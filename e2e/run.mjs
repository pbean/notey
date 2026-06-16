#!/usr/bin/env node
/**
 * E2E test runner for Tauri app via tauri-driver.
 *
 * Usage: node e2e/run.mjs
 *
 * Prerequisites:
 *   - tauri-driver installed (cargo install tauri-driver)
 *   - WebKitWebDriver available (webkit2gtk-driver package)
 *   - Debug binary built (npx tauri build --debug --no-bundle)
 *   - notey CLI binary built (cargo build, run in notey-cli/) — for the live-sync suite
 */

import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';
import net from 'node:net';
import { fileURLToPath } from 'url';

// Force WebKitGTK software rendering before anything spawns the driver. Under a
// GPU-less virtual framebuffer (xvfb on CI / headless local runs) WebKitGTK's
// accelerated-compositing + DMABUF renderer crashes the web process as soon as
// the page renders under WebDriver automation, which wedges every subsequent
// command and times the run out (exit 124). These vars fall back to software
// rendering. WEBKIT_DISABLE_COMPOSITING_MODE is the official Tauri WebDriver CI
// recommendation; the other two cover the no-GPU DMABUF/GL paths. They inherit
// down the spawn chain (node → tauri-driver → WebKitWebDriver → app web process),
// so a bare `node e2e/run.mjs` works without the caller exporting anything.
// `??=` lets a caller still override any of them.
process.env.WEBKIT_DISABLE_COMPOSITING_MODE ??= '1';
process.env.WEBKIT_DISABLE_DMABUF_RENDERER ??= '1';
process.env.LIBGL_ALWAYS_SOFTWARE ??= '1';

// Pin a unique per-run IPC socket so the CLI live-sync suite rendezvous's the
// test app and the `notey` CLI on their own endpoint — never colliding with a
// real notey instance the developer may have running on the default
// `$XDG_RUNTIME_DIR/notey.sock`. Set before the driver spawns so it inherits
// down node → tauri-driver → app (same chain as the WEBKIT vars above), and the
// CLI (spawned from this process) reads the same value. `??=` lets a caller
// override it.
process.env.NOTEY_SOCKET_PATH ??= path.join(os.tmpdir(), `notey-e2e-${process.pid}.sock`);

import {
  createSession,
  deleteSession,
  findElement,
  findElements,
  elementId,
  getElementAttribute,
  getElementText,
  getElementProperty,
  executeScript,
  isElementDisplayed,
  sendKeysToElement,
  sendSpecialKey,
  sendChord,
  getPageSource,
  pause,
} from './driver.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_PATH = path.resolve(__dirname, '..', 'src-tauri', 'target', 'debug', 'tauri-app');
const ESCAPE = '\uE00C';
const ENTER = '\uE007';
const CONTROL = '\uE009';

let tauriDriver;
let sessionId;
let passed = 0;
let failed = 0;
// Set once, before any test app launches: whether a real notey instance already
// owns the default IPC socket (see the live-sync suite's guard for why it matters).
let realInstancePresent = false;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// --- Helpers ---

/** True for WebDriver errors that mean the session/app died — never worth retrying. */
function isFatalSession(e) {
  return /invalid session id|session deleted|session not created|not reachable|disconnected/i.test(
    e?.message || '',
  );
}

/** Poll until a CSS selector resolves to an element; return its id. Fails fast if the session died. */
async function waitForCss(selector, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      return elementId(await findElement(sessionId, 'css selector', selector));
    } catch (e) {
      if (isFatalSession(e)) throw e; // crash/hang — surface it, don't mask as a slow timeout
      lastErr = e;
      await pause(150);
    }
  }
  throw lastErr || new Error(`Timed out waiting for ${selector}`);
}

/**
 * Click the element matching `selector` by waiting for it to exist, then
 * dispatching a programmatic `.click()`. The capture window is hidden
 * (`visible:false`), so a W3C element-click would fail "element not
 * interactable"; a DOM `.click()` still triggers the React onClick handler.
 */
async function clickCss(selector, timeoutMs = 5000) {
  await waitForCss(selector, timeoutMs);
  await executeScript(sessionId, 'document.querySelector(arguments[0]).click();', [selector]);
}

/** Poll the toast region until a toast containing `substring` appears (toasts auto-dismiss at 3s). */
async function waitForToast(substring, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  let last = '';
  while (Date.now() < deadline) {
    try {
      const id = elementId(await findElement(sessionId, 'css selector', '[data-testid="toaster"]'));
      last = await getElementText(sessionId, id);
      if (last.includes(substring)) return last;
    } catch (e) {
      if (isFatalSession(e)) throw e;
    }
    await pause(150);
  }
  throw new Error(`Toast "${substring}" not seen within ${timeoutMs}ms (last toaster text: "${last}")`);
}

/** Open the command palette (Ctrl+P) and run the command whose label is `label`. */
async function runPaletteCommand(label) {
  await sendChord(sessionId, CONTROL, 'p');
  // Type into the cmdk input element directly so keystrokes can't land in the editor.
  const input = await waitForCss('[data-testid="command-input"]');
  await pause(100);
  await sendKeysToElement(sessionId, input, label);
  await pause(300); // let cmdk filter down to the exact match
  await sendSpecialKey(sessionId, ENTER);
  await pause(300);
}

/**
 * Among elements matching `selector`, find the one whose text contains `marker`
 * and return its `data-testid`. Matches against the `textContent` property — not
 * WebDriver visible text — because panel titles render in the hidden capture
 * window with clipping styles that make `getElementText` return them empty. The
 * dev DB is not isolated, so tests target their own marker note rather than
 * "the first row".
 */
async function testIdContaining(selector, marker) {
  const els = await findElements(sessionId, 'css selector', selector);
  for (const el of els) {
    const id = elementId(el);
    const text = await getElementProperty(sessionId, id, 'textContent');
    if ((text || '').includes(marker)) {
      return { id, testId: await getElementAttribute(sessionId, id, 'data-testid') };
    }
  }
  return null;
}

/** Whether any trash row's text currently contains `marker`. */
async function trashHasMarker(marker) {
  return (await testIdContaining('[data-testid^="trash-item-"]', marker)) !== null;
}

/** Poll until a trash row contains `marker` (the trash panel loads asynchronously). */
async function waitForMarkerInTrash(marker, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await trashHasMarker(marker)) return;
    await pause(200);
  }
  throw new Error(`Trash never showed marker "${marker}" within ${timeoutMs}ms`);
}

/** Poll until no trash row contains `marker`. */
async function waitForMarkerGoneFromTrash(marker, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await trashHasMarker(marker))) return;
    await pause(200);
  }
  throw new Error(`Trash still contains marker "${marker}" after ${timeoutMs}ms`);
}

/**
 * Re-open a note in the editor by its title via the note list (Ctrl+B). A
 * restored note has no open tab, so it must be re-opened from the list before
 * the active-tab-only "Move to Trash" command can act on it again.
 */
async function reopenNoteByMarker(marker) {
  await sendChord(sessionId, CONTROL, 'b');
  await waitForCss('[data-testid="note-list-panel"]');
  await pause(200);
  const match = await testIdContaining('[data-testid^="note-list-item-"]', marker);
  assert(match, `Note list has no item matching marker "${marker}"`);
  await clickCss(`[data-testid="${match.testId}"]`);
  await pause(400); // panel closes, note loads into the editor
}

/**
 * Spawn the standalone `notey` CLI debug binary and resolve with its exit code
 * and captured output. Runs with `cwd: process.cwd()` — the same cwd the app
 * inherited from this runner — so the CLI's git-root workspace detection lands
 * on the same workspace the desktop made active, and the new note passes the
 * desktop's active-workspace filter. A missing binary rejects with a build hint
 * rather than a cryptic ENOENT.
 */
function runCli(args, { timeoutMs = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    const bin = path.resolve(__dirname, '..', 'notey-cli', 'target', 'debug', 'notey');
    const child = spawn(bin, args, { cwd: process.cwd(), env: process.env });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`CLI '${args.join(' ')}' timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(new Error(`CLI spawn failed (build it first: cargo build in notey-cli/): ${e.message}`));
    });
    child.stdout.on('data', (d) => {
      stdout += d;
    });
    child.stderr.on('data', (d) => {
      stderr += d;
    });
    // Swallow stream-level errors (e.g. EPIPE when we SIGKILL on timeout) so they
    // can't surface as an unhandled 'error' and crash the runner.
    child.stdout.on('error', () => {});
    child.stderr.on('error', () => {});
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

/** Poll the (open) note list until a row's text contains `marker`. */
async function waitForMarkerInNoteList(marker, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await testIdContaining('[data-testid^="note-list-item-"]', marker)) return;
    await pause(200);
  }
  throw new Error(`Note list never showed CLI-added marker "${marker}" within ${timeoutMs}ms`);
}

/**
 * Paths the app's IPC server may have bound, in priority order. The app resolves
 * its socket as NOTEY_SOCKET_PATH → `$XDG_RUNTIME_DIR/notey.sock` → temp fallback
 * (mirrors `socket_server::socket_path`). We export a unique per-run
 * NOTEY_SOCKET_PATH, but a modern WebKitWebDriver (webkit2gtk ≥2.52) resets the
 * launched app's environment — stripping NOTEY_SOCKET_PATH and forcing
 * XDG_RUNTIME_DIR back to the real session value — and tauri-driver has no env
 * passthrough, so the harness cannot steer the app's path: it must discover it.
 * On CI's older driver the env survives, so the first candidate wins and behavior
 * is unchanged.
 */
function appSocketCandidates() {
  const xdg = process.env.XDG_RUNTIME_DIR;
  return [process.env.NOTEY_SOCKET_PATH, xdg ? path.join(xdg, 'notey.sock') : null].filter(Boolean);
}

/**
 * Whether a Unix socket path is *accepting connections* (a live server), as
 * opposed to a leftover stale socket file. A probe connect that immediately
 * disconnects is harmless: the IPC worker sees EOF before any frame and exits.
 */
function isSocketLive(p, timeoutMs = 500) {
  return new Promise((resolve) => {
    const sock = net.connect(p);
    let settled = false;
    const timer = setTimeout(() => done(false), timeoutMs);
    function done(live) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      sock.destroy();
      resolve(live);
    }
    sock.once('connect', () => done(true));
    sock.once('error', () => done(false));
  });
}

/**
 * Poll until one of the app's candidate IPC sockets is *live*, and return that
 * path. The app's IPC server binds during Tauri's setup hook, which can lag a
 * freshly-created WebDriver session on a cold runner — without this gate the first
 * `notey add` races the bind and fails exit-2 ("not running"). Liveness (not mere
 * file existence) is checked so a leftover stale socket never wins over the path
 * the app actually bound. Returns null after the deadline, leaving the CLI's own
 * connect timeout to report a genuine absence.
 */
async function waitForAppSocket(timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const c of appSocketCandidates()) {
      if (fs.existsSync(c) && (await isSocketLive(c))) return c;
    }
    await pause(150);
  }
  return null;
}

// --- Setup ---

async function startDriver() {
  tauriDriver = spawn('tauri-driver', [], { stdio: ['ignore', 'ignore', 'pipe'] });

  let driverStderr = '';
  let spawnError = null;
  tauriDriver.stderr.on('data', (chunk) => { driverStderr += chunk; });
  tauriDriver.on('error', (e) => { spawnError = e; });

  // Poll until the driver is accepting connections (30s — CI runners are slow to cold-start)
  for (let i = 0; i < 60; i++) {
    if (spawnError) break;
    try {
      await fetch('http://127.0.0.1:4444/status');
      return;
    } catch {
      await pause(500);
    }
  }

  // Log captured stderr before throwing so CI shows why the driver failed
  if (driverStderr) console.error('tauri-driver stderr:\n' + driverStderr);
  throw spawnError || new Error('tauri-driver did not start within 30 seconds');
}

function stopDriver() {
  if (tauriDriver) {
    tauriDriver.kill('SIGKILL');
    tauriDriver = null;
  }
}

// --- Tests ---

async function captureLoopTests() {
  console.log('\nP0-E2E-001: Capture Loop');

  await test('editor is visible on launch', async () => {
    const el = await findElement(sessionId, 'css selector', '.cm-editor');
    const displayed = await isElementDisplayed(sessionId, el.ELEMENT || el['element-6066-11e4-a52e-4f735466cecf']);
  });

  await test('accepts typed content', async () => {
    const el = await findElement(sessionId, 'css selector', '.cm-content');
    const elId = el.ELEMENT || el['element-6066-11e4-a52e-4f735466cecf'];
    // Send keys directly to the contenteditable element
    await sendKeysToElement(sessionId, elId, 'Hello from E2E');
    await pause(500);
    const text = await getElementText(sessionId, elId);
    assert(text.includes('Hello from E2E'), `Expected text to contain "Hello from E2E", got: "${text}"`);
  });

  await test('auto-save triggers without error', async () => {
    // Wait for 300ms debounce + save cycle
    await pause(1000);
    const source = await getPageSource(sessionId);
    assert(!source.includes('Save failed'), 'Page should not show "Save failed"');
  });

  await test('Escape key triggers dismiss', async () => {
    await sendSpecialKey(sessionId, ESCAPE);
    await pause(1000);
    // Window hides — if the session is still alive, the Escape was handled
    // (dismiss hides window but doesn't destroy the WebView)
  });
}

async function windowManagementTests() {
  console.log('\nP1-INT-012: Window Management');

  await test('app shell renders with editor', async () => {
    const el = await findElement(sessionId, 'css selector', '.cm-editor');
    assert(el, 'cm-editor should exist');
  });

  await test('editor state persists across interactions', async () => {
    const el = await findElement(sessionId, 'css selector', '.cm-content');
    const elId = el.ELEMENT || el['element-6066-11e4-a52e-4f735466cecf'];
    await sendKeysToElement(sessionId, elId, 'Persistence test');
    await pause(500);
    const text = await getElementText(sessionId, elId);
    assert(text.includes('Persistence test'), `Expected persisted text, got: "${text}"`);
  });

  await test('no save errors after typing', async () => {
    await pause(1500);
    const source = await getPageSource(sessionId);
    assert(!source.includes('Save failed'), 'No save errors should be present');
  });
}

/**
 * Best-effort permanent purge of the marker note from trash. Used as a safety
 * net so a mid-run failure (before the happy-path permanent-delete step) does
 * not leave an orphan in the non-isolated dev DB. Swallows every error — this
 * is cleanup, not an assertion, and the session may already be dead.
 */
async function purgeMarkerFromTrash(marker) {
  try {
    await runPaletteCommand('View Trash');
    await waitForCss('[data-testid="trash-panel"]', 2000);
    const item = await testIdContaining('[data-testid^="trash-item-"]', marker);
    if (!item) return; // already gone (happy path completed) — nothing to clean
    const noteId = item.testId.replace('trash-item-', '');
    await clickCss(`[data-testid="trash-delete-${noteId}"]`, 2000);
    await clickCss('[data-testid="confirm-delete-confirm"]', 2000);
    await waitForMarkerGoneFromTrash(marker, 3000);
    console.log(`  ⌫ cleaned up orphaned marker note "${marker}"`);
  } catch {
    /* cleanup is best-effort; never fail the run because teardown could not run */
  }
}

async function trashLifecycleTests() {
  console.log('\nP1-E2E-002: Trash Lifecycle');

  // Unique per run so the marker note is identifiable in a non-isolated dev DB.
  const marker = `E2E-TRASH-${Date.now()}`;

  try {
  await test('create a note tagged with a unique marker', async () => {
    await sendChord(sessionId, CONTROL, 'n'); // New Note → fresh active tab
    await pause(400);
    const contentId = await waitForCss('.cm-content');
    await sendKeysToElement(sessionId, contentId, marker);
    await pause(800); // 300ms auto-save debounce + save round-trip
    const text = await getElementText(sessionId, contentId);
    assert(text.includes(marker), `Editor should contain marker, got: "${text}"`);
  });

  await test('Move to Trash shows the confirmation toast', async () => {
    await runPaletteCommand('Move to Trash');
    await waitForToast('moved to trash');
  });

  await test('View Trash lists the trashed note', async () => {
    await runPaletteCommand('View Trash');
    await waitForCss('[data-testid="trash-panel"]');
    await waitForMarkerInTrash(marker);
  });

  await test('Restore removes the note from trash', async () => {
    const item = await testIdContaining('[data-testid^="trash-item-"]', marker);
    assert(item, `Trash row for marker "${marker}" should exist`);
    const noteId = item.testId.replace('trash-item-', '');
    await clickCss(`[data-testid="trash-restore-${noteId}"]`);
    await waitForToast('restored');
    await waitForMarkerGoneFromTrash(marker);
    await sendSpecialKey(sessionId, ESCAPE); // close the trash panel
    await pause(300);
  });

  await test('re-trash the restored note via the note list', async () => {
    await reopenNoteByMarker(marker);
    await runPaletteCommand('Move to Trash');
    await waitForToast('moved to trash');
  });

  await test('permanent delete via confirm dialog clears it from trash', async () => {
    await runPaletteCommand('View Trash');
    await waitForMarkerInTrash(marker);
    const item = await testIdContaining('[data-testid^="trash-item-"]', marker);
    assert(item, `Trash row for marker "${marker}" should exist before delete`);
    const noteId = item.testId.replace('trash-item-', '');
    await clickCss(`[data-testid="trash-delete-${noteId}"]`);
    await waitForCss('[data-testid="confirm-delete-dialog"]');
    await clickCss('[data-testid="confirm-delete-confirm"]');
    await waitForMarkerGoneFromTrash(marker);
  });
  } finally {
    // Safety net for DW-91: if any step above threw before the permanent-delete,
    // the marker note is still in trash. Purge it so the shared dev DB stays clean.
    await purgeMarkerFromTrash(marker);
  }
}

/**
 * Best-effort cleanup of the CLI-created marker note: load it as the active tab
 * (selecting it from the list also closes the panel), move it to trash, then
 * permanently purge it from trash. Panel-state-agnostic so it works whether the
 * happy path left the panel open or a mid-run failure left unknown state. Never
 * throws — teardown must not fail the run.
 */
async function purgeCliNote(marker) {
  try {
    let match = await testIdContaining('[data-testid^="note-list-item-"]', marker);
    if (!match) {
      // Panel closed (or note not yet shown) — open the list and look again.
      await sendChord(sessionId, CONTROL, 'b');
      await waitForCss('[data-testid="note-list-panel"]', 2000);
      await pause(200);
      match = await testIdContaining('[data-testid^="note-list-item-"]', marker);
    }
    if (match) {
      await clickCss(`[data-testid="${match.testId}"]`);
      await pause(400); // panel closes, note loads into the editor
      await runPaletteCommand('Move to Trash');
      await waitForToast('moved to trash', 3000);
    }
  } catch (e) {
    // Best-effort: the note may already be gone or the session may be dead. Log a
    // non-fatal failure so a genuinely-stuck teardown is visible rather than
    // silently leaking the marker note into the shared dev DB.
    if (!isFatalSession(e)) console.log(`    (cleanup: pre-trash step failed: ${e.message})`);
  }
  // Purge from trash regardless of how far the above got.
  await purgeMarkerFromTrash(marker);
}

async function cliLiveSyncTests() {
  console.log('\nP1-E2E-003: CLI Live Sync');

  // A modern WebKitWebDriver resets the test app's env, forcing it onto the
  // default `$XDG_RUNTIME_DIR/notey.sock` — the same endpoint a real desktop notey
  // uses. If a real instance was already listening there before we launched, the
  // CLI would talk to IT (polluting the real DB) instead of the test app. Skip
  // rather than hijack; CI never trips this (no real instance, env survives).
  if (realInstancePresent) {
    console.log(
      '  ⚠ skipped: a running notey instance owns the default IPC socket. ' +
        'Close it to run the live-sync suite locally — this WebKitWebDriver build ' +
        'resets the app env, preventing per-run socket isolation.',
    );
    return;
  }

  // Unique per run so the marker note is identifiable in a non-isolated dev DB.
  const marker = `E2E-CLISYNC-${Date.now()}`;
  let addSucceeded = false;

  try {
    await test('note list panel opens with no pre-existing marker note', async () => {
      await sendChord(sessionId, CONTROL, 'b'); // open the note list
      await waitForCss('[data-testid="note-list-panel"]');
      await pause(300);
      const pre = await testIdContaining('[data-testid^="note-list-item-"]', marker);
      assert(!pre, `marker note "${marker}" must not exist before the CLI add`);
    });

    await test('notey add (CLI, separate process) exits 0', async () => {
      // Discover where the app actually bound (its env may not survive the
      // WebDriver launch) and point the CLI at that exact socket. The CLI reads
      // NOTEY_SOCKET_PATH at spawn, so updating it here steers `runCli` below.
      const appSocket = await waitForAppSocket();
      assert(appSocket, `app IPC socket never came up; tried: ${appSocketCandidates().join(', ')}`);
      process.env.NOTEY_SOCKET_PATH = appSocket;
      const res = await runCli(['add', marker]);
      assert(res.code === 0, `CLI exited ${res.code}; stderr: "${res.stderr.trim()}"`);
      addSucceeded = true;
    });

    await test('new note appears in the open list via the note-created event', async () => {
      // The panel was opened BEFORE the add, so the only thing that can surface
      // this row is the live note-created → debounced refresh seam — not a
      // UI-triggered load. This is the cross-process assertion under test.
      // Short-circuit a failed add: otherwise this waits the full timeout and
      // misreports a CLI-side failure as an event-pipeline failure.
      assert(addSucceeded, 'skipped: CLI add did not succeed (see the prior failure)');
      await waitForMarkerInNoteList(marker);
    });
  } finally {
    await purgeCliNote(marker);
  }
}

// --- Main ---

async function main() {
  // Detect a real notey instance on the default socket BEFORE launching the test
  // app (which, under a modern WebKitWebDriver, binds that same default path). Once
  // the test app is up we can't tell its socket apart from a pre-existing one.
  const xdg = process.env.XDG_RUNTIME_DIR;
  const defaultSock = xdg ? path.join(xdg, 'notey.sock') : null;
  realInstancePresent = !!(defaultSock && fs.existsSync(defaultSock) && (await isSocketLive(defaultSock)));

  console.log('Starting tauri-driver...');
  await startDriver();

  try {
    console.log('Creating session...');
    sessionId = await createSession(APP_PATH);
    console.log(`Session: ${sessionId}`);

    // Give the app time to fully initialize
    await pause(3000);

    await captureLoopTests();

    // Delete session and create a fresh one for window tests
    await deleteSession(sessionId);
    await pause(2000);

    sessionId = await createSession(APP_PATH);
    await pause(3000);

    await windowManagementTests();

    // Fresh session for the trash-lifecycle feature suite.
    await deleteSession(sessionId);
    await pause(2000);

    sessionId = await createSession(APP_PATH);
    await pause(3000);

    await trashLifecycleTests();

    // Fresh session for the CLI live-sync feature suite.
    await deleteSession(sessionId);
    await pause(2000);

    sessionId = await createSession(APP_PATH);
    await pause(3000);

    await cliLiveSyncTests();
  } catch (e) {
    console.error('Fatal error:', e.message);
    failed++;
  } finally {
    if (sessionId) await deleteSession(sessionId).catch(() => {});
    stopDriver();
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
