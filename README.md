# Zo Browser Assistant

Chrome extension for saving webpages to Zo and chatting with page context in either popup or side panel.

## ⚠️ Known Issues & Performance Notes

**Zo Workspace Files Loading:** The file listing feature uses the `/zo/ask` API with a natural language prompt to retrieve your workspace structure. This approach can take **30-120 seconds** to populate, depending on:
- Your workspace size and complexity
- Current API load and model availability
- The fallback model being used (`vercel:zai/glm-5`)

We chose this approach because Zo doesn't currently expose a dedicated file listing API endpoint. The MCP server (which has a `list_files` tool) uses a different protocol that's not easily accessible from browser extensions.

**Save Operation:** The "Save to Bookmarks" feature sends your page content to Zo for summarization and then writes a markdown file to your workspace. This is a **background operation** that can take 60-120+ seconds. You'll see a progress indicator, and the save continues even if you close the popup.

## Modes

- **Popup mode** for quick actions (chat, save, model selection).
- **Side panel mode** for long-running conversations with full history.
- Both surfaces use the same per-page thread, so conversation continues seamlessly.

## Key Features

### 🤖 Chat & AI
- **Streaming responses** - Watch the AI type in real-time, word by word
- **Dynamic model selection** - Choose from all your Native and BYOK models
- **Per-page thread history** - Conversations are saved per URL and sync between popup and sidebar
- **Markdown-rendered answers** with syntax highlighting

### 💾 Save & Bookmarks
- **Save pages to Zo** - Summarize and save pages to your `Bookmarks` folder
- **Background saving** - Save continues even if you close the popup
- **Progress indicator** - Visual countdown bar shows save progress
- **Duplicate detection** - Checks if a page was already saved before creating a new bookmark

### 📁 File Management
- **Tree view for Zo Workspace Files** - Expandable folders, hierarchical structure
- **File metadata** - Shows file size, type, and last modified date
- **Click to insert** - Click any file to insert a reference into your chat
- **Local artifacts** - View and delete chat threads and saved pages

### ⚙️ Settings
- **Zo Handle** - Configure your handle (e.g., `curtastrophe`) for personalized deep links
- **Zo API Key** - Your API token from Settings → Advanced → Access Tokens
- **Default model** - Choose your preferred default model

## Model Selection Behavior

- On popup/sidepanel open, the extension loads all available models from `GET /models/available` using your saved Zo API key.
- The model dropdown shown under the chat box is **session-local**.
- Changing model in popup/sidepanel applies immediately for that UI session only.
- When popup/sidepanel closes and reopens, model resets to your default model from Settings.
- If API key is missing or invalid, the extension shows an inline model error and disables chat/send/save actions.

## Install

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer Mode** (toggle in top right).
4. Click **Load unpacked** and select the extension folder.
5. Click the extension icon → **Options** → paste your:
   - **Zo API Token** (from Settings → Advanced → Access Tokens)
   - **Zo Handle** (e.g., `curtastrophe`)
6. Start saving and chatting!

## Technical Architecture

### Why `/zo/ask` for file listing?

We use the `/zo/ask` endpoint with a structured prompt to list files because:
1. **No dedicated file API** - Zo doesn't expose a `GET /api/files` endpoint
2. **MCP is CLI-focused** - The MCP server (which has `list_files`) is designed for CLI tools like Claude Code, not browser extensions
3. **HTTP is simpler** - Browser extensions work best with standard HTTP APIs

The trade-off is slower file listing (30-120s) but simpler architecture.

## Notes

- Side panel uses Chrome Side Panel API.
- Workspace file listing is requested through Zo API and may depend on account permissions/response quality.
- Streaming responses use Server-Sent Events (SSE) for real-time updates.
- Background saving uses the `chrome.alarms` API to complete saves after popup closes.
