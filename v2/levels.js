/* ゲコ＆エナー v2 — ステージ定義。せかいは「ひょうのシート」: ブロックは、いろつきのセル。
   マスの記号: . あき / # いし(なおせる) / S はがね(なおせない) / c ひびわれ(のるとくずれる)
   いろ: 0 ちゃいろ(ふつう) 1 あか(あつい) 2 あお(こおり) 3 みどり(ばね) 4 ひびわれ(もろい。ひびわれブロックと おなじ)。座標は「マス」(x, y)。
   なにもないところにブロックは生まれない。あるブロックを、うごかす・ならべる・ぬる・隠す・けす。 */
(function () {
  'use strict';
  function make(def) {
    const w = def.w, h = def.h || 12;
    const front = [], color = [], lock = [];
    for (let y = 0; y < h; y++) { front.push(new Array(w).fill('.')); color.push(new Array(w).fill(0)); lock.push(new Array(w).fill(0)); }
    const m = {
      ents: [], gems: [], sparks: [], checks: [], lifts: [], switches: [], doors: [], judges: [], start: [2, h - 3], flag: [w - 4, h - 3],
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
      lift(x, y, w, dx, dy, period, phase, col, ctl) { const o = { x, y, w, dx, dy, period: period || 7, phase: phase || 0, col: col || 0 }; if (ctl !== undefined && ctl !== null) o.ctl = ctl; m.lifts.push(o); },
      judge(x, y, type, color, id) { m.judges.push([x, y, type, color || 0, id || 0]); },
      sw(x, y, id) { m.switches.push([x, y, id || 0]); },
      door(x, y, h, id) { m.doors.push([x, y, h, id || 0]); },
      spark(x, y) { m.sparks.push([x, y]); },
      check(x, y) { m.checks.push([x, y]); },
    };
    def.build(m);
    return {
      id: def.id, name: def.name, world: def.world, w, h, tools: def.tools || [], energy: def.energy !== undefined ? def.energy : 60, regen: def.regen,
      front: front.map(r => r.join('')), color, lock,
      ents: m.ents, lifts: m.lifts, switches: m.switches, doors: m.doors, judges: m.judges, gems: m.gems, sparks: m.sparks, checks: m.checks, start: m.start, flag: m.flag,
      hints: def.hints || [], solution: def.solution || [], bg: def.bg, bg2: def.bg2, par: def.par || 0,
      scene: def.scene, sheet: def.sheet, windows: def.windows, fog: def.fog,
    };
  }

  const L = [];

  // ---- ワールド1: よせる ----
  L.push(make({
    id: '1-1', name: 'はじめの一歩', world: 1, w: 20, tools: [], energy: 0, bg: '#42B8C2', bg2: '#3AA7B1',
    hints: [
      { x: 1, text: '◀ ▶ で移動。「はばたき」でジャンプ。長押しで高く跳べる' },
      { x: 6, text: '空中で長押しすると、ふわり。足場をのぼって、右上の旗をめざそう' },
      { x: 12, text: 'データのかけらは 2つ。ひとつは、少ない足場で ジャンプして とりにいこう' },
    ],
    build(m) {
      // 横20×縦12。左下スタート、右上ゴール。敵なし。はばたき(ジャンプ+ふわり)だけで クリアできる
      m.floor();
      m.rect(3, 8, 5, 8, '#');      // A
      m.rect(7, 6, 9, 6, '#');      // B
      m.rect(10, 4, 12, 4, '#');    // C
      m.rect(14, 2, 16, 2, '#');    // G(ゴールの足場)
      m.gem(8, 5);                  // かんたん: Bの上を歩くだけ
      m.set(14, 8, '#'); m.set(17, 6, '#'); m.gem(18, 4); // むずかしい: ひとつずつの足場から ジャンプ
      m.start = [2, 9];
      m.flag = [15, 1];
    },
  }));

  L.push(make({
    id: '1-2', name: '下に寄せる', world: 1, w: 56, tools: ['sort'], energy: 12, bg: '#42B8C2', bg2: '#3AA7B1', par: 10,
    hints: [
      { x: 1, text: '「なおす」で時間が止まる。この世界では、ブロックがシートのセルになっている' },
      { x: 8, text: '「データ」→「ならべかえ」で範囲内のブロックを一方向に寄せる。失敗しても「元に戻す」でエナジーが返る' },
      { x: 14, text: '浮いているブロックを範囲で選び、「よせ↓」で橋にしよう。広く選べば右のブロックもまとめて動かせる' },
    ],
    build(m) {
      m.floor(); m.ceil(3); m.pit(22, 29);
      [4, 5, 6, 4, 5, 6, 4, 5].forEach((y, i) => m.blk(22 + i, y, 0));
      [5].forEach(y => m.blk(31, y, 0)); [3, 6].forEach(y => m.blk(32, y, 0)); [4, 5, 7].forEach(y => m.blk(33, y, 0)); [3, 4, 6, 8].forEach(y => m.blk(34, y, 0)); // 空にういた、ばらばらのブロック(おとすと、かいだんになる)
      m.gem(26, 8); m.gem(40, 8); m.gem(34, 5);
      // (セルくんは、いない。うごくてきがいると、おとしたブロックがひっかかるため)
      m.check(36, 9);
      m.flag = [52, 9];
    },
    solution: [{ x: 18, edits: [{ tool: 'sort', rect: { x0: 22, y0: 3, x1: 34, y1: 10 }, opts: { sort: 'D' } }] }],
  }));

  L.push(make({
    id: '1-3', name: 'ふわりと越える', world: 1, w: 66, tools: [], energy: 0, bg: '#42B8C2', bg2: '#3AA7B1',
    hints: [
      { x: 8, text: '広い穴は、ジャンプ後にボタンを長押し。しばらくゆっくり落ちる「ふわり」が使える' },
      { x: 28, text: '「ふわり」は着地するとまた使える' },
      { x: 48, text: '赤いブロックは触れるとダメージ。ジャンプで越えよう。無傷ならノーミス！' },
    ],
    build(m) {
      m.floor(); m.pit(18, 22); m.pit(36, 40);
      m.blk(52, 9, 1);
      m.gem(20, 8); m.gem(38, 8); m.gem(56, 8);
      m.spark(12, 9); m.spark(30, 9); m.spark(46, 9);
      m.check(30, 9);
      m.flag = [62, 9];
    },
  }));

  // ---- ワールド2: フィルター ----
  L.push(make({
    id: '2-1', name: 'フィルター', world: 2, w: 62, tools: ['filter'], energy: 8, bg: '#F3C9A0', bg2: '#E9B88A', par: 8,
    hints: [
      { x: 6, text: '「データ」→「フィルター」で選んだ色だけ残し、ほかを通り抜けられる' },
      { x: 20, text: '青だけ残せば、茶色の壁を通れて青い足場は残る' },
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
    id: '2-2', name: '寄せてからフィルター', world: 2, w: 62, tools: ['sort', 'filter'], energy: 20, bg: '#F3C9A0', bg2: '#E9B88A', par: 18,
    hints: [
      { x: 4, text: '青いブロックを「よせ↓」で橋にしてから、フィルターで青だけ残そう' },
      { x: 30, text: '茶色の壁はフィルターで通ろう。青い橋は残る' },
    ],
    build(m) {
      m.floor(); m.ceil(3); m.pit(20, 27);
      [4, 5, 6, 4, 5, 6, 4, 5].forEach((y, i) => m.blk(20 + i, y, 2));
      m.rect(38, 3, 39, 9, '#');
      m.gem(24, 8); m.gem(46, 8);
      m.ent('walker', 46, 9);
      m.check(32, 9);
      m.gem(34, 8);
      m.flag = [56, 9];
    },
    solution: [
      { x: 16, edits: [{ tool: 'sort', rect: { x0: 20, y0: 4, x1: 27, y1: 10 }, opts: { sort: 'D' } }] },
      { x: 30, edits: [{ tool: 'filter', fcolor: 2 }] },
    ],
  }));

  // ---- ワールド3: ガラスといろコピー ----
  L.push(make({
    id: '3-1', name: 'ガラスに色をつける', world: 3, w: 60, tools: ['painter'], energy: 4, bg: '#C7B9EE', bg2: '#B8A8E6', par: 2,
    hints: [
      { x: 4, text: '透明なガラスは性質を持たない。「いろコピー」で色と性質をつけられる' },
      { x: 16, text: '①浮いている緑のブロックをタップ ②天井の穴の下にあるガラス床をドラッグ。跳ねる床になる' },
      { x: 27, text: '上に出たら、ジャンプを長押しして「ふわり」で前へ！' },
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
      { x: 1, text: '茶色の壁を通るにはフィルターが必要。でも色のないガラスの橋も消えてしまう' },
      { x: 4, text: '①ガラスを「よせ↓」で橋にする ②青の色を「いろコピー」する ③フィルターで青だけ残す' },
    ],
    build(m) {
      m.floor(); m.ceil(3); m.pit(26, 33);
      [4, 5, 6, 4, 5, 6, 4, 5].forEach((y, i) => m.blk(26 + i, y, 5));
      m.blk(6, 6, 2);
      m.rect(14, 3, 15, 9, '#');
      m.gem(30, 8); m.gem(48, 8);
      m.ent('walker', 22, 9); m.ent('walker', 50, 9);
      m.check(20, 9);
      m.gem(20, 8);
      m.flag = [60, 9];
    },
    solution: [
      { x: 8, edits: [{ tool: 'sort', rect: { x0: 26, y0: 4, x1: 33, y1: 10 }, opts: { sort: 'D' } }, { tool: 'painter', srcCell: [6, 6], rect: { x0: 26, y0: 10, x1: 33, y1: 10 } }, { tool: 'filter', fcolor: 2 }] },
    ],
  }));

  // ---- ワールド4: かたち ----
  L.push(make({
    id: '4-1', name: '左右反転', world: 4, w: 56, tools: ['transform'], energy: 10, bg: '#9ADBC0', bg2: '#86CEB0', par: 8,
    hints: [
      { x: 4, text: '「セル」→「かたち」→「左右反転」で、選んだ範囲を左右反転する' },
      { x: 12, text: '左が高い階段は登れない。2つの階段をまとめて選び、左右反転しよう' },
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
      { x: 6, text: '向こう岸の青い塔を、穴も含めて正方形に選び、「かたち」→「90°回転」で橋にしよう' },
      { x: 34, text: '茶色の壁はフィルターで通り抜けよう' },
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

  // ---- ワールド5: まもり ----
  L.push(make({
    id: '5-1', name: '守って残す', world: 5, w: 62, tools: ['protect', 'filter'], energy: 14, bg: '#F2B6B0', bg2: '#E8A29B', par: 12,
    hints: [
      { x: 1, text: '茶色の壁をフィルターで通りたい。でも、穴の足場も茶色なので消えてしまう' },
      { x: 4, text: '「表示」→「シートをまもる」で足場を保護しよう。保護したブロックはフィルターでも消えない。その後、青だけ残す' },
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
    id: '5-2', name: '保護を外して寄せる', world: 5, w: 60, tools: ['sort', 'unprotect'], energy: 18, bg: '#F2B6B0', bg2: '#E8A29B', par: 16,
    hints: [
      { x: 4, text: '保護ブロック（カギ）は「よせる」の仕切りになり、上のブロックはそこで止まる' },
      { x: 12, text: '先に「まもりをはずす」を使い、まとめて「よせ↓」。順番を間違えるとコスト不足になる' },
    ],
    build(m) {
      m.floor(); m.ceil(3); m.pit(22, 29);
      [4, 5, 6, 4, 5, 6, 4, 5].forEach((y, i) => m.blk(22 + i, y, 0));
      for (let x = 22; x <= 28; x++) m.blk(x, 7, 0, true);
      m.gem(26, 8); m.gem(46, 8);
      m.ent('walker', 44, 9);
      m.check(34, 9);
      m.gem(36, 8);
      m.flag = [54, 9];
    },
    solution: [{ x: 18, edits: [{ tool: 'unprotect', rect: { x0: 22, y0: 7, x1: 28, y1: 7 } }, { tool: 'sort', rect: { x0: 22, y0: 4, x1: 29, y1: 10 }, opts: { sort: 'D' } }] }],
  }));

  L.push(make({
    id: '5-3', name: '寄せてから左右反転', world: 5, w: 62, tools: ['sort', 'transform'], energy: 20, bg: '#F2B6B0', bg2: '#E8A29B', par: 18,
    hints: [
      { x: 4, text: '散らばったブロックを「←よせ」で階段状にそろえよう' },
      { x: 12, text: '次に「かたち」→「左右反転」。階段を登れる向きに変えよう' },
    ],
    build(m) {
      m.floor(); m.ceil(1);
      [[9, [0, 2, 3, 5]], [8, [1, 4, 5]], [7, [2, 5]], [6, [1]]].forEach(([y, xs]) => xs.forEach(x => m.blk(16 + x, y, 0)));
      m.rect(22, 6, 50, 9, 'S');
      m.gem(40, 5); m.gem(12, 9);
      m.ent('walker', 10, 9);
      m.check(14, 9);
      m.gem(30, 5);
      m.flag = [46, 5];
    },
    solution: [{ x: 11, edits: [{ tool: 'sort', rect: { x0: 16, y0: 6, x1: 21, y1: 9 }, opts: { sort: 'L' } }, { tool: 'transform', rect: { x0: 16, y0: 6, x1: 21, y1: 9 }, opts: { tf: 'flipH' } }] }],
  }));

  // ---- ワールド6: うえへ（たてながのステージ） ----
  L.push(make({
    id: '6-1', name: 'バネの縦穴', world: 6, w: 24, h: 30, tools: ['painter'], energy: 8, bg: '#8FA6E8', bg2: '#7E95DB', par: 7,
    hints: [
      { x: 0, text: '縦穴を登ろう。普通のジャンプでは天井に届かない' },
      { x: 8, text: '浮いている緑の色を、足元のガラスに「いろコピー」。跳ねて天井の穴を抜けよう。次の足場も同じように' },
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
    id: '6-2', name: '登りの塔', world: 6, w: 26, h: 30, tools: [], energy: 0, bg: '#8FA6E8', bg2: '#7E95DB',
    hints: [{ x: 0, text: '足場をジグザグに登ろう。落ちても一段下からやり直せる' }],
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

  // ---- ワールド7: リフト ----
  L.push(make({
    id: '7-1', name: 'リフトに乗る', world: 7, w: 60, tools: [], energy: 0, bg: '#E3D18F', bg2: '#D8C47C',
    hints: [
      { x: 6, text: '薄く見える線はリフトの通り道。リフトは決まった道を往復する' },
      { x: 14, text: '広い穴はジャンプだけでは越えられない。リフトに乗って向こう岸へ' },
    ],
    build(m) {
      m.floor(); m.ceil(3); m.pit(22, 33);
      m.lift(22, 10, 3, 9, 0, 8, 0);
      m.gem(28, 8); m.gem(46, 8);
      m.ent('walker', 42, 9);
      m.check(16, 9);
      m.gem(36, 8);
      m.flag = [54, 9];
    },
    solution: [],
  }));

  L.push(make({
    id: '7-2', name: 'リフトで高い所へ', world: 7, w: 60, tools: ['filter'], energy: 8, bg: '#E3D18F', bg2: '#D8C47C', par: 8,
    hints: [
      { x: 6, text: '上下に動くリフトで高い足場へ。上がったら、茶色の壁をフィルターで通り抜けよう' },
      { x: 12, text: 'リフトの通り道にはブロックを動かせない。寄せる・回転・反転でも同じ' },
    ],
    build(m) {
      m.floor(); m.ceil(1);
      m.rect(27, 5, 52, 9, 'S'); m.pit(24, 26);
      m.lift(24, 10, 3, 0, -5, 8, 0);
      m.rect(36, 1, 37, 4, '#');
      m.blk(30, 4, 2); m.gem(31, 3); m.gem(46, 3);
      m.ent('walker', 44, 4);
      m.gem(42, 4);
      m.flag = [56, 9];
    },
    solution: [],
  }));

  L.push(make({
    id: '7-3', name: 'ガラスのリフト', world: 7, w: 62, tools: ['painter'], energy: 4, bg: '#E3D18F', bg2: '#D8C47C', par: 2,
    hints: [
      { x: 4, text: 'このリフトは色のないガラス。「いろコピー」で色と性質をつけられる' },
      { x: 10, text: '高い壁を越えるには、緑の色をガラスのリフトにコピーして、跳ねるリフトにしよう' },
    ],
    build(m) {
      m.floor(); m.ceil(1); m.pit(22, 31);
      m.lift(22, 10, 3, 7, 0, 8, 0, 5);
      m.rect(32, 5, 52, 9, 'S');
      m.blk(14, 6, 3);
      m.gem(26, 8); m.gem(40, 4);
      m.check(16, 9);
      m.gem(36, 4);
      m.flag = [46, 4];
    },
    solution: [],
  }));

  L.push(make({
    id: '7-4', name: 'リフトとフィルター', world: 7, w: 66, tools: ['filter'], energy: 8, bg: '#E3D18F', bg2: '#D8C47C', par: 8,
    hints: [
      { x: 4, text: 'フィルターはリフトにも効く。残す色以外のリフトは薄くなり、通り抜けられる' },
      { x: 8, text: '青い壁を通り、茶色のリフトは残したい。赤いリフトは危険。どの色を残す？' },
    ],
    build(m) {
      m.floor(); m.ceil(3); m.pit(22, 33);
      m.rect(14, 3, 15, 9, '#'); m.paint(14, 3, 15, 9, 2);
      m.lift(22, 10, 3, 9, 0, 8, 0, 0);
      m.lift(44, 4, 3, 0, 5, 6, 0.5, 1);
      m.gem(28, 8); m.gem(52, 8);
      m.check(18, 9);
      m.gem(38, 8);
      m.flag = [60, 9];
    },
    solution: [],
  }));

  L.push(make({
    id: '7-5', name: '滑るリフト', world: 7, w: 60, tools: [], energy: 0, bg: '#E3D18F', bg2: '#D8C47C',
    hints: [
      { x: 6, text: '青いリフトは滑りやすい。乗ったら反対方向に少し動いて止まろう' },
      { x: 14, text: '滑って落ちないよう、リフトの中央を保とう' },
    ],
    build(m) {
      m.floor(); m.ceil(3); m.pit(22, 33);
      m.lift(22, 10, 2, 10, 0, 8, 0, 2);
      m.gem(28, 8); m.gem(46, 8);
      m.ent('walker', 44, 9);
      m.check(16, 9);
      m.gem(38, 8);
      m.flag = [54, 9];
    },
    solution: [],
  }));

  L.push(make({
    id: '7-6', name: 'リフトを緑にしてフィルター', world: 7, w: 66, tools: ['painter', 'filter'], energy: 10, bg: '#E3D18F', bg2: '#D8C47C', par: 10,
    hints: [
      { x: 2, text: '茶色の壁を通り、跳ねるリフトで高台へ。高台には赤いリフトもある' },
      { x: 5, text: '①緑の色をガラスのリフトに「いろコピー」 ②フィルターで緑だけ残す。壁と赤いリフトを通り抜けられる' },
    ],
    build(m) {
      m.floor(); m.ceil(1); m.pit(22, 31);
      m.rect(14, 1, 15, 9, '#');
      m.lift(22, 10, 3, 7, 0, 8, 0, 5);
      m.rect(32, 5, 56, 9, 'S');
      m.blk(6, 6, 3);
      m.lift(44, 1, 3, 0, 3, 5, 0, 1);
      m.gem(26, 8); m.gem(38, 4);
      m.gem(48, 4);
      m.flag = [52, 4];
    },
    solution: [],
  }));

  // ---- ワールド8: じしゃく ----
  L.push(make({
    id: '8-1', name: '磁石と判定セル', world: 8, w: 60, tools: ['sort'], energy: 10, bg: '#D6C3A5', bg2: '#C9B392', par: 10,
    hints: [
      { x: 1, text: '赤と青の磁石ブロックは、一番近い鋼に引き寄せられる' },
      { x: 5, text: '扉の向こうに判定セル（三角マーク）がある。磁石を動かして反応させよう' },
      { x: 8, text: '磁石の真下にブロックがあると動かない。「←よせ」でどかしてみよう' },
    ],
    build(m) {
      m.floor();
      m.door(12, 0, 10, 0);
      m.blk(16, 8, 2); m.set(16, 7, 'M'); m.judge(16, 9, 'exist', 0, 0);
      m.gem(5, 8); m.gem(9, 7); m.gem(26, 8);
      m.check(30, 9);
      m.flag = [52, 9];
    },
    solution: [{ x: 8, edits: [{ tool: 'sort', rect: { x0: 14, y0: 8, x1: 16, y1: 8 }, opts: { sort: 'L' } }] }],
  }));

  L.push(make({
    id: '8-2', name: '2つの扉', world: 8, w: 60, tools: ['sort', 'unprotect'], energy: 26, bg: '#D6C3A5', bg2: '#C9B392', par: 26,
    hints: [
      { x: 1, text: 'まず1つ目の扉を開こう' },
      { x: 28, text: '2つ目の磁石の下には保護ブロックがある。先に「まもりをはずす」' },
    ],
    build(m) {
      m.floor();
      m.door(12, 0, 10, 0); m.blk(16, 8, 2); m.set(16, 7, 'M'); m.judge(16, 9, 'exist', 0, 0);
      m.door(34, 0, 10, 1); m.blk(38, 8, 0, true); m.set(38, 7, 'M'); m.judge(38, 9, 'exist', 0, 1);
      m.gem(5, 8); m.gem(9, 7); m.gem(26, 8);
      m.check(28, 9);
      m.flag = [52, 9];
    },
    solution: [
      { x: 8, edits: [{ tool: 'sort', rect: { x0: 14, y0: 8, x1: 16, y1: 8 }, opts: { sort: 'L' } }] },
      { x: 30, edits: [{ tool: 'unprotect', rect: { x0: 38, y0: 8, x1: 38, y1: 8 } }, { tool: 'sort', rect: { x0: 36, y0: 8, x1: 38, y1: 8 }, opts: { sort: 'L' } }] },
    ],
  }));

  L.push(make({
    id: '8-3', name: '横向きの磁石', world: 8, w: 58, tools: ['sort', 'filter'], energy: 18, bg: '#D6C3A5', bg2: '#C9B392', par: 18,
    hints: [
      { x: 1, text: '磁石は横にも動く。横の鋼がより近ければ、そちらへ引き寄せられる' },
      { x: 14, text: '上の磁石の横にあるブロックを「↑よせ」でどかそう。磁石が動き、判定セルがONになる' },
      { x: 36, text: '扉の先の壁はフィルターで通り抜けよう' },
    ],
    build(m) {
      m.floor();
      m.set(27, 6, 'S'); m.set(24, 6, 'M'); m.blk(25, 6, 0); m.blk(24, 7, 0); m.judge(26, 6, 'exist', 0, 0);
      m.door(36, 0, 10, 0);
      for (let y = 0; y <= 9; y++) m.blk(44, y, 0);
      m.gem(5, 8); m.gem(10, 7); m.gem(20, 8);
      m.check(30, 9);
      m.flag = [52, 9];
    },
    solution: [
      { x: 16, edits: [{ tool: 'sort', rect: { x0: 25, y0: 3, x1: 25, y1: 6 }, opts: { sort: 'U' } }] },
      { x: 38, edits: [{ tool: 'filter', fcolor: 2 }] },
    ],
  }));

  // ---- ワールド9: くみあわせ(ふたつ いじょうの どうぐを つかう) ----
  L.push(make({
    id: '9-1', name: '倒して落として橋に', world: 9, w: 56, tools: ['transform', 'sort'], energy: 18, bg: '#B9D9C0', bg2: '#A8CBB0', par: 18,
    hints: [
      { x: 1, text: '広い穴に、ブロックの塔を倒して橋を作ろう' },
      { x: 8, text: '「かたち」→「90°回転」で倒すと、まだ高い位置に浮いている' },
      { x: 12, text: '「よせ↓」でブロックを穴に落とそう。四角く範囲を選ぶ' },
    ],
    build(m) {
      m.floor(); m.pit(22, 27);
      for (let y = 3; y <= 9; y++) m.blk(20, y, 0);
      m.gem(6, 8); m.gem(15, 8); m.gem(34, 8);
      m.check(30, 9);
      m.flag = [52, 9];
    },
    solution: [{ x: 14, edits: [{ tool: 'transform', rect: { x0: 20, y0: 3, x1: 26, y1: 9 }, opts: { tf: 'rot' } }, { tool: 'sort', rect: { x0: 20, y0: 3, x1: 26, y1: 10 }, opts: { sort: 'D' } }] }],
  }));

  L.push(make({
    id: '9-2', name: '反転して通り抜ける', world: 9, w: 36, tools: ['transform', 'filter'], energy: 16, bg: '#B9D9C0', bg2: '#A8CBB0', par: 16,
    hints: [
      { x: 1, text: '左が高い階段は登れない。まず「左右反転」しよう' },
      { x: 17, text: '棚の壁はフィルターで通れるが、階段も消える。登ってから使おう' },
    ],
    build(m) {
      m.floor(); m.ceil(3);
      [[14, 6], [15, 7], [16, 8], [17, 9]].forEach(([x, y0]) => { for (let y = y0; y <= 9; y++) m.blk(x, y, 0); });
      m.rect(18, 6, 34, 6, 'S');
      for (let y = 3; y <= 5; y++) m.blk(26, y, 0);
      m.gem(11, 8); m.gem(16, 6); m.gem(22, 4);
      m.flag = [31, 5];
    },
    solution: [
      { x: 8, edits: [{ tool: 'transform', rect: { x0: 14, y0: 6, x1: 17, y1: 9 }, opts: { tf: 'flipH' } }] },
      { x: 19, edits: [{ tool: 'filter', fcolor: 2 }] },
    ],
  }));

  L.push(make({
    id: '9-3', name: '作って守って通る', world: 9, w: 48, tools: ['sort', 'protect', 'filter'], energy: 22, bg: '#B9D9C0', bg2: '#A8CBB0', par: 22,
    hints: [
      { x: 1, text: '浮いているブロックを「よせ↓」で穴に落とし、橋を作ろう' },
      { x: 8, text: '壁はフィルターで通れる。でも橋も同じ色…' },
      { x: 10, text: '橋を「シートをまもる」で保護すると、フィルターでも消えない' },
    ],
    build(m) {
      m.floor(); m.ceil(3); m.pit(14, 19);
      [4, 5, 6, 4, 5, 6].forEach((y, i) => m.blk(14 + i, y, 0));
      for (let y = 3; y <= 9; y++) m.blk(28, y, 0);
      m.gem(6, 8); m.gem(24, 8); m.gem(36, 8);
      m.check(24, 9);
      m.flag = [44, 9];
    },
    solution: [{ x: 8, edits: [{ tool: 'sort', rect: { x0: 14, y0: 3, x1: 19, y1: 10 }, opts: { sort: 'D' } }, { tool: 'protect', rect: { x0: 14, y0: 10, x1: 19, y1: 10 } }, { tool: 'filter', fcolor: 2 }] }],
  }));

  L.push(make({
    id: '9-4', name: '保護を外して反転', world: 9, w: 34, tools: ['unprotect', 'transform', 'filter'], energy: 22, bg: '#B9D9C0', bg2: '#A8CBB0', par: 22,
    hints: [
      { x: 1, text: '左が高い階段に、1つだけ保護ブロックがある' },
      { x: 6, text: '保護ブロックは反転できない。「まもりをはずす」→「左右反転」' },
      { x: 15, text: '棚の壁は登った後にフィルターで通ろう' },
    ],
    build(m) {
      m.floor(); m.ceil(3);
      [[12, 6], [13, 7], [14, 8], [15, 9]].forEach(([x, y0]) => { for (let y = y0; y <= 9; y++) m.blk(x, y, 0, x === 14 && y === 9); });
      m.rect(16, 6, 32, 6, 'S');
      for (let y = 3; y <= 5; y++) m.blk(24, y, 0);
      m.gem(8, 8); m.gem(14, 6); m.gem(20, 4);
      m.flag = [29, 5];
    },
    solution: [
      { x: 6, edits: [{ tool: 'unprotect', rect: { x0: 14, y0: 9, x1: 14, y1: 9 } }, { tool: 'transform', rect: { x0: 12, y0: 6, x1: 15, y1: 9 }, opts: { tf: 'flipH' } }] },
      { x: 17, edits: [{ tool: 'filter', fcolor: 2 }] },
    ],
  }));

  // ---- ワールド10: はんていセル(ブロックのじょうたいで、とびらがひらく) ----
  L.push(make({
    id: '10-1', name: '存在セル', world: 10, w: 50, tools: ['sort'], energy: 10, bg: '#E6D3A3', bg2: '#D9C48F', par: 10,
    hints: [
      { x: 1, text: '角の三角マークは「判定セル」。ここにブロックがあると扉が開く。色は判定条件を示す' },
      { x: 5, text: '左の青いブロックを「よせ→」で判定セルへ運ぼう' },
    ],
    build(m) {
      m.floor(); m.door(24, 0, 10, 0); m.judge(17, 9, 'exist', 0, 0);
      m.blk(9, 9, 2);
      m.gem(4, 8); m.gem(13, 7); m.gem(21, 8);
      m.check(22, 9);
      m.flag = [46, 9];
    },
    solution: [{ x: 2, edits: [{ tool: 'sort', rect: { x0: 9, y0: 9, x1: 17, y1: 9 }, opts: { sort: 'R' } }] }],
  }));

  L.push(make({
    id: '10-2', name: '空きセルと存在セル', world: 10, w: 50, tools: ['sort', 'filter'], energy: 18, bg: '#E6D3A3', bg2: '#D9C48F', par: 18,
    hints: [
      { x: 1, text: '2つの判定セルが両方ONなら扉が開く。紫＝ブロックあり、灰色＝空き' },
      { x: 5, text: '右に寄せると茶色ブロックが「□」のマスに残る。フィルターで薄くして空きにしよう' },
    ],
    build(m) {
      m.floor(); m.door(24, 0, 10, 0); m.judge(17, 9, 'exist', 0, 0); m.judge(16, 9, 'empty', 0, 0);
      m.blk(5, 9, 0); m.blk(9, 9, 2);
      m.gem(3, 8); m.gem(12, 7); m.gem(21, 8);
      m.check(22, 9);
      m.flag = [46, 9];
    },
    solution: [{ x: 2, edits: [{ tool: 'sort', rect: { x0: 5, y0: 9, x1: 17, y1: 9 }, opts: { sort: 'R' } }, { tool: 'filter', fcolor: 2 }] }],
  }));

  L.push(make({
    id: '10-3', name: '色セル', world: 10, w: 50, tools: ['painter', 'sort'], energy: 12, bg: '#E6D3A3', bg2: '#D9C48F', par: 12,
    hints: [
      { x: 1, text: 'この判定セルには緑のブロックが必要' },
      { x: 5, text: 'ガラスに緑を「いろコピー」し、「よせ→」で判定セルへ運ぼう' },
    ],
    build(m) {
      m.floor(); m.door(24, 0, 10, 0); m.judge(17, 9, 'color', 3, 0);
      m.blk(8, 9, 5); m.blk(12, 6, 3);
      m.gem(3, 8); m.gem(14, 8); m.gem(21, 8);
      m.check(22, 9);
      m.flag = [46, 9];
    },
    solution: [{ x: 2, edits: [{ tool: 'painter', srcCell: [12, 6], rect: { x0: 8, y0: 9, x1: 8, y1: 9 } }, { tool: 'sort', rect: { x0: 8, y0: 9, x1: 17, y1: 9 }, opts: { sort: 'R' } }] }],
  }));

  L.push(make({
    id: '10-4', name: 'ブロックでリフトを動かす', world: 10, w: 60, tools: ['sort'], energy: 10, bg: '#E6D3A3', bg2: '#D9C48F', par: 10,
    hints: [
      { x: 1, text: 'このリフトは停止中。判定セル「1」がONの間だけ、同じ色・番号のリフトが動く' },
      { x: 4, text: '「よせ→」でブロックを判定セルへ。エナーが立ってもONになるが、離れるとOFFになる' },
    ],
    build(m) {
      m.floor(); m.ceil(3); m.pit(22, 33);
      m.lift(22, 10, 3, 9, 0, 8, 0, 0, 0);
      m.judge(13, 9, 'exist', 0, 0); m.blk(7, 9, 2);
      m.gem(5, 8); m.gem(28, 8); m.gem(40, 8);
      m.check(16, 9);
      m.flag = [54, 9];
    },
    solution: [{ x: 2, edits: [{ tool: 'sort', rect: { x0: 7, y0: 9, x1: 13, y1: 9 }, opts: { sort: 'R' } }] }],
  }));

  // ---- ワールド11: はんていセルと リフト ----
  L.push(make({
    id: '11-1', name: '2つのリフト', world: 11, w: 70, tools: ['sort', 'painter'], energy: 22, bg: '#C9DCEB', bg2: '#B7CDE0', par: 22,
    hints: [
      { x: 1, text: '停止中のリフトは、同じ番号の判定セルがONの間だけ動く' },
      { x: 5, text: '1つ目は「よせ→」でブロックを紫の判定セルへ' },
      { x: 34, text: '2つ目の判定セルには緑が必要。ガラスに「いろコピー」して寄せよう' },
    ],
    build(m) {
      m.floor(); m.ceil(3); m.pit(22, 33); m.pit(50, 61);
      m.lift(22, 10, 3, 9, 0, 8, 0, 0, 0); m.lift(50, 10, 3, 9, 0, 8, 0, 0, 1);
      m.judge(13, 9, 'exist', 0, 0); m.blk(7, 9, 2);
      m.judge(41, 9, 'color', 3, 1); m.blk(36, 9, 5); m.blk(38, 6, 3);
      m.gem(5, 8); m.gem(28, 8); m.gem(56, 8);
      m.check(34, 9);
      m.flag = [66, 9];
    },
    solution: [
      { x: 2, edits: [{ tool: 'sort', rect: { x0: 7, y0: 9, x1: 13, y1: 9 }, opts: { sort: 'R' } }] },
      { x: 36, edits: [{ tool: 'painter', srcCell: [38, 6], rect: { x0: 36, y0: 9, x1: 36, y1: 9 } }, { tool: 'sort', rect: { x0: 36, y0: 9, x1: 41, y1: 9 }, opts: { sort: 'R' } }] },
    ],
  }));

  L.push(make({
    id: '11-2', name: '登るリフトと空きセル', world: 11, w: 56, tools: ['filter', 'sort'], energy: 18, bg: '#C9DCEB', bg2: '#B7CDE0', par: 18,
    hints: [
      { x: 1, text: '灰色の三角は「空きセル」。ここが空いている間だけリフトが動く' },
      { x: 5, text: '鋼にはまったブロックは動かせない。フィルターで茶色だけ残すと、青が薄くなって空きになる' },
      { x: 33, text: '棚の隙間には、浮いたブロックを「よせ↓」で落として橋を作ろう' },
    ],
    build(m) {
      m.floor(); m.pit(30, 32);
      m.lift(30, 10, 3, 0, -6, 8, 0, 0, 0);
      m.judge(10, 9, 'empty', 0, 0); m.blk(10, 9, 2); m.set(9, 9, 'S'); m.set(11, 9, 'S'); m.set(10, 8, 'S');
      m.rect(33, 5, 33, 9, 'S');
      m.rect(33, 4, 38, 4, 'S'); m.rect(45, 4, 52, 4, 'S');
      [1, 2, 3, 1, 2, 3].forEach((y, i) => m.blk(39 + i, y, 0));
      m.gem(4, 8); m.gem(31, 6); m.gem(48, 2);
      m.check(22, 9);
      m.flag = [50, 3];
    },
    solution: [
      { x: 2, edits: [{ tool: 'filter', fcolor: 0 }] },
      { x: 36, edits: [{ tool: 'sort', rect: { x0: 39, y0: 1, x1: 44, y1: 4 }, opts: { sort: 'D' } }] },
    ],
  }));

  L.push(make({
    id: '11-3', name: 'リフトで渡って扉を開く', world: 11, w: 60, tools: ['sort', 'filter'], energy: 18, bg: '#C9DCEB', bg2: '#B7CDE0', par: 18,
    hints: [
      { x: 1, text: '停止中のリフトを動かすには、青いブロックを判定セルへ' },
      { x: 36, text: '向こう岸の扉は灰色の「空きセル」で開く。浮いた茶色ブロックをどかそう' },
      { x: 37, text: 'エナジーが残り少ない。フィルターで青だけ残すと…？' },
    ],
    build(m) {
      m.floor(); m.ceil(3); m.pit(22, 33);
      m.lift(22, 10, 3, 9, 0, 8, 0, 0, 0);
      m.judge(13, 9, 'exist', 0, 0); m.blk(7, 9, 2);
      m.judge(40, 7, 'empty', 0, 1); m.blk(40, 7, 0); m.door(44, 0, 10, 1);
      m.gem(5, 8); m.gem(28, 8); m.gem(50, 8);
      m.check(36, 9);
      m.flag = [54, 9];
    },
    solution: [
      { x: 2, edits: [{ tool: 'sort', rect: { x0: 7, y0: 9, x1: 13, y1: 9 }, opts: { sort: 'R' } }] },
      { x: 36, edits: [{ tool: 'filter', fcolor: 2 }] },
    ],
  }));

  // ---- ワールド12: あついと つめたい(赤=マグマ と 青=氷が となりあうと、ふつうの ブロックに もどる) ----
  L.push(make({
    id: '12-1', name: 'ジュッと階段', world: 12, w: 26, tools: ['sort'], energy: 12, bg: '#BFE3E8', bg2: '#A9D6DC', par: 10,
    hints: [
      { x: 2, text: '赤（マグマ）と青（氷）がとなりあうと、どちらも普通のブロックになる' },
      { x: 6, text: '宙に浮いたブロックを、「よせ↓」で階段にしよう。赤と青が交互に並べば、安全な階段になる' },
      { x: 9, text: '地面の宝石は、寄せる前に取っておこう。階段の下になってしまうよ' },
    ],
    build(m) {
      m.floor(); m.ceil(3);
      m.rect(15, 6, 25, 9, 'S');
      m.blk(11, 6, 1);
      m.blk(12, 4, 1); m.blk(12, 8, 2);
      m.blk(13, 3, 1); m.blk(13, 5, 2); m.blk(13, 7, 1);
      m.blk(14, 3, 1); m.blk(14, 5, 2); m.blk(14, 7, 1); m.blk(14, 9, 2);
      m.gem(13, 9); m.gem(12, 5); m.gem(20, 4);
      m.flag = [22, 5];
    },
    solution: [{ x: 9, edits: [{ tool: 'sort', rect: { x0: 11, y0: 3, x1: 14, y1: 9 }, opts: { sort: 'D' } }] }],
  }));

  L.push(make({
    id: '12-2', name: 'ガラスで冷やす', world: 12, w: 24, tools: ['painter'], energy: 4, bg: '#BFE3E8', bg2: '#A9D6DC', par: 2,
    hints: [
      { x: 2, text: '赤い階段は、乗るとダメージ。ガラスに「いろコピー」で青をつければ、となりの赤が冷めて普通のブロックになる' },
      { x: 5, text: '①浮いている青いブロックをタップ ②階段のガラスをドラッグ（ガラスにだけ色がつく）' },
      { x: 14, text: '穴は、ジャンプのあとに長押しの「ふわり」で越えよう。宝石は穴の真上、天井すれすれだ' },
    ],
    build(m) {
      m.floor(); m.ceil(3);
      m.rect(13, 6, 16, 9, 'S'); m.pit(17, 20);
      // 階段: (x+y)が偶数=赤、奇数=ガラス(てっぺんは、ぜんぶ赤)
      [[9, 9], [10, 8], [10, 9], [11, 7], [11, 8], [11, 9], [12, 6], [12, 7], [12, 8], [12, 9]].forEach(([x, y]) => m.blk(x, y, (x + y) % 2 === 0 ? 1 : 5));
      m.blk(5, 5, 2);
      m.gem(11, 4); m.gem(15, 4); m.gem(18, 3);
      m.flag = [22, 9];
    },
    solution: [{ x: 6, edits: [{ tool: 'painter', srcCell: [5, 5], rect: { x0: 9, y0: 6, x1: 12, y1: 9 } }] }],
  }));

  L.push(make({
    id: '12-3', name: 'ぬって寄せて橋', world: 12, w: 26, tools: ['sort', 'painter'], energy: 14, bg: '#BFE3E8', bg2: '#A9D6DC', par: 12,
    hints: [
      { x: 2, text: '穴の上に浮かぶ赤とガラスを、「よせ↓」で橋にしよう。でも赤い橋は渡れない…' },
      { x: 5, text: '橋のガラスに青をうつせば、赤が冷めて安全な橋になる。順番は、どちらが先でもOK' },
    ],
    build(m) {
      m.floor(); m.ceil(3); m.pit(10, 15);
      // 6列ぶん: 赤・ガラス・赤・ガラス・赤・ガラス(高さはバラバラ)
      [[10, 4, 1], [11, 6, 5], [12, 3, 1], [13, 7, 5], [14, 5, 1], [15, 4, 5]].forEach(([x, y, c]) => m.blk(x, y, c));
      m.blk(4, 6, 2);
      m.rect(18, 8, 20, 9, 'S');
      m.gem(13, 8); m.gem(19, 6); m.gem(8, 9);
      m.flag = [23, 9];
    },
    solution: [{ x: 7, edits: [{ tool: 'sort', rect: { x0: 10, y0: 3, x1: 15, y1: 10 }, opts: { sort: 'D' } }, { tool: 'painter', srcCell: [4, 6], rect: { x0: 10, y0: 10, x1: 15, y1: 10 } }] }],
  }));

  // ---- ワールド13: Excelの こまった きどう(あたらしい てきを ためす) ----
  L.push(make({
    id: '13-1', name: 'ゼロジョさんの通り道', world: 13, w: 26, tools: [], energy: 0, bg: '#DCE9C9', bg2: '#CADBB4',
    hints: [
      { x: 2, text: '赤い「ゼロジョさん」は、踏めないしたおせない。タイミングを見て、飛び越えよう' },
    ],
    build(m) {
      m.floor(); m.ceil(3);
      m.rect(7, 3, 17, 7, 'S');
      m.ent('div0', 11, 9); m.ent('div0', 15, 9);
      m.gem(9, 8); m.gem(16, 8); m.gem(21, 8);
      m.flag = [23, 9];
    },
  }));

  L.push(make({
    id: '13-2', name: 'フィラーマンの橋', world: 13, w: 26, tools: [], energy: 0, bg: '#DCE9C9', bg2: '#CADBB4',
    hints: [
      { x: 2, text: '「フィラーマン」は、数秒ごとに足もとの床を右へ増やす。緑の枠が次に増えるマス' },
      { x: 5, text: '倒してしまうと床が増えなくなる。上手に飛び越えて、橋の先へ進もう' },
    ],
    build(m) {
      m.floor(); m.ceil(3); m.pit(9, 18);
      m.ent('autofill', 8, 9, { d: 1 });
      m.gem(13, 8); m.gem(18, 8); m.gem(4, 7);
      m.flag = [23, 9];
    },
  }));

  L.push(make({
    id: '13-3', name: 'セルくん', world: 13, w: 26, tools: [], energy: 0, bg: '#DCE9C9', bg2: '#CADBB4',
    hints: [
      { x: 2, text: '白いシートに、うっすら文字が見える所がある。近づくと…？' },
    ],
    build(m) {
      m.floor(); m.ceil(3);
      m.ent('walker', 9, 9); m.ent('walker', 15, 9); m.ent('walker', 20, 9);
      m.gem(8, 7); m.gem(16, 7); m.gem(22, 8);
      m.flag = [24, 9];
    },
  }));

  L.push(make({
    id: '13-4', name: 'ぎたい手', world: 13, w: 26, tools: ['sort'], energy: 20, bg: '#DCE9C9', bg2: '#CADBB4',
    hints: [
      { x: 2, text: '空にういたブロックを「ならべかえ」で下へ寄せて、橋を作ろう' },
      { x: 9, text: 'あれ？ 橋が思った形にならない。ブロックに見えて、動かない子がいる。近づくと目が見える。ダメージはないけれど、編集もきかない' },
    ],
    build(m) {
      m.floor(); m.ceil(3); m.pit(11, 16);
      [[11, 5], [12, 7], [13, 4], [14, 6], [15, 8], [16, 5]].forEach(q => m.blk(q[0], q[1], 0));
      m.ent('fake', 13, 10, { c: 0 });
      m.gem(9, 8); m.gem(13, 7); m.gem(22, 8);
      m.flag = [23, 9];
    },
    solution: [{ x: 7, edits: [{ tool: 'sort', rect: { x0: 11, y0: 3, x1: 16, y1: 10 }, opts: { sort: 'D' } }] }],
  }));

  L.push(make({
    id: '13-5', name: 'しょしき屋', world: 13, w: 26, tools: [], energy: 0, bg: '#DCE9C9', bg2: '#CADBB4',
    hints: [
      { x: 2, text: '「しょしき屋」は、点線のはんいの ブロックの色を、勝手に変える。変わる前に、はんいがちかちかする' },
      { x: 6, text: '赤いブロックは、熱くてさわれない。はんいがふたつあると、色が変わるタイミングがずれる' },
    ],
    build(m) {
      m.floor(); m.ceil(3); m.pit(8, 17);
      [8, 9, 10, 11, 14, 15, 16, 17].forEach(x => m.blk(x, 10, 0));
      m.set(12, 10, 'S'); m.set(13, 10, 'S');
      m.ent('condfmt', 12, 7, { ranges: [[8, 10, 11, 10], [14, 10, 17, 10]] });
      m.gem(9, 8); m.gem(15, 8); m.gem(21, 8);
      m.flag = [23, 9];
    },
  }));

  L.push(make({
    id: '13-6', name: 'とりかえ職人', world: 13, w: 26, tools: [], energy: 0, bg: '#DCE9C9', bg2: '#CADBB4',
    hints: [
      { x: 2, text: '「とりかえ職人」は、点線のはんいの ブロックを、ときどき かたほうへ寄せる。寄せる前に、はんいが光る' },
      { x: 17, text: 'たてに寄せる なかまもいる。壁が あいたり、とじたりする' },
    ],
    build(m) {
      m.floor(); m.ceil(3); m.pit(8, 15);
      [8, 9, 10, 11, 12, 13].forEach(x => m.blk(x, 10, 0));
      m.ent('shuffler', 11, 7, { ranges: [[8, 10, 15, 10]] });
      [7, 8, 9].forEach(y => m.blk(21, y, 0));
      m.ent('shuffler', 23, 5, { axis: 'y', ranges: [[21, 4, 21, 9]] });
      m.gem(9, 8); m.gem(19, 8); m.gem(22, 6);
      m.flag = [24, 9];
    },
  }));

  L.push(make({
    id: '13-7', name: 'ルーパールーパー', world: 13, w: 26, tools: [], energy: 0, bg: '#DCE9C9', bg2: '#CADBB4',
    hints: [
      { x: 2, text: '「ルーパールーパー」は、マスにそって かどを直角にまがり、同じところをぐるぐる回る。踏めないし、倒せない' },
      { x: 6, text: '通り道が うすく見える。タイミングを見て、すき間を通り抜けよう' },
    ],
    build(m) {
      m.floor(); m.ceil(3);
      m.ent('circ', 8, 6, { ranges: [[8, 6, 12, 9]] }); m.ent('circ', 16, 7, { ranges: [[16, 7, 19, 9]] });
      m.gem(10, 8); m.gem(17, 8); m.gem(22, 8);
      m.flag = [24, 9];
    },
  }));

  L.push(make({
    id: '13-8', name: 'うまった かけら', world: 13, w: 26, tools: ['sort'], energy: 20, bg: '#DCE9C9', bg2: '#CADBB4',
    hints: [
      { x: 2, text: '「フィラーマン」が、みぞを ブロックでうめていく。ねらう はんいに6こ たまると、いったん とまる' },
      { x: 6, text: 'かけらが うまってしまったら、「ならべかえ」でブロックを寄せて、掘り出そう' },
    ],
    build(m) {
      m.floor(); m.ceil(3); m.rect(8, 10, 17, 10, '.');
      m.ent('autofill', 7, 9, { d: 1, cap: 6 });
      m.gem(9, 10); m.gem(16, 10); m.gem(22, 8);
      m.flag = [24, 9];
    },
    solution: [{ x: 7, edits: [{ tool: 'sort', rect: { x0: 8, y0: 10, x1: 17, y1: 10 }, opts: { sort: 'R' } }] }],
  }));

  L.push(make({
    id: '13-9', name: '色をまもる', world: 13, w: 26, tools: ['protect'], energy: 12, bg: '#DCE9C9', bg2: '#CADBB4',
    hints: [
      { x: 2, text: '「しょしき屋」が、橋の色を 赤と青に かえてしまう。赤はあつくてさわれない' },
      { x: 5, text: '色がかわる前に、「シートをまもる」で橋をまもると、色を変えられなくなる' },
    ],
    build(m) {
      m.floor(); m.ceil(3); m.pit(8, 15);
      for (let x = 8; x <= 15; x++) m.blk(x, 10, 0);
      m.ent('condfmt', 11, 6, { seq: [2, 1], ranges: [[8, 10, 11, 10], [12, 10, 15, 10]] });
      m.gem(9, 8); m.gem(14, 8); m.gem(21, 8);
      m.flag = [23, 9];
    },
    solution: [{ x: 4, edits: [{ tool: 'protect', rect: { x0: 8, y0: 10, x1: 15, y1: 10 } }] }],
  }));

  L.push(make({
    id: '13-10', name: 'マグマの橋', world: 13, w: 26, tools: ['sort'], energy: 20, bg: '#DCE9C9', bg2: '#CADBB4',
    hints: [
      { x: 2, text: '橋は赤いマグマのブロックばかり。さわるとダメージで、渡れない' },
      { x: 5, text: '「フィラーマン」が、青い氷のブロックを作っている！ 赤と氷がとなりあうと、ふつうのブロックになる' },
    ],
    build(m) {
      m.floor(); m.ceil(3); m.pit(10, 17);
      for (let x = 10; x <= 17; x++) m.blk(x, 10, 1);
      m.ent('autofill', 9, 7, { d: 1, c: 2, reach: 8, max: 8 });
      m.gem(5, 8); m.gem(13, 7); m.gem(21, 8);
      m.flag = [23, 9];
    },
    solution: [{ x: 7, edits: [{ tool: 'sort', rect: { x0: 10, y0: 8, x1: 17, y1: 10 }, opts: { sort: 'D' } }] }],
  }));

  L.push(make({
    id: '13-11', name: 'ふえる橋', world: 13, w: 30, tools: ['sort'], energy: 20, bg: '#DCE9C9', bg2: '#CADBB4',
    hints: [
      { x: 2, text: '「フィラーマン」は、足もとのマスを どんどん ふやす。でも 届くはんいには かぎりがある' },
      { x: 5, text: 'ふやしたブロックを「ならべかえ」で向こうへ寄せると、また ふやしてくれる' },
    ],
    build(m) {
      m.floor(); m.ceil(3); m.pit(8, 25);
      m.ent('autofill', 7, 9, { d: 1, reach: 12 });
      m.gem(12, 8); m.gem(20, 8); m.gem(27, 8);
      m.flag = [28, 9];
    },
    solution: [{ x: 7, edits: [{ tool: 'sort', rect: { x0: 8, y0: 10, x1: 25, y1: 10 }, opts: { sort: 'R' } }] }],
  }));

  L.push(make({
    id: '13-12', name: 'いろづけ師', world: 13, w: 26, tools: ['protect'], energy: 12, bg: '#DCE9C9', bg2: '#CADBB4',
    hints: [
      { x: 2, text: '「いろづけ師」は、歩いては 立ちどまり、足もとの ガラスを 1マスずつ 赤く塗る。赤はあつくて さわれない' },
      { x: 5, text: '全部 塗られる前に、「シートをまもる」で ガラスをまもるか、いろづけ師を 踏んで倒そう。倒すと、塗られた ガラスは もとに もどる' },
    ],
    build(m) {
      m.floor(); m.ceil(3); m.pit(8, 15);
      for (let x = 8; x <= 15; x++) m.blk(x, 10, 5);
      m.ent('bucket', 15, 9, { c: 1, dir: -1, lim: [7, 16] });
      m.gem(9, 8); m.gem(14, 8); m.gem(21, 8);
      m.flag = [23, 9];
    },
    solution: [{ x: 4, edits: [{ tool: 'protect', rect: { x0: 8, y0: 10, x1: 15, y1: 10 } }] }],
  }));

  L.push(make({
    id: '13-13', name: 'あつがりのぎたい手', world: 13, w: 26, tools: ['sort'], energy: 20, bg: '#DCE9C9', bg2: '#CADBB4',
    hints: [
      { x: 2, text: 'トンネルを、ぎたい手がふさいでいる。動かないし、編集もきかない' },
      { x: 6, text: 'トンネルの上の小部屋に、赤い（熱い）ブロックがある。ぎたい手の上へ落としてみよう' },
    ],
    build(m) {
      m.floor(); m.ceil(3);
      m.rect(12, 3, 16, 8, 'S'); m.rect(14, 4, 14, 8, '.'); m.blk(14, 4, 1); // 上の小部屋に、赤いブロック
      m.rect(14, 10, 14, 10, '.'); // ゆかの、ひとマスぶんの くぼみ
      m.ent('fake', 14, 9, { c: 0 });
      m.gem(6, 8); m.gem(10, 8); m.gem(18, 8);
      m.flag = [23, 9];
    },
    solution: [{ x: 8, edits: [{ tool: 'sort', rect: { x0: 14, y0: 4, x1: 14, y1: 8 }, opts: { sort: 'D' } }] }],
  }));

  // ---- ワールド14: 改ページプレビュー(見えるのは、エナーのまわりだけ。青い枠の外はグレー) ----
  L.push(make({
    id: '14-1', name: '見えるのは まわりだけ', world: 14, w: 34, tools: [], energy: 0, bg: '#D9D2E6', bg2: '#C9C0DA', fog: { w: 11, h: 7 },
    hints: [
      { x: 2, text: '「改ページプレビュー」。青い枠の中だけ見えて、外はグレー。ゴールとかけらは、うっすら光る' },
      { x: 10, text: '見えない所から敵が近づくと、青い枠のふちに、赤いしるしがちかちかする' },
    ],
    build(m) {
      m.floor(); m.ceil(3);
      m.ent('walker', 14, 9); m.ent('div0', 22, 9); m.ent('walker', 27, 9);
      m.gem(11, 8); m.gem(24, 7); m.gem(31, 8);
      m.flag = [32, 9];
    },
  }));

  L.push(make({
    id: '14-2', name: '印刷範囲の設定', world: 14, w: 30, tools: ['printarea', 'sort'], energy: 18, bg: '#D9D2E6', bg2: '#C9C0DA', fog: { w: 11, h: 7 },
    hints: [
      { x: 2, text: '穴は広くて、飛び越せない。むこうにあるブロックを、穴へ寄せたい。でも、青い枠は せまい' },
      { x: 4, text: '「印刷範囲の設定」で見える所を広げてから、「ならべかえ」で寄せよう（青い枠の外は、なおせない）' },
    ],
    build(m) {
      m.floor(); m.ceil(3); m.pit(8, 13);
      for (let x = 14; x <= 19; x++) m.blk(x, 10, 0);
      m.gem(11, 8); m.gem(17, 8); m.gem(25, 8);
      m.flag = [27, 9];
    },
    solution: [{ x: 7, edits: [{ tool: 'printarea', rect: { x0: 8, y0: 10, x1: 19, y1: 10 } }, { tool: 'sort', rect: { x0: 8, y0: 10, x1: 19, y1: 10 }, opts: { sort: 'L' } }] }],
  }));

  L.push(make({
    id: '14-3', name: 'ズームで下見', world: 14, w: 36, tools: ['zoom'], energy: 12, bg: '#D9D2E6', bg2: '#C9C0DA', fog: { w: 11, h: 7 },
    hints: [
      { x: 2, text: '「ズーム」を使うと、数秒だけ見える範囲が2倍に広がる。その間は、なおせない' },
      { x: 12, text: '先に敵のようすを見ておいてから、タイミングよく通りぬけよう' },
    ],
    build(m) {
      m.floor(); m.ceil(3); m.rect(10, 3, 30, 5, 'S');
      m.ent('div0', 15, 9); m.ent('div0', 21, 9); m.ent('circ', 25, 6, { ranges: [[25, 6, 28, 9]] });
      m.gem(12, 8); m.gem(18, 8); m.gem(33, 8);
      m.flag = [34, 9];
    },
    solution: [{ x: 4, edits: [{ tool: 'zoom' }] }],
  }));

  // ---- じっけんシート: すべてのどうぐを、すきにためす場所 ----
  L.push(make({
    id: 'LAB', name: '実験シート（全機能）', world: 5, w: 64, regen: 10, energy: 100, bg: '#B7C6D9', bg2: '#A6B6CC',
    tools: ['painter', 'transform', 'sort', 'filter', 'protect', 'unprotect'],
    hints: [
      { x: 1, text: '実験シートでは全道具が使え、エナジーも早く回復する。自由に試そう' },
      { x: 12, text: '色の違うブロックとガラスが並んでいる。「ならべかえ」と「いろコピー」を試そう' },
      { x: 24, text: 'カギは保護の印。「まもりをはずす」で解除すれば「ならべかえ」や「かたち」が使える' },
      { x: 34, text: '穴はジャンプと「ふわり」で越えよう' },
      { x: 46, text: 'フィルターで残す色を選び、壁を通り抜けよう' },
    ],
    build(m) {
      m.floor(); m.ceil(2);
      // A: いろのちがうれつとだん(ならべかえ・いろコピー)
      [5, 2, 3, 5, 0, 3, 5, 2, 0].forEach((c, i) => m.blk(6 + i, 8, c));
      [2, 5, 4, 3].forEach((c, i) => m.blk(8 + i, 7, c));
      // B: 4×4のもよう(かたち)
      const pat = ['.1.3', '2..5', '.4.1', '30.2'];
      pat.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') m.blk(18 + i, 4 + j, +ch); }));
      // C: まもったブロック
      m.blk(26, 8, 0, true); m.blk(27, 8, 3, true); m.blk(28, 8, 0, true);
      // D: あな
      m.pit(36, 40);
      // E: かべ(フィルター)
      m.rect(46, 3, 47, 9, '#');
      m.ent('walker', 14, 9); m.ent('guard', 30, 9); m.ent('walker', 56, 9); m.ent('flyer', 22, 6);
      m.lift(50, 9, 3, 0, -5, 6, 0, 5); m.lift(36, 10, 3, 2, 0, 6, 0, 3);
      m.spark(10, 9); m.spark(20, 9); m.spark(32, 9); m.spark(44, 9); m.spark(54, 9);
      m.flag = [60, 9];
    },
    solution: [{ x: 42, edits: [{ tool: 'filter', fcolor: 2 }] }],
  }));

  window.LEVELS = L;
})();
