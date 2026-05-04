/* pynenc.org — mushroom slides next to "Pynenc" when you scroll past the avatar */
(function () {
  "use strict";

  function init() {
    var src = "/assets/img/shared/pynenc_logo.png";
    var brand = document.querySelector(".navbar-custom .navbar-brand");
    if (!brand) return;

    /* Create the small inline mushroom (hidden by default via CSS) */
    var img = document.createElement("img");
    img.src = src;
    img.alt = "";
    img.className = "brand-shroom";
    brand.prepend(img);

    var nav = document.querySelector(".navbar-custom");
    if (!nav) return;

    function sync() {
      var short = nav.classList.contains("top-nav-short");
      if (short) {
        img.classList.add("visible");
      } else {
        img.classList.remove("visible");
      }
    }

    /* MutationObserver: react whenever Beautiful Jekyll toggles the class */
    new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        if (mutations[i].attributeName === "class") { sync(); break; }
      }
    }).observe(nav, { attributes: true });

    /* Belt-and-suspenders: also check on scroll */
    window.addEventListener("scroll", sync, { passive: true });

    sync(); /* set correct state on load */
  }

  /* Ensure DOM is ready before querying */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
