import { getSettings } from "./core/settings-store.js";
import { getActiveTabContext } from "./core/page-context.js";
import { askZo, listAvailableModels } from "./core/zo-client.js";
import { groupModels, chooseInitialModel } from "./core/model-catalog.js";
import { getThread, saveThread, clearThread, listThreadMetas, normalizeUrlToThreadId } from "./core/chat-store.js";
import { sortHistory } from "./core/history-index.js";
import { getLocalArtifacts, getZoWorkspaceFiles } from "./core/files-provider.js";
import { savePageArtifact, formatArtifactPath } from "./core/saved-pages.js";
import { buildOpenInZoUrl } from "./core/open-in-zo.js";

if (typeof marked !== "undefined") {
  marked.setOptions({ breaks: true, gfm: true });
}

let state = {
  apiKey: "",
  defaultModel: "openrouter:z-ai/glm-5",
  selectedModel: "",
  context: null,
  messages: [],
  filesTab: "local",
  modelsReady: false,
  inFlightRequestId: 0,
};

const el = {
  pageTitle: document.getElementById("page-title"),
  pageUrl: document.getElementById("page-url"),
  chatMessages: document.getElementById("chat-messages"),
  chatInput: document.getElementById("chat-input"),
  sendBtn: document.getElementById("send-btn"),
  saveBtn: document.getElementById("save-btn"),
  openInZoBtn: document.getElementById("open-in-zo-btn"),
  clearChatBtn: document.getElementById("clear-chat-btn"),
  historyList: document.getElementById("history-list"),
  filesList: document.getElementById("files-list"),
  filesQuery: document.getElementById("files-query"),
  filesRefresh: document.getElementById("files-refresh"),
  status: document.getElementById("status"),
  chatModelSelect: document.getElementById("chat-model-select"),
  chatModelStatus: document.getElementById("chat-model-status"),
};

function setActionAvailability(enabled) {
  el.sendBtn.disabled = !enabled;
  el.saveBtn.disabled = !enabled;
  el.chatInput.disabled = !enabled;
}

function setModelStatus(text) {
  if (!text) {
    el.chatModelStatus.classList.add("hidden");
    el.chatModelStatus.textContent = "";
    return;
  }
  el.chatModelStatus.textContent = text;
  el.chatModelStatus.classList.remove("hidden");
}

function setStatus(text) {
  el.status.textContent = text;
  el.status.classList.remove("hidden");
  setTimeout(() => el.status.classList.add("hidden"), 2200);
}

function renderChat() {
  el.chatMessages.innerHTML = "";
  if (!state.messages.length) {
    const row = document.createElement("div");
    row.className = "row";
    row.textContent = "Continue the page conversation here.";
    el.chatMessages.appendChild(row);
    return;
  }

  state.messages.forEach((m) => {
    const d = document.createElement("div");
    d.className = `message ${m.role === "user" ? "user" : "assistant"}`;
    if (m.role === "assistant" && typeof marked !== "undefined") {
      d.innerHTML = marked.parse(m.content || "");
      d.querySelectorAll("pre code").forEach((b) => {
        if (typeof hljs !== "undefined") hljs.highlightElement(b);
      });
    } else {
      d.textContent = m.content || "";
    }
    el.chatMessages.appendChild(d);
  });

  el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
}

function populateModelSelect(models) {
  const groups = groupModels(models);
  el.chatModelSelect.innerHTML = "";
  groups.forEach((group) => {
    const og = document.createElement("optgroup");
    og.label = group.label;
    group.items.forEach((item) => {
      const opt = document.createElement("option");
      opt.value = item.modelName;
      opt.textContent = item.label;
      og.appendChild(opt);
    });
    el.chatModelSelect.appendChild(og);
  });
  state.selectedModel = chooseInitialModel(models, state.defaultModel);
  el.chatModelSelect.value = state.selectedModel;
  el.chatModelSelect.disabled = false;
}

async function loadModelsForSession() {
  if (!state.apiKey) {
    state.modelsReady = false;
    el.chatModelSelect.disabled = true;
    setModelStatus("API key missing. Configure in Settings.");
    setActionAvailability(false);
    return;
  }

  el.chatModelSelect.disabled = true;
  setModelStatus("Loading models...");
  try {
    const models = await listAvailableModels({ apiKey: state.apiKey });
    if (!models.length) throw new Error("No available models returned for this account.");
    populateModelSelect(models);
    state.modelsReady = true;
    setModelStatus("");
    setActionAvailability(Boolean(state.context));
  } catch (e) {
    state.modelsReady = false;
    el.chatModelSelect.innerHTML = "";
    el.chatModelSelect.disabled = true;
    setModelStatus(String(e.message || e));
    setActionAvailability(false);
  }
}

async function loadContextAndThread() {
  state.context = await getActiveTabContext();
  if (!state.context) {
    el.pageTitle.textContent = "Unable to access page";
    el.pageTitle.title = "Unable to access page";
    el.pageUrl.textContent = "Try navigating to a regular webpage";
    el.pageUrl.title = "Try navigating to a regular webpage";
    setActionAvailability(false);
    return;
  }

  el.pageTitle.textContent = state.context.title;
  el.pageTitle.title = state.context.title || "";
  el.pageUrl.textContent = state.context.url;
  el.pageUrl.title = state.context.url || "";

  const thread = await getThread(state.context.url);
  state.messages = thread?.messages || [];
  renderChat();
  setActionAvailability(state.modelsReady);
}

async function persistMessagesForContext({ url, title, messages }) {
  if (!url) return;
  await saveThread({ url, title: title || "", messages });
  chrome.runtime.sendMessage({ type: "THREAD_UPDATED", threadId: normalizeUrlToThreadId(url) });
}

async function sendChat() {
  if (!state.modelsReady) return setStatus("Model list unavailable");
  if (!state.apiKey) return setStatus("Configure API key in settings first");
  const q = el.chatInput.value.trim();
  if (!q || !state.context || !state.selectedModel) return;

  const lockedContext = {
    url: state.context.url,
    title: state.context.title,
    content: state.context.content || "",
  };
  const lockedModel = state.selectedModel;
  const requestId = ++state.inFlightRequestId;

  const workingMessages = [...state.messages, { role: "user", content: q }];

  el.chatInput.value = "";

  if (state.context?.url === lockedContext.url) {
    state.messages = workingMessages;
    renderChat();
  }

  await persistMessagesForContext({
    url: lockedContext.url,
    title: lockedContext.title,
    messages: workingMessages,
  });

  const contextText = lockedContext.content.slice(0, 12000);
  const recent = workingMessages.slice(-10).map((m) => `${m.role}: ${m.content}`).join("\n\n");
  const prompt = `You are helping with this webpage.\nTitle: ${lockedContext.title}\nURL: ${lockedContext.url}\n\nPage:\n${contextText}\n\nConversation:\n${recent}\n\nLatest question: ${q}\n\nRespond in markdown.`;

  try {
    const data = await askZo({ apiKey: state.apiKey, model: lockedModel, input: prompt });
    const finalMessages = [...workingMessages, { role: "assistant", content: data.output || "No response" }];

    await persistMessagesForContext({
      url: lockedContext.url,
      title: lockedContext.title,
      messages: finalMessages,
    });

    if (state.context?.url === lockedContext.url && requestId === state.inFlightRequestId) {
      state.messages = finalMessages;
      renderChat();
    }
  } catch (e) {
    setStatus(String(e.message || e));
  }
}

async function savePageToZo() {
  if (!state.modelsReady) return setStatus("Model list unavailable");
  if (!state.apiKey || !state.context || !state.selectedModel) return setStatus("Missing API key, page context, or model");

  try {
    const input = `Save this webpage to memory. First, search the Bookmarks folder to see if a markdown file for this exact URL already exists. If it does, do not create a new one, and just reply 'ALREADY_SAVED'. If it does not exist, create a detailed markdown summary of the page and save it in the Bookmarks folder. When finished, reply 'SAVED'.\nTitle: ${state.context.title}\nURL: ${state.context.url}\n\nContent:\n${(state.context.content || "").slice(0, 15000)}`;
    const data = await askZo({ apiKey: state.apiKey, model: state.selectedModel, input });

    if (data && data.output && data.output.includes("ALREADY_SAVED")) {
      await savePageArtifact({
        url: state.context.url,
        title: state.context.title,
        model: state.selectedModel,
        zoSaved: true,
      });
      el.saveBtn.textContent = '✓ Saved';
      el.saveBtn.disabled = true;
      setStatus("Already saved in Zo Workspace");
    } else {
      await savePageArtifact({
        url: state.context.url,
        title: state.context.title,
        model: state.selectedModel,
        zoSaved: true,
      });
      el.saveBtn.textContent = '✓ Saved';
      el.saveBtn.disabled = true;
      setStatus("Saved to Zo Bookmarks folder");
    }
  } catch (e) {
    setStatus(String(e.message || e));
  } finally {
    el.saveBtn.classList.remove("btn-saving");
  }
}

async function refreshHistory() {
  const metas = sortHistory(await listThreadMetas());
  el.historyList.innerHTML = metas.length ? "" : `<div class="row">No history yet</div>`;

  metas.forEach((m) => {
    const r = document.createElement("div");
    r.className = "row";
    r.innerHTML = `<div>${m.title || m.url || "Untitled"}</div><div class="meta">${m.url || ""} • ${m.messageCount || 0} msgs</div>`;
    r.title = m.url || m.title || "";
    r.addEventListener("click", async () => {
      const thread = await getThread(m.url);
      if (thread) {
        state.context = { ...(state.context || {}), url: m.url, title: m.title || state.context?.title || "" };
        state.messages = thread.messages || [];
        el.pageTitle.textContent = state.context.title || "";
        el.pageTitle.title = state.context.title || "";
        el.pageUrl.textContent = state.context.url || "";
        el.pageUrl.title = state.context.url || "";
        renderChat();
        switchPane("chat");
      }
    });
    el.historyList.appendChild(r);
  });
}

async function refreshFiles() {
  const query = el.filesQuery.value.trim();
  el.filesList.innerHTML = `<div class="row">Loading...</div>`;

  try {
    const model = state.selectedModel || state.defaultModel;
    const items = state.filesTab === "local"
      ? await getLocalArtifacts({ query })
      : await getZoWorkspaceFiles({
          apiKey: state.apiKey,
          model,
          defaultModel: state.defaultModel,
          pageUrl: state.context?.url,
          query,
        });

    el.filesList.innerHTML = items.length ? "" : `<div class="row">No files found</div>`;
    items.forEach((i) => {
      const r = document.createElement("div");
      r.className = "row";
      r.innerHTML = `<div>${i.path || "(no path)"}</div><div class="meta">${i.kind || "file"} • ${i.summary || ""}</div>`;
      r.title = i.path || "";
      el.filesList.appendChild(r);
    });
  } catch (e) {
    el.filesList.innerHTML = `<div class="row">Failed to load files: ${String(e.message || e)}</div>`;
  }
}

function switchPane(name) {
  document.querySelectorAll(".pane").forEach((p) => p.classList.remove("active"));
  document.querySelector(`#pane-${name}`)?.classList.add("active");
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.pane === name));
}

function switchFilesPane(name) {
  state.filesTab = name;
  document.querySelectorAll(".subtab").forEach((t) => t.classList.toggle("active", t.dataset.filesPane === name));
  refreshFiles();
}

async function init() {
  const settings = await getSettings();
  state.apiKey = settings.apiKey;
  state.defaultModel = settings.model;

  await loadContextAndThread();
  await loadModelsForSession();
  await refreshHistory();

  chrome.tabs.onActivated.addListener(async (info) => {
    if (info.tabId !== state.context?.tabId) await loadContextAndThread();
  });

  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
    if (tabId === state.context?.tabId && changeInfo.url) await loadContextAndThread();
  });

  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", async () => {
    switchPane(t.dataset.pane);
    if (t.dataset.pane === "history") await refreshHistory();
    if (t.dataset.pane === "files") await refreshFiles();
  }));

  document.querySelectorAll(".subtab").forEach((t) => t.addEventListener("click", () => switchFilesPane(t.dataset.filesPane)));

  el.chatModelSelect.addEventListener("change", () => {
    state.selectedModel = el.chatModelSelect.value;
  });

  el.sendBtn.addEventListener("click", sendChat);
  el.chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  });

  el.saveBtn.addEventListener("click", savePageToZo);
  el.openInZoBtn.addEventListener("click", () => {
    const url = buildOpenInZoUrl({ pageUrl: state.context?.url, pageTitle: state.context?.title });
    chrome.tabs.create({ url });
  });

  el.clearChatBtn.addEventListener("click", async () => {
    if (!state.context?.url) return;
    await clearThread(state.context.url);
    state.messages = [];
    renderChat();
    await refreshHistory();
  });

  el.filesRefresh.addEventListener("click", refreshFiles);
  el.filesQuery.addEventListener("keydown", (e) => {
    if (e.key === "Enter") refreshFiles();
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "THREAD_UPDATED") {
      refreshHistory();
      if (state.context?.url) loadContextAndThread();
    }
  });
}

init();
