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

- Save current webpage to Zo with instant local save and background sync.
- Chat with page context using Zo API with streaming responses.
- Markdown-rendered answers with syntax highlighting.
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
3. Load unpacked extension from `Fabric/Coding Projects/zo-chrome-extension`.
4. Open Options and set Zo API key, default model, and Zo handle.

## Notes

- Side panel uses Chrome Side Panel API.
- Workspace file listing is requested through Zo API and may depend on account permissions/response quality.
- Save uses `agent-browser` for page content extraction with HTML fetch fallback.
- Content is compressed via TokenCut (AgentReady API) before storage to save tokens on future LLM consumption.

## Streaming Chat Responses

- Token-by-token streaming via Server-Sent Events (SSE) for real-time updates.
- **Fixed in v1.2:** Improved streaming parser reliability for more consistent token delivery.
- Fixed edge case where "No response" appeared despite successful API calls.

## Customizing Save Behavior

When you click **Save to Zo**, the extension sends a generic "save this webpage" prompt to your Zo server. By default, Zo saves a markdown summary to `/Bookmarks` in your workspace.

You can fully customize what happens next:

**1. Faster saves with TokenCut**

Install the [`@tokencut` skill](https://github.com/zocomputer/skills) from the Zo Skills registry. It compresses extracted page text by ~40–60% before it hits the LLM — reducing token usage on every save.

**2. Custom integrations via Zo Rules**

Add a Zo Rule that intercepts save prompts and runs your own script. Example rule condition:

> *When asked to save a URL, run `/home/workspace/Scripts/save_url.ts`*

Your script can then sync the bookmark to any platform connected to your Zo (e.g. Raindrop.io, Notion, a self-hosted database). The extension itself is platform-agnostic — the integration logic lives entirely on your Zo server, so each user's setup is their own.
