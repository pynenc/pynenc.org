/* pynenc.org - minimal post subheader (no author, no share buttons) */
(function () {
  "use strict";

  var LINK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>';

  function getWordCount(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  function copyUrl(button) {
    var url = window.location.href;
    var label = button.querySelector(".post-copy-label");

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(function () {
        showCopied(label);
      });
    } else {
      var ta = document.createElement("textarea");
      ta.value = url;
      ta.style.cssText = "position:fixed;opacity:0;pointer-events:none";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); showCopied(label); }
      catch (e) { /* silent */ }
      document.body.removeChild(ta);
    }
  }

  function showCopied(label) {
    var orig = label.textContent;
    label.textContent = "Copied!";
    setTimeout(function () { label.textContent = orig; }, 1500);
  }

  function buildSubheader(article) {
    if (document.querySelector(".post-subheader-minimal")) return;

    var dateEl = document.querySelector(".intro-header .post-meta");
    var dateText = "";
    if (dateEl) {
      dateText = dateEl.textContent.replace(/^Posted on\s+/i, "").trim();
    }

    var words = getWordCount(article.innerText || article.textContent || "");
    var minutes = Math.max(1, Math.round(words / 220));

    var row = document.createElement("div");
    row.className = "post-subheader-minimal";

    /* Left group: read time + copy URL */
    var left = document.createElement("div");
    left.className = "post-subheader-left";

    var readTime = document.createElement("span");
    readTime.className = "post-meta-item";
    readTime.textContent = minutes + " min read";
    left.appendChild(readTime);

    var copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "post-copy-url";
    copyBtn.innerHTML = LINK_ICON + '<span class="post-copy-label">Copy URL</span>';
    copyBtn.addEventListener("click", function () { copyUrl(copyBtn); });
    left.appendChild(copyBtn);

    row.appendChild(left);

    /* Right: date */
    if (dateText) {
      var date = document.createElement("span");
      date.className = "post-meta-date";
      date.textContent = dateText;
      row.appendChild(date);
    }

    /* Insert BEFORE the article so it sits above mushroom decorations */
    article.parentNode.insertBefore(row, article);
    document.body.classList.add("has-post-subheader");
  }

  function init() {
    var article = document.querySelector("article.blog-post");
    if (!article) return;
    buildSubheader(article);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
