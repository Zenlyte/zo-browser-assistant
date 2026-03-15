import { normalizeUrlToThreadId } from "./chat-store.js";

export function buildOpenInZoUrl({ pageUrl, pageTitle }) {
  const base = "https://curtastrophe.zo.computer/?t=chat";
  const u = new URL(base);
  
  let prompt = `Help me understand this webpage:`;
  if (pageTitle) prompt += `\nTitle: ${pageTitle}`;
  if (pageUrl) prompt += `\nURL: ${pageUrl}`;
  
  u.searchParams.set("input", prompt);
  
  if (pageUrl) {
    u.searchParams.set("page_url", pageUrl);
    u.searchParams.set("thread_id", normalizeUrlToThreadId(pageUrl));
  }
  if (pageTitle) u.searchParams.set("page_title", pageTitle);
  
  return u.toString();
}
