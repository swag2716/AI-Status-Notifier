(function () {
  var hostname = location.hostname;
  var PLATFORM_NAME = {
    "claude.ai": "Claude",
    "chat.openai.com": "ChatGPT",
    "chatgpt.com": "ChatGPT",
    "gemini.google.com": "Gemini",
    "www.perplexity.ai": "Perplexity",
    "copilot.microsoft.com": "Copilot"
  };
  var platform = PLATFORM_NAME[hostname];
  if (!platform) return;

  var currentState = "idle";
  var doneTimer = null;
  var STABLE_MS = 1500;
  var debugInfo = { stopBtn: false, streamClass: false, fieldset: false, textChange: false };

  // ── Visibility check ────────────────────────────────────────────────────────
  function isVisible(el) {
    if (!el) return false;
    var s = window.getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || s.opacity === "0") return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  // ── Stop button detection ───────────────────────────────────────────────────
  // Only match very specific stop-related labels, not generic "stop"
  function hasStopButton() {
    var stopPhrases = ["stop response", "stop generating", "stop streaming", "stop responding"];
    var buttons = document.querySelectorAll("button");
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      if (!isVisible(btn)) continue;
      var label = (btn.getAttribute("aria-label") || "").toLowerCase();
      var testid = (btn.getAttribute("data-testid") || "").toLowerCase();
      // Exact testid match
      if (testid === "stop-button") return true;
      // Phrase match on aria-label
      for (var j = 0; j < stopPhrases.length; j++) {
        if (label.indexOf(stopPhrases[j]) !== -1) return true;
      }
    }
    return false;
  }

  // ── Streaming class detection ───────────────────────────────────────────────
  function hasStreamingClass() {
    if (document.querySelector(".result-streaming")) return true;
    if (document.querySelector('[data-is-streaming="true"]')) return true;
    if (document.querySelector('[data-state="streaming"]')) return true;
    return false;
  }

  // ── Composer/fieldset disabled (Claude specific) ───────────────────────────
  function isComposerDisabled() {
    if (hostname !== "claude.ai") return false;
    return !!document.querySelector("fieldset[disabled]");
  }

  // ── Text change watcher — ONLY for known response containers ───────────────
  var lastText = "";
  var lastTextTime = 0;
  var TEXT_STABLE_MS = 2000;

  function getResponseContainer() {
    var el = null;
    if (hostname === "claude.ai") {
      var msgs = document.querySelectorAll('[data-testid="assistant-message"]');
      if (msgs.length) el = msgs[msgs.length - 1];
    } else if (hostname === "chat.openai.com" || hostname === "chatgpt.com") {
      var msgs = document.querySelectorAll('[data-message-author-role="assistant"]');
      if (msgs.length) el = msgs[msgs.length - 1];
    } else if (hostname === "gemini.google.com") {
      var msgs = document.querySelectorAll("model-response");
      if (msgs.length) el = msgs[msgs.length - 1];
    }
    return el;
  }

  function isTextChanging() {
    var el = getResponseContainer();
    if (!el) return false;
    var text = el.textContent;
    if (text !== lastText) {
      lastText = text;
      lastTextTime = Date.now();
      return true;
    }
    // Text recently changed but now stable
    if (lastTextTime > 0 && (Date.now() - lastTextTime) < TEXT_STABLE_MS) return true;
    return false;
  }

  // ── Combined ────────────────────────────────────────────────────────────────
  function isThinking() {
    debugInfo.stopBtn     = hasStopButton();
    debugInfo.streamClass = hasStreamingClass();
    debugInfo.fieldset    = isComposerDisabled();
    debugInfo.textChange  = isTextChanging();
    return debugInfo.stopBtn || debugInfo.streamClass || debugInfo.fieldset || debugInfo.textChange;
  }

  // ── State machine ───────────────────────────────────────────────────────────
  function setState(newState) {
    if (newState === currentState) return;
    currentState = newState;
    try {
      chrome.runtime.sendMessage({ type: "AI_STATE_CHANGE", state: newState, platform: platform });
    } catch (e) {}
  }

  function tick() {
    var thinking = isThinking();
    if (thinking) {
      clearTimeout(doneTimer);
      doneTimer = null;
      setState("thinking");
    } else if (currentState === "thinking") {
      if (!doneTimer) {
        doneTimer = setTimeout(function () {
          if (!isThinking()) {
            setState("done");
            setTimeout(function () {
              if (currentState === "done") setState("idle");
            }, 8000);
          }
          doneTimer = null;
        }, STABLE_MS);
      }
    }
  }

  setInterval(tick, 300);
  var observer = new MutationObserver(tick);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    if (msg.type === "GET_STATE") {
      sendResponse({ state: currentState, platform: platform, debug: debugInfo });
    }
  });

  tick();
})();
