import { normalizeModels } from "./model-catalog.js";

const FILES_PROMPT = (pageUrl, query) => `Return up to 30 workspace files relevant to this URL and query.
URL: ${pageUrl || ""}
Query: ${query || ""}
Return JSON only with shape:
{"items":[{"path":"...","kind":"...","summary":"..."}]}`;

const TREE_PROMPT = (dirPath) => `List all files and folders in the directory "${dirPath || "/home/workspace"}". Use the list_files tool. Return JSON only with shape:
{"entries":[{"name":"filename","path":"/full/path","type":"file_or_directory"}]}
Include ALL entries. Do not summarize or omit. Return the raw listing as JSON.`;

function uniqueModels(models = []) {
  return [...new Set(models.filter(Boolean))];
}

function parseItemsFromOutput(output) {
  if (Array.isArray(output?.items)) return output.items;

  const text = typeof output === "string" ? output : "";
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed?.items)) return parsed.items;
    if (Array.isArray(parsed)) return parsed;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed?.items)) return parsed.items;
      } catch {}
    }
  }

  return [];
}

function sanitizeItems(items = []) {
  return items
    .filter((i) => i && typeof i.path === "string" && i.path.trim())
    .map((i) => ({
      path: i.path.trim(),
      kind: typeof i.kind === "string" ? i.kind : "file",
      summary: typeof i.summary === "string" ? i.summary : "",
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

export async function askZoStream({ apiKey, model, input, onChunk, onDone, onError }) {
  const res = await fetch("https://api.zo.computer/zo/ask", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ input, model_name: model, stream: true }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Zo API error: ${res.status} ${errText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullContent = "";
  let isComplete = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    let eventType = "";
    for (const line of lines) {
      if (line.startsWith("event: ")) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        const dataStr = line.slice(6);
        try {
          const data = JSON.parse(dataStr);
          
          // Handle different response formats
          if (eventType === "PartStartEvent") {
            if (data.part?.content && data.part?.part_kind === "text") {
              fullContent += data.part.content;
              onChunk(fullContent, data.part.content);
            }
          } else if (eventType === "PartDeltaEvent") {
            if (data.delta?.content_delta && data.delta?.part_delta_kind === "text") {
              fullContent += data.delta.content_delta;
              onChunk(fullContent, data.delta.content_delta);
            }
          } else if (eventType === "FrontendModelResponse" || eventType === "ModelResponse") {
            if (data.content) {
              fullContent += data.content;
              onChunk(fullContent, data.content);
            } else if (data.output && typeof data.output === "string") {
              // Non-streaming format - treat as complete response
              fullContent = data.output;
              onChunk(fullContent, data.output);
            }
          } else if (eventType === "FrontendModelResponseError" || eventType === "Error") {
            if (onError) onError(new Error(data.message || data.error || "Stream error"));
            isComplete = true;
          } else if (eventType === "End" || eventType === "FrontendModelResponseEnd") {
            if (data.data?.output) {
              fullContent = data.data.output;
            }
            isComplete = true;
            if (onDone) onDone(fullContent);
          }
        } catch (e) {
          // Failed to parse JSON - might be plain text output
          if (dataStr && dataStr !== "[DONE]") {
            fullContent += dataStr;
            onChunk(fullContent, dataStr);
          }
        }
        // Always reset eventType after processing data line
        eventType = "";
      } else if (line === "") {
        // Empty line marks end of event
        eventType = "";
      }
    }
  }

  // Final done callback
  if (onDone && !isComplete) onDone(fullContent);
  return fullContent;
}

export async function listAvailableModels({ apiKey }) {
  const res = await fetch("https://api.zo.computer/models/available", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    cache: "no-store",
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
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              path: { type: "string" },
              kind: { type: "string" },
              summary: { type: "string" },
            },
            required: ["path"],
          },
        },
      },
      required: ["items"],
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
  const items = sanitizeItems(parseItemsFromOutput(data.output));
  return items;
}

export async function listZoWorkspaceFiles({ apiKey, model, defaultModel, pageUrl, query }) {
  const fallbackModel = "vercel:zai/glm-5";

  let lastError = null;

  try {
    const strictItems = await tryListFilesWithModel({
      apiKey,
      model: fallbackModel,
      pageUrl,
      query,
      useOutputFormat: true,
    });
    if (strictItems.length) return strictItems;

    const relaxedItems = await tryListFilesWithModel({
      apiKey,
      model: fallbackModel,
      pageUrl,
      query,
      useOutputFormat: false,
    });
    if (relaxedItems.length) return relaxedItems;
  } catch (e) {
    lastError = e;
  }

  if (lastError) {
    throw new Error(`Failed to load Zo Workspace Files with fallback model (${fallbackModel}): ${lastError.message}`);
  }

  return [];
}

function parseTreeEntries(output) {
  const text = typeof output === "string" ? output : JSON.stringify(output || "");
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed?.entries)) return parsed.entries;
    if (Array.isArray(parsed)) return parsed;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed?.entries)) return parsed.entries;
      } catch {}
    }
  }

  // Fallback: parse tree-style text output like "  - name/" or "  - name"
  const lines = text.split("\n");
  const entries = [];
  for (const line of lines) {
    const trimmed = line.replace(/^[\s\-•]+/, "").trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("(")) continue;
    const isDir = trimmed.endsWith("/");
    const name = isDir ? trimmed.slice(0, -1) : trimmed;
    if (name && !name.includes("{") && !name.includes(":") && name.length < 200) {
      entries.push({ name, type: isDir ? "directory" : "file" });
    }
  }
  return entries;
}

export async function listZoDirectory({ apiKey, dirPath }) {
  const fallbackModel = "vercel:zai/glm-5";

  const res = await fetch("https://api.zo.computer/zo/ask", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      input: TREE_PROMPT(dirPath),
      model_name: fallbackModel,
    }),
  });

  if (!res.ok) throw new Error(`Zo API error: ${res.status}`);

  const data = await res.json();
  const entries = parseTreeEntries(data.output);

  return entries
    .filter((e) => e && (e.name || e.path))
    .map((e) => {
      const name = e.name || (e.path ? e.path.split("/").pop() : "");
      const fullPath = e.path || `${dirPath || "/home/workspace"}/${name}`;
      const type = e.type === "directory" || e.type === "dir" || name.endsWith("/") ? "directory" : "file";
      return { name: name.replace(/\/$/, ""), path: fullPath.replace(/\/$/, ""), type };
    })
    .filter((e) => e.name);
}
