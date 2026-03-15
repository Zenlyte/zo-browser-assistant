import { savePageArtifact } from "./core/saved-pages.js";
import { askZo, askZoStream } from "./core/zo-client.js";
import { saveThread, getThread, normalizeUrlToThreadId } from "./core/chat-store.js";

// Keep track of active streams to support popup -> sidebar handoff
const activeStreams = new Map();

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

  if (message?.type === "START_STREAM") {
    const { url, title, model, apiKey, input, messages } = message;
    const threadId = normalizeUrlToThreadId(url);

    // If there's already a stream for this thread, ignore or cancel? 
    // Usually user sends a new question, so we should allow it.
    if (activeStreams.has(threadId)) {
      // Logic to cancel existing if needed
    }

    const streamState = {
      fullContent: "",
      isComplete: false,
      error: null,
      messages: [...messages] // The messages including the new user question
    };
    activeStreams.set(threadId, streamState);

    (async () => {
      try {
        await askZoStream({
          apiKey,
          model,
          input,
          onChunk(fullText) {
            streamState.fullContent = fullText;
            chrome.runtime.sendMessage({
              type: "STREAM_CHUNK",
              threadId,
              fullText
            }).catch(() => {}); // Expected if no UI is open mid-handoff
          },
          onDone(fullText) {
            streamState.fullContent = fullText;
            streamState.isComplete = true;
            
            // Save to chat store
            const finalMessages = [...streamState.messages, { role: "assistant", content: fullText }];
            saveThread({ url, title, messages: finalMessages }).then(() => {
              chrome.runtime.sendMessage({
                type: "STREAM_DONE",
                threadId,
                fullText
              }).catch(() => {});
              
              // Notify that thread was updated for syncing
              chrome.runtime.sendMessage({ type: "THREAD_UPDATED", threadId }).catch(() => {});
              
              // Clean up after a delay to allow UI to "catch" the done state
              setTimeout(() => activeStreams.delete(threadId), 5000);
            });
          },
          onError(err) {
            streamState.error = String(err.message || err);
            chrome.runtime.sendMessage({
              type: "STREAM_ERROR",
              threadId,
              error: streamState.error
            }).catch(() => {});
            activeStreams.delete(threadId);
          }
        });
      } catch (e) {
        chrome.runtime.sendMessage({
          type: "STREAM_ERROR",
          threadId,
          error: String(e.message || e)
        }).catch(() => {});
        activeStreams.delete(threadId);
      }
    })();

    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "GET_ACTIVE_STREAM") {
    const threadId = message.threadId;
    const stream = activeStreams.get(threadId);
    if (stream) {
      sendResponse({ 
        isActive: true, 
        fullContent: stream.fullContent, 
        isComplete: stream.isComplete,
        error: stream.error
      });
    } else {
      sendResponse({ isActive: false });
    }
    return true;
  }

  if (message?.type === "THREAD_UPDATED" || message?.type === "ACTIVE_TAB_CHANGED") {
    chrome.runtime.sendMessage(message).catch(() => {});
    sendResponse({ ok: true });
    return true;
  }

  return false;
});

// Keyboard shortcut handlers
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === "open-sidebar") {
    try {
      const windowId = tab?.windowId || (await chrome.windows.getLastFocused()).id;
      if (windowId) await chrome.sidePanel.open({ windowId });
    } catch (e) {
      console.warn("Failed to open sidebar:", e);
    }
    return;
  }

  if (command === "quick-save") {
    // Quick save: save current tab's page to Zo
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!activeTab?.url) return;

      // Extract page content via scripting
      const results = await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: () => ({
          title: document.title,
          url: window.location.href,
          content: document.body.innerText.slice(0, 15000)
        })
      });
      const pageData = results[0]?.result;
      if (!pageData) return;

      // Get API key from storage
      const { zoApiKey: apiKey, zoModel: model } = await chrome.storage.sync.get(['zoApiKey', 'zoModel']);
      if (!apiKey) {
        chrome.notifications?.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Zo Extension',
          message: 'Please configure your Zo API key in extension settings'
        });
        return;
      }

      // Save locally first for instant feedback
      await savePageArtifact({
        url: pageData.url,
        title: pageData.title,
        model: model || 'openrouter:z-ai/glm-5',
        zoSaved: false,
      });

      // Show notification
      chrome.notifications?.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Zo Extension',
        message: `Saving "${pageData.title?.slice(0, 40) || 'Page'}" to Zo...`
      });

      // Trigger background save
      chrome.runtime.sendMessage({
        type: "BACKGROUND_SAVE",
        url: pageData.url,
        title: pageData.title,
        content: pageData.content,
        apiKey,
        model: model || 'openrouter:z-ai/glm-5'
      });

    } catch (e) {
      console.warn("Quick save failed:", e);
    }
    return;
  }
});

// Handle activate-save command: open popup and trigger save
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === "activate-save") {
    // First open the popup
    chrome.action.openPopup();
    
    // Wait a moment then send save message to popup
    setTimeout(async () => {
      try {
        // Get current tab info
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!activeTab?.id) return;
        
        // Execute save script
        chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: () => {
            // Trigger save button click if popup is open
            const saveBtn = document.getElementById('save-btn');
            if (saveBtn) saveBtn.click();
          }
        });
      } catch (err) {
        console.error('activate-save error:', err);
      }
    }, 500);
  }
});
