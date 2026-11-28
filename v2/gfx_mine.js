/* 自作の絵(16×16)を、ゲームの絵に さしかえる。URLに ?mine=1 を つけたとき(せっていの「自作の絵」)だけ はたらく。
   絵は assets/mine/ に おく。1まい 16×16(ブロックは1マス)。いまの対象: 茶ブロック(block_brown.png)・鋼ブロック(block_steel.png)・溶岩(block_lava.png)・氷(block_ice.png)。
   どれも ゲームの座標(16px=1マス)に そのまま描く。画面の大きさにあわせて 整数倍に ひろがる(ぼかさない)。 */
(function () {
  'use strict';
  if (!/[?&]mine=1/.test(location.search)) return;
  const X = window.GFXX; if (!X) return;
  const BASE = 'assets/mine/', imgs = {}, cache = {};
  const load = (n) => { const i = new Image(); i.onload = () => { imgs[n] = i; }; i.onerror = () => {}; i.src = BASE + n + '.png'; };
  load('block_brown'); load('block_steel'); load('block_lava'); load('block_ice');
  // 読みこんだ絵を、16×16のcanvasにして かえす(まだなら、もとの絵)
  function tile(n) {
    if (cache[n]) return cache[n]; const i = imgs[n]; if (!i) return null;
    const c = document.createElement('canvas'); c.width = 16; c.height = 16; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(i, 0, 0, 16, 16); return cache[n] = c;
  }
  const S = window.GFX, origMetal = S && S.metal;
  if (origMetal) S.metal = function () { const f = tile('block_steel'); return f || origMetal.apply(S, arguments); }; // 鋼
  const orig = X.block;
  X.block = function (t, c) {
    if (t !== 3 && c === 0) { const f = tile('block_brown'); if (f) return f; } // 茶(ふつうの足場)
    if (t !== 3 && c === 1) { const f = tile('block_lava'); if (f) return f; } // 赤(マグマ)
    if (t !== 3 && c === 2) { const f = tile('block_ice'); if (f) return f; } // 青(氷)
    return orig.apply(X, arguments);
  };
})();
