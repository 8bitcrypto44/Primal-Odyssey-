/* Primal Odyssey — SNES tilemap explore (Mode-1 style) */
(function () {
  "use strict";
  if (!window.PO_SNES) window.PO_SNES = {};
  var S = window.PO_SNES;
  S.enabled = true;
  S.atlasImg = {};
  S.ready = false;
  S.camX = 0;
  S.camY = 0;

  function loadImg(url, cb) {
    var im = new Image();
    im.onload = function () { cb(im); };
    im.onerror = function () { cb(null); };
    im.src = url;
  }

  S.preload = function () {
    if (!S.atlas || !S.maps) return;
    var keys = Object.keys(S.atlas);
    var left = keys.length;
    if (!left) { S.ready = true; return; }
    keys.forEach(function (rid) {
      loadImg(S.atlas[rid], function (im) {
        if (im) S.atlasImg[rid] = im;
        left--;
        if (left <= 0) S.ready = true;
      });
    });
  };

  S.current = function () {
    var r = window.region;
    var id = (r && r.id) || "africa";
    return S.maps && S.maps[id] ? S.maps[id] : null;
  };

  S.tileAt = function (tx, ty) {
    var m = S.current();
    if (!m) return "grass";
    tx = tx | 0; ty = ty | 0;
    if (ty < 0 || tx < 0 || ty >= m.h || tx >= m.w) return "cliff";
    return m.ground[ty][tx];
  };

  S.solidWorld = function (wx, wy) {
    var m = S.current();
    if (!m) return false;
    var t = S.tileAt(wx, wy);
    var f = S.frames && S.frames[t];
    if (f && f.solid) return true;
    // object collision (trees/rocks near feet)
    var objs = m.objects || [];
    for (var i = 0; i < objs.length; i++) {
      var o = objs[i];
      var fr = S.frames[o.id];
      if (!fr || !fr.solid) continue;
      var ox = o.x / m.tile, oy = o.y / m.tile;
      if (Math.hypot(wx - ox, wy - oy) < 0.55) return true;
    }
    return false;
  };

  function drawTile(ctx, atlas, frame, dx, dy) {
    if (!atlas || !frame) return;
    ctx.drawImage(atlas, frame.x, frame.y, frame.w, frame.h, dx | 0, dy | 0, frame.w, frame.h);
  }

  S.draw = function (ctx, W, H, player, sprites, getAnimalCanvas, dayPhase) {
    var m = S.current();
    if (!m || !S.ready) {
      ctx.fillStyle = "#143018";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#5dce7a";
      ctx.font = "10px monospace";
      ctx.fillText("LOADING SNES WORLD...", 40, H / 2);
      return;
    }
    var rid = (window.region && window.region.id) || "africa";
    var atlas = S.atlasImg[rid] || S.atlasImg.africa;
    var T = m.tile || 16;
    // camera centers on player (tile space → pixels)
    var px = player.x * T;
    var py = player.y * T;
    S.camX = px - W / 2;
    S.camY = py - H / 2;
    S.camX = Math.max(0, Math.min(m.w * T - W, S.camX));
    S.camY = Math.max(0, Math.min(m.h * T - H, S.camY));

    var phase = dayPhase ? dayPhase() : { light: 1, tint: [1, 1, 1], name: "day" };
    ctx.imageSmoothingEnabled = false;

    // sky wash behind map (for cliff edges)
    ctx.fillStyle = rid === "mountains" ? "#6a9ad0" : (rid === "jungle" ? "#1a3a28" : (rid === "wetlands" ? "#3a6a78" : "#4a8ac8"));
    ctx.fillRect(0, 0, W, H);

    // BG1 ground
    var x0 = Math.max(0, (S.camX / T) | 0);
    var y0 = Math.max(0, (S.camY / T) | 0);
    var x1 = Math.min(m.w - 1, ((S.camX + W) / T) | 0);
    var y1 = Math.min(m.h - 1, ((S.camY + H) / T) | 0);
    for (var ty = y0; ty <= y1; ty++) {
      for (var tx = x0; tx <= x1; tx++) {
        var id = m.ground[ty][tx];
        var fr = S.frames[id] || S.frames.grass;
        var dx = tx * T - S.camX;
        var dy = ty * T - S.camY;
        drawTile(ctx, atlas, fr, dx, dy);
      }
    }

    // Animated water shimmer (simple palette flash)
    if ((performance.now() / 400 | 0) % 2 === 0) {
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = "#c0f0ff";
      for (ty = y0; ty <= y1; ty++) {
        for (tx = x0; tx <= x1; tx++) {
          if (m.ground[ty][tx].indexOf("water") === 0 && ((tx + ty) & 1)) {
            ctx.fillRect(tx * T - S.camX, ty * T - S.camY, T, T);
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    // Collect draw list: objects + animals + player, Y-sort (SNES sprite priority)
    var list = [];
    var objs = m.objects || [];
    for (var i = 0; i < objs.length; i++) {
      var o = objs[i];
      var ofr = S.frames[o.id];
      if (!ofr) continue;
      var sx = o.x - S.camX - ofr.w / 2;
      var sy = o.y - S.camY - ofr.h;
      if (sx > W || sy > H || sx + ofr.w < 0 || sy + ofr.h < 0) continue;
      list.push({ y: o.y, kind: "obj", o: o, fr: ofr, sx: sx, sy: sy });
    }
    if (sprites) {
      for (i = 0; i < sprites.length; i++) {
        var sp = sprites[i];
        if (sp.kind !== "animal") continue;
        var ax = sp.x * T - S.camX;
        var ay = sp.y * T - S.camY;
        if (ax < -40 || ay < -40 || ax > W + 40 || ay > H + 40) continue;
        list.push({ y: sp.y * T, kind: "animal", sp: sp, ax: ax, ay: ay });
      }
    }
    list.push({ y: py + 8, kind: "player" });
    list.sort(function (a, b) { return a.y - b.y; });

    for (i = 0; i < list.length; i++) {
      var it = list[i];
      if (it.kind === "obj") {
        drawTile(ctx, atlas, it.fr, it.sx, it.sy);
      } else if (it.kind === "animal" && getAnimalCanvas) {
        var img = getAnimalCanvas(it.sp.id, it.sp.frame | 0);
        if (!img) continue;
        var aw = 28, ah = 28 * (img.height / Math.max(1, img.width));
        ctx.drawImage(img, it.ax - aw / 2, it.ay - ah, aw, ah);
        if (it.sp.rare) {
          ctx.fillStyle = "#e8c86a";
          ctx.fillRect(it.ax - 2, it.ay - ah - 4, 4, 4);
        }
      } else if (it.kind === "player") {
        // Simple SNES-style explorer sprite
        var fx = px - S.camX;
        var fy = py - S.camY;
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath(); ctx.ellipse(fx, fy + 4, 6, 2.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#3a2a18";
        ctx.fillRect(fx - 3, fy - 10, 6, 8);
        ctx.fillStyle = "#c8a060";
        ctx.fillRect(fx - 3, fy - 16, 6, 6);
        ctx.fillStyle = "#2a6a40";
        ctx.fillRect(fx - 4, fy - 4, 8, 6);
        // facing indicator
        var ang = player.dir || 0;
        ctx.fillStyle = "#e8e0c0";
        ctx.fillRect(fx + Math.cos(ang) * 5 - 1, fy - 12 + Math.sin(ang) * 3, 2, 2);
      }
    }

    // Day/night tint
    if (phase.light < 0.95) {
      ctx.fillStyle = "rgba(10,20,40," + ((1 - phase.light) * 0.45) + ")";
      ctx.fillRect(0, 0, W, H);
    }
  };

  // Boot preload when data present
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { S.preload(); });
  } else {
    S.preload();
  }
})();
