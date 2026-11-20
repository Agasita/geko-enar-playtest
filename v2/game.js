/* ゲコ＆エナー v2 — ほんたい。320x180 のドットをせいすうばいに拡大してひょうじする(すべてのドットがおなじ大きさ)。 */
(function () {
  'use strict';
  const W = 288, H = 180, T = 16, DT = 1 / 60;
  const TL = { EMPTY: 0, STONE: 1, STEEL: 2, CRACK: 3, SPIKE: 5, GLASSED: 6, MAGNET: 7 }; // GLASSED = いろをつけたガラス(いろのちからは、ふつうのブロックとおなじ。もとガラスのしるしがつく)
  const CH2TILE = { '.': 0, '#': 1, 'S': 2, 'c': 3, '^': 5, 'M': 7 };
  // ブロックのいろ(＝Excelのセルのいろ)。いろにはちからがある。
  const COLORS = [
    { n: 'ちゃいろ', hex: '#C9A15E', hi: '#E8CFA0', lo: '#735630', fx: 'ふつう' },
    { n: 'あか', hex: '#E8563F', hi: '#F7A08F', lo: '#A8403F', fx: 'あつい（さわるとダメージ）' },
    { n: 'あお', hex: '#6FD6E8', hi: '#D5F6FC', lo: '#3F9DB5', fx: 'すべる（こおり）' },
    { n: 'みどり', hex: '#58B368', hi: '#8FD18A', lo: '#3F8F52', fx: 'はずむ（ばね）' },
    { n: 'きいろ', hex: '#F5C842', hi: '#FFE27A', lo: '#C99A1E', fx: 'もろい（のると、0.5びょうほどでくずれる）' },
    { n: 'ガラス', hex: '#DCEBF3', hi: '#FFFFFF', lo: '#9DB9C8', fx: 'いろなしのセル（ちからなし）。いろコピーでいろ（ちから）をつけられる' },
  ];
  const GLASS = 5;
  const TABS = [{ id: 'home', name: 'ホーム' }, { id: 'cell', name: 'セル' }, { id: 'data', name: 'データ' }, { id: 'view', name: 'ひょうじ' }];
  // Excelのきのうを、世界のなおすにてんようしたどうぐ。なにもないところにブロックは生まれない(うごかす・ならべる・いろ・隠す・けす、だけ)。
  const TOOLS = [
    { id: 'painter', tab: 'home', name: 'いろコピー', mode: 'painter', cost: 2, help: '①いろをまねるブロックをタップ → ②ガラスのあるはんいをドラッグ（ガラスにだけいろがつく）' },
    { id: 'transform', tab: 'cell', name: 'かたち', mode: 'rect', cost: 8, help: 'はんいのブロックをひっくりかえしたり、まわしたりする（まわすときは、しかくにえらぶ）' },
    { id: 'sort', tab: 'data', name: 'ならべかえ', mode: 'rect', cost: 10, help: 'はんいのブロックを、ひとつのほうこうによせる（まもりブロックとはがねでくぎられる）' },
    { id: 'filter', tab: 'data', name: 'フィルター', mode: 'instant', cost: 8, help: 'いろをえらぶ → そのいろのブロックだけがのこり、ほかはとおりぬけられる' },
    { id: 'protect', tab: 'view', name: 'シートをまもる', mode: 'rect', cost: 4, help: 'はんいのブロックをまもる。まもったブロックは、どのどうぐもきかない' },
    { id: 'unprotect', tab: 'view', name: 'まもりをはずす', mode: 'rect', cost: 6, help: 'はんいのまもりをはずす' },
  ];
  const TOOL_BY = {}; TOOLS.forEach(t => { TOOL_BY[t.id] = t; });
  function newEdit(lv) {
    const first = lv && lv.tools.length ? TOOL_BY[lv.tools[0]] : TOOLS[0];
    return { on: false, tab: first.tab, tool: first.id, opts: { color: 1, tf: 'flipH', sort: 'D', from: 1, to: 2, axis: 'row', fcolor: 2 },
      step: 0, src: null, srcCell: null, sel: null, hover: null, kb: null, undo: [], redo: [], pan: false, cursor: [0, 0], msg: '' };
  }
  const $ = (s) => document.querySelector(s);
  const cv = $('#cv'); let ctx = cv.getContext('2d'); const mainCtx = ctx;
  ctx.imageSmoothingEnabled = false;

  // ===== ドットえ =====
  const sprCache = {};
  function sprite(name, idx, flip) {
    const key = name + ':' + idx + ':' + (flip ? 1 : 0);
    if (sprCache[key]) return sprCache[key];
    const rows = (SPRITES[name][idx] || SPRITES[name][0]);
    const c = document.createElement('canvas'); c.width = rows[0].length; c.height = rows.length;
    const g = c.getContext('2d');
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x]; if (ch === '.') continue;
      g.fillStyle = PAL[ch] || '#f0f'; g.fillRect(flip ? rows[y].length - 1 - x : x, y, 1, 1);
    }
    return (sprCache[key] = c);
  }
  function heroSprite(name, flip) {
    const key = 'hero:' + name + ':' + (flip ? 1 : 0);
    if (sprCache[key]) return sprCache[key];
    const rows = SPRITES.hero[name];
    const c = document.createElement('canvas'); c.width = 16; c.height = 16;
    const g = c.getContext('2d');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const ch = rows[y][x]; if (ch === '.') continue;
      g.fillStyle = PAL[ch]; g.fillRect(flip ? 15 - x : x, y, 1, 1);
    }
    return (sprCache[key] = c);
  }

  // 3x5 のドットフォント(数字と一部の記号)
  const FONT = {
    '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001',
    '5': '111100111001111', '6': '111100111101111', '7': '111001001001001', '8': '111101111101111', '9': '111101111001111',
    ':': '000010000010000', '/': '001001010100100', '.': '000000000000010', '-': '000000111000000', 'x': '000101010101000',
  };
  function text(str, x, y, col) {
    ctx.fillStyle = col || '#fff';
    for (const ch of String(str)) {
      const g = FONT[ch];
      if (g) for (let i = 0; i < 15; i++) if (g[i] === '1') ctx.fillRect(x + (i % 3), y + ((i / 3) | 0), 1, 1);
      x += 4;
    }
  }
  const HEART = ['.1.1.', '11111', '11111', '.111.', '..1..'];
  const GEM = ['..1..', '.121.', '12221', '.121.', '..1..'];
  const BOLT = ['..11.', '.11..', '1111.', '..11.', '.1...'];
  function icon(rows, x, y, c1, c2) {
    for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) {
      const v = rows[j][i]; if (v === '.') continue;
      ctx.fillStyle = v === '2' ? (c2 || '#fff') : c1; ctx.fillRect(x + i, y + j, 1, 1);
    }
  }

  // ===== おと(WebAudio) =====
  let ac = null, muted = false;
  function audio() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = false; } } return ac; }
  function tone(f0, f1, dur, type, vol) {
    const a = audio(); if (!a || muted) return;
    const o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
    o.type = type || 'square'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(vol || .06, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + .02);
  }
  function noise(dur, vol) {
    const a = audio(); if (!a || muted) return;
    const b = a.createBuffer(1, a.sampleRate * dur, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = a.createBufferSource(), g = a.createGain(); g.gain.value = vol || .05; s.buffer = b; s.connect(g); g.connect(a.destination); s.start();
  }
  const SFX = {
    jump() { tone(280, 520, .12, 'square', .04); }, land() { tone(120, 70, .06, 'triangle', .05); },
    swing() { noise(.08, .04); }, hit() { tone(200, 60, .12, 'sawtooth', .06); noise(.06, .05); },
    gem() { tone(660, 990, .1, 'square', .05); setTimeout(() => tone(990, 1320, .12, 'square', .05), 70); },
    spark() { tone(880, 1200, .07, 'triangle', .04); },
    editOn() { tone(500, 200, .18, 'sine', .06); }, editOff() { tone(200, 500, .18, 'sine', .06); },
    place() { tone(440, 660, .06, 'square', .04); }, bad() { tone(140, 100, .1, 'square', .04); },
    hurt() { tone(300, 90, .25, 'sawtooth', .07); }, die() { tone(260, 40, .5, 'sawtooth', .07); },
    win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, f, .14, 'square', .05), i * 110)); },
    bounce() { tone(200, 700, .18, 'sine', .07); }, dash() { noise(.1, .05); tone(400, 200, .1, 'square', .03); },
    freeze() { tone(900, 300, .25, 'triangle', .06); },
  };

  // ===== 保存 =====
  const SAVE_KEY = 'geko-enar-v2';
  let save = { levels: {}, muted: false };
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (s && s.levels) save = s; } catch (e) { /* ほぞんできなくても遊べる */ }
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } }
  muted = !!save.muted;
  // 自作ステージ(ステージさくせいページで保存したもの)を、ステージ一覧のおわりに足す
  const CUSTOM_KEY = 'geko-enar-v2-custom';
  function normalizeCustom(l) {
    const w = l.w | 0, h = Array.isArray(l.front) ? l.front.length : 0;
    if (w < 20 || w > 160 || h < 12 || h > 60 || !Array.isArray(l.color) || l.color.length !== h) throw new Error('bad level');
    if (Array.isArray(l.gems) && l.gems.length > 5) l = Object.assign({}, l, { gems: l.gems.slice(0, 5) });
    return Object.assign({ world: 9, hints: [], solution: [], bg: '#9ADBC0', bg2: '#86CEB0', par: 0, sparks: [], lifts: [], switches: [], doors: [], judges: [], checks: [], gems: [], ents: [], start: [2, 9], flag: [w - 4, 9], custom: true },
      l, { w, h, energy: l.energy | 0, tools: (l.tools || []).filter(id => TOOL_BY[id]), lock: l.lock || l.front.map(() => new Array(w).fill(0)), hints: l.hint ? [{ x: 0, text: l.hint }] : (l.hints || []) });
  }
  (function loadCustomLevels() {
    let arr = []; try { arr = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]'); } catch (e) { arr = []; }
    arr.forEach(l => { try { LEVELS.push(normalizeCustom(l)); } catch (e) { /* こわれたデータはむし */ } });
  })();

  // ===== 状態 =====
  const G = {
    mode: 'title', level: null, levelIdx: 0, paused: false, t: 0, frame: 0,
    front: null, back: null, p: null, enemies: [], bullets: [], parts: [], pick: [], checks: [], flag: null,
    cam: { x: 0, y: 0 }, shake: 0, hitstop: 0, energy: 0, gems: 0, deaths: 0, hits: 0, time: 0,
    edit: null,
    hintShown: {}, respawn: null, flash: 0,
  };
  // しゅじんこうはエナー（ドローンのような鳥）。そうさは ◀ ▶ と「はばたき」だけ。ジャンプでとび、くうちゅうで押し続けると、すこしのあいだ「ふわり」とおちるのがゆっくりになる。
  // 攻撃とダッシュはない（てきは、うえからふんで たおす）。もとのゲコは ?hero=gekko で遊べる。
  const ENER = ((/[?&]hero=(\w+)/.exec(location.search) || [])[1]) !== 'gekko';
  const HOVER_T = .35, HOVER_VY = 36;
  if (ENER) document.body.classList.add('ener');
  const input = { left: false, right: false, down: false, up: false, jumpHeld: false, jumpP: false, atkP: false, dashP: false, editP: false };

  // ===== レベル読み込み =====
  function loadLevel(i) {
    const lv = LEVELS[i]; G.levelIdx = i; G.level = lv;
    G.front = lv.front.map(r => Array.from(r).map(c => CH2TILE[c] || 0));
    G.col = lv.color.map(r => r.slice()); G.lock = lv.lock.map(r => r.slice());
    G.hideRow = new Set(); G.hideCol = new Set(); G.filter = null; G.regen = lv.regen || 0; G.maxE = lv.regen ? 100 : lv.energy; // じっけんシートいがいは、ステージごとの「コストじょうげん」だけ。かいふくしない
    G.enemies = lv.ents.map((e, k) => makeEnemy(e, k));
    G.lifts = (lv.lifts || []).map(l => makeLift(l)); G.crumb = {}; G.mgs = [];
    G.switches = (lv.switches || []).map(s => ({ x: s[0], y: s[1], id: s[2] || 0, on: false }));
    G.doors = (lv.doors || []).map(d => ({ x: d[0], y: d[1], h: d[2], id: d[3] || 0, open: false, anim: 0, latched: false }));
    G.judges = (lv.judges || []).map(j => ({ x: j[0], y: j[1], type: j[2], color: j[3] || 0, id: j[4] || 0, on: false })); G.idOn = {};
    G.pick = [];
    lv.gems.forEach((g, k) => G.pick.push({ type: 'gem', x: g[0] * T + 4, y: g[1] * T + 4, w: 8, h: 8, k, got: false }));
    if (lv.regen) lv.sparks.forEach((g, k) => G.pick.push({ type: 'spark', x: g[0] * T + 4, y: g[1] * T + 4, w: 8, h: 8, k, got: false }));
    G.checks = lv.checks.map(c => ({ x: c[0] * T, y: c[1] * T, on: false }));
    G.flag = { x: lv.flag[0] * T, y: lv.flag[1] * T - 16, w: 16, h: 32 };
    G.respawn = { x: lv.start[0] * T + 3, y: lv.start[1] * T + 2 };
    G.bullets = []; G.parts = [];
    G.energy = lv.energy; G.gems = 0; G.deaths = 0; G.hits = 0; G.time = 0; G.hintShown = {};
    G.edit = newEdit(lv); G.edit.cursor = [lv.start[0], lv.start[1]];
    G.p = newPlayer(G.respawn.x, G.respawn.y);
    G.cam.x = 0; G.cam.y = 0; snapCam();
    G.cleared = false; G.clearT = 0;
    $('#editbar').classList.add('hide'); document.body.classList.remove('editing'); $('#touch').classList.remove('hide');
    UI.refresh();
  }
  function newPlayer(x, y) {
    return { x, y, w: 10, h: 14, vx: 0, vy: 0, face: 1, ground: false, coyote: 0, jbuf: 0, dashT: 0, dashAvail: true, atkT: 0, atkCd: 0, atkHit: null,
      inv: 0, hp: 3, squash: 0, anim: 0, wasGround: false, dead: 0, stun: 0, pogo: false, hurtT: 0 };
  }
  function makeEnemy(e, k) {
    const base = { type: e.type, x: e.x * T, y: e.y * T, k, dead: false, frozen: 0, t: Math.random() * 6, flash: 0, stun: 0 };
    if (e.type === 'walker') return Object.assign(base, { w: 12, h: 12, ox: 2, oy: 4, vx: -28, hp: 1, dir: -1, x: base.x + 2, y: base.y + 4 });
    if (e.type === 'guard') return Object.assign(base, { w: 12, h: 13, ox: 2, oy: 3, vx: -22, hp: 2, dir: -1, x: base.x + 2, y: base.y + 3 });
    if (e.type === 'flyer') return Object.assign(base, { w: 12, h: 10, ox: 2, oy: 5, hp: 1, bx: base.x + 2, by: base.y + 5, range: e.range || 30, x: base.x + 2, y: base.y + 5 });
    if (e.type === 'turret') return Object.assign(base, { w: 12, h: 12, ox: 2, oy: 2, hp: 3, cd: 1.6, tele: 0, x: base.x + 2, y: base.y + 2 });
    return base;
  }
  function snapCam() {
    const lv = G.level; G.cam.x = Math.round(clamp(G.p.x - W / 2, 0, lv.w * T - W)); G.cam.y = Math.round(clamp(G.p.y - H * .6, 0, Math.max(0, lv.h * T - H)));
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ===== 衝突 =====
  const inb = (tx, ty) => tx >= 0 && ty >= 0 && tx < G.level.w && ty < G.level.h;
  function tileAt(tx, ty) { if (tx < 0 || tx >= G.level.w || ty < 0) return TL.STEEL; if (ty >= G.level.h) return 0; return G.front[ty][tx]; }
  const isBlockT = (t) => t === TL.STONE || t === TL.CRACK || t === TL.GLASSED || t === TL.MAGNET;
  // ぎょう・れつの非ひょうじとフィルターの結果、いま実際に「ある」ブロックか
  function blockVisible(tx, ty) { if (G.front[ty][tx] === TL.MAGNET) return !(G.hideRow.has(ty) || G.hideCol.has(tx)); if (G.lock[ty][tx]) return true; if (G.hideRow.has(ty) || G.hideCol.has(tx)) return false; return G.filter === null || G.col[ty][tx] === G.filter; }
  function solidCell(tx, ty) {
    if (tx < 0 || tx >= G.level.w || ty < 0) return true; if (ty >= G.level.h) return false;
    if (G.doors) for (const d of G.doors) if (!d.open && tx === d.x && ty >= d.y && ty < d.y + d.h) return true;
    if (G.mgs) for (const m of G.mgs) if (tx === m.x + m.dx && ty === m.y + m.dy) return true;
    const t = G.front[ty][tx]; if (t === TL.STEEL) return true;
    return isBlockT(t) && blockVisible(tx, ty);
  }
  function colorAt(tx, ty) { return inb(tx, ty) && isBlockT(G.front[ty][tx]) && blockVisible(tx, ty) ? G.col[ty][tx] : -1; }
  const isFragile = (tx, ty) => { if (!inb(tx, ty) || !blockVisible(tx, ty)) return false; const t = G.front[ty][tx]; return t === TL.CRACK || ((t === TL.STONE || t === TL.GLASSED) && G.col[ty][tx] === 4); };
  // ---- リフト: きまったみち(レール)を、きまったくりかえしていったりきたりするあしば。なおすではどうかせない ----
  function makeLift(l) {
    const w = l.w * T, ax = l.x * T, ay = l.y * T, bx = (l.x + l.dx) * T, by = (l.y + l.dy) * T;
    return { col: l.col || 0, ctl: l.ctl === undefined ? -1 : l.ctl, stand: 0, gone: 0, ax, ay, bx, by, w, h: T, period: l.period || 7, t: (l.phase || 0) * (l.period || 7), x: ax, y: ay,
      rail: { x0: Math.min(l.x, l.x + l.dx), y0: Math.min(l.y, l.y + l.dy), x1: Math.max(l.x, l.x + l.dx) + l.w - 1, y1: Math.max(l.y, l.y + l.dy) }, vert: l.dy !== 0 };
  }
  function liftAt(L, t) { const s = .5 - .5 * Math.cos(2 * Math.PI * t / L.period); return { x: L.ax + (L.bx - L.ax) * s, y: L.ay + (L.by - L.ay) * s }; }
  const liftOn = (L) => !L.gone && (G.filter === null || L.col === G.filter); // フィルターでいろがちがうリフトは、とおりぬけられる(うすくなる)
  function onLift(L) { const p = G.p; return liftOn(L) && p.ground && p.x + p.w > L.x && p.x < L.x + L.w && Math.abs(p.y + p.h - L.y) <= 2.5; }
  function updateLifts(dt) {
    const p = G.p;
    for (const L of G.lifts) {
      if (L.ctl < 0 || (G.idOn && G.idOn[L.ctl])) L.t += dt; // はんていセルで うごかす リフトは、ONの あいだだけ うごく
      const n = liftAt(L, L.t), dx = n.x - L.x, dy = n.y - L.y, ride = !p.dead && onLift(L);
      // きいろ(もろい)のリフトは、のると0.5びょうでくずれて、しばらくきえる
      if (L.gone > 0) { L.gone -= dt; if (L.gone <= 0) { L.gone = 0; L.stand = 0; } } else if (L.col === 4) { L.stand = ride ? L.stand + dt : Math.max(0, L.stand - dt); if (L.stand > .5) { L.gone = 2.6; spawnParts(L.x + L.w / 2, L.y + 6, 12, '#F5C842', 60); SFX.hit(); } }
      if (ride && dy <= 0) { moveY(p, dy); moveX(p, dx); }
      L.x = n.x; L.y = n.y;
      if (ride && dy > 0) { moveY(p, dy); moveX(p, dx); }
      if (!ride && !p.dead && liftOn(L) && overlap(p.x, p.y, p.w, p.h, L.x, L.y, L.w, L.h)) { // よこやしたからあたったら、おしだす
        if (Math.abs(dy) >= Math.abs(dx)) p.y = dy < 0 ? L.y - p.h : L.y + L.h; else p.x = dx > 0 ? L.x + L.w : L.x - p.w;
      }
    }
  }
  const liftRailHit = (tx, ty) => G.lifts && G.lifts.some(L => tx >= L.rail.x0 && tx <= L.rail.x1 && ty >= L.rail.y0 && ty <= L.rail.y1);
  function boxHitsSolid(x, y, w, h) {
    if (G.lifts) for (const L of G.lifts) if (liftOn(L) && x < L.x + L.w && x + w > L.x && y < L.y + L.h && y + h > L.y) return true;
    const x0 = Math.floor(x / T), x1 = Math.floor((x + w - .001) / T), y0 = Math.floor(y / T), y1 = Math.floor((y + h - .001) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (solidCell(tx, ty)) return true;
    return false;
  }
  const frozenRects = () => [];
  const overlap = (ax, ay, aw, ah, bx, by, bw, bh) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

  // ===== プレイヤー =====
  const RUN = 105, ACC = 1000, AIR = 720, FRIC = 1400, GRAV = 1100, FALLM = 1.45, JUMP = 300, MAXFALL = 420, BOUNCE = 440, DASH_V = 235;
  function spawnParts(x, y, n, col, sp) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = (sp || 60) * (.3 + Math.random()); G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, life: .35 + Math.random() * .3, col: col || '#fff' }); }
  }
  function hurtPlayer(src, spike) {
    const p = G.p; if (p.inv > 0 || p.dead || G.cleared) return;
    p.hp--; G.hits++; p.inv = 1.3; G.shake = 6; G.hitstop = .08; SFX.hurt(); spawnParts(p.x + 5, p.y + 7, 10, '#E8563F');
    p.vx = -p.face * 110; p.vy = -190; p.stun = .15;
    if (p.hp <= 0 || spike) killPlayer();
  }
  function killPlayer() {
    const p = G.p; if (p.dead) return;
    p.dead = .7; G.deaths++; SFX.die(); spawnParts(p.x + 5, p.y + 7, 18, '#F5C842', 90); p.vx = 0; p.vy = 0; G.shake = 8;
  }
  function respawnPlayer() {
    const hp = 3; G.p = newPlayer(G.respawn.x, G.respawn.y); G.p.hp = hp; G.p.inv = 1; G.cam.x = G.cam.x; G.flash = .3;
  }
  function updatePlayer(dt) {
    const p = G.p;
    if (p.dead) { p.dead -= dt; if (p.dead <= 0) respawnPlayer(); return; }
    if (p.inv > 0) p.inv -= dt;
    if (p.stun > 0) p.stun = Math.max(0, p.stun - dt);
    p.atkCd -= dt;
    if (ENER) { input.atkP = false; input.dashP = false; }
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir && p.stun <= 0) p.face = dir;
    // 接地判定
    p.wasGround = p.ground;
    p.ground = boxHitsSolid(p.x, p.y + 1, p.w, p.h) && p.vy >= 0;
    if (p.ground) { p.coyote = .1; p.dashAvail = true; p.hover = HOVER_T; } else p.coyote -= dt;
    if (input.jumpP) p.jbuf = .11; else p.jbuf -= dt;
    // 足もとのいろ(あお=こおり)
    let onIce = false;
    for (const L of G.lifts) if (L.col === 2 && onLift(L)) onIce = true;
    if (p.ground) { const fy = Math.floor((p.y + p.h + 1) / T); for (let tx = Math.floor(p.x / T); tx <= Math.floor((p.x + p.w - 1) / T); tx++) if (colorAt(tx, fy) === 2) onIce = true; }
    // ダッシュ
    if (input.dashP && p.dashAvail && p.dashT <= 0 && p.stun <= 0) { p.dashT = .17; p.dashAvail = false; p.vx = p.face * DASH_V; p.vy = 0; SFX.dash(); spawnParts(p.x + 5, p.y + 12, 5, '#fff', 30); }
    if (p.dashT > 0) {
      p.dashT -= dt; p.vx = p.face * DASH_V; p.vy = 0;
      const px = Math.floor((p.x + (p.face > 0 ? p.w + 2 : -2)) / T), py = Math.floor((p.y + 7) / T); if (isFragile(px, py)) breakCrack(px, py); // もろいブロックはダッシュでこわれる
    } else if (p.stun <= 0) {
      const target = dir * RUN; const a = dir ? (p.ground ? (onIce ? 260 : ACC) : AIR) : (p.ground ? (onIce ? 70 : FRIC) : 200);
      const dv = target - p.vx; p.vx += clamp(dv, -a * dt, a * dt);
    }
    // ジャンプ
    if (p.jbuf > 0 && p.coyote > 0 && p.stun <= 0) { p.vy = -JUMP; p.jbuf = 0; p.coyote = 0; p.ground = false; p.squash = -.25; SFX.jump(); spawnParts(p.x + 5, p.y + 14, 4, '#fff', 25); }
    // おもさ(うえ昇なかにボタンを離すと低くなる)
    if (p.dashT <= 0) {
      let g = GRAV; if (p.vy > 0) { g *= FALLM; p.free = false; } else if (!input.jumpHeld && p.vy < -80 && !p.free) g *= 2.6;
      p.vy = Math.min(MAXFALL, p.vy + g * dt);
    }
    // ふわり(エナー): くうちゅうでジャンプを押し続けると、すこしのあいだ、おちる速さがおさえられる
    p.hovering = false;
    if (ENER && !window.__noHover && !p.ground && p.vy > 0 && input.jumpHeld && p.hover > 0 && p.stun <= 0) { p.hover -= dt; p.hovering = true; if (p.vy > HOVER_VY) p.vy = HOVER_VY; }
    // 攻撃
    if (input.atkP && p.atkCd <= 0 && p.stun <= 0) { p.atkT = .22; p.atkCd = .3; p.atkHit = new Set(); p.pogo = input.down && !p.ground; SFX.swing(); }
    if (p.atkT > 0) { p.atkT -= dt; if (p.atkT < .17 && p.atkT > .05) doAttack(); }
    // いどうと衝突(x→y)
    moveX(p, p.vx * dt); moveY(p, p.vy * dt);
    // ちゃくち
    p.ground = boxHitsSolid(p.x, p.y + 1, p.w, p.h) && p.vy >= 0;
    if (ENER) { // もろいブロックは、のってから0.45びょうで、くずれる
      const stand = new Set();
      if (p.ground) { const fy = Math.floor((p.y + p.h + 1) / T); for (let tx = Math.floor(p.x / T); tx <= Math.floor((p.x + p.w - 1) / T); tx++) if (isFragile(tx, fy) && !G.lock[fy][tx]) { const k = tx + ',' + fy; stand.add(k); G.crumb[k] = (G.crumb[k] || 0) + dt; if (G.crumb[k] > .45) { breakCrack(tx, fy); delete G.crumb[k]; } } }
      for (const k of Object.keys(G.crumb)) if (!stand.has(k)) { G.crumb[k] -= dt; if (G.crumb[k] <= 0) delete G.crumb[k]; }
    }
    if (p.ground && !p.wasGround) { p.squash = .3; SFX.land(); spawnParts(p.x + 5, p.y + 14, 3, '#fff', 20); }
    // みどりのブロック=ばね
    if (p.ground && p.vy >= 0 && G.lifts.some(L => L.col === 3 && onLift(L))) { p.vy = -BOUNCE; p.hover = HOVER_T; p.free = true; p.ground = false; p.coyote = 0; p.squash = -.4; SFX.bounce(); spawnParts(p.x + 5, p.y + 14, 8, '#8FD18A', 40); }
    if (p.ground && p.vy >= 0) {
      const ty = Math.floor((p.y + p.h + 1) / T), tx0 = Math.floor(p.x / T), tx1 = Math.floor((p.x + p.w - 1) / T);
      for (let tx = tx0; tx <= tx1; tx++) if (colorAt(tx, ty) === 3) { p.vy = -BOUNCE; p.hover = HOVER_T; p.free = true; p.ground = false; p.coyote = 0; p.squash = -.4; SFX.bounce(); spawnParts(p.x + 5, p.y + 14, 8, '#8FD18A', 40); break; }
    }
    // あかいブロック=あつい(さわるとダメージ)
    for (const L of G.lifts) if (L.col === 1 && liftOn(L) && overlap(p.x - 1, p.y - 1, p.w + 2, p.h + 2, L.x, L.y, L.w, L.h)) hurtPlayer(null, false);
    for (let ty = Math.floor((p.y - 1) / T); ty <= Math.floor((p.y + p.h + 1) / T); ty++) for (let tx = Math.floor((p.x - 1) / T); tx <= Math.floor((p.x + p.w) / T); tx++)
      if (colorAt(tx, ty) === 1 && overlap(p.x - 1, p.y - 1, p.w + 2, p.h + 2, tx * T, ty * T, T, T)) hurtPlayer(null, false);
    // 落した
    if (p.y > G.level.h * T + 40) { G.deaths++; G.p.dead = 0.01; SFX.die(); G.p.dead = .5; p.vy = 0; }
    p.anim += dt * (Math.abs(p.vx) > 20 ? 1 : 0.4); if (p.squash) p.squash *= .85; if (Math.abs(p.squash) < .01) p.squash = 0;
  }
  function moveX(e, dx) {
    if (!dx) return;
    const step = Math.sign(dx); let n = Math.abs(dx);
    while (n > 0) {
      const s = Math.min(1, n) * step;
      if (boxHitsSolid(e.x + s, e.y, e.w, e.h)) { e.vx = 0; return true; }
      e.x += s; n -= 1;
    }
    return false;
  }
  function moveY(e, dy) {
    if (!dy) return;
    const step = Math.sign(dy); let n = Math.abs(dy);
    while (n > 0) {
      const s = Math.min(1, n) * step;
      if (boxHitsSolid(e.x, e.y + s, e.w, e.h)) { e.vy = 0; return true; }
      e.y += s; n -= 1;
    }
    return false;
  }
  function attackBox() {
    const p = G.p;
    if (p.pogo) return { x: p.x - 1, y: p.y + p.h - 2, w: p.w + 2, h: 12 };
    return p.face > 0 ? { x: p.x + p.w - 1, y: p.y - 1, w: 20, h: p.h + 2 } : { x: p.x - 19, y: p.y - 1, w: 20, h: p.h + 2 };
  }
  function doAttack() {
    const p = G.p, b = attackBox();
    // ひびわれ・きいろ(もろい)ブロックはこわれる
    const x0 = Math.floor(b.x / T), x1 = Math.floor((b.x + b.w - 1) / T), y0 = Math.floor(b.y / T), y1 = Math.floor((b.y + b.h - 1) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (isFragile(tx, ty) && !G.lock[ty][tx]) breakCrack(tx, ty);
    for (const e of G.enemies) {
      if (e.dead || e.hidden || p.atkHit.has(e)) continue;
      if (!overlap(b.x, b.y, b.w, b.h, e.x, e.y, e.w, e.h)) continue;
      p.atkHit.add(e);
      if (e.type === 'guard' && !p.pogo && ((p.face > 0 && e.dir < 0) || (p.face < 0 && e.dir > 0))) { // たてでふせがれる
        SFX.bad(); spawnParts(e.x + 6, e.y + 6, 4, '#93A0B8'); p.vx = -p.face * 60; continue;
      }
      damageEnemy(e, 1);
      if (p.pogo) { p.vy = -250; p.free = true; p.dashAvail = true; p.pogo = false; }
    }
  }
  function breakCrack(tx, ty) { G.front[ty][tx] = 0; G.col[ty][tx] = 0; SFX.hit(); spawnParts(tx * T + 8, ty * T + 8, 8, '#B07A4F', 70); G.shake = 3; }
  function damageEnemy(e, n) {
    e.hp -= n; e.flash = .15; G.hitstop = .05; G.shake = 3; SFX.hit(); spawnParts(e.x + e.w / 2, e.y + e.h / 2, 7, '#fff', 60);
    if (e.hp <= 0) { e.dead = true; spawnParts(e.x + e.w / 2, e.y + e.h / 2, 14, '#F5C842', 90); if (G.regen) G.pick.push({ type: 'spark', x: e.x + 2, y: e.y + 2, w: 8, h: 8, got: false, drop: true }); }
  }

  // ===== てき =====
  const hiddenAt = (cx, cy) => G.hideRow.has(cy) || G.hideCol.has(cx);
  function updateEnemies(dt) {
    const p = G.p;
    for (const e of G.enemies) {
      if (e.dead) continue;
      e.hidden = hiddenAt(Math.floor((e.x + e.w / 2) / T), Math.floor((e.y + e.h / 2) / T)); // かくしたぎょう・れつのてきは、そこにいない扱い
      e.t += dt; if (e.flash > 0) e.flash -= dt;
      if (e.hidden) continue;
      if (e.stun > 0) { e.stun -= dt; continue; }
      if (e.type === 'walker' || e.type === 'guard') {
        // おもさとあるぎょう(縁やかべで折り返す)
        e.vy = (e.vy || 0) + 900 * dt; if (moveY(e, e.vy * dt)) e.vy = 0;
        const spd = e.type === 'guard' ? 22 : 28;
        const ahead = e.dir > 0 ? e.x + e.w + 2 : e.x - 2;
        const floorAhead = solidCell(Math.floor(ahead / T), Math.floor((e.y + e.h + 2) / T));
        const wall = boxHitsSolid(e.x + e.dir * 2, e.y, e.w, e.h - 1);
        if (!floorAhead || wall) e.dir = -e.dir; else moveX(e, e.dir * spd * dt);
      } else if (e.type === 'flyer') {
        const px = e.x;
        e.x = e.bx + Math.sin(e.t * 1.1) * e.range; e.y = e.by + Math.sin(e.t * 2.2) * 4; e.dir = e.x > px ? 1 : -1;
      } else if (e.type === 'turret') {
        e.cd -= dt; e.dir = (p.x + 5 > e.x + 6) ? 1 : -1;
        if (e.cd < .5) e.tele = 1; else e.tele = 0;
        if (e.cd <= 0 && Math.abs(p.x - e.x) < 150) { e.cd = 2.2; G.bullets.push({ x: e.x + 6 + e.dir * 8, y: e.y + 4, w: 4, h: 4, vx: e.dir * 85 }); }
      }
      // 接触ダメージ・ダッシュ攻撃
      if (!p.dead && overlap(p.x, p.y, p.w, p.h, e.x, e.y, e.w, e.h)) {
        if (p.dashT > 0 && (e.type === 'guard' || e.type === 'walker' || e.type === 'flyer')) { if (e.type === 'guard') { e.stun = .8; } damageEnemy(e, 1); p.dashT = 0; p.vx = -p.face * 60; }
        else if (p.vy > 60 && p.y + p.h - 6 < e.y + 4 && e.type !== 'turret') { damageEnemy(e, 1); p.vy = -240; p.hover = HOVER_T; p.free = true; p.dashAvail = true; } // ふみつけ
        else hurtPlayer(e);
      }
    }
    for (const b of G.bullets) {
      b.x += b.vx * dt;
      if (boxHitsSolid(b.x, b.y, b.w, b.h) || b.x < 0 || b.x > G.level.w * T) b.dead = true;
      if (!G.p.dead && overlap(b.x, b.y, b.w, b.h, p.x, p.y, p.w, p.h)) { b.dead = true; hurtPlayer(null); }
    }
    G.bullets = G.bullets.filter(b => !b.dead);
  }

  // ===== 取得物・ゴール =====
  function updatePickups() {
    const p = G.p; if (p.dead) return;
    for (const k of G.pick) {
      if (k.got || k.gone) continue;
      if (hiddenAt(Math.floor((k.x + 4) / T), Math.floor((k.y + 4) / T))) continue;
      if (overlap(p.x, p.y, p.w, p.h, k.x, k.y, k.w, k.h)) {
        k.got = true;
        if (k.type === 'gem') { G.gems++; SFX.gem(); spawnParts(k.x + 4, k.y + 4, 10, EXCEL ? '#70AD47' : '#7FA2F0', 70); }
        else { G.energy = Math.min(G.maxE, G.energy + 15); SFX.spark(); spawnParts(k.x + 4, k.y + 4, 5, '#F5C842', 40); }
      }
    }
    for (const c of G.checks) {
      if (c.gone) continue;
      if (!c.on && Math.abs(p.x - c.x) < 10 && Math.abs(p.y - c.y) < 24) { c.on = true; G.respawn = { x: c.x + 3, y: c.y + 2 }; SFX.spark(); UI.toast('チェックポイント'); }
    }
    const f = G.flag;
    if (!G.cleared && overlap(p.x, p.y, p.w, p.h, f.x, f.y, f.w, f.h)) winLevel();
  }
  function winLevel() {
    G.cleared = true; G.clearT = 0; SFX.win();
    // 3つのもくひょう(バッジ)。それぞれ別に記録する: ①クリア ②Σ(ほうせき)を全部 ③ノーミス(ダメージをうけない)
    const goals = [true, G.gems >= G.level.gems.length, G.deaths === 0 && G.hits === 0];
    const prev = save.levels[G.level.id] || { goals: [false, false, false] };
    const merged = goals.map((v, i) => v || !!(prev.goals && prev.goals[i]));
    save.levels[G.level.id] = { goals: merged, gemsBest: Math.max(prev.gemsBest || (prev.goals && prev.goals[1] ? G.level.gems.length : 0), G.gems), time: Math.min(prev.time || 1e9, Math.round(G.time * 10) / 10) };
    persist(); G.lastGoals = goals;
    setTimeout(() => { if (G.cleared) UI.showResult(goals); }, 800);
  }
  // 3つのもくひょうのバッジ: ✓クリア / Σが3つそろう / ノーミス（ダメージをうけない）
  function badgesHTML(goals, gemsGot, total, big) {
    const n = (total === undefined ? 3 : total); let sg = '';
    for (let i = 0; i < Math.min(n, 5); i++) sg += '<i class="sg' + (i < gemsGot ? ' on' : '') + '">Σ</i>';
    return '<span class="bds' + (big ? ' big' : '') + '"><span class="bd ck' + (goals[0] ? ' on' : '') + '">✓</span>' + (n ? '<span class="bd sgs' + (goals[1] ? ' all' : '') + '">' + sg + '</span>' : '') + '<span class="bd pf' + (goals[2] ? ' on' : '') + '">ノーミス</span></span>';
  }
  const gemsOf = (lv, s) => (s ? (s.gemsBest !== undefined ? s.gemsBest : (s.goals && s.goals[1] ? lv.gems.length : 0)) : 0);

  // ===== なおす(Excelのしくみ) =====
  const key = (x, y) => x + ',' + y;
  const isBlk = (x, y) => isBlockT(G.front[y][x]);
  const isFixedCell = (x, y) => { const t = G.front[y][x]; return t === TL.STEEL || !!G.lock[y][x]; }; // はがね・トゲ・まもったブロック
  const isMovable = (x, y) => isBlk(x, y) && !G.lock[y][x];
  function actorRects() {
    const r = [{ x: G.p.x, y: G.p.y, w: G.p.w, h: G.p.h }];
    for (const e of G.enemies) if (!e.dead) r.push({ x: e.x, y: e.y, w: e.w, h: e.h });
    return r;
  }
  function cellBlocked(tx, ty) { // ひと・てき・リフトのみちとかさなるマスには、ブロックをおけない
    if (liftRailHit(tx, ty)) return true;
    if (G.doors && G.doors.some(d => tx === d.x && ty >= d.y && ty < d.y + d.h)) return true;
    for (const r of actorRects()) if (overlap(tx * T, ty * T, T, T, r.x, r.y, r.w, r.h)) return true;
    return false;
  }
  function normRect(s) { return { x0: Math.min(s.x0, s.x1), y0: Math.min(s.y0, s.y1), x1: Math.max(s.x0, s.x1), y1: Math.max(s.y0, s.y1) }; }
  const fail = (msg, extra) => Object.assign({ ok: false, msg }, extra || {});
  function rectEach(r, fn) { for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) if (inb(x, y)) fn(x, y); }
  const costOf = (id) => TOOL_BY[id].cost;

  // ---- 計画: 実際に変えるまえに「できるか・費よう・どこが変わるか」を求める ----
  function planMove(src, dx, dy) {
    const cells = [], keys = new Set();
    rectEach(src, (x, y) => { if (isMovable(x, y)) { cells.push({ x, y, t: G.front[y][x], c: G.col[y][x] }); keys.add(key(x, y)); } });
    if (!cells.length) return fail('うごかせるブロックがありません');
    const rect = { x0: dx, y0: dy, x1: dx + (src.x1 - src.x0), y1: dy + (src.y1 - src.y0) }, ghost = [];
    for (const c of cells) {
      const tx = c.x - src.x0 + dx, ty = c.y - src.y0 + dy;
      if (!inb(tx, ty)) return fail('はみだします', { rects: [rect], ghost });
      ghost.push({ x: tx, y: ty, t: c.t, c: c.c });
      if (!(G.front[ty][tx] === 0 || keys.has(key(tx, ty)))) return fail('ぶつかります', { rects: [rect], ghost });
      if (cellBlocked(tx, ty)) return fail('じゃまがあります（キャラクター・リフトのみち）', { rects: [rect], ghost });
    }
    if (cells.every(c => c.x - src.x0 + dx === c.x && c.y - src.y0 + dy === c.y)) return fail('おなじばしょです');
    return { ok: true, cost: costOf('move'), rects: [src, rect], ghost, run() {
      for (const c of cells) { G.front[c.y][c.x] = 0; G.col[c.y][c.x] = 0; }
      for (const c of cells) { const tx = c.x - src.x0 + dx, ty = c.y - src.y0 + dy; G.front[ty][tx] = c.t; G.col[ty][tx] = c.c; }
    } };
  }
  function planSwap(a, dx, dy) {
    const w = a.x1 - a.x0, h = a.y1 - a.y0, b = { x0: dx, y0: dy, x1: dx + w, y1: dy + h };
    if (!inb(b.x0, b.y0) || !inb(b.x1, b.y1)) return fail('はみだします', { rects: [a, b] });
    if (!(a.x1 < b.x0 || b.x1 < a.x0 || a.y1 < b.y0 || b.y1 < a.y0)) return fail('かさなっています', { rects: [a, b] });
    const pairs = []; let changed = false;
    for (let j = 0; j <= h; j++) for (let i = 0; i <= w; i++) {
      const ax = a.x0 + i, ay = a.y0 + j, bx = b.x0 + i, by = b.y0 + j;
      if ((G.front[ay][ax] !== 0 && isFixedCell(ax, ay)) || (G.front[by][bx] !== 0 && isFixedCell(bx, by))) return fail('うごかないセルがふくまれます', { rects: [a, b] });
      if (G.front[ay][ax] !== G.front[by][bx] || G.col[ay][ax] !== G.col[by][bx]) changed = true;
      if (G.front[ay][ax] !== 0 && cellBlocked(bx, by)) return fail('じゃまがあります（キャラクター・リフトのみち）', { rects: [a, b] });
      if (G.front[by][bx] !== 0 && cellBlocked(ax, ay)) return fail('じゃまがあります（キャラクター・リフトのみち）', { rects: [a, b] });
      pairs.push([ax, ay, bx, by]);
    }
    if (!changed) return fail('いれかえてもおなじです', { rects: [a, b] });
    return { ok: true, cost: costOf('swap'), rects: [a, b], run() {
      for (const [ax, ay, bx, by] of pairs) {
        const ft = G.front[ay][ax], fc = G.col[ay][ax]; G.front[ay][ax] = G.front[by][bx]; G.col[ay][ax] = G.col[by][bx]; G.front[by][bx] = ft; G.col[by][bx] = fc;
      }
    } };
  }
  function planClear(r) {
    const cells = []; rectEach(r, (x, y) => { if (isMovable(x, y)) cells.push([x, y]); });
    if (!cells.length) return fail('けせるブロックがありません', { rects: [r] });
    return { ok: true, cost: costOf('clear'), rects: [r], hl: cells, run() { for (const [x, y] of cells) { G.front[y][x] = 0; G.col[y][x] = 0; } } };
  }
  function liftsInRect(r) { return G.lifts.filter(L => L.col === GLASS && !L.gone && L.x < (r.x1 + 1) * T && L.x + L.w > r.x0 * T && L.y < (r.y1 + 1) * T && L.y + L.h > r.y0 * T); }
  function planColor(r, c, id) {
    const ls = liftsInRect(r);
    const cells = []; rectEach(r, (x, y) => { if (isMovable(x, y) && G.col[y][x] === GLASS) cells.push([x, y]); }); // いろをつけられるのは、ガラス(いろなし)だけ
    if (!cells.length && !ls.length) return fail('ガラスがありません（いろをつけられるのは、ガラスだけ）', { rects: [r] });
    const hl = cells.slice(); for (const L of ls) for (let x = Math.floor(L.x / T); x * T < L.x + L.w; x++) hl.push([x, Math.floor(L.y / T)]);
    return { ok: true, cost: costOf(id), rects: [r], hl, run() { for (const [x, y] of cells) { G.col[y][x] = c; G.front[y][x] = TL.GLASSED; } for (const L of ls) { L.col = c; L.mark = true; } } };
  }
  function planTransform(r, op) {
    const w = r.x1 - r.x0 + 1, h = r.y1 - r.y0 + 1;
    if ((op === 'rot' || op === 'trans') && w !== h) return fail('しかくにえらんでね（いま ' + w + '×' + h + '）', { rects: [r] });
    const map = (lx, ly) => ({ flipH: [w - 1 - lx, ly], flipV: [lx, h - 1 - ly], rot: [h - 1 - ly, lx], trans: [ly, lx] }[op]);
    const cells = [], vacated = new Set();
    rectEach(r, (x, y) => { if (isMovable(x, y)) { cells.push({ x, y, t: G.front[y][x], c: G.col[y][x] }); vacated.add(key(x, y)); } });
    if (!cells.length) return fail('うごかせるブロックがありません', { rects: [r] });
    let changed = false;
    for (const c of cells) {
      const [nx, ny] = map(c.x - r.x0, c.y - r.y0); c.tx = r.x0 + nx; c.ty = r.y0 + ny;
      if (!inb(c.tx, c.ty)) return fail('はみだします', { rects: [r] });
      if (!(G.front[c.ty][c.tx] === 0 || vacated.has(key(c.tx, c.ty)))) return fail('うごかないセルにぶつかります', { rects: [r] });
      if (cellBlocked(c.tx, c.ty)) return fail('じゃまがあります（キャラクター・リフトのみち）', { rects: [r] });
      if (c.tx !== c.x || c.ty !== c.y) changed = true;
    }
    if (!changed) return fail('かたちをかえてもおなじです', { rects: [r] });
    return { ok: true, cost: costOf('transform'), rects: [r], ghost: cells.map(c => ({ x: c.tx, y: c.ty, t: c.t, c: c.c })), run() {
      for (const c of cells) { G.front[c.y][c.x] = 0; G.col[c.y][c.x] = 0; }
      for (const c of cells) { G.front[c.ty][c.tx] = c.t; G.col[c.ty][c.tx] = c.c; }
    } };
  }
  function planSort(r, dir) {
    const horiz = dir === 'L' || dir === 'R';
    const lines = horiz ? r.y1 - r.y0 + 1 : r.x1 - r.x0 + 1, len = horiz ? r.x1 - r.x0 + 1 : r.y1 - r.y0 + 1;
    const assign = []; // {x,y,t,c}
    const barrier = (x, y) => (G.front[y][x] !== 0 && isFixedCell(x, y)) || cellBlocked(x, y);
    for (let i = 0; i < lines; i++) {
      const coords = []; for (let k = 0; k < len; k++) coords.push(horiz ? [r.x0 + k, r.y0 + i] : [r.x0 + i, r.y0 + k]);
      let seg = [];
      const flush = () => {
        if (seg.length) {
          const blocks = seg.filter(([x, y]) => isMovable(x, y)).map(([x, y]) => ({ x, y, t: G.front[y][x], c: G.col[y][x] }));
          {
            const first = dir === 'L' || dir === 'U'; const n = blocks.length;
            seg.forEach(([x, y], k) => { const idx = first ? k : k - (seg.length - n); const b = idx >= 0 && idx < n ? blocks[idx] : null; assign.push({ x, y, t: b ? b.t : 0, c: b ? b.c : 0 }); });
          }
        }
        seg = [];
      };
      for (const [x, y] of coords) { if (barrier(x, y)) flush(); else seg.push([x, y]); }
      flush();
    }
    const diff = assign.filter(a => G.front[a.y][a.x] !== a.t || G.col[a.y][a.x] !== a.c);
    if (!diff.length) return fail('ならべかえてもおなじです', { rects: [r] });
    return { ok: true, cost: costOf('sort'), rects: [r], hl: diff.map(d => [d.x, d.y]), run() { for (const a of assign) { G.front[a.y][a.x] = a.t; G.col[a.y][a.x] = a.c; } } };
  }
  function planReplace(r, from, to) {
    if (from === to) return fail('「から」と「へ」がおなじいろです', { rects: [r] });
    const cells = []; rectEach(r, (x, y) => { if (isMovable(x, y) && G.col[y][x] === from) cells.push([x, y]); });
    if (!cells.length) return fail(COLORS[from].n + 'いろのブロックがありません', { rects: [r] });
    return { ok: true, cost: costOf('replace'), rects: [r], hl: cells, run() { for (const [x, y] of cells) G.col[y][x] = to; } };
  }
  function planHide(r, axis) {
    const set = axis === 'col' ? G.hideCol : G.hideRow, lo = axis === 'col' ? r.x0 : r.y0, hi = axis === 'col' ? r.x1 : r.y1;
    const rows = []; for (let i = lo; i <= hi; i++) if (!set.has(i)) rows.push(i);
    const rect = axis === 'col' ? { x0: r.x0, x1: r.x1, y0: 0, y1: G.level.h - 1 } : { x0: 0, x1: G.level.w - 1, y0: r.y0, y1: r.y1 };
    if (!rows.length) return fail('すでにかくれています', { rects: [rect] });
    return { ok: true, cost: costOf('hide'), rects: [rect], run() { for (const i of rows) set.add(i); } };
  }
  function planUnhide() {
    if (!G.hideRow.size && !G.hideCol.size) return fail('かくれたぎょう・れつはありません');
    return { ok: true, cost: costOf('unhide'), run() { G.hideRow.clear(); G.hideCol.clear(); } };
  }
  function planFilter(c) {
    if (G.filter === c) return fail(c === null ? 'フィルターはかかっていません' : 'すでにそのいろです');
    if (c === null) return { ok: true, cost: 0, run() { G.filter = null; } };
    return { ok: true, cost: costOf('filter'), run() { G.filter = c; } };
  }
  function planProtect(r, on) {
    const cells = []; rectEach(r, (x, y) => { if (on ? (isBlk(x, y) && !G.lock[y][x]) : G.lock[y][x]) cells.push([x, y]); });
    if (!cells.length) return fail(on ? 'まもれるブロックがありません' : 'まもったブロックがありません', { rects: [r] });
    return { ok: true, cost: costOf(on ? 'protect' : 'unprotect'), rects: [r], hl: cells, run() { for (const [x, y] of cells) G.lock[y][x] = on ? 1 : 0; } };
  }
  const colOfX = (x) => Math.floor(x / T);
  function shiftEntities(x, dir, removeCol) { // れつ x よりみぎ(いじょう)のもちものをひだりみぎにずらす
    const sh = (v) => v;
    void sh;
    for (const e of G.enemies) { const c = Math.floor((e.x + e.w / 2) / T); if (removeCol && c === x) { e.dead = true; continue; } if (c >= x + (removeCol ? 1 : 0)) { e.x += dir * T; if (e.bx !== undefined) e.bx += dir * T; } }
    for (const k of G.pick) { const c = Math.floor((k.x + 4) / T); if (removeCol && c === x) { k.gone = true; continue; } if (c >= x + (removeCol ? 1 : 0)) k.x += dir * T; }
    for (const k of G.checks) { const c = Math.floor(k.x / T); if (removeCol && c === x) { k.gone = true; continue; } if (c >= x + (removeCol ? 1 : 0)) k.x += dir * T; }
    if (Math.floor(G.flag.x / T) >= x + (removeCol ? 1 : 0)) G.flag.x += dir * T;
    if (Math.floor(G.respawn.x / T) >= x + (removeCol ? 1 : 0)) G.respawn.x += dir * T; else if (removeCol && Math.floor(G.respawn.x / T) === x) G.respawn.x -= T;
    if (Math.floor((G.p.x + 5) / T) >= x + (removeCol ? 1 : 0)) G.p.x += dir * T;
  }
  function shiftSets(x, dir, removeCol) {
    const out = new Set(); for (const c of G.hideCol) { if (removeCol && c === x) continue; out.add(c >= x + (removeCol ? 1 : 0) ? c + dir : c); } G.hideCol = out;
  }
  function planInsCol(x) {
    const w = G.level.w, h = G.level.h;
    if (x < 1 || x > w - 2) return fail('ここにはいれられません', { cols: [x] });
    for (let y = 0; y < h; y++) if (isBlk(w - 1, y)) return fail('いちばんみぎのれつにブロックがあり、はみだします', { cols: [x] });
    if (colOfX(G.flag.x) === w - 1) return fail('ゴールがはみだします', { cols: [x] });
    return { ok: true, cost: costOf('insCol'), cols: [x], run() {
      for (let y = 0; y < h; y++) {
        const leftSteel = G.front[y][x - 1] === TL.STEEL;
        for (let xx = w - 1; xx > x; xx--) { G.front[y][xx] = G.front[y][xx - 1]; G.col[y][xx] = G.col[y][xx - 1]; G.lock[y][xx] = G.lock[y][xx - 1]; }
        G.front[y][x] = leftSteel ? TL.STEEL : 0; G.col[y][x] = 0; G.lock[y][x] = 0;
      }
      shiftEntities(x, 1, false); shiftSets(x, 1, false);
    } };
  }
  function planDelCol(x) {
    const w = G.level.w, h = G.level.h;
    if (x < 1 || x > w - 2) return fail('ここはけせません', { cols: [x] });
    if (colOfX(G.p.x + 5) === x) return fail('キャラクターがいるれつはけせません', { cols: [x] });
    if (colOfX(G.flag.x) === x) return fail('ゴールのれつはけせません', { cols: [x] });
    return { ok: true, cost: costOf('delCol'), cols: [x], run() {
      for (let y = 0; y < h; y++) {
        const lastSteel = G.front[y][w - 1] === TL.STEEL;
        for (let xx = x; xx < w - 1; xx++) { G.front[y][xx] = G.front[y][xx + 1]; G.col[y][xx] = G.col[y][xx + 1]; G.lock[y][xx] = G.lock[y][xx + 1]; }
        G.front[y][w - 1] = lastSteel ? TL.STEEL : 0; G.col[y][w - 1] = 0; G.lock[y][w - 1] = 0;
      }
      shiftEntities(x, -1, true); shiftSets(x, -1, true);
    } };
  }
  function planFor(tool, a) {
    const o = a.opts || G.edit.opts;
    switch (tool) {
      case 'painter': { const [sx, sy] = a.srcCell; if (!inb(sx, sy) || !isBlk(sx, sy)) return fail('まねするブロックがありません'); if (G.col[sy][sx] === GLASS) return fail('ガラスのいろ（いろなし）はコピーできません'); return planColor(a.rect, G.col[sy][sx], 'painter'); }
      case 'transform': return planTransform(a.rect, o.tf);
      case 'sort': return planSort(a.rect, o.sort);
      case 'filter': return planFilter(a.fcolor !== undefined ? a.fcolor : o.fcolor);
      case 'protect': return planProtect(a.rect, true);
      case 'unprotect': return planProtect(a.rect, false);
    }
    return fail('このどうぐはつかえません');
  }

  // ---- 実ぎょう・もとにもどす・やり直す(状態をまるごと保存する) ----
  function minCost() { let m = 999; for (const id of G.level.tools) m = Math.min(m, TOOL_BY[id].cost); return m; }
  function snapshot() {
    return {
      front: G.front.map(r => r.slice()), col: G.col.map(r => r.slice()), lock: G.lock.map(r => r.slice()),
      hideRow: [...G.hideRow], hideCol: [...G.hideCol], filter: G.filter, lc: G.lifts.map(L => L.col), lm: G.lifts.map(L => !!L.mark),
      en: G.enemies.map(e => ({ e, x: e.x, y: e.y, bx: e.bx, dead: e.dead })), pick: G.pick.map(k => ({ k, x: k.x, gone: !!k.gone })),
      checks: G.checks.map(c => ({ c, x: c.x, gone: !!c.gone })), flagX: G.flag.x, resp: { x: G.respawn.x, y: G.respawn.y }, px: G.p.x,
    };
  }
  function restoreSnap(s) {
    G.mgs = [];
    G.front = s.front.map(r => r.slice()); G.col = s.col.map(r => r.slice()); G.lock = s.lock.map(r => r.slice());
    G.hideRow = new Set(s.hideRow); G.hideCol = new Set(s.hideCol); G.filter = s.filter; if (s.lc) s.lc.forEach((c, i) => { G.lifts[i].col = c; G.lifts[i].mark = !!(s.lm && s.lm[i]); });
    for (const o of s.en) { o.e.x = o.x; o.e.y = o.y; if (o.bx !== undefined) o.e.bx = o.bx; o.e.dead = o.dead; }
    for (const o of s.pick) { o.k.x = o.x; o.k.gone = o.gone; }
    for (const o of s.checks) { o.c.x = o.x; o.c.gone = o.gone; }
    G.flag.x = s.flagX; G.respawn = { x: s.resp.x, y: s.resp.y }; G.p.x = s.px;
  }
  function runPlan(plan) {
    const E = G.edit;
    if (!plan.ok) { E.msg = plan.msg; SFX.bad(); return false; }
    if (plan.cost > G.energy) { E.msg = 'エナジーがたりません（' + plan.cost + '）'; SFX.bad(); return false; }
    E.undo.push({ state: snapshot(), cost: plan.cost }); E.redo.length = 0;
    plan.run(); G.mgs = []; G.energy -= plan.cost; E.msg = ''; SFX.place();
    if (!G.regen && G.energy < minCost()) UI.toast('コストをつかいきりました。もうなおせません（Rでやりなおし）', 3500);
    return true;
  }
  function undoEdit() {
    const E = G.edit, u = E.undo.pop(); if (!u) { SFX.bad(); return; }
    E.redo.push({ state: snapshot(), cost: u.cost }); restoreSnap(u.state); G.energy = Math.min(G.maxE, G.energy + u.cost); SFX.place(); E.step = 0; E.src = null; E.msg = '';
  }
  function redoEdit() {
    const E = G.edit, r = E.redo.pop(); if (!r) { SFX.bad(); return; }
    if (G.energy < r.cost) { E.redo.push(r); E.msg = 'エナジーがたりません'; SFX.bad(); return; }
    E.undo.push({ state: snapshot(), cost: r.cost }); restoreSnap(r.state); G.energy -= r.cost; SFX.place();
  }
  function setEdit(on) {
    const E = G.edit; if (G.mode !== 'play' || G.cleared || G.p.dead) return;
    if (!G.level.tools.length) { UI.toast('このステージではなおせないよ'); return; }
    E.on = on; E.sel = null; E.kb = null; E.msg = ''; E.step = 0; E.src = null; E.srcCell = null;
    if (on) { SFX.editOn(); E.cursor = [Math.floor((G.p.x + 5) / T), Math.floor((G.p.y + 7) / T)];  } else SFX.editOff();
    $('#editbar').classList.toggle('hide', !on); $('#touch').classList.toggle('hide', on); document.body.classList.toggle('editing', on); UI.refreshTools();
  }

  // ---- はんいの選びかた(ドラッグ・タップ・キーボード) ----
  const toolDef = () => TOOL_BY[G.edit.tool];
  const hasMovable = (r) => { let n = 0; rectEach(r, (x, y) => { if (isMovable(x, y)) n++; }); return n > 0; };
  function onRectDone(r) {
    const E = G.edit, d = toolDef(); if (!d) return;
    if (d.mode === 'rect') runPlan(planFor(E.tool, { rect: r }));
    else if (d.mode === 'two' && E.step === 0) {
      if (!hasMovable(r)) { E.msg = 'うごかせるブロックがありません'; SFX.bad(); } else { E.src = r; E.step = 1; E.msg = ''; SFX.place(); }
    } else if (d.mode === 'painter' && E.step === 1) { if (runPlan(planFor('painter', { rect: r, srcCell: E.srcCell }))) { /* つづけてぬれる */ } }
    UI.refreshTools();
  }
  function onTap(tx, ty) {
    const E = G.edit, d = toolDef(); if (!d) return;
    if (d.mode === 'two' && E.step === 1) { if (runPlan(planFor(E.tool, { rect: E.src, dst: [tx, ty] }))) { E.step = 0; E.src = null; } }
    else if (d.mode === 'painter' && E.step === 0) {
      if (inb(tx, ty) && isBlk(tx, ty)) { E.srcCell = [tx, ty]; E.step = 1; E.msg = ''; SFX.place(); } else { E.msg = 'ブロックをタップしてね'; SFX.bad(); }
    } else if (d.mode === 'col') runPlan(planFor(E.tool, { col: tx }));
    UI.refreshTools();
  }
  function kbSpace() {
    const E = G.edit, d = toolDef(); if (!d) return;
    const [cx, cy] = E.cursor;
    const corner = () => { if (!E.kb) { E.kb = [cx, cy]; } else { const r = normRect({ x0: E.kb[0], y0: E.kb[1], x1: cx, y1: cy }); E.kb = null; onRectDone(r); } };
    if (d.mode === 'rect') corner();
    else if (d.mode === 'two') { if (E.step === 0) corner(); else onTap(cx, cy); }
    else if (d.mode === 'painter') { if (E.step === 0) onTap(cx, cy); else corner(); }
    else if (d.mode === 'col') onTap(cx, cy);
  }
  function previewPlan() {
    const E = G.edit, d = toolDef(); if (!d) return null;
    const sel = E.sel || (E.kb && { x0: E.kb[0], y0: E.kb[1], x1: E.cursor[0], y1: E.cursor[1] });
    const hv = E.hover || E.cursor;
    if (d.mode === 'rect') return sel ? planFor(E.tool, { rect: normRect(sel) }) : null;
    if (d.mode === 'two') { if (E.step === 0) return sel ? { ok: true, cost: 0, rects: [normRect(sel)], pre: true } : null; return planFor(E.tool, { rect: E.src, dst: hv }); }
    if (d.mode === 'painter') { if (E.step === 0) return null; return sel ? planFor('painter', { rect: normRect(sel), srcCell: E.srcCell }) : null; }
    if (d.mode === 'col') return planFor(E.tool, { col: hv[0] });
    return null;
  }


  // ---- じしゃく: いちばん近い はがね に、ひきよせられる(ちょくせんの上に ほかのブロックがあると、はたらかない) ----
  const MAG_SPEED = RUN; // しゅじんこうがあるくのと、おなじはやさ
  const MAG_DIRS = [[0, 1], [-1, 0], [1, 0], [0, -1]]; // した・ひだり・みぎ・うえ(おなじ距離なら、この順)
  function magPull(x, y) { // {dx,dy,d}: ひきよせる向きと、はがねまでのマス数。なければ null
    let best = null;
    for (const [dx, dy] of MAG_DIRS) {
      for (let d = 1; ; d++) {
        const tx = x + dx * d, ty = y + dy * d; if (!inb(tx, ty)) break;
        if (G.doors.some(q => !q.open && tx === q.x && ty >= q.y && ty < q.y + q.h)) break;
        const t = G.front[ty][tx]; if (t === 0) continue;
        if (t === TL.STEEL) { if (!best || d < best.d) best = { dx, dy, d }; break; }
        break; // ほかのブロックがあるので、このむきは はたらかない
      }
    }
    return best;
  }
  function magStepFree(m) { // つぎのマスに、すすめるか(ひと・てきがいると、まつ)
    const nx = m.x + m.dx, ny = m.y + m.dy; if (!inb(nx, ny) || G.front[ny][nx] !== 0) return false;
    if (G.doors.some(q => !q.open && nx === q.x && ny >= q.y && ny < q.y + q.h)) return false;
    for (const r of actorRects()) if (overlap(nx * T, ny * T, T, T, r.x, r.y, r.w, r.h)) return false;
    return true;
  }
  function updateMagnets(dt) {
    const moving = new Set(G.mgs.map(m => m.x + ',' + m.y));
    // うごいていないじしゃくは、ひきよせられるか調べる
    for (let y = 0; y < G.level.h; y++) for (let x = 0; x < G.level.w; x++) {
      if (G.front[y][x] !== TL.MAGNET || moving.has(x + ',' + y) || !blockVisible(x, y)) continue;
      const pl = magPull(x, y); if (!pl || pl.d <= 1) continue;
      const m = { x, y, dx: pl.dx, dy: pl.dy, off: 0 }; if (magStepFree(m)) { G.mgs.push(m); moving.add(x + ',' + y); }
    }
    for (const m of G.mgs.slice()) {
      if (G.front[m.y][m.x] !== TL.MAGNET) { G.mgs.splice(G.mgs.indexOf(m), 1); continue; }
      if (m.off === 0 && !magStepFree(m)) continue; // まつ(のこして、あとでまた)
      const step = MAG_SPEED * dt, p = G.p;
      const ride = !p.dead && p.ground && p.x + p.w > m.x * T + m.off * T * m.dx && p.x < (m.x + 1) * T + m.off * T * m.dx && Math.abs(p.y + p.h - (m.y * T + m.off * T * m.dy)) <= 2.5;
      m.off += step / T; if (ride) { p.x += m.dx * step; p.y += m.dy * step; }
      while (m.off >= 1) { // 1マスすすんだ
        const nx = m.x + m.dx, ny = m.y + m.dy;
        G.front[ny][nx] = G.front[m.y][m.x]; G.col[ny][nx] = G.col[m.y][m.x]; G.lock[ny][nx] = G.lock[m.y][m.x]; G.front[m.y][m.x] = 0; G.col[m.y][m.x] = 0; G.lock[m.y][m.x] = 0;
        m.x = nx; m.y = ny; m.off -= 1;
        const pl = magPull(m.x, m.y);
        if (!pl || pl.d <= 1 || pl.dx !== m.dx || pl.dy !== m.dy || !magStepFree(m)) { m.off = 0; G.mgs.splice(G.mgs.indexOf(m), 1); SFX.place(); break; }
      }
    }
    // スイッチ: じしゃくがかさなったら、おされる(いちどおしたら、そのまま)
    for (const s of G.switches) {
      if (s.on) continue;
      if (inb(s.x, s.y) && G.front[s.y][s.x] === TL.MAGNET) s.on = true; // そのマスに、じしゃくがある
      if (!s.on) for (const m of G.mgs) { const mx = (m.x + m.dx * m.off) * T, my = (m.y + m.dy * m.off) * T; if (Math.abs(mx - s.x * T) < 8 && Math.abs(my - s.y * T) < 8) s.on = true; }
      if (s.on) { SFX.gem && SFX.gem(); for (const d of G.doors) if (d.id === s.id && !d.open) { d.latched = true; d.open = true; UI.toast('どこかで、とびらがひらいたよ', 1800); } }
    }
  }


  // ---- はんていセル: マスに、くっついた「しらべるところ」。ブロックのじょうたいが そろうと ON。おなじ番号のとびらが ひらく ----
  // 「ある」は、じっさいにぶつかるブロック(フィルターで うすくなったブロックは「ない」)
  function heroOn(j) { const p = G.p; return !p.dead && p.ground && Math.floor((p.x + p.w / 2) / T) === j.x && Math.floor((p.y + p.h - 1) / T) === j.y; }
  function judgeOn(j) {
    if (!inb(j.x, j.y)) return false;
    const t = G.front[j.y][j.x], real = isBlockT(t) && blockVisible(j.x, j.y);
    if (j.type === 'exist') return real || heroOn(j); // しゅじんこうが たっていても「ある」
    if (j.type === 'empty') return !solidCell(j.x, j.y) && !heroOn(j);
    if (j.type === 'color') return real && G.col[j.y][j.x] === j.color;
    return false;
  }
  function updateDoors(dt) {
    for (const j of G.judges) j.on = judgeOn(j);
    G.idOn = {}; for (const j of G.judges) { if (G.idOn[j.id] === undefined) G.idOn[j.id] = true; if (!j.on) G.idOn[j.id] = false; }
    for (const d of G.doors) {
      const mine = G.judges.filter(j => j.id === d.id), cond = mine.length > 0 && mine.every(j => j.on), want = d.latched || cond;
      if (!want && d.open) { // とびらがしまる: ひと・てきが、とびらの中にいたら、しまらない(はさまない)
        const inside = actorRects().some(r => overlap(d.x * T, d.y * T, T, d.h * T, r.x, r.y, r.w, r.h));
        if (!inside) d.open = false;
      } else if (want && !d.open) d.open = true;
      d.anim = Math.max(0, Math.min(1, d.anim + (d.open ? dt * 2 : -dt * 2)));
    }
  }

  // ===== 更新 =====
  function update(dt) {
    if (G.mode !== 'play') return;
    if (G.edit.on) { G.frame++; G.shake = 0; updateDoors(dt); return; }
    if (G.hitstop > 0) { G.hitstop -= dt; return; }
    G.frame++; G.t += dt;
    if (!G.cleared) G.time += dt;
    updateDoors(dt); updateLifts(dt); updateMagnets(dt); updatePlayer(dt); updateEnemies(dt); updatePickups();
    if (!G.cleared) G.energy = Math.min(100, G.energy + dt * G.regen);
    for (const q of G.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 200 * dt; q.life -= dt; }
    G.parts = G.parts.filter(q => q.life > 0);
    G.pick = G.pick.filter(k => !k.got);
    if (G.shake > 0) G.shake = Math.max(0, G.shake - 30 * dt);
    if (G.flash > 0) G.flash -= dt;
    // ヒント
    for (const h of G.level.hints) if (!G.hintShown[h.x] && G.p.x / T >= h.x) { G.hintShown[h.x] = true; UI.toast(h.text, 4200); }
    // カメラ
    const tx = clamp(G.p.x - W / 2 + G.p.face * 22, 0, G.level.w * T - W), ty = clamp(G.p.y - H * .6, 0, Math.max(0, G.level.h * T - H));
    G.cam.x += (tx - G.cam.x) * Math.min(1, dt * 7); G.cam.y += (ty - G.cam.y) * Math.min(1, dt * 5);
    if (G.cleared) G.clearT += dt;
    input.jumpP = input.atkP = input.dashP = input.editP = false;
  }

  // ===== 描画 =====
  function dotRect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
  // みた目: ?gfx=excel(ふつう: Excelかぜ) / ?gfx=snes(ソリッドばん) / ?gfx=classic(もとのえ)
  const THEME = ((/[?&]gfx=(\w+)/.exec(location.search) || [])[1]) || 'excel';
  const EXCEL = THEME === 'excel' && !!window.GFXX, SNES = THEME === 'snes' && !!window.GFX, SOLID = (EXCEL || SNES) && !!window.GFX;
  const TILES = EXCEL ? window.GFXX : SNES ? window.GFX : null;
  if (EXCEL) document.body.classList.add('theme-excel');
  function drawBackground() {
    if (TILES) { TILES.bg(ctx, G, G.level, W, H); return; }
    const lv = G.level; ctx.fillStyle = lv.bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = lv.bg2;
    const sc = Math.round(G.cam.x * .3);
    for (let i = -1; i < 5; i++) { // えんけいのまるいおか(1ドットたんいのかいだん)
      const cx = i * 110 - (sc % 110) + 50, r = 52, base = 150;
      for (let x = cx - r; x < cx + r; x++) { const dx = x + .5 - cx; const h = Math.round(Math.sqrt(r * r - dx * dx) * .55); ctx.fillRect(x, base - h, 1, h + 40); }
    }
    const sd = Math.round(G.cam.x * .5);
    for (let j = 0; j < 16; j++) ctx.fillRect(((j * 47 - sd) % 330 + 330) % 330 - 5, 10 + (j * 31) % 120, 2, 2);
  }
  const TC = { steel: '#66708C', steelL: '#8D97B3', steelD: '#2F3752' };
  const LOCK = ['.111.', '1...1', '11111', '11011', '11111'];
  // もとガラスの印: しろい「つやのわく」(内がわのわくと、かどのきらめき)
  function glassMark(x, y) {
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(x + 2, y + 2, 12, 1); ctx.fillRect(x + 2, y + 2, 1, 12); ctx.fillRect(x + 4, y + 4, 2, 1); ctx.fillRect(x + 4, y + 4, 1, 2);
    ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(x + 3, y + 13, 11, 1); ctx.fillRect(x + 13, y + 3, 1, 11);
  }
  function drawBlock(t, c, x, y, topOpen, botOpen, alpha, seed) {
    const k = COLORS[c] || COLORS[0];
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    if (TILES) { ctx.drawImage(TILES.block(t === TL.GLASSED ? TL.STONE : t, c, topOpen, botOpen, seed === undefined ? 0 : seed), x, y); if (t === TL.GLASSED) glassMark(x, y); ctx.globalAlpha = 1; return; }
    ctx.fillStyle = k.hex; ctx.fillRect(x, y, T, T);
    if (topOpen) { ctx.fillStyle = k.hi; ctx.fillRect(x, y, T, 2); }
    if (botOpen) { ctx.fillStyle = k.lo; ctx.fillRect(x, y + T - 3, T, 3); }
    if (c === 3) { ctx.fillStyle = '#fff'; ctx.fillRect(x + 4, y + 6, 2, 2); ctx.fillRect(x + 7, y + 4, 2, 2); ctx.fillRect(x + 10, y + 6, 2, 2); }
    else if (c === 2) { ctx.fillStyle = k.hi; ctx.fillRect(x + 3, y + 5, 5, 1); ctx.fillRect(x + 6, y + 9, 6, 1); }
    else if (c === 1) { ctx.fillStyle = k.lo; ctx.fillRect(x + 3, y + 4, 2, 3); ctx.fillRect(x + 7, y + 6, 2, 4); ctx.fillRect(x + 11, y + 4, 2, 3); }
    if (c === 5) { ctx.fillStyle = '#fff'; for (let i = 0; i < 6; i++) { ctx.fillRect(x + 3 + i, y + 11 - i, 2, 1); } ctx.fillStyle = k.lo; ctx.fillRect(x, y, T, 1); ctx.fillRect(x, y, 1, T); ctx.fillRect(x + T - 1, y, 1, T); ctx.fillRect(x, y + T - 1, T, 1); }
    if (t === TL.GLASSED) glassMark(x, y);
    if (c === 4 || t === TL.CRACK) { ctx.fillStyle = k.lo; ctx.fillRect(x + 7, y + 2, 2, 4); ctx.fillRect(x + 5, y + 6, 2, 4); ctx.fillRect(x + 9, y + 9, 2, 4); }
    ctx.globalAlpha = 1;
  }

  // じしゃくブロック: はがねいろのからだに、赤と青のきょく(U字)
  function drawMagnet(x, y, alpha) {
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.fillStyle = '#4A5470'; ctx.fillRect(x, y, T, T);
    ctx.fillStyle = '#8D97B3'; ctx.fillRect(x, y, T, 1); ctx.fillRect(x, y, 1, T);
    ctx.fillStyle = '#2B3350'; ctx.fillRect(x, y + T - 1, T, 1); ctx.fillRect(x + T - 1, y, 1, T);
    ctx.fillStyle = '#D9D9D9'; ctx.fillRect(x + 3, y + 3, 10, 10);
    ctx.fillStyle = '#4A5470'; ctx.fillRect(x + 5, y + 3, 6, 6);
    ctx.fillStyle = '#E04444'; ctx.fillRect(x + 3, y + 3, 2, 3); ctx.fillRect(x + 3, y + 3, 2, 2);
    ctx.fillStyle = '#3F7FE0'; ctx.fillRect(x + 11, y + 3, 2, 3);
    ctx.fillStyle = '#E04444'; ctx.fillRect(x + 3, y + 3, 2, 4); ctx.fillStyle = '#3F7FE0'; ctx.fillRect(x + 11, y + 3, 2, 4);
    ctx.globalAlpha = 1;
  }
  const SW_COL = ['#C00000', '#2E75B6', '#217346', '#C99A1E'];
  function drawSwitch(s, cx, cy) {
    const x = s.x * T - cx, y = s.y * T - cy, c = SW_COL[s.id % 4];
    ctx.fillStyle = '#595959'; ctx.fillRect(x + 2, y + 12, 12, 4);
    ctx.fillStyle = c; ctx.fillRect(x + 3, y + (s.on ? 13 : 10), 10, s.on ? 2 : 3);
    ctx.fillStyle = 'rgba(255,255,255,.6)'; if (!s.on) ctx.fillRect(x + 4, y + 10, 8, 1);
  }

  // はんていセルのわく(ブロックのうえに かさねる): しゅるいごとの いろの、ふとめの てんせん。ON=うすく いろをぬり、チェック
  const JUDGE_COL = { exist: '#8A4FD0', empty: '#4D4D4D' };
  const judgeColor = (j) => j.type === 'color' ? ((COLORS[j.color] || COLORS[0]).hex) : JUDGE_COL[j.type];
  const idNum = (n) => String(n + 1);
  function outlinedNum(str, x, y, col) { text(str, x + 1, y, '#FFFFFF'); text(str, x - 1, y, '#FFFFFF'); text(str, x, y + 1, '#FFFFFF'); text(str, x, y - 1, '#FFFFFF'); text(str, x, y, col); }
  function drawLinks(cx, cy) { // どのはんていセルが、どのとびら・リフトに つながっているか(おなじ いろの てんせん)
    for (const j of G.judges) {
      const col = SW_COL[j.id % 4], x0 = j.x * T + 8 - cx, y0 = j.y * T + 8 - cy, ends = [];
      for (const d of G.doors) if (d.id === j.id) ends.push([d.x * T + 8 - cx, clamp(j.y * T + 8, d.y * T + 4, d.y * T + d.h * T - 4) - cy]);
      for (const L of G.lifts) if (L.ctl === j.id) ends.push([L.x + L.w / 2 - cx, L.y + L.h / 2 - cy]);
      for (const [x1, y1] of ends) {
        const len = Math.hypot(x1 - x0, y1 - y0), n = Math.floor(len / 5);
        for (let k = 1; k < n; k++) { const x = Math.round(x0 + (x1 - x0) * k / n), y = Math.round(y0 + (y1 - y0) * k / n); ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(x - 1, y - 1, 3, 3); ctx.fillStyle = col; ctx.fillRect(x, y, 2, 2); }
      }
    }
  }
  function drawJudges(cx, cy) {
    drawLinks(cx, cy);
    for (const j of G.judges) {
      const x = j.x * T - cx, y = j.y * T - cy, c = judgeColor(j);
      if (j.on) { ctx.globalAlpha = .16; ctx.fillStyle = c; ctx.fillRect(x, y, T, T); ctx.globalAlpha = 1; }
      // Excelの「コメント」のしるし: かどの さんかく。いろ＝はんていの しゅるい(そんざい=むらさき / あき=こいはい / いろ=そのいろ)
      for (let i = 0; i < 11; i++) { ctx.fillStyle = '#000000'; ctx.fillRect(x + T - (11 - i), y + i, 11 - i, 1); }
      for (let i = 0; i < 9; i++) { ctx.fillStyle = c; ctx.fillRect(x + T - (9 - i), y + i, 9 - i, 1); }
      outlinedNum(idNum(j.id), x + 1, y + T - 7, '#262626'); // つながる ばんごう
      if (j.on) { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x + T - 8, y + T - 9, 7, 7); ctx.fillStyle = '#217346'; ctx.fillRect(x + T - 7, y + T - 6, 2, 2); ctx.fillRect(x + T - 6, y + T - 5, 2, 2); ctx.fillRect(x + T - 5, y + T - 4, 2, 2); ctx.fillRect(x + T - 4, y + T - 5, 2, 2); ctx.fillRect(x + T - 3, y + T - 7, 2, 3); }
    }
  }
  function drawDoors(cx, cy) {
    for (const d of G.doors) {
      const c = SW_COL[d.id % 4], x = d.x * T - cx, y = d.y * T - cy, h = d.h * T, a = 1 - d.anim;
      if (a <= 0.02) { ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(x + 7, y, 2, h); continue; }
      ctx.globalAlpha = Math.max(.15, a); const hh = Math.round(h * Math.max(.1, a));
      ctx.fillStyle = '#3B3F4D'; ctx.fillRect(x + 2, y, 12, hh); ctx.fillStyle = c; ctx.fillRect(x + 2, y, 12, 3); ctx.fillRect(x + 2, y + hh - 3, 12, 3);
      ctx.fillStyle = '#5A6074'; for (let yy = y + 6; yy < y + hh - 4; yy += 6) ctx.fillRect(x + 4, yy, 8, 2);
      ctx.fillStyle = c; ctx.fillRect(x + 4, y + (hh >> 1) - 4, 8, 8); text(idNum(d.id), x + 7, y + (hh >> 1) - 2, '#FFFFFF'); ctx.globalAlpha = 1;
    }
  }
  function drawTile(t, x, y, tx, ty) {
    if (t === TL.MAGNET) { if ((G.hideRow.has(ty) || G.hideCol.has(tx)) && !G.lock[ty][tx]) return; const mv = G.mgs.find(m => m.x === tx && m.y === ty); drawMagnet(Math.round(x + (mv ? mv.dx * mv.off * T : 0)), Math.round(y + (mv ? mv.dy * mv.off * T : 0))); if (G.lock[ty][tx] && SOLID) ctx.drawImage(GFX.lock(), x + 8, y + 1); return; }
    if (isBlockT(t)) {
      if ((G.hideRow.has(ty) || G.hideCol.has(tx)) && !G.lock[ty][tx]) return;
      const faded = G.filter !== null && G.col[ty][tx] !== G.filter && !G.lock[ty][tx];
      drawBlock(t, G.col[ty][tx], x, y, !solidCell(tx, ty - 1), !solidCell(tx, ty + 1), faded ? .28 : undefined, tx * 7 + ty * 13);
      if (G.lock[ty][tx] && SOLID) ctx.drawImage(GFX.lock(), x + 8, y + 1);
      else if (G.lock[ty][tx]) { ctx.fillStyle = '#1F2A44'; ctx.fillRect(x + 9, y + 1, 6, 7); icon(LOCK, x + 10, y + 2, '#F5C842'); }
    } else if (t === TL.STEEL) {
      ctx.drawImage(GFX.metal(), x, y);
    }
  }
  // レール(いったりきたりするみち)は、うすくみせる。リフトは、矢印つきのみどりのいた
  function drawLiftRails(cx, cy) {
    for (const L of G.lifts) {
      const r = L.rail, x = r.x0 * T - cx, y = r.y0 * T - cy, w = (r.x1 - r.x0 + 1) * T, h = (r.y1 - r.y0 + 1) * T, c = EXCEL ? '33,115,70' : '255,255,255';
      ctx.fillStyle = 'rgba(' + c + ',.10)'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(' + c + ',.35)';
      if (L.vert) { for (let yy = y; yy < y + h; yy += 4) { ctx.fillRect(x + L.w / 2 - 1 + 0, yy, 2, 2); } ctx.fillRect(x, y, L.w, 1); ctx.fillRect(x, y + h - 1, L.w, 1); }
      else { for (let xx = x; xx < x + w; xx += 4) ctx.fillRect(xx, y + 7, 2, 2); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h); }
    }
  }
  // リフトのいたのいろ: 0=ふつう(みどりのいた) 1〜4=ちからのいろ(ブロックとおなじ) 5=ガラス(いろなし)
  const LIFT_EXCEL = [['#7F7F7F', '#FFCC99', '#FFE5CC', '#C99A66', '#3F3F76'], ['#9C0006', '#FF8F9A', '#FFC7CE', '#7A0000', '#9C0006'], ['#1F4E79', '#9DC3E6', '#DDEBF7', '#2E75B6', '#1F4E79'], ['#00673A', '#70D68F', '#C6EFCE', '#00873C', '#00673A'], ['#7F5200', '#FFD966', '#FFF2CC', '#BF9000', '#7F5200'], ['#6B8FB8', '#F4F9FD', '#FFFFFF', '#B7D0EA', '#5A7FA6']];
  function liftPalette(c) {
    if (EXCEL || c === 5) return LIFT_EXCEL[c] || LIFT_EXCEL[0];
    const k = COLORS[c] || COLORS[0]; return [k.lo, k.hex, k.hi, k.lo, '#FFFFFF'];
  }
  function drawLifts(cx, cy) {
    for (const L of G.lifts) {
      if (L.gone) continue;
      const x = Math.round(L.x - cx), y = Math.round(L.y - cy), w = L.w, h = L.h, P = liftPalette(L.col || 0);
      if (L.col === 4 && L.stand > 0) ctx.globalAlpha = Math.max(.35, 1 - L.stand);
      if (!liftOn(L)) ctx.globalAlpha = .28; // フィルターできえているリフト: うすくみえる(とおりぬけられる)
      ctx.fillStyle = P[0]; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = P[1]; ctx.fillRect(x + 1, y + 1, w - 2, h - 5);
      ctx.fillStyle = P[2]; ctx.fillRect(x + 1, y + 1, w - 2, 2);
      ctx.fillStyle = P[3]; ctx.fillRect(x + 1, y + h - 4, w - 2, 3);
      if (L.col === 5) { ctx.fillStyle = '#DDEBF7'; for (let i = 0; i < 4; i++) ctx.fillRect(x + 3 + i * 8, y + 3, 4, 1); }
      const mx = x + (w >> 1), my = y + 6;
      ctx.fillStyle = P[4];
      if (L.vert) { ctx.fillRect(mx, my - 3, 1, 7); ctx.fillRect(mx - 1, my - 2, 3, 1); ctx.fillRect(mx - 2, my - 1, 5, 1); ctx.fillRect(mx - 1, my + 3, 3, 1); ctx.fillRect(mx - 2, my + 2, 5, 1); }
      else { ctx.fillRect(mx - 4, my, 9, 1); ctx.fillRect(mx - 4, my - 1, 1, 3); ctx.fillRect(mx - 3, my - 2, 1, 5); ctx.fillRect(mx + 4, my - 1, 1, 3); ctx.fillRect(mx + 3, my - 2, 1, 5); }
      if (L.col === 1) { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x + 3, y + 3, 1, 1); ctx.fillRect(x + w - 4, y + 3, 1, 1); }
      ctx.fillStyle = '#FFE27A'; if (L.col !== 5) { ctx.fillRect(x + 2, y + h - 3, 2, 1); ctx.fillRect(x + w - 4, y + h - 3, 2, 1); }
      if (L.ctl >= 0) { const tc = SW_COL[L.ctl % 4]; ctx.fillStyle = '#000'; ctx.fillRect(x + 1, y - 9, 9, 9); ctx.fillStyle = tc; ctx.fillRect(x + 2, y - 8, 7, 7); text(idNum(L.ctl), x + 4, y - 6, '#FFFFFF'); if (!(G.idOn && G.idOn[L.ctl])) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x + w - 8, y + 4, 2, 6); ctx.fillRect(x + w - 5, y + 4, 2, 6); } }
      if (L.mark) { ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillRect(x + 2, y + 2, w - 4, 1); ctx.fillRect(x + 2, y + 2, 1, h - 6); ctx.fillRect(x + 4, y + 4, 2, 1); ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(x + 3, y + h - 5, w - 5, 1); }
      ctx.globalAlpha = 1;
    }
  }
  // Excelの「Σ（ごうけい）」: ほうせきのかわり。ステージに3つ。あつめると、HUDの3つのわくが、うまっていく
  const SIGMA = ['11111', '10000', '01000', '00100', '01000', '10000', '11111'];
  function sigmaTile(x, y, s, on) {
    ctx.fillStyle = on ? '#185C37' : '#A6A6A6'; ctx.fillRect(x, y, s, s); ctx.fillStyle = on ? '#217346' : '#D9D9D9'; ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
    if (on) { ctx.fillStyle = '#4FAE78'; ctx.fillRect(x + 1, y + 1, s - 2, 1); }
    const ox = x + ((s - 5) >> 1), oy = y + ((s - 7) >> 1); ctx.fillStyle = on ? '#FFFFFF' : '#A6A6A6';
    for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) if (SIGMA[j][i] === '1') ctx.fillRect(ox + i, oy + j, 1, 1);
  }
  function drawWorld() {
    const lv = G.level, cx = Math.round(G.cam.x + (G.sx || 0)), cy = Math.round(G.cam.y);
    const x0 = Math.max(0, Math.floor(cx / T)), x1 = Math.min(lv.w - 1, Math.floor((cx + W) / T)), y0 = Math.max(0, Math.floor(cy / T)), y1 = Math.min(lv.h - 1, Math.floor((cy + H) / T));
    drawLiftRails(cx, cy);
    for (const s of G.switches) drawSwitch(s, cx, cy);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) { const t = G.front[ty][tx]; if (t) drawTile(t, tx * T - cx, ty * T - cy, tx, ty); }
    drawLifts(cx, cy); drawDoors(cx, cy);
    // かくしたぎょう・れつは、てんせんで示す
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    for (const ty of G.hideRow) for (let x = 0; x < W; x += 4) ctx.fillRect(x, ty * T - cy + 7, 2, 2);
    for (const tx of G.hideCol) for (let y = 0; y < H; y += 4) ctx.fillRect(tx * T - cx + 7, y, 2, 2);
    // チェックポイントとゴール
    for (const c of G.checks) { if (c.gone) continue; const x = c.x - cx, y = c.y - cy; ctx.fillStyle = '#5B6785'; ctx.fillRect(x + 7, y + 2, 2, 14); ctx.fillStyle = c.on ? '#F5C842' : '#93A0B8'; ctx.fillRect(x + 9, y + 2, 6, 4); }
    { const f = G.flag, x = f.x - cx, y = f.y - cy; ctx.fillStyle = '#5B6785'; ctx.fillRect(x + 6, y, 3, 32); ctx.fillStyle = '#E8563F'; ctx.fillRect(x + 9, y + 1, 12, 9); ctx.fillStyle = '#fff'; ctx.fillRect(x + 12, y + 3, 3, 3); }
    // 取得物
    for (const k of G.pick) {
      if (k.gone || hiddenAt(Math.floor((k.x + 4) / T), Math.floor((k.y + 4) / T))) continue;
      const x = k.x - cx, y = k.y - cy + Math.round(Math.sin(G.t * 4 + k.x) * 1.5);
      if (k.type === 'gem') { if (EXCEL) sigmaTile(x - 1, y - 1, 10, true); else icon(GEM, x + 1, y + 1, '#4C9BE8', '#BFD8FF'); } else icon(BOLT, x + 1, y + 1, '#F5C842');
    }
    // てき
    for (const e of G.enemies) {
      if (e.dead || e.hidden) continue;
      const fr = Math.floor(e.t * 4) % 2, flip = e.dir > 0;
      const name = e.type === 'walker' ? 'walker' : e.type === 'guard' ? 'guard' : e.type === 'flyer' ? 'flyer' : 'turret';
      const fi = name === 'guard' || name === 'turret' ? 0 : fr;
      const s = EXCEL ? GFXX.enemy(name, fi, e.dir < 0) : sprite(name, fi, flip);
      const x = Math.round(e.x - (e.ox || 0) - cx) - (EXCEL ? 1 : 0), y = Math.round(e.y - (e.oy || 0) - cy) - (EXCEL ? 1 : 0);
      if (e.flash > 0 && Math.floor(e.flash * 40) % 2) ctx.globalAlpha = .4; ctx.drawImage(s, x, y); ctx.globalAlpha = 1;
      if (e.type === 'guard' && !EXCEL) { ctx.fillStyle = '#4C9BE8'; ctx.fillRect(Math.round(e.x - cx) + (e.dir > 0 ? e.w - 1 : -3), Math.round(e.y - cy), 4, e.h); }
      if (e.type === 'turret' && e.tele) { ctx.fillStyle = '#FFE27A'; ctx.fillRect(Math.round(e.x - cx) + 4, Math.round(e.y - cy) - 4, 4, 2); }
    }
    for (const b of G.bullets) dotRect(b.x - cx, b.y - cy, 4, 4, '#E8563F');
    drawPlayer(cx, cy);
    for (const q of G.parts) dotRect(q.x - cx, q.y - cy, 2, 2, q.col);
    drawJudges(cx, cy); // はんていセルは、ブロックがあっても、しゅじんこうがいても、いちばん手前
    // 相棒エナー
    if (!ENER) { const p = G.p, bx = Math.round(p.x - cx - p.face * 14 + Math.sin(G.t * 3) * 1), by = Math.round(p.y - cy - 12 + Math.sin(G.t * 4) * 2); if (EXCEL) ctx.drawImage(GFXX.bird(p.face < 0), bx - 1, by - 1); else if (SOLID) ctx.drawImage(GFX.bird(p.face < 0), bx - 1, by - 1); else ctx.drawImage(sprite('bird', 0, p.face < 0), bx, by); }
  }
  const ENER_PAL = { W: '#FFFFFF', S: '#C6D3F0', U: '#4F7FE0', V: '#8FB0F5', O: '#F29B3A', e: '#1F2A44', f: '#E8663A' };
  const enerCache = {};
  function enerImg(name, flip) {
    if (EXCEL) return GFXX.ener(name, flip);
    const k = name + (flip ? 1 : 0); return enerCache[k] || (enerCache[k] = GFX.gridSprite(GFX.enerGrid(name, ENER_PAL), flip));
  }
  function drawEner(cx, cy) { // しゅじんこうエナー
    const p = G.p, flap = Math.floor(G.t * (p.hovering ? 16 : 9)) % 2;
    let name = 'idle';
    if (p.stun > 0) name = 'hurt'; else if (p.hovering) name = flap ? 'up' : 'down'; else if (!p.ground) name = p.vy < -40 ? 'up' : 'down'; else if (Math.abs(p.vx) > 25) name = flap ? 'idle' : 'down';
    const bob = p.ground && Math.abs(p.vx) <= 25 ? Math.round(Math.sin(G.t * 4) * 1) : 0;
    ctx.drawImage(enerImg(name, p.face < 0), Math.round(p.x - 3 - cx), Math.round(p.y - 1 - cy) + bob);
    if (p.hovering) { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(Math.round(p.x + 2 - cx), Math.round(p.y + p.h + 2 - cy), 6, 1); ctx.fillRect(Math.round(p.x + 4 - cx), Math.round(p.y + p.h + 4 - cy), 2, 1); }
  }
  function drawPlayer(cx, cy) {
    const p = G.p; if (p.dead) return;
    if (p.inv > 0 && Math.floor(p.inv * 20) % 2) return;
    if (ENER) { drawEner(cx, cy); return; }
    let name = 'idle0';
    if (p.stun > 0) name = 'hurt';
    else if (p.atkT > 0) name = p.atkT > .13 ? 'windup' : 'swing';
    else if (!p.ground) name = p.vy < -40 ? 'rise' : p.vy > 40 ? 'fall' : 'takeoff';
    else if (Math.abs(p.vx) > 25) name = ['walk0', 'walk1', 'walk2', 'walk3'][Math.floor(p.anim * 10) % 4];
    else name = Math.floor(G.t * 1.6) % 2 ? 'idle2' : 'idle0';
    const sq = p.squash, sx = 1 + Math.abs(sq) * .0, sy = 1;
    void sx; void sy;
    const x = Math.round(p.x - 3 - cx), y = Math.round(p.y - 2 - cy);
    if (EXCEL) ctx.drawImage(GFXX.hero(name, p.face < 0), x - 1, y - 1); else if (SOLID) ctx.drawImage(GFX.hero(name, p.face < 0), x - 1, y - 1); else ctx.drawImage(heroSprite(name, p.face < 0), x, y);
    if (p.dashT > 0) { ctx.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 1; i < 4; i++) ctx.fillRect(x + 3 - p.face * i * 6, y + 5, 6, 8); }
    if (p.atkT > 0) { // レンチのこ
      const b = attackBox(), prog = 1 - p.atkT / .22; ctx.fillStyle = '#D5DBE6';
      if (p.pogo) { ctx.fillRect(Math.round(b.x - cx) + 2, Math.round(b.y - cy), 8, 3 + Math.round(prog * 8)); }
      else { const len = Math.round(6 + prog * 14); ctx.fillRect(Math.round(p.face > 0 ? b.x - cx : b.x + b.w - cx - len), Math.round(b.y - cy) + 2, len, 3); ctx.fillStyle = '#93A0B8'; ctx.fillRect(Math.round(p.face > 0 ? b.x - cx + len - 3 : b.x + b.w - cx - len), Math.round(b.y - cy) + 2, 3, 10); }
    }
  }
  function drawHUD() {
    return; // HUDは、ウィンドウのリボンにだす(キャンバスにはかかない)
    const X = EXCEL; // Excelかぜ: しろいいた(コメントのような)のうえに、くらいいろでかく
    if (X) { ctx.save(); ctx.translate(GFXX.HW + 2, GFXX.HH + 2); const ph = (G.level.tools.length ? 33 : 24) + (G.filter !== null ? 9 : 0); ctx.fillStyle = '#F3F3F3'; ctx.fillRect(0, 0, 88, ph); ctx.fillStyle = '#ABABAB'; ctx.fillRect(0, 0, 88, 1); ctx.fillRect(0, ph - 1, 88, 1); ctx.fillRect(0, 0, 1, ph); ctx.fillRect(87, 0, 1, ph); }
    const ink = X ? '#262626' : '#fff', sub = X ? '#595959' : '#D5DBE6';
    // ハート
    for (let i = 0; i < 3; i++) icon(HEART, 6 + i * 7, 6, i < G.p.hp ? '#E8563F' : (X ? '#D0D0D0' : '#2F3752'));
    // エナジー(なおせないステージではでさない)
    if (G.level.tools.length) {
      ctx.fillStyle = X ? '#7F7F7F' : '#1F2A44'; ctx.fillRect(5, 15, 62, 7); ctx.fillStyle = X ? '#FFFFFF' : '#5B6785'; ctx.fillRect(6, 16, 60, 5);
      ctx.fillStyle = G.energy < minCost() ? '#E8563F' : (X ? '#70AD47' : '#F5C842'); ctx.fillRect(6, 16, Math.round(60 * G.energy / Math.max(1, G.maxE)), 5);
      icon(BOLT, 70, 14, X ? '#C99A1E' : '#F5C842'); text(Math.floor(G.energy), 77, 16, ink);
    }
    // ほうせき
    const gy = G.level.tools.length ? 25 : 16;
    const ng = G.level.gems.length;
    if (X && ng <= 5 && ng > 0) for (let i = 0; i < ng; i++) sigmaTile(6 + i * 11, gy - 1, 9, i < G.gems);
    else if (ng) { if (X) sigmaTile(6, gy - 1, 9, true); else icon(GEM, 6, gy, '#4C9BE8', '#BFD8FF'); text(G.gems + '/' + ng, X ? 17 : 13, gy + 1, ink); }
    if (G.filter !== null) { icon(FUNNEL, 6, gy + 9, ink); ctx.fillStyle = COLORS[G.filter].hex; ctx.fillRect(15, gy + 9, 6, 5); if (X) { ctx.fillStyle = '#7F7F7F'; ctx.fillRect(15, gy + 9, 6, 1); ctx.fillRect(15, gy + 13, 6, 1); } }
    text(Math.floor(G.time / 60) + ':' + String(Math.floor(G.time % 60)).padStart(2, '0'), 42, gy + 1, sub);
    if (X) ctx.restore();
  }
  const FUNNEL = ['1111111', '.11111.', '..111..', '..111..', '...1...'];
  function drawEditOverlay() {
    const E = G.edit, cx = Math.round(G.cam.x), cy = Math.round(G.cam.y);
    ctx.fillStyle = EXCEL ? 'rgba(33,115,70,.07)' : 'rgba(31,42,68,.35)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = EXCEL ? 'rgba(33,115,70,.18)' : 'rgba(255,255,255,.12)';
    for (let x = -(cx % T); x < W; x += T) ctx.fillRect(x, 0, 1, H);
    for (let y = -(cy % T); y < H; y += T) ctx.fillRect(0, y, W, 1);
    const box = (r, col) => { ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.strokeRect(r.x0 * T - cx + .5, r.y0 * T - cy + .5, (r.x1 - r.x0 + 1) * T - 1, (r.y1 - r.y0 + 1) * T - 1); };
    if (E.step === 1 && E.src) box(E.src, '#4C9BE8');                       // きりとりもと・いれかえもと
    if (E.srcCell) box({ x0: E.srcCell[0], y0: E.srcCell[1], x1: E.srcCell[0], y1: E.srcCell[1] }, '#F5C842'); // いろコピーもと
    const d = toolDef();
    const plan = previewPlan();
    if (plan) {
      const ok = plan.ok, col = ok ? '#8FD18A' : '#E8563F';
      if (plan.cols) for (const x of plan.cols) { ctx.fillStyle = ok ? 'rgba(143,209,138,.3)' : 'rgba(232,86,63,.3)'; ctx.fillRect(x * T - cx, 0, T, H); ctx.fillStyle = col; ctx.fillRect(x * T - cx, 0, 1, H); ctx.fillRect(x * T - cx + T - 1, 0, 1, H); }
      if (plan.rects) for (const r of plan.rects) { if (!plan.pre) { ctx.fillStyle = ok ? 'rgba(143,209,138,.16)' : 'rgba(232,86,63,.16)'; ctx.fillRect(r.x0 * T - cx, r.y0 * T - cy, (r.x1 - r.x0 + 1) * T, (r.y1 - r.y0 + 1) * T); } box(r, plan.pre ? '#fff' : col); }
      if (plan.hl) for (const [x, y] of plan.hl) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x * T - cx + 1, y * T - cy + 1, T - 2, T - 2); }
      if (plan.ghost) for (const g of plan.ghost) drawBlock(g.t, g.c, g.x * T - cx, g.y * T - cy, true, true, .65);
      if (!plan.pre && plan.cost !== undefined) { const r = (plan.rects && plan.rects[plan.rects.length - 1]) || { x0: plan.cols ? plan.cols[0] : 0, y0: 1 }; text(plan.cost, r.x0 * T - cx + 2, Math.max(2, r.y0 * T - cy - 7), ok ? '#fff' : '#E8563F'); }
      if (!ok && plan.msg) E.hint = plan.msg; else E.hint = '';
    } else if (d && (d.mode === 'col' || E.cursor) && !E.sel && !E.pan) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(E.cursor[0] * T - cx + .5, E.cursor[1] * T - cy + .5, T - 1, T - 1); E.hint = '';
    }
  }
  // Excelのリボン(がめんのうえ): ライフ・コスト・Σ・タイム・ボタンを、リボンのグループのみた目で
  const RB = { hp: -1, cost: -1, max: -1, gems: -1, ng: -1, time: '', play: null, mute: null, edit: null };
  function updateRibbon() {
    const rib = $('#ribbon'); if (!rib) return;
    const play = G.mode === 'play' && !!G.level;
    if (RB.play !== play) { RB.play = play; rib.classList.toggle('idle', !play); }
    if (!play) return;
    if (RB.hp !== G.p.hp) { RB.hp = G.p.hp; let h = ''; for (let i = 0; i < 3; i++) h += '<i class="hp' + (i < G.p.hp ? ' on' : '') + '">♥</i>'; $('#rb-hearts').innerHTML = h; }
    const has = G.level.tools.length > 0; $('#rb-g-cost').style.display = has ? '' : 'none';
    const e = Math.floor(G.energy);
    if (has && (RB.cost !== e || RB.max !== G.maxE)) { RB.cost = e; RB.max = G.maxE; $('#rb-bar').firstElementChild.style.width = (100 * G.energy / Math.max(1, G.maxE)) + '%'; $('#rb-bar').classList.toggle('low', G.energy < minCost()); $('#rb-cost').textContent = e; }
    const ng = G.level.gems.length; $('#rb-g-sigma').style.display = ng ? '' : 'none';
    if (RB.gems !== G.gems || RB.ng !== ng) { RB.gems = G.gems; RB.ng = ng; let h = ''; if (ng <= 5) for (let i = 0; i < ng; i++) h += '<i class="sg' + (i < G.gems ? ' on' : '') + '">Σ</i>'; else h = '<i class="sg on">Σ</i><b>' + G.gems + '/' + ng + '</b>'; $('#rb-sigma').innerHTML = h; }
    const t = Math.floor(G.time / 60) + ':' + String(Math.floor(G.time % 60)).padStart(2, '0'); if (RB.time !== t) { RB.time = t; $('#rb-time').textContent = t; }
    const hasEdit = !$('#btn-edit').classList.contains('hide'); if (RB.edit !== hasEdit) { RB.edit = hasEdit; $('#rb-edit').style.display = hasEdit ? '' : 'none'; }
    const mu = $('#btn-mute').textContent; if (RB.mute !== mu) { RB.mute = mu; $('#rb-mute').textContent = mu; }
  }
  function render() {
    if (!G.level) return;
    updateRibbon();
    G.sx = (G.shake && !G.edit.on) ? (Math.random() - .5) * G.shake : 0;
    drawBackground(); drawWorld();
    if (EXCEL) GFXX.frame(ctx, G, G.level, W, H);
    if (G.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (G.flash * 1.2) + ')'; ctx.fillRect(0, 0, W, H); }
    if (G.edit.on) { drawEditOverlay(); UI.helpText(); }
    drawHUD();
    if (G.p.dead) { ctx.fillStyle = 'rgba(31,42,68,' + Math.min(.6, (0.7 - G.p.dead)) + ')'; ctx.fillRect(0, 0, W, H); }
  }

  // ===== い力 =====
  const KEYS = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowDown: 'down', KeyS: 'down', ArrowUp: 'up', KeyW: 'up',
  };
  function press(name, v) {
    if (name === 'left' || name === 'right' || name === 'down' || name === 'up') input[name] = v;
    else if (name === 'jump') { if (v && !input.jumpHeld) input.jumpP = true; input.jumpHeld = v; }
    else if (name === 'attack') { if (v) input.atkP = true; }
    else if (name === 'dash') { if (v) input.dashP = true; }
    else if (name === 'edit') { if (v) toggleEdit(); }
  }
  function toggleEdit() { if (G.mode === 'play') setEdit(!G.edit.on); }
  addEventListener('keydown', (e) => {
    if (e.repeat) return; audio();
    if (G.mode !== 'play') return;
    if (G.edit.on) {
      const E = G.edit;
      if (e.code === 'KeyE' || e.code === 'Tab' || e.code === 'Escape') { e.preventDefault(); setEdit(false); return; }
      if (e.code === 'KeyZ') { undoEdit(); return; }
      if (e.code === 'KeyY') { redoEdit(); return; }
      if (e.code === 'BracketLeft' || e.code === 'BracketRight') { const tabs = UI.tabsOf(); const i = tabs.indexOf(E.tab); UI.pickTab(tabs[(i + (e.code === 'BracketRight' ? 1 : tabs.length - 1)) % tabs.length]); return; }
      const n = parseInt(e.key, 10); if (n >= 1 && n <= 9) { const list = UI.toolsOfTab(E.tab); if (list[n - 1]) UI.pickTool(list[n - 1].id); return; }
      const mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1] }[e.code];
      if (mv) { e.preventDefault(); E.cursor = [clamp(E.cursor[0] + mv[0], 0, G.level.w - 1), clamp(E.cursor[1] + mv[1], 0, G.level.h - 1)]; E.hover = null; return; }
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); kbSpace(); }
      return;
    }
    if (KEYS[e.code]) { e.preventDefault(); press(KEYS[e.code], true); return; }
    if (e.code === 'Space' || e.code === 'KeyZ' || e.code === 'KeyK') { e.preventDefault(); press('jump', true); }
    else if (e.code === 'KeyX' || e.code === 'KeyJ') press('attack', true);
    else if (e.code === 'KeyC' || e.code === 'KeyL' || e.code === 'ShiftLeft') press('dash', true);
    else if (e.code === 'KeyE' || e.code === 'Tab') { e.preventDefault(); toggleEdit(); }
    else if (e.code === 'KeyR') UI.restart();
  });
  addEventListener('keyup', (e) => {
    if (KEYS[e.code]) press(KEYS[e.code], false);
    if (e.code === 'Space' || e.code === 'KeyZ' || e.code === 'KeyK') press('jump', false);
  });
  addEventListener('blur', () => { input.left = input.right = input.down = input.up = input.jumpHeld = false; });
  // タッチボタン
  document.querySelectorAll('[data-btn]').forEach((b) => {
    const name = b.dataset.btn;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); audio(); b.setPointerCapture(e.pointerId); b.classList.add('on'); press(name, true); });
    const up = (e) => { b.classList.remove('on'); press(name, false); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  });
  // なおす: ポインタではんいをえらぶ・タップする
  function toWorld(e) {
    const r = cv.getBoundingClientRect(), s = r.width / W;
    const px = (e.clientX - r.left) / s + Math.round(G.cam.x), py = (e.clientY - r.top) / s + Math.round(G.cam.y);
    return { px, py, tx: clamp(Math.floor(px / T), 0, G.level.w - 1), ty: clamp(Math.floor(py / T), 0, G.level.h - 1) };
  }
  let dragging = false, panLast = null, tapMode = false;
  const wantsRect = () => { const d = toolDef(), E = G.edit; return d && (d.mode === 'rect' || (d.mode === 'two' && E.step === 0) || (d.mode === 'painter' && E.step === 1)); };
  cv.addEventListener('pointerdown', (e) => {
    audio(); if (G.mode !== 'play' || !G.edit.on) return; e.preventDefault(); cv.setPointerCapture(e.pointerId);
    const E = G.edit, w = toWorld(e);
    if (E.pan) { panLast = { x: e.clientX, y: e.clientY }; return; }
    E.kb = null; E.cursor = [w.tx, w.ty]; E.hover = [w.tx, w.ty];
    if (wantsRect()) { dragging = true; tapMode = false; E.sel = { x0: w.tx, y0: w.ty, x1: w.tx, y1: w.ty }; }
    else { dragging = true; tapMode = true; E.sel = null; }
  });
  cv.addEventListener('pointermove', (e) => {
    const E = G.edit; if (G.mode !== 'play' || !E.on) return;
    if (panLast) { const s = cv.getBoundingClientRect().width / W; G.cam.x = clamp(G.cam.x - (e.clientX - panLast.x) / s, 0, G.level.w * T - W); G.cam.y = clamp(G.cam.y - (e.clientY - panLast.y) / s, 0, Math.max(0, G.level.h * T - H)); panLast = { x: e.clientX, y: e.clientY }; return; }
    const w = toWorld(e); E.hover = [w.tx, w.ty]; if (!dragging) { E.cursor = [w.tx, w.ty]; return; }
    if (E.sel) { E.sel.x1 = w.tx; E.sel.y1 = w.ty; }
  });
  const endDrag = () => {
    const E = G.edit; if (panLast) { panLast = null; return; }
    if (!dragging) return; dragging = false;
    if (tapMode) { const h = E.hover; tapMode = false; if (h) onTap(h[0], h[1]); return; }
    if (!E.sel) return; const r = normRect(E.sel); E.sel = null; onRectDone(r);
  };
  cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', () => { dragging = false; G.edit.sel = null; panLast = null; });

  // ===== UI(DOM) =====
  const UI = {
    toastT: 0,
    toast(msg, ms) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hide'); clearTimeout(UI.toastT); UI.toastT = setTimeout(() => t.classList.add('hide'), ms || 2200); },
    show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.add('hide')); if (id) $(id).classList.remove('hide'); document.body.classList.toggle('menu', !!id); fit(); },
    refresh() {
      const lv = G.level; $('#lvname').textContent = lv.id + ' ' + lv.name; $('#btn-edit').classList.toggle('hide', !lv.tools.length);
      UI.refreshTools();
    },
    helpText() { const E = G.edit, d = TOOL_BY[E.tool]; const t = E.pan ? 'ドラッグでがめんをうごかす' : (E.msg || E.hint || (d ? d.help : '')); const el = $('#edithelp'); if (el.textContent !== t) el.textContent = t; },
    tabsOf() { const t = new Set(); G.level.tools.forEach(id => t.add(TOOL_BY[id].tab)); return TABS.map(x => x.id).filter(id => t.has(id)); },
    toolsOfTab(tab) { return G.level.tools.map(id => TOOL_BY[id]).filter(t => t.tab === tab); },
    pickTab(tab) { const E = G.edit; E.tab = tab; const l = UI.toolsOfTab(tab); if (!l.find(t => t.id === E.tool)) UI.pickTool(l[0].id); else UI.refreshTools(); },
    pickTool(id) { const E = G.edit; E.tool = id; E.tab = TOOL_BY[id].tab; E.sel = null; E.kb = null; E.step = 0; E.src = null; E.srcCell = null; E.pan = false; E.msg = ''; UI.refreshTools(); },
    refreshTools() {
      const E = G.edit; if (!G.level) return;
      const tabs = $('#tabs'), bar = $('#tools'), opts = $('#opts'); tabs.innerHTML = ''; bar.innerHTML = ''; opts.innerHTML = '';
      UI.tabsOf().forEach((id) => {
        const b = document.createElement('button'); b.textContent = TABS.find(t => t.id === id).name; b.className = E.tab === id ? 'sel' : ''; b.onclick = () => UI.pickTab(id); tabs.appendChild(b);
      });
      UI.toolsOfTab(E.tab).forEach((t, i) => {
        const b = document.createElement('button'); b.innerHTML = '<kbd>' + (i + 1) + '</kbd> ' + t.name + '<small>' + t.cost + '</small>'; b.className = E.tool === t.id && !E.pan ? 'sel' : ''; b.onclick = () => UI.pickTool(t.id); bar.appendChild(b);
      });
      const chips = (label, items, cur, pick) => {
        const row = document.createElement('div'); row.className = 'chips'; if (label) { const l = document.createElement('span'); l.textContent = label; row.appendChild(l); }
        items.forEach(it => { const c = document.createElement('button'); c.className = 'chip' + (cur === it.v ? ' sel' : ''); c.textContent = it.label || ''; if (it.color !== undefined) { c.style.background = COLORS[it.color].hex; c.title = COLORS[it.color].n + ': ' + COLORS[it.color].fx; c.textContent = it.label || COLORS[it.color].n; c.style.color = '#1f2a44'; } c.onclick = () => pick(it.v); row.appendChild(c); });
        opts.appendChild(row);
      };
      const colorItems = COLORS.map((c, i) => ({ v: i, color: i }));
      const o = E.opts, id = E.tool;
      if (id === 'transform') chips('', [{ v: 'flipH', label: 'よこにひっくり' }, { v: 'flipV', label: 'たてにひっくり' }, { v: 'rot', label: '90°まわす' }], o.tf, v => { o.tf = v; UI.refreshTools(); });
      else if (id === 'sort') chips('', [{ v: 'L', label: '←よせ' }, { v: 'R', label: 'よせ→' }, { v: 'U', label: '↑よせ' }, { v: 'D', label: 'よせ↓' }], o.sort, v => { o.sort = v; UI.refreshTools(); });
      else if (id === 'filter') chips('のこすいろ', colorItems.concat([{ v: null, label: 'はずす' }]), G.filter, v => { runPlan(planFor('filter', { fcolor: v })); UI.refreshTools(); });
      const d = TOOL_BY[E.tool]; $('#edithelp').textContent = E.pan ? 'ドラッグでがめんをうごかす' : (E.msg || E.hint || (d ? d.help : ''));
      $('#e-pan').className = E.pan ? 'sel' : '';
    },
    restart() { if (G.mode !== 'play') return; loadLevel(G.levelIdx); UI.show(null); },
    start(i) { G.mode = 'play'; loadLevel(i); UI.show(null); $('#hud').classList.remove('hide'); $('#touch').classList.remove('hide'); const t = $('#toast'); t.classList.add('hide'); G.paused = false; },
    title() { G.mode = 'title'; UI.show('#screen-title'); $('#hud').classList.add('hide'); $('#touch').classList.add('hide'); $('#editbar').classList.add('hide'); },
    select() { G.mode = 'select'; UI.show('#screen-select'); $('#hud').classList.add('hide'); $('#touch').classList.add('hide'); $('#editbar').classList.add('hide'); UI.buildSelect(); },
    unlocked(i) { return true; }, // ためしあそびよう: ステージはじゆうにえらべる
    buildSelect() {
      const box = $('#levels'); box.innerHTML = ''; let perfect = 0, sigma = 0, sigmaAll = 0;
      LEVELS.forEach((lv, i) => {
        const s = save.levels[lv.id], b = document.createElement('button'); const ok = UI.unlocked(i); if (s && s.goals && s.goals[2]) perfect++; sigma += gemsOf(lv, s); sigmaAll += lv.gems.length;
        b.className = 'lv' + (ok ? '' : ' lock'); b.disabled = !ok;
        b.innerHTML = '<b>' + lv.id + '</b><span>' + lv.name + '</span>' + badgesHTML(s ? s.goals : [false, false, false], gemsOf(lv, s), lv.gems.length, false);
        b.onclick = () => UI.start(i); box.appendChild(b);
      });
      $('#total').textContent = 'ノーミス ' + perfect + '/' + LEVELS.length + '　Σ ' + sigma + '/' + sigmaAll;
    },
    showResult(goals) {
      G.mode = 'result'; UI.show('#screen-result');
      $('#r-stars').innerHTML = badgesHTML(goals, G.gems, G.level.gems.length, true);
      const lv = G.level;
      $('#r-info').innerHTML = 'Σ ' + G.gems + '/' + lv.gems.length + '　タイム ' + G.time.toFixed(1) + 'びょう　ダメージ ' + G.hits + 'かい';
      const tips = []; if (!goals[1]) tips.push('Σを3つぜんぶあつめる'); if (!goals[2]) tips.push('ノーミス（ダメージをうけない）でクリア');
      $('#r-tip').textContent = tips.length ? tips.join('　') : 'パーフェクト！';
      const last = G.levelIdx >= LEVELS.length - 1; $('#r-next').textContent = last ? 'ステージえらびへ' : 'つぎのステージへ';
    },
  };
  $('#e-undo').onclick = () => undoEdit(); $('#e-redo').onclick = () => redoEdit(); $('#e-done').onclick = () => setEdit(false);
  $('#e-pan').onclick = () => { G.edit.pan = !G.edit.pan; UI.refreshTools(); };
  $('#btn-play').onclick = () => { audio(); UI.select(); };
  $('#btn-back').onclick = () => UI.title();
  let guideFrom = 'title';
  // 実際のゲームとおなじ描画で、み本のえ(16×16)をつくる
  function tileSample(draw) {
    const c = document.createElement('canvas'); c.width = 16; c.height = 16; const g2 = c.getContext('2d'); g2.imageSmoothingEnabled = false;
    ctx = g2; try { draw(); } finally { ctx = mainCtx; }
    return c;
  }
  function openGuide(from) {
    guideFrom = from; G.mode = from; UI.show('#screen-guide');
    const blk = (c, alpha) => tileSample(() => drawBlock(TL.STONE, c, 0, 0, true, true, alpha, 0));
    const items = [['h', 'いろつきブロック（なおすでいろをかえられる）']];
    COLORS.forEach((k, i) => items.push([blk(i), k.n + 'ブロック', k.fx]));
    items.push([tileSample(() => drawBlock(TL.GLASSED, 3, 0, 0, true, true, undefined, 0)), 'もとガラス（いろをつけたガラス）', 'いろコピーでいろをつけたガラス。いろのちからはふつうのブロックとおなじで、しろい「つやのわく」がのこるので、もとガラスだとわかる。もういちどはいろをつけられない']);
    items.push(['h', 'そのほかのじめん']);
    items.push([tileSample(() => ctx.drawImage(GFX.metal(), 0, 0)), 'はがね', 'なおせないはがねのかべ・ゆか・てんじょう。どのどうぐもきかない']);
    items.push([tileSample(() => drawBlock(TL.CRACK, 0, 0, 0, true, true, undefined, 0)), 'ひびわれかべ', 'きいろブロックとおなじ（のるとくずれる）。どうぐがきく']);
    items.push(['h', 'じしゃく・スイッチ・とびら']);
    items.push([tileSample(() => drawMagnet(0, 0)), 'じしゃくブロック', 'いちばんちかいはがねに、まっすぐひきよせられる（あるくのとおなじはやさ）。まっすぐのせんの上にほかのブロックがあると、はたらかない。フィルターのえいきょうはうけない']);
    items.push(['h', 'はんていセル（とびらにつながる）']);
    items.push([tileSample(() => { const s = G.judges; G.judges = [{ x: 0, y: 0, type: 'exist', color: 0, id: 0, on: false }]; try { drawJudges(0, 0); } finally { G.judges = s; } }), 'そんざいセル', 'そのマスに、ほんとうにぶつかるブロックが あるか、しゅじんこうが たっていると ON。フィルターでうすくなったブロックは「ない」あつかい。ONのあいだだけ、おなじ番号の とびらが ひらき、おなじ番号の リフトが うごく']);
    items.push([tileSample(() => { const s = G.judges; G.judges = [{ x: 0, y: 0, type: 'empty', color: 0, id: 0, on: false }]; try { drawJudges(0, 0); } finally { G.judges = s; } }), 'あきセル', 'そのマスに、ぶつかるものが なにもなく、しゅじんこうも いないと ON。フィルターでブロックをうすくすると ONになる']);
    items.push([tileSample(() => { const s = G.judges; G.judges = [{ x: 0, y: 0, type: 'color', color: 3, id: 0, on: false }]; try { drawJudges(0, 0); } finally { G.judges = s; } }), 'いろセル', 'そのマスに、きめたいろの ブロックが あると ON。いろコピーでつくった いろも、かぞえる']);
    items.push([tileSample(() => drawSwitch({ x: 0, y: 0, id: 0, on: false }, 0, 0)), 'スイッチ', 'じしゃくブロックがかさなると、おされる（いちどおしたら、そのまま）。おなじいろのとびらがひらく']);
    items.push([tileSample(() => { const save = G.doors; G.doors = [{ x: 0, y: 0, h: 1, id: 0, open: false, anim: 0 }]; try { drawDoors(0, 0); } finally { G.doors = save; } }), 'とびら', 'スイッチをおすまで、とおれない。ブロックもおけない']);
    items.push(['h', 'なおすときのしるし']);
    items.push([tileSample(() => { const save = G.lifts; G.lifts = [{ x: 0, y: 0, w: 16, h: 16, vert: true }]; try { drawLifts(0, 0); } finally { G.lifts = save; } }), 'リフト', 'きまったみち（うすくみえるみち）を、きまったくりかえしていったりきたりするあしば。のるとはこばれる。どうぐではうごかせず、みちにブロックをおくこともできない。リフトにもいろ（ちから）があり、フィルターでけせる（うすくなってとおりぬけられる）。ガラスのリフトは、いろコピーでいろをつけられる']);
    items.push([tileSample(() => { drawBlock(TL.STONE, 0, 0, 0, true, true, undefined, 0); if (SOLID) ctx.drawImage(GFX.lock(), 8, 1); else { ctx.fillStyle = '#1F2A44'; ctx.fillRect(9, 1, 6, 7); icon(LOCK, 10, 2, '#F5C842'); } }), 'カギ（まもり）', 'まもったブロック。どのどうぐもきかず、フィルターでもきえない。よせるときのしきりになる。「まもりをはずす」ではずせる']);
    items.push([blk(0, .28), 'うすいひょうじ', 'フィルターをかけているところ。えらんだいろいがいのブロック（ガラスも）は、うすくなってとおりぬけられる']);
    const box = $('#guide'); box.innerHTML = '';
    items.forEach(it => {
      if (it[0] === 'h') { const p = document.createElement('p'); p.className = 'gh'; p.textContent = it[1]; box.appendChild(p); return; }
      const d = document.createElement('div'); d.className = 'gi';
      d.innerHTML = '<div><b></b><span></span></div>'; d.insertBefore(it[0], d.firstChild); it[0].className = 'gtile';
      d.querySelector('b').textContent = it[1]; d.querySelector('span').textContent = it[2]; box.appendChild(d);
    });
  }
  $('#btn-guide').onclick = () => openGuide('title');
  $('#btn-guide2').onclick = () => openGuide('select');
  $('#btn-guide-back').onclick = () => (guideFrom === 'select' ? UI.select() : UI.title());
  document.querySelectorAll('[data-proxy]').forEach(b => { b.onclick = () => $(b.dataset.proxy).click(); });
  $('#btn-edit').onclick = () => toggleEdit();
  $('#btn-restart').onclick = () => UI.restart();
  $('#btn-menu').onclick = () => UI.select();
  $('#btn-mute').onclick = () => { muted = !muted; save.muted = muted; persist(); $('#btn-mute').textContent = muted ? '🔇' : '🔊'; };
  $('#btn-mute').textContent = muted ? '🔇' : '🔊';
  $('#r-retry').onclick = () => { UI.start(G.levelIdx); };
  $('#r-next').onclick = () => { if (G.levelIdx >= LEVELS.length - 1) UI.select(); else UI.start(G.levelIdx + 1); };
  $('#r-menu').onclick = () => UI.select();
  $('#btn-reset').onclick = () => { if (confirm('セーブデータをけしますか？')) { save = { levels: {}, muted }; persist(); UI.buildSelect(); } };

  // ===== 拡大ひょうじ(整数倍) =====
  // ウィンドウ全からだ(リボン・シート・ペイン)を、がめんにあわせて拡大する。シートは、いつも320×180(マス目の世界)。
  function fit() {
    const wrap = $('#stage'), vw = wrap.clientWidth, vh = wrap.clientHeight, portrait = vw < vh;
    const RH = portrait ? 24 : 15, LPW = portrait ? 0 : 48, PW = portrait ? 0 : 80; let LW = LPW + W + PW, LH = RH + H;
    let s = Math.min(vw / LW, vh / (portrait ? RH + H + 90 : LH)); if (s >= 2) s = Math.floor(s); // せいすうばいに、ぴったりいれる
    let ph = 100;
    if (portrait) { ph = Math.max(90, Math.min(300, Math.floor(vh / s) - RH - H)); LH = RH + H + ph; if (LH * s > vh) s = vh / LH; }
    const r = document.documentElement.style; r.setProperty('--s', s); r.setProperty('--rh', RH); r.setProperty('--lw', LPW); r.setProperty('--pw', PW); r.setProperty('--ph', ph);
    cv.style.width = W * s + 'px'; cv.style.height = H * s + 'px';
    $('#game').style.width = LW * s + 'px'; $('#game').style.height = LH * s + 'px';
    document.body.classList.toggle('s3', s >= 2.7);
  }
  addEventListener('resize', fit); fit();

  // ===== メインループ =====
  let last = performance.now(), acc = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    if (G.paused) { last = now; return; }
    acc += Math.min(.1, (now - last) / 1000); last = now;
    while (acc >= DT) { update(DT); acc -= DT; }
    render();
  }
  loadLevel(0); render(); UI.title();
  { // ?test=ID : ステージさくせいページからのテストプレイ
    const m = /[?&]test=([^&]+)/.exec(location.search);
    if (m) { const i = LEVELS.findIndex(l => l.id === decodeURIComponent(m[1])); if (i >= 0) { audio(); UI.start(i); } }
  }
  $('#btn-editor').onclick = () => { location.href = 'editor.html'; };
  requestAnimationFrame(loop);

  // ===== テストようの口(自どうプレイが使う) =====
  window.__geko = {
    G, input, press, update, render, UI, LEVELS, T, TL, COLORS, TOOLS, setEdit, undoEdit, redoEdit, runPlan, planFor, normRect,
    // 自どうプレイ・テストよう: {tool, rect, dst, srcCell, col, opts} を指定して、実際のなおすとおなじ処理をぎょうう
    runTool(spec) {
      const E = G.edit; E.tool = spec.tool; Object.assign(E.opts, spec.opts || {});
      const plan = planFor(spec.tool, { rect: spec.rect, dst: spec.dst, srcCell: spec.srcCell, col: spec.col, fcolor: spec.fcolor });
      const ok = runPlan(plan); return { ok, msg: ok ? '' : (plan.msg || E.msg) };
    },
    step(n) { for (let i = 0; i < n; i++) update(DT); },
    start(i) { UI.start(i); G.paused = true; },
  };
})();

