/* pynenc.org - reusable mushroom decorations for publication pages */
(function () {
  "use strict";

  var SHROOM_SRC = "/assets/img/shared/pynenc_logo.png";

  function createShroom(className) {
    var img = document.createElement("img");
    img.src = SHROOM_SRC;
    img.alt = "";
    img.className = className;
    return img;
  }

  function createBand(className, count) {
    var band = document.createElement("div");
    band.className = className;

    for (var i = 0; i < count; i++) {
      var shroom = createShroom("shroom-sm publication-shroom-token");
      shroom.style.transform = "rotate(" + ((i % 2 === 0 ? -1 : 1) * (8 + i * 3)) + "deg)";
      band.appendChild(shroom);
    }

    return band;
  }

  function createDivider() {
    var divider = document.createElement("div");
    divider.className = "shroom-divider publication-shroom-divider";
    divider.appendChild(createShroom("publication-shroom-token"));
    return divider;
  }

  function decorateMedia(article) {
    var mediaImages = article.querySelectorAll(
      "img[src*='/assets/img/publications/'], img[src*='assets/img/publications/']," +
      "img[src*='/assets/img/posts/'], img[src*='assets/img/posts/']," +
      "img[src*='/assets/img/shared/'], img[src*='assets/img/shared/']"
    );

    mediaImages.forEach(function (image) {
      var src = image.getAttribute("src") || "";
      if (
        src.indexOf("pynenc_logo") !== -1 ||
        image.classList.contains("publication-shroom-token") ||
        image.classList.contains("shroom-dot") ||
        image.classList.contains("shroom-sm")
      ) {
        return;
      }

      image.classList.add("pynmon-screenshot", "lightbox-target");

      if (
        image.parentElement &&
        image.parentElement.tagName === "P" &&
        !image.parentElement.classList.contains("pynmon-showcase")
      ) {
        image.parentElement.classList.add("pynmon-showcase");
      }
    });
  }

  function decorateHeadings(article) {
    var headings = article.querySelectorAll("h2");

    headings.forEach(function (heading, index) {
      var floatClass = index % 2 === 0
        ? "shroom-float-right publication-shroom-float publication-shroom-token"
        : "shroom-float-left publication-shroom-float publication-shroom-token";

      heading.parentNode.insertBefore(createShroom(floatClass), heading);

      if (heading.nextElementSibling) {
        heading.parentNode.insertBefore(createDivider(), heading.nextElementSibling);
      }
    });
  }

  function decoratePublication(article) {
    if (article.dataset.shroomsDecorated === "true") {
      return;
    }
    article.dataset.shroomsDecorated = "true";
    article.classList.add("publication-with-shrooms");

    var topBand = createBand("publication-shroom-band", 5);
    var bottomBand = createBand("publication-shroom-band publication-shroom-band-bottom", 4);

    article.insertBefore(topBand, article.firstChild);
    decorateMedia(article);
    decorateHeadings(article);
    article.appendChild(bottomBand);
  }

  function init() {
    var articles = document.querySelectorAll("article.blog-post");
    if (!articles.length) {
      return;
    }

    articles.forEach(function (article) {
      decoratePublication(article);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
