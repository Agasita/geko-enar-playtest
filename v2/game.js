/* ゲコ＆エナー v2 — 本体。320x180 のドットを整数倍に拡大して表示する(すべてのドットが同じ大きさ)。 */
(function () {
  'use strict';
  const W = 288, H = 180, T = 16, DT = 1 / 60; // シートは18マス×11.25マス。横向きの画面で、整数倍(2倍)にぴったり入る大きさ
  const TL = { EMPTY: 0, STONE: 1, STEEL: 2, CRACK: 3, SPIKE: 5, GLASSED: 6 }; // GLASSED = 書式をつけたガラス(色の性質は、ふつうのブロックと同じ。元ガラスの印がつく)
  const CH2TILE = { '.': 0, '#': 1, 'S': 2, 'c': 3, '^': 5 };
  // ブロックの色(＝Excelのセルの色)。色には性質がある。
  const COLORS = [
    { n: '茶', hex: '#C9A15E', hi: '#E8CFA0', lo: '#735630', fx: 'ふつう' },
    { n: '赤', hex: '#E8563F', hi: '#F7A08F', lo: '#A8403F', fx: 'あつい（さわるとダメージ）' },
    { n: '青', hex: '#6FD6E8', hi: '#D5F6FC', lo: '#3F9DB5', fx: 'すべる（氷）' },
    { n: '緑', hex: '#58B368', hi: '#8FD18A', lo: '#3F8F52', fx: 'はずむ（ばね）' },
    { n: '黄', hex: '#F5C842', hi: '#FFE27A', lo: '#C99A1E', fx: 'もろい（乗ると、0.5秒ほどでくずれる）' },
    { n: 'ガラス', hex: '#DCEBF3', hi: '#FFFFFF', lo: '#9DB9C8', fx: '未書式のセル（性質なし）。書式のコピーで色（性質）をつけられる' },
  ];
  const GLASS = 5;
  const TABS = [{ id: 'home', name: 'ホーム' }, { id: 'cell', name: 'セル' }, { id: 'data', name: 'データ' }, { id: 'view', name: '表示' }];
  // Excelの機能を、世界の編集に転用した道具。何もないところにブロックは生まれない(動かす・並べる・色・隠す・消す、だけ)。
  const TOOLS = [
    { id: 'painter', tab: 'home', name: '書式のコピー', mode: 'painter', cost: 2, help: '①色をまねるブロックをタップ → ②ガラスのある範囲をドラッグ（ガラスにだけ色がつく）' },
    { id: 'transform', tab: 'cell', name: '変形', mode: 'rect', cost: 8, help: '範囲のブロックを反転・回転（回転は正方形の範囲）' },
    { id: 'sort', tab: 'data', name: '並べ替え', mode: 'rect', cost: 10, help: '範囲のブロックを、上下左右に寄せる（保護ブロックと鋼で区切られる）' },
    { id: 'filter', tab: 'data', name: 'フィルター', mode: 'instant', cost: 8, help: '色を選ぶ → その色のブロックだけが残り、他は通りぬけられる' },
    { id: 'protect', tab: 'view', name: 'シートの保護', mode: 'rect', cost: 4, help: '範囲のブロックを保護する。保護されたブロックは、どの編集も受けない' },
    { id: 'unprotect', tab: 'view', name: '保護の解除', mode: 'rect', cost: 6, help: '範囲の保護を解除する' },
  ];
  const TOOL_BY = {}; TOOLS.forEach(t => { TOOL_BY[t.id] = t; });
  function newEdit(lv) {
    const first = lv && lv.tools.length ? TOOL_BY[lv.tools[0]] : TOOLS[0];
    return { on: false, tab: first.tab, tool: first.id, opts: { color: 1, tf: 'flipH', sort: 'L', from: 1, to: 2, axis: 'row', fcolor: 2 },
      step: 0, src: null, srcCell: null, sel: null, hover: null, kb: null, undo: [], redo: [], pan: false, cursor: [0, 0], msg: '' };
  }
  const $ = (s) => document.querySelector(s);
  const cv = $('#cv'); let ctx = cv.getContext('2d'); const mainCtx = ctx;
  ctx.imageSmoothingEnabled = false;

  // ===== ドット絵 =====
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

  // ===== 音(WebAudio) =====
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
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (s && s.levels) save = s; } catch (e) { /* 保存できなくても遊べる */ }
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } }
  muted = !!save.muted;
  // 自作ステージ(ステージ作成ページで保存したもの)を、ステージ一覧のおわりに足す
  const CUSTOM_KEY = 'geko-enar-v2-custom';
  function normalizeCustom(l) {
    const w = l.w | 0, h = Array.isArray(l.front) ? l.front.length : 0;
    if (w < 20 || w > 160 || h < 12 || h > 60 || !Array.isArray(l.color) || l.color.length !== h) throw new Error('bad level');
    return Object.assign({ world: 9, hints: [], solution: [], bg: '#9ADBC0', bg2: '#86CEB0', par: 0, sparks: [], checks: [], gems: [], ents: [], start: [2, 9], flag: [w - 4, 9], custom: true },
      l, { w, h, energy: l.energy | 0, tools: (l.tools || []).filter(id => TOOL_BY[id]), lock: l.lock || l.front.map(() => new Array(w).fill(0)), hints: l.hint ? [{ x: 0, text: l.hint }] : (l.hints || []) });
  }
  (function loadCustomLevels() {
    let arr = []; try { arr = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]'); } catch (e) { arr = []; }
    arr.forEach(l => { try { LEVELS.push(normalizeCustom(l)); } catch (e) { /* こわれたデータは無視 */ } });
  })();

  // ===== 状態 =====
  const G = {
    mode: 'title', level: null, levelIdx: 0, paused: false, t: 0, frame: 0,
    front: null, back: null, p: null, enemies: [], bullets: [], parts: [], pick: [], checks: [], flag: null,
    cam: { x: 0, y: 0 }, shake: 0, hitstop: 0, energy: 0, gems: 0, deaths: 0, hits: 0, time: 0,
    edit: null,
    hintShown: {}, respawn: null, flash: 0,
  };
  // 主人公はエナー（ドローンのような鳥）。操作は ◀ ▶ と「はばたき」だけ。ジャンプで跳び、空中で押し続けると、少しのあいだ「ふわり」と落ちるのがゆっくりになる。
  // 攻撃とダッシュはない（敵は、上からふんで たおす）。もとのゲコは ?hero=gekko で遊べる。
  const ENER = ((/[?&]hero=(\w+)/.exec(location.search) || [])[1]) !== 'gekko';
  const HOVER_T = .35, HOVER_VY = 36;
  if (ENER) document.body.classList.add('ener');
  const input = { left: false, right: false, down: false, up: false, jumpHeld: false, jumpP: false, atkP: false, dashP: false, editP: false };

  // ===== レベル読み込み =====
  function loadLevel(i) {
    const lv = LEVELS[i]; G.levelIdx = i; G.level = lv;
    G.front = lv.front.map(r => Array.from(r).map(c => CH2TILE[c] || 0));
    G.col = lv.color.map(r => r.slice()); G.lock = lv.lock.map(r => r.slice());
    G.hideRow = new Set(); G.hideCol = new Set(); G.filter = null; G.regen = lv.regen || 0; G.maxE = lv.regen ? 100 : lv.energy; // 実験シート以外は、ステージごとの「コスト上限」だけ。回復しない
    G.enemies = lv.ents.map((e, k) => makeEnemy(e, k));
    G.lifts = (lv.lifts || []).map(l => makeLift(l)); G.crumb = {};
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
  const isBlockT = (t) => t === TL.STONE || t === TL.CRACK || t === TL.GLASSED;
  // 行・列の非表示とフィルターの結果、いま実際に「ある」ブロックか
  function blockVisible(tx, ty) { if (G.lock[ty][tx]) return true; if (G.hideRow.has(ty) || G.hideCol.has(tx)) return false; return G.filter === null || G.col[ty][tx] === G.filter; }
  function solidCell(tx, ty) {
    if (tx < 0 || tx >= G.level.w || ty < 0) return true; if (ty >= G.level.h) return false;
    const t = G.front[ty][tx]; if (t === TL.STEEL) return true;
    return isBlockT(t) && blockVisible(tx, ty);
  }
  function colorAt(tx, ty) { return inb(tx, ty) && isBlockT(G.front[ty][tx]) && blockVisible(tx, ty) ? G.col[ty][tx] : -1; }
  const isFragile = (tx, ty) => { if (!inb(tx, ty) || !blockVisible(tx, ty)) return false; const t = G.front[ty][tx]; return t === TL.CRACK || ((t === TL.STONE || t === TL.GLASSED) && G.col[ty][tx] === 4); };
  // ---- リフト: 決まった道(レール)を、一定の周期で往復する足場。編集では動かせない ----
  function makeLift(l) {
    const w = l.w * T, ax = l.x * T, ay = l.y * T, bx = (l.x + l.dx) * T, by = (l.y + l.dy) * T;
    return { col: l.col || 0, stand: 0, gone: 0, ax, ay, bx, by, w, h: T, period: l.period || 7, t: (l.phase || 0) * (l.period || 7), x: ax, y: ay,
      rail: { x0: Math.min(l.x, l.x + l.dx), y0: Math.min(l.y, l.y + l.dy), x1: Math.max(l.x, l.x + l.dx) + l.w - 1, y1: Math.max(l.y, l.y + l.dy) }, vert: l.dy !== 0 };
  }
  function liftAt(L, t) { const s = .5 - .5 * Math.cos(2 * Math.PI * t / L.period); return { x: L.ax + (L.bx - L.ax) * s, y: L.ay + (L.by - L.ay) * s }; }
  const liftOn = (L) => !L.gone && (G.filter === null || L.col === G.filter); // フィルターで色がちがうリフトは、通りぬけられる(うすくなる)
  function onLift(L) { const p = G.p; return liftOn(L) && p.ground && p.x + p.w > L.x && p.x < L.x + L.w && Math.abs(p.y + p.h - L.y) <= 2.5; }
  function updateLifts(dt) {
    const p = G.p;
    for (const L of G.lifts) {
      L.t += dt; const n = liftAt(L, L.t), dx = n.x - L.x, dy = n.y - L.y, ride = !p.dead && onLift(L);
      // 黄(もろい)のリフトは、乗ると0.5秒でくずれて、しばらく消える
      if (L.gone > 0) { L.gone -= dt; if (L.gone <= 0) { L.gone = 0; L.stand = 0; } } else if (L.col === 4) { L.stand = ride ? L.stand + dt : Math.max(0, L.stand - dt); if (L.stand > .5) { L.gone = 2.6; spawnParts(L.x + L.w / 2, L.y + 6, 12, '#F5C842', 60); SFX.hit(); } }
      if (ride && dy <= 0) { moveY(p, dy); moveX(p, dx); }
      L.x = n.x; L.y = n.y;
      if (ride && dy > 0) { moveY(p, dy); moveX(p, dx); }
      if (!ride && !p.dead && liftOn(L) && overlap(p.x, p.y, p.w, p.h, L.x, L.y, L.w, L.h)) { // 横や下から当たったら、おし出す
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
    // 足もとの色(青=氷)
    let onIce = false;
    for (const L of G.lifts) if (L.col === 2 && onLift(L)) onIce = true;
    if (p.ground) { const fy = Math.floor((p.y + p.h + 1) / T); for (let tx = Math.floor(p.x / T); tx <= Math.floor((p.x + p.w - 1) / T); tx++) if (colorAt(tx, fy) === 2) onIce = true; }
    // ダッシュ
    if (input.dashP && p.dashAvail && p.dashT <= 0 && p.stun <= 0) { p.dashT = .17; p.dashAvail = false; p.vx = p.face * DASH_V; p.vy = 0; SFX.dash(); spawnParts(p.x + 5, p.y + 12, 5, '#fff', 30); }
    if (p.dashT > 0) {
      p.dashT -= dt; p.vx = p.face * DASH_V; p.vy = 0;
      const px = Math.floor((p.x + (p.face > 0 ? p.w + 2 : -2)) / T), py = Math.floor((p.y + 7) / T); if (isFragile(px, py)) breakCrack(px, py); // もろいブロックはダッシュで壊れる
    } else if (p.stun <= 0) {
      const target = dir * RUN; const a = dir ? (p.ground ? (onIce ? 260 : ACC) : AIR) : (p.ground ? (onIce ? 70 : FRIC) : 200);
      const dv = target - p.vx; p.vx += clamp(dv, -a * dt, a * dt);
    }
    // ジャンプ
    if (p.jbuf > 0 && p.coyote > 0 && p.stun <= 0) { p.vy = -JUMP; p.jbuf = 0; p.coyote = 0; p.ground = false; p.squash = -.25; SFX.jump(); spawnParts(p.x + 5, p.y + 14, 4, '#fff', 25); }
    // 重力(上昇中にボタンを離すと低くなる)
    if (p.dashT <= 0) {
      let g = GRAV; if (p.vy > 0) { g *= FALLM; p.free = false; } else if (!input.jumpHeld && p.vy < -80 && !p.free) g *= 2.6;
      p.vy = Math.min(MAXFALL, p.vy + g * dt);
    }
    // ふわり(エナー): 空中でジャンプを押し続けると、少しのあいだ、落ちる速さがおさえられる
    p.hovering = false;
    if (ENER && !window.__noHover && !p.ground && p.vy > 0 && input.jumpHeld && p.hover > 0 && p.stun <= 0) { p.hover -= dt; p.hovering = true; if (p.vy > HOVER_VY) p.vy = HOVER_VY; }
    // 攻撃
    if (input.atkP && p.atkCd <= 0 && p.stun <= 0) { p.atkT = .22; p.atkCd = .3; p.atkHit = new Set(); p.pogo = input.down && !p.ground; SFX.swing(); }
    if (p.atkT > 0) { p.atkT -= dt; if (p.atkT < .17 && p.atkT > .05) doAttack(); }
    // 移動と衝突(x→y)
    moveX(p, p.vx * dt); moveY(p, p.vy * dt);
    // 着地
    p.ground = boxHitsSolid(p.x, p.y + 1, p.w, p.h) && p.vy >= 0;
    if (ENER) { // もろいブロックは、乗ってから0.45秒で、くずれる
      const stand = new Set();
      if (p.ground) { const fy = Math.floor((p.y + p.h + 1) / T); for (let tx = Math.floor(p.x / T); tx <= Math.floor((p.x + p.w - 1) / T); tx++) if (isFragile(tx, fy) && !G.lock[fy][tx]) { const k = tx + ',' + fy; stand.add(k); G.crumb[k] = (G.crumb[k] || 0) + dt; if (G.crumb[k] > .45) { breakCrack(tx, fy); delete G.crumb[k]; } } }
      for (const k of Object.keys(G.crumb)) if (!stand.has(k)) { G.crumb[k] -= dt; if (G.crumb[k] <= 0) delete G.crumb[k]; }
    }
    if (p.ground && !p.wasGround) { p.squash = .3; SFX.land(); spawnParts(p.x + 5, p.y + 14, 3, '#fff', 20); }
    // 緑のブロック=ばね
    if (p.ground && p.vy >= 0 && G.lifts.some(L => L.col === 3 && onLift(L))) { p.vy = -BOUNCE; p.hover = HOVER_T; p.free = true; p.ground = false; p.coyote = 0; p.squash = -.4; SFX.bounce(); spawnParts(p.x + 5, p.y + 14, 8, '#8FD18A', 40); }
    if (p.ground && p.vy >= 0) {
      const ty = Math.floor((p.y + p.h + 1) / T), tx0 = Math.floor(p.x / T), tx1 = Math.floor((p.x + p.w - 1) / T);
      for (let tx = tx0; tx <= tx1; tx++) if (colorAt(tx, ty) === 3) { p.vy = -BOUNCE; p.hover = HOVER_T; p.free = true; p.ground = false; p.coyote = 0; p.squash = -.4; SFX.bounce(); spawnParts(p.x + 5, p.y + 14, 8, '#8FD18A', 40); break; }
    }
    // 赤いブロック=あつい(さわるとダメージ)
    for (const L of G.lifts) if (L.col === 1 && liftOn(L) && overlap(p.x - 1, p.y - 1, p.w + 2, p.h + 2, L.x, L.y, L.w, L.h)) hurtPlayer(null, false);
    for (let ty = Math.floor((p.y - 1) / T); ty <= Math.floor((p.y + p.h + 1) / T); ty++) for (let tx = Math.floor((p.x - 1) / T); tx <= Math.floor((p.x + p.w) / T); tx++)
      if (colorAt(tx, ty) === 1 && overlap(p.x - 1, p.y - 1, p.w + 2, p.h + 2, tx * T, ty * T, T, T)) hurtPlayer(null, false);
    // 落下
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
    // ひび割れ・黄色(もろい)ブロックは壊れる
    const x0 = Math.floor(b.x / T), x1 = Math.floor((b.x + b.w - 1) / T), y0 = Math.floor(b.y / T), y1 = Math.floor((b.y + b.h - 1) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (isFragile(tx, ty) && !G.lock[ty][tx]) breakCrack(tx, ty);
    for (const e of G.enemies) {
      if (e.dead || e.hidden || p.atkHit.has(e)) continue;
      if (!overlap(b.x, b.y, b.w, b.h, e.x, e.y, e.w, e.h)) continue;
      p.atkHit.add(e);
      if (e.type === 'guard' && !p.pogo && ((p.face > 0 && e.dir < 0) || (p.face < 0 && e.dir > 0))) { // 盾で防がれる
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

  // ===== 敵 =====
  const hiddenAt = (cx, cy) => G.hideRow.has(cy) || G.hideCol.has(cx);
  function updateEnemies(dt) {
    const p = G.p;
    for (const e of G.enemies) {
      if (e.dead) continue;
      e.hidden = hiddenAt(Math.floor((e.x + e.w / 2) / T), Math.floor((e.y + e.h / 2) / T)); // 隠した行・列の敵は、そこにいない扱い
      e.t += dt; if (e.flash > 0) e.flash -= dt;
      if (e.hidden) continue;
      if (e.stun > 0) { e.stun -= dt; continue; }
      if (e.type === 'walker' || e.type === 'guard') {
        // 重力と歩行(縁や壁で折り返す)
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
    // 3つの目標(バッジ)。それぞれ別に記録する: ①クリア ②Σ(宝石)を全部 ③ノーミス(ダメージを受けない)
    const goals = [true, G.gems >= G.level.gems.length, G.deaths === 0 && G.hits === 0];
    const prev = save.levels[G.level.id] || { goals: [false, false, false] };
    const merged = goals.map((v, i) => v || !!(prev.goals && prev.goals[i]));
    save.levels[G.level.id] = { goals: merged, gemsBest: Math.max(prev.gemsBest || (prev.goals && prev.goals[1] ? G.level.gems.length : 0), G.gems), time: Math.min(prev.time || 1e9, Math.round(G.time * 10) / 10) };
    persist(); G.lastGoals = goals;
    setTimeout(() => { if (G.cleared) UI.showResult(goals); }, 800);
  }
  // 3つの目標のバッジ: ✓クリア / Σが3つそろう / ノーミス（ダメージを受けない）
  function badgesHTML(goals, gemsGot, total, big) {
    const n = (total === undefined ? 3 : total); let sg = '';
    for (let i = 0; i < Math.min(n, 3); i++) sg += '<i class="sg' + (i < gemsGot ? ' on' : '') + '">Σ</i>';
    return '<span class="bds' + (big ? ' big' : '') + '"><span class="bd ck' + (goals[0] ? ' on' : '') + '">✓</span>' + (n ? '<span class="bd sgs' + (goals[1] ? ' all' : '') + '">' + sg + '</span>' : '') + '<span class="bd pf' + (goals[2] ? ' on' : '') + '">ノーミス</span></span>';
  }
  const gemsOf = (lv, s) => (s ? (s.gemsBest !== undefined ? s.gemsBest : (s.goals && s.goals[1] ? lv.gems.length : 0)) : 0);

  // ===== 編集(Excelのしくみ) =====
  const key = (x, y) => x + ',' + y;
  const isBlk = (x, y) => isBlockT(G.front[y][x]);
  const isFixedCell = (x, y) => { const t = G.front[y][x]; return t === TL.STEEL || !!G.lock[y][x]; }; // 鋼・トゲ・保護されたブロック
  const isMovable = (x, y) => isBlk(x, y) && !G.lock[y][x];
  function actorRects() {
    const r = [{ x: G.p.x, y: G.p.y, w: G.p.w, h: G.p.h }];
    for (const e of G.enemies) if (!e.dead) r.push({ x: e.x, y: e.y, w: e.w, h: e.h });
    return r;
  }
  function cellBlocked(tx, ty) { // 人・敵・リフトの道と重なるマスには、ブロックを置けない
    if (liftRailHit(tx, ty)) return true;
    for (const r of actorRects()) if (overlap(tx * T, ty * T, T, T, r.x, r.y, r.w, r.h)) return true;
    return false;
  }
  function normRect(s) { return { x0: Math.min(s.x0, s.x1), y0: Math.min(s.y0, s.y1), x1: Math.max(s.x0, s.x1), y1: Math.max(s.y0, s.y1) }; }
  const fail = (msg, extra) => Object.assign({ ok: false, msg }, extra || {});
  function rectEach(r, fn) { for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) if (inb(x, y)) fn(x, y); }
  const costOf = (id) => TOOL_BY[id].cost;

  // ---- 計画: 実際に変える前に「できるか・費用・どこが変わるか」を求める ----
  function planMove(src, dx, dy) {
    const cells = [], keys = new Set();
    rectEach(src, (x, y) => { if (isMovable(x, y)) { cells.push({ x, y, t: G.front[y][x], c: G.col[y][x] }); keys.add(key(x, y)); } });
    if (!cells.length) return fail('動かせるブロックがありません');
    const rect = { x0: dx, y0: dy, x1: dx + (src.x1 - src.x0), y1: dy + (src.y1 - src.y0) }, ghost = [];
    for (const c of cells) {
      const tx = c.x - src.x0 + dx, ty = c.y - src.y0 + dy;
      if (!inb(tx, ty)) return fail('はみ出します', { rects: [rect], ghost });
      ghost.push({ x: tx, y: ty, t: c.t, c: c.c });
      if (!(G.front[ty][tx] === 0 || keys.has(key(tx, ty)))) return fail('ぶつかります', { rects: [rect], ghost });
      if (cellBlocked(tx, ty)) return fail('じゃまがあります（キャラクター・リフトの道）', { rects: [rect], ghost });
    }
    if (cells.every(c => c.x - src.x0 + dx === c.x && c.y - src.y0 + dy === c.y)) return fail('同じ場所です');
    return { ok: true, cost: costOf('move'), rects: [src, rect], ghost, run() {
      for (const c of cells) { G.front[c.y][c.x] = 0; G.col[c.y][c.x] = 0; }
      for (const c of cells) { const tx = c.x - src.x0 + dx, ty = c.y - src.y0 + dy; G.front[ty][tx] = c.t; G.col[ty][tx] = c.c; }
    } };
  }
  function planSwap(a, dx, dy) {
    const w = a.x1 - a.x0, h = a.y1 - a.y0, b = { x0: dx, y0: dy, x1: dx + w, y1: dy + h };
    if (!inb(b.x0, b.y0) || !inb(b.x1, b.y1)) return fail('はみ出します', { rects: [a, b] });
    if (!(a.x1 < b.x0 || b.x1 < a.x0 || a.y1 < b.y0 || b.y1 < a.y0)) return fail('重なっています', { rects: [a, b] });
    const pairs = []; let changed = false;
    for (let j = 0; j <= h; j++) for (let i = 0; i <= w; i++) {
      const ax = a.x0 + i, ay = a.y0 + j, bx = b.x0 + i, by = b.y0 + j;
      if ((G.front[ay][ax] !== 0 && isFixedCell(ax, ay)) || (G.front[by][bx] !== 0 && isFixedCell(bx, by))) return fail('固定されたセルが含まれます', { rects: [a, b] });
      if (G.front[ay][ax] !== G.front[by][bx] || G.col[ay][ax] !== G.col[by][bx]) changed = true;
      if (G.front[ay][ax] !== 0 && cellBlocked(bx, by)) return fail('じゃまがあります（キャラクター・リフトの道）', { rects: [a, b] });
      if (G.front[by][bx] !== 0 && cellBlocked(ax, ay)) return fail('じゃまがあります（キャラクター・リフトの道）', { rects: [a, b] });
      pairs.push([ax, ay, bx, by]);
    }
    if (!changed) return fail('入れ替えても同じです', { rects: [a, b] });
    return { ok: true, cost: costOf('swap'), rects: [a, b], run() {
      for (const [ax, ay, bx, by] of pairs) {
        const ft = G.front[ay][ax], fc = G.col[ay][ax]; G.front[ay][ax] = G.front[by][bx]; G.col[ay][ax] = G.col[by][bx]; G.front[by][bx] = ft; G.col[by][bx] = fc;
      }
    } };
  }
  function planClear(r) {
    const cells = []; rectEach(r, (x, y) => { if (isMovable(x, y)) cells.push([x, y]); });
    if (!cells.length) return fail('消せるブロックがありません', { rects: [r] });
    return { ok: true, cost: costOf('clear'), rects: [r], hl: cells, run() { for (const [x, y] of cells) { G.front[y][x] = 0; G.col[y][x] = 0; } } };
  }
  function liftsInRect(r) { return G.lifts.filter(L => L.col === GLASS && !L.gone && L.x < (r.x1 + 1) * T && L.x + L.w > r.x0 * T && L.y < (r.y1 + 1) * T && L.y + L.h > r.y0 * T); }
  function planColor(r, c, id) {
    const ls = liftsInRect(r);
    const cells = []; rectEach(r, (x, y) => { if (isMovable(x, y) && G.col[y][x] === GLASS) cells.push([x, y]); }); // 書式をつけられるのは、ガラス(未書式)だけ
    if (!cells.length && !ls.length) return fail('ガラスがありません（書式をつけられるのは、ガラスだけ）', { rects: [r] });
    const hl = cells.slice(); for (const L of ls) for (let x = Math.floor(L.x / T); x * T < L.x + L.w; x++) hl.push([x, Math.floor(L.y / T)]);
    return { ok: true, cost: costOf(id), rects: [r], hl, run() { for (const [x, y] of cells) { G.col[y][x] = c; G.front[y][x] = TL.GLASSED; } for (const L of ls) { L.col = c; L.mark = true; } } };
  }
  function planTransform(r, op) {
    const w = r.x1 - r.x0 + 1, h = r.y1 - r.y0 + 1;
    if ((op === 'rot' || op === 'trans') && w !== h) return fail('正方形に選んでね（いま ' + w + '×' + h + '）', { rects: [r] });
    const map = (lx, ly) => ({ flipH: [w - 1 - lx, ly], flipV: [lx, h - 1 - ly], rot: [h - 1 - ly, lx], trans: [ly, lx] }[op]);
    const cells = [], vacated = new Set();
    rectEach(r, (x, y) => { if (isMovable(x, y)) { cells.push({ x, y, t: G.front[y][x], c: G.col[y][x] }); vacated.add(key(x, y)); } });
    if (!cells.length) return fail('動かせるブロックがありません', { rects: [r] });
    let changed = false;
    for (const c of cells) {
      const [nx, ny] = map(c.x - r.x0, c.y - r.y0); c.tx = r.x0 + nx; c.ty = r.y0 + ny;
      if (!inb(c.tx, c.ty)) return fail('はみ出します', { rects: [r] });
      if (!(G.front[c.ty][c.tx] === 0 || vacated.has(key(c.tx, c.ty)))) return fail('固定されたセルにぶつかります', { rects: [r] });
      if (cellBlocked(c.tx, c.ty)) return fail('じゃまがあります（キャラクター・リフトの道）', { rects: [r] });
      if (c.tx !== c.x || c.ty !== c.y) changed = true;
    }
    if (!changed) return fail('変形しても同じです', { rects: [r] });
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
    if (!diff.length) return fail('並べ替えても同じです', { rects: [r] });
    return { ok: true, cost: costOf('sort'), rects: [r], hl: diff.map(d => [d.x, d.y]), run() { for (const a of assign) { G.front[a.y][a.x] = a.t; G.col[a.y][a.x] = a.c; } } };
  }
  function planReplace(r, from, to) {
    if (from === to) return fail('「から」と「へ」が同じ色です', { rects: [r] });
    const cells = []; rectEach(r, (x, y) => { if (isMovable(x, y) && G.col[y][x] === from) cells.push([x, y]); });
    if (!cells.length) return fail(COLORS[from].n + '色のブロックがありません', { rects: [r] });
    return { ok: true, cost: costOf('replace'), rects: [r], hl: cells, run() { for (const [x, y] of cells) G.col[y][x] = to; } };
  }
  function planHide(r, axis) {
    const set = axis === 'col' ? G.hideCol : G.hideRow, lo = axis === 'col' ? r.x0 : r.y0, hi = axis === 'col' ? r.x1 : r.y1;
    const rows = []; for (let i = lo; i <= hi; i++) if (!set.has(i)) rows.push(i);
    const rect = axis === 'col' ? { x0: r.x0, x1: r.x1, y0: 0, y1: G.level.h - 1 } : { x0: 0, x1: G.level.w - 1, y0: r.y0, y1: r.y1 };
    if (!rows.length) return fail('すでに隠れています', { rects: [rect] });
    return { ok: true, cost: costOf('hide'), rects: [rect], run() { for (const i of rows) set.add(i); } };
  }
  function planUnhide() {
    if (!G.hideRow.size && !G.hideCol.size) return fail('隠れた行・列はありません');
    return { ok: true, cost: costOf('unhide'), run() { G.hideRow.clear(); G.hideCol.clear(); } };
  }
  function planFilter(c) {
    if (G.filter === c) return fail(c === null ? 'フィルターはかかっていません' : 'すでにその色です');
    if (c === null) return { ok: true, cost: 0, run() { G.filter = null; } };
    return { ok: true, cost: costOf('filter'), run() { G.filter = c; } };
  }
  function planProtect(r, on) {
    const cells = []; rectEach(r, (x, y) => { if (on ? (isBlk(x, y) && !G.lock[y][x]) : G.lock[y][x]) cells.push([x, y]); });
    if (!cells.length) return fail(on ? '保護できるブロックがありません' : '保護されたブロックがありません', { rects: [r] });
    return { ok: true, cost: costOf(on ? 'protect' : 'unprotect'), rects: [r], hl: cells, run() { for (const [x, y] of cells) G.lock[y][x] = on ? 1 : 0; } };
  }
  const colOfX = (x) => Math.floor(x / T);
  function shiftEntities(x, dir, removeCol) { // 列 x より右(以上)の持ちものを左右にずらす
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
    if (x < 1 || x > w - 2) return fail('ここには入れられません', { cols: [x] });
    for (let y = 0; y < h; y++) if (isBlk(w - 1, y)) return fail('いちばん右の列にブロックがあり、はみ出します', { cols: [x] });
    if (colOfX(G.flag.x) === w - 1) return fail('ゴールがはみ出します', { cols: [x] });
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
    if (x < 1 || x > w - 2) return fail('ここは消せません', { cols: [x] });
    if (colOfX(G.p.x + 5) === x) return fail('キャラクターがいる列は消せません', { cols: [x] });
    if (colOfX(G.flag.x) === x) return fail('ゴールの列は消せません', { cols: [x] });
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
      case 'painter': { const [sx, sy] = a.srcCell; if (!inb(sx, sy) || !isBlk(sx, sy)) return fail('まねするブロックがありません'); if (G.col[sy][sx] === GLASS) return fail('ガラスの色（未書式）はコピーできません'); return planColor(a.rect, G.col[sy][sx], 'painter'); }
      case 'transform': return planTransform(a.rect, o.tf);
      case 'sort': return planSort(a.rect, o.sort);
      case 'filter': return planFilter(a.fcolor !== undefined ? a.fcolor : o.fcolor);
      case 'protect': return planProtect(a.rect, true);
      case 'unprotect': return planProtect(a.rect, false);
    }
    return fail('この道具は使えません');
  }

  // ---- 実行・元に戻す・やり直す(状態をまるごと保存する) ----
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
    if (plan.cost > G.energy) { E.msg = 'エナジーが足りません（' + plan.cost + '）'; SFX.bad(); return false; }
    E.undo.push({ state: snapshot(), cost: plan.cost }); E.redo.length = 0;
    plan.run(); G.energy -= plan.cost; E.msg = ''; SFX.place();
    if (!G.regen && G.energy < minCost()) UI.toast('コストを使い切りました。もう編集できません（Rでやり直し）', 3500);
    return true;
  }
  function undoEdit() {
    const E = G.edit, u = E.undo.pop(); if (!u) { SFX.bad(); return; }
    E.redo.push({ state: snapshot(), cost: u.cost }); restoreSnap(u.state); G.energy = Math.min(G.maxE, G.energy + u.cost); SFX.place(); E.step = 0; E.src = null; E.msg = '';
  }
  function redoEdit() {
    const E = G.edit, r = E.redo.pop(); if (!r) { SFX.bad(); return; }
    if (G.energy < r.cost) { E.redo.push(r); E.msg = 'エナジーが足りません'; SFX.bad(); return; }
    E.undo.push({ state: snapshot(), cost: r.cost }); restoreSnap(r.state); G.energy -= r.cost; SFX.place();
  }
  function setEdit(on) {
    const E = G.edit; if (G.mode !== 'play' || G.cleared || G.p.dead) return;
    if (!G.level.tools.length) { UI.toast('このステージでは編集できないよ'); return; }
    E.on = on; E.sel = null; E.kb = null; E.msg = ''; E.step = 0; E.src = null; E.srcCell = null;
    if (on) { SFX.editOn(); E.cursor = [Math.floor((G.p.x + 5) / T), Math.floor((G.p.y + 7) / T)];  } else SFX.editOff();
    UI.refreshTools();
  }

  // ---- 範囲の選びかた(ドラッグ・タップ・キーボード) ----
  const toolDef = () => TOOL_BY[G.edit.tool];
  const hasMovable = (r) => { let n = 0; rectEach(r, (x, y) => { if (isMovable(x, y)) n++; }); return n > 0; };
  function onRectDone(r) {
    const E = G.edit, d = toolDef(); if (!d) return;
    if (d.mode === 'rect') runPlan(planFor(E.tool, { rect: r }));
    else if (d.mode === 'two' && E.step === 0) {
      if (!hasMovable(r)) { E.msg = '動かせるブロックがありません'; SFX.bad(); } else { E.src = r; E.step = 1; E.msg = ''; SFX.place(); }
    } else if (d.mode === 'painter' && E.step === 1) { if (runPlan(planFor('painter', { rect: r, srcCell: E.srcCell }))) { /* 続けて塗れる */ } }
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

  // ===== 更新 =====
  function update(dt) {
    if (G.mode !== 'play') return;
    if (G.edit.on) { G.frame++; G.shake = 0; return; }
    if (G.hitstop > 0) { G.hitstop -= dt; return; }
    G.frame++; G.t += dt;
    if (!G.cleared) G.time += dt;
    updateLifts(dt); updatePlayer(dt); updateEnemies(dt); updatePickups();
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
  // 見た目: ?gfx=excel(標準: Excel風) / ?gfx=snes(ソリッド版) / ?gfx=classic(元の絵)
  const THEME = ((/[?&]gfx=(\w+)/.exec(location.search) || [])[1]) || 'excel';
  const EXCEL = THEME === 'excel' && !!window.GFXX, SNES = THEME === 'snes' && !!window.GFX, SOLID = (EXCEL || SNES) && !!window.GFX;
  const TILES = EXCEL ? window.GFXX : SNES ? window.GFX : null;
  if (EXCEL) document.body.classList.add('theme-excel');
  function drawBackground() {
    if (TILES) { TILES.bg(ctx, G, G.level, W, H); return; }
    const lv = G.level; ctx.fillStyle = lv.bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = lv.bg2;
    const sc = Math.round(G.cam.x * .3);
    for (let i = -1; i < 5; i++) { // 遠景の丸い丘(1ドット単位の階段)
      const cx = i * 110 - (sc % 110) + 50, r = 52, base = 150;
      for (let x = cx - r; x < cx + r; x++) { const dx = x + .5 - cx; const h = Math.round(Math.sqrt(r * r - dx * dx) * .55); ctx.fillRect(x, base - h, 1, h + 40); }
    }
    const sd = Math.round(G.cam.x * .5);
    for (let j = 0; j < 16; j++) ctx.fillRect(((j * 47 - sd) % 330 + 330) % 330 - 5, 10 + (j * 31) % 120, 2, 2);
  }
  const TC = { steel: '#66708C', steelL: '#8D97B3', steelD: '#2F3752' };
  const LOCK = ['.111.', '1...1', '11111', '11011', '11111'];
  // 元ガラスの印: 白い「つやの枠」(内がわの枠と、かどのきらめき)
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
  function drawTile(t, x, y, tx, ty) {
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
  // レール(往復する道)は、うすく見せる。リフトは、矢印つきの緑の板
  function drawLiftRails(cx, cy) {
    for (const L of G.lifts) {
      const r = L.rail, x = r.x0 * T - cx, y = r.y0 * T - cy, w = (r.x1 - r.x0 + 1) * T, h = (r.y1 - r.y0 + 1) * T, c = EXCEL ? '33,115,70' : '255,255,255';
      ctx.fillStyle = 'rgba(' + c + ',.10)'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(' + c + ',.35)';
      if (L.vert) { for (let yy = y; yy < y + h; yy += 4) { ctx.fillRect(x + L.w / 2 - 1 + 0, yy, 2, 2); } ctx.fillRect(x, y, L.w, 1); ctx.fillRect(x, y + h - 1, L.w, 1); }
      else { for (let xx = x; xx < x + w; xx += 4) ctx.fillRect(xx, y + 7, 2, 2); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h); }
    }
  }
  // リフトの板の色: 0=ふつう(緑の板) 1〜4=性質の色(ブロックと同じ) 5=ガラス(未書式)
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
      if (!liftOn(L)) ctx.globalAlpha = .28; // フィルターで消えているリフト: うすく見える(通りぬけられる)
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
      if (L.mark) { ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillRect(x + 2, y + 2, w - 4, 1); ctx.fillRect(x + 2, y + 2, 1, h - 6); ctx.fillRect(x + 4, y + 4, 2, 1); ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(x + 3, y + h - 5, w - 5, 1); }
      ctx.globalAlpha = 1;
    }
  }
  // Excelの「Σ（合計）」: 宝石のかわり。ステージに3つ。あつめると、HUDの3つのわくが、うまっていく
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
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) { const t = G.front[ty][tx]; if (t) drawTile(t, tx * T - cx, ty * T - cy, tx, ty); }
    drawLifts(cx, cy);
    // 隠した行・列は、点線で示す
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
    // 敵
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
    // 相棒エナー
    if (!ENER) { const p = G.p, bx = Math.round(p.x - cx - p.face * 14 + Math.sin(G.t * 3) * 1), by = Math.round(p.y - cy - 12 + Math.sin(G.t * 4) * 2); if (EXCEL) ctx.drawImage(GFXX.bird(p.face < 0), bx - 1, by - 1); else if (SOLID) ctx.drawImage(GFX.bird(p.face < 0), bx - 1, by - 1); else ctx.drawImage(sprite('bird', 0, p.face < 0), bx, by); }
  }
  const ENER_PAL = { W: '#FFFFFF', S: '#C6D3F0', U: '#4F7FE0', V: '#8FB0F5', O: '#F29B3A', e: '#1F2A44', f: '#E8663A' };
  const enerCache = {};
  function enerImg(name, flip) {
    if (EXCEL) return GFXX.ener(name, flip);
    const k = name + (flip ? 1 : 0); return enerCache[k] || (enerCache[k] = GFX.gridSprite(GFX.enerGrid(name, ENER_PAL), flip));
  }
  function drawEner(cx, cy) { // 主人公エナー
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
    if (p.atkT > 0) { // レンチの弧
      const b = attackBox(), prog = 1 - p.atkT / .22; ctx.fillStyle = '#D5DBE6';
      if (p.pogo) { ctx.fillRect(Math.round(b.x - cx) + 2, Math.round(b.y - cy), 8, 3 + Math.round(prog * 8)); }
      else { const len = Math.round(6 + prog * 14); ctx.fillRect(Math.round(p.face > 0 ? b.x - cx : b.x + b.w - cx - len), Math.round(b.y - cy) + 2, len, 3); ctx.fillStyle = '#93A0B8'; ctx.fillRect(Math.round(p.face > 0 ? b.x - cx + len - 3 : b.x + b.w - cx - len), Math.round(b.y - cy) + 2, 3, 10); }
    }
  }
  function drawHUD() {
    return; // HUDは、ウィンドウのリボンに出す(キャンバスには描かない)
    const X = EXCEL; // Excel風: 白い板(コメントのような)の上に、暗い色で描く
    if (X) { ctx.save(); ctx.translate(GFXX.HW + 2, GFXX.HH + 2); const ph = (G.level.tools.length ? 33 : 24) + (G.filter !== null ? 9 : 0); ctx.fillStyle = '#F3F3F3'; ctx.fillRect(0, 0, 88, ph); ctx.fillStyle = '#ABABAB'; ctx.fillRect(0, 0, 88, 1); ctx.fillRect(0, ph - 1, 88, 1); ctx.fillRect(0, 0, 1, ph); ctx.fillRect(87, 0, 1, ph); }
    const ink = X ? '#262626' : '#fff', sub = X ? '#595959' : '#D5DBE6';
    // ハート
    for (let i = 0; i < 3; i++) icon(HEART, 6 + i * 7, 6, i < G.p.hp ? '#E8563F' : (X ? '#D0D0D0' : '#2F3752'));
    // エナジー(編集できないステージでは出さない)
    if (G.level.tools.length) {
      ctx.fillStyle = X ? '#7F7F7F' : '#1F2A44'; ctx.fillRect(5, 15, 62, 7); ctx.fillStyle = X ? '#FFFFFF' : '#5B6785'; ctx.fillRect(6, 16, 60, 5);
      ctx.fillStyle = G.energy < minCost() ? '#E8563F' : (X ? '#70AD47' : '#F5C842'); ctx.fillRect(6, 16, Math.round(60 * G.energy / Math.max(1, G.maxE)), 5);
      icon(BOLT, 70, 14, X ? '#C99A1E' : '#F5C842'); text(Math.floor(G.energy), 77, 16, ink);
    }
    // 宝石
    const gy = G.level.tools.length ? 25 : 16;
    const ng = G.level.gems.length;
    if (X && ng === 3) for (let i = 0; i < 3; i++) sigmaTile(6 + i * 11, gy - 1, 9, i < G.gems);
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
    if (E.step === 1 && E.src) box(E.src, '#4C9BE8');                       // 切り取り元・入れ替え元
    if (E.srcCell) box({ x0: E.srcCell[0], y0: E.srcCell[1], x1: E.srcCell[0], y1: E.srcCell[1] }, '#F5C842'); // 書式のコピー元
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
  function renderSheet() { // シート(マス目の世界)だけをえがく。リボン・ペインは、ウィンドウ側で
    G.sx = (G.shake && !G.edit.on) ? (Math.random() - .5) * G.shake : 0;
    drawBackground(); drawWorld();
    if (EXCEL) GFXX.frame(ctx, G, G.level, W, H);
    if (G.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (G.flash * 1.2) + ')'; ctx.fillRect(0, 0, W, H); }
    if (G.edit.on) drawEditOverlay();
    if (G.p.dead) { ctx.fillStyle = 'rgba(31,42,68,' + Math.min(.6, (0.7 - G.p.dead)) + ')'; ctx.fillRect(0, 0, W, H); }
  }

  // ===== 日本語のドット文字(font_ja.js) と、キャンバスのUI =====
  const FJ = window.FONT_JA || { 10: {}, 12: {} };
  const glyphCache = new Map();
  const charAdv = (ch, size) => (ch.charCodeAt(0) < 0x80 ? size >> 1 : size);
  function glyphImg(ch, size, color) {
    const key = size + color + ch; let c = glyphCache.get(key); if (c !== undefined) return c;
    const hx = (FJ[size] || {})[ch]; if (!hx) { glyphCache.set(key, null); return null; }
    const adv = charAdv(ch, size), cvs = document.createElement('canvas'); cvs.width = adv; cvs.height = size; const g2 = cvs.getContext('2d'); g2.fillStyle = color;
    for (let y = 0; y < size; y++) { const row = parseInt(hx.substr(y * 3, 3), 16); for (let x = 0; x < adv; x++) if ((row >> (adv - 1 - x)) & 1) g2.fillRect(x, y, 1, 1); }
    glyphCache.set(key, cvs); return cvs;
  }
  function textW(str, size, scale) { let w = 0; for (const ch of String(str)) w += charAdv(ch, size || 10) * (scale || 1); return w; }
  const TXT_FONT = '"Yu Gothic UI","Meiryo UI","Hiragino Sans","Noto Sans CJK JP","Noto Sans JP",sans-serif';
  function drawText(str, x, y, color, size, scale) {
    size = size || 10; scale = scale || 1; color = color || '#1A1A1A'; let cx = x;
    ctx.fillStyle = color; ctx.textBaseline = 'top'; ctx.font = '600 ' + Math.round(size * scale * 1.05 * 10) / 10 + 'px ' + TXT_FONT;
    for (const ch of String(str)) {
      if (ch === '\n') { cx = x; y += size * scale + 1; continue; }
      if (ch !== ' ' && ch !== '\u3000') ctx.fillText(ch, cx, y - 1);
      cx += charAdv(ch, size) * scale;
    }
    return cx - x;
  }
  function wrapText(str, maxW, size) {
    const lines = []; let cur = '', w = 0;
    for (const ch of String(str)) {
      if (ch === '\n') { lines.push(cur); cur = ''; w = 0; continue; }
      const a = charAdv(ch, size);
      if (w + a > maxW && cur) { lines.push(cur); cur = ''; w = 0; }
      cur += ch; w += a;
    }
    if (cur) lines.push(cur); return lines;
  }
  // ドット絵のアイコン(1=いろ)
  const ICON = {
    edit: ['.......##', '......###', '.....###.', '....###..', '...###...', '..###....', '.###.....', '###......', '##.......'],
    restart: ['..#####..', '.#.....#.', '#.....###', '#......#.', '#........', '#.......#', '.#.....#.', '..#####..'],
    sound: ['...#.....', '..##.#...', '####..#..', '####..#..', '####..#..', '..##.#...', '...#.....'],
    mute: ['...#.....', '..##.#.#.', '####..#..', '####.#.#.', '####.....', '..##.....', '...#.....'],
    menu: ['#########', '.........', '#########', '.........', '#########'],
    hand: ['...#.#...', '.#.#.#.#.', '.#.#.#.#.', '.#.#.#.##', '.#######.', '.#######.', '..######.', '...#####.'],
    undo: ['..#......', '.##.####.', '###.....#', '.##.....#', '..#....#.', '.......#.'],
    redo: ['......#..', '.####.##.', '#.....###', '#.....##.', '.#....#..', '.#.......'],
    left: ['....#', '...##', '..###', '.####', '#####', '.####', '..###', '...##', '....#'],
    right: ['#....', '##...', '###..', '####.', '#####', '####.', '###..', '##...', '#....'],
  };
  function drawIcon(name, x, y, color, scale) {
    const rows = ICON[name]; scale = scale || 1; ctx.fillStyle = color || '#262626';
    for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) if (rows[j][i] === '#') ctx.fillRect(Math.round(x + i * scale), Math.round(y + j * scale), scale, scale);
  }
  const iconSize = (name) => [ICON[name][0].length, ICON[name].length];
  function iconScaled(rows, x, y, c1, scale) { for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) if (rows[j][i] !== '.') { ctx.fillStyle = c1; ctx.fillRect(x + i * scale, y + j * scale, scale, scale); } }

  // ---- ウィンドウの大きさ(論理)と、ボタンの当たり判定 ----
  const VIEW = { w: 416, h: 204, portrait: false, ph: 100, rh: 24, pw: 96, s: 2 };
  let SX = 48, SY = 15; // シート(マス目の世界)の左上(横向き: 左ペインのつぎ。縦向き: リボンの下)
  const MY = 24; // メニュー画面の、リボンの高さ
  const UIC = { hits: [], scroll: {}, down: null, touch: false, press: null };
  const COL = { bg: '#F3F3F3', line: '#ABABAB', text: '#262626', sub: '#595959', green: '#217346', gdark: '#185C37', note: '#FFFFE1', sel: '#E2F0D9' };
  function box(x, y, w, h, fill, border) { if (fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); } if (border) { ctx.fillStyle = border; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h); } }
  // ボタン: label か icon。type 'tap'(離したとき) / 'hold'(おしている間)。
  function btn(x, y, w, h, o) {
    const hit = { x, y, w, h, type: o.hold ? 'hold' : 'tap', fn: o.fn, name: o.name, label: o.hl || o.label || o.icon || o.name || '' };
    UIC.hits.push(hit);
    const pressed = UIC.press === hit || (o.hold && o.name && ((o.name === 'left' && input.left) || (o.name === 'right' && input.right) || (o.name === 'jump' && input.jumpHeld)));
    const primary = o.primary, sel = o.sel;
    let fill = primary ? (pressed ? COL.gdark : COL.green) : (sel ? COL.sel : (pressed ? '#CFE3D6' : '#F8F8F8'));
    box(x, y, w, h, fill, primary ? COL.gdark : (sel ? COL.green : '#8C8C8C'));
    if (!primary && !sel) { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x + 1, y + 1, w - 2, 1); }
    const ink = primary ? '#FFFFFF' : COL.text, size = o.size || 10;
    if (o.icon) { const [iw, ih] = iconSize(o.icon), sc = o.iscale || 1; drawIcon(o.icon, x + ((w - iw * sc) >> 1), y + ((h - ih * sc) >> 1), o.icolor || ink, sc); }
    else if (o.label) {
      const tw = textW(o.label, size);
      if (o.left) drawText(o.label, x + 3, y + ((h - size) >> 1), ink, size); else drawText(o.label, x + ((w - tw) >> 1), y + ((h - size) >> 1), ink, size);
      if (o.right) drawText(o.right, x + w - 3 - textW(o.right, size), y + ((h - size) >> 1), primary ? '#FFFFFF' : COL.green, size);
    }
    if (sel) { ctx.fillStyle = COL.green; ctx.fillRect(x, y, 2, h); }
    return hit;
  }
  const hitAt = (x, y) => { for (let i = UIC.hits.length - 1; i >= 0; i--) { const h = UIC.hits[i]; if (x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) return h; } return null; };
  // スクロールする一覧: {id,x,y,w,h,total}。ドラッグ・ホイールでうごく
  function scrollRegion(id, x, y, w, h, total) {
    const s = UIC.scroll[id] || (UIC.scroll[id] = { off: 0 }); s.max = Math.max(0, total - h); s.off = clamp(s.off, 0, s.max);
    UIC.hits.push({ x, y, w, h, type: 'scroll', id }); return s;
  }
  function scrollbar(s, x, y, h, total) { if (s.max <= 0) return; const th = Math.max(10, h * h / total), ty = y + (h - th) * s.off / s.max; box(x, y, 3, h, '#E1E1E1'); box(x, Math.round(ty), 3, Math.round(th), COL.green); }
  const toLogical = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * (VIEW.w / r.width), y: (e.clientY - r.top) * (VIEW.h / r.height) }; };

  // ===== 入力 =====
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
  // ポインタ: ボタン(キャンバスにえがいたUI) → シート(編集のドラッグ・タップ)の順に、あたりを調べる
  function toWorld(e) {
    const L = toLogical(e), px = L.x - SX + Math.round(G.cam.x), py = L.y - SY + Math.round(G.cam.y);
    return { px, py, tx: clamp(Math.floor(px / T), 0, G.level.w - 1), ty: clamp(Math.floor(py / T), 0, G.level.h - 1) };
  }
  const inSheet = (L) => L.x >= SX && L.x < SX + W && L.y >= SY && L.y < SY + H;
  let dragging = false, panLast = null, tapMode = false;
  const wantsRect = () => { const d = toolDef(), E = G.edit; return d && (d.mode === 'rect' || (d.mode === 'two' && E.step === 0) || (d.mode === 'painter' && E.step === 1)); };
  const ptrs = new Map();
  const scrollAt = (x, y) => { for (const h of UIC.hits) if (h.type === 'scroll' && x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) return h; return null; };
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('pointerdown', (e) => {
    audio(); if (e.pointerType === 'touch') UIC.touch = true; e.preventDefault(); cv.setPointerCapture(e.pointerId);
    const L = toLogical(e), h = hitAt(L.x, L.y);
    if (h && h.type === 'hold') { press(h.name, true); UIC.press = h; ptrs.set(e.pointerId, { hold: h }); return; }
    const sc = scrollAt(L.x, L.y);
    if (h && h.type === 'tap' || sc) { UIC.press = h && h.type === 'tap' ? h : null; ptrs.set(e.pointerId, { tap: h && h.type === 'tap' ? h : null, scroll: sc, y0: L.y, ly: L.y, moved: false }); return; }
    // シート(編集中だけ)
    if (G.mode !== 'play' || !G.edit.on || !inSheet(L)) return;
    const E = G.edit, w = toWorld(e);
    if (E.pan) { panLast = { x: L.x, y: L.y }; return; }
    E.kb = null; E.cursor = [w.tx, w.ty]; E.hover = [w.tx, w.ty];
    if (wantsRect()) { dragging = true; tapMode = false; E.sel = { x0: w.tx, y0: w.ty, x1: w.tx, y1: w.ty }; }
    else { dragging = true; tapMode = true; E.sel = null; }
  });
  cv.addEventListener('pointermove', (e) => {
    const L = toLogical(e), pt = ptrs.get(e.pointerId);
    if (pt && pt.scroll) { if (!pt.moved && Math.abs(L.y - pt.y0) > 5) { pt.moved = true; UIC.press = null; } if (pt.moved) { UIC.scroll[pt.scroll.id].off -= (L.y - pt.ly); } pt.ly = L.y; return; }
    if (pt) return;
    const E = G.edit; if (G.mode !== 'play' || !E.on) return;
    if (panLast) { G.cam.x = clamp(G.cam.x - (L.x - panLast.x), 0, G.level.w * T - W); G.cam.y = clamp(G.cam.y - (L.y - panLast.y), 0, Math.max(0, G.level.h * T - H)); panLast = { x: L.x, y: L.y }; return; }
    if (!dragging && !inSheet(L)) return;
    const w = toWorld(e); E.hover = [w.tx, w.ty]; if (!dragging) { E.cursor = [w.tx, w.ty]; return; }
    if (E.sel) { E.sel.x1 = w.tx; E.sel.y1 = w.ty; }
  });
  const endDrag = () => {
    const E = G.edit; if (panLast) { panLast = null; return; }
    if (!dragging) return; dragging = false;
    if (tapMode) { const h = E.hover; tapMode = false; if (h) onTap(h[0], h[1]); return; }
    if (!E.sel) return; const r = normRect(E.sel); E.sel = null; onRectDone(r);
  };
  const ptrUp = (e, cancel) => {
    const pt = ptrs.get(e.pointerId);
    if (pt) {
      ptrs.delete(e.pointerId); UIC.press = null;
      if (pt.hold) { press(pt.hold.name, false); return; }
      if (!cancel && pt.tap && !pt.moved) { const L = toLogical(e), h = pt.tap; if (L.x >= h.x && L.x < h.x + h.w && L.y >= h.y && L.y < h.y + h.h && h.fn) h.fn(); }
      return;
    }
    if (cancel) { dragging = false; G.edit.sel = null; panLast = null; return; }
    endDrag();
  };
  cv.addEventListener('pointerup', (e) => ptrUp(e, false)); cv.addEventListener('pointercancel', (e) => ptrUp(e, true));
  cv.addEventListener('wheel', (e) => { const L = toLogical(e), sc = scrollAt(L.x, L.y); if (sc) { e.preventDefault(); UIC.scroll[sc.id].off += e.deltaY * .5; } }, { passive: false });

  // ===== UI(キャンバスで描く: ゲームと同じドット文字・同じ倍率) =====
  const TOUCH_DEV = () => UIC.touch || (window.matchMedia && matchMedia('(hover: none)').matches);
  const UI = {
    toastMsg: '', toastT: 0, result: null,
    toast(msg, ms) { UI.toastMsg = msg; UI.toastT = (ms || 2200) / 1000; },
    show() { fit(); }, refresh() {}, refreshTools() {}, helpText() {},
    tabsOf() { const t = new Set(); G.level.tools.forEach(id => t.add(TOOL_BY[id].tab)); return TABS.map(x => x.id).filter(id => t.has(id)); },
    toolsOfTab(tab) { return G.level.tools.map(id => TOOL_BY[id]).filter(t => t.tab === tab); },
    pickTab(tab) { const E = G.edit; E.tab = tab; const l = UI.toolsOfTab(tab); if (!l.find(t => t.id === E.tool)) UI.pickTool(l[0].id); },
    pickTool(id) { const E = G.edit; E.tool = id; E.tab = TOOL_BY[id].tab; E.sel = null; E.kb = null; E.step = 0; E.src = null; E.srcCell = null; E.pan = false; E.msg = ''; },
    restart() { if (G.mode !== 'play') return; loadLevel(G.levelIdx); },
    start(i) { G.mode = 'play'; loadLevel(i); UI.toastT = 0; G.paused = false; },
    title() { G.mode = 'title'; },
    select() { G.mode = 'select'; },
    unlocked(i) { return true; }, // 試遊用: ステージは自由に選べる
    buildSelect() {},
    showResult(goals) { G.mode = 'result'; UI.result = goals; },
  };
  const hasEditBtn = () => G.level && G.level.tools.length > 0;
  const toggleMute = () => { muted = !muted; save.muted = muted; persist(); };

  // ---- 目標のバッジ(✓クリア / Σが3つ / ノーミス)をキャンバスにえがく ----
  function drawBadges(x, y, goals, gemsGot, n, sc) {
    sc = sc || 1; const s = 10 * sc; let cx = x;
    box(cx, y, s, s, goals[0] ? COL.green : '#BFBFBF', null); const ck = ['...........', '.........#.', '........##.', '.#.....##..', '.##...##...', '..##.##....', '...###.....', '....#......']; // ✓
    ctx.fillStyle = '#FFFFFF'; for (let j = 0; j < 8; j++) for (let i = 0; i < 11; i++) if (ck[j][i] === '#') ctx.fillRect(cx + Math.round((i - 1) * sc * (s - 2) / 10) + sc, y + Math.round((j + 1) * sc * (s - 2) / 10), Math.max(1, sc), Math.max(1, sc));
    cx += s + 3 * sc;
    if (n > 0) { for (let i = 0; i < Math.min(n, 3); i++) { sigmaTile(cx, y, s, i < gemsGot); cx += s + 1 * sc; } cx += 2 * sc; }
    const label = 'ノーミス', size = sc > 1 ? 12 : 10, tw = textW(label, size) + 6 * sc;
    box(cx, y, tw, s, goals[2] ? '#FFC000' : '#E1E1E1', goals[2] ? '#B38600' : '#BFBFBF'); drawText(label, cx + 3 * sc, y + ((s - size) >> 1), goals[2] ? '#262626' : '#8C8C8C', size);
    return cx + tw - x;
  }
  const badgesW = (n, sc) => { sc = sc || 1; const s = 10 * sc; return s + 3 * sc + (n > 0 ? Math.min(n, 3) * (s + sc) + 2 * sc : 0) + textW('ノーミス', sc > 1 ? 12 : 10) + 6 * sc; };

  // ---- リボン(上): ライフ・コスト・Σ・タイム・ボタン ----
  function drawRibbonBase(title, h) {
    h = h || MY; const w = VIEW.w; box(0, 0, w, h, COL.bg); ctx.fillStyle = COL.line; ctx.fillRect(0, h - 1, w, 1);
    box(0, 0, 38, h - 1, '#FFFFFF'); ctx.fillStyle = COL.green; ctx.fillRect(0, h - 4, 38, 3); drawText('ホーム', 4, (h - 4 - 10) >> 1, COL.green, 10);
    ctx.fillStyle = '#D4D4D4'; ctx.fillRect(38, 0, 1, h - 1);
    if (title) drawText(title, 46, (h - 10) >> 1, COL.text, 10);
  }
  function actionButtons(list) { list.forEach(([x, y, w, h, o]) => btn(x, y, w, h, o)); }
  function menuActions() { return { menu: { icon: 'menu', label: 'ステージえらび', fn: () => UI.select() }, sound: { icon: muted ? 'mute' : 'sound', label: '音', fn: toggleMute }, restart: { icon: 'restart', label: 'やりなおし', fn: () => UI.restart() } }; }
  function drawRibbonPlay() {
    const P = VIEW.portrait, rh = P ? MY : 15; drawRibbonBase(null, rh); const w = VIEW.w, ty = (rh - 10) >> 1; let x = 44; const sep = (xx) => { ctx.fillStyle = '#D4D4D4'; ctx.fillRect(xx, 2, 1, rh - 5); };
    for (let i = 0; i < 3; i++) iconScaled(['.1.1.', '11111', '11111', '.111.', '..1..'], x + i * 12, ty, i < G.p.hp ? '#E04444' : '#D0D0D0', 2);
    x += 3 * 12 + 4; sep(x); x += 6;
    if (hasEditBtn()) {
      const e = Math.floor(G.energy), bw = P ? 24 : 34, by = (rh - 8) >> 1; box(x, by, bw, 8, '#FFFFFF', '#8C8C8C'); ctx.fillStyle = G.energy < minCost() ? '#E04444' : '#70AD47'; ctx.fillRect(x + 1, by + 1, Math.round((bw - 2) * G.energy / Math.max(1, G.maxE)), 6);
      x += bw + 3; x += drawText(String(e), x, ty, COL.text, 10) + 5; sep(x); x += 6;
    }
    const ng = G.level.gems.length; if (ng) { if (ng <= 3) for (let i = 0; i < ng; i++) { sigmaTile(x, ty, 10, i < G.gems); x += 11; } else { sigmaTile(x, ty, 10, true); x += 12; x += drawText(G.gems + '/' + ng, x, ty, COL.text, 10); } x += 3; sep(x); x += 6; }
    drawText(Math.floor(G.time / 60) + ':' + String(Math.floor(G.time % 60)).padStart(2, '0'), x, ty, COL.text, 10);
    if (!P) { // 横向き: ボタンは、左のペイン。ここには、ステージ名を出す
      const nm = G.level.id + ' ' + G.level.name; drawText(nm, w - 6 - textW(nm, 10), ty, COL.green, 10); return;
    }
    const M = menuActions(); let bx = w - 3; const by = 4, bh = 16;
    bx -= 18; btn(bx, by, 18, bh, M.menu); bx -= 20; btn(bx, by, 18, bh, M.sound); bx -= 20; btn(bx, by, 18, bh, M.restart); bx -= 4;
    if (hasEditBtn()) { bx -= 20; btn(bx, by, 20, bh, { hl: '編集', sel: G.edit.on, icon: 'edit', fn: () => toggleEdit() }); }
  }
  // ---- ペイン(横/下): 操作ボタン・キー説明・編集の道具 ----
  function paneRect() { return VIEW.portrait ? { x: 0, y: SY + H, w: VIEW.w, h: VIEW.h - SY - H } : { x: SX + W, y: SY, w: VIEW.w - W, h: H }; }
  function editHelp() { const E = G.edit, d = TOOL_BY[E.tool]; return E.pan ? 'ドラッグで画面を動かす' : (E.msg || E.hint || (d ? d.help : '')); }
  function drawPane() { if (VIEW.portrait) drawPanePortrait(); else { drawLeftPane(); drawRightPane(); } }
  function drawPanePortrait() {
    const P = paneRect(); box(P.x, P.y, P.w, P.h, COL.bg, null); ctx.fillStyle = COL.line; if (VIEW.portrait) ctx.fillRect(P.x, P.y, P.w, 1); else ctx.fillRect(P.x, P.y, 1, P.h);
    const E = G.edit;
    if (!E.on) {
      if (TOUCH_DEV()) {
        if (VIEW.portrait) { const cy = P.y + ((P.h - 44) >> 1); btn(P.x + 10, cy, 52, 44, { hold: true, name: 'left', icon: 'left', iscale: 2, label: '左' }); btn(P.x + 68, cy, 52, 44, { hold: true, name: 'right', icon: 'right', iscale: 2, label: '右' }); btn(P.x + P.w - 110, cy, 100, 44, { hold: true, name: 'jump', primary: true, label: 'はばたき', size: 12 }); }
        else { btn(P.x + 6, P.y + 92, 40, 40, { hold: true, name: 'left', icon: 'left', iscale: 2, label: '左' }); btn(P.x + 50, P.y + 92, 40, 40, { hold: true, name: 'right', icon: 'right', iscale: 2, label: '右' }); btn(P.x + 6, P.y + 138, 84, 34, { hold: true, name: 'jump', primary: true, label: 'はばたき', size: 12 }); }
      } else {
        const lines = ['キー操作', '← → 移動', 'Z / Space', 'はばたき', '空中で押し続けると', 'ふわり', 'E 編集(時間停止)', 'R やりなおし'];
        lines.forEach((t, i) => drawText(t, P.x + 6, P.y + 6 + i * 13, i === 0 ? COL.green : COL.sub, 10));
      }
      return;
    }
    // 編集のパネル
    let y = P.y + 3; const w = P.w - 6, x0 = P.x + 3;
    const note = wrapText(editHelp(), w - 6, 10).slice(0, VIEW.portrait ? 3 : 5); const nh = note.length * 11 + 4;
    box(x0, y, w, nh, COL.note, '#000000'); note.forEach((t, i) => drawText(t, x0 + 3, y + 2 + i * 11, '#000000', 10)); y += nh + 3;
    const tabs = UI.tabsOf(), tw = Math.floor(w / Math.max(1, tabs.length));
    tabs.forEach((id, i) => btn(x0 + i * tw, y, tw - 1, 14, { sel: E.tab === id, label: TABS.find(t => t.id === id).name, fn: () => UI.pickTab(id) })); y += 17;
    UI.toolsOfTab(E.tab).forEach((t, i) => { btn(x0, y, w, 15, { sel: E.tool === t.id && !E.pan, left: true, label: (i + 1) + ' ' + t.name, right: String(t.cost), fn: () => UI.pickTool(t.id) }); y += 16; });
    y += 2; const o = E.opts, id = E.tool;
    const chipRow = (items) => { let cx = x0; for (const it of items) { const cw = it.color !== undefined ? 14 : textW(it.label, 10) + 8; if (cx + cw > x0 + w) { cx = x0; y += 15; } if (it.color !== undefined) { const h = btn(cx, y, cw, 13, { sel: it.sel, fn: it.fn, label: COLORS[it.color].n }); box(cx + 2, y + 2, cw - 4, 9, COLORS[it.color].hex, '#404040'); } else btn(cx, y, cw, 13, { sel: it.sel, label: it.label, fn: it.fn }); cx += cw + 2; } y += 15; };
    if (id === 'transform') chipRow([{ v: 'flipH', label: '左右反転' }, { v: 'flipV', label: '上下反転' }, { v: 'rot', label: '回転90°' }].map(it => ({ ...it, sel: o.tf === it.v, fn: () => { o.tf = it.v; } })));
    else if (id === 'sort') chipRow([{ v: 'L', label: '←寄せ' }, { v: 'R', label: '寄せ→' }, { v: 'U', label: '↑寄せ' }, { v: 'D', label: '寄せ↓' }].map(it => ({ ...it, sel: o.sort === it.v, fn: () => { o.sort = it.v; } })));
    else if (id === 'filter') { drawText('残す色', x0, y, COL.sub, 10); y += 12; chipRow(COLORS.map((c, i) => ({ color: i, sel: G.filter === i, fn: () => { runPlan(planFor('filter', { fcolor: i })); } })).concat([{ label: '解除', sel: G.filter === null, fn: () => { runPlan(planFor('filter', { fcolor: null })); } }])); }
    // フッター: やり直し・やり直す・画面を動かす・終了
    const fy = P.y + P.h - 19, fw = Math.floor((w - 6) / 3);
    btn(x0, fy, 18, 16, { icon: 'undo', label: '元に戻す', fn: () => undoEdit() }); btn(x0 + 20, fy, 18, 16, { icon: 'redo', label: 'やり直す', fn: () => redoEdit() }); btn(x0 + 40, fy, 18, 16, { sel: E.pan, icon: 'hand', label: '画面を動かす', fn: () => { E.pan = !E.pan; } });
    btn(x0 + 60, fy, w - 60, 16, { primary: true, label: VIEW.portrait ? '編集を終える' : '終了', fn: () => setEdit(false) });
  }
  // ---- 横向き: 左ペイン(ボタン・指の左)と右ペイン(はばたき・説明・編集) ----
  function drawLeftPane() {
    const P = { x: 0, y: SY, w: SX, h: H }, E = G.edit; box(P.x, P.y, P.w, P.h, COL.bg, null); ctx.fillStyle = COL.line; ctx.fillRect(P.x + P.w - 1, P.y, 1, P.h);
    if (!E.on) {
      const M = menuActions(), y0 = P.y + 3;
      btn(2, y0, 21, 21, M.menu); btn(25, y0, 21, 21, M.sound); btn(2, y0 + 23, 21, 21, M.restart);
      if (hasEditBtn()) btn(25, y0 + 23, 21, 21, { hl: '編集', icon: 'edit', fn: () => toggleEdit() });
      if (TOUCH_DEV()) { btn(2, P.y + 86, 21, 90, { hold: true, name: 'left', icon: 'left', iscale: 2, label: '左' }); btn(25, P.y + 86, 21, 90, { hold: true, name: 'right', icon: 'right', iscale: 2, label: '右' }); }
      return;
    }
    UI.tabsOf().forEach((id, i) => btn(2, P.y + 3 + i * 16, 44, 14, { sel: E.tab === id, label: TABS.find(t => t.id === id).name, fn: () => UI.pickTab(id) }));
    const fy = P.y + P.h - 44;
    btn(2, fy, 21, 19, { icon: 'undo', label: '元に戻す', fn: () => undoEdit() }); btn(25, fy, 21, 19, { icon: 'redo', label: 'やり直す', fn: () => redoEdit() });
    btn(2, fy + 22, 21, 19, { sel: E.pan, icon: 'hand', label: '画面を動かす', fn: () => { E.pan = !E.pan; } }); btn(25, fy + 22, 21, 19, { primary: true, label: '終了', fn: () => setEdit(false) });
  }
  function drawRightPane() {
    const P = { x: SX + W, y: SY, w: VIEW.w - SX - W, h: H }, E = G.edit; box(P.x, P.y, P.w, P.h, COL.bg, null); ctx.fillStyle = COL.line; ctx.fillRect(P.x, P.y, 1, P.h);
    const x0 = P.x + 3, w = P.w - 5; let y = P.y + 3;
    if (!E.on) {
      if (TOUCH_DEV()) btn(P.x + 4, P.y + 100, P.w - 8, 76, { hold: true, name: 'jump', primary: true, label: 'はばたき', size: 12 });
      else { ['キー操作', '← → 移動', 'Z / Space', 'はばたき', '空中で押し', '続けると', 'ふわり', 'E 編集', 'R やりなおし'].forEach((t, i) => drawText(t, x0 + 2, y + 2 + i * 12, i === 0 ? COL.green : COL.text, 10)); }
      return;
    }
    UI.toolsOfTab(E.tab).forEach((t, i) => { btn(x0, y, w, 15, { sel: E.tool === t.id && !E.pan, left: true, label: (w < 90 ? '' : (i + 1) + ' ') + t.name, right: String(t.cost), fn: () => UI.pickTool(t.id) }); y += 16; });
    y += 2; const o = E.opts, id = E.tool;
    const chipRow = (items) => { let cx = x0; for (const it of items) { const cw = it.color !== undefined ? 14 : textW(it.label, 10) + 8; if (cx + cw > x0 + w) { cx = x0; y += 15; } if (it.color !== undefined) { btn(cx, y, cw, 13, { sel: it.sel, fn: it.fn, label: COLORS[it.color].n }); box(cx + 2, y + 2, cw - 4, 9, COLORS[it.color].hex, '#404040'); } else btn(cx, y, cw, 13, { sel: it.sel, label: it.label, fn: it.fn }); cx += cw + 2; } y += 15; };
    if (id === 'transform') chipRow([{ v: 'flipH', label: '左右反転' }, { v: 'flipV', label: '上下反転' }, { v: 'rot', label: '回転90°' }].map(it => ({ ...it, sel: o.tf === it.v, fn: () => { o.tf = it.v; } })));
    else if (id === 'sort') chipRow([{ v: 'L', label: '←寄せ' }, { v: 'R', label: '寄せ→' }, { v: 'U', label: '↑寄せ' }, { v: 'D', label: '寄せ↓' }].map(it => ({ ...it, sel: o.sort === it.v, fn: () => { o.sort = it.v; } })));
    else if (id === 'filter') { drawText('残す色', x0, y, COL.sub, 10); y += 12; chipRow(COLORS.map((c, i) => ({ color: i, sel: G.filter === i, fn: () => { runPlan(planFor('filter', { fcolor: i })); } })).concat([{ label: '解除', sel: G.filter === null, fn: () => { runPlan(planFor('filter', { fcolor: null })); } }])); }
    // 説明は、のこりの高さに入るだけ(下から)
    y += 3; const room = Math.floor((P.y + P.h - 3 - y - 4) / 11); let note = wrapText(editHelp(), w - 6, 10);
    if (note.length > room) { note = note.slice(0, Math.max(1, room)); note[note.length - 1] = note[note.length - 1].slice(0, -1) + '…'; }
    const nh = note.length * 11 + 4; box(x0, y, w, nh, COL.note, '#000000'); note.forEach((t, i) => drawText(t, x0 + 3, y + 2 + i * 11, '#000000', 10));
  }
  function drawToastAndName() {
    if (UI.toastT > 0 && !G.edit.on && UI.toastMsg) {
      const lines = wrapText(UI.toastMsg, W - 18, 10), bh = lines.length * 11 + 6, bw = Math.min(W - 6, Math.max(...lines.map(l => textW(l, 10))) + 10), bx = SX + ((W - bw) >> 1), by = SY + 4;
      box(bx, by, bw, bh, COL.note, '#000000'); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(bx + 2, by + bh, bw, 2); lines.forEach((l, i) => drawText(l, bx + 5, by + 3 + i * 11, '#000000', 10));
    }
    if (window.__noName) return;
    const nm = G.level.id + ' ' + G.level.name, nw = textW(nm, 10) + 10; box(SX, SY + H - 14, nw, 14, '#FFFFFF', COL.line); ctx.fillStyle = COL.green; ctx.fillRect(SX, SY + H - 14, nw, 2); drawText(nm, SX + 5, SY + H - 11, COL.green, 10);
  }
  // ---- 遊ぶ画面(ウィンドウ全体) ----
  function drawPlayWindow() {
    drawRibbonPlay();
    ctx.save(); ctx.translate(SX, SY); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip(); renderSheet(); ctx.restore();
    drawPane(); drawToastAndName();
  }
  // ---- メニューの画面 ----
  function sheetBg() { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, MY, VIEW.w, VIEW.h - MY); ctx.fillStyle = '#E1E1E1'; for (let x = 0; x < VIEW.w; x += 16) ctx.fillRect(x, MY, 1, VIEW.h - MY); for (let y = MY; y < VIEW.h; y += 16) ctx.fillRect(0, y, VIEW.w, 1); }
  function drawTitle() {
    drawRibbonBase('ゲコ＆エナー v2'); sheetBg(); const cx = VIEW.w >> 1, P = VIEW.portrait, top = MY + (P ? 40 : 2), gap = P ? 1 : 0;
    const tw = textW('ゲコ＆エナー', 12, 3); drawText('ゲコ＆エナー', cx - (tw >> 1), top + 2, COL.green, 12, 3);
    const sub = P ? '時間を止めて、世界を直しながら進む' : '時間を止めて、世界を直しながら進む　アクション・パズル', sw = textW(sub, 10); drawText(sub, cx - (sw >> 1), top + 42, COL.sub, 10);
    if (P) { const s2 = 'アクション・パズル'; drawText(s2, cx - (textW(s2, 10) >> 1), top + 54, COL.sub, 10); }
    const bw = 130; let y = top + (P ? 76 : 58);
    btn(cx - (bw >> 1), y, bw, 22, { primary: true, label: 'あそぶ', size: 12, fn: () => { audio(); UI.select(); } }); y += P ? 30 : 26;
    btn(cx - (bw >> 1), y, bw, 16, { label: 'ブロックのずかん', fn: () => openGuide('title') }); y += P ? 22 : 19;
    btn(cx - (bw >> 1), y, bw, 16, { label: 'ステージ作成(テスト用)', fn: () => { location.href = 'editor.html'; } }); y += P ? 24 : 21;
    const th = [['excel', 'Excel風', './'], ['snes', 'ソリッド版', '?gfx=snes'], ['classic', '元の絵', '?gfx=classic']]; let tx = cx - 100;
    th.forEach(([k, name, href]) => { btn(tx, y, 64, 14, { sel: THEME === k, label: name, fn: () => { location.href = href; } }); tx += 68; }); y += P ? 20 : 18;
    const old = '旧バージョン(Pyxel版)はこちら', ow = textW(old, 10); drawText(old, cx - (ow >> 1), y, COL.sub, 10); ctx.fillStyle = COL.sub; ctx.fillRect(cx - (ow >> 1), y + 10, ow, 1); UIC.hits.push({ x: cx - (ow >> 1), y: y - 2, w: ow, h: 14, type: 'tap', label: '旧バージョン', fn: () => { location.href = '../'; } });
  }
  function drawSelect() {
    drawRibbonBase('ステージえらび'); sheetBg(); const w = VIEW.w, port = VIEW.portrait, rowH = port ? 28 : 16, top = MY + 14, bot = VIEW.h - 19;
    btn(w - 62, 4, 58, 16, { label: '← もどる', fn: () => UI.title() }); btn(w - 112, 4, 46, 16, { label: 'ずかん', fn: () => openGuide('select') });
    box(0, MY, w, 14, '#E6E6E6', null); ctx.fillStyle = COL.line; ctx.fillRect(0, MY + 13, w, 1); drawText('ステージ', 6, MY + 2, COL.sub, 10); drawText('名前', 48, MY + 2, COL.sub, 10); if (!port) drawText('目標', 316, MY + 2, COL.sub, 10);
    const total = LEVELS.length * rowH, s = scrollRegion('sel', 0, top, w, bot - top, total);
    let perfect = 0, sigma = 0, sigmaAll = 0;
    ctx.save(); ctx.beginPath(); ctx.rect(0, top, w, bot - top); ctx.clip();
    LEVELS.forEach((lv, i) => {
      const sv = save.levels[lv.id], goals = sv ? sv.goals : [false, false, false], gots = gemsOf(lv, sv); if (goals[2]) perfect++; sigma += gots; sigmaAll += lv.gems.length;
      const y = top + i * rowH - s.off; if (y + rowH < top || y > bot) return;
      const hit = { x: 0, y, w: w - 5, h: rowH, type: 'tap', label: lv.id + ' ' + lv.name, fn: () => { audio(); UI.start(i); } }; UIC.hits.push(hit);
      ctx.fillStyle = UIC.press === hit ? '#CFE3D6' : (i % 2 ? '#F6F8FC' : '#FFFFFF'); ctx.fillRect(0, y, w - 5, rowH); ctx.fillStyle = '#E1E1E1'; ctx.fillRect(0, y + rowH - 1, w, 1);
      drawText(lv.id, 6, y + 3, COL.green, 10); drawText(lv.name, 48, y + 3, COL.text, 10);
      if (port) drawBadges(48, y + 15, goals, gots, lv.gems.length, 1); else drawBadges(w - 8 - badgesW(lv.gems.length, 1), y + 3, goals, gots, lv.gems.length, 1);
    });
    ctx.restore(); scrollbar(s, w - 4, top, bot - top, total);
    box(0, bot, w, VIEW.h - bot, COL.bg, null); ctx.fillStyle = COL.line; ctx.fillRect(0, bot, w, 1);
    drawText('ノーミス ' + perfect + '/' + LEVELS.length + '　Σ ' + sigma + '/' + sigmaAll, 6, bot + 5, COL.green, 10);
    btn(w - 148, bot + 2, 72, 15, { label: 'ステージ作成', fn: () => { location.href = 'editor.html'; } }); btn(w - 74, bot + 2, 70, 15, { label: 'セーブを消す', fn: () => { if (confirm('セーブデータを消しますか？')) { save = { levels: {}, muted }; persist(); } } });
  }
  let guideFrom = 'title', guideItems = null;
  function tileSample(draw) { const c = document.createElement('canvas'); c.width = 16; c.height = 16; const g2 = c.getContext('2d'); g2.imageSmoothingEnabled = false; const keep = ctx; ctx = g2; try { draw(); } finally { ctx = keep; } return c; }
  function buildGuide() {
    const blk = (c, alpha) => tileSample(() => drawBlock(TL.STONE, c, 0, 0, true, true, alpha, 0));
    const it = [['h', '色つきブロック（編集で色を変えられる）']];
    COLORS.forEach((k, i) => it.push([blk(i), k.n + 'ブロック', k.fx]));
    it.push([tileSample(() => drawBlock(TL.GLASSED, 3, 0, 0, true, true, undefined, 0)), '元ガラス（書式をつけたガラス）', '書式のコピーで色をつけたガラス。色の性質はふつうのブロックと同じで、白い「つやの枠」が残るので、元ガラスだと分かる。もう一度は書式をつけられない']);
    it.push(['h', 'そのほかの地形']);
    it.push([tileSample(() => ctx.drawImage(GFX.metal(), 0, 0)), '鋼（はがね）', '編集できない金属の壁・床・天井。どの道具も効かない']);
    it.push([tileSample(() => drawBlock(TL.CRACK, 0, 0, 0, true, true, undefined, 0)), 'ひび割れ壁', '黄ブロックと同じ（乗るとくずれる）。編集の対象']);
    it.push(['h', '編集のしるし']);
    it.push([tileSample(() => { const keep = G.lifts; G.lifts = [{ x: 0, y: 0, w: 16, h: 16, vert: true }]; try { drawLifts(0, 0); } finally { G.lifts = keep; } }), 'リフト', '決まった道（うすく見える道）を、一定の周期で往復する足場。乗ると運ばれる。編集では動かせず、道にブロックを置くこともできない。リフトにも色（性質）があり、フィルターで消せる（うすくなって通りぬけられる）。ガラスのリフトは、書式のコピーで色をつけられる']);
    it.push([tileSample(() => { drawBlock(TL.STONE, 0, 0, 0, true, true, undefined, 0); if (SOLID) ctx.drawImage(GFX.lock(), 8, 1); else { ctx.fillStyle = '#1F2A44'; ctx.fillRect(9, 1, 6, 7); icon(LOCK, 10, 2, '#F5C842'); } }), 'カギ（保護）', '保護されたブロック。どの編集も受けず、フィルターでも消えない。寄せるときの仕切りになる。「保護の解除」で外せる']);
    it.push([blk(0, .28), 'うすい表示', 'フィルター中。選んだ色以外のブロック（ガラスも）は、うすくなって通りぬけられる']);
    return it;
  }
  function openGuide(from) { guideFrom = from; G.mode = 'guide'; guideItems = buildGuide(); (UIC.scroll.guide || (UIC.scroll.guide = { off: 0 })).off = 0; }
  function drawGuide() {
    drawRibbonBase('ブロックのずかん'); sheetBg(); const w = VIEW.w, top = MY, bot = VIEW.h;
    btn(w - 62, 4, 58, 16, { label: '← もどる', fn: () => (guideFrom === 'select' ? UI.select() : UI.title()) });
    const tw = w - 52, lay = guideItems.map(it => (it[0] === 'h' ? { h: 16 } : { lines: wrapText(it[2], tw, 10), h: 0 })); lay.forEach(l => { if (l.lines) l.h = Math.max(38, 16 + l.lines.length * 11 + 4); });
    const total = lay.reduce((a, l) => a + l.h, 0) + 6, s = scrollRegion('guide', 0, top, w, bot - top, total); let y = top + 3 - s.off;
    ctx.save(); ctx.beginPath(); ctx.rect(0, top, w, bot - top); ctx.clip();
    guideItems.forEach((it, i) => {
      const l = lay[i];
      if (it[0] === 'h') { drawText(it[1], 6, y + 3, COL.green, 10); ctx.fillStyle = COL.green; ctx.fillRect(6, y + 14, w - 18, 1); }
      else { box(4, y, w - 12, l.h - 3, '#FFFFFF', COL.line); ctx.imageSmoothingEnabled = false; ctx.drawImage(it[0], 8, y + 3, 32, 32); box(8, y + 3, 32, 32, null, '#ABABAB'); drawText(it[1], 46, y + 3, COL.text, 10); l.lines.forEach((t, k) => drawText(t, 46, y + 15 + k * 11, COL.sub, 10)); }
      y += l.h;
    });
    ctx.restore(); scrollbar(s, w - 4, top, bot - top, total);
  }
  function drawResult() {
    drawRibbonBase('クリア'); sheetBg(); const goals = UI.result || [true, false, false], lv = G.level, cx = VIEW.w >> 1, top = MY + (VIEW.portrait ? 30 : 4);
    const t = 'クリア！', tw = textW(t, 12, 2); drawText(t, cx - (tw >> 1), top + 4, COL.green, 12, 2);
    const n = lv.gems.length, bw = badgesW(n, 2); drawBadges(cx - (bw >> 1), top + 36, goals, G.gems, n, 2);
    const info = 'Σ ' + G.gems + '/' + n + '　タイム ' + G.time.toFixed(1) + '秒　ダメージ ' + G.hits + '回'; drawText(info, cx - (textW(info, 10) >> 1), top + 64, COL.text, 10);
    const tips = []; if (!goals[1] && n) tips.push('Σを3つぜんぶ集める'); if (!goals[2]) tips.push('ノーミス（ダメージを受けない）でクリア'); const tip = tips.length ? tips.join('　') : 'パーフェクト！';
    wrapText(tip, VIEW.w - 20, 10).forEach((l, i) => drawText(l, cx - (textW(l, 10) >> 1), top + 80 + i * 11, COL.sub, 10));
    const last = G.levelIdx >= LEVELS.length - 1, bwid = 140; let y = top + 106;
    btn(cx - (bwid >> 1), y, bwid, 22, { primary: true, label: last ? 'ステージえらびへ' : '次のステージへ', size: 12, fn: () => { if (last) UI.select(); else UI.start(G.levelIdx + 1); } }); y += 27;
    btn(cx - 71, y, 68, 16, { label: 'もう一度', fn: () => UI.start(G.levelIdx) }); btn(cx + 3, y, 68, 16, { label: 'ステージえらび', fn: () => UI.select() });
  }
  function render() {
    if (!G.level) return; ctx.setTransform(VIEW.k || 1, 0, 0, VIEW.k || 1, 0, 0); ctx.imageSmoothingEnabled = false;
    UIC.hits.length = 0; ctx.fillStyle = '#D9D9D9'; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    if (G.mode === 'play') drawPlayWindow(); else if (G.mode === 'title') drawTitle(); else if (G.mode === 'select') drawSelect(); else if (G.mode === 'guide') drawGuide(); else if (G.mode === 'result') drawResult();
  }
  // ===== 拡大表示 =====
  // ウィンドウ全体(リボン・シート・ペイン)を、画面にあわせて拡大する。シートは、いつも320×180(マス目の世界)。
  function fit() {
    const wrap = $('#stage'), vw = wrap.clientWidth, vh = wrap.clientHeight, portrait = vw < vh;
    const LPW = 48, RPW = 80, RH = portrait ? MY : 15; let LW = portrait ? W : LPW + W + RPW, LH = RH + H, ph = 0;
    let s = Math.min(vw / LW, vh / (portrait ? LH + 90 : LH)); if (s >= 2) s = Math.floor(s); // 整数倍に、ぴったり入れる(ドット文字を読みやすく)
    if (portrait) { ph = Math.max(90, Math.min(300, Math.floor(vh / s) - RH - H)); LH = RH + H + ph; if (LH * s > vh) s = vh / LH; }
    Object.assign(VIEW, { w: LW, h: LH, portrait, ph, s }); SX = portrait ? 0 : LPW; SY = RH;
    const k = Math.max(1, Math.min(6, Math.round(s * (window.devicePixelRatio || 1)))); VIEW.k = k; // 文字をくっきり描くため、実際の画素にあわせた解像度で描く
    if (cv.width !== LW * k || cv.height !== LH * k) { cv.width = LW * k; cv.height = LH * k; ctx.imageSmoothingEnabled = false; }
    cv.style.width = LW * s + 'px'; cv.style.height = LH * s + 'px';
    $('#game').style.width = LW * s + 'px'; $('#game').style.height = LH * s + 'px';
  }
  addEventListener('resize', fit); fit();

  // ===== メインループ =====
  let last = performance.now(), acc = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    if (G.paused) { last = now; return; }
    acc += Math.min(.1, (now - last) / 1000); UI.toastT = Math.max(0, UI.toastT - Math.min(.1, (now - last) / 1000)); last = now;
    while (acc >= DT) { update(DT); acc -= DT; }
    render();
  }
  loadLevel(0); render(); UI.title();
  { // ?test=ID : ステージ作成ページからのテストプレイ
    const m = /[?&]test=([^&]+)/.exec(location.search);
    if (m) { const i = LEVELS.findIndex(l => l.id === decodeURIComponent(m[1])); if (i >= 0) { audio(); UI.start(i); } }
  }
  requestAnimationFrame(loop);

  // ===== テスト用の口(自動プレイが使う) =====
  window.__geko = {
    G, input, press, update, render, UI, hits: () => UIC.hits.map(h => ({ type: h.type, label: h.label, x: h.x, y: h.y, w: h.w, h: h.h })), VIEW, LEVELS, T, TL, COLORS, TOOLS, setEdit, undoEdit, redoEdit, runPlan, planFor, normRect,
    // 自動プレイ・テスト用: {tool, rect, dst, srcCell, col, opts} を指定して、実際の編集と同じ処理を行う
    runTool(spec) {
      const E = G.edit; E.tool = spec.tool; Object.assign(E.opts, spec.opts || {});
      const plan = planFor(spec.tool, { rect: spec.rect, dst: spec.dst, srcCell: spec.srcCell, col: spec.col, fcolor: spec.fcolor });
      const ok = runPlan(plan); return { ok, msg: ok ? '' : (plan.msg || E.msg) };
    },
    step(n) { for (let i = 0; i < n; i++) update(DT); },
    start(i) { UI.start(i); G.paused = true; },
  };
})();

