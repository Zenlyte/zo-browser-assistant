export async function getActiveTabContext() {
  // Use lastFocusedWindow for side panel compatibility
  // Side panels run in their own window, so currentWindow would return wrong context
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab) return null;
  const page = await extractPageContent(tab.id);
  return {
    tabId: tab.id,
    url: tab.url || "",
    title: tab.title || "Untitled",
    content: page?.content || "",
  };
}

export async function extractPageContent(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const selectors = ["article", "[role='main']", "main", ".content", ".post-content", ".article-content", ".entry-content", "#content", "#main"];
        for (const selector of selectors) {
          const el = document.querySelector(selector);
          if (el && el.innerText.trim().length > 100) {
            return { content: el.innerText.trim().slice(0, 20000), source: selector };
          }
        }
        const clone = document.body.cloneNode(true);
        ["nav", "footer", "header", "aside", ".sidebar", ".navigation", ".menu", ".ads"].forEach((s) => clone.querySelectorAll(s).forEach((el) => el.remove()));
        return { content: clone.innerText.trim().slice(0, 20000), source: "body" };
      },
    });
    return results?.[0]?.result || { content: "", source: "none" };
  } catch (e) {
    // May fail on restricted pages (chrome://, etc.)
    return { content: "", source: "error", error: e.message };
  }
}
