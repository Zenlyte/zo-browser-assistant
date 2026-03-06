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

  if (message?.type === "THREAD_UPDATED" || message?.type === "ACTIVE_TAB_CHANGED") {
    chrome.runtime.sendMessage(message);
    sendResponse({ ok: true });
    return true;
  }

  return false;
});
