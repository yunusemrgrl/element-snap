// content.js - Element Snap Premium (Node Capture)

(function () {
    if (window.top !== window.self) return; // Sadece ana pencerede çalış
  
    const shortcutKey = "KeyS";
    let selectionMode = false;
    let highlightedElement = null;
    let highlightBox = null;
  
    // Vurgulayıcı kutuyu DOM'a ekleme
    function ensureHighlightBox() {
      if (highlightBox) return;
      highlightBox = document.createElement("div");
      highlightBox.id = "element-snap-highlight";
      Object.assign(highlightBox.style, {
        position: "fixed",
        zIndex: "2147483647",
        pointerEvents: "none",
        border: "2px solid #22d3ee", // Cyan tema rengi
        background: "rgba(34, 211, 238, 0.15)",
        boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
        borderRadius: "4px",
        display: "none",
        transition: "all 100ms ease"
      });
      document.documentElement.appendChild(highlightBox);
    }
  
    function updateHighlight(target) {
      ensureHighlightBox();
      const rect = target.getBoundingClientRect();
      highlightBox.style.display = "block";
      highlightBox.style.top = rect.top + "px";
      highlightBox.style.left = rect.left + "px";
      highlightBox.style.width = rect.width + "px";
      highlightBox.style.height = rect.height + "px";
    }
  
    // Seçim modunu aç/kapat
    function enableSelectionMode() {
      selectionMode = true;
      highlightedElement = null;
      document.documentElement.style.cursor = "crosshair";
      document.body.style.cursor = "crosshair";
    }
  
    function disableSelectionMode() {
      selectionMode = false;
      highlightedElement = null;
      document.documentElement.style.cursor = "";
      document.body.style.cursor = "";
      if (highlightBox) highlightBox.style.display = "none";
    }
  
    // Hedef geometri hesaplama (Sayfa üzerindeki net scroll pozisyonu ile)
    function buildGeometry(target) {
      const rect = target.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
  
      // Biraz (padding) pay bırakma (opsiyonel)
      const padding = 0; 
      
      const left = Math.max(0, Math.floor(window.scrollX + rect.left - padding));
      const top = Math.max(0, Math.floor(window.scrollY + rect.top - padding));
      const width = Math.ceil(rect.width + (padding * 2));
      const height = Math.ceil(rect.height + (padding * 2));
  
      return {
        x: left,
        y: top,
        width: width,
        height: height,
        tagName: target.tagName,
        id: target.id || null,
        className: typeof target.className === "string" ? target.className : null,
        pageUrl: window.location.href,
        pageTitle: document.title || null
      };
    }
  
    // Geometriyi Arka plana (Background) iletme
    function captureHighlightedElement(target) {
      disableSelectionMode();
      
      const geometry = buildGeometry(target);
      if (!geometry) {
        alert("Element boyutu hatalı.");
        return;
      }
      
      // Bekleme (Paint Rendering)
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          chrome.runtime.sendMessage({
            type: "capture-node-screenshot",
            geometry: geometry
          });
        });
      });
    }
  
    // Kısayol Dinleyici (Sadece Escape)
    document.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      if (selectionMode && e.key === "Escape") {
        e.preventDefault();
        disableSelectionMode();
      }
    }, true);
  
    // Hover ile Element Tarama
    document.addEventListener("mousemove", (e) => {
      if (!selectionMode) return;
      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (!target || target === highlightBox) return;
      
      highlightedElement = target;
      updateHighlight(target);
    }, true);
  
    // Tıklama ile Elementi Yakala
    document.addEventListener("click", (e) => {
      if (!selectionMode) return;
      const target = document.elementFromPoint(e.clientX, e.clientY) || highlightedElement;
      if (!target || target === highlightBox) return;
  
      e.preventDefault();
      e.stopPropagation();
      captureHighlightedElement(target);
    }, true);
  
    // İkon Tıklaması ile Seçimi Aç/Kapat (Pop-up'tan gelebilir)
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message?.type === "toggle-selection-mode") {
        selectionMode ? disableSelectionMode() : enableSelectionMode();
        sendResponse({ ok: true, selectionMode });
      }
      return false;
    });
  
  })();
