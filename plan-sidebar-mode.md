# DECISIONS
- Popup and side panel share the same per-page conversation thread. Users can continue the exact conversation when switching surfaces.
- Files area in side panel is split into two tabs:
  - Local Artifacts (extension-saved captures/chats)
  - Zo Workspace Files (loaded via Zo API)
- Quick launch is `Open in Zo` and deep-links with current page context.

## Task Checklist
### Phase 1. Shared core + Side Panel shell
- ☑ Add side panel entry to manifest and wire action click to open side panel.
- ☑ Extract popup business logic into shared modules (settings, page context extraction, Zo API client, shared chat store).
- ☑ Create side panel page scaffold with Zo Dark UI, shared-thread chat area, and header actions (`Save`, `Open in Zo`).
- ☑ Add unit tests for URL key normalization and storage adapters.

### Phase 2. History + dual files tabs + Open in Zo deep link
- ☑ Add “History” pane in side panel with per-page threads sorted by recent activity.
- ☑ Add Files pane tabs: `Local Artifacts` and `Zo Workspace Files` (API-backed).
- ☑ Implement `Open in Zo` deep link with current page URL/title context parameters.
- ☑ Add unit tests for history indexing/sorting and files provider mapping.

### Phase 3. Popup/Panel sync contract and cleanup
- ☑ Make popup consume the shared modules so behaviour matches side panel.
- ☑ Implement cross-surface sync events so panel and popup stay consistent in real time.
- ☑ Remove duplicated logic from popup script and simplify background worker.
- ☑ Add unit tests for reducer/state transitions and runtime message contracts.

## Phase 1. Shared core + Side Panel shell
### Affected files and changes
- `manifest.json`
  - Add `side_panel` default path.
  - Add permissions required for side panel workflow (`tabs` for robust active-tab reads in panel context).
- `scripts/background.js`
  - Handle action click with `chrome.sidePanel.open({ windowId })`.
  - Set panel behaviour (`chrome.sidePanel.setPanelBehavior`) so toolbar click opens panel.
  - Replace keep-alive interval with event-driven handlers.
- `sidepanel.html` (new)
  - Zo Dark side panel layout. Header actions (`Save`, `Open in Zo`), chat, and secondary pane toggles.
- `styles/sidepanel.css` (new)
  - Shared design tokens with popup, panel-optimized spacing and scroll regions.
- `scripts/sidepanel.js` (new)
  - Compose shared modules and drive side panel state.
- `scripts/core/settings-store.js` (new)
  - Typed getters/setters for `zoApiKey` and model.
- `scripts/core/page-context.js` (new)
  - `getActiveTabContext()` and `extractPageContent(tabId)` shared by popup/panel.
- `scripts/core/zo-client.js` (new)
  - `askZo({input, model, apiKey})` + `listZoWorkspaceFiles({apiKey, pageUrl, query})` with uniform error surface.
- `scripts/core/chat-store.js` (new)
  - Shared per-page thread persistence in `chrome.storage.local`, explicit schema and normalization.
- `scripts/core/types.js` (new, JSDoc typedefs)
  - `ThreadId`, `ChatMessage`, `ThreadMeta`, `FileListItem` typedefs.

### Planned code changes
- Use one shared thread model for both surfaces:
  - `threadId = normalizeUrlToThreadId(url)`
  - `Thread = { id, url, title, updatedAt, messages[] }`
- Move API/storage logic out of popup into composable functions.
- Side panel initializes active tab context and listens for tab activation/update to switch thread.

### Unit tests (automated only)
- `tests/chat-store.test.js` (new)
  - Stable thread ID normalization (drops tracking params, invalid URL handling, truncation).
  - Shared-thread save/load round-trip used by popup and panel.
- `tests/page-context.test.js` (new)
  - Content truncation limits and fallback branch behaviour (pure helpers only).

## Phase 2. History + dual files tabs + Open in Zo deep link
### Affected files and changes
- `sidepanel.html`
  - Add panes: `Chat`, `History`, `Files`.
  - Within `Files`, add subtabs: `Local Artifacts`, `Zo Workspace Files`.
- `styles/sidepanel.css`
  - Add tab styles, list styles, empty/error/loading states.
- `scripts/sidepanel.js`
  - Add pane routing and dual-provider loading flows.
- `scripts/core/history-index.js` (new)
  - Build indexed/sorted view from stored threads.
- `scripts/core/files-provider.js` (new)
  - Provider interface:
    - `getLocalArtifacts({pageUrl, query}) -> Promise<FileListItem[]>`
    - `getZoWorkspaceFiles({apiKey, pageUrl, query}) -> Promise<FileListItem[]>`
- `scripts/core/open-in-zo.js` (new)
  - Build deep-link URL:
    - base: `https://YOUR-HANDLE.zo.computer/`
    - params: `source=chrome-extension`, `page_url`, `page_title`, optional `thread_id`.

### Planned code changes
- History pane:
  - List all threads with title/url snippet, `updatedAt`, message count.
  - Click switches active shared thread and renders chat.
- Files pane:
  - `Local Artifacts` shows extension-known artifacts (captures/chat exports metadata) with client-side filter.
  - `Zo Workspace Files` calls Zo API and maps response to `FileListItem`.
- Header quick action:
  - Rename to `Open in Zo` and open deep link in new tab using current page context.

### Unit tests (automated only)
- `tests/history-index.test.js` (new)
  - Sort by `updatedAt` desc, stable handling for missing metadata.
- `tests/files-provider.test.js` (new)
  - Local mapping/filter behaviour.
  - Zo API response mapping + error normalization.
- `tests/open-in-zo.test.js` (new)
  - Deep-link param encoding and optional-field handling.

## Phase 3. Popup/Panel sync contract and cleanup
### Affected files and changes
- `scripts/popup.js`
  - Replace embedded logic with shared core module calls.
  - Keep popup as compact surface over shared thread store.
- `popup.html`, `popup.css`
  - Add `Open Sidebar` CTA for quick continuation in side panel.
- `scripts/background.js`
  - Add relay events (`THREAD_UPDATED`, `ACTIVE_TAB_CHANGED`) to keep popup/panel in sync.
- `README.md`
  - Document popup + side panel shared-thread behaviour, history, files subtabs, and `Open in Zo`.

### Planned code changes
- Both surfaces read/write same thread schema and thread IDs.
- Add explicit runtime message contract with small payloads.
- Remove duplicated fetch/persistence implementations.

### Unit tests (automated only)
- `tests/state-reducer.test.js` (new)
  - Transitions: add message, switch thread, clear thread, hydrate thread.
- `tests/message-contract.test.js` (new)
  - Validate runtime payloads for known event types.
