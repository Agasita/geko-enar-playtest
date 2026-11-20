/* ゲコ＆エナー v2 — ソリッド系グラフィック(見本)。URLに ?gfx=snes を付けると使われる。
   かんがえほう: ベタ塗りのふといいろめん + くっきりしたふちどり。ブロックは「ひょうのセル」のように、1マスずつふちどられる。
   ようすのノイズやディザはつかわない。はいけいはくらくおちついたいろ + うすいほうがん(＝シート)。もとのグラフィックは、そのままのこっている。 */
(function () {
  'use strict';
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, t) => { const x = typeof a === 'string' ? hex(a) : a, y = typeof b === 'string' ? hex(b) : b; return [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]; };
  const rgb = (c, a) => 'rgba(' + c.map(v => Math.round(v)).join(',') + ',' + (a === undefined ? 1 : a) + ')';
  function surface(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); const img = g.createImageData(w, h); return { c, g, img, w, h, set(x, y, col) { if (x < 0 || y < 0 || x >= w || y >= h) return; const i = (y * w + x) * 4, v = typeof col === 'string' ? hex(col) : col; img.data[i] = v[0]; img.data[i + 1] = v[1]; img.data[i + 2] = v[2]; img.data[i + 3] = 255; }, done() { g.putImageData(img, 0, 0); return c; } }; }

  // ---- ブロックのいろ(＝ちから)。o:縁 / s:かげ(したの面) / b:おもて(うえの面) / l:ハイライト / x:しるし ----
  const PAL = [
    { o: '#3B2812', s: '#8F6A36', b: '#D9A650', l: '#F6D590', x: '#8F6A36' },   // ちゃいろ(ふつう)
    { o: '#3A0E18', s: '#8A2A2C', b: '#E8563F', l: '#FF9A6B', x: '#FFE27A' },   // あか(あつい)
    { o: '#17536B', s: '#3D9DBA', b: '#7BE0EE', l: '#E4FBFF', x: '#FFFFFF' },   // あお(こおり)
    { o: '#17452B', s: '#2F8048', b: '#58C070', l: '#A6EA96', x: '#E8FFD0' },   // みどり(ばね)
    { o: '#6B4608', s: '#C28E14', b: '#F7CE45', l: '#FFF0A0', x: '#7A4E0A' },   // きいろ(もろい)
    { o: '#4A5A68', s: '#9DB9C8', b: '#DCEBF3', l: '#FFFFFF', x: '#FFFFFF' },   // ガラス(いろなし)
  ];
  const cache = {};
  function makeBlock(c, topOpen, botOpen) {
    const p = PAL[c], s = surface(16, 16);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) s.set(x, y, y < 10 ? p.b : p.s); // おもて(うえ10ぎょう)と、かげ(した6ぎょう)
    for (let x = 1; x < 15; x++) { s.set(x, 1, p.l); s.set(x, 10, mix(p.s, p.o, .35)); }          // うえのハイライトと、めんのさかいめ
    for (let y = 1; y < 10; y++) s.set(1, y, p.l);                                                 // ひだりのハイライト
    for (let x = 0; x < 16; x++) { s.set(x, 0, p.o); s.set(x, 15, p.o); } for (let y = 0; y < 16; y++) { s.set(0, y, p.o); s.set(15, y, p.o); } // ふちどり
    // しるし(ちからが、ひと目でわかる)
    const mark = (pts, col) => pts.forEach(([x, y]) => s.set(x, y, col));
    if (c === 1) { mark([[3, 3], [4, 4], [5, 5], [6, 6], [7, 7], [9, 3], [10, 4], [11, 5], [12, 6], [13, 7]], p.x); mark([[4, 3], [5, 4], [6, 5], [7, 6], [10, 3], [11, 4], [12, 5], [13, 6]], p.l); }
    else if (c === 2) { mark([[10, 3], [9, 4], [8, 5], [7, 6], [11, 3], [10, 4], [9, 5], [8, 6]], p.x); mark([[4, 7], [3, 8], [5, 7], [4, 8]], p.x); }
    else if (c === 3) { for (const y0 of [3, 9]) for (let i = 0; i < 4; i++) { s.set(7 - i, y0 + i, p.o); s.set(8 + i, y0 + i, p.o); s.set(7 - i, y0 + i - 1, p.x); s.set(8 + i, y0 + i - 1, p.x); } }
    else if (c === 5) { mark([[10, 3], [9, 4], [8, 5], [7, 6], [11, 3], [10, 4], [9, 5], [8, 6], [5, 8], [4, 9], [6, 8], [5, 9]], p.x); }
    else if (c === 4) { mark([[8, 2], [7, 3], [7, 4], [8, 5], [9, 6], [8, 7], [7, 8], [8, 9]], p.x); mark([[9, 2], [8, 3], [8, 4], [9, 5], [10, 6], [9, 7], [8, 8]], p.o); }
    return s.done();
  }
  function makeCrack(topOpen, botOpen) { // ひびわれかべ(ちゃいろ + ひび)
    const s = surface(16, 16), p = PAL[0]; s.g.drawImage(makeBlock(0, topOpen, botOpen), 0, 0);
    const g = s.g; g.fillStyle = p.o; for (const [x, y] of [[8, 2], [7, 3], [7, 4], [8, 5], [9, 6], [8, 7], [7, 8], [8, 9], [9, 11], [8, 12], [8, 13]]) g.fillRect(x, y, 2, 1);
    return s.c;
  }
  function makeSteel() { // はがね: くらいスレート。うえのめんがすこしあかるい。ボルト
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


  // ---- 金属(はがね): ほぼ単いろのあおみのあるはがねいろ。ほかのブロックより目立つように、質感はひかえめ(ふちの明暗とネジだけ) ----
  function makeMetal() {
    const s = surface(16, 16), base = '#8493AB';
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) s.set(x, y, base);
    for (let i = 1; i < 15; i++) { s.set(i, 1, '#A7B4C8'); s.set(1, i, '#9AA8BE'); s.set(i, 14, '#6E7C95'); s.set(14, i, '#6E7C95'); }
    for (let i = 0; i < 16; i++) { s.set(i, 0, '#2B3448'); s.set(i, 15, '#2B3448'); s.set(0, i, '#2B3448'); s.set(15, i, '#2B3448'); }
    for (const [x, y] of [[3, 3], [11, 3], [3, 11], [11, 11]]) { s.set(x, y, '#C9D3E3'); s.set(x + 1, y, '#5F6D86'); s.set(x, y + 1, '#5F6D86'); s.set(x + 1, y + 1, '#3A4660'); } // ネジ
    return s.done();
  }
  let metalImg = null;

  // ---- はいけい: くらいいろ + うすいほうがん(スプレッドシート) ----
  const bgCache = {};
  function buildBg(bgHex, W, H) {
    const base = hex(bgHex), c = document.createElement('canvas'); c.width = W; c.height = H + 160; const g = c.getContext('2d');
    const top = mix(base, [14, 16, 34], .86), bot = mix(base, [14, 16, 34], .68);
    const n = 7; for (let i = 0; i < n; i++) { g.fillStyle = rgb(mix(top, bot, i / (n - 1))); g.fillRect(0, Math.round(i * c.height / n), W, Math.ceil(c.height / n)); } // ベタ塗りのおび(ディザなし)
    // 四すみをくらくする
    const vg = g.createRadialGradient(W / 2, c.height / 2, Math.min(W, c.height) * .35, W / 2, c.height / 2, Math.max(W, c.height) * .75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)'); g.fillStyle = vg; g.fillRect(0, 0, W, c.height);
    return { img: c, line: rgb(mix(base, [255, 255, 255], .42), .13), line2: rgb(mix(base, [255, 255, 255], .5), .22) };
  }
  function drawBg(ctx, G, lv, W, H) {
    const key = lv.bg + W + H; const L = bgCache[key] || (bgCache[key] = buildBg(lv.bg, W, H));
    const cx = G.cam.x, cy = G.cam.y, maxY = Math.max(0, lv.h * 16 - H), vy = maxY ? cy / maxY : 0;
    ctx.drawImage(L.img, 0, -Math.round(vy * 160));
    const par = .55, step = 16, ox = Math.round(cx * par), oy = Math.round(cy * par); // ほうがんは、せかいよりすこしゆっくりうごく(おくゆき)
    ctx.fillStyle = L.line; for (let x = -(ox % step); x < W; x += step) ctx.fillRect(x, 0, 1, H); for (let y = -(oy % step); y < H; y += step) ctx.fillRect(0, y, W, 1);
    ctx.fillStyle = L.line2; const big = step * 4; for (let x = -(ox % big); x < W; x += big) ctx.fillRect(x, 0, 1, H); for (let y = -(oy % big); y < H; y += big) ctx.fillRect(0, y, W, 1);
  }


  // ---- キャラクター: もとのえの形をつかい、ベタ塗り(2面)＋ふといふちどり(外側に1ドット)に描きなおす ----
  const HERO_MAP = { g: '#F7CE45', f: '#C28E14', j: '#58C070', i: '#A6EA96', k: '#2F8048', q: '#4C7BE0', p: '#2B4C9B', '9': '#F7CE45', '0': '#1F2A44', '6': '#FFFFFF' };
  const BIRD_MAP = { '6': '#FFFFFF', u: '#5F86DE', y: '#DDE6FA', '8': '#F29B3A', '0': '#1F2A44' };
  const OUT = '#1F2A44';
  function solidSprite(rows, map, flip) {
    const h = rows.length, w = rows[0].length, g = [];
    for (let y = 0; y < h; y++) { g.push([]); for (let x = 0; x < w; x++) { const ch = rows[y][flip ? w - 1 - x : x]; g[y].push(ch === '.' || !map[ch] ? null : map[ch]); } }
    const s = surface(w + 2, h + 2);
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? null : g[y][x];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let c = g[y][x]; if (!c) continue;
      if (c !== '#FFFFFF' && c !== OUT) { // うえのふちをあかるく、したのふちをくらく(2めんのベタ塗り)
        if (!at(x, y - 1)) c = mix(c, [255, 255, 255], .35); else if (!at(x, y + 1)) c = mix(c, [20, 24, 48], .28);
      }
      s.set(x + 1, y + 1, c);
    }
    for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) { if (at(x, y)) continue; if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) s.set(x + 1, y + 1, outCol || OUT); }
    return s.done();
  }

  // ---- しゅじんこう(ゲコ): ふとい面で組み立てなおす。体の部品(帽子・あたま・どうぎ・うで・あし)を重ねて、全コマをかく ----
  const HC = { y: '#F7CE45', Y: '#FFF0A0', s: '#C28E14', g: '#58C070', G: '#A6EA96', d: '#2F8048', w: '#FFFFFF', p: '#1F2A44', b: '#4C7BE0', B: '#2B4C9B', n: '#F7CE45', m: '#E8563F' };
  function heroFrame(name, HCp) {
    HCp = HCp || HC; const g = []; for (let y = 0; y < 16; y++) g.push(new Array(16).fill(null));
    const R = (x, y, w, h, k) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (x + i >= 0 && x + i < 16 && y + j >= 0 && y + j < 16) g[y + j][x + i] = HCp[k]; };
    const P = (x, y, k) => R(x, y, 1, 1, k);
    let B = 0, legs = 'stand', arm = 'down', eye = 'open';
    if (name === 'idle2') B = 1;
    else if (name === 'walk0') legs = 'a'; else if (name === 'walk1') { legs = 'mid'; B = 1; } else if (name === 'walk2') legs = 'b'; else if (name === 'walk3') { legs = 'mid'; B = 1; }
    else if (name === 'rise') { legs = 'tuck'; arm = 'up'; } else if (name === 'fall') { legs = 'wide'; arm = 'up'; } else if (name === 'takeoff') { legs = 'wide'; B = 2; }
    else if (name === 'windup') { arm = 'back'; } else if (name === 'swing') { arm = 'front'; B = 0; } else if (name === 'hurt') { arm = 'up'; eye = 'x'; legs = 'wide'; }
    // あし
    const foot = (x, y) => { R(x, y, 4, 2, 'd'); R(x, y, 3, 1, 'g'); };
    if (legs === 'stand') { foot(3, 14); foot(9, 14); } else if (legs === 'a') { foot(2, 14); foot(10, 14); } else if (legs === 'b') { foot(5, 14); foot(8, 14); }
    else if (legs === 'mid') { foot(4, 14); foot(8, 14); } else if (legs === 'tuck') { foot(3, 13); foot(9, 12); } else if (legs === 'wide') { foot(1, 14); foot(11, 14); }
    // どうぎ(あおいサロペット)
    R(4, 10 + B, 8, 4 - B, 'b'); R(4, 13, 8, 1, 'B'); R(6, 10 + B, 1, 2, 'B'); P(8, 12, 'n'); P(9, 12, 'n');
    // うで
    if (arm === 'down') { R(11, 11 + B, 2, 3, 'g'); P(12, 13, 'd'); } else if (arm === 'up') { R(12, 7 + B, 2, 4, 'g'); P(13, 7 + B, 'G'); }
    else if (arm === 'back') { R(1, 9 + B, 2, 4, 'g'); P(1, 9 + B, 'G'); } else if (arm === 'front') { R(11, 11, 4, 2, 'g'); P(14, 11, 'G'); }
    // あたま
    R(3, 6 + B, 11, 4, 'g'); R(2, 7 + B, 13, 2, 'g'); R(3, 9 + B, 11, 1, 'd'); P(3, 6 + B, 'G'); P(4, 6 + B, 'G'); P(2, 7 + B, 'G');
    if (eye === 'open') { R(9, 7 + B, 4, 3, 'w'); R(11, 8 + B, 2, 2, 'p'); P(9, 7 + B, 'w'); } else { P(9, 7 + B, 'p'); P(10, 8 + B, 'p'); P(11, 9 + B, 'p'); P(11, 7 + B, 'p'); P(9, 9 + B, 'p'); }
    R(5, 9 + B, 5, 1, 'd'); if (eye === 'x') { R(6, 9 + B, 3, 1, 'm'); }
    // ヘルメット
    R(5, 1 + B, 6, 1, 'y'); R(4, 2 + B, 8, 2, 'y'); R(3, 4 + B, 10, 1, 'y'); R(5, 2 + B, 3, 1, 'Y'); P(4, 3 + B, 'Y'); R(2, 5 + B, 13, 1, 's'); R(14, 5 + B, 1, 1, 'y');
    return g;
  }
  function gridSprite(grid, flip, outCol) {
    const h = grid.length, w = grid[0].length, s = surface(w + 2, h + 2), at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? null : grid[y][flip ? w - 1 - x : x];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = at(x, y); if (c) s.set(x + 1, y + 1, c); }
    for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) { if (at(x, y)) continue; if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) s.set(x + 1, y + 1, OUT); }
    return s.done();
  }

  // ---- 相棒エナー(しろい鳥) ----
  const BC = { W: '#FFFFFF', S: '#C6D3F0', U: '#4F7FE0', V: '#8FB0F5', O: '#F29B3A', e: '#1F2A44', f: '#E8663A' };
  const BIRD_ROWS = ['............', '....WWWW....', '...WWWWWW...', '..WWWWWWeW..', '..WWWWWWWWOO', '.UUWWWWWWW..', 'UUUVWWWWWW..', '.UUUUWWWSW..', '...UUUSSSS..', '.....f.f....', '............', '............'];
  function birdGrid() { return BIRD_ROWS.map(r => [...r].map(ch => (ch === '.' ? null : BC[ch]))); }

  // ---- エナー(しゅじんこう・ドローンのような鳥): 14×14のえ。はばたきのコマ ----
  const ENER_ROWS = ['..............', '.....WWWW.....', '....WWWWWW....', '...WWWWWWeW...', '...WWWWWWWWOO.', '..UUWWWWWWW...', '.UUUVWWWWWW...', '..UUUUWWWSW...', '....UUUSSSS...', '......f.f.....', '..............', '..............', '..............', '..............'];
  function enerGrid(name, pal) {
    const g = ENER_ROWS.map(r => [...r].map(ch => (ch === '.' ? null : pal[ch]))), U = pal.U, V = pal.V, W = pal.W;
    const P = (x, y, c) => { if (x >= 0 && x < 14 && y >= 0 && y < 14) g[y][x] = c; };
    // てまえの はね(からだの よこの あお)を、うごかす: ふだん=よこ / up=うえ / down=した
    const wingCells = [[2, 5], [3, 5], [1, 6], [2, 6], [3, 6], [4, 6], [2, 7], [3, 7], [4, 7], [5, 7]];
    if (name === 'up' || name === 'down') wingCells.forEach(([x, y]) => { g[y][x] = null; });
    if (name === 'up') { // はね: うえ
      [[4, 5, 'U'], [3, 4, 'U'], [4, 4, 'U'], [5, 4, 'V'], [2, 3, 'U'], [3, 3, 'U'], [1, 2, 'U'], [2, 2, 'U'], [1, 1, 'V'], [2, 1, 'V']].forEach(([x, y, c]) => P(x, y, c === 'V' ? V : U));
    } else if (name === 'down') { // はね: した
      [[3, 7, 'U'], [4, 7, 'U'], [5, 7, 'U'], [2, 8, 'U'], [3, 8, 'U'], [2, 9, 'U'], [3, 9, 'V'], [1, 10, 'V'], [2, 10, 'V'], [1, 9, 'U']].forEach(([x, y, c]) => P(x, y, c === 'V' ? V : U));
    } else if (name === 'hurt') { // ダメージ(めが×)
      P(9, 3, pal.e); P(8, 3, pal.e); P(9, 4, W); P(8, 4, pal.e);
    }
    return g;
  }

  window.GFX = {
    block(t, c, topOpen, botOpen) { const key = (t === 3 ? 'c' : 'b') + c; return cache[key] || (cache[key] = t === 3 ? makeCrack() : makeBlock(c)); },
    steel() { return cache.s || (cache.s = makeSteel()); },
    lock() { return lockImg || (lockImg = makeLock()); },
    metal() { return metalImg || (metalImg = makeMetal()); },
    bg: drawBg, heroFrame, gridSprite, enerGrid,
    hero(name, flip) { const k = 'h' + name + (flip ? 1 : 0); return cache[k] || (cache[k] = gridSprite(heroFrame(name), flip)); },
    bird(flip) { const k = 'bird' + (flip ? 1 : 0); return cache[k] || (cache[k] = gridSprite(birdGrid(), flip)); },
  };
})();
