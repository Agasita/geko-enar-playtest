/* ゲコ＆エナー v2 — ステージ定義。世界は「表計算シート」: ブロックは、色つきのセル。
   マスの記号: . 空き / # 石(編集できる) / S 鋼(編集できない) / c ひび割れ(攻撃・ダッシュで壊れる)
   色: 0 茶(ふつう) 1 赤(あつい) 2 青(氷) 3 緑(ばね) 4 黄(もろい)。座標は「マス」(x, y)。
   何もないところにブロックは生まれない。あるブロックを、動かす・並べる・塗る・隠す・消す。 */
(function () {
  'use strict';
  function make(def) {
    const w = def.w, h = def.h || 12;
    const front = [], color = [], lock = [];
    for (let y = 0; y < h; y++) { front.push(new Array(w).fill('.')); color.push(new Array(w).fill(0)); lock.push(new Array(w).fill(0)); }
    const m = {
      ents: [], gems: [], sparks: [], checks: [], start: [2, h - 3], flag: [w - 4, h - 3],
      set(x, y, ch) { front[y][x] = ch; },
      rect(x0, y0, x1, y1, ch) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) front[y][x] = ch; },
      floor() { m.rect(0, h - 2, w - 1, h - 1, 'S'); },
      ceil(rows) { m.rect(0, 0, w - 1, rows - 1, 'S'); },
      pit(x0, x1) { m.rect(x0, h - 2, x1, h - 1, '.'); },
      blk(x, y, c, locked) { front[y][x] = '#'; color[y][x] = c || 0; if (locked) lock[y][x] = 1; },
      paint(x0, y0, x1, y1, c) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) color[y][x] = c; },
      lockRect(x0, y0, x1, y1) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) lock[y][x] = 1; },
      ent(type, x, y, extra) { m.ents.push(Object.assign({ type, x, y }, extra || {})); },
      gem(x, y) { m.gems.push([x, y]); },
      spark(x, y) { m.sparks.push([x, y]); },
      check(x, y) { m.checks.push([x, y]); },
    };
    def.build(m);
    return {
      id: def.id, name: def.name, world: def.world, w, h, tools: def.tools || [], energy: def.energy !== undefined ? def.energy : 60, regen: def.regen,
      front: front.map(r => r.join('')), color, lock,
      ents: m.ents, gems: m.gems, sparks: m.sparks, checks: m.checks, start: m.start, flag: m.flag,
      hints: def.hints || [], solution: def.solution || [], bg: def.bg, bg2: def.bg2, par: def.par || 0,
    };
  }

  const L = [];

  // ---- ワールド1: 寄せる ----
  L.push(make({
    id: '1-1', name: 'はじめの一歩', world: 1, w: 56, tools: [], energy: 0, bg: '#42B8C2', bg2: '#3AA7B1',
    hints: [
      { x: 1, text: '◀ ▶ で移動。A でジャンプ（長押しで高く）' },
      { x: 14, text: '穴は、ジャンプでとびこえよう' },
      { x: 26, text: 'B でレンチ攻撃。敵に当てて、たおそう' },
      { x: 40, text: '宝石を3つ集めると★がふえる' },
    ],
    build(m) {
      m.floor(); m.pit(18, 20); m.set(9, 9, '#');
      m.rect(33, 8, 36, 8, '#'); m.gem(35, 7);
      m.pit(42, 43); m.gem(43, 8); m.gem(48, 8);
      m.ent('walker', 28, 9); m.ent('walker', 46, 9);
      m.spark(15, 9); m.spark(39, 9);
      m.flag = [52, 9];
    },
  }));

  L.push(make({
    id: '1-2', name: '重力で寄せる', world: 1, w: 56, tools: ['sort'], energy: 12, bg: '#42B8C2', bg2: '#3AA7B1', par: 10,
    hints: [
      { x: 1, text: '「編集」で時間が止まる。世界は表計算シート、ブロックは色つきのセルだよ' },
      { x: 8, text: '「データ」タブの「並べ替え」: 範囲のブロックを、一方向に寄せる。「寄せ↓」は、重力で落とすイメージ' },
      { x: 14, text: '穴の上に浮かぶブロックを、範囲ごと選んで「寄せ↓」。落ちて橋になる' },
    ],
    build(m) {
      m.floor(); m.ceil(3); m.pit(22, 29);
      [4, 5, 6, 4, 5, 6, 4, 5].forEach((y, i) => m.blk(22 + i, y, 0));
      m.gem(26, 8); m.gem(40, 8); m.gem(46, 5); m.set(46, 6, '#');
      m.ent('walker', 38, 9);
      m.check(34, 9);
      m.flag = [52, 9];
    },
    solution: [{ x: 18, edits: [{ tool: 'sort', rect: { x0: 22, y0: 4, x1: 29, y1: 10 }, opts: { sort: 'D' } }] }],
  }));

  L.push(make({
    id: '1-3', name: 'ダッシュと割れ壁', world: 1, w: 66, tools: [], energy: 0, bg: '#42B8C2', bg2: '#3AA7B1',
    hints: [
      { x: 8, text: '広い穴は C でダッシュしながらジャンプ！' },
      { x: 26, text: '盾の敵は、ダッシュでぶつかるとたおせる' },
      { x: 42, text: 'ひび割れた壁は、攻撃かダッシュで壊れる' },
      { x: 50, text: '赤いブロックは、さわると即ミス。ジャンプでこえよう' },
    ],
    build(m) {
      m.floor(); m.pit(18, 21);
      m.ent('guard', 33, 9);
      m.rect(46, 7, 46, 9, 'c'); m.gem(49, 9);
      m.blk(54, 9, 1);
      m.gem(31, 8); m.gem(38, 7); m.set(38, 8, '#');
      m.spark(12, 9); m.spark(29, 9); m.spark(44, 9);
      m.check(40, 9);
      m.flag = [62, 9];
    },
  }));

  // ---- ワールド2: フィルター ----
  L.push(make({
    id: '2-1', name: 'フィルター', world: 2, w: 62, tools: ['filter'], energy: 8, bg: '#F3C9A0', bg2: '#E9B88A', par: 8,
    hints: [
      { x: 6, text: '「データ」タブの「フィルター」: 選んだ色のブロックだけが残り、ほかは通りぬけられる' },
      { x: 20, text: '青だけ残すと、茶色の壁が消える。足場の青は残る' },
    ],
    build(m) {
      m.floor(); m.ceil(4);
      m.rect(30, 4, 31, 9, '#');
      m.blk(36, 8, 2); m.blk(37, 8, 2); m.blk(38, 8, 2); m.gem(37, 7);
      m.gem(25, 9); m.gem(52, 8);
      m.ent('walker', 24, 9); m.ent('walker', 42, 9);
      m.check(34, 9);
      m.flag = [58, 9];
    },
    solution: [{ x: 26, edits: [{ tool: 'filter', fcolor: 2 }] }],
  }));

  L.push(make({
    id: '2-2', name: '寄せてから、フィルター', world: 2, w: 62, tools: ['sort', 'filter'], energy: 20, bg: '#F3C9A0', bg2: '#E9B88A', par: 18,
    hints: [
      { x: 4, text: '浮かぶ青いブロックを「寄せ↓」で橋にして、そのあと「フィルター」で青だけ残す' },
      { x: 30, text: '茶色の壁は、フィルターで通りぬけよう。橋（青）は残る' },
    ],
    build(m) {
      m.floor(); m.ceil(3); m.pit(20, 27);
      [4, 5, 6, 4, 5, 6, 4, 5].forEach((y, i) => m.blk(20 + i, y, 2));
      m.rect(38, 3, 39, 9, '#');
      m.gem(24, 8); m.gem(46, 8);
      m.ent('walker', 46, 9);
      m.check(32, 9);
      m.flag = [56, 9];
    },
    solution: [
      { x: 16, edits: [{ tool: 'sort', rect: { x0: 20, y0: 4, x1: 27, y1: 10 }, opts: { sort: 'D' } }] },
      { x: 30, edits: [{ tool: 'filter', fcolor: 2 }] },
    ],
  }));

  // ---- ワールド3: ガラスと書式のコピー ----
  L.push(make({
    id: '3-1', name: 'ガラスに書式をつける', world: 3, w: 60, tools: ['painter'], energy: 4, bg: '#C7B9EE', bg2: '#B8A8E6', par: 2,
    hints: [
      { x: 4, text: '透明なブロックは「ガラス」（未書式のセル）。性質をもたない。「書式のコピー」で色（性質）をつけられる' },
      { x: 16, text: '空に浮かぶ緑のブロックを①タップ → 天井の穴の下のガラスの床を②ドラッグ。床がはずむ' },
      { x: 27, text: '上に出たら、いちばん高いところで C（ダッシュ）で前へ！' },
    ],
    build(m) {
      m.floor(); m.ceil(4);
      m.rect(24, 6, 59, 6, 'S'); m.rect(29, 6, 32, 6, '.');
      m.rect(56, 7, 59, 9, 'S');
      m.blk(30, 10, 5); m.blk(31, 10, 5);
      m.blk(22, 6, 3); m.blk(14, 6, 3);
      m.gem(31, 8); m.gem(40, 5); m.gem(48, 5);
      m.ent('walker', 20, 9); m.ent('walker', 46, 5);
      m.check(26, 9);
      m.flag = [55, 5];
    },
    solution: [{ x: 24, edits: [{ tool: 'painter', srcCell: [22, 6], rect: { x0: 30, y0: 10, x1: 31, y1: 10 } }] }],
  }));

  L.push(make({
    id: '3-2', name: 'ガラスの橋', world: 3, w: 66, tools: ['sort', 'painter', 'filter'], energy: 22, bg: '#C7B9EE', bg2: '#B8A8E6', par: 20,
    hints: [
      { x: 1, text: 'まず茶色の壁を、フィルターで通りぬけたい。でも、ガラスは色がないので、フィルターで消えてしまう' },
      { x: 4, text: '①ガラスを「寄せ↓」で橋に ②青いブロックの色を書式コピーで橋にうつす ③フィルターで青だけ残す' },
    ],
    build(m) {
      m.floor(); m.ceil(3); m.pit(26, 33);
      [4, 5, 6, 4, 5, 6, 4, 5].forEach((y, i) => m.blk(26 + i, y, 5));
      m.blk(6, 6, 2);
      m.rect(14, 3, 15, 9, '#');
      m.gem(30, 8); m.gem(48, 8);
      m.ent('walker', 22, 9); m.ent('walker', 50, 9);
      m.check(20, 9);
      m.flag = [60, 9];
    },
    solution: [
      { x: 8, edits: [{ tool: 'sort', rect: { x0: 26, y0: 4, x1: 33, y1: 10 }, opts: { sort: 'D' } }, { tool: 'painter', srcCell: [6, 6], rect: { x0: 26, y0: 10, x1: 33, y1: 10 } }, { tool: 'filter', fcolor: 2 }] },
    ],
  }));

  // ---- ワールド4: 変形 ----
  L.push(make({
    id: '4-1', name: '左右反転', world: 4, w: 56, tools: ['transform'], energy: 10, bg: '#9ADBC0', bg2: '#86CEB0', par: 8,
    hints: [
      { x: 4, text: '「セル」タブの「変形」→「左右反転」: 範囲のブロックを、左右にひっくり返す' },
      { x: 12, text: '左がわが高い階段は、のぼれない。2つの階段を、まとめて範囲に入れて反転しよう' },
    ],
    build(m) {
      m.floor(); m.ceil(3);
      [[22, 6], [23, 7], [24, 8], [25, 9], [30, 6], [31, 7], [32, 8], [33, 9]].forEach(([x, y]) => m.rect(x, y, x, 9, '#'));
      m.gem(27, 9); m.gem(44, 8); m.gem(36, 6);
      m.ent('walker', 40, 9);
      m.check(36, 9);
      m.flag = [52, 9];
    },
    solution: [{ x: 18, edits: [{ tool: 'transform', rect: { x0: 22, y0: 6, x1: 33, y1: 9 }, opts: { tf: 'flipH' } }] }],
  }));

  L.push(make({
    id: '4-2', name: '倒して橋に', world: 4, w: 66, tools: ['transform', 'filter'], energy: 18, bg: '#9ADBC0', bg2: '#86CEB0', par: 16,
    hints: [
      { x: 6, text: '向こう岸にそびえる青い塔を、穴ごと選んで「変形」→「回転90°」。倒れて橋になる！（正方形に選ぶ）' },
      { x: 34, text: '茶色の壁は、フィルターで通りぬけよう' },
    ],
    build(m) {
      m.floor(); m.ceil(4); m.pit(20, 25);
      m.rect(25, 5, 25, 10, '#'); m.paint(25, 5, 25, 10, 2);
      m.rect(44, 4, 44, 9, '#');
      m.gem(22, 8); m.gem(56, 8); m.gem(34, 5);
      m.ent('walker', 50, 9);
      m.check(31, 9);
      m.flag = [62, 9];
    },
    solution: [
      { x: 16, edits: [{ tool: 'transform', rect: { x0: 20, y0: 5, x1: 25, y1: 10 }, opts: { tf: 'rot' } }] },
      { x: 38, edits: [{ tool: 'filter', fcolor: 2 }] },
    ],
  }));

  // ---- ワールド5: 保護 ----
  L.push(make({
    id: '5-1', name: '保護でのこす', world: 5, w: 62, tools: ['protect', 'filter'], energy: 14, bg: '#F2B6B0', bg2: '#E8A29B', par: 12,
    hints: [
      { x: 1, text: '茶色の壁を、フィルターで通りぬけたい。でも、穴の中の足場も茶色で、いっしょに消えてしまう' },
      { x: 4, text: '「表示」タブの「シートの保護」: 保護したブロックは、フィルターで消えない（カギのマーク）。足場を保護してから、フィルターで青だけ残そう' },
    ],
    build(m) {
      m.floor(); m.ceil(4); m.pit(26, 33);
      m.blk(27, 10, 0); m.blk(28, 10, 0); m.blk(31, 10, 0); m.blk(32, 10, 0);
      m.rect(14, 4, 15, 9, '#');
      m.blk(6, 9, 2); m.gem(48, 8);
      m.gem(30, 8); m.gem(54, 8);
      m.ent('walker', 44, 9);
      m.check(20, 9);
      m.flag = [58, 9];
    },
    solution: [
      { x: 8, edits: [{ tool: 'protect', rect: { x0: 27, y0: 10, x1: 32, y1: 10 } }, { tool: 'filter', fcolor: 2 }] },
    ],
  }));

  L.push(make({
    id: '5-2', name: '保護を解除して寄せる', world: 5, w: 60, tools: ['sort', 'unprotect'], energy: 18, bg: '#F2B6B0', bg2: '#E8A29B', par: 16,
    hints: [
      { x: 4, text: '保護されたブロック（カギ）は「寄せる」の仕切りになる。仕切りの上のブロックは、そこで止まる' },
      { x: 12, text: '先に保護を解除してから、まとめて「寄せ↓」しよう。順番を間違えると、コストが足りなくなる' },
    ],
    build(m) {
      m.floor(); m.ceil(3); m.pit(22, 29);
      [4, 5, 6, 4, 5, 6, 4, 5].forEach((y, i) => m.blk(22 + i, y, 0));
      for (let x = 22; x <= 28; x++) m.blk(x, 7, 0, true);
      m.gem(26, 8); m.gem(46, 8);
      m.ent('walker', 44, 9);
      m.check(34, 9);
      m.flag = [54, 9];
    },
    solution: [{ x: 18, edits: [{ tool: 'unprotect', rect: { x0: 22, y0: 7, x1: 28, y1: 7 } }, { tool: 'sort', rect: { x0: 22, y0: 4, x1: 29, y1: 10 }, opts: { sort: 'D' } }] }],
  }));

  L.push(make({
    id: '5-3', name: '寄せてから反転', world: 5, w: 62, tools: ['sort', 'transform'], energy: 20, bg: '#F2B6B0', bg2: '#E8A29B', par: 18,
    hints: [
      { x: 4, text: '散らばったブロックを、まず「←寄せ」で階段の形にそろえる' },
      { x: 12, text: 'つぎに「変形」→「左右反転」。左が高い階段は、のぼれない。反転して、のぼれる階段にしよう' },
    ],
    build(m) {
      m.floor(); m.ceil(1);
      [[9, [0, 2, 3, 5]], [8, [1, 4, 5]], [7, [2, 5]], [6, [4]]].forEach(([y, xs]) => xs.forEach(x => m.blk(16 + x, y, 0)));
      m.rect(22, 6, 50, 9, 'S');
      m.gem(40, 5); m.gem(12, 9);
      m.ent('walker', 10, 9);
      m.check(14, 9);
      m.flag = [46, 5];
    },
    solution: [{ x: 11, edits: [{ tool: 'sort', rect: { x0: 16, y0: 6, x1: 21, y1: 9 }, opts: { sort: 'L' } }, { tool: 'transform', rect: { x0: 16, y0: 6, x1: 21, y1: 9 }, opts: { tf: 'flipH' } }] }],
  }));

  // ---- ワールド6: 上へ（たて長のステージ） ----
  L.push(make({
    id: '6-1', name: 'バネのたて穴', world: 6, w: 24, h: 30, tools: ['painter'], energy: 8, bg: '#8FA6E8', bg2: '#7E95DB', par: 7,
    hints: [
      { x: 0, text: 'たて穴をのぼろう。ふつうのジャンプでは、天井にとどかない' },
      { x: 8, text: '空に浮かぶ緑のブロックの色を、「書式のコピー」で足もとのガラスにうつして、天井の穴をつきぬけよう。つぎの足場も同じように' },
    ],
    build(m) {
      m.floor();
      m.rect(0, 0, 0, 27, 'S'); m.rect(23, 0, 23, 27, 'S'); m.rect(1, 0, 22, 1, 'S');
      [[23, 10], [18, 6], [13, 10], [8, 6]].forEach(([y, hx]) => { m.rect(1, y, 22, y, 'S'); m.rect(hx, y, hx + 1, y, '.'); });
      m.blk(4, 24, 3);
      m.blk(10, 27, 5); m.blk(11, 27, 5);
      m.blk(6, 22, 5); m.blk(7, 22, 5);
      m.blk(10, 17, 5); m.blk(11, 17, 5);
      m.blk(6, 12, 5); m.blk(7, 12, 5);
      m.gem(15, 22); m.gem(5, 17); m.gem(15, 12);
      m.start = [3, 27]; m.flag = [19, 7];
    },
    solution: [],
  }));

  L.push(make({
    id: '6-2', name: 'のぼりの塔', world: 6, w: 26, h: 30, tools: [], energy: 0, bg: '#8FA6E8', bg2: '#7E95DB',
    hints: [{ x: 0, text: 'ジグザグに足場をのぼろう。落ちたら、ひとつ下の足場にもどるだけ' }],
    build(m) {
      m.floor();
      m.rect(0, 0, 0, 27, 'S'); m.rect(25, 0, 25, 27, 'S'); m.rect(1, 0, 24, 1, 'S');
      for (let i = 0; i < 11; i++) { const y = 26 - i * 2, x = i % 2 ? 12 : 2; m.rect(x, y, x + 7, y, 'S'); }
      m.ent('walker', 15, 23); m.ent('walker', 4, 17); m.ent('flyer', 5, 11);
      m.gem(14, 19); m.gem(5, 13); m.gem(14, 7);
      m.check(13, 19); m.check(13, 11);
      m.start = [10, 27]; m.flag = [4, 5];
    },
    solution: [],
  }));

  // ---- 実験シート: すべての道具を、好きに試す場所 ----
  L.push(make({
    id: 'LAB', name: '実験シート（全機能）', world: 5, w: 64, regen: 10, energy: 100, bg: '#B7C6D9', bg2: '#A6B6CC',
    tools: ['painter', 'transform', 'sort', 'filter', 'protect', 'unprotect'],
    hints: [
      { x: 1, text: '実験シート: すべての道具が使える（エナジーは早く回復）。気になる機能を、ためしてみよう' },
      { x: 12, text: '色のちがうブロックの列（ガラスもある）。「並べ替え」「書式のコピー（ガラスだけ）」を試そう' },
      { x: 24, text: 'カギは保護。「保護の解除」で外してから、寄せる・変形ができる' },
      { x: 34, text: '穴は、ジャンプ＋ダッシュでこえよう' },
      { x: 46, text: '壁は「フィルター」で通れる（残す色をえらぶ）' },
    ],
    build(m) {
      m.floor(); m.ceil(2);
      // A: 色のちがう列と段(並べ替え・書式のコピー)
      [5, 2, 3, 5, 0, 3, 5, 2, 0].forEach((c, i) => m.blk(6 + i, 8, c));
      [2, 5, 4, 3].forEach((c, i) => m.blk(8 + i, 7, c));
      // B: 4×4の模様(変形)
      const pat = ['.1.3', '2..5', '.4.1', '30.2'];
      pat.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') m.blk(18 + i, 4 + j, +ch); }));
      // C: 保護されたブロック
      m.blk(26, 8, 0, true); m.blk(27, 8, 3, true); m.blk(28, 8, 0, true);
      // D: 穴
      m.pit(36, 40);
      // E: 壁(フィルター)
      m.rect(46, 3, 47, 9, '#');
      m.ent('walker', 14, 9); m.ent('guard', 30, 9); m.ent('walker', 52, 9); m.ent('flyer', 22, 6);
      m.spark(10, 9); m.spark(20, 9); m.spark(32, 9); m.spark(44, 9); m.spark(54, 9);
      m.flag = [60, 9];
    },
    solution: [{ x: 42, edits: [{ tool: 'filter', fcolor: 2 }] }],
  }));

  window.LEVELS = L;
})();
