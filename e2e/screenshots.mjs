#!/usr/bin/env node
/**
 * Documentation screenshot capture for Notey, via tauri-driver.
 *
 * Drives the real debug binary through the same tauri-driver + WebKitWebDriver
 * stack as `e2e/run.mjs`, seeds deterministic sample data over the real IPC
 * bridge, opens each view/overlay, and writes a PNG per view to `docs/images/`.
 *
 * Usage: node e2e/screenshots.mjs   (or `npm run screenshots`)
 *
 * Prerequisites (identical to the E2E suite):
 *   - tauri-driver installed (cargo install --locked tauri-driver)
 *   - WebKitWebDriver available (webkit2gtk-driver package)
 *   - Debug binary built (npx tauri build --debug --no-bundle) → target/debug/notey
 *   - A display: a real X server (DISPLAY set) renders real pixels; under a
 *     headless box wrap with `xvfb-run -a node e2e/screenshots.mjs`.
 *
 * The capture window launches hidden (`visible:false`); this script shows it
 * before each shot so the OS compositor renders real content. It writes to the
 * app's own data dir (identifier com.pinkyd.notey) — running it adds the sample
 * notes to your local Notey database.
 */

import { spawn, spawnSync } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Force WebKitGTK software rendering before anything spawns the driver — same
// rationale as e2e/run.mjs: the accelerated-compositing + DMABUF paths crash the
// web process under a GPU-less framebuffer and wedge every WebDriver command.
process.env.WEBKIT_DISABLE_COMPOSITING_MODE ??= '1';
process.env.WEBKIT_DISABLE_DMABUF_RENDERER ??= '1';
process.env.LIBGL_ALWAYS_SOFTWARE ??= '1';

// Isolate the IPC socket so a real Notey instance on the default socket is never
// disturbed (mirrors run.mjs; carried to the app via --socket-path).
if (!process.env.NOTEY_SOCKET_PATH) {
  process.env.NOTEY_SOCKET_PATH = path.join(os.tmpdir(), `notey-shots-${process.pid}.sock`);
}
const SOCKET_PATH = process.env.NOTEY_SOCKET_PATH;

import {
  createSession,
  deleteSession,
  executeScript,
  executeAsyncScript,
  findElement,
  elementId,
  sendKeysToElement,
  sendSpecialKey,
  sendChord,
  takeScreenshot,
  pause,
} from './driver.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_PATH = path.resolve(__dirname, '..', 'src-tauri', 'target', 'debug', 'notey');
const OUT_DIR = path.resolve(__dirname, '..', 'docs', 'images');
const ESCAPE = '';
const ENTER = '';
const CONTROL = '';

let tauriDriver;
let sessionId;
let captured = 0;
let failed = 0;

// --- Driver lifecycle (mirrors e2e/run.mjs) ---

/**
 * Best-effort reap of leftover driver processes. tauri-driver spawns a
 * WebKitWebDriver child that does NOT exit when tauri-driver is killed, so a
 * prior crashed/SIGKILLed run can orphan one holding port 4445 — which makes the
 * next run's driver fail to bind and every command return "fetch failed". Clear
 * them before starting so the script is self-healing across runs.
 */
function reapOrphanDrivers() {
  for (const name of ['tauri-driver', 'WebKitWebDriver']) {
    spawnSync('pkill', ['-9', '-f', name], { stdio: 'ignore' });
  }
}

async function startDriver() {
  reapOrphanDrivers();
  await pause(500);
  tauriDriver = spawn('tauri-driver', [], { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  let spawnError = null;
  tauriDriver.stderr.on('data', (c) => { stderr += c; });
  tauriDriver.on('error', (e) => { spawnError = e; });
  for (let i = 0; i < 60; i++) {
    if (spawnError) break;
    try {
      await fetch('http://127.0.0.1:4444/status');
      return;
    } catch {
      await pause(500);
    }
  }
  if (stderr) console.error('tauri-driver stderr:\n' + stderr);
  throw spawnError || new Error('tauri-driver did not start within 30 seconds');
}

function stopDriver() {
  if (tauriDriver) {
    tauriDriver.kill('SIGKILL');
    tauriDriver = null;
  }
  // SIGKILL orphans the WebKitWebDriver child — reap it so the next run starts clean.
  reapOrphanDrivers();
}

function launchSession() {
  return createSession(APP_PATH, ['--socket-path', SOCKET_PATH]);
}

// --- Helpers ---

async function waitForCss(selector, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      return elementId(await findElement(sessionId, 'css selector', selector));
    } catch (e) {
      lastErr = e;
      await pause(150);
    }
  }
  throw lastErr || new Error(`Timed out waiting for ${selector}`);
}

async function clickCss(selector, timeoutMs = 8000) {
  await waitForCss(selector, timeoutMs);
  await executeScript(sessionId, 'document.querySelector(arguments[0]).click();', [selector]);
}

/** Invoke a real Tauri command from the page; resolve `{ ok, value | err }`. */
async function invokeCommand(cmd, args) {
  return executeAsyncScript(
    sessionId,
    `var done = arguments[arguments.length - 1];
     window.__TAURI_INTERNALS__.invoke(arguments[0], arguments[1])
       .then(function (v) { done({ ok: true, value: v }); })
       .catch(function (e) { done({ ok: false, err: String((e && e.message) || e) }); });`,
    [cmd, args],
  );
}

/** Open the command palette and run the command labelled `label`. */
async function runPaletteCommand(label) {
  await sendChord(sessionId, CONTROL, 'p');
  const input = await waitForCss('[data-testid="command-input"]');
  await pause(120);
  await sendKeysToElement(sessionId, input, label);
  await pause(350);
  await sendSpecialKey(sessionId, ENTER);
  await pause(400);
}

/**
 * Show + focus the (hidden-on-launch) capture window so the compositor renders
 * real pixels for the screenshot. Best-effort across the Tauri v2 internal
 * window-command shapes; failures are non-fatal (a mapped X server still
 * composites the webview surface for WebKitWebDriver).
 */
async function showWindow() {
  for (const args of [{}, { label: 'main' }]) {
    const r = await invokeCommand('plugin:window|show', args).catch(() => null);
    if (r?.ok) break;
  }
  await invokeCommand('plugin:window|set_focus', {}).catch(() => null);
  await pause(300);
}

/** Capture the viewport to docs/images/<name>.png. */
async function capture(name) {
  try {
    await showWindow();
    const b64 = await takeScreenshot(sessionId);
    const buf = Buffer.from(b64, 'base64');
    if (buf.length < 1000) throw new Error(`screenshot suspiciously small (${buf.length} bytes)`);
    fs.writeFileSync(path.join(OUT_DIR, `${name}.png`), buf);
    captured++;
    console.log(`  ✓ ${name}.png (${(buf.length / 1024).toFixed(0)} KB)`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}.png — ${e.message}`);
  }
}

/** Launch a fresh session, resetting onboarding so the first-run reveal maps the window. */
async function newSession() {
  forceFirstRunReveal();
  sessionId = await launchSession();
  await pause(3500); // app init + first-run reveal
}

/** Tear down the current session and let the app/socket settle before the next. */
async function endSession() {
  if (sessionId) await deleteSession(sessionId).catch(() => {});
  sessionId = null;
  await pause(1500);
}

/** Dismiss the first-run onboarding overlay if present. */
async function dismissOnboarding() {
  try {
    await waitForCss('[data-testid="onboarding-overlay"]', 5000);
    await sendSpecialKey(sessionId, ESCAPE);
    await pause(700);
  } catch {
    /* not shown — nothing to dismiss */
  }
}

/**
 * Run `fn` inside a fresh session, always tearing it down afterwards. Used for
 * side-effecting steps (seeding) that don't capture.
 */
async function withSession(label, fn) {
  try {
    await newSession();
    await fn();
  } catch (e) {
    console.log(`  ! ${label}: ${e.message}`);
  } finally {
    await endSession();
  }
}

/**
 * Capture one view in its own fresh session. A new WebKitWebDriver web process
 * per shot avoids the cumulative instability that crashes a long single session
 * (the same reason e2e/run.mjs relaunches between suites). `navigate` opens the
 * target view; `theme` is applied (and persisted) before navigating.
 */
async function shot(name, { theme, navigate } = {}) {
  try {
    await newSession();
    await dismissOnboarding();
    if (theme) {
      await setTheme(theme);
      await pause(400);
    }
    if (navigate) await navigate();
    await capture(name);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}.png — ${e.message}`);
  } finally {
    await endSession();
  }
}

/** Set the theme via the real config command and let the webview re-apply it. */
async function setTheme(theme) {
  await invokeCommand('update_config', { partial: { general: { theme } } }).catch(() => null);
  await pause(500);
}

/**
 * Resolve the platform config dir the app will use (mirrors src-tauri's
 * `resolve_config_dir("notey")` via the `dirs` crate) and remove
 * `onboarding.toml`. This forces the app's first-run reveal, which *maps* the
 * capture window — a never-mapped window makes WebKitWebDriver's screenshot
 * command crash the session. Non-destructive: the notes database lives in the
 * separate data dir and is untouched; onboarding state regenerates on dismiss.
 */
function forceFirstRunReveal() {
  let base;
  if (process.platform === 'darwin') {
    base = path.join(os.homedir(), 'Library', 'Application Support');
  } else if (process.platform === 'win32') {
    base = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  } else {
    base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  }
  const onboarding = path.join(base, 'notey', 'onboarding.toml');
  try {
    fs.rmSync(onboarding, { force: true });
    console.log(`Reset onboarding state (${onboarding}) to force first-run reveal.`);
  } catch (e) {
    console.log(`Could not reset onboarding state: ${e.message}`);
  }
}

// --- Sample data ---

async function seed() {
  // Two workspaces rooted at real, existing directories (create_workspace
  // canonicalizes the path). The repo dir and the home dir always exist.
  const repoRoot = path.resolve(__dirname, '..');
  await invokeCommand('create_workspace', { name: 'Notey', path: repoRoot }).catch(() => null);
  await invokeCommand('create_workspace', { name: 'Personal', path: os.homedir() }).catch(() => null);

  const notes = [
    `# Release checklist\n\n- [x] Tag v0.1.0\n- [ ] Draft GitHub release notes\n- [ ] Capture fresh screenshots\n- [ ] Announce on the changelog`,
    `# Meeting notes — sync\n\nDecisions:\n- Ship the workspace selector in the status bar\n- Keep the capture window at 720×480\n\nFollow-ups:\n- Wire FTS5 snippets into search results`,
    `# Ideas\n\nA quick-capture note tool that disappears when you Esc. Global hotkey summons it, tabs hold what you're juggling, and full-text search finds it later.`,
    `# Shell snippets\n\n\`\`\`sh\nrg --files | fzf\ngit log --oneline --graph\n\`\`\``,
    `Plain scratch buffer — todo: reply to the docs thread.`,
  ];
  for (const content of notes) {
    const created = await invokeCommand('create_note', { format: 'markdown', workspaceId: null });
    if (created?.ok && created.value?.id != null) {
      await invokeCommand('update_note', {
        id: created.value.id,
        title: null,
        content,
        format: null,
      });
    }
  }
  await pause(400);
}

// --- Capture sequence ---

// Navigation closures used by the per-view sessions.

async function typeSampleNote() {
  await sendChord(sessionId, CONTROL, 'n');
  await pause(400);
  const content = await waitForCss('.cm-content');
  await sendKeysToElement(
    sessionId,
    content,
    '# Standup\n\n- Shipped the trash lifecycle\n- Reviewing the CLI live-sync seam\n- Next: docs + screenshots',
  );
  await pause(900); // auto-save debounce + round-trip
}

async function openPalette() {
  await sendChord(sessionId, CONTROL, 'p');
  await waitForCss('[data-testid="command-palette"]');
  await pause(300);
}

async function openSearch() {
  await runPaletteCommand('Search Notes');
  const search = await waitForCss('[data-testid="search-input"]');
  await sendKeysToElement(sessionId, search, 'release');
  await pause(500);
}

async function openNoteList() {
  await sendChord(sessionId, CONTROL, 'b');
  await waitForCss('[data-testid="note-list-panel"]');
  await pause(300);
}

async function openSettings() {
  await runPaletteCommand('Open Settings');
  await waitForCss('[data-testid="settings-overlay"]');
  await pause(300);
}

async function openWorkspaceMenu() {
  await executeScript(sessionId, 'document.querySelector(arguments[0]).focus();', [
    '[data-testid="workspace-name"]',
  ]);
  await sendSpecialKey(sessionId, ENTER);
  await pause(400);
}

async function openTrash() {
  // Create a throwaway note, move it to trash, then view the panel.
  await sendChord(sessionId, CONTROL, 'n');
  await pause(300);
  const tmp = await waitForCss('.cm-content');
  await sendKeysToElement(sessionId, tmp, 'Draft to discard');
  await pause(800);
  await runPaletteCommand('Move to Trash');
  await pause(400);
  await runPaletteCommand('View Trash');
  await waitForCss('[data-testid="trash-panel"]');
  await pause(300);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('Starting tauri-driver...');
  await startDriver();

  try {
    // First-run onboarding overlay — captured in its own session before dismissal.
    console.log('\nOnboarding (first run):');
    await withSession('onboarding', async () => {
      await waitForCss('[data-testid="onboarding-overlay"]', 6000);
      await capture('onboarding');
    });

    // Seed sample notes + workspaces once; they persist in the notes DB and are
    // reused by every subsequent view session.
    console.log('\nSeeding sample data...');
    await withSession('seed', async () => {
      await dismissOnboarding();
      await seed();
    });

    console.log('\nLight theme:');
    await shot('editor-light', { theme: 'light', navigate: typeSampleNote });
    await shot('command-palette', { theme: 'light', navigate: openPalette });
    await shot('search', { theme: 'light', navigate: openSearch });
    await shot('note-list', { theme: 'light', navigate: openNoteList });
    await shot('settings-general', { theme: 'light', navigate: openSettings });
    await shot('workspace-selector', { theme: 'light', navigate: openWorkspaceMenu });
    await shot('trash', { theme: 'light', navigate: openTrash });

    console.log('\nDark theme:');
    await shot('editor-dark', { theme: 'dark', navigate: typeSampleNote });
    await shot('command-palette-dark', { theme: 'dark', navigate: openPalette });
  } catch (e) {
    console.error('Fatal error:', e.message);
    failed++;
  } finally {
    if (sessionId) await deleteSession(sessionId).catch(() => {});
    stopDriver();
  }

  console.log(
    `\nCaptured ${captured} screenshot(s) into ${path.relative(process.cwd(), OUT_DIR)}/` +
      (failed ? `, ${failed} failed` : ''),
  );
  process.exit(failed > 0 ? 1 : 0);
}

main();
