/**
 * Element Snap Premium Editor
 * Object-Based Canvas Rendering Engine
 */

document.addEventListener('DOMContentLoaded', () => {
    const bgCanvas = document.getElementById('bgCanvas');
    const drawCanvas = document.getElementById('drawCanvas');
    const canvasWrapper = document.getElementById('canvasWrapper');
    const colorPrev = document.getElementById('colorPrev');
    const colPicker = document.getElementById('colPicker');
    const cropOverlay = document.getElementById('cropOverlay');
  
    const bgCtx = bgCanvas.getContext('2d');
    const drawCtx = drawCanvas.getContext('2d', { willReadFrequently: true });
  
    // State 
    let currentTool = 'select'; // select, crop, rect, pen, arrow, text, eraser
    let zoomLevel = 1;
    let currentColor = '#22d3ee';
    let currentThickness = 3;
    let exportFormat = 'png'; 

    // --- Object-Based Render System Variables ---
    let drawItems = []; // Tüm Çizim Objeleri
    let redoStack = []; // Geri alınan (Redo) history objeleri listesi
    
    // Etkileşim State'leri
    let isDrawing = false;
    let isDragging = false;
    let isErasing = false;
    
    let startX = 0, startY = 0;
    let activeItem = null; // Şu an çizilen veya sürüklenen obje
    let hoverItem = null; // Üzerinde gezilen obje (Hover/Eraser için)
    let dragOffsetX = 0, dragOffsetY = 0;
  
    // ---------------------------------------------------------
    // INIT
    // ---------------------------------------------------------
    function initCanvas(img) {
      bgCanvas.width = img.width;
      bgCanvas.height = img.height;
      drawCanvas.width = img.width;
      drawCanvas.height = img.height;
      
      bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
      bgCtx.drawImage(img, 0, 0);
      
      drawCtx.lineCap = 'round';
      drawCtx.lineJoin = 'round';
      
      drawItems = [];
      redoStack = [];
      renderAll();
      fitToScreen();
    }
  
    function loadImageData(dataUrl) {
      const img = new Image();
      img.onload = () => initCanvas(img);
      img.src = dataUrl;
    }
  
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['capturedImage'], (result) => {
        if (result.capturedImage) loadImageData(result.capturedImage);
        else console.log(chrome.i18n.getMessage("testMode"));
      });
    }
  
    document.getElementById('fileUpload').addEventListener('change', (e) => {
      const file = e.files ? e.files[0] : e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = ev => loadImageData(ev.target.result);
        reader.readAsDataURL(file);
      }
    });
  
    // ---------------------------------------------------------
    // UI: TOOLS
    // ---------------------------------------------------------
    const toolBtns = document.querySelectorAll('.tool-btn');
    toolBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        toolBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTool = btn.dataset.tool;
        
        drawCanvas.style.cursor = getCursorForTool(currentTool);
        if (currentTool !== 'crop') cropOverlay.style.display = 'none';
        
        activeItem = null; // Araç değişince aktif seçimi bırak
        renderAll();
      });
    });
  
    function getCursorForTool(tool) {
      switch(tool) {
        case 'pen': case 'rect': case 'arrow': return 'crosshair';
        case 'text': return 'text';
        case 'crop': return 'crosshair';
        case 'eraser': return 'cell'; // Silgi imleci
        default: return 'default'; // select (Move)
      }
    }
  
    colPicker.addEventListener('input', (e) => {
      currentColor = e.target.value;
      colorPrev.style.background = currentColor;
    });

    const settingsModal = document.getElementById('settingsModal');
    document.getElementById('btn-settings').addEventListener('click', () => {
        settingsModal.style.display = 'flex';
    });
    document.getElementById('closeSettings').addEventListener('click', () => {
        settingsModal.style.display = 'none';
    });
    window.addEventListener('click', (e) => {
        if (e.target === settingsModal) settingsModal.style.display = 'none';
    });
  
    const formatBtns = document.querySelectorAll('.format-btn');
    formatBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        formatBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        exportFormat = btn.dataset.fmt;
      });
    });
  
    // ---------------------------------------------------------
    // RENDER ENGINE (Nesne Çizim Sistemi)
    // ---------------------------------------------------------
    function renderAll() {
      drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
      
      // Tüm nesneleri döngü ile tekrar çiz, aktif/hover stilini ayarla
      for (const item of drawItems) {
        drawCtx.save();
        
        if (activeItem === item && currentTool === 'select') {
          drawCtx.shadowColor = 'rgba(0, 150, 255, 0.5)';
          drawCtx.shadowBlur = 10;
        } else if (hoverItem === item && currentTool === 'eraser') {
          drawCtx.globalAlpha = 0.5; // Silgi ile hover olunca soluklaşsın
          drawCtx.shadowColor = 'red';
          drawCtx.shadowBlur = 8;
        }
        
        drawCtx.strokeStyle = item.color;
        drawCtx.fillStyle = item.color;
        drawCtx.lineWidth = item.width;
        
        switch (item.type) {
            case 'pen':
                if (item.points.length > 0) {
                    drawCtx.beginPath();
                    drawCtx.moveTo(item.x + item.points[0].x, item.y + item.points[0].y);
                    for (let i = 1; i < item.points.length; i++) {
                        drawCtx.lineTo(item.x + item.points[i].x, item.y + item.points[i].y);
                    }
                    drawCtx.stroke();
                }
                break;
            case 'rect':
                drawCtx.beginPath();
                drawCtx.strokeRect(item.x, item.y, item.w, item.h);
                break;
            case 'arrow':
                drawCtx.beginPath();
                drawArrowCore(drawCtx, item.x, item.y, item.x + item.dx, item.y + item.dy);
                break;
            case 'text':
                drawCtx.font = "20px Inter, sans-serif";
                drawCtx.fillText(item.text, item.x, item.y);
                break;
        }
        drawCtx.restore();
      }
    }

    function drawArrowCore(ctx, fx, fy, tx, ty) {
      const headlen = 12; 
      const dx = tx - fx; const dy = ty - fy;
      const ang = Math.atan2(dy, dx);
      ctx.moveTo(fx, fy); ctx.lineTo(tx, ty);
      ctx.lineTo(tx - headlen * Math.cos(ang - Math.PI/6), ty - headlen * Math.sin(ang - Math.PI/6));
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx - headlen * Math.cos(ang + Math.PI/6), ty - headlen * Math.sin(ang + Math.PI/6));
      ctx.stroke();
    }

    // Hit-Test (Tıklanan nesneyi bulma)
    function findItemAtPosition(x, y) {
        // En son çizilen en üsttedir, geriye doğru arayalım
        for (let i = drawItems.length - 1; i >= 0; i--) {
            const item = drawItems[i];
            const hitThreshold = Math.max(8, item.width + 4);
            
            if (item.type === 'rect') {
                // Dikdörtgen sınırları içinde mi? (Sadece çerçevesine bakmak karmaşık, içini de kabul edelim)
                const minX = Math.min(item.x, item.x + item.w) - hitThreshold;
                const maxX = Math.max(item.x, item.x + item.w) + hitThreshold;
                const minY = Math.min(item.y, item.y + item.h) - hitThreshold;
                const maxY = Math.max(item.y, item.y + item.h) + hitThreshold;
                if (x >= minX && x <= maxX && y >= minY && y <= maxY) return item;
            } 
            else if (item.type === 'text') {
                // Approximate bounding box for text
                if (x >= item.x - 5 && x <= item.x + 100 && y >= item.y - 20 && y <= item.y + 5) return item;
            }
            else if (item.type === 'arrow') {
                // Line bounding box hit test
                const minX = Math.min(item.x, item.x + item.dx) - hitThreshold;
                const maxX = Math.max(item.x, item.x + item.dx) + hitThreshold;
                const minY = Math.min(item.y, item.y + item.dy) - hitThreshold;
                const maxY = Math.max(item.y, item.y + item.dy) + hitThreshold;
                if (x >= minX && x <= maxX && y >= minY && y <= maxY) return item;
            }
            else if (item.type === 'pen') {
                // Pen objesindeki her bir noktanın hit threshold'una bak
                for (const p of item.points) {
                    const px = item.x + p.x;
                    const py = item.y + p.y;
                    if (Math.abs(x - px) < hitThreshold && Math.abs(y - py) < hitThreshold) {
                        return item;
                    }
                }
            }
        }
        return null;
    }
  
    // ---------------------------------------------------------
    // MOUSE EVENTS
    // ---------------------------------------------------------
    function getMousePos(e) {
      const rect = drawCanvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / zoomLevel,
        y: (e.clientY - rect.top) / zoomLevel
      };
    }
  
    window.addEventListener('mousedown', (e) => {
      // Tuval sınırları içindeyse işlem yap
      if(e.target !== drawCanvas && currentTool !== 'crop') return; 
      
      const pos = getMousePos(e);
      startX = pos.x;
      startY = pos.y;
      
      if (currentTool === 'crop') {
         isDrawing = true;
         cropOverlay.style.display = 'block';
         updateCropOverlay(startX, startY, 0, 0);
         return;
      }
      
      if (currentTool === 'select') {
          activeItem = findItemAtPosition(pos.x, pos.y);
          if (activeItem) {
              isDragging = true;
              dragOffsetX = pos.x - activeItem.x;
              dragOffsetY = pos.y - activeItem.y;
              redoStack = []; // Geçmiş sıfırla
          }
          renderAll();
          return;
      }

      if (currentTool === 'eraser') {
          isErasing = true;
          const hit = findItemAtPosition(pos.x, pos.y);
          if (hit) {
              drawItems = drawItems.filter(i => i !== hit);
              redoStack = [];
              hoverItem = null;
              renderAll();
          }
          return;
      }

      // Yeni Obje Çizimi
      isDrawing = true;
      activeItem = {
          id: Date.now(),
          type: currentTool,
          x: startX,
          y: startY,
          color: currentColor,
          width: currentThickness,
          w: 0, h: 0, dx: 0, dy: 0,
          points: currentTool === 'pen' ? [{x: 0, y: 0}] : null
      };
      
      // Yeni öğeyi eklendiği an anında listeye katıyoruz (Canlı izleme için)
      if(currentTool !== 'text') {
        drawItems.push(activeItem);
        redoStack = [];
      }
    });
  
    window.addEventListener('mousemove', (e) => {
      const pos = getMousePos(e);
      
      // Eraser veya Select Hover (Arayüz içi canlı bildirim)
      if (!isDrawing && !isDragging && !isErasing) {
          if (currentTool === 'eraser' || currentTool === 'select') {
              const prevHover = hoverItem;
              hoverItem = findItemAtPosition(pos.x, pos.y);
              if (prevHover !== hoverItem) {
                  drawCanvas.style.cursor = hoverItem ? (currentTool === 'eraser' ? 'not-allowed' : 'move') : getCursorForTool(currentTool);
                  renderAll();
              }
          }
          return;
      }

      // Drag Object (Taşıma Modu)
      if (isDragging && activeItem) {
          activeItem.x = pos.x - dragOffsetX;
          activeItem.y = pos.y - dragOffsetY;
          renderAll();
          return;
      }

      // Eraser Drag (Silgi Sürükleyerek tarama)
      if (isErasing) {
         const hit = findItemAtPosition(pos.x, pos.y);
         if (hit) {
             drawItems = drawItems.filter(i => i !== hit);
             hoverItem = null;
             renderAll();
         }
         return;
      }

      // Çizim Modları
      if (!isDrawing || !activeItem) return;
      
      const w = pos.x - startX;
      const h = pos.y - startY;
  
      if (currentTool === 'pen') {
          activeItem.points.push({x: pos.x - activeItem.x, y: pos.y - activeItem.y});
          renderAll();
      } else if (currentTool === 'crop') {
          updateCropOverlay(startX, startY, w, h);
      } else if (currentTool === 'rect') {
          activeItem.w = w;
          activeItem.h = h;
          renderAll();
      } else if (currentTool === 'arrow') {
          activeItem.dx = w;
          activeItem.dy = h;
          renderAll();
      }
    });
  
    window.addEventListener('mouseup', (e) => {
      if (isDragging) {
          isDragging = false;
          return;
      }
      if (isErasing) {
          isErasing = false;
          return;
      }
      if (!isDrawing) return;
      isDrawing = false;
      
      const pos = getMousePos(e);
      const w = pos.x - startX;
      const h = pos.y - startY;
  
      if (currentTool === 'crop') {
         if (Math.abs(w) > 20 && Math.abs(h) > 20) {
           if (confirm(chrome.i18n.getMessage("confirmCrop"))) applyCrop(startX, startY, w, h);
         }
         cropOverlay.style.display = 'none';
         const selectBtn = document.querySelector('[data-tool="select"]');
         if (selectBtn) selectBtn.click();
         
      } else if (currentTool === 'text') {
          // Metinler fare bırakılınca oluşur.
          const txt = prompt(chrome.i18n.getMessage("promptText"));
          if (txt && txt.trim() !== "") { 
              activeItem.text = txt; 
              drawItems.push(activeItem);
              redoStack = [];
              renderAll();
          }
      } else {
          // Eğer rect veya arrow çok küçükse iptal et (boş tıklamalar)
          if ((currentTool === 'rect' || currentTool === 'arrow') && Math.abs(w) < 5 && Math.abs(h) < 5) {
              drawItems.pop(); 
              renderAll();
          }
      }
      
      activeItem = null;
    });
  
    function updateCropOverlay(x, y, w, h) {
      const left = Math.min(x, x + w);
      const top = Math.min(y, y + h);
      const width = Math.abs(w);
      const height = Math.abs(h);
      cropOverlay.style.left = left + 'px';
      cropOverlay.style.top = top + 'px';
      cropOverlay.style.width = width + 'px';
      cropOverlay.style.height = height + 'px';
    }
  
    function applyCrop(x, y, w, h) {
      const cx = Math.min(x, x + w);
      const cy = Math.min(y, y + h);
      const cw = Math.abs(w);
      const ch = Math.abs(h);
      
      const merged = mergeCanvases();
      const img = new Image();
      img.onload = () => {
        bgCanvas.width = drawCanvas.width = cw;
        bgCanvas.height = drawCanvas.height = ch;
        bgCtx.clearRect(0,0,cw,ch);
        bgCtx.drawImage(img, cx, cy, cw, ch, 0, 0, cw, ch);
        
        drawItems = []; // Kırpma işlemi olunca tüm obje layerı ana resme gömülür ve sıfırlanır
        redoStack = [];
        renderAll();
        fitToScreen();
      };
      img.src = merged;
    }
  
    // ---------------------------------------------------------
    // HISTORY & UNDO
    // ---------------------------------------------------------
    // Artık Undo işlemi drawItems dizisinin son elemanını çıkarmak demektir.
    document.getElementById('btn-undo').addEventListener('click', () => {
      if (drawItems.length > 0) {
        redoStack.push(drawItems.pop());
        renderAll();
      }
    });
  
    // ---------------------------------------------------------
    // ZOOM & PAN
    // ---------------------------------------------------------
    function setZoom(level) {
      zoomLevel = level;
      canvasWrapper.style.transform = `scale(${zoomLevel})`;
      document.getElementById('zoom-label').innerText = Math.round(zoomLevel * 100) + '%';
    }
  
    function fitToScreen() {
      const container = document.getElementById('canvasContainer');
      const rx = (container.clientWidth - 80) / drawCanvas.width;
      const ry = (container.clientHeight - 80) / drawCanvas.height;
      setZoom(Math.min(rx, ry, 1)); 
    }
  
    document.getElementById('btn-zoom-in').addEventListener('click', () => setZoom(zoomLevel + 0.1));
    document.getElementById('btn-zoom-out').addEventListener('click', () => setZoom(Math.max(0.1, zoomLevel - 0.1)));
  
    // ---------------------------------------------------------
    // KEYBOARD SHORTCUTS
    // ---------------------------------------------------------
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            document.getElementById('btn-undo').click();
        }
        if (e.key.toLowerCase() === 'e') {
            const eraserBtn = document.querySelector('[data-tool="eraser"]');
            if (eraserBtn) eraserBtn.click();
        }
        if (e.key.toLowerCase() === 'v') {
            const selectBtn = document.querySelector('[data-tool="select"]');
            if (selectBtn) selectBtn.click();
        }
        if (e.key === 'Escape') {
            if (settingsModal.style.display === 'flex') settingsModal.style.display = 'none';
        }
    });

    // ---------------------------------------------------------
    // EXPORT
    // ---------------------------------------------------------
    function mergeCanvases() {
      const off = document.createElement('canvas');
      off.width = bgCanvas.width;
      off.height = bgCanvas.height;
      const ctx = off.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0,0,off.width,off.height);
      ctx.drawImage(bgCanvas, 0, 0);
      ctx.drawImage(drawCanvas, 0, 0);
      return off.toDataURL('image/png');
    }
  
    document.getElementById('btn-download').addEventListener('click', () => {
      const fmt = exportFormat.toLowerCase();
      const filename = "element-snap-" + Date.now();
      
      if (fmt === 'png') {
        const link = document.createElement('a'); link.download = filename + '.png'; link.href = mergeCanvases(); link.click();
      } else if (fmt === 'jpg') {
        const link = document.createElement('a'); link.download = filename + '.jpg'; 
        
        const off = document.createElement('canvas'); off.width = bgCanvas.width; off.height = bgCanvas.height;
        const ctx = off.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0,0,off.width,off.height);
        ctx.drawImage(bgCanvas, 0, 0); ctx.drawImage(drawCanvas, 0, 0);
        link.href = off.toDataURL('image/jpeg', 0.9); link.click();
      } else if (currentTool === 'pdf') {
        if (!window.jspdf) return alert(chrome.i18n.getMessage("alertError") + "jsPDF module not loaded.");
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: bgCanvas.width>bgCanvas.height?'l':'p', unit:'px', format:[bgCanvas.width,bgCanvas.height]});
        pdf.addImage(mergeCanvases(), 'PNG', 0, 0, bgCanvas.width, bgCanvas.height);
        pdf.save(filename + '.pdf');
      }
    });
  
    document.getElementById('btn-share').addEventListener('click', async () => {
      try {
        const res = await fetch(mergeCanvases());
        const blob = await res.blob();
        await navigator.clipboard.write([new ClipboardItem({[blob.type]: blob})]);
        alert(chrome.i18n.getMessage("alertClipboard"));
      } catch(e) { alert(chrome.i18n.getMessage("alertError") + e); }
    });
  
    document.getElementById('btn-new').addEventListener('click', () => {
      if(typeof chrome !== 'undefined' && chrome.tabs) window.close();
      else alert(chrome.i18n.getMessage("testModePluginClose"));
    });

    // --- I18N DOM Initialization ---
    function localizeDOM() {
      const elements = document.querySelectorAll('[data-i18n]');
      elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        const message = chrome.i18n.getMessage(key);
        if (message) {
          if (el.tagName === 'INPUT' && el.type === 'button') el.value = message;
          else if (el.hasAttribute('title')) el.title = message;
          else el.textContent = message;
        }
      });
      // Handle tooltips correctly for icons
      const tooltips = document.querySelectorAll('[data-i18n-title]');
      tooltips.forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        const message = chrome.i18n.getMessage(key);
        if (message) el.title = message;
      });
    }
    localizeDOM();
  });
