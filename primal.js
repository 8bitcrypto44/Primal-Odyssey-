(function () {
  const isEmbed =
    window !== window.top || /(?:\?|&)embed=1(?:&|$)/.test(location.search || "");
  let parentFs = false;
  function poIsMobileDevice() {
    try {
      // Any fine pointer (mouse/trackpad) = desktop — even on hybrid touch laptops.
      if (window.matchMedia("(pointer: fine)").matches) {
        return false;
      }
    } catch (e) {}
    const touch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
    let narrow = false;
    let coarse = false;
    try {
      narrow = window.matchMedia("(max-width: 700px)").matches;
      coarse = window.matchMedia("(pointer: coarse)").matches;
    } catch (e2) {}
    return narrow || (touch && coarse);
  }
  if (isEmbed) {
    document.documentElement.classList.add("po-embed");
    document.documentElement.classList.add("po-loading");
    if (poIsMobileDevice()) document.documentElement.classList.add("po-mobile");
    function lockEmbedScroll() {
      if (poIsMobileDevice()) return;
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
    document.addEventListener(
      "touchmove",
      function (e) {
        if (poIsMobileDevice()) return;
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
  const hudCanvas = document.getElementById("po-hud-canvas");
  const hctx = hudCanvas ? hudCanvas.getContext("2d", { alpha: true }) : null;
  // ImageData floor stays cheap — keep readable res for Digistracts / fullscreen
  const IS_MOBILE = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ||
    (window.matchMedia && matchMedia("(pointer:coarse)").matches);
  // World stays SNES-scale; HUD overlay is hi-DPI on top.
  const W = 320;
  const H = 240;
  let hudCssW = W, hudCssH = H;
  canvas.width = W;
  canvas.height = H;
  canvas.style.imageSmoothingEnabled = false;
  ctx.imageSmoothingEnabled = false;
  const MAP = 36;
  const FOV = Math.PI / 3;
  const TEX = 256;
  const FLOOR_STEP_X = 1;
  const FLOOR_STEP_Y = 1;
  function canvasContentBox(shellRect) {
    const rect = canvas.getBoundingClientRect();
    const s = shellRect || (canvas.parentElement && canvas.parentElement.getBoundingClientRect()) || rect;
    // Game stretches to fill the whole player frame — chrome uses the full canvas box
    const left = rect.left;
    const top = rect.top;
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    return {
      left: left - s.left,
      top: top - s.top,
      width: width,
      height: height,
      bottomGap: Math.max(0, s.height - (top - s.top + height))
    };
  }

  function syncHudOverlay() {
    if (!hudCanvas || !hctx) return;
    const shell = canvas.parentElement;
    const srect = shell ? shell.getBoundingClientRect() : canvas.getBoundingClientRect();
    const box = canvasContentBox(srect);
    const cssW = box.width;
    const cssH = box.height;
    hudCssW = cssW;
    hudCssH = cssH;
    hudCanvas.style.left = Math.round(box.left) + "px";
    hudCanvas.style.top = Math.round(box.top) + "px";
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const bw = Math.round(cssW * dpr);
    const bh = Math.round(cssH * dpr);
    if (hudCanvas.width !== bw || hudCanvas.height !== bh) {
      hudCanvas.width = bw;
      hudCanvas.height = bh;
    }
    hudCanvas.style.width = cssW + "px";
    hudCanvas.style.height = cssH + "px";
    hctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    hctx.imageSmoothingEnabled = true;
    if (hctx.imageSmoothingQuality) hctx.imageSmoothingQuality = "high";
    syncChromeToCanvas(box);
  }

  function syncChromeToCanvas(box) {
    const shell = canvas.parentElement;
    if (!shell) return;
    if (!box) box = canvasContentBox(shell.getBoundingClientRect());
    const touchEl = document.getElementById("po-touch");
    const touchOn = document.documentElement.classList.contains("po-touch-on") &&
      touchEl && !touchEl.hidden;
    const land = document.documentElement.classList.contains("po-land");
    const fs = document.documentElement.classList.contains("po-fs") || isNativeFullscreen() || parentFs || likelyParentFullscreen();
    // Only lift above sticks when touch pads are actually showing
    const stickLift = touchOn ? (land ? Math.min(100, box.height * 0.22) : Math.min(132, box.height * 0.3)) : 0;
    // Fullscreen / land: pull chrome up so it isn't clipped under the screen edge
    const edgePad = (fs || land)
      ? Math.max(14, Math.round(box.height * 0.035))
      : 4;
    const bottom = box.bottomGap + stickLift + edgePad;
    const bar = document.getElementById("po-bottom-bar");
    if (bar) {
      bar.style.left = Math.round(box.left) + "px";
      bar.style.width = Math.round(box.width) + "px";
      bar.style.right = "auto";
      bar.style.bottom = Math.round(bottom) + "px";
    }
    if (touchEl) {
      touchEl.style.left = Math.round(box.left) + "px";
      touchEl.style.width = Math.round(box.width) + "px";
      touchEl.style.right = "auto";
      touchEl.style.bottom = Math.round(box.bottomGap + (fs || land ? 8 : 0)) + "px";
    }
    const hintEl = document.getElementById("po-hint");
    if (hintEl) {
      hintEl.style.left = Math.round(box.left + box.width / 2) + "px";
      hintEl.style.right = "auto";
      hintEl.style.bottom = Math.round(bottom + (touchOn ? 40 : 36)) + "px";
    }
    const objEl = document.getElementById("po-obj");
    if (objEl) {
      objEl.style.left = Math.round(box.left + 8) + "px";
      objEl.style.top = Math.round(box.top + 8) + "px";
      objEl.style.bottom = "auto";
      objEl.style.right = "auto";
      objEl.style.transform = "none";
    }
    const questEl = document.getElementById("po-quest-chip");
    if (questEl) {
      questEl.style.left = Math.round(box.left + box.width / 2) + "px";
      questEl.style.top = Math.round(box.top + 8) + "px";
      questEl.style.right = "auto";
    }
    const cautionEl = document.getElementById("po-caution");
    if (cautionEl) {
      cautionEl.style.left = Math.round(box.left + box.width / 2) + "px";
      cautionEl.style.top = Math.round(box.top + 44) + "px";
      cautionEl.style.right = "auto";
    }
  }
  function poIntegerScale() {
    const shell = canvas.parentElement;
    if (!shell) return;
    // Stretch pixel world to fill the entire player frame (PC / mobile / fullscreen)
    canvas.style.position = "absolute";
    canvas.style.left = "0";
    canvas.style.top = "0";
    canvas.style.right = "0";
    canvas.style.bottom = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.maxWidth = "none";
    canvas.style.maxHeight = "none";
    canvas.style.margin = "0";
    canvas.style.objectFit = "fill";
    canvas.style.imageRendering = "pixelated";
    canvas.style.display = "block";
    syncHudOverlay();
  }
  poIntegerScale();
  window.addEventListener("resize", poIntegerScale);
  const UNIT_FT = 11;
  const HT_FT = {
    acacia: 36, baobab: 58, pine: 85, tree: 110,
    africa_tree1: 36, africa_tree2: 42, africa_tree3: 38,
    mountains_tree1: 85, mountains_tree2: 78, mountains_tree3: 90,
    jungle_tree1: 110, jungle_tree2: 100, jungle_tree3: 120,
    wetlands_tree1: 48, wetlands_tree2: 55, wetlands_tree3: 44,
    africa_rock1: 6.5, africa_rock2: 5.5, africa_rock3: 7.5, africa_rock4: 6, africa_rock5: 8,
    mountains_rock1: 6.5, mountains_rock2: 5.5, mountains_rock3: 7.5, mountains_rock4: 6, mountains_rock5: 8,
    jungle_rock1: 6.5, jungle_rock2: 5.5, jungle_rock3: 7.5, jungle_rock4: 6, jungle_rock5: 8,
    wetlands_rock1: 6.5, wetlands_rock2: 5.5, wetlands_rock3: 7.5, wetlands_rock4: 6, wetlands_rock5: 8,
    africa_grass1: 3.8, africa_grass2: 3.2, africa_grass3: 4.5,
    mountains_grass1: 3.8, mountains_grass2: 3.2, mountains_grass3: 4.5,
    jungle_grass1: 3.8, jungle_grass2: 3.2, jungle_grass3: 4.5,
    wetlands_grass1: 3.8, wetlands_grass2: 3.2, wetlands_grass3: 4.5,
    africa_bush1: 4, africa_bush2: 4.2,
    mountains_bush1: 4, mountains_bush2: 4.2,
    jungle_bush1: 4, jungle_bush2: 4.2,
    wetlands_bush1: 4, wetlands_bush2: 4.2,
    rock: 6.5, snowrock: 6.5, grass: 3.8, fern: 4.2, bush: 4,
    wallrock: 14, reed: 4, africa_thorn: 3.2, jungle_vine: 12, wet_lily: 1.2, mtn_fir: 40,
    lm_watering_hole: 10, lm_cairn: 8, lm_boardwalk: 7, lm_reed_blind: 8, lm_ranger_post: 9, lm_canopy_gap: 14, bird: 1.2,
    lion: 4.8, tiger: 4.5, leopard: 3, jaguar: 3.2, snowleopard: 2.8,
    cougar: 3.2, wolf: 3, grizzly: 5.5, gorilla: 5.6, hippo: 5.5,
    rhino: 6.2, buffalo: 5.5, croc: 1.8, anaconda: 2.5, eagle: 2.8, honeybadger: 3.4, lynx: 2.6, ocelot: 2.5, manatee: 4.2
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
    reduceMotionBtn: document.getElementById("po-reduce-motion"),
    victory: document.getElementById("po-victory"),
    victoryX: document.getElementById("po-victory-x"),
    victoryMeta: document.getElementById("po-victory-meta"),
    victoryBody: document.getElementById("po-victory-body"),
    victoryGo: document.getElementById("po-victory-go"),
    bestiaryBtn: document.getElementById("po-bestiary-btn"),
    bestiary: document.getElementById("po-bestiary"),
    bestiaryX: document.getElementById("po-bestiary-x"),
    bestiaryBody: document.getElementById("po-bestiary-body"),
    shareBtn: document.getElementById("po-share"),
    binocsBtn: document.getElementById("po-binocs-btn"),
    focusBtn: document.getElementById("po-focus-btn"),
    spotterBtn: document.getElementById("po-spotter-btn"),
    cautionEl: document.getElementById("po-caution"),
    toolsBtn: document.getElementById("po-tools-btn"),
    toolsTray: document.getElementById("po-tools-tray"),
    autoBtn: document.getElementById("po-auto-btn"),
    seasonBtn: document.getElementById("po-season"),
    diffBtn: document.getElementById("po-diff"),
    weeklyBtn: document.getElementById("po-weekly"),
    recapImg: document.getElementById("po-recap-img"),
    recapDl: document.getElementById("po-recap-dl"),
    postcard: document.getElementById("po-postcard"),
    questChip: document.getElementById("po-quest-chip")
  };

  const MUSIC_BASE = "https://incompetech.com/music/royalty-free/mp3-royaltyfree/";
  const MUSIC = {
    africa: MUSIC_BASE + "Digya.mp3",
    mountains: MUSIC_BASE + "Windswept.mp3",
    jungle: MUSIC_BASE + "Nightdreams.mp3",
    wetlands: MUSIC_BASE + "Nightdreams.mp3"
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
  let worldFade = 0;
  let zBuf = null;
  let remoteWall = {};
  let remoteParallax = {};
  let remoteDecal = {};
  let remoteLandmark = {};
  let remoteTitle = {};
  let playerKit = {};
  let localCover = {};
  let lightningT = 0;
  let introCard = null;
  let reduceMotion = false;
  let tourStep = 0; // 0 off, 1 note, 2 animal, 3 done
  let photoAnimals = 0;
  let photoLandmark = false;
  let photoDusk = false;
  let audioDuck = 1;
  let cautionLevel = 0;
  let binocsOn = false;
  let binocsOwned = false;
  let focusHold = false;
  let stuckIdle = 0;
  let progressStamp = 0;
  let sessionSeed = (Date.now() / 86400000) | 0;
  let weeklyMode = true;
  let season = "wet"; // wet | dry
  let difficulty = "explorer"; // kids | explorer
  let autoWalk = false;
  let questPhase = 0; // 0 start, 1 notes3, 2 rareTrail, 3 photoRare, 4 done
  let runStart = 0;
  let runNotesAtStart = 0;
  let photoRareDone = false;
  let toolsOpen = false;
  let dens = [];
  let herds = [];
  let rangerCd = 0;
  function isoWeekSeed() {
    const d = new Date();
    const onejan = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
    return d.getFullYear() * 100 + week;
  }
  sessionSeed = isoWeekSeed();
  let scriptEvent = { id: null, t: 0, cd: 12 };
  let victoryPending = false;
  let victoryFlash = 0;
  let spotterOn = false;
  let photoLock = null;
  let bestiary = {};
  let shareLine = "";
  const RARE_IDS = { africa: "honeybadger", mountains: "lynx", jungle: "ocelot", wetlands: "manatee" };
  const RANGER_TIPS = {
    africa: "Ranger tip: honey badgers dig near termite mounds at midday — follow loose dirt.",
    mountains: "Ranger tip: lynx prints look like soft snowshoes — check dusk ridgelines.",
    jungle: "Ranger tip: ocelots love fern edges after rain — move quiet near thickets.",
    wetlands: "Ranger tip: manatees graze quiet channels — binoculars help from the boardwalk."
  };
  const BADGE_LABEL = {
    africa: "SAVANNA RANGER", mountains: "ALPINE SCOUT", jungle: "CANOPY GUIDE", wetlands: "MARSH WARDEN"
  };
  const COVER = {
    africa: "https://i.postimg.cc/D0kDM1Xb/african-cover-image.jpg",
    mountains: "https://i.postimg.cc/L5K7bj11/mountains-cover-image.jpg",
    jungle: "https://i.postimg.cc/VvqTQ5qs/jungle-cover-image.jpg",
    wetlands: "https://i.postimg.cc/VvqTQ5qs/jungle-cover-image.jpg"
  };
  const RADIO_LINES = {
    "WATERING HOLE": "Ranger Asha: watering hole active — keep distance from pods.",
    "KOPJE LOOKOUT": "Ranger Asha: kopje lookout clear — good scan for dust trails.",
    "RANGER POST": "Ranger Asha at Post Alpha — log notes and watch for dust storms.",
    "SNOW OVERLOOK": "Ranger Cole: ridge wind rising — watch footing on ice.",
    "RIDGE TRAIL": "Ranger Cole: ridge trail open — lynx sign reported at dusk.",
    "ICE CAIRN": "Ranger Cole: ice cairn marks the safe switchback — stay on trail.",
    "CANOPY GAP": "Ranger Maya: canopy gap — light shaft useful for note hunting.",
    "FERN THICKET": "Ranger Maya: fern thicket dense — move slow, watch for ocelot.",
    "RIVER LOOKOUT": "Ranger Maya: river lookout wet — anaconda sign on the banks.",
    "BOARDWALK": "Ranger Dion: boardwalk secure — glass water, watch for manatee boils.",
    "REED BLIND": "Ranger Dion: reed blind ready — stay low, birds flush easy.",
    "OXBOW LAKE": "Ranger Dion: oxbow lake deep — hippo channels marked."
  };
  const RANGER_CHAT = {
    africa: ["Ranger Asha: pride tracks fresh southwest of camp.", "Ranger Asha: if dust rolls in, hug the kopje wall."],
    mountains: ["Ranger Cole: eagle thermal over the overlook.", "Ranger Cole: lynx likes the dusk switchback."],
    jungle: ["Ranger Maya: jaguar scrape under the fern wall.", "Ranger Maya: stay on the boardwalk roots."],
    wetlands: ["Ranger Dion: manatee boils near the oxbow.", "Ranger Dion: boardwalk first — mud hides dens."]
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
    masterGain.gain.value = muted ? 0 : musicVol * 0.55 * audioDuck;
  }

  function setAudioDuck(on) {
    audioDuck = on ? 0.28 : 1;
    sfxGain();
  }
  function haptic(ms) {
    try {
      if (navigator.vibrate) navigator.vibrate(ms || 18);
    } catch (e) {}
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
  function thunderBoom() {
    const ctxA = ensureAudio();
    if (!ctxA || muted) return;
    sfxGain();
    const now = ctxA.currentTime;
    for (let i = 0; i < 3; i++) {
      const o = ctxA.createOscillator();
      const g = ctxA.createGain();
      o.type = i === 0 ? "sawtooth" : "triangle";
      o.frequency.value = 55 + i * 18 + Math.random() * 12;
      g.gain.value = 0.0001;
      o.connect(g); g.connect(masterGain);
      const t0 = now + i * 0.05;
      g.gain.exponentialRampToValueAtTime(0.09 - i * 0.02, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55 + i * 0.15);
      o.start(t0);
      o.stop(t0 + 0.7 + i * 0.15);
    }
    haptic(40);
  }

  function footstep(wetness) {
    const ctxA = ensureAudio();
    if (!ctxA || muted) return;
    sfxGain();
    const o = ctxA.createOscillator();
    const g = ctxA.createGain();
    const snow = region && region.id === "mountains" && !wetness;
    const leaf = region && (region.id === "jungle" || region.id === "wetlands") && !wetness;
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
    return {
      onboarded: false, lastRegion: null, regions: {}, shots: [],
      bigLook: false, reduceMotion: false,
      photoAnimals: 0, photoLandmark: false, photoDusk: false, tourDone: false,
      bestiary: {}, binocs: false, spotter: false,
      season: "wet", difficulty: "explorer", weekly: true, postcard: false,
      weeklyBest: {}
    };
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
    s.photoAnimals = photoAnimals;
    s.photoLandmark = !!photoLandmark;
    s.photoDusk = !!photoDusk;
    s.tourDone = tourStep >= 3 || !!s.tourDone;
    s.bestiary = bestiary;
    s.binocs = !!binocsOwned;
    s.spotter = !!spotterOn;
    s.season = season;
    s.difficulty = difficulty;
    s.weekly = !!weeklyMode;
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
    const label = "Continue · " + (show ? (PO_DATA[s.lastRegion].name || s.lastRegion) : "");
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
      if (done) el.textContent = "Cleared · " + (BADGE_LABEL[id] || "Ranger");
    });
    syncBadgeWall(s);
    syncShareLine(s);
  }
  function syncBadgeWall(s) {
    const wall = document.getElementById("po-badge-wall");
    if (!wall) return;
    const ids = ["africa", "mountains", "jungle", "wetlands"];
    let html = "";
    ids.forEach(function (id) {
      const on = !!(s.regions[id] && s.regions[id].complete);
      html += "<span class=\"po-badge" + (on ? " on" : "") + "\" title=\"" + (BADGE_LABEL[id] || id) + "\">" +
        (on ? (BADGE_LABEL[id] || id) : "—") + "</span>";
    });
    wall.innerHTML = html;
    wall.hidden = false;
  }
  function syncShareLine(s) {
    const cleared = Object.keys(s.regions || {}).filter(function (id) {
      return s.regions[id] && s.regions[id].complete;
    });
    shareLine = cleared.length
      ? ("I cleared " + cleared.map(function (id) { return BADGE_LABEL[id] || id; }).join(", ") + " in Primal Odyssey!")
      : "Exploring Primal Odyssey — Africa, Mountains, Jungle & Wetlands.";
    if (ui.shareBtn) ui.shareBtn.hidden = false;
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
    photoAnimals = s.photoAnimals | 0;
    photoLandmark = !!s.photoLandmark;
    photoDusk = !!s.photoDusk;
    tourStep = s.tourDone ? 3 : 0;
    bestiary = s.bestiary && typeof s.bestiary === "object" ? s.bestiary : {};
    binocsOwned = !!s.binocs;
    spotterOn = !!s.spotter;
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
    bestiary[id] = true;
    if (id === "honeybadger" || id === "lynx" || id === "ocelot" || id === "manatee") rareFound = true;
    progressStamp = t;
    stuckIdle = 0;
    persistProgress();
    syncObjectives();
    checkRegionVictory();
  }
  function markLandmark(id) {
    if (!id || landmarksVisited[id]) return;
    landmarksVisited[id] = true;
    blip(490, 0.1, "sine");
    radioCall(RADIO_LINES[id] || ("Ranger net: " + id + " logged."));
    progressStamp = t;
    stuckIdle = 0;
    haptic(22);
    persistProgress();
    syncObjectives();
    syncQuest();
    checkRegionVictory();
  }

  function checkRegionVictory() {
    if (!region || victoryPending) return;
    if (!regionObjectivesDone()) return;
    victoryPending = true;
    victoryFlash = 3.2;
    questPhase = 4;
    blip(520, 0.08, "sine");
    setTimeout(function () { blip(660, 0.1, "triangle"); }, 120);
    setTimeout(function () { blip(880, 0.14, "square"); }, 240);
    haptic([30, 40, 30, 40, 80]);
    const elapsed = Math.max(1, ((t - runStart) | 0));
    const recap = buildRecapCard({
      region: region.name,
      badge: BADGE_LABEL[region.id] || "RANGER",
      notes: notesFound.length,
      animals: Object.keys(animalsSeen).length,
      photos: photoShots.length,
      seconds: elapsed,
      tip: RANGER_TIPS[region.id] || ""
    });
    if (ui.victory) {
      ui.victoryMeta.textContent = (BADGE_LABEL[region.id] || "RANGER") + " earned";
      ui.victoryBody.textContent = RANGER_TIPS[region.id] || "Expedition cleared.";
      if (ui.recapImg) { ui.recapImg.src = recap; ui.recapImg.hidden = false; }
      if (ui.recapDl) { ui.recapDl.href = recap; ui.recapDl.download = "primal-odyssey-" + region.id + ".png"; ui.recapDl.hidden = false; }
      ui.victory.classList.add("show");
      mode = "victory";
      clearInput();
    }
    if (ui.hint) ui.hint.textContent = "Expedition cleared — " + (BADGE_LABEL[region.id] || "badge");
    const s = loadSave();
    const b = regionBucket(s, region.id);
    b.complete = true;
    b.bestTime = b.bestTime ? Math.min(b.bestTime, elapsed) : elapsed;
    if (weeklyMode) {
      s.weeklyBest = s.weeklyBest || {};
      const key = sessionSeed + ":" + region.id;
      if (!s.weeklyBest[key] || elapsed < s.weeklyBest[key]) s.weeklyBest[key] = elapsed;
    }
    const all = ["africa", "mountains", "jungle", "wetlands"].every(function (id) {
      return s.regions[id] && s.regions[id].complete;
    });
    if (all) {
      s.postcard = true;
      document.documentElement.classList.add("po-postcard");
      if (ui.postcard) ui.postcard.hidden = false;
    }
    writeSave(s);
    persistProgress();
    syncRegionStamps();
    syncQuest();
  }

  function buildRecapCard(info) {
    const c = document.createElement("canvas");
    c.width = 720; c.height = 405;
    const g = c.getContext("2d");
    const grd = g.createLinearGradient(0, 0, 720, 405);
    grd.addColorStop(0, "#041208");
    grd.addColorStop(1, "#0a2a18");
    g.fillStyle = grd;
    g.fillRect(0, 0, 720, 405);
    g.strokeStyle = "#5dce7a";
    g.lineWidth = 6;
    g.strokeRect(12, 12, 696, 381);
    g.fillStyle = "#5dce7a";
    g.font = "700 32px Atkinson Hyperlegible, Segoe UI, sans-serif";
    g.fillText("Primal Odyssey", 36, 58);
    g.fillStyle = "#e8c86a";
    g.font = "700 24px Atkinson Hyperlegible, Segoe UI, sans-serif";
    g.fillText(info.badge, 36, 96);
    g.fillStyle = "#cfe8d6";
    g.font = "400 18px Atkinson Hyperlegible, Segoe UI, sans-serif";
    g.fillText(info.region, 36, 128);
    const mins = (info.seconds / 60) | 0;
    const secs = info.seconds % 60;
    const lines = [
      "Time  " + mins + "m " + secs + "s",
      "Notes  " + info.notes,
      "Animals  " + info.animals,
      "Photos  " + info.photos,
      weeklyMode ? ("Weekly seed  " + sessionSeed) : "Session run"
    ];
    lines.forEach(function (ln, i) {
      g.fillText(ln, 36, 174 + i * 30);
    });
    g.fillStyle = "#7fa88c";
    g.font = "400 15px Atkinson Hyperlegible, Segoe UI, sans-serif";
    const tip = (info.tip || "").slice(0, 70);
    g.fillText(tip, 36, 360);
    g.fillStyle = "#5dce7a";
    g.fillText("8bitcrypto_44", 500, 380);
    return c.toDataURL("image/png");
  }

  function syncQuest() {
    if (!region) return;
    if (notesFound.length >= 3 && questPhase < 1) {
      questPhase = 1;
      radioCall((RANGER_CHAT[region.id] || ["Ranger net: good work."])[0]);
      if (ui.hint) ui.hint.textContent = "Quest: rare trail unlocked — follow gold rare prints";
      haptic(40);
    }
    if (questPhase >= 1 && (rareFound || animalsSeen[RARE_IDS[region.id]]) && questPhase < 2) {
      questPhase = 2;
      if (ui.hint) ui.hint.textContent = "Quest: photograph the rare (Photo when in frame)";
    }
    if (questPhase >= 2 && photoRareDone && questPhase < 3) {
      questPhase = 3;
      if (ui.hint) ui.hint.textContent = "Quest complete — finish remaining objectives";
    }
    if (ui.questChip) {
      const labels = [
        "Quest: collect 3 field notes",
        "Quest: follow rare trail",
        "Quest: photo the rare",
        "Quest: wrap objectives",
        "Quest: cleared"
      ];
      ui.questChip.textContent = labels[Math.min(questPhase, 4)];
      ui.questChip.hidden = mode === "title";
    }
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
      return id !== "honeybadger" && id !== "lynx" && id !== "ocelot" && id !== "manatee";
    }).length;
    const lmNeed = 2;
    const lmN = Object.keys(landmarksVisited).length;
    const list = [
      { done: notesTotal > 0 && notesFound.length >= notesTotal, label: "Field notes " + notesFound.length + "/" + notesTotal },
      { done: seenN >= animalNeed, label: "Open dossiers " + Math.min(seenN, animalNeed) + "/" + animalNeed },
      { done: lmN >= lmNeed, label: "Visit a landmark " + Math.min(lmN, lmNeed) + "/" + lmNeed }
    ];
    if (region) {
      const rid = RARE_IDS[region.id];
      const names = { honeybadger: "honey badger", lynx: "lynx", ocelot: "ocelot", manatee: "manatee" };
      if (rid) list.push({ done: !!rareFound || !!animalsSeen[rid], label: "Find the rare " + (names[rid] || rid) });
    }
    list.push({ done: photoAnimals >= 3, label: "Photo animals " + Math.min(photoAnimals, 3) + "/3" });
    list.push({ done: !!photoLandmark, label: "Photo a landmark " + (photoLandmark ? "1" : "0") + "/1" });
    list.push({ done: !!photoDusk, label: "Photo at dusk/night " + (photoDusk ? "1" : "0") + "/1" });
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
      if (!s.tourDone) {
        tourStep = 1;
        if (ui.hint) ui.hint.textContent = "Tour: follow the green note arrow to your first field note";
      }
    }
    clearInput();
    syncTouchUI();
    syncObjectives();
    setAudioDuck(false);
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
    if (!ctxA || muted || reduceMotion) return;
    sfxGain();
    ambientNodes = [];
    function tone(freq, vol, type) {
      const o = ctxA.createOscillator();
      const g = ctxA.createGain();
      o.type = type || "sine";
      o.frequency.value = freq;
      g.gain.value = vol * audioDuck;
      o.connect(g);
      g.connect(masterGain);
      o.start();
      ambientNodes.push(o, g);
    }
    try {
      const bufLen = Math.floor(ctxA.sampleRate * 2);
      const buf = ctxA.createBuffer(1, bufLen, ctxA.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * 0.35;
      const src = ctxA.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const filter = ctxA.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = regionId === "jungle" ? 900 : (regionId === "mountains" ? 380 : 620);
      filter.Q.value = 0.55;
      const ng = ctxA.createGain();
      ng.gain.value = (regionId === "jungle" ? 0.03 : (regionId === "mountains" ? 0.024 : 0.018)) * audioDuck;
      src.connect(filter); filter.connect(ng); ng.connect(masterGain);
      src.start();
      ambientNodes.push(src, filter, ng);
    } catch (e) {}
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
      ui.mute.textContent = muted ? "Muted" : "Sound";
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
  let player = { x: 3.5, y: 3.5, dir: 0, pitch: 0, bob: 0, vx: 0, vy: 0 };
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
  let miniExplored = null;
  let miniPpt = 3; // pixels-per-tile on baked chart
  let miniMeta = { w: 0, h: 0, ppt: 3 };
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
      ui.notesChip.textContent = "Notes " + notesFound.length + "/" + notesTotal;
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
    croc: 1.5, anaconda: 1.2, eagle: 4.5, honeybadger: 3.6, lynx: 3.5, ocelot: 3.6, manatee: 1.6
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

  function seededRand(n) {
    const x = Math.sin(sessionSeed * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  }
  function findAnimalData(regionId, animalId) {
    const R = PO_DATA[regionId];
    if (!R || !R.animals) return null;
    for (let i = 0; i < R.animals.length; i++) if (R.animals[i].id === animalId) return R.animals[i];
    return null;
  }
  function wetlandsAnimals() {
    const specs = [
      { from: "africa", id: "hippo" },
      { from: "africa", id: "croc" },
      { from: "jungle", id: "anaconda" },
      { from: "jungle", id: "jaguar" },
      { from: "mountains", id: "eagle" }
    ];
    return specs.map(function (sp, i) {
      const src = findAnimalData(sp.from, sp.id);
      if (!src) return null;
      const a = Object.assign({}, src);
      a.x = 12 + i * 4; a.y = 14 + (i % 3) * 3;
      return a;
    }).filter(Boolean);
  }

  function buildWorld(regionId) {
    const base = PO_DATA[regionId];
    if (!base) return;
    const R = Object.assign({}, base);
    if (regionId === "wetlands") R.animals = wetlandsAnimals();
    region = R;
    window.region = region;
    wall = [];
    floor = [];
    sprites = [];
    propCache = {};
    miniBase = null;
    miniExplored = null;
    landmarks = [];
    notesFound = [];
    particles = [];
    dayT = seededRand(3) * 40;
    victoryPending = false;
    victoryFlash = 0;
    scriptEvent = { id: null, t: 0, cd: 8 + seededRand(7) * 10 };
    stuckIdle = 0;
    progressStamp = t;
    photoLock = null;

    for (let y = 0; y < MAP; y++) {
      wall[y] = [];
      floor[y] = [];
      for (let x = 0; x < MAP; x++) {
        const n = Math.sin(x * 0.55) * Math.cos(y * 0.47) + Math.sin((x + y) * 0.19);
        const n2 = Math.sin(x * 0.31 + 2.1) * Math.cos(y * 0.37 - 1.4);
        let f = 1;
        const wetBias = season === "wet" ? -0.08 : 0.12;
        if (regionId === "africa") {
          if (n > (0.62 + wetBias) || (n2 > 0.75 && n > 0.2)) f = 3;
          else if (Math.abs(n) < 0.07 || Math.abs(n2) < 0.05) f = 0;
        } else if (regionId === "mountains") {
          if (n < -0.42 || n2 < -0.55) f = 2;
          else if (Math.abs(n) < 0.08) f = 0;
          if (season === "wet" && n < -0.2 && Math.random() < 0.04) f = 3;
        } else if (regionId === "wetlands") {
          if (n > (0.25 + wetBias) || n2 > (0.4 + wetBias * 0.5)) f = 3;
          else if (Math.abs(n) < 0.1) f = 0;
          else if (n < -0.45) f = 2;
        } else {
          if (n > (0.68 + wetBias) ) f = 3;
          else if (n2 > 0.55) f = 0;
          else if (n < -0.35) f = 2;
        }
        wall[y][x] = 0;
        floor[y][x] = f;
      }
    }

    for (let y = 2; y < 7; y++) for (let x = 2; x < 7; x++) { wall[y][x] = 0; floor[y][x] = 0; }

    // Visible kopjes — wall textures + rocks as billboards (no invisible wall cells)
    const kopjeN = regionId === "mountains" ? 5 : (regionId === "africa" ? 4 : (regionId === "wetlands" ? 2 : 3));
    const kopjeRock = regionId === "mountains" ? "snowrock" : "rock";
    const wallProp = regionId === "mountains" ? "wallmountains"
      : ((regionId === "jungle" || regionId === "wetlands") ? "walljungle" : "wallafrica");
    for (let k = 0; k < kopjeN; k++) {
      const cx = 8 + rnd(MAP - 16), cy = 8 + rnd(MAP - 16);
      if (Math.hypot(cx - 4.5, cy - 4.5) < 6) continue;
      const rad = 1 + rnd(2);
      for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
        if (dx * dx + dy * dy > rad * rad + 0.5) continue;
        const x = cx + dx, y = cy + dy;
        if (x < 2 || y < 2 || x >= MAP - 2 || y >= MAP - 2) continue;
        wall[y][x] = 1; // solid for wall raycast
        floor[y][x] = regionId === "mountains" ? 2 : 1;
        if (dx === 0 && dy === 0) {
          // Decorative crest rocks only — faces come from wall caster
          sprites.push({
            x: x + 0.5, y: y + 0.35, kind: "prop", prop: kopjeRock,
            scale: worldScale(kopjeRock) * 0.7, bob: 0
          });
        } else if (!rnd(3)) {
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

    const rid = regionId;
    const trees = [rid + "_tree1", rid + "_tree2", rid + "_tree3"];
    const rocks = [rid + "_rock1", rid + "_rock2", rid + "_rock3", rid + "_rock4", rid + "_rock5"];
    const grasses = [rid + "_grass1", rid + "_grass2", rid + "_grass3"];
    const bushes = [rid + "_bush1", rid + "_bush2"];
    // Dense SNES outdoor packing — carpet + clustered canopy
    function placeCluster(kinds, count, radius) {
      const cx = 4 + Math.random() * (MAP - 8);
      const cy = 4 + Math.random() * (MAP - 8);
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const rad = Math.random() * radius;
        const x = cx + Math.cos(ang) * rad;
        const y = cy + Math.sin(ang) * rad;
        if (!openSpot(x, y)) continue;
        const kind = kinds[rnd(kinds.length)];
        sprites.push({
          x: x, y: y, kind: "prop", prop: kind,
          scale: worldScale(kind) * (0.8 + Math.random() * 0.45), bob: 0
        });
      }
    }
    const treeClusters = rid === "jungle" ? 10 : (rid === "mountains" ? 8 : 7);
    for (let c = 0; c < treeClusters; c++) placeCluster(trees, rid === "jungle" ? 7 : 5, 3.2);
    for (let i = 0; i < 18; i++) placeProp(rocks[rnd(rocks.length)]);
    // Grass carpet grid
    for (let gy = 2; gy < MAP - 2; gy += 1) {
      for (let gx = 2; gx < MAP - 2; gx += 1) {
        if (wall[gy][gx] || floor[gy][gx] === 3) continue;
        if (Math.random() > (rid === "jungle" ? 0.55 : 0.42)) continue;
        const x = gx + 0.2 + Math.random() * 0.6;
        const y = gy + 0.2 + Math.random() * 0.6;
        if (Math.hypot(x - 4.5, y - 4.5) < 2.2) continue;
        const kind = Math.random() < 0.35 ? bushes[rnd(bushes.length)] : grasses[rnd(grasses.length)];
        sprites.push({
          x: x, y: y, kind: "prop", prop: kind,
          scale: worldScale(kind) * (0.55 + Math.random() * 0.55), bob: 0
        });
      }
    }
    if (rid === "wetlands") {
      for (let i = 0; i < 28; i++) placeProp("wetlands_grass3");
      for (let i = 0; i < 18; i++) placeProp("wet_lily");
    }
    if (rid === "jungle") {
      for (let i = 0; i < 20; i++) placeProp("jungle_tree3");
    }
    if (rid === "mountains") {
      for (let i = 0; i < 16; i++) placeProp("mountains_tree2");
    }

    const rimRock = rocks[0];
    const rimTall = trees[0];
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
          scale: worldScale(propKind) * 1.65, bob: 0, landmark: true
        });
      }
    }
    if (regionId === "africa") {
      addLandmark("WATERING HOLE", 18.5, 12.5, "lm_watering_hole");
      addLandmark("KOPJE LOOKOUT", 26.5, 24.5, "rock");
      addLandmark("RANGER POST", 8.5, 18.5, "lm_ranger_post");
    } else if (regionId === "mountains") {
      addLandmark("SNOW OVERLOOK", 22.5, 10.5, "pine");
      addLandmark("RIDGE TRAIL", 12.5, 22.5, "snowrock");
      addLandmark("ICE CAIRN", 28.5, 18.5, "lm_cairn");
    } else if (regionId === "wetlands") {
      addLandmark("BOARDWALK", 10.5, 10.5, "lm_boardwalk");
      addLandmark("REED BLIND", 22.5, 18.5, "lm_reed_blind");
      addLandmark("OXBOW LAKE", 26.5, 12.5, "reed");
    } else {
      addLandmark("CANOPY GAP", 16.5, 16.5, "lm_canopy_gap");
      addLandmark("FERN THICKET", 27.5, 20.5, "fern");
      addLandmark("RIVER LOOKOUT", 8.5, 12.5, "tree");
    }
    // Scale anchors — tiny birds
    for (let b = 0; b < 8; b++) {
      const bx = 4 + seededRand(300 + b) * (MAP - 8);
      const by = 4 + seededRand(310 + b) * (MAP - 8);
      sprites.push({
        x: bx, y: by, kind: "prop", prop: "bird",
        scale: 0.22 + seededRand(320 + b) * 0.12, bob: seededRand(330 + b),
        bird: true
      });
    }

    const spotJitter = function (arr) {
      return arr.map(function (p, i) {
        const j = seededRand(20 + i);
        return [p[0] + (j - 0.5) * 2.5, p[1] + (seededRand(40 + i) - 0.5) * 2.5];
      });
    };
    animalsPlace(R, spotJitter([[17, 8], [28, 20], [10, 26], [24, 29], [20, 15]]));
    let rareXY = null;
    const rareBase = {
      africa: { x: 14.5, y: 22.5 },
      mountains: { x: 26.5, y: 14.5 },
      jungle: { x: 12.5, y: 24.5 },
      wetlands: { x: 20.5, y: 22.5 }
    };
    const rb = rareBase[regionId];
    if (rb) {
      rareXY = {
        x: rb.x + (seededRand(99) - 0.5) * 3,
        y: rb.y + (seededRand(101) - 0.5) * 3
      };
    }
    if (regionId === "africa" && window.PO_BONUS && PO_BONUS.honeybadger) {
      spawnAnimal(PO_BONUS.honeybadger, rareXY.x, rareXY.y, true);
    }
    if (regionId === "mountains" && window.PO_BONUS && PO_BONUS.lynx) {
      spawnAnimal(PO_BONUS.lynx, rareXY.x, rareXY.y, true);
    }
    if (regionId === "jungle" && window.PO_BONUS && PO_BONUS.ocelot) {
      spawnAnimal(PO_BONUS.ocelot, rareXY.x, rareXY.y, true);
    }
    if (regionId === "wetlands" && window.PO_BONUS && PO_BONUS.manatee) {
      spawnAnimal(PO_BONUS.manatee, rareXY.x, rareXY.y, true);
    }
    placeFieldNotes(regionId);
    // Track/scat props near animals
    sprites.filter(function (s) { return s.kind === "animal" && !s.herdSil; }).forEach(function (a) {
      if (Math.random() > 0.55) return;
      const tx = a.x + (Math.random() - 0.5) * 2.2;
      const ty = a.y + (Math.random() - 0.5) * 2.2;
      if (!openSpot(tx, ty)) return;
      sprites.push({
        x: tx, y: ty, kind: "prop", prop: "grass",
        scale: worldScale("grass") * 0.55, bob: 0, track: true,
        trackTint: a.rare ? "rare" : (a.id || "wild")
      });
    });
    // Rare hunt trail from camp toward rare
    if (rareXY) {
      for (let s = 1; s <= 7; s++) {
        const u = s / 8;
        const tx = 4.5 + (rareXY.x - 4.5) * u + (Math.random() - 0.5) * 0.4;
        const ty = 4.5 + (rareXY.y - 4.5) * u + (Math.random() - 0.5) * 0.4;
        if (wall[ty | 0] && wall[ty | 0][tx | 0]) continue;
        sprites.push({
          x: tx, y: ty, kind: "prop", prop: "grass",
          scale: worldScale("grass") * 0.4, bob: 0, track: true, rareTrack: true, trackTint: "rare"
        });
      }
    }

    // Dens / territory heat
    dens = [];
    sprites.filter(function (s) { return s.kind === "animal" && !s.rare && !s.herdSil; }).forEach(function (a, i) {
      if (seededRand(70 + i) > 0.55) return;
      const dx = a.x + (seededRand(80 + i) - 0.5) * 3;
      const dy = a.y + (seededRand(90 + i) - 0.5) * 3;
      dens.push({ x: dx, y: dy, owner: a.id });
      sprites.push({
        x: dx, y: dy, kind: "prop", prop: "rock",
        scale: worldScale("rock") * 0.5, bob: 0, den: true, track: true, trackTint: "den"
      });
      a.denX = dx; a.denY = dy;
    });
    // Distant herd billboards for scale
    herds = [];
    const herdIds = regionId === "africa" ? ["buffalo", "lion", "rhino"]
      : (regionId === "mountains" ? ["wolf", "cougar", "eagle"]
        : (regionId === "wetlands" ? ["hippo", "croc", "manatee"] : ["jaguar", "gorilla", "anaconda"]));
    for (let h = 0; h < 5; h++) {
      const hx = 8 + seededRand(110 + h) * (MAP - 16);
      const hy = 8 + seededRand(120 + h) * (MAP - 16);
      if (Math.hypot(hx - 4.5, hy - 4.5) < 8) continue;
      herds.push({ x: hx, y: hy });
      sprites.push({
        x: hx, y: hy, kind: "prop",
        prop: regionId === "mountains" ? "pine"
          : (regionId === "africa" ? "acacia"
            : (regionId === "wetlands" ? "reed" : "tree")),
        scale: worldScale("acacia") * 0.35, bob: 0, herd: true
      });
      const nSil = 3 + (seededRand(130 + h) * 3) | 0;
      for (let s = 0; s < nSil; s++) {
        sprites.push({
          x: hx + (seededRand(140 + h * 10 + s) - 0.5) * 2.2,
          y: hy + (seededRand(150 + h * 10 + s) - 0.5) * 2.2,
          kind: "animal",
          id: herdIds[s % herdIds.length],
          data: { name: "Distant herd", color: "#1a2018" },
          scale: worldScale(herdIds[s % herdIds.length]) * (0.35 + seededRand(160 + s) * 0.2),
          bob: 0, animT: Math.random() * 10, vx: 0, vy: 0, walkT: 99,
          face: seededRand(170 + s) > 0.5 ? 1 : -1,
          herdSil: true, alertT: 0, poseT: 0, gait: 0
        });
      }
    }
    if (regionId === "wetlands") {
      for (let r = 0; r < 18; r++) {
        const rx = 3 + seededRand(200 + r) * (MAP - 6);
        const ry = 3 + seededRand(210 + r) * (MAP - 6);
        const onWater = floor[ry | 0] && floor[ry | 0][rx | 0] === 3;
        if (!onWater && !openSpot(rx, ry)) continue;
        if (wall[ry | 0] && wall[ry | 0][rx | 0]) continue;
        sprites.push({
          x: rx, y: ry, kind: "prop", prop: "reed",
          scale: worldScale("grass") * (0.7 + seededRand(220 + r) * 0.5), bob: 0
        });
      }
    }

    // Binoculars cache near camp
    sprites.push({
      x: 6.2, y: 5.4, kind: "prop", prop: "rock",
      scale: worldScale("rock") * 0.45, bob: 0, binocs: true, track: false
    });

    player.x = 4.5;
    player.y = 4.5;
    player.dir = 0.4;
    player.pitch = 0;
    player.bob = 0;
    if (window.PO_SNES && PO_SNES.maps && PO_SNES.maps[regionId]) {
      const sm = PO_SNES.maps[regionId];
      player.x = sm.start[0];
      player.y = sm.start[1];
      let si = 0;
      sprites.forEach(function (sp) {
        if (sp.kind !== "animal" || sp.herdSil) return;
        if (si < sm.spawns.length) {
          sp.x = sm.spawns[si][0];
          sp.y = sm.spawns[si][1];
          si++;
        }
      });
      sprites = sprites.filter(function (sp) {
        return sp.kind !== "prop" || sp.track || sp.binocs || sp.den || (sp.kind === "note");
      });
      if (sm.landmarks && sm.landmarks.length) {
        landmarks = sm.landmarks.map(function (lm) {
          return { id: lm.id, label: lm.label || lm.id, x: lm.x, y: lm.y };
        });
      }
    }
    window.region = region;
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
      alertCd: 1 + Math.random() * 2,
      poseT: 0,
      nocturnal: !!(a.nocturnal || rare || a.id === "cougar" || a.id === "leopard" || a.id === "jaguar" || a.id === "wolf" || a.id === "snowleopard" || a.id === "lynx" || a.id === "ocelot" || a.id === "honeybadger")
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
    let list = (lines[regionId] || lines.africa).slice();
    if (regionId === "wetlands") {
      list = [
        "Boardwalk planks still wet from last tide.",
        "Reed stems bent where something heavy passed.",
        "Oxbow mud holds a perfect croc slide.",
        "Manatee graze lines spiral through clear water.",
        "Heron rookery chalks the far mangrove.",
        "Mosquito veil thick near still channels.",
        "Jaguar pugmark pressed in river silt.",
        "Ranger float tied off at the blind."
      ];
    }
    // Daily shuffle
    for (let i = list.length - 1; i > 0; i--) {
      const j = (seededRand(200 + i) * (i + 1)) | 0;
      const tmp = list[i]; list[i] = list[j]; list[j] = tmp;
    }
    notesTotal = list.length;
    notesFound = [];
    let placed = 0;
    for (let i = 0; i < list.length; i++) {
      for (let tries = 0; tries < 50; tries++) {
        const x = 3 + seededRand(300 + i * 10 + tries) * (MAP - 6);
        const y = 3 + seededRand(400 + i * 10 + tries) * (MAP - 6);
        if (wall[y | 0][x | 0] || floor[y | 0][x | 0] === 3) continue;
        if (Math.hypot(x - 4.5, y - 4.5) < 3) continue;
        sprites.push({
          x: x, y: y, kind: "note", noteId: regionId + "-" + i,
          text: list[i], scale: 0.35, bob: seededRand(50 + i) * 6, taken: false
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
    if (window.PO_SNES && PO_SNES.enabled && PO_SNES.maps && PO_SNES.wetWorld) {
      return PO_SNES.wetWorld(x, y);
    }
    const ix = x | 0, iy = y | 0;
    if (ix < 0 || iy < 0 || ix >= MAP || iy >= MAP) return true;
    return floor[iy][ix] === 3;
  }

  function solidPropRadius(sp) {
    if (!sp || sp.kind !== "prop") return 0;
    const p = sp.prop || "";
    if (p.indexOf("_grass") >= 0 || p.indexOf("_bush") >= 0 || p === "grass" || p === "fern" || p === "bush" || p === "reed" || p === "africa_thorn" || p === "wet_lily" || p === "bird" || p === "bug" || sp.track || sp.binocs || sp.den || sp.herd || sp.bird) return 0;
    if (p.indexOf("lm_") === 0) return 0.5;
    if (p.indexOf("_tree") >= 0 || p === "acacia" || p === "baobab" || p === "pine" || p === "tree" || p === "jungle_vine" || p === "mtn_fir") return 0.42;
    if (p === "wallafrica" || p === "walljungle" || p === "wallmountains") return 0.55;
    if (p.indexOf("_rock") >= 0 || p === "rock" || p === "snowrock") return 0.38;
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
    if (window.PO_SNES && PO_SNES.enabled && PO_SNES.maps) {
      return PO_SNES.solidWorld(x, y);
    }
    // Water is wadeable (slowed in movePlayer); only walls/props block hard
    return blocked(x, y) || propBlocked(x, y);
  }

  function animalBlocked(x, y, sp) {
    if (window.PO_SNES && PO_SNES.enabled && PO_SNES.maps) {
      if (PO_SNES.solidWorld(x, y)) return !(sp && sp.waterLove);
      return false;
    }
    if (blocked(x, y) || propBlocked(x, y)) return true;
    if (sp && sp.waterLove) return false;
    return wet(x, y);
  }

  function worldBounds() {
    if (window.PO_SNES && PO_SNES.enabled && PO_SNES.current && PO_SNES.current()) {
      const m = PO_SNES.current();
      return { min: 1.5, maxX: m.w - 1.5, maxY: m.h - 1.5 };
    }
    return { min: 1.5, maxX: MAP - 1.5, maxY: MAP - 1.5 };
  }

  function retargetAnimal(sp) {
    const dx = player.x - sp.x, dy = player.y - sp.y;
    const dist = Math.hypot(dx, dy) || 0.001;
    let ang = Math.random() * Math.PI * 2;
    let spd = (sp.speed || 0.55) * (0.75 + Math.random() * 0.5);
    const phase = dayPhase();
    if (sp.poseT > 0) {
      sp.vx = 0; sp.vy = 0; sp.walkT = Math.max(sp.walkT, 0.35); return;
    }
    if (weather.kind === "snow" && region && region.id === "mountains") spd *= 0.72;
    if (weather.kind === "rain" && sp.waterLove) spd *= 1.25;
    if (weather.kind === "dust") spd *= 0.88;
    if ((phase.name === "night" || phase.name === "dusk") && sp.nocturnal) spd *= 1.28;
    if (phase.name === "day" && sp.nocturnal && !sp.waterLove) spd *= 0.72;

    if (sp.fleeDist > 0 && dist < sp.fleeDist) {
      ang = Math.atan2(sp.y - player.y, sp.x - player.x) + (Math.random() - 0.5) * 0.6;
      spd *= 1.45;
      sp.alertT = Math.max(sp.alertT, 0.8);
    } else if (sp.behavior === "ambush" && sp.aggroDist > 0 && dist < sp.aggroDist && dist > 1.2) {
      ang = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.4;
      spd *= 0.95;
    } else if (sp.behavior === "apex" && sp.aggroDist > 0 && dist < sp.aggroDist * 0.7) {
      ang = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.8;
      spd *= 1.1;
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
        if (pd > 2.8) { ang = Math.atan2(cy - sp.y, cx - sp.x); spd *= 1.05; }
        else if (pd < 1.1) ang = Math.atan2(sp.y - cy, sp.x - cx);
      }
    }

    if (sp.denX != null && Math.random() < 0.28) {
      const dd = Math.hypot(sp.denX - sp.x, sp.denY - sp.y);
      if (dd > 1.5) ang = Math.atan2(sp.denY - sp.y, sp.denX - sp.x);
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
      if (sp.herdSil) {
        sp.animT = (sp.animT || 0) + dt;
        sp.bob = Math.sin(sp.animT * 1.2 + i) * 0.08;
        sp.walkFrame = ((sp.animT * 1.4) | 0) % 2;
        continue;
      }
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
      if (sp.alertT > 0.35) sp.walkFrame = 6;
      else if (moving) sp.walkFrame = 2 + ((((sp.gait / (Math.PI / 2)) | 0) % 4 + 4) % 4);
      else sp.walkFrame = ((sp.animT * 1.7) | 0) % 2;
      const pdist = Math.hypot(player.x - sp.x, player.y - sp.y);
      if (sp.alertT > 0) sp.alertT -= dt;
      if (sp.poseT > 0) {
        sp.poseT -= dt;
        sp.vx = 0; sp.vy = 0;
        sp.bob = Math.sin(sp.animT * 3) * 0.08;
        sp.squash = 1.05;
        sp.walkFrame = 6;
        continue;
      }
      sp.alertCd = (sp.alertCd || 0) - dt;
      if (pdist < 4.2 && sp.alertCd <= 0 && mode === "explore") {
        sp.alertT = 1.4;
        sp.alertCd = 5 + Math.random() * 4;
        animalReact(sp);
        if (sp.fleeDist > 0) retargetAnimal(sp);
      }
      let moveMul = 1;
      if (weather.kind === "snow" && region && region.id === "mountains") moveMul *= 0.78;
      if (weather.kind === "rain" && sp.waterLove) moveMul *= 1.2;
      const nx = sp.x + sp.vx * dt * moveMul;
      const ny = sp.y + sp.vy * dt * moveMul;
      let hitX = false, hitY = false;
      if (!animalBlocked(nx, sp.y, sp)) sp.x = nx;
      else {
        hitX = true;
        sp.vx *= -1;
        if (Math.abs(sp.vx) > 0.05) sp.face = sp.vx < 0 ? -1 : 1;
      }
      if (!animalBlocked(sp.x, ny, sp)) sp.y = ny;
      else {
        hitY = true;
        sp.vy *= -1;
      }
      // Cornered / jammed against solids → pick a new wander heading (stops run-in-place)
      if ((hitX && hitY) || (hitX || hitY) && Math.hypot(sp.vx, sp.vy) < 0.12) {
        sp.walkT = 0;
      } else if (hitX || hitY) {
        sp.walkT = Math.min(sp.walkT, 0.35);
      }
      const wb = worldBounds();
      sp.x = clamp(sp.x, wb.min, wb.maxX);
      sp.y = clamp(sp.y, wb.min, wb.maxY);
      // Actual travel this frame — used by SNES draw for walk vs idle
      sp._moved = Math.hypot(sp.x - (sp._lx || sp.x), sp.y - (sp._ly || sp.y));
      sp._lx = sp.x; sp._ly = sp.y;
      if (sp.herdSil) continue;
      // Dynamic fading prints
      if (moving && Math.hypot(sp.x - (sp._px || sp.x), sp.y - (sp._py || sp.y)) > 0.55) {
        sp._px = sp.x; sp._py = sp.y;
        if (sprites.length < 220) {
          sprites.push({
            x: sp.x - sp.vx * 0.15, y: sp.y - sp.vy * 0.15,
            kind: "prop", prop: "grass",
            scale: worldScale("grass") * 0.28, bob: 0,
            track: true, fadeTrack: true, life: 4.5 + Math.random(),
            trackTint: sp.rare ? "rare" : (sp.id || "wild")
          });
        }
      } else if (!sp._px) { sp._px = sp.x; sp._py = sp.y; }
    }
    // Fade old prints
    for (let i = sprites.length - 1; i >= 0; i--) {
      const tr = sprites[i];
      if (!tr.fadeTrack) continue;
      tr.life -= dt;
      if (tr.life <= 0) {
        sprites[i] = sprites[sprites.length - 1];
        sprites.pop();
      }
    }
  }

  function tryPickupNotes() {
    for (let i = 0; i < sprites.length; i++) {
      const sp = sprites[i];
      if (sp.binocs && !binocsOwned && Math.hypot(sp.x - player.x, sp.y - player.y) < 1.4) {
        binocsOwned = true;
        sp.binocs = false;
        blip(700, 0.12, "sine");
        if (ui.hint) ui.hint.textContent = "Binoculars found — hold B or Binoc to zoom & ID";
        if (ui.binocsBtn) ui.binocsBtn.hidden = false;
        persistProgress();
      }
    }
    for (let i = 0; i < sprites.length; i++) {
      const sp = sprites[i];
      if (sp.kind !== "note" || sp.taken) continue;
      if (Math.hypot(sp.x - player.x, sp.y - player.y) > 1.35) continue;
      sp.taken = true;
      notesFound.push({ id: sp.noteId, text: sp.text });
      noteFlash = 1.8;
      blip(660, 0.1, "triangle");
      haptic(25);
      progressStamp = t;
      stuckIdle = 0;
      syncQuest();
      if (tourStep === 1) {
        tourStep = 2;
        if (ui.hint) ui.hint.textContent = "Tour: tap a nearby animal for its parchment dossier";
      }
      syncNotesUI();
      persistProgress();
      syncObjectives();
      checkRegionVictory();
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
    setAudioDuck(true);
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
    setAudioDuck(false);
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

  // Smoothed top-down velocity (SNES + raycast share this)
  player.vx = player.vx || 0;
  player.vy = player.vy || 0;

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
    if (autoWalk && mode === "explore") {
      let tx = null, ty = null;
      sprites.forEach(function (sp) {
        if (sp.kind === "note" && !sp.taken) {
          if (tx == null || Math.hypot(sp.x - player.x, sp.y - player.y) < Math.hypot(tx - player.x, ty - player.y)) {
            tx = sp.x; ty = sp.y;
          }
        }
      });
      if (tx == null) {
        landmarks.forEach(function (lm) {
          if (landmarksVisited[lm.id || lm.label]) return;
          if (tx == null || Math.hypot(lm.x - player.x, lm.y - player.y) < Math.hypot(tx - player.x, ty - player.y)) {
            tx = lm.x; ty = lm.y;
          }
        });
      }
      if (tx != null) {
        const ang = Math.atan2(ty - player.y, tx - player.x);
        let diff = ang - player.dir;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        turn += clamp(diff * 1.8, -1, 1);
        fwd += 0.85;
      }
    }
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
    let c = Math.cos(player.dir), s = Math.sin(player.dir);
    let wishX = 0, wishY = 0;
    if (window.PO_SNES && PO_SNES.enabled && PO_SNES.maps) {
      // Top-down: WASD is world-relative
      wishX = strafe;
      wishY = -fwd;
      const wishLen = Math.hypot(wishX, wishY);
      if (wishLen > 0.01) {
        player.dir = Math.atan2(wishY, wishX);
        wishX /= wishLen;
        wishY /= wishLen;
      } else {
        wishX = wishY = 0;
      }
      c = Math.cos(player.dir);
      s = Math.sin(player.dir);
    } else {
      wishX = c * fwd + -s * strafe;
      wishY = s * fwd + c * strafe;
      const wl = Math.hypot(wishX, wishY);
      if (wl > 1) { wishX /= wl; wishY /= wl; }
    }
    let spMul = 1;
    if (wet(player.x, player.y)) spMul *= 0.72; // wade — was 0.48 (felt stuck)
    if (weather.kind === "snow") spMul *= 0.88;
    else if (weather.kind === "dust") spMul *= 0.92;
    else if (weather.kind === "rain") spMul *= 0.94;
    else if (weather.kind) spMul *= 0.9;
    const maxSp = 3.85 * spMul; // snappier top speed (v49 felt held back)
    // Quick accel; still a soft stop so it isn't on/off stiff
    if (wishX || wishY) {
      const blend = Math.min(1, 22 * dt);
      player.vx += (wishX * maxSp - player.vx) * blend;
      player.vy += (wishY * maxSp - player.vy) * blend;
    } else {
      const fr = Math.exp(-22 * dt);
      player.vx *= fr;
      player.vy *= fr;
      if (Math.hypot(player.vx, player.vy) < 0.08) { player.vx = 0; player.vy = 0; }
    }
    const mx = player.vx * dt;
    const my = player.vy * dt;
    // Lighter look-ahead so trees don't "grab" the Agent
    if (!playerBlocked(player.x + mx * 1.15, player.y)) player.x += mx;
    else player.vx *= 0.15;
    if (!playerBlocked(player.x, player.y + my * 1.15)) player.y += my;
    else player.vy *= 0.15;
    {
      const wb = worldBounds();
      player.x = clamp(player.x, wb.min, wb.maxX);
      player.y = clamp(player.y, wb.min, wb.maxY);
    }
    const movingNow = Math.hypot(player.vx, player.vy) > 0.12;
    player._snesMoving = movingNow;
    if (movingNow) {
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
    updateCaution();
    revealMiniFog(player.x, player.y, 5.5);
  }

  function revealMiniFog(wx, wy, rad) {
    if (!miniExplored) return;
    const r = rad | 0;
    const cx = wx | 0, cy = wy | 0;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > rad * rad) continue;
        const x = cx + dx, y = cy + dy;
        if (y < 0 || x < 0 || y >= miniExplored.length || x >= miniExplored[0].length) continue;
        miniExplored[y][x] = 1;
      }
    }
  }

  function updateCaution() {
    let threat = 0;
    const near = difficulty === "kids" ? 1.6 : 2.2;
    const mid = difficulty === "kids" ? 3.2 : 4.2;
    const far = difficulty === "kids" ? 5.0 : 6.5;
    for (let i = 0; i < sprites.length; i++) {
      const sp = sprites[i];
      if (sp.kind !== "animal") continue;
      const d = Math.hypot(sp.x - player.x, sp.y - player.y);
      const dangerous = sp.behavior === "apex" || sp.behavior === "ambush" || sp.aggroDist > 0;
      if (!dangerous) continue;
      if (d < near) threat = Math.max(threat, 1);
      else if (d < mid) threat = Math.max(threat, 0.55);
      else if (d < far) threat = Math.max(threat, 0.25);
    }
    cautionLevel = threat;
    if (ui.cautionEl) {
      if (threat >= 0.9) {
        ui.cautionEl.hidden = false;
        ui.cautionEl.textContent = "Caution — too close";
        ui.cautionEl.className = "po-caution hot";
        if (threat > cautionLevel) haptic(30);
      } else if (threat >= 0.4) {
        ui.cautionEl.hidden = false;
        ui.cautionEl.textContent = "Caution — wildlife near";
        ui.cautionEl.className = "po-caution warm";
      } else {
        ui.cautionEl.hidden = true;
      }
    }
  }

  function updateScripted(dt) {
    if (mode !== "explore" || !region) return;
    scriptEvent.cd -= dt;
    if (scriptEvent.t > 0) {
      scriptEvent.t -= dt;
      if (scriptEvent.t <= 0) scriptEvent.id = null;
      return;
    }
    if (scriptEvent.cd > 0) return;
    scriptEvent.cd = 18 + Math.random() * 22;
    const pool = [];
    sprites.forEach(function (sp) {
      if (sp.kind !== "animal") return;
      if (sp.id === "hippo") pool.push("hippo");
      if (sp.id === "eagle") pool.push("eagle");
      if (sp.rare) pool.push("rare");
      if (sp.id === "croc" || sp.id === "anaconda") pool.push("rise");
    });
    if (!pool.length) return;
    const pick = pool[(Math.random() * pool.length) | 0];
    scriptEvent.id = pick;
    scriptEvent.t = 4.5;
    sprites.forEach(function (sp) {
      if (sp.kind !== "animal") return;
      if (pick === "hippo" && sp.id === "hippo") {
        sp.poseT = 3.5; sp.bob = 0.8; sp.alertT = 2;
        if (ui.hint) ui.hint.textContent = "Moment: a hippo rises from the channel…";
      }
      if (pick === "eagle" && sp.id === "eagle") {
        sp.behavior = "soar"; sp.poseT = 0; sp.vx *= 1.4; sp.vy *= 1.4; sp.alertT = 2;
        if (ui.hint) ui.hint.textContent = "Moment: an eagle circles the thermal…";
      }
      if (pick === "rare" && sp.rare) {
        sp.alertT = 2.5; sp.poseT = 2.2;
        if (ui.hint) ui.hint.textContent = "Moment: rare sign — dust clears on a silhouette…";
      }
      if (pick === "rise" && (sp.id === "croc" || sp.id === "anaconda")) {
        sp.poseT = 2.8; sp.bob = 0.55;
        if (ui.hint) ui.hint.textContent = "Moment: something heavy shifts in the water…";
      }
    });
    animalReact({ behavior: pick === "eagle" ? "soar" : "apex" });
  }

  function updateStuck(dt) {
    if (mode !== "explore") return;
    stuckIdle += dt;
    if (stuckIdle > 90 && notesFound.length < notesTotal) {
      stuckIdle = 0;
      if (ui.hint) ui.hint.textContent = "Stuck? Hold FOCUS (V) — compass marks your next goal";
    }
  }

  function nearWater(mx, my) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = mx + dx, y = my + dy;
      if (x < 0 || y < 0 || x >= MAP || y >= MAP) continue;
      if (floor[y][x] === 3) return true;
    }
    return false;
  }
  function nearWallSoft(mx, my) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const x = mx + dx, y = my + dy;
      if (x < 0 || y < 0 || x >= MAP || y >= MAP) continue;
      if (wall[y] && wall[y][x]) return true;
    }
    return false;
  }
  function floorRgbAt(fx, fy, fog) {
    const R = region;
    const phase = dayPhase();
    const mx = fx | 0, my = fy | 0;
    const cell = (mx >= 0 && my >= 0 && mx < MAP && my < MAP) ? floor[my][mx] : 1;
    const n = ((mx * 13 + my * 29) ^ ((fx * 8 | 0) * 7 + (fy * 8 | 0))) & 7;
    let shimmer = 1;
    const wetShore = cell !== 3 && nearWater(mx, my);
    if (cell === 3) {
      shimmer = 0.82 + 0.18 * Math.sin(t * 3.2 + fx * 4.2 + fy * 2.4)
        + 0.08 * Math.sin(t * 7.1 + fx * 9 + fy * 6);
    }
    if (cell === 2 && R.snow) shimmer = 0.92 + 0.1 * Math.sin(t * 3 + fx * 5 + n);
    if (wetShore) shimmer *= 0.9 + 0.08 * Math.sin(t * 2.5 + fx + fy);
    fog *= phase.light * shimmer;
    let ao = 1;
    if (nearWallSoft(mx, my)) ao *= 0.78;
    if (season === "wet" && cell !== 3) ao *= 0.92;
    if (season === "dry" && R.id === "africa" && cell === 1) ao *= 1.05;
    const tex = remoteGround[R.id];
    const wFrames = remoteGround._waterFrames;
    const waterTex = (wFrames && wFrames.length)
      ? wFrames[((t * 2.2) | 0) % wFrames.length]
      : remoteGround._water;
    if (cell === 3) {
      let r, g, b;
      if (waterTex) {
        let u = ((fx * TEX * 1.4 + t * 6) % TEX + TEX) % TEX | 0;
        let v = ((fy * TEX * 1.4 + Math.sin(t + fx) * 4) % TEX + TEX) % TEX | 0;
        const i = (v * TEX + u) * 4;
        r = waterTex.data[i]; g = waterTex.data[i + 1]; b = waterTex.data[i + 2];
      } else {
        const c = hexRgb(R.water || "#2a6a7a");
        r = c[0]; g = c[1]; b = c[2];
      }
      const spec = clamp(0.55 + 0.45 * Math.sin(t * 5 + fx * 8 + fy * 5), 0, 1);
      const skyMix = 0.18 + 0.22 * phase.light * spec;
      r = (r * (1 - skyMix) + 180 * skyMix * phase.tint[0]) | 0;
      g = (g * (1 - skyMix) + 210 * skyMix * phase.tint[1]) | 0;
      b = (b * (1 - skyMix) + 230 * skyMix * phase.tint[2]) | 0;
      if (spec > 0.85) { r = Math.min(255, r + 40); g = Math.min(255, g + 50); b = Math.min(255, b + 55); }
      return [
        (r * fog * ao * phase.tint[0]) | 0,
        (g * fog * ao * phase.tint[1]) | 0,
        (b * fog * ao * phase.tint[2]) | 0
      ];
    }
    if (tex) {
      // Dense SNES tile repeat — blades/dirt readable at feet
      let u = ((fx * TEX) % TEX + TEX) % TEX | 0;
      let v = ((fy * TEX) % TEX + TEX) % TEX | 0;
      const i = (v * TEX + u) * 4;
      let r = tex.data[i], g = tex.data[i + 1], b = tex.data[i + 2];
      if (cell === 2 || cell === 0) { r = (r * 0.75) | 0; g = (g * 0.7) | 0; b = (b * 0.55) | 0; }
      if (R.id === "jungle" && cell === 2) { r = (r * 0.55) | 0; g = (g * 0.7) | 0; b = (b * 0.55) | 0; }
      if (wetShore) { r = (r * 0.55) | 0; g = (g * 0.65) | 0; b = Math.min(255, (b * 0.9 + 40) | 0); }
      if (R.id === "wetlands") { r = (r * 0.7) | 0; g = (g * 0.85) | 0; b = Math.min(255, (b * 0.95 + 18) | 0); }
      // Floor decals (mud / leaf / crack / lily)
      const dk = ((mx * 17 + my * 31) & 15);
      if (dk === 3 && remoteDecal.mud) {
        const du = ((fx * 32) % 32 + 32) % 32 | 0, dv = ((fy * 32) % 32 + 32) % 32 | 0;
        const di = (dv * 32 + du) * 4, dd = remoteDecal.mud.data;
        if (dd[di + 3] > 40) { r = (r * 0.55 + dd[di] * 0.45) | 0; g = (g * 0.55 + dd[di + 1] * 0.45) | 0; b = (b * 0.55 + dd[di + 2] * 0.45) | 0; }
      } else if (dk === 7 && R.id === "jungle" && remoteDecal.leaf) {
        const du = ((fx * 32) % 32 + 32) % 32 | 0, dv = ((fy * 32) % 32 + 32) % 32 | 0;
        const di = (dv * 32 + du) * 4, dd = remoteDecal.leaf.data;
        if (dd[di + 3] > 40) { r = (r * 0.5 + dd[di] * 0.5) | 0; g = (g * 0.5 + dd[di + 1] * 0.5) | 0; b = (b * 0.5 + dd[di + 2] * 0.5) | 0; }
      } else if (dk === 11 && R.id === "wetlands" && remoteDecal.lily) {
        const du = ((fx * 32) % 32 + 32) % 32 | 0, dv = ((fy * 32) % 32 + 32) % 32 | 0;
        const di = (dv * 32 + du) * 4, dd = remoteDecal.lily.data;
        if (dd[di + 3] > 40) { r = (r * 0.45 + dd[di] * 0.55) | 0; g = (g * 0.45 + dd[di + 1] * 0.55) | 0; b = (b * 0.45 + dd[di + 2] * 0.55) | 0; }
      } else if (dk === 1 && R.id === "africa" && remoteDecal.crack) {
        const du = ((fx * 32) % 32 + 32) % 32 | 0, dv = ((fy * 32) % 32 + 32) % 32 | 0;
        const di = (dv * 32 + du) * 4, dd = remoteDecal.crack.data;
        if (dd[di + 3] > 40) { r = (r * 0.65) | 0; g = (g * 0.65) | 0; b = (b * 0.65) | 0; }
      }
      return [
        (r * fog * ao * phase.tint[0]) | 0,
        (g * fog * ao * phase.tint[1]) | 0,
        (b * fog * ao * phase.tint[2]) | 0
      ];
    }
    let hex;
    if (cell === 2) hex = R.id === "mountains" ? "#c8d4e0" : (R.path || "#8a6b35");
    else if (cell === 0) hex = R.path || "#8a6b35";
    else {
      hex = R.ground[n % R.ground.length];
      if (R.id === "jungle") hex = n > 5 ? "#1a4a20" : "#163416";
      if (R.id === "africa" && n < 3) hex = n === 0 ? "#6a8a30" : "#9a7a38";
      if (R.id === "wetlands") hex = n > 4 ? "#1a4a38" : "#245848";
    }
    const grit = 0.9 + (n / 7) * 0.14;
    const c = hexRgb(hex);
    let r = c[0], g = c[1], b = c[2];
    if (wetShore) { r = (r * 0.55) | 0; g = (g * 0.65) | 0; b = Math.min(255, (b * 0.9 + 40) | 0); }
    return [
      (r * fog * grit * ao * phase.tint[0]) | 0,
      (g * fog * grit * ao * phase.tint[1]) | 0,
      (b * fog * grit * ao * phase.tint[2]) | 0
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
      ctx.imageSmoothingEnabled = false;
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
    // Celestial disc
    const dayU = ((dayT / 120) % 1 + 1) % 1;
    const celX = (W * (0.12 + dayU * 0.76) + Math.cos(player.dir) * 18) % W;
    const celY = horizon * (0.18 + Math.sin(Math.min(1, dayU * 1.15) * Math.PI) * 0.42);
    if (phase.name === "night") {
      ctx.fillStyle = "rgba(220,230,255," + (0.55 + phase.light * 0.2) + ")";
      ctx.beginPath(); ctx.arc(celX, celY, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(200,220,255,0.12)";
      ctx.beginPath(); ctx.arc(celX, celY, 22, 0, Math.PI * 2); ctx.fill();
    } else {
      const sunA = phase.name === "dawn" || phase.name === "dusk" ? 0.95 : 0.75;
      ctx.fillStyle = phase.name === "dusk" ? ("rgba(255,140,60," + sunA + ")") : ("rgba(255,230,150," + sunA + ")");
      ctx.beginPath(); ctx.arc(celX, Math.max(8, celY), phase.name === "day" ? 12 : 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,200,100,0.12)";
      ctx.beginPath(); ctx.arc(celX, Math.max(8, celY), 28, 0, Math.PI * 2); ctx.fill();
    }
    // SNES midground layer only (no crude polygon silhouette)
    const para = remoteParallax[R.id];
    if (para) {
      const pscroll = ((player.dir * 80) % para.width + para.width) % para.width;
      const ph = Math.min(horizon * 0.55, para.height);
      ctx.globalAlpha = 0.85;
      ctx.drawImage(para, -pscroll, horizon - ph, para.width, ph);
      ctx.drawImage(para, -pscroll + para.width, horizon - ph, para.width, ph);
      ctx.globalAlpha = 1;
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
    const phase = dayPhase();
    const duskFly = phase.name === "dusk" || phase.name === "night";
    const want = R.id === "mountains" ? 28 : (R.id === "jungle" ? 20 : (R.id === "wetlands" ? 24 : 16))
      + (duskFly ? 10 : 0);
    while (particles.length < want) {
      const fly = duskFly && Math.random() < 0.45;
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: fly ? (Math.random() - 0.5) * 30 : (Math.random() - 0.5) * (R.id === "mountains" ? 18 : 10),
        vy: fly ? (Math.random() - 0.5) * 20
          : (R.id === "mountains" ? (20 + Math.random() * 35)
            : (R.id === "jungle" ? 25 + Math.random() * 40
              : (R.id === "wetlands" ? -8 - Math.random() * 18 : (Math.random() - 0.5) * 12))),
        life: 1 + Math.random() * 2,
        kind: fly ? "firefly" : R.id
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
      if (p.kind === "firefly") {
        const pulse = 0.35 + 0.65 * Math.abs(Math.sin(t * 6 + p.x));
        ctx.fillStyle = "rgba(220,255,140," + (a * pulse) + ")";
        ctx.fillRect(p.x | 0, p.y | 0, 2, 2);
      } else if (p.kind === "mountains") {
        ctx.fillStyle = "rgba(230,240,255," + a + ")";
        ctx.fillRect(p.x | 0, p.y | 0, 2, 2);
      } else if (p.kind === "jungle") {
        ctx.fillStyle = "rgba(140,200,160," + (a * 0.7) + ")";
        ctx.fillRect(p.x | 0, p.y | 0, 1, 3);
      } else if (p.kind === "wetlands") {
        ctx.fillStyle = "rgba(180,220,200," + (a * 0.45) + ")";
        ctx.fillRect(p.x | 0, p.y | 0, 2, 2);
      } else {
        ctx.fillStyle = "rgba(210,180,100," + (a * 0.5) + ")";
        ctx.fillRect(p.x | 0, p.y | 0, 2, 1);
      }
    }
  }

  function drawPropBillboard(ctx2, prop, size) {
    // Map SMB3 variant ids onto classic procedural silhouettes
    if (prop.indexOf("_tree") >= 0) {
      if (prop.indexOf("africa") === 0) prop = prop.indexOf("2") >= 0 ? "baobab" : "acacia";
      else if (prop.indexOf("mountains") === 0) prop = "pine";
      else if (prop.indexOf("wetlands") === 0) prop = "acacia";
      else prop = "tree";
    } else if (prop.indexOf("_rock") >= 0) {
      prop = prop.indexOf("mountains") === 0 ? "snowrock" : "rock";
    } else if (prop.indexOf("_grass") >= 0) {
      prop = prop.indexOf("wetlands") === 0 && prop.indexOf("3") >= 0 ? "reed" : "grass";
    } else if (prop.indexOf("_bush") >= 0) {
      prop = "bush";
    }
    const s = size;
    const px = function (x, y, w, h, col) {
      ctx2.fillStyle = col;
      ctx2.fillRect(x, y, Math.max(1, w), Math.max(1, h));
    };
    ctx2.fillStyle = "rgba(0,0,0,0.32)";
    ctx2.beginPath();
    ctx2.ellipse(s * 0.5, s * 0.93, s * 0.34, s * 0.08, 0, 0, Math.PI * 2);
    ctx2.fill();
    if (prop === "acacia" || prop === "baobab" || prop === "tree" || prop === "jungle_vine") {
      const thick = prop === "baobab" ? 0.18 : 0.1;
      px(s * (0.5 - thick / 2), s * 0.4, s * thick, s * 0.52, "#2a1a08");
      px(s * (0.5 - thick / 2 + 0.02), s * 0.4, s * (thick - 0.04), s * 0.52, "#4a3214");
      for (let y = 0.42; y < 0.9; y += 0.04) px(s * (0.5 - thick / 2), s * y, s * thick, 1, "#1a1006");
      ctx2.strokeStyle = "#2a1a08";
      ctx2.lineWidth = Math.max(2, s * 0.035);
      ctx2.beginPath();
      ctx2.moveTo(s * 0.5, s * 0.48); ctx2.lineTo(s * 0.2, s * 0.28);
      ctx2.moveTo(s * 0.5, s * 0.5); ctx2.lineTo(s * 0.8, s * 0.26);
      ctx2.moveTo(s * 0.5, s * 0.55); ctx2.lineTo(s * 0.15, s * 0.42);
      ctx2.moveTo(s * 0.5, s * 0.52); ctx2.lineTo(s * 0.85, s * 0.4);
      ctx2.stroke();
      const clusters = prop === "acacia"
        ? [[0.5, 0.28, 0.4, 0.14, "#2a6a34"], [0.32, 0.26, 0.18, 0.1, "#3a8a44"], [0.68, 0.25, 0.2, 0.1, "#1a5a28"], [0.5, 0.22, 0.16, 0.08, "#4aaa50"]]
        : (prop === "baobab"
          ? [[0.5, 0.28, 0.3, 0.26, "#5a3a18"], [0.35, 0.22, 0.16, 0.14, "#6a4a22"], [0.65, 0.24, 0.16, 0.14, "#4a2a10"]]
          : [[0.5, 0.22, 0.26, 0.2, "#1a5a28"], [0.32, 0.3, 0.18, 0.16, "#2a7a38"], [0.7, 0.28, 0.18, 0.16, "#0a4020"],
             [0.42, 0.14, 0.14, 0.1, "#3a8a44"], [0.6, 0.16, 0.12, 0.1, "#1a5a28"], [0.5, 0.36, 0.2, 0.12, "#245830"]]);
      for (let i = 0; i < clusters.length; i++) {
        const c = clusters[i];
        ctx2.fillStyle = c[4];
        ctx2.beginPath();
        ctx2.ellipse(s * c[0], s * c[1], s * c[2], s * c[3], 0, 0, Math.PI * 2);
        ctx2.fill();
      }
      for (let i = 0; i < 18; i++) px(s * (0.25 + (i % 6) * 0.08), s * (0.14 + ((i / 6) | 0) * 0.08), 2, 2, "rgba(160,220,100,0.5)");
      if (prop === "jungle_vine" || prop === "tree") {
        ctx2.strokeStyle = "#1a4a20";
        ctx2.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          ctx2.beginPath();
          ctx2.moveTo(s * (0.35 + i * 0.1), s * 0.4);
          ctx2.lineTo(s * (0.35 + i * 0.1 + 0.02), s * 0.75);
          ctx2.stroke();
        }
      }
    } else if (prop === "pine" || prop === "mtn_fir") {
      px(s * 0.46, s * 0.62, s * 0.08, s * 0.32, "#3a2a18");
      for (let i = 0; i < 5; i++) {
        ctx2.fillStyle = i % 2 ? "#1a4a28" : "#2a6a38";
        ctx2.beginPath();
        ctx2.moveTo(s * 0.5, s * (0.05 + i * 0.12));
        ctx2.lineTo(s * (0.1 + i * 0.04), s * (0.32 + i * 0.12));
        ctx2.lineTo(s * (0.9 - i * 0.04), s * (0.32 + i * 0.12));
        ctx2.fill();
      }
    } else if (prop === "reed" || prop === "fern" || prop === "grass" || prop === "bush" || prop === "africa_thorn") {
      if (prop === "bush") {
        const blobs = [[0.5, 0.55, 0.32], [0.3, 0.6, 0.2], [0.7, 0.58, 0.2], [0.5, 0.4, 0.18]];
        for (let i = 0; i < blobs.length; i++) {
          ctx2.fillStyle = ["#3a6a20", "#4a7a28", "#5a8a30", "#2a5a18"][i];
          ctx2.beginPath();
          ctx2.ellipse(s * blobs[i][0], s * blobs[i][1], s * blobs[i][2], s * blobs[i][2] * 0.7, 0, 0, Math.PI * 2);
          ctx2.fill();
        }
      } else {
        for (let i = 0; i < 12; i++) {
          const cols = prop === "fern" ? ["#1a6a38", "#2a8a50", "#3aaa60"]
            : (prop === "reed" ? ["#3a6a40", "#4a7a48", "#2a5a30"]
              : (prop === "africa_thorn" ? ["#8a7a30", "#6a5a20", "#9a8a40"] : ["#5a8a28", "#6a9a30", "#7aaa38"]));
          ctx2.fillStyle = cols[i % cols.length];
          const bx = s * (0.12 + i * 0.065);
          const bh = s * (0.4 + (i % 4) * 0.1);
          ctx2.beginPath();
          ctx2.moveTo(bx, s * 0.92);
          ctx2.quadraticCurveTo(bx + s * 0.02, s * 0.92 - bh * 0.5, bx + (i % 3 - 1) * s * 0.02, s * 0.92 - bh);
          ctx2.lineTo(bx + s * 0.04, s * 0.92);
          ctx2.fill();
          if (prop === "reed" || prop === "fern") {
            ctx2.beginPath();
            ctx2.ellipse(bx + s * 0.02, s * 0.92 - bh, s * 0.07, s * 0.04, 0, 0, Math.PI * 2);
            ctx2.fill();
          }
        }
      }
    } else if (prop === "wet_lily") {
      ctx2.fillStyle = "#2a6a40";
      ctx2.beginPath(); ctx2.ellipse(s * 0.5, s * 0.65, s * 0.4, s * 0.18, 0, 0, Math.PI * 2); ctx2.fill();
      ctx2.fillStyle = "#e8d070";
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        ctx2.beginPath();
        ctx2.ellipse(s * 0.5 + Math.cos(ang) * s * 0.1, s * 0.42 + Math.sin(ang) * s * 0.06, s * 0.06, s * 0.04, ang, 0, Math.PI * 2);
        ctx2.fill();
      }
      ctx2.fillStyle = "#d09020";
      ctx2.beginPath(); ctx2.arc(s * 0.5, s * 0.42, s * 0.04, 0, Math.PI * 2); ctx2.fill();
    } else if (prop === "bird") {
      ctx2.fillStyle = "#2a2a30";
      ctx2.beginPath(); ctx2.ellipse(s * 0.5, s * 0.5, s * 0.22, s * 0.12, 0, 0, Math.PI * 2); ctx2.fill();
      ctx2.fillStyle = "#c89030";
      ctx2.beginPath(); ctx2.moveTo(s * 0.28, s * 0.48); ctx2.lineTo(s * 0.18, s * 0.42); ctx2.lineTo(s * 0.28, s * 0.52); ctx2.fill();
      ctx2.fillStyle = "#f0f0e0";
      ctx2.beginPath(); ctx2.arc(s * 0.58, s * 0.45, 2, 0, Math.PI * 2); ctx2.fill();
    } else {
      const snow = prop === "snowrock";
      ctx2.fillStyle = snow ? "#a8b0b8" : "#5a5858";
      ctx2.beginPath();
      ctx2.moveTo(s * 0.15, s * 0.88);
      ctx2.lineTo(s * 0.22, s * 0.45);
      ctx2.lineTo(s * 0.4, s * 0.22);
      ctx2.lineTo(s * 0.62, s * 0.15);
      ctx2.lineTo(s * 0.82, s * 0.35);
      ctx2.lineTo(s * 0.9, s * 0.88);
      ctx2.closePath();
      ctx2.fill();
      ctx2.fillStyle = snow ? "#e8eef4" : "#8a8888";
      ctx2.beginPath();
      ctx2.moveTo(s * 0.22, s * 0.45);
      ctx2.lineTo(s * 0.4, s * 0.22);
      ctx2.lineTo(s * 0.55, s * 0.4);
      ctx2.lineTo(s * 0.35, s * 0.55);
      ctx2.closePath();
      ctx2.fill();
      ctx2.fillStyle = snow ? "#788090" : "#3a3838";
      ctx2.beginPath();
      ctx2.moveTo(s * 0.62, s * 0.15);
      ctx2.lineTo(s * 0.82, s * 0.35);
      ctx2.lineTo(s * 0.75, s * 0.6);
      ctx2.lineTo(s * 0.55, s * 0.4);
      ctx2.closePath();
      ctx2.fill();
      ctx2.strokeStyle = snow ? "#606878" : "#2a2828";
      ctx2.lineWidth = 1;
      ctx2.beginPath();
      ctx2.moveTo(s * 0.35, s * 0.4); ctx2.lineTo(s * 0.48, s * 0.7); ctx2.lineTo(s * 0.42, s * 0.85);
      ctx2.moveTo(s * 0.6, s * 0.35); ctx2.lineTo(s * 0.7, s * 0.75);
      ctx2.stroke();
      if (!snow) {
        ctx2.fillStyle = "rgba(45,100,45,0.55)";
        for (let i = 0; i < 6; i++) {
          ctx2.beginPath();
          ctx2.ellipse(s * (0.3 + i * 0.08), s * (0.7 + (i % 2) * 0.05), 4, 3, 0, 0, Math.PI * 2);
          ctx2.fill();
        }
      }
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
    ocelot: "https://i.postimg.cc/7P3YkKQM/leopard.jpg",
    manatee: "https://i.postimg.cc/1RG5QvYw/hippo.jpg"
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
  // manatee uses hippo art
  const REMOTE_GROUND = {
    africa: "https://i.postimg.cc/DZcRJ8N1/ground-africa.jpg",
    mountains: "https://i.postimg.cc/NMxZ95n1/ground-mountains.jpg",
    jungle: "https://i.postimg.cc/0QChMb4Y/ground-jungle.jpg",
    wetlands: "https://i.postimg.cc/0QChMb4Y/ground-jungle.jpg"
  };
  const REMOTE_SKY = {
    africa: "https://i.postimg.cc/Y9xTGhPN/sky-africa.jpg",
    mountains: "https://i.postimg.cc/XJgtGpPs/sky-mountains.jpg",
    jungle: "https://i.postimg.cc/Kz5CkRWq/sky-jungle.jpg",
    wetlands: "https://i.postimg.cc/Kz5CkRWq/sky-jungle.jpg"
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
    lynx: "assets/walk/lynx.png",
    ocelot: "assets/walk/ocelot.png",
    manatee: "assets/walk/manatee.png"
  };
  const LOCAL_PROPS = {
    acacia: "assets/props/acacia.png", baobab: "assets/props/baobab.png", pine: "assets/props/pine.png",
    tree: "assets/props/tree.png", reed: "assets/props/reed.png", fern: "assets/props/fern.png",
    grass: "assets/props/grass.png", bush: "assets/props/bush.png", rock: "assets/props/rock.png",
    snowrock: "assets/props/snowrock.png", africa_thorn: "assets/props/africa_thorn.png",
    jungle_vine: "assets/props/jungle_vine.png", wet_lily: "assets/props/wet_lily.png",
    mtn_fir: "assets/props/mtn_fir.png", bird: "assets/props/bird.png", bug: "assets/props/bug.png",
    wallafrica: "assets/props/wallafrica.png", walljungle: "assets/props/walljungle.png",
    wallmountains: "assets/props/wallmountains.png",
    africa_tree1: "assets/props/africa_tree1.png",
    africa_tree2: "assets/props/africa_tree2.png",
    africa_tree3: "assets/props/africa_tree3.png",
    africa_rock1: "assets/props/africa_rock1.png",
    africa_rock2: "assets/props/africa_rock2.png",
    africa_rock3: "assets/props/africa_rock3.png",
    africa_rock4: "assets/props/africa_rock4.png",
    africa_rock5: "assets/props/africa_rock5.png",
    africa_grass1: "assets/props/africa_grass1.png",
    africa_grass2: "assets/props/africa_grass2.png",
    africa_grass3: "assets/props/africa_grass3.png",
    africa_bush1: "assets/props/africa_bush1.png",
    africa_bush2: "assets/props/africa_bush2.png",
    mountains_tree1: "assets/props/mountains_tree1.png",
    mountains_tree2: "assets/props/mountains_tree2.png",
    mountains_tree3: "assets/props/mountains_tree3.png",
    mountains_rock1: "assets/props/mountains_rock1.png",
    mountains_rock2: "assets/props/mountains_rock2.png",
    mountains_rock3: "assets/props/mountains_rock3.png",
    mountains_rock4: "assets/props/mountains_rock4.png",
    mountains_rock5: "assets/props/mountains_rock5.png",
    mountains_grass1: "assets/props/mountains_grass1.png",
    mountains_grass2: "assets/props/mountains_grass2.png",
    mountains_grass3: "assets/props/mountains_grass3.png",
    mountains_bush1: "assets/props/mountains_bush1.png",
    mountains_bush2: "assets/props/mountains_bush2.png",
    jungle_tree1: "assets/props/jungle_tree1.png",
    jungle_tree2: "assets/props/jungle_tree2.png",
    jungle_tree3: "assets/props/jungle_tree3.png",
    jungle_rock1: "assets/props/jungle_rock1.png",
    jungle_rock2: "assets/props/jungle_rock2.png",
    jungle_rock3: "assets/props/jungle_rock3.png",
    jungle_rock4: "assets/props/jungle_rock4.png",
    jungle_rock5: "assets/props/jungle_rock5.png",
    jungle_grass1: "assets/props/jungle_grass1.png",
    jungle_grass2: "assets/props/jungle_grass2.png",
    jungle_grass3: "assets/props/jungle_grass3.png",
    jungle_bush1: "assets/props/jungle_bush1.png",
    jungle_bush2: "assets/props/jungle_bush2.png",
    wetlands_tree1: "assets/props/wetlands_tree1.png",
    wetlands_tree2: "assets/props/wetlands_tree2.png",
    wetlands_tree3: "assets/props/wetlands_tree3.png",
    wetlands_rock1: "assets/props/wetlands_rock1.png",
    wetlands_rock2: "assets/props/wetlands_rock2.png",
    wetlands_rock3: "assets/props/wetlands_rock3.png",
    wetlands_rock4: "assets/props/wetlands_rock4.png",
    wetlands_rock5: "assets/props/wetlands_rock5.png",
    wetlands_grass1: "assets/props/wetlands_grass1.png",
    wetlands_grass2: "assets/props/wetlands_grass2.png",
    wetlands_grass3: "assets/props/wetlands_grass3.png",
    wetlands_bush1: "assets/props/wetlands_bush1.png",
    wetlands_bush2: "assets/props/wetlands_bush2.png"
  };
  const LOCAL_WALLS = {
    africa: "assets/walls/africa.png", mountains: "assets/walls/mountains.png",
    jungle: "assets/walls/jungle.png", wetlands: "assets/walls/wetlands.png"
  };
  const LOCAL_LANDMARKS = {
    watering_hole: "assets/landmarks/watering_hole.png", cairn: "assets/landmarks/cairn.png",
    boardwalk: "assets/landmarks/boardwalk.png", reed_blind: "assets/landmarks/reed_blind.png",
    ranger_post: "assets/landmarks/ranger_post.png", canopy_gap: "assets/landmarks/canopy_gap.png"
  };
  const LOCAL_DECALS = {
    mud: "assets/decals/mud.png", leaf: "assets/decals/leaf.png",
    crack: "assets/decals/crack.png", lily: "assets/decals/lily.png"
  };
  const LOCAL_PARALLAX = {
    africa: "assets/parallax/africa.png", mountains: "assets/parallax/mountains.png",
    jungle: "assets/parallax/jungle.png", wetlands: "assets/parallax/wetlands.png"
  };
  const LOCAL_GROUND = {
    africa: "assets/ground/africa.png", mountains: "assets/ground/mountains.png",
    jungle: "assets/ground/jungle.png", wetlands: "assets/ground/wetlands.png"
  };
  const LOCAL_SKY = {
    africa: "assets/sky/africa.png", mountains: "assets/sky/mountains.png",
    jungle: "assets/sky/jungle.png", wetlands: "assets/sky/wetlands.png"
  };
  const LOCAL_WATER = [
    "assets/ground/water0.png", "assets/ground/water1.png", "assets/ground/water2.png"
  ];
  const LOCAL_TITLES = {
    africa: "assets/titles/africa.png", mountains: "assets/titles/mountains.png",
    jungle: "assets/titles/jungle.png", wetlands: "assets/titles/wetlands.png"
  };

  function makeGaitFrames(src) {
    // 0-1 idle, 2-5 walk, 6 alert — split body/legs for real sheet feel
    const poses = [
      { lean: 0, squash: 1.0, shift: 0, leg: 0, head: 0 },
      { lean: 0.01, squash: 1.03, shift: 0, leg: 1, head: -1 },
      { lean: -0.08, squash: 0.94, shift: -4, leg: -5, head: 1 },
      { lean: 0.03, squash: 1.07, shift: 0, leg: 4, head: 0 },
      { lean: 0.09, squash: 0.94, shift: 4, leg: 5, head: 1 },
      { lean: -0.02, squash: 1.02, shift: 0, leg: -3, head: 0 },
      { lean: -0.07, squash: 1.12, shift: -2, leg: 0, head: -3 }
    ];
    const frames = [];
    const mid = (src.height * 0.55) | 0;
    for (let i = 0; i < poses.length; i++) {
      const p = poses[i];
      const c = document.createElement("canvas");
      c.width = src.width + 18;
      c.height = src.height + 14;
      const g = c.getContext("2d");
      g.imageSmoothingEnabled = false;
      g.translate(c.width / 2 + p.shift, c.height - 2);
      g.transform(1, 0, p.lean, p.squash, 0, 0);
      // upper body
      g.drawImage(src, 0, 0, src.width, mid, -src.width / 2, -src.height + p.head, src.width, mid);
      // legs / lower with stride offset
      g.drawImage(src, 0, mid, src.width, src.height - mid,
        -src.width / 2 + p.leg * 0.35, -src.height + mid, src.width, src.height - mid);
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
    // SNES nearest-neighbor: props keep detail; animals chunky downsample
    const max = mode === "prop" ? 256 : 72;
    let tw = img.width, th = img.height;
    const scale = Math.min(1, max / Math.max(tw, th));
    let w = Math.max(8, (tw * scale) | 0);
    let h = Math.max(8, (th * scale) | 0);
    // Snap to even NES-ish sizes
    w = Math.max(8, w - (w % 2));
    h = Math.max(8, h - (h % 2));
    const tmp = document.createElement("canvas");
    tmp.width = w; tmp.height = h;
    const tctx = tmp.getContext("2d");
    tctx.imageSmoothingEnabled = false;
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
    octx.imageSmoothingEnabled = false;
    octx.drawImage(tmp, minX, minY, cw, ch, 0, 0, cw, ch);
    off._pixel = true;
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
    Object.keys(LOCAL_PROPS).forEach(function (kind) {
      loadImg(LOCAL_PROPS[kind], function (img) {
        remoteProps[kind] = fitRemoteToCanvas(img, "prop");
        delete propCache[kind];
      });
    });
    Object.keys(REMOTE_PROPS).forEach(function (kind) {
      if (remoteProps[kind]) return;
      // Skip soft photo flora — SMB3 pixel local props are the source of truth
      if (/tree|rock|grass|bush|acacia|baobab|pine|fern|snowrock|reed|thorn|vine|fir|lily/i.test(kind)) return;
      loadImg(REMOTE_PROPS[kind], function (img) {
        if (remoteProps[kind]) return;
        remoteProps[kind] = fitRemoteToCanvas(img, "prop");
        delete propCache[kind];
      });
    });
    Object.keys(LOCAL_WALLS).forEach(function (rid) {
      loadImg(LOCAL_WALLS[rid], function (img) {
        remoteWall[rid] = img;
      });
    });
    Object.keys(LOCAL_LANDMARKS).forEach(function (k) {
      loadImg(LOCAL_LANDMARKS[k], function (img) {
        remoteLandmark[k] = fitRemoteToCanvas(img, "prop");
      });
    });
    Object.keys(LOCAL_DECALS).forEach(function (k) {
      loadImg(LOCAL_DECALS[k], function (img) {
        const c = document.createElement("canvas");
        c.width = c.height = 32;
        const g = c.getContext("2d");
        g.drawImage(img, 0, 0, 32, 32);
        remoteDecal[k] = g.getImageData(0, 0, 32, 32);
      });
    });
    Object.keys(LOCAL_PARALLAX).forEach(function (rid) {
      loadImg(LOCAL_PARALLAX[rid], function (img) {
        remoteParallax[rid] = img;
      });
    });
    Object.keys(LOCAL_TITLES).forEach(function (rid) {
      loadImg(LOCAL_TITLES[rid], function (img) {
        remoteTitle[rid] = img;
      });
    });
    loadImg("assets/player/hands.png", function (img) { playerKit.hands = img; });
    loadImg("assets/player/binocs.png", function (img) { playerKit.binocs = img; });
    loadImg("assets/player/journal.png", function (img) { playerKit.journal = img; });
    loadImg("assets/covers/wetlands.png", function (img) { localCover.wetlands = img; });
    Object.keys(LOCAL_GROUND).forEach(function (rid) {
      loadImg(LOCAL_GROUND[rid], function (img) {
        const c = document.createElement("canvas");
        c.width = c.height = TEX;
        const g = c.getContext("2d");
        g.imageSmoothingEnabled = false;
        g.drawImage(img, 0, 0, TEX, TEX);
        remoteGround[rid] = g.getImageData(0, 0, TEX, TEX);
      });
    });
    // Soft photo grounds/skies disabled — SNES pixel tiles only
    Object.keys(LOCAL_SKY).forEach(function (rid) {
      loadImg(LOCAL_SKY[rid], function (img) {
        const c = document.createElement("canvas");
        c.width = W;
        c.height = Math.max(96, Math.ceil(H * 0.52));
        const g = c.getContext("2d");
        g.imageSmoothingEnabled = false;
        g.drawImage(img, 0, 0, c.width, c.height);
        remoteSky[rid] = c;
      });
    });
    // Animated water tiles (3 frames)
    (function () {
      const c0 = document.createElement("canvas");
      c0.width = c0.height = TEX;
      const g0 = c0.getContext("2d");
      g0.fillStyle = "#1a5a78";
      g0.fillRect(0, 0, TEX, TEX);
      const fallback = g0.getImageData(0, 0, TEX, TEX);
      remoteGround._waterFrames = [fallback, fallback, fallback];
      remoteGround._water = fallback;
      LOCAL_WATER.forEach(function (url, fi) {
        loadImg(url, function (img) {
          const c = document.createElement("canvas");
          c.width = c.height = TEX;
          const g = c.getContext("2d");
          g.imageSmoothingEnabled = false;
          g.drawImage(img, 0, 0, TEX, TEX);
          remoteGround._waterFrames[fi] = g.getImageData(0, 0, TEX, TEX);
          remoteGround._water = remoteGround._waterFrames[0] || remoteGround._waterFrames[fi];
        });
      });
    })();
    /* wetlands SNES local */
  }

  function getPropCanvas(prop) {
    if (prop.indexOf("lm_") === 0) {
      const key = prop.slice(3);
      if (remoteLandmark[key]) return remoteLandmark[key];
    }
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

  function mapAnimFrame(frame, len) {
    if (len >= 7) return ((frame % len) + len) % len;
    if (frame >= 6) return len - 1;
    if (frame <= 1) return 0;
    return 1 + (((frame - 2) % Math.max(1, len - 1)) + Math.max(1, len - 1)) % Math.max(1, len - 1);
  }
  function getAnimalCanvas(id, frame) {
    const walk = remoteWalk[id];
    if (walk && walk.length) {
      return walk[mapAnimFrame(frame | 0, walk.length)];
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
    const labelDist = binocsOn ? 12 : (phase.name === "night" ? 3.2 : 5.5);
    const dirX = Math.cos(player.dir), dirY = Math.sin(player.dir);
    const fov = binocsOn ? 0.38 : 0.66;
    const planeX = -dirY * fov, planeY = dirX * fov;
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
      const sightMax = (weather.kind === "dust") ? 11 : ((weather.kind === "rain") ? 16 : 22);
      if (transformY <= 0.15 || transformY > sightMax) continue;
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
      const floatY = sp.kind === "note" ? ((Math.sin(t * 3 + sp.bob) * 4) | 0)
        : (sp.bird ? ((Math.sin(t * 4 + (sp.bob || 0)) * 10 - 18) | 0) : 0);
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
        const pulse = (difficulty === "kids" ? 0.55 : 0.35) + 0.25 * Math.sin(t * 4 + sp.bob);
        ctx.fillStyle = "rgba(93,206,122," + pulse + ")";
        ctx.beginPath();
        ctx.ellipse(spriteScreenX, floorY - 2, spriteW * 0.55, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (sp.track) {
        if (sp.fadeTrack) ctx.globalAlpha = fogA * clamp((sp.life || 0) / 4, 0, 1) * 0.85;
        const tw = Math.max(4, spriteW * 0.45);
        const th = Math.max(2, spriteH * 0.12);
        const pulse = sp.rareTrack ? (0.45 + 0.25 * Math.sin(t * 4 + sp.x)) : 0.55;
        const tid = String(sp.trackTint || "");
        const col = sp.rareTrack
          ? ("rgba(200,140,40," + pulse + ")")
          : (tid === "rare" ? "rgba(180,120,40,0.6)"
            : (tid === "den" || sp.den ? "rgba(90,40,20,0.65)" : "rgba(40,28,12,0.55)"));
        ctx.fillStyle = col;
        const hoof = /buffalo|rhino|hippo|manatee/.test(tid);
        const scrape = /croc|anaconda/.test(tid);
        const bird = /eagle/.test(tid);
        if (scrape) {
          ctx.fillRect(spriteScreenX - tw * 0.6, floorY - 2, tw * 1.2, Math.max(2, th));
          ctx.fillRect(spriteScreenX - tw * 0.2, floorY - th * 2, tw * 0.15, th * 2);
        } else if (bird) {
          ctx.beginPath();
          ctx.moveTo(spriteScreenX - tw * 0.5, floorY);
          ctx.lineTo(spriteScreenX, floorY - th * 2);
          ctx.lineTo(spriteScreenX + tw * 0.5, floorY);
          ctx.fill();
        } else if (hoof) {
          ctx.beginPath();
          ctx.ellipse(spriteScreenX - tw * 0.3, floorY - 1, tw * 0.28, th * 1.1, 0, 0, Math.PI * 2);
          ctx.ellipse(spriteScreenX + tw * 0.3, floorY - 1, tw * 0.28, th * 1.1, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // cat/canid pad prints
          ctx.beginPath();
          ctx.ellipse(spriteScreenX, floorY - 1, tw * 0.35, th * 1.2, 0, 0, Math.PI * 2);
          ctx.fill();
          for (let p = -1; p <= 1; p++) {
            ctx.beginPath();
            ctx.ellipse(spriteScreenX + p * tw * 0.28, floorY - th * 2.2, tw * 0.12, th * 0.7, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        if (sp.rareTrack && transformY < 8) {
          ctx.fillStyle = "rgba(232,200,106,0.9)";
          ctx.beginPath();
          ctx.moveTo(spriteScreenX, drawStartY - 10);
          ctx.lineTo(spriteScreenX + 5, drawStartY - 4);
          ctx.lineTo(spriteScreenX, drawStartY + 2);
          ctx.lineTo(spriteScreenX - 5, drawStartY - 4);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        continue;
      }
      // Ground contact shadow (all billboards)
      if (sp.kind === "animal" || sp.kind === "prop") {
        ctx.fillStyle = "rgba(0,0,0," + (0.22 * fogA) + ")";
        ctx.beginPath();
        ctx.ellipse(spriteScreenX + leanX * 0.2, floorY - 1, spriteW * 0.36, Math.max(3, spriteH * 0.04), 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.imageSmoothingEnabled = false;
      if (sp.herdSil) {
        ctx.globalAlpha = fogA * 0.55;
        ctx.filter = "brightness(0.15) contrast(1.2)";
      }
      if (sp.wallFace) {
        // Vertical cliff strip shading
        ctx.globalAlpha = fogA * (sp.wallStack ? 0.75 : 0.95);
      }
      // Day/night lit vs silhouette feel
      if (sp.kind === "animal" && !sp.herdSil) {
        if (phase.name === "night") ctx.filter = "brightness(0.55) saturate(0.7) hue-rotate(12deg)";
        else if (phase.name === "dusk") ctx.filter = "brightness(0.85) sepia(0.15) saturate(1.1)";
        else if (phase.name === "dawn") ctx.filter = "brightness(0.9) sepia(0.1)";
      }
      // Z-buffer column occlusion against walls
      const zHit = transformY;
      const drawSpriteCols = function (dx0, dy0, dw, dh, sx, sy, sw, sh) {
        if (!zBuf) {
          ctx.drawImage(img, sx, sy, sw, sh, dx0, dy0, dw, dh);
          return;
        }
        const step = IS_MOBILE ? 2 : 1;
        for (let cx = 0; cx < dw; cx += step) {
          const sxScreen = dx0 + cx;
          if (sxScreen < 0 || sxScreen >= W) continue;
          if (zBuf[sxScreen | 0] < zHit - 0.05) continue;
          const u0 = sx + (cx / dw) * sw;
          const uw = Math.max(1, (step / dw) * sw);
          ctx.drawImage(img, u0, sy, uw, sh, sxScreen, dy0, step, dh);
        }
      };
      if (flip) {
        ctx.translate(drawStartX + spriteW, drawStartY);
        ctx.scale(-1, 1);
        if (sp.kind === "animal" && sp.lean) ctx.transform(1, 0, sp.lean * 0.5, 1, 0, 0);
        drawSpriteCols(0, 0, spriteW, spriteH, 0, 0, img.width, img.height);
      } else {
        if (sp.kind === "animal" && sp.lean) {
          ctx.translate(drawStartX + spriteW / 2, drawStartY + spriteH);
          ctx.transform(1, 0, sp.lean * 0.5, 1, 0, 0);
          drawSpriteCols(-spriteW / 2, -spriteH, spriteW, spriteH, 0, 0, img.width, img.height);
        } else {
          drawSpriteCols(drawStartX, drawStartY, spriteW, spriteH, 0, 0, img.width, img.height);
        }
      }
      if (sp.kind === "animal") ctx.filter = "none";
      if (sp.herdSil || sp.wallFace) { ctx.filter = "none"; }
      if (sp.kind === "animal" && transformY < 4.5 && !sp.herdSil) {
        // Close-up rim / fill light
        ctx.save();
        ctx.globalAlpha = 0.18 * fogA * phase.light;
        ctx.fillStyle = phase.name === "night" ? "#a8c8ff" : "#fff8e0";
        ctx.beginPath();
        ctx.ellipse(spriteScreenX, drawStartY + spriteH * 0.32, spriteW * 0.4, spriteH * 0.32, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();

      if (sp.kind === "note") {
        if (transformY < 7) {
          ctx.fillStyle = "rgba(93,206,122,0.9)";
          ctx.beginPath();
          ctx.arc(spriteScreenX, drawStartY - 8, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#e8ffe8";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        continue;
      }

      if (sp.kind === "animal" && !sp.herdSil) {
        drawSprites._screen.push({
          a: sp,
          x0: drawStartX,
          y0: drawStartY,
          x1: drawEndX,
          y1: drawStartY + spriteH,
          dist: transformY
        });
        if (transformY < labelDist) {
          ctx.fillStyle = sp.rare ? "rgba(232,200,106,0.95)" : "rgba(93,206,122,0.85)";
          ctx.beginPath();
          ctx.arc(spriteScreenX, drawStartY - 6, sp.rare ? 3.5 : 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        if (sp.alertT > 0) {
          ctx.fillStyle = "rgba(255,220,80," + clamp(sp.alertT, 0, 1) + ")";
          ctx.beginPath();
          ctx.moveTo(spriteScreenX, drawStartY - 22);
          ctx.lineTo(spriteScreenX + 5, drawStartY - 12);
          ctx.lineTo(spriteScreenX - 5, drawStartY - 12);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    // Landmark markers when near (bitmap only — no canvas text)
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
      ctx.fillStyle = "rgba(232,200,106,0.9)";
      ctx.beginPath();
      ctx.moveTo(sx, sy - 6);
      ctx.lineTo(sx + 5, sy + 4);
      ctx.lineTo(sx - 5, sy + 4);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawHUDOverlay() {
    const phase = dayPhase();
    const snesOn = !!(window.PO_SNES && PO_SNES.enabled && PO_SNES.maps);
    if (!snesOn) {
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
    } else {
      // Region name lives on DOM chips — keep a small status plate without text
      ctx.fillStyle = "rgba(8,20,12,0.72)";
      ctx.fillRect(4, H - 10, 48, 6);
      ctx.fillStyle = "rgba(93,206,122,0.75)";
      ctx.fillRect(4, H - 10, 48, 2);
    }
    if (phase.name === "night" || phase.name === "dusk") {
      const lg = ctx.createRadialGradient(W / 2, H * 0.58, 16, W / 2, H * 0.55, H * 0.62);
      lg.addColorStop(0, "rgba(255,210,130," + (phase.name === "night" ? 0.16 : 0.08) + ")");
      lg.addColorStop(0.4, "rgba(255,150,60,0.05)");
      lg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = lg;
      ctx.fillRect(0, 0, W, H);
    }
    beginHudFrame();
    drawWayPings();
    drawRangerMinimap(phase);
    drawPhotoAssist();
    if (binocsOn) {
      ctx.fillStyle = "rgba(0,10,5,0.55)";
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.arc(W / 2, H / 2, Math.min(W, H) * 0.32, 0, Math.PI * 2, true);
      ctx.fill("evenodd");
      ctx.strokeStyle = "rgba(93,206,122,0.55)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, Math.min(W, H) * 0.32, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(20,40,25,0.8)";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, Math.min(W, H) * 0.34, 0, Math.PI * 2);
      ctx.stroke();
      // metal bridge
      ctx.fillStyle = "rgba(30,50,35,0.85)";
      ctx.fillRect(W / 2 - 18, H / 2 - 6, 36, 12);
    }
    // FOCUS / photo soft DOF rings
    if (focusHold || binocsOn) {
      const dof = ctx.createRadialGradient(W / 2, H / 2, H * 0.08, W / 2, H / 2, H * 0.7);
      dof.addColorStop(0, "rgba(0,0,0,0)");
      dof.addColorStop(0.45, "rgba(0,0,0,0.05)");
      dof.addColorStop(1, "rgba(0,8,4,0.45)");
      ctx.fillStyle = dof;
      ctx.fillRect(0, 0, W, H);
      // fake blur bands top/bottom
      ctx.fillStyle = "rgba(4,12,8,0.12)";
      for (let i = 0; i < 6; i++) {
        ctx.fillRect(0, i * 3, W, 2);
        ctx.fillRect(0, H - 4 - i * 3, W, 2);
      }
    }
    drawExplorerHands();
    if (victoryFlash > 0) {
      ctx.fillStyle = "rgba(232,200,106," + (Math.min(1, victoryFlash) * 0.18) + ")";
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawExplorerHands() {
    if (mode !== "explore") return;
    if (window.PO_SNES && PO_SNES.enabled && PO_SNES.maps) return;
    const bob = viewBob() * 0.35;
    const run = Math.abs(pad.fwd) > 0.2 || keys["w"] || keys["ArrowUp"];
    const sway = run ? Math.sin(t * 10) * 6 : Math.sin(t * 2) * 2;
    ctx.save();
    ctx.globalAlpha = 0.92;
    if (binocsOn && playerKit.binocs) {
      ctx.drawImage(playerKit.binocs, W / 2 - 60, H / 2 - 30 + bob * 0.2, 120, 60);
      ctx.restore();
      return;
    }
    if (playerKit.hands) {
      ctx.drawImage(playerKit.hands, sway * 0.5, H - 58 + bob, W, 60);
      if (playerKit.journal) {
        ctx.drawImage(playerKit.journal, W * 0.78 - sway, H - 70 + bob, 42, 56);
      }
    } else {
      ctx.fillStyle = "#c4a070";
      ctx.beginPath();
      ctx.ellipse(W * 0.18 + sway, H - 8 + bob, 48, 28, -0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2a5a8a";
      ctx.fillRect(W * 0.08 + sway, H - 36 + bob, 55, 22);
      ctx.fillStyle = "#c4a070";
      ctx.beginPath();
      ctx.ellipse(W * 0.82 - sway, H - 10 + bob, 46, 26, 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2a5a8a";
      ctx.fillRect(W * 0.72 - sway, H - 34 + bob, 55, 20);
    }
    ctx.restore();
  }

  function drawPhotoAssist() {
    photoLock = null;
    const hits = drawSprites._screen || [];
    let best = null, bestD = 1e9;
    for (let i = 0; i < hits.length; i++) {
      const h = hits[i];
      const cx = (h.x0 + h.x1) / 2, cy = (h.y0 + h.y1) / 2;
      const d = Math.hypot(cx - W / 2, cy - H / 2);
      if (d < 70 && h.dist < bestD && h.dist < 8) { best = h; bestD = h.dist; }
    }
    let lmNear = false;
    landmarks.forEach(function (lm) {
      if (Math.hypot(lm.x - player.x, lm.y - player.y) < 5) lmNear = true;
    });
    if (best || lmNear) {
      photoLock = best ? best.a : { landmark: true };
      ctx.strokeStyle = "rgba(93,206,122,0.85)";
      ctx.lineWidth = 2;
      const s = 18;
      ctx.strokeRect(W / 2 - s, H / 2 - s, s * 2, s * 2);
      ctx.fillStyle = best ? "#8dffb0" : "#e8c86a";
      ctx.beginPath();
      ctx.arc(W / 2, H / 2 - 28, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function beginHudFrame() {
    if (!hctx || !hudCanvas) return;
    syncHudOverlay();
    hctx.clearRect(0, 0, hudCssW, hudCssH);
    hudCanvas.style.visibility = (mode === "title" || mode === "help") ? "hidden" : "visible";
  }

  function g2h(gx, gy) {
    return { x: (gx / W) * hudCssW, y: (gy / H) * hudCssH };
  }

  function drawWayPings() {
    if (!hctx) return;
    const sx = hudCssW / W, sy = hudCssH / H;
    function ping(wx, wy, col) {
      const dirX = Math.cos(player.dir), dirY = Math.sin(player.dir);
      const fov = binocsOn ? 0.38 : 0.66;
      const planeX = -dirY * fov, planeY = dirX * fov;
      const spriteX = wx - player.x, spriteY = wy - player.y;
      const invDet = 1 / (planeX * dirY - dirX * planeY);
      const transformX = invDet * (dirY * spriteX - dirX * spriteY);
      const transformY = invDet * (-planeY * spriteX + planeX * spriteY);
      let gx, gy;
      if (transformY > 0.2) {
        gx = (W / 2) * (1 + transformX / transformY);
        gy = H / 2 + pitchPx() - 18 / transformY;
        if (gx > 24 && gx < W - 24 && gy > 24 && gy < H - 24) return;
      }
      const ang = Math.atan2(spriteY, spriteX) - player.dir;
      const edge = Math.min(W, H) * 0.42;
      gx = W / 2 + Math.sin(ang) * edge;
      gy = H / 2 - Math.cos(ang) * edge * 0.55 + pitchPx() * 0.25;
      gx = clamp(gx, 18, W - 18);
      gy = clamp(gy, 18, H - 18);
      const p = g2h(gx, gy);
      const sc = Math.min(sx, sy);
      hctx.fillStyle = col;
      hctx.beginPath();
      hctx.moveTo(p.x, p.y - 8 * sc);
      hctx.lineTo(p.x + 7 * sc, p.y + 6 * sc);
      hctx.lineTo(p.x - 7 * sc, p.y + 6 * sc);
      hctx.closePath();
      hctx.fill();
      hctx.strokeStyle = "rgba(4,16,10,0.55)";
      hctx.lineWidth = Math.max(1, sc);
      hctx.stroke();
    }
    let bestNote = null, bestNd = 1e9;
    sprites.forEach(function (sp) {
      if (sp.kind !== "note" || sp.taken) return;
      const d = Math.hypot(sp.x - player.x, sp.y - player.y);
      if (d < bestNd) { bestNd = d; bestNote = sp; }
    });
    if (bestNote) ping(bestNote.x, bestNote.y, "rgba(93,206,122,0.95)");
    let bestLm = null, bestLd = 1e9;
    landmarks.forEach(function (lm) {
      if (landmarksVisited[lm.id || lm.label]) return;
      const d = Math.hypot(lm.x - player.x, lm.y - player.y);
      if (d < bestLd) { bestLd = d; bestLm = lm; }
    });
    if (bestLm) ping(bestLm.x, bestLm.y, "rgba(232,200,106,0.95)");
    let bestRare = null, bestRd = 1e9;
    sprites.forEach(function (sp) {
      if (sp.kind !== "animal" || !sp.rare || animalsSeen[sp.id]) return;
      const d = Math.hypot(sp.x - player.x, sp.y - player.y);
      if (d < bestRd && d < 18) { bestRd = d; bestRare = sp; }
    });
    if (bestRare && rareFound === false) ping(bestRare.x, bestRare.y, "rgba(232,160,80,0.9)");
    drawSoftCompass(bestNote, bestLm, bestRare);
  }

  function drawSoftCompass(note, lm, rare) {
    if (!hctx) return;
    let tx = null, ty = null, col = "#5dce7a", tag = "";
    if (tourStep === 1 && note) { tx = note.x; ty = note.y; tag = "NOTE"; }
    else if (tourStep === 2) {
      const a = sprites.find(function (sp) { return sp.kind === "animal" && !sp.rare && !sp.herdSil; });
      if (a) { tx = a.x; ty = a.y; col = "#c9a227"; tag = "ANIMAL"; }
    } else if (focusHold) {
      const objs = objectiveState();
      const next = objs.find(function (o) { return !o.done; });
      if (next && next.label.indexOf("notes") >= 0 && note) { tx = note.x; ty = note.y; tag = "NOTE"; }
      else if (next && next.label.indexOf("landmark") >= 0 && lm) { tx = lm.x; ty = lm.y; col = "#e8c86a"; tag = "SITE"; }
      else if (next && next.label.indexOf("rare") >= 0 && rare) { tx = rare.x; ty = rare.y; col = "#e8a050"; tag = "RARE"; }
      else if (note) { tx = note.x; ty = note.y; tag = "NOTE"; }
      else if (lm) { tx = lm.x; ty = lm.y; col = "#e8c86a"; tag = "SITE"; }
    } else if (note) { tx = note.x; ty = note.y; tag = "NOTE"; }
    else if (lm) { tx = lm.x; ty = lm.y; col = "#e8c86a"; tag = "SITE"; }
    else if (rare && !rareFound) { tx = rare.x; ty = rare.y; col = "#e8a050"; tag = "RARE"; }
    if (tx == null) return;
    const ang = Math.atan2(ty - player.y, tx - player.x) - player.dir;
    // Small dial parked left of the minimap (keeps top-left free for Objectives)
    const mapPad = 10, mapFrame = 3;
    const mapGuess = Math.round(Math.min(118, Math.max(92, hudCssW * 0.16)));
    const cx = Math.max(22, hudCssW - mapGuess - mapPad - mapFrame - 26);
    const cy = 20, r = 11;
    hctx.save();
    hctx.translate(cx, cy);
    const g = hctx.createRadialGradient(0, 0, 1.5, 0, 0, r);
    g.addColorStop(0, "rgba(20,50,30,0.92)");
    g.addColorStop(1, "rgba(4,16,10,0.88)");
    hctx.fillStyle = g;
    hctx.beginPath(); hctx.arc(0, 0, r, 0, Math.PI * 2); hctx.fill();
    hctx.strokeStyle = "rgba(93,206,122,0.85)";
    hctx.lineWidth = 1.25;
    hctx.stroke();
    hctx.fillStyle = "#e8c86a";
    hctx.font = "700 8px Atkinson Hyperlegible,Segoe UI,sans-serif";
    hctx.textAlign = "center";
    hctx.textBaseline = "middle";
    hctx.fillText("N", 0, -r + 5);
    hctx.rotate(ang);
    hctx.fillStyle = col;
    hctx.beginPath();
    hctx.moveTo(0, -r + 3.5);
    hctx.lineTo(3.2, 2.5);
    hctx.lineTo(0, 0.6);
    hctx.lineTo(-3.2, 2.5);
    hctx.closePath();
    hctx.fill();
    hctx.restore();
    if (tag) {
      hctx.font = "600 9px Atkinson Hyperlegible,Segoe UI,sans-serif";
      const labelW = Math.max(26, hctx.measureText(tag).width + 8);
      hctx.fillStyle = "rgba(4,20,10,0.85)";
      hctx.fillRect(cx - labelW / 2, cy + r + 2, labelW, 12);
      hctx.fillStyle = col;
      hctx.textAlign = "center";
      hctx.textBaseline = "middle";
      hctx.fillText(tag, cx, cy + r + 8);
    }
  }

  function miniHash(x, y) {
    return ((x * 73856093) ^ (y * 19349663)) >>> 0;
  }

  function miniGroundColor(t, rid, x, y) {
    const n = miniHash(x, y) & 3;
    const water = t.indexOf("water") === 0 || t.charAt(0) === "w" || t.indexOf("sw") === 0;
    if (t.indexOf("cliff") === 0) return ["#4a4844", "#3a3834", "#55524c", "#2e2c2a"][n];
    if (water) {
      if (rid === "wetlands") return ["#1e6a78", "#247888", "#186070", "#2a8090"][n];
      if (rid === "mountains") return ["#3a6a90", "#2e5a80", "#4678a0", "#245070"][n];
      return ["#2a7a98", "#3488a8", "#1e6888", "#3a94b0"][n];
    }
    if (t.indexOf("path") === 0 || t.indexOf("dirt") === 0) {
      return rid === "mountains" ? ["#9a8a70", "#8a7a60", "#a89878", "#7a6a50"][n]
        : ["#b08a48", "#9a7840", "#c09850", "#886838"][n];
    }
    if (t.indexOf("sand") === 0) return ["#d4b878", "#c8aa68", "#e0c488", "#b89a58"][n];
    if (t.indexOf("snow") === 0) return ["#e8f0f8", "#d8e4f0", "#f0f6fc", "#c8d4e0"][n];
    if (t.indexOf("mud") === 0 || t.indexOf("dark") === 0) return ["#2a4830", "#243c28", "#345438", "#1e3424"][n];
    // grass / default by biome
    if (rid === "africa") return ["#8a9a3a", "#7a8a32", "#9aaa42", "#6a7a2a"][n];
    if (rid === "jungle") return ["#1a5a28", "#145020", "#226830", "#0e4018"][n];
    if (rid === "mountains") return ["#4a6a48", "#3e5e3c", "#567856", "#345034"][n];
    if (rid === "wetlands") return ["#3a6a48", "#326040", "#487858", "#2a5438"][n];
    return ["#3a6a30", "#326028", "#447838", "#2a5420"][n];
  }

  function rebuildMiniBase() {
    const snesMap = (window.PO_SNES && PO_SNES.enabled && PO_SNES.maps && region && PO_SNES.maps[region.id]) || null;
    const rid = (region && region.id) || "africa";
    const ppt = 3;
    miniPpt = ppt;

    if (snesMap) {
      const mw = snesMap.w, mh = snesMap.h;
      miniMeta = { w: mw, h: mh, ppt: ppt };
      miniBase = document.createElement("canvas");
      miniBase.width = mw * ppt;
      miniBase.height = mh * ppt;
      const m = miniBase.getContext("2d");
      m.imageSmoothingEnabled = false;
      miniExplored = [];
      for (let y = 0; y < mh; y++) {
        miniExplored[y] = [];
        for (let x = 0; x < mw; x++) {
          miniExplored[y][x] = 0;
          const t = snesMap.ground[y][x];
          m.fillStyle = miniGroundColor(t, rid, x, y);
          m.fillRect(x * ppt, y * ppt, ppt, ppt);
          // micro shore highlight
          if ((t.indexOf("water") === 0 || t.charAt(0) === "w") && (x + y) % 5 === 0) {
            m.fillStyle = "rgba(180,230,255,0.22)";
            m.fillRect(x * ppt + 1, y * ppt, 1, 1);
          }
        }
      }
      // Canopy / rock stamps from objects (readable at ppt=3)
      (snesMap.objects || []).forEach(function (o) {
        if (!o || !o.id) return;
        const id = o.id;
        if (id.indexOf("detail") >= 0 || id.indexOf("grass") >= 0) return;
        const tx = (o.x / snesMap.tile) | 0;
        const ty = (o.y / snesMap.tile) | 0;
        const px = tx * ppt, py = ty * ppt;
        const isTree = id.indexOf("tree") >= 0 || id.indexOf("baobab") >= 0 || id.indexOf("pine") >= 0
          || id.indexOf("fir") >= 0 || id.indexOf("acacia") >= 0 || id.indexOf("ptree") === 0;
        const isRock = id.indexOf("rock") >= 0 || id === "cairn";
        const isCamp = id.indexOf("camp") === 0 || id === "sign" || id === "trail_flag";
        if (isTree) {
          m.fillStyle = rid === "africa" ? "rgba(46,106,40,0.9)" : (rid === "jungle" ? "rgba(14,64,32,0.95)" : "rgba(36,88,40,0.9)");
          m.beginPath(); m.arc(px + ppt * 0.5, py + ppt * 0.35, ppt * 0.85, 0, Math.PI * 2); m.fill();
          m.fillStyle = rid === "africa" ? "rgba(74,154,56,0.85)" : "rgba(26,104,64,0.85)";
          m.beginPath(); m.arc(px + ppt * 0.5, py + ppt * 0.25, ppt * 0.45, 0, Math.PI * 2); m.fill();
        } else if (isRock) {
          m.fillStyle = rid === "mountains" ? "rgba(208,216,224,0.95)" : "rgba(106,104,96,0.9)";
          m.beginPath(); m.ellipse(px + ppt * 0.5, py + ppt * 0.55, ppt * 0.55, ppt * 0.35, 0, 0, Math.PI * 2); m.fill();
        } else if (isCamp) {
          m.fillStyle = "#c97820";
          m.beginPath(); m.arc(px + ppt * 0.5, py + ppt * 0.5, ppt * 0.4, 0, Math.PI * 2); m.fill();
        } else if (id.indexOf("bush") >= 0 || id.indexOf("fern") >= 0) {
          m.fillStyle = "rgba(42,122,64,0.75)";
          m.beginPath(); m.arc(px + ppt * 0.5, py + ppt * 0.6, ppt * 0.4, 0, Math.PI * 2); m.fill();
        }
      });
      // Chart parchment vignette
      const g = m.createRadialGradient(miniBase.width / 2, miniBase.height / 2, miniBase.width * 0.2,
        miniBase.width / 2, miniBase.height / 2, miniBase.width * 0.72);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(8,16,10,0.35)");
      m.fillStyle = g;
      m.fillRect(0, 0, miniBase.width, miniBase.height);
      revealMiniFog(player.x, player.y, 7);
      return;
    }

    // Raycast fallback map
    const mw = MAP, mh = MAP;
    miniMeta = { w: mw, h: mh, ppt: ppt };
    miniBase = document.createElement("canvas");
    miniBase.width = mw * ppt;
    miniBase.height = mh * ppt;
    const m = miniBase.getContext("2d");
    m.imageSmoothingEnabled = false;
    miniExplored = [];
    for (let y = 0; y < mh; y++) {
      miniExplored[y] = [];
      for (let x = 0; x < mw; x++) {
        miniExplored[y][x] = 0;
        const f = floor[y][x];
        let col = "#163820";
        if (wall[y][x]) col = "#1a2a1c";
        else if (f === 3) col = "#1a5a6a";
        else if (f === 2) col = rid === "mountains" ? "#c8d4e0" : "#6a5a30";
        else if (f === 0) col = "#8a6b35";
        else if (rid === "jungle") col = "#1a4a22";
        else if (rid === "africa") col = "#9a7a38";
        else col = "#4a5a50";
        m.fillStyle = col;
        m.fillRect(x * ppt, y * ppt, ppt, ppt);
      }
    }
    sprites.forEach(function (sp) {
      if (sp.kind !== "prop") return;
      const p = sp.prop || "";
      if (p.indexOf("_grass") >= 0 || p.indexOf("_bush") >= 0 || p === "grass" || p === "bush" || p === "fern" || p === "reed") return;
      const px = (sp.x * ppt) | 0, py = (sp.y * ppt) | 0;
      if (p.indexOf("_tree") >= 0 || p === "pine" || p === "tree" || p === "acacia" || p === "baobab") {
        m.fillStyle = "#2a8a40";
        m.fillRect(px - 1, py - 1, 3, 3);
      } else {
        m.fillStyle = (p.indexOf("mountains_rock") === 0 || p === "snowrock") ? "#e8eef4" : "#6a6868";
        m.fillRect(px, py, 2, 2);
      }
    });
    revealMiniFog(player.x, player.y, 7);
  }

  function drawRangerMinimap(phase) {
    if (!hctx || !miniBase || mode === "title") return;
    const ppt = miniMeta.ppt || miniPpt;
    // Readable hi-res chart (CSS px) — world stays pixel, this layer is crisp
    const drawSz = Math.round(Math.min(118, Math.max(92, hudCssW * 0.16)));
    const pad = 10;
    const frame = 3;
    const ox = hudCssW - drawSz - pad - frame;
    const oy = pad + frame + 4;
    const viewTiles = 22;
    const src = viewTiles * ppt;
    let sx = player.x * ppt - src / 2;
    let sy = player.y * ppt - src / 2;
    sx = Math.max(0, Math.min(miniBase.width - src, sx));
    sy = Math.max(0, Math.min(miniBase.height - src, sy));

    // Soft parchment frame
    hctx.fillStyle = "rgba(6,14,8,0.9)";
    roundRect(hctx, ox - frame - 1, oy - frame - 1, drawSz + frame * 2 + 2, drawSz + frame * 2 + 8, 5);
    hctx.fill();
    hctx.strokeStyle = "rgba(93,206,122,0.75)";
    hctx.lineWidth = 1.5;
    roundRect(hctx, ox - frame + 0.5, oy - frame + 0.5, drawSz + frame * 2 - 1, drawSz + frame * 2 - 1, 4);
    hctx.stroke();

    hctx.save();
    hctx.beginPath();
    roundRect(hctx, ox, oy, drawSz, drawSz, 3);
    hctx.clip();
    hctx.fillStyle = "#0a180e";
    hctx.fillRect(ox, oy, drawSz, drawSz);
    hctx.imageSmoothingEnabled = true;
    if (hctx.imageSmoothingQuality) hctx.imageSmoothingQuality = "high";
    hctx.drawImage(miniBase, sx, sy, src, src, ox, oy, drawSz, drawSz);

    // Soft fog (not chunky tile blocks)
    if (miniExplored) {
      const tilePx = drawSz / viewTiles;
      const tx0 = (sx / ppt) | 0, ty0 = (sy / ppt) | 0;
      for (let ty = 0; ty < viewTiles; ty++) {
        for (let tx = 0; tx < viewTiles; tx++) {
          const gx = tx0 + tx, gy = ty0 + ty;
          if (gy < 0 || gx < 0 || gy >= miniExplored.length || gx >= miniExplored[0].length) continue;
          if (miniExplored[gy][gx]) continue;
          hctx.fillStyle = "rgba(2,8,4,0.62)";
          hctx.beginPath();
          hctx.arc(ox + (tx + 0.5) * tilePx, oy + (ty + 0.5) * tilePx, tilePx * 0.72, 0, Math.PI * 2);
          hctx.fill();
        }
      }
    }

    function worldToMini(wx, wy) {
      return {
        x: ox + ((wx * ppt - sx) / src) * drawSz,
        y: oy + ((wy * ppt - sy) / src) * drawSz
      };
    }

    landmarks.forEach(function (lm) {
      const p = worldToMini(lm.x, lm.y);
      if (p.x < ox - 2 || p.y < oy - 2 || p.x > ox + drawSz + 2 || p.y > oy + drawSz + 2) return;
      const visited = landmarksVisited[lm.id || lm.label];
      hctx.fillStyle = visited ? "#7a9a6a" : "#e8c86a";
      hctx.beginPath();
      hctx.moveTo(p.x, p.y - 3.5);
      hctx.lineTo(p.x + 2.8, p.y);
      hctx.lineTo(p.x, p.y + 3.5);
      hctx.lineTo(p.x - 2.8, p.y);
      hctx.closePath();
      hctx.fill();
    });

    const pulse = 0.55 + Math.sin(t * 5) * 0.35;
    sprites.forEach(function (sp) {
      if (sp.kind === "note" && !sp.taken) {
        const p = worldToMini(sp.x, sp.y);
        if (p.x < ox || p.y < oy || p.x > ox + drawSz || p.y > oy + drawSz) return;
        hctx.fillStyle = "rgba(93,206,122," + pulse + ")";
        hctx.beginPath(); hctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2); hctx.fill();
        return;
      }
      if (sp.kind !== "animal" || sp.herdSil) return;
      const p = worldToMini(sp.x, sp.y);
      if (p.x < ox - 1 || p.y < oy - 1 || p.x > ox + drawSz + 1 || p.y > oy + drawSz + 1) return;
      if (sp.rare) {
        hctx.strokeStyle = "#e8c86a";
        hctx.lineWidth = 1.2;
        hctx.beginPath(); hctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2); hctx.stroke();
      }
      hctx.fillStyle = (sp.data && sp.data.color) || "#c9a227";
      hctx.beginPath(); hctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2); hctx.fill();
    });

    const pp = worldToMini(player.x, player.y);
    hctx.fillStyle = "rgba(93,206,122,0.2)";
    hctx.beginPath();
    hctx.moveTo(pp.x, pp.y);
    hctx.arc(pp.x, pp.y, 11, player.dir - 0.5, player.dir + 0.5);
    hctx.closePath();
    hctx.fill();
    hctx.fillStyle = "#e8f5ec";
    hctx.beginPath();
    hctx.moveTo(pp.x + Math.cos(player.dir) * 5, pp.y + Math.sin(player.dir) * 5);
    hctx.lineTo(pp.x + Math.cos(player.dir + 2.5) * 3, pp.y + Math.sin(player.dir + 2.5) * 3);
    hctx.lineTo(pp.x + Math.cos(player.dir - 2.5) * 3, pp.y + Math.sin(player.dir - 2.5) * 3);
    hctx.closePath();
    hctx.fill();
    hctx.fillStyle = "#5dce7a";
    hctx.beginPath(); hctx.arc(pp.x, pp.y, 1.6, 0, Math.PI * 2); hctx.fill();
    hctx.restore();

    // Hi-res labels
    hctx.fillStyle = "#e8c86a";
    hctx.font = "700 10px Atkinson Hyperlegible,Segoe UI,sans-serif";
    hctx.textAlign = "center";
    hctx.textBaseline = "middle";
    hctx.fillText("N", ox + drawSz / 2, oy - frame - 6);

    const phaseCol = phase.name === "night" ? "#5a7ab0"
      : (phase.name === "dusk" ? "#c97820"
        : (phase.name === "dawn" ? "#e8a060" : "#e8c86a"));
    hctx.fillStyle = phaseCol;
    hctx.fillRect(ox + 2, oy + drawSz + 3, drawSz - 4, 2);
  }

  function roundRect(c, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
  }

  function animalReact(sp) {
    const ctxA = ensureAudio();
    if (!ctxA || muted) return;
    sfxGain();
    const id = (sp && sp.id) || "";
    const o = ctxA.createOscillator();
    const g = ctxA.createGain();
    let type = "sawtooth", freq = 140, dur = 0.28, vol = 0.06;
    if (sp.behavior === "soar" || id === "eagle") { type = "sine"; freq = 980; dur = 0.35; }
    else if (id === "lion" || id === "tiger" || id === "jaguar") { type = "sawtooth"; freq = 90; dur = 0.4; vol = 0.08; }
    else if (id === "wolf") { type = "triangle"; freq = 420; dur = 0.45; }
    else if (id === "hippo" || id === "manatee" || id === "croc" || id === "anaconda") { type = "sine"; freq = 70; dur = 0.35; }
    else if (id === "honeybadger") { type = "square"; freq = 220; dur = 0.2; }
    else if (sp.behavior === "ambush") { type = "triangle"; freq = 180; dur = 0.25; }
    o.type = type;
    o.frequency.value = freq + Math.random() * 30;
    g.gain.value = 0.0001;
    o.connect(g); g.connect(masterGain);
    const now = ctxA.currentTime;
    g.gain.exponentialRampToValueAtTime(vol, now + 0.02);
    o.frequency.exponentialRampToValueAtTime(o.frequency.value * 0.65, now + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.start(now); o.stop(now + dur + 0.02);
    if (cautionLevel > 0.5) haptic(12);
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
    if (region.id === "mountains") weather.kind = season === "wet" ? (Math.random() < 0.5 ? "snow" : "rain") : "snow";
    else if (region.id === "africa") weather.kind = season === "dry" ? "dust" : (Math.random() < 0.45 ? "rain" : "dust");
    else if (region.id === "wetlands") weather.kind = season === "dry" ? "dust" : "rain";
    else weather.kind = season === "dry" ? "dust" : "rain";
    weather.t = 7 + Math.random() * 7;
    weather._boltCd = 2 + Math.random() * 3;
    if (ui.hint && mode === "explore") {
      ui.hint.textContent = weather.kind === "dust" ? "Dust storm rolling in…"
        : (weather.kind === "snow" ? "Snow squall on the ridge…" : "Canopy rain starting…");
    }
  }

  function drawWeather() {
    if (reduceMotion) return;
    // Heat haze (Africa dry day) even without storm
    if (region && region.id === "africa" && season === "dry" && dayPhase().name === "day" && !weather.kind) {
      ctx.fillStyle = "rgba(255,200,120,0.04)";
      for (let i = 0; i < 8; i++) {
        const y = (H * 0.45 + i * 10 + Math.sin(t * 2 + i) * 3) | 0;
        ctx.fillRect(0, y, W, 2);
      }
    }
    if (!weather.kind) return;
    const a = clamp(weather.t / 2, 0, 1) * 0.35;
    if (weather.kind === "dust") {
      ctx.fillStyle = "rgba(180,140,70," + (0.12 + a * 0.25) + ")";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(210,170,90,0.35)";
      for (let i = 0; i < 120; i++) {
        const x = ((t * 110 + i * 47) % (W + 40)) - 20;
        const y = (i * 53 + t * 35 + Math.sin(t + i) * 8) % H;
        ctx.fillRect(x | 0, y | 0, 4, 1);
      }
    } else if (weather.kind === "snow") {
      ctx.fillStyle = "rgba(200,220,255," + (0.1 + a * 0.2) + ")";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(240,248,255,0.85)";
      for (let i = 0; i < 140; i++) {
        const x = (i * 41 + t * 40 + Math.sin(i + t) * 6) % W;
        const y = (i * 73 + t * 70) % H;
        const sz = 1 + (i % 3);
        ctx.fillRect(x | 0, y | 0, sz, sz);
      }
      // ground dusting band
      ctx.fillStyle = "rgba(230,240,255," + (0.08 + a * 0.1) + ")";
      ctx.fillRect(0, H - 28, W, 28);
    } else {
      ctx.fillStyle = "rgba(30,50,40," + (0.12 + a * 0.2) + ")";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(160,200,180,0.4)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 140; i++) {
        const x = (i * 37 + t * 220) % W;
        const y = (i * 59 + t * 300) % H;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 14); ctx.stroke();
      }
      // splash dots near bottom
      ctx.fillStyle = "rgba(180,220,200,0.35)";
      for (let i = 0; i < 40; i++) {
        const x = (i * 61 + t * 40) % W;
        const y = H - 8 - (i % 5) * 3;
        ctx.fillRect(x | 0, y | 0, 2, 2);
      }
    }
    if (lightningT > 0) {
      ctx.fillStyle = "rgba(220,235,255," + (clamp(lightningT * 2.2, 0, 1) * 0.55) + ")";
      ctx.fillRect(0, 0, W, H);
      if (lightningT > 0.12) {
        ctx.strokeStyle = "rgba(240,250,255,0.9)";
        ctx.lineWidth = 2;
        let lx = W * (0.2 + (lightningT * 7 % 1) * 0.6);
        ctx.beginPath();
        ctx.moveTo(lx, 0);
        for (let i = 0; i < 5; i++) {
          lx += (Math.random() - 0.5) * 40;
          ctx.lineTo(lx, (i + 1) * (H * 0.12));
        }
        ctx.stroke();
      }
    }
  }

  function journalMapDataUrl() {
    const mw = (miniMeta && miniMeta.w) || MAP;
    const mh = (miniMeta && miniMeta.h) || MAP;
    const ms = Math.max(2, Math.min(4, (320 / Math.max(mw, mh)) | 0));
    const c = document.createElement("canvas");
    c.width = mw * ms;
    c.height = mh * ms;
    const g = c.getContext("2d");
    g.fillStyle = "#e8d9b8";
    g.fillRect(0, 0, c.width, c.height);
    if (miniBase) g.drawImage(miniBase, 0, 0, c.width, c.height);
    sprites.forEach(function (sp) {
      if (sp.kind === "note") {
        g.fillStyle = sp.taken ? "#6a8a5a" : "#1f7a3e";
        g.fillRect((sp.x * ms) | 0, (sp.y * ms) | 0, 3, 3);
      }
    });
    landmarks.forEach(function (lm) {
      const id = lm.id || lm.label;
      const px = (lm.x * ms) | 0, py = (lm.y * ms) | 0;
      g.fillStyle = landmarksVisited[id] ? "#8a6a20" : "#c9a227";
      g.fillRect(px, py, 3, 3);
      g.fillStyle = "#5a3a18";
      g.font = "7px monospace";
      const icon = /POST|BOARD/.test(id) ? "P" : (/CAIRN|BLIND/.test(id) ? "C" : (/LOOK|OVER|GAP|LAKE/.test(id) ? "L" : "S"));
      g.fillText(icon, px + 4, py + 6);
    });
    g.fillStyle = "#bf0a30";
    g.beginPath();
    g.arc(player.x * ms, player.y * ms, 3, 0, Math.PI * 2);
    g.fill();
    return c.toDataURL("image/png");
  }

  function openJournal() {
    if (!ui.journal) return;
    if (mode === "dossier") closeDossier();
    if (mode === "note") { notePendingLog = false; if (ui.note) ui.note.classList.remove("show"); }
    const s = loadSave();
    if (ui.journalMeta) ui.journalMeta.textContent = (region ? region.name : "EXPEDITION") + " · field journal";
    let html = "";
    html += "<h3>Expedition map</h3>";
    html += "<p class=\"map-legend\">Green = notes · Gold = landmarks · Red = you</p>";
    html += "<img class=\"jmap\" src=\"" + journalMapDataUrl() + "\" alt=\"field map\">";
    if (region && RANGER_TIPS[region.id]) html += "<p><i>" + RANGER_TIPS[region.id] + "</i></p>";
    html += "<h3>Notes</h3><ul>";
    if (!notesFound.length) html += "<li>No field notes yet — follow the print trails.</li>";
    notesFound.forEach(function (n, i) { html += "<li>✓ " + (i + 1) + ". " + n.text + "</li>"; });
    html += "</ul><h3>Landmarks</h3><ul>";
    const lms = Object.keys(landmarksVisited);
    if (!lms.length) html += "<li>No landmarks logged yet.</li>";
    lms.forEach(function (id) { html += "<li>✓ " + id + "</li>"; });
    html += "</ul><h3>Sightings</h3><ul>";
    const seen = Object.keys(animalsSeen);
    if (!seen.length) html += "<li>No dossiers opened yet.</li>";
    seen.forEach(function (id) { html += "<li>✓ " + id + "</li>"; });
    html += "</ul><h3>Photo challenges</h3><ul>";
    html += "<li class=\"" + (photoAnimals >= 3 ? "done" : "") + "\">Animals " + Math.min(photoAnimals, 3) + "/3</li>";
    html += "<li class=\"" + (photoLandmark ? "done" : "") + "\">Landmark " + (photoLandmark ? "1" : "0") + "/1</li>";
    html += "<li class=\"" + (photoDusk ? "done" : "") + "\">Dusk/night " + (photoDusk ? "1" : "0") + "/1</li>";
    html += "</ul><h3>Photos</h3>";
    if (!photoShots.length) html += "<p>Press Photo or P to snap a sighting.</p>";
    else {
      photoShots.forEach(function (src) {
        html += "<img class=\"shot\" src=\"" + src + "\" alt=\"sighting\">";
      });
    }
    const stamp = s.regions[region ? region.id : ""] && s.regions[region.id].complete;
    if (stamp) {
      html += "<p><b>Region cleared</b> — badge: " + (BADGE_LABEL[region.id] || "Ranger") + "</p>";
      if (RANGER_TIPS[region.id]) html += "<p>" + RANGER_TIPS[region.id] + "</p>";
    }
    if (ui.journalBody) ui.journalBody.innerHTML = html;
    ui.journal.classList.add("show");
    mode = "journal";
    clearInput();
    syncTouchUI();
    setAudioDuck(true);
    blip(500, 0.1, "sine");
  }
  function closeJournal() {
    if (ui.journal) ui.journal.classList.remove("show");
    if (mode === "journal") mode = "explore";
    clearInput();
    syncTouchUI();
    setAudioDuck(false);
  }
  function gradePhotoFrame() {
    const off = document.createElement("canvas");
    off.width = W; off.height = H;
    const g = off.getContext("2d");
    g.drawImage(canvas, 0, 0);
    // Soft DOF: darken + slight blur feel via vignette rings
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.12, W / 2, H / 2, H * 0.72);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(0.55, "rgba(0,0,0,0.08)");
    vg.addColorStop(1, "rgba(8,4,0,0.55)");
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);
    // Film grain
    const id = g.getImageData(0, 0, W, H);
    const px = id.data;
    for (let i = 0; i < px.length; i += 16) {
      const n = (Math.random() * 28 - 14) | 0;
      px[i] = clamp(px[i] + n, 0, 255);
      px[i + 1] = clamp(px[i + 1] + n, 0, 255);
      px[i + 2] = clamp(px[i + 2] + n, 0, 255);
    }
    g.putImageData(id, 0, 0);
    // Warm grade
    g.fillStyle = "rgba(255,180,90,0.06)";
    g.fillRect(0, 0, W, H);
    g.strokeStyle = "rgba(93,206,122,0.5)";
    g.lineWidth = 2;
    g.strokeRect(6, 6, W - 12, H - 12);
    // Postcard brand plate (bitmap bars — readable stamp drawn large)
    g.fillStyle = "rgba(4,20,10,0.82)";
    g.fillRect(8, 8, 168, 36);
    g.strokeStyle = "#5dce7a";
    g.strokeRect(8.5, 8.5, 167, 35);
    g.fillStyle = "#5dce7a";
    g.font = "700 13px Atkinson Hyperlegible, Segoe UI, sans-serif";
    g.fillText("Primal Odyssey", 14, 24);
    g.fillStyle = "#9ec9ad";
    g.font = "400 11px Atkinson Hyperlegible, Segoe UI, sans-serif";
    const rname = region ? region.name : "Field";
    g.fillText(rname + " · field card", 14, 38);
    g.fillStyle = "rgba(4,20,10,0.8)";
    g.fillRect(10, H - 32, Math.min(W - 20, 220), 20);
    g.fillStyle = "#8dffb0";
    g.font = "600 12px Atkinson Hyperlegible, Segoe UI, sans-serif";
    const stamp = photoLock && photoLock.data && photoLock.data.name
      ? photoLock.data.name
      : "Field sighting";
    g.fillText(stamp.slice(0, 28), 16, H - 18);
    return off.toDataURL("image/jpeg", 0.8);
  }
  function takePhoto() {
    if (mode !== "explore") return;
    try {
      const url = gradePhotoFrame();
      photoShots.unshift(url);
      if (photoShots.length > 12) photoShots.length = 12;
      photoFlashT = 0.18;
      if (ui.photoFlash) { ui.photoFlash.hidden = false; ui.photoFlash.classList.add("on"); }
      blip(880, 0.06, "square");
      const hits = drawSprites._screen || [];
      let gotAnimal = false, gotLm = false;
      if (photoLock && photoLock.kind === "animal") {
        gotAnimal = true;
        photoLock.poseT = 1.8;
        photoLock.alertT = Math.max(photoLock.alertT, 0.7);
      }
      for (let i = 0; i < hits.length; i++) {
        const h = hits[i];
        if (h.dist > 9) continue;
        if (h.a && h.a.kind === "animal") {
          gotAnimal = true;
          h.a.poseT = 1.6;
          h.a.alertT = Math.max(h.a.alertT, 0.6);
        }
      }
      if (photoLock && photoLock.landmark) gotLm = true;
      landmarks.forEach(function (lm) {
        if (Math.hypot(lm.x - player.x, lm.y - player.y) < 5.5) gotLm = true;
      });
      if (gotAnimal) photoAnimals = Math.min(3, photoAnimals + 1);
      if (gotLm) photoLandmark = true;
      const phase = dayPhase();
      if (phase.name === "dusk" || phase.name === "night") photoDusk = true;
      if (photoLock && photoLock.rare) {
        photoRareDone = true;
        syncQuest();
      }
      haptic(20);
      persistProgress();
      syncObjectives();
      let msg = "Sighting saved to JOURNAL";
      if (gotAnimal) msg = "Animal pose captured · JOURNAL";
      else if (gotLm) msg = "Landmark shot logged · JOURNAL";
      if (ui.hint) ui.hint.textContent = msg;
    } catch (e) {
      if (ui.hint) ui.hint.textContent = "Photo failed (try again)";
    }
  }

  function drawWalls() {
    if (!zBuf || zBuf.length !== W) zBuf = new Float32Array(W);
    for (let i = 0; i < W; i++) zBuf[i] = 1e9;
    const phase = dayPhase();
    const bobY = viewBob();
    const pitch = pitchPx();
    const dirX = Math.cos(player.dir), dirY = Math.sin(player.dir);
    const planeX = -dirY * 0.66, planeY = dirX * 0.66;
    const texImg = remoteWall[region ? region.id : "africa"];
    const tex = texImg || null;
    const tw = tex ? tex.width : 64, th = tex ? tex.height : 64;
    for (let x = 0; x < W; x++) {
      const cameraX = 2 * x / W - 1;
      let rayDirX = dirX + planeX * cameraX;
      let rayDirY = dirY + planeY * cameraX;
      let mapX = player.x | 0, mapY = player.y | 0;
      const deltaDistX = Math.abs(1 / (rayDirX || 1e-8));
      const deltaDistY = Math.abs(1 / (rayDirY || 1e-8));
      let stepX, stepY, sideDistX, sideDistY;
      if (rayDirX < 0) { stepX = -1; sideDistX = (player.x - mapX) * deltaDistX; }
      else { stepX = 1; sideDistX = (mapX + 1 - player.x) * deltaDistX; }
      if (rayDirY < 0) { stepY = -1; sideDistY = (player.y - mapY) * deltaDistY; }
      else { stepY = 1; sideDistY = (mapY + 1 - player.y) * deltaDistY; }
      let hit = 0, side = 0, guard = 0;
      while (hit === 0 && guard++ < 48) {
        if (sideDistX < sideDistY) { sideDistX += deltaDistX; mapX += stepX; side = 0; }
        else { sideDistY += deltaDistY; mapY += stepY; side = 1; }
        if (mapX < 0 || mapY < 0 || mapX >= MAP || mapY >= MAP) { break; }
        if (wall[mapY][mapX]) hit = 1;
      }
      if (!hit) continue;
      let perp = side === 0
        ? (mapX - player.x + (1 - stepX) / 2) / (rayDirX || 1e-8)
        : (mapY - player.y + (1 - stepY) / 2) / (rayDirY || 1e-8);
      perp = Math.max(0.15, Math.abs(perp));
      zBuf[x] = perp;
      const lineH = Math.min(H * 2.5, Math.abs(H / perp)) | 0;
      let drawStart = ((-lineH / 2 + H / 2 + bobY + pitch) | 0);
      let drawEnd = ((lineH / 2 + H / 2 + bobY + pitch) | 0);
      if (drawStart < 0) drawStart = 0;
      if (drawEnd >= H) drawEnd = H - 1;
      let wallX = side === 0 ? player.y + perp * rayDirY : player.x + perp * rayDirX;
      wallX -= Math.floor(wallX);
      let texX = (wallX * tw) | 0;
      if ((side === 0 && rayDirX > 0) || (side === 1 && rayDirY < 0)) texX = tw - texX - 1;
      const fog = clamp(1.15 - perp / 18, 0.25, 1) * phase.light * (side ? 0.75 : 1);
      const stripH = Math.max(1, drawEnd - drawStart);
      if (tex) {
        ctx.globalAlpha = fog;
        ctx.drawImage(tex, Math.max(0, Math.min(tw - 1, texX)), 0, 1, th, x, drawStart, 1, stripH);
        ctx.globalAlpha = 1;
        if (side) {
          ctx.fillStyle = "rgba(0,0,0,0.22)";
          ctx.fillRect(x, drawStart, 1, stripH);
        }
      } else {
        const base = region.id === "mountains" ? [120, 130, 145] : (region.id === "jungle" ? [40, 70, 45] : (region.id === "wetlands" ? [45, 80, 78] : [110, 95, 65]));
        ctx.fillStyle = "rgb(" + ((base[0] * fog) | 0) + "," + ((base[1] * fog) | 0) + "," + ((base[2] * fog) | 0) + ")";
        ctx.fillRect(x, drawStart, 1, stripH);
      }
    }
  }

  function drawWorld() {
    if (window.PO_SNES && PO_SNES.enabled && PO_SNES.maps) {
      PO_SNES.draw(ctx, W, H, player, sprites, getAnimalCanvas, dayPhase);
      drawParticles();
      drawWeather();
      drawHUDOverlay();
    } else {
      drawSkyFloor();
      drawWalls();
      drawSprites();
      drawParticles();
      drawWeather();
      drawHUDOverlay();
    }
    if (noteFlash > 0) {
      ctx.fillStyle = "rgba(93,206,122," + (noteFlash * 0.15) + ")";
      ctx.fillRect(0, 0, W, H);
    }
    if (worldFade > 0) {
      const f = clamp(worldFade, 0, 1);
      ctx.fillStyle = "rgba(8,16,10," + (f * 0.94) + ")";
      ctx.fillRect(0, 0, W, H);
      const card = region && remoteTitle[region.id];
      if (card) {
        ctx.globalAlpha = f;
        const cw = Math.min(W * 0.88, card.width);
        const ch = cw * (card.height / card.width);
        ctx.drawImage(card, (W - cw) / 2, (H - ch) / 2 - 10, cw, ch);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = "rgba(232,210,150," + (f * 0.12) + ")";
        ctx.fillRect(W * 0.08, H * 0.28, W * 0.84, H * 0.34);
        ctx.strokeStyle = "rgba(93,206,122," + (f * 0.7) + ")";
        ctx.lineWidth = 2;
        ctx.strokeRect(W * 0.08 + 4, H * 0.28 + 4, W * 0.84 - 8, H * 0.34 - 8);
        ctx.fillStyle = "rgba(93,206,122," + f + ")";
        ctx.beginPath();
        ctx.arc(W / 2, H * 0.42, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (photoFlashT > 0 && ui.photoFlash) {
      ui.photoFlash.hidden = false;
      ui.photoFlash.classList.add("on");
    }
  }

  function animalAtScreen(sx, sy) {
    if (window.PO_SNES && PO_SNES.enabled && PO_SNES.maps && PO_SNES.current) {
      const m = PO_SNES.current();
      const T = (m && m.tile) || 16;
      const wx = (sx + (PO_SNES.camX || 0)) / T;
      const wy = (sy + (PO_SNES.camY || 0)) / T;
      let best = null, bestD = 1.4;
      for (let i = 0; i < sprites.length; i++) {
        const sp = sprites[i];
        if (sp.kind !== "animal" || sp.herdSil) continue;
        const d = Math.hypot(sp.x - wx, sp.y - wy);
        if (d < bestD) { bestD = d; best = sp; }
      }
      return best;
    }
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
    // PC with mouse: keep desktop chrome even if a touchscreen is present
    try {
      if (window.matchMedia("(pointer: fine)").matches &&
          !window.matchMedia("(pointer: coarse)").matches) {
        return false;
      }
    } catch (e) {}
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
    return mode === "explore" || mode === "dossier" || mode === "log" || mode === "note" || mode === "help" || mode === "journal" || mode === "bestiary" || mode === "victory";
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

  function likelyParentFullscreen() {
    // Digistracts fullscreen is on the parent page — iframe rarely gets document.fullscreenElement
    if (!isEmbed) return false;
    try {
      if (window.matchMedia && window.matchMedia("(display-mode: fullscreen)").matches) return true;
    } catch (e) {}
    const vh = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
    const target = Math.min(
      (window.screen && (window.screen.availHeight || window.screen.height)) || vh,
      vh + 80
    );
    return vh >= target * 0.86;
  }

  function askParentFullscreen(exit) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: exit ? "po-fs-exit" : "po-fs" }, "*");
      }
    } catch (e) {}
  }

  function tryLandscapeFullscreen() {
    // Called from Full screen button (any device) or Digistracts gesture
    if (mode !== "explore") return;
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
    // Always available while exploring (PC, mobile, embed, fullscreen)
    const show = mode === "explore";
    const fs = isNativeFullscreen() || parentFs || likelyParentFullscreen();
    ui.fsBtn.hidden = !show;
    ui.fsBtn.setAttribute("aria-pressed", fs ? "true" : "false");
    ui.fsBtn.textContent = fs ? "Exit FS" : "FS";
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
        ? "Full screen · Stick · Look ▲▼◀▶ · Drag canvas · Tap animals"
        : "Stick · Look all ways · Drag to look · Notes · Full screen";
    } else if (ui.hint && mode === "explore") {
      ui.hint.textContent = "WASD · Drag look · Tap animal · J journal · P photo · L log · Esc";
    }
    syncFsBtn();
    notifyParentChrome();
    syncChromeToCanvas();
  }

  function openDossier(animal) {
    clearInput();
    closeLog();
    if (mode === "note") {
      notePendingLog = false;
      if (ui.note) ui.note.classList.remove("show");
    }
    if (tourStep === 2) {
      tourStep = 3;
      const s = loadSave();
      s.tourDone = true;
      writeSave(s);
      if (ui.hint) ui.hint.textContent = "Tour complete — explore freely. J journal · P photo";
    }
    setAudioDuck(true);
    openAnimal = animal;
    tab = "facts";
    mode = "dossier";
    syncTouchUI();
    ui.dossier.classList.add("show");
    ui.dName.textContent = animal.data.name;
    ui.dLatin.textContent = animal.data.latin;
    ui.dDanger.textContent = animal.data.danger + (animal.rare ? " · Rare find" : "");
    blip(440, 0.08, "sine");
    const dctx = ui.dArt.getContext("2d");
    dctx.imageSmoothingEnabled = false;
    dctx.fillStyle = "#e8d9b0";
    dctx.fillRect(0, 0, 96, 96);
    dctx.strokeStyle = "#8a6a38";
    dctx.lineWidth = 3;
    dctx.strokeRect(2, 2, 92, 92);
    dctx.strokeStyle = "#c9a227";
    dctx.lineWidth = 1;
    dctx.strokeRect(6, 6, 84, 84);
    dctx.fillStyle = "rgba(90,60,30,0.08)";
    for (let y = 12; y < 88; y += 6) dctx.fillRect(10, y, 76, 1);
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
    setAudioDuck(false);
  }

  function openBestiary() {
    if (!ui.bestiary) return;
    const ids = Object.keys(REMOTE).concat(Object.keys(window.PO_BONUS || {}));
    const uniq = {};
    ids.forEach(function (id) { uniq[id] = true; });
    let html = "<p>Silhouette until sighted. Open a dossier to fill the book.</p><div class=\"po-bestiary-grid\">";
    Object.keys(uniq).sort().forEach(function (id) {
      const seen = !!bestiary[id] || !!animalsSeen[id];
      html += "<div class=\"po-bestiary-cell" + (seen ? " on" : "") + "\"><span>" + (seen ? id : "???") + "</span></div>";
    });
    html += "</div>";
    if (ui.bestiaryBody) ui.bestiaryBody.innerHTML = html;
    ui.bestiary.classList.add("show");
    mode = "bestiary";
    setAudioDuck(true);
    clearInput();
    syncTouchUI();
  }
  function closeBestiary() {
    if (ui.bestiary) ui.bestiary.classList.remove("show");
    if (mode === "bestiary") mode = "explore";
    setAudioDuck(false);
    clearInput();
    syncTouchUI();
  }
  function closeVictory() {
    if (ui.victory) ui.victory.classList.remove("show");
    if (mode === "victory") mode = "explore";
    clearInput();
    syncTouchUI();
  }
  function copyShare() {
    const text = shareLine || "Primal Odyssey";
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        if (ui.hint) ui.hint.textContent = "Share line copied";
      }).catch(function () { window.prompt("Copy share line:", text); });
    } else window.prompt("Copy share line:", text);
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
    if (ui.bestiaryBtn) ui.bestiaryBtn.hidden = false;
    if (ui.focusBtn) ui.focusBtn.hidden = false;
    if (ui.spotterBtn) ui.spotterBtn.hidden = false;
    if (ui.binocsBtn) ui.binocsBtn.hidden = !binocsOwned;
    ui.regionChip.textContent = region.name;
    document.documentElement.classList.toggle("po-spotter", spotterOn);
    closeDossier();
    clearInput();
    syncNotesUI();
    syncObjectives();
    syncTouchUI();
    playRegionMusic(id);
    startAmbient(id);
    persistProgress();
    tryLandscapeFullscreen();
    runStart = t;
    worldFade = 1.35;
    introCard = id === "africa" ? "Golden grass · pride country"
      : (id === "mountains" ? "Thin air · ridge hunters"
        : (id === "wetlands" ? "Glass water · reed blinds" : "Canopy dark · stalkers"));
    questPhase = 0;
    photoRareDone = false;
    autoWalk = false;
    if (ui.autoBtn) ui.autoBtn.setAttribute("aria-pressed", "false");
    if (ui.toolsTray) ui.toolsTray.hidden = true;
    toolsOpen = false;
    if (ui.toolsBtn) ui.toolsBtn.hidden = false;
    if (ui.autoBtn) ui.autoBtn.hidden = false;
    if (ui.questChip) ui.questChip.hidden = false;
    syncQuest();
    const s = loadSave();
    season = s.season || season;
    difficulty = s.difficulty || difficulty;
    weeklyMode = s.weekly !== false;
    if (weeklyMode) sessionSeed = isoWeekSeed();
    document.documentElement.classList.toggle("po-kids", difficulty === "kids");
    document.documentElement.classList.toggle("po-postcard", !!s.postcard);
    if (ui.postcard) ui.postcard.hidden = !s.postcard;
    if (!s.onboarded) openHelp();
    else if (!s.tourDone) {
      tourStep = 1;
      if (ui.hint) ui.hint.textContent = "Follow the compass to the nearest field note";
    }
    if (region && s.regions[id] && s.regions[id].complete && ui.hint) {
      ui.hint.textContent = (BADGE_LABEL[id] || "RANGER") + " · " + (RANGER_TIPS[id] || "Region cleared");
    }
    rangerCd = 10;
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
    if (ui.bestiaryBtn) ui.bestiaryBtn.hidden = true;
    if (ui.focusBtn) ui.focusBtn.hidden = true;
    if (ui.spotterBtn) ui.spotterBtn.hidden = true;
    if (ui.binocsBtn) ui.binocsBtn.hidden = true;
    if (ui.toolsBtn) ui.toolsBtn.hidden = true;
    if (ui.toolsTray) ui.toolsTray.hidden = true;
    if (ui.autoBtn) ui.autoBtn.hidden = true;
    if (ui.questChip) ui.questChip.hidden = true;
    if (ui.cautionEl) ui.cautionEl.hidden = true;
    if (ui.victory) ui.victory.classList.remove("show");
    if (ui.bestiary) ui.bestiary.classList.remove("show");
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
    if (gamePaused && (mode === "explore" || mode === "dossier" || mode === "log" || mode === "note" || mode === "help" || mode === "journal" || mode === "bestiary" || mode === "victory")) {
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
    if (worldFade > 0) worldFade = Math.max(0, worldFade - dt * 0.85);
    if (lightningT > 0) lightningT = Math.max(0, lightningT - dt);
    if (weather.kind === "rain" && weather.t > 0) {
      weather._boltCd = (weather._boltCd || 3) - dt;
      if (weather._boltCd <= 0) {
        weather._boltCd = 3.5 + Math.random() * 5;
        lightningT = 0.28 + Math.random() * 0.12;
        setTimeout(thunderBoom, 180 + Math.random() * 220);
      }
    }
    ambientChirpT -= dt;
    if (ambientChirpT <= 0 && mode === "explore") {
      ambientChirpT = 4 + Math.random() * 7;
      if (Math.random() < 0.65) birdChirp();
    }
    if (victoryFlash > 0) victoryFlash = Math.max(0, victoryFlash - dt);
    if (mode === "explore") {
      updateWeather(dt);
      updateScripted(dt);
      updateStuck(dt);
      rangerCd -= dt;
      if (rangerCd <= 0 && region) {
        rangerCd = 22 + Math.random() * 18;
        const chat = RANGER_CHAT[region.id];
        if (chat && Math.random() < 0.55) radioCall(chat[(Math.random() * chat.length) | 0]);
      }
      movePlayer(dt);
      moveAnimals(dt);
      updateParticles(dt);
      ui.posChip.textContent = "POS " + player.x.toFixed(1) + "," + player.y.toFixed(1);
      drawWorld();
    } else if (mode === "dossier" || mode === "log" || mode === "note" || mode === "help" || mode === "journal" || mode === "bestiary" || mode === "victory") {
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
      else if (mode === "bestiary") closeBestiary();
      else if (mode === "victory") closeVictory();
      else if (mode === "log") closeLog();
      else if (mode === "explore") showTitle();
      return;
    }
    if (mode === "explore" && (e.key === "b" || e.key === "B")) {
      if (binocsOwned) { binocsOn = !binocsOn; if (ui.hint) ui.hint.textContent = binocsOn ? "Binoculars on" : "Binoculars off"; }
      return;
    }
    if (mode === "explore" && (e.key === "v" || e.key === "V")) {
      focusHold = true;
      if (ui.hint) ui.hint.textContent = "Focus — compass shows next objective";
      return;
    }
    if (mode === "explore" && (e.key === "k" || e.key === "K")) {
      openBestiary();
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
  window.addEventListener("keyup", function (e) {
    keys[e.key] = false;
    if (e.key === "v" || e.key === "V") focusHold = false;
  });
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
    if (d.type === "po-fs-state") {
      parentFs = !!d.active;
      syncFsBtn();
      syncTouchUI();
    }
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
  (function bootMeta() {
    const s = loadSave();
    season = s.season || "wet";
    difficulty = s.difficulty || "explorer";
    weeklyMode = s.weekly !== false;
    if (weeklyMode) sessionSeed = isoWeekSeed();
    document.documentElement.classList.toggle("po-kids", difficulty === "kids");
    document.documentElement.classList.toggle("po-postcard", !!s.postcard);
    if (ui.postcard) ui.postcard.hidden = !s.postcard;
    if (ui.seasonBtn) ui.seasonBtn.textContent = "Season · " + (season.charAt(0).toUpperCase() + season.slice(1));
    if (ui.diffBtn) ui.diffBtn.textContent = difficulty === "kids" ? "Kids mode" : "Explorer";
    if (ui.weeklyBtn) {
      ui.weeklyBtn.setAttribute("aria-pressed", weeklyMode ? "true" : "false");
      ui.weeklyBtn.textContent = weeklyMode ? ("Weekly · " + sessionSeed) : "Session seed";
    }
  })();
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
  if (ui.bestiaryBtn) ui.bestiaryBtn.addEventListener("click", openBestiary);
  if (ui.bestiaryX) ui.bestiaryX.addEventListener("click", closeBestiary);
  if (ui.victoryX) ui.victoryX.addEventListener("click", closeVictory);
  if (ui.victoryGo) ui.victoryGo.addEventListener("click", closeVictory);
  if (ui.shareBtn) ui.shareBtn.addEventListener("click", copyShare);
  if (ui.binocsBtn) {
    ui.binocsBtn.addEventListener("pointerdown", function () { if (binocsOwned) binocsOn = true; });
    ui.binocsBtn.addEventListener("pointerup", function () { binocsOn = false; });
    ui.binocsBtn.addEventListener("pointerleave", function () { binocsOn = false; });
  }
  if (ui.focusBtn) {
    ui.focusBtn.addEventListener("pointerdown", function () { focusHold = true; });
    ui.focusBtn.addEventListener("pointerup", function () { focusHold = false; });
    ui.focusBtn.addEventListener("pointerleave", function () { focusHold = false; });
  }
  if (ui.spotterBtn) {
    ui.spotterBtn.addEventListener("click", function () {
      spotterOn = !spotterOn;
      document.documentElement.classList.toggle("po-spotter", spotterOn);
      ui.spotterBtn.setAttribute("aria-pressed", spotterOn ? "true" : "false");
      if (ui.hint) ui.hint.textContent = spotterOn ? "Spotter on — tap animals while explorer moves" : "Spotter off";
      persistProgress();
    });
  }
  if (ui.toolsBtn) {
    ui.toolsBtn.addEventListener("click", function () {
      toolsOpen = !toolsOpen;
      if (ui.toolsTray) ui.toolsTray.hidden = !toolsOpen;
      ui.toolsBtn.setAttribute("aria-pressed", toolsOpen ? "true" : "false");
    });
  }
  if (ui.autoBtn) {
    ui.autoBtn.addEventListener("click", function () {
      autoWalk = !autoWalk;
      ui.autoBtn.setAttribute("aria-pressed", autoWalk ? "true" : "false");
      if (ui.hint) ui.hint.textContent = autoWalk ? "One-thumb: walking toward next goal" : "Auto-walk off";
    });
  }
  if (ui.seasonBtn) {
    ui.seasonBtn.addEventListener("click", function () {
      season = season === "wet" ? "dry" : "wet";
      ui.seasonBtn.textContent = "Season · " + (season.charAt(0).toUpperCase() + season.slice(1));
      persistProgress();
      if (ui.hint) ui.hint.textContent = "Season set to " + season + " — applies on next region enter";
    });
  }
  if (ui.diffBtn) {
    ui.diffBtn.addEventListener("click", function () {
      difficulty = difficulty === "kids" ? "explorer" : "kids";
      document.documentElement.classList.toggle("po-kids", difficulty === "kids");
      ui.diffBtn.textContent = difficulty === "kids" ? "Kids mode" : "Explorer";
      persistProgress();
    });
  }
  if (ui.weeklyBtn) {
    ui.weeklyBtn.addEventListener("click", function () {
      weeklyMode = !weeklyMode;
      sessionSeed = weeklyMode ? isoWeekSeed() : ((Date.now() / 1000) | 0);
      ui.weeklyBtn.setAttribute("aria-pressed", weeklyMode ? "true" : "false");
      ui.weeklyBtn.textContent = weeklyMode ? ("Weekly · " + sessionSeed) : "Session seed";
      persistProgress();
    });
  }
  // dossier swipe tabs
  (function bindDossierSwipe() {
    if (!ui.dossier) return;
    let sx = 0;
    ui.dossier.addEventListener("touchstart", function (e) {
      if (!e.changedTouches || !e.changedTouches[0]) return;
      sx = e.changedTouches[0].clientX;
    }, { passive: true });
    ui.dossier.addEventListener("touchend", function (e) {
      if (!e.changedTouches || !e.changedTouches[0] || mode !== "dossier") return;
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) < 50) return;
      const order = ["facts", "myths", "fun", "survive"];
      let i = order.indexOf(tab);
      if (i < 0) i = 0;
      i = clamp(i + (dx < 0 ? 1 : -1), 0, order.length - 1);
      tab = order[i];
      document.querySelectorAll(".po-tabs button").forEach(function (b) {
        b.classList.toggle("active", b.getAttribute("data-tab") === tab);
      });
      if (openAnimal) {
        const lines = openAnimal.data[tab] || [];
        ui.dBody.innerHTML = lines.map(function (p) { return "<p>" + p + "</p>"; }).join("");
      }
    }, { passive: true });
  })();
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
    poIntegerScale();
    requestAnimationFrame(function () {
      poIntegerScale();
      syncChromeToCanvas();
    });
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
  document.querySelectorAll(".po-card[data-region]").forEach(function (card) {
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
  (function deepLinkRegion() {
    try {
      const q = new URLSearchParams(location.search || "");
      const rid = (q.get("region") || "").toLowerCase();
      // Never auto-load a world — always land on "Choose your expedition"
      if (rid && PO_DATA[rid]) {
        setTimeout(function () {
          const card = document.querySelector('.po-card[data-region="' + rid + '"]');
          if (card) {
            card.classList.add("po-pick");
            try { card.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (e2) {}
          }
          if (ui.hint) ui.hint.textContent = "Pick a biome to begin";
        }, 60);
      }
    } catch (e) {}
  })();
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
