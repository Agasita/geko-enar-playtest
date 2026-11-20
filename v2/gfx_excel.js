/* ゲコ＆エナー v2 — Excelふうグラフィック。せかいを「表計算シート」としてかく。
   しろいシートにほうがん(セル)、れつのみだし(A, B, C…)とぎょうのばんごう、えらんでいるセル(みどりのわく)。ブロックは「いろつきのセル」。
   URLに ?gfx=excel (ふつう)。?gfx=classic でもとのえ、?gfx=snes でソリッドばん。 */
(function () {
  'use strict';
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, t) => { const x = typeof a === 'string' ? hex(a) : a, y = typeof b === 'string' ? hex(b) : b; return [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]; };
  const css = (c) => 'rgb(' + c.map(v => Math.round(v)).join(',') + ')';
  function surface(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); const img = g.createImageData(w, h); return { c, g, img, w, h, set(x, y, col) { if (x < 0 || y < 0 || x >= w || y >= h) return; const i = (y * w + x) * 4, v = typeof col === 'string' ? hex(col) : col; img.data[i] = v[0]; img.data[i + 1] = v[1]; img.data[i + 2] = v[2]; img.data[i + 3] = 255; }, done() { g.putImageData(img, 0, 0); return c; } }; }

  // ---- 3x5 のドットフォント(英字・数字) ----
  const F = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
    I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
    Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
    Y: '101101010010010', Z: '111001010100111',
    '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001001001001', '8': '111101111101111', '9': '111101111001111',
  };
  function glyphs(ctx, str, x, y, col) { ctx.fillStyle = col; for (const ch of str) { const g = F[ch]; if (g) for (let i = 0; i < 15; i++) if (g[i] === '1') ctx.fillRect(x + (i % 3), y + ((i / 3) | 0), 1, 1); x += 4; } }
  const colName = (c) => { let s = ''; c++; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };

  const cache = {};
  // ---- ブロック(いろつきのセル): Excelの「セルのスタイル」の配いろ + 条件付きいろのようなアイコン ----
  //  ちゃいろ=入力(オレンジ) あか=悪い あお=アクセント(あお) みどり=良い きいろ=ふつう(きいろ) ガラス=いろなし
  const STY = [
    { fill: '#FFCC99', bd: '#7F7F7F', ic: '#3F3F76' }, { fill: '#FFC7CE', bd: '#D9959D', ic: '#9C0006' }, { fill: '#BDD7EE', bd: '#7FA8D0', ic: '#1F4E79' },
    { fill: '#C6EFCE', bd: '#7DBB8C', ic: '#00873C' }, { fill: '#FFEB9C', bd: '#BF9000', ic: '#7F5200' }, { fill: '#FFFFFF', bd: '#8FB4DC', ic: '#8FB4DC' },
  ];
  function makeBlock(c) {
    const st = STY[c], s = surface(16, 16), f = hex(st.fill), bd = hex(st.bd), ic = hex(st.ic), hi = mix(f, [255, 255, 255], .55);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) s.set(x, y, f);
    for (let i = 0; i < 16; i++) { if (c === 4 && (i % 4) >= 2) continue; s.set(i, 0, bd); s.set(i, 15, bd); s.set(0, i, bd); s.set(15, i, bd); }   // きいろはてんせんのふち(もろい)
    if (c === 4) for (let i = 0; i < 16; i++) { if ((i % 4) < 2) continue; s.set(i, 0, mix(bd, f, .5)); s.set(i, 15, mix(bd, f, .5)); s.set(0, i, mix(bd, f, .5)); s.set(15, i, mix(bd, f, .5)); }
    const P = (pts, col) => pts.forEach(([x, y]) => s.set(x, y, col));
    const R = (x0, y0, w, h, col) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) s.set(x0 + i, y0 + j, col); };
    // 作ようが、ひと目でわかるアイコン
    if (c === 1) { // あか＝ダメージ: ちゅういのさんかく(!)
      for (let r = 0; r < 9; r++) { const y = 3 + r, half = Math.floor(r * .6); for (let xx = 8 - half - 1; xx <= 8 + half; xx++) s.set(xx, y, ic); }
      for (let xx = 3; xx <= 12; xx++) s.set(xx, 12, ic);
      R(7, 7, 2, 3, '#FFFFFF'); R(7, 11, 2, 1, '#FFFFFF');
    } else if (c === 2) { // あお＝すべる(こおり): ゆきのけっしょう
      const ic2 = ic;
      R(8, 3, 1, 11, ic2); R(3, 8, 11, 1, ic2); for (let i = 0; i < 5; i++) { s.set(4 + i, 4 + i, ic2); s.set(12 - i, 4 + i, ic2); s.set(4 + i, 12 - i, ic2); s.set(12 - i, 12 - i, ic2); }
      P([[7, 4], [9, 4], [7, 12], [9, 12], [4, 7], [4, 9], [12, 7], [12, 9]], ic2);
    } else if (c === 3) { // みどり＝はずむ: うえむきのやじるしと、ばね
      P([[8, 2], [7, 3], [8, 3], [9, 3], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4]], ic); R(7, 5, 3, 3, ic); R(8, 5, 1, 3, ic);
      R(5, 9, 6, 1, ic); P([[10, 10]], ic); R(5, 11, 6, 1, ic); P([[5, 12]], ic); R(5, 13, 6, 1, ic);
    } else if (c === 4) { // きいろ＝もろい: ひびと、こぼれおちるかけら
      P([[8, 2], [7, 3], [7, 4], [8, 5], [9, 6], [8, 7], [7, 8]], ic); P([[9, 7], [10, 8]], ic);
      R(4, 11, 2, 2, ic); R(8, 12, 2, 2, ic); R(11, 10, 1, 1, ic); R(3, 9, 1, 1, ic);
    } else if (c === 5) { for (let i = 1; i < 15; i++) { s.set(i, 1, '#EAF3FB'); s.set(1, i, '#EAF3FB'); s.set(i, 14, '#EAF3FB'); s.set(14, i, '#EAF3FB'); } }   // ガラス: いろなしのセル
    return s.done();
  }
  function makeCrack() {
    const s = surface(16, 16); s.g.drawImage(makeBlock(0), 0, 0);
    const g = s.g; g.fillStyle = '#7F4F1F'; for (const [x, y] of [[8, 2], [7, 3], [7, 4], [8, 5], [9, 6], [8, 7], [7, 8], [8, 9], [9, 11], [8, 12], [8, 13]]) g.fillRect(x, y, 2, 1);
    return s.c;
  }
  function makeSteel() { // はがね: なおせないセル(しゃせん)
    const s = surface(16, 16);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) s.set(x, y, ((x + y) % 6 < 3) ? '#BFBFBF' : '#A6A6A6');
    for (let i = 0; i < 16; i++) { s.set(i, 0, '#595959'); s.set(i, 15, '#595959'); s.set(0, i, '#595959'); s.set(15, i, '#595959'); }
    for (let i = 1; i < 15; i++) { s.set(i, 1, '#E0E0E0'); s.set(1, i, '#E0E0E0'); }
    return s.done();
  }

  // ---- はいけい・見出し・選択わく ----
  const HW = 13, HH = 9; // ぎょうのばんごうのはば / れつのみだしのたかさ
  function drawBg(ctx, G, lv, W, H) {
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
    const cx = Math.round(G.cam.x + (G.sx || 0)), cy = Math.round(G.cam.y), T = 16;
    ctx.fillStyle = '#D4D4D4';
    for (let x = -(((cx % T) + T) % T); x < W; x += T) ctx.fillRect(x, 0, 1, H);
    for (let y = -(((cy % T) + T) % T); y < H; y += T) ctx.fillRect(0, y, W, 1);
  }
  function drawFrame(ctx, G, lv, W, H) {
    const cx = Math.round(G.cam.x + (G.sx || 0)), cy = Math.round(G.cam.y), T = 16;
    // カーソル(えらんでいるセル)は、なおしているところだけだす。見出しも、そのセルのれつ・ぎょうがみどりになる
    const E = G.edit, cur = E && E.on ? (E.hover || E.cursor) : null, pc = cur ? cur[0] : -999, pr = cur ? cur[1] : -999;
    if (cur) { const x = pc * T - cx, y = pr * T - cy; ctx.fillStyle = '#217346'; ctx.fillRect(x, y, T, 1); ctx.fillRect(x, y + T - 1, T, 1); ctx.fillRect(x, y, 1, T); ctx.fillRect(x + T - 1, y, 1, T); ctx.fillRect(x + T - 3, y + T - 3, 4, 4); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x + T - 2, y + T - 2, 2, 2); }
    // れつのみだし
    ctx.fillStyle = '#E6E6E6'; ctx.fillRect(HW, 0, W - HW, HH); ctx.fillStyle = '#ABABAB'; ctx.fillRect(HW, HH - 1, W - HW, 1);
    for (let c = Math.floor((cx + HW) / T); c * T - cx < W; c++) {
      const x = c * T - cx; if (x + T <= HW) continue;
      if (c === pc) { ctx.fillStyle = '#C6E0B4'; ctx.fillRect(Math.max(HW, x), 0, x < HW ? x + T - HW : T, HH - 1); }
      ctx.fillStyle = '#ABABAB'; if (x >= HW) ctx.fillRect(x, 0, 1, HH);
      const name = colName(c); if (x >= HW - 1) glyphs(ctx, name, x + Math.round((T - name.length * 4 + 1) / 2), 2, c === pc ? '#1E5C3A' : '#444444');
    }
    // ぎょうのばんごう
    ctx.fillStyle = '#E6E6E6'; ctx.fillRect(0, HH, HW, H - HH); ctx.fillStyle = '#ABABAB'; ctx.fillRect(HW - 1, HH, 1, H - HH);
    for (let r = Math.floor((cy + HH) / T); r * T - cy < H; r++) {
      const y = r * T - cy; if (y + T <= HH) continue;
      if (r === pr) { ctx.fillStyle = '#C6E0B4'; ctx.fillRect(0, Math.max(HH, y), HW - 1, y < HH ? y + T - HH : T); }
      ctx.fillStyle = '#ABABAB'; if (y >= HH) ctx.fillRect(0, y, HW, 1);
      const name = String(r + 1); if (y >= HH - 3) glyphs(ctx, name, Math.round((HW - name.length * 4) / 2), y + 5, r === pr ? '#1E5C3A' : '#444444');
    }
    // ひだりうえの角(すべて選択)
    ctx.fillStyle = '#E6E6E6'; ctx.fillRect(0, 0, HW, HH); ctx.fillStyle = '#ABABAB'; ctx.fillRect(HW - 1, 0, 1, HH); ctx.fillRect(0, HH - 1, HW, 1);
    ctx.fillStyle = '#B4B4B4'; ctx.fillRect(7, 2, 4, 1); ctx.fillRect(8, 3, 3, 1); ctx.fillRect(9, 4, 2, 1); ctx.fillRect(10, 5, 1, 1);
  }


  // ---- キャラクター(エナー・ゲコ・てき): Officeの配いろのフラットなえ。縁は濃い灰いろ ----
  const OUTX = '#404040';
  const HCX = { y: '#FFC000', Y: '#FFE699', s: '#BF9000', g: '#70AD47', G: '#A9D18E', d: '#548235', w: '#FFFFFF', p: '#262626', b: '#4472C4', B: '#2F5597', n: '#FFC000', m: '#C00000' };
  const BCX = { W: '#FFFFFF', S: '#D9D9D9', U: '#5B9BD5', V: '#9DC3E6', O: '#ED7D31', e: '#262626', f: '#C55A11' };
  const BIRD = ['............', '....WWWW....', '...WWWWWW...', '..WWWWWWeW..', '..WWWWWWWWOO', '.UUWWWWWWW..', 'UUUVWWWWWW..', '.UUUUWWWSW..', '...UUUSSSS..', '.....f.f....', '............', '............'];
  function grid16() { const g = []; for (let y = 0; y < 16; y++) g.push(new Array(16).fill(null)); return g; }
  function prims(g) { return { R(x, y, w, h, col) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (x + i >= 0 && x + i < 16 && y + j >= 0 && y + j < 16) g[y + j][x + i] = col; }, P(x, y, col) { if (x >= 0 && x < 16 && y >= 0 && y < 16) g[y][x] = col; } }; }
  function enemyGrid(name, fr) { // みぎむき。ゲームがわで、むきにあわせてひだりみぎをいれかえる
    const g = grid16(), { R, P } = prims(g), W = '#FFFFFF', K = '#262626';
    if (name === 'walker') { // ノイズ: あかいエラーのかたまり
      const body = '#C0504D', lt = '#E6B8B7', dk = '#8C2F2D';
      R(3, 5, 10, 8, body); R(4, 4, 8, 1, body); R(4, 13, 8, 1, dk); R(3, 12, 10, 1, dk); R(4, 5, 4, 1, lt);
      R(4, 7, 3, 3, W); R(9, 7, 3, 3, W); R(6, 8, 1, 2, K); R(11, 8, 1, 2, K); R(4, 6, 3, 1, dk); R(9, 6, 3, 1, dk); R(6, 11, 4, 1, K);
      if (fr) { R(4, 14, 3, 2, dk); R(9, 14, 3, 2, dk); } else { R(3, 14, 3, 2, dk); R(10, 14, 3, 2, dk); }
    } else if (name === 'guard') { // ガード: あおいからだと、あおいたて
      const body = '#2F5597', lt = '#4472C4', sh = '#9DC3E6';
      R(3, 5, 9, 8, body); R(4, 4, 7, 1, body); R(4, 5, 4, 1, lt); R(4, 7, 3, 3, W); R(6, 8, 1, 2, K); R(4, 6, 3, 1, '#1F3864');
      R(11, 4, 4, 9, sh); R(12, 3, 2, 1, sh); R(12, 13, 2, 1, sh); R(12, 5, 2, 7, W); R(11, 8, 4, 2, W); P(11, 4, '#DDEBF7');
      R(3, 14, 3, 2, '#1F3864'); R(8, 14, 3, 2, '#1F3864');
    } else if (name === 'flyer') { // フライヤー: むらさきのたまと、はばたくはね
      const body = '#7030A0', lt = '#9B59C9', wg = '#CDB8E6';
      R(5, 5, 6, 7, body); R(4, 6, 8, 5, body); R(6, 4, 4, 1, body); R(6, 12, 4, 1, '#4B1F6E'); R(6, 5, 3, 1, lt);
      R(7, 7, 3, 3, W); R(9, 8, 1, 2, '#C00000');
      if (fr) { R(0, 8, 4, 3, wg); R(12, 8, 4, 3, wg); } else { R(0, 3, 4, 3, wg); R(12, 3, 4, 3, wg); }
    } else { // タレット: はいいろのほうだい
      R(3, 10, 10, 4, '#595959'); R(2, 14, 12, 1, '#404040'); R(4, 6, 8, 5, '#7F7F7F'); R(5, 5, 6, 1, '#7F7F7F'); R(5, 6, 4, 1, '#BFBFBF');
      R(10, 7, 5, 3, '#404040'); R(6, 8, 2, 2, '#C00000'); P(4, 12, '#BFBFBF'); P(11, 12, '#BFBFBF');
    }
    return g;
  }

  window.GFXX = {
    HW, HH,
    block(t, c) { const key = (t === 3 ? 'c' : 'b') + c; return cache[key] || (cache[key] = t === 3 ? makeCrack() : makeBlock(c)); },
    steel() { return window.GFX.metal(); },
    hero(name, flip) { const k = 'h' + name + (flip ? 1 : 0); return cache[k] || (cache[k] = GFX.gridSprite(GFX.heroFrame(name, HCX), flip, OUTX)); },
    bird(flip) { const k = 'bird' + (flip ? 1 : 0); return cache[k] || (cache[k] = GFX.gridSprite(BIRD.map(r => [...r].map(ch => (ch === '.' ? null : BCX[ch]))), flip, OUTX)); },
    ener(name, flip) { const k = 'en' + name + (flip ? 1 : 0); return cache[k] || (cache[k] = GFX.gridSprite(GFX.enerGrid(name, BCX), flip, OUTX)); },
    enemy(name, fr, flip) { const k = 'e' + name + fr + (flip ? 1 : 0); return cache[k] || (cache[k] = GFX.gridSprite(enemyGrid(name, fr), flip, OUTX)); },
    bg: drawBg, frame: drawFrame,
  };
})();
