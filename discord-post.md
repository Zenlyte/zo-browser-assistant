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

- Chrome Manifest V3 + Side Panel API
- Streaming responses with real-time rendering
- Shared core modules between popup/panel
- Per-URL chat persistence with thread continuity
- Markdown rendering with syntax highlighting
- TokenCut compression (40-60% token savings on stored content)
- Dynamic model selection from Zo API (native + BYOK)

## How it works

1. You're reading an article
2. Click extension → ask "What are the main points?"
3. Need more context? Open the sidebar
4. Same conversation continues in full side panel
5. Browse history or workspace files while chatting

Chat threads are tied to each page URL (normalized, tracking params stripped), so returning to a page loads your previous conversation.

Saving a page is near-instant — content is extracted, compressed with TokenCut, and saved locally. Background sync pushes to Zo, Fabric, Mem.ai, and Raindrop.io.

Would love feedback if anyone tries it out! 🙌

---

*Using: Zo API, Chrome Side Panel API, TokenCut*
