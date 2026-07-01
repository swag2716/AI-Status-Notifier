// AI Status Notifier — Popup v12

var STATE_UI = {
  idle:     { emoji: "💤", label: "Idle",      color: "#64748b", pulse: false },
  thinking: { emoji: "🧠", label: "Thinking…", color: "#fbbf24", pulse: true  },
  done:     { emoji: "✅", label: "Done!",      color: "#34d399", pulse: false }
};

var AI_HOSTS = [
  "claude.ai", "chat.openai.com", "chatgpt.com",
  "gemini.google.com", "www.perplexity.ai", "copilot.microsoft.com"
];

var PLATFORM_NAME = {
  "claude.ai": "Claude",
  "chat.openai.com": "ChatGPT",
  "chatgpt.com": "ChatGPT",
  "gemini.google.com": "Gemini",
  "www.perplexity.ai": "Perplexity",
  "copilot.microsoft.com": "Copilot"
};

var tabStatusMap = {};

function renderAllTabs() {
  var container = document.getElementById("ai-tabs-list");
  var entries = Object.values(tabStatusMap);

  if (entries.length === 0) {
    container.innerHTML = '<div class="not-ai">No AI tabs are currently open.<br/>Open Claude, ChatGPT, or another<br/>supported site to start tracking.</div>';
    return;
  }

  var order = { thinking: 0, done: 1, idle: 2 };
  entries.sort(function(a, b) { return (order[a.state] || 2) - (order[b.state] || 2); });

  container.innerHTML = entries.map(function(entry) {
    var ui = STATE_UI[entry.state] || STATE_UI.idle;
    var d = entry.debug || {};
    var signals = [];
    if (d.stopBtn)     signals.push("stop-btn");
    if (d.streamClass) signals.push("stream-class");
    if (d.fieldset)    signals.push("fieldset");
    if (d.textChange)  signals.push("text-change");
    var debugStr = signals.length ? signals.join(", ") : "none";

    return '<div class="tab-row ' + entry.state + '">' +
      '<div class="tab-dot ' + entry.state + '">' + ui.emoji +
        (ui.pulse ? '<div class="pulse-ring"></div>' : '') +
      '</div>' +
      '<div class="tab-info">' +
        '<div class="tab-platform">' + entry.platform + '</div>' +
        '<div class="tab-state" style="color:' + ui.color + '">' + ui.label + '</div>' +
        '<div class="tab-debug">signals: ' + debugStr + '</div>' +
      '</div>' +
      '<button class="switch-btn" data-tab-id="' + entry.tabId + '" title="Switch to tab">↗</button>' +
    '</div>';
  }).join("");

  container.querySelectorAll(".switch-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var id = parseInt(btn.getAttribute("data-tab-id"), 10);
      chrome.tabs.update(id, { active: true });
      window.close();
    });
  });
}

function fetchTabState(tab) {
  return new Promise(function(resolve) {
    var hostname = "";
    try { hostname = new URL(tab.url).hostname; } catch(e) {}
    var platform = PLATFORM_NAME[hostname] || "AI";

    chrome.tabs.sendMessage(tab.id, { type: "GET_STATE" }, function(res) {
      if (chrome.runtime.lastError || !res) {
        chrome.runtime.sendMessage({ type: "GET_TAB_STATE", tabId: tab.id }, function(bgRes) {
          resolve({ tabId: tab.id, state: (bgRes && bgRes.state) || "idle", platform: (bgRes && bgRes.platform) || platform, debug: {} });
        });
        return;
      }
      resolve({ tabId: tab.id, state: res.state, platform: res.platform || platform, debug: res.debug || {} });
    });
  });
}

async function init() {
  var allTabs  = await chrome.tabs.query({});
  var aiTabs   = allTabs.filter(function(t) {
    try { return AI_HOSTS.indexOf(new URL(t.url).hostname) !== -1; }
    catch(e) { return false; }
  });

  if (aiTabs.length === 0) {
    document.getElementById("ai-tabs-list").innerHTML = '<div class="not-ai">No AI tabs are currently open.</div>';
    return;
  }

  var results = await Promise.all(aiTabs.map(fetchTabState));
  results.forEach(function(r) { tabStatusMap[r.tabId] = r; });
  renderAllTabs();
  checkNotificationPermission();
}

chrome.runtime.onMessage.addListener(function(msg) {
  if (msg.type === "AI_STATE_CHANGE" && msg.tabId) {
    tabStatusMap[msg.tabId] = { tabId: msg.tabId, state: msg.state, platform: msg.platform, debug: tabStatusMap[msg.tabId] && tabStatusMap[msg.tabId].debug || {} };
    renderAllTabs();
  }
});

function checkNotificationPermission() {
  var warning = document.getElementById("notif-warning");
  if (Notification.permission === "denied") {
    warning.innerHTML = '<div class="notif-warning">⚠️ Notifications blocked.<br/>System Settings → Notifications → Chrome</div>';
  } else if (Notification.permission === "default") {
    Notification.requestPermission();
  }
}

var toggle = document.getElementById("notify-toggle");
chrome.storage.local.get(["notifyEnabled"], function(prefs) {
  toggle.checked = prefs.notifyEnabled !== false;
});
toggle.addEventListener("change", function() {
  chrome.storage.local.set({ notifyEnabled: toggle.checked });
});

document.getElementById("test-btn").addEventListener("click", function() {
  var btn = this;
  chrome.runtime.sendMessage({ type: "TEST_NOTIFICATION" }, function() {
    btn.textContent = "Sent ✓";
    btn.classList.add("sent");
    setTimeout(function() { btn.textContent = "Test 🔔"; btn.classList.remove("sent"); }, 2000);
  });
});

init();
