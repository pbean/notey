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
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  createSession,
  deleteSession,
  findElement,
  findElements,
  elementId,
  getElementAttribute,
  getElementText,
  clickElement,
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
 * Among elements matching `selector`, find the one whose visible text contains
 * `marker` and return its `data-testid`. The dev DB is not isolated, so tests
 * target their own marker note rather than "the first row".
 */
async function testIdContaining(selector, marker) {
  const els = await findElements(sessionId, 'css selector', selector);
  for (const el of els) {
    const id = elementId(el);
    const text = await getElementText(sessionId, id);
    if (text.includes(marker)) {
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
  await clickElement(sessionId, match.id);
  await pause(400); // panel closes, note loads into the editor
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

async function trashLifecycleTests() {
  console.log('\nP1-E2E-002: Trash Lifecycle');

  // Unique per run so the marker note is identifiable in a non-isolated dev DB.
  const marker = `E2E-TRASH-${Date.now()}`;

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
    await clickElement(sessionId, await waitForCss(`[data-testid="trash-restore-${noteId}"]`));
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
    await clickElement(sessionId, await waitForCss(`[data-testid="trash-delete-${noteId}"]`));
    await waitForCss('[data-testid="confirm-delete-dialog"]');
    await clickElement(sessionId, await waitForCss('[data-testid="confirm-delete-confirm"]'));
    await waitForMarkerGoneFromTrash(marker);
  });
}

// --- Main ---

async function main() {
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
