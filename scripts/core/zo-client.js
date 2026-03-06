import { normalizeModels } from "./model-catalog.js";

const FILES_PROMPT = (pageUrl, query) => `List up to 50 files and folders from the Zo workspace that are relevant to:
- Current page URL: ${pageUrl || "(none)"}
- Search query: ${query || "(none)"}

Return a JSON object with a hierarchical tree structure:
{
  "folders": [
    {
      "name": "Folder Name",
      "path": "/path/to/folder",
      "items": [
        {"name": "file.md", "path": "/path/to/folder/file.md", "type": "file", "size": "12KB", "modified": "2024-01-15", "summary": "Brief description"}
      ]
    }
  ],
  "files": [
    {"name": "root-file.md", "path": "/path/to/root-file.md", "type": "file", "size": "8KB", "modified": "2024-01-10", "summary": "Brief description"}
  ]
}

Requirements:
- Include file size (human readable like "12KB", "1.5MB")
- Include last modified date (YYYY-MM-DD format)
- Include file type/extension
- Include a brief 1-line summary of each file's content/purpose
- Group files by their parent folder
- Limit to most relevant 50 items total
- Prioritize files related to: ${pageUrl || query || "general workspace content"}`;

function uniqueModels(models = []) {
  return [...new Set(models.filter(Boolean))];
}

function parseTreeFromOutput(output) {
  if (typeof output !== "object" || output === null) {
    const text = typeof output === "string" ? output : "";
    if (!text) return null;
    
    try {
      const parsed = JSON.parse(text);
      if (parsed?.folders || parsed?.files) return parsed;
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          if (parsed?.folders || parsed?.files) return parsed;
        } catch {}
      }
    }
    return null;
  }
  
  if (output?.folders || output?.files) return output;
  return null;
}

function flattenTreeToItems(tree = {}) {
  const items = [];
  
  // Process folders and their nested items
  (tree.folders || []).forEach(folder => {
    items.push({
      path: folder.path,
      kind: "folder",
      summary: folder.name || "",
      type: "folder",
      size: "",
      modified: ""
    });
    
    // Add nested files in this folder
    (folder.items || []).forEach(item => {
      items.push({
        path: item.path || `${folder.path}/${item.name}`,
        kind: "file",
        summary: item.summary || "",
        type: item.type || "file",
        size: item.size || "",
        modified: item.modified || ""
      });
    });
  });
  
  // Add root-level files
  (tree.files || []).forEach(file => {
    items.push({
      path: file.path || file.name,
      kind: "file",
      summary: file.summary || "",
      type: file.type || "file",
      size: file.size || "",
      modified: file.modified || ""
    });
  });
  
  return items.slice(0, 50);
}

function sanitizeItems(items = []) {
  return items
    .filter((i) => i && typeof i.path === "string" && i.path.trim())
    .map((i) => ({
      path: i.path.trim(),
      kind: typeof i.kind === "string" ? i.kind : "file",
      summary: typeof i.summary === "string" ? i.summary : "",
      type: typeof i.type === "string" ? i.type : "",
      size: typeof i.size === "string" ? i.size : "",
      modified: typeof i.modified === "string" ? i.modified : ""
    }));
}

export async function askZo({ apiKey, model, input }) {
  const res = await fetch("https://api.zo.computer/zo/ask", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ input, model_name: model }),
  });
  if (!res.ok) throw new Error(`Zo API error: ${res.status}`);
  return res.json();
}

export async function listAvailableModels({ apiKey }) {
  const res = await fetch("https://api.zo.computer/models/available", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error("Invalid API key. Update it in Settings.");
  }
  if (!res.ok) {
    throw new Error(`Failed to load models: HTTP ${res.status}`);
  }

  const data = await res.json();
  return normalizeModels(data.models || []);
}

async function tryListFilesWithModel({ apiKey, model, pageUrl, query, useOutputFormat }) {
  const body = {
    input: FILES_PROMPT(pageUrl, query),
    model_name: model,
  };

  if (useOutputFormat) {
    body.output_format = {
      type: "object",
      properties: {
        folders: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              path: { type: "string" },
              items: { type: "array" }
            }
          }
        },
        files: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              path: { type: "string" },
              type: { type: "string" },
              size: { type: "string" },
              modified: { type: "string" },
              summary: { type: "string" }
            }
          }
        }
      },
    };
  }

  const res = await fetch("https://api.zo.computer/zo/ask", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = new Error(`Zo API error: ${res.status}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const tree = parseTreeFromOutput(data.output);
  const items = tree ? flattenTreeToItems(tree) : [];
  return sanitizeItems(items);
}

export async function listZoWorkspaceFiles({ apiKey, model, defaultModel, pageUrl, query }) {
  const fallbackModel = "vercel:zai/glm-5";
  const modelsToTry = uniqueModels([model, defaultModel, fallbackModel]);

  let lastError = null;

  for (const m of modelsToTry) {
    if (!m) continue;

    try {
      const items = await tryListFilesWithModel({
        apiKey,
        model: m,
        pageUrl,
        query,
        useOutputFormat: true,
      });
      if (items.length) return items;

      const relaxedItems = await tryListFilesWithModel({
        apiKey,
        model: m,
        pageUrl,
        query,
        useOutputFormat: false,
      });
      if (relaxedItems.length) return relaxedItems;
    } catch (e) {
      lastError = e;
      if (e.status === 401 || e.status === 403) throw e;
    }
  }

  if (lastError) {
    throw new Error(`Failed to load Zo Workspace Files: ${lastError.message}`);
  }

  return [];
}
