const TRACKING_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid", "ref"];

export function normalizeUrlToThreadId(url) {
  try {
    const u = new URL(url);
    TRACKING_PARAMS.forEach((p) => u.searchParams.delete(p));
    const key = `${u.origin}${u.pathname}`.replace(/[^a-zA-Z0-9_-]/g, "_");
    return key.slice(0, 140) || "thread_unknown";
  } catch {
    return `thread_${String(url || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120)}`;
  }
}

export async function getThread(url) {
  const id = normalizeUrlToThreadId(url);
  const data = await chrome.storage.local.get(id);
  return data[id] || null;
}

export async function saveThread({ url, title, messages }) {
  const id = normalizeUrlToThreadId(url);
  const record = {
    id,
    url,
    title: title || "",
    updatedAt: Date.now(),
    messages: Array.isArray(messages) ? messages : [],
  };
  await chrome.storage.local.set({ [id]: record });
  await chrome.storage.local.set({ [`meta_${id}`]: { id, url, title: record.title, updatedAt: record.updatedAt, messageCount: record.messages.length } });
  return record;
}

export async function clearThread(url) {
  const id = normalizeUrlToThreadId(url);
  await chrome.storage.local.remove([id, `meta_${id}`]);
}

export async function listThreadMetas() {
  const all = await chrome.storage.local.get(null);
  return Object.keys(all)
    .filter((k) => k.startsWith("meta_"))
    .map((k) => all[k])
    .filter(Boolean);
}
