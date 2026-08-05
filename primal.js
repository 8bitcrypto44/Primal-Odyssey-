(function () {
  const isEmbed =
    window !== window.top || /(?:\?|&)embed=1(?:&|$)/.test(location.search || "");
  if (isEmbed) {
    document.documentElement.classList.add("po-embed");
    document.documentElement.classList.add("po-loading");
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
  // ImageData floor stays cheap — keep readable res for Digistracts / fullscreen
  const IS_MOBILE = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ||
    (window.matchMedia && matchMedia("(pointer:coarse)").matches);
  const W = IS_MOBILE ? 560 : 720;
  const H = IS_MOBILE ? 315 : 405;
  canvas.width = W;
  canvas.height = H;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const MAP = 36;
  const FOV = Math.PI / 3;
  const TEX = IS_MOBILE ? 96 : 128;
  const FLOOR_STEP_X = IS_MOBILE ? 2 : 2;
  const FLOOR_STEP_Y = IS_MOBILE ? 2 : 1;
  const UNIT_FT = 11;
  const HT_FT = {
    acacia: 30, baobab: 50, pine: 75, tree: 100,
    rock: 5, snowrock: 5, grass: 3, fern: 3.5, bush: 3.2,
    wallrock: 9,
    lion: 4.8, tiger: 4.5, leopard: 3, jaguar: 3.2, snowleopard: 2.8,
    cougar: 3.2, wolf: 3, grizzly: 5.5, gorilla: 5.6, hippo: 5.5,
    rhino: 6.2, buffalo: 5.5, croc: 1.8, anaconda: 2.5, eagle: 2.8, honeybadger: 3.4, lynx: 2.6, ocelot: 2.5
  };
  function worldScale(id) { return (HT_FT[id] || 6) / UNIT_FT; }

  const ui = {
    title: document.getElementById("po-title"),
    dossier: document.getElementById("po-dossier"),
    log: document.getElementById("po-log"),
    hud: document.getElementById("po-hud"),
    hint: document.getElementById("po-hint"),
    regionChip: document.getElementById("po-region-chip"),
    posChip: document.getElementById("po-pos-chip"),
    notesChip: document.getElementById("po-notes-chip"),
    menuBtn: document.getElementById("po-menu-btn"),
    fsBtn: document.getElementById("po-fs-btn"),
    mute: document.getElementById("po-mute"),
    vol: document.getElementById("po-vol"),
    touch: document.getElementById("po-touch"),
    stick: document.getElementById("po-stick"),
    knob: document.getElementById("po-knob"),
    lookL: document.getElementById("po-look-l"),
    lookR: document.getElementById("po-look-r"),
    lookU: document.getElementById("po-look-u"),
    lookD: document.getElementById("po-look-d"),
    dArt: document.getElementById("po-dossier-art"),
    dName: document.getElementById("po-d-name"),
    dLatin: document.getElementById("po-d-latin"),
    dDanger: document.getElementById("po-d-danger"),
    dBody: document.getElementById("po-d-body"),
    dClose: document.getElementById("po-d-close"),
    logBody: document.getElementById("po-log-body"),
    logClose: document.getElementById("po-log-close"),
    note: document.getElementById("po-note"),
    noteBody: document.getElementById("po-note-body"),
    noteMeta: document.getElementById("po-note-meta"),
    noteFoot: document.getElementById("po-note-foot"),
    noteX: document.getElementById("po-note-x"),
    obj: document.getElementById("po-obj"),
    objList: document.getElementById("po-obj-list"),
    pausedEl: document.getElementById("po-paused"),
    continueBtn: document.getElementById("po-continue"),
    help: document.getElementById("po-help"),
    helpX: document.getElementById("po-help-x"),
    helpGo: document.getElementById("po-help-go"),
    journal: document.getElementById("po-journal"),
    journalX: document.getElementById("po-journal-x"),
    journalBody: document.getElementById("po-journal-body"),
    journalMeta: document.getElementById("po-journal-meta"),
    journalBtn: document.getElementById("po-journal-btn"),
    photoBtn: document.getElementById("po-photo-btn"),
    photoFlash: document.getElementById("po-photo-flash"),
    continueArt: document.getElementById("po-continue-art"),
    continueLabel: document.getElementById("po-continue-label"),
    bigLookBtn: document.getElementById("po-big-look"),
    reduceMotionBtn: document.getElementById("po-reduce-motion")
  };

  const MUSIC_BASE = "https://incompetech.com/music/royalty-free/mp3-royaltyfree/";
  const MUSIC = {
    africa: MUSIC_BASE + "Digya.mp3",
    mountains: MUSIC_BASE + "Windswept.mp3",
    jungle: MUSIC_BASE + "Nightdreams.mp3"
  };
  let bgm = null, musicVol = 0.55, muted = false, musicRegion = null;
  let audioCtx = null, masterGain = null, ambientNodes = null, footTimer = 0;
  let dayT = 0;
  let particles = [];
  let notesFound = [];
  let notesTotal = 0;
  let noteFlash = 0;
  let notePendingLog = false;
  let gamePaused = false;
  let ambientChirpT = 0;
  let landmarksVisited = {};
  let animalsSeen = {};
  let rareFound = false;
  let weather = { kind: null, t: 0, next: 18 };
  let photoShots = [];
  let photoFlashT = 0;
  let reduceMotion = false;
  const RARE_IDS = { africa: "honeybadger", mountains: "lynx", jungle: "ocelot" };
  const COVER = {
    africa: "https://i.postimg.cc/D0kDM1Xb/african-cover-image.jpg",
    mountains: "https://i.postimg.cc/L5K7bj11/mountains-cover-image.jpg",
    jungle: "https://i.postimg.cc/VvqTQ5qs/jungle-cover-image.jpg"
  };
  const RADIO_LINES = {
    "WATERING HOLE": "Ranger net: watering hole active — keep distance from pods.",
    "KOPJE LOOKOUT": "Ranger net: kopje lookout clear — good scan for dust trails.",
    "SNOW OVERLOOK": "Ranger net: ridge wind rising — watch footing on ice.",
    "RIDGE TRAIL": "Ranger net: ridge trail open — lynx sign reported at dusk.",
    "CANOPY GAP": "Ranger net: canopy gap — light shaft useful for note hunting.",
    "FERN THICKET": "Ranger net: fern thicket dense — move slow, watch for ocelot."
  };
  const SAVE_KEY = "po_expedition_v1";

  function ensureAudio() {
    if (audioCtx) return audioCtx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = muted ? 0 : musicVol * 0.55;
    masterGain.connect(audioCtx.destination);
    return audioCtx;
  }

  function sfxGain() {
    ensureAudio();
    if (!masterGain) return;
    masterGain.gain.value = muted ? 0 : musicVol * 0.55;
  }

  function blip(freq, dur, type) {
    const ctxA = ensureAudio();
    if (!ctxA || muted) return;
    sfxGain();
    const o = ctxA.createOscillator();
    const g = ctxA.createGain();
    o.type = type || "sine";
    o.frequency.value = freq;
    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(masterGain);
    const now = ctxA.currentTime;
    g.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + (dur || 0.12));
    o.start(now);
    o.stop(now + (dur || 0.12) + 0.02);
  }

  function footstep(wetness) {
    const ctxA = ensureAudio();
    if (!ctxA || muted) return;
    sfxGain();
    const o = ctxA.createOscillator();
    const g = ctxA.createGain();
    const snow = region && region.id === "mountains" && !wetness;
    const leaf = region && region.id === "jungle" && !wetness;
    o.type = wetness ? "sine" : (snow ? "triangle" : (leaf ? "sine" : "triangle"));
    o.frequency.value = wetness
      ? (70 + Math.random() * 40)
      : (snow ? (180 + Math.random() * 50) : (leaf ? (200 + Math.random() * 80) : (130 + Math.random() * 45)));
    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(masterGain);
    const now = ctxA.currentTime;
    const peak = wetness ? 0.05 : (snow ? 0.035 : 0.055);
    g.gain.exponentialRampToValueAtTime(peak, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + (wetness ? 0.11 : 0.07));
    o.start(now);
    o.stop(now + 0.13);
    if (wetness && Math.random() < 0.35) {
      const o2 = ctxA.createOscillator();
      const g2 = ctxA.createGain();
      o2.type = "sine";
      o2.frequency.value = 220 + Math.random() * 40;
      g2.gain.value = 0.0001;
      o2.connect(g2); g2.connect(masterGain);
      g2.gain.exponentialRampToValueAtTime(0.02, now + 0.02);
      g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
      o2.start(now + 0.02); o2.stop(now + 0.16);
    }
  }

  function emptySave() {
    return { onboarded: false, lastRegion: null, regions: {}, shots: [], bigLook: false, reduceMotion: false };
  }
  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return emptySave();
      const s = JSON.parse(raw);
      if (!s || typeof s !== "object") return emptySave();
      s.regions = s.regions || {};
      return s;
    } catch (e) { return emptySave(); }
  }
  function writeSave(s) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) {}
  }
  function regionBucket(s, id) {
    if (!s.regions[id]) s.regions[id] = { notes: [], seen: [], landmarks: [], rare: false };
    const b = s.regions[id];
    b.notes = b.notes || [];
    b.seen = b.seen || [];
    b.landmarks = b.landmarks || [];
    return b;
  }
  function persistProgress() {
    const s = loadSave();
    s.shots = photoShots.slice(0, 24);
    s.bigLook = document.documentElement.classList.contains("po-big-look");
    s.reduceMotion = !!reduceMotion;
    if (region) {
      s.lastRegion = region.id;
      const b = regionBucket(s, region.id);
      b.notes = notesFound.map(function (n) { return n.id; });
      b.seen = Object.keys(animalsSeen);
      b.landmarks = Object.keys(landmarksVisited);
      b.rare = !!rareFound;
      b.complete = regionObjectivesDone();
    }
    writeSave(s);
    syncContinueBtn();
    syncRegionStamps();
  }
  function syncContinueBtn() {
    if (!ui.continueBtn) return;
    const s = loadSave();
    const show = !!(s.lastRegion && PO_DATA[s.lastRegion]);
    ui.continueBtn.hidden = !show;
    const label = "CONTINUE · " + (show ? (PO_DATA[s.lastRegion].name || s.lastRegion).toUpperCase() : "");
    if (ui.continueLabel) ui.continueLabel.textContent = label;
    else ui.continueBtn.textContent = label;
    if (ui.continueArt) {
      if (show && COVER[s.lastRegion]) {
        ui.continueArt.src = COVER[s.lastRegion];
        ui.continueArt.hidden = false;
      } else ui.continueArt.hidden = true;
    }
  }
  function syncRegionStamps() {
    const s = loadSave();
    document.querySelectorAll(".po-stamp").forEach(function (el) {
      const id = el.getAttribute("data-stamp");
      const done = !!(s.regions[id] && s.regions[id].complete);
      el.hidden = !done;
    });
  }
  function applyA11yFromSave() {
    const s = loadSave();
    document.documentElement.classList.toggle("po-big-look", !!s.bigLook);
    reduceMotion = !!s.reduceMotion;
    document.documentElement.classList.toggle("po-reduce-motion", reduceMotion);
    if (ui.bigLookBtn) ui.bigLookBtn.setAttribute("aria-pressed", s.bigLook ? "true" : "false");
    if (ui.reduceMotionBtn) ui.reduceMotionBtn.setAttribute("aria-pressed", reduceMotion ? "true" : "false");
  }
  function regionObjectivesDone() {
    if (!region) return false;
    return objectiveState().every(function (o) { return o.done; });
  }
  function restoreRegionProgress(regionId) {
    const s = loadSave();
    photoShots = Array.isArray(s.shots) ? s.shots.slice(0, 24) : [];
    const b = regionBucket(s, regionId);
    animalsSeen = {};
    landmarksVisited = {};
    rareFound = !!b.rare;
    b.seen.forEach(function (id) { animalsSeen[id] = true; });
    b.landmarks.forEach(function (id) { landmarksVisited[id] = true; });
    const noteSet = {};
    b.notes.forEach(function (id) { noteSet[id] = true; });
    notesFound = [];
    sprites.forEach(function (sp) {
      if (sp.kind !== "note") return;
      if (noteSet[sp.noteId]) {
        sp.taken = true;
        notesFound.push({ id: sp.noteId, text: sp.text });
      }
    });
  }
  function markAnimalSeen(id) {
    if (!id) return;
    animalsSeen[id] = true;
    if (id === "honeybadger" || id === "lynx" || id === "ocelot") rareFound = true;
    persistProgress();
    syncObjectives();
  }
  function markLandmark(id) {
    if (!id || landmarksVisited[id]) return;
    landmarksVisited[id] = true;
    blip(490, 0.1, "sine");
    radioCall(RADIO_LINES[id] || ("Ranger net: " + id + " logged."));
    persistProgress();
    syncObjectives();
  }
  function radioCall(line) {
    const ctxA = ensureAudio();
    if (ctxA && !muted) {
      sfxGain();
      const now = ctxA.currentTime;
      for (let i = 0; i < 3; i++) {
        const o = ctxA.createOscillator();
        const g = ctxA.createGain();
        o.type = i === 0 ? "sawtooth" : "sine";
        o.frequency.value = i === 0 ? 180 : (700 + i * 120);
        g.gain.value = 0.0001;
        o.connect(g); g.connect(masterGain);
        g.gain.exponentialRampToValueAtTime(0.03, now + 0.02 + i * 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12 + i * 0.06);
        o.start(now + i * 0.04); o.stop(now + 0.18 + i * 0.06);
      }
    }
    if (ui.hint && mode === "explore") ui.hint.textContent = line;
  }
  function objectiveState() {
    const animalNeed = 4;
    const seenN = Object.keys(animalsSeen).filter(function (id) {
      return id !== "honeybadger" && id !== "lynx" && id !== "ocelot";
    }).length;
    const lmNeed = 1;
    const lmN = Object.keys(landmarksVisited).length;
    const list = [
      { done: notesTotal > 0 && notesFound.length >= notesTotal, label: "Field notes " + notesFound.length + "/" + notesTotal },
      { done: seenN >= animalNeed, label: "Open dossiers " + Math.min(seenN, animalNeed) + "/" + animalNeed },
      { done: lmN >= lmNeed, label: "Visit a landmark " + Math.min(lmN, lmNeed) + "/" + lmNeed }
    ];
    if (region) {
      const rid = RARE_IDS[region.id];
      const names = { honeybadger: "honey badger", lynx: "lynx", ocelot: "ocelot" };
      if (rid) list.push({ done: !!rareFound || !!animalsSeen[rid], label: "Find the rare " + (names[rid] || rid) });
    }
    return list;
  }
  function syncObjectives() {
    if (!ui.obj || !ui.objList) return;
    const list = objectiveState();
    ui.obj.hidden = mode === "title" || mode === "help";
    ui.objList.innerHTML = list.map(function (o) {
      return "<li class=\"" + (o.done ? "done" : "") + "\">" + o.label + "</li>";
    }).join("");
  }
  function openHelp() {
    if (!ui.help) return;
    ui.help.classList.add("show");
    mode = "help";
    clearInput();
    syncTouchUI();
  }
  function closeHelp(mark) {
    if (ui.help) ui.help.classList.remove("show");
    if (mode === "help") mode = "explore";
    if (mark) {
      const s = loadSave();
      s.onboarded = true;
      writeSave(s);
    }
    clearInput();
    syncTouchUI();
    syncObjectives();
  }
  function setPaused(on) {
    gamePaused = !!on;
    if (ui.pausedEl) ui.pausedEl.hidden = !gamePaused || mode === "title";
  }
  function birdChirp() {
    const ctxA = ensureAudio();
    if (!ctxA || muted) return;
    sfxGain();
    const o = ctxA.createOscillator();
    const g = ctxA.createGain();
    o.type = "sine";
    const base = region && region.id === "jungle" ? 1400 : (region && region.id === "mountains" ? 1100 : 1600);
    o.frequency.value = base + Math.random() * 400;
    g.gain.value = 0.0001;
    o.connect(g); g.connect(masterGain);
    const now = ctxA.currentTime;
    g.gain.exponentialRampToValueAtTime(0.03, now + 0.02);
    o.frequency.exponentialRampToValueAtTime(base * 1.4, now + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    o.start(now); o.stop(now + 0.18);
  }



  function stopAmbient() {
    if (!ambientNodes) return;
    try {
      ambientNodes.forEach(function (n) {
        try { n.stop(); } catch (e) {}
        try { n.disconnect(); } catch (e2) {}
      });
    } catch (e) {}
    ambientNodes = null;
  }

  function startAmbient(regionId) {
    stopAmbient();
    const ctxA = ensureAudio();
    if (!ctxA) return;
    sfxGain();
    ambientNodes = [];
    function tone(freq, vol, type) {
      const o = ctxA.createOscillator();
      const g = ctxA.createGain();
      o.type = type || "sine";
      o.frequency.value = freq;
      g.gain.value = vol;
      o.connect(g);
      g.connect(masterGain);
      o.start();
      ambientNodes.push(o, g);
    }
    if (regionId === "africa") {
      tone(180, 0.008, "sine");
      tone(420 + Math.random() * 40, 0.004, "triangle");
    } else if (regionId === "mountains") {
      tone(90, 0.012, "sine");
      tone(220, 0.005, "sawtooth");
    } else {
      tone(140, 0.007, "sine");
      tone(880, 0.003, "triangle");
      tone(1200, 0.002, "sine");
    }
  }

  function syncMuteUI() {
    if (ui.mute) {
      ui.mute.textContent = muted ? "MUTED" : "SOUND";
      ui.mute.setAttribute("aria-pressed", muted ? "true" : "false");
    }
    if (ui.vol) ui.vol.value = String(Math.round(musicVol * 100));
    sfxGain();
  }

  function applyMusicVol() {
    if (bgm) bgm.volume = muted ? 0 : musicVol;
    sfxGain();
    syncMuteUI();
  }

  function playRegionMusic(id) {
    const url = MUSIC[id];
    if (!url) return;
    ensureAudio();
    if (!bgm) { bgm = new Audio(); bgm.loop = true; bgm.preload = "auto"; }
    if (musicRegion !== id) {
      musicRegion = id;
      bgm.src = url;
      try { bgm.currentTime = 0; } catch (e) {}
    }
    applyMusicVol();
    const p = bgm.play();
    if (p && p.catch) p.catch(function () {});
    startAmbient(id);
  }

  function stopMusic() {
    musicRegion = null;
    if (bgm) { bgm.pause(); try { bgm.currentTime = 0; } catch (e) {} }
    stopAmbient();
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
  let player = { x: 3.5, y: 3.5, dir: 0, pitch: 0, bob: 0 };
  let keys = {};
  let openAnimal = null;
  let tab = "facts";
  let t = 0;
  let mode = "title";
  let lookDrag = null;
  let lookMoved = 0;
  let suppressClickUntil = 0;
  let pad = { fwd: 0, strafe: 0, turn: 0, pitch: 0 };
  let propCache = {};
  let miniBase = null;
  let landmarks = [];

  function dayPhase() {
    // Full cycle ~120s: dawn → noon → dusk → night
    const u = ((dayT / 120) % 1 + 1) % 1;
    if (u < 0.2) return { name: "dawn", light: 0.55 + (u / 0.2) * 0.35, tint: [1.1, 0.85, 0.65] };
    if (u < 0.45) return { name: "day", light: 1, tint: [1, 1, 1] };
    if (u < 0.65) return { name: "dusk", light: 0.75, tint: [1.15, 0.75, 0.55] };
    return { name: "night", light: 0.38, tint: [0.55, 0.65, 0.95] };
  }

  function syncNotesUI() {
    if (ui.notesChip) {
      ui.notesChip.textContent = "NOTES " + notesFound.length + "/" + notesTotal;
      ui.notesChip.classList.toggle("pulse", notesFound.length > 0 && notesFound.length < notesTotal);
      ui.notesChip.classList.toggle("done", notesTotal > 0 && notesFound.length >= notesTotal);
    }
  }

  function rnd(n) { return Math.floor(Math.random() * n); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function viewBob() { return Math.sin(player.bob) * 6; }
  function pitchPx() { return player.pitch * H * 0.72; }
  function horizonY() {
    return Math.max(10, Math.min(H - 12, (H / 2 + viewBob() + pitchPx()) | 0));
  }
  const GAIT_HZ = {
    lion: 3.4, tiger: 3.3, leopard: 3.6, jaguar: 3.5, snowleopard: 3.4, cougar: 3.5,
    wolf: 3.8, grizzly: 2.4, gorilla: 2.2, hippo: 1.8, rhino: 1.9, buffalo: 2.0,
    croc: 1.5, anaconda: 1.2, eagle: 4.5, honeybadger: 3.6, lynx: 3.5, ocelot: 3.6
  };
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
    landmarks = [];
    notesFound = [];
    particles = [];
    dayT = Math.random() * 40;

    for (let y = 0; y < MAP; y++) {
      wall[y] = [];
      floor[y] = [];
      for (let x = 0; x < MAP; x++) {
        const n = Math.sin(x * 0.55) * Math.cos(y * 0.47) + Math.sin((x + y) * 0.19);
        const n2 = Math.sin(x * 0.31 + 2.1) * Math.cos(y * 0.37 - 1.4);
        let f = 1;
        if (regionId === "africa") {
          if (n > 0.62 || (n2 > 0.75 && n > 0.2)) f = 3;
          else if (Math.abs(n) < 0.07 || Math.abs(n2) < 0.05) f = 0;
        } else if (regionId === "mountains") {
          if (n < -0.42 || n2 < -0.55) f = 2;
          else if (Math.abs(n) < 0.08) f = 0;
        } else {
          if (n > 0.68) f = 3;
          else if (n2 > 0.55) f = 0;
          else if (n < -0.35) f = 2;
        }
        wall[y][x] = 0;
        floor[y][x] = f;
      }
    }

    for (let y = 2; y < 7; y++) for (let x = 2; x < 7; x++) { wall[y][x] = 0; floor[y][x] = 0; }

    // Visible kopjes — wall textures + rocks as billboards (no invisible wall cells)
    const kopjeN = regionId === "mountains" ? 5 : (regionId === "africa" ? 4 : 3);
    const kopjeRock = regionId === "mountains" ? "snowrock" : "rock";
    const wallProp = regionId === "mountains" ? "wallmountains"
      : (regionId === "jungle" ? "walljungle" : "wallafrica");
    for (let k = 0; k < kopjeN; k++) {
      const cx = 8 + rnd(MAP - 16), cy = 8 + rnd(MAP - 16);
      if (Math.hypot(cx - 4.5, cy - 4.5) < 6) continue;
      const rad = 1 + rnd(2);
      for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
        if (dx * dx + dy * dy > rad * rad + 0.5) continue;
        const x = cx + dx, y = cy + dy;
        if (x < 2 || y < 2 || x >= MAP - 2 || y >= MAP - 2) continue;
        wall[y][x] = 0;
        floor[y][x] = regionId === "mountains" ? 2 : 1;
        if (dx === 0 && dy === 0) {
          sprites.push({
            x: x + 0.5, y: y + 0.5, kind: "prop", prop: wallProp,
            scale: worldScale("wallrock") * (0.95 + Math.random() * 0.35), bob: 0
          });
        } else if (!rnd(2)) {
          sprites.push({
            x: x + 0.35 + Math.random() * 0.3,
            y: y + 0.35 + Math.random() * 0.3,
            kind: "prop", prop: kopjeRock,
            scale: worldScale(kopjeRock) * (0.9 + Math.random() * 0.4), bob: 0
          });
        }
      }
    }

    function openSpot(x, y) {
      const ix = x | 0, iy = y | 0;
      if (ix < 1 || iy < 1 || ix >= MAP - 1 || iy >= MAP - 1) return false;
      if (wall[iy][ix] || floor[iy][ix] === 3) return false;
      if (Math.hypot(x - 4.5, y - 4.5) < 2.5) return false;
      return true;
    }

    function placeProp(kind, scaleMul) {
      for (let tries = 0; tries < 40; tries++) {
        const x = 2 + Math.random() * (MAP - 4);
        const y = 2 + Math.random() * (MAP - 4);
        if (!openSpot(x, y)) continue;
        sprites.push({
          x: x, y: y, kind: "prop", prop: kind,
          scale: worldScale(kind) * (0.85 + Math.random() * 0.3) * (scaleMul || 1), bob: 0
        });
        return true;
      }
      return false;
    }

    function placeEdgeProp(kind, x, y) {
      sprites.push({
        x: x, y: y, kind: "prop", prop: kind,
        scale: worldScale(kind) * (1.05 + Math.random() * 0.25), bob: 0
      });
    }

    const trees = regionId === "africa" ? ["acacia", "baobab", "acacia", "acacia"]
      : regionId === "mountains" ? ["pine", "pine"] : ["tree", "tree", "tree"];
    const treeN = regionId === "mountains" ? 22 : (regionId === "jungle" ? 20 : 16);
    for (let i = 0; i < treeN; i++) placeProp(trees[rnd(trees.length)]);
    const rocks = regionId === "mountains" ? ["snowrock"] : ["rock"];
    const rockN = regionId === "mountains" ? 16 : 12;
    for (let i = 0; i < rockN; i++) placeProp(rocks[0]);
    if (regionId === "mountains") {
      for (let i = 0; i < 28; i++) placeProp("grass");
      for (let i = 0; i < 16; i++) placeProp("bush");
    } else if (regionId === "africa") {
      for (let i = 0; i < 36; i++) placeProp("grass");
      for (let i = 0; i < 12; i++) placeProp("bush");
    } else {
      for (let i = 0; i < 26; i++) placeProp("fern");
      for (let i = 0; i < 18; i++) placeProp("bush");
      for (let i = 0; i < 14; i++) placeProp("grass");
    }

    const rimRock = regionId === "mountains" ? "snowrock" : "rock";
    const rimTall = regionId === "africa" ? "acacia" : (regionId === "mountains" ? "pine" : "tree");
    for (let i = 1; i < MAP - 1; i += 3) {
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
        if (rnd(2)) continue;
        const shore = regionId === "jungle" ? "fern" : "grass";
        sprites.push({
          x: x + 0.35 + Math.random() * 0.3,
          y: y + 0.35 + Math.random() * 0.3,
          kind: "prop", prop: shore,
          scale: worldScale(shore) * (0.85 + Math.random() * 0.3), bob: 0
        });
      }
    }

    // Landmarks
    function addLandmark(label, x, y, propKind) {
      if (!openSpot(x, y) && floor[y | 0][x | 0] !== 3) {
        x = clamp(x, 4, MAP - 4); y = clamp(y, 4, MAP - 4);
      }
      landmarks.push({ id: label, label: label, x: x, y: y });
      if (propKind) {
        sprites.push({
          x: x, y: y, kind: "prop", prop: propKind,
          scale: worldScale(propKind) * 1.35, bob: 0, landmark: true
        });
      }
    }
    if (regionId === "africa") {
      addLandmark("WATERING HOLE", 18.5, 12.5, "baobab");
      addLandmark("KOPJE LOOKOUT", 26.5, 24.5, "rock");
    } else if (regionId === "mountains") {
      addLandmark("SNOW OVERLOOK", 22.5, 10.5, "pine");
      addLandmark("RIDGE TRAIL", 12.5, 22.5, "snowrock");
    } else {
      addLandmark("CANOPY GAP", 16.5, 16.5, "tree");
      addLandmark("FERN THICKET", 27.5, 20.5, "fern");
    }

    animalsPlace(R, [[17, 8], [28, 20], [10, 26], [24, 29], [20, 15]]);
    if (regionId === "africa" && window.PO_BONUS && PO_BONUS.honeybadger) {
      spawnAnimal(PO_BONUS.honeybadger, 14.5, 22.5, true);
    }
    if (regionId === "mountains" && window.PO_BONUS && PO_BONUS.lynx) {
      spawnAnimal(PO_BONUS.lynx, 26.5, 14.5, true);
    }
    if (regionId === "jungle" && window.PO_BONUS && PO_BONUS.ocelot) {
      spawnAnimal(PO_BONUS.ocelot, 12.5, 24.5, true);
    }
    placeFieldNotes(regionId);
    // Track/scat props near animals
    sprites.filter(function (s) { return s.kind === "animal"; }).forEach(function (a) {
      if (Math.random() > 0.55) return;
      const tx = a.x + (Math.random() - 0.5) * 2.2;
      const ty = a.y + (Math.random() - 0.5) * 2.2;
      if (!openSpot(tx, ty)) return;
      sprites.push({
        x: tx, y: ty, kind: "prop", prop: "grass",
        scale: worldScale("grass") * 0.55, bob: 0, track: true
      });
    });

    player.x = 4.5;
    player.y = 4.5;
    player.dir = 0.4;
    player.pitch = 0;
    player.bob = 0;
    rebuildMiniBase();
    syncNotesUI();
  }

  function spawnAnimal(a, x, y, rare) {
    x = clamp(x, 2, MAP - 3);
    y = clamp(y, 2, MAP - 3);
    const waterLove = !!(a.waterLove || a.id === "croc" || a.id === "hippo" || a.id === "anaconda");
    if (waterLove) {
      for (let t = 0; t < 50; t++) {
        const tx = 2 + rnd(MAP - 4) + 0.5, ty = 2 + rnd(MAP - 4) + 0.5;
        if (!wall[ty | 0][tx | 0] && floor[ty | 0][tx | 0] === 3) { x = tx; y = ty; break; }
      }
    } else if (wall[y | 0][x | 0] || floor[y | 0][x | 0] === 3) {
      for (let t = 0; t < 60; t++) {
        const tx = 2 + rnd(MAP - 4) + 0.5, ty = 2 + rnd(MAP - 4) + 0.5;
        if (!wall[ty | 0][tx | 0] && floor[ty | 0][tx | 0] !== 3) { x = tx; y = ty; break; }
      }
    }
    sprites.push({
      x: x, y: y, kind: "animal", data: a, id: a.id,
      scale: worldScale(a.id), bob: 0, animT: Math.random() * 10,
      gait: Math.random() * Math.PI * 2,
      vx: 0, vy: 0, walkT: 0.5 + Math.random() * 2, face: 1,
      waterLove: waterLove,
      behavior: a.behavior || "apex",
      speed: a.speed || 0.55,
      fleeDist: a.fleeDist || 0,
      aggroDist: a.aggroDist || 0,
      packId: a.packId || null,
      idleBob: a.idleBob || 0.2,
      rare: !!rare,
      alertT: 0,
      alertCd: 1 + Math.random() * 2
    });
  }

  function animalsPlace(R, spots) {
    R.animals.forEach(function (a, i) {
      let x = spots[i] ? spots[i][0] + 0.5 : (a.x / 64) * MAP;
      let y = spots[i] ? spots[i][1] + 0.5 : (a.y / 40) * MAP;
      spawnAnimal(a, x, y, false);
    });
  }

  function placeFieldNotes(regionId) {
    const lines = {
      africa: [
        "Dust swirls around acacia thorns — pride country.",
        "Mud slide marks the bank: hippo highway at night.",
        "Buffalo dung piles steam in the morning light.",
        "Rhino midden — a territorial scent bulletin board.",
        "Croc belly-drag grooves vanish into opaque water.",
        "Baobab shade holds cool air like a secret room.",
        "Kopje rock still warm from the noon sun.",
        "Honey badger dig! Loose dirt and bee-wax crumbs."
      ],
      mountains: [
        "Pine needles carpet a quiet game trail.",
        "Snow crust broken by heavy bear pads.",
        "Wolf scat packed with fur and bone chips.",
        "Cougar scrape under a wind-bent pine.",
        "Eagle feather stuck in alpine scrub.",
        "Snow leopard prints ghost across the ridge.",
        "Ice wind sings through the overlook rocks.",
        "Trail cairn marks the safer descent."
      ],
      jungle: [
        "Jaguar pugmark pressed into river clay.",
        "Anaconda belly track across wet ferns.",
        "Gorilla knuckle prints on the muddy path.",
        "Tiger claw rake high on a trunk.",
        "Leopard scent tree — bark polished smooth.",
        "Canopy gap spills a shaft of green light.",
        "Drip drip drip — mist beads on every leaf.",
        "Broken ferns show a heavy body passed at dawn."
      ]
    };
    const list = lines[regionId] || lines.africa;
    notesTotal = list.length;
    notesFound = [];
    let placed = 0;
    for (let i = 0; i < list.length; i++) {
      for (let tries = 0; tries < 50; tries++) {
        const x = 3 + Math.random() * (MAP - 6);
        const y = 3 + Math.random() * (MAP - 6);
        if (wall[y | 0][x | 0] || floor[y | 0][x | 0] === 3) continue;
        if (Math.hypot(x - 4.5, y - 4.5) < 3) continue;
        sprites.push({
          x: x, y: y, kind: "note", noteId: regionId + "-" + i,
          text: list[i], scale: 0.35, bob: Math.random() * 6, taken: false
        });
        placed++;
        break;
      }
    }
    notesTotal = placed;
    // Print trails from camp toward each note
    sprites.filter(function (s) { return s.kind === "note"; }).forEach(function (note) {
      const steps = 5 + rnd(3);
      for (let s = 1; s <= steps; s++) {
        const u = s / (steps + 1);
        const tx = 4.5 + (note.x - 4.5) * u + (Math.random() - 0.5) * 0.35;
        const ty = 4.5 + (note.y - 4.5) * u + (Math.random() - 0.5) * 0.35;
        if (wall[ty | 0] && wall[ty | 0][tx | 0]) continue;
        if (floor[ty | 0] && floor[ty | 0][tx | 0] === 3) continue;
        sprites.push({
          x: tx, y: ty, kind: "prop", prop: "grass",
          scale: worldScale("grass") * 0.35, bob: 0, track: true
        });
      }
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

  function solidPropRadius(sp) {
    if (!sp || sp.kind !== "prop") return 0;
    const p = sp.prop || "";
    if (p === "grass" || p === "fern" || p === "bush" || sp.track) return 0;
    if (p === "acacia" || p === "baobab" || p === "pine" || p === "tree") return 0.42;
    if (p === "wallafrica" || p === "walljungle" || p === "wallmountains") return 0.55;
    if (p === "rock" || p === "snowrock") return 0.38;
    return 0.28;
  }
  function propBlocked(x, y) {
    for (let i = 0; i < sprites.length; i++) {
      const sp = sprites[i];
      const rad = solidPropRadius(sp);
      if (!rad) continue;
      if (Math.hypot(x - sp.x, y - sp.y) < rad) return true;
    }
    return false;
  }
  function playerBlocked(x, y) {
    // Water is wadeable (slowed in movePlayer); only walls/props block hard
    return blocked(x, y) || propBlocked(x, y);
  }

  function animalBlocked(x, y, sp) {
    if (blocked(x, y) || propBlocked(x, y)) return true;
    if (sp && sp.waterLove) return false;
    return wet(x, y);
  }

  function retargetAnimal(sp) {
    const dx = player.x - sp.x, dy = player.y - sp.y;
    const dist = Math.hypot(dx, dy) || 0.001;
    let ang = Math.random() * Math.PI * 2;
    let spd = (sp.speed || 0.55) * (0.75 + Math.random() * 0.5);

    if (sp.fleeDist > 0 && dist < sp.fleeDist) {
      ang = Math.atan2(sp.y - player.y, sp.x - player.x) + (Math.random() - 0.5) * 0.6;
      spd *= 1.35;
    } else if (sp.behavior === "ambush" && sp.aggroDist > 0 && dist < sp.aggroDist && dist > 1.2) {
      ang = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.4;
      spd *= 0.85;
    } else if (sp.behavior === "apex" && sp.aggroDist > 0 && dist < sp.aggroDist * 0.7) {
      ang = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.8;
    } else if (sp.packId) {
      let sx = 0, sy = 0, n = 0;
      for (let i = 0; i < sprites.length; i++) {
        const o = sprites[i];
        if (o.kind !== "animal" || o === sp || o.packId !== sp.packId) continue;
        sx += o.x; sy += o.y; n++;
      }
      if (n) {
        const cx = sx / n, cy = sy / n;
        const pd = Math.hypot(cx - sp.x, cy - sp.y);
        if (pd > 3.5) ang = Math.atan2(cy - sp.y, cx - sp.x);
      }
    }

    if (sp.waterLove) {
      for (let t = 0; t < 10; t++) {
        const a = Math.random() * Math.PI * 2;
        const tx = sp.x + Math.cos(a) * 3, ty = sp.y + Math.sin(a) * 3;
        if (wet(tx, ty) || nearCell(tx | 0, ty | 0, function (nx, ny) { return floor[ny][nx] === 3; })) {
          ang = a;
          break;
        }
      }
    }
    if (sp.behavior === "soar") {
      spd *= 1.15;
      ang += (Math.random() - 0.5) * 1.2;
    }
    sp.vx = Math.cos(ang) * spd;
    sp.vy = Math.sin(ang) * spd;
    sp.walkT = 1.4 + Math.random() * 2.2;
    if (Math.abs(sp.vx) > 0.05) sp.face = sp.vx < 0 ? -1 : 1;
  }

  function moveAnimals(dt) {
    for (let i = 0; i < sprites.length; i++) {
      const sp = sprites[i];
      if (sp.kind !== "animal") continue;
      sp.animT = (sp.animT || 0) + dt;
      sp.walkT -= dt;
      if (sp.walkT <= 0) retargetAnimal(sp);
      const spd = Math.hypot(sp.vx, sp.vy);
      const moving = spd > 0.08;
      const hz = GAIT_HZ[sp.id] || 2.8;
      if (moving) sp.gait = (sp.gait || 0) + dt * hz * Math.PI * 2 * clamp(spd / 0.7, 0.55, 1.35);
      else sp.gait = (sp.gait || 0) + dt * 1.2;
      const stride = Math.sin(sp.gait);
      const plant = Math.abs(Math.cos(sp.gait));
      if (sp.behavior === "soar") {
        sp.bob = Math.sin(sp.animT * 5.5) * 0.55 + stride * 0.12;
        sp.lean = Math.sin(sp.animT * 2.2) * 0.04;
        sp.squash = 1 + Math.sin(sp.animT * 6) * 0.04;
      } else {
        sp.bob = (moving ? stride * 0.28 * plant : Math.sin(sp.animT * 2) * (sp.idleBob || 0.15));
        sp.lean = moving ? stride * 0.07 : 0;
        sp.squash = moving ? (0.94 + plant * 0.1) : 1;
      }
      sp.walkFrame = moving ? ((sp.gait / (Math.PI / 2)) | 0) : 0;
      const pdist = Math.hypot(player.x - sp.x, player.y - sp.y);
      if (sp.alertT > 0) sp.alertT -= dt;
      sp.alertCd = (sp.alertCd || 0) - dt;
      if (pdist < 4.2 && sp.alertCd <= 0 && mode === "explore") {
        sp.alertT = 1.4;
        sp.alertCd = 5 + Math.random() * 4;
        animalReact(sp);
      }
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

  function tryPickupNotes() {
    for (let i = 0; i < sprites.length; i++) {
      const sp = sprites[i];
      if (sp.kind !== "note" || sp.taken) continue;
      if (Math.hypot(sp.x - player.x, sp.y - player.y) > 1.35) continue;
      sp.taken = true;
      notesFound.push({ id: sp.noteId, text: sp.text });
      noteFlash = 1.8;
      blip(660, 0.1, "triangle");
      syncNotesUI();
      persistProgress();
      syncObjectives();
      const allDone = notesFound.length >= notesTotal && notesTotal > 0;
      openFieldNote(sp.text, notesFound.length, notesTotal, allDone);
      return;
    }
  }

  function openFieldNote(text, found, total, allDone) {
    if (!ui.note) return;
    if (mode === "dossier") closeDossier();
    if (mode === "log") closeLog();
    notePendingLog = !!allDone;
    if (ui.noteMeta) {
      ui.noteMeta.textContent = (region ? region.name : "EXPEDITION") +
        " · note " + found + " of " + total;
    }
    if (ui.noteBody) ui.noteBody.textContent = text;
    if (ui.noteFoot) {
      ui.noteFoot.textContent = allDone
        ? "All notes recovered — close to open the expedition log"
        : "Press × or Esc to continue exploring";
    }
    ui.note.classList.add("show");
    mode = "note";
    clearInput();
    syncTouchUI();
    blip(520, 0.1, "sine");
  }

  function closeFieldNote() {
    if (ui.note) ui.note.classList.remove("show");
    const openLog = notePendingLog;
    notePendingLog = false;
    if (mode === "note") mode = "explore";
    clearInput();
    syncTouchUI();
    syncObjectives();
    if (openLog) openExpeditionLog();
  }

  function openExpeditionLog() {
    if (!ui.log || !ui.logBody) return;
    if (mode === "dossier") closeDossier();
    if (mode === "note") {
      if (ui.note) ui.note.classList.remove("show");
      notePendingLog = false;
    }
    ui.logBody.innerHTML = "<p><b>" + (region ? region.name : "EXPEDITION") + "</b> — " +
      notesFound.length + "/" + notesTotal + " field notes recovered.</p>" +
      notesFound.map(function (n, i) {
        return "<p>" + (i + 1) + ". " + n.text + "</p>";
      }).join("");
    ui.log.classList.add("show");
    mode = "log";
    clearInput();
    syncTouchUI();
    blip(520, 0.12, "sine");
  }

  function closeLog() {
    if (ui.log) ui.log.classList.remove("show");
    if (mode === "log") mode = "explore";
    clearInput();
    syncTouchUI();
  }

  function movePlayer(dt) {
    let turn = 0, fwd = 0, strafe = 0, pitchIn = 0;
    if (keys.ArrowLeft || keys.q || keys.Q) turn -= 1;
    if (keys.ArrowRight || keys.e || keys.E) turn += 1;
    if (keys.w || keys.W) fwd += 1;
    if (keys.s || keys.S) fwd -= 1;
    if (keys.a || keys.A) strafe -= 1;
    if (keys.d || keys.D) strafe += 1;
    if (keys.ArrowUp || keys.r || keys.R || keys.i || keys.I) pitchIn += 1;
    if (keys.ArrowDown || keys.f || keys.F || keys.k || keys.K) pitchIn -= 1;
    fwd += pad.fwd;
    strafe += pad.strafe;
    turn += pad.turn;
    pitchIn += pad.pitch;
    fwd = clamp(fwd, -1, 1);
    strafe = clamp(strafe, -1, 1);
    turn = clamp(turn, -1, 1);
    pitchIn = clamp(pitchIn, -1, 1);
    player.dir += turn * 2.4 * dt;
    player.pitch = clamp(player.pitch + pitchIn * 1.35 * dt, -0.58, 0.58);
    const c = Math.cos(player.dir), s = Math.sin(player.dir);
    let spMul = 1;
    if (wet(player.x, player.y)) spMul *= 0.48;
    if (weather.kind) spMul *= 0.78;
    const sp = 2.6 * spMul * dt;
    const mx = (c * fwd + -s * strafe) * sp;
    const my = (s * fwd + c * strafe) * sp;
    if (!playerBlocked(player.x + mx * 3.2, player.y)) player.x += mx;
    if (!playerBlocked(player.x, player.y + my * 3.2)) player.y += my;
    player.x = clamp(player.x, 1.5, MAP - 1.5);
    player.y = clamp(player.y, 1.5, MAP - 1.5);
    if (fwd || strafe) {
      player.bob += dt * 10;
      footTimer -= dt;
      if (footTimer <= 0) {
        footTimer = 0.28;
        const nearW = nearCell(player.x | 0, player.y | 0, function (nx, ny) { return floor[ny][nx] === 3; });
        footstep(nearW || wet(player.x, player.y));
      }
    }
    tryPickupNotes();
    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i];
      if (Math.hypot(lm.x - player.x, lm.y - player.y) < 2.2) markLandmark(lm.id || lm.label);
    }
  }

  function floorRgbAt(fx, fy, fog) {
    const R = region;
    const phase = dayPhase();
    const mx = fx | 0, my = fy | 0;
    const cell = (mx >= 0 && my >= 0 && mx < MAP && my < MAP) ? floor[my][mx] : 1;
    const n = ((mx * 13 + my * 29) ^ ((fx * 8 | 0) * 7 + (fy * 8 | 0))) & 7;
    let shimmer = 1;
    if (cell === 3) shimmer = 0.88 + 0.12 * Math.sin(t * 4 + fx * 3 + fy * 2);
    if (cell === 2 && R.snow) shimmer = 0.92 + 0.1 * Math.sin(t * 3 + fx * 5 + n);
    fog *= phase.light * shimmer;
    const tex = remoteGround[R.id];
    if (tex && cell !== 3) {
      let u = ((fx * TEX) % TEX + TEX) % TEX | 0;
      let v = ((fy * TEX) % TEX + TEX) % TEX | 0;
      const i = (v * TEX + u) * 4;
      let r = tex.data[i], g = tex.data[i + 1], b = tex.data[i + 2];
      if (cell === 2 || cell === 0) { r = (r * 0.75) | 0; g = (g * 0.7) | 0; b = (b * 0.55) | 0; }
      if (R.id === "jungle" && cell === 2) { r = (r * 0.55) | 0; g = (g * 0.7) | 0; b = (b * 0.55) | 0; }
      return [
        (r * fog * phase.tint[0]) | 0,
        (g * fog * phase.tint[1]) | 0,
        (b * fog * phase.tint[2]) | 0
      ];
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
    const c = hexRgb(hex);
    return [
      (c[0] * fog * grit * phase.tint[0]) | 0,
      (c[1] * fog * grit * phase.tint[1]) | 0,
      (c[2] * fog * grit * phase.tint[2]) | 0
    ];
  }

  let floorID = null;
  function drawSkyFloor() {
    const R = region;
    const phase = dayPhase();
    const bobY = viewBob();
    const horizon = horizonY();
    const skyImg = remoteSky[R.id];
    if (skyImg) {
      const scroll = ((player.dir * 120) % skyImg.width + skyImg.width) % skyImg.width;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(skyImg, -scroll, 0, skyImg.width, horizon);
      ctx.drawImage(skyImg, -scroll + skyImg.width, 0, skyImg.width, horizon);
      ctx.fillStyle = "rgba(" +
        ((phase.tint[0] * 40) | 0) + "," + ((phase.tint[1] * 30) | 0) + "," + ((phase.tint[2] * 50) | 0) + "," +
        (1 - phase.light) * 0.55 + ")";
      ctx.fillRect(0, 0, W, horizon);
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, horizon);
      g.addColorStop(0, shade(R.sky[0], phase.light));
      g.addColorStop(1, shade(R.sky[2] || R.sky[1], phase.light * 0.9));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, horizon);
    }
    if (R.mist) {
      ctx.fillStyle = "rgba(20,50,30," + (0.22 + (1 - phase.light) * 0.2) + ")";
      ctx.fillRect(0, 0, W, horizon);
    }
    const dirX = Math.cos(player.dir), dirY = Math.sin(player.dir);
    const planeX = -dirY * 0.66, planeY = dirX * 0.66;
    const fh = H - horizon;
    if (!floorID || floorID.width !== W || floorID.height !== fh) {
      floorID = new ImageData(W, fh);
    }
    const data = floorID.data;
    const stepX = FLOOR_STEP_X, stepY = FLOOR_STEP_Y;
    for (let y = 0; y < fh; y += stepY) {
      const rowDist = (0.5 * H) / (y + 1);
      const fog = clamp(1 - rowDist / 16, 0.2, 1);
      const Lx = player.x + rowDist * (dirX - planeX);
      const Ly = player.y + rowDist * (dirY - planeY);
      const Rx = player.x + rowDist * (dirX + planeX);
      const Ry = player.y + rowDist * (dirY + planeY);
      for (let x = 0; x < W; x += stepX) {
        const u = x / W;
        const rgb = floorRgbAt(Lx + (Rx - Lx) * u, Ly + (Ry - Ly) * u, fog);
        const r = rgb[0], g = rgb[1], b = rgb[2];
        for (let dy = 0; dy < stepY && y + dy < fh; dy++) {
          const row = (y + dy) * W;
          for (let dx = 0; dx < stepX && x + dx < W; dx++) {
            const i = (row + x + dx) * 4;
            data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
          }
        }
      }
    }
    ctx.putImageData(floorID, 0, horizon);
  }

  function updateParticles(dt) {
    const R = region;
    if (!R) return;
    const want = R.id === "mountains" ? 22 : (R.id === "jungle" ? 16 : 12);
    while (particles.length < want) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * (R.id === "mountains" ? 18 : 10),
        vy: R.id === "mountains" ? (20 + Math.random() * 35) : (R.id === "jungle" ? 25 + Math.random() * 40 : (Math.random() - 0.5) * 12),
        life: 1 + Math.random() * 2,
        kind: R.id
      });
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0 || p.y > H + 4 || p.x < -4 || p.x > W + 4) {
        particles[i] = particles[particles.length - 1];
        particles.pop();
      }
    }
  }

  function drawParticles() {
    const phase = dayPhase();
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const a = clamp(p.life, 0, 1) * 0.55 * phase.light;
      if (p.kind === "mountains") {
        ctx.fillStyle = "rgba(230,240,255," + a + ")";
        ctx.fillRect(p.x | 0, p.y | 0, 2, 2);
      } else if (p.kind === "jungle") {
        ctx.fillStyle = "rgba(140,200,160," + (a * 0.7) + ")";
        ctx.fillRect(p.x | 0, p.y | 0, 1, 3);
      } else {
        ctx.fillStyle = "rgba(210,180,100," + (a * 0.5) + ")";
        ctx.fillRect(p.x | 0, p.y | 0, 2, 1);
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
    wolf: "https://i.postimg.cc/h4LPB230/wolf.jpg",
    // Direct Kenney animal-pack link used for honey badger (no PostImg body art provided)
    honeybadger: "https://res.cloudinary.com/dol86wsz1/image/upload/v1770151649/summer_art/kenney/2d/animal-pack-redux/dog.png",
    lynx: "https://i.postimg.cc/SQ6NhgtL/snowleopard.jpg",
    ocelot: "https://i.postimg.cc/7P3YkKQM/leopard.jpg"
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
    snowrock: "https://i.postimg.cc/vHvDYzX8/snowrock.jpg",
    wallafrica: "https://i.postimg.cc/kXyDJcw5/wall-africa.jpg",
    walljungle: "https://i.postimg.cc/CL4dhNJR/wall-jungle.jpg",
    wallmountains: "https://i.postimg.cc/15K4mHMg/wall-mountains.jpg"
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
  const remoteWalk = {};
  const remoteProps = {};
  const remoteGround = {};
  const remoteSky = {};
  // Local AI walk strips (4 frames) shipped with Pages
  const WALK_SHEETS = {
    lion: "assets/walk/lion.png",
    wolf: "assets/walk/wolf.png",
    buffalo: "assets/walk/buffalo.png",
    tiger: "assets/walk/tiger.png",
    grizzly: "assets/walk/grizzly.png",
    honeybadger: "assets/walk/honeybadger.png",
    gorilla: "assets/walk/gorilla.png",
    croc: "assets/walk/croc.png",
    leopard: "assets/walk/leopard.png",
    jaguar: "assets/walk/jaguar.png",
    snowleopard: "assets/walk/snowleopard.png",
    cougar: "assets/walk/cougar.png",
    hippo: "assets/walk/hippo.png",
    rhino: "assets/walk/rhino.png",
    anaconda: "assets/walk/anaconda.png",
    eagle: "assets/walk/eagle.png",
    lynx: "assets/walk/snowleopard.png",
    ocelot: "assets/walk/leopard.png"
  };

  function makeGaitFrames(src) {
    const poses = [
      { lean: -0.1, squash: 0.93, shift: -3 },
      { lean: 0.02, squash: 1.05, shift: 0 },
      { lean: 0.1, squash: 0.93, shift: 3 },
      { lean: -0.02, squash: 1.03, shift: 0 }
    ];
    const frames = [];
    for (let i = 0; i < poses.length; i++) {
      const p = poses[i];
      const c = document.createElement("canvas");
      c.width = src.width + 12;
      c.height = src.height + 10;
      const g = c.getContext("2d");
      g.imageSmoothingEnabled = true;
      g.translate(c.width / 2 + p.shift, c.height - 2);
      g.transform(1, 0, p.lean, p.squash, 0, 0);
      g.drawImage(src, -src.width / 2, -src.height);
      c._photo = !!src._photo;
      frames.push(c);
    }
    return frames;
  }

  function sliceWalkStrip(img, n) {
    n = n || 4;
    const fw = (img.width / n) | 0;
    const frames = [];
    for (let i = 0; i < n; i++) {
      const c = document.createElement("canvas");
      const tmp = document.createElement("canvas");
      tmp.width = fw; tmp.height = img.height;
      const tctx = tmp.getContext("2d");
      tctx.drawImage(img, i * fw, 0, fw, img.height, 0, 0, fw, img.height);
      frames.push(fitRemoteToCanvas(tmp, "animal"));
    }
    return frames;
  }

  function fitRemoteToCanvas(img, mode) {
    // Props keep foliage greens; animals only punch white/studio backdrops
    const max = mode === "prop" ? 160 : 224;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.max(16, (img.width * scale) | 0);
    const h = Math.max(16, (img.height * scale) | 0);
    const tmp = document.createElement("canvas");
    tmp.width = w; tmp.height = h;
    const tctx = tmp.getContext("2d");
    tctx.imageSmoothingEnabled = true;
    tctx.imageSmoothingQuality = "high";
    tctx.drawImage(img, 0, 0, w, h);
    let minX = 0, minY = 0, maxX = w - 1, maxY = h - 1;
    try {
      const data = tctx.getImageData(0, 0, w, h), px = data.data;
      function sample(ix, iy) {
        const i = (iy * w + ix) * 4;
        return [px[i], px[i + 1], px[i + 2]];
      }
      const corners = [sample(0, 0), sample(w - 1, 0), sample(0, h - 1), sample(w - 1, h - 1)];
      let br = 0, bg = 0, bb = 0;
      for (let c = 0; c < 4; c++) { br += corners[c][0]; bg += corners[c][1]; bb += corners[c][2]; }
      br = (br / 4) | 0; bg = (bg / 4) | 0; bb = (bb / 4) | 0;
      const brightBackdrop = br > 200 && bg > 200 && bb > 200;
      const keyGreen = mode === "animal" && bg > br + 25 && bg > bb + 25 && bg > 140;
      for (let i = 0; i < px.length; i += 4) {
        const r = px[i], g = px[i + 1], b = px[i + 2];
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        // Near-white / paper studio
        if (r > 228 && g > 228 && b > 228 && mx - mn < 28) { px[i + 3] = 0; continue; }
        if (brightBackdrop) {
          const dr = r - br, dg = g - bg, db = b - bb;
          if (dr * dr + dg * dg + db * db < 1100 && mx > 185) { px[i + 3] = 0; continue; }
        }
        // Only animals on green-screen style plates — never props (trees/grass)
        if (keyGreen && g > 155 && g > r * 1.35 && g > b * 1.35 && r < 120 && b < 130) {
          px[i + 3] = 0;
        }
      }
      minX = w; minY = h; maxX = 0; maxY = 0;
      let any = false;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i + 3] > 24) {
          any = true;
          const x = (i / 4) % w, y = (i / 4 / w) | 0;
          if (x < minX) minX = x; if (y < minY) minY = y;
          if (x > maxX) maxX = x; if (y > maxY) maxY = y;
        }
      }
      if (!any) { minX = 0; minY = 0; maxX = w - 1; maxY = h - 1; }
      tctx.putImageData(data, 0, 0);
    } catch (e) {}
    const cw = Math.max(8, maxX - minX + 1), ch = Math.max(8, maxY - minY + 1);
    const off = document.createElement("canvas");
    off.width = cw; off.height = ch;
    const octx = off.getContext("2d");
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = "high";
    octx.drawImage(tmp, minX, minY, cw, ch, 0, 0, cw, ch);
    off._photo = true;
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
        remoteArt[id] = fitRemoteToCanvas(img, "animal");
        if (!remoteWalk[id]) remoteWalk[id] = makeGaitFrames(remoteArt[id]);
        delete propCache["a:" + id];
      });
    });
    Object.keys(WALK_SHEETS).forEach(function (id) {
      loadImg(WALK_SHEETS[id], function (img) {
        remoteWalk[id] = sliceWalkStrip(img, 4);
        delete propCache["a:" + id];
      });
    });
    Object.keys(REMOTE_PROPS).forEach(function (kind) {
      loadImg(REMOTE_PROPS[kind], function (img) {
        remoteProps[kind] = fitRemoteToCanvas(img, "prop");
        delete propCache[kind];
      });
    });
    Object.keys(REMOTE_GROUND).forEach(function (rid) {
      loadImg(REMOTE_GROUND[rid], function (img) {
        const c = document.createElement("canvas");
        c.width = c.height = TEX;
        const g = c.getContext("2d");
        g.imageSmoothingEnabled = true;
        g.drawImage(img, 0, 0, TEX, TEX);
        remoteGround[rid] = g.getImageData(0, 0, TEX, TEX);
      });
    });
    Object.keys(REMOTE_SKY).forEach(function (rid) {
      loadImg(REMOTE_SKY[rid], function (img) {
        const c = document.createElement("canvas");
        c.width = W;
        c.height = Math.ceil(H * 0.55);
        const g = c.getContext("2d");
        g.imageSmoothingEnabled = true;
        g.drawImage(img, 0, 0, c.width, c.height);
        remoteSky[rid] = c;
      });
    });
  }

  function getPropCanvas(prop) {
    if (remoteProps[prop]) return remoteProps[prop];
    if (propCache[prop]) return propCache[prop];
    const off = document.createElement("canvas");
    off.width = off.height = 96;
    const octx = off.getContext("2d");
    octx.imageSmoothingEnabled = false;
    drawPropBillboard(octx, prop, 96);
    propCache[prop] = off;
    return off;
  }

  function getAnimalCanvas(id, frame) {
    const walk = remoteWalk[id];
    if (walk && walk.length) {
      const fi = ((frame % walk.length) + walk.length) % walk.length;
      return walk[fi];
    }
    if (remoteArt[id]) return remoteArt[id];
    const key = "a:" + id;
    if (propCache[key]) return propCache[key];
    const sz = PO_SPRITES.spriteSize(id, 5);
    const off = document.createElement("canvas");
    off.width = Math.max(64, sz.w + 12);
    off.height = Math.max(64, sz.h + 18);
    const octx = off.getContext("2d");
    octx.imageSmoothingEnabled = false;
    octx.fillStyle = "rgba(0,0,0,0.35)";
    octx.beginPath();
    octx.ellipse(off.width / 2, off.height - 6, off.width * 0.28, 5, 0, 0, Math.PI * 2);
    octx.fill();
    PO_SPRITES.drawSprite(octx, id, 6, 3, 5, 0);
    propCache[key] = off;
    return off;
  }

  function getNoteCanvas() {
    if (propCache.note) return propCache.note;
    const off = document.createElement("canvas");
    off.width = 72;
    off.height = 96;
    const c = off.getContext("2d");
    c.imageSmoothingEnabled = false;
    // ground glow
    c.fillStyle = "rgba(70, 200, 110, 0.4)";
    c.beginPath();
    c.ellipse(36, 88, 24, 7, 0, 0, Math.PI * 2);
    c.fill();
    // notebook body
    c.fillStyle = "#dcc896";
    c.fillRect(16, 10, 42, 58);
    c.fillStyle = "#c9b078";
    c.fillRect(16, 10, 8, 58);
    c.strokeStyle = "#6a4a22";
    c.lineWidth = 2;
    c.strokeRect(16, 10, 42, 58);
    // page lines
    c.strokeStyle = "rgba(90, 60, 30, 0.4)";
    c.lineWidth = 1;
    for (let y = 24; y < 60; y += 8) {
      c.beginPath();
      c.moveTo(28, y);
      c.lineTo(52, y);
      c.stroke();
    }
    // green field-note seal
    c.fillStyle = "#1f7a3e";
    c.beginPath();
    c.arc(37, 30, 9, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#e8ffe8";
    c.font = "bold 11px monospace";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("N", 37, 31);
    // folded corner
    c.fillStyle = "#b9a06a";
    c.beginPath();
    c.moveTo(50, 10);
    c.lineTo(58, 10);
    c.lineTo(58, 18);
    c.closePath();
    c.fill();
    propCache.note = off;
    return off;
  }

  function drawSprites() {
    const bobY = viewBob();
    const pitch = pitchPx();
    const phase = dayPhase();
    const labelDist = phase.name === "night" ? 3.2 : 5.5;
    const dirX = Math.cos(player.dir), dirY = Math.sin(player.dir);
    const planeX = -dirY * 0.66, planeY = dirX * 0.66;
    const list = sprites.map(function (sp) {
      if (sp.kind === "note" && sp.taken) return null;
      const dx = sp.x - player.x, dy = sp.y - player.y;
      return { sp: sp, dist: dx * dx + dy * dy };
    }).filter(Boolean).sort(function (a, b) { return b.dist - a.dist; });

    drawSprites._screen = [];
    for (let i = 0; i < list.length; i++) {
      const sp = list[i].sp;
      const spriteX = sp.x - player.x;
      const spriteY = sp.y - player.y;
      const invDet = 1 / (planeX * dirY - dirX * planeY);
      const transformX = invDet * (dirY * spriteX - dirX * spriteY);
      const transformY = invDet * (-planeY * spriteX + planeX * spriteY);
      if (transformY <= 0.15 || transformY > 22) continue;
      const spriteScreenX = ((W / 2) * (1 + transformX / transformY)) | 0;
      let sc = sp.scale || worldScale(sp.id || sp.prop);
      if (sp.kind === "note") sc = 0.55;
      if (sp.behavior === "soar") sc *= 1.05;
      if (sp.kind === "animal" && sp.squash) sc *= sp.squash;
      if (sp.kind === "animal" && transformY < 5.5) sc *= 1.1;
      const bobOff = (sp.bob || 0) * (10 / Math.max(0.6, transformY));
      let spriteH = Math.abs((H / transformY) * sc) | 0;
      if (sp.kind === "note") spriteH = Math.max(18, spriteH);
      if (spriteH < 3) continue;

      const walkFr = sp.kind === "animal" ? (sp.walkFrame || 0) : 0;
      const img = sp.kind === "note" ? getNoteCanvas()
        : (sp.kind === "animal" ? getAnimalCanvas(sp.id, walkFr) : getPropCanvas(sp.prop));
      let spriteW = Math.max(4, (spriteH * (img.width / img.height)) | 0);
      if (sp.kind === "animal" && sp.lean) spriteW = Math.max(4, (spriteW * (1 + Math.abs(sp.lean) * 0.35)) | 0);
      const floorY = (H / 2 + bobY + pitch + (H * 0.5) / transformY) | 0;
      const floatY = sp.kind === "note" ? ((Math.sin(t * 3 + sp.bob) * 4) | 0) : 0;
      const leanX = sp.kind === "animal" ? ((sp.lean || 0) * spriteW * 0.35) | 0 : 0;
      const drawStartY = floorY - spriteH - (bobOff | 0) + floatY;
      const drawStartX = (-spriteW / 2 + spriteScreenX + leanX) | 0;
      const drawEndX = drawStartX + spriteW;
      if (drawEndX < 0 || drawStartX >= W || drawStartY >= H || drawStartY + spriteH < 0) continue;
      const flip = sp.kind === "animal" && sp.face < 0;
      const fogA = clamp(1.15 - transformY / 20, 0.4, 1);
      ctx.save();
      ctx.globalAlpha = fogA;
      if (sp.kind === "note") {
        const pulse = 0.35 + 0.25 * Math.sin(t * 4 + sp.bob);
        ctx.fillStyle = "rgba(93,206,122," + pulse + ")";
        ctx.beginPath();
        ctx.ellipse(spriteScreenX, floorY - 2, spriteW * 0.55, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (sp.track) {
        const tw = Math.max(4, spriteW * 0.45);
        const th = Math.max(2, spriteH * 0.12);
        ctx.fillStyle = "rgba(40,28,12,0.55)";
        ctx.beginPath();
        ctx.ellipse(spriteScreenX - tw * 0.35, floorY - 1, tw * 0.45, th, -0.25, 0, Math.PI * 2);
        ctx.ellipse(spriteScreenX + tw * 0.35, floorY - 1, tw * 0.45, th, 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        continue;
      }
      ctx.imageSmoothingEnabled = !!(img._photo) || sp.kind === "note" || (sp.kind === "animal" && transformY < 6);
      ctx.imageSmoothingQuality = (sp.kind === "animal" && transformY < 5.5) ? "high" : "medium";
      if (flip) {
        ctx.translate(drawStartX + spriteW, drawStartY);
        ctx.scale(-1, 1);
        if (sp.kind === "animal" && sp.lean) ctx.transform(1, 0, sp.lean * 0.5, 1, 0, 0);
        ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, spriteW, spriteH);
      } else {
        if (sp.kind === "animal" && sp.lean) {
          ctx.translate(drawStartX + spriteW / 2, drawStartY + spriteH);
          ctx.transform(1, 0, sp.lean * 0.5, 1, 0, 0);
          ctx.drawImage(img, 0, 0, img.width, img.height, -spriteW / 2, -spriteH, spriteW, spriteH);
        } else {
          ctx.drawImage(img, 0, 0, img.width, img.height, drawStartX, drawStartY, spriteW, spriteH);
        }
      }
      ctx.restore();

      if (sp.kind === "note") {
        if (transformY < 7) {
          ctx.fillStyle = "rgba(4,20,10,0.82)";
          ctx.fillRect(spriteScreenX - 34, drawStartY - 14, 68, 12);
          ctx.fillStyle = "#8dffb0";
          ctx.font = "11px monospace";
          ctx.textAlign = "center";
          ctx.fillText("FIELD NOTE", spriteScreenX, drawStartY - 5);
          ctx.textAlign = "left";
        }
        continue;
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
        if (transformY < labelDist) {
          ctx.fillStyle = "rgba(4,20,10,0.75)";
          const label = (sp.rare ? "★ " : "") + sp.data.name + " · tap";
          const lw = Math.min(110, 8 + label.length * 5);
          ctx.fillRect(spriteScreenX - lw / 2, drawStartY - 14, lw, 11);
          ctx.fillStyle = sp.rare ? "#e8c86a" : "#5dce7a";
          ctx.font = "11px monospace";
          ctx.textAlign = "center";
          ctx.fillText(label, spriteScreenX, drawStartY - 6);
          ctx.textAlign = "left";
        }
        if (sp.alertT > 0) {
          ctx.fillStyle = "rgba(255,220,80," + clamp(sp.alertT, 0, 1) + ")";
          ctx.font = "bold 18px monospace";
          ctx.textAlign = "center";
          ctx.fillText("!", spriteScreenX, drawStartY - 18);
          ctx.textAlign = "left";
        }
      }
    }

    // Landmark labels when near
    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i];
      const dx = lm.x - player.x, dy = lm.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 7 || dist < 0.2) continue;
      const invDet = 1 / (planeX * dirY - dirX * planeY);
      const transformX = invDet * (dirY * dx - dirX * dy);
      const transformY = invDet * (-planeY * dx + planeX * dy);
      if (transformY <= 0.2) continue;
      const sx = ((W / 2) * (1 + transformX / transformY)) | 0;
      const sy = (H / 2 + bobY + pitchPx() - 20 / transformY) | 0;
      ctx.fillStyle = "rgba(4,20,10,0.8)";
      ctx.fillRect(sx - 48, sy - 8, 96, 12);
      ctx.fillStyle = "#9ec9ad";
      ctx.font = "11px monospace";
      ctx.textAlign = "center";
      ctx.fillText(lm.label, sx, sy + 2);
      ctx.textAlign = "left";
    }
  }

  function drawHUDOverlay() {
    const phase = dayPhase();
    ctx.strokeStyle = "rgba(93,206,122,0.7)";
    ctx.beginPath();
    ctx.moveTo(W / 2 - 8, H / 2);
    ctx.lineTo(W / 2 + 8, H / 2);
    ctx.moveTo(W / 2, H / 2 - 8);
    ctx.lineTo(W / 2, H / 2 + 8);
    ctx.stroke();
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.8);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0," + (0.35 + (1 - phase.light) * 0.35) + ")");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
    if (phase.name === "night" || phase.name === "dusk") {
      const lg = ctx.createRadialGradient(W / 2, H * 0.58, 16, W / 2, H * 0.55, H * 0.62);
      lg.addColorStop(0, "rgba(255,210,130," + (phase.name === "night" ? 0.16 : 0.08) + ")");
      lg.addColorStop(0.4, "rgba(255,150,60,0.05)");
      lg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = lg;
      ctx.fillRect(0, 0, W, H);
    }
    drawWayPings();
    const ms = 2, msz = MAP * ms;
    const ox = W - msz - 6, oy = 6;
    ctx.fillStyle = "rgba(2,12,6,0.85)";
    ctx.fillRect(ox - 3, oy - 3, msz + 6, msz + 6);
    ctx.strokeStyle = "#2d6b45";
    ctx.lineWidth = 1;
    ctx.strokeRect(ox - 3.5, oy - 3.5, msz + 6, msz + 6);
    if (miniBase) ctx.drawImage(miniBase, ox, oy);
    sprites.forEach(function (sp) {
      if (sp.kind === "note" && !sp.taken) {
        ctx.fillStyle = "#5dce7a";
        ctx.fillRect((ox + sp.x * ms) | 0, (oy + sp.y * ms) | 0, 2, 2);
        return;
      }
      if (sp.kind !== "animal") return;
      const px = ox + sp.x * ms, py = oy + sp.y * ms;
      ctx.fillStyle = sp.data.color || "#c9a227";
      ctx.fillRect((px - 1) | 0, (py - 1) | 0, 2, 2);
    });
    landmarks.forEach(function (lm) {
      if (landmarksVisited[lm.id || lm.label]) return;
      ctx.fillStyle = "#e8c86a";
      ctx.fillRect((ox + lm.x * ms) | 0, (oy + lm.y * ms) | 0, 2, 2);
    });
    const ppx = ox + player.x * ms, ppy = oy + player.y * ms;
    ctx.fillStyle = "#5dce7a";
    ctx.beginPath();
    ctx.moveTo(ppx + Math.cos(player.dir) * 4, ppy + Math.sin(player.dir) * 4);
    ctx.lineTo(ppx + Math.cos(player.dir + 2.4) * 2.5, ppy + Math.sin(player.dir + 2.4) * 2.5);
    ctx.lineTo(ppx + Math.cos(player.dir - 2.4) * 2.5, ppy + Math.sin(player.dir - 2.4) * 2.5);
    ctx.fill();
    ctx.fillStyle = "rgba(4,20,10,0.85)";
    ctx.fillRect(ox - 3, oy + msz + 4, msz + 6, 10);
    ctx.fillStyle = "#9ec9ad";
    ctx.font = "7px monospace";
    ctx.textAlign = "center";
    ctx.fillText(phase.name.toUpperCase(), ox + msz / 2, oy + msz + 11);
    ctx.textAlign = "left";
  }

  function drawWayPings() {
    const dirX = Math.cos(player.dir), dirY = Math.sin(player.dir);
    const planeX = -dirY * 0.66, planeY = dirX * 0.66;
    function ping(wx, wy, col, tag) {
      const spriteX = wx - player.x, spriteY = wy - player.y;
      const invDet = 1 / (planeX * dirY - dirX * planeY);
      const transformX = invDet * (dirY * spriteX - dirX * spriteY);
      const transformY = invDet * (-planeY * spriteX + planeX * spriteY);
      let sx, sy;
      if (transformY > 0.2) {
        sx = (W / 2) * (1 + transformX / transformY);
        sy = H / 2 + pitchPx() - 18 / transformY;
        if (sx > 24 && sx < W - 24 && sy > 24 && sy < H - 24) return;
      }
      const ang = Math.atan2(spriteY, spriteX) - player.dir;
      const edge = Math.min(W, H) * 0.42;
      sx = W / 2 + Math.sin(ang) * edge;
      sy = H / 2 - Math.cos(ang) * edge * 0.55 + pitchPx() * 0.25;
      sx = clamp(sx, 18, W - 18);
      sy = clamp(sy, 18, H - 18);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 7);
      ctx.lineTo(sx + 6, sy + 5);
      ctx.lineTo(sx - 6, sy + 5);
      ctx.fill();
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      ctx.fillText(tag, sx, sy + 16);
      ctx.textAlign = "left";
    }
    let bestNote = null, bestNd = 1e9;
    sprites.forEach(function (sp) {
      if (sp.kind !== "note" || sp.taken) return;
      const d = Math.hypot(sp.x - player.x, sp.y - player.y);
      if (d < bestNd) { bestNd = d; bestNote = sp; }
    });
    if (bestNote) ping(bestNote.x, bestNote.y, "rgba(93,206,122,0.95)", "NOTE");
    let bestLm = null, bestLd = 1e9;
    landmarks.forEach(function (lm) {
      if (landmarksVisited[lm.id || lm.label]) return;
      const d = Math.hypot(lm.x - player.x, lm.y - player.y);
      if (d < bestLd) { bestLd = d; bestLm = lm; }
    });
    if (bestLm) ping(bestLm.x, bestLm.y, "rgba(232,200,106,0.95)", "SITE");
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

  function animalReact(sp) {
    const ctxA = ensureAudio();
    if (!ctxA || muted) return;
    sfxGain();
    const o = ctxA.createOscillator();
    const g = ctxA.createGain();
    o.type = sp.behavior === "soar" ? "sine" : "sawtooth";
    o.frequency.value = sp.behavior === "soar" ? 900 : (120 + Math.random() * 80);
    g.gain.value = 0.0001;
    o.connect(g); g.connect(masterGain);
    const now = ctxA.currentTime;
    g.gain.exponentialRampToValueAtTime(0.06, now + 0.02);
    o.frequency.exponentialRampToValueAtTime(o.frequency.value * 0.7, now + 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    o.start(now); o.stop(now + 0.3);
  }

  function updateWeather(dt) {
    if (!region || reduceMotion) {
      weather.kind = null; weather.t = 0; return;
    }
    if (weather.t > 0) {
      weather.t -= dt;
      if (weather.t <= 0) { weather.kind = null; weather.next = 28 + Math.random() * 35; }
      return;
    }
    weather.next -= dt;
    if (weather.next > 0) return;
    weather.kind = region.id === "africa" ? "dust" : (region.id === "mountains" ? "snow" : "rain");
    weather.t = 7 + Math.random() * 7;
    if (ui.hint && mode === "explore") {
      ui.hint.textContent = weather.kind === "dust" ? "Dust storm rolling in…"
        : (weather.kind === "snow" ? "Snow squall on the ridge…" : "Canopy rain starting…");
    }
  }

  function drawWeather() {
    if (!weather.kind || reduceMotion) return;
    const a = clamp(weather.t / 2, 0, 1) * 0.35;
    if (weather.kind === "dust") {
      ctx.fillStyle = "rgba(180,140,70," + (0.12 + a * 0.25) + ")";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(210,170,90,0.35)";
      for (let i = 0; i < 40; i++) {
        const x = ((t * 90 + i * 47) % (W + 40)) - 20;
        const y = (i * 53 + t * 30) % H;
        ctx.fillRect(x | 0, y | 0, 3, 1);
      }
    } else if (weather.kind === "snow") {
      ctx.fillStyle = "rgba(200,220,255," + (0.1 + a * 0.2) + ")";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(240,248,255,0.85)";
      for (let i = 0; i < 55; i++) {
        const x = (i * 41 + t * 40) % W;
        const y = (i * 73 + t * 70) % H;
        ctx.fillRect(x | 0, y | 0, 2, 2);
      }
    } else {
      ctx.fillStyle = "rgba(30,50,40," + (0.12 + a * 0.2) + ")";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(160,200,180,0.35)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 50; i++) {
        const x = (i * 37 + t * 180) % W;
        const y = (i * 59 + t * 260) % H;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y + 10); ctx.stroke();
      }
    }
  }

  function openJournal() {
    if (!ui.journal) return;
    if (mode === "dossier") closeDossier();
    if (mode === "note") { notePendingLog = false; if (ui.note) ui.note.classList.remove("show"); }
    const s = loadSave();
    if (ui.journalMeta) ui.journalMeta.textContent = (region ? region.name : "EXPEDITION") + " · field journal";
    let html = "";
    html += "<h3>NOTES</h3><ul>";
    if (!notesFound.length) html += "<li>No field notes yet — follow the print trails.</li>";
    notesFound.forEach(function (n, i) { html += "<li>✓ " + (i + 1) + ". " + n.text + "</li>"; });
    html += "</ul><h3>LANDMARKS</h3><ul>";
    const lms = Object.keys(landmarksVisited);
    if (!lms.length) html += "<li>No landmarks logged yet.</li>";
    lms.forEach(function (id) { html += "<li>✓ " + id + "</li>"; });
    html += "</ul><h3>SIGHTINGS</h3><ul>";
    const seen = Object.keys(animalsSeen);
    if (!seen.length) html += "<li>No dossiers opened yet.</li>";
    seen.forEach(function (id) { html += "<li>✓ " + id + "</li>"; });
    html += "</ul><h3>PHOTOS</h3>";
    if (!photoShots.length) html += "<p>Press PHOTO or P to snap a sighting.</p>";
    else {
      photoShots.forEach(function (src) {
        html += "<img class=\"shot\" src=\"" + src + "\" alt=\"sighting\">";
      });
    }
    const stamp = s.regions[region ? region.id : ""] && s.regions[region.id].complete;
    if (stamp) html += "<p><b>REGION CLEARED</b> — stamp earned on the title map.</p>";
    if (ui.journalBody) ui.journalBody.innerHTML = html;
    ui.journal.classList.add("show");
    mode = "journal";
    clearInput();
    syncTouchUI();
    blip(500, 0.1, "sine");
  }
  function closeJournal() {
    if (ui.journal) ui.journal.classList.remove("show");
    if (mode === "journal") mode = "explore";
    clearInput();
    syncTouchUI();
  }
  function takePhoto() {
    if (mode !== "explore") return;
    try {
      const url = canvas.toDataURL("image/jpeg", 0.7);
      photoShots.unshift(url);
      if (photoShots.length > 12) photoShots.length = 12;
      photoFlashT = 0.18;
      if (ui.photoFlash) { ui.photoFlash.hidden = false; ui.photoFlash.classList.add("on"); }
      blip(880, 0.06, "square");
      persistProgress();
      if (ui.hint) ui.hint.textContent = "Sighting saved to JOURNAL";
    } catch (e) {
      if (ui.hint) ui.hint.textContent = "Photo failed (try again)";
    }
  }

  function drawWorld() {
    drawSkyFloor();
    drawSprites();
    drawParticles();
    drawWeather();
    drawHUDOverlay();
    if (noteFlash > 0) {
      ctx.fillStyle = "rgba(93,206,122," + (noteFlash * 0.15) + ")";
      ctx.fillRect(0, 0, W, H);
    }
    if (photoFlashT > 0 && ui.photoFlash) {
      ui.photoFlash.hidden = false;
      ui.photoFlash.classList.add("on");
    }
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
    pad.pitch = 0;
    if (ui.knob) ui.knob.style.transform = "translate(-50%,-50%)";
    if (ui.lookL) ui.lookL.classList.remove("is-held");
    if (ui.lookR) ui.lookR.classList.remove("is-held");
    if (ui.lookU) ui.lookU.classList.remove("is-held");
    if (ui.lookD) ui.lookD.classList.remove("is-held");
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
    return mode === "explore" || mode === "dossier" || mode === "log" || mode === "note" || mode === "help" || mode === "journal";
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
        ? "FULL SCREEN · Stick · LOOK ▲▼◀▶ · Drag canvas · Tap animals"
        : "Stick · LOOK all ways · Drag to look · NOTES · FULL SCREEN";
    } else if (ui.hint && mode === "explore") {
      ui.hint.textContent = "WASD · Drag look · Tap animal · J journal · P photo · L log · Esc";
    }
    syncFsBtn();
    notifyParentChrome();
  }

  function openDossier(animal) {
    clearInput();
    closeLog();
    if (mode === "note") {
      notePendingLog = false;
      if (ui.note) ui.note.classList.remove("show");
    }
    openAnimal = animal;
    tab = "facts";
    mode = "dossier";
    syncTouchUI();
    ui.dossier.classList.add("show");
    ui.dName.textContent = animal.data.name.toUpperCase();
    ui.dLatin.textContent = animal.data.latin;
    ui.dDanger.textContent = animal.data.danger + (animal.rare ? " · RARE FIND" : "");
    blip(440, 0.08, "sine");
    const dctx = ui.dArt.getContext("2d");
    dctx.imageSmoothingEnabled = false;
    dctx.fillStyle = "#f3e6c4";
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
    markAnimalSeen(animal.id);
    syncObjectives();
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
    closeLog();
    if (ui.note) ui.note.classList.remove("show");
    if (ui.help) ui.help.classList.remove("show");
    notePendingLog = false;
    setPaused(false);
    buildWorld(id);
    restoreRegionProgress(id);
    mode = "explore";
    ui.title.classList.remove("show");
    ui.hud.hidden = false;
    ui.hint.hidden = false;
    if (ui.menuBtn) ui.menuBtn.hidden = false;
    if (ui.obj) ui.obj.hidden = false;
    if (ui.journalBtn) ui.journalBtn.hidden = false;
    if (ui.photoBtn) ui.photoBtn.hidden = false;
    ui.regionChip.textContent = region.name;
    closeDossier();
    clearInput();
    syncNotesUI();
    syncObjectives();
    syncTouchUI();
    playRegionMusic(id);
    persistProgress();
    tryLandscapeFullscreen();
    const s = loadSave();
    if (!s.onboarded) openHelp();
  }

  function showTitle() {
    mode = "title";
    ui.title.classList.add("show");
    ui.hud.hidden = true;
    ui.hint.hidden = true;
    if (ui.obj) ui.obj.hidden = true;
    if (ui.menuBtn) ui.menuBtn.hidden = true;
    if (ui.journalBtn) ui.journalBtn.hidden = true;
    if (ui.photoBtn) ui.photoBtn.hidden = true;
    setPaused(false);
    stopMusic();
    closeDossier();
    closeLog();
    closeJournal();
    if (ui.note) ui.note.classList.remove("show");
    if (ui.help) ui.help.classList.remove("show");
    notePendingLog = false;
    clearInput();
    syncContinueBtn();
    syncRegionStamps();
    syncTouchUI();
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - (loop._last || now)) / 1000);
    loop._last = now;
    if (gamePaused && (mode === "explore" || mode === "dossier" || mode === "log" || mode === "note" || mode === "help" || mode === "journal")) {
      drawWorld();
      requestAnimationFrame(loop);
      return;
    }
    t += dt;
    dayT += dt;
    if (noteFlash > 0) noteFlash = Math.max(0, noteFlash - dt);
    if (photoFlashT > 0) {
      photoFlashT -= dt;
      if (photoFlashT <= 0 && ui.photoFlash) {
        ui.photoFlash.classList.remove("on");
        ui.photoFlash.hidden = true;
      }
    }
    ambientChirpT -= dt;
    if (ambientChirpT <= 0 && mode === "explore") {
      ambientChirpT = 4 + Math.random() * 7;
      if (Math.random() < 0.65) birdChirp();
    }
    if (mode === "explore") {
      updateWeather(dt);
      movePlayer(dt);
      moveAnimals(dt);
      updateParticles(dt);
      ui.posChip.textContent = "POS " + player.x.toFixed(1) + "," + player.y.toFixed(1);
      drawWorld();
    } else if (mode === "dossier" || mode === "log" || mode === "note" || mode === "help" || mode === "journal") {
      moveAnimals(dt);
      updateParticles(dt);
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
      else if (mode === "note") closeFieldNote();
      else if (mode === "help") closeHelp(true);
      else if (mode === "journal") closeJournal();
      else if (mode === "log") closeLog();
      else if (mode === "explore") showTitle();
      return;
    }
    if (mode === "explore" && (e.key === "l" || e.key === "L")) {
      if (notesFound.length) openExpeditionLog();
      return;
    }
    if (mode === "explore" && (e.key === "j" || e.key === "J")) {
      openJournal();
      return;
    }
    if (mode === "explore" && (e.key === "p" || e.key === "P")) {
      takePhoto();
      return;
    }
    if (mode === "explore" && (e.key === "e" || e.key === "E")) {
      tryPickupNotes();
      return;
    }
    if (mode !== "explore") return;
    keys[e.key] = true;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].indexOf(e.key) >= 0) e.preventDefault();
  });
  window.addEventListener("keyup", function (e) { keys[e.key] = false; });
  window.addEventListener("blur", function () {
    clearInput();
    if (mode !== "title") setPaused(true);
  });
  window.addEventListener("focus", function () {
    setPaused(false);
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      clearInput();
      if (mode !== "title") setPaused(true);
    } else setPaused(false);
  });
  window.addEventListener("message", function (e) {
    const d = e.data;
    if (!d || typeof d !== "object") return;
    if (d.type === "po-pause") setPaused(true);
    if (d.type === "po-resume") setPaused(false);
  });

  canvas.addEventListener("mousedown", function (e) {
    if (mode !== "explore") return;
    lookMoved = 0;
    lookDrag = { x: e.clientX, y: e.clientY, dir: player.dir, pitch: player.pitch };
  });
  window.addEventListener("mouseup", function () { lookDrag = null; });
  window.addEventListener("mousemove", function (e) {
    if (!lookDrag || mode !== "explore") return;
    const dx = e.clientX - lookDrag.x;
    const dy = e.clientY - lookDrag.y;
    lookMoved = Math.max(lookMoved, Math.hypot(dx, dy));
    player.dir = lookDrag.dir + dx * 0.0055;
    player.pitch = clamp(lookDrag.pitch - dy * 0.0045, -0.58, 0.58);
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
    lookDrag = { x: e.touches[0].clientX, y: e.touches[0].clientY, dir: player.dir, pitch: player.pitch };
  }, { passive: false });

  window.addEventListener("touchmove", function (e) {
    if (!lookDrag || mode !== "explore" || !e.touches.length) return;
    e.preventDefault();
    const dx = e.touches[0].clientX - lookDrag.x;
    const dy = e.touches[0].clientY - lookDrag.y;
    lookMoved = Math.max(lookMoved, Math.hypot(dx, dy));
    player.dir = lookDrag.dir + dx * 0.0055;
    player.pitch = clamp(lookDrag.pitch - dy * 0.0045, -0.58, 0.58);
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
  if (ui.continueBtn) {
    ui.continueBtn.addEventListener("click", function () {
      const s = loadSave();
      if (s.lastRegion && PO_DATA[s.lastRegion]) enterRegion(s.lastRegion);
    });
  }
  function closeHelpAndGo() { closeHelp(true); }
  if (ui.helpX) ui.helpX.addEventListener("click", function (e) { e.stopPropagation(); closeHelpAndGo(); });
  if (ui.helpGo) ui.helpGo.addEventListener("click", closeHelpAndGo);
  if (ui.help) {
    ui.help.addEventListener("click", function (e) {
      if (e.target === ui.help) closeHelpAndGo();
    });
  }
  syncContinueBtn();
  syncRegionStamps();
  applyA11yFromSave();
  if (ui.journalBtn) ui.journalBtn.addEventListener("click", openJournal);
  if (ui.journalX) ui.journalX.addEventListener("click", function (e) {
    e.stopPropagation();
    closeJournal();
  });
  if (ui.journal) {
    ui.journal.addEventListener("click", function (e) {
      if (e.target === ui.journal) closeJournal();
    });
  }
  if (ui.photoBtn) ui.photoBtn.addEventListener("click", takePhoto);
  if (ui.bigLookBtn) {
    ui.bigLookBtn.addEventListener("click", function () {
      const on = !document.documentElement.classList.contains("po-big-look");
      document.documentElement.classList.toggle("po-big-look", on);
      ui.bigLookBtn.setAttribute("aria-pressed", on ? "true" : "false");
      persistProgress();
    });
  }
  if (ui.reduceMotionBtn) {
    ui.reduceMotionBtn.addEventListener("click", function () {
      reduceMotion = !reduceMotion;
      document.documentElement.classList.toggle("po-reduce-motion", reduceMotion);
      ui.reduceMotionBtn.setAttribute("aria-pressed", reduceMotion ? "true" : "false");
      if (reduceMotion) weather.kind = null;
      persistProgress();
    });
  }
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
  ui.dClose.addEventListener("click", function (e) {
    e.stopPropagation();
    closeDossier();
  });
  if (ui.dossier) {
    ui.dossier.addEventListener("click", function (e) {
      if (e.target === ui.dossier) closeDossier();
    });
  }
  if (ui.logClose) ui.logClose.addEventListener("click", closeLog);
  if (ui.noteX) ui.noteX.addEventListener("click", function (e) {
    e.stopPropagation();
    closeFieldNote();
  });
  if (ui.note) {
    ui.note.addEventListener("click", function (e) {
      if (e.target === ui.note) closeFieldNote();
    });
  }
  if (ui.notesChip) {
    ui.notesChip.addEventListener("click", function () {
      if (mode === "explore" && notesFound.length) openExpeditionLog();
    });
  }
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
    function bindPitch(btn, dir) {
      if (!btn) return;
      function down(e) {
        if (mode !== "explore") return;
        pad.pitch = dir;
        btn.classList.add("is-held");
        tryLandscapeFullscreen();
        e.preventDefault();
      }
      function up() {
        if (pad.pitch === dir) pad.pitch = 0;
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
    bindPitch(ui.lookU, 1);
    bindPitch(ui.lookD, -1);
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
  requestAnimationFrame(function () {
    document.documentElement.classList.remove("po-loading");
    requestAnimationFrame(loop);
  });

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
