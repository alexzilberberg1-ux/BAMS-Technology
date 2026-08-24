/**
 * BAMS Practice Assistant — embeddable chat widget (HIPAA-conscious build).
 *
 * Usage on a practice's website:
 *   <script src="https://assistant.bamstechnology.com/widget/widget.js"
 *           data-client="lakeside-dental" defer></script>
 *
 * Privacy posture:
 *  - Nothing is written to localStorage, sessionStorage, or cookies. The
 *    session id lives in JS memory only and dies with the page.
 *  - A consent notice (server-configured per practice) is shown before the
 *    first message, with an emergency disclaimer pinned in the chat.
 *  - All traffic goes to the practice's assistant endpoint over HTTPS; there
 *    are no third-party requests, fonts, or analytics.
 */
(function () {
  var script = document.currentScript;
  if (!script) return;
  var clientId = script.getAttribute("data-client");
  if (!clientId) return console.error("[bams-widget] missing data-client attribute");
  var apiBase = script.getAttribute("data-api") || new URL(script.src).origin;
  if (apiBase.indexOf("https:") !== 0 && apiBase.indexOf("http://localhost") !== 0) {
    return console.error("[bams-widget] refusing to run over non-HTTPS endpoint");
  }
  var base = apiBase + "/api/" + encodeURIComponent(clientId);

  var state = { open: false, sessionId: null, cfg: null, busy: false, consented: false };

  fetch(base + "/widget-config")
    .then(function (r) {
      if (!r.ok) throw new Error("widget-config " + r.status);
      return r.json();
    })
    .then(function (cfg) {
      state.cfg = cfg;
      render();
    })
    .catch(function (e) {
      console.error("[bams-widget]", e);
    });

  function el(tag, styles, text) {
    var node = document.createElement(tag);
    if (styles) Object.assign(node.style, styles);
    if (text != null) node.textContent = text;
    return node;
  }

  function render() {
    var b = state.cfg.branding;
    var c = state.cfg.compliance || {};

    var button = el("button", {
      position: "fixed", right: "20px", bottom: "20px", width: "60px", height: "60px",
      borderRadius: "50%", border: "none", cursor: "pointer", zIndex: "99999",
      background: b.primaryColor, color: "#fff", fontSize: "26px",
      boxShadow: "0 8px 24px rgba(0,0,0,.25)",
    }, b.avatar);
    button.setAttribute("aria-label", "Chat with " + b.assistantName);
    button.setAttribute("aria-expanded", "false");

    var panel = el("div", {
      position: "fixed", right: "20px", bottom: "92px", width: "360px", maxWidth: "calc(100vw - 40px)",
      height: "540px", maxHeight: "calc(100vh - 120px)", background: "#fff", borderRadius: "16px",
      boxShadow: "0 20px 60px rgba(0,0,0,.3)", display: "none", flexDirection: "column",
      overflow: "hidden", zIndex: "99999", fontFamily: "system-ui, sans-serif",
    });
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", b.assistantName + " chat");

    var header = el("div", {
      background: b.primaryColor, color: "#fff", padding: "12px 16px",
      fontWeight: "700", fontSize: "15px",
    }, b.assistantName + " · " + b.practiceName);

    var emergency = el("div", {
      background: "#fff7ed", color: "#9a3412", padding: "7px 12px", fontSize: "12px",
      borderBottom: "1px solid #fed7aa", lineHeight: "1.35",
    }, c.emergencyNote || "If this is a medical emergency, call 911.");

    var messages = el("div", {
      flex: "1", overflowY: "auto", padding: "12px", display: "flex",
      flexDirection: "column", gap: "8px", background: "#f7f8fb",
    });
    messages.setAttribute("role", "log");
    messages.setAttribute("aria-live", "polite");

    var form = el("form", { display: "flex", padding: "10px", gap: "8px", background: "#fff" });
    var input = el("input", {
      flex: "1", border: "1px solid #dde2ec", borderRadius: "999px",
      padding: "10px 14px", fontSize: "14px", outline: "none",
    });
    input.placeholder = "Type a message…";
    input.maxLength = 1000;
    input.setAttribute("aria-label", "Message " + b.assistantName);
    var send = el("button", {
      border: "none", borderRadius: "999px", padding: "10px 16px", cursor: "pointer",
      background: b.primaryColor, color: "#fff", fontWeight: "700", fontSize: "14px",
    }, "Send");
    form.appendChild(input);
    form.appendChild(send);

    var footer = el("div", {
      textAlign: "center", fontSize: "10px", color: "#8a94a8", padding: "0 0 6px 0", background: "#fff",
    }, "Powered by BAMS Technology");

    panel.appendChild(header);
    panel.appendChild(emergency);
    panel.appendChild(messages);
    panel.appendChild(form);
    panel.appendChild(footer);
    document.body.appendChild(panel);
    document.body.appendChild(button);

    // --- consent gate: shown once per page load, before any chat ---
    var consent = el("div", {
      position: "absolute", inset: "0", background: "rgba(255,255,255,.97)", zIndex: "2",
      display: "flex", flexDirection: "column", justifyContent: "center", padding: "22px", gap: "12px",
    });
    consent.appendChild(el("div", { fontWeight: "800", fontSize: "16px", color: "#13233f" }, "Before you chat"));
    consent.appendChild(el("div", { fontSize: "13px", color: "#3d4a63", lineHeight: "1.5" },
      c.consentText || "Please don't share detailed medical history here — only what's needed to book."));
    consent.appendChild(el("div", { fontSize: "13px", color: "#9a3412", lineHeight: "1.5" },
      c.emergencyNote || "If this is a medical emergency, call 911."));
    if (c.privacyPolicyUrl) {
      var link = el("a", { fontSize: "12px", color: b.primaryColor }, "Privacy policy");
      link.href = c.privacyPolicyUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      consent.appendChild(link);
    }
    var agree = el("button", {
      border: "none", borderRadius: "999px", padding: "10px 18px", cursor: "pointer",
      background: b.primaryColor, color: "#fff", fontWeight: "700", fontSize: "14px", alignSelf: "flex-start",
    }, "I understand — start chat");
    consent.appendChild(agree);
    panel.style.position = "fixed";
    panel.appendChild(consent);

    agree.addEventListener("click", function () {
      state.consented = true;
      consent.remove();
      if (messages.childElementCount === 0) bubble(b.greeting, false);
      input.focus();
    });

    function bubble(text, mine) {
      var node = el("div", {
        maxWidth: "85%", padding: "9px 13px", borderRadius: "14px", fontSize: "14px",
        lineHeight: "1.4", whiteSpace: "pre-wrap",
        alignSelf: mine ? "flex-end" : "flex-start",
        background: mine ? b.primaryColor : "#fff",
        color: mine ? "#fff" : "#1d2b45",
        boxShadow: mine ? "none" : "0 1px 3px rgba(0,0,0,.08)",
      }, text);
      messages.appendChild(node);
      messages.scrollTop = messages.scrollHeight;
      return node;
    }

    function setOpen(open) {
      state.open = open;
      panel.style.display = open ? "flex" : "none";
      button.setAttribute("aria-expanded", String(open));
      if (open && state.consented && messages.childElementCount === 0) bubble(b.greeting, false);
      if (open && state.consented) input.focus();
    }

    button.addEventListener("click", function () { setOpen(!state.open); });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && state.open) setOpen(false);
    });

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (!state.consented) return;
      var text = input.value.trim();
      if (!text || state.busy) return;
      input.value = "";
      bubble(text, true);
      var typing = bubble("…", false);
      state.busy = true;
      send.disabled = true;

      fetch(base + "/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: state.sessionId, message: text }),
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          state.sessionId = data.sessionId || state.sessionId;
          typing.textContent = data.reply || data.error || "Sorry, something went wrong.";
        })
        .catch(function () {
          typing.textContent = "Connection trouble — please try again or call the office.";
        })
        .then(function () {
          state.busy = false;
          send.disabled = false;
          messages.scrollTop = messages.scrollHeight;
        });
    });
  }
})();
