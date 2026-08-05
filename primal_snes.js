/* Primal Odyssey — SNES tilemap explore v50 */
(function () {
  "use strict";
  if (!window.PO_SNES) window.PO_SNES = {};
  var S = window.PO_SNES;
  S.enabled = true;
  S.atlasImg = {};
  S.playerImg = null;
  S.animalImg = null;
  S.parallaxImg = {};
  S.ready = false;
  S.camX = 0;
  S.camY = 0;
  S.footprints = [];

  function loadImg(url, cb) {
    var im = new Image();
    im.onload = function () { cb(im); };
    im.onerror = function () { cb(null); };
    im.src = url;
  }

  S.preload = function () {
    if (!S.atlas || !S.maps) return;
    var keys = Object.keys(S.atlas);
    var pkeys = S.parallax ? Object.keys(S.parallax) : [];
    var left = keys.length + pkeys.length + 2;
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
    pkeys.forEach(function (rid) {
      loadImg(S.parallax[rid], function (im) {
        if (im) S.parallaxImg[rid] = im;
        done();
      });
    });
    loadImg(S.playerSheet || "assets/snes/built/player.png", function (im) {
      S.playerImg = im;
      done();
    });
    loadImg(S.animalSheet || "assets/snes/built/animals_td.png", function (im) {
      S.animalImg = im;
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
      var ox = o.x / m.tile;
      var oy = o.y / m.tile;
      var rad = Math.max(0.28, Math.min(0.85, (fr.feet || 8) / m.tile * 0.42));
      if (Math.hypot(wx - ox, wy - oy) < rad) return true;
    }
    return false;
  };

  function drawTile(ctx, atlas, frame, dx, dy, sh) {
    if (!atlas || !frame) return;
    var h = sh != null ? sh : frame.h;
    var sy = frame.y + (frame.h - h);
    ctx.drawImage(atlas, frame.x, sy, frame.w, h, dx | 0, (dy + (frame.h - h)) | 0, frame.w, h);
  }

  function drawTileTop(ctx, atlas, frame, dx, dy, th) {
    if (!atlas || !frame || !th) return;
    ctx.drawImage(atlas, frame.x, frame.y, frame.w, th, dx | 0, dy | 0, frame.w, th);
  }

  function facingDir(player) {
    var a = player.dir || 0;
    var deg = ((a * 180 / Math.PI) % 360 + 360) % 360;
    if (deg >= 315 || deg < 45) return "right";
    if (deg < 135) return "down";
    if (deg < 225) return "left";
    return "up";
  }

  function animalFacing(sp) {
    var vx = sp.vx || 0, vy = sp.vy || 0;
    if (Math.hypot(vx, vy) < 0.03) {
      return sp._faceDir || "down";
    }
    var a = Math.atan2(vy, vx);
    var deg = ((a * 180 / Math.PI) % 360 + 360) % 360;
    var dir = "right";
    if (deg >= 315 || deg < 45) dir = "right";
    else if (deg < 135) dir = "down";
    else if (deg < 225) dir = "left";
    else dir = "up";
    sp._faceDir = dir;
    return dir;
  }

  function todMultiply(ctx, W, H, phase) {
    var name = (phase && phase.name) || "day";
    if (name === "day" && (!phase || phase.light > 0.92)) return;
    ctx.save();
    if (name === "dusk") {
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = "rgb(255,190,140)";
      ctx.globalAlpha = 0.55;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "rgba(40,20,60,1)";
      ctx.fillRect(0, 0, W, H);
    } else if (name === "night") {
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = "rgb(90,110,180)";
      ctx.globalAlpha = 0.7;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = "rgba(8,12,40,1)";
      ctx.fillRect(0, 0, W, H);
    } else if (phase && phase.light < 0.95) {
      ctx.fillStyle = "rgba(10,20,40," + ((1 - phase.light) * 0.4) + ")";
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  function drawLocalLights(ctx, W, H, m, T, player, phase) {
    if (!phase || (phase.name !== "dusk" && phase.name !== "night" && phase.name !== "dawn")) return;
    var objs = m.objects || [];
    for (var i = 0; i < objs.length; i++) {
      var o = objs[i];
      if (o.id !== "trail_flag" && o.id !== "sign" && o.id !== "camp_fire" && o.id.indexOf("camp") < 0) continue;
      var lx = o.x - S.camX;
      var ly = o.y - S.camY - 6;
      if (lx < -40 || ly < -40 || lx > W + 40 || ly > H + 40) continue;
      var rad = o.id === "camp_fire" ? 48 : 38;
      var g = ctx.createRadialGradient(lx, ly, 2, lx, ly, rad);
      g.addColorStop(0, o.id === "camp_fire" ? "rgba(255,180,60,0.45)" : "rgba(255,200,90,0.35)");
      g.addColorStop(0.45, "rgba(255,140,40,0.12)");
      g.addColorStop(1, "rgba(255,100,20,0)");
      ctx.fillStyle = g;
      ctx.fillRect(lx - rad, ly - rad, rad * 2, rad * 2);
    }
    // soft lantern around explorer at night
    if (phase.name === "night") {
      var fx = player.x * T - S.camX;
      var fy = player.y * T - S.camY;
      var lg = ctx.createRadialGradient(fx, fy - 8, 4, fx, fy - 8, 52);
      lg.addColorStop(0, "rgba(255,220,140,0.22)");
      lg.addColorStop(1, "rgba(255,180,80,0)");
      ctx.fillStyle = lg;
      ctx.fillRect(fx - 54, fy - 62, 108, 108);
    }
  }

  S.pushFootprint = function (x, y) {
    S.footprints.push({ x: x, y: y, t: performance.now() });
    if (S.footprints.length > 28) S.footprints.shift();
  };

  S.draw = function (ctx, W, H, player, sprites, getAnimalCanvas, dayPhase) {
    var m = S.current();
    if (!m || !S.ready) {
      ctx.fillStyle = "#143018";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#5dce7a";
      ctx.fillRect(40, H / 2 - 2, 48, 4);
      ctx.fillRect(96, H / 2 - 2, 16, 4);
      ctx.fillRect(120, H / 2 - 2, 8, 4);
      return;
    }
    var rid = (window.region && window.region.id) || "africa";
    var atlas = S.atlasImg[rid] || S.atlasImg.africa;
    var T = m.tile || 16;
    var px = player.x * T;
    var py = player.y * T;
    // Soft camera follow — kills 1px jitter from discrete player steps
    var targetCamX = px - W / 2;
    var targetCamY = py - H / 2;
    targetCamX = Math.max(0, Math.min(m.w * T - W, targetCamX));
    targetCamY = Math.max(0, Math.min(m.h * T - H, targetCamY));
    if (S.camX == null || isNaN(S.camX)) S.camX = targetCamX;
    if (S.camY == null || isNaN(S.camY)) S.camY = targetCamY;
    var camLerp = 0.42; // tighter follow — soft enough to hide jitter, not "drag"
    S.camX += (targetCamX - S.camX) * camLerp;
    S.camY += (targetCamY - S.camY) * camLerp;

    var phase = dayPhase ? dayPhase() : { light: 1, tint: [1, 1, 1], name: "day" };
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = rid === "mountains" ? "#6a9ad0" : (rid === "jungle" ? "#1a3a28" : (rid === "wetlands" ? "#3a6a78" : "#4a8ac8"));
    ctx.fillRect(0, 0, W, H);

    // Parallax distant band
    var para = S.parallaxImg[rid];
    if (para) {
      var ph = Math.min(56, para.height);
      var scroll = ((S.camX * 0.28) % para.width + para.width) % para.width;
      ctx.globalAlpha = 0.92;
      ctx.drawImage(para, scroll, 0, para.width - scroll, ph, 0, 0, W * ((para.width - scroll) / para.width), ph);
      if (scroll > 0) {
        ctx.drawImage(para, 0, 0, scroll, ph, W * ((para.width - scroll) / para.width), 0, W * (scroll / para.width), ph);
      }
      ctx.globalAlpha = 1;
    }

    var anim = S.waterAnim || m.waterAnim || ["water", "water2", "water3", "water_a"];
    // Slower base tick + per-tile phase so lakes ripple instead of whole-map flicker
    var animBase = (performance.now() / 420 | 0);
    var now = performance.now();

    var x0 = Math.max(0, (S.camX / T) | 0);
    var y0 = Math.max(0, (S.camY / T) | 0);
    var x1 = Math.min(m.w - 1, ((S.camX + W) / T) | 0);
    var y1 = Math.min(m.h - 1, ((S.camY + H) / T) | 0);

    for (var ty = y0; ty <= y1; ty++) {
      for (var tx = x0; tx <= x1; tx++) {
        var id = m.ground[ty][tx];
        if (id === "water" || id === "water2" || id === "water3" || id === "water_a" || id === "water_b" || id === "water_c") {
          id = anim[(animBase + tx * 3 + ty * 5) % anim.length];
        }
        var fr = S.frames[id] || S.frames.grass;
        drawTile(ctx, atlas, fr, tx * T - S.camX, ty * T - S.camY);
      }
    }

    // footprints
    for (var fi = 0; fi < S.footprints.length; fi++) {
      var fp = S.footprints[fi];
      var age = (now - fp.t) / 1800;
      if (age > 1) continue;
      ctx.fillStyle = "rgba(40,30,15," + ((1 - age) * 0.28) + ")";
      ctx.fillRect((fp.x * T - S.camX - 1) | 0, (fp.y * T - S.camY) | 0, 2, 2);
      ctx.fillRect((fp.x * T - S.camX + 2) | 0, (fp.y * T - S.camY + 1) | 0, 2, 2);
    }
    S.footprints = S.footprints.filter(function (f) { return now - f.t < 1800; });

    // detail layer with sway
    var dets = m.details || [];
    for (var di = 0; di < dets.length; di++) {
      var d = dets[di];
      var dfr = S.frames[d.id];
      if (!dfr) continue;
      var sway = Math.sin(now / 450 + d.x * 0.05) * (dfr.anim ? 1.2 : 0);
      var ddx = d.x - S.camX - dfr.w / 2 + sway;
      var ddy = d.y - S.camY - dfr.h;
      if (ddx > W || ddy > H || ddx + dfr.w < 0 || ddy + dfr.h < 0) continue;
      drawTile(ctx, atlas, dfr, ddx, ddy);
    }

    var list = [];
    var canopyQ = [];
    var objs = m.objects || [];
    for (var i = 0; i < objs.length; i++) {
      var o = objs[i];
      var ofr = S.frames[o.id];
      if (!ofr) continue;
      var sx = o.x - S.camX - ofr.w / 2;
      var sy = o.y - S.camY - ofr.h;
      if (sx > W || sy > H || sx + ofr.w < 0 || sy + ofr.h < 0) continue;
      var swayO = ofr.anim ? Math.sin(now / 500 + o.x * 0.04) * 1.1 : 0;
      list.push({ y: o.y, kind: "obj", o: o, fr: ofr, sx: sx + swayO, sy: sy });
      if (ofr.canopy && ofr.canopyH > 0) {
        canopyQ.push({ o: o, fr: ofr, sx: sx + swayO, sy: sy });
      }
    }
    if (sprites) {
      for (i = 0; i < sprites.length; i++) {
        var sp = sprites[i];
        if (sp.kind === "animal") {
          var ax = sp.x * T - S.camX;
          var ay = sp.y * T - S.camY;
          if (ax < -48 || ay < -48 || ax > W + 48 || ay > H + 48) continue;
          list.push({ y: sp.y * T, kind: "animal", sp: sp, ax: ax, ay: ay });
        } else if (sp.kind === "note" && !sp.taken) {
          var nx = sp.x * T - S.camX;
          var ny = sp.y * T - S.camY;
          if (nx < -24 || ny < -24 || nx > W + 24 || ny > H + 24) continue;
          list.push({ y: sp.y * T, kind: "note", sp: sp, ax: nx, ay: ny });
        }
      }
    }
    list.push({ y: py + 6, kind: "player" });
    list.sort(function (a, b) { return a.y - b.y; });

    var moving = !!(player._snesMoving);
    // Walk cycle paced by smoothed speed (less strobe than fixed 100ms)
    var pSpd = Math.hypot(player.vx || 0, player.vy || 0);
    var walkFrame = moving ? ((now / Math.max(90, 160 - pSpd * 28) | 0) % 3) : 0;
    var face = facingDir(player);
    if (moving && (!S._lastFp || now - S._lastFp > 160)) {
      S.pushFootprint(player.x, player.y);
      S._lastFp = now;
    }

    for (i = 0; i < list.length; i++) {
      var it = list[i];
      if (it.kind === "obj") {
        ctx.fillStyle = "rgba(0,0,0,0.26)";
        ctx.beginPath();
        ctx.ellipse(it.sx + it.fr.w / 2, it.sy + it.fr.h - 1, Math.max(4, it.fr.w * 0.24), 2.6, 0, 0, Math.PI * 2);
        ctx.fill();
        if (it.fr.canopy && it.fr.canopyH > 0) {
          var trunkH = it.fr.h - it.fr.canopyH;
          drawTile(ctx, atlas, it.fr, it.sx, it.sy, trunkH);
        } else {
          drawTile(ctx, atlas, it.fr, it.sx, it.sy);
        }
      } else if (it.kind === "note") {
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.beginPath();
        ctx.ellipse(it.ax, it.ay + 1, 5, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        var nfr = S.frames.field_note;
        if (atlas && nfr) {
          var bob = Math.sin(now / 320 + it.sp.x) * 1.2;
          drawTile(ctx, atlas, nfr, it.ax - nfr.w / 2, it.ay - nfr.h + bob);
        } else {
          ctx.fillStyle = "#e8d6aa";
          ctx.fillRect(it.ax - 5, it.ay - 12, 10, 12);
          ctx.strokeStyle = "#5a3a18";
          ctx.strokeRect(it.ax - 5.5, it.ay - 12.5, 11, 13);
        }
        // soft ping
        ctx.strokeStyle = "rgba(93,206,122," + (0.35 + Math.sin(now / 280) * 0.25) + ")";
        ctx.beginPath();
        ctx.arc(it.ax, it.ay - 6, 8 + (now / 200 % 4), 0, Math.PI * 2);
        ctx.stroke();
      } else if (it.kind === "animal") {
        ctx.fillStyle = "rgba(0,0,0,0.32)";
        ctx.beginPath();
        ctx.ellipse(it.ax, it.ay + 2, 10, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        var dir = animalFacing(it.sp);
        // Prefer real travel over velocity — velocity stays high when jammed in solids
        var movingA = (it.sp._moved != null ? it.sp._moved > 0.002 : Math.hypot(it.sp.vx || 0, it.sp.vy || 0) > 0.04);
        var aFrame = movingA ? ((now / 120 | 0) % 3) : 1;
        var td = S.frames["td_" + it.sp.id + "_" + dir + "_" + aFrame]
          || S.frames["td_" + it.sp.id + "_" + dir + "_0"]
          || S.frames["td_" + it.sp.id + "_l_" + (aFrame % 2)]
          || S.frames["td_" + it.sp.id]
          || S.frames["td_" + (it.sp.id === "lion" ? "lioness" : it.sp.id)];
        if (S.animalImg && td) {
          var dw = Math.min(56, td.w), dh = Math.min(48, td.h);
          ctx.drawImage(S.animalImg, td.x, td.y, td.w, td.h, (it.ax - dw / 2) | 0, (it.ay - dh + 2) | 0, dw, dh);
        } else if (getAnimalCanvas) {
          var img = getAnimalCanvas(it.sp.id, it.sp.frame | 0);
          if (img) {
            ctx.drawImage(img, it.ax - 16, it.ay - 24, 32, 24);
          }
        }
        if (it.sp.rare) {
          ctx.fillStyle = "#e8c86a";
          ctx.beginPath();
          ctx.moveTo(it.ax, it.ay - 30);
          ctx.lineTo(it.ax + 3, it.ay - 26);
          ctx.lineTo(it.ax, it.ay - 22);
          ctx.lineTo(it.ax - 3, it.ay - 26);
          ctx.closePath();
          ctx.fill();
        }
        if (it.sp.alertT > 0) {
          ctx.fillStyle = "rgba(255,220,80," + Math.min(1, it.sp.alertT) + ")";
          ctx.beginPath();
          ctx.moveTo(it.ax, it.ay - 34);
          ctx.lineTo(it.ax + 3, it.ay - 28);
          ctx.lineTo(it.ax - 3, it.ay - 28);
          ctx.closePath();
          ctx.fill();
        }
      } else if (it.kind === "player") {
        var fx = px - S.camX;
        var fy = py - S.camY;
        ctx.fillStyle = "rgba(0,0,0,0.34)";
        ctx.beginPath();
        ctx.ellipse(fx, fy + 3, 5.5, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
        var key = moving ? ("player_" + face + "_" + walkFrame) : ("player_" + face + "_idle");
        var pfr = S.frames[key] || S.frames["player_" + face + "_1"] || S.frames["player_" + face + "_0"];
        if (S.playerImg && pfr) {
          ctx.drawImage(S.playerImg, pfr.x, pfr.y, pfr.w, pfr.h, (fx - 8) | 0, (fy - 20) | 0, 16, 24);
        }
      }
    }

    // canopy pass — always draw leaves (trunk-only pass was cutting trees off);
    // fade slightly when standing under so you can still see the Agent
    for (i = 0; i < canopyQ.length; i++) {
      var c = canopyQ[i];
      var dist = Math.hypot(player.x * T - c.o.x, player.y * T - c.o.y);
      var under = dist < Math.max(28, c.fr.w * 0.7) && player.y * T > c.o.y - 4;
      ctx.globalAlpha = under ? 0.72 : 1;
      drawTileTop(ctx, atlas, c.fr, c.sx, c.sy, c.fr.canopyH);
      ctx.globalAlpha = 1;
    }

    drawLocalLights(ctx, W, H, m, T, player, phase);

    // SNES tile HUD chrome corners
    ctx.fillStyle = "rgba(8,20,12,0.9)";
    ctx.fillRect(0, 0, W, 3);
    ctx.fillRect(0, H - 3, W, 3);
    ctx.fillRect(0, 0, 3, H);
    ctx.fillRect(W - 3, 0, 3, H);
    ctx.strokeStyle = "rgba(93,206,122,0.45)";
    ctx.strokeRect(4.5, 4.5, W - 9, H - 9);
    ctx.fillStyle = "#5dce7a";
    [[5, 5], [W - 8, 5], [5, H - 8], [W - 8, H - 8]].forEach(function (p) {
      ctx.fillRect(p[0], p[1], 3, 3);
    });

    todMultiply(ctx, W, H, phase);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { S.preload(); });
  } else {
    S.preload();
  }
})();
