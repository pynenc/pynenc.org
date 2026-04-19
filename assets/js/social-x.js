/* pynenc.org - replace legacy Twitter link/icon with X */
(function () {
  "use strict";

  var X_URL = "https://x.com/pynenc";
  var X_ICON = '<span class="x-social-icon x-social-icon-text fa-stack-1x fa-inverse" aria-hidden="true">X</span>';

  function patchTwitterLinks() {
    var links = document.querySelectorAll('a[href*="twitter.com/pynenc"], a[href*="x.com/pynenc"]');

    links.forEach(function (link) {
      link.href = X_URL;
      link.title = "X";
      link.setAttribute("aria-label", "X");

      var sr = link.querySelector(".sr-only");
      if (sr) {
        sr.textContent = "X";
      }

      var twitterIcon = link.querySelector("i.fab.fa-twitter, i.fa-brands.fa-twitter, i.fa-x-twitter");
      if (twitterIcon) {
        twitterIcon.outerHTML = X_ICON;
      } else if (!link.querySelector(".x-social-icon")) {
        var stack = link.querySelector(".fa-stack");
        if (stack) {
          stack.insertAdjacentHTML("beforeend", X_ICON);
        }
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", patchTwitterLinks);
  } else {
    patchTwitterLinks();
  }
})();
