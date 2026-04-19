/* pynenc.org - copy button for code blocks */
(function () {
  "use strict";

  var COPY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="10" height="10" rx="2"></rect><path d="M15 9V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path></svg>';
  var CHECK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13l4 4L19 7"></path></svg>';
  var ERROR_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 9v4"></path><path d="M12 17h.01"></path><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path></svg>';
  var clipboard;

  function getCodeText(codeEl) {
    return codeEl.textContent.replace(/\n$/, "");
  }

  function renderButtonState(button, state) {
    var icon = COPY_ICON;
    var label = "Copy code";

    button.classList.remove("copied", "failed");

    if (state === "copied") {
      icon = CHECK_ICON;
      label = "Copied";
      button.classList.add("copied");
    } else if (state === "failed") {
      icon = ERROR_ICON;
      label = "Copy failed";
      button.classList.add("failed");
    }

    button.innerHTML = icon + '<span class="sr-only">' + label + '</span>';
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
  }

  function showTemporaryState(button, state) {
    renderButtonState(button, state);
    window.setTimeout(function () {
      renderButtonState(button, "default");
    }, 1500);
  }

  function copyFallback(text) {
    return new Promise(function (resolve, reject) {
      var textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      textarea.style.pointerEvents = "none";

      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);

      var ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (err) {
        reject(err);
      } finally {
        document.body.removeChild(textarea);
      }

      if (ok) {
        resolve();
      } else {
        reject(new Error("Copy command failed"));
      }
    });
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }

    return copyFallback(text);
  }

  function manualCopy(button) {
    var text = button.getAttribute("data-copy-text") || "";

    return copyText(text)
      .then(function () {
        showTemporaryState(button, "copied");
      })
      .catch(function () {
        showTemporaryState(button, "failed");
      });
  }

  function attachButton(container) {
    if (container.dataset.copyReady === "true") {
      return;
    }

    var code = container.querySelector("pre code");
    if (!code) {
      code = container.querySelector("pre");
    }

    if (!code) {
      return;
    }

    container.dataset.copyReady = "true";
    container.classList.add("code-copy-container");

    var button = document.createElement("button");
    button.type = "button";
    button.className = "code-copy-btn";
    button.setAttribute("data-copy-text", getCodeText(code));
    renderButtonState(button, "default");

    if (!window.ClipboardJS) {
      button.addEventListener("click", function () {
        manualCopy(button);
      });
    }

    container.appendChild(button);
  }

  function initClipboardJs() {
    if (!window.ClipboardJS) {
      return;
    }

    if (clipboard) {
      clipboard.destroy();
    }

    clipboard = new window.ClipboardJS(".code-copy-btn", {
      text: function (trigger) {
        return trigger.getAttribute("data-copy-text") || "";
      }
    });

    clipboard.on("success", function (event) {
      showTemporaryState(event.trigger, "copied");
      if (event.clearSelection) {
        event.clearSelection();
      }
    });

    clipboard.on("error", function (event) {
      manualCopy(event.trigger);
    });
  }

  function init() {
    var blocks = document.querySelectorAll("div.highlighter-rouge, figure.highlight");
    blocks.forEach(attachButton);
    initClipboardJs();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
