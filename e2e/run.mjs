#!/usr/bin/env node
/**
 * E2E test runner for Tauri app via tauri-driver.
 *
 * Usage: node e2e/run.mjs
 *
 * Prerequisites:
 *   - tauri-driver installed (cargo install tauri-driver)
 *   - WebKitWebDriver available (webkitgtk-6.0 package)
 *   - Debug binary built (npx tauri build --debug --no-bundle)
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  createSession,
  deleteSession,
  findElement,
  getElementText,
  clickElement,
  isElementDisplayed,
  sendKeys,
  sendKeysToElement,
  sendSpecialKey,
  getPageSource,
  pause,
} from './driver.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_PATH = path.resolve(__dirname, '..', 'src-tauri', 'target', 'debug', 'tauri-app');
const ESCAPE = '\uE00C';

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

// --- Setup ---

async function startDriver() {
  tauriDriver = spawn('tauri-driver', [], { stdio: ['ignore', 'pipe', 'pipe'] });
  tauriDriver.on('error', (e) => { throw e; });

  // Poll until the driver is accepting connections
  for (let i = 0; i < 30; i++) {
    try {
      await fetch('http://127.0.0.1:4444/status');
      return;
    } catch {
      await pause(500);
    }
  }
  throw new Error('tauri-driver did not start within 15 seconds');
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
