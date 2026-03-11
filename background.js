// background.js - Element Snap Premium (Multi-Mode Capture)

const DEBUGGER_VERSION = '1.3';

// ── Debugger Helpers ──────────────────────────────────────────────────────────
function attachDebugger(target) {
  return new Promise((resolve, reject) => {
    chrome.debugger.attach(target, DEBUGGER_VERSION, () => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      resolve();
    });
  });
}

function detachDebugger(target) {
  return new Promise((resolve) => {
    chrome.debugger.detach(target, () => resolve());
  });
}

function sendDebuggerCommand(target, method, params = {}) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand(target, method, params, (result) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      resolve(result);
    });
  });
}

// ── Save & Open Editor ────────────────────────────────────────────────────────
function openEditor(dataUrl) {
  chrome.storage.local.set({ capturedImage: dataUrl }, () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('editor.html') });
  });
}

// ── Mode: Element / Custom Size ───────────────────────────────────────────────
// Both use the debugger with a clip rect
async function captureWithClip(tabId, geometry) {
  const target = { tabId };
  let attached = false;
  try {
    await attachDebugger(target);
    attached = true;
    await sendDebuggerCommand(target, 'Page.enable');

    const { data } = await sendDebuggerCommand(target, 'Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: true,
      clip: {
        x: geometry.x, y: geometry.y,
        width: geometry.width, height: geometry.height,
        scale: 1
      }
    });
    if (!data) throw new Error('screenshot-failed');
    openEditor('data:image/png;base64,' + data);
  } catch (err) {
    console.error('[Element Snap] Capture error:', err);
  } finally {
    if (attached) await detachDebugger(target);
  }
}

// ── Mode: Full Page ───────────────────────────────────────────────────────────
// No clip → captures entire page beyond the viewport scroll
async function captureFullPage(tabId) {
  const target = { tabId };
  let attached = false;
  try {
    await attachDebugger(target);
    attached = true;
    await sendDebuggerCommand(target, 'Page.enable');

    // Get full page dimensions via Runtime
    const { result } = await sendDebuggerCommand(target, 'Runtime.evaluate', {
      expression: 'JSON.stringify({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight })',
      returnByValue: true
    });
    const { w, h } = JSON.parse(result.value);

    const { data } = await sendDebuggerCommand(target, 'Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: w, height: h, scale: 1 }
    });
    if (!data) throw new Error('screenshot-failed');
    openEditor('data:image/png;base64,' + data);
  } catch (err) {
    console.error('[Element Snap] Full page error:', err);
  } finally {
    if (attached) await detachDebugger(target);
  }
}

// ── Mode: Visible Tab ─────────────────────────────────────────────────────────
// Simple — no debugger needed
async function captureVisibleTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    openEditor(dataUrl);
  } catch (err) {
    console.error('[Element Snap] Tab capture error:', err);
  }
}

// ── Message Router ────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender) => {
  if (!sender.tab) return;
  const tabId = sender.tab.id;

  switch (message.type) {
    case 'capture-node-screenshot':
      captureWithClip(tabId, message.geometry);
      break;
    case 'capture-fullpage':
      captureFullPage(tabId);
      break;
    case 'capture-visible-tab':
      captureVisibleTab(tabId);
      break;
  }
});

// ── Action Click / Keyboard Shortcut ─────────────────────────────────────────
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id || tab.url?.startsWith('chrome://')) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'toggle-selection-mode' });
  } catch {
    // Content script not injected yet — inject it first
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      setTimeout(() => chrome.tabs.sendMessage(tab.id, { type: 'toggle-selection-mode' }), 120);
    } catch (err) {
      console.error('[Element Snap] Injection failed:', err);
    }
  }
});
