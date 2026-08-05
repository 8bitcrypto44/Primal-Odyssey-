/* Primal Odyssey — SNES tilemap explore v43 */
(function () {
  "use strict";
  if (!window.PO_SNES) window.PO_SNES = {};
  var S = window.PO_SNES;
  S.enabled = true;
  S.atlasImg = {};
  S.playerImg = null;
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
    var left = keys.length + 1;
    function done() {
      left--;
      if (left <= 0) S.ready = true;
    }
    keys.forEach(function (rid) {
      loadImg(S.atlas[rid], function (im) {
        if (im) S.atlasImg[rid] = im;
        done();
      });
    });
    loadImg(S.playerSheet || "assets/snes/built/player.png", function (im) {
      S.playerImg = im;
      done();
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

  function isWaterTile(t) {
    if (!t) return false;
    return t.indexOf("water") === 0 || t.charAt(0) === "w" || t.indexOf("sw") === 0;
  }

  S.wetWorld = function (wx, wy) {
    return isWaterTile(S.tileAt(wx, wy));
  };

  S.solidWorld = function (wx, wy) {
    var m = S.current();
    if (!m) return false;
    var t = S.tileAt(wx, wy);
    var f = S.frames && S.frames[t];
    if (f && f.solid) return true;
    var objs = m.objects || [];
    for (var i = 0; i < objs.length; i++) {
      var o = objs[i];
      var fr = S.frames[o.id];
      if (!fr || !fr.solid) continue;
      // walk-behind: collide only near feet / trunk base
      var ox = o.x / m.tile;
      var oy = o.y / m.tile;
      var rad = Math.max(0.35, (fr.feet || 8) / m.tile * 0.55);
      if (Math.hypot(wx - ox, wy - oy) < rad) return true;
    }
    return false;
  };

  function drawTile(ctx, atlas, frame, dx, dy) {
    if (!atlas || !frame) return;
    ctx.drawImage(atlas, frame.x, frame.y, frame.w, frame.h, dx | 0, dy | 0, frame.w, frame.h);
  }

  function facingDir(player) {
    var a = player.dir || 0;
    // 0=E in canvas math for cos/sin; map to sprite dirs
    var deg = ((a * 180 / Math.PI) % 360 + 360) % 360;
    if (deg >= 315 || deg < 45) return "right";
    if (deg < 135) return "down";
    if (deg < 225) return "left";
    return "up";
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
    var px = player.x * T;
    var py = player.y * T;
    S.camX = px - W / 2;
    S.camY = py - H / 2;
    S.camX = Math.max(0, Math.min(m.w * T - W, S.camX));
    S.camY = Math.max(0, Math.min(m.h * T - H, S.camY));

    var phase = dayPhase ? dayPhase() : { light: 1, tint: [1, 1, 1], name: "day" };
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = rid === "mountains" ? "#6a9ad0" : (rid === "jungle" ? "#1a3a28" : (rid === "wetlands" ? "#3a6a78" : "#4a8ac8"));
    ctx.fillRect(0, 0, W, H);

    var anim = S.waterAnim || m.waterAnim || ["water", "water2", "water3", "water_a"];
    var animI = (performance.now() / 280 | 0) % anim.length;

    var x0 = Math.max(0, (S.camX / T) | 0);
    var y0 = Math.max(0, (S.camY / T) | 0);
    var x1 = Math.min(m.w - 1, ((S.camX + W) / T) | 0);
    var y1 = Math.min(m.h - 1, ((S.camY + H) / T) | 0);

    // BG1 ground (+ animated open water)
    for (var ty = y0; ty <= y1; ty++) {
      for (var tx = x0; tx <= x1; tx++) {
        var id = m.ground[ty][tx];
        if (id === "water" || id === "water2" || id === "water3" || id === "water_a" || id === "water_b" || id === "water_c") {
          id = anim[animI];
        }
        var fr = S.frames[id] || S.frames.grass;
        drawTile(ctx, atlas, fr, tx * T - S.camX, ty * T - S.camY);
      }
    }

    // BG2 detail layer (flowers/tufts) — under tall sprites
    var dets = m.details || [];
    for (var di = 0; di < dets.length; di++) {
      var d = dets[di];
      var dfr = S.frames[d.id];
      if (!dfr) continue;
      var ddx = d.x - S.camX - dfr.w / 2;
      var ddy = d.y - S.camY - dfr.h;
      if (ddx > W || ddy > H || ddx + dfr.w < 0 || ddy + dfr.h < 0) continue;
      drawTile(ctx, atlas, dfr, ddx, ddy);
    }

    // Y-sorted sprites
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
        if (ax < -48 || ay < -48 || ax > W + 48 || ay > H + 48) continue;
        list.push({ y: sp.y * T, kind: "animal", sp: sp, ax: ax, ay: ay });
      }
    }
    list.push({ y: py + 6, kind: "player" });
    list.sort(function (a, b) { return a.y - b.y; });

    var moving = !!(player._snesMoving);
    var walkFrame = moving ? ((performance.now() / 140 | 0) % 3) : 1;
    var face = facingDir(player);

    for (i = 0; i < list.length; i++) {
      var it = list[i];
      if (it.kind === "obj") {
        // soft contact shadow at feet
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.beginPath();
        ctx.ellipse(it.sx + it.fr.w / 2, it.sy + it.fr.h - 1, Math.max(4, it.fr.w * 0.22), 2.4, 0, 0, Math.PI * 2);
        ctx.fill();
        drawTile(ctx, atlas, it.fr, it.sx, it.sy);
      } else if (it.kind === "animal" && getAnimalCanvas) {
        var img = getAnimalCanvas(it.sp.id, it.sp.frame | 0);
        if (!img) continue;
        var aw = 30, ah = 30 * (img.height / Math.max(1, img.width));
        // soft shadow
        ctx.fillStyle = "rgba(0,0,0,0.28)";
        ctx.beginPath();
        ctx.ellipse(it.ax, it.ay + 2, aw * 0.28, 3.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.drawImage(img, it.ax - aw / 2, it.ay - ah, aw, ah);
        if (it.sp.rare) {
          ctx.fillStyle = "#e8c86a";
          ctx.fillRect(it.ax - 2, it.ay - ah - 4, 4, 4);
        }
      } else if (it.kind === "player") {
        var fx = px - S.camX;
        var fy = py - S.camY;
        ctx.fillStyle = "rgba(0,0,0,0.32)";
        ctx.beginPath();
        ctx.ellipse(fx, fy + 3, 5.5, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
        var key = "player_" + face + "_" + walkFrame;
        var pfr = S.frames[key];
        if (S.playerImg && pfr) {
          ctx.drawImage(S.playerImg, pfr.x, pfr.y, pfr.w, pfr.h, (fx - 8) | 0, (fy - 20) | 0, 16, 24);
        } else {
          ctx.fillStyle = "#2a6a40";
          ctx.fillRect(fx - 4, fy - 14, 8, 12);
          ctx.fillStyle = "#c8a060";
          ctx.fillRect(fx - 3, fy - 20, 6, 6);
        }
      }
    }

    // 16-bit style screen border
    ctx.strokeStyle = "rgba(20,40,28,0.85)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);
    ctx.strokeStyle = "rgba(93,206,122,0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(3, 3, W - 6, H - 6);

    if (phase.light < 0.95) {
      ctx.fillStyle = "rgba(10,20,40," + ((1 - phase.light) * 0.45) + ")";
      ctx.fillRect(0, 0, W, H);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { S.preload(); });
  } else {
    S.preload();
  }
})();
