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

  function isScrollTarget(node) {
    return node && node.closest && node.closest(".po-overlay, .po-dossier, .po-paper-dossier, .po-log, .po-touch, .po-stick, .po-look-btn");
  }

  function blockEmbedScroll(e) {
    if (isMobileEmbed()) return;
    if (isScrollTarget(e.target)) return;
    e.preventDefault();
  }

  function measureEmbedHeight() {
    var doc = document.documentElement;
    var bod = document.body;
    var shell = ROOT.querySelector(".po-shell");
    var title = document.getElementById("po-title");
    [doc, bod, ROOT, shell].forEach(function (el) {
      if (!el) return;
      el.style.height = "auto";
      el.style.minHeight = "0";
      el.style.maxHeight = "none";
    });
    var rootTop = ROOT.getBoundingClientRect().top;
    var maxBottom = ROOT.getBoundingClientRect().bottom;
    [shell, document.getElementById("po-canvas"), document.getElementById("po-bottom-bar"), document.getElementById("po-touch"), document.getElementById("po-hud-canvas")].forEach(function (el) {
      if (!el || el.hidden) return;
      var r = el.getBoundingClientRect();
      if (r.height > 0 && r.bottom > maxBottom) maxBottom = r.bottom;
    });
    document.querySelectorAll(".po-overlay.show").forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.bottom > maxBottom) maxBottom = r.bottom;
    });
    var bboxH = Math.ceil(Math.max(0, maxBottom - rootTop)) + 8;
    var tight = !(title && title.classList.contains("show"));
    if (tight) {
      return Math.ceil(Math.max(EMBED_MIN_H, bboxH));
    }
    return Math.ceil(Math.max(
      EMBED_MIN_H,
      bboxH,
      ROOT.scrollHeight || 0,
      doc.scrollHeight || 0
    ));
  }

  function applyEmbedFrameHeight(h) {
    h = Math.max(EMBED_MIN_H, Math.round(h || measureEmbedHeight()));
    var mobile = isMobileEmbed();
    syncMobileClass();
    [document.documentElement, document.body, ROOT].forEach(function (el) {
      if (mobile) {
        el.style.height = "auto";
        el.style.minHeight = "0";
        el.style.maxHeight = "none";
        el.style.overflowX = "hidden";
        el.style.overflowY = "visible";
        el.style.touchAction = "pan-y";
      } else {
        el.style.height = h + "px";
        el.style.minHeight = h + "px";
        el.style.maxHeight = h + "px";
        el.style.overflow = "hidden";
      }
    });
    return h;
  }

  function flushEmbedResize() {
    if (!window.parent) return;
    try {
      var h = applyEmbedFrameHeight(measureEmbedHeight());
      window.parent.postMessage({
        type: "po-resize",
        height: h,
        mobile: isMobileEmbed()
      }, "*");
      window.parent.postMessage({
        type: "po-mobile",
        active: isMobileEmbed()
      }, "*");
    } catch (e) {}
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
      debounce = setTimeout(flushEmbedResize, 0);
    });
    embedMutObs.observe(ROOT, { childList: true, subtree: true, attributes: true, characterData: true });
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
