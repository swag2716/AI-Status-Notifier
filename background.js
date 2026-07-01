// AI Status Notifier — Background v6
// Sets both tab-specific AND global badge so it's visible from any tab

const tabStates = {};

const BADGE = {
  idle:     { color: "#9CA3AF", text: "" },
  thinking: { color: "#F59E0B", text: "..." },
  done:     { color: "#10B981", text: "✓" },
};

// Tab-specific badge (visible when on that tab)
function applyTabBadge(tabId, state) {
  const b = BADGE[state] || BADGE.idle;
  chrome.action.setBadgeText({ text: b.text, tabId });
  chrome.action.setBadgeBackgroundColor({ color: b.color, tabId });
}

// Global badge (visible from ANY tab)
function applyGlobalBadge(state) {
  const b = BADGE[state] || BADGE.idle;
  chrome.action.setBadgeText({ text: b.text });
  chrome.action.setBadgeBackgroundColor({ color: b.color });
}

// Pick the most "interesting" state across all AI tabs
// thinking > done > idle
function getMostImportantState() {
  const states = Object.values(tabStates).map(t => t.state);
  if (states.includes("thinking")) return "thinking";
  if (states.includes("done"))     return "done";
  return "idle";
}

// ── Keep service worker alive ────────────────────────────────────────────────
chrome.alarms.create("keepAlive", { periodInMinutes: 0.4 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "keepAlive") chrome.storage.local.get("lastState", () => {});
});

// ── Fire notification ────────────────────────────────────────────────────────
function fireNotification(id, title, message) {
  chrome.notifications.create(id, {
    type: "basic",
    iconUrl: "icons/done48.png",
    title,
    message,
    priority: 2,
    requireInteraction: false,
  }, () => {
    if (chrome.runtime.lastError)
      console.error("[AI Notifier] Notification failed:", chrome.runtime.lastError.message);
  });
}

// ── Message handler ──────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg.type === "AI_STATE_CHANGE") {
    const tabId = sender.tab?.id;
    if (!tabId) return;

    const prev = tabStates[tabId]?.state;
    const { state, platform } = msg;

    tabStates[tabId] = { state, platform };

    // Tab-specific badge
    applyTabBadge(tabId, state);

    // Global badge — reflects most important state across all AI tabs
    applyGlobalBadge(getMostImportantState());

    chrome.storage.local.set({ lastState: state, lastPlatform: platform });
    console.log(`[AI Notifier] Tab ${tabId} (${platform}): ${prev} → ${state}`);

    if (state === "done" && prev === "thinking") {
      chrome.storage.local.get(["notifyEnabled"], (prefs) => {
        if (prefs.notifyEnabled === false) return;
        fireNotification(
          "ai-done-" + tabId + "-" + Date.now(),
          `${platform} finished responding`,
          "Click to switch to the tab."
        );
      });
    }
    return;
  }

  if (msg.type === "TEST_NOTIFICATION") {
    fireNotification("ai-test-" + Date.now(), "🔔 Test Notification", "Notifications are working correctly!");
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === "GET_TAB_STATE") {
    sendResponse(tabStates[msg.tabId] || { state: "idle", platform: "" });
    return true;
  }
});

// ── Notification click → focus tab ──────────────────────────────────────────
chrome.notifications.onClicked.addListener((notifId) => {
  chrome.notifications.clear(notifId);
  if (!notifId.startsWith("ai-done-")) return;
  const tabId = parseInt(notifId.split("-")[2], 10);
  if (!isNaN(tabId)) {
    chrome.tabs.update(tabId, { active: true }, (tab) => {
      if (tab?.windowId) chrome.windows.update(tab.windowId, { focused: true });
    });
  }
});

// ── Clean up & refresh global badge on tab close/navigate ───────────────────
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    delete tabStates[tabId];
    applyTabBadge(tabId, "idle");
    applyGlobalBadge(getMostImportantState());
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabStates[tabId];
  applyGlobalBadge(getMostImportantState());
});

// When active tab changes, reflect global state
chrome.tabs.onActivated.addListener(() => {
  applyGlobalBadge(getMostImportantState());
});
