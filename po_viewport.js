(function () {
  "use strict";
  var isEmbed =
    window !== window.top || /(?:\?|&)embed=1(?:&|$)/.test(location.search || "");
  if (!isEmbed) return;
  var ROOT = document.getElementById("po-root");
  if (!ROOT) return;

  // Digistracts-style floors: content drives height; avoid forced tall blank.
  var EMBED_MIN_H = 680;
  var EMBED_MENU_MIN_H = 900;
  var EMBED_PLAY_MIN_H = 360;
  var EMBED_PLAY_PAD = 24;
  var embedFsActive = false;
  var embedBurstGen = 0;
  var embedMutObs = null;
  var embedPlayH = 0;
  var embedLastReportH = 0;
  var embedPlayLockGen = 0;
  var embedPlaySettling = false;
  var embedGrowT = null;
  var embedMeasuring = false;

  function isMobileDevice() {
    try {
      // Short edge <= 700 covers portrait phones and landscape phones (e.g. 844x390).
      var w = window.innerWidth || 0;
      var h = window.innerHeight || 0;
      var shortEdge = Math.min(w, h);
      if (shortEdge > 0 && shortEdge <= 700) return true;
    } catch (e0) {}
    try {
      // Wide hybrid laptops with a mouse stay desktop.
      if (window.matchMedia("(pointer: fine)").matches) {
        return false;
      }
    } catch (e) {}
    var touch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
    var coarse = false;
    try {
      coarse = window.matchMedia("(pointer: coarse)").matches;
    } catch (e2) {}
    return touch && coarse;
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

  function isEmbedPlayShell() {
    return isMobileEmbed() && !isMenuOpen() && !embedFsActive;
  }

  function clearEmbedPlayLock() {
    embedPlayH = 0;
    embedLastReportH = 0;
    embedPlayLockGen++;
    clearTimeout(embedGrowT);
    embedGrowT = null;
  }

  function syncEmbedUiMode() {
    var menuOpen = isMenuOpen();
    if (menuOpen) clearEmbedPlayLock();
    ROOT.classList.toggle("po-ui-menu", menuOpen);
    ROOT.classList.toggle("po-ui-play", !menuOpen);
    document.documentElement.classList.toggle("po-ui-menu", menuOpen);
    document.documentElement.classList.toggle("po-ui-play", !menuOpen);
    if (isEmbedPlayShell() && embedPlayH > 0 && !embedPlaySettling) return;
    notifyResize();
    if (isMobileEmbed() && !isEmbedPlayShell()) scheduleEmbedResizeBurst();
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

  function embedPlayTargetH() {
    if (!isMobileEmbed() || isMenuOpen()) return EMBED_PLAY_MIN_H;
    var rw = Math.max(280, ROOT.clientWidth || window.innerWidth || 360);
    var stageH = Math.ceil(rw * 9 / 16);
    var vh = window.innerHeight || document.documentElement.clientHeight || 680;
    // Portrait: grow playfield so canvas fills ~58%+ of the phone (QA fillH), not a 16:9 postage strip.
    var portraitFill = Math.ceil(vh * 0.58);
    if (vh >= rw) stageH = Math.max(stageH, portraitFill);
    var safe = 12;
    try {
      safe += Math.ceil(parseInt(getComputedStyle(document.documentElement).getPropertyValue("padding-bottom"), 10) || 0);
    } catch (e) {}
    // Extra room for stacked touch pads + chip bar under the stage
    return Math.max(EMBED_PLAY_MIN_H, stageH + 160 + safe + EMBED_PLAY_PAD);
  }

  function measureEmbedPlayOpen() {
    if (!isMobileEmbed() || isMenuOpen()) return embedPlayTargetH();
    var shell = ROOT.querySelector(".po-shell");
    var bar = document.getElementById("po-bottom-bar");
    var touch = document.getElementById("po-touch");
    var rootTop = ROOT.getBoundingClientRect().top;
    var maxBottom = rootTop;
    [shell, bar, touch].forEach(function (el) {
      if (!el || el.hidden) return;
      var r = el.getBoundingClientRect();
      if (r.height > 0 && r.bottom > maxBottom) maxBottom = r.bottom;
    });
    var bboxH = Math.ceil(Math.max(0, maxBottom - rootTop)) + 8;
    var h = Math.ceil(Math.max(embedPlayTargetH(), bboxH)) + EMBED_PLAY_PAD;
    var vh = window.innerHeight || document.documentElement.clientHeight || 680;
    return Math.min(h, Math.ceil(vh * 1.25));
  }

  function lockEmbedPlayHeight(h) {
    h = Math.max(embedPlayTargetH(), Math.round(h || 0));
    embedPlayH = h;
    embedLastReportH = h;
  }

  function maybeGrowEmbedPlayLock() {
    if (!isEmbedPlayShell() || embedPlayH <= 0 || embedPlaySettling) return;
    var measured = measureEmbedPlayOpen();
    if (measured <= embedPlayH + 8) return;
    lockEmbedPlayHeight(measured);
  }

  function scheduleEmbedPlayGrowCheck() {
    clearTimeout(embedGrowT);
    embedGrowT = setTimeout(function () {
      embedGrowT = null;
      var before = embedPlayH;
      maybeGrowEmbedPlayLock();
      if (embedPlayH > before + 4) flushEmbedResize(true);
    }, 120);
  }

  function scheduleEmbedPlaySettle() {
    if (!isEmbedPlayShell()) return;
    embedPlayLockGen++;
    var gen = embedPlayLockGen;
    embedPlayH = 0;
    embedLastReportH = 0;
    embedPlaySettling = true;
    function finishSettle() {
      if (gen !== embedPlayLockGen || !isEmbedPlayShell()) {
        embedPlaySettling = false;
        return;
      }
      lockEmbedPlayHeight(measureEmbedPlayOpen());
      embedPlaySettling = false;
      flushEmbedResize(true);
      scheduleEmbedPlayGrowCheck();
      setTimeout(function () {
        if (gen !== embedPlayLockGen || !isEmbedPlayShell()) return;
        maybeGrowEmbedPlayLock();
        flushEmbedResize(true);
      }, 400);
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        setTimeout(finishSettle, 260);
      });
    });
  }

  function measureMenuContentHeight(rootTop) {
    // Prefer intrinsic .po-menu size: desktop absolute #po-title fill can clip rects.
    var title = document.getElementById("po-title");
    var menu = title && title.querySelector(".po-menu");
    if (menu) {
      var mh = Math.max(
        menu.scrollHeight || 0,
        menu.offsetHeight || 0,
        Math.ceil(menu.getBoundingClientRect().height || 0)
      );
      Array.prototype.forEach.call(menu.querySelectorAll(".po-card, .po-brand, .po-regions, .po-a11y, .po-wip, .po-lead, h2, .po-tag, .po-continue"), function (el) {
        mh = Math.max(mh, (el.offsetTop || 0) + (el.offsetHeight || 0));
      });
      return Math.ceil(mh) + 36;
    }
    if (title) {
      return Math.ceil(Math.max(title.scrollHeight || 0, title.offsetHeight || 0)) + 16;
    }
    return EMBED_MENU_MIN_H;
  }

  function embedFloorH() {
    if (!isMobileEmbed()) {
      return isMenuOpen() ? EMBED_MENU_MIN_H : EMBED_MIN_H;
    }
    if (isMenuOpen()) return EMBED_MENU_MIN_H;
    if (isEmbedPlayShell() && embedPlayH > 0) return embedPlayH;
    return embedPlayTargetH();
  }

  function measureEmbedHeight() {
    // Desktop: do not force height:auto before measure — absolute menu overlay
    // needs a real iframe-sized containing block.
    if (isMobileEmbed()) resetEmbedMeasureStyles();
    var rootTop = ROOT.getBoundingClientRect().top;
    var menuOpen = isMenuOpen();
    var mobile = isMobileEmbed();

    if (isEmbedPlayShell() && embedPlayH > 0) return embedPlayH;

    if (menuOpen) {
      var bboxH = measureMenuContentHeight(rootTop);
      // Desktop absolute overlay: still ask parent for content height so cards fit.
      return Math.ceil(Math.max(mobile ? EMBED_MENU_MIN_H : EMBED_MENU_MIN_H, bboxH));
    }

    if (mobile) {
      return measureEmbedPlayOpen();
    }

    var maxBottom = rootTop;
    var shell = ROOT.querySelector(".po-shell");
    var w = Math.max(1, ROOT.clientWidth || (shell && shell.clientWidth) || window.innerWidth || 320);
    var gameH = Math.round(w * 9 / 16);
    if (shell) {
      var sr = shell.getBoundingClientRect();
      maxBottom = Math.max(maxBottom, sr.top + gameH);
    }
    maxBottom = considerBottom(maxBottom, shell);
    maxBottom = considerBottom(maxBottom, document.getElementById("po-bottom-bar"));
    maxBottom = considerBottom(maxBottom, document.getElementById("po-touch"));
    document.querySelectorAll(".po-overlay.show").forEach(function (el) {
      if (el.id === "po-title") return;
      var inner = el.querySelector(".po-menu, .panel, .po-dossier, .po-paper-dossier, .po-log-inner");
      maxBottom = considerBottom(maxBottom, inner || el);
    });
    var bboxPlay = Math.ceil(Math.max(0, maxBottom - rootTop)) + 8;
    return Math.ceil(Math.max(EMBED_MIN_H, bboxPlay));
  }

  function applyEmbedFrameHeight(h) {
    h = Math.max(embedFloorH(), Math.round(h || measureEmbedHeight()));
    var mobile = isMobileEmbed();
    var menuOpen = isMenuOpen();
    var landOrFs =
      document.documentElement.classList.contains("po-land") ||
      document.documentElement.classList.contains("po-fs");
    syncMobileClass();
    if (mobile && isEmbedPlayShell() && embedPlayH > 0) return h;
    // Digistracts desktop: keep html/body/root sized to the iframe (never height:auto
    // with absolute overlays — that collapses .po-shell to 0 and blanks the menu).
    // Landscape / FS immersive: lock to iframe viewport (do not force height:auto).
    if (mobile && landOrFs) {
      [document.documentElement, document.body, ROOT].forEach(function (el) {
        el.style.height = "100%";
        el.style.minHeight = "100%";
        el.style.maxHeight = "100%";
        el.style.overflow = "hidden";
      });
      return h;
    }
    if (mobile) {
      resetEmbedMeasureStyles();
      [document.documentElement, document.body, ROOT].forEach(function (el) {
        el.style.height = "auto";
        el.style.minHeight = "0";
        el.style.maxHeight = "none";
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

  function flushEmbedResize(force) {
    if (!window.parent || embedMeasuring) return;
    if (isEmbedPlayShell() && embedPlayH > 0 && !embedPlaySettling && !force) return;
    if (isEmbedPlayShell() && embedPlayH > 0 && !embedPlaySettling && force) {
      maybeGrowEmbedPlayLock();
    }
    embedMeasuring = true;
    try {
      var menuOpen = isMenuOpen();
      ROOT.classList.toggle("po-ui-menu", menuOpen);
      ROOT.classList.toggle("po-ui-play", !menuOpen);
      document.documentElement.classList.toggle("po-ui-menu", menuOpen);
      document.documentElement.classList.toggle("po-ui-play", !menuOpen);
      var h = applyEmbedFrameHeight(measureEmbedHeight());
      // Digistracts anti-loop: only while play-locked; menu must grow as layout settles.
      if (!force && isEmbedPlayShell() && embedLastReportH > 0) {
        if (Math.abs(h - embedLastReportH) < 8) return;
        if (h > embedLastReportH + 16) return;
      }
      if (force && isEmbedPlayShell() && embedPlayH > 0 && embedLastReportH > 0 && Math.abs(h - embedLastReportH) < 8) {
        return;
      }
      embedLastReportH = h;
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
    if (isEmbedPlayShell()) return;
    flushEmbedResize(true);
    var gen = ++embedBurstGen;
    [32, 96, 280, 600].forEach(function (ms) {
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
    flushEmbedResize(true);
    if (!isEmbedPlayShell() || embedPlayH <= 0) {
      requestAnimationFrame(function () {
        flushEmbedResize(true);
      });
    }
  }

  function onFsStateMsg(active) {
    var wasFs = embedFsActive;
    embedFsActive = !!active;
    if (wasFs && !embedFsActive) clearEmbedPlayLock();
    if (wasFs !== embedFsActive) syncEmbedUiMode();
  }

  syncMobileClass();
  syncEmbedUiMode();
  applyEmbedFrameHeight(measureEmbedHeight());
  bindEmbedResizeObserver();
  bindMenuImageLoads();
  document.addEventListener("wheel", blockEmbedScroll, { passive: false });
  document.addEventListener("touchmove", blockEmbedScroll, { passive: false });
  window.addEventListener("resize", function () {
    if (isEmbedPlayShell() && embedPlayH > 0) {
      scheduleEmbedPlayGrowCheck();
      return;
    }
    syncEmbedUiMode();
  });
  window.addEventListener("orientationchange", function () {
    clearEmbedPlayLock();
    setTimeout(function () {
      syncMobileClass();
      syncEmbedUiMode();
    }, 160);
  });
  window.addEventListener("message", function (e) {
    if (!e.data || typeof e.data !== "object") return;
    if (e.data.type === "po-fs-state") onFsStateMsg(e.data.active);
    if (e.data.type === "po-request-resize") {
      if (isEmbedPlayShell() && embedPlayH > 0 && !embedPlaySettling) {
        maybeGrowEmbedPlayLock();
        flushEmbedResize(true);
        return;
      }
      flushEmbedResize(true);
      if (!isEmbedPlayShell()) scheduleEmbedResizeBurst();
    }
  });

  var titleEl = document.getElementById("po-title");
  if (titleEl && window.MutationObserver) {
    new MutationObserver(function () {
      var menuOpen = isMenuOpen();
      syncMobileClass();
      ROOT.classList.toggle("po-ui-menu", menuOpen);
      ROOT.classList.toggle("po-ui-play", !menuOpen);
      document.documentElement.classList.toggle("po-ui-menu", menuOpen);
      document.documentElement.classList.toggle("po-ui-play", !menuOpen);
      if (menuOpen) {
        clearEmbedPlayLock();
        scheduleEmbedResizeBurst();
        return;
      }
      if (isMobileEmbed()) {
        scheduleEmbedPlaySettle();
        return;
      }
      clearEmbedPlayLock();
      scheduleEmbedResizeBurst();
    }).observe(titleEl, { attributes: true, attributeFilter: ["class"] });
  }

  scheduleEmbedResizeBurst();
})();
