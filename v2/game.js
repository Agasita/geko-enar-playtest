/* ゲコ＆エナー v2 — 本体。320x180 のドットを整数倍に拡大して表示する(すべてのドットが同じ大きさ)。 */
(function () {
  'use strict';
  const W = 320, H = 180, T = 16, DT = 1 / 60;
  const TL = { EMPTY: 0, STONE: 1, STEEL: 2, CRACK: 3, BOUNCE: 4, SPIKE: 5 };
  const CH2TILE = { '.': 0, '#': 1, 'S': 2, 'c': 3, 'b': 4, '^': 5 };
  const TOOLS = [
    { id: 'build', name: 'つくる', cost: 4, help: 'ドラッグした範囲の空きマスに石をつくる（1マス4）' },
    { id: 'back', name: '奥へ', cost: 3, help: '石を奥の層へ送る/奥の石を手前にもどす（1マス3）' },
    { id: 'paint', name: 'ぬる', cost: 3, help: '石を「ばね」にする。もう一度ぬると石にもどる（1マス3）' },
    { id: 'freeze', name: 'かためる', cost: 10, help: '敵をタップ→8秒間、石の足場にする（10）' },
  ];
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
    edit: { on: false, tool: 'build', mat: 'bounce', sel: null, undo: [], pan: false, cursor: [0, 0], kb: null, msg: '' },
    hintShown: {}, respawn: null, flash: 0,
  };
  const input = { left: false, right: false, down: false, up: false, jumpHeld: false, jumpP: false, atkP: false, dashP: false, editP: false };

  // ===== レベル読み込み =====
  function loadLevel(i) {
    const lv = LEVELS[i]; G.levelIdx = i; G.level = lv;
    G.front = lv.front.map(r => Array.from(r).map(c => CH2TILE[c] || 0));
    G.back = lv.back.map(r => Array.from(r).map(c => (c === 'B' ? 1 : 0)));
    G.enemies = lv.ents.map((e, k) => makeEnemy(e, k));
    G.pick = [];
    lv.gems.forEach((g, k) => G.pick.push({ type: 'gem', x: g[0] * T + 4, y: g[1] * T + 4, w: 8, h: 8, k, got: false }));
    lv.sparks.forEach((g, k) => G.pick.push({ type: 'spark', x: g[0] * T + 4, y: g[1] * T + 4, w: 8, h: 8, k, got: false }));
    G.checks = lv.checks.map(c => ({ x: c[0] * T, y: c[1] * T, on: false }));
    G.flag = { x: lv.flag[0] * T, y: lv.flag[1] * T - 16, w: 16, h: 32 };
    G.respawn = { x: lv.start[0] * T + 3, y: lv.start[1] * T + 2 };
    G.bullets = []; G.parts = [];
    G.energy = lv.energy; G.gems = 0; G.deaths = 0; G.hits = 0; G.time = 0; G.hintShown = {};
    G.edit = { on: false, tool: lv.tools[0] || 'build', mat: 'bounce', sel: null, undo: [], pan: false, cursor: [lv.start[0], lv.start[1]], kb: null, msg: '' };
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
  const solidT = (t) => t === TL.STONE || t === TL.STEEL || t === TL.CRACK || t === TL.BOUNCE;
  // かためた敵は、少し大きめの石の足場になる(乗りやすいように)
  function frozenRects() { const r = []; for (const e of G.enemies) if (!e.dead && e.frozen > 0) r.push({ x: e.x - 3, y: e.y - 1, w: e.w + 6, h: e.h + 2 }); return r; }
  function boxHitsSolid(x, y, w, h, ignoreFrozen) {
    const x0 = Math.floor(x / T), x1 = Math.floor((x + w - .001) / T), y0 = Math.floor(y / T), y1 = Math.floor((y + h - .001) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (solidT(tileAt(tx, ty))) return true;
    if (!ignoreFrozen) for (const e of frozenRects()) if (overlap(x, y, w, h, e.x, e.y, e.w, e.h)) return true;
    return false;
  }
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
    // ダッシュ
    if (input.dashP && p.dashAvail && p.dashT <= 0 && p.stun <= 0) { p.dashT = .17; p.dashAvail = false; p.vx = p.face * DASH_V; p.vy = 0; SFX.dash(); spawnParts(p.x + 5, p.y + 12, 5, '#fff', 30); }
    if (p.dashT > 0) { p.dashT -= dt; p.vx = p.face * DASH_V; p.vy = 0; }
    else if (p.stun <= 0) {
      // 横移動
      const slide = 0; const target = dir * RUN; const a = dir ? (p.ground ? ACC : AIR) : (p.ground ? FRIC : 200);
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
    // ばね
    if (p.ground && p.vy >= 0) {
      const ty = Math.floor((p.y + p.h + 1) / T), tx0 = Math.floor(p.x / T), tx1 = Math.floor((p.x + p.w - 1) / T);
      for (let tx = tx0; tx <= tx1; tx++) if (tileAt(tx, ty) === TL.BOUNCE) { p.vy = -BOUNCE; p.free = true; p.ground = false; p.coyote = 0; p.squash = -.4; SFX.bounce(); spawnParts(p.x + 5, p.y + 14, 8, '#8FD18A', 40); break; }
    }
    // トゲ
    const sx0 = Math.floor(p.x / T), sx1 = Math.floor((p.x + p.w - 1) / T), sy0 = Math.floor((p.y + 6) / T), sy1 = Math.floor((p.y + p.h - 1) / T);
    for (let ty = sy0; ty <= sy1; ty++) for (let tx = sx0; tx <= sx1; tx++) if (tileAt(tx, ty) === TL.SPIKE && p.y + p.h > ty * T + 8) hurtPlayer(null, true);
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
    // ひび割れブロック
    const x0 = Math.floor(b.x / T), x1 = Math.floor((b.x + b.w - 1) / T), y0 = Math.floor(b.y / T), y1 = Math.floor((b.y + b.h - 1) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (inb(tx, ty) && G.front[ty][tx] === TL.CRACK) breakCrack(tx, ty);
    for (const e of G.enemies) {
      if (e.dead || e.frozen > 0 || p.atkHit.has(e)) continue;
      if (!overlap(b.x, b.y, b.w, b.h, e.x, e.y, e.w, e.h)) continue;
      p.atkHit.add(e);
      if (e.type === 'guard' && !p.pogo && ((p.face > 0 && e.dir < 0) || (p.face < 0 && e.dir > 0))) { // 盾で防がれる
        SFX.bad(); spawnParts(e.x + 6, e.y + 6, 4, '#93A0B8'); p.vx = -p.face * 60; continue;
      }
      damageEnemy(e, 1);
      if (p.pogo) { p.vy = -250; p.free = true; p.dashAvail = true; p.pogo = false; }
    }
  }
  function breakCrack(tx, ty) { G.front[ty][tx] = 0; SFX.hit(); spawnParts(tx * T + 8, ty * T + 8, 8, '#B07A4F', 70); G.shake = 3; }
  function damageEnemy(e, n) {
    e.hp -= n; e.flash = .15; G.hitstop = .05; G.shake = 3; SFX.hit(); spawnParts(e.x + e.w / 2, e.y + e.h / 2, 7, '#fff', 60);
    if (e.hp <= 0) { e.dead = true; spawnParts(e.x + e.w / 2, e.y + e.h / 2, 14, '#F5C842', 90); G.pick.push({ type: 'spark', x: e.x + 2, y: e.y + 2, w: 8, h: 8, got: false, drop: true }); }
  }

  // ===== 敵 =====
  function updateEnemies(dt) {
    const p = G.p;
    for (const e of G.enemies) {
      if (e.dead) continue;
      e.t += dt; if (e.flash > 0) e.flash -= dt;
      if (e.frozen > 0) { e.frozen -= dt; if (e.frozen <= 0) spawnParts(e.x + 6, e.y + 6, 8, '#6FD6E8'); continue; }
      if (e.stun > 0) { e.stun -= dt; continue; }
      if (e.type === 'walker' || e.type === 'guard') {
        // 重力と歩行(縁や壁で折り返す)
        e.vy = (e.vy || 0) + 900 * dt; if (moveY(e, e.vy * dt)) e.vy = 0;
        const spd = e.type === 'guard' ? 22 : 28; const nx = e.x + e.dir * 2;
        const ahead = e.dir > 0 ? e.x + e.w + 2 : e.x - 2;
        const floorAhead = solidT(tileAt(Math.floor(ahead / T), Math.floor((e.y + e.h + 2) / T)));
        const wall = boxHitsSolid(e.x + e.dir * 2, e.y, e.w, e.h - 1);
        if (!floorAhead || wall) e.dir = -e.dir; else moveX(e, e.dir * spd * dt);
        void nx;
      } else if (e.type === 'flyer') {
        const px = e.x, py = e.y;
        e.x = e.bx + Math.sin(e.t * 1.1) * e.range; e.y = e.by + Math.sin(e.t * 2.2) * 4; e.dir = e.x > px ? 1 : -1; void py;
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
      if (boxHitsSolid(b.x, b.y, b.w, b.h, true) || b.x < 0 || b.x > G.level.w * T) b.dead = true;
      if (!G.p.dead && overlap(b.x, b.y, b.w, b.h, p.x, p.y, p.w, p.h)) { b.dead = true; hurtPlayer(null); }
      if (!b.dead) for (const e of frozenRects()) if (overlap(b.x, b.y, b.w, b.h, e.x, e.y, e.w, e.h)) b.dead = true;
    }
    G.bullets = G.bullets.filter(b => !b.dead);
  }

  // ===== 取得物・ゴール =====
  function updatePickups() {
    const p = G.p; if (p.dead) return;
    for (const k of G.pick) {
      if (k.got) continue;
      if (overlap(p.x, p.y, p.w, p.h, k.x, k.y, k.w, k.h)) {
        k.got = true;
        if (k.type === 'gem') { G.gems++; SFX.gem(); spawnParts(k.x + 4, k.y + 4, 10, '#7FA2F0', 70); }
        else { G.energy = Math.min(100, G.energy + 15); SFX.spark(); spawnParts(k.x + 4, k.y + 4, 5, '#F5C842', 40); }
      }
    }
    for (const c of G.checks) {
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

  // ===== 編集 =====
  function actorRects() {
    const r = [{ x: G.p.x, y: G.p.y, w: G.p.w, h: G.p.h }];
    for (const e of G.enemies) if (!e.dead) r.push({ x: e.x, y: e.y, w: e.w, h: e.h });
    return r;
  }
  function cellBlocked(tx, ty) { // 人や敵と重なるマスには置けない
    for (const r of actorRects()) if (overlap(tx * T, ty * T, T, T, r.x, r.y, r.w, r.h)) return true;
    return false;
  }
  function normRect(s) { return { x0: Math.min(s.x0, s.x1), y0: Math.min(s.y0, s.y1), x1: Math.max(s.x0, s.x1), y1: Math.max(s.y0, s.y1) }; }
  function planEdit(tool, r, mat) {
    // 変更点のリストと費用を返す(まだ反映しない)
    const ch = []; const lv = G.level;
    if (tool === 'freeze') return { ch, cost: 0 };
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
      if (!inb(x, y)) continue;
      const f = G.front[y][x], b = G.back[y][x];
      if (tool === 'build') { if (f === 0 && !cellBlocked(x, y)) ch.push({ x, y, f0: f, b0: b, f1: TL.STONE, b1: b }); }
      else if (tool === 'back') {
        if (f === TL.STONE || f === TL.BOUNCE || f === TL.CRACK) { if (b === 0) ch.push({ x, y, f0: f, b0: b, f1: 0, b1: 1 }); }
        else if (f === 0 && b === 1 && !cellBlocked(x, y)) ch.push({ x, y, f0: f, b0: b, f1: TL.STONE, b1: 0 });
      } else if (tool === 'paint') {
        if (mat === 'bounce' && f === TL.STONE) ch.push({ x, y, f0: f, b0: b, f1: TL.BOUNCE, b1: b });
        else if (mat === 'bounce' && f === TL.BOUNCE) ch.push({ x, y, f0: f, b0: b, f1: TL.STONE, b1: b });
      }
    }
    const def = TOOLS.find(t => t.id === tool);
    void lv;
    return { ch, cost: ch.length * def.cost };
  }
  function tryApply(sel) {
    const E = G.edit; if (!E.on) return false;
    if (E.tool === 'freeze') return tryFreeze(sel.x1, sel.y1, sel.px, sel.py);
    const r = normRect(sel); const plan = planEdit(E.tool, r, E.mat);
    if (!plan.ch.length) { E.msg = 'ここは変えられません'; SFX.bad(); return false; }
    if (plan.cost > G.energy) { E.msg = 'エナジーが足りません（' + plan.cost + '）'; SFX.bad(); return false; }
    for (const c of plan.ch) { G.front[c.y][c.x] = c.f1; G.back[c.y][c.x] = c.b1; spawnParts(c.x * T + 8, c.y * T + 8, 3, '#EBD7A5', 30); }
    G.energy -= plan.cost; E.undo.push({ ch: plan.ch, cost: plan.cost }); SFX.place(); E.msg = ''; G.shake = 1;
    return true;
  }
  function tryFreeze(cx, cy, px, py) {
    const E = G.edit; let best = null, bd = 1e9;
    const wx = px != null ? px : cx * T + 8, wy = py != null ? py : cy * T + 8;
    for (const e of G.enemies) {
      if (e.dead || e.frozen > 0) continue;
      const d = Math.hypot(e.x + e.w / 2 - wx, e.y + e.h / 2 - wy); if (d < bd) { bd = d; best = e; }
    }
    if (!best || bd > 22) { E.msg = '敵をタップしてね'; SFX.bad(); return false; }
    if (G.energy < 10) { E.msg = 'エナジーが足りません（10）'; SFX.bad(); return false; }
    if (overlap(G.p.x, G.p.y, G.p.w, G.p.h, best.x, best.y, best.w, best.h)) { E.msg = '重なっているので、かためられません'; SFX.bad(); return false; }
    best.frozen = 8; G.energy -= 10; E.undo.push({ freeze: best, cost: 10 }); SFX.freeze(); E.msg = ''; spawnParts(best.x + 6, best.y + 6, 12, '#6FD6E8', 60);
    return true;
  }
  function undoEdit() {
    const E = G.edit, u = E.undo.pop(); if (!u) { SFX.bad(); return; }
    if (u.freeze) u.freeze.frozen = 0; else for (const c of u.ch) { G.front[c.y][c.x] = c.f0; G.back[c.y][c.x] = c.b0; }
    G.energy = Math.min(100, G.energy + u.cost); SFX.place();
  }
  function setEdit(on) {
    const E = G.edit; if (G.mode !== 'play' || G.cleared || G.p.dead) return;
    if (!G.level.tools.length) { UI.toast('このステージでは編集できないよ'); return; }
    E.on = on; E.sel = null; E.kb = null; E.msg = '';
    if (on) { SFX.editOn(); E.cursor = [Math.floor((G.p.x + 5) / T), Math.floor((G.p.y + 7) / T)]; G.cam.x = clamp(G.cam.x + 30, 0, G.level.w * T - W); } else SFX.editOff();
    $('#editbar').classList.toggle('hide', !on); $('#touch').classList.toggle('hide', on); document.body.classList.toggle('editing', on); UI.refreshTools();
  }

  // ===== 更新 =====
  function update(dt) {
    if (G.mode !== 'play') return;
    if (G.edit.on) { G.frame++; return; }
    if (G.hitstop > 0) { G.hitstop -= dt; return; }
    G.frame++; G.t += dt;
    if (!G.cleared) G.time += dt;
    updatePlayer(dt); updateEnemies(dt); updatePickups();
    if (!G.cleared) G.energy = Math.min(100, G.energy + dt * 1.2);
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
  function tileColors() {
    return { stone: '#C9A15E', stoneL: '#E8CFA0', stoneD: '#735630', steel: '#66708C', steelL: '#8D97B3', steelD: '#2F3752', bounce: '#58B368', bounceL: '#8FD18A', crack: '#C9A15E' };
  }
  const TC = tileColors();
  function drawTile(t, x, y, tx, ty, dim) {
    if (t === TL.STONE || t === TL.BOUNCE || t === TL.CRACK) {
      const col = t === TL.BOUNCE ? TC.bounce : TC.stone, hi = t === TL.BOUNCE ? TC.bounceL : TC.stoneL, lo = t === TL.BOUNCE ? '#3F8F52' : TC.stoneD;
      ctx.fillStyle = col; ctx.fillRect(x, y, T, T);
      if (!solidT(tileAt(tx, ty - 1))) { ctx.fillStyle = hi; ctx.fillRect(x, y, T, 2); }
      if (!solidT(tileAt(tx, ty + 1))) { ctx.fillStyle = lo; ctx.fillRect(x, y + T - 3, T, 3); }
      if (t === TL.BOUNCE) { ctx.fillStyle = '#fff'; ctx.fillRect(x + 4, y + 5, 2, 2); ctx.fillRect(x + 7, y + 3, 2, 2); ctx.fillRect(x + 10, y + 5, 2, 2); }
      if (t === TL.CRACK) { ctx.fillStyle = TC.stoneD; ctx.fillRect(x + 7, y + 2, 2, 4); ctx.fillRect(x + 5, y + 6, 2, 4); ctx.fillRect(x + 9, y + 9, 2, 4); }
    } else if (t === TL.STEEL) {
      ctx.fillStyle = TC.steel; ctx.fillRect(x, y, T, T);
      if (!solidT(tileAt(tx, ty - 1))) { ctx.fillStyle = TC.steelL; ctx.fillRect(x, y, T, 2); }
      if (!solidT(tileAt(tx, ty + 1))) { ctx.fillStyle = TC.steelD; ctx.fillRect(x, y + T - 3, T, 3); }
      ctx.fillStyle = TC.steelD; ctx.fillRect(x + 3, y + 6, 2, 2); ctx.fillRect(x + 11, y + 6, 2, 2);
    } else if (t === TL.SPIKE) {
      ctx.fillStyle = '#D5DBE6';
      for (let i = 0; i < 4; i++) for (let j = 0; j < 8; j++) { const w = 4 - Math.floor(j / 2); ctx.fillRect(x + i * 4 + (4 - w) / 2, y + 8 + j, w, 1); }
    }
    void dim;
  }
  function drawWorld() {
    const lv = G.level, cx = Math.round(G.cam.x + (G.shake ? (Math.random() - .5) * G.shake : 0)), cy = Math.round(G.cam.y);
    const x0 = Math.max(0, Math.floor(cx / T)), x1 = Math.min(lv.w - 1, Math.floor((cx + W) / T)), y0 = Math.max(0, Math.floor(cy / T)), y1 = Math.min(lv.h - 1, Math.floor((cy + H) / T));
    // 奥の層(暗く)
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (G.back[ty][tx]) {
      ctx.fillStyle = 'rgba(31,42,68,.38)'; ctx.fillRect(tx * T - cx, ty * T - cy, T, T);
      ctx.fillStyle = 'rgba(31,42,68,.25)'; ctx.fillRect(tx * T - cx + 2, ty * T - cy + 2, T - 4, T - 4);
    }
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) { const t = G.front[ty][tx]; if (t) drawTile(t, tx * T - cx, ty * T - cy, tx, ty); }
    // チェックポイントとゴール
    for (const c of G.checks) { const x = c.x - cx, y = c.y - cy; ctx.fillStyle = '#5B6785'; ctx.fillRect(x + 7, y + 2, 2, 14); ctx.fillStyle = c.on ? '#F5C842' : '#93A0B8'; ctx.fillRect(x + 9, y + 2, 6, 4); }
    { const f = G.flag, x = f.x - cx, y = f.y - cy; ctx.fillStyle = '#5B6785'; ctx.fillRect(x + 6, y, 3, 32); ctx.fillStyle = '#E8563F'; ctx.fillRect(x + 9, y + 1, 12, 9); ctx.fillStyle = '#fff'; ctx.fillRect(x + 12, y + 3, 3, 3); }
    // 取得物
    for (const k of G.pick) {
      const x = k.x - cx, y = k.y - cy + Math.round(Math.sin(G.t * 4 + k.x) * 1.5);
      if (k.type === 'gem') icon(GEM, x + 1, y + 1, '#4C9BE8', '#BFD8FF'); else icon(BOLT, x + 1, y + 1, '#F5C842');
    }
    // 敵
    for (const e of G.enemies) {
      if (e.dead) continue;
      const fr = Math.floor(e.t * 4) % 2, flip = e.dir > 0;
      let name = e.type === 'walker' ? 'walker' : e.type === 'guard' ? 'guard' : e.type === 'flyer' ? 'flyer' : 'turret';
      const s = sprite(name, name === 'guard' || name === 'turret' ? 0 : fr, flip);
      const x = Math.round(e.x - (e.ox || 0) - cx), y = Math.round(e.y - (e.oy || 0) - cy);
      if (e.frozen > 0) {
        ctx.drawImage(s, x, y); const fx = Math.round(e.x - cx) - 3, fy = Math.round(e.y - cy) - 1;
        ctx.fillStyle = 'rgba(111,214,232,.8)'; ctx.fillRect(fx, fy, e.w + 6, e.h + 2);
        ctx.fillStyle = '#E3F6FF'; ctx.fillRect(fx, fy, e.w + 6, 2);
        if (e.frozen < 2 && Math.floor(e.frozen * 8) % 2) { ctx.fillStyle = '#fff'; ctx.fillRect(fx, fy, e.w + 6, e.h + 2); }
      } else { if (e.flash > 0 && Math.floor(e.flash * 40) % 2) ctx.globalAlpha = .4; ctx.drawImage(s, x, y); ctx.globalAlpha = 1; }
      if (e.type === 'guard' && e.frozen <= 0) { ctx.fillStyle = '#4C9BE8'; ctx.fillRect(Math.round(e.x - cx) + (e.dir > 0 ? e.w - 1 : -3), Math.round(e.y - cy), 4, e.h); }
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
    text(Math.floor(G.time / 60) + ':' + String(Math.floor(G.time % 60)).padStart(2, '0'), 36, gy + 1, '#D5DBE6');
  }
  function drawEditOverlay() {
    const E = G.edit, cx = Math.round(G.cam.x), cy = Math.round(G.cam.y);
    ctx.fillStyle = 'rgba(31,42,68,.35)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    for (let x = -(cx % T); x < W; x += T) ctx.fillRect(x, 0, 1, H);
    for (let y = -(cy % T); y < H; y += T) ctx.fillRect(0, y, W, 1);
    const sel = E.sel || (E.kb && { x0: E.kb[0], y0: E.kb[1], x1: E.cursor[0], y1: E.cursor[1] });
    if (E.tool === 'freeze') {
      for (const e of G.enemies) if (!e.dead && e.frozen <= 0) { ctx.strokeStyle = '#6FD6E8'; ctx.lineWidth = 1; ctx.strokeRect(Math.round(e.x - cx) - 2.5, Math.round(e.y - cy) - 2.5, e.w + 5, e.h + 5); }
    } else if (sel) {
      const r = normRect(sel), plan = planEdit(E.tool, r, E.mat), ok = plan.ch.length && plan.cost <= G.energy;
      for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) { ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x * T - cx, y * T - cy, T, T); }
      for (const c of plan.ch) { ctx.fillStyle = ok ? 'rgba(143,209,138,.7)' : 'rgba(232,86,63,.7)'; ctx.fillRect(c.x * T - cx + 1, c.y * T - cy + 1, T - 2, T - 2); }
      ctx.strokeStyle = ok ? '#8FD18A' : '#E8563F'; ctx.lineWidth = 1; ctx.strokeRect(r.x0 * T - cx + .5, r.y0 * T - cy + .5, (r.x1 - r.x0 + 1) * T - 1, (r.y1 - r.y0 + 1) * T - 1);
      text(plan.cost, r.x0 * T - cx + 2, r.y0 * T - cy - 7, ok ? '#fff' : '#E8563F');
    } else if (!E.sel && E.kb == null && E.cursor) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(E.cursor[0] * T - cx + .5, E.cursor[1] * T - cy + .5, T - 1, T - 1);
    }
  }
  function render() {
    if (!G.level) return;
    drawBackground(); drawWorld();
    if (G.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (G.flash * 1.2) + ')'; ctx.fillRect(0, 0, W, H); }
    if (G.edit.on) drawEditOverlay();
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
      const n = parseInt(e.key, 10); if (n >= 1 && n <= TOOLS.length) { const t = TOOLS[n - 1]; if (G.level.tools.includes(t.id)) { E.tool = t.id; UI.refreshTools(); } return; }
      const mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1] }[e.code];
      if (mv) { e.preventDefault(); E.cursor = [clamp(E.cursor[0] + mv[0], 0, G.level.w - 1), clamp(E.cursor[1] + mv[1], 0, G.level.h - 1)]; return; }
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (E.tool === 'freeze') { tryFreeze(E.cursor[0], E.cursor[1]); return; }
        if (!E.kb) E.kb = [E.cursor[0], E.cursor[1]];
        else { tryApply({ x0: E.kb[0], y0: E.kb[1], x1: E.cursor[0], y1: E.cursor[1] }); E.kb = null; }
      }
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
  // 編集: ポインタで範囲を選ぶ
  function toWorld(e) {
    const r = cv.getBoundingClientRect(), s = r.width / W;
    const px = (e.clientX - r.left) / s + Math.round(G.cam.x), py = (e.clientY - r.top) / s + Math.round(G.cam.y);
    return { px, py, tx: clamp(Math.floor(px / T), 0, G.level.w - 1), ty: clamp(Math.floor(py / T), 0, G.level.h - 1) };
  }
  let dragging = false, panLast = null;
  cv.addEventListener('pointerdown', (e) => {
    audio(); if (G.mode !== 'play' || !G.edit.on) return; e.preventDefault(); cv.setPointerCapture(e.pointerId);
    const E = G.edit, w = toWorld(e);
    if (E.pan) { panLast = { x: e.clientX, y: e.clientY }; return; }
    dragging = true; E.kb = null; E.sel = { x0: w.tx, y0: w.ty, x1: w.tx, y1: w.ty, px: w.px, py: w.py };
    if (E.tool === 'freeze') { E.sel = null; dragging = false; tryFreeze(w.tx, w.ty, w.px, w.py); }
  });
  cv.addEventListener('pointermove', (e) => {
    const E = G.edit; if (G.mode !== 'play' || !E.on) return;
    if (panLast) { const s = cv.getBoundingClientRect().width / W; G.cam.x = clamp(G.cam.x - (e.clientX - panLast.x) / s, 0, G.level.w * T - W); G.cam.y = clamp(G.cam.y - (e.clientY - panLast.y) / s, 0, Math.max(0, G.level.h * T - H)); panLast = { x: e.clientX, y: e.clientY }; return; }
    if (!dragging || !E.sel) return; const w = toWorld(e); E.sel.x1 = w.tx; E.sel.y1 = w.ty;
  });
  const endDrag = (e) => {
    const E = G.edit; if (panLast) { panLast = null; return; }
    if (!dragging || !E.sel) return; dragging = false;
    const sel = E.sel; E.sel = null; tryApply(sel); UI.refreshTools();
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
    refreshTools() {
      const E = G.edit, bar = $('#tools'); bar.innerHTML = '';
      TOOLS.forEach((t, i) => {
        if (!G.level.tools.includes(t.id)) return;
        const b = document.createElement('button'); b.textContent = (i + 1) + ' ' + t.name; b.className = E.tool === t.id ? 'sel' : '';
        b.onclick = () => { E.tool = t.id; E.sel = null; E.kb = null; E.pan = false; UI.refreshTools(); };
        bar.appendChild(b);
      });
      const pan = document.createElement('button'); pan.textContent = '✋ 画面'; pan.className = E.pan ? 'sel' : ''; pan.onclick = () => { E.pan = !E.pan; UI.refreshTools(); }; bar.appendChild(pan);
      const u = document.createElement('button'); u.textContent = '↶ 戻す'; u.onclick = undoEdit; bar.appendChild(u);
      const x = document.createElement('button'); x.textContent = '編集を終える'; x.className = 'done'; x.onclick = () => setEdit(false); bar.appendChild(x);
      const def = TOOLS.find(t => t.id === E.tool); $('#edithelp').textContent = E.pan ? 'ドラッグで画面を動かす' : (def ? def.help : '');
      $('#paintopt').classList.toggle('hide', E.tool !== 'paint' || E.pan);
    },
    restart() { if (G.mode !== 'play') return; loadLevel(G.levelIdx); UI.show(null); },
    start(i) { G.mode = 'play'; loadLevel(i); UI.show(null); $('#hud').classList.remove('hide'); $('#touch').classList.remove('hide'); const t = $('#toast'); t.classList.add('hide'); G.paused = false; },
    title() { G.mode = 'title'; UI.show('#screen-title'); $('#hud').classList.add('hide'); $('#touch').classList.add('hide'); $('#editbar').classList.add('hide'); },
    select() { G.mode = 'select'; UI.show('#screen-select'); $('#hud').classList.add('hide'); $('#touch').classList.add('hide'); $('#editbar').classList.add('hide'); UI.buildSelect(); },
    unlocked(i) { return i === 0 || !!save.levels[LEVELS[i - 1].id]; },
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
  document.querySelectorAll('#paintopt button').forEach(b => b.onclick = () => { G.edit.mat = b.dataset.mat; document.querySelectorAll('#paintopt button').forEach(x => x.classList.toggle('sel', x === b)); });
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
    G, input, press, update, render, UI, LEVELS, T, TL, planEdit, tryApply, tryFreeze, setEdit, undoEdit, normRect,
    step(n) { for (let i = 0; i < n; i++) update(DT); },
    start(i) { UI.start(i); G.paused = true; },
  };
})();
