(function () {
  "use strict";
  var isEmbed =
    window !== window.top || /(?:\?|&)embed=1(?:&|$)/.test(location.search || "");
  if (!isEmbed) return;
  var ROOT = document.getElementById("po-root");
  if (!ROOT) return;

  var EMBED_MIN_H = 680;
  var embedBurstGen = 0;
  var embedMutObs = null;
  var embedMeasuring = false;
  var lastReportH = 0;

  function isMobileDevice() {
    try {
      if (window.matchMedia("(pointer: fine)").matches && !window.matchMedia("(pointer: coarse)").matches) {
        return false;
      }
    } catch (e) {}
    var touch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
    var narrow = false;
    var coarse = false;
    try {
      narrow = window.matchMedia("(max-width: 700px)").matches;
      coarse = window.matchMedia("(pointer: coarse)").matches;
    } catch (e2) {}
    return (touch && coarse) || narrow;
  }

  function isMobileEmbed() {
    return isMobileDevice();
  }

  function syncMobileClass() {
    document.documentElement.classList.toggle("po-mobile", isMobileDevice());
  }

  function isMenuOpen() {
    var title = document.getElementById("po-title");
    return !!(title && title.classList.contains("show"));
  }

  function isScrollTarget(node) {
    return node && node.closest && node.closest(".po-overlay, .po-dossier, .po-paper-dossier, .po-log, .po-touch, .po-stick, .po-look-btn");
  }

  function blockEmbedScroll(e) {
    if (isMobileEmbed()) return;
    if (isScrollTarget(e.target)) return;
    e.preventDefault();
  }

  function resetEmbedMeasureStyles() {
    var doc = document.documentElement;
    var bod = document.body;
    var shell = ROOT.querySelector(".po-shell");
    var title = document.getElementById("po-title");
    [doc, bod, ROOT, shell, title].forEach(function (el) {
      if (!el) return;
      el.style.height = "auto";
      el.style.minHeight = "0";
      el.style.maxHeight = "none";
    });
  }

  function considerBottom(maxBottom, el) {
    if (!el || el.hidden) return maxBottom;
    if (el.offsetParent === null && !(el.classList && el.classList.contains("show"))) return maxBottom;
    var r = el.getBoundingClientRect();
    if (r.height <= 0) return maxBottom;
    return r.bottom > maxBottom ? r.bottom : maxBottom;
  }

  function measureEmbedHeight() {
    resetEmbedMeasureStyles();
    var rootTop = ROOT.getBoundingClientRect().top;
    var maxBottom = rootTop;
    var menuOpen = isMenuOpen();

    ROOT.classList.toggle("po-ui-menu", menuOpen);
    ROOT.classList.toggle("po-ui-play", !menuOpen);

    if (menuOpen) {
      var title = document.getElementById("po-title");
      maxBottom = considerBottom(maxBottom, title);
      if (title) {
        var tr = title.getBoundingClientRect();
        var th = Math.max(title.scrollHeight || 0, title.offsetHeight || 0, tr.height || 0);
        maxBottom = Math.max(maxBottom, tr.top + th);
      }
    } else {
      var shell = ROOT.querySelector(".po-shell");
      var w = Math.max(1, ROOT.clientWidth || shell && shell.clientWidth || window.innerWidth || 320);
      var gameH = Math.round(w * 9 / 16);
      if (shell) {
        var sr = shell.getBoundingClientRect();
        maxBottom = Math.max(maxBottom, sr.top + gameH);
      }
      maxBottom = considerBottom(maxBottom, shell);
      maxBottom = considerBottom(maxBottom, document.getElementById("po-bottom-bar"));
      maxBottom = considerBottom(maxBottom, document.getElementById("po-touch"));
      maxBottom = considerBottom(maxBottom, document.getElementById("po-hud-canvas"));
      document.querySelectorAll(".po-overlay.show").forEach(function (el) {
        maxBottom = considerBottom(maxBottom, el);
      });
    }

    var bboxH = Math.ceil(Math.max(0, maxBottom - rootTop)) + 8;
    if (isMobileEmbed()) {
      return Math.ceil(Math.max(EMBED_MIN_H, bboxH));
    }
    return Math.ceil(Math.max(
      EMBED_MIN_H,
      bboxH,
      menuOpen ? (ROOT.scrollHeight || 0) : 0,
      menuOpen ? (document.documentElement.scrollHeight || 0) : 0
    ));
  }

  function applyEmbedFrameHeight(h) {
    h = Math.max(EMBED_MIN_H, Math.round(h || measureEmbedHeight()));
    var mobile = isMobileEmbed();
    syncMobileClass();
    if (mobile) {
      resetEmbedMeasureStyles();
      [document.documentElement, document.body, ROOT].forEach(function (el) {
        el.style.overflowX = "hidden";
        el.style.overflowY = "visible";
        el.style.touchAction = "pan-y";
      });
    } else {
      [document.documentElement, document.body, ROOT].forEach(function (el) {
        el.style.height = h + "px";
        el.style.minHeight = h + "px";
        el.style.maxHeight = h + "px";
        el.style.overflow = "hidden";
      });
    }
    return h;
  }

  function flushEmbedResize() {
    if (!window.parent || embedMeasuring) return;
    embedMeasuring = true;
    try {
      var h = applyEmbedFrameHeight(measureEmbedHeight());
      if (isMobileEmbed() && lastReportH > 0 && h > lastReportH + 16 && !isMenuOpen()) {
        h = lastReportH;
      }
      lastReportH = h;
      window.parent.postMessage({
        type: "po-resize",
        height: h,
        mobile: isMobileEmbed()
      }, "*");
      window.parent.postMessage({
        type: "po-mobile",
        active: isMobileEmbed()
      }, "*");
    } catch (e) {} finally {
      embedMeasuring = false;
    }
  }

  function scheduleEmbedResizeBurst() {
    if (!isMobileEmbed()) return;
    flushEmbedResize();
    var gen = ++embedBurstGen;
    [32, 96].forEach(function (ms) {
      setTimeout(function () {
        if (gen !== embedBurstGen) return;
        flushEmbedResize();
      }, ms);
    });
  }

  function bindEmbedResizeObserver() {
    if (!isMobileEmbed() || embedMutObs || !window.MutationObserver) return;
    var debounce = null;
    embedMutObs = new MutationObserver(function () {
      clearTimeout(debounce);
      debounce = setTimeout(flushEmbedResize, 32);
    });
    embedMutObs.observe(ROOT, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden"] });
  }

  function notifyResize() {
    flushEmbedResize();
    requestAnimationFrame(flushEmbedResize);
  }

  syncMobileClass();
  applyEmbedFrameHeight(measureEmbedHeight());
  bindEmbedResizeObserver();
  document.addEventListener("wheel", blockEmbedScroll, { passive: false });
  document.addEventListener("touchmove", blockEmbedScroll, { passive: false });
  window.addEventListener("resize", notifyResize);
  window.addEventListener("orientationchange", function () {
    lastReportH = 0;
    setTimeout(function () {
      syncMobileClass();
      notifyResize();
      scheduleEmbedResizeBurst();
    }, 160);
  });
  window.addEventListener("message", function (e) {
    if (!e.data || typeof e.data !== "object") return;
    if (e.data.type === "po-request-resize") {
      flushEmbedResize();
      scheduleEmbedResizeBurst();
    }
  });
  notifyResize();
  scheduleEmbedResizeBurst();
})();
