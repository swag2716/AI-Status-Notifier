# AI Status Notifier — Chrome Extension

A lightweight Chrome extension that tracks the state of AI tools in real time and notifies you when a response is ready — even when you're on a different tab.

## Features

- **Multi-platform support** — tracks Claude, ChatGPT, Gemini, Perplexity, and Copilot simultaneously
- **Live status per tool** — each open AI tab gets its own status row in the popup
- **Badge on extension icon** — shows `...` (thinking) or `✓` (done) from any tab you're on
- **Desktop notifications** — get notified the moment an AI finishes responding, even if you've switched tabs
- **Background tracking** — works while you're on YouTube, VS Code, or any other tab
- **One-click tab switch** — click ↗ in the popup to jump directly to the AI tab that finished
- **No API keys** — pure DOM observation, zero external requests, fully offline

## Supported Sites

| Platform | URL |
|---|---|
| Claude | claude.ai |
| ChatGPT | chat.openai.com / chatgpt.com |
| Gemini | gemini.google.com |
| Perplexity | perplexity.ai |
| Microsoft Copilot | copilot.microsoft.com |

## How It Works

The extension injects a content script into each supported AI site. The script uses multiple detection strategies in parallel:

1. **Stop button detection** — every AI platform shows a "Stop generating" button while streaming; the extension watches for it to appear/disappear
2. **Streaming class detection** — watches for CSS classes like `.result-streaming` that platforms add during generation
3. **Composer state** — detects when the input area is disabled (Claude-specific)
4. **Text-change watcher** — watches the last assistant message container; if the text is actively changing, the AI is still responding

When the state transitions from `thinking → done`, the background service worker fires a desktop notification.

No conversation content is ever read, stored, or transmitted anywhere.

## Installation

### From source (Developer Mode)

1. Clone or download this repository
   ```bash
   git clone https://github.com/YOUR_USERNAME/ai-status-notifier.git
   ```

2. Open Chrome and navigate to `chrome://extensions`

3. Enable **Developer mode** (toggle in the top-right corner)

4. Click **Load unpacked** and select the `ai-status-extension` folder

5. Pin the extension by clicking the 🧩 puzzle icon in the toolbar and pinning **AI Status Notifier**

### Enable Desktop Notifications (macOS)

1. Open **System Settings → Notifications**
2. Find **Google Chrome** and set alert style to **Banners** or **Alerts**
3. Make sure **Allow Notifications** is toggled on

### Enable Desktop Notifications (Windows)

1. Open **Settings → System → Notifications**
2. Find **Google Chrome** and toggle it on
3. Make sure **Focus Assist** is not blocking notifications

## Usage

1. Open any supported AI site (e.g. claude.ai)
2. Send a message to the AI
3. Switch to any other tab — the extension keeps tracking in the background
4. The badge on the extension icon changes:
   - 🟡 `...` — AI is thinking / generating
   - 🟢 `✓` — AI has finished
5. A desktop notification appears when the response is ready
6. Click the notification (or the ↗ button in the popup) to jump back to the AI tab

## File Structure

```
ai-status-extension/
├── manifest.json       # Extension config, permissions, content script rules
├── background.js       # Service worker — manages badges, notifications, tab state
├── content.js          # Injected into AI sites — detects thinking/done state
├── popup.html          # Extension popup UI
├── popup.js            # Popup logic — fetches and displays per-tab status
└── icons/
    ├── idle16.png
    ├── idle48.png
    ├── idle128.png
    ├── done16.png
    ├── done48.png
    └── done128.png
```

## Permissions Used

| Permission | Why |
|---|---|
| `notifications` | Show desktop notification when AI finishes |
| `tabs` | Query all open tabs to find AI sites |
| `scripting` | Inject content script into AI pages |
| `storage` | Remember notification on/off preference |
| `alarms` | Keep the background service worker alive (MV3 requirement) |

## Known Limitations

- **Chrome only** — does not work in the Claude desktop app, iOS app, or Android app
- **Selector drift** — AI platforms occasionally update their UI; if detection breaks after a platform update, the selectors in `content.js` may need a tweak
- **Single window** — if you have multiple Chrome windows open, the badge reflects the most active AI state across all of them

## Contributing

Pull requests are welcome! If a platform's detection breaks after a UI update, the fix is usually a one-liner in the relevant `detect*` function inside `content.js`.
