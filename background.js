// background.js - Element Snap Premium (Node Capture)

const DEBUGGER_VERSION = "1.3";

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

async function captureNodeScreenshot(tabId, geometry) {
  const target = { tabId };
  let attached = false;

  try {
    await attachDebugger(target);
    attached = true;

    await sendDebuggerCommand(target, "Page.enable");
    await sendDebuggerCommand(target, "Runtime.enable");

    // Ekranda seçilen objenin ekran görüntüsünü Page.captureScreenshot ile
    // clip (kesim koordinati) parametresini kullanarak asıl kalitede al.
    const screenshot = await sendDebuggerCommand(target, "Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: true,
      clip: {
        x: geometry.x,
        y: geometry.y,
        width: geometry.width,
        height: geometry.height,
        scale: 1 // Windows Cihaz scale oranı ayarlanabilir isteğe göre 
      }
    });

    if (!screenshot || !screenshot.data) throw new Error("screenshot-failed");

    const dataUrl = "data:image/png;base64," + screenshot.data;

    chrome.storage.local.set({ capturedImage: dataUrl }, () => {
        chrome.tabs.create({ url: chrome.runtime.getURL("editor.html") });
    });

  } catch (error) {
    console.error("Capture Error:", error);
  } finally {
    if (attached) {
      await detachDebugger(target);
    }
  }
}

// Mesaj dinleyici - İçerik scriptinden gelen screenshot emri 
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "capture-node-screenshot" && sender.tab) {
    captureNodeScreenshot(sender.tab.id, message.geometry);
    // Asenkron olduğu için true dönmüyoruz, yanıt gerekmiyor, ekran açılacak.
  }
});

// Toolbar ikonuna veya kısayola tıklandığında
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id || tab.url.startsWith('chrome://')) {
    console.warn("Bu sayfada eklenti çalıştırılamaz.");
    return;
  }

  try {
    // Önce content script'in orada olup olmadığını kontrol et
    await chrome.tabs.sendMessage(tab.id, { type: "toggle-selection-mode" });
  } catch (error) {
    // Eğer mesaj başarısız olursa (script yüklenmemişse), scripti elle enjekte et
    console.log("Content script bulunamadı, yeniden enjekte ediliyor...");
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      // Enjeksiyondan sonra tekrar dene
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id, { type: "toggle-selection-mode" });
      }, 100);
    } catch (err) {
      console.error("Script enjeksiyonu başarısız:", err);
    }
  }
});
