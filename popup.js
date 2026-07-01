// AI Status Notifier — Popup v7
// Shows status for ALL open AI tabs simultaneously

const STATE_UI = {
  idle:     { emoji: "💤", label: "Idle",      color: "#64748b", pulse: false },
  thinking: { emoji: "🧠", label: "Thinking…", color: "#fbbf24", pulse: true  },
  done:     { emoji: "✅", label: "Done!",      color: "#34d399", pulse: false },
};

const AI_HOSTS = [
  "claude.ai", "chat.openai.com", "chatgpt.com",
  "gemini.google.com", "www.perplexity.ai", "copilot.microsoft.com",
];

const PLATFORM_NAME = {
  "claude.ai":              "Claude",
  "chat.openai.com":        "ChatGPT",
  "chatgpt.com":            "ChatGPT",
  "gemini.google.com":      "Gemini",
  "www.perplexity.ai":      "Perplexity",
  "copilot.microsoft.com":  "Copilot",
};

// Track per-tab states locally in popup
const tabStatusMap = {}; // tabId → { state, platform, tabId }

function renderAllTabs() {
  const container = document.getElementById("ai-tabs-list");
  const entries = Object.values(tabStatusMap);

  if (entries.length === 0) {
    container.innerHTML = `
      <div class="not-ai">
        No AI tabs are currently open.<br/>
        Open Claude, ChatGPT, or another<br/>supported site to start tracking.
      </div>`;
    return;
  }

  // Sort: thinking first, then done, then idle
  const order = { thinking: 0, done: 1, idle: 2 };
  entries.sort((a, b) => (order[a.state] ?? 2) - (order[b.state] ?? 2));

  container.innerHTML = entries.map(({ state, platform, tabId }) => {
    const ui = STATE_UI[state] || STATE_UI.idle;
    return `
      <div class="tab-row" data-tab-id="${tabId}">
        <div class="tab-dot ${state}">
          ${ui.emoji}
          ${ui.pulse ? '<div class="pulse-ring"></div>' : ""}
        </div>
        <div class="tab-info">
          <div class="tab-platform">${platform}</div>
          <div class="tab-state" style="color:${ui.color}">${ui.label}</div>
        </div>
        <button class="switch-btn" data-tab-id="${tabId}" title="Switch to tab">↗</button>
      </div>`;
  }).join("");

  // Switch to tab on arrow click
  container.querySelectorAll(".switch-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = parseInt(btn.getAttribute("data-tab-id"), 10);
      chrome.tabs.update(id, { active: true });
      window.close();
    });
  });
}

// Ask content script for state of a specific tab
function fetchTabState(tab) {
  return new Promise((resolve) => {
    let hostname = "";
    try { hostname = new URL(tab.url).hostname; } catch (_) {}
    const platform = PLATFORM_NAME[hostname] || "AI";

    chrome.tabs.sendMessage(tab.id, { type: "GET_STATE" }, (res) => {
      if (chrome.runtime.lastError || !res) {
        // Fallback to background state
        chrome.runtime.sendMessage({ type: "GET_TAB_STATE", tabId: tab.id }, (bgRes) => {
          resolve({
            tabId: tab.id,
            state: bgRes?.state || "idle",
            platform: bgRes?.platform || platform,
          });
        });
        return;
      }
      resolve({ tabId: tab.id, state: res.state, platform: res.platform || platform });
    });
  });
}

async function init() {
  const allTabs = await chrome.tabs.query({});
  const aiTabs  = allTabs.filter(t => {
    try { return AI_HOSTS.includes(new URL(t.url).hostname); }
    catch (_) { return false; }
  });

  if (aiTabs.length === 0) {
    document.getElementById("ai-tabs-list").innerHTML = `
      <div class="not-ai">
        No AI tabs are currently open.<br/>
        Open Claude, ChatGPT, or another<br/>supported site to start tracking.
      </div>`;
    return;
  }

  // Fetch all tab states in parallel
  const results = await Promise.all(aiTabs.map(fetchTabState));
  results.forEach(r => { tabStatusMap[r.tabId] = r; });
  renderAllTabs();

  checkNotificationPermission();
}

// ── Live updates while popup is open ──────────────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "AI_STATE_CHANGE") {
    // Update just the changed tab
    if (msg.tabId) {
      tabStatusMap[msg.tabId] = { tabId: msg.tabId, state: msg.state, platform: msg.platform };
      renderAllTabs();
    } else {
      // Re-fetch all if no tabId
      init();
    }
  }
});

// ── Notification permission warning ───────────────────────────────────────
function checkNotificationPermission() {
  const warning = document.getElementById("notif-warning");
  if (Notification.permission === "denied") {
    warning.innerHTML = `
      <div class="notif-warning">
        ⚠️ Notifications blocked. Go to<br/>
        <b>System Settings → Notifications → Chrome</b>
      </div>`;
  } else if (Notification.permission === "default") {
    Notification.requestPermission();
  }
}

// ── Notification toggle ────────────────────────────────────────────────────
const toggle = document.getElementById("notify-toggle");
chrome.storage.local.get(["notifyEnabled"], (prefs) => {
  toggle.checked = prefs.notifyEnabled !== false;
});
toggle.addEventListener("change", () => {
  chrome.storage.local.set({ notifyEnabled: toggle.checked });
});

// ── Test notification ──────────────────────────────────────────────────────
document.getElementById("test-btn").addEventListener("click", function () {
  const btn = this;
  chrome.runtime.sendMessage({ type: "TEST_NOTIFICATION" }, () => {
    btn.textContent = "Sent ✓";
    btn.classList.add("sent");
    setTimeout(() => { btn.textContent = "Test 🔔"; btn.classList.remove("sent"); }, 2000);
  });
});

init();
