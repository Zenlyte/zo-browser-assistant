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
- Markdown-rendered answers.
- Per-page thread history.
- Side panel history browser.
- Files pane with:
  - Local Artifacts
  - Zo Workspace Files (API-backed)
- Open in Zo deep link with page context.
- Dynamic model dropdown in popup and side panel.

## Install

1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Load unpacked extension from `Fabric/Coding Projects/zo-chrome-extension`.
4. Open Options and set Zo API key.

## Notes

- Side panel uses Chrome Side Panel API.
- Workspace file listing is requested through Zo API and may depend on account permissions/response quality.
