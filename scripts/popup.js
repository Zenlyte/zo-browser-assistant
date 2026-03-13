import { getSettings } from "./core/settings-store.js";
import { getActiveTabContext } from "./core/page-context.js";
import { askZo, askZoStream, listAvailableModels } from "./core/zo-client.js";
import { groupModels, chooseInitialModel } from "./core/model-catalog.js";
import { getThread, saveThread, clearThread, normalizeUrlToThreadId } from "./core/chat-store.js";
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
  modelsReady: false,
};

const savesInFlight = new Set();

const el = {
  notConfigured: document.getElementById("not-configured"),
  mainContent: document.getElementById("main-content"),
  pageTitle: document.getElementById("page-title"),
  pageUrl: document.getElementById("page-url"),
  chatMessages: document.getElementById("chat-messages"),
  chatInput: document.getElementById("chat-input"),
  sendBtn: document.getElementById("send-btn"),
  saveBtn: document.getElementById("save-btn"),
  clearChatBtn: document.getElementById("clear-chat-btn"),
  status: document.getElementById("status"),
  settingsBtn: document.getElementById("settings-btn"),
  openOptions: document.getElementById("open-options"),
  openSidebarBtn: document.getElementById("open-sidebar-btn"),
  openInZoBtn: document.getElementById("open-in-zo-btn"),
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

function showStatus(text, type = "loading") {
  el.status.textContent = text;
  el.status.className = `status ${type}`;
  el.status.classList.remove("hidden");
  if (type !== "loading") setTimeout(() => el.status.classList.add("hidden"), 2200);
}

function renderMessages() {
  el.chatMessages.innerHTML = "";
  if (!state.messages.length) {
    el.chatMessages.innerHTML = `<div class="chat-welcome"><p>Ask questions about the current webpage and continue in Sidebar anytime.</p></div>`;
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

function appendStreamingBubble() {
  const d = document.createElement("div");
  d.className = "message assistant streaming";
  d.innerHTML = `<span class="streaming-cursor"></span>`;
  el.chatMessages.appendChild(d);
  el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
  return d;
}

function updateStreamingBubble(bubble, content) {
  if (typeof marked !== "undefined") {
    bubble.innerHTML = marked.parse(content) + `<span class="streaming-cursor"></span>`;
    bubble.querySelectorAll("pre code").forEach((b) => {
      if (typeof hljs !== "undefined") hljs.highlightElement(b);
    });
  } else {
    bubble.textContent = content;
  }
  el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
}

function finalizeStreamingBubble(bubble, content) {
  bubble.classList.remove("streaming");
  if (typeof marked !== "undefined") {
    bubble.innerHTML = marked.parse(content);
    bubble.querySelectorAll("pre code").forEach((b) => {
      if (typeof hljs !== "undefined") hljs.highlightElement(b);
    });
  } else {
    bubble.textContent = content;
  }
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
      opt.textContent = `${item.label}`;
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

async function persist() {
  if (!state.context?.url) return;
  await saveThread({ url: state.context.url, title: state.context.title, messages: state.messages });
  chrome.runtime.sendMessage({ type: "THREAD_UPDATED", threadId: normalizeUrlToThreadId(state.context.url) });
}

async function init() {
  const s = await getSettings();
  state.apiKey = s.apiKey;
  state.defaultModel = s.model;

  if (!state.apiKey) {
    el.notConfigured.classList.remove("hidden");
    el.mainContent.classList.add("hidden");
  }

  state.context = await getActiveTabContext();
  if (state.context) {
    el.pageTitle.textContent = state.context.title;
    el.pageUrl.textContent = state.context.url;
    const thread = await getThread(state.context.url);
    state.messages = thread?.messages || [];
  }
  renderMessages();
  bindEvents();
  await loadModelsForSession();
}

function bindEvents() {
  el.settingsBtn.addEventListener("click", () => chrome.runtime.openOptionsPage());
  el.openOptions.addEventListener("click", () => chrome.runtime.openOptionsPage());
  el.openSidebarBtn.addEventListener("click", async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const windowId = tab?.windowId;
      if (!windowId) throw new Error("No browser window found");
      await chrome.sidePanel.open({ windowId });
      window.close();
    } catch (e) {
      showStatus(String(e.message || e), "error");
    }
  });
  el.openInZoBtn.addEventListener("click", () => {
    const url = buildOpenInZoUrl({ pageUrl: state.context?.url, pageTitle: state.context?.title });
    chrome.tabs.create({ url });
  });

  el.chatModelSelect.addEventListener("change", () => {
    state.selectedModel = el.chatModelSelect.value;
  });

  el.chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  });
  el.sendBtn.addEventListener("click", sendChat);
  el.saveBtn.addEventListener("click", savePage);
  el.clearChatBtn.addEventListener("click", async () => {
    if (!state.context?.url) return;
    await clearThread(state.context.url);
    state.messages = [];
    renderMessages();
    showStatus("Chat cleared", "success");
  });

  chrome.runtime.onMessage.addListener(async (msg) => {
    if (msg?.type === "THREAD_UPDATED" && state.context?.url) {
      const thread = await getThread(state.context.url);
      state.messages = thread?.messages || [];
      renderMessages();
    }
    
    if (msg?.type === "SAVE_COMPLETED" && state.context?.url === msg.url) {
      savesInFlight.delete(msg.url);
      el.saveBtn.classList.remove("btn-saving");
      if (msg.alreadySaved) {
        el.saveBtn.innerHTML = '<span class="btn-icon">✓</span> Already in Zo';
      }
    }

    if (msg?.type === "SAVE_FAILED" && state.context?.url === msg.url) {
      savesInFlight.delete(msg.url);
      el.saveBtn.classList.remove("btn-saving");
      el.saveBtn.innerHTML = '<span class="btn-icon">⚠️</span> Save failed';
      el.saveBtn.disabled = false;
      showStatus("Zo sync failed: " + msg.error, "error");
    }
  });
}

async function savePage() {
  if (!state.modelsReady) return showStatus("Model list unavailable", "error");
  if (!state.apiKey || !state.context || !state.selectedModel) return showStatus("Missing API key, page context, or model", "error");

  const url = state.context.url;
  if (savesInFlight.has(url)) return showStatus("Already saving this page...", "loading");

  savesInFlight.add(url);
  el.saveBtn.disabled = true;
  el.saveBtn.innerHTML = '<span class="btn-icon">✓</span> Saved to Zo';
  showStatus("Page saved locally and syncing to Zo. Safe to close.", "success");

  await savePageArtifact({
    url: state.context.url,
    title: state.context.title,
    model: state.selectedModel,
    zoSaved: false,
  });

  chrome.runtime.sendMessage({
    type: "BACKGROUND_SAVE",
    url: state.context.url,
    title: state.context.title,
    content: state.context.content || "",
    apiKey: state.apiKey,
    model: state.selectedModel
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn("Background script not ready:", chrome.runtime.lastError);
    }
  });
}

async function sendChat() {
  const q = el.chatInput.value.trim();
  if (!q) return;
  if (!state.modelsReady) return showStatus("Model list unavailable", "error");
  if (!state.apiKey || !state.context || !state.selectedModel) return showStatus("Missing API key, page context, or model", "error");

  el.chatInput.value = "";
  state.messages.push({ role: "user", content: q });
  renderMessages();
  await persist();

  const bubble = appendStreamingBubble();
  setActionAvailability(false);

  try {
    const convo = state.messages.slice(-10).map((m) => `${m.role}: ${m.content}`).join("\n\n");
    const input = `Help answer questions about this webpage.\nTitle: ${state.context.title}\nURL: ${state.context.url}\n\nContent:\n${(state.context.content || "").slice(0, 12000)}\n\nConversation:\n${convo}\n\nLatest user question: ${q}\nRespond in markdown.`;

    const finalContent = await askZoStream({
      apiKey: state.apiKey,
      model: state.selectedModel,
      input,
      onChunk(fullText) {
        updateStreamingBubble(bubble, fullText);
      },
      onDone(fullText) {
        finalizeStreamingBubble(bubble, fullText);
      },
      onError(err) {
        showStatus(String(err.message || err), "error");
      },
    });

    const output = finalContent || "No response";
    finalizeStreamingBubble(bubble, output);
    state.messages.push({ role: "assistant", content: output });
    await persist();
  } catch (e) {
    bubble.remove();
    showStatus(String(e.message || e), "error");
  } finally {
    setActionAvailability(true);
  }
}

init();
