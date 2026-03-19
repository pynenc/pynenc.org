/* pynenc.org — mushroom collection
   As mushrooms scroll above the viewport they are "collected" into the navbar.
   Scrolling back down releases them back to the page. */
(function () {
  "use strict";

  var SELECTOR = [
    "img.shroom-dot",
    "img.shroom-sm",
    "img.shroom-float-right",
    "img.shroom-float-left",
    ".shroom-divider img"
  ].join(", ");

  /* Varied sizes (px) and rotations (deg) for the navbar tokens */
  var SIZES = [16, 21, 14, 24, 18, 20, 13, 22, 17, 25, 15, 19];
  var ROTS  = [-10, 15, -18, 8, -12, 20, -6, 14, -22, 10, -15, 7];

  var pairMap = new WeakMap(); /* page img → pair */

  function restingOpacity(img) {
    return (img.classList.contains("shroom-float-right") ||
            img.classList.contains("shroom-float-left")) ? "0.85" : "1";
  }

  function collect(pair) {
    if (pair.collected) return;
    pair.collected = true;
    /* Shrink + fade out of page */
    pair.page.style.opacity = "0";
    pair.page.style.transform = "translateY(-10px) scale(0.2)";
    /* Grow into navbar */
    pair.nav.style.opacity = "1";
    pair.nav.style.transform = "scale(1) rotate(" + pair.rot + "deg)";
  }

  function uncollect(pair) {
    if (!pair.collected) return;
    pair.collected = false;
    /* Restore page mushroom (remove inline overrides; CSS takes over) */
    pair.page.style.opacity = restingOpacity(pair.page);
    pair.page.style.transform = "";
    /* Shrink out of navbar */
    pair.nav.style.opacity = "0";
    pair.nav.style.transform = "scale(0) rotate(" + pair.rot + "deg)";
  }

  function init() {
    var nav = document.querySelector("nav.navbar-custom");
    if (!nav) return;

    var allShrooms = Array.prototype.slice.call(
      document.querySelectorAll(SELECTOR)
    ).filter(function (el) { return !el.closest(".navbar-custom"); });

    if (!allShrooms.length) return;

    /* Inject collection container as the first child of the collapse area
       so it sits between the brand and the navlinks in the flex row */
    var collection = document.createElement("div");
    collection.className = "shroom-collection";
    var collapse = nav.querySelector(".navbar-collapse");
    if (collapse) {
      collapse.insertBefore(collection, collapse.firstChild);
    } else {
      nav.appendChild(collection);
    }

    /* Build a pair (page img ↔ nav token) for every mushroom */
    var pairs = allShrooms.map(function (img, i) {
      var size = SIZES[i % SIZES.length];
      var rot  = ROTS[i % ROTS.length];

      /* Smooth transition so collect/uncollect animate */
      img.style.transition = "opacity 0.55s ease, transform 0.55s ease";

      /* Navbar token — starts invisible */
      var navImg = document.createElement("img");
      navImg.src = "/assets/img/pynenc_logo.png";
      navImg.alt = "";
      navImg.style.cssText = [
        "width:"  + size + "px",
        "height:" + size + "px",
        "object-fit:contain",
        "opacity:0",
        "transform:scale(0) rotate(" + rot + "deg)",
        "transition:opacity 0.5s ease, transform 0.5s ease",
        "flex-shrink:0"
      ].join(";");
      collection.appendChild(navImg);

      var pair = { page: img, nav: navImg, rot: rot, collected: false };
      pairMap.set(img, pair);
      return pair;
    });

    /* One observer for all mushrooms.
       - isIntersecting → visible in page → uncollect
       - not intersecting AND top < 0 → scrolled above viewport → collect
       - not intersecting AND top > 0 → below viewport, not yet reached → leave alone */
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var pair = pairMap.get(entry.target);
        if (!pair) return;
        if (entry.isIntersecting) {
          uncollect(pair);
        } else if (entry.boundingClientRect.top < 0) {
          collect(pair);
        }
      });
    }, { threshold: 0.1 });

    allShrooms.forEach(function (img) { observer.observe(img); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

