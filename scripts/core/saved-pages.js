const SAVED_PAGES_KEY = "saved_pages";

export async function listSavedPages() {
  const data = await chrome.storage.local.get([SAVED_PAGES_KEY]);
  const rows = Array.isArray(data[SAVED_PAGES_KEY]) ? data[SAVED_PAGES_KEY] : [];
  return rows;
}

export async function savePageArtifact({ url, title, model, zoSaved }) {
  const current = await listSavedPages();
  const now = Date.now();
  const filtered = current.filter((r) => r.url !== url);
  const row = {
    url,
    title: title || "Untitled",
    model: model || "",
    zoSaved: Boolean(zoSaved),
    savedAt: now,
  };
  const next = [row, ...filtered].slice(0, 500);
  await chrome.storage.local.set({ [SAVED_PAGES_KEY]: next });
  return row;
}

export async function deleteSavedPage(url) {
  const current = await listSavedPages();
  const next = current.filter((r) => r.url !== url);
  await chrome.storage.local.set({ [SAVED_PAGES_KEY]: next });
}

export function formatArtifactPath(url) {
  try {
    const u = new URL(url);
    const path = `${u.hostname}${u.pathname}`.replace(/\/$/, "") || u.hostname;
    return `local-artifact://saved-pages/${path}`;
  } catch {
    return "local-artifact://saved-pages/unknown";
  }
}
