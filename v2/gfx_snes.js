/* ゲコ＆エナー v2 — スーパーファミコン風グラフィック(見本)。URLに ?gfx=snes を付けると使われる。
   ブロック・地形・背景をプログラムで描く(ドット単位)。元のグラフィックは、そのまま残っている。 */
(function () {
  'use strict';
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const toHex = (c) => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const x = typeof a === 'string' ? hex(a) : a, y = typeof b === 'string' ? hex(b) : b; return [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]; };
  const light = (c, t) => mix(c, [255, 255, 255], t), dark = (c, t) => mix(c, [20, 24, 48], t);
  function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function surface(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); const img = g.createImageData(w, h); return { c, g, img, w, h, set(x, y, col) { if (x < 0 || y < 0 || x >= w || y >= h) return; const i = (y * w + x) * 4, v = typeof col === 'string' ? hex(col) : col; img.data[i] = v[0]; img.data[i + 1] = v[1]; img.data[i + 2] = v[2]; img.data[i + 3] = 255; }, done() { g.putImageData(img, 0, 0); return c; } }; }

  // ---- ブロックの色(＝性質)ごとの、5段階の色 ----
  const PAL = [
    { d: '#4A321A', m: '#8A6838', b: '#C9A15E', l: '#E8CFA0', h: '#FFF0CC' },   // 茶(ふつう)
    { d: '#3A1020', m: '#7A2230', b: '#A8403F', l: '#E8563F', h: '#FFC86B' },   // 赤(あつい)
    { d: '#2A6D8A', m: '#4FB0C8', b: '#8CE0EE', l: '#CFF6FB', h: '#FFFFFF' },   // 青(氷)
    { d: '#25583A', m: '#3F8F52', b: '#58B368', l: '#9EDB8C', h: '#D8F8B8' },   // 緑(ばね)
    { d: '#8A5C0C', m: '#C99A1E', b: '#F5C842', l: '#FFE27A', h: '#FFF8C8' },   // 黄(もろい)
  ];
  const cache = {};
  function bevel(s, p, topOpen, botOpen) {
    for (let x = 0; x < 16; x++) { s.set(x, 0, p.l); s.set(x, 15, p.m); }
    for (let y = 0; y < 16; y++) { s.set(0, y, p.l); s.set(15, y, p.m); }
    s.set(15, 0, p.b); s.set(0, 15, p.b);
    if (topOpen) { for (let x = 0; x < 16; x++) { s.set(x, 0, p.h); s.set(x, 1, p.l); } }
    if (botOpen) { for (let x = 0; x < 16; x++) { s.set(x, 14, p.m); s.set(x, 15, p.d); } }
  }
  function speckle(s, p, seed, n) { const r = rng(seed); for (let i = 0; i < n; i++) { const x = 1 + Math.floor(r() * 14), y = 2 + Math.floor(r() * 12); s.set(x, y, r() < .5 ? p.l : p.m); } }
  function fillBase(s, p, grad) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) s.set(x, y, grad ? mix(p.l, p.b, Math.min(1, y / 9)) : p.b); }

  function makeBlock(c, topOpen, botOpen, v) {
    const p = PAL[c], s = surface(16, 16), r = rng(v * 97 + c * 13 + 5);
    fillBase(s, p, c === 2);
    if (c === 0) { // レンガ
      for (let x = 0; x < 16; x++) { s.set(x, 7, p.d); s.set(x, 15, p.d); }
      for (let y = 0; y < 7; y++) s.set(7, y, p.d); for (let y = 8; y < 15; y++) { s.set(3, y, p.d); s.set(11, y, p.d); }
      for (const [x0, x1, y0] of [[0, 7, 0], [8, 15, 0], [0, 3, 8], [4, 11, 8], [12, 15, 8]]) { for (let x = x0 + 1; x <= x1 - 1; x++) s.set(x, y0 + 1, p.l); for (let y = y0 + 1; y <= y0 + 5; y++) s.set(x0 + 1, y, p.l); for (let x = x0 + 1; x <= x1 - 1; x++) s.set(x, y0 + 6, p.m); }
      speckle(s, p, v + 1, 9);
    } else if (c === 1) { // 溶岩の岩(ひびが光る)
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) s.set(x, y, (x + y) % 5 === 0 ? p.m : p.b);
      for (let i = 0; i < 12; i++) s.set(1 + Math.floor(r() * 14), 1 + Math.floor(r() * 14), p.m);
      const path = [[2, 2], [3, 4], [5, 5], [5, 7], [7, 8], [8, 10], [10, 11], [11, 13], [12, 14]];
      path.forEach(([x, y], i) => { s.set(x, y, p.h); s.set(x + 1, y, p.l); s.set(x - 1, y + 0, p.l); if (i % 2) s.set(x, y + 1, p.l); });
      for (const [x, y] of [[13, 3], [14, 5], [3, 11], [2, 13]]) { s.set(x, y, p.l); s.set(x, y - 1, p.h); }
    } else if (c === 2) { // 氷
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = (x - y + 32) % 8; if (d === 0) s.set(x, y, p.l); else if (d === 1) s.set(x, y, p.h); else if (d === 4) s.set(x, y, p.m); }
      for (const [x, y] of [[4, 4], [11, 9]]) { s.set(x, y, p.h); s.set(x - 1, y, p.h); s.set(x + 1, y, p.h); s.set(x, y - 1, p.h); s.set(x, y + 1, p.h); }
    } else if (c === 3) { // ばね(うえむきの矢じるし)
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x + y) % 6 === 0) s.set(x, y, p.m);
      for (const y0 of [3, 9]) for (let i = 0; i < 5; i++) { s.set(8 - i, y0 + i, p.d); s.set(7 + i, y0 + i, p.d); s.set(8 - i, y0 + i - 1, p.h); s.set(7 + i, y0 + i - 1, p.h); s.set(8 - i, y0 + i - 2, p.l); s.set(7 + i, y0 + i - 2, p.l); }
    } else { // 黄(もろい砂岩: すじとひび)
      for (const y of [4, 9, 13]) for (let x = 1; x < 15; x++) if ((x + y) % 5 !== 0) s.set(x, y, p.l);
      for (const y of [5, 10]) for (let x = 2; x < 15; x++) if ((x + y) % 4 === 0) s.set(x, y, p.m);
      const crack = [[7, 1], [8, 2], [7, 3], [6, 5], [7, 6], [9, 8], [8, 10], [6, 11], [7, 13], [8, 14]];
      crack.forEach(([x, y]) => { s.set(x, y, p.d); s.set(x + 1, y, p.m); });
      s.set(2, 2, p.h); s.set(13, 12, p.h);
    }
    bevel(s, p, topOpen, botOpen);
    return s.done();
  }
  function makeCrack(topOpen, botOpen, v) { // ひび割れ壁(茶いろ + ひび)
    const p = PAL[0], s = surface(16, 16), base = makeBlock(0, topOpen, botOpen, v); s.g.drawImage(base, 0, 0);
    const g = s.g; g.fillStyle = p.d; for (const [x, y] of [[7, 2], [8, 3], [8, 4], [7, 5], [6, 6], [7, 7], [8, 9], [9, 10], [8, 11], [7, 12], [8, 13]]) { g.fillRect(x, y, 1, 1); g.fillRect(x + 1, y, 1, 1); }
    g.fillStyle = p.h; for (const [x, y] of [[6, 2], [7, 4], [5, 6], [7, 9]]) g.fillRect(x, y, 1, 1);
    return s.c;
  }
  function makeSteel(topOpen, botOpen) {
    const s = surface(16, 16), a = '#8D97B3', b = '#66708C', d = '#2F3752', m = '#505A78', h = '#C5CDE3';
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) s.set(x, y, mix(a, b, y / 15));
    for (let x = 0; x < 16; x++) { s.set(x, 0, h); s.set(x, 15, d); s.set(x, 7, m); s.set(x, 8, h); } for (let y = 0; y < 16; y++) { s.set(0, y, h); s.set(15, y, d); }
    for (const [x, y] of [[2, 2], [12, 2], [2, 11], [12, 11]]) { s.set(x, y, d); s.set(x + 1, y, d); s.set(x, y + 1, d); s.set(x + 1, y + 1, m); s.set(x, y - 1 < 0 ? 0 : y - 1, h); }
    if (topOpen) for (let x = 0; x < 16; x++) { s.set(x, 0, '#E6ECFA'); s.set(x, 1, h); }
    if (botOpen) for (let x = 0; x < 16; x++) { s.set(x, 14, m); s.set(x, 15, '#1B2036'); }
    return s.done();
  }
  function makeLock() {
    const s = surface(8, 10), o = '#1F2A44', y = '#F5C842', k = '#FFF0A0', d = '#B98A12';
    const rows = ['..oooo..', '.oyooyo.', '.oy..yo.', '.oy..yo.', 'oooooooo', 'oykkkkyo', 'oykddkyo', 'oykddkyo', 'oyyyyyyo', 'oooooooo'];
    rows.forEach((row, yy) => [...row].forEach((ch, xx) => { if (ch === 'o') s.set(xx, yy, o); else if (ch === 'y') s.set(xx, yy, y); else if (ch === 'k') s.set(xx, yy, k); else if (ch === 'd') s.set(xx, yy, d); }));
    return s.done();
  }
  let lockImg = null;

  // ---- 背景(視差スクロール) ----
  const bgCache = {};
  const PW = 640; // 繰り返しの幅(つなぎ目なし)
  function wave(x, terms) { let v = 0; for (const [k, ph, amp] of terms) v += Math.sin(2 * Math.PI * k * x / PW + ph) * amp; return v; }
  function buildBg(bgHex, bg2Hex, W, H) {
    const base = hex(bgHex), base2 = hex(bg2Hex), EX = 80; // 高いステージ用に、上下に余白
    const layers = {};
    // 空: だんだん明るくなる(ディザでなめらかに)
    const sky = surface(W, H + EX * 2), top = dark(base, .32), bot = light(base, .30), N = 9;
    for (let y = 0; y < sky.h; y++) {
      const t = Math.min(1, Math.max(0, (y - EX * .5) / (H + EX))) * (N - 1), band = Math.floor(t), fr = t - band;
      const colAt = (i) => mix(top, bot, Math.min(1, i / (N - 1)));
      for (let x = 0; x < W; x++) { let i = band; if (fr > .66) i = band + 1; else if (fr > .33 && (x + y) % 2 === 0) i = band + 1; sky.set(x, y, colAt(i)); }
    }
    layers.sky = sky.done();
    // 雲
    const cl = surface(PW, 60), rc = rng(7), white = light(base, .78), shade = mix(base, [255, 255, 255], .5), hi = [255, 255, 255];
    for (let n = 0; n < 7; n++) {
      const cx = Math.floor((n + rc() * .6) * PW / 7), cy = 12 + Math.floor(rc() * 28), bumps = [[0, 0, 11], [-14, 4, 8], [13, 3, 9], [-5, -5, 8], [6, -4, 7]];
      for (const [dx, dy, rr] of bumps) for (let y = -rr; y <= rr; y++) for (let x = -rr; x <= rr; x++) { if (x * x + y * y > rr * rr) continue; const px = ((cx + dx + x) % PW + PW) % PW, py = cy + dy + y; if (py < 0 || py >= 60) continue; const lowShade = y > rr * .35; cl.set(px, py, lowShade ? shade : (y < -rr * .45 && x < 2 ? hi : white)); }
    }
    layers.clouds = cl.done();
    // 遠い山(とがった形と、日なた・日かげ)
    const mt = surface(PW, 120), mc = mix(base2, [60, 70, 130], .35), mcl = light(mc, .25), mcd = dark(mc, .25);
    const mh = (x) => 60 + wave(x, [[2, .5, 22], [5, 1.3, 12], [11, 0, 5], [23, 2, 2]]);
    for (let x = 0; x < PW; x++) { const h0 = Math.round(mh(x)), hl = mh(x - 2), hr = mh(x + 2); for (let y = h0; y < 120; y++) { const sunny = hl > hr; let c = sunny ? mcl : mc; if (!sunny && (x + y) % 2 === 0 && y < h0 + 14) c = mcd; if (y === h0) c = light(mc, .6); mt.set(x, y, c); } }
    layers.mountains = mt.done();
    // 近い丘 + 木
    const hl = surface(PW, 90), hc = mix(base2, [40, 110, 70], .45), hcl = light(hc, .22), hcd = dark(hc, .3);
    const hh = (x) => 40 + wave(x, [[3, 1, 12], [7, .2, 7], [17, 2, 2]]);
    for (let x = 0; x < PW; x++) { const h0 = Math.round(hh(x)); for (let y = h0; y < 90; y++) hl.set(x, y, y === h0 ? hcl : (y < h0 + 3 ? hc : ((x + y) % 4 === 0 && y < h0 + 20 ? hcd : hc))); }
    const rt = rng(21); for (let x = 6; x < PW - 6; x += 17 + Math.floor(rt() * 15)) { const ty = Math.round(hh(x)), hgt = 11 + Math.floor(rt() * 7); for (let k = 0; k < hgt; k++) { const wv = Math.round((k + 1) * .5); for (let q = -wv; q <= wv; q++) hl.set(((x + q) % PW + PW) % PW, ty - hgt + k + 2, q <= -wv + 0 ? hcd : (q >= wv ? hcl : hcd)); } hl.set(x, ty + 2, [90, 60, 30]); hl.set(x, ty + 1, [90, 60, 30]); for (let k = 0; k < hgt - 1; k += 3) { const wv = Math.round((k + 1) * .5); hl.set(((x - wv + 1) % PW + PW) % PW, ty - hgt + k + 2, hcl); } }
    layers.hills = hl.done();
    return layers;
  }
  function drawBg(ctx, G, lv, W, H) {
    const key = lv.bg + lv.bg2 + W + H; const L = bgCache[key] || (bgCache[key] = buildBg(lv.bg, lv.bg2, W, H));
    const cx = G.cam.x, cy = G.cam.y, maxY = Math.max(0, lv.h * 16 - H), vy = maxY ? cy / maxY : 0; // たて長ステージでは、背景も少し上下に動く
    const oy = (f) => Math.round(-vy * 60 * f);
    ctx.drawImage(L.sky, 0, -40 + oy(.5));
    const rep = (img, par, y) => { const off = Math.round(((cx * par) % PW + PW) % PW); for (let x = -off; x < W; x += PW) ctx.drawImage(img, x, y); };
    rep(L.clouds, .08, 10 + oy(.5)); rep(L.mountains, .16, H - 135 + oy(.7)); rep(L.hills, .32, H - 80 + oy(1));
  }

  window.GFX = {
    block(t, c, topOpen, botOpen, seed) {
      const v = Math.abs(seed | 0) % 4, key = (t === 3 ? 'c' : 'b') + c + (topOpen ? 1 : 0) + (botOpen ? 1 : 0) + v;
      return cache[key] || (cache[key] = t === 3 ? makeCrack(topOpen, botOpen, v) : makeBlock(c, topOpen, botOpen, v));
    },
    steel(topOpen, botOpen) { const key = 's' + (topOpen ? 1 : 0) + (botOpen ? 1 : 0); return cache[key] || (cache[key] = makeSteel(topOpen, botOpen)); },
    lock() { return lockImg || (lockImg = makeLock()); },
    bg: drawBg,
  };
})();
