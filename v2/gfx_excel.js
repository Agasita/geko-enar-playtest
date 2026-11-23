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
  // ブロックは「りったいてき」に: ふちどり + うえ・ひだりの ひかり + した・みぎの かげ + ざいしつの もよう。マークは つけない(はがね以外)
  const MAGMA = ['KKKOOKKKKKKK', 'KKKOYOKKKKOO', 'KKOOYOKKKOYO', 'KOYOOKKKOYOK', 'KOYOKKKOOYOK', 'OOYOOOOOYOOK', 'KOOYYYYYOOKK', 'KKKOOOOYOKKK', 'KKKKKKOYOKKk', 'KkKKKOOYOOKK', 'KKKKOOYOOKKK', 'KKKKOYOKKKKK'];
  const MAGMA_COL = { K: '#4A1812', k: '#5E2118', O: '#E8571B', Y: '#FFD43B' };
  function makeBlock(c) {
    const st = STY[c], s = surface(16, 16), f = hex(st.fill), ic = hex(st.ic);
    const edge = mix(f, [0, 0, 0], .42), hi = mix(f, [255, 255, 255], .6), lo = mix(f, [0, 0, 0], .22), up = mix(f, [255, 255, 255], .14);
    const P = (pts, col) => pts.forEach(([x, y]) => s.set(x, y, col));
    const R = (x0, y0, w, h, col) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) s.set(x0 + i, y0 + j, col); };
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) s.set(x, y, y < 8 ? up : f);
    if (c === 1) { // あか＝マグマ: こげた いわの すきまから、あつい ひかりが もれる
      for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) s.set(x + 2, y + 2, MAGMA_COL[MAGMA[y][x]]);
    } else if (c === 2) { // あお＝こおり: すきとおらない みずいろ。ななめの ひかりの すじと、こおりの ひび
      R(2, 2, 12, 12, '#A9E7F6'); R(2, 2, 12, 5, '#BDEFFA'); R(2, 10, 12, 4, '#8CD9EC');
      for (let i = 0; i < 7; i++) { s.set(3 + i, 11 - i, '#FFFFFF'); s.set(4 + i, 11 - i, '#E6FAFF'); }
      for (let i = 0; i < 4; i++) s.set(6 + i, 13 - i, '#FFFFFF');
      P([[11, 8], [10, 9], [10, 10], [9, 11], [4, 4], [5, 5], [5, 6]], '#6CC3DC'); P([[12, 4], [11, 3], [12, 3], [13, 3]], '#FFFFFF');
    } else if (c === 0) { // ちゃいろ＝つち: こいしの つぶつぶ
      P([[4, 4], [10, 3], [6, 9], [11, 8], [3, 11], [9, 12], [12, 12], [7, 5]], mix(f, [0, 0, 0], .2)); P([[5, 5], [11, 4], [7, 10], [12, 9], [4, 12], [10, 13]], mix(f, [255, 255, 255], .35));
    }
    // ふちどり・ひかり・かげ(まんなかの がぞうを けさない よう、いちばん さいごに)
    const hl = c === 1 ? '#8A3A22' : hi, sh = c === 1 ? '#2A0A07' : lo, ed = c === 1 ? '#1E0705' : (c === 2 ? '#3F9DB5' : edge);
    if (c !== 4) { for (let i = 1; i < 15; i++) { s.set(i, 1, hl); s.set(1, i, hl); s.set(i, 14, sh); s.set(14, i, sh); } }
    for (let i = 0; i < 16; i++) { if (c === 4 && (i % 4) >= 2) continue; s.set(i, 0, ed); s.set(i, 15, ed); s.set(0, i, ed); s.set(15, i, ed); }   // きいろは てんせんの ふち(もろい)
    if (c === 4) { for (let i = 0; i < 16; i++) { if ((i % 4) < 2) continue; const m = mix(edge, f, .5); s.set(i, 0, m); s.set(i, 15, m); s.set(0, i, m); s.set(15, i, m); } for (let i = 2; i < 14; i++) { s.set(i, 2, hi); s.set(2, i, hi); s.set(i, 13, lo); s.set(13, i, lo); } }
    if (c === 3) { // みどり＝はずむ: ふとい うえむきの やじるし(↑)と、した の だい
      for (let r = 0; r < 5; r++) R(7 - r, 2 + r, 2 + r * 2, 1, ic);
      R(6, 7, 4, 5, ic); R(3, 13, 10, 1, ic); for (let r = 0; r < 5; r++) s.set(7 - r, 2 + r, '#5FD58D');
    } else if (c === 4) { // きいろ＝もろい: ひびと、こぼれおちる かけら
      P([[8, 3], [7, 4], [7, 5], [8, 6], [9, 7], [8, 8], [7, 9]], ic); P([[9, 8], [10, 9]], ic); R(4, 11, 2, 2, ic); R(9, 11, 2, 2, ic); P([[12, 6], [4, 7]], ic);
    } else if (c === 5) { for (let i = 2; i < 14; i++) { s.set(i, 2, '#EAF3FB'); s.set(2, i, '#EAF3FB'); s.set(i, 13, '#EAF3FB'); s.set(13, i, '#EAF3FB'); } for (let i = 0; i < 16; i++) { s.set(i, 0, '#8FB4DC'); s.set(i, 15, '#8FB4DC'); s.set(0, i, '#8FB4DC'); s.set(15, i, '#8FB4DC'); } P([[4, 4], [5, 4], [4, 5], [10, 10], [11, 10], [10, 11]], '#FFFFFF'); }
    return s.done();
  }
  function makeCrack() { // ひびわれ: ブロックを たてに さく、ふとい ひびと、えだわかれ。わきに ひかりの ふち
    const s = surface(16, 16); s.g.drawImage(makeBlock(0), 0, 0);
    const g = s.g, dk = '#2B1808', lt = '#F6E3BC';
    const main = [[8, 0], [8, 1], [7, 2], [7, 3], [8, 4], [9, 5], [9, 6], [8, 7], [7, 8], [7, 9], [8, 10], [9, 11], [8, 12], [7, 13], [7, 14], [8, 15]];
    const br = [[10, 5], [11, 4], [12, 3], [13, 3], [6, 9], [5, 10], [4, 10], [3, 11], [10, 12], [11, 12], [12, 13], [13, 13], [10, 7], [11, 8]];
    g.fillStyle = lt; for (const [x, y] of main) g.fillRect(x - 2, y, 1, 1); for (const [x, y] of br) g.fillRect(x, y - 1, 1, 1);
    g.fillStyle = dk; for (const [x, y] of main) g.fillRect(x - 1, y, 3, 1); for (const [x, y] of br) g.fillRect(x, y, 1, 1);
    g.fillStyle = '#7B4B1E'; for (const [x, y] of [[8, 4], [7, 8], [8, 12]]) g.fillRect(x + 2, y, 1, 1);
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
    } else if (name === 'div0') { // #DIV/0!: とげの ある あかい セル。「#」の もじ
      const body = '#C00000', dk = '#7A0000', lt = '#FF7B7B';
      R(3, 6, 10, 8, body); R(3, 13, 10, 1, dk); R(3, 6, 10, 1, lt); R(4, 4, 2, 2, body); R(7, 3, 2, 3, body); R(10, 4, 2, 2, body); P(4, 4, lt); P(7, 3, lt); P(10, 4, lt);
      R(6, 8, 1, 4, W); R(9, 8, 1, 4, W); R(5, 9, 6, 1, W); R(5, 11, 6, 1, W);
    } else if (name === 'autofill') { // オートフィル: みどりの セルと、みぎしたの フィルハンドル(ちいさな しかく)
      R(3, 4, 10, 10, '#C6E0B4'); R(3, 4, 10, 1, '#E2F0D9'); R(3, 13, 10, 1, '#8DB574'); R(5, 7, 2, 2, K); R(9, 7, 2, 2, K); R(6, 10, 4, 1, K);
      R(11, 12, 5, 4, '#217346'); R(12, 13, 3, 2, W); P(4, 5, W);
    } else if (name === 'moji') { // しろい文字: しょうたいを あらわした すがた。すそが ゆらゆらの おばけ
      const wb = '#EDEDED', sh = '#BFBFBF', dk = '#7F7F7F';
      R(6, 2, 4, 1, wb); R(5, 3, 6, 1, wb); R(4, 4, 8, 8, wb); R(4, 4, 8, 1, '#FFFFFF'); R(11, 5, 1, 7, sh); R(5, 11, 6, 1, sh);
      R(5, 6, 2, 3, K); R(9, 6, 2, 3, K); P(5, 6, W); P(9, 6, W); R(7, 10, 2, 2, dk);
      if (fr) { R(4, 12, 2, 2, wb); R(7, 12, 2, 2, wb); R(10, 12, 2, 2, wb); P(4, 13, sh); P(7, 13, sh); P(10, 13, sh); } else { R(5, 12, 2, 2, wb); R(8, 12, 2, 2, wb); R(11, 12, 1, 2, wb); R(4, 12, 1, 1, wb); P(5, 13, sh); P(8, 13, sh); }
    } else if (name === 'condfmt') { // 条件つき書式: にじいろの ペンキローラー
      const st = ['#C00000', '#ED7D31', '#FFC000', '#70AD47', '#4472C4', '#7030A0'], wd = [2, 2, 3, 3, 2, 2];
      let x = 1; st.forEach((c, i) => { R(x, 2, wd[i], 6, c); x += wd[i]; }); R(1, 2, 14, 1, '#F2F2F2'); R(1, 7, 14, 1, '#404040');
      R(4, 4, 3, 3, W); R(9, 4, 3, 3, W); P(5, 5, K); P(5, 6, K); P(10, 5, K); P(10, 6, K);
      R(7, 8, 2, 1, '#7F7F7F'); R(7, 9, 5, 1, '#7F7F7F'); R(11, 10, 2, 5, '#A6A6A6'); R(11, 10, 1, 5, '#D9D9D9');
      if (fr) { P(2, 1, '#FFFFFF'); P(13, 0, '#FFE699'); } else { P(3, 0, '#FFE699'); P(14, 1, '#FFFFFF'); }
    } else if (name === 'shuffler') { // 並べ替え: オレンジの はこと、「上へ・下へ」の やじるし
      R(5, 4, 6, 9, '#ED7D31'); R(5, 4, 6, 1, '#F4B183'); R(5, 12, 6, 1, '#C55A11');
      R(6, 6, 2, 3, W); R(9, 6, 2, 3, W); P(7, 7, K); P(7, 8, K); P(10, 7, K); P(10, 8, K); R(7, 11, 2, 1, K);
      P(2, 2, W); R(1, 3, 3, 1, W); R(0, 4, 5, 1, W); R(2, 5, 1, fr ? 8 : 9, W);
      R(13, fr ? 3 : 2, 1, 8, W); R(11, 10, 5, 1, W); R(12, 11, 3, 1, W); P(13, 12, W);
    } else if (name === 'circ') { // 循環参照: ぐるぐる まわる、こんいろの わっか
      const ring = '#2F3E6B', lt = '#6C7FB8', core = '#1B2340';
      R(5, 1, 6, 1, ring); R(3, 2, 10, 1, ring); R(2, 3, 12, 2, ring); R(1, 5, 14, 6, ring); R(2, 11, 12, 2, ring); R(3, 13, 10, 1, ring); R(5, 14, 6, 1, ring);
      R(5, 4, 6, 1, core); R(4, 5, 8, 6, core); R(5, 11, 6, 1, core);
      R(3, 2, 6, 1, lt); R(2, 3, 4, 1, lt); R(1, 5, 1, 4, lt);
      R(5, 7, 2, 2, '#FFD966'); R(9, 7, 2, 2, '#FFD966'); P(6, 8, K); P(10, 8, K);
      if (fr) { P(14, 2, '#FFC000'); P(15, 3, '#FFC000'); P(0, 12, '#FFC000'); } else { P(14, 12, '#FFC000'); P(15, 11, '#FFC000'); P(0, 3, '#FFC000'); }
    } else { // タレット: はいいろのほうだい
      R(3, 10, 10, 4, '#595959'); R(2, 14, 12, 1, '#404040'); R(4, 6, 8, 5, '#7F7F7F'); R(5, 5, 6, 1, '#7F7F7F'); R(5, 6, 4, 1, '#BFBFBF');
      R(10, 7, 5, 3, '#404040'); R(6, 8, 2, 2, '#C00000'); P(4, 12, '#BFBFBF'); P(11, 12, '#BFBFBF');
    }
    return g;
  }


  // ---- データのかけら(宝石)と、ゴールの フロッピーディスク: ほかのキャラと おなじ、ドットのえ+こい灰いろのふち ----
  const SHARD = ['..LLLLLL..', '.LWWLLMMD.', 'LWLLLMMMDD', 'LLLLMMMMDD', '.LLLMMMDD.', '..LLMMDD..', '...LMMD...', '....MD....'];
  const SHCX = { W: '#FFFFFF', L: '#9DC3E6', M: '#5B9BD5', D: '#2F5597' };
  // フロッピー: 14x14のディスクを、かどを したにした(ひしがた)15x15のドット。まえ=シャッターとラベル、うら=まんなかの わ
  function floppyGrid(back) {
    const N = 15, c = 7, g = [];
    for (let y = 0; y < N; y++) { const row = []; for (let x = 0; x < N; x++) {
      if (Math.abs(x - c) + Math.abs(y - c) > c) { row.push(null); continue; }
      const s = x + y; let col = s >= 14 ? '#2F5597' : '#4472C4'; // ひだりうえは ひかり、みぎしたは かげ
      if (!back) {
        if (y >= 2 && y <= 6 && s >= 7 && s <= 10) col = (s === 9 && y >= 3 && y <= 5) ? '#7F7F7F' : '#D9D9D9'; // シャッター(ぎんいろ)
        else if (y >= 8 && y <= 12 && s >= 17 && s <= 21) col = (s === 19 && y >= 9 && y <= 11) ? '#C00000' : '#FFFFFF'; // ラベル
      } else {
        const dx = x - c, dy = y - c; if (dx * dx + dy * dy <= 7) col = (dx * dx + dy * dy <= 1) ? '#404040' : '#D9D9D9'; // まんなかの わ
      }
      row.push(col); } g.push(row); }
    return g;
  }
  window.GFXX = {
    HW, HH,
    block(t, c) { const cr = t === 3 || c === 4; const key = (cr ? 'c' : 'b') + (cr ? 0 : c); return cache[key] || (cache[key] = cr ? makeCrack() : makeBlock(c)); }, // 黄色=ひび割れ(おなじ ブロック)
    steel() { return window.GFX.metal(); },
    hero(name, flip) { const k = 'h' + name + (flip ? 1 : 0); return cache[k] || (cache[k] = GFX.gridSprite(GFX.heroFrame(name, HCX), flip, OUTX)); },
    bird(flip) { const k = 'bird' + (flip ? 1 : 0); return cache[k] || (cache[k] = GFX.gridSprite(BIRD.map(r => [...r].map(ch => (ch === '.' ? null : BCX[ch]))), flip, OUTX)); },
    ener(name, flip) { const k = 'en' + name + (flip ? 1 : 0); return cache[k] || (cache[k] = GFX.gridSprite(GFX.enerGrid(name, BCX), flip, OUTX)); },
    enemy(name, fr, flip) { const k = 'e' + name + fr + (flip ? 1 : 0); return cache[k] || (cache[k] = GFX.gridSprite(enemyGrid(name, fr), flip, OUTX)); },
    shard() { return cache.shard || (cache.shard = GFX.gridSprite(SHARD.map(r => [...r].map(ch => (ch === '.' ? null : SHCX[ch]))), false, OUTX)); },
    floppy(back) { const k = 'fl' + (back ? 1 : 0); return cache[k] || (cache[k] = GFX.gridSprite(floppyGrid(back), false, OUTX)); },
    bg: drawBg, frame: drawFrame,
  };
})();
