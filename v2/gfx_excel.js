/* ゲコ＆エナー v2 — Excel風グラフィック。世界を「表計算シート」として描く。
   白いシートに方眼(セル)、列見出し(A, B, C…)と行番号、選択中のセル(緑のわく)。ブロックは「色つきのセル」。
   URLに ?gfx=excel (標準)。?gfx=classic で元の絵、?gfx=snes でソリッド版。 */
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

  // ---- ブロック(色つきのセル) ----
  const FILL = ['#F4B183', '#FF6B5E', '#9DC3E6', '#70AD47', '#FFD966', '#FFFFFF'];
  const cache = {};
  function cell(c) {
    const s = surface(16, 16), base = hex(FILL[c]), bd = mix(base, [0, 0, 0], .32), hi = mix(base, [255, 255, 255], .45);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) s.set(x, y, base);
    for (let i = 0; i < 16; i++) { s.set(i, 0, bd); s.set(i, 15, bd); s.set(0, i, bd); s.set(15, i, bd); }
    for (let i = 1; i < 15; i++) { s.set(i, 1, hi); s.set(1, i, hi); }
    return { s, base, bd, hi };
  }
  const dots = (s, pts, col) => pts.forEach(([x, y]) => s.set(x, y, col));
  function makeBlock(c) {
    const { s, base, bd, hi } = cell(c), W = '#FFFFFF', D = css(mix(base, [0, 0, 0], .55));
    if (c === 1) { for (let y = 3; y <= 9; y++) { s.set(7, y, W); s.set(8, y, W); } s.set(7, 12, W); s.set(8, 12, W); s.set(7, 13, W); s.set(8, 13, W); } // 「!」(さわると即ミス)
    else if (c === 2) { for (const [x0, y0] of [[2, 5], [2, 10]]) { dots(s, [[x0, y0 + 1], [x0 + 1, y0], [x0 + 2, y0], [x0 + 3, y0 + 1], [x0 + 4, y0 + 2], [x0 + 5, y0 + 2], [x0 + 6, y0 + 1], [x0 + 7, y0], [x0 + 8, y0], [x0 + 9, y0 + 1], [x0 + 10, y0 + 2], [x0 + 11, y0 + 2]], W); } } // 「〜」(すべる)
    else if (c === 3) { for (const y0 of [3, 9]) for (let i = 0; i < 5; i++) { s.set(7 - i, y0 + i, W); s.set(8 + i, y0 + i, W); s.set(7 - i, y0 + i + 1, D); s.set(8 + i, y0 + i + 1, D); } } // 「︿」(はずむ)
    else if (c === 4) { dots(s, [[8, 2], [7, 3], [7, 4], [8, 5], [9, 6], [8, 7], [7, 8], [8, 9], [9, 10], [8, 11], [8, 12], [9, 13]], D); dots(s, [[3, 7], [12, 4], [4, 12], [12, 11]], D); } // ひび(もろい)
    else if (c === 5) { for (let i = 0; i < 7; i++) { s.set(3 + i, 11 - i, '#BDD7EE'); s.set(4 + i, 11 - i, '#DDEBF7'); s.set(8 + i, 13 - i + 0, '#DDEBF7'); } } // ガラスのつや(未書式)
    return s.done();
  }
  function makeCrack() {
    const s = surface(16, 16); s.g.drawImage(makeBlock(0), 0, 0);
    const g = s.g; g.fillStyle = '#8C4A1F'; for (const [x, y] of [[8, 2], [7, 3], [7, 4], [8, 5], [9, 6], [8, 7], [7, 8], [8, 9], [9, 11], [8, 12], [8, 13]]) g.fillRect(x, y, 2, 1);
    return s.c;
  }
  function makeSteel() { // 鋼: 編集できないセル(しゃ線)
    const s = surface(16, 16);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) s.set(x, y, ((x + y) % 6 < 3) ? '#BFBFBF' : '#A6A6A6');
    for (let i = 0; i < 16; i++) { s.set(i, 0, '#595959'); s.set(i, 15, '#595959'); s.set(0, i, '#595959'); s.set(15, i, '#595959'); }
    for (let i = 1; i < 15; i++) { s.set(i, 1, '#E0E0E0'); s.set(1, i, '#E0E0E0'); }
    return s.done();
  }

  // ---- 背景・見出し・選択わく ----
  const HW = 13, HH = 9; // 行番号の幅 / 列見出しの高さ
  function cols(G, lv) { return { X: G.cX || null, w: G.cw || null }; }
  function drawBg(ctx, G, lv, W, H) {
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
    const cx = Math.round(G.cam.x + (G.warp ? 0 : (G.sx || 0))), cy = Math.round(G.cam.y), T = 16;
    ctx.fillStyle = '#D4D4D4';
    if (G.cX) { for (let c = 0; c < G.cw.length; c++) { const x = G.cX[c] - cx; if (x >= W) break; if (x >= 0) ctx.fillRect(x, 0, 1, H); } }
    else for (let x = -(((cx % T) + T) % T); x < W; x += T) ctx.fillRect(x, 0, 1, H);
    for (let y = -(((cy % T) + T) % T); y < H; y += T) ctx.fillRect(0, y, W, 1);
  }
  function drawFrame(ctx, G, lv, W, H) {
    const cx = Math.round(G.cam.x + (G.warp ? 0 : (G.sx || 0))), cy = Math.round(G.cam.y), T = 16, X = G.cX, CW = G.cw, nC = CW ? CW.length : lv.w;
    const colX = (c) => X ? X[c] : c * T, colW = (c) => CW ? CW[c] : T;
    const colAt = (px) => { if (!X) return Math.floor(px / T); let lo = 0, hi = nC - 1; if (px < 0) return 0; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (X[m] <= px) lo = m; else hi = m - 1; } return lo; };
    // カーソル(選択中のセル)は、編集中だけ出す。見出しも、そのセルの列・行が緑になる
    const E = G.edit, cur = E && E.on ? (E.hover || E.cursor) : null, pc = cur ? cur[0] : -999, pr = cur ? cur[1] : -999;
    if (cur) { const x = colX(pc) - cx, y = pr * T - cy, w = colW(pc); ctx.fillStyle = '#217346'; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + T - 1, w, 1); ctx.fillRect(x, y, 1, T); ctx.fillRect(x + w - 1, y, 1, T); ctx.fillRect(x + w - 3, y + T - 3, 4, 4); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x + w - 2, y + T - 2, 2, 2); }
    // 列見出し
    ctx.fillStyle = '#E6E6E6'; ctx.fillRect(HW, 0, W - HW, HH); ctx.fillStyle = '#ABABAB'; ctx.fillRect(HW, HH - 1, W - HW, 1);
    for (let c = Math.max(0, colAt(cx + HW)); c < nC && colX(c) - cx < W; c++) {
      const x = colX(c) - cx, cwid = colW(c); if (x + cwid <= HW) continue;
      if (c === pc) { ctx.fillStyle = '#C6E0B4'; ctx.fillRect(Math.max(HW, x), 0, x < HW ? x + cwid - HW : cwid, HH - 1); }
      ctx.fillStyle = '#ABABAB'; if (x >= HW) ctx.fillRect(x, 0, 1, HH);
      const name = colName(c); if (x >= HW - 1 && cwid >= name.length * 4 + 2) glyphs(ctx, name, x + Math.round((cwid - name.length * 4 + 1) / 2), 2, c === pc ? '#1E5C3A' : '#444444');
    }
    // 行番号
    ctx.fillStyle = '#E6E6E6'; ctx.fillRect(0, HH, HW, H - HH); ctx.fillStyle = '#ABABAB'; ctx.fillRect(HW - 1, HH, 1, H - HH);
    for (let r = Math.floor((cy + HH) / T); r * T - cy < H; r++) {
      const y = r * T - cy; if (y + T <= HH) continue;
      if (r === pr) { ctx.fillStyle = '#C6E0B4'; ctx.fillRect(0, Math.max(HH, y), HW - 1, y < HH ? y + T - HH : T); }
      ctx.fillStyle = '#ABABAB'; if (y >= HH) ctx.fillRect(0, y, HW, 1);
      const name = String(r + 1); if (y >= HH - 3) glyphs(ctx, name, Math.round((HW - name.length * 4) / 2), y + 5, r === pr ? '#1E5C3A' : '#444444');
    }
    // 左上の角(すべて選択)
    ctx.fillStyle = '#E6E6E6'; ctx.fillRect(0, 0, HW, HH); ctx.fillStyle = '#ABABAB'; ctx.fillRect(HW - 1, 0, 1, HH); ctx.fillRect(0, HH - 1, HW, 1);
    ctx.fillStyle = '#B4B4B4'; ctx.fillRect(7, 2, 4, 1); ctx.fillRect(8, 3, 3, 1); ctx.fillRect(9, 4, 2, 1); ctx.fillRect(10, 5, 1, 1);
  }

  window.GFXX = {
    HW, HH,
    block(t, c) { const key = (t === 3 ? 'c' : 'b') + c; return cache[key] || (cache[key] = t === 3 ? makeCrack() : makeBlock(c)); },
    steel() { return window.GFX.metal(); },
    bg: drawBg, frame: drawFrame,
  };
})();
