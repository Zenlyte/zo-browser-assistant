import { normalizeModels } from "./model-catalog.js";

const FILES_PROMPT = (pageUrl, query) => `Return up to 30 workspace files relevant to this URL and query.
URL: ${pageUrl || ""}
Query: ${query || ""}
Return JSON only with shape:
{"items":[{"path":"...","kind":"...","summary":"..."}]}`;

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
