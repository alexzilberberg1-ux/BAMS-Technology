/**
 * BAMS Practice Assistant — embeddable chat widget.
 *
 * Usage on a practice's website:
 *   <script src="https://assistant.bamstechnology.com/widget/widget.js"
 *           data-client="lakeside-dental" defer></script>
 *
 * No dependencies, themes itself from the client's server-side config.
 */
(function () {
  var script = document.currentScript;
  if (!script) return;
  var clientId = script.getAttribute("data-client");
  if (!clientId) return console.error("[bams-widget] missing data-client attribute");
  var apiBase =
    script.getAttribute("data-api") || new URL(script.src).origin;
  var base = apiBase + "/api/" + encodeURIComponent(clientId);

  var state = { open: false, sessionId: null, branding: null, busy: false };

  fetch(base + "/widget-config")
    .then(function (r) {
      if (!r.ok) throw new Error("widget-config " + r.status);
      return r.json();
    })
    .then(function (cfg) {
      state.branding = cfg.branding;
      render();
    })
    .catch(function (e) {
      console.error("[bams-widget]", e);
    });

  function el(tag, styles, text) {
    var node = document.createElement(tag);
    if (styles) Object.assign(node.style, styles);
    if (text) node.textContent = text;
    return node;
  }

  function render() {
    var b = state.branding;

    var button = el("button", {
      position: "fixed", right: "20px", bottom: "20px", width: "60px", height: "60px",
      borderRadius: "50%", border: "none", cursor: "pointer", zIndex: "99999",
      background: b.primaryColor, color: "#fff", fontSize: "26px",
      boxShadow: "0 8px 24px rgba(0,0,0,.25)",
    }, b.avatar);
    button.setAttribute("aria-label", "Open chat with " + b.assistantName);

    var panel = el("div", {
      position: "fixed", right: "20px", bottom: "92px", width: "360px", maxWidth: "calc(100vw - 40px)",
      height: "520px", maxHeight: "calc(100vh - 120px)", background: "#fff", borderRadius: "16px",
      boxShadow: "0 20px 60px rgba(0,0,0,.3)", display: "none", flexDirection: "column",
      overflow: "hidden", zIndex: "99999", fontFamily: "system-ui, sans-serif",
    });

    var header = el("div", {
      background: b.primaryColor, color: "#fff", padding: "14px 16px",
      fontWeight: "700", fontSize: "15px",
    }, b.assistantName + " · " + b.practiceName);

    var messages = el("div", {
      flex: "1", overflowY: "auto", padding: "12px", display: "flex",
      flexDirection: "column", gap: "8px", background: "#f7f8fb",
    });

    var form = el("form", { display: "flex", padding: "10px", gap: "8px", background: "#fff" });
    var input = el("input", {
      flex: "1", border: "1px solid #dde2ec", borderRadius: "999px",
      padding: "10px 14px", fontSize: "14px", outline: "none",
    });
    input.placeholder = "Type a message…";
    var send = el("button", {
      border: "none", borderRadius: "999px", padding: "10px 16px", cursor: "pointer",
      background: b.primaryColor, color: "#fff", fontWeight: "700", fontSize: "14px",
    }, "Send");
    form.appendChild(input);
    form.appendChild(send);

    panel.appendChild(header);
    panel.appendChild(messages);
    panel.appendChild(form);
    document.body.appendChild(panel);
    document.body.appendChild(button);

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

    button.addEventListener("click", function () {
      state.open = !state.open;
      panel.style.display = state.open ? "flex" : "none";
      if (state.open && messages.childElementCount === 0) bubble(b.greeting, false);
      if (state.open) input.focus();
    });

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var text = input.value.trim();
      if (!text || state.busy) return;
      input.value = "";
      bubble(text, true);
      var typing = bubble("…", false);
      state.busy = true;

      fetch(base + "/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: state.sessionId, message: text }),
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          state.sessionId = data.sessionId || state.sessionId;
          typing.textContent = data.reply || "Sorry, something went wrong.";
        })
        .catch(function () {
          typing.textContent = "Connection trouble — please try again or call the office.";
        })
        .then(function () {
          state.busy = false;
          messages.scrollTop = messages.scrollHeight;
        });
    });
  }
})();
