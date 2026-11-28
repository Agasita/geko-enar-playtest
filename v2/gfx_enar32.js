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
  const HD = window.HD = { ready: false, blocks: (function () { const m = (/[?&]blocks=(old|concept|gpt|raw|big)/.exec(location.search) || [])[1]; return m === 'old' ? null : (m || 'big'); })() }; // 茶・鋼・赤・青は、大きい絵(GPT)から32pxに縮めて、決めたパレットに寄せたものを つかう。blocks=old(いまの素材) / concept(原画から) / raw(パレットに寄せる前) でくらべられる(HD.blocks を かえると、その場で きりかわる)
  // 画面の大きさ: ?ts=64 なら 1マス=64px(画面 1152×720)。ふつうは 32(576×360)。ブロックの絵(320px)は、ts=40/64/80/160/320 で ぴったり割り切れる
  const TS = Math.max(16, Math.min(320, parseInt((/[?&]ts=(\d+)/.exec(location.search) || [])[1], 10) || 32)), SC = TS / 16;
  const cv = document.getElementById('cv');
  if (cv) { cv.width = Math.round(288 * SC); cv.height = Math.round(180 * SC); const c = cv.getContext('2d'); c.imageSmoothingEnabled = false; c.setTransform(SC, 0, 0, SC, 0, 0); }
  HD.ts = TS;
  // HDの絵は、2つの引数(x, y)で描くと、半分の大きさ。そのほかの形は、そのまま。
  const _draw = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function (im) {
    if (im && im.__lw && arguments.length === 3) return _draw.call(this, im, arguments[1], arguments[2], im.__lw, im.__lw * im.height / im.width);
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
  // 320px四方のブロック(8まい)。どれも 1マス(=論理16)の大きさで 描く
  const big = {};
  ['brown', 'lava', 'ice', 'spring', 'cracked', 'glass', 'steel', 'lock'].forEach((n) => loadImg('assets/enar32_hires/blocks320/' + n + '.png').then((i) => { if (n === 'brown' && !/[?&]brown=320/.test(location.search)) return; if (n === 'steel' && !/[?&]steel=320/.test(location.search)) return; if (n === 'lava' && !/[?&]lava=320/.test(location.search)) return; if (n === 'ice' && !/[?&]ice=320/.test(location.search)) return; i.__hd = true; i.__lw = 16; big[n] = i; }).catch(() => {}));
  // 土(茶)のブロックは、32pxの絵(brown_user.png)に さしかえる。?brown=320 で 320px版にもどせる
  if (!/[?&]brown=320/.test(location.search)) loadImg(BASE + 'brown_user.png').then((i) => { i.__hd = true; i.__lw = 16; big.brown = i; }).catch(() => {});
  // 鋼のブロックも、32pxの絵(steel_user.png)に さしかえる。?steel=320 で 320px版にもどせる
  if (!/[?&]steel=320/.test(location.search)) loadImg(BASE + 'steel_user.png').then((i) => { i.__hd = true; i.__lw = 16; big.steel = i; }).catch(() => {});
  // マグマ(赤)のブロックも、32pxの絵(lava_user.png)に さしかえる。?lava=320 で 320px版にもどせる
  if (!/[?&]lava=320/.test(location.search)) loadImg(BASE + 'lava_user.png').then((i) => { i.__hd = true; i.__lw = 16; big.lava = i; }).catch(() => {});
  // 氷(青)のブロックも、32pxの絵(ice_user.png)に さしかえる。?ice=320 で 320px版にもどせる
  if (!/[?&]ice=320/.test(location.search)) loadImg(BASE + 'ice_user.png').then((i) => { i.__hd = true; i.__lw = 16; big.ice = i; }).catch(() => {});
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
      if (HD.blocks === 'big') {
        const n = t === 3 ? 'cracked' : c === 0 ? 'brown' : c === 1 ? 'lava' : c === 2 ? 'ice' : c === 3 ? 'spring' : c === 5 ? 'glass' : null;
        if (n && big[n]) return big[n];
      }
      if (HD.blocks && HD.blocks !== 'big' && t !== 3 && c <= 2) { const kk = ['brown', 'red', 'blue'][c]; const q = cmpFrame(kk, s); if (q) return q; }
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
  // ?hero=new: 画像生成AIが作った、新しいエナー(シマエナガ型ロボット。羽=キーボード、尾=USBケーブル)の試験。32px×9コマの1列(hero_enar_new.png)
  // コマ: 0 立ち / 1 まばたき / 2 はばたき上 / 3 はばたき下 / 4 ダメージ / 5 ふわり / 6〜8 喜び
  let heroNew = null;
  if (/[?&]hero=new/.test(location.search)) loadImg(BASE + 'hero_enar_new.png').then((i) => { heroNew = i; }).catch(() => {});
  function heroNewFrame(idx, flip) {
    const key = 'hnew' + idx + (flip ? 1 : 0); if (cache[key]) return cache[key];
    const c = document.createElement('canvas'); c.width = 32; c.height = 32; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    if (flip) { g.translate(32, 0); g.scale(-1, 1); }
    g.drawImage(heroNew, idx * 32, 0, 32, 32, 0, 0, 32, 32); c.__hd = true; return cache[key] = c;
  }
  X.ener = function (name, flip) {
    if (heroNew) return heroNewFrame(name === 'hurt' ? 4 : name === 'up' ? 2 : name === 'down' ? 3 : 0, flip);
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
    S.metal = function () { if (HD.blocks === 'big' && big.steel) return big.steel; if (HD.blocks && HD.blocks !== 'big') { const q = cmpFrame('steel', 0); if (q) return q; } if (HD.ready) { const f = frame('block_steel', 'variant_0'); if (f) return f; } return orig.metal.apply(S, arguments); };
  }
  // ゲームがわから つかう: カギの重ね絵(ブロックと おなじ大きさ)、エナジーの玉
  HD.lock = () => (HD.ready ? frame('block_lock', 'overlay') : null);
  HD.orb = () => (HD.ready ? frame('item_energy', pick(['shine_0', 'shine_1', 'shine_2', 'shine_3'], 5)) : null);
})();
