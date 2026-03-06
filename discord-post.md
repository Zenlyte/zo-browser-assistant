# 🚀 Built: Zo Chrome Extension (with Side Panel!)

Hey everyone! Just wrapped up a Chrome extension that brings Zo into your browser. Thought I'd share what I built 👇

## What it does

**Two modes:**
- **Popup mode** → Quick access from toolbar (save page, ask questions)
- **Side panel mode** → Full persistent sidebar for longer sessions

**Key features:**
- 💾 **Save any webpage to Zo** with one click (gets summarized & stored)
- 💬 **Chat with the current page** using AI (ask questions, get summaries, extract info)
- 🔄 **Shared conversation threads** → Start in popup, continue in sidebar seamlessly
- 📚 **History browser** → See all your past page conversations
- 📁 **Files tabs** → View local artifacts + your Zo workspace files
- 🔗 **"Open in Zo"** → Deep-link to full Zo Computer with page context

## Design

Matched the Zo dark aesthetic (zinc palette, subtle borders, Inter font). Popup is compact, side panel has room for history/files exploration.

## Tech

- Chrome Manifest V3
- Side Panel API for persistent sidebar
- Shared core modules between popup/panel
- Per-URL chat persistence with thread continuity
- Markdown rendering with syntax highlighting

## How it works

1. You're reading an article
2. Click extension → ask "What are the main points?"
3. Need more context? Hit "Open Sidebar"
4. Same conversation continues in full side panel
5. Browse your history or workspace files while chatting

Chat threads are tied to each page URL (normalized, tracking params stripped), so returning to a page loads your previous conversation automatically.

## What's next?

Could add:
- Export threads as markdown
- Search across all conversations
- Custom prompts/templates
- More Zo API integrations

Pretty happy with how the shared-thread model turned out. Having the same chat work across popup + sidebar without any weird sync issues was the trickiest part.

**Repo structure:**
```
zo-chrome-extension/
├── manifest.json
├── popup.html / sidepanel.html
├── scripts/
│   ├── popup.js / sidepanel.js
│   └── core/ (shared modules)
└── tests/ (unit tests)
```

Would love feedback if anyone tries it out! 🙌

---

*Using: Zo API, Claude/GLM-5, Chrome Side Panel API*
