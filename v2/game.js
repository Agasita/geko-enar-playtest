/* ゲコ＆エナー v2 — 本体。320x180 のドットを整数倍に拡大して表示する(すべてのドットが同じ大きさ)。 */
(function () {
  'use strict';
  const W = 320, H = 180, T = 16, DT = 1 / 60;
  const TL = { EMPTY: 0, STONE: 1, STEEL: 2, CRACK: 3, SPIKE: 5 };
  const CH2TILE = { '.': 0, '#': 1, 'S': 2, 'c': 3, '^': 5 };
  // ブロックの色(＝Excelのセルの色)。色には性質がある。
  const COLORS = [
    { n: '灰', hex: '#C9A15E', hi: '#E8CFA0', lo: '#735630', fx: 'ふつう' },
    { n: '赤', hex: '#E8563F', hi: '#F7A08F', lo: '#A8403F', fx: 'あつい（さわるとダメージ）' },
    { n: '青', hex: '#6FD6E8', hi: '#D5F6FC', lo: '#3F9DB5', fx: 'すべる（氷）' },
    { n: '緑', hex: '#58B368', hi: '#8FD18A', lo: '#3F8F52', fx: 'はずむ（ばね）' },
    { n: '黄', hex: '#F5C842', hi: '#FFE27A', lo: '#C99A1E', fx: 'もろい（攻撃・ダッシュで壊れる）' },
  ];
  const TABS = [{ id: 'home', name: 'ホーム' }, { id: 'cell', name: 'セル' }, { id: 'data', name: 'データ' }, { id: 'view', name: '表示' }];
  // Excelの機能を、世界の編集に転用した道具。何もないところにブロックは生まれない(動かす・並べる・色・隠す・消す、だけ)。
  const TOOLS = [
    { id: 'move', tab: 'home', name: '切り取り→貼り付け', mode: 'two', cost: 8, help: '①動かす範囲をドラッグ → ②行き先（左上）をタップ' },
    { id: 'swap', tab: 'home', name: '入れ替え', mode: 'two', cost: 8, help: '①範囲Aをドラッグ → ②入れ替え先（左上）をタップ' },
    { id: 'clear', tab: 'home', name: '内容の消去', mode: 'rect', cost: 2, help: '範囲のブロックを消す（Delete）' },
    { id: 'color', tab: 'home', name: '塗りつぶし', mode: 'rect', cost: 3, help: '範囲のブロックを選んだ色にする。色には性質がある' },
    { id: 'painter', tab: 'home', name: '書式のコピー', mode: 'painter', cost: 2, help: '①まねしたいブロックをタップ → ②範囲をドラッグ' },
    { id: 'transform', tab: 'cell', name: '変形', mode: 'rect', cost: 8, help: '範囲のブロックを反転・回転・転置（回転と転置は正方形）' },
    { id: 'insCol', tab: 'cell', name: '列の挿入', mode: 'col', cost: 12, help: '列をタップ → その手前に空の列を入れる（右が1つずれる）' },
    { id: 'delCol', tab: 'cell', name: '列の削除', mode: 'col', cost: 10, help: '列をタップ → その列を消して左に詰める（穴がせまくなる）' },
    { id: 'sort', tab: 'data', name: '並べ替え', mode: 'rect', cost: 10, help: '範囲の各行・各列を並べ替える（寄せる／色の順）' },
    { id: 'filter', tab: 'data', name: 'フィルター', mode: 'instant', cost: 8, help: '色を選ぶ → その色のブロックだけが残り、他は通りぬけられる' },
    { id: 'replace', tab: 'data', name: '置換', mode: 'rect', cost: 6, help: '範囲の「から」の色を「へ」の色に置き換える' },
    { id: 'hide', tab: 'view', name: '行・列の非表示', mode: 'rect', cost: 6, help: '範囲がかかる行（または列）を隠す。隠した行・列のブロックと敵は通りぬけられる' },
    { id: 'unhide', tab: 'view', name: '再表示', mode: 'instant', cost: 3, help: '隠した行・列を、すべて元にもどす' },
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
  const cv = $('#cv'), ctx = cv.getContext('2d');
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

  // ===== 状態 =====
  const G = {
    mode: 'title', level: null, levelIdx: 0, paused: false, t: 0, frame: 0,
    front: null, back: null, p: null, enemies: [], bullets: [], parts: [], pick: [], checks: [], flag: null,
    cam: { x: 0, y: 0 }, shake: 0, hitstop: 0, energy: 0, gems: 0, deaths: 0, hits: 0, time: 0,
    edit: null,
    hintShown: {}, respawn: null, flash: 0,
  };
  const input = { left: false, right: false, down: false, up: false, jumpHeld: false, jumpP: false, atkP: false, dashP: false, editP: false };

  // ===== レベル読み込み =====
  function loadLevel(i) {
    const lv = LEVELS[i]; G.levelIdx = i; G.level = lv;
    G.front = lv.front.map(r => Array.from(r).map(c => CH2TILE[c] || 0));
    G.col = lv.color.map(r => r.slice()); G.lock = lv.lock.map(r => r.slice());
    G.hideRow = new Set(); G.hideCol = new Set(); G.filter = null; G.regen = lv.regen || 1.2;
    G.enemies = lv.ents.map((e, k) => makeEnemy(e, k));
    G.pick = [];
    lv.gems.forEach((g, k) => G.pick.push({ type: 'gem', x: g[0] * T + 4, y: g[1] * T + 4, w: 8, h: 8, k, got: false }));
    lv.sparks.forEach((g, k) => G.pick.push({ type: 'spark', x: g[0] * T + 4, y: g[1] * T + 4, w: 8, h: 8, k, got: false }));
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
  const isBlockT = (t) => t === TL.STONE || t === TL.CRACK;
  // 行・列の非表示とフィルターの結果、いま実際に「ある」ブロックか
  function blockVisible(tx, ty) { if (G.hideRow.has(ty) || G.hideCol.has(tx)) return false; return G.filter === null || G.col[ty][tx] === G.filter; }
  function solidCell(tx, ty) {
    if (tx < 0 || tx >= G.level.w || ty < 0) return true; if (ty >= G.level.h) return false;
    const t = G.front[ty][tx]; if (t === TL.STEEL) return true;
    return isBlockT(t) && blockVisible(tx, ty);
  }
  function colorAt(tx, ty) { return inb(tx, ty) && isBlockT(G.front[ty][tx]) && blockVisible(tx, ty) ? G.col[ty][tx] : -1; }
  const isFragile = (tx, ty) => { if (!inb(tx, ty) || !blockVisible(tx, ty)) return false; const t = G.front[ty][tx]; return t === TL.CRACK || (t === TL.STONE && G.col[ty][tx] === 4); };
  function boxHitsSolid(x, y, w, h) {
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
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir && p.stun <= 0) p.face = dir;
    // 接地判定
    p.wasGround = p.ground;
    p.ground = boxHitsSolid(p.x, p.y + 1, p.w, p.h) && p.vy >= 0;
    if (p.ground) { p.coyote = .1; p.dashAvail = true; } else p.coyote -= dt;
    if (input.jumpP) p.jbuf = .11; else p.jbuf -= dt;
    // 足もとの色(青=氷)
    let onIce = false;
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
    // 攻撃
    if (input.atkP && p.atkCd <= 0 && p.stun <= 0) { p.atkT = .22; p.atkCd = .3; p.atkHit = new Set(); p.pogo = input.down && !p.ground; SFX.swing(); }
    if (p.atkT > 0) { p.atkT -= dt; if (p.atkT < .17 && p.atkT > .05) doAttack(); }
    // 移動と衝突(x→y)
    moveX(p, p.vx * dt); moveY(p, p.vy * dt);
    // 着地
    p.ground = boxHitsSolid(p.x, p.y + 1, p.w, p.h) && p.vy >= 0;
    if (p.ground && !p.wasGround) { p.squash = .3; SFX.land(); spawnParts(p.x + 5, p.y + 14, 3, '#fff', 20); }
    // 緑のブロック=ばね
    if (p.ground && p.vy >= 0) {
      const ty = Math.floor((p.y + p.h + 1) / T), tx0 = Math.floor(p.x / T), tx1 = Math.floor((p.x + p.w - 1) / T);
      for (let tx = tx0; tx <= tx1; tx++) if (colorAt(tx, ty) === 3) { p.vy = -BOUNCE; p.free = true; p.ground = false; p.coyote = 0; p.squash = -.4; SFX.bounce(); spawnParts(p.x + 5, p.y + 14, 8, '#8FD18A', 40); break; }
    }
    // 赤いブロック=あつい(さわるとダメージ)
    for (let ty = Math.floor((p.y - 1) / T); ty <= Math.floor((p.y + p.h) / T); ty++) for (let tx = Math.floor((p.x - 1) / T); tx <= Math.floor((p.x + p.w) / T); tx++)
      if (colorAt(tx, ty) === 1 && overlap(p.x - 1, p.y - 1, p.w + 2, p.h + 2, tx * T, ty * T, T, T)) hurtPlayer(null, false);
    // トゲ
    const sx0 = Math.floor(p.x / T), sx1 = Math.floor((p.x + p.w - 1) / T), sy0 = Math.floor((p.y + 6) / T), sy1 = Math.floor((p.y + p.h - 1) / T);
    for (let ty = sy0; ty <= sy1; ty++) for (let tx = sx0; tx <= sx1; tx++) if (tileAt(tx, ty) === TL.SPIKE && !G.hideRow.has(ty) && !G.hideCol.has(tx) && p.y + p.h > ty * T + 8) hurtPlayer(null, true);
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
    if (e.hp <= 0) { e.dead = true; spawnParts(e.x + e.w / 2, e.y + e.h / 2, 14, '#F5C842', 90); G.pick.push({ type: 'spark', x: e.x + 2, y: e.y + 2, w: 8, h: 8, got: false, drop: true }); }
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
        else if (p.vy > 60 && p.y + p.h - 6 < e.y + 4 && e.type !== 'turret') { damageEnemy(e, 1); p.vy = -240; p.free = true; p.dashAvail = true; } // ふみつけ
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
        if (k.type === 'gem') { G.gems++; SFX.gem(); spawnParts(k.x + 4, k.y + 4, 10, '#7FA2F0', 70); }
        else { G.energy = Math.min(100, G.energy + 15); SFX.spark(); spawnParts(k.x + 4, k.y + 4, 5, '#F5C842', 40); }
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
    // ★は3つの目標。それぞれ別に記録する: ①クリア ②宝石を全部 ③ノーダメージ
    const goals = [true, G.gems >= G.level.gems.length, G.deaths === 0 && G.hits === 0];
    const prev = save.levels[G.level.id] || { goals: [false, false, false] };
    const merged = goals.map((v, i) => v || !!(prev.goals && prev.goals[i]));
    save.levels[G.level.id] = { goals: merged, time: Math.min(prev.time || 1e9, Math.round(G.time * 10) / 10) };
    persist(); G.lastGoals = goals;
    setTimeout(() => { if (G.cleared) UI.showResult(goals); }, 800);
  }
  const starCount = (s) => (s && s.goals ? s.goals.filter(Boolean).length : 0);
  const pips = (goals) => goals.map(v => (v ? '★' : '☆')).join('');

  // ===== 編集(Excelのしくみ) =====
  const key = (x, y) => x + ',' + y;
  const isBlk = (x, y) => isBlockT(G.front[y][x]);
  const isFixedCell = (x, y) => { const t = G.front[y][x]; return t === TL.STEEL || t === TL.SPIKE || !!G.lock[y][x]; }; // 鋼・トゲ・保護されたブロック
  const isMovable = (x, y) => isBlk(x, y) && !G.lock[y][x];
  function actorRects() {
    const r = [{ x: G.p.x, y: G.p.y, w: G.p.w, h: G.p.h }];
    for (const e of G.enemies) if (!e.dead) r.push({ x: e.x, y: e.y, w: e.w, h: e.h });
    return r;
  }
  function cellBlocked(tx, ty) { // 人や敵と重なるマスには、ブロックを置けない
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
      if (cellBlocked(tx, ty)) return fail('キャラクターと重なります', { rects: [rect], ghost });
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
      if (G.front[ay][ax] !== 0 && cellBlocked(bx, by)) return fail('キャラクターと重なります', { rects: [a, b] });
      if (G.front[by][bx] !== 0 && cellBlocked(ax, ay)) return fail('キャラクターと重なります', { rects: [a, b] });
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
  function planColor(r, c, id) {
    const cells = []; rectEach(r, (x, y) => { if (isMovable(x, y) && G.col[y][x] !== c) cells.push([x, y]); });
    if (!cells.length) return fail('色を変えられるブロックがありません', { rects: [r] });
    return { ok: true, cost: costOf(id), rects: [r], hl: cells, run() { for (const [x, y] of cells) G.col[y][x] = c; } };
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
      if (cellBlocked(c.tx, c.ty)) return fail('キャラクターと重なります', { rects: [r] });
      if (c.tx !== c.x || c.ty !== c.y) changed = true;
    }
    if (!changed) return fail('変形しても同じです', { rects: [r] });
    return { ok: true, cost: costOf('transform'), rects: [r], ghost: cells.map(c => ({ x: c.tx, y: c.ty, t: c.t, c: c.c })), run() {
      for (const c of cells) { G.front[c.y][c.x] = 0; G.col[c.y][c.x] = 0; }
      for (const c of cells) { G.front[c.ty][c.tx] = c.t; G.col[c.ty][c.tx] = c.c; }
    } };
  }
  function planSort(r, dir) {
    const horiz = dir === 'L' || dir === 'R' || dir === 'CR';
    const lines = horiz ? r.y1 - r.y0 + 1 : r.x1 - r.x0 + 1, len = horiz ? r.x1 - r.x0 + 1 : r.y1 - r.y0 + 1;
    const assign = []; // {x,y,t,c}
    const barrier = (x, y) => (G.front[y][x] !== 0 && isFixedCell(x, y)) || cellBlocked(x, y);
    for (let i = 0; i < lines; i++) {
      const coords = []; for (let k = 0; k < len; k++) coords.push(horiz ? [r.x0 + k, r.y0 + i] : [r.x0 + i, r.y0 + k]);
      let seg = [];
      const flush = () => {
        if (seg.length) {
          const blocks = seg.filter(([x, y]) => isMovable(x, y)).map(([x, y]) => ({ x, y, t: G.front[y][x], c: G.col[y][x] }));
          if (dir === 'CR' || dir === 'CC') {
            const cs = blocks.map(b => b.c).sort((p, q) => p - q);
            blocks.forEach((b, k) => assign.push({ x: b.x, y: b.y, t: b.t, c: cs[k] }));
          } else {
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
      case 'move': return planMove(a.rect, a.dst[0], a.dst[1]);
      case 'swap': return planSwap(a.rect, a.dst[0], a.dst[1]);
      case 'clear': return planClear(a.rect);
      case 'color': return planColor(a.rect, o.color, 'color');
      case 'painter': { const [sx, sy] = a.srcCell; if (!inb(sx, sy) || !isBlk(sx, sy)) return fail('まねするブロックがありません'); return planColor(a.rect, G.col[sy][sx], 'painter'); }
      case 'transform': return planTransform(a.rect, o.tf);
      case 'insCol': return planInsCol(a.col);
      case 'delCol': return planDelCol(a.col);
      case 'sort': return planSort(a.rect, o.sort);
      case 'filter': return planFilter(a.fcolor !== undefined ? a.fcolor : o.fcolor);
      case 'replace': return planReplace(a.rect, o.from, o.to);
      case 'hide': return planHide(a.rect, o.axis);
      case 'unhide': return planUnhide();
      case 'protect': return planProtect(a.rect, true);
      case 'unprotect': return planProtect(a.rect, false);
    }
    return fail('この道具は使えません');
  }

  // ---- 実行・元に戻す・やり直す(状態をまるごと保存する) ----
  function snapshot() {
    return {
      front: G.front.map(r => r.slice()), col: G.col.map(r => r.slice()), lock: G.lock.map(r => r.slice()),
      hideRow: [...G.hideRow], hideCol: [...G.hideCol], filter: G.filter,
      en: G.enemies.map(e => ({ e, x: e.x, y: e.y, bx: e.bx, dead: e.dead })), pick: G.pick.map(k => ({ k, x: k.x, gone: !!k.gone })),
      checks: G.checks.map(c => ({ c, x: c.x, gone: !!c.gone })), flagX: G.flag.x, resp: { x: G.respawn.x, y: G.respawn.y }, px: G.p.x,
    };
  }
  function restoreSnap(s) {
    G.front = s.front.map(r => r.slice()); G.col = s.col.map(r => r.slice()); G.lock = s.lock.map(r => r.slice());
    G.hideRow = new Set(s.hideRow); G.hideCol = new Set(s.hideCol); G.filter = s.filter;
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
    plan.run(); G.energy -= plan.cost; E.msg = ''; SFX.place(); G.shake = 1;
    return true;
  }
  function undoEdit() {
    const E = G.edit, u = E.undo.pop(); if (!u) { SFX.bad(); return; }
    E.redo.push({ state: snapshot(), cost: u.cost }); restoreSnap(u.state); G.energy = Math.min(100, G.energy + u.cost); SFX.place(); E.step = 0; E.src = null; E.msg = '';
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
    if (on) { SFX.editOn(); E.cursor = [Math.floor((G.p.x + 5) / T), Math.floor((G.p.y + 7) / T)]; G.cam.x = clamp(G.cam.x + 30, 0, G.level.w * T - W); } else SFX.editOff();
    $('#editbar').classList.toggle('hide', !on); $('#touch').classList.toggle('hide', on); document.body.classList.toggle('editing', on); UI.refreshTools();
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
    if (G.edit.on) { G.frame++; return; }
    if (G.hitstop > 0) { G.hitstop -= dt; return; }
    G.frame++; G.t += dt;
    if (!G.cleared) G.time += dt;
    updatePlayer(dt); updateEnemies(dt); updatePickups();
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
  function drawBackground() {
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
  function drawBlock(t, c, x, y, topOpen, botOpen, alpha) {
    const k = COLORS[c] || COLORS[0];
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.fillStyle = k.hex; ctx.fillRect(x, y, T, T);
    if (topOpen) { ctx.fillStyle = k.hi; ctx.fillRect(x, y, T, 2); }
    if (botOpen) { ctx.fillStyle = k.lo; ctx.fillRect(x, y + T - 3, T, 3); }
    if (c === 3) { ctx.fillStyle = '#fff'; ctx.fillRect(x + 4, y + 6, 2, 2); ctx.fillRect(x + 7, y + 4, 2, 2); ctx.fillRect(x + 10, y + 6, 2, 2); }
    else if (c === 2) { ctx.fillStyle = k.hi; ctx.fillRect(x + 3, y + 5, 5, 1); ctx.fillRect(x + 6, y + 9, 6, 1); }
    else if (c === 1) { ctx.fillStyle = k.lo; ctx.fillRect(x + 3, y + 4, 2, 3); ctx.fillRect(x + 7, y + 6, 2, 4); ctx.fillRect(x + 11, y + 4, 2, 3); }
    if (c === 4 || t === TL.CRACK) { ctx.fillStyle = k.lo; ctx.fillRect(x + 7, y + 2, 2, 4); ctx.fillRect(x + 5, y + 6, 2, 4); ctx.fillRect(x + 9, y + 9, 2, 4); }
    ctx.globalAlpha = 1;
  }
  function drawTile(t, x, y, tx, ty) {
    if (isBlockT(t)) {
      if (G.hideRow.has(ty) || G.hideCol.has(tx)) return;
      const faded = G.filter !== null && G.col[ty][tx] !== G.filter;
      drawBlock(t, G.col[ty][tx], x, y, !solidCell(tx, ty - 1), !solidCell(tx, ty + 1), faded ? .28 : undefined);
      if (G.lock[ty][tx]) { ctx.fillStyle = '#1F2A44'; ctx.fillRect(x + 9, y + 1, 6, 7); icon(LOCK, x + 10, y + 2, '#F5C842'); }
    } else if (t === TL.STEEL) {
      ctx.fillStyle = TC.steel; ctx.fillRect(x, y, T, T);
      if (!solidCell(tx, ty - 1)) { ctx.fillStyle = TC.steelL; ctx.fillRect(x, y, T, 2); }
      if (!solidCell(tx, ty + 1)) { ctx.fillStyle = TC.steelD; ctx.fillRect(x, y + T - 3, T, 3); }
      ctx.fillStyle = TC.steelD; ctx.fillRect(x + 3, y + 6, 2, 2); ctx.fillRect(x + 11, y + 6, 2, 2);
    } else if (t === TL.SPIKE) {
      if (G.hideRow.has(ty) || G.hideCol.has(tx)) return;
      ctx.fillStyle = '#D5DBE6';
      for (let i = 0; i < 4; i++) for (let j = 0; j < 8; j++) { const w = 4 - Math.floor(j / 2); ctx.fillRect(x + i * 4 + (4 - w) / 2, y + 8 + j, w, 1); }
    }
  }
  function drawWorld() {
    const lv = G.level, cx = Math.round(G.cam.x + (G.shake ? (Math.random() - .5) * G.shake : 0)), cy = Math.round(G.cam.y);
    const x0 = Math.max(0, Math.floor(cx / T)), x1 = Math.min(lv.w - 1, Math.floor((cx + W) / T)), y0 = Math.max(0, Math.floor(cy / T)), y1 = Math.min(lv.h - 1, Math.floor((cy + H) / T));
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) { const t = G.front[ty][tx]; if (t) drawTile(t, tx * T - cx, ty * T - cy, tx, ty); }
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
      if (k.type === 'gem') icon(GEM, x + 1, y + 1, '#4C9BE8', '#BFD8FF'); else icon(BOLT, x + 1, y + 1, '#F5C842');
    }
    // 敵
    for (const e of G.enemies) {
      if (e.dead || e.hidden) continue;
      const fr = Math.floor(e.t * 4) % 2, flip = e.dir > 0;
      const name = e.type === 'walker' ? 'walker' : e.type === 'guard' ? 'guard' : e.type === 'flyer' ? 'flyer' : 'turret';
      const s = sprite(name, name === 'guard' || name === 'turret' ? 0 : fr, flip);
      const x = Math.round(e.x - (e.ox || 0) - cx), y = Math.round(e.y - (e.oy || 0) - cy);
      if (e.flash > 0 && Math.floor(e.flash * 40) % 2) ctx.globalAlpha = .4; ctx.drawImage(s, x, y); ctx.globalAlpha = 1;
      if (e.type === 'guard') { ctx.fillStyle = '#4C9BE8'; ctx.fillRect(Math.round(e.x - cx) + (e.dir > 0 ? e.w - 1 : -3), Math.round(e.y - cy), 4, e.h); }
      if (e.type === 'turret' && e.tele) { ctx.fillStyle = '#FFE27A'; ctx.fillRect(Math.round(e.x - cx) + 4, Math.round(e.y - cy) - 4, 4, 2); }
    }
    for (const b of G.bullets) dotRect(b.x - cx, b.y - cy, 4, 4, '#E8563F');
    drawPlayer(cx, cy);
    for (const q of G.parts) dotRect(q.x - cx, q.y - cy, 2, 2, q.col);
    // 相棒エナー
    { const p = G.p, bx = Math.round(p.x - cx - p.face * 14 + Math.sin(G.t * 3) * 1), by = Math.round(p.y - cy - 12 + Math.sin(G.t * 4) * 2); ctx.drawImage(sprite('bird', 0, p.face < 0), bx, by); }
  }
  function drawPlayer(cx, cy) {
    const p = G.p; if (p.dead) return;
    if (p.inv > 0 && Math.floor(p.inv * 20) % 2) return;
    let name = 'idle0';
    if (p.stun > 0) name = 'hurt';
    else if (p.atkT > 0) name = p.atkT > .13 ? 'windup' : 'swing';
    else if (!p.ground) name = p.vy < -40 ? 'rise' : p.vy > 40 ? 'fall' : 'takeoff';
    else if (Math.abs(p.vx) > 25) name = ['walk0', 'walk1', 'walk2', 'walk3'][Math.floor(p.anim * 10) % 4];
    else name = Math.floor(G.t * 1.6) % 2 ? 'idle2' : 'idle0';
    const sq = p.squash, sx = 1 + Math.abs(sq) * .0, sy = 1;
    void sx; void sy;
    const x = Math.round(p.x - 3 - cx), y = Math.round(p.y - 2 - cy);
    ctx.drawImage(heroSprite(name, p.face > 0), x, y);
    if (p.dashT > 0) { ctx.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 1; i < 4; i++) ctx.fillRect(x + 3 - p.face * i * 6, y + 5, 6, 8); }
    if (p.atkT > 0) { // レンチの弧
      const b = attackBox(), prog = 1 - p.atkT / .22; ctx.fillStyle = '#D5DBE6';
      if (p.pogo) { ctx.fillRect(Math.round(b.x - cx) + 2, Math.round(b.y - cy), 8, 3 + Math.round(prog * 8)); }
      else { const len = Math.round(6 + prog * 14); ctx.fillRect(Math.round(p.face > 0 ? b.x - cx : b.x + b.w - cx - len), Math.round(b.y - cy) + 2, len, 3); ctx.fillStyle = '#93A0B8'; ctx.fillRect(Math.round(p.face > 0 ? b.x - cx + len - 3 : b.x + b.w - cx - len), Math.round(b.y - cy) + 2, 3, 10); }
    }
  }
  function drawHUD() {
    // ハート
    for (let i = 0; i < 3; i++) icon(HEART, 6 + i * 7, 6, i < G.p.hp ? '#E8563F' : '#2F3752');
    // エナジー(編集できないステージでは出さない)
    if (G.level.tools.length) {
    ctx.fillStyle = '#1F2A44'; ctx.fillRect(5, 15, 62, 7); ctx.fillStyle = '#5B6785'; ctx.fillRect(6, 16, 60, 5);
    ctx.fillStyle = G.energy < 20 ? '#E8563F' : '#F5C842'; ctx.fillRect(6, 16, Math.round(60 * G.energy / 100), 5);
    icon(BOLT, 70, 14, '#F5C842'); text(Math.floor(G.energy), 77, 16, '#fff'); }
    // 宝石
    const gy = G.level.tools.length ? 25 : 16;
    icon(GEM, 6, gy, '#4C9BE8', '#BFD8FF'); text(G.gems + '/' + G.level.gems.length, 13, gy + 1, '#fff');
    if (G.filter !== null) { icon(FUNNEL, 6, gy + 9, '#fff'); ctx.fillStyle = COLORS[G.filter].hex; ctx.fillRect(15, gy + 9, 6, 5); }
    text(Math.floor(G.time / 60) + ':' + String(Math.floor(G.time % 60)).padStart(2, '0'), 36, gy + 1, '#D5DBE6');
  }
  const FUNNEL = ['1111111', '.11111.', '..111..', '..111..', '...1...'];
  function drawEditOverlay() {
    const E = G.edit, cx = Math.round(G.cam.x), cy = Math.round(G.cam.y);
    ctx.fillStyle = 'rgba(31,42,68,.35)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.12)';
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
  function render() {
    if (!G.level) return;
    drawBackground(); drawWorld();
    if (G.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (G.flash * 1.2) + ')'; ctx.fillRect(0, 0, W, H); }
    if (G.edit.on) { drawEditOverlay(); UI.helpText(); }
    drawHUD();
    if (G.p.dead) { ctx.fillStyle = 'rgba(31,42,68,' + Math.min(.6, (0.7 - G.p.dead)) + ')'; ctx.fillRect(0, 0, W, H); }
  }

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
  // タッチボタン
  document.querySelectorAll('[data-btn]').forEach((b) => {
    const name = b.dataset.btn;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); audio(); b.setPointerCapture(e.pointerId); b.classList.add('on'); press(name, true); });
    const up = (e) => { b.classList.remove('on'); press(name, false); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  });
  // 編集: ポインタで範囲を選ぶ・タップする
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
    show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.add('hide')); if (id) $(id).classList.remove('hide'); },
    refresh() {
      const lv = G.level; $('#lvname').textContent = lv.id + ' ' + lv.name; $('#btn-edit').classList.toggle('hide', !lv.tools.length);
      UI.refreshTools();
    },
    helpText() { const E = G.edit, d = TOOL_BY[E.tool]; const t = E.pan ? 'ドラッグで画面を動かす' : (E.msg || E.hint || (d ? d.help : '')); const el = $('#edithelp'); if (el.textContent !== t) el.textContent = t; },
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
      if (id === 'color') chips('色', colorItems, o.color, v => { o.color = v; UI.refreshTools(); });
      else if (id === 'transform') chips('', [{ v: 'flipH', label: '左右反転' }, { v: 'flipV', label: '上下反転' }, { v: 'rot', label: '回転90°' }, { v: 'trans', label: '転置' }], o.tf, v => { o.tf = v; UI.refreshTools(); });
      else if (id === 'sort') chips('', [{ v: 'L', label: '←寄せ' }, { v: 'R', label: '寄せ→' }, { v: 'U', label: '↑寄せ' }, { v: 'D', label: '寄せ↓' }, { v: 'CR', label: '色順(行)' }, { v: 'CC', label: '色順(列)' }], o.sort, v => { o.sort = v; UI.refreshTools(); });
      else if (id === 'replace') { chips('から', colorItems, o.from, v => { o.from = v; UI.refreshTools(); }); chips('へ', colorItems, o.to, v => { o.to = v; UI.refreshTools(); }); }
      else if (id === 'hide') chips('', [{ v: 'row', label: '行を隠す' }, { v: 'col', label: '列を隠す' }], o.axis, v => { o.axis = v; UI.refreshTools(); });
      else if (id === 'filter') chips('残す色', colorItems.concat([{ v: null, label: '解除' }]), G.filter, v => { runPlan(planFor('filter', { fcolor: v })); UI.refreshTools(); });
      else if (id === 'unhide') { const b = document.createElement('button'); b.className = 'chip wide'; b.textContent = 'すべて再表示（' + TOOL_BY.unhide.cost + '）'; b.onclick = () => { runPlan(planFor('unhide', {})); UI.refreshTools(); }; opts.appendChild(b); }
      const d = TOOL_BY[E.tool]; $('#edithelp').textContent = E.pan ? 'ドラッグで画面を動かす' : (E.msg || E.hint || (d ? d.help : ''));
      $('#e-pan').className = E.pan ? 'sel' : '';
    },
    restart() { if (G.mode !== 'play') return; loadLevel(G.levelIdx); UI.show(null); },
    start(i) { G.mode = 'play'; loadLevel(i); UI.show(null); $('#hud').classList.remove('hide'); $('#touch').classList.remove('hide'); const t = $('#toast'); t.classList.add('hide'); G.paused = false; },
    title() { G.mode = 'title'; UI.show('#screen-title'); $('#hud').classList.add('hide'); $('#touch').classList.add('hide'); $('#editbar').classList.add('hide'); },
    select() { G.mode = 'select'; UI.show('#screen-select'); $('#hud').classList.add('hide'); $('#touch').classList.add('hide'); $('#editbar').classList.add('hide'); UI.buildSelect(); },
    unlocked(i) { return true; }, // 試遊用: ステージは自由に選べる
    buildSelect() {
      const box = $('#levels'); box.innerHTML = ''; let total = 0;
      LEVELS.forEach((lv, i) => {
        const s = save.levels[lv.id], b = document.createElement('button'); const ok = UI.unlocked(i); total += starCount(s);
        b.className = 'lv' + (ok ? '' : ' lock'); b.disabled = !ok;
        b.innerHTML = '<b>' + lv.id + '</b><span>' + lv.name + '</span><i>' + (s ? pips(s.goals) : (ok ? '☆☆☆' : '🔒')) + '</i>';
        b.onclick = () => UI.start(i); box.appendChild(b);
      });
      $('#total').textContent = '★ ' + total + ' / ' + LEVELS.length * 3;
    },
    showResult(goals) {
      G.mode = 'result'; UI.show('#screen-result');
      $('#r-stars').textContent = pips(goals);
      const lv = G.level;
      $('#r-info').innerHTML = '宝石 ' + G.gems + '/' + lv.gems.length + '　タイム ' + G.time.toFixed(1) + '秒　ダメージ ' + G.hits + '回';
      const tips = []; if (!goals[1]) tips.push('★2: 宝石を全部あつめる'); if (!goals[2]) tips.push('★3: ノーダメージでクリア');
      $('#r-tip').textContent = tips.length ? tips.join('　') : 'パーフェクト！';
      const last = G.levelIdx >= LEVELS.length - 1; $('#r-next').textContent = last ? 'ステージえらびへ' : '次のステージへ';
    },
  };
  $('#e-undo').onclick = () => undoEdit(); $('#e-redo').onclick = () => redoEdit(); $('#e-done').onclick = () => setEdit(false);
  $('#e-pan').onclick = () => { G.edit.pan = !G.edit.pan; UI.refreshTools(); };
  $('#btn-play').onclick = () => { audio(); UI.select(); };
  $('#btn-back').onclick = () => UI.title();
  $('#btn-edit').onclick = () => toggleEdit();
  $('#btn-restart').onclick = () => UI.restart();
  $('#btn-menu').onclick = () => UI.select();
  $('#btn-mute').onclick = () => { muted = !muted; save.muted = muted; persist(); $('#btn-mute').textContent = muted ? '🔇' : '🔊'; };
  $('#btn-mute').textContent = muted ? '🔇' : '🔊';
  $('#r-retry').onclick = () => { UI.start(G.levelIdx); };
  $('#r-next').onclick = () => { if (G.levelIdx >= LEVELS.length - 1) UI.select(); else UI.start(G.levelIdx + 1); };
  $('#r-menu').onclick = () => UI.select();
  $('#btn-reset').onclick = () => { if (confirm('セーブデータを消しますか？')) { save = { levels: {}, muted }; persist(); UI.buildSelect(); } };

  // ===== 拡大表示(整数倍) =====
  function fit() {
    const wrap = $('#stage'), cw = wrap.clientWidth, ch = wrap.clientHeight;
    let s = Math.floor(Math.min(cw / W, ch / H)); if (s < 2) s = Math.min(cw / W, ch / H); // 狭い画面では小数倍にして大きく見せる
    cv.style.width = W * s + 'px'; cv.style.height = H * s + 'px';
    $('#game').style.width = W * s + 'px'; $('#game').style.height = H * s + 'px';
    document.documentElement.style.setProperty('--s', s);
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
  requestAnimationFrame(loop);

  // ===== テスト用の口(自動プレイが使う) =====
  window.__geko = {
    G, input, press, update, render, UI, LEVELS, T, TL, COLORS, TOOLS, setEdit, undoEdit, redoEdit, runPlan, planFor, normRect,
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

