/**
 * Minimal WebDriver client for tauri-driver.
 * Uses raw fetch against the W3C WebDriver protocol.
 * Avoids framework-level capability injection (WDIO v9 forces webSocketUrl:true
 * which tauri-driver/WebKitWebDriver rejects).
 */

const BASE = 'http://127.0.0.1:4444';

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (json.value?.error) {
    throw new Error(`WebDriver error: ${json.value.error} — ${json.value.message}`);
  }
  return json.value;
}

/**
 * Create a WebDriver session that launches the Tauri app.
 *
 * @param {string} application - Absolute path to the app binary.
 * @param {string[]} [args] - Command-line arguments forwarded to the launched
 *   binary via `tauri:options.args` (tauri-driver passes them through as process
 *   args). Used to route a per-run `--socket-path`, which survives a modern
 *   WebKitWebDriver resetting the app's environment. Omitted from the capability
 *   when empty.
 * @returns {Promise<string>} The created session id.
 */
export async function createSession(application, args = []) {
  const tauriOptions = { application };
  if (args.length > 0) tauriOptions.args = args;
  const value = await request('POST', '/session', {
    capabilities: {
      alwaysMatch: {
        browserName: 'wry',
        'tauri:options': tauriOptions,
      },
    },
  });
  return value.sessionId;
}

export async function deleteSession(sessionId) {
  await request('DELETE', `/session/${sessionId}`).catch(() => {});
}

export async function findElement(sessionId, using, value) {
  return request('POST', `/session/${sessionId}/element`, { using, value });
}

export async function findElements(sessionId, using, value) {
  return request('POST', `/session/${sessionId}/elements`, { using, value });
}

/**
 * Unwrap a WebDriver element reference to its id, tolerating both the legacy
 * `ELEMENT` key and the W3C `element-6066-…` key.
 */
export function elementId(el) {
  return el.ELEMENT || el['element-6066-11e4-a52e-4f735466cecf'];
}

export async function getElementAttribute(sessionId, elementId, name) {
  return request('GET', `/session/${sessionId}/element/${elementId}/attribute/${name}`);
}

export async function getElementText(sessionId, elementId) {
  return request('GET', `/session/${sessionId}/element/${elementId}/text`);
}

/**
 * Read a DOM property (e.g. `textContent`) of an element. Unlike
 * `getElementText` — which returns WebDriver "visible text" and omits content
 * that is clipped (`overflow:hidden`/`white-space:nowrap`) or in a non-rendered
 * window — `textContent` returns the full text regardless of layout/visibility.
 * The capture window launches hidden (`visible:false`), so panel titles must be
 * matched via this property rather than visible text.
 */
export async function getElementProperty(sessionId, elementId, name) {
  return request('GET', `/session/${sessionId}/element/${elementId}/property/${name}`);
}

export async function clickElement(sessionId, elementId) {
  return request('POST', `/session/${sessionId}/element/${elementId}/click`, {});
}

export async function isElementDisplayed(sessionId, elementId) {
  return request('GET', `/session/${sessionId}/element/${elementId}/displayed`);
}

export async function sendKeys(sessionId, keys) {
  return request('POST', `/session/${sessionId}/actions`, {
    actions: [
      {
        type: 'key',
        id: 'keyboard',
        actions: [
          ...keys.split('').flatMap((ch) => [
            { type: 'keyDown', value: ch },
            { type: 'keyUp', value: ch },
          ]),
        ],
      },
    ],
  });
}

export async function sendKeysToElement(sessionId, elementId, text) {
  return request('POST', `/session/${sessionId}/element/${elementId}/value`, { text });
}

export async function sendSpecialKey(sessionId, key) {
  return request('POST', `/session/${sessionId}/actions`, {
    actions: [
      {
        type: 'key',
        id: 'keyboard',
        actions: [
          { type: 'keyDown', value: key },
          { type: 'keyUp', value: key },
        ],
      },
    ],
  });
}

/**
 * Press a modifier+key chord (e.g. Ctrl+P): hold `modifier` down across a
 * single `key` press, then release both. `sendKeys`/`sendSpecialKey` only emit
 * standalone keys and cannot express chorded shortcuts.
 */
export async function sendChord(sessionId, modifier, key) {
  return request('POST', `/session/${sessionId}/actions`, {
    actions: [
      {
        type: 'key',
        id: 'keyboard',
        actions: [
          { type: 'keyDown', value: modifier },
          { type: 'keyDown', value: key },
          { type: 'keyUp', value: key },
          { type: 'keyUp', value: modifier },
        ],
      },
    ],
  });
}

export async function getPageSource(sessionId) {
  return request('GET', `/session/${sessionId}/source`);
}

/**
 * Run a synchronous script in the page and return its result. `args` are passed
 * as the script's `arguments`. Used to dispatch DOM clicks directly: the capture
 * window launches hidden (`visible:false`), so a W3C "element click" fails the
 * interactability check, but a programmatic `.click()` still fires the element's
 * React onClick handler.
 */
export async function executeScript(sessionId, script, args = []) {
  return request('POST', `/session/${sessionId}/execute/sync`, { script, args });
}

/**
 * Run an asynchronous script in the page and return what it passes to its
 * completion callback. The callback is the script's LAST argument
 * (`arguments[arguments.length - 1]`); the command resolves when the script
 * invokes it. Unlike `executeScript` (sync), this is the W3C-standard way to
 * await a promise — used to drive a real Tauri command (`__TAURI_INTERNALS__.invoke`)
 * and observe its resolved value without depending on a particular driver's
 * (non-standard) sync-await-of-thenables behavior.
 */
export async function executeAsyncScript(sessionId, script, args = []) {
  return request('POST', `/session/${sessionId}/execute/async`, { script, args });
}

export function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
