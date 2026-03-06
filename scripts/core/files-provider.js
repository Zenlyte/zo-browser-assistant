import { listThreadMetas } from "./chat-store.js";
import { listZoWorkspaceFiles } from "./zo-client.js";
import { listSavedPages, formatArtifactPath } from "./saved-pages.js";

export async function getLocalArtifacts({ query = "" }) {
  const metas = await listThreadMetas();
  const savedPages = await listSavedPages();
  const q = query.toLowerCase();

  const threadItems = metas.map((m) => ({
    path: m.url || "",
    kind: "thread",
    summary: `${m.title || "Untitled"} (${m.messageCount || 0} msgs)`,
  }));

  const savedPageItems = savedPages.map((p) => ({
    path: formatArtifactPath(p.url),
    kind: "saved-page",
    summary: `${p.title || p.url} • ${p.zoSaved ? "saved to Zo" : "local only"}`,
  }));

  return [...savedPageItems, ...threadItems].filter((i) =>
    !q || i.path.toLowerCase().includes(q) || i.summary.toLowerCase().includes(q)
  );
}

export async function getZoWorkspaceFiles({ apiKey, model, defaultModel, pageUrl, query = "" }) {
  return listZoWorkspaceFiles({ apiKey, model, defaultModel, pageUrl, query });
}
