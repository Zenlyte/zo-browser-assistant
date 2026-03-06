import { normalizeUrlToThreadId } from "./chat-store.js";

export function buildOpenInZoUrl({ pageUrl, pageTitle, handle }) {
  const base = handle ? `https://${handle}.zo.computer/` : "https://app.zo.computer/";
  const u = new URL(base);
  u.searchParams.set("source", "chrome-extension");
  if (pageUrl) {
    u.searchParams.set("page_url", pageUrl);
    u.searchParams.set("thread_id", normalizeUrlToThreadId(pageUrl));
  }
  if (pageTitle) u.searchParams.set("page_title", pageTitle);
  return u.toString();
}
