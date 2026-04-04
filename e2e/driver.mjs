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

export async function createSession(application) {
  const value = await request('POST', '/session', {
    capabilities: {
      alwaysMatch: {
        browserName: 'wry',
        'tauri:options': { application },
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

export async function getElementText(sessionId, elementId) {
  return request('GET', `/session/${sessionId}/element/${elementId}/text`);
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

export async function getPageSource(sessionId) {
  return request('GET', `/session/${sessionId}/source`);
}

export function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
