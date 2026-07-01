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
  var lastText = "";
  var lastTextTime = 0;
  var doneTimer = null;
  var STABLE_MS = 1500;

  function isVisible(el) {
    if (!el) return false;
    var s = window.getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || s.opacity === "0") return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function hasButtonMatching(keywords) {
    var buttons = document.querySelectorAll("button");
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      if (!isVisible(btn)) continue;
      var text = (
        (btn.getAttribute("aria-label") || "") + " " +
        (btn.getAttribute("data-testid") || "") + " " +
        btn.textContent
      ).toLowerCase();
      for (var j = 0; j < keywords.length; j++) {
        if (text.indexOf(keywords[j]) !== -1) return true;
      }
    }
    return false;
  }

  function detectClaude() {
    if (hasButtonMatching(["stop response", "stop generating", "stop"])) return true;
    if (document.querySelector('[data-is-streaming="true"]')) return true;
    if (document.querySelector("fieldset[disabled]")) return true;
    return false;
  }

  function detectChatGPT() {
    if (document.querySelector('button[data-testid="stop-button"]')) return true;
    if (hasButtonMatching(["stop generating", "stop streaming", "stop"])) return true;
    if (document.querySelector(".result-streaming")) return true;
    if (document.querySelector('[data-state="streaming"]')) return true;
    var formBtns = document.querySelectorAll("form button");
    for (var i = 0; i < formBtns.length; i++) {
      if (formBtns[i].querySelector("rect") && isVisible(formBtns[i])) return true;
    }
    return false;
  }

  function detectGemini() {
    if (hasButtonMatching(["stop generating response", "stop generating", "stop"])) return true;
    if (document.querySelector(".loading-indicator")) return true;
    return false;
  }

  function detectPerplexity() {
    if (hasButtonMatching(["stop", "stop generating"])) return true;
    if (document.querySelector(".generating")) return true;
    return false;
  }

  function detectCopilot() {
    if (hasButtonMatching(["stop responding", "stop"])) return true;
    if (document.querySelector(".typing-indicator")) return true;
    return false;
  }

  function isThinking() {
    if (hostname === "claude.ai") return detectClaude();
    if (hostname === "chat.openai.com" || hostname === "chatgpt.com") return detectChatGPT();
    if (hostname === "gemini.google.com") return detectGemini();
    if (hostname === "www.perplexity.ai") return detectPerplexity();
    if (hostname === "copilot.microsoft.com") return detectCopilot();
    return false;
  }

  function getLastResponseText() {
    var msgs;
    if (hostname === "claude.ai") {
      msgs = document.querySelectorAll('[data-testid="assistant-message"], .font-claude-message');
      if (msgs.length) return msgs[msgs.length - 1].textContent;
    }
    if (hostname === "chat.openai.com" || hostname === "chatgpt.com") {
      msgs = document.querySelectorAll('[data-message-author-role="assistant"]');
      if (msgs.length) return msgs[msgs.length - 1].textContent;
    }
    if (hostname === "gemini.google.com") {
      msgs = document.querySelectorAll("model-response");
      if (msgs.length) return msgs[msgs.length - 1].textContent;
    }
    return document.body.textContent.slice(-300);
  }

  function checkTextChanging() {
    var text = getLastResponseText();
    if (text !== lastText) {
      lastText = text;
      lastTextTime = Date.now();
      return true;
    }
    if (lastTextTime > 0 && (Date.now() - lastTextTime) < STABLE_MS) return true;
    return false;
  }

  function setState(newState) {
    if (newState === currentState) return;
    currentState = newState;
    chrome.runtime.sendMessage({
      type: "AI_STATE_CHANGE",
      state: newState,
      platform: platform,
      url: location.href
    });
  }

  function tick() {
    var textChanging = checkTextChanging();
    var thinking = isThinking() || textChanging;
    if (thinking) {
      clearTimeout(doneTimer);
      doneTimer = null;
      setState("thinking");
    } else if (currentState === "thinking") {
      if (!doneTimer) {
        doneTimer = setTimeout(function () {
          if (!isThinking() && !checkTextChanging()) {
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
      sendResponse({ state: currentState, platform: platform });
    }
  });
  tick();
})();
