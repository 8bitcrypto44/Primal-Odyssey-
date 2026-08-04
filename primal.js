(function () {
  const isEmbed =
    window !== window.top || /(?:\?|&)embed=1(?:&|$)/.test(location.search || "");
  if (isEmbed) {
    document.documentElement.classList.add("po-embed");
    function lockEmbedScroll() {
      if (window.scrollY || document.documentElement.scrollTop || document.body.scrollTop) {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }
    }
    window.addEventListener("scroll", lockEmbedScroll, { passive: true });
    window.addEventListener("resize", lockEmbedScroll);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("scroll", lockEmbedScroll);
      window.visualViewport.addEventListener("resize", lockEmbedScroll);
    }
    // Stop Digistracts/GoDaddy parent page from scrolling the iframe out of view
    document.addEventListener(
      "touchmove",
      function (e) {
        let el = e.target;
        while (el && el !== document.documentElement) {
          if (el.classList && (
            el.classList.contains("po-overlay") ||
            el.classList.contains("po-dossier") ||
            el.classList.contains("po-touch") ||
            el.classList.contains("po-stick") ||
            el.classList.contains("po-look-btn")
          )) {
            return;
          }
          el = el.parentElement;
        }
        e.preventDefault();
      },
      { passive: false, capture: true }
    );
  }
  const canvas = document.getElementById("po-canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.imageSmoothingEnabled = false;
  canvas.style.imageRendering = "pixelated";
  const W = 480, H = 270;
  const MAP = 36;
  const FOV = Math.PI / 3;
  const TEX = 64;
  const UNIT_FT = 11;
  const HT_FT = {
    acacia: 30, baobab: 50, pine: 75, tree: 100,
    rock: 5, snowrock: 5, grass: 3, fern: 3.5, bush: 3.2,
    lion: 4.8, tiger: 4.5, leopard: 3, jaguar: 3.2, snowleopard: 2.8,
    cougar: 3.2, wolf: 3, grizzly: 5.5, gorilla: 5.6, hippo: 5.5,
    rhino: 6.2, buffalo: 5.5, croc: 1.8, anaconda: 2.5, eagle: 2.8
  };
  function worldScale(id) { return (HT_FT[id] || 6) / UNIT_FT; }

  const ui = {
    title: document.getElementById("po-title"),
    dossier: document.getElementById("po-dossier"),
    hud: document.getElementById("po-hud"),
    hint: document.getElementById("po-hint"),
    regionChip: document.getElementById("po-region-chip"),
    posChip: document.getElementById("po-pos-chip"),
    menuBtn: document.getElementById("po-menu-btn"),
    fsBtn: document.getElementById("po-fs-btn"),
    mute: document.getElementById("po-mute"),
    vol: document.getElementById("po-vol"),
    touch: document.getElementById("po-touch"),
    stick: document.getElementById("po-stick"),
    knob: document.getElementById("po-knob"),
    lookL: document.getElementById("po-look-l"),
    lookR: document.getElementById("po-look-r"),
    dArt: document.getElementById("po-dossier-art"),
    dName: document.getElementById("po-d-name"),
    dLatin: document.getElementById("po-d-latin"),
    dDanger: document.getElementById("po-d-danger"),
    dBody: document.getElementById("po-d-body"),
    dClose: document.getElementById("po-d-close")
  };

  const MUSIC_BASE = "https://incompetech.com/music/royalty-free/mp3-royaltyfree/";
  const MUSIC = {
    africa: MUSIC_BASE + "Digya.mp3",
    mountains: MUSIC_BASE + "Windswept.mp3",
    jungle: MUSIC_BASE + "Nightdreams.mp3"
  };
  let bgm = null, musicVol = 0.55, muted = false, musicRegion = null;

  function syncMuteUI() {
    if (ui.mute) {
      ui.mute.textContent = muted ? "MUTED" : "SOUND";
      ui.mute.setAttribute("aria-pressed", muted ? "true" : "false");
    }
    if (ui.vol) ui.vol.value = String(Math.round(musicVol * 100));
  }

  function applyMusicVol() {
    if (bgm) bgm.volume = muted ? 0 : musicVol;
    syncMuteUI();
  }

  function playRegionMusic(id) {
    const url = MUSIC[id];
    if (!url) return;
    if (!bgm) { bgm = new Audio(); bgm.loop = true; bgm.preload = "auto"; }
    if (musicRegion !== id) {
      musicRegion = id;
      bgm.src = url;
      try { bgm.currentTime = 0; } catch (e) {}
    }
    applyMusicVol();
    const p = bgm.play();
    if (p && p.catch) p.catch(function () {});
  }

  function stopMusic() {
    musicRegion = null;
    if (bgm) { bgm.pause(); try { bgm.currentTime = 0; } catch (e) {} }
  }

  function setMuted(on) { muted = !!on; applyMusicVol(); }
  function setVolume(pct) {
    musicVol = clamp(pct / 100, 0, 1);
    if (musicVol > 0) muted = false;
    applyMusicVol();
  }

  let region = null;
  let wall = [];
  let floor = [];
  let sprites = [];
  let player = { x: 3.5, y: 3.5, dir: 0, bob: 0 };
  let keys = {};
  let openAnimal = null;
  let tab = "facts";
  let t = 0;
  let mode = "title";
  let lookDrag = null;
  let lookMoved = 0;
  let suppressClickUntil = 0;
  let pad = { fwd: 0, strafe: 0, turn: 0 };
  let propCache = {};
  let miniBase = null;

  function rnd(n) { return Math.floor(Math.random() * n); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function hexRgb(h) {
    h = h.replace("#", "");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function shade(hex, f) {
    const c = hexRgb(hex);
    return "rgb(" + (c[0] * f | 0) + "," + (c[1] * f | 0) + "," + (c[2] * f | 0) + ")";
  }

  function nearCell(ix, iy, test) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const x = ix + dx, y = iy + dy;
      if (x < 0 || y < 0 || x >= MAP || y >= MAP) continue;
      if (test(x, y)) return true;
    }
    return false;
  }

  function buildWorld(regionId) {
    const R = PO_DATA[regionId];
    region = R;
    wall = [];
    floor = [];
    sprites = [];
    propCache = {};
    miniBase = null;

    for (let y = 0; y < MAP; y++) {
      wall[y] = [];
      floor[y] = [];
      for (let x = 0; x < MAP; x++) {
        const n = Math.sin(x * 0.55) * Math.cos(y * 0.47) + Math.sin((x + y) * 0.19);
        let f = 1;
        if (regionId === "africa") {
          if (n > 0.68) f = 3;
          else if (Math.abs(n) < 0.06) f = 0;
        } else if (regionId === "mountains") {
          if (n < -0.5) f = 2;
        } else if (n > 0.72) f = 3;
        // No invisible edge walls — soft clamp + visible rim props below
        wall[y][x] = 0;
        floor[y][x] = f;
      }
    }

    for (let y = 2; y < 7; y++) for (let x = 2; x < 7; x++) { wall[y][x] = 0; floor[y][x] = 0; }

    function openSpot(x, y) {
      const ix = x | 0, iy = y | 0;
      if (ix < 1 || iy < 1 || ix >= MAP - 1 || iy >= MAP - 1) return false;
      if (wall[iy][ix] || floor[iy][ix] === 3) return false;
      if (Math.hypot(x - 4.5, y - 4.5) < 2.5) return false;
      return true;
    }

    function placeProp(kind) {
      for (let tries = 0; tries < 40; tries++) {
        const x = 2 + Math.random() * (MAP - 4);
        const y = 2 + Math.random() * (MAP - 4);
        if (!openSpot(x, y)) continue;
        sprites.push({
          x: x, y: y, kind: "prop", prop: kind,
          scale: worldScale(kind) * (0.9 + Math.random() * 0.2), bob: 0
        });
        return;
      }
    }

    function placeEdgeProp(kind, x, y) {
      sprites.push({
        x: x, y: y, kind: "prop", prop: kind,
        scale: worldScale(kind) * (1.05 + Math.random() * 0.25), bob: 0
      });
    }

    const trees = regionId === "africa" ? ["acacia", "baobab", "acacia"]
      : regionId === "mountains" ? ["pine"] : ["tree", "tree"];
    const treeN = regionId === "mountains" ? 32 : 10;
    for (let i = 0; i < treeN; i++) placeProp(trees[rnd(trees.length)]);
    const rocks = regionId === "mountains" ? ["snowrock"] : ["rock"];
    const rockN = regionId === "mountains" ? 24 : 18;
    for (let i = 0; i < rockN; i++) placeProp(rocks[0]);
    if (regionId === "mountains") {
      for (let i = 0; i < 45; i++) placeProp("grass");
      for (let i = 0; i < 28; i++) placeProp("bush");
    }

    // Visible map rim so the soft boundary is readable (rocks / trees / pines)
    const rimRock = regionId === "mountains" ? "snowrock" : "rock";
    const rimTall = regionId === "africa" ? "acacia" : (regionId === "mountains" ? "pine" : "tree");
    for (let i = 1; i < MAP - 1; i += 2) {
      const j = i + 0.5;
      placeEdgeProp(i % 4 === 1 ? rimTall : rimRock, j, 1.15);
      placeEdgeProp(i % 4 === 1 ? rimTall : rimRock, j, MAP - 1.15);
      placeEdgeProp(i % 4 === 3 ? rimTall : rimRock, 1.15, j);
      placeEdgeProp(i % 4 === 3 ? rimTall : rimRock, MAP - 1.15, j);
    }

    for (let y = 1; y < MAP - 1; y++) {
      for (let x = 1; x < MAP - 1; x++) {
        if (wall[y][x] || floor[y][x] === 3) continue;
        if (!nearCell(x, y, function (nx, ny) { return floor[ny][nx] === 3; })) continue;
        if (rnd(3)) continue;
        const shore = regionId === "jungle" ? "fern" : "grass";
        sprites.push({
          x: x + 0.35 + Math.random() * 0.3,
          y: y + 0.35 + Math.random() * 0.3,
          kind: "prop", prop: shore,
          scale: worldScale(shore) * (0.85 + Math.random() * 0.3), bob: 0
        });
      }
    }

    animalsPlace(R, [[17, 8], [28, 20], [10, 26], [24, 29], [20, 15]]);
    player.x = 4.5;
    player.y = 4.5;
    player.dir = 0.4;
    player.bob = 0;
    rebuildMiniBase();
  }

  function animalsPlace(R, spots) {
    R.animals.forEach(function (a, i) {
      let x = spots[i] ? spots[i][0] + 0.5 : (a.x / 64) * MAP;
      let y = spots[i] ? spots[i][1] + 0.5 : (a.y / 40) * MAP;
      x = clamp(x, 2, MAP - 3);
      y = clamp(y, 2, MAP - 3);
      const waterLove = a.id === "croc" || a.id === "hippo" || a.id === "anaconda";
      if (waterLove) {
        for (let t = 0; t < 50; t++) {
          const tx = 2 + rnd(MAP - 4) + 0.5, ty = 2 + rnd(MAP - 4) + 0.5;
          if (!wall[ty | 0][tx | 0] && floor[ty | 0][tx | 0] === 3) { x = tx; y = ty; break; }
        }
      } else if (wall[y | 0][x | 0] || floor[y | 0][x | 0] === 3) {
        // Nudge to dry land — never mutate water cells into dirt
        let placed = false;
        for (let t = 0; t < 60; t++) {
          const tx = 2 + rnd(MAP - 4) + 0.5, ty = 2 + rnd(MAP - 4) + 0.5;
          if (!wall[ty | 0][tx | 0] && floor[ty | 0][tx | 0] !== 3) {
            x = tx; y = ty; placed = true; break;
          }
        }
        if (!placed) { x = 4.5; y = 4.5; }
      }
      sprites.push({
        x: x, y: y, kind: "animal", data: a, id: a.id,
        scale: worldScale(a.id), bob: 0,
        vx: 0, vy: 0, walkT: 0.5 + Math.random() * 2, face: 1,
        waterLove: waterLove
      });
    });
  }

  function blocked(x, y) {
    if (x < 0 || y < 0 || x >= MAP || y >= MAP) return true;
    return wall[y | 0][x | 0] > 0;
  }

  function wet(x, y) {
    const ix = x | 0, iy = y | 0;
    if (ix < 0 || iy < 0 || ix >= MAP || iy >= MAP) return true;
    return floor[iy][ix] === 3;
  }

  function playerBlocked(x, y) {
    return blocked(x, y) || wet(x, y);
  }

  function animalBlocked(x, y, sp) {
    if (blocked(x, y)) return true;
    if (sp && sp.waterLove) return false;
    return wet(x, y);
  }

  function retargetAnimal(sp) {
    let ang = Math.random() * Math.PI * 2;
    if (sp.waterLove) {
      for (let t = 0; t < 8; t++) {
        const a = Math.random() * Math.PI * 2;
        const tx = sp.x + Math.cos(a) * 3, ty = sp.y + Math.sin(a) * 3;
        if (wet(tx, ty) || nearCell(tx | 0, ty | 0, function (nx, ny) { return floor[ny][nx] === 3; })) {
          ang = a;
          break;
        }
      }
    }
    const spd = sp.id === "eagle" ? 0.95 : (0.4 + Math.random() * 0.5);
    sp.vx = Math.cos(ang) * spd;
    sp.vy = Math.sin(ang) * spd;
    sp.walkT = 2 + Math.random() * 2;
    if (Math.abs(sp.vx) > 0.05) sp.face = sp.vx < 0 ? -1 : 1;
  }

  function moveAnimals(dt) {
    for (let i = 0; i < sprites.length; i++) {
      const sp = sprites[i];
      if (sp.kind !== "animal") continue;
      sp.walkT -= dt;
      if (sp.walkT <= 0) retargetAnimal(sp);
      const nx = sp.x + sp.vx * dt;
      const ny = sp.y + sp.vy * dt;
      if (!animalBlocked(nx, sp.y, sp)) sp.x = nx;
      else {
        sp.vx *= -1;
        if (Math.abs(sp.vx) > 0.05) sp.face = sp.vx < 0 ? -1 : 1;
        sp.walkT = Math.min(sp.walkT, 0.4);
      }
      if (!animalBlocked(sp.x, ny, sp)) sp.y = ny;
      else {
        sp.vy *= -1;
        sp.walkT = Math.min(sp.walkT, 0.4);
      }
      sp.x = clamp(sp.x, 1.5, MAP - 1.5);
      sp.y = clamp(sp.y, 1.5, MAP - 1.5);
    }
  }

  function movePlayer(dt) {
    let turn = 0, fwd = 0, strafe = 0;
    if (keys.ArrowLeft || keys.q || keys.Q) turn -= 1;
    if (keys.ArrowRight || keys.e || keys.E) turn += 1;
    if (keys.w || keys.W || keys.ArrowUp) fwd += 1;
    if (keys.s || keys.S || keys.ArrowDown) fwd -= 1;
    if (keys.a || keys.A) strafe -= 1;
    if (keys.d || keys.D) strafe += 1;
    fwd += pad.fwd;
    strafe += pad.strafe;
    turn += pad.turn;
    fwd = clamp(fwd, -1, 1);
    strafe = clamp(strafe, -1, 1);
    turn = clamp(turn, -1, 1);
    player.dir += turn * 2.2 * dt;
    const c = Math.cos(player.dir), s = Math.sin(player.dir);
    const sp = 2.6 * dt;
    const mx = (c * fwd + -s * strafe) * sp;
    const my = (s * fwd + c * strafe) * sp;
    if (!playerBlocked(player.x + mx * 3.2, player.y)) player.x += mx;
    if (!playerBlocked(player.x, player.y + my * 3.2)) player.y += my;
    player.x = clamp(player.x, 1.5, MAP - 1.5);
    player.y = clamp(player.y, 1.5, MAP - 1.5);
    if (fwd || strafe) player.bob += dt * 10;
  }

  function floorColorAt(fx, fy, fog) {
    const R = region;
    const mx = fx | 0, my = fy | 0;
    const cell = (mx >= 0 && my >= 0 && mx < MAP && my < MAP) ? floor[my][mx] : 1;
    const n = ((mx * 13 + my * 29) ^ ((fx * 8 | 0) * 7 + (fy * 8 | 0))) & 7;
    const tex = remoteGround[R.id];
    if (tex && cell !== 3) {
      let u = ((fx * TEX) % TEX + TEX) % TEX | 0;
      let v = ((fy * TEX) % TEX + TEX) % TEX | 0;
      const i = (v * TEX + u) * 4;
      let r = tex.data[i], g = tex.data[i + 1], b = tex.data[i + 2];
      if (cell === 2 || cell === 0) { r = (r * 0.75) | 0; g = (g * 0.7) | 0; b = (b * 0.55) | 0; }
      return "rgb(" + ((r * fog) | 0) + "," + ((g * fog) | 0) + "," + ((b * fog) | 0) + ")";
    }
    let hex;
    if (cell === 3) hex = R.water || "#2a6a7a";
    else if (cell === 2) hex = R.id === "mountains" ? "#c8d4e0" : (R.path || "#8a6b35");
    else if (cell === 0) hex = R.path || "#8a6b35";
    else {
      hex = R.ground[n % R.ground.length];
      if (R.id === "jungle") hex = n > 5 ? "#1a4a20" : "#163416";
      if (R.id === "africa" && n < 3) hex = n === 0 ? "#6a8a30" : "#9a7a38";
    }
    const grit = 0.9 + (n / 7) * 0.14;
    return shade(hex, fog * grit);
  }

  function drawSkyFloor() {
    const R = region;
    const bobY = Math.sin(player.bob) * 4;
    const horizon = (H / 2 + bobY) | 0;
    const skyImg = remoteSky[R.id];
    if (skyImg) {
      const scroll = ((player.dir * 120) % skyImg.width + skyImg.width) % skyImg.width;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(skyImg, -scroll, 0, skyImg.width, horizon);
      ctx.drawImage(skyImg, -scroll + skyImg.width, 0, skyImg.width, horizon);
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, horizon);
      g.addColorStop(0, R.sky[0]);
      g.addColorStop(1, R.sky[2] || R.sky[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, horizon);
    }
    if (R.mist) {
      ctx.fillStyle = "rgba(20,50,30,0.28)";
      ctx.fillRect(0, 0, W, horizon);
    }
    const dirX = Math.cos(player.dir), dirY = Math.sin(player.dir);
    const planeX = -dirY * 0.66, planeY = dirX * 0.66;
    const stepY = 1, stepX = 2;
    for (let y = horizon + 1; y < H; y += stepY) {
      const rowDist = (0.5 * H) / (y - horizon);
      const fog = clamp(1 - rowDist / 16, 0.2, 1);
      const Lx = player.x + rowDist * (dirX - planeX);
      const Ly = player.y + rowDist * (dirY - planeY);
      const Rx = player.x + rowDist * (dirX + planeX);
      const Ry = player.y + rowDist * (dirY + planeY);
      for (let x = 0; x < W; x += stepX) {
        const u = x / W;
        ctx.fillStyle = floorColorAt(Lx + (Rx - Lx) * u, Ly + (Ry - Ly) * u, fog);
        ctx.fillRect(x, y, stepX, stepY);
      }
    }
  }

  function drawPropBillboard(ctx2, prop, size) {
    const s = size;
    if (prop === "acacia" || prop === "baobab" || prop === "tree") {
      ctx2.fillStyle = "#3a2a10";
      ctx2.fillRect(s * 0.44, s * 0.35, s * 0.12, s * 0.55);
      ctx2.fillStyle = prop === "baobab" ? "#5a3a18" : "#2a6a34";
      ctx2.beginPath();
      ctx2.ellipse(s * 0.5, s * 0.3, s * (prop === "acacia" ? 0.4 : 0.28), s * (prop === "acacia" ? 0.16 : 0.28), 0, 0, Math.PI * 2);
      ctx2.fill();
    } else if (prop === "pine") {
      ctx2.fillStyle = "#3a2a18";
      ctx2.fillRect(s * 0.46, s * 0.55, s * 0.1, s * 0.4);
      ctx2.fillStyle = "#1a4a28";
      for (let i = 0; i < 3; i++) {
        ctx2.beginPath();
        ctx2.moveTo(s * 0.5, s * (0.1 + i * 0.18));
        ctx2.lineTo(s * 0.15, s * (0.4 + i * 0.18));
        ctx2.lineTo(s * 0.85, s * (0.4 + i * 0.18));
        ctx2.fill();
      }
    } else if (prop === "grass" || prop === "fern" || prop === "bush") {
      ctx2.fillStyle = prop === "fern" ? "#2a8a50" : (prop === "bush" ? "#4a7a28" : "#6a9a30");
      for (let i = 0; i < 5; i++) ctx2.fillRect(s * (0.25 + i * 0.1), s * 0.35, s * 0.06, s * 0.6);
    } else {
      ctx2.fillStyle = prop === "snowrock" ? "#c8d0d8" : "#5a5858";
      ctx2.fillRect(s * 0.25, s * 0.5, s * 0.5, s * 0.4);
    }
  }

  const REMOTE = {
    lion: "https://i.postimg.cc/ZnC9fp4X/Lion.jpg",
    grizzly: "https://i.postimg.cc/vTc1PfbK/Bear.jpg",
    anaconda: "https://i.postimg.cc/yxkJfcs5/Anaconda.jpg",
    rhino: "https://i.postimg.cc/90r4xZCN/Rhino.jpg",
    croc: "https://i.postimg.cc/MHvcsVqF/Crock.jpg",
    buffalo: "https://i.postimg.cc/WpGbv5fq/buffalo.jpg",
    cougar: "https://i.postimg.cc/y6mYHLrS/cougar.jpg",
    eagle: "https://i.postimg.cc/pVfXHs1j/eagle.jpg",
    gorilla: "https://i.postimg.cc/KcPv20sL/gorilla.jpg",
    hippo: "https://i.postimg.cc/1RG5QvYw/hippo.jpg",
    jaguar: "https://i.postimg.cc/zDCXrxPT/jaguar.jpg",
    leopard: "https://i.postimg.cc/7P3YkKQM/leopard.jpg",
    snowleopard: "https://i.postimg.cc/SQ6NhgtL/snowleopard.jpg",
    tiger: "https://i.postimg.cc/PfWrjSFQ/tiger.jpg",
    wolf: "https://i.postimg.cc/h4LPB230/wolf.jpg"
  };
  const REMOTE_PROPS = {
    acacia: "https://i.postimg.cc/m24tWq34/acacia.jpg",
    baobab: "https://i.postimg.cc/vHycwj7Q/baobab.jpg",
    pine: "https://i.postimg.cc/dtFLcXRh/pine.jpg",
    tree: "https://i.postimg.cc/WbVhcKmh/jungletree.jpg",
    rock: "https://i.postimg.cc/L6Vh9Tv9/rock.jpg",
    grass: "https://i.postimg.cc/02vb13G5/grass.jpg",
    bush: "https://i.postimg.cc/02vb13G5/grass.jpg",
    fern: "https://i.postimg.cc/X7Wp6hKY/fern.jpg",
    snowrock: "https://i.postimg.cc/vHvDYzX8/snowrock.jpg"
  };
  const REMOTE_GROUND = {
    africa: "https://i.postimg.cc/DZcRJ8N1/ground-africa.jpg",
    mountains: "https://i.postimg.cc/NMxZ95n1/ground-mountains.jpg",
    jungle: "https://i.postimg.cc/0QChMb4Y/ground-jungle.jpg"
  };
  const REMOTE_SKY = {
    africa: "https://i.postimg.cc/Y9xTGhPN/sky-africa.jpg",
    mountains: "https://i.postimg.cc/XJgtGpPs/sky-mountains.jpg",
    jungle: "https://i.postimg.cc/Kz5CkRWq/sky-jungle.jpg"
  };
  const remoteArt = {};
  const remoteProps = {};
  const remoteGround = {};
  const remoteSky = {};

  function fitRemoteToCanvas(img) {
    const max = 96;
    const scale = Math.min(max / img.width, max / img.height);
    const w = Math.max(8, (img.width * scale) | 0), h = Math.max(8, (img.height * scale) | 0);
    const tmp = document.createElement("canvas");
    tmp.width = w; tmp.height = h;
    const tctx = tmp.getContext("2d");
    tctx.imageSmoothingEnabled = false;
    tctx.drawImage(img, 0, 0, w, h);
    let minX = 0, minY = 0, maxX = w - 1, maxY = h - 1;
    try {
      const data = tctx.getImageData(0, 0, w, h), px = data.data;
      // Only remove near-white background — no fringe erode (destroys pixel-art)
      for (let i = 0; i < px.length; i += 4) {
        const r = px[i], g = px[i + 1], b = px[i + 2];
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        if (r > 232 && g > 232 && b > 232 && mx - mn < 28) px[i + 3] = 0;
      }
      minX = w; minY = h; maxX = 0; maxY = 0;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i + 3] > 20) {
          const x = (i / 4) % w, y = (i / 4 / w) | 0;
          if (x < minX) minX = x; if (y < minY) minY = y;
          if (x > maxX) maxX = x; if (y > maxY) maxY = y;
        }
      }
      tctx.putImageData(data, 0, 0);
      if (maxX <= minX || maxY <= minY) { minX = 0; minY = 0; maxX = w - 1; maxY = h - 1; }
    } catch (e) {}
    const cw = maxX - minX + 1, ch = maxY - minY + 1;
    const off = document.createElement("canvas");
    off.width = cw; off.height = ch;
    const octx = off.getContext("2d");
    octx.imageSmoothingEnabled = false;
    octx.drawImage(tmp, minX, minY, cw, ch, 0, 0, cw, ch);
    return off;
  }

  function loadImg(url, onOk) {
    fetch(url, { mode: "cors", cache: "force-cache" }).then(function (res) {
      if (!res.ok) throw new Error("x");
      return res.blob();
    }).then(function (blob) {
      const u = URL.createObjectURL(blob), img = new Image();
      img.onload = function () { onOk(img); URL.revokeObjectURL(u); };
      img.onerror = function () { URL.revokeObjectURL(u); };
      img.src = u;
    }).catch(function () {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = function () { onOk(img); };
      img.onerror = function () {
        const i2 = new Image();
        i2.crossOrigin = "anonymous";
        i2.onload = function () { onOk(i2); };
        i2.src = url;
      };
      img.src = url;
    });
  }

  function preloadRemoteArt() {
    Object.keys(REMOTE).forEach(function (id) {
      loadImg(REMOTE[id], function (img) {
        remoteArt[id] = fitRemoteToCanvas(img);
        delete propCache["a:" + id];
      });
    });
    Object.keys(REMOTE_PROPS).forEach(function (kind) {
      loadImg(REMOTE_PROPS[kind], function (img) {
        remoteProps[kind] = fitRemoteToCanvas(img);
        delete propCache[kind];
      });
    });
    Object.keys(REMOTE_GROUND).forEach(function (rid) {
      loadImg(REMOTE_GROUND[rid], function (img) {
        const c = document.createElement("canvas");
        c.width = c.height = TEX;
        const g = c.getContext("2d");
        g.imageSmoothingEnabled = false;
        g.drawImage(img, 0, 0, TEX, TEX);
        remoteGround[rid] = g.getImageData(0, 0, TEX, TEX);
      });
    });
    Object.keys(REMOTE_SKY).forEach(function (rid) {
      loadImg(REMOTE_SKY[rid], function (img) {
        const c = document.createElement("canvas");
        c.width = W;
        c.height = H / 2;
        const g = c.getContext("2d");
        g.imageSmoothingEnabled = false;
        g.drawImage(img, 0, 0, c.width, c.height);
        remoteSky[rid] = c;
      });
    });
  }

  function getPropCanvas(prop) {
    if (remoteProps[prop]) return remoteProps[prop];
    if (propCache[prop]) return propCache[prop];
    const off = document.createElement("canvas");
    off.width = off.height = 64;
    const octx = off.getContext("2d");
    octx.imageSmoothingEnabled = false;
    drawPropBillboard(octx, prop, 64);
    propCache[prop] = off;
    return off;
  }

  function getAnimalCanvas(id) {
    const key = "a:" + id;
    if (remoteArt[id]) return remoteArt[id];
    if (propCache[key]) return propCache[key];
    const sz = PO_SPRITES.spriteSize(id, 3);
    const off = document.createElement("canvas");
    off.width = Math.max(48, sz.w + 8);
    off.height = Math.max(48, sz.h + 14);
    const octx = off.getContext("2d");
    octx.imageSmoothingEnabled = false;
    octx.fillStyle = "rgba(0,0,0,0.35)";
    octx.beginPath();
    octx.ellipse(off.width / 2, off.height - 5, off.width * 0.28, 4, 0, 0, Math.PI * 2);
    octx.fill();
    PO_SPRITES.drawSprite(octx, id, 4, 2, 3, 0);
    propCache[key] = off;
    return off;
  }

  function drawSprites() {
    const bobY = Math.sin(player.bob) * 4;
    const dirX = Math.cos(player.dir), dirY = Math.sin(player.dir);
    const planeX = -dirY * 0.66, planeY = dirX * 0.66;
    const list = sprites.map(function (sp) {
      const dx = sp.x - player.x, dy = sp.y - player.y;
      return { sp: sp, dist: dx * dx + dy * dy };
    }).sort(function (a, b) { return b.dist - a.dist; });

    drawSprites._screen = [];
    for (let i = 0; i < list.length; i++) {
      const sp = list[i].sp;
      const spriteX = sp.x - player.x;
      const spriteY = sp.y - player.y;
      const invDet = 1 / (planeX * dirY - dirX * planeY);
      const transformX = invDet * (dirY * spriteX - dirX * spriteY);
      const transformY = invDet * (-planeY * spriteX + planeX * spriteY);
      if (transformY <= 0.15 || transformY > 26) continue;
      const spriteScreenX = ((W / 2) * (1 + transformX / transformY)) | 0;
      const sc = sp.scale || worldScale(sp.id || sp.prop);
      const spriteH = Math.abs((H / transformY) * sc) | 0;
      if (spriteH < 4) continue;
      const img = sp.kind === "animal" ? getAnimalCanvas(sp.id) : getPropCanvas(sp.prop);
      const spriteW = Math.max(4, (spriteH * (img.width / img.height)) | 0);
      const floorY = (H / 2 + bobY + (H * 0.5) / transformY) | 0;
      const drawStartY = floorY - spriteH;
      const drawStartX = (-spriteW / 2 + spriteScreenX) | 0;
      const drawEndX = drawStartX + spriteW;
      if (drawEndX < 0 || drawStartX >= W || drawStartY >= H || drawStartY + spriteH < 0) continue;
      const flip = sp.kind === "animal" && sp.face < 0;
      // One blit per sprite (stripe loop was thousands of drawImage calls on Mountains)
      if (flip) {
        ctx.save();
        ctx.translate(drawStartX + spriteW, drawStartY);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, spriteW, spriteH);
        ctx.restore();
      } else {
        ctx.drawImage(img, 0, 0, img.width, img.height, drawStartX, drawStartY, spriteW, spriteH);
      }

      if (sp.kind === "animal") {
        drawSprites._screen.push({
          a: sp,
          x0: drawStartX,
          y0: drawStartY,
          x1: drawEndX,
          y1: drawStartY + spriteH,
          dist: transformY
        });
        if (transformY < 5) {
          ctx.fillStyle = "rgba(4,20,10,0.75)";
          ctx.fillRect(spriteScreenX - 36, drawStartY - 14, 72, 11);
          ctx.fillStyle = "#5dce7a";
          ctx.font = "8px monospace";
          ctx.textAlign = "center";
          ctx.fillText(sp.data.name + " · click", spriteScreenX, drawStartY - 5);
          ctx.textAlign = "left";
        }
      }
    }
  }

  function drawHUDOverlay() {
    ctx.strokeStyle = "rgba(93,206,122,0.7)";
    ctx.beginPath();
    ctx.moveTo(W / 2 - 8, H / 2);
    ctx.lineTo(W / 2 + 8, H / 2);
    ctx.moveTo(W / 2, H / 2 - 8);
    ctx.lineTo(W / 2, H / 2 + 8);
    ctx.stroke();
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.8);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
    const ms = 2, msz = MAP * ms, ox = W - msz - 8, oy = 8;
    ctx.fillStyle = "rgba(2,12,6,0.85)";
    ctx.fillRect(ox - 3, oy - 3, msz + 6, msz + 6);
    ctx.strokeStyle = "#2d6b45";
    ctx.lineWidth = 1;
    ctx.strokeRect(ox - 3.5, oy - 3.5, msz + 6, msz + 6);
    if (miniBase) ctx.drawImage(miniBase, ox, oy);
    sprites.forEach(function (sp) {
      if (sp.kind !== "animal") return;
      const px = ox + sp.x * ms, py = oy + sp.y * ms;
      ctx.fillStyle = sp.data.color || "#c9a227";
      ctx.fillRect((px - 1) | 0, (py - 1) | 0, 2, 2);
    });
    const ppx = ox + player.x * ms, ppy = oy + player.y * ms;
    ctx.fillStyle = "#5dce7a";
    ctx.beginPath();
    ctx.moveTo(ppx + Math.cos(player.dir) * 4, ppy + Math.sin(player.dir) * 4);
    ctx.lineTo(ppx + Math.cos(player.dir + 2.4) * 2.5, ppy + Math.sin(player.dir + 2.4) * 2.5);
    ctx.lineTo(ppx + Math.cos(player.dir - 2.4) * 2.5, ppy + Math.sin(player.dir - 2.4) * 2.5);
    ctx.fill();
  }

  function rebuildMiniBase() {
    const ms = 2, msz = MAP * ms;
    miniBase = document.createElement("canvas");
    miniBase.width = miniBase.height = msz;
    const m = miniBase.getContext("2d");
    m.imageSmoothingEnabled = false;
    for (let y = 0; y < MAP; y++) {
      for (let x = 0; x < MAP; x++) {
        const f = floor[y][x];
        let col = "#163820";
        if (wall[y][x]) col = "#1a2a1c";
        else if (f === 3) col = "#1a5a6a";
        else if (f === 2) col = region.id === "mountains" ? "#c8d4e0" : "#6a5a30";
        else if (f === 0) col = "#8a6b35";
        else if (region.id === "jungle") col = "#1a4a22";
        else if (region.id === "africa") col = "#9a7a38";
        else col = "#4a5a50";
        m.fillStyle = col;
        m.fillRect(x * ms, y * ms, ms, ms);
      }
    }
    sprites.forEach(function (sp) {
      if (sp.kind !== "prop") return;
      const p = sp.prop;
      if (p === "grass" || p === "bush" || p === "fern") return;
      if (p === "pine" || p === "tree" || p === "acacia" || p === "baobab") m.fillStyle = "#2a8a40";
      else m.fillStyle = p === "snowrock" ? "#e8eef4" : "#6a6868";
      m.fillRect((sp.x * ms) | 0, (sp.y * ms) | 0, 1, 1);
    });
  }

  function drawWorld() {
    drawSkyFloor();
    drawSprites();
    drawHUDOverlay();
  }

  function animalAtScreen(sx, sy) {
    const hits = drawSprites._screen || [];
    let best = null, bestD = 1e9;
    for (let i = 0; i < hits.length; i++) {
      const h = hits[i];
      if (sx >= h.x0 && sx <= h.x1 && sy >= h.y0 && sy <= h.y1 && h.dist < bestD) {
        best = h.a;
        bestD = h.dist;
      }
    }
    return best && bestD < 7 ? best : null;
  }

  function clearInput() {
    keys = {};
    lookDrag = null;
    pad.fwd = 0;
    pad.strafe = 0;
    pad.turn = 0;
    if (ui.knob) ui.knob.style.transform = "translate(-50%,-50%)";
    if (ui.lookL) ui.lookL.classList.remove("is-held");
    if (ui.lookR) ui.lookR.classList.remove("is-held");
  }

  function wantsTouchUI() {
    return ("ontouchstart" in window) ||
      (navigator.maxTouchPoints > 0) ||
      (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) ||
      window.innerWidth <= 900;
  }

  function isLandscape() {
    if (window.matchMedia && window.matchMedia("(orientation: landscape)").matches) return true;
    const vh = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
    return window.innerWidth > window.innerHeight || (wantsTouchUI() && vh <= 520 && window.innerWidth >= window.innerHeight);
  }

  function inGameMode() {
    return mode === "explore" || mode === "dossier";
  }

  function notifyParentChrome() {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: "po-chrome",
          explore: mode === "explore",
          inGame: inGameMode(),
          land: inGameMode() && wantsTouchUI() && isLandscape()
        }, "*");
      }
    } catch (e) {}
  }

  function isNativeFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function askParentFullscreen(exit) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: exit ? "po-fs-exit" : "po-fs" }, "*");
      }
    } catch (e) {}
  }

  function tryLandscapeFullscreen() {
    // Browsers block this without a user gesture; Digistracts calls it from touch.
    if (mode !== "explore" || !wantsTouchUI() || !isLandscape()) return;
    if (isNativeFullscreen()) return;
    askParentFullscreen(false);
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return;
    try {
      const p = req.call(el);
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }

  function exitFullscreenAll() {
    askParentFullscreen(true);
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (exit && isNativeFullscreen()) {
      try {
        const p = exit.call(document);
        if (p && p.catch) p.catch(function () {});
      } catch (e) {}
    }
  }

  function syncFsBtn() {
    if (!ui.fsBtn) return;
    const show = inGameMode() && wantsTouchUI() && isLandscape();
    const fs = isNativeFullscreen();
    ui.fsBtn.hidden = !show;
    ui.fsBtn.setAttribute("aria-pressed", fs ? "true" : "false");
    ui.fsBtn.textContent = fs ? "EXIT FULL SCREEN" : "FULL SCREEN";
    document.documentElement.classList.toggle("po-fs", fs);
  }

  function syncTouchUI() {
    const touch = wantsTouchUI();
    const exploring = mode === "explore" && touch;
    const land = inGameMode() && touch && isLandscape();
    document.documentElement.classList.toggle("po-touch-on", exploring);
    document.documentElement.classList.toggle("po-land", land);
    if (ui.touch) ui.touch.hidden = !exploring;
    if (ui.hint && mode === "explore" && exploring) {
      ui.hint.textContent = land
        ? "Tap FULL SCREEN to hide the browser bar · Stick move · LOOK turn"
        : "Stick to move · LOOK to turn · Tap animal · Rotate phone · Tap FULL SCREEN";
    } else if (ui.hint && mode === "explore") {
      ui.hint.textContent = "Drag to look · Tap animal for dossier · REGIONS menu";
    }
    syncFsBtn();
    notifyParentChrome();
  }

  function openDossier(animal) {
    clearInput();
    openAnimal = animal;
    tab = "facts";
    mode = "dossier";
    syncTouchUI();
    ui.dossier.classList.add("show");
    ui.dName.textContent = animal.data.name.toUpperCase();
    ui.dLatin.textContent = animal.data.latin;
    ui.dDanger.textContent = animal.data.danger;
    const dctx = ui.dArt.getContext("2d");
    dctx.imageSmoothingEnabled = false;
    dctx.fillStyle = "#020805";
    dctx.fillRect(0, 0, 96, 96);
    const remote = remoteArt[animal.id];
    if (remote) {
      const sc = Math.min(88 / remote.width, 88 / remote.height);
      const dw = remote.width * sc, dh = remote.height * sc;
      dctx.drawImage(remote, (96 - dw) / 2, (96 - dh) / 2, dw, dh);
    } else {
      const sz = PO_SPRITES.spriteSize(animal.id, 1);
      const sc = Math.min(2.4, 88 / Math.max(sz.w, sz.h));
      PO_SPRITES.drawSprite(dctx, animal.id, (96 - sz.w * sc) / 2, (96 - sz.h * sc) / 2, sc, 0);
    }
    renderTab();
    document.querySelectorAll(".po-tabs button").forEach(function (b) {
      b.classList.toggle("active", b.dataset.tab === tab);
    });
  }

  function renderTab() {
    if (!openAnimal) return;
    const lines = openAnimal.data[tab] || [];
    ui.dBody.innerHTML = lines.map(function (p) { return "<p>" + p + "</p>"; }).join("");
  }

  function closeDossier() {
    ui.dossier.classList.remove("show");
    openAnimal = null;
    clearInput();
    if (mode === "dossier") mode = "explore";
    syncTouchUI();
  }

  function enterRegion(id) {
    buildWorld(id);
    mode = "explore";
    ui.title.classList.remove("show");
    ui.hud.hidden = false;
    ui.hint.hidden = false;
    if (ui.menuBtn) ui.menuBtn.hidden = false;
    ui.regionChip.textContent = region.name;
    closeDossier();
    clearInput();
    syncTouchUI();
    playRegionMusic(id);
    tryLandscapeFullscreen();
  }

  function showTitle() {
    mode = "title";
    ui.title.classList.add("show");
    ui.hud.hidden = true;
    ui.hint.hidden = true;
    if (ui.menuBtn) ui.menuBtn.hidden = true;
    stopMusic();
    closeDossier();
    clearInput();
    syncTouchUI();
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - (loop._last || now)) / 1000);
    loop._last = now;
    t += dt;
    if (mode === "explore") {
      movePlayer(dt);
      moveAnimals(dt);
      ui.posChip.textContent = "POS " + player.x.toFixed(1) + "," + player.y.toFixed(1);
      drawWorld();
    } else if (mode === "dossier") {
      moveAnimals(dt);
      drawWorld();
    } else {
      ctx.fillStyle = "#030605";
      ctx.fillRect(0, 0, W, H);
    }
    requestAnimationFrame(loop);
  }

  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (mode === "dossier") closeDossier();
      else if (mode === "explore") showTitle();
      return;
    }
    if (mode !== "explore") return;
    keys[e.key] = true;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].indexOf(e.key) >= 0) e.preventDefault();
  });
  window.addEventListener("keyup", function (e) { keys[e.key] = false; });
  window.addEventListener("blur", function () { clearInput(); });

  canvas.addEventListener("mousedown", function (e) {
    if (mode !== "explore") return;
    lookMoved = 0;
    lookDrag = { x: e.clientX, dir: player.dir };
  });
  window.addEventListener("mouseup", function () { lookDrag = null; });
  window.addEventListener("mousemove", function (e) {
    if (!lookDrag || mode !== "explore") return;
    lookMoved = Math.max(lookMoved, Math.abs(e.clientX - lookDrag.x));
    player.dir = lookDrag.dir + (e.clientX - lookDrag.x) * 0.005;
  });

  function canvasPos(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const rw = rect.width || 1;
    const rh = rect.height || 1;
    // object-fit:contain letterboxes the 480x270 buffer inside the element box
    const scale = Math.min(rw / W, rh / H);
    const dw = W * scale;
    const dh = H * scale;
    const ox = (rw - dw) * 0.5;
    const oy = (rh - dh) * 0.5;
    return {
      sx: (clientX - rect.left - ox) * (W / dw),
      sy: (clientY - rect.top - oy) * (H / dh)
    };
  }

  function tryOpenAt(clientX, clientY) {
    // After a look-drag, browsers still fire a delayed click; do not open dossiers from it.
    if (performance.now() < suppressClickUntil) return;
    if (lookMoved > 8) {
      suppressClickUntil = performance.now() + 450;
      lookMoved = 0;
      return;
    }
    const p = canvasPos(clientX, clientY);
    const hit = animalAtScreen(p.sx, p.sy);
    if (hit) openDossier(hit);
  }

  canvas.addEventListener("click", function (e) {
    if (mode !== "explore") return;
    tryOpenAt(e.clientX, e.clientY);
  });

  canvas.addEventListener("touchstart", function (e) {
    if (mode !== "explore" || !e.touches.length) return;
    e.preventDefault();
    lookMoved = 0;
    lookDrag = { x: e.touches[0].clientX, dir: player.dir };
  }, { passive: false });

  window.addEventListener("touchmove", function (e) {
    if (!lookDrag || mode !== "explore" || !e.touches.length) return;
    e.preventDefault();
    const dx = e.touches[0].clientX - lookDrag.x;
    lookMoved = Math.max(lookMoved, Math.abs(dx));
    player.dir = lookDrag.dir + dx * 0.005;
  }, { passive: false });

  window.addEventListener("touchend", function (e) {
    if (mode === "explore" && lookDrag && e.changedTouches && e.changedTouches.length) {
      const t = e.changedTouches[0];
      tryOpenAt(t.clientX, t.clientY);
    }
    lookDrag = null;
  });
  window.addEventListener("touchcancel", function () {
    if (lookMoved > 8) suppressClickUntil = performance.now() + 450;
    lookDrag = null;
  });
  window.addEventListener("pointercancel", function () {
    if (lookMoved > 8) suppressClickUntil = performance.now() + 450;
    lookDrag = null;
  });

  canvas.addEventListener("mousemove", function (e) {
    if (mode !== "explore" || lookDrag) return;
    const p = canvasPos(e.clientX, e.clientY);
    canvas.style.cursor = animalAtScreen(p.sx, p.sy) ? "pointer" : "crosshair";
  });

  ui.menuBtn.addEventListener("click", showTitle);
  if (ui.fsBtn) {
    ui.fsBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (isNativeFullscreen()) exitFullscreenAll();
      else tryLandscapeFullscreen();
      setTimeout(syncFsBtn, 200);
    });
  }
  function onFsChange() {
    syncFsBtn();
    syncTouchUI();
  }
  document.addEventListener("fullscreenchange", onFsChange);
  document.addEventListener("webkitfullscreenchange", onFsChange);
  ui.dClose.addEventListener("click", closeDossier);
  if (ui.mute) ui.mute.addEventListener("click", function () { setMuted(!muted); });
  if (ui.vol) ui.vol.addEventListener("input", function () { setVolume(+ui.vol.value); });
  document.querySelectorAll(".po-tabs button").forEach(function (btn) {
    btn.addEventListener("click", function () {
      tab = btn.dataset.tab;
      document.querySelectorAll(".po-tabs button").forEach(function (b) {
        b.classList.toggle("active", b === btn);
      });
      renderTab();
    });
  });
  document.querySelectorAll(".po-card").forEach(function (card) {
    card.addEventListener("click", function () {
      enterRegion(card.dataset.region);
    });
  });

  // --- Mobile stick + look buttons ---
  (function bindTouchControls() {
    if (!ui.stick || !ui.knob) return;
    let stickId = null;
    function readStick(clientX, clientY) {
      const r = ui.stick.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let dx = (clientX - cx) / (r.width * 0.42);
      let dy = (clientY - cy) / (r.height * 0.42);
      const m = Math.hypot(dx, dy);
      if (m > 1) { dx /= m; dy /= m; }
      pad.strafe = dx;
      pad.fwd = -dy;
      const kx = dx * (r.width * 0.28);
      const ky = dy * (r.height * 0.28);
      ui.knob.style.transform = "translate(calc(-50% + " + kx + "px), calc(-50% + " + ky + "px))";
    }
    function endStick() {
      stickId = null;
      pad.fwd = 0;
      pad.strafe = 0;
      ui.knob.style.transform = "translate(-50%,-50%)";
    }
    ui.stick.addEventListener("pointerdown", function (e) {
      if (mode !== "explore") return;
      stickId = e.pointerId;
      ui.stick.setPointerCapture(e.pointerId);
      readStick(e.clientX, e.clientY);
      tryLandscapeFullscreen();
      e.preventDefault();
    });
    ui.stick.addEventListener("pointermove", function (e) {
      if (stickId !== e.pointerId) return;
      readStick(e.clientX, e.clientY);
      e.preventDefault();
    });
    ui.stick.addEventListener("pointerup", endStick);
    ui.stick.addEventListener("pointercancel", endStick);
    ui.stick.addEventListener("lostpointercapture", endStick);

    function bindLook(btn, dir) {
      if (!btn) return;
      function down(e) {
        if (mode !== "explore") return;
        pad.turn = dir;
        btn.classList.add("is-held");
        tryLandscapeFullscreen();
        e.preventDefault();
      }
      function up() {
        if (pad.turn === dir) pad.turn = 0;
        btn.classList.remove("is-held");
      }
      btn.addEventListener("pointerdown", down);
      btn.addEventListener("pointerup", up);
      btn.addEventListener("pointercancel", up);
      btn.addEventListener("pointerleave", function (e) {
        if (e.buttons === 0) up();
      });
    }
    bindLook(ui.lookL, -1);
    bindLook(ui.lookR, 1);
  })();

  window.addEventListener("resize", syncTouchUI);
  window.addEventListener("orientationchange", function () {
    setTimeout(syncTouchUI, 120);
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncTouchUI);
  }
  syncMuteUI();
  syncTouchUI();
  preloadRemoteArt();
  requestAnimationFrame(loop);

  window.PO = {
    enterRegion: enterRegion,
    showTitle: showTitle,
    listAnimals: function () {
      return sprites.filter(function (s) { return s.kind === "animal"; }).map(function (a) {
        return { id: a.id, name: a.data.name, x: a.x, y: a.y };
      });
    },
    openAnimal: function (id) {
      const a = sprites.find(function (x) { return x.kind === "animal" && x.id === id; });
      if (a) openDossier(a);
    },
    mode: function () { return mode; },
    remoteReady: function () { return Object.keys(remoteArt); },
    lookAt: function (id) {
      const a = sprites.find(function (x) { return x.kind === "animal" && x.id === id; });
      if (!a) return;
      player.x = a.x - 2.2; player.y = a.y; player.dir = 0;
      if (blocked(player.x, player.y)) { player.x = a.x - 2.5; player.y = a.y; }
    }
  };
})();
