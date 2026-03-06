import { normalizeUrlToThreadId } from "./chat-store.js";

export function buildOpenInZoUrl({ pageUrl, pageTitle }) {
  const base = "https://YOUR-HANDLE.zo.computer/";
  const u = new URL(base);
  u.searchParams.set("source", "chrome-extension");
  if (pageUrl) {
    u.searchParams.set("page_url", pageUrl);
    u.searchParams.set("thread_id", normalizeUrlToThreadId(pageUrl));
  }
  if (pageTitle) u.searchParams.set("page_title", pageTitle);
  return u.toString();
}
