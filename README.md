# Zo Browser Assistant

Chrome extension for saving webpages to Zo and chatting with page context in either popup or side panel.

## Modes

- Popup mode for quick actions.
- Side panel mode for long-running conversations.
- Both surfaces use the same per-page thread, so conversation continues seamlessly.

## Model Selection Behavior

- On popup/sidepanel open, the extension loads all available models from `GET /models/available` using your saved Zo API key.
- The model dropdown shown under the chat box is session-local.
- Changing model in popup/sidepanel applies immediately for that UI session only.
- When popup/sidepanel closes and reopens, model resets to your default model from Settings.
- If API key is missing or invalid, the extension shows an inline model error and disables chat/send/save actions.

## Key Features

- Save current webpage to Zo.
- Chat with page context using Zo API.
- **Persistent Streaming**: Handoff active chat streams between popup and sidebar seamlessly.
- Markdown-rendered answers.
- Per-page thread history (URL-normalized, tracking params stripped).
- Side panel history browser with delete support.
- Files pane with:
  - Local Artifacts (deletable)
  - Zo Workspace Files in expandable tree view (API-backed)
- Open in Zo deep link with configurable handle.
- Dynamic model dropdown sourced from `/models/available` API (native + BYOK).
- TokenCut compression on saved content for reduced token usage in downstream LLM calls.
- Save pipeline: Instant local save + background sync to Zo Bookmarks (markdown summary).

## Install

1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Load unpacked extension from this folder.
4. Open **Extension Options** and configure:
   - **Zo API Key** (required)
   - **Default Model** (required)
   - **Zo Handle** (required for "Open in Zo" links)
   - **Custom Save Script** (optional - for personal integrations)

## Notes

- Side panel uses Chrome Side Panel API.
- Workspace file listing is requested through Zo API and may depend on account permissions/response quality.
- Save uses `agent-browser` for page content extraction with HTML fetch fallback.
- Content is compressed via TokenCut (AgentReady API) before storage to save tokens on future LLM consumption.

## Streaming Chat Responses

- Token-by-token streaming via Server-Sent Events (SSE) for real-time updates.
- **Fixed in v1.2:** Improved streaming parser reliability for more consistent token delivery.
- Fixed edge case where "No response" appeared despite successful API calls.

## Save Behavior

### Default (Public Version)

When you click **Save to Zo**, the extension:
1. Saves the page content locally as a "local artifact" (fast, immediate feedback)
2. Sends a generic "save this webpage" prompt to your Zo server
3. Zo creates a markdown summary in your `/Bookmarks` folder

### Personal Setup (Custom Script)

**For your own custom integrations** (e.g., saving to Raindrop.io, Notion, Mem, etc.):

1. Create a custom save script (e.g., `/home/workspace/Automations/Scripts/save_url.ts`)
2. Open Extension Options → **Custom Save Script (Optional)**
3. Enter your script path: `/home/workspace/Automations/Scripts/save_url.ts`
4. Now when you click **Save to Zo**, your custom script runs automatically

**Benefits:**
- Single codebase works for everyone
- Your personal setup is just configuration, not a fork
- Easy to share the extension with others
- Bug fixes apply to everyone automatically

**Example custom script:** See `Automations/Scripts/save_url.ts` for a reference implementation that saves to Fabric, Mem.ai, and Raindrop.io.

## Performance Tips

**Faster saves with TokenCut**

Install the [`@tokencut` skill](https://github.com/zocomputer/skills) from the Zo Skills registry. It compresses extracted page text by ~40–60% before it hits the LLM — reducing token usage on every save.
