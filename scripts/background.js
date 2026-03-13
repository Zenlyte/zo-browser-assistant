import { savePageArtifact } from "./core/saved-pages.js";
import { askZo } from "./core/zo-client.js";

async function ensurePopupFirstBehavior() {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
  } catch {
  }
}

function createMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "open-popup",
      title: "Open Popup",
      contexts: ["action"],
    });
    chrome.contextMenus.create({
      id: "open-sidebar",
      title: "Open Sidebar",
      contexts: ["action"],
    });
  });
}

chrome.runtime.onInstalled.addListener(async (details) => {
  await ensurePopupFirstBehavior();
  if (details.reason === "install") {
    chrome.runtime.openOptionsPage();
  }
  createMenus();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensurePopupFirstBehavior();
  createMenus();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "open-sidebar") {
    const windowId = tab?.windowId || (await chrome.windows.getLastFocused()).id;
    if (windowId) await chrome.sidePanel.open({ windowId });
    return;
  }

  if (info.menuItemId === "open-popup") {
    const url = chrome.runtime.getURL("popup.html");
    await chrome.windows.create({
      url,
      type: "popup",
      width: 430,
      height: 760,
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "OPEN_SIDE_PANEL") {
    (async () => {
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        const windowId = activeTab?.windowId || (await chrome.windows.getLastFocused()).id;
        if (!windowId) {
          sendResponse({ ok: false, error: "No focused browser window found" });
          return;
        }
        await chrome.sidePanel.open({ windowId });
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }

  if (message?.type === "BACKGROUND_SAVE") {
    const { url, title, content, apiKey, model } = message;
    
    (async () => {
      try {
        // Use a much faster prompt that directly executes the save_url script without LLM rewriting
        const input = `Run this exact command to save the URL: nohup bun /home/workspace/Scripts/save_url.ts '${url}' >/dev/null 2>&1 &
Reply strictly with 'SAVED'.`;

        const data = await askZo({ apiKey, model, input });
        
        await savePageArtifact({
          url,
          title,
          model,
          zoSaved: true,
        });

        chrome.runtime.sendMessage({ 
          type: "SAVE_COMPLETED", 
          url, 
          alreadySaved: data?.output?.includes("ALREADY_SAVED") 
        }).catch(() => {}); // Ignore error if no UI is listening
      } catch (e) {
        console.warn("Background save failed:", e);
        chrome.runtime.sendMessage({ 
          type: "SAVE_FAILED", 
          url, 
          error: String(e.message || e) 
        }).catch(() => {});
      }
    })();

    // Immediately resolve to provide fast user feedback (< 10 seconds)
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "THREAD_UPDATED" || message?.type === "ACTIVE_TAB_CHANGED") {
    chrome.runtime.sendMessage(message);
    sendResponse({ ok: true });
    return true;
  }

  return false;
});
