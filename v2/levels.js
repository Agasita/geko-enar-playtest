/* ゲコ＆エナー v2 — ステージ定義。せかいは「ひょうのシート」: ブロックは、いろつきのセル。
   マスの記号: . あき / # いし(なおせる) / S はがね(なおせない) / c ひびわれ(のるとくずれる)
   いろ: 0 ちゃいろ(ふつう) 1 あか(あつい) 2 あお(こおり) 3 みどり(ばね) 4 きいろ(もろい)。座標は「マス」(x, y)。
   なにもないところにブロックは生まれない。あるブロックを、うごかす・ならべる・ぬる・隠す・けす。 */
(function () {
  'use strict';
  function make(def) {
    const w = def.w, h = def.h || 12;
    const front = [], color = [], lock = [];
    for (let y = 0; y < h; y++) { front.push(new Array(w).fill('.')); color.push(new Array(w).fill(0)); lock.push(new Array(w).fill(0)); }
    const m = {
      ents: [], gems: [], sparks: [], checks: [], lifts: [], switches: [], doors: [], start: [2, h - 3], flag: [w - 4, h - 3],
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
      lift(x, y, w, dx, dy, period, phase, col) { m.lifts.push({ x, y, w, dx, dy, period: period || 7, phase: phase || 0, col: col || 0 }); },
      sw(x, y, id) { m.switches.push([x, y, id || 0]); },
      door(x, y, h, id) { m.doors.push([x, y, h, id || 0]); },
      spark(x, y) { m.sparks.push([x, y]); },
      check(x, y) { m.checks.push([x, y]); },
    };
    def.build(m);
    return {
      id: def.id, name: def.name, world: def.world, w, h, tools: def.tools || [], energy: def.energy !== undefined ? def.energy : 60, regen: def.regen,
      front: front.map(r => r.join('')), color, lock,
      ents: m.ents, lifts: m.lifts, switches: m.switches, doors: m.doors, gems: m.gems, sparks: m.sparks, checks: m.checks, start: m.start, flag: m.flag,
      hints: def.hints || [], solution: def.solution || [], bg: def.bg, bg2: def.bg2, par: def.par || 0,
    };
  }

  const L = [];

  // ---- ワールド1: よせる ----
  L.push(make({
    id: '1-1', name: 'はじめのいっぽ', world: 1, w: 56, tools: [], energy: 0, bg: '#42B8C2', bg2: '#3AA7B1',
    hints: [
      { x: 1, text: '◀ ▶ でいどう。A でジャンプ（ながおしでたかく）' },
      { x: 14, text: 'あなは、ジャンプでとびこえよう' },
      { x: 26, text: 'てきは、うえからふんでたおせる。ぶつかると、ダメージ' },
      { x: 40, text: 'ほうせきを3つあつめると★がふえる' },
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
    id: '1-2', name: 'おもさでよせる', world: 1, w: 56, tools: ['sort'], energy: 12, bg: '#42B8C2', bg2: '#3AA7B1', par: 10,
    hints: [
      { x: 1, text: '「なおす」でじかんがとまる。せかいはひょうのシート、ブロックはいろつきのセルだよ' },
      { x: 8, text: '「データ」タブの「ならべかえ」: はんいのブロックを、ひとつのほうこうによせる。「よせ↓」は、おもさでおとすイメージ。まちがえたら「もどす」で、エナジーもかえってくるよ' },
      { x: 14, text: 'あなのうえにうかぶブロックを、はんいごとえらんで「よせ↓」。おちてはしになる。はんいは、ひろくとれるよ（はしのブロックも、右のばらばらのブロックも、いっぺんに）' },
    ],
    build(m) {
      m.floor(); m.ceil(3); m.pit(22, 29);
      [4, 5, 6, 4, 5, 6, 4, 5].forEach((y, i) => m.blk(22 + i, y, 0));
      [5].forEach(y => m.blk(31, y, 0)); [3, 6].forEach(y => m.blk(32, y, 0)); [4, 5, 7].forEach(y => m.blk(33, y, 0)); [3, 4, 6, 8].forEach(y => m.blk(34, y, 0)); // 空にういた、ばらばらのブロック(おとすと、かいだんになる)
      m.gem(26, 8); m.gem(40, 8); m.gem(34, 5);
      // (ノイズは、いない。うごくてきがいると、おとしたブロックがひっかかるため)
      m.check(36, 9);
      m.flag = [52, 9];
    },
    solution: [{ x: 18, edits: [{ tool: 'sort', rect: { x0: 22, y0: 3, x1: 34, y1: 10 }, opts: { sort: 'D' } }] }],
  }));

  L.push(make({
    id: '1-3', name: 'ふわりとこえる', world: 1, w: 66, tools: [], energy: 0, bg: '#42B8C2', bg2: '#3AA7B1',
    hints: [
      { x: 8, text: 'ひろいあなは、ジャンプのあと、ボタンをおしつづけよう。エナーが「ふわり」と、ゆっくりおちる（すこしのあいだだけ）' },
      { x: 28, text: 'ふわりは、ちゃくちするとまたつかえる' },
      { x: 48, text: 'あかいブロックは、さわるとダメージ。ジャンプでこえよう（ダメージをうけないと、ノーミスのバッジ）' },
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
      { x: 6, text: '「データ」タブの「フィルター」: えらんだいろのブロックだけがのこり、ほかはとおりぬけられる' },
      { x: 20, text: 'あおだけのこすと、ちゃいろのかべがきえる。あしばのあおはのこる' },
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
    id: '2-2', name: 'よせてから、フィルター', world: 2, w: 62, tools: ['sort', 'filter'], energy: 20, bg: '#F3C9A0', bg2: '#E9B88A', par: 18,
    hints: [
      { x: 4, text: 'うかぶあおいブロックを「よせ↓」ではしにして、そのあと「フィルター」であおだけのこす' },
      { x: 30, text: 'ちゃいろのかべは、フィルターでとおりぬけよう。はし（あお）はのこる' },
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
    id: '3-1', name: 'ガラスにいろをつける', world: 3, w: 60, tools: ['painter'], energy: 4, bg: '#C7B9EE', bg2: '#B8A8E6', par: 2,
    hints: [
      { x: 4, text: 'すきとおったなブロックは「ガラス」（いろなしのセル）。ちからをもたない。「いろコピー」でいろ（ちから）をつけられる' },
      { x: 16, text: 'そらにうかぶみどりのブロックを①タップ → てんじょうのあなのしたのガラスのゆかを②ドラッグ。ゆかがはずむ' },
      { x: 27, text: 'うえにでたら、ジャンプをおしつづけて「ふわり」と、まえへ！' },
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
    id: '3-2', name: 'ガラスのはし', world: 3, w: 66, tools: ['sort', 'painter', 'filter'], energy: 22, bg: '#C7B9EE', bg2: '#B8A8E6', par: 20,
    hints: [
      { x: 1, text: 'まずちゃいろのかべを、フィルターでとおりぬけたい。でも、ガラスはいろがないので、フィルターできえてしまう' },
      { x: 4, text: '①ガラスを「よせ↓」ではしに ②あおいブロックのいろをいろコピーではしにうつす ③フィルターであおだけのこす' },
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
    id: '4-1', name: 'よこにひっくり', world: 4, w: 56, tools: ['transform'], energy: 10, bg: '#9ADBC0', bg2: '#86CEB0', par: 8,
    hints: [
      { x: 4, text: '「セル」タブの「かたち」→「よこにひっくり」: はんいのブロックを、ひだりみぎにひっくりかえす' },
      { x: 12, text: 'ひだりがわがたかいかいだんは、のぼれない。2つのかいだんを、まとめてはんいにいれてひっくりかえそう' },
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
    id: '4-2', name: 'たおしてはしに', world: 4, w: 66, tools: ['transform', 'filter'], energy: 18, bg: '#9ADBC0', bg2: '#86CEB0', par: 16,
    hints: [
      { x: 6, text: 'むこうぎしにそびえるあおいとうを、あなごとえらんで「かたち」→「90°まわす」。たおれてはしになる！（しかくにえらぶ）' },
      { x: 34, text: 'ちゃいろのかべは、フィルターでとおりぬけよう' },
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
    id: '5-1', name: 'まもってのこす', world: 5, w: 62, tools: ['protect', 'filter'], energy: 14, bg: '#F2B6B0', bg2: '#E8A29B', par: 12,
    hints: [
      { x: 1, text: 'ちゃいろのかべを、フィルターでとおりぬけたい。でも、あなのなかのあしばもちゃいろで、いっしょにきえてしまう' },
      { x: 4, text: '「ひょうじ」タブの「シートをまもる」: まもったブロックは、フィルターできえない（カギのマーク）。あしばをまもってから、フィルターであおだけのこそう' },
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
    id: '5-2', name: 'まもりをはずしてよせる', world: 5, w: 60, tools: ['sort', 'unprotect'], energy: 18, bg: '#F2B6B0', bg2: '#E8A29B', par: 16,
    hints: [
      { x: 4, text: 'まもったブロック（カギ）は「よせる」のしきりになる。しきりのうえのブロックは、そこでとまる' },
      { x: 12, text: 'さきにまもりをはずしてから、まとめて「よせ↓」しよう。じゅんばんをまちがえると、コストがたりなくなる' },
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
    id: '5-3', name: 'よせてからひっくりかえし', world: 5, w: 62, tools: ['sort', 'transform'], energy: 20, bg: '#F2B6B0', bg2: '#E8A29B', par: 18,
    hints: [
      { x: 4, text: 'ちらばったブロックを、まず「←よせ」でかいだんのかたちにそろえる' },
      { x: 12, text: 'つぎに「かたち」→「よこにひっくり」。ひだりがたかいかいだんは、のぼれない。ひっくりかえして、のぼれるかいだんにしよう' },
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
    id: '6-1', name: 'バネのたてあな', world: 6, w: 24, h: 30, tools: ['painter'], energy: 8, bg: '#8FA6E8', bg2: '#7E95DB', par: 7,
    hints: [
      { x: 0, text: 'たてあなをのぼろう。ふつうのジャンプでは、てんじょうにとどかない' },
      { x: 8, text: 'そらにうかぶみどりのブロックのいろを、「いろコピー」であしもとのガラスにうつして、てんじょうのあなをつきぬけよう。つぎのあしばもおなじように' },
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
    id: '6-2', name: 'のぼりのとう', world: 6, w: 26, h: 30, tools: [], energy: 0, bg: '#8FA6E8', bg2: '#7E95DB',
    hints: [{ x: 0, text: 'ジグザグにあしばをのぼろう。おちたら、ひとつしたのあしばにもどるだけ' }],
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
    id: '7-1', name: 'リフトにのる', world: 7, w: 60, tools: [], energy: 0, bg: '#E3D18F', bg2: '#D8C47C',
    hints: [
      { x: 6, text: 'うすくみえるのは、リフトのとおりみち。リフトは、きまったみちをいったりきたりする' },
      { x: 14, text: 'あなはひろすぎて、とべない。リフトがちかづいたら、のってむこうぎしへ' },
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
    id: '7-2', name: 'リフトでたかいところへ', world: 7, w: 60, tools: ['filter'], energy: 8, bg: '#E3D18F', bg2: '#D8C47C', par: 8,
    hints: [
      { x: 6, text: 'うえしたにいったりきたりするリフトで、たかいあしばへ。うえがったら、ちゃいろのかべをフィルターでとおりぬけよう' },
      { x: 12, text: 'リフトのとおりみちには、ブロックをどうかせない（よせる・かいてん・ひっくりかえしも、みちをよけてぎょうわれる）' },
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
      { x: 4, text: 'このリフトは、ガラス（いろなし）。ちからをもたない。いろコピーで、ブロックのようにいろ（ちから）をつけられる' },
      { x: 10, text: 'むこうぎしのたかいかべは、ふつうではのぼれない。うかぶみどりのブロックのいろを、リフトにコピーしよう（はずむリフトになる）' },
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
    id: '7-4', name: 'リフトをフィルターでだしいれ', world: 7, w: 66, tools: ['filter'], energy: 8, bg: '#E3D18F', bg2: '#D8C47C', par: 8,
    hints: [
      { x: 4, text: 'リフトにもいろ（ちから）がある。フィルターは、リフトにもきく。のこすいろいがいのリフトは、うすくなってとおりぬけられる' },
      { x: 8, text: 'あおいかべをとおりぬけたい。でも、あなをわたるちゃいろのリフトはのこしたい。あかいリフトは、さわるとダメージ。さて、どのいろをのこす？' },
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
    id: '7-5', name: 'すべるリフト', world: 7, w: 60, tools: [], energy: 0, bg: '#E3D18F', bg2: '#D8C47C',
    hints: [
      { x: 6, text: 'あおいリフトは、のるとすべる（こおり）。いきおいがつくので、のったら、はんたいのむきにすこしおして、とまろう' },
      { x: 14, text: 'いたのうえでとまれないと、すべっておちる。リフトのどうきにあわせて、まんなかにいよう' },
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
    id: '7-6', name: 'リフトをみどりにして、フィルター', world: 7, w: 66, tools: ['painter', 'filter'], energy: 10, bg: '#E3D18F', bg2: '#D8C47C', par: 10,
    hints: [
      { x: 2, text: 'ちゃいろのかべをとおりぬけたい。むこうぎしのたかいだいには、はずむリフトでとびのりたい。だいのうえには、あかいリフトもある' },
      { x: 5, text: '①うかぶみどりのブロックのいろを、ガラスのリフトにいろコピー ②フィルターでみどりだけのこす（かべとあかいリフトがうすくなる）' },
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
    id: '8-1', name: 'じしゃくとスイッチ', world: 8, w: 60, tools: ['sort'], energy: 10, bg: '#D6C3A5', bg2: '#C9B392', par: 8,
    hints: [
      { x: 1, text: 'あかとあおの「じしゃく」ブロックは、いちばんちかい はがね に ひきよせられる' },
      { x: 5, text: 'とびらは しまっている。スイッチは とびらの むこう。じしゃくで おしてみよう' },
      { x: 8, text: 'じしゃくの まっすぐ下に ブロックがあると、はたらかない。「←よせ」で よこにどかすと… じしゃくが うごきだすよ' },
    ],
    build(m) {
      m.floor();
      m.door(12, 0, 10, 0);
      m.blk(16, 8, 2); m.set(16, 7, 'M'); m.sw(16, 9, 0);
      m.gem(5, 8); m.gem(9, 7); m.gem(26, 8);
      m.check(30, 9);
      m.flag = [52, 9];
    },
    solution: [{ x: 8, edits: [{ tool: 'sort', rect: { x0: 14, y0: 8, x1: 16, y1: 8 }, opts: { sort: 'L' } }] }],
  }));

  L.push(make({
    id: '8-2', name: 'ふたつのとびら', world: 8, w: 60, tools: ['sort', 'unprotect'], energy: 26, bg: '#D6C3A5', bg2: '#C9B392', par: 26,
    hints: [
      { x: 1, text: 'とびらが ふたつ。まず ひとつめの とびらを ひらこう' },
      { x: 28, text: 'ふたつめの じしゃくの したのブロックには、カギ（まもり）が かかっている。さきに「まもりをはずす」' },
    ],
    build(m) {
      m.floor();
      m.door(12, 0, 10, 0); m.blk(16, 8, 2); m.set(16, 7, 'M'); m.sw(16, 9, 0);
      m.door(34, 0, 10, 1); m.blk(38, 8, 0, true); m.set(38, 7, 'M'); m.sw(38, 9, 1);
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
    id: '8-3', name: 'よこむきの じしゃく', world: 8, w: 58, tools: ['sort', 'filter'], energy: 18, bg: '#D6C3A5', bg2: '#C9B392', par: 18,
    hints: [
      { x: 1, text: 'じしゃくは よこにも ひきよせられる。ゆかより、よこの はがねが ちかければ よこへ' },
      { x: 14, text: 'うえの じしゃくの よこのブロックを「↑よせ」で どかすと… じしゃくが はがねへ。スイッチを おすよ' },
      { x: 36, text: 'とびらの さきの かべは「フィルター」で すりぬけよう' },
    ],
    build(m) {
      m.floor();
      m.set(27, 6, 'S'); m.set(24, 6, 'M'); m.blk(25, 6, 0); m.blk(24, 7, 0); m.sw(26, 6, 0);
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
    id: '9-1', name: 'たおして おとして はしにする', world: 9, w: 56, tools: ['transform', 'sort'], energy: 18, bg: '#B9D9C0', bg2: '#A8CBB0', par: 18,
    hints: [
      { x: 1, text: 'ひろい あな。ブロックの とうを たおして はしに しよう' },
      { x: 8, text: '「かたち」の「90°まわす」。でも たおすと たかい ところに うく…' },
      { x: 12, text: 'うかんだブロックを「よせ↓」で あなに おとそう（はんいは しかくに）' },
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
    id: '9-2', name: 'ひっくりかえして すりぬける', world: 9, w: 36, tools: ['transform', 'filter'], energy: 16, bg: '#B9D9C0', bg2: '#A8CBB0', par: 16,
    hints: [
      { x: 1, text: 'ひだりが たかい かいだんは のぼれない。さきに「よこにひっくり」' },
      { x: 17, text: 'たなの かべは「フィルター」で すりぬける。…でも かいだんも きえる。のぼってから だよ' },
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
    id: '9-3', name: 'つくって まもって とおる', world: 9, w: 48, tools: ['sort', 'protect', 'filter'], energy: 22, bg: '#B9D9C0', bg2: '#A8CBB0', par: 22,
    hints: [
      { x: 1, text: 'あなには はしが ない。うかぶブロックを「よせ↓」で はしに' },
      { x: 8, text: 'かべは「フィルター」で とおれる。でも はしも おなじ いろ…' },
      { x: 10, text: 'はしを「シートをまもる」で まもれば、フィルターでも きえないよ' },
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
    id: '9-4', name: 'カギを はずして ひっくりかえす', world: 9, w: 34, tools: ['unprotect', 'transform', 'filter'], energy: 22, bg: '#B9D9C0', bg2: '#A8CBB0', par: 22,
    hints: [
      { x: 1, text: 'ひだりが たかい かいだん。でも ひとつだけ カギ（まもり）が かかっている' },
      { x: 6, text: 'カギつきの ブロックは ひっくりかえせない。「まもりをはずす」→「よこにひっくり」' },
      { x: 15, text: 'たなの かべは「フィルター」。のぼったあとに！' },
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

  // ---- じっけんシート: すべてのどうぐを、すきにためす場所 ----
  L.push(make({
    id: 'LAB', name: 'じっけんシート（ぜんぶ）', world: 5, w: 64, regen: 10, energy: 100, bg: '#B7C6D9', bg2: '#A6B6CC',
    tools: ['painter', 'transform', 'sort', 'filter', 'protect', 'unprotect'],
    hints: [
      { x: 1, text: 'じっけんシート: すべてのどうぐがつかえる（エナジーははやくかいふく）。きになるきのうを、ためしてみよう' },
      { x: 12, text: 'いろのちがうブロックのれつ（ガラスもある）。「ならべかえ」「いろコピー（ガラスだけ）」をためそう' },
      { x: 24, text: 'カギはまもり。「まもりをはずす」ではずしてから、よせる・かたちができる' },
      { x: 34, text: 'あなは、ジャンプ＋ふわりでこえよう' },
      { x: 46, text: 'かべは「フィルター」でとおれる（のこすいろをえらぶ）' },
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
