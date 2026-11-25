/* ゲコ＆エナー v2 — ほんたい。320x180 のドットをせいすうばいに拡大してひょうじする(すべてのドットがおなじ大きさ)。 */
(function () {
  'use strict';
  const W = 288, H = 180, T = 16, DT = 1 / 60;
  const TL = { EMPTY: 0, STONE: 1, STEEL: 2, CRACK: 3, SPIKE: 5, GLASSED: 6, MAGNET: 7 }; // GLASSED = いろをつけたガラス(いろのちからは、ふつうのブロックとおなじ。もとガラスのしるしがつく)
  const CH2TILE = { '.': 0, '#': 1, 'S': 2, 'c': 3, '^': 5, 'M': 7 };
  // ブロックのいろ(＝Excelのセルのいろ)。いろにはちからがある。
  const COLORS = [
    { n: '茶色', hex: '#C9A15E', hi: '#E8CFA0', lo: '#735630', fx: '普通のブロック' },
    { n: '赤', hex: '#E8563F', hi: '#F7A08F', lo: '#A8403F', fx: '熱い。触れるとダメージ' },
    { n: '青', hex: '#6FD6E8', hi: '#D5F6FC', lo: '#3F9DB5', fx: '滑る床（氷）' },
    { n: '緑', hex: '#58B368', hi: '#8FD18A', lo: '#3F8F52', fx: '跳ねる床（バネ）' },
    { n: 'ひび割れ', hex: '#8C6A3A', hi: '#C9A15E', lo: '#4A3318', fx: '乗ると約0.5秒で崩れる（旧・黄色ブロックと同じもの）' },
    { n: 'ガラス', hex: '#DCEBF3', hi: '#FFFFFF', lo: '#9DB9C8', fx: '色のないセル。色コピーで性質をつけられる' },
  ];
  const GLASS = 5;
  const TABS = [{ id: 'home', name: 'ホーム' }, { id: 'cell', name: 'セル' }, { id: 'data', name: 'データ' }, { id: 'view', name: '表示' }];
  // Excelのきのうを、世界のなおすにてんようしたどうぐ。なにもないところにブロックは生まれない(うごかす・ならべる・いろ・隠す・けす、だけ)。
  const TOOLS = [
    { id: 'painter', tab: 'home', name: 'いろコピー', mode: 'painter', cost: 2, help: '①色をコピーするブロックをタップ ②ガラスの範囲をドラッグ。ガラスにだけ色がつく' },
    { id: 'transform', tab: 'cell', name: 'かたち', mode: 'rect', cost: 8, help: '選んだ範囲を反転・回転する。90°回転は正方形で選ぶ' },
    { id: 'sort', tab: 'data', name: 'ならべかえ', mode: 'rect', cost: 10, help: '範囲内のブロックを一方向に寄せる。保護ブロックと鋼で区切られる' },
    { id: 'filter', tab: 'data', name: 'フィルター', mode: 'instant', cost: 8, help: '残す色を選ぶ。ほかの色は通り抜けられる' },
    { id: 'protect', tab: 'view', name: 'シートをまもる', mode: 'rect', cost: 4, help: '範囲内のブロックを保護する。保護したブロックは編集できない' },
    { id: 'unprotect', tab: 'view', name: 'まもりをはずす', mode: 'rect', cost: 6, help: '選んだ範囲の保護を解除する' },
    { id: 'printarea', tab: 'view', name: '印刷範囲の設定', mode: 'rect', cost: 6, help: '範囲を選ぶと、そこが青い枠のまま、ずっと見えるようになる（いまの見える範囲に、重ねて選ぶ。40マスまで・3か所まで）' },
    { id: 'zoom', tab: 'view', name: 'ズーム', mode: 'instant', cost: 4, help: '「ズームする」を押すと、数秒だけ、見える範囲が2倍に広がる（その間は、なおせない）' },
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
  function audio() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = false; } }
    if (ac && ac.state === 'suspended' && !document.hidden) { try { ac.resume(); } catch (e) { /* ignore */ } }
    return ac;
  }
  // BGM・ジングル(music.js)。どこかをさわった/キーを押した さいしょの瞬間に、音を ゆるしてもらう（スマホ対策）
  const BGM = window.BGM || { attach() {}, want() {}, jingle() {}, duck() {} };
  BGM.attach(() => ac || null, () => muted);
  ['pointerdown', 'keydown', 'touchend'].forEach(ev => addEventListener(ev, () => audio(), { passive: true }));
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
    swing() { noise(.08, .04); }, melt() { noise(.35, .05); tone(900, 300, .3, 'triangle', .03); }, hit() { tone(200, 60, .12, 'sawtooth', .06); noise(.06, .05); },
    gem() { tone(660, 990, .1, 'square', .05); setTimeout(() => tone(990, 1320, .12, 'square', .05), 70); },
    spark() { tone(880, 1200, .07, 'triangle', .04); },
    editOn() { tone(500, 200, .18, 'sine', .06); }, editOff() { tone(200, 500, .18, 'sine', .06); },
    place() { tone(440, 660, .06, 'square', .04); }, bad() { tone(140, 100, .1, 'square', .04); },
    hurt() { tone(300, 90, .25, 'sawtooth', .07); }, die() { BGM.jingle('miss'); },
    win() { BGM.jingle('clear'); }, perfect() { BGM.jingle('perfect'); }, check() { BGM.jingle('check'); },
    bounce() { tone(200, 700, .18, 'sine', .07); }, dash() { noise(.1, .05); tone(400, 200, .1, 'square', .03); },
    freeze() { tone(900, 300, .25, 'triangle', .06); },
  };

  // ===== 保存 =====
  const DEMO = window.DEMO || null; // 体験版(demo/index.html): ステージを しぼり、ステージ作成・テストは なし
  const SAVE_KEY = DEMO ? 'geko-enar-v2-demo' : 'geko-enar-v2';
  let save = { levels: {}, muted: false };
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (s && s.levels) save = s; } catch (e) { /* ほぞんできなくても遊べる */ }
  const PRACTICE_KEY = SAVE_KEY + '-practice';
  let practice = false; try { practice = localStorage.getItem(PRACTICE_KEY) === '1'; } catch (e) { /* ignore */ }
  const setPractice = (v) => { practice = v; try { localStorage.setItem(PRACTICE_KEY, v ? '1' : '0'); } catch (e) { /* ignore */ } };
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
    if (DEMO) { const keep = DEMO.levels, picked = keep.map(id => LEVELS.find(l => l.id === id)).filter(Boolean); LEVELS.splice(0, LEVELS.length, ...picked); return; }
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
  // 操作感の数値。パネル(操作感チューニング)から リアルタイムに かえられる。もとの値は TUNE_DEF
  const TUNE_DEF = { RUN: 105, ACC: 1000, AIR: 720, FRIC: 1400, AIRF: 200, GRAV: 1100, FALLM: 1.45, JUMP: 300, MAXFALL: 420, CUT: 2.6, COYOTE: .1, JBUF: .11,
    HOVER_T: .35, HOVER_VY: 36, BOUNCE: 440, DASH_V: 235, DASH_T: .17, ICE_ACC: 260, ICE_FRIC: 70,
    WIN_FLIP: .6, WIN_PERIOD: 1.6, WIN_CLOSED: 1 };
  const TU = Object.assign({}, TUNE_DEF);
  if (window.GFXX) window.GFXX.tune = TU; // 窓のくるりの速さも、パネルから
  if (ENER) document.body.classList.add('ener');
  const input = { left: false, right: false, down: false, up: false, jumpHeld: false, jumpP: false, atkP: false, dashP: false, editP: false };

  // ===== レベル読み込み =====
  function loadLevel(i) {
    const lv = LEVELS[i]; G.levelIdx = i; G.level = lv;
    G.front = lv.front.map(r => Array.from(r).map(c => CH2TILE[c] || 0));
    G.col = lv.color.map(r => r.slice()); G.lock = lv.lock.map(r => r.slice());
    G.hideRow = new Set(); G.hideCol = new Set(); G.filter = null; G.regen = lv.regen || 0; G.maxE = lv.regen ? 100 : lv.energy; // じっけんシートいがいは、ステージごとの「コストじょうげん」だけ。かいふくしない
    G.fog = lv.fog || null; G.areas = []; G.zoomT = 0;
    G.enemies = lv.ents.map((e, k) => makeEnemy(e, k)); G.fakes = G.enemies.filter(e => e.type === 'fake');
    G.lifts = (lv.lifts || []).map(l => makeLift(l)); G.crumb = {}; G.mgs = []; G.under = {};
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
    G.spent = 0; G.assisted = false; G.energy = lv.energy; G.gems = 0; G.deaths = 0; G.hits = 0; G.time = 0; G.hintShown = {};
    if (!practice && lv.tools.length && !lv.regen && save.fails && (save.fails[lv.id] || 0) >= 3 && !EDITOR_TEST) { G.maxE = G.energy = Math.ceil(lv.energy * 1.5); G.assisted = true; }
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
    if (e.type === 'bucket') return Object.assign(base, { w: 14, h: 13, ox: 1, oy: 2, vx: -24, hp: 1, dir: e.dir || -1, c: e.c === undefined ? 0 : e.c, lim: e.lim || null, painted: [], pt: 0, x: base.x + 1, y: base.y + 2 }); // 塗りつぶし: あるきながら、足もとの ガラスを 1マスずつ ぬる。たおすと、ぬった ガラスは もとに もどる
    if (e.type === 'turret') return Object.assign(base, { w: 12, h: 12, ox: 2, oy: 2, hp: 3, cd: 1.6, tele: 0, x: base.x + 2, y: base.y + 2 });
    // ---- Excelの こまった きどう ----
    if (e.type === 'div0') return Object.assign(base, { w: 12, h: 11, ox: 2, oy: 5, vx: -18, hp: 999, dir: -1, x: base.x + 2, y: base.y + 5 }); // #DIV/0!: ふめない・たおせない。ゆっくり おうふく
    if (e.type === 'autofill') return Object.assign(base, { w: 12, h: 12, ox: 2, oy: 4, hp: 1, cd: 1.5, made: 0, cap: e.cap === undefined ? 1e9 : e.cap, max: e.max === undefined ? 1e9 : e.max, reach: e.reach || 12, rate: e.rate || 2.2, c: e.c, dir: e.d || 1, d: e.d || 1, x: base.x + 2, y: base.y + 4 }); // オートフィル: ゆかを どんどん ふやす
    if (e.type === 'fake') return Object.assign(base, { w: 14, h: 14, ox: 1, oy: 2, hp: 1, look: 0, c: e.c || 0, dir: 1, gx: Math.round(base.x / T), gy: Math.round(base.y / T), mv: 0, x: base.x + 1, y: base.y + 2 }); // にせブロック: ブロックに ぎたい。ブロックでは ないので なおす(へんしゅう)が きかず、へんしゅう中も しょうたいは わからない
    // ---- ざんりの Excel てき ----
    const rg = (def) => (e.ranges && e.ranges.length ? e.ranges : [def]).map(r => ({ x0: Math.min(r[0], r[2]), y0: Math.min(r[1], r[3]), x1: Math.max(r[0], r[2]), y1: Math.max(r[1], r[3]) }));
    if (e.type === 'condfmt') return Object.assign(base, { w: 14, h: 12, ox: 1, oy: 2, hp: 1, cd: 2.4, step: 0, seq: e.seq || [0, 1, 2], ranges: rg([e.x - 2, e.y + 1, e.x + 2, e.y + 2]), tele: 0, dir: 1, x: base.x + 1, y: base.y + 2 }); // 条件つき書式: はんいの ブロックの いろを かってに かえる
    if (e.type === 'shuffler') return Object.assign(base, { w: 12, h: 12, ox: 2, oy: 2, hp: 2, cd: 2.4, sdir: e.dir || (e.axis === 'y' ? -1 : 1), axis: e.axis || 'x', ranges: rg([e.x - 3, e.y + 1, e.x + 3, e.y + 1]), tele: 0, x: base.x + 2, y: base.y + 2 }); // 並べ替え: はんいの ブロックを かたほうへ よせて ならべなおす
    if (e.type === 'circ') { const lp = rg([e.x, e.y, e.x + 3, e.y + 2])[0]; if (lp.x1 === lp.x0) lp.x1++; if (lp.y1 === lp.y0) lp.y1++; return Object.assign(base, { w: 12, h: 12, ox: 2, oy: 2, hp: 999, loop: lp, dir: 1, t: 0, x: lp.x0 * T + 2, y: lp.y0 * T + 2 }); } // 循環参照: マスに そって、直角に まがりながら ぐるぐる まわる。たおせない
    if (e.type === 'moji') return Object.assign(base, { w: 12, h: 12, ox: 2, oy: 4, hp: 1, awake: false, dir: 1, x: base.x + 2, y: base.y + 4 }); // しろい文字: ちかづくと しょうたいを あらわす
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
    if (G.mgs) for (const m of G.mgs) for (const c of m.cells) if (tx === c[0] + m.dx && ty === c[1] + m.dy) return true;
    if (G.fakes) for (const f of G.fakes) if (!f.hidden && tx === f.gx && ty === f.gy) return true; // にせブロックは かべ
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
        // あたった ひとを おしだす。おした さきが かべや ゆかの なかなら「はさまれた」: にげばが あっても ミス(1ミス)
        const to = Math.abs(dy) >= Math.abs(dx) ? [p.x, dy < 0 ? L.y - p.h : L.y + L.h] : [dx > 0 ? L.x + L.w : L.x - p.w, p.y];
        if (!boxHitsSolid(to[0], to[1], p.w, p.h)) { p.x = to[0]; p.y = to[1]; } else { p.x = to[0]; p.y = to[1]; killPlayer('crush'); }
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
  // あそびごこちの演出用。ほこり(よこにひろがる)・きらめきのわ・ふきあがる紙ふぶき
  function spawnDust(x, y, n, spd) {
    for (let i = 0; i < n; i++) { const d = i % 2 ? 1 : -1, s = spd * (.4 + Math.random() * .6); G.parts.push({ x: x + d * 2, y, vx: d * s, vy: -6 - Math.random() * 14, g: 40, s: 2 + (Math.random() < .35 ? 1 : 0), life: .28 + Math.random() * .2, col: Math.random() < .5 ? '#fff' : '#E4ECF8' }); }
  }
  function spawnRing(x, y, n, spd, col) {
    for (let i = 0; i < n; i++) { const a = i / n * 6.283; G.parts.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, g: 0, s: 2, life: .35, col }); }
    for (let i = 0; i < 4; i++) G.parts.push({ x: x + (Math.random() - .5) * 10, y: y + (Math.random() - .5) * 6, vx: (Math.random() - .5) * 10, vy: -22 - Math.random() * 16, g: -10, s: 1, life: .6 + Math.random() * .3, col: '#fff' });
  }
  const CONFETTI = ['#F5C842', '#E8563F', '#4C9BE8', '#70AD47', '#F29B3A', '#fff'];
  function spawnConfetti(x, y, n) {
    for (let i = 0; i < n; i++) { const a = -1.57 + (Math.random() - .5) * 2.2, s = 70 + Math.random() * 110; G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 220, s: 2 + (i % 3 === 0 ? 1 : 0), life: 1 + Math.random() * .7, col: CONFETTI[i % CONFETTI.length] }); }
  }
  function spawnParts(x, y, n, col, sp) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = (sp || 60) * (.3 + Math.random()); G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, life: .35 + Math.random() * .3, col: col || '#fff' }); }
  }
  function hurtPlayer(src, spike) {
    const p = G.p; if (p.inv > 0 || p.dead || G.cleared) return;
    p.hp--; G.hits++; p.inv = 1.3; G.shake = 6; G.hitstop = .08; SFX.hurt(); spawnParts(p.x + 5, p.y + 7, 10, '#E8563F');
    p.vx = -p.face * 110; p.vy = -190; p.stun = .15;
    if (p.hp <= 0 || spike) killPlayer(spike ? 'spike' : 'hp');
  }
  // ミスの演出: ひとコマ止まって白く光る → しゅじんこうが くるくる まわりながら とびあがって おちていく → 「ミス…」と りゆうを 出す → BGMを 止めて、やりなおすときに BGMも 最初から
  const DEAD_T = 1.8;
  function killPlayer(why) {
    const p = G.p; if (p.dead) return;
    p.dead = DEAD_T; p.deadT = 0; p.why = why || 'hp'; p.rot = 0; p.inv = 0; p.stun = 9; G.deaths++; SFX.die();
    G.shake = 8; G.hitstop = .12; G.flash = .25;
    spawnParts(p.x + 5, p.y + 7, 18, '#F5C842', 90); spawnRing(p.x + 5, p.y + 7, 14, 90, '#E8563F');
    p.vx = (p.face ? -p.face : -1) * 30; p.vy = -230; // ここからは p.x / p.y を、そのまま「とんでいくしゅじんこう」の いちとして うごかす
  }
  const MISS_TEXT = { hp: 'ライフが なくなった…', spike: 'とげに ささった…', fall: 'あなに おちちゃった…', crush: 'はさまれちゃった…' };
  function respawnPlayer() {
    const hp = 3; G.p = newPlayer(G.respawn.x, G.respawn.y); G.p.hp = hp; G.p.inv = 1; G.cam.x = G.cam.x; G.flash = .3;
    BGM.restart(); UI.wipe(null); snapCam(); G.hitstop = .25; // BGMを 頭から ならしなおす
  }
  function updatePlayer(dt) {
    const p = G.p;
    if (!p.dead && !G.cleared) { // かべや ゆかに めりこんだまま うごけなくならない よう、すこし ようすを みて、うえへ にがす(だめなら ミス)
      if (boxHitsSolid(p.x, p.y, p.w, p.h)) { p.emb = (p.emb || 0) + dt; if (p.emb > .2) { let moved = false; for (let up = 1; up <= 40; up++) if (!boxHitsSolid(p.x, p.y - up, p.w, p.h)) { p.y -= up; p.vy = 0; moved = true; break; } p.emb = 0; if (!moved) killPlayer('crush'); } } else p.emb = 0;
    }
    if (p.dead) {
      p.dead -= dt; p.deadT += dt;
      if (p.why !== 'fall') { p.vy += 620 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += (p.vx < 0 ? -1 : 1) * 10 * dt; }
      if (p.dead <= 0) respawnPlayer();
      return;
    }
    if (p.inv > 0) p.inv -= dt;
    if (p.stun > 0) p.stun = Math.max(0, p.stun - dt);
    p.atkCd -= dt;
    if (ENER) { input.atkP = false; input.dashP = false; }
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir && p.stun <= 0) p.face = dir;
    // 接地判定
    p.wasGround = p.ground;
    p.ground = boxHitsSolid(p.x, p.y + 1, p.w, p.h) && p.vy >= 0;
    if (p.ground) { p.coyote = TU.COYOTE; p.dashAvail = true; p.hover = TU.HOVER_T; } else p.coyote -= dt;
    if (input.jumpP) p.jbuf = TU.JBUF; else p.jbuf -= dt;
    // 足もとのいろ(あお=こおり)
    let onIce = false;
    for (const L of G.lifts) if (L.col === 2 && onLift(L)) onIce = true;
    if (p.ground) { const fy = Math.floor((p.y + p.h + 1) / T); for (let tx = Math.floor(p.x / T); tx <= Math.floor((p.x + p.w - 1) / T); tx++) if (colorAt(tx, fy) === 2) onIce = true; }
    // ダッシュ
    if (input.dashP && p.dashAvail && p.dashT <= 0 && p.stun <= 0) { p.dashT = TU.DASH_T; p.dashAvail = false; p.vx = p.face * TU.DASH_V; p.vy = 0; SFX.dash(); spawnParts(p.x + 5, p.y + 12, 5, '#fff', 30); }
    if (p.dashT > 0) {
      p.dashT -= dt; p.vx = p.face * TU.DASH_V; p.vy = 0;
      const px = Math.floor((p.x + (p.face > 0 ? p.w + 2 : -2)) / T), py = Math.floor((p.y + 7) / T); if (isFragile(px, py)) breakCrack(px, py); // もろいブロックはダッシュでこわれる
    } else if (p.stun <= 0) {
      const target = dir * TU.RUN; const a = dir ? (p.ground ? (onIce ? TU.ICE_ACC : TU.ACC) : TU.AIR) : (p.ground ? (onIce ? TU.ICE_FRIC : TU.FRIC) : TU.AIRF);
      const dv = target - p.vx; p.vx += clamp(dv, -a * dt, a * dt);
    }
    // ジャンプ
    if (p.jbuf > 0 && p.coyote > 0 && p.stun <= 0) { p.vy = -TU.JUMP; p.jbuf = 0; p.coyote = 0; p.ground = false; p.squash = -.25; SFX.jump(); spawnParts(p.x + 5, p.y + 14, 4, '#fff', 25); }
    // おもさ(うえ昇なかにボタンを離すと低くなる)
    if (p.dashT <= 0) {
      let g = TU.GRAV; if (p.vy > 0) { g *= TU.FALLM; p.free = false; } else if (!input.jumpHeld && p.vy < -80 && !p.free) g *= TU.CUT;
      p.vy = Math.min(TU.MAXFALL, p.vy + g * dt);
    }
    // ふわり(エナー): くうちゅうでジャンプを押し続けると、すこしのあいだ、おちる速さがおさえられる
    p.hovering = false;
    if (ENER && !window.__noHover && !p.ground && p.vy > 0 && input.jumpHeld && p.hover > 0 && p.stun <= 0) { p.hover -= dt; p.hovering = true; if (p.vy > TU.HOVER_VY) p.vy = TU.HOVER_VY; }
    // 攻撃
    if (input.atkP && p.atkCd <= 0 && p.stun <= 0) { p.atkT = .22; p.atkCd = .3; p.atkHit = new Set(); p.pogo = input.down && !p.ground; SFX.swing(); }
    if (p.atkT > 0) { p.atkT -= dt; if (p.atkT < .17 && p.atkT > .05) doAttack(); }
    // いどうと衝突(x→y)
    p.impact = p.vy; // ちゃくちの つよさ(ほこりの量)に つかう
    moveX(p, p.vx * dt); moveY(p, p.vy * dt);
    // ちゃくち
    p.ground = boxHitsSolid(p.x, p.y + 1, p.w, p.h) && p.vy >= 0;
    if (ENER) { // もろいブロックは、のってから0.45びょうで、くずれる
      const stand = new Set();
      if (p.ground) { const fy = Math.floor((p.y + p.h + 1) / T); for (let tx = Math.floor(p.x / T); tx <= Math.floor((p.x + p.w - 1) / T); tx++) if (isFragile(tx, fy) && !G.lock[fy][tx]) { const k = tx + ',' + fy; stand.add(k); G.crumb[k] = (G.crumb[k] || 0) + dt; if (G.crumb[k] > .45) { breakCrack(tx, fy); delete G.crumb[k]; } } }
      for (const k of Object.keys(G.crumb)) if (!stand.has(k)) { G.crumb[k] -= dt; if (G.crumb[k] <= 0) delete G.crumb[k]; }
    }
    if (p.ground && !p.wasGround) { p.squash = .3; SFX.land(); const hard = Math.min(1, Math.max(0, (p.impact || 0) - 120) / 280); spawnDust(p.x + 5, p.y + 14, 4 + Math.round(hard * 6), 28 + hard * 30); if (hard > .6) G.shake = Math.max(G.shake, 1.5); }
    // みどりのブロック=ばね
    if (p.ground && p.vy >= 0 && G.lifts.some(L => L.col === 3 && onLift(L))) { p.vy = -TU.BOUNCE; p.hover = TU.HOVER_T; p.free = true; p.ground = false; p.coyote = 0; p.squash = -.4; SFX.bounce(); spawnParts(p.x + 5, p.y + 14, 8, '#8FD18A', 40); }
    if (p.ground && p.vy >= 0) {
      const ty = Math.floor((p.y + p.h + 1) / T), tx0 = Math.floor(p.x / T), tx1 = Math.floor((p.x + p.w - 1) / T);
      for (let tx = tx0; tx <= tx1; tx++) if (colorAt(tx, ty) === 3) { p.vy = -TU.BOUNCE; p.hover = TU.HOVER_T; p.free = true; p.ground = false; p.coyote = 0; p.squash = -.4; SFX.bounce(); spawnParts(p.x + 5, p.y + 14, 8, '#8FD18A', 40); break; }
    }
    // あかいブロック=あつい(さわるとダメージ)
    for (const L of G.lifts) if (L.col === 1 && liftOn(L) && overlap(p.x - 1, p.y - 1, p.w + 2, p.h + 2, L.x, L.y, L.w, L.h)) hurtPlayer(null, false);
    for (let ty = Math.floor((p.y - 1) / T); ty <= Math.floor((p.y + p.h + 1) / T); ty++) for (let tx = Math.floor((p.x - 1) / T); tx <= Math.floor((p.x + p.w) / T); tx++)
      if (colorAt(tx, ty) === 1 && overlap(p.x - 1, p.y - 1, p.w + 2, p.h + 2, tx * T, ty * T, T, T)) hurtPlayer(null, false);
    // 落した
    if (p.y > G.level.h * T + 40) { killPlayer('fall'); G.hitstop = 0; G.flash = 0; G.shake = 0; }
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
    if (e.hp <= 0) { e.dead = true; if (e.type === 'bucket') restorePaint(e); spawnParts(e.x + e.w / 2, e.y + e.h / 2, 14, '#F5C842', 90); if (G.regen) G.pick.push({ type: 'spark', x: e.x + 2, y: e.y + 2, w: 8, h: 8, got: false, drop: true }); }
  }

  // ===== てき =====
  const hiddenAt = (cx, cy) => G.hideRow.has(cy) || G.hideCol.has(cx);
  // オートフィルの「つぎに ふえる セル」: じぶんの足もと(ゆか)の たかさで、むきの さきの、さいしょの あきマス
  function fillTarget(e) {
    const tx0 = Math.floor((e.x + e.w / 2) / T), ty = Math.floor((e.y + e.h / 2) / T) + 1, d = e.d || 1;
    for (let k = 1; k <= (e.reach || 12); k++) {
      const x = tx0 + d * k; if (!inb(x, ty)) return null; const f = G.front[ty][x];
      if (f === 0) return [x, ty];
      if (!isBlockT(f)) return null;
    }
    return null;
  }
  // オートフィル: ねらう ばんい(reach)の なかに、いま ある ブロックの かず。cap に たっしていると、つくらない(よせて ばんいの そとへ だすと、また つくる)
  function fillWindowCount(e) {
    const tx0 = Math.floor((e.x + e.w / 2) / T), ty = Math.floor((e.y + e.h / 2) / T) + 1, d = e.d || 1; let n = 0;
    for (let k = 1; k <= (e.reach || 12); k++) { const x = tx0 + d * k; if (!inb(x, ty)) break; if (isBlockT(G.front[ty][x])) n++; }
    return n;
  }
  const AF_COL = ['#C9A15E', '#E8563F', '#6FD6E8', '#58B368', '#F5C842'];
  // 条件つき書式: はんいの ブロックの いろを かえる(ガラス・鋼・カギは そのまま)
  function formatRange(r, col) {
    let n = 0;
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
      if (!inb(x, y) || G.front[y][x] !== TL.STONE || G.lock[y][x] || G.col[y][x] === GLASS || G.col[y][x] === col) continue;
      G.col[y][x] = col; n++; spawnParts(x * T + 8, y * T + 8, 3, ['#C9A15E', '#E8563F', '#6FD6E8', '#58B368', '#F5C842'][col] || '#fff', 40);
    }
    return n;
  }
  // 塗りつぶし: 足もとの ガラスに いろを ぬる(まもった ガラスは ぬれない)。ぬった マスは おぼえておく
  const paintableAt = (x, y) => inb(x, y) && isBlockT(G.front[y][x]) && !G.lock[y][x] && G.col[y][x] === GLASS;
  function paintCell(e, x, y) { G.front[y][x] = TL.GLASSED; G.col[y][x] = e.c; e.painted.push([x, y]); spawnParts(x * T + 8, y * T + 8, 4, AF_COL[e.c] || '#fff', 40); SFX.place(); }
  // 塗りつぶしを たおしたら、ぬった ガラスは もとの ガラスに もどる(うごかして その場に ないものは、そのまま)
  function restorePaint(e) {
    let n = 0;
    for (const [x, y] of e.painted || []) {
      if (!inb(x, y) || G.front[y][x] !== TL.GLASSED || G.col[y][x] !== e.c) continue;
      G.front[y][x] = TL.STONE; G.col[y][x] = GLASS; n++; spawnParts(x * T + 8, y * T + 8, 4, '#DCEBF3', 50);
    }
    e.painted = []; if (n) SFX.place();
  }
  // 並べ替え: はんいの ブロックを、かたほうへ よせて ならべなおす(鋼・磁石・カギ・ひび割れは しきり。ひとや てきの いる ところは そのまま)
  function slideRange(r, axis, dir) {
    const isB = (x, y) => G.front[y][x] === TL.STONE || G.front[y][x] === TL.GLASSED;
    const wall = (x, y) => { const t = G.front[y][x]; return t === TL.STEEL || t === TL.MAGNET || t === TL.CRACK || !!G.lock[y][x]; };
    const lines = axis === 'x' ? (r.y1 - r.y0 + 1) : (r.x1 - r.x0 + 1), len = axis === 'x' ? (r.x1 - r.x0 + 1) : (r.y1 - r.y0 + 1);
    let moved = 0;
    for (let li = 0; li < lines; li++) {
      const at = (k) => axis === 'x' ? [r.x0 + k, r.y0 + li] : [r.x0 + li, r.y0 + k];
      let k = 0;
      while (k < len) {
        const c0 = at(k); if (!inb(c0[0], c0[1]) || wall(c0[0], c0[1])) { k++; continue; }
        let k1 = k; const seg = [];
        while (k1 < len) { const c = at(k1); if (!inb(c[0], c[1]) || wall(c[0], c[1])) break; seg.push(c); k1++; }
        k = k1;
        const blocks = seg.filter(c => isB(c[0], c[1])).map(c => ({ f: G.front[c[1]][c[0]], c: G.col[c[1]][c[0]] }));
        if (!blocks.length || blocks.length === seg.length) continue;
        if (seg.some(c => cellBlocked(c[0], c[1]))) continue;
        const start = dir > 0 ? seg.length - blocks.length : 0, next = seg.map((c, i) => (i >= start && i < start + blocks.length) ? blocks[i - start] : null);
        if (seg.every((c, i) => (next[i] ? (isB(c[0], c[1]) && G.front[c[1]][c[0]] === next[i].f && G.col[c[1]][c[0]] === next[i].c) : !isB(c[0], c[1])))) continue;
        seg.forEach((c, i) => { if (next[i]) { G.front[c[1]][c[0]] = next[i].f; G.col[c[1]][c[0]] = next[i].c; } else { G.front[c[1]][c[0]] = TL.EMPTY; G.col[c[1]][c[0]] = 0; } });
        moved += blocks.length; spawnParts(seg[0][0] * T + 8, seg[0][1] * T + 8, 3, '#ADB9CA', 40);
      }
    }
    return moved;
  }
  // 循環参照: ループの ふちを、マスに そって うごく ばしょ(きょりは px)
  function loopPos(lp, d) {
    const w = (lp.x1 - lp.x0) * T, h = (lp.y1 - lp.y0) * T, per = 2 * (w + h); d = ((d % per) + per) % per;
    let x, y, dir;
    if (d < w) { x = d; y = 0; dir = 1; } else if (d < w + h) { x = w; y = d - w; dir = 1; } else if (d < 2 * w + h) { x = w - (d - w - h); y = h; dir = -1; } else { x = 0; y = h - (d - 2 * w - h); dir = -1; }
    return { x: lp.x0 * T + x, y: lp.y0 * T + y, dir };
  }
  // ===== てき図鑑 =====
  const DEX = [
    ['walker', 'てくてく', 'ゆかを まっすぐ あるく。ふちや かべに ぶつかると ひきかえす。上から ふむと たおせる'],
    ['guard', 'かたいこうら', 'かたい こうらを もつ。2かい ふまないと たおせない'],
    ['flyer', 'ふわふわ', 'くうちゅうを ゆらゆら ただよう。上から ふむと たおせる'],
    ['turret', 'たまうち', 'エナーの ほうを むいて、たまを うつ。うつ まえに 光る。ふめないし、たおせない。光った ときに、たまの みちから はずれよう'],
    ['div0', '#DIV/0!', 'エラーの かたまり。ふめないし、たおせない。ゆっくり おうふく するので、タイミングを みて よけよう'],
    ['autofill', 'オートフィル', 'ゆかを どんどん コピーして ふやす。つくる ブロックの いろは、しゅるいで ちがう（赤や 氷も）。ねらう マスが 光る。ふむと たおせる'],
    ['moji', 'しろい文字', 'しろい シートに とけこむ、ほとんど みえない 文字。ちかづくと あらわれて、おいかけてくる。ふむと たおせる'],
    ['condfmt', '条件つき書式', 'ふわふわ ういて、はんいの ブロックの いろを、ときどき かってに かえる。かえる まえに、はんいが ちかちか する。はんいが ふたつ ある ときは、かわる いろが ずれる。ふむと たおせる'],
    ['bucket', '塗りつぶし', 'ゆかを あるいて、ガラスの上で 立ちどまっては、足もとを 1マスずつ ぬっていく。ぬる とき、足もとが ちかちか する。まもった ガラスには ぬれない。ふむと たおせて、ぬった ガラスは ぜんぶ もとに もどる'],
    ['shuffler', '並べ替え', 'はんいの ブロックを、ときどき かたほうへ よせて ならべなおす。よせる まえに、はんいが 光る。たてに よせる なかまも いる。2かい ふむと たおせる'],
    ['circ', '循環参照', 'マスに そって、かどで 直角に まがりながら、おなじ ところを ぐるぐる まわる。ふめないし、たおせない。みちすじが うすく 見えるので、タイミングを みて とおりぬけよう'],
    ['fake', 'にせブロック', 'ブロックに ばけている。とおくでは みわけが つかず、ちかづくと 目が みえる。かべのように 立ちふさがるけれど、ダメージは ない。ふむことも、へんしゅうも コピーも きかない。でも あつい（赤い）ブロックが となりに くると、あつがって 1マス はなれる'],
  ];
  function seeEnemy(type) {
    save.seenEnemies = save.seenEnemies || {}; if (save.seenEnemies[type]) return;
    save.seenEnemies[type] = true; persist();
    const d = DEX.find(x => x[0] === type); if (d && UI.toast) UI.toast('てき図鑑に のったよ：' + d[1], 2600);
  }
  function updateEnemies(dt) {
    const p = G.p;
    for (const e of G.enemies) {
      if (e.dead) continue;
      e.hidden = hiddenAt(Math.floor((e.x + e.w / 2) / T), Math.floor((e.y + e.h / 2) / T)); // かくしたぎょう・れつのてきは、そこにいない扱い
      e.t += dt; if (e.flash > 0) e.flash -= dt;
      if (e.hidden) continue;
      if (!save.seenEnemies || !save.seenEnemies[e.type]) { if (e.type === 'moji' ? e.awake : e.type === 'fake' ? e.look === 2 : (Math.abs(p.x - e.x) < 150 && Math.abs(p.y - e.y) < 100)) seeEnemy(e.type); } // てき図鑑に のる
      if (e.stun > 0) { e.stun -= dt; continue; }
      if (e.type === 'fake') { // にせブロック: あるかない。とおくでは ただの ブロック→ちかいと とじた目→かなり ちかいと 目が あいて こちらを 目で おう
        const dx = (p.x + 5) - (e.x + 7), dy = (p.y + 7) - (e.y + 7), d = Math.hypot(dx, dy);
        const look = p.dead ? 0 : d < 30 ? 2 : d < 64 ? 1 : 0;
                e.look = look; e.ex = dx; e.ey = dy;
        // あつい(赤い)ブロックが となりに くると、あつがって 1マス はなれる(はんたいがわへ)
        const tx0 = e.gx * T + 1, ty0 = e.gy * T + 2;
        if (e.mv > 0) { e.mv -= dt; const k = Math.max(0, e.mv / .5); if (Math.random() < dt * 40) { const sd = Math.random() < .5 ? -1 : 1; G.parts.push({ x: e.x + 7 + sd * 5, y: e.y + 3, vx: sd * (25 + Math.random() * 35), vy: -50 - Math.random() * 40, g: 260, s: 2, life: .45 + Math.random() * .25, col: Math.random() < .5 ? '#8FD0FF' : '#D6EEFF' }); } e.x = tx0 - e.fdx * T * k; e.y = ty0 - e.fdy * T * k; if (e.mv <= 0) { e.mv = 0; e.x = tx0; e.y = ty0; } }
        else {
          const hot = (x, y) => colorAt(x, y) === 1;
          const tries = [[hot(e.gx - 1, e.gy), 1, 0], [hot(e.gx + 1, e.gy), -1, 0], [hot(e.gx, e.gy - 1), 0, 1], [hot(e.gx, e.gy + 1), 0, -1]];
          for (const [h, mx, my] of tries) {
            if (!h) continue;
            const nx = e.gx + mx, ny = e.gy + my;
            if (solidCell(nx, ny) || liftRailHit(nx, ny)) continue;
            if (overlap(nx * T, ny * T, T, T, p.x, p.y, p.w, p.h)) continue;
            if (G.enemies.some(o => o !== e && !o.dead && overlap(nx * T, ny * T, T, T, o.x, o.y, o.w, o.h))) continue;
            e.gx = nx; e.gy = ny; e.fdx = mx; e.fdy = my; e.mv = .5; SFX.bad(); spawnParts(e.x + 7, e.y + 7, 5, '#E8563F', 40); break;
          }
        }
      }
      if (e.type === 'moji' && !e.awake) { // ぎたい中: ちかづくと しょうたいを あらわす
        if (Math.abs(p.x + 5 - (e.x + 6)) < 46 && Math.abs(p.y - e.y) < 30 && !p.dead) { e.awake = true; e.t = 0; SFX.bad(); spawnParts(e.x + 6, e.y + 4, 8, '#fff', 60); G.shake = Math.max(G.shake, 2); }
        continue;
      }
      if (e.type === 'autofill') {
        e.dir = e.d; e.cd -= dt;
        if (e.cd <= 0) { const tg = fillTarget(e); e.cd = e.rate; if (tg && e.made < e.max && fillWindowCount(e) < e.cap && !cellBlocked(tg[0], tg[1])) {
          const below = G.front[tg[1]][Math.floor((e.x + e.w / 2) / T)], sc = isBlockT(below) ? G.col[tg[1]][Math.floor((e.x + e.w / 2) / T)] : 0;
          G.front[tg[1]][tg[0]] = TL.STONE; G.col[tg[1]][tg[0]] = e.c !== undefined ? e.c : (sc === GLASS ? 0 : sc); G.lock[tg[1]][tg[0]] = 0; e.made++; SFX.place(); spawnParts(tg[0] * T + 8, tg[1] * T + 8, 6, e.c !== undefined ? AF_COL[e.c] : '#70AD47', 40); } }
      }
      if (e.type === 'walker' || e.type === 'guard' || e.type === 'div0' || e.type === 'moji' || e.type === 'fake' || e.type === 'bucket') {
        // おもさとあるぎょう(縁やかべで折り返す)
        if (e.type !== 'fake') { e.vy = (e.vy || 0) + 900 * dt; if (moveY(e, e.vy * dt)) e.vy = 0; } // にせブロックは その場に ある
        const spd = e.type === 'guard' ? 22 : e.type === 'div0' ? 18 : e.type === 'moji' ? 36 : 28;
        if (e.lim) { const mc = (e.x + e.w / 2) / T; if (mc < e.lim[0] + .5) e.dir = 1; else if (mc > e.lim[1] + .5) e.dir = -1; } // 行ったり来たりの はんい(マス)
        if (e.type === 'moji') e.dir = (p.x + 5 > e.x + 6) ? 1 : -1;
        const ahead = e.dir > 0 ? e.x + e.w + 2 : e.x - 2;
        const floorAhead = solidCell(Math.floor(ahead / T), Math.floor((e.y + e.h + 2) / T));
        const wall = boxHitsSolid(e.x + e.dir * 2, e.y, e.w, e.h - 1);
        const bkx = Math.floor((e.x + e.w / 2) / T), bky = Math.floor((e.y + e.h + 1) / T);
        const bkOn = e.type === 'bucket' && paintableAt(bkx, bky) && Math.abs((e.x + e.w / 2) - (bkx * T + T / 2)) <= 2; // ガラスの まんなかに きたら 立ちどまる
        if (e.type === 'fake') { /* あるかない */ } else if (bkOn) { /* 塗るあいだは 立ちどまる */ } else if (!floorAhead || wall) { if (e.type !== 'moji') e.dir = -e.dir; } else moveX(e, e.dir * spd * dt);
        if (e.type === 'bucket') { // 立ちどまって、足もとが ちかちか してから ぬる。ぬりおわったら また すすむ
          if (bkOn) { e.pt += dt; e.ptc = [bkx, bky]; if (e.pt >= 1) { paintCell(e, bkx, bky); e.pt = 0; } } else e.pt = 0;
        }
      } else if (e.type === 'condfmt' || e.type === 'shuffler') {
        e.cd -= dt; e.tele = e.cd < 1 ? 1 : 0; e.dir = (p.x + 5 > e.x + 6) ? 1 : -1;
        if (e.cd <= 0) {
          e.cd = 4.2; let n = 0;
          if (e.type === 'condfmt') { e.step++; e.ranges.forEach((r, k) => { n += formatRange(r, e.seq[(e.step + k) % e.seq.length]); }); }
          else { e.ranges.forEach(r => { n += slideRange(r, e.axis, e.sdir); }); e.sdir = -e.sdir; }
          if (n) SFX.place();
        }
      } else if (e.type === 'circ') {
        const q = loopPos(e.loop, e.t * 38); e.x = q.x + 2; e.y = q.y + 2; e.dir = q.dir;
      } else if (e.type === 'flyer') {
        const px = e.x;
        e.x = e.bx + Math.sin(e.t * 1.1) * e.range; e.y = e.by + Math.sin(e.t * 2.2) * 4; e.dir = e.x > px ? 1 : -1;
      } else if (e.type === 'turret') {
        e.cd -= dt; e.dir = (p.x + 5 > e.x + 6) ? 1 : -1;
        if (e.cd < .5) e.tele = 1; else e.tele = 0;
        if (e.cd <= 0 && Math.abs(p.x - e.x) < 150) { e.cd = 2.2; G.bullets.push({ x: e.x + 6 + e.dir * 8, y: e.y + 4, w: 4, h: 4, vx: e.dir * 85 }); }
      }
      // 接触ダメージ・ダッシュ攻撃
      if (!p.dead && e.type !== 'fake' && overlap(p.x, p.y, p.w, p.h, e.x, e.y, e.w, e.h)) {
        if (p.dashT > 0 && (e.type === 'guard' || e.type === 'walker' || e.type === 'flyer' || e.type === 'moji')) { if (e.type === 'guard') { e.stun = .8; } damageEnemy(e, 1); p.dashT = 0; p.vx = -p.face * 60; }
        else if (p.vy > 60 && p.y + p.h - 6 < e.y + 4 && e.type !== 'turret' && e.type !== 'div0' && e.type !== 'circ') { damageEnemy(e, 1); p.vy = -240; p.hover = TU.HOVER_T; p.free = true; p.dashAvail = true; } // ふみつけ
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
        if (k.type === 'gem') { G.gems++; SFX.gem(); spawnRing(k.x + 4, k.y + 4, 12, 75, EXCEL ? '#70AD47' : '#7FA2F0'); spawnParts(k.x + 4, k.y + 4, 6, '#fff', 50); G.hitstop = Math.max(G.hitstop, .04); }
        else { G.energy = Math.min(G.maxE, G.energy + 15); SFX.spark(); spawnParts(k.x + 4, k.y + 4, 5, '#F5C842', 40); }
      }
    }
    for (const c of G.checks) {
      if (c.gone) continue;
      if (!c.on && Math.abs(p.x - c.x) < 10 && Math.abs(p.y - c.y) < 24) { c.on = true; G.respawn = { x: c.x + 3, y: c.y + 2 }; SFX.check(); UI.toast('チェックポイント'); }
    }
    const f = G.flag;
    if (!G.cleared && overlap(p.x, p.y, p.w, p.h, f.x, f.y, f.w, f.h)) winLevel();
  }
  // ステージを つくる ページからの テストプレイ(?from=editor): クリアしても きろくを のこさず、すぐ つくる がめんに もどる
  const EDITOR_TEST = /[?&]from=editor/.test(location.search);
  const backToEditor = () => { location.href = 'editor.html?edit=' + encodeURIComponent(G.level.id); };
  // ランク: Σぜんぶ・ノーミス・ムダなし(つかったコスト ≦ もくひょうコスト)の たっせい数。ムダなしが ないステージ(どうぐなし等)は 2つで はかる
  const parApplies = (lv) => lv.par > 0 && lv.tools.length > 0 && !lv.regen;
  const rankOf = (goals, lv) => { const poss = parApplies(lv) ? 3 : 2, got = (goals[1] ? 1 : 0) + (goals[2] ? 1 : 0) + (parApplies(lv) && goals[3] ? 1 : 0); return ['S', 'A', 'B', 'C'][poss - got]; };
  const RANK_ORD = { S: 0, A: 1, B: 2, C: 3 };
  function winLevel() {
    G.cleared = true; G.clearT = 0; G.confT = 0; spawnConfetti(G.flag.x + G.flag.w / 2, G.flag.y + 4, 36);
    if (EDITOR_TEST) { SFX.win(); UI.toast('クリア！ ステージ作成に戻ります', 1500); setTimeout(() => { if (G.cleared) backToEditor(); }, 1300); return; }
    // もくひょう(バッジ)。それぞれ別に記録する: ①クリア ②Σ(ほうせき)を全部 ③ノーミス(ダメージをうけない) ④ムダなし(コストが もくひょう いか)
    const lv = G.level; const hadAll = lv.gems.length > 0 && gemsOf(lv, save.levels[lv.id]) >= lv.gems.length; // はじめて ぜんぶ あつめたか
    const goals = [true, G.gems >= lv.gems.length, G.deaths === 0 && G.hits === 0, parApplies(lv) && G.spent <= lv.par];
    const rank = rankOf(goals, lv); G.lastRank = rank; G.lastGoals = goals; G.newNote = !practice && lv.gems.length > 0 && goals[1] && !hadAll && !!FRAG_NOTES[lv.id];
    if (rank === 'S') SFX.perfect(); else SFX.win();
    if (practice) { setTimeout(() => { if (G.cleared) UI.showResult(goals); }, 800); return; } // れんしゅうモードは、きろくを のこさない
    const prev = save.levels[lv.id] || { goals: [false, false, false, false] };
    const merged = goals.map((v, i) => v || !!(prev.goals && prev.goals[i]));
    const bestRank = prev.rank && RANK_ORD[prev.rank] < RANK_ORD[rank] ? prev.rank : rank;
    save.levels[lv.id] = { goals: merged, rank: bestRank, gemsBest: Math.max(prev.gemsBest || (prev.goals && prev.goals[1] ? lv.gems.length : 0), G.gems), time: Math.min(prev.time || 1e9, Math.round(G.time * 10) / 10) };
    if (save.fails) save.fails[lv.id] = 0; // たすけぶねは、クリアで おわり
    persist();
    setTimeout(() => { if (G.cleared) UI.showResult(goals); }, 800);
  }
  // 3つのもくひょうのバッジ: ✓クリア / Σが3つそろう / ノーミス（ダメージをうけない）
  function badgesHTML(goals, gemsGot, total, big, par) {
    const n = (total === undefined ? 3 : total); let sg = '';
    for (let i = 0; i < Math.min(n, 5); i++) sg += '<i class="sg' + (i < gemsGot ? ' on' : '') + '"></i>';
    return '<span class="bds' + (big ? ' big' : '') + '"><span class="bd ck' + (goals[0] ? ' on' : '') + '">✓</span>' + (n ? '<span class="bd sgs' + (goals[1] ? ' all' : '') + '">' + sg + '</span>' : '') + '<span class="bd pf' + (goals[2] ? ' on' : '') + '">ノーミス</span>' + (par ? '<span class="bd pf' + (goals[3] ? ' on' : '') + '">ムダなし</span>' : '') + '</span>';
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
    if (!cells.length) return fail('動かせるブロックがありません');
    const rect = { x0: dx, y0: dy, x1: dx + (src.x1 - src.x0), y1: dy + (src.y1 - src.y0) }, ghost = [];
    for (const c of cells) {
      const tx = c.x - src.x0 + dx, ty = c.y - src.y0 + dy;
      if (!inb(tx, ty)) return fail('範囲からはみ出します', { rects: [rect], ghost });
      ghost.push({ x: tx, y: ty, t: c.t, c: c.c });
      if (!(G.front[ty][tx] === 0 || keys.has(key(tx, ty)))) return fail('ほかのものにぶつかります', { rects: [rect], ghost });
      if (cellBlocked(tx, ty)) return fail('エナーやリフトの通り道が邪魔です', { rects: [rect], ghost });
    }
    if (cells.every(c => c.x - src.x0 + dx === c.x && c.y - src.y0 + dy === c.y)) return fail('移動先が同じです');
    return { ok: true, cost: costOf('move'), rects: [src, rect], ghost, run() {
      for (const c of cells) { G.front[c.y][c.x] = 0; G.col[c.y][c.x] = 0; }
      for (const c of cells) { const tx = c.x - src.x0 + dx, ty = c.y - src.y0 + dy; G.front[ty][tx] = c.t; G.col[ty][tx] = c.c; }
    } };
  }
  function planSwap(a, dx, dy) {
    const w = a.x1 - a.x0, h = a.y1 - a.y0, b = { x0: dx, y0: dy, x1: dx + w, y1: dy + h };
    if (!inb(b.x0, b.y0) || !inb(b.x1, b.y1)) return fail('範囲からはみ出します', { rects: [a, b] });
    if (!(a.x1 < b.x0 || b.x1 < a.x0 || a.y1 < b.y0 || b.y1 < a.y0)) return fail('ブロックが重なります', { rects: [a, b] });
    const pairs = []; let changed = false;
    for (let j = 0; j <= h; j++) for (let i = 0; i <= w; i++) {
      const ax = a.x0 + i, ay = a.y0 + j, bx = b.x0 + i, by = b.y0 + j;
      if ((G.front[ay][ax] !== 0 && isFixedCell(ax, ay)) || (G.front[by][bx] !== 0 && isFixedCell(bx, by))) return fail('動かせないセルが含まれています', { rects: [a, b] });
      if (G.front[ay][ax] !== G.front[by][bx] || G.col[ay][ax] !== G.col[by][bx]) changed = true;
      if (G.front[ay][ax] !== 0 && cellBlocked(bx, by)) return fail('エナーやリフトの通り道が邪魔です', { rects: [a, b] });
      if (G.front[by][bx] !== 0 && cellBlocked(ax, ay)) return fail('エナーやリフトの通り道が邪魔です', { rects: [a, b] });
      pairs.push([ax, ay, bx, by]);
    }
    if (!changed) return fail('入れ替えても変わりません', { rects: [a, b] });
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
    const cells = []; rectEach(r, (x, y) => { if (isMovable(x, y) && G.col[y][x] === GLASS) cells.push([x, y]); }); // いろをつけられるのは、ガラス(いろなし)だけ
    if (!cells.length && !ls.length) return fail('ガラスがありません。色をつけられるのはガラスだけです', { rects: [r] });
    const hl = cells.slice(); for (const L of ls) for (let x = Math.floor(L.x / T); x * T < L.x + L.w; x++) hl.push([x, Math.floor(L.y / T)]);
    return { ok: true, cost: costOf(id), rects: [r], hl, run() { for (const [x, y] of cells) { G.col[y][x] = c; G.front[y][x] = TL.GLASSED; } for (const L of ls) { L.col = c; L.mark = true; } } };
  }
  function planTransform(r, op) {
    const w = r.x1 - r.x0 + 1, h = r.y1 - r.y0 + 1;
    if ((op === 'rot' || op === 'trans') && w !== h) return fail('正方形で選んでください（現在 ' + w + '×' + h + '）', { rects: [r] });
    const map = (lx, ly) => ({ flipH: [w - 1 - lx, ly], flipV: [lx, h - 1 - ly], rot: [h - 1 - ly, lx], trans: [ly, lx] }[op]);
    const cells = [], vacated = new Set();
    rectEach(r, (x, y) => { if (isMovable(x, y)) { cells.push({ x, y, t: G.front[y][x], c: G.col[y][x] }); vacated.add(key(x, y)); } });
    if (!cells.length) return fail('動かせるブロックがありません', { rects: [r] });
    let changed = false;
    for (const c of cells) {
      const [nx, ny] = map(c.x - r.x0, c.y - r.y0); c.tx = r.x0 + nx; c.ty = r.y0 + ny;
      if (!inb(c.tx, c.ty)) return fail('範囲からはみ出します', { rects: [r] });
      if (!(G.front[c.ty][c.tx] === 0 || vacated.has(key(c.tx, c.ty)))) return fail('動かせないセルにぶつかります', { rects: [r] });
      if (cellBlocked(c.tx, c.ty)) return fail('エナーやリフトの通り道が邪魔です', { rects: [r] });
      if (c.tx !== c.x || c.ty !== c.y) changed = true;
    }
    if (!changed) return fail('形を変えても同じです', { rects: [r] });
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
    if (from === to) return fail('元の色と変更先の色が同じです', { rects: [r] });
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
    if (!G.hideRow.size && !G.hideCol.size) return fail('隠れている行・列はありません');
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
    if (x < 1 || x > w - 2) return fail('ここには入れられません', { cols: [x] });
    for (let y = 0; y < h; y++) if (isBlk(w - 1, y)) return fail('右端のブロックがはみ出します', { cols: [x] });
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
    if (colOfX(G.p.x + 5) === x) return fail('エナーがいる列は消せません', { cols: [x] });
    if (colOfX(G.flag.x) === x) return fail('ゴールがある列は消せません', { cols: [x] });
    return { ok: true, cost: costOf('delCol'), cols: [x], run() {
      for (let y = 0; y < h; y++) {
        const lastSteel = G.front[y][w - 1] === TL.STEEL;
        for (let xx = x; xx < w - 1; xx++) { G.front[y][xx] = G.front[y][xx + 1]; G.col[y][xx] = G.col[y][xx + 1]; G.lock[y][xx] = G.lock[y][xx + 1]; }
        G.front[y][w - 1] = lastSteel ? TL.STEEL : 0; G.col[y][w - 1] = 0; G.lock[y][w - 1] = 0;
      }
      shiftEntities(x, -1, true); shiftSets(x, -1, true);
    } };
  }
  // 改ページプレビュー(見える範囲の せいげん): あおい枠(エナーのまわり)と、印刷範囲の設定で ひろげた ところが 「見える」
  function fogFrame() {
    const f = G.fog, k = G.zoomT > 0 ? 2 : 1, px = Math.floor((G.p.x + 5) / T), py = Math.floor((G.p.y + 7) / T), hw = Math.floor(f.w * k / 2), hh = Math.floor(f.h * k / 2);
    return { x0: px - hw, y0: py - hh, x1: px + hw, y1: py + hh };
  }
  function fogRects() { return G.fog ? [fogFrame()].concat(G.areas || []) : null; }
  function cellVisible(x, y) { if (!G.fog) return true; return fogRects().some(r => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1); }
  function rectAllVisible(r) { for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) if (inb(x, y) && !cellVisible(x, y)) return false; return true; }
  function planFor(tool, a) {
    const o = a.opts || G.edit.opts;
    if (G.fog && tool !== 'zoom' && tool !== 'filter') {
      if (G.zoomT > 0) return fail('ズーム中は、なおせません');
      const outMsg = 'あおい枠の外は、なおせません（「印刷範囲の設定」で、見える所を ひろげられます）';
      if (tool === 'printarea') {
        let any = false; rectEach(a.rect, (x, y) => { if (cellVisible(x, y)) any = true; });
        if (!any) return fail('いまの見える範囲と、重ねて選んでください', { rects: [a.rect] });
      } else {
        if (a.rect && !rectAllVisible(a.rect)) return fail(outMsg, { rects: [a.rect] });
        if (a.srcCell && !cellVisible(a.srcCell[0], a.srcCell[1])) return fail(outMsg);
        if (a.dst && !cellVisible(a.dst[0], a.dst[1])) return fail(outMsg);
      }
    }
    switch (tool) {
      case 'printarea': { const r = a.rect, n = (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1);
        if (!G.fog) return fail('このステージでは、使えません');
        if (n > 40) return fail('ひろすぎます（40マスまで）', { rects: [r] });
        if ((G.areas || []).length >= 3) return fail('これ以上は、設定できません（3か所まで）');
        return { ok: true, cost: costOf('printarea'), rects: [r], run() { G.areas.push({ x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1 }); SFX.place(); } }; }
      case 'zoom': if (!G.fog) return fail('このステージでは、使えません'); return { ok: true, cost: costOf('zoom'), run() { G.zoomT = 5; } };
      case 'painter': { const [sx, sy] = a.srcCell; if (!inb(sx, sy) || !isBlk(sx, sy)) return fail('コピー元のブロックがありません'); if (G.front[sy][sx] === TL.MAGNET) return fail('磁石はコピーできません'); if (G.col[sy][sx] === GLASS) return fail('色のないガラスはコピー元にできません'); return planColor(a.rect, G.col[sy][sx], 'painter'); }
      case 'transform': return planTransform(a.rect, o.tf);
      case 'sort': return planSort(a.rect, o.sort);
      case 'filter': return planFilter(a.fcolor !== undefined ? a.fcolor : o.fcolor);
      case 'protect': return planProtect(a.rect, true);
      case 'unprotect': return planProtect(a.rect, false);
    }
    return fail('この道具は使えません');
  }

  // ---- 実ぎょう・もとにもどす・やり直す(状態をまるごと保存する) ----
  function minCost() { let m = 999; for (const id of G.level.tools) m = Math.min(m, TOOL_BY[id].cost); return m; }
  function snapshot() {
    return {
      front: G.front.map(r => r.slice()), col: G.col.map(r => r.slice()), lock: G.lock.map(r => r.slice()), under: JSON.stringify(G.under),
      hideRow: [...G.hideRow], hideCol: [...G.hideCol], filter: G.filter, lc: G.lifts.map(L => L.col), lm: G.lifts.map(L => !!L.mark),
      en: G.enemies.map(e => ({ e, x: e.x, y: e.y, bx: e.bx, dead: e.dead })), pick: G.pick.map(k => ({ k, x: k.x, gone: !!k.gone })),
      checks: G.checks.map(c => ({ c, x: c.x, gone: !!c.gone })), flagX: G.flag.x, resp: { x: G.respawn.x, y: G.respawn.y }, px: G.p.x,
      areas: (G.areas || []).map(r => Object.assign({}, r)), zt: G.zoomT || 0,
    };
  }
  function restoreSnap(s) {
    G.mgs = []; G.under = s.under ? JSON.parse(s.under) : {};
    G.front = s.front.map(r => r.slice()); G.col = s.col.map(r => r.slice()); G.lock = s.lock.map(r => r.slice());
    G.hideRow = new Set(s.hideRow); G.hideCol = new Set(s.hideCol); G.filter = s.filter; if (s.lc) s.lc.forEach((c, i) => { G.lifts[i].col = c; G.lifts[i].mark = !!(s.lm && s.lm[i]); });
    for (const o of s.en) { o.e.x = o.x; o.e.y = o.y; if (o.bx !== undefined) o.e.bx = o.bx; o.e.dead = o.dead; }
    for (const o of s.pick) { o.k.x = o.x; o.k.gone = o.gone; }
    for (const o of s.checks) { o.c.x = o.x; o.c.gone = o.gone; }
    G.flag.x = s.flagX; G.respawn = { x: s.resp.x, y: s.resp.y }; G.p.x = s.px;
    G.areas = (s.areas || []).map(r => Object.assign({}, r)); G.zoomT = s.zt || 0;
  }
  function runPlan(plan) {
    const E = G.edit;
    if (!plan.ok) { E.msg = plan.msg; SFX.bad(); return false; }
    if (!practice && plan.cost > G.energy) { E.msg = 'エナジー不足（' + plan.cost + '）'; SFX.bad(); return false; }
    E.undo.push({ state: snapshot(), cost: plan.cost }); E.redo.length = 0;
    plan.run(); G.mgs = []; if (!practice) G.energy -= plan.cost; G.spent += plan.cost; E.msg = ''; SFX.place();
    if (!practice && !G.regen && G.energy < minCost()) UI.toast('コストを使い切り、もう編集できません。Rで最初から', 3500);
    return true;
  }
  function undoEdit() {
    const E = G.edit, u = E.undo.pop(); if (!u) { SFX.bad(); return; }
    E.redo.push({ state: snapshot(), cost: u.cost }); restoreSnap(u.state); G.spent = Math.max(0, G.spent - u.cost); if (!practice) G.energy = Math.min(G.maxE, G.energy + u.cost); SFX.place(); E.step = 0; E.src = null; E.msg = '';
  }
  function redoEdit() {
    const E = G.edit, r = E.redo.pop(); if (!r) { SFX.bad(); return; }
    if (!practice && G.energy < r.cost) { E.redo.push(r); E.msg = 'エナジーが足りません'; SFX.bad(); return; }
    E.undo.push({ state: snapshot(), cost: r.cost }); restoreSnap(r.state); if (!practice) G.energy -= r.cost; G.spent += r.cost; SFX.place();
  }
  function setEdit(on) {
    const E = G.edit; if (G.mode !== 'play' || G.cleared || G.p.dead) return;
    if (!G.level.tools.length) { UI.toast('このステージでは「なおす」を使えません'); return; }
    if (on && G.fog && G.zoomT > 0) { UI.toast('ズーム中は、なおせません'); return; }
    E.on = on; E.pan = false; E.sel = null; E.kb = null; E.msg = ''; E.step = 0; E.src = null; E.srcCell = null;
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
      if (!hasMovable(r)) { E.msg = '動かせるブロックがありません'; SFX.bad(); } else { E.src = r; E.step = 1; E.msg = ''; SFX.place(); }
    } else if (d.mode === 'painter' && E.step === 1) { if (runPlan(planFor('painter', { rect: r, srcCell: E.srcCell }))) { /* つづけてぬれる */ } }
    UI.refreshTools();
  }
  function onTap(tx, ty) {
    const E = G.edit, d = toolDef(); if (!d) return;
    if (d.mode === 'two' && E.step === 1) { if (runPlan(planFor(E.tool, { rect: E.src, dst: [tx, ty] }))) { E.step = 0; E.src = null; } }
    else if (d.mode === 'painter' && E.step === 0) {
      if (inb(tx, ty) && G.front[ty][tx] === TL.MAGNET) { E.msg = '磁石はコピーできません'; SFX.bad(); }
      else if (inb(tx, ty) && isBlk(tx, ty)) { E.srcCell = [tx, ty]; E.step = 1; E.msg = ''; SFX.place(); } else { E.msg = 'ブロックをタップしてください'; SFX.bad(); }
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
  // じしゃくどうしも くっつく: となりあった じしゃくは「ひとかたまり」で、いっしょに うごき、1つでも はがねに くっついたら かたまり ぜんたいが とまる
  const magSpeed = () => TU.RUN; // しゅじんこうがあるくのと、おなじはやさ
  const MAG_DIRS = [[0, 1], [-1, 0], [1, 0], [0, -1]]; // した・ひだり・みぎ・うえ(おなじ距離なら、この順)
  const isGhost = (x, y) => { const t = G.front[y][x]; return isBlockT(t) && t !== TL.MAGNET && !blockVisible(x, y); };
  const mk = (x, y) => x + ',' + y;
  function magClusters() { // となりあう じしゃく(4ほうこう)を、ひとかたまりに
    const seen = new Set(), out = [];
    for (let y = 0; y < G.level.h; y++) for (let x = 0; x < G.level.w; x++) {
      if (G.front[y][x] !== TL.MAGNET || seen.has(mk(x, y))) continue;
      const cells = [], q = [[x, y]]; seen.add(mk(x, y));
      while (q.length) { const [cx, cy] = q.pop(); cells.push([cx, cy]); for (const [dx, dy] of MAG_DIRS) { const nx = cx + dx, ny = cy + dy; if (inb(nx, ny) && G.front[ny][nx] === TL.MAGNET && !seen.has(mk(nx, ny))) { seen.add(mk(nx, ny)); q.push([nx, ny]); } } }
      out.push(cells);
    }
    return out;
  }
  // かたまりが ひきよせられる むき {dx,dy}。はがねに くっついているか、ひきよせる はがねが ないと null(=うごかない)
  function clusterPull(cells) {
    const set = new Set(cells.map(c => mk(c[0], c[1])));
    for (const [x, y] of cells) for (const [dx, dy] of MAG_DIRS) { const nx = x + dx, ny = y + dy; if (inb(nx, ny) && G.front[ny][nx] === TL.STEEL) return null; } // はがねに くっついている
    let best = null;
    for (const [x, y] of cells) for (const [dx, dy] of MAG_DIRS) {
      let own = 0;
      for (let d = 1; ; d++) {
        const tx = x + dx * d, ty = y + dy * d; if (!inb(tx, ty)) break;
        if (G.doors.some(q => !q.open && tx === q.x && ty >= q.y && ty < q.y + q.h)) break;
        if (set.has(mk(tx, ty))) { own++; continue; } // かたまりの なかまは とびこえる
        const t = G.front[ty][tx]; if (t === 0) continue;
        if (isGhost(tx, ty)) continue; // フィルターで うすくなった ブロックは、すりぬけられる
        if (t === TL.STEEL) { const de = d - own; if (!best || de < best.d) best = { dx, dy, d: de }; break; }
        break; // ほかの ブロック(なかま いがいの じしゃく も)が あるので、このむきは はたらかない
      }
    }
    return best;
  }
  function clusterFree(cells, dx, dy) { // つぎの マスに すすめるか(ひと・てきが いると、まつ)
    const set = new Set(cells.map(c => mk(c[0], c[1])));
    for (const [x, y] of cells) {
      const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) return false;
      if (!set.has(mk(nx, ny)) && G.front[ny][nx] !== 0 && !isGhost(nx, ny)) return false;
      if (G.doors.some(q => !q.open && nx === q.x && ny >= q.y && ny < q.y + q.h)) return false;
      for (const r of actorRects()) if (overlap(nx * T, ny * T, T, T, r.x, r.y, r.w, r.h)) return false;
    }
    return true;
  }
  function moveCluster(m) { // 1マス すすめる(さきの じしゃくから じゅんに)
    const order = m.cells.slice().sort((a, b) => (b[0] * m.dx + b[1] * m.dy) - (a[0] * m.dx + a[1] * m.dy));
    for (const c of order) {
      const x = c[0], y = c[1], nx = x + m.dx, ny = y + m.dy, ok = mk(x, y), nk = mk(nx, ny), prev = G.under[ok];
      if (G.front[ny][nx] !== 0) G.under[nk] = { t: G.front[ny][nx], c: G.col[ny][nx], l: G.lock[ny][nx] }; // うすくなった ブロックの うえを とおる: したに のこしておく
      G.front[ny][nx] = G.front[y][x]; G.col[ny][nx] = G.col[y][x]; G.lock[ny][nx] = G.lock[y][x];
      if (prev) { G.front[y][x] = prev.t; G.col[y][x] = prev.c; G.lock[y][x] = prev.l; delete G.under[ok]; } else { G.front[y][x] = 0; G.col[y][x] = 0; G.lock[y][x] = 0; }
      c[0] = nx; c[1] = ny;
    }
  }
  // ===== ギミック: マグマ(赤)と氷(青)が たて・よこに となりあうと、どちらも ふつうの(茶色の)ブロックに なる =====
  function meltCheck() {
    const lv = G.level; if (!lv || G.edit.on) return;
    const kind = (tx, ty) => { if (!inb(tx, ty)) return -1; const t = G.front[ty][tx]; if ((t !== TL.STONE && t !== TL.GLASSED) || !blockVisible(tx, ty)) return -1; const c = G.col[ty][tx]; return c === 1 || c === 2 ? c : -1; };
    const hit = new Set();
    for (let ty = 0; ty < lv.h; ty++) for (let tx = 0; tx < lv.w; tx++) {
      if (kind(tx, ty) !== 1) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (kind(tx + dx, ty + dy) === 2) { hit.add(tx + ',' + ty); hit.add((tx + dx) + ',' + (ty + dy)); }
    }
    if (!hit.size) return;
    for (const key of hit) {
      const [tx, ty] = key.split(',').map(Number); G.front[ty][tx] = TL.STONE; G.col[ty][tx] = 0;
      for (let i = 0; i < 5; i++) G.parts.push({ x: tx * T + 3 + Math.random() * 10, y: ty * T + 4 + Math.random() * 6, vx: (Math.random() - .5) * 14, vy: -26 - Math.random() * 22, g: -14, s: 2 + (i % 2), life: .5 + Math.random() * .4, col: i % 2 ? '#FFFFFF' : '#DDE7F0' });
    }
    SFX.melt(); G.shake = Math.max(G.shake, 1);
  }
  function updateMagnets(dt) {
    for (const k of Object.keys(G.under)) { const [ux, uy] = k.split(',').map(Number); if (G.front[uy][ux] !== TL.MAGNET) { if (G.front[uy][ux] === 0) { const u = G.under[k]; G.front[uy][ux] = u.t; G.col[uy][ux] = u.c; G.lock[uy][ux] = u.l; } delete G.under[k]; } }
    // うごいていない かたまりは、ひきよせられるか しらべる
    const moving = new Set(); for (const m of G.mgs) for (const c of m.cells) moving.add(mk(c[0], c[1]));
    for (const cells of magClusters()) {
      if (cells.some(c => moving.has(mk(c[0], c[1]))) || cells.some(c => !blockVisible(c[0], c[1]))) continue;
      const pl = clusterPull(cells); if (!pl) continue;
      if (clusterFree(cells, pl.dx, pl.dy)) { G.mgs.push({ cells, dx: pl.dx, dy: pl.dy, off: 0 }); for (const c of cells) moving.add(mk(c[0], c[1])); }
    }
    for (const m of G.mgs.slice()) {
      if (!m.cells.every(c => G.front[c[1]][c[0]] === TL.MAGNET)) { G.mgs.splice(G.mgs.indexOf(m), 1); continue; }
      if (m.off === 0 && !clusterFree(m.cells, m.dx, m.dy)) continue; // まつ
      const step = magSpeed() * dt, p = G.p;
      const ride = !p.dead && p.ground && m.cells.some(c => p.x + p.w > c[0] * T + m.off * T * m.dx && p.x < (c[0] + 1) * T + m.off * T * m.dx && Math.abs(p.y + p.h - (c[1] * T + m.off * T * m.dy)) <= 2.5);
      m.off += step / T; if (ride) { p.x += m.dx * step; p.y += m.dy * step; }
      while (m.off >= 1) { // 1マスすすんだ
        moveCluster(m); m.off -= 1;
        const all = magClusters().find(cl => cl.some(c => c[0] === m.cells[0][0] && c[1] === m.cells[0][1]));
        const pl = all ? clusterPull(all) : null;
        if (all) m.cells = all; // くっついた じしゃくも なかまに
        if (!pl || pl.dx !== m.dx || pl.dy !== m.dy || !clusterFree(m.cells, m.dx, m.dy)) { m.off = 0; G.mgs.splice(G.mgs.indexOf(m), 1); SFX.place(); break; }
      }
    }
    // スイッチ: じしゃくがかさなったら、おされる(いちどおしたら、そのまま)
    for (const s of G.switches) {
      if (s.on) continue;
      if (inb(s.x, s.y) && G.front[s.y][s.x] === TL.MAGNET) s.on = true; // そのマスに、じしゃくがある
      if (!s.on) for (const m of G.mgs) for (const c of m.cells) { const mx = (c[0] + m.dx * m.off) * T, my = (c[1] + m.dy * m.off) * T; if (Math.abs(mx - s.x * T) < 8 && Math.abs(my - s.y * T) < 8) s.on = true; }
      if (s.on) { SFX.gem && SFX.gem(); for (const d of G.doors) if (d.id === s.id && !d.open) { d.latched = true; d.open = true; UI.toast('どこかの扉が開きました！', 1800); } }
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
    G.frame++; G.t += dt; if (G.zoomT > 0) G.zoomT = Math.max(0, G.zoomT - dt);
    if (!G.cleared) G.time += dt;
    updateDoors(dt); updateLifts(dt); updateMagnets(dt); meltCheck(); updatePlayer(dt); updateEnemies(dt); updatePickups();
    if (!G.cleared) G.energy = Math.min(100, G.energy + dt * G.regen);
    for (const q of G.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.g === undefined ? 200 : q.g) * dt; q.life -= dt; }
    if (G.cleared && G.confT < .6) { const before = Math.floor(G.confT / .2); G.confT += dt; if (Math.floor(G.confT / .2) !== before) spawnConfetti(G.flag.x + G.flag.w / 2, G.flag.y + 4, 14); }
    G.parts = G.parts.filter(q => q.life > 0);
    G.pick = G.pick.filter(k => !k.got);
    if (G.shake > 0) G.shake = Math.max(0, G.shake - 30 * dt);
    if (G.flash > 0) G.flash -= dt;
    // ヒント
    for (const h of G.level.hints) if (!G.hintShown[h.x] && G.p.x / T >= h.x) { G.hintShown[h.x] = true; UI.toast(h.text, 4200); }
    // カメラ
    const tx = clamp(G.p.x - W / 2 + G.p.face * 22, 0, G.level.w * T - W), ty = clamp(G.p.y - H * .6, 0, Math.max(0, G.level.h * T - H));
    if (!G.p.dead) { G.cam.x += (tx - G.cam.x) * Math.min(1, dt * 7); G.cam.y += (ty - G.cam.y) * Math.min(1, dt * 5); } // ミスのあいだは カメラを とめる
    if (G.cleared) G.clearT += dt;
    input.jumpP = input.atkP = input.dashP = input.editP = false;
  }

  // ===== 描画 =====
  function dotRect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
  // みた目: ?gfx=excel(ふつう: Excelふう) / ?gfx=snes(ソリッドばん) / ?gfx=classic(もとのえ)
  // 公開版は Excelふう ひとつだけ。開発用に ?dev=1 を付けると、見た目の切りかえ(?gfx=)と 調整パネルが つかえる
  const DEV = /[?&]dev=1/.test(location.search);
  const THEME = (DEV && (/[?&]gfx=(\w+)/.exec(location.search) || [])[1]) || (/[?&]gfx=enar32/.test(location.search) ? 'enar32' : 'excel'); // enar32(32pxの新しい見た目)だけは、公開版でも URLで えらべる
  const EXCEL =(THEME === 'excel' || THEME === 'enar32') && !!window.GFXX, SNES = THEME === 'snes' && !!window.GFX, SOLID = (EXCEL || SNES) && !!window.GFX;
  const TILES = EXCEL ? window.GFXX : SNES ? window.GFX : null;
  if (EXCEL) document.body.classList.add('theme-excel');
  const IW = (im) => im.__hd ? im.width / 2 : im.width, IH = (im) => im.__hd ? im.height / 2 : im.height; // 32px素材(__hd)は、論理px(16px=1マス)では 半分の大きさ
  function drawLock(x, y) { const h = window.HD && window.HD.lock(); if (h) ctx.drawImage(h, x, y); else ctx.drawImage(GFX.lock(), x + 8, y + 1); }
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
  // ガラスの「ぴかり」: ときどき、よこぎる しろい ひかりの おびが、ひょうめんを とおる。となりの ブロックへ、つづけて ながれる
  const SHINE_PERIOD = 3.0, SHINE_LEN = .22; // はやい ひとなで
  function glassShine(x, y, w, h, onColor) { // onColor: いろを つけた あとの ガラス(しろい ひかり) / むいろは うすい あお
    const wx = x + Math.round(G.cam.x + (G.sx || 0)), ph = ((G.t - wx * .006) % SHINE_PERIOD + SHINE_PERIOD) % SHINE_PERIOD;
    if (ph > SHINE_LEN) return;
    const span = w + h, s = Math.round(-6 + (ph / SHINE_LEN) * (span + 8)), a = ctx.globalAlpha;
    const cols = onColor ? ['#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF'] : ['#DCEBF8', '#A9D1F0', '#8FC1EA', '#DCEBF8']; // しろい ガラスの うえでも 見えるように、うすい あおの おび(ななめ「/」)
    for (let r = 2; r < h - 2; r++) for (let i = 0; i < cols.length; i++) { const px = s - r + i; if (px < 1 || px > w - 2) continue; ctx.globalAlpha = a * (onColor ? [.45, .95, 1, .95, .45][i] : 1); ctx.fillStyle = cols[i]; ctx.fillRect(x + px, y + r, 1, 1); }
    ctx.globalAlpha = a;
    // ひかりの キラッ(おびが まんなかを とおる とき、十字)
    if (ph > SHINE_LEN * .3 && ph < SHINE_LEN * .8) { const sx = x + (w >> 1), sy = y + 3; if (onColor) { ctx.fillStyle = 'rgba(0,70,50,.45)'; ctx.fillRect(sx + 1, sy - 1, 1, 3); ctx.fillRect(sx, sy + 1, 3, 1); } ctx.fillStyle = onColor ? '#FFFFFF' : '#6FA8DC'; ctx.fillRect(sx, sy - 1, 1, 3); ctx.fillRect(sx - 1, sy, 3, 1); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(sx, sy, 1, 1); }
    ctx.globalAlpha = a;
  }
  function drawBlock(t, c, x, y, topOpen, botOpen, alpha, seed) {
    const k = COLORS[c] || COLORS[0];
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    if (TILES) { ctx.drawImage(TILES.block(t === TL.GLASSED ? TL.STONE : t, c, topOpen, botOpen, seed === undefined ? 0 : seed), x, y); if (t === TL.GLASSED) { glassMark(x, y); if (G.level) glassShine(x, y, T, T, true); } else if (c === 5 && G.level) glassShine(x, y, T, T); ctx.globalAlpha = 1; return; }
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
  function drawJudges(cx, cy) {
    for (const j of G.judges) {
      const x = j.x * T - cx, y = j.y * T - cy, c = judgeColor(j);
      if (j.on) { ctx.globalAlpha = .16; ctx.fillStyle = c; ctx.fillRect(x, y, T, T); ctx.globalAlpha = 1; }
      // Excelの「コメント」のしるし: かどの さんかく。いろ＝はんていの しゅるい(そんざい=むらさき / あき=こいはい / いろ=そのいろ)
      for (let i = 0; i < 10; i++) { ctx.fillStyle = c; ctx.fillRect(x + T - (10 - i), y + i, 10 - i, 1); }
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
    if (t === TL.MAGNET) { if ((G.hideRow.has(ty) || G.hideCol.has(tx)) && !G.lock[ty][tx]) return; const mv = G.mgs.find(m => m.cells.some(c => c[0] === tx && c[1] === ty)); drawMagnet(Math.round(x + (mv ? mv.dx * mv.off * T : 0)), Math.round(y + (mv ? mv.dy * mv.off * T : 0))); if (G.lock[ty][tx] && SOLID) drawLock(x, y); return; }
    if (isBlockT(t)) {
      if ((G.hideRow.has(ty) || G.hideCol.has(tx)) && !G.lock[ty][tx]) return;
      const faded = G.filter !== null && G.col[ty][tx] !== G.filter && !G.lock[ty][tx];
      drawBlock(t, G.col[ty][tx], x, y, !solidCell(tx, ty - 1), !solidCell(tx, ty + 1), faded ? .28 : undefined, tx * 7 + ty * 13);
      if (G.lock[ty][tx] && SOLID) drawLock(x, y);
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
      if (L.col === 5) glassShine(x, y, w, h); else if (L.mark) glassShine(x, y, w, h, true);
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
  // ===== データのかけら(宝石)と、ゴールの フロッピーディスク: ほかの えと おなじ ドットの スプライト =====
  // かけら: ゆらゆら うごいて、ときどき ぴかっと ひかる(1ドットの 十字)。on=false は HUDの「まだ」の わく
  function drawShard(cx, cy, s, on) {
    if (!on) return;
    const im = GFXX.shard(); ctx.drawImage(im, Math.round(cx - IW(im) / 2), Math.round(cy - IH(im) / 2));
    if (Math.sin(G.t * 3 + cx * .7) > .93) { const x = Math.round(cx - 3), y = Math.round(cy - 4); ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
  }
  // ゴール: 角を下にした フロッピーディスクが、ゆっくり くるくる まわる(よこはばが ちぢんで、うらがえる)。とると クリア
  function drawGoal(x, y) {
    const cx = x + 8; let a = 1, spin = G.t * 1.6, grow = 1;
    if (G.cleared) { const c = G.clearT || 0; a = Math.max(0, 1 - c * 1.8); grow = 1 + c * 1.6; spin = G.t * 1.6 + c * 14; if (a <= 0) return; }
    const k = Math.cos(spin), back = k < 0, im = GFXX.floppy(back), w = Math.max(3, Math.round(IW(im) * Math.abs(k) * grow)), h = Math.round(IH(im) * grow);
    const bob = Math.round(Math.sin(G.t * 2.4) * 1.5), dx = Math.round(cx - w / 2), dy = Math.round(y + 16 - h / 2) + bob;
    ctx.globalAlpha = a; ctx.drawImage(im, dx, dy, w, h); ctx.globalAlpha = 1;
    if (!G.cleared && Math.sin(G.t * 2 + 1) > .94) { ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(cx + 6), dy + 1, 3, 1); ctx.fillRect(Math.round(cx + 7), dy, 1, 3); }
  }
  // しろい文字(ぎたい): しろい シートに とけこむ、ほとんど みえない 文字。ほんの すこし、ゆらぐ
  function drawMojiHint(e, cx, cy) {
    const x = Math.round(e.x + 6 - cx), y = Math.round(e.y + 7 - cy), a = .8 + .2 * Math.sin(e.t * 2.2);
    ctx.save(); ctx.font = '700 13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(165,190,230,' + (a * .85) + ')'; ctx.fillText('あ', x + 1, y + 1);
    ctx.fillStyle = 'rgba(250,251,255,' + a + ')'; ctx.fillText('あ', x, y); ctx.restore();
  }
  // にせブロック: とおくでは ふつうの ブロック。ちかづくと とじた目、かなり ちかづくと 目が あいて こちらを おう。へんしゅう中は しょうたいが わからない
  function drawFake(e, cx, cy) {
    const hotMv = e.mv > 0; // あつがって にげている ところ: 目を 見開いて、ぶるぶる ふるえる
    const x = Math.round(e.x - 1 - cx) + (hotMv ? Math.round(Math.sin(e.t * 90) * 1.2) : 0), y = Math.round(e.y - 2 - cy) + (hotMv ? Math.round(Math.cos(e.t * 77) * 1) : 0);
    if (e.flash > 0 && Math.floor(e.flash * 40) % 2) ctx.globalAlpha = .4;
    drawBlock(TL.STONE, e.c || 0, x, y, true, true, undefined, 0); ctx.globalAlpha = 1;
    const look = hotMv ? 2 : G.edit.on ? 0 : (e.look || 0);
    if (look === 1) { ctx.fillStyle = 'rgba(38,38,38,.32)'; ctx.fillRect(x + 3, y + 7, 4, 1); ctx.fillRect(x + 9, y + 7, 4, 1); }
    else if (look === 2) {
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(x + 3, y + 5, 4, 4); ctx.fillRect(x + 9, y + 5, 4, 4);
      const px = hotMv ? 1 : (e.ex || 0) > 6 ? 2 : (e.ex || 0) < -6 ? 0 : 1, py = hotMv ? 1 : (e.ey || 0) > 6 ? 2 : (e.ey || 0) < -6 ? 0 : 1;
      ctx.fillStyle = 'rgba(38,38,38,.5)'; if (hotMv) { ctx.fillStyle = 'rgba(38,38,38,.75)'; ctx.fillRect(x + 4 + px, y + 6 + py, 1, 1); ctx.fillRect(x + 10 + px, y + 6 + py, 1, 1); } else { ctx.fillRect(x + 3 + px, y + 5 + py, 2, 2); ctx.fillRect(x + 9 + px, y + 5 + py, 2, 2); }
      ctx.fillStyle = 'rgba(38,38,38,.28)'; ctx.fillRect(x + 3, y + 4, 4, 1); ctx.fillRect(x + 9, y + 4, 4, 1);
    }
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
    drawGoal(G.flag.x - cx, G.flag.y - cy);
    // 取得物
    for (const k of G.pick) {
      if (k.gone || hiddenAt(Math.floor((k.x + 4) / T), Math.floor((k.y + 4) / T))) continue;
      const x = k.x - cx, y = k.y - cy + Math.round(Math.sin(G.t * 4 + k.x) * 1.5);
      if (k.type === 'gem') { if (EXCEL) drawShard(x + 4, y + 4, 10, true); else icon(GEM, x + 1, y + 1, '#4C9BE8', '#BFD8FF'); } else { const o = window.HD && window.HD.orb(); if (o) ctx.drawImage(o, Math.round(x + 4 - IW(o) / 2), Math.round(y + 4 - IH(o) / 2)); else icon(BOLT, x + 1, y + 1, '#F5C842'); }
    }
    // てき
    for (const e of G.enemies) {
      if (e.dead || e.hidden) continue;
      const fr = Math.floor(e.t * 4) % 2, flip = e.dir > 0;
      if (e.type === 'moji' && !e.awake) { drawMojiHint(e, cx, cy); continue; }
      if (e.type === 'fake') { drawFake(e, cx, cy); continue; }
      const name = e.type === 'walker' ? 'walker' : e.type === 'guard' ? 'guard' : e.type === 'flyer' ? 'flyer' : (e.type === 'div0' || e.type === 'autofill' || e.type === 'moji' || e.type === 'shuffler' || e.type === 'circ' || e.type === 'condfmt' || e.type === 'bucket') ? (EXCEL ? (e.type === 'autofill' && e.c !== undefined ? 'autofill' + e.c : e.type === 'bucket' ? 'bucket' + e.c : e.type) : 'walker') : 'turret';
      const fi = name === 'guard' || name === 'turret' ? 0 : fr;
      if (e.type === 'circ') { // みちすじ(うすい てんせん)
        const lp = e.loop; ctx.strokeStyle = 'rgba(47,62,107,.32)'; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.strokeRect(lp.x0 * T + 8 - cx + .5, lp.y0 * T + 8 - cy + .5, (lp.x1 - lp.x0) * T, (lp.y1 - lp.y0) * T); ctx.setLineDash([]);
      }
      if (e.type === 'condfmt' || e.type === 'shuffler') { // はんい(ちかちかは、もうすぐ かわる/うごく あいず)
        const blink = e.tele ? (.5 + .5 * Math.sin(e.t * 22)) : 0, NC = ['#C9A15E', '#E8563F', '#6FD6E8', '#58B368', '#F5C842'];
        e.ranges.forEach((r, k) => {
          const rx = r.x0 * T - cx, ry = r.y0 * T - cy, rw = (r.x1 - r.x0 + 1) * T, rh = (r.y1 - r.y0 + 1) * T;
          const base = e.type === 'condfmt' ? NC[e.seq[(e.step + 1 + k) % e.seq.length]] : '#ADB9CA';
          if (e.tele) { ctx.globalAlpha = .12 + .22 * blink; ctx.fillStyle = base; ctx.fillRect(rx, ry, rw, rh); ctx.globalAlpha = 1; }
          ctx.strokeStyle = e.type === 'condfmt' ? 'rgba(112,48,160,' + (.35 + .4 * blink) + ')' : 'rgba(197,90,17,' + (.35 + .4 * blink) + ')'; ctx.lineWidth = 1; ctx.setLineDash([3, 2]); ctx.strokeRect(rx + .5, ry + .5, rw - 1, rh - 1); ctx.setLineDash([]);
          if (e.type === 'shuffler') { ctx.fillStyle = 'rgba(197,90,17,' + (.5 + .4 * blink) + ')'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(e.axis === 'x' ? (e.sdir > 0 ? '▶' : '◀') : (e.sdir > 0 ? '▼' : '▲'), rx + rw / 2, ry + rh / 2); }
        });
      }
      const s = EXCEL ? GFXX.enemy(name, fi, e.dir < 0) : sprite(name, fi, flip);
      const x = Math.round(e.x - (e.ox || 0) - cx) - (EXCEL ? 1 : 0), y = Math.round(e.y - (e.oy || 0) - cy) - (EXCEL ? 1 : 0);
      if (e.flash > 0 && Math.floor(e.flash * 40) % 2) ctx.globalAlpha = .4; ctx.drawImage(s, x, y); ctx.globalAlpha = 1;
      if (e.type === 'guard' && !EXCEL) { ctx.fillStyle = '#4C9BE8'; ctx.fillRect(Math.round(e.x - cx) + (e.dir > 0 ? e.w - 1 : -3), Math.round(e.y - cy), 4, e.h); }
      if (e.type === 'autofill' && e.cd < .8 && e.made < e.max && fillWindowCount(e) < e.cap) { const tg = fillTarget(e); if (tg) { ctx.globalAlpha = .35 + .3 * Math.sin(e.t * 18); ctx.fillStyle = e.c !== undefined ? AF_COL[e.c] : '#70AD47'; ctx.fillRect(tg[0] * T - cx, tg[1] * T - cy, T, T); ctx.globalAlpha = 1; ctx.strokeStyle = e.c !== undefined ? AF_COL[e.c] : '#217346'; ctx.lineWidth = 1; ctx.strokeRect(tg[0] * T - cx + .5, tg[1] * T - cy + .5, T - 1, T - 1); } }
      if (e.type === 'bucket' && e.pt > 0 && e.ptc) { const bl = .5 + .5 * Math.sin(e.t * 26); ctx.globalAlpha = .25 + .35 * bl * (e.pt / 1 + .4); ctx.fillStyle = AF_COL[e.c] || '#fff'; ctx.fillRect(e.ptc[0] * T - cx, e.ptc[1] * T - cy, T, T); ctx.globalAlpha = 1; }
      if (e.type === 'turret' && e.tele) { ctx.fillStyle = '#FFE27A'; ctx.fillRect(Math.round(e.x - cx) + 4, Math.round(e.y - cy) - 4, 4, 2); }
    }
    for (const b of G.bullets) dotRect(b.x - cx, b.y - cy, 4, 4, '#E8563F');
    // 主人公は丸めていないカメラ位置で描く(カメラと主人公を別々に丸めると、歩くたびに1pxずつ揺れてガクガクして見えるため)
    drawPlayer(G.cam.x + (G.sx || 0), G.cam.y);
    for (const q of G.parts) dotRect(q.x - cx, q.y - cy, q.s || 2, q.s || 2, q.col);
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
    const p = G.p, seq = ['idle', 'up', 'idle', 'down']; // はばたきの 4コマ: よこ→うえ→よこ→した
    const fr = (hz) => seq[Math.floor(G.t * hz) % 4];
    let name = 'idle';
    if (p.stun > 0) name = 'hurt'; else if (p.hovering) name = fr(22); else if (!p.ground) name = p.vy < -40 ? fr(18) : fr(12); else if (Math.abs(p.vx) > 25) name = fr(13);
    const bob = p.ground && Math.abs(p.vx) <= 25 ? Math.round(Math.sin(G.t * 4) * 1) : 0;
    ctx.drawImage(enerImg(name, p.face < 0), Math.round(p.x - 3 - cx), Math.round(p.y - 1 - cy) + bob);
    if (p.hovering) { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(Math.round(p.x + 2 - cx), Math.round(p.y + p.h + 2 - cy), 6, 1); ctx.fillRect(Math.round(p.x + 4 - cx), Math.round(p.y + p.h + 4 - cy), 2, 1); }
  }
  // 改ページプレビュー: 見える所は あおい枠。そのほかは グレーのセル。ゴール・かけらは うっすら ひかり、近い てきは ふちに ちかちか
  let fogCv = null;
  function drawFog() {
    const cx = Math.round(G.cam.x + (G.sx || 0)), cy = Math.round(G.cam.y), rs = fogRects();
    if (!fogCv) { fogCv = document.createElement('canvas'); fogCv.width = W; fogCv.height = H; }
    const g = fogCv.getContext('2d'); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H);
    g.fillStyle = '#BDBDBD'; g.fillRect(0, 0, W, H); g.fillStyle = '#AFAFAF';
    for (let x = -(((cx % T) + T) % T); x < W; x += T) g.fillRect(x, 0, 1, H);
    for (let y = -(((cy % T) + T) % T); y < H; y += T) g.fillRect(0, y, W, 1);
    g.fillStyle = 'rgba(120,120,120,.35)'; g.font = '700 22px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ページ 1', W / 2, H / 2 + 4);
    g.globalCompositeOperation = 'destination-out';
    for (const r of rs) g.fillRect(r.x0 * T - cx, r.y0 * T - cy, (r.x1 - r.x0 + 1) * T, (r.y1 - r.y0 + 1) * T);
    ctx.drawImage(fogCv, 0, 0);
    ctx.strokeStyle = G.zoomT > 0 ? '#5B9BD5' : '#1F5BB5'; ctx.lineWidth = 2;
    for (const r of rs) ctx.strokeRect(r.x0 * T - cx + 1, r.y0 * T - cy + 1, (r.x1 - r.x0 + 1) * T - 2, (r.y1 - r.y0 + 1) * T - 2);
    // うっすら ひかる ゴールと かけら(見えない所だけ)
    const hid = (px, py) => !cellVisible(Math.floor(px / T), Math.floor(py / T));
    ctx.save(); ctx.globalAlpha = .35 + .2 * Math.sin(G.t * 3);
    if (EXCEL && hid(G.flag.x + 8, G.flag.y + 8)) { const im = GFXX.floppy(false); ctx.drawImage(im, Math.round(G.flag.x + 8 - IW(im) / 2 - cx), Math.round(G.flag.y + 8 - IH(im) / 2 - cy)); }
    for (const k of G.pick) { if (k.type !== 'gem' || k.got || k.gone || !hid(k.x + 4, k.y + 4)) continue; if (EXCEL) { const im = GFXX.shard(); ctx.drawImage(im, Math.round(k.x + 4 - IW(im) / 2 - cx), Math.round(k.y + 4 - IH(im) / 2 - cy)); } else { ctx.fillStyle = '#4C9BE8'; ctx.fillRect(Math.round(k.x - cx), Math.round(k.y - cy), 8, 8); } }
    ctx.restore();
    // ふちの ちかちか: 見えない ところの てきが ちかいとき、あおい枠のふちに あかい しるし
    const fr = fogFrame(), fx0 = fr.x0 * T - cx, fy0 = fr.y0 * T - cy, fx1 = (fr.x1 + 1) * T - cx, fy1 = (fr.y1 + 1) * T - cy;
    if (Math.sin(G.t * 10) > -.2) for (const e of G.enemies) {
      if (e.dead || e.hidden || e.type === 'fake' || (e.type === 'moji' && !e.awake)) continue;
      const ex = e.x + e.w / 2, ey = e.y + e.h / 2; if (cellVisible(Math.floor(ex / T), Math.floor(ey / T))) continue;
      const sx = ex - cx, sy = ey - cy; if (sx > fx0 - 6 * T && sx < fx1 + 6 * T && sy > fy0 - 5 * T && sy < fy1 + 5 * T) {
        const mx = Math.min(fx1 - 7, Math.max(fx0 + 7, sx)), my = Math.min(fy1 - 7, Math.max(fy0 + 7, sy));
        ctx.fillStyle = '#E8563F'; ctx.beginPath(); ctx.moveTo(mx, my - 5); ctx.lineTo(mx + 5, my + 4); ctx.lineTo(mx - 5, my + 4); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(mx - .5, my - 2, 1, 4); ctx.fillRect(mx - .5, my + 3, 1, 1);
      }
    }
  }
  function drawPlayer(cx, cy) {
    const p = G.p;
    if (p.dead) { // とんでいく しゅじんこう(くるくる まわる)
      if (p.why === 'fall') return;
      const mx = p.x + 5 - cx, my = p.y + 7 - cy; ctx.save(); ctx.translate(Math.round(mx), Math.round(my)); ctx.rotate(p.rot); ctx.translate(-Math.round(mx), -Math.round(my));
      drawPlayerBody(cx, cy);
      ctx.restore(); return;
    }
    drawPlayerBody(cx, cy);
  }
  function drawPlayerBody(cx, cy) {
    const p = G.p;
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
    const X = EXCEL; // Excelふう: しろいいた(コメントのような)のうえに、くらいいろでかく
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
    ctx.fillStyle = 'rgba(11,18,38,.63)'; ctx.fillRect(0, 0, W, H); // ゲーム画面だけを、リングを出したときと同じ暗さに
    if (E.pan) { // 手モード: 黄色いわく と 札で、はっきり しらせる
      ctx.strokeStyle = '#FFC000'; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, W - 3, H - 3);
      ctx.fillStyle = '#FFC000'; ctx.fillRect(W / 2 - 38, 3, 76, 13); ctx.fillStyle = '#000'; ctx.font = 'bold 9px sans-serif'; ctx.textBaseline = 'top'; ctx.textAlign = 'center'; ctx.fillText('✋ 手モード', W / 2, 5); ctx.textAlign = 'left';
    }
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
    const e = practice ? '∞' : Math.floor(G.energy);
    if (has && (RB.cost !== e || RB.max !== G.maxE)) { RB.cost = e; RB.max = G.maxE; $('#rb-bar').firstElementChild.style.width = practice ? '100%' : (100 * G.energy / Math.max(1, G.maxE)) + '%'; $('#rb-bar').classList.toggle('low', !practice && G.energy < minCost()); $('#rb-cost').textContent = e; }
    const ng = G.level.gems.length; $('#rb-g-sigma').style.display = ng ? '' : 'none';
    if (RB.gems !== G.gems || RB.ng !== ng) { RB.gems = G.gems; RB.ng = ng; let h = ''; if (ng <= 5) for (let i = 0; i < ng; i++) h += '<i class="sg' + (i < G.gems ? ' on' : '') + '"></i>'; else h = '<i class="sg on"></i><b>' + G.gems + '/' + ng + '</b>'; $('#rb-sigma').innerHTML = h; }
    const t = Math.floor(G.time / 60) + ':' + String(Math.floor(G.time % 60)).padStart(2, '0'); if (RB.time !== t) { RB.time = t; $('#rb-time').textContent = t; }
    const hasEdit = !$('#btn-edit').classList.contains('hide'); if (RB.edit !== hasEdit) { RB.edit = hasEdit; $('#rb-edit').style.display = hasEdit ? '' : 'none'; $('#lb-edit').style.display = hasEdit ? '' : 'none'; }
    const mu = $('#btn-mute').textContent; if (RB.mute !== mu) { RB.mute = mu; $('#rb-mute').innerHTML = mu + '<span class="lbl"> 音</span>'; $('#lb-mute').textContent = mu + ' 音'; }
  }
  function render() {
    if (!G.level) return;
    updateRibbon();
    G.sx = (G.shake && !G.edit.on) ? (Math.random() - .5) * G.shake : 0;
    drawBackground(); drawWorld();
    if (G.fog) drawFog();
    if (EXCEL) GFXX.frame(ctx, G, G.level, W, H);
    if (G.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (G.flash * 1.2) + ')'; ctx.fillRect(0, 0, W, H); }
    if (G.edit.on) { drawEditOverlay(); UI.helpText(); }
    drawHUD();
    if (G.p.dead) drawMiss();
  }
  // 「ミス…」の画面: くらくなって、よこからバンドが すべりこみ、文字が ぽんと はずむ
  function drawMiss() {
    const t = G.p.deadT || 0, e = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
    ctx.fillStyle = 'rgba(20,26,46,' + (.55 * e(t / .35)) + ')'; ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * .9); g.addColorStop(0, 'rgba(232,86,63,0)'); g.addColorStop(1, 'rgba(232,86,63,' + (.4 * e(t / .3)) + ')'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const k = e((t - .25) / .3), fade = Math.min(1, Math.max(0, (G.p.dead) / .25)); if (k <= 0) return;
    ctx.save(); ctx.globalAlpha = fade;
    const bh = 54, by = Math.round(H / 2 - bh / 2 - 6), bw = Math.round(W * k);
    ctx.fillStyle = 'rgba(31,42,68,.92)'; ctx.fillRect(0, by, bw, bh); ctx.fillStyle = '#E8563F'; ctx.fillRect(0, by, bw, 2); ctx.fillRect(0, by + bh - 2, bw, 2);
    const tt = Math.max(0, t - .45), pop = 1 + .35 * Math.max(0, 1 - tt * 5) * Math.cos(tt * 25); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (t > .45) {
      ctx.save(); ctx.translate(W / 2, by + 20); ctx.scale(pop, pop); ctx.font = '700 24px system-ui, sans-serif'; ctx.fillStyle = '#E8563F'; ctx.fillText('ミス…', 1, 2); ctx.fillStyle = '#fff'; ctx.fillText('ミス…', 0, 0); ctx.restore();
      ctx.font = '700 11px system-ui, sans-serif'; ctx.fillStyle = '#D5DBE6'; ctx.fillText(MISS_TEXT[G.p.why] || '', W / 2, by + 42);
    }
    ctx.restore();
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
    if (G.mode === 'opening') { if (e.code === 'Escape') OP.finish(); else if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight') { e.preventDefault(); OP.advance(); } return; }
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
  const RING = /[?&]ring=1/.test(location.search); // 試験: なおすコマンドを リングコマンドにして、画面ながおしで よびだす。ダブルタップで 手(画面いどう)を きりかえる
  let downInfo = null, lastTap = { t: 0, x: 0, y: 0 }, pendTap = null;
  const cancelPend = () => { if (pendTap) { clearTimeout(pendTap); pendTap = null; } };
  const wantsRect = () => { const d = toolDef(), E = G.edit; return d && (d.mode === 'rect' || (d.mode === 'two' && E.step === 0) || (d.mode === 'painter' && E.step === 1)); };
  cv.addEventListener('pointerdown', (e) => {
    audio(); if (G.mode !== 'play' || !G.edit.on) return; e.preventDefault(); cv.setPointerCapture(e.pointerId); if (RING) cancelPend();
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
  const endDrag = (e) => {
    const E = G.edit;
    let tap = false;
    if (RING && e && downInfo) tap = Math.hypot(e.clientX - downInfo.x, e.clientY - downInfo.y) < 10 && performance.now() - downInfo.t < 300;
    if (RING && tap) { // ダブルタップ: 手(画面いどう)を きりかえる
      const n = performance.now();
      if (n - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 36) {
        lastTap.t = 0; cancelPend(); dragging = false; tapMode = false; panLast = null; E.sel = null; E.pan = !E.pan; SFX.place(); UI.refreshTools(); return;
      }
      lastTap = { t: n, x: e.clientX, y: e.clientY };
    }
    if (panLast) { panLast = null; return; }
    if (!dragging) return; dragging = false;
    const tm = tapMode; tapMode = false;
    const fin = () => { pendTap = null; if (tm) { const h = E.hover; if (h) onTap(h[0], h[1]); return; } if (!E.sel) return; const r = normRect(E.sel); E.sel = null; onRectDone(r); };
    if (RING && tap) { cancelPend(); pendTap = setTimeout(fin, 300); } else fin();
  };
  // ---- リングコマンド(聖剣2ふう): ながおしで わっかが ひらく。ゆびを 目あての方向へ うごかして はなすと えらべる ----
  const Ring = (function () {
    const el = document.createElement('div'); el.id = 'ring'; el.className = 'hide'; document.body.append(el);
    let items = [], sx = 0, sy = 0, hi = -1, held = false;
    const E = () => G.edit;
    function build() {
      items = G.level.tools.map(id => ({ label: TOOL_BY[id].name, sub: TOOL_BY[id].cost, cur: E().tool === id && !E().pan, run: () => UI.pickTool(id) }));
      items.push({ label: '手', sub: '', cur: E().pan, run: () => { E().pan = !E().pan; UI.refreshTools(); } });
      items.push({ label: 'もどす', sub: '', run: () => undoEdit() });
      items.push({ label: 'やりなおし', sub: '', run: () => redoEdit() });
      items.push({ label: 'おわる', sub: '', run: () => setEdit(false) });
    }
    function open(x, y) {
      build(); sx = x; sy = y; hi = -1; held = true;
      const n = items.length, R = n <= 6 ? 86 : 108, m = R + 46;
      const cx = Math.max(Math.min(x, innerWidth - m), Math.min(m, innerWidth / 2)), cy = Math.max(Math.min(y, innerHeight - m), Math.min(m, innerHeight / 2));
      el.innerHTML = '<div class="ring-disc" style="left:' + cx + 'px;top:' + cy + 'px;width:' + (R * 2) + 'px;height:' + (R * 2) + 'px"></div><div class="ring-center" style="left:' + cx + 'px;top:' + cy + 'px"></div>';
      items.forEach((it, i) => {
        const a = -Math.PI / 2 + i * 2 * Math.PI / n; it.a = a;
        const b = document.createElement('button'); b.className = 'ri' + (it.cur ? ' cur' : ''); b.style.left = cx + 'px'; b.style.top = cy + 'px'; b.style.setProperty('--x', Math.round(Math.cos(a) * R) + 'px'); b.style.setProperty('--y', Math.round(Math.sin(a) * R) + 'px'); b.style.transitionDelay = (i * 22) + 'ms';
        b.innerHTML = it.label + (it.sub !== '' ? '<small>' + it.sub + '</small>' : ''); b.onclick = () => choose(i); it.el = b; el.append(b);
      });
      el.className = 'held'; SFX.editOn(); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('open')));
    }
    function move(x, y) {
      if (!held) return; const dx = x - sx, dy = y - sy; let k = -1;
      if (Math.hypot(dx, dy) > 24) { const a = Math.atan2(dy, dx); let best = 9; items.forEach((it, i) => { let d = Math.abs(a - it.a) % (2 * Math.PI); if (d > Math.PI) d = 2 * Math.PI - d; if (d < best) { best = d; k = i; } }); }
      if (k !== hi) { hi = k; items.forEach((it, i) => it.el.classList.toggle('hi', i === k)); const c = el.querySelector('.ring-center'); if (c) c.textContent = k >= 0 ? items[k].label : ''; }
    }
    function choose(i) { const it = items[i]; close(); if (it) { SFX.place(); it.run(); } }
    function close() { held = false; el.className = 'hide'; el.innerHTML = ''; items = []; }
    function release() { if (!held) return; held = false; if (hi >= 0) choose(hi); else el.classList.remove('held'); }
    el.addEventListener('pointerdown', (e) => { if (e.target === el || e.target.classList.contains('ring-disc')) close(); });
    return { open, move, release, close, get isOpen() { return !el.classList.contains('hide'); } };
  })();
  if (RING) {
    let lpTimer = null, lpPointer = null;
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointerdown', (e) => {
      if (G.mode !== 'play') return; if (Ring.isOpen) { Ring.close(); return; }
      downInfo = { x: e.clientX, y: e.clientY, t: performance.now() }; clearTimeout(lpTimer); lpPointer = e.pointerId;
      try { cv.setPointerCapture(e.pointerId); } catch (_) { /* no-op */ }
      lpTimer = setTimeout(() => {
        lpTimer = null; if (G.mode !== 'play') return; const E = G.edit;
        if (!E.on) { setEdit(true); if (!G.edit.on) return; }
        dragging = false; tapMode = false; panLast = null; G.edit.sel = null; downInfo = null; cancelPend(); Ring.open(e.clientX, e.clientY);
      }, 480);
    });
    cv.addEventListener('pointermove', (e) => { if (lpTimer && downInfo && Math.hypot(e.clientX - downInfo.x, e.clientY - downInfo.y) > 10) { clearTimeout(lpTimer); lpTimer = null; } Ring.move(e.clientX, e.clientY); });
    const lpEnd = () => { clearTimeout(lpTimer); lpTimer = null; Ring.release(); };
    cv.addEventListener('pointerup', lpEnd); cv.addEventListener('pointercancel', lpEnd);
  }
  cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', () => { dragging = false; G.edit.sel = null; panLast = null; });

  // ===== UI(DOM) =====
  // ===== データのかけら: ぜんぶ あつめると、ステージごとの「メモ」が よめる(せかいの なぞを すこしずつ とく) =====
  // ※ ものがたりの たたき台。あとから ぜんぶ かきかえられる
  const FRAG_NOTES = {
    '1-1': 'かけらは、こわれる まえの シートの きおく。ひろうと、ほんのり あたたかい。',
    '1-2': 'さいきん、だれかが あたらしい ソフトを いれたらしい。なまえは まだ わからない。',
    '1-3': 'くうちゅうで ボタンを ながおしすると、ふわり。たかい ところも ゆっくり こえられるよ。',
    '2-1': 'こわれた シートは、どれも「きれいに そろえられて」いた。まちがった ばしょに。',
    '2-2': 'ソフトは、せかいを おそうじ しようとしている…? わるぎは ないのかも しれない。',
    '3-1': 'ガラスは いろを つけると、その いろの せいしつに なる。おぼえておくと やくに たつ。',
    '3-2': 'こわれた しゅんかんの きろくに、おなじ ことばが のこっていた。「ぴかぴか」。',
    '4-1': 'ひだりと みぎが ひっくりかえった シート。まるで かがみの せかい。',
    '4-2': 'たおして、はしに する。ブロックは うごかしかた しだいで、たよれる なかまに なる。',
    '5-1': 'まもられた ブロックは、おそうじから のがれた。「ほご」は だいじな ちから。',
    '5-2': 'ほごを はずすのは、よく かんがえてから。いちど はずすと、もどせない ことも。',
    '5-3': 'よせてから ひっくりかえす。じゅんばんを かえるだけで、あたらしい みちが みえる。',
    '6-1': 'たかい ところの かけらほど、きおくが のこっている。あきらめずに のぼろう。',
    '6-2': 'とうの いちばん うえに、ソフトの ほんたいが ある…そんな うわさが ある。',
    '7-1': 'リフトは、むかし ひとが のるために つくった どうぐ。いまも まじめに うごいている。',
    '7-2': 'たかい ところへ いくには、リフトの うごきを よく みて、のるタイミングを はかる。',
    '7-3': 'ガラスの リフトは、いろを つけると はたらきが かわる。ためして みよう。',
    '7-4': 'リフトと フィルター。ふたつを あわせると、とおれなかった みちが ひらく。',
    '7-5': 'つるつる すべる リフト。あせらず、ゆっくり とまるのを まとう。',
    '7-6': 'みどりに したリフトは、ぴょんと はねる。さきに いろを かえて、あとから とおす。',
    '8-1': 'じしゃくは、かならず いちばん ちかい はがねに むかう。まっすぐ、まじめに。',
    '8-2': 'ふたつの とびら。どちらも ひらけた とき、ソフトの ひみつの ひとつが みえた。',
    '8-3': 'よこむきの じしゃく。ひっぱられる ほうこうを まず かくにんしよう。',
    '9-1': 'たおして、おとして、はしにする。ブロックの いちを かえると、みちが うまれる。',
    '9-2': 'はんてんして とおりぬける。うらがわにも、シートの ひろがりが ある。',
    '9-3': 'つくって、まもって、とおる。ソフトは、まもられた ばしょには てを だせなかった。',
    '9-4': 'ほごを はずして、はんてん。ひとつの そうさで、せかいが ひっくりかえる。',
    '10-1': 'そんざいセルは、ブロックの「いる」「いない」を しっている。みはりばんの ようだ。',
    '10-2': 'からっぽの セルと、そんざいセル。ふたつの めが そろうと、とびらが ひらく。',
    '10-3': 'いろセルは、いろを みわける。おなじ いろの ブロックだけを うけいれる。',
    '10-4': 'ブロックで リフトを うごかす。いつもと ぎゃくの はっそうが ひつよう。',
    '11-1': 'ふたつの リフトを つかいこなせたら、もう たいていの シートは こわくない。',
    '11-2': 'のぼる リフトと からっぽの セル。じゅんばんを まちがえない ことが だいじ。',
    '11-3': 'ソフトの なまえは「ぴかぴかクリーナー」。いちばん おくの シートで、まっている。',
    '12-1': 'あつい ブロックと つめたい ブロックが ぶつかると、ジュッと ぬるくなる。おそうじソフトも、ここは きれいに できなかった。',
    '12-2': 'ガラスに いろを うつすと、となりの ブロックの せいしつも かわる。ちいさな ふれあいが、せかいを かえる。',
    '12-3': 'あつさと つめたさを、つりあわせる。バランスが、こわれた シートを なおす カギらしい。',
    '13-1': '「#DIV/0!」は、ゼロで わられて こまっている。さわると あぶないから、そっと よけて あげよう。',
    '13-2': 'オートフィルは、ゆかを ひろげたいだけ。おせっかいだけど、わるいこだとは かぎらない。',
    '13-3': 'しろい文字は、みえないふりが とくい。でも、よく みると ちょっとだけ ゆれている。',
    '13-4': 'にせブロックは、ブロックの ふりが じょうず。なおす(じかんていし)の 中なら、目が みえるらしい。',
    '13-13': 'にせブロックは、じつは あつがり。あかいブロックが そばに くると、にげていく。',
  };
  const UI = {
    toastT: 0,
    toast(msg, ms) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hide'); clearTimeout(UI.toastT); UI.toastT = setTimeout(() => t.classList.add('hide'), ms || 2200); },
    // がめんの きりかえ。きりかえた直後に、紙の「列」が ひとつずつ ひらくように めくれて、あたらしい がめんが あらわれる
    transLabel: null, transInit: false,
    // info = { world, id, name }(ステージのはじまり: 名前を 大きく 見せてから ひらく) / なし = すぐに ひらく
    wipe(info) {
      let t = $('#trans');
      if (!t) { t = document.createElement('div'); t.id = 'trans'; for (let i = 0; i < 14; i++) { const c = document.createElement('i'); c.style.setProperty('--i', i); t.append(c); } const b = document.createElement('b'); for (const k of ['small', 'strong', 'span']) b.append(document.createElement(k)); t.append(b); document.body.append(t); }
      if (info) { const [a, n, m] = t.querySelectorAll('b > *'); a.textContent = 'WORLD ' + info.world; n.textContent = info.id; m.textContent = info.name; }
      t.classList.remove('go'); void t.offsetWidth; t.className = 'go' + (info ? ' lab' : ''); // ← 1フレーム目から ぜんぶ おおっているので、ちらつかない
      clearTimeout(UI.wipeT); UI.wipeT = setTimeout(() => { t.className = ''; }, info ? 2300 : 800);
    },
    show(id) {
      const cur = document.querySelector('.screen:not(.hide)'), curId = cur ? '#' + cur.id : null, first = false;
      document.querySelectorAll('.screen').forEach(s => s.classList.add('hide')); if (id) $(id).classList.remove('hide'); document.body.classList.toggle('menu', !!id); fit();
      if (!first && curId !== (id || null)) { UI.wipe(UI.transLabel); } UI.transLabel = null;
    },
    refresh() {
      const lv = G.level; $('#lvname').textContent = lv.id + ' ' + lv.name; $('#btn-edit').classList.toggle('hide', !lv.tools.length);
      UI.refreshTools();
    },
    helpText() { const E = G.edit, d = TOOL_BY[E.tool]; const t = E.pan ? 'ドラッグで画面を移動' + (RING ? '（ダブルタップで もどる）' : '') : (E.msg || E.hint || (d ? d.help : '')); const el = $('#edithelp'); if (el.textContent !== t) el.textContent = t; },
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
      if (id === 'transform') chips('', [{ v: 'flipH', label: '左右反転' }, { v: 'flipV', label: '上下反転' }, { v: 'rot', label: '90°回転' }], o.tf, v => { o.tf = v; UI.refreshTools(); });
      else if (id === 'sort') chips('', [{ v: 'L', label: '←よせ' }, { v: 'R', label: 'よせ→' }, { v: 'U', label: '↑よせ' }, { v: 'D', label: 'よせ↓' }], o.sort, v => { o.sort = v; UI.refreshTools(); });
      else if (id === 'filter') chips('残す色', colorItems.concat([{ v: null, label: '外す' }]), G.filter, v => { runPlan(planFor('filter', { fcolor: v })); UI.refreshTools(); });
      else if (id === 'zoom') chips('', [{ v: 1, label: 'ズームする' }], null, v => { runPlan(planFor('zoom', {})); UI.refreshTools(); });
      const d = TOOL_BY[E.tool]; $('#edithelp').textContent = E.pan ? 'ドラッグで画面を移動' + (RING ? '（ダブルタップで もどる）' : '') : (E.msg || E.hint || (d ? d.help : ''));
      $('#e-pan').className = E.pan ? 'sel' : '';
    },
    restart() { if (G.mode !== 'play') return; const id = G.level.id; if (!practice && !G.cleared && !EDITOR_TEST) { save.fails = save.fails || {}; save.fails[id] = (save.fails[id] || 0) + 1; persist(); } loadLevel(G.levelIdx); UI.show(null); UI.assistNote(); },
    assistNote() { if (G.assisted) UI.toast('なんども ちょうせん している ね！ エナジーを 5わり ふやしたよ（クリアすると もとに もどる）', 4500); },
    start(i) { G.mode = 'play'; loadLevel(i); UI.transLabel = { world: G.level.world, id: G.level.id, name: G.level.name }; UI.show(null); G.hitstop = 1.45; /* ステージ名が出ている間は、うごき・タイムを とめる */ UI.assistNote(); $('#hud').classList.remove('hide'); $('#touch').classList.remove('hide'); const t = $('#toast'); t.classList.add('hide'); G.paused = false; },
    title() { G.mode = 'title'; UI.show('#screen-title'); $('#hud').classList.add('hide'); $('#touch').classList.add('hide'); $('#editbar').classList.add('hide'); },
    select() { G.mode = 'select'; UI.show('#screen-select'); $('#hud').classList.add('hide'); $('#touch').classList.add('hide'); $('#editbar').classList.add('hide'); UI.buildSelect(); },
    unlocked(i) { return true; }, // ためしあそびよう: ステージはじゆうにえらべる
    notes() {
      G.mode = 'select'; UI.show('#screen-notes'); const box = $('#notes'); box.innerHTML = ''; let got = 0, all = 0;
      LEVELS.forEach(lv => { if (!lv.gems.length || !FRAG_NOTES[lv.id]) return; all++; const ok = gemsOf(lv, save.levels[lv.id]) >= lv.gems.length; if (ok) got++;
        const d = document.createElement('div'); d.className = 'note' + (ok ? '' : ' lock'); const b = document.createElement('b'); b.textContent = lv.id + '  ' + lv.name; const p = document.createElement('p'); p.textContent = ok ? FRAG_NOTES[lv.id] : '？？？（かけらを ぜんぶ あつめると よめる）'; d.append(b, p); box.append(d); });
      $('#notes-rate').textContent = 'メモ ' + got + '/' + all;
    },
    buildSelect() {
      const box = $('#levels'); box.innerHTML = ''; let perfect = 0, sigma = 0, sigmaAll = 0;
      LEVELS.forEach((lv, i) => {
        const s = save.levels[lv.id], b = document.createElement('button'); const ok = UI.unlocked(i); if (s && s.goals && s.goals[2]) perfect++; sigma += gemsOf(lv, s); sigmaAll += lv.gems.length;
        b.className = 'lv' + (ok ? '' : ' lock'); b.disabled = !ok;
        b.innerHTML = '<b>' + lv.id + '</b>' + (s && s.rank ? '<i class="rk rk' + s.rank + '">' + s.rank + '</i>' : '') + '<span>' + lv.name + '</span>' + badgesHTML(s ? s.goals : [false, false, false, false], gemsOf(lv, s), lv.gems.length, false, parApplies(lv));
        b.onclick = () => UI.start(i); box.appendChild(b);
      });
      $('#total').textContent = 'ノーミス ' + perfect + '/' + LEVELS.length + '　かけら ' + sigma + '/' + sigmaAll;
    },
    showResult(goals) {
      G.mode = 'result'; UI.show('#screen-result');
      $('#r-stars').innerHTML = badgesHTML(goals, G.gems, G.level.gems.length, true, parApplies(G.level));
      const lv = G.level;
      $('#r-info').innerHTML = (practice ? '' : 'ランク <b class="rk rk' + G.lastRank + '">' + G.lastRank + '</b>　') + (lv.gems.length ? 'かけら ' + G.gems + '/' + lv.gems.length + '（復元率 ' + Math.round(G.gems / lv.gems.length * 100) + '%）　' : '') + 'タイム ' + G.time.toFixed(1) + '秒　ダメージ ' + G.hits + '回' + (parApplies(lv) ? '　つかったコスト ' + G.spent + '（もくひょう ' + lv.par + '）' : '');
      const tips = []; if (!goals[1]) tips.push('データのかけらを すべて あつめる'); if (!goals[2]) tips.push('ダメージを受けずにクリア'); if (parApplies(lv) && !goals[3]) tips.push('コストを ' + lv.par + ' 以下で');
      $('#r-tip').textContent = practice ? 'れんしゅうモード（記録は残りません）' : (tips.length ? tips.join('　') : 'パーフェクト！');
      const nt = $('#r-note'); if (nt) { const full = lv.gems.length > 0 && goals[1] && FRAG_NOTES[lv.id]; nt.classList.toggle('hide', !full); if (full) nt.innerHTML = '<b>' + (G.newNote ? 'あたらしい メモが ふえた！' : 'かけらの メモ') + '</b>' + FRAG_NOTES[lv.id].replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
      const last = G.levelIdx >= LEVELS.length - 1; $('#r-next').textContent = last ? 'ステージ選択へ' : '次のステージへ';
    },
  };
  $('#e-undo').onclick = () => undoEdit(); $('#e-redo').onclick = () => redoEdit(); $('#e-done').onclick = () => setEdit(false);
  $('#e-pan').onclick = () => { G.edit.pan = !G.edit.pan; UI.refreshTools(); };
  // ===== オープニング: 絵本のように 5まいの え + 1文字ずつ でる 文。タップ/Space/Enterで つぎへ、Esc・スキップで とばす =====
  const OP = (function () {
    const W = 192, H = 108, cv = $('#op-cv'), oc = cv.getContext('2d'); oc.imageSmoothingEnabled = false;
    const SCENES = [
      'ここは、データの せかい。\nエナーは ひだまりの シートで、のんびり くらしている。',
      'ところが ある日、そらが ちらちら…。\nあつい日と さむい日が、ごちゃまぜに なってしまった。',
      'ちかごろ、あたらしい ソフトが インストール されたらしい。\nなまえは「ぴかぴかクリーナー」。',
      'あちこちの シートが こわれて、\nはたけの 作物も そだたない…。',
      '「げんいんを つきとめて、せかいを もとどおりに しよう！」\nエナーは、はばたいた。',
    ];
    let idx = 0, t0 = 0, shown = 0, running = false, next = 'select', raf = 0;
    const R = (x, y, w, h, c) => { oc.fillStyle = c; oc.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
    const disc = (cx, cy, r, c) => { oc.fillStyle = c; for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * .6) oc.fillRect(cx + x, cy + y, 1, 1); };
    const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
    const bird = (x, y, sc, flip) => { const im = GFXX.bird(!!flip); oc.drawImage(im, Math.round(x - im.width * sc / 2), Math.round(y - im.height * sc / 2), im.width * sc, im.height * sc); };
    const grid = (a) => { oc.fillStyle = 'rgba(255,255,255,' + a + ')'; for (let x = 0; x < W; x += 16) oc.fillRect(x, 0, 1, H); for (let y = 0; y < H; y += 16) oc.fillRect(0, y, W, 1); };
    const hills = (far, near, ground) => { disc(40, 112, 52, far); disc(150, 118, 58, far); disc(100, 128, 62, near); R(0, 92, W, 16, ground); R(0, 92, W, 1, 'rgba(0,0,0,.12)'); };
    const txt = (s, x, y, size, col, bold) => { oc.font = (bold ? '700 ' : '') + size + 'px system-ui, sans-serif'; oc.textAlign = 'center'; oc.textBaseline = 'middle'; oc.fillStyle = col; oc.fillText(s, x, y); };
    function scene(i, t) {
      if (i === 0) { // 朝の そうげん
        R(0, 0, W, H, '#BFE3F5'); R(0, 40, W, 30, '#D6EEF9'); R(0, 62, W, 30, '#EAF6FC');
        disc(150, 26, 11 + Math.round(Math.sin(t * 2)), '#FFE699'); disc(150, 26, 8, '#FFD966');
        for (let k = 0; k < 8; k++) { const a = k * .785 + t * .3; R(150 + Math.cos(a) * 18, 26 + Math.sin(a) * 18, 2, 2, '#FFE699'); }
        const cx = (t * 4) % 220 - 20; R(cx, 22, 26, 6, '#fff'); R(cx + 5, 17, 16, 6, '#fff'); const c2 = (t * 3 + 90) % 220 - 20; R(c2, 40, 22, 5, '#fff');
        hills('#A9D18E', '#8CC269', '#70AD47');
        for (let k = 0; k < 7; k++) { const fx = 14 + k * 27, fy = 98 + (k % 3) * 3; R(fx, fy, 2, 2, k % 2 ? '#FFC000' : '#fff'); R(fx, fy + 2, 1, 3, '#548235'); }
        bird(84, 76 + Math.sin(t * 1.5) * 1.5, 3, false);
        const z = (t * 1.2) % 3; txt('z', 108 + z * 4, 62 - z * 8, 8 + z * 2, 'rgba(60,80,120,' + (1 - z / 3) + ')', true);
      } else if (i === 1) { // そらが ちらちら: あつい/さむい が ごちゃまぜ
        const f = Math.floor(t * 7);
        R(0, 0, W, H, '#9DB7E8'); R(0, 0, 96, H, '#FFD27F');
        for (let y = 0; y < H; y += 6) { const o = hash(f * 7 + y) < .22 ? (hash(f + y * 3) - .5) * 40 : 0; if (o) { R(96 + o, y, 60, 4, hash(y + f) < .5 ? '#FFD27F' : '#DCE8FF'); } }
        disc(36, 28, 12, '#FF9F40'); disc(36, 28, 9, '#FFD966');
        for (let k = 0; k < 18; k++) { const sx = 100 + ((k * 37 + t * 22) % 88), sy = (k * 23 + t * 30) % 92; R(sx, sy, 2, 2, '#fff'); }
        hills('#A9D18E', '#8CC269', '#70AD47');
        R(0, 92, 96, 16, '#C9B84A'); R(96, 92, 96, 16, '#CFE3F2');
        for (let k = 0; k < 4; k++) { const gx = 20 + k * 22; R(gx, 86, 1, 6, '#8C6A3A'); R(gx - 1, 85, 3, 2, '#C0504D'); } // かれた はたけ
        bird(96, 78 + Math.sin(t * 2) * 1, 3, false);
        if (hash(f * 3.3) < .25) R(0, Math.floor(hash(f) * H), W, 2, 'rgba(255,255,255,.7)');
      } else if (i === 2) { // 「ぴかぴかクリーナー」の インストール つうち
        R(0, 0, W, H, '#1F2A44'); grid(.05);
        const bx = 36, by = 14, bw = 120, bh = 62;
        R(bx + 3, by + 3, bw, bh, 'rgba(0,0,0,.35)'); R(bx, by, bw, bh, '#fff'); R(bx, by, bw, 11, '#4472C4'); R(bx, by + 11, bw, 1, '#2F5597');
        for (let k = 0; k < 3; k++) R(bx + bw - 28 + k * 9, by + 3, 6, 5, k === 2 ? '#E8563F' : '#BDD7EE');
        txt('ぴかぴかクリーナー', bx + 44, by + 6, 8, '#fff', true);
        txt('インストール かんりょう！', bx + bw / 2, by + 28, 9, '#262626', true);
        txt('せかいを ぴかぴかに します', bx + bw / 2, by + 41, 7, '#595959', false);
        R(bx + bw / 2 - 14, by + 48, 28, 10, '#70AD47'); R(bx + bw / 2 - 14, by + 57, 28, 1, '#548235'); txt('OK', bx + bw / 2, by + 53, 7, '#fff', true);
        for (let k = 0; k < 6; k++) { const a = hash(k * 9) * 6.28, r = 74 + Math.sin(t * 2 + k) * 4, sx = 96 + Math.cos(a) * r * 1.1, sy = 46 + Math.sin(a) * r * .55; if (Math.sin(t * 3 + k * 2) > 0) { R(sx - 2, sy, 5, 1, '#FFE699'); R(sx, sy - 2, 1, 5, '#FFE699'); } }
        bird(28, 92 + Math.sin(t * 2) * 1, 3, false);
        txt('?', 40, 76, 12, '#FFD966', true);
      } else if (i === 3) { // こわれた シート
        R(0, 0, W, H, '#F2F2F2'); grid(.0); oc.fillStyle = '#D9D9D9'; for (let x = 0; x < W; x += 24) oc.fillRect(x, 0, 1, H); for (let y = 0; y < H; y += 16) oc.fillRect(0, y, W, 1);
        for (let r = 0; r < 7; r++) for (let c = 0; c < 8; c++) {
          const k = hash(r * 11 + c * 5 + 1), x = c * 24 + 1, y = r * 16 + 1;
          if (k < .17) { R(x, y, 23, 15, '#3A3F4F'); } // あなの あいた セル
          else if (k < .34) { R(x, y, 23, 15, '#FFC7CE'); txt(['#REF!', '#N/A', '#DIV/0!', '#VALUE!'][Math.floor(k * 40) % 4], x + 11, y + 8, 5, '#9C0006', true); }
          else if (k < .46) { oc.save(); oc.translate(x + 11, y + 8); oc.rotate(3.14159 + Math.sin(t * 2 + r) * .1); txt(String(Math.floor(k * 900)), 0, 0, 7, '#595959', true); oc.restore(); } // さかさまの すうじ
        }
        const jx = Math.floor(t * 5) % 2 ? 1 : 0; R(0, 0, W, 3, '#217346'); R(0, H - 3, W, 3, '#217346');
        bird(96 + jx, 88 + Math.sin(t * 2) * 1, 3, false);
        txt('!?', 112, 78, 10, '#E8563F', true);
      } else { // はばたく
        const k = Math.min(1, t / 2.2);
        R(0, 0, W, H, '#FFD9B0'); R(0, 0, W, 34, '#9DC3E6'); R(0, 34, W, 24, '#C5D9EE'); R(0, 58, W, 24, '#F8CFA6'); R(0, 82, W, 26, '#FFD9B0');
        disc(96, 82, 20, '#FFE699'); disc(96, 82, 15, '#FFD966');
        for (let q = 0; q < 14; q++) { const a = q / 14 * 6.28 + t * .4; R(96 + Math.cos(a) * 32, 82 + Math.sin(a) * 32, 2, 2, '#FFF2CC'); }
        hills('#A9D18E', '#8CC269', '#70AD47');
        const by = 80 - k * 34 + Math.sin(t * 6) * 2; bird(96, by, 5, false);
        for (let q = 0; q < 8; q++) { const px = 96 - 24 - q * 7, py = by + 8 + q * 2 + Math.sin(t * 5 + q) * 2; R(px, py, 3 - (q > 4 ? 1 : 0), 2, 'rgba(255,255,255,' + (0.9 - q * .1) + ')'); }
        const sh = GFXX.shard(); oc.drawImage(sh, 150, 16 + Math.round(Math.sin(t * 3) * 2), sh.width * 2, sh.height * 2);
        if (Math.sin(t * 4) > .6) { R(160, 14, 5, 1, '#fff'); R(162, 12, 1, 5, '#fff'); }
      }
    }
    function drawDots() { const d = $('#op-dots'); if (!d) return; d.innerHTML = ''; for (let i = 0; i < SCENES.length; i++) { const e = document.createElement('i'); if (i === idx) e.className = 'on'; d.append(e); } }
    function frame() {
      if (!running) return; raf = requestAnimationFrame(frame);
      const t = (performance.now() - t0) / 1000; scene(idx, t);
      const full = SCENES[idx], n = Math.min(full.length, Math.floor(t * 26)); if (n !== shown) { shown = n; $('#op-text').textContent = full.slice(0, n); }
      $('#op-hint').style.visibility = shown >= full.length && Math.floor(t * 2) % 2 ? 'hidden' : 'visible';
      $('#op-hint').textContent = shown >= full.length ? (idx === SCENES.length - 1 ? 'タップで はじめる ▶' : 'タップで つぎへ ▶') : '';
    }
    function go(i) { idx = i; t0 = performance.now(); shown = -1; drawDots(); }
    const api = {
      start(to) { next = to || 'select'; G.mode = 'opening'; UI.show('#screen-opening'); $('#hud').classList.add('hide'); $('#touch').classList.add('hide'); $('#editbar').classList.add('hide'); running = true; go(0); cancelAnimationFrame(raf); frame(); },
      peek(i, t) { scene(i, t); return SCENES[i]; }, // ガイド用: i場面の絵を、t秒めの ようすで かく（文もかえす）
      advance() { if (!running) return; const full = SCENES[idx]; if (shown < full.length) { t0 = performance.now() - full.length / 26 * 1000; return; } if (idx >= SCENES.length - 1) { api.finish(); } else go(idx + 1); },
      finish() { running = false; cancelAnimationFrame(raf); save.seenOpening = true; persist(); if (next === 'title') UI.title(); else UI.select(); },
    };
    $('#screen-opening').addEventListener('pointerdown', (e) => { if (e.target.closest('#op-skip')) return; api.advance(); });
    $('#op-skip').onclick = () => api.finish();
    return api;
  })();
  $('#btn-play').onclick = () => { audio(); if (!save.seenOpening) OP.start('select'); else UI.select(); };
  if ($('#btn-opening')) $('#btn-opening').onclick = () => { audio(); OP.start('title'); };
  const practiceBtn = $('#btn-practice'); const refreshPractice = () => { if (practiceBtn) { practiceBtn.textContent = 'れんしゅう：' + (practice ? 'ON' : 'OFF'); practiceBtn.classList.toggle('on', practice); } };
  if (practiceBtn) { practiceBtn.onclick = () => { setPractice(!practice); refreshPractice(); UI.toast(practice ? 'れんしゅうモード：エナジー むせいげん（記録は のこりません）' : 'ふつうの モードに もどしました', 2200); }; refreshPractice(); }
  $('#btn-back').onclick = () => UI.title();
  if ($('#btn-notes')) { $('#btn-notes').onclick = () => UI.notes(); $('#btn-notes-back').onclick = () => UI.select(); }
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
    const items = [['h', '色つきブロック（色ごとに性質が違う）']];
    COLORS.forEach((k, i) => items.push([blk(i), k.n + 'ブロック', k.fx]));
    items.push([tileSample(() => drawBlock(TL.STONE, 0, 0, 0, true, true, undefined, 0)), '赤と青がとなりあうと', '熱い赤（マグマ）と、冷たい青（氷）が、たて・よこにとなりあうと、おたがいを打ち消して、ふつうの茶色ブロックになる（ジュッと湯気が出る）']);
    items.push([tileSample(() => drawBlock(TL.GLASSED, 3, 0, 0, true, true, undefined, 0)), '色つきガラス', 'いろコピーで色をつけたガラス。色の性質を持ち、白い枠が残る。一度色をつけると変更できない']);
    items.push(['h', 'その他の地形']);
    items.push([tileSample(() => ctx.drawImage(GFX.metal(), 0, 0)), '鋼', '編集できない鋼の壁・床・天井。どの道具も効かない']);
    items.push(['h', '磁石・スイッチ・扉']);
    items.push([tileSample(() => drawMagnet(0, 0)), '磁石ブロック', '最も近い鋼へ一直線に移動する（エナーの歩く速さ）。途中にブロックがあると動かない（フィルターで薄くなったブロックは通り抜ける）。磁石自体にはフィルターが効かない。となりあった磁石はくっついてひとかたまりになり、いっしょに動く。どれか1つでも鋼にくっつくと、かたまり全体が止まる']);
    items.push(['h', '判定セル（扉などと連動）']);
    items.push([tileSample(() => { const s = G.judges; G.judges = [{ x: 0, y: 0, type: 'exist', color: 0, id: 0, on: false }]; try { drawJudges(0, 0); } finally { G.judges = s; } }), '存在セル', 'このマスに実体のあるブロックかエナーがいるとON。薄くなったブロックは対象外。ONの間、同じ番号の扉が開き、リフトが動く']);
    items.push([tileSample(() => { const s = G.judges; G.judges = [{ x: 0, y: 0, type: 'empty', color: 0, id: 0, on: false }]; try { drawJudges(0, 0); } finally { G.judges = s; } }), '空きセル', 'このマスに実体のあるものもエナーもいなければON。フィルターで薄くなったブロックは空き扱い']);
    items.push([tileSample(() => { const s = G.judges; G.judges = [{ x: 0, y: 0, type: 'color', color: 3, id: 0, on: false }]; try { drawJudges(0, 0); } finally { G.judges = s; } }), '色セル', '指定色のブロックがあるとON。いろコピーで色をつけたガラスも対象']);
    items.push([tileSample(() => drawSwitch({ x: 0, y: 0, id: 0, on: false }, 0, 0)), 'スイッチ', '磁石が重なるとONになり、そのまま維持。同じ色の扉が開く']);
    items.push([tileSample(() => { const save = G.doors; G.doors = [{ x: 0, y: 0, h: 1, id: 0, open: false, anim: 0 }]; try { drawDoors(0, 0); } finally { G.doors = save; } }), '扉', '対応するスイッチや判定セルで開く。閉じている間は通れず、ブロックも置けない']);
    items.push(['h', '仕掛け・カギ']);
    items.push([tileSample(() => { const save = G.lifts; G.lifts = [{ x: 0, y: 0, w: 16, h: 16, vert: true }]; try { drawLifts(0, 0); } finally { G.lifts = save; } }), 'リフト', '決まった道を往復する足場。乗ると運ばれる。リフトは編集で動かせず、通り道にブロックも置けない。色の性質やフィルターが効き、ガラス製は「いろコピー」が使える']);
    items.push([tileSample(() => { drawBlock(TL.STONE, 0, 0, 0, true, true, undefined, 0); if (SOLID) drawLock(0, 0); else { ctx.fillStyle = '#1F2A44'; ctx.fillRect(9, 1, 6, 7); icon(LOCK, 10, 2, '#F5C842'); } }), 'カギ（保護）', '保護されたブロック。編集やフィルターが効かず、寄せるときの仕切りになる。「まもりをはずす」で解除できる']);
    items.push([blk(0, .28), '薄い表示', 'フィルターで残す色以外のブロック（ガラスを含む）は薄くなり、通り抜けられる']);
    // 体験版: ステージに でてこない しかけ(磁石・判定セル・リフト)の せつめいは だす (見せない)
    let shown = items;
    if (DEMO) { let skip = false; shown = items.filter(it => { if (it[0] === 'h') { skip = /磁石|判定セル/.test(it[1]); return !skip && true; } return !skip && it[1] !== 'リフト'; }); }
    // 中身の ない 見出しは だす しない
    shown = shown.filter((it, i) => !(it[0] === 'h' && (i === shown.length - 1 || shown[i + 1][0] === 'h')));
    const box = $('#guide'); box.innerHTML = '';
    shown.forEach(it => {
      if (it[0] === 'h') { const p = document.createElement('p'); p.className = 'gh'; p.textContent = it[1]; box.appendChild(p); return; }
      const d = document.createElement('div'); d.className = 'gi';
      d.innerHTML = '<div><b></b><span></span></div>'; d.insertBefore(it[0], d.firstChild); it[0].className = 'gtile';
      d.querySelector('b').textContent = it[1]; d.querySelector('span').textContent = it[2]; box.appendChild(d);
    });
  }
  function openBestiary() {
    G.mode = 'select'; UI.show('#screen-bestiary');
    const box = $('#bestiary'); box.innerHTML = ''; const seen = save.seenEnemies || {}; let got = 0;
    DEX.forEach(([type, name, desc]) => {
      const ok = !!seen[type]; if (ok) got++;
      const cv = document.createElement('canvas'); cv.width = 20; cv.height = 20; const g2 = cv.getContext('2d'); g2.imageSmoothingEnabled = false; ctx = g2;
      try {
        if (!ok) { g2.fillStyle = '#d9d9d9'; g2.fillRect(2, 2, 16, 16); g2.fillStyle = '#9a9a9a'; g2.font = '700 12px system-ui, sans-serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText('?', 10, 11); }
        else if (type === 'fake') drawFake({ x: 3, y: 4, c: 0, look: 2, ex: -10, ey: 0, flash: 0 }, 0, 0);
        else { const nm = !EXCEL && !['walker', 'guard', 'flyer', 'turret'].includes(type) ? 'walker' : type; g2.drawImage(EXCEL ? GFXX.enemy(nm, 0, false) : sprite(nm, 0, false), 1, 1); }
      } finally { ctx = mainCtx; }
      cv.className = 'gtile';
      const d = document.createElement('div'); d.className = 'gi' + (ok ? '' : ' lock'); d.innerHTML = '<div><b></b><span></span></div>'; d.insertBefore(cv, d.firstChild);
      d.querySelector('b').textContent = ok ? name : '？？？'; d.querySelector('span').textContent = ok ? desc : 'まだ であって いない';
      box.appendChild(d);
    });
    $('#bestiary-rate').textContent = got + '/' + DEX.length;
  }
  if ($('#btn-bestiary')) { $('#btn-bestiary').onclick = openBestiary; $('#btn-bestiary-back').onclick = () => UI.select(); }
  $('#btn-guide').onclick = () => openGuide('title');
  $('#btn-guide2').onclick = () => openGuide('select');
  $('#btn-guide-back').onclick = () => (guideFrom === 'select' ? UI.select() : UI.title());
  document.querySelectorAll('[data-proxy]').forEach(b => { b.onclick = () => $(b.dataset.proxy).click(); });
  $('#btn-edit').onclick = () => toggleEdit();
  $('#btn-restart').onclick = () => UI.restart();
  $('#btn-menu').onclick = () => (EDITOR_TEST ? backToEditor() : UI.select());
  $('#btn-mute').onclick = () => { muted = !muted; save.muted = muted; persist(); $('#btn-mute').textContent = muted ? '🔇' : '🔊'; };
  $('#btn-mute').textContent = muted ? '🔇' : '🔊';
  $('#r-retry').onclick = () => { UI.start(G.levelIdx); };
  $('#r-next').onclick = () => { if (G.levelIdx >= LEVELS.length - 1) UI.select(); else UI.start(G.levelIdx + 1); };
  $('#r-menu').onclick = () => UI.select();
  $('#btn-reset').onclick = () => { if (confirm('セーブデータを消しますか？')) { save = { levels: {}, muted }; persist(); UI.buildSelect(); } };

  // ===== 拡大ひょうじ(整数倍) =====
  // ウィンドウ全からだ(リボン・シート・ペイン)を、がめんにあわせて拡大する。シートは、いつも320×180(マス目の世界)。
  function fit() {
    const wrap = $('#stage'), vw = wrap.clientWidth, vh = wrap.clientHeight, portrait = vw < vh;
    const RH = portrait ? 48 : 15, LPW = portrait ? 0 : 48, PW = portrait ? 0 : 80; let LW = LPW + W + PW, LH = RH + H;
    let s = Math.min(vw / LW, vh / (portrait ? RH + H + 90 : LH)); if (s >= 2) s = Math.floor(s); // せいすうばいに、ぴったりいれる
    let ph = 100;
    if (portrait) { ph = Math.max(90, Math.min(300, Math.floor(vh / s) - RH - H)); LH = RH + H + ph; if (LH * s > vh) s = vh / LH; }
    const r = document.documentElement.style; r.setProperty('--s', s); r.setProperty('--rh', RH); r.setProperty('--lw', LPW); r.setProperty('--pw', PW); r.setProperty('--ph', ph);
    cv.style.width = W * s + 'px'; cv.style.height = H * s + 'px';
    $('#game').style.width = LW * s + 'px'; $('#game').style.height = LH * s + 'px';
    document.body.classList.toggle('s3', s >= 2.7);
  }
  addEventListener('resize', fit); fit();

  // ===== 操作感チューニングパネル: 数値をスライダーでかえて、そのまま あそんで たしかめる =====
  // 値は TU(上の TUNE_DEF がもとの値)。「コピー」で、いまの値をクリップボードに出せる。
  (function tunePanel() {
    if (!DEV) return;
    const GROUPS = [
      ['はしる', [
        ['RUN', 'さいだい速度', 40, 220, 1], ['ACC', '地上の加速', 200, 4000, 10], ['FRIC', '地上のブレーキ', 200, 4000, 10],
        ['AIR', '空中の加速', 100, 3000, 10], ['AIRF', '空中のブレーキ', 0, 1500, 10]]],
      ['ジャンプ・おちる', [
        ['JUMP', 'ジャンプ力', 150, 500, 1], ['GRAV', '重力(のぼり)', 400, 2400, 10], ['FALLM', 'おちる時の重力倍率', 0.6, 3, 0.05],
        ['MAXFALL', 'おちる最高速', 150, 800, 5], ['CUT', 'ボタンを離した時の重力倍率', 1, 5, 0.1],
        ['COYOTE', 'コヨーテ時間(秒)', 0, 0.3, 0.01], ['JBUF', '先行入力(秒)', 0, 0.3, 0.01]]],
      ['ふわり・ほか', [
        ['HOVER_T', 'ふわりの時間(秒)', 0, 1.5, 0.01], ['HOVER_VY', 'ふわりのおちる速さ', 0, 150, 1], ['BOUNCE', 'ばねの強さ', 200, 800, 5],
        ['DASH_V', 'ダッシュ速度', 100, 500, 5], ['DASH_T', 'ダッシュ時間(秒)', 0.05, 0.5, 0.01],
        ['ICE_ACC', 'こおりの加速', 50, 1000, 10], ['ICE_FRIC', 'こおりのブレーキ', 10, 600, 5]]],
      ['まど(背景)', [
        ['WIN_FLIP', 'めくれる時間(秒)', 0.2, 2, 0.05], ['WIN_PERIOD', '閉じる間隔(倍率・大きいほど たまに)', 0.5, 4, 0.1], ['WIN_CLOSED', '閉じている長さ(倍率)', 0, 2, 0.1]]],
    ];
    const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
    const panel = el('aside', null); panel.id = 'tune';
    const head = el('div', 'tune-head'); head.append(el('strong', null, '操作感チューニング'));
    const btnReset = el('button', 'tiny ghost', 'もどす'), btnCopy = el('button', 'tiny ghost', 'コピー');
    head.append(btnReset, btnCopy); panel.append(head);

    const live = el('div', 'tune-live'); const cvs = el('canvas'); cvs.width = 216; cvs.height = 76; live.append(cvs);
    const info = el('pre', 'tune-info'); live.append(info); panel.append(live);
    const legend = el('div', 'tune-legend'); legend.innerHTML = '<span style="color:#4c9be8">■ よこ速度</span> <span style="color:#e8563f">■ たて速度</span>'; panel.append(legend);

    const rows = {};
    const fmt = (k, v) => String(Math.round(v * 100) / 100);
    for (const [title, items] of GROUPS) {
      const g = el('details'); g.open = true; g.append(el('summary', null, title));
      for (const [k, label, min, max, step] of items) {
        const row = el('label', 'tune-row'), name = el('span', 'tune-name', label), val = el('span', 'tune-val');
        const inp = el('input'); inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = TU[k];
        const sync = () => { val.textContent = fmt(k, TU[k]); val.classList.toggle('chg', TU[k] !== TUNE_DEF[k]); };
        inp.addEventListener('input', () => { TU[k] = +inp.value; sync(); });
        // スライダーに フォーカスが のこると ← → が スライダーを うごかして ゲームが 操作できなくなるので、はなしたら外す
        const drop = () => inp.blur(); inp.addEventListener('change', drop); inp.addEventListener('pointerup', drop);
        row.append(name, val, inp); g.append(row); rows[k] = { inp, sync }; sync();
      }
      panel.append(g);
    }
    const toggle = el('button', 'ghost tiny', '調整パネル ▸'); toggle.id = 'tune-toggle';
    document.body.append(panel, toggle);
    const setOpen = (on) => { document.body.classList.toggle('tuning', on); toggle.textContent = on ? '調整パネル ◂' : '調整パネル ▸'; dispatchEvent(new Event('resize')); };
    toggle.onclick = () => setOpen(!document.body.classList.contains('tuning'));
    btnReset.onclick = () => { Object.assign(TU, TUNE_DEF); for (const k in rows) { rows[k].inp.value = TU[k]; rows[k].sync(); } };
    btnCopy.onclick = () => {
      const txt = JSON.stringify(TU).replace(/,/g, ', ');
      const done = () => UI.toast('いまの値をコピーしました', 1500);
      try { navigator.clipboard.writeText(txt).then(done, () => prompt('コピーしてください', txt)); } catch (e) { prompt('コピーしてください', txt); }
    };
    setOpen(true);

    // 読みとり(計算した値)とグラフ
    const ctx2 = cvs.getContext('2d'), N = 216, hx = new Float32Array(N), hy = new Float32Array(N); let hi = 0, acc2 = 0, last2 = performance.now(), infoT = 0;
    function derived() {
      const jh = TU.JUMP * TU.JUMP / (2 * TU.GRAV), tUp = TU.JUMP / TU.GRAV, tDn = Math.sqrt(2 * jh / (TU.GRAV * TU.FALLM)), air = tUp + tDn;
      const short = (TU.JUMP * TU.JUMP) / (2 * TU.GRAV * TU.CUT);
      return '最高ジャンプ ' + jh.toFixed(1) + 'px (' + (jh / T).toFixed(1) + 'マス)\n'
        + 'ちょん押し   ' + short.toFixed(1) + 'px (' + (short / T).toFixed(1) + 'マス)\n'
        + '滞空時間     ' + air.toFixed(2) + '秒 / とぶ距離 約' + Math.round(TU.RUN * air) + 'px\n'
        + 'トップ速度まで ' + (TU.RUN / TU.ACC).toFixed(2) + '秒 / とまる距離 ' + Math.round(TU.RUN * TU.RUN / (2 * TU.FRIC)) + 'px';
    }
    function frame() {
      requestAnimationFrame(frame);
      const p = G.p, on = G.mode === 'play' && p && !G.paused;
      // 画面の更新回数に関係なく、1秒=60サンプルで記録する(グラフの横軸は 約3.6秒)
      const now = performance.now(); acc2 += Math.min(250, now - last2) / (1000 / 60); last2 = now;
      for (; acc2 >= 1; acc2--) { hx[hi] = on ? p.vx : 0; hy[hi] = on ? p.vy : 0; hi = (hi + 1) % N; }
      if (!document.body.classList.contains('tuning')) return;
      const w = cvs.width, h = cvs.height; ctx2.clearRect(0, 0, w, h); ctx2.fillStyle = '#0006'; ctx2.fillRect(0, 0, w, h);
      ctx2.strokeStyle = '#ffffff30'; ctx2.beginPath(); ctx2.moveTo(0, h / 2); ctx2.lineTo(w, h / 2); ctx2.stroke();
      const line = (arr, col, sc) => { ctx2.strokeStyle = col; ctx2.beginPath(); for (let i = 0; i < N; i++) { const v = arr[(hi + i) % N], x = i, y = h / 2 - v * sc; i ? ctx2.lineTo(x, y) : ctx2.moveTo(x, y); } ctx2.stroke(); };
      line(hx, '#4c9be8', (h / 2) / 260); line(hy, '#e8563f', (h / 2) / 520);
      if (now - infoT > 100 && (infoT = now)) info.textContent = derived() + (on ? '\n\nvx ' + p.vx.toFixed(0) + '  vy ' + p.vy.toFixed(0) + '  ' + (p.ground ? '接地' : '空中') : '\n\n(ステージを あそぶと 速度が出ます)');
    }
    frame();
  })();

  // ===== BGMの切りかえ: 画面・ステージ(ワールド)・「なおす」中かどうかで きめる =====
  const bgmFor = (w) => w <= 3 ? 'stageA' : w <= 7 ? 'stageB' : 'stageC';
  function syncBGM() {
    let name = null, delay = 0.15;
    if (G.mode === 'title' || G.mode === 'opening') name = 'title';
    else if (G.mode === 'select') name = 'select';
    else if (G.mode === 'result') { name = 'select'; delay = 2.4; } // クリアのジングルが おわってから
    else if (G.mode === 'play' && G.level && !G.cleared) name = (G.p && G.p.dead) ? null : bgmFor(G.level.world | 0); // ミスのあいだは BGMを 止める
    BGM.want(name, delay);
    BGM.duck(G.mode === 'play' && ((G.edit && G.edit.on) || (G.p && G.p.dead > 0)));
  }

  // ===== メインループ =====
  let last = performance.now(), acc = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    if (G.paused) { last = now; return; }
    syncBGM();
    acc += Math.min(.1, (now - last) / 1000); last = now;
    while (acc >= DT) { update(DT); acc -= DT; }
    render();
  }
  loadLevel(0); render(); UI.title();
  { // ?test=ID : ステージさくせいページからのテストプレイ
    const m = DEMO ? null : /[?&]test=([^&]+)/.exec(location.search);
    if (m) { const i = LEVELS.findIndex(l => l.id === decodeURIComponent(m[1])); if (i >= 0) { audio(); UI.start(i); if (EDITOR_TEST) UI.toast('テストプレイ中：右上の ☰ でステージ作成に戻る', 4000); } }
  }
  if ($('#btn-editor')) $('#btn-editor').onclick = () => { location.href = 'editor.html'; };
  requestAnimationFrame(loop);

  // ===== テストようの口(自どうプレイが使う) =====
  window.__geko = { OP,
    G, input, press, update, render, UI, LEVELS, T, TL, COLORS, TOOLS, makeEnemy, setEdit, undoEdit, redoEdit, runPlan, planFor, normRect,
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

