# DECISIONS
- Populate model options from `GET /models/available` using `zoApiKey` saved in extension settings.
- If API key is missing or invalid, show an inline error in chat UI and disable send/save actions until fixed.
- Add model dropdown under the chat input in both popup and side panel.
- Default model comes from settings on open. Model changes in popup/side panel are session-local only and reset when that UI closes.

## Task Checklist
### Phase 1. Add model catalog client + session model state
- ☑ Add a `listAvailableModels` API client with normalized model entries.
- ☑ Add session-local model state in popup and side panel, initialized from settings default.
- ☑ Add explicit error states for missing/invalid API key and model list fetch failure.
- ☑ Add unit tests for model normalization and provider grouping.

### Phase 2. Wire dropdown UIs in popup and side panel
- ☑ Add dropdown component under chat input in popup.
- ☑ Add dropdown component under chat input in side panel.
- ☑ Populate dropdown on UI init with grouped provider options.
- ☑ Keep selection local to UI session and use selected model for send/save calls.
- ☑ Add unit tests for selected-model fallback and disabled-state behaviour.

### Phase 3. Settings alignment and cleanup
- ☑ Keep settings page model selector as persistent default only.
- ☑ Refactor duplicated dropdown-building logic into shared utility.
- ☑ Update README to document default-vs-session model behaviour.
- ☑ Add unit tests for settings/default merge logic.

## Phase 1. Add model catalog client + session model state
### Affected files and changes
- `scripts/core/zo-client.js`
  - Add `listAvailableModels({ apiKey })` for `GET https://api.zo.computer/models/available`.
  - Normalize response to:
    - `{ provider, modelName, label, isByok, type }`
  - Raise typed errors for 401/403/5xx with user-safe message strings.
- `scripts/core/model-catalog.js` (new)
  - Pure helpers:
    - `normalizeModels(raw)`
    - `groupModels(models)` by provider/type
    - `buildOptionGroups(models)` for `<optgroup>/<option>` rendering data.
- `scripts/popup.js`
  - Add session field `selectedModel` initialized from settings default model.
  - Add state field for catalog/error/loading.
- `scripts/sidepanel.js`
  - Same session model fields and loading/error state.

### Planned code changes
- Keep persistent settings unchanged: `zoModel` remains default model.
- On popup/panel init:
  1. Load settings.
  2. If no API key: show error `API key missing. Configure in Settings.`
  3. If key exists: call `listAvailableModels` and build dropdown options.
  4. Set `selectedModel` to settings default if present in catalog, else first available model.
- Send/save actions always use `selectedModel`, never mutate settings.

### Unit tests (automated only)
- `tests/model-catalog.test.js` (new)
  - Normalizes `/models/available` rows.
  - Preserves BYOK/native flags.
  - Stable grouping and label formatting.
- `tests/zo-client-models.test.js` (new)
  - Maps 401/403 to actionable errors.
  - Handles empty model lists safely.

## Phase 2. Wire dropdown UIs in popup and side panel
### Affected files and changes
- `popup.html`
  - Add model select block directly under chat input area:
    - label `Model`
    - `<select id="chat-model-select">`
    - inline status `<div id="chat-model-status">`
- `popup.css`
  - Add compact model row styling aligned with Zo dark controls.
- `scripts/popup.js`
  - Populate model select on init.
  - Handle `change` event to update `state.selectedModel` in memory only.
  - Disable send/save when model list unavailable or API key invalid.
- `sidepanel.html`
  - Add equivalent model select under chat composer.
- `styles/sidepanel.css`
  - Add model row styles consistent with panel theme.
- `scripts/sidepanel.js`
  - Same model loading and selection logic as popup.

### Planned code changes
- Dropdown shows all available models from API, grouped by provider/type (including BYOK if returned).
- If load fails due to auth:
  - show inline error
  - keep dropdown disabled
  - keep send/save disabled with status message.
- If load succeeds:
  - enable dropdown + send/save
  - selected model persists until popup/panel closes.

### Unit tests (automated only)
- `tests/model-selection-session.test.js` (new)
  - Uses default model from settings on init.
  - Falls back to first model when default missing.
  - Confirms changes do not write `zoModel` to storage.
- `tests/model-ui-guards.test.js` (new)
  - Send/save disabled when catalog unavailable.
  - Error message set for missing/invalid key.

## Phase 3. Settings alignment and cleanup
### Affected files and changes
- `options.html`
  - Keep persistent default model selector.
  - Optional helper text: `Used as default when popup/panel opens`.
- `scripts/options.js`
  - No runtime session model writes. Save only persistent defaults.
- `scripts/core/settings-store.js`
  - Keep defaults contract stable (`apiKey`, `model`).
- `README.md`
  - Document model behaviour:
    - settings model = default on open
    - chat dropdown = session-local override

### Planned code changes
- Keep responsibilities separate:
  - Settings page manages durable defaults.
  - Chat UIs manage ephemeral overrides.
- Remove any duplicated model-list rendering code by consolidating in `model-catalog.js` helpers.

### Unit tests (automated only)
- `tests/settings-default-model.test.js` (new)
  - Confirms persistent default load/save unaffected by chat session overrides.
