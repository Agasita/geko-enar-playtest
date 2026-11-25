/* 32px素材（enar32）を、あたらしい見た目テーマとして つかう。 URLに ?gfx=enar32 を つけたときだけ はたらく（なにも つけなければ、いままでの Excel風のまま）。
   - ゲームの座標・物理は、いままで(16px=1マス)のまま。絵だけを、2倍の こまかさ(32px=1マス)で描く。
   - そのために、画面(canvas)を 576×360 にして、ctx.scale(2,2)。HDの絵(__hd)は、2つの引数の drawImage だと、半分の大きさ(論理px)で描く。
   - 素材は assets/enar32/ 。よみこみが おわるまでは、いままでの Excel風の絵が出る。
   いまの対象(第1弾): ブロック・鋼・カギ・エナー・ゴール・かけら・エナジーの玉。てき・背景・UIは、これから。 */
(function () {
  'use strict';
  const ON = /[?&]gfx=enar32/.test(location.search);
  if (!ON) return;
  const BASE = 'assets/enar32/';
  const HD = window.HD = { ready: false, blocks: (function () { const m = (/[?&]blocks=(old|concept|gpt|raw)/.exec(location.search) || [])[1]; return m === 'old' ? null : (m || 'gpt'); })() }; // 茶・鋼・赤・青は、大きい絵(GPT)から32pxに縮めて、決めたパレットに寄せたものを つかう。blocks=old(いまの素材) / concept(原画から) / raw(パレットに寄せる前) でくらべられる(HD.blocks を かえると、その場で きりかわる)
  const cv = document.getElementById('cv');
  if (cv) { cv.width = 576; cv.height = 360; const c = cv.getContext('2d'); c.imageSmoothingEnabled = false; c.setTransform(2, 0, 0, 2, 0, 0); }
  // HDの絵は、2つの引数(x, y)で描くと、半分の大きさ。そのほかの形は、そのまま。
  const _draw = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function (im) {
    if (im && im.__hd && arguments.length === 3) return _draw.call(this, im, arguments[1], arguments[2], im.width / 2, im.height / 2);
    return _draw.apply(this, arguments);
  };
  const sheets = {}, atlas = {}, cache = {}, cmp = {};
  const NEED = ['block_brown', 'block_red', 'block_blue', 'block_green', 'block_yellow', 'block_cracked', 'block_glass', 'block_steel', 'block_lock', 'hero_enar', 'hero_glide', 'item_floppy', 'item_sigma', 'item_energy'];
  const loadImg = (src) => new Promise((ok, ng) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ng; i.src = src; });
  Promise.all([fetch(BASE + 'atlas.json').then(r => r.json()), ...NEED.map(n => loadImg(BASE + 'sheets/' + n + '.png').then(i => { sheets[n] = i; }))])
    .then(([a]) => { Object.assign(atlas, a); HD.ready = true; })
    .catch((e) => { console.warn('enar32: よみこみに しっぱい', e); });
  // くらべ用: 大きい絵(コンセプト原画 / GPTの縮小版)から 32pxに切った 1列のシート。HD.blocks で つかう
  ['concept', 'gpt', 'raw'].forEach((k) => loadImg('assets/enar32_hires/' + (k === 'raw' ? 'cmp_gpt_raw' : 'cmp_' + k) + '.png').then((img) => {
    const n = img.width / 32; cmp[k] = [];
    for (let i = 0; i < n; i++) { const c = document.createElement('canvas'); c.width = 32; c.height = 32; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, i * 32, 0, 32, 32, 0, 0, 32, 32); c.__hd = true; cmp[k].push(c); }
  }).catch(() => {}));
  // gpt: 茶0-3 / 鋼4-6 / 赤7-11(idle,heat0-3) / 青12-16(idle,shine0-3)。concept: 茶0 / 鋼1 / 赤2 / 青3
  function cmpFrame(kind, s) {
    const a = cmp[HD.blocks]; if (!a) return null; const g = HD.blocks !== 'concept';
    if (kind === 'brown') return g ? a[s % 4] : a[0];
    if (kind === 'steel') return g ? a[4 + (s % 3)] : a[1];
    if (kind === 'red') return g ? a[7 + [0, 1, 2, 3, 4, 3, 2, 1][Math.floor(now() * 6 + s) % 8]] : a[2];
    if (kind === 'blue') return g ? a[12 + [0, 0, 0, 1, 2, 3, 4, 0][Math.floor(now() * 4 + s) % 8]] : a[3];
    return null;
  }
  // シート(ファイル名)と、コマの名前 → 切り出した canvas(__hd つき)。flip=左右反転
  function frame(sheet, name, flip) {
    const key = sheet + ':' + name + (flip ? 1 : 0); if (cache[key]) return cache[key];
    const img = sheets[sheet]; if (!img) return null;
    let q = null; for (const k in atlas) for (const s of atlas[k]) if (s.file === 'sheets/' + sheet + '.png') { const f = s.frames.find(f => f.name === name); if (f) q = f; }
    if (!q) return null;
    const c = document.createElement('canvas'); c.width = q.w; c.height = q.h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    if (flip) { g.translate(q.w, 0); g.scale(-1, 1); }
    g.drawImage(img, q.x, q.y, q.w, q.h, 0, 0, q.w, q.h);
    c.__hd = true; return cache[key] = c;
  }
  const now = () => performance.now() / 1000;
  const pick = (arr, hz, off) => arr[Math.floor(now() * hz + (off || 0)) % arr.length];
  const X = window.GFXX, S = window.GFX;
  if (!X) return;
  const orig = { block: X.block, ener: X.ener, floppy: X.floppy, shard: X.shard, metal: S && S.metal, lock: S && S.lock };
  X.block = function (t, c, top, bot, seed) {
    if (HD.ready) {
      let f = null; const s = Math.abs(seed || 0);
      if (HD.blocks && t !== 3 && c <= 2) { const kk = ['brown', 'red', 'blue'][c]; const q = cmpFrame(kk, s); if (q) return q; }
      if (t === 3) f = frame('block_cracked', 'idle_0');                                  // ひび割れ
      else if (c === 4) f = frame('block_yellow', 'idle_0');                              // 黄(もろい)
      else if (c === 0) f = frame('block_brown', 'variant_' + (s % 4));
      else if (c === 1) f = frame('block_red', pick(['idle_0', 'heat_0', 'heat_1', 'heat_2', 'heat_3', 'heat_2', 'heat_1', 'heat_0'], 6, s));
      else if (c === 2) f = frame('block_blue', pick(['idle_0', 'idle_0', 'idle_0', 'shine_0', 'shine_1', 'shine_2', 'shine_3', 'idle_0'], 4, s));
      else if (c === 3) f = frame('block_green', 'idle_0');
      else if (c === 5) f = frame('block_glass', pick(['idle_0', 'idle_0', 'idle_0', 'idle_0', 'shine_0', 'shine_1', 'shine_2', 'shine_3'], 3, s));
      if (f) return f;
    }
    return orig.block.apply(X, arguments);
  };
  X.ener = function (name, flip) {
    if (HD.ready) {
      const f = frame('hero_enar', name === 'hurt' ? 'damage' : name === 'up' ? 'flap_up' : name === 'down' ? 'flap_down' : 'idle_0', flip);
      if (f) return f;
    }
    return orig.ener.apply(X, arguments);
  };
  X.floppy = function (back) {
    if (HD.ready) { const f = frame('item_floppy', back ? 'spin_3' : 'float_0'); if (f) return f; }
    return orig.floppy.apply(X, arguments);
  };
  X.shard = function () {
    if (HD.ready) { const f = frame('item_sigma', pick(['shine_0', 'shine_1', 'shine_2', 'shine_3'], 5)); if (f) return f; }
    return orig.shard.apply(X, arguments);
  };
  if (S) {
    S.metal = function () { if (HD.blocks) { const q = cmpFrame('steel', 0); if (q) return q; } if (HD.ready) { const f = frame('block_steel', 'variant_0'); if (f) return f; } return orig.metal.apply(S, arguments); };
  }
  // ゲームがわから つかう: カギの重ね絵(ブロックと おなじ大きさ)、エナジーの玉
  HD.lock = () => (HD.ready ? frame('block_lock', 'overlay') : null);
  HD.orb = () => (HD.ready ? frame('item_energy', pick(['shine_0', 'shine_1', 'shine_2', 'shine_3'], 5)) : null);
})();
