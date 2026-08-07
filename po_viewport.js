(function () {
  "use strict";
  var isEmbed =
    window !== window.top || /(?:\?|&)embed=1(?:&|$)/.test(location.search || "");
  if (!isEmbed) return;
  var ROOT = document.getElementById("po-root");
  if (!ROOT) return;

  var EMBED_MIN_H = 680;
  // Region cards + brand need more than play floor on desktop.
  var EMBED_MENU_MIN_H = 980;
  var embedBurstGen = 0;
  var embedMutObs = null;
  var embedMeasuring = false;
  var lastReportH = 0;
  var lastPostedH = 0;

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

  function syncEmbedUiMode() {
    var menuOpen = isMenuOpen();
    ROOT.classList.toggle("po-ui-menu", menuOpen);
    ROOT.classList.toggle("po-ui-play", !menuOpen);
    document.documentElement.classList.toggle("po-ui-menu", menuOpen);
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

  function measureMenuContentHeight(rootTop) {
    // Never use #po-title itself: on desktop embed it is position:absolute;inset:0
    // and tracks the iframe viewport — measuring it feeds a grow loop.
    var title = document.getElementById("po-title");
    var menu = title && title.querySelector(".po-menu");
    var maxBottom = rootTop;
    if (menu) {
      maxBottom = considerBottom(maxBottom, menu);
      var mr = menu.getBoundingClientRect();
      var mh = Math.max(menu.scrollHeight || 0, menu.offsetHeight || 0, mr.height || 0);
      maxBottom = Math.max(maxBottom, mr.top + mh);
      Array.prototype.forEach.call(menu.querySelectorAll(".po-card, .po-brand, .po-regions, .po-a11y"), function (el) {
        maxBottom = considerBottom(maxBottom, el);
      });
    } else if (title) {
      Array.prototype.forEach.call(title.children || [], function (child) {
        maxBottom = considerBottom(maxBottom, child);
      });
    }
    return Math.ceil(Math.max(0, maxBottom - rootTop)) + 16;
  }

  function measureEmbedHeight() {
    resetEmbedMeasureStyles();
    var rootTop = ROOT.getBoundingClientRect().top;
    var maxBottom = rootTop;
    var menuOpen = isMenuOpen();
    var mobile = isMobileEmbed();

    if (menuOpen) {
      var bboxH = measureMenuContentHeight(rootTop);
      var floor = mobile ? Math.min(EMBED_MENU_MIN_H, 860) : EMBED_MENU_MIN_H;
      return Math.ceil(Math.max(floor, bboxH));
    }

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
      if (el.id === "po-title") return;
      var inner = el.querySelector(".po-menu, .panel, .po-dossier, .po-paper-dossier, .po-log-inner");
      maxBottom = considerBottom(maxBottom, inner || el);
    });

    var bboxPlay = Math.ceil(Math.max(0, maxBottom - rootTop)) + 8;
    return Math.ceil(Math.max(EMBED_MIN_H, bboxPlay));
  }

  function applyEmbedFrameHeight(h) {
    var menuOpen = isMenuOpen();
    var floor = menuOpen ? (isMobileEmbed() ? 640 : EMBED_MENU_MIN_H) : EMBED_MIN_H;
    h = Math.max(floor, Math.round(h || measureEmbedHeight()));
    var mobile = isMobileEmbed();
    syncMobileClass();
    syncEmbedUiMode();
    if (mobile || menuOpen) {
      // Menu uses document flow (po-ui-menu CSS) — don't lock a clipped viewport.
      resetEmbedMeasureStyles();
      [document.documentElement, document.body, ROOT].forEach(function (el) {
        el.style.height = "auto";
        el.style.minHeight = "0";
        el.style.maxHeight = "none";
        el.style.overflowX = "hidden";
        el.style.overflowY = mobile || menuOpen ? "visible" : "hidden";
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

  function flushEmbedResize(force) {
    if (!window.parent || embedMeasuring) return;
    embedMeasuring = true;
    try {
      syncEmbedUiMode();
      var menuOpen = isMenuOpen();
      var h = applyEmbedFrameHeight(measureEmbedHeight());
      // Anti-loop only while IN GAME. Menu must be allowed to grow after images/layout settle.
      if (!force && !menuOpen && lastReportH > 0) {
        if (Math.abs(h - lastReportH) < 8) {
          return;
        }
        if (h > lastReportH + 16) {
          h = lastReportH;
        }
      }
      if (!force && lastPostedH > 0 && Math.abs(h - lastPostedH) < 8) {
        lastReportH = h;
        return;
      }
      lastReportH = h;
      lastPostedH = h;
      window.parent.postMessage({
        type: "po-resize",
        height: h,
        mobile: isMobileEmbed(),
        menu: menuOpen
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
    flushEmbedResize(true);
    var gen = ++embedBurstGen;
    [40, 120, 280, 600].forEach(function (ms) {
      setTimeout(function () {
        if (gen !== embedBurstGen) return;
        flushEmbedResize(true);
      }, ms);
    });
  }

  function bindEmbedResizeObserver() {
    if (embedMutObs || !window.MutationObserver) return;
    var debounce = null;
    embedMutObs = new MutationObserver(function () {
      if (!isMenuOpen()) return;
      clearTimeout(debounce);
      debounce = setTimeout(function () {
        flushEmbedResize(true);
      }, 48);
    });
    embedMutObs.observe(ROOT, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "hidden"]
    });
  }

  function bindMenuImageLoads() {
    var title = document.getElementById("po-title");
    if (!title) return;
    title.querySelectorAll("img").forEach(function (img) {
      if (img.complete) return;
      img.addEventListener("load", function () {
        if (isMenuOpen()) scheduleEmbedResizeBurst();
      }, { once: true });
    });
  }

  function notifyResize() {
    // Window resize from parent setFrameHeight: don't force-grow while in menu
    // (force burst handles real menu opens). Soft notify only.
    flushEmbedResize(isMenuOpen());
  }

  syncMobileClass();
  syncEmbedUiMode();
  applyEmbedFrameHeight(measureEmbedHeight());
  bindEmbedResizeObserver();
  bindMenuImageLoads();
  document.addEventListener("wheel", blockEmbedScroll, { passive: false });
  document.addEventListener("touchmove", blockEmbedScroll, { passive: false });
  window.addEventListener("resize", notifyResize);
  window.addEventListener("orientationchange", function () {
    lastReportH = 0;
    lastPostedH = 0;
    setTimeout(function () {
      syncMobileClass();
      syncEmbedUiMode();
      scheduleEmbedResizeBurst();
    }, 160);
  });
  window.addEventListener("message", function (e) {
    if (!e.data || typeof e.data !== "object") return;
    if (e.data.type === "po-request-resize") {
      scheduleEmbedResizeBurst();
    }
  });

  // Watch title open/close for remount height.
  var titleEl = document.getElementById("po-title");
  if (titleEl && window.MutationObserver) {
    new MutationObserver(function () {
      lastReportH = 0;
      lastPostedH = 0;
      syncEmbedUiMode();
      scheduleEmbedResizeBurst();
    }).observe(titleEl, { attributes: true, attributeFilter: ["class"] });
  }

  scheduleEmbedResizeBurst();
})();
