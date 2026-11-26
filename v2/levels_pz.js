/* パズル・アクション検証ステージ集(P01〜P13)。ひらきかた: v2/index.html?pz=1 （公開版には ふくまれない）
   どの面も、scripts/stage_bot.js の 検証ボットで「ほんとうに クリアできる」ことを たしかめてある(解法は docs/PUZZLE_STAGES.pdf)。
   solution は 解くための 編集を じゅんばんに ならべたもの。 */
(function () {
  'use strict';
  if (!/[?&]pz=1/.test(location.search)) return;
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
      ent(type, x, y, extra) { m.ents.push(Object.assign({ type, x, y }, extra || {})); },
      gem(x, y) { m.gems.push([x, y]); },
      lift(x, y, w, dx, dy, period, phase, col, ctl) { const o = { x, y, w, dx, dy, period: period || 7, phase: phase || 0, col: col || 0 }; if (ctl !== undefined && ctl !== null) o.ctl = ctl; m.lifts.push(o); },
      judge(x, y, type, color, id) { m.judges.push([x, y, type, color || 0, id || 0]); },
      door(x, y, h, id) { m.doors.push([x, y, h, id || 0]); },
    };
    m.row = (x0, x1, y, c, lk) => { for (let x = x0; x <= x1; x++) m.blk(x, y, c || 0, lk); };
    m.S = (x0, y0, x1, y1) => m.rect(x0, y0, x1, y1, 'S');
    m.wall = (x0, y0, x1, y1, c) => { m.rect(x0, y0, x1, y1, '#'); m.paint(x0, y0, x1, y1, c || 0); };
    def.build(m);
    return {
      id: def.id, name: def.name, world: def.world, w, h, tools: def.tools || [], energy: def.energy !== undefined ? def.energy : 0, regen: def.regen,
      front: front.map(r => r.join('')), color, lock,
      ents: m.ents, lifts: m.lifts, switches: m.switches, doors: m.doors, judges: m.judges, gems: m.gems, sparks: m.sparks, checks: m.checks, start: m.start, flag: m.flag,
      hints: def.hints || [], solution: def.solution || [], bg: def.bg, bg2: def.bg2, par: def.par || 0, fog: def.fog,
      meta: def.meta || {},
    };
  }
  const L = [];
  const PAL = [['#F3E3B8', '#E9D49C'], ['#CFE8D6', '#BBDDC6'], ['#D9D2E6', '#C9C0DA'], ['#F3C9A0', '#E9B88A'], ['#C9DDF3', '#B5CDE8']];
  const F = (x0, y0, x1, y1) => ({ x0, y0, x1, y1 });
  const FOG = { w: 11, h: 7 };
  // add(番号, 名前, 設定)。 meta: 難しさ(★)・使う仕掛け・ねらい・解法の手順(PDFに のせる)
  function add(n, name, o) {
    const id = 'P' + String(n).padStart(2, '0'), p = PAL[(n - 1) % PAL.length];
    L.push(make({ id, name, world: 31, w: o.w, tools: o.tools, energy: o.energy, fog: o.fog, bg: p[0], bg2: p[1], par: o.par || o.energy,
      hints: o.hints || [], solution: [{ edits: o.edits || [] }], meta: { star: o.star, tags: o.tags, aim: o.aim, steps: o.steps, note: o.note || '', bot: o.bot || {} }, build: o.build }));
  }

  add(1, 'ならべて、のぼって', { w: 40, tools: ['sort'], energy: 20, star: 2, tags: ['ならべかえ'], hints: [{ x: 1, text: '横にも縦にも、「ならべかえ」で寄せられる' }],
    aim: '同じ道具を、向きを変えて二度使う入門面。横寄せで橋、縦寄せで階段を作る。',
    steps: ['手前の4つのブロックを囲んで「→よせ」：穴の上に橋ができる（かけら1つ目は橋の上）', 'ばらばらに浮いた3列を囲んで「よせ↓」：1・2・3段の階段になる', '階段を登って、鋼の棚の旗へ'],
    build(m) { m.floor(); m.pit(10, 13); m.row(3, 6, 9, 0); m.blk(20, 5); m.blk(21, 3); m.blk(21, 6); m.blk(22, 2); m.blk(22, 4); m.blk(22, 7); m.S(23, 6, 28, 6); m.gem(11, 8); m.gem(27, 5); m.flag = [26, 5]; },
    edits: [{ tool: 'sort', rect: F(3, 9, 13, 9), opts: { sort: 'R' } }, { tool: 'sort', rect: F(20, 2, 22, 9), opts: { sort: 'D' } }] });

  add(2, '青を残して壁を抜ける', { w: 44, tools: ['protect', 'filter'], energy: 12, star: 2, tags: ['フィルター', 'シートをまもる'], hints: [{ x: 1, text: '色を残すと、ほかの色の足場も消える。消したくない足場は…？' }],
    aim: 'フィルターで消えてしまう足場を、「まもる」で残す。順番が大事。',
    steps: ['先に、青い着地点（3マス）を「シートをまもる」で保護する', '「フィルター」で茶色を残す：赤い壁が消える。保護した青い足場は残る', '茶色の床を歩いて壁を抜け、2つの穴を、青い足場を踏み台に渡る'],
    build(m) { m.floor(); m.ceil(2); m.row(8, 23, 10, 0); m.wall(14, 2, 15, 9, 1); m.pit(24, 25); m.row(26, 28, 10, 2); m.pit(29, 30); m.gem(27, 9); m.flag = [36, 9]; },
    edits: [{ tool: 'protect', rect: F(26, 10, 28, 10) }, { tool: 'filter', fcolor: 0 }] });

  add(3, '色鍵の二重扉', { w: 52, tools: ['painter', 'filter'], energy: 10, star: 3, tags: ['いろコピー', 'フィルター', '判定セル', '扉'], hints: [{ x: 1, text: '扉は、判定セルの様子で開く。色と、あるなし、2種類の扉がある' }],
    aim: '色判定の扉と、存在判定の扉を、順番に開ける。フィルターで判定も変わることを使う。',
    steps: ['緑のブロック（上の見本）から色をコピーして、ガラスの判定セルを緑にする：1つ目の扉が開く', '1つ目の扉を抜けたら、フィルターで緑を残す：赤い壁が消える（このとき赤の「あるなし判定」はOFF＝2つ目の扉は閉じる）', '壁を抜けて鋼の台の上に立ち、フィルターを「外す」（コスト0）：赤い壁がもどり、2つ目の扉が開く'],
    build(m) { m.floor(); m.ceil(2); m.blk(6, 5, 3); m.blk(14, 9, 5); m.judge(14, 9, 'color', 3, 0); m.door(20, 0, 10, 0); m.wall(28, 2, 29, 9, 1); m.judge(28, 9, 'exist', 0, 1); m.S(31, 9, 35, 9); m.door(38, 0, 10, 1); m.flag = [46, 9]; },
    edits: [{ tool: 'painter', srcCell: [6, 5], rect: F(14, 9, 14, 9) }, { tool: 'filter', fcolor: 3 }, { tool: 'filter', fcolor: null }] });

  add(4, '氷の橋', { w: 46, tools: ['sort'], energy: 10, star: 3, tags: ['ならべかえ', '氷（滑る）'], hints: [{ x: 1, text: '氷の上は、止まれない。勢いを残して跳ぼう' }],
    aim: '寄せて作った橋が「氷」になる。橋の先も氷の床で、その先に穴が待つ。滑りを読んで跳ぶアクション面。',
    steps: ['手前の氷のブロック7つを囲んで「→よせ」：穴の上に氷の橋ができる', '橋に乗ったら、氷の床が続く。止まれないので、勢いを保ったまま進む', '氷の終わりの先の穴は、端で跳んで越える（途中で減速しすぎない）'],
    build(m) { m.floor(); m.pit(10, 16); m.row(4, 10, 9, 2); m.row(17, 21, 10, 2); m.pit(22, 24); m.gem(13, 8); m.flag = [30, 9]; },
    edits: [{ tool: 'sort', rect: F(4, 9, 16, 9), opts: { sort: 'R' } }] });

  add(5, '行ったり来たりの桟橋', { w: 34, tools: [], energy: 0, star: 3, tags: ['敵：並べ替え', 'タイミング'], hints: [{ x: 1, text: '浮かぶ橋は、ときどき、左右に動く。動いたあとに渡ろう' }],
    aim: '編集なし。敵（並べ替え）が材を左右に寄せ続ける。2つの橋が重なる位置に立って、次の寄せを待つ。',
    steps: ['左の岸から、いちばん左に寄った橋（4マス）に乗る', '橋の右端（重なる場所）に立って、次に右へ寄るのを待つ', '右へ寄ったら、鋼の中継台へ渡る。右の橋でも、同じように「重なる場所」で待ち、最後の岸へ'],
    build(m) { m.floor(); m.pit(10, 25); m.S(17, 10, 18, 11); m.row(10, 13, 10, 0); m.row(19, 22, 10, 0); m.ent('shuffler', 17, 6, { axis: 'x', ranges: [[10, 10, 25, 10]], dir: 1 }); m.gem(17, 9); m.flag = [30, 9]; },
    edits: [] });

  add(6, '工場の橋を持ち上げる', { w: 36, tools: ['sort'], energy: 10, star: 3, tags: ['敵：オートフィル', 'ならべかえ'], hints: [{ x: 1, text: '工場は、足もとの高さにしか、橋を作らない' }],
    aim: '敵（オートフィル）が低い位置に作った橋を、「ならべかえ」で出口の高さに持ち上げる。',
    steps: ['高い鋼の台の上でスタート。少し待つと、工場が下の穴に材を4つ作る', '4つできたら、穴の4列を上まで囲んで「↑よせ」：橋が、台と同じ高さに上がる', '台のはしから、1マスの隙間を跳んで橋を渡り、反対側の台の旗へ'],
    build(m) { m.floor(); m.S(0, 7, 9, 9); m.S(15, 7, 22, 9); m.pit(11, 14); m.ent('autofill', 10, 9, { d: 1, max: 4, reach: 6 }); m.start = [3, 6]; m.flag = [20, 6]; },
    edits: [{ tool: 'sort', rect: F(11, 7, 14, 10), opts: { sort: 'U' } }] });

  add(7, '赤を落として偽壁をどかす', { w: 30, tools: ['sort'], energy: 10, star: 3, tags: ['敵：にせブロック', 'ならべかえ', '赤（熱い）'], hints: [{ x: 1, text: '偽の壁は、熱いものが隣に来ると、逃げる' }],
    aim: '偽ブロックは編集もコピーも効かない。でも、熱い赤ブロックを隣に置くと逃げる。上から赤を落として押しのける。',
    steps: ['床の穴の上に浮いている赤いブロックを、穴の高さまで囲んで「↓よせ」：赤が穴に落ちて、偽壁の左隣に来る', '偽壁が右へ1マス逃げて、くぼみが現れる', '赤い床を跳び越して（熱い）、くぼみの中の旗へ'],
    build(m) { m.floor(); m.pit(19, 19); m.pit(21, 21); m.set(20, 10, '.'); m.ent('fake', 20, 10); m.blk(19, 6, 1); m.flag = [20, 10]; },
    edits: [{ tool: 'sort', rect: F(19, 5, 19, 10), opts: { sort: 'D' } }] });

  add(8, '塗り屋を踏んで鍵を戻す', { w: 40, tools: [], energy: 0, star: 3, tags: ['敵：塗りつぶし', '判定セル', '扉'], hints: [{ x: 1, text: '敵が塗ると、鍵が変わる。倒すと、ぜんぶ元にもどる' }],
    aim: '編集なし。塗りつぶしがガラスを赤く塗ると、色なし判定が外れて扉が閉まる。上段から踏んで倒すと、塗りが戻って扉が開く。',
    steps: ['手前の高い台（鋼）に上がって待つ。塗り屋が右へ進みながらガラスを赤くする（扉は閉まる）', '塗り屋が台の下を通るとき、上から踏む：倒れて、塗ったガラスが元にもどる（扉が開く）', '赤く熱い床の上は歩かずに、そのまま扉を抜けて旗へ'],
    build(m) { m.floor(); m.row(12, 20, 10, 5); m.judge(16, 10, 'color', 5, 0); m.door(28, 0, 10, 0); m.ent('bucket', 10, 9, { c: 1, dir: 1 }); m.S(14, 8, 18, 8); m.gem(16, 7); m.flag = [34, 9]; },
    edits: [] });

  add(9, '残す色を替えて二度抜ける', { w: 46, tools: ['filter'], energy: 16, star: 3, tags: ['フィルター'], hints: [{ x: 1, text: 'フィルターは、いつも1色だけ。途中で選び直せる' }],
    aim: 'フィルターを2回使う。壁の色が前半と後半で違い、後半の橋は、前半では見えない色。',
    steps: ['茶色を残す：前半の赤い壁が消える', '鋼の台の上で、残す色を青に替える：後半の茶色の壁が消えて、青い橋が現れる', '青い橋（穴の上）を渡って旗へ'],
    build(m) { m.floor(); m.ceil(2); m.wall(10, 2, 11, 9, 1); m.S(16, 9, 21, 9); m.wall(24, 2, 25, 9, 0); m.pit(28, 35); m.row(28, 35, 9, 2); m.flag = [42, 9]; },
    edits: [{ tool: 'filter', fcolor: 0 }, { tool: 'filter', fcolor: 2 }] });

  add(10, '工場が作る色鍵', { w: 42, tools: ['filter'], energy: 8, star: 3, tags: ['敵：オートフィル', 'フィルター', '判定セル', '扉'], hints: [{ x: 1, text: '工場が作ったブロックが、扉の鍵になる' }],
    aim: '敵が作る緑のブロックが色判定の鍵。フィルターで緑を残せば、鍵を保ったまま赤い壁だけを消せる。',
    steps: ['フィルターで「緑」を残す：赤い壁が消える（工場の材はこれから作られるので、まだ何もない）', '工場が、判定セルの位置に緑のブロックを1つ作る：緑は残っているので判定がONになり、扉が開く', '赤い壁があった場所を抜けて、扉へ'],
    build(m) { m.floor(); m.ceil(2); m.pit(11, 11); m.ent('autofill', 10, 9, { d: 1, max: 1, c: 3, reach: 4 }); m.judge(11, 10, 'color', 3, 0); m.wall(24, 2, 25, 9, 1); m.door(34, 0, 10, 0); m.flag = [38, 9]; },
    edits: [{ tool: 'filter', fcolor: 3 }] });

  add(11, '足場を固定してから畳む', { w: 34, tools: ['protect', 'sort'], energy: 14, star: 4, tags: ['シートをまもる', 'ならべかえ', '保護が仕切りになる'], hints: [{ x: 1, text: '保護したブロックは、動かない。ほかのブロックの仕切りにもなる' }],
    aim: '上寄せすると、すべてのブロックが天井へ行ってしまう。真ん中の1つを保護して、足場として残す。',
    steps: ['縦穴の真ん中にあるブロックを「シートをまもる」で保護する', '穴の3列を囲んで「↑よせ」：保護ブロックは動かず、その下のブロックは直下に詰まって、足場の柱になる。ほかの列は天井へ', '左の台から、柱の天辺に跳び乗り、右の台へ'],
    build(m) { m.floor(); m.ceil(2); m.S(0, 7, 9, 9); m.S(13, 7, 20, 9); m.pit(10, 12); m.blk(11, 6); m.blk(11, 8); m.blk(11, 9); m.blk(10, 9); m.blk(12, 9); m.blk(12, 8); m.start = [3, 6]; m.flag = [18, 6]; },
    edits: [{ tool: 'protect', rect: F(11, 6, 11, 6) }, { tool: 'sort', rect: F(10, 2, 12, 9), opts: { sort: 'U' } }] });

  add(12, '細い窓で左右反転', { w: 36, tools: ['printarea', 'transform'], energy: 14, fog: FOG, star: 4, tags: ['改ページプレビュー', '印刷範囲の設定', 'かたち'], hints: [{ x: 1, text: '見えない所は、なおせない。まず、見える所を広げる' }],
    aim: '見える範囲が狭い面。細長い印刷範囲で遠くの穴まで見えるようにして、1回の反転で、離れた足場をまとめて動かす。',
    steps: ['いまの見える範囲の右端に重ねて、穴の先まで届く細長い範囲を「印刷範囲の設定」で作る', '足場（3つ）から穴の右端までを囲んで「左右反転」：足場が穴の上に移る', '穴の上の足場を渡って旗へ'],
    build(m) { m.floor(); m.pit(16, 18); m.row(7, 9, 9, 0); m.start = [8, 9]; m.flag = [24, 9]; },
    edits: [{ tool: 'printarea', rect: F(13, 9, 18, 9) }, { tool: 'transform', rect: F(7, 9, 18, 9), opts: { tf: 'flipH' } }] });

  add(13, '遠隔で開ける最後の扉', { w: 50, tools: ['printarea', 'transform', 'filter'], energy: 22, fog: FOG, star: 5, tags: ['改ページプレビュー', '印刷範囲の設定', 'かたち', 'フィルター', '判定セル', '扉'], hints: [{ x: 1, text: '見える所のうちに、あとで使う場所を、残しておこう' }],
    aim: '総合面。スタート地点にいるうちに、遠くの編集に使う範囲を確保する。出口の前で、鍵と壁を同時に処理する。',
    steps: ['スタート地点で、緑のブロックと判定セルを含む範囲を「印刷範囲の設定」で青枠に残す（コスト6）', '出口の前（赤い壁の手前）まで歩く', '青枠に残した範囲で、緑ブロックを判定セルの位置へ「左右反転」（コスト8）：色判定がONになり扉が開く', '「フィルター」で緑を残す（コスト8）：赤い壁が消える。緑は残るので扉も開いたまま', '壁を抜け、扉を通って旗へ'],
    build(m) { m.floor(); m.ceil(2); m.blk(6, 9, 3); m.judge(12, 9, 'color', 3, 0); m.wall(36, 2, 37, 9, 1); m.door(42, 0, 10, 0); m.start = [9, 9]; m.flag = [46, 9]; },
    edits: [{ tool: 'printarea', rect: F(5, 9, 13, 9) }, { tool: 'transform', rect: F(6, 9, 12, 9), opts: { tf: 'flipH' } }, { tool: 'filter', fcolor: 3 }] });

  window.LEVELS_PZ = L; window.LEVELS = L;
})();
