// content.js - Element Snap Premium (Multi-Mode Capture)

(function () {
  if (window.top !== window.self) return; // Only run in main frame
  if (window.__elementSnapLoaded) return;
  window.__elementSnapLoaded = true;

  // ── State ──────────────────────────────────────────────────────────────────
  let selectionMode  = false;
  let customMode     = false;
  let highlightedEl  = null;
  let highlightBox   = null;
  let modePicker     = null;
  let customDragBox  = null;
  let customW = 0, customH = 0;

  // ── Highlight Box ──────────────────────────────────────────────────────────
  function ensureHighlightBox() {
    if (highlightBox) return;
    highlightBox = document.createElement('div');
    highlightBox.id = 'es-highlight';
    Object.assign(highlightBox.style, {
      position: 'fixed', zIndex: '2147483646', pointerEvents: 'none',
      border: '2px solid #22d3ee', background: 'rgba(34,211,238,0.12)',
      boxShadow: '0 0 0 1px rgba(0,0,0,0.4)', borderRadius: '4px',
      display: 'none', transition: 'all 80ms ease'
    });
    document.documentElement.appendChild(highlightBox);
  }

  function updateHighlight(target) {
    ensureHighlightBox();
    const r = target.getBoundingClientRect();
    Object.assign(highlightBox.style, {
      display: 'block', top: r.top + 'px', left: r.left + 'px',
      width: r.width + 'px', height: r.height + 'px'
    });
  }

  // ── Mode Picker Panel ──────────────────────────────────────────────────────
  function showModePicker() {
    if (modePicker) return;

    modePicker = document.createElement('div');
    modePicker.id = 'es-mode-picker';
    modePicker.innerHTML = `
      <div id="es-mp-inner">
        <div id="es-mp-header">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="2.5" stroke-linecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          <span>Element Snap</span>
          <button id="es-mp-close" title="Cancel (Esc)">✕</button>
        </div>
        <p id="es-mp-sub">Choose capture mode</p>
        <div id="es-mp-grid">
          <button class="es-mp-btn" data-mode="element">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/></svg>
            <span>Element</span>
          </button>
          <button class="es-mp-btn" data-mode="fullpage">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
            <span>Full Page</span>
          </button>
          <button class="es-mp-btn" data-mode="tab">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
            <span>Tab View</span>
          </button>
          <button class="es-mp-btn" data-mode="custom">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            <span>Custom Size</span>
          </button>
        </div>
        <div id="es-mp-custom-row" style="display:none">
          <label>W <input id="es-w" type="number" value="800" min="1" max="9999" placeholder="800"></label>
          <span>×</span>
          <label>H <input id="es-h" type="number" value="600" min="1" max="9999" placeholder="600"></label>
          <span>px</span>
          <button id="es-custom-go">Capture →</button>
        </div>
      </div>
    `;

    // Styles injected inline so they don't conflict with the host page
    const style = document.createElement('style');
    style.id = 'es-mode-picker-style';
    style.textContent = `
      #es-mode-picker {
        position: fixed; inset: 0; z-index: 2147483647;
        display: flex; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.55); backdrop-filter: blur(6px);
      }
      #es-mp-inner {
        background: rgba(20,21,26,0.92); border: 1px solid rgba(255,255,255,0.1);
        border-radius: 16px; padding: 24px 28px; width: 320px;
        box-shadow: 0 25px 60px rgba(0,0,0,0.6);
        font-family: 'Inter', system-ui, sans-serif; color: #fff;
      }
      #es-mp-header {
        display: flex; align-items: center; gap: 8px; margin-bottom: 4px;
        font-size: 15px; font-weight: 600;
      }
      #es-mp-header span { flex: 1; }
      #es-mp-close {
        background: none; border: none; color: #6b7280; cursor: pointer;
        font-size: 16px; padding: 2px 6px; border-radius: 4px;
      }
      #es-mp-close:hover { background: rgba(255,255,255,0.1); color: #fff; }
      #es-mp-sub { margin: 0 0 16px; font-size: 12px; color: #6b7280; }
      #es-mp-grid {
        display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
      }
      .es-mp-btn {
        display: flex; flex-direction: column; align-items: center; gap: 8px;
        padding: 14px 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.04); color: #d1d5db; cursor: pointer;
        font-size: 12px; font-weight: 500; transition: all 0.18s ease;
        font-family: inherit;
      }
      .es-mp-btn:hover {
        background: rgba(34,211,238,0.1); border-color: rgba(34,211,238,0.4);
        color: #22d3ee; transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(34,211,238,0.2);
      }
      #es-mp-custom-row {
        margin-top: 14px; display: flex; align-items: center; gap: 8px;
        flex-wrap: wrap;
      }
      #es-mp-custom-row label {
        display: flex; align-items: center; gap: 4px;
        font-size: 12px; color: #9ca3af;
      }
      #es-mp-custom-row input {
        width: 64px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
        color: #fff; border-radius: 6px; padding: 5px 8px; font-size: 13px;
        text-align: center; font-family: inherit;
      }
      #es-mp-custom-row span { color: #6b7280; font-size: 12px; }
      #es-custom-go {
        margin-left: auto; background: #22d3ee; color: #0f172a; border: none;
        padding: 6px 14px; border-radius: 7px; font-weight: 600; font-size: 12px;
        cursor: pointer; font-family: inherit;
      }
      #es-custom-go:hover { background: #06b6d4; }
    `;

    document.head.appendChild(style);
    document.documentElement.appendChild(modePicker);

    // Event listeners
    modePicker.querySelector('#es-mp-close').addEventListener('click', hideAll);

    modePicker.querySelectorAll('.es-mp-btn').forEach(btn => {
      btn.addEventListener('click', () => handleModeSelect(btn.dataset.mode));
    });

    modePicker.querySelector('#es-custom-go').addEventListener('click', () => {
      const w = parseInt(modePicker.querySelector('#es-w').value) || 800;
      const h = parseInt(modePicker.querySelector('#es-h').value) || 600;
      hideModePicker();
      startCustomCapture(w, h);
    });

    // Click backdrop to close
    modePicker.addEventListener('click', (e) => {
      if (e.target === modePicker) hideAll();
    });
  }

  function hideModePicker() {
    if (modePicker) { modePicker.remove(); modePicker = null; }
    const style = document.getElementById('es-mode-picker-style');
    if (style) style.remove();
  }

  function handleModeSelect(mode) {
    if (mode === 'element') {
      hideModePicker();
      enableSelectionMode();
    } else if (mode === 'fullpage') {
      hideModePicker();
      sendCapture({ type: 'capture-fullpage' });
    } else if (mode === 'tab') {
      hideModePicker();
      sendCapture({ type: 'capture-visible-tab' });
    } else if (mode === 'custom') {
      const row = modePicker.querySelector('#es-mp-custom-row');
      row.style.display = row.style.display === 'none' ? 'flex' : 'none';
    }
  }

  // ── Element Selection Mode (existing behavior) ─────────────────────────────
  function enableSelectionMode() {
    selectionMode = true;
    highlightedEl = null;
    document.documentElement.style.cursor = 'crosshair';
    document.body.style.cursor = 'crosshair';
  }

  function disableSelectionMode() {
    selectionMode = false;
    highlightedEl = null;
    document.documentElement.style.cursor = '';
    document.body.style.cursor = '';
    if (highlightBox) highlightBox.style.display = 'none';
  }

  function buildGeometry(target) {
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: Math.max(0, Math.floor(window.scrollX + rect.left)),
      y: Math.max(0, Math.floor(window.scrollY + rect.top)),
      width:  Math.ceil(rect.width),
      height: Math.ceil(rect.height)
    };
  }

  function captureHighlightedElement(target) {
    disableSelectionMode();
    const geometry = buildGeometry(target);
    if (!geometry) { alert(chrome.i18n.getMessage('errorSize')); return; }
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      sendCapture({ type: 'capture-node-screenshot', geometry });
    }));
  }

  // ── Custom Size Mode ───────────────────────────────────────────────────────
  function startCustomCapture(w, h) {
    customMode = true;
    customW = w; customH = h;

    // Create a moveable drag box
    customDragBox = document.createElement('div');
    Object.assign(customDragBox.style, {
      position: 'fixed', zIndex: '2147483647',
      width: w + 'px', height: h + 'px',
      border: '2px solid #22d3ee', background: 'rgba(34,211,238,0.08)',
      boxShadow: '0 0 0 9999px rgba(0,0,0,0.45), 0 0 20px rgba(34,211,238,0.3)',
      borderRadius: '4px', cursor: 'crosshair', boxSizing: 'border-box',
      left: Math.max(0, (window.innerWidth  - w) / 2) + 'px',
      top:  Math.max(0, (window.innerHeight - h) / 2) + 'px',
      userSelect: 'none'
    });

    // Label
    const label = document.createElement('div');
    Object.assign(label.style, {
      position: 'absolute', top: '-28px', left: '0',
      background: '#22d3ee', color: '#0f172a', fontSize: '12px', fontWeight: '600',
      padding: '2px 8px', borderRadius: '4px', fontFamily: 'Inter, system-ui, sans-serif',
      whiteSpace: 'nowrap'
    });
    label.textContent = `${w} × ${h} px — Click to capture`;
    customDragBox.appendChild(label);

    document.documentElement.appendChild(customDragBox);

    // Drag support
    let dragging = false, ox = 0, oy = 0;
    customDragBox.addEventListener('mousedown', (e) => {
      dragging = true; ox = e.clientX - customDragBox.offsetLeft; oy = e.clientY - customDragBox.offsetTop;
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      customDragBox.style.left = (e.clientX - ox) + 'px';
      customDragBox.style.top  = (e.clientY - oy) + 'px';
    });
    window.addEventListener('mouseup', (e) => {
      if (!dragging) return;
      dragging = false;
    }, { once: false });

    customDragBox.addEventListener('click', (e) => {
      e.stopPropagation();
      const rect = customDragBox.getBoundingClientRect();
      const geometry = {
        x: Math.max(0, Math.floor(window.scrollX + rect.left)),
        y: Math.max(0, Math.floor(window.scrollY + rect.top)),
        width: customW, height: customH
      };
      customDragBox.remove(); customDragBox = null; customMode = false;
      setTimeout(() => sendCapture({ type: 'capture-node-screenshot', geometry }), 80);
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function sendCapture(message) {
    chrome.runtime.sendMessage(message);
  }

  function hideAll() {
    hideModePicker();
    disableSelectionMode();
    if (customDragBox) { customDragBox.remove(); customDragBox = null; customMode = false; }
  }

  // ── Event Listeners ────────────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.key === 'Escape') { e.preventDefault(); hideAll(); }
  }, true);

  document.addEventListener('mousemove', (e) => {
    if (!selectionMode) return;
    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (!target || target === highlightBox) return;
    highlightedEl = target;
    updateHighlight(target);
  }, true);

  document.addEventListener('click', (e) => {
    if (!selectionMode) return;
    const target = document.elementFromPoint(e.clientX, e.clientY) || highlightedEl;
    if (!target || target === highlightBox) return;
    e.preventDefault(); e.stopPropagation();
    captureHighlightedElement(target);
  }, true);

  // ── Message Listener ───────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === 'toggle-selection-mode') {
      if (modePicker) { hideAll(); }
      else { showModePicker(); }
      sendResponse({ ok: true });
    }
    if (message?.type === 'start-element-mode') {
      hideAll();
      enableSelectionMode();
      sendResponse({ ok: true });
    }
    return false;
  });

})();
