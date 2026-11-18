/* ゲコ＆エナー v2 — ソリッド系グラフィック(見本)。URLに ?gfx=snes を付けると使われる。
   考え方: ベタ塗りの太い色面 + くっきりした縁どり。ブロックは「表計算のセル」のように、1マスずつ縁どられる。
   質感のノイズやディザはつかわない。背景は暗く落ちついた色 + うすい方眼(＝シート)。元のグラフィックは、そのまま残っている。 */
(function () {
  'use strict';
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, t) => { const x = typeof a === 'string' ? hex(a) : a, y = typeof b === 'string' ? hex(b) : b; return [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]; };
  const rgb = (c, a) => 'rgba(' + c.map(v => Math.round(v)).join(',') + ',' + (a === undefined ? 1 : a) + ')';
  function surface(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); const img = g.createImageData(w, h); return { c, g, img, w, h, set(x, y, col) { if (x < 0 || y < 0 || x >= w || y >= h) return; const i = (y * w + x) * 4, v = typeof col === 'string' ? hex(col) : col; img.data[i] = v[0]; img.data[i + 1] = v[1]; img.data[i + 2] = v[2]; img.data[i + 3] = 255; }, done() { g.putImageData(img, 0, 0); return c; } }; }

  // ---- ブロックの色(＝性質)。o:縁 / s:かげ(下の面) / b:おもて(上の面) / l:ハイライト / x:しるし ----
  const PAL = [
    { o: '#3B2812', s: '#8F6A36', b: '#D9A650', l: '#F6D590', x: '#8F6A36' },   // 茶(ふつう)
    { o: '#3A0E18', s: '#8A2A2C', b: '#E8563F', l: '#FF9A6B', x: '#FFE27A' },   // 赤(あつい)
    { o: '#17536B', s: '#3D9DBA', b: '#7BE0EE', l: '#E4FBFF', x: '#FFFFFF' },   // 青(氷)
    { o: '#17452B', s: '#2F8048', b: '#58C070', l: '#A6EA96', x: '#E8FFD0' },   // 緑(ばね)
    { o: '#6B4608', s: '#C28E14', b: '#F7CE45', l: '#FFF0A0', x: '#7A4E0A' },   // 黄(もろい)
  ];
  const cache = {};
  function makeBlock(c, topOpen, botOpen) {
    const p = PAL[c], s = surface(16, 16);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) s.set(x, y, y < 10 ? p.b : p.s); // おもて(上10行)と、かげ(下6行)
    for (let x = 1; x < 15; x++) { s.set(x, 1, p.l); s.set(x, 10, mix(p.s, p.o, .35)); }          // 上のハイライトと、面の境いめ
    for (let y = 1; y < 10; y++) s.set(1, y, p.l);                                                 // 左のハイライト
    for (let x = 0; x < 16; x++) { s.set(x, 0, p.o); s.set(x, 15, p.o); } for (let y = 0; y < 16; y++) { s.set(0, y, p.o); s.set(15, y, p.o); } // 縁どり
    // しるし(性質が、ひと目で分かる)
    const mark = (pts, col) => pts.forEach(([x, y]) => s.set(x, y, col));
    if (c === 1) { mark([[3, 3], [4, 4], [5, 5], [6, 6], [7, 7], [9, 3], [10, 4], [11, 5], [12, 6], [13, 7]], p.x); mark([[4, 3], [5, 4], [6, 5], [7, 6], [10, 3], [11, 4], [12, 5], [13, 6]], p.l); }
    else if (c === 2) { mark([[10, 3], [9, 4], [8, 5], [7, 6], [11, 3], [10, 4], [9, 5], [8, 6]], p.x); mark([[4, 7], [3, 8], [5, 7], [4, 8]], p.x); }
    else if (c === 3) { for (const y0 of [3, 9]) for (let i = 0; i < 4; i++) { s.set(7 - i, y0 + i, p.o); s.set(8 + i, y0 + i, p.o); s.set(7 - i, y0 + i - 1, p.x); s.set(8 + i, y0 + i - 1, p.x); } }
    else if (c === 4) { mark([[8, 2], [7, 3], [7, 4], [8, 5], [9, 6], [8, 7], [7, 8], [8, 9]], p.x); mark([[9, 2], [8, 3], [8, 4], [9, 5], [10, 6], [9, 7], [8, 8]], p.o); }
    return s.done();
  }
  function makeCrack(topOpen, botOpen) { // ひび割れ壁(茶 + ひび)
    const s = surface(16, 16), p = PAL[0]; s.g.drawImage(makeBlock(0, topOpen, botOpen), 0, 0);
    const g = s.g; g.fillStyle = p.o; for (const [x, y] of [[8, 2], [7, 3], [7, 4], [8, 5], [9, 6], [8, 7], [7, 8], [8, 9], [9, 11], [8, 12], [8, 13]]) g.fillRect(x, y, 2, 1);
    return s.c;
  }
  function makeSteel() { // 鋼: 暗いスレート。上の面が少し明るい。ボルト
    const s = surface(16, 16), o = '#1B2036', b = '#707A99', t = '#9AA5C4', d = '#4A5472', h = '#C9D2EA';
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) s.set(x, y, y < 10 ? b : d);
    for (let x = 1; x < 15; x++) { s.set(x, 1, t); s.set(x, 10, '#39405A'); } for (let y = 1; y < 10; y++) s.set(1, y, t);
    for (let x = 0; x < 16; x++) { s.set(x, 0, o); s.set(x, 15, o); } for (let y = 0; y < 16; y++) { s.set(0, y, o); s.set(15, y, o); }
    for (const [x, y] of [[3, 3], [11, 3]]) { s.set(x, y, h); s.set(x + 1, y, t); s.set(x, y + 1, d); s.set(x + 1, y + 1, d); }
    return s.done();
  }
  function makeLock() {
    const s = surface(8, 10), o = '#1F2A44', y = '#F5C842', k = '#FFF0A0', d = '#B98A12';
    ['..oooo..', '.oyooyo.', '.oy..yo.', '.oy..yo.', 'oooooooo', 'oykkkkyo', 'oykddkyo', 'oykddkyo', 'oyyyyyyo', 'oooooooo'].forEach((row, yy) => [...row].forEach((ch, xx) => { if (ch === 'o') s.set(xx, yy, o); else if (ch === 'y') s.set(xx, yy, y); else if (ch === 'k') s.set(xx, yy, k); else if (ch === 'd') s.set(xx, yy, d); }));
    return s.done();
  }
  let lockImg = null;

  // ---- 背景: 暗い色 + うすい方眼(スプレッドシート) ----
  const bgCache = {};
  function buildBg(bgHex, W, H) {
    const base = hex(bgHex), c = document.createElement('canvas'); c.width = W; c.height = H + 160; const g = c.getContext('2d');
    const top = mix(base, [14, 16, 34], .86), bot = mix(base, [14, 16, 34], .68);
    const n = 7; for (let i = 0; i < n; i++) { g.fillStyle = rgb(mix(top, bot, i / (n - 1))); g.fillRect(0, Math.round(i * c.height / n), W, Math.ceil(c.height / n)); } // ベタ塗りの帯(ディザなし)
    // 四すみを暗くする
    const vg = g.createRadialGradient(W / 2, c.height / 2, Math.min(W, c.height) * .35, W / 2, c.height / 2, Math.max(W, c.height) * .75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)'); g.fillStyle = vg; g.fillRect(0, 0, W, c.height);
    return { img: c, line: rgb(mix(base, [255, 255, 255], .42), .13), line2: rgb(mix(base, [255, 255, 255], .5), .22) };
  }
  function drawBg(ctx, G, lv, W, H) {
    const key = lv.bg + W + H; const L = bgCache[key] || (bgCache[key] = buildBg(lv.bg, W, H));
    const cx = G.cam.x, cy = G.cam.y, maxY = Math.max(0, lv.h * 16 - H), vy = maxY ? cy / maxY : 0;
    ctx.drawImage(L.img, 0, -Math.round(vy * 160));
    const par = .55, step = 16, ox = Math.round(cx * par), oy = Math.round(cy * par); // 方眼は、世界より少しゆっくり動く(奥ゆき)
    ctx.fillStyle = L.line; for (let x = -(ox % step); x < W; x += step) ctx.fillRect(x, 0, 1, H); for (let y = -(oy % step); y < H; y += step) ctx.fillRect(0, y, W, 1);
    ctx.fillStyle = L.line2; const big = step * 4; for (let x = -(ox % big); x < W; x += big) ctx.fillRect(x, 0, 1, H); for (let y = -(oy % big); y < H; y += big) ctx.fillRect(0, y, W, 1);
  }

  window.GFX = {
    block(t, c, topOpen, botOpen) { const key = (t === 3 ? 'c' : 'b') + c; return cache[key] || (cache[key] = t === 3 ? makeCrack() : makeBlock(c)); },
    steel() { return cache.s || (cache.s = makeSteel()); },
    lock() { return lockImg || (lockImg = makeLock()); },
    bg: drawBg,
  };
})();
