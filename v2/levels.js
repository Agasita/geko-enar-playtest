/* ゲコ＆エナー v2 — ステージ定義。世界は「表計算シート」: ブロックは、色つきのセル。
   マスの記号: . 空き / # 石(編集できる) / S 鋼(編集できない) / c ひび割れ(攻撃・ダッシュで壊れる)
   色: 0 茶(ふつう) 1 赤(あつい) 2 青(氷) 3 緑(ばね) 4 黄(もろい)。座標は「マス」(x, y)。
   何もないところにブロックは生まれない。あるブロックを、動かす・並べる・塗る・隠す・消す。 */
(function () {
  'use strict';
  function make(def) {
    const w = def.w, h = 12;
    const front = [], color = [], lock = [];
    for (let y = 0; y < h; y++) { front.push(new Array(w).fill('.')); color.push(new Array(w).fill(0)); lock.push(new Array(w).fill(0)); }
    const m = {
      ents: [], gems: [], sparks: [], checks: [], start: [2, 9], flag: [w - 4, 9],
      set(x, y, ch) { front[y][x] = ch; },
      rect(x0, y0, x1, y1, ch) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) front[y][x] = ch; },
      floor() { m.rect(0, 10, w - 1, 11, 'S'); },
      ceil(rows) { m.rect(0, 0, w - 1, rows - 1, 'S'); },
      pit(x0, x1) { m.rect(x0, 10, x1, 11, '.'); },
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
  const T1 = ['move', 'clear'];

  // ---- ワールド1: スタートアップ ----
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
    id: '1-2', name: '切り取って、貼り付け', world: 1, w: 62, tools: ['move', 'clear'], energy: 12, bg: '#42B8C2', bg2: '#3AA7B1', par: 10,
    hints: [
      { x: 1, text: '「編集」で時間が止まる。世界は表計算シート、ブロックは色つきのセルだよ' },
      { x: 10, text: '上の棚のブロックを、「切り取り→貼り付け」で穴へ運ぼう。ブロックは新しくは生まれない' },
      { x: 34, text: '高い壁は「内容の消去」で消せる' },
    ],
    build(m) {
      m.floor(); m.pit(20, 25);
      m.rect(10, 6, 17, 6, 'S'); m.rect(12, 5, 17, 5, '#');
      m.rect(41, 6, 41, 9, '#');
      m.gem(22, 8); m.gem(41, 5); m.gem(53, 8);
      m.ent('walker', 31, 9); m.ent('walker', 49, 9);
      m.spark(18, 9); m.spark(30, 9); m.spark(46, 9);
      m.check(36, 9);
      m.flag = [58, 9];
    },
    solution: [
      { x: 15, edits: [{ tool: 'move', rect: { x0: 12, y0: 5, x1: 17, y1: 5 }, dst: [20, 10] }] },
      { x: 37, edits: [{ tool: 'clear', rect: { x0: 41, y0: 6, x1: 41, y1: 9 } }] },
    ],
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

  // ---- ワールド2: 行と列（非表示・変形） ----
  L.push(make({
    id: '2-1', name: '列をかくす', world: 2, w: 56, tools: ['hide', 'move'], energy: 8, bg: '#F3C9A0', bg2: '#E9B88A', par: 6,
    hints: [
      { x: 1, text: '新しい力「行・列の非表示」: 隠した列のブロックは、通りぬけられる' },
      { x: 18, text: '壁は消さずに、その列を隠そう。「表示」タブ →「行・列の非表示」→「列を隠す」' },
    ],
    build(m) {
      m.floor(); m.ceil(4);
      m.rect(26, 4, 28, 9, '#');
      m.gem(30, 9); m.gem(45, 8); m.gem(40, 5);
      m.ent('walker', 38, 9); m.ent('flyer', 44, 6);
      m.spark(20, 9); m.spark(35, 9);
      m.flag = [52, 9];
    },
    solution: [{ x: 22, edits: [{ tool: 'hide', rect: { x0: 26, y0: 5, x1: 28, y1: 5 }, opts: { axis: 'col' } }] }],
  }));

  L.push(make({
    id: '2-2', name: 'ひっくり返せ', world: 2, w: 66, tools: ['transform', 'hide', 'move'], energy: 16, bg: '#F3C9A0', bg2: '#E9B88A', par: 14,
    hints: [
      { x: 6, text: '「セル」タブの「変形」: ブロックを回転・反転・転置できる（回転と転置は正方形の範囲）' },
      { x: 12, text: '向こう岸にそびえる塔を、穴ごと選んで「回転90°」。倒れて橋になる！' },
      { x: 36, text: '壁は、その列を隠して通りぬけよう' },
    ],
    build(m) {
      m.floor(); m.ceil(4); m.pit(20, 25);
      m.rect(25, 5, 25, 10, '#');
      m.rect(44, 4, 44, 9, '#');
      m.gem(22, 8); m.gem(56, 8); m.gem(34, 5);
      m.ent('flyer', 34, 7); m.ent('walker', 50, 9); m.ent('turret', 58, 9);
      m.spark(16, 9); m.spark(31, 9); m.spark(40, 9);
      m.check(31, 9);
      m.flag = [62, 9];
    },
    solution: [
      { x: 17, edits: [{ tool: 'transform', rect: { x0: 20, y0: 5, x1: 25, y1: 10 }, opts: { tf: 'rot' } }] },
      { x: 40, edits: [{ tool: 'hide', rect: { x0: 44, y0: 5, x1: 44, y1: 5 }, opts: { axis: 'col' } }] },
    ],
  }));

  // ---- ワールド3: 色（書式） ----
  L.push(make({
    id: '3-1', name: '色の性質', world: 3, w: 60, tools: ['color', 'painter'], energy: 5, bg: '#C7B9EE', bg2: '#B8A8E6', par: 3,
    hints: [
      { x: 6, text: '「塗りつぶし」: ブロックの色には性質がある。緑＝はずむ、青＝すべる、赤＝あつい、黄＝もろい' },
      { x: 20, text: '天井の穴の下のブロックを、緑にしよう' },
      { x: 27, text: '上に出たら、いちばん高いところで C（ダッシュ）で前へ！' },
    ],
    build(m) {
      m.floor(); m.ceil(4);
      m.rect(24, 6, 59, 6, 'S'); m.rect(29, 6, 32, 6, '.');
      m.rect(56, 7, 59, 9, 'S');
      m.blk(30, 10, 0); m.blk(31, 10, 0);
      m.gem(31, 8); m.gem(40, 5); m.gem(48, 5);
      m.ent('walker', 20, 9); m.ent('walker', 46, 5);
      m.spark(14, 9); m.spark(36, 5);
      m.check(26, 9);
      m.flag = [55, 5];
    },
    solution: [{ x: 24, edits: [{ tool: 'color', rect: { x0: 30, y0: 10, x1: 31, y1: 10 }, opts: { color: 3 } }] }],
  }));

  // ---- ワールド4: データ（フィルター・保護・列の削除） ----
  L.push(make({
    id: '4-1', name: 'フィルター', world: 4, w: 62, tools: ['filter', 'color', 'replace'], energy: 10, bg: '#9ADBC0', bg2: '#86CEB0', par: 8,
    hints: [
      { x: 6, text: '「データ」タブの「フィルター」: 選んだ色のブロックだけが残り、ほかは通りぬけられる' },
      { x: 20, text: '青だけ残すと、茶色の壁が消える。終わったら「解除」を忘れずに' },
    ],
    build(m) {
      m.floor(); m.ceil(4);
      m.rect(30, 4, 31, 9, '#');
      m.blk(36, 8, 2); m.blk(37, 8, 2); m.blk(38, 8, 2); m.gem(37, 7);
      m.gem(25, 9); m.gem(52, 8);
      m.ent('walker', 24, 9); m.ent('walker', 42, 9); m.ent('guard', 48, 9);
      m.spark(16, 9); m.spark(34, 9);
      m.check(34, 9);
      m.flag = [58, 9];
    },
    solution: [{ x: 26, edits: [{ tool: 'filter', fcolor: 2 }] }],
  }));

  L.push(make({
    id: '4-2', name: 'シートを仕上げる', world: 4, w: 96, tools: ['unprotect', 'clear', 'transform', 'hide', 'delCol', 'color', 'filter'], energy: 46, bg: '#3C4170', bg2: '#343863', par: 42,
    hints: [
      { x: 6, text: '表計算のしくみを、ぜんぶ使おう' },
      { x: 12, text: '赤い鍵のついたブロックは「保護」されている。「表示」タブで保護を解除してから消そう' },
      { x: 58, text: '「セル」タブの「列の削除」: 穴の列を消すと、左に詰まって穴がせまくなる' },
    ],
    build(m) {
      m.floor(); m.ceil(4);
      m.rect(18, 4, 18, 9, '#'); m.lockRect(18, 4, 18, 9);
      m.pit(28, 33); m.rect(33, 5, 33, 10, '#');
      m.rect(46, 4, 46, 9, '#');
      m.pit(62, 66);
      m.ent('walker', 24, 9); m.ent('walker', 38, 9); m.ent('guard', 54, 9); m.ent('turret', 76, 9);
      m.gem(30, 8); m.gem(46, 3); m.gem(64, 8);
      m.set(46, 3, '.');
      m.spark(10, 9); m.spark(22, 9); m.spark(40, 9); m.spark(58, 9);
      m.check(24, 9); m.check(42, 9); m.check(58, 9);
      m.flag = [88, 9];
    },
    solution: [
      { x: 14, edits: [{ tool: 'unprotect', rect: { x0: 18, y0: 4, x1: 18, y1: 9 } }, { tool: 'clear', rect: { x0: 18, y0: 4, x1: 18, y1: 9 } }] },
      { x: 25, edits: [{ tool: 'transform', rect: { x0: 28, y0: 5, x1: 33, y1: 10 }, opts: { tf: 'rot' } }] },
      { x: 42, edits: [{ tool: 'hide', rect: { x0: 46, y0: 5, x1: 46, y1: 5 }, opts: { axis: 'col' } }] },
      { x: 59, edits: [{ tool: 'delCol', col: 63 }, { tool: 'delCol', col: 63 }] },
    ],
  }));

  // ---- ワールド5: 応用（置換・入れ替え・並べ替え） ----
  const T5 = ['move', 'swap', 'clear', 'color', 'painter', 'transform', 'sort', 'replace', 'hide', 'filter'];
  L.push(make({
    id: '5-1', name: '赤い床を置換', world: 5, w: 64, tools: ['replace', 'color', 'hide'], energy: 8, bg: '#F2B6B0', bg2: '#E8A29B', par: 6,
    hints: [
      { x: 6, text: '「データ」タブの「置換」: 範囲の「から」の色を「へ」の色に、まとめて置き換える' },
      { x: 18, text: '赤い床は、さわると即ミス（天井が低くて、とびこせない）。赤を茶に置換しよう（「から」＝赤、「へ」＝茶）' },
    ],
    build(m) {
      m.floor(); m.ceil(4);
      m.pit(28, 37); m.rect(28, 11, 37, 11, 'S');
      for (let x = 28; x <= 37; x++) m.blk(x, 10, 1);
      m.rect(28, 4, 37, 8, 'S'); m.gem(32, 9); m.gem(52, 8); m.gem(44, 9);
      m.ent('walker', 20, 9); m.ent('walker', 52, 9);
      m.spark(14, 9); m.spark(24, 9); m.spark(50, 9);
      m.check(24, 9);
      m.flag = [58, 9];
    },
    solution: [{ x: 24, edits: [{ tool: 'replace', rect: { x0: 28, y0: 10, x1: 37, y1: 10 }, opts: { from: 1, to: 0 } }] }],
  }));

  L.push(make({
    id: '5-2', name: '入れ替え', world: 5, w: 66, tools: ['swap', 'move', 'clear'], energy: 10, bg: '#F2B6B0', bg2: '#E8A29B', par: 8,
    hints: [
      { x: 4, text: '「ホーム」タブの「入れ替え」: 2つの範囲のブロックを、そっくり交換する' },
      { x: 12, text: '上の棚の茶ブロックと、むこうの赤い床を、入れ替えよう（①棚をドラッグ → ②床の左端をタップ）' },
    ],
    build(m) {
      m.floor(); m.ceil(4);
      m.rect(24, 7, 28, 7, 'S');
      for (let x = 24; x <= 28; x++) m.blk(x, 6, 0);
      m.pit(31, 35); m.rect(31, 11, 35, 11, 'S');
      for (let x = 31; x <= 35; x++) m.blk(x, 10, 1);
      m.rect(31, 4, 35, 8, 'S'); m.gem(33, 9); m.gem(50, 8); m.gem(18, 8);
      m.ent('walker', 14, 9); m.ent('walker', 44, 9);
      m.spark(14, 9);
      m.check(21, 9);
      m.flag = [60, 9];
    },
    solution: [{ x: 20, edits: [{ tool: 'swap', rect: { x0: 24, y0: 6, x1: 28, y1: 6 }, dst: [31, 10] }] }],
  }));

  L.push(make({
    id: '5-3', name: '重力で並べ替え', world: 5, w: 70, tools: ['sort', 'hide', 'move', 'clear'], energy: 18, bg: '#F2B6B0', bg2: '#E8A29B', par: 10,
    hints: [
      { x: 5, text: '「データ」タブの「並べ替え」: 範囲のブロックを、一方向に寄せる。「寄せ↓」は、重力で落とすイメージ' },
      { x: 12, text: '穴の上に浮かぶブロックを、まとめて「寄せ↓」で落として、橋にしよう' },
      { x: 42, text: '壁は、その列を隠して通りぬけよう' },
    ],
    build(m) {
      m.floor(); m.ceil(3); m.pit(22, 29);
      [0, 2, 3, 0, 2, 3, 0, 2].forEach((c, i) => m.blk(22 + i, 4 + (i % 3), c));
      m.rect(46, 3, 46, 9, '#');
      m.gem(26, 8); m.gem(56, 8); m.gem(36, 5); m.set(36, 6, '#');
      m.ent('walker', 38, 9); m.ent('guard', 52, 9); m.ent('flyer', 60, 6);
      m.spark(14, 9); m.spark(34, 9); m.spark(42, 9);
      m.check(34, 9);
      m.flag = [65, 9];
    },
    solution: [
      { x: 18, edits: [{ tool: 'sort', rect: { x0: 22, y0: 4, x1: 29, y1: 10 }, opts: { sort: 'D' } }] },
      { x: 42, edits: [{ tool: 'hide', rect: { x0: 46, y0: 4, x1: 46, y1: 4 }, opts: { axis: 'col' } }] },
    ],
  }));

  // ---- ワールド6: 書式・反転・列の削除 ----
  L.push(make({
    id: '6-1', name: '書式をコピー', world: 6, w: 60, tools: ['painter', 'hide'], energy: 4, bg: '#E3D18F', bg2: '#D8C47C', par: 2,
    hints: [
      { x: 4, text: '「ホーム」タブの「書式のコピー」: まねしたいブロックを①タップ → ②色をぬる範囲をドラッグ' },
      { x: 16, text: '空に浮かぶ緑のブロックの色を、天井の穴の下の床にコピーしよう（はずむ床になる）' },
      { x: 27, text: '上に出たら、いちばん高いところで C（ダッシュ）で前へ！' },
    ],
    build(m) {
      m.floor(); m.ceil(4);
      m.rect(24, 6, 59, 6, 'S'); m.rect(29, 6, 32, 6, '.');
      m.rect(56, 7, 59, 9, 'S');
      m.blk(30, 10, 0); m.blk(31, 10, 0);
      m.blk(22, 6, 3); m.blk(14, 6, 3);
      m.gem(31, 8); m.gem(40, 5); m.gem(48, 5);
      m.ent('walker', 20, 9); m.ent('walker', 46, 5);
      m.check(26, 9);
      m.flag = [55, 5];
    },
    solution: [{ x: 24, edits: [{ tool: 'painter', srcCell: [22, 6], rect: { x0: 30, y0: 10, x1: 31, y1: 10 } }] }],
  }));

  L.push(make({
    id: '6-2', name: '左右反転', world: 6, w: 56, tools: ['transform', 'move'], energy: 10, bg: '#E3D18F', bg2: '#D8C47C', par: 8,
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
    id: '6-3', name: '穴をつめる', world: 6, w: 60, tools: ['delCol', 'insCol', 'move'], energy: 24, bg: '#E3D18F', bg2: '#D8C47C', par: 20,
    hints: [
      { x: 4, text: '「セル」タブの「列の削除」: 列をタップすると、その列が消えて左につまる' },
      { x: 14, text: '広い穴の中の列を2つ消して、穴をせまくしよう。ジャンプ＋ダッシュでこえられる' },
    ],
    build(m) {
      m.floor(); m.ceil(4); m.pit(28, 34);
      m.gem(31, 8); m.gem(44, 8); m.gem(20, 9);
      m.ent('walker', 14, 9); m.ent('walker', 42, 9);
      m.check(24, 9);
      m.flag = [54, 9];
    },
    solution: [{ x: 24, edits: [{ tool: 'delCol', col: 30 }, { tool: 'delCol', col: 30 }] }],
  }));

  // ---- 実験シート: すべての道具を、好きに試す場所 ----
  L.push(make({
    id: 'LAB', name: '実験シート（全機能）', world: 5, w: 64, regen: 10, energy: 100, bg: '#B7C6D9', bg2: '#A6B6CC',
    tools: ['move', 'swap', 'clear', 'color', 'painter', 'transform', 'insCol', 'delCol', 'sort', 'filter', 'replace', 'hide', 'unhide', 'protect', 'unprotect'],
    hints: [
      { x: 1, text: '実験シート: すべての道具が使える（エナジーは早く回復）。気になる機能を、ためしてみよう' },
      { x: 12, text: '色のちがうブロックの列。「並べ替え」「置換」「塗りつぶし」「書式のコピー」を試そう' },
      { x: 24, text: '赤い鍵は保護。解除してから動かせる' },
      { x: 34, text: '穴の列を「削除」「挿入」して、広さを変えてみよう' },
      { x: 46, text: '壁は「非表示」「フィルター」「消去」のどれでも通れる' },
    ],
    build(m) {
      m.floor(); m.ceil(2);
      // A: 色のちがう列と段(並べ替え・置換・書式のコピー)
      [4, 2, 3, 4, 0, 3, 4, 2, 0].forEach((c, i) => m.blk(6 + i, 8, c));
      [2, 4, 1, 3].forEach((c, i) => m.blk(8 + i, 7, c));
      // B: 4×4の模様(変形・入れ替え)
      const pat = ['.1.3', '2..0', '.4.1', '30.2'];
      pat.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') m.blk(18 + i, 4 + j, +ch); }));
      // C: 保護されたブロック
      m.blk(26, 8, 0, true); m.blk(27, 8, 3, true); m.blk(28, 8, 0, true);
      // D: 穴(列の削除・挿入)
      m.pit(36, 40);
      // E: 壁(非表示・フィルター・消去)
      m.rect(46, 3, 47, 9, '#'); m.paint(46, 3, 46, 5, 0); m.paint(47, 6, 47, 9, 2);
      m.ent('walker', 14, 9); m.ent('guard', 30, 9); m.ent('walker', 52, 9); m.ent('flyer', 22, 6);
      m.spark(10, 9); m.spark(20, 9); m.spark(32, 9); m.spark(44, 9); m.spark(54, 9);
      m.flag = [60, 9];
    },
    solution: [{ x: 42, edits: [{ tool: 'hide', rect: { x0: 46, y0: 4, x1: 47, y1: 4 }, opts: { axis: 'col' } }] }],
  }));

  window.LEVELS = L;
})();
