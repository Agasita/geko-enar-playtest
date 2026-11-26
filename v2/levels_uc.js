/* ステージ検証用: 『ステージ設計ユースケース60』の盤面を、そのまま遊べる形にしたもの。
   ひらきかた: v2/index.html?uc=1 （ふつうの公開版には、ふくまれない。 levels.js のあとに よみこまれ、LEVELS を おきかえる）
   ID は U01〜U60（案の番号）。盤面・使える道具・コストは新規提案で、数値は「例示した手順のコスト」。
   ※ 敵や判定セルの更新順、踏み返りの高さ、リフトの位相は、実機で調整する前提。note つきの面は、案を簡略にしてある。 */
(function () {
  'use strict';
  if (!/[?&]uc=1/.test(location.search)) return;
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
    // ぶろっくを よこに ならべる / たてに ならべる / 鋼
    m.row = (x0, x1, y, c, lk) => { for (let x = x0; x <= x1; x++) m.blk(x, y, c || 0, lk); };
    m.S = (x0, y0, x1, y1) => m.rect(x0, y0, x1, y1, 'S');
    m.wall = (x0, y0, x1, y1, c) => { m.rect(x0, y0, x1, y1, '#'); m.paint(x0, y0, x1, y1, c || 0); };
    def.build(m);
    return {
      id: def.id, name: def.name, world: def.world, w, h, tools: def.tools || [], energy: def.energy !== undefined ? def.energy : 0, regen: def.regen,
      front: front.map(r => r.join('')), color, lock,
      ents: m.ents, lifts: m.lifts, switches: m.switches, doors: m.doors, judges: m.judges, gems: m.gems, sparks: m.sparks, checks: m.checks, start: m.start, flag: m.flag,
      hints: def.hints || [], solution: def.solution || [], bg: def.bg, bg2: def.bg2, par: def.par || 0, fog: def.fog, note: def.note || '',
    };
  }
  const L = [];
  const PAL = [['#F3E3B8', '#E9D49C'], ['#CFE8D6', '#BBDDC6'], ['#D9D2E6', '#C9C0DA'], ['#F3C9A0', '#E9B88A'], ['#C9DDF3', '#B5CDE8'], ['#F0D0D0', '#E6BBBB']];
  // add(番号, 名前, 設定): 世界は 5面ずつ(21〜32)
  function add(n, name, o) {
    const id = 'U' + String(n).padStart(2, '0'), world = 21 + Math.floor((n - 1) / 5), p = PAL[Math.floor((n - 1) / 5) % PAL.length];
    const sol = o.sol || [];
    L.push(make({ id, name, world, w: o.w, tools: o.tools, energy: o.energy, fog: o.fog, bg: p[0], bg2: p[1], par: o.par,
      hints: [{ x: o.hx || 1, text: '検証メモ：' + o.play }], solution: sol, note: o.note, build: o.build }));
  }
  const F = (x0, y0, x1, y1) => ({ x0, y0, x1, y1 });
  const FOG = { w: 11, h: 7 };

  // ===== 01-05 色と足場 =====
  add(1, '一枚だけの踏切台', { w: 34, tools: ['painter'], energy: 4, play: '棚の手前のガラスだけを緑にして踏む。跳ねた先で棚に乗ればクリア。広く塗ると手前でも跳ねる。',
    build(m) { m.floor(); m.row(12, 17, 10, 5); m.blk(3, 6, 3); m.row(19, 25, 6, 0); m.flag = [23, 5]; },
    sol: [{ edits: [{ tool: 'painter', srcCell: [3, 6], rect: F(16, 10, 17, 10) }] }] });
  add(2, '熱い壁に窓を開ける', { w: 36, tools: ['filter'], energy: 8, play: '茶を残して赤壁を透過し、同色の床を歩く。何色を消したいかから、残す色を逆算する。',
    build(m) { m.floor(); m.ceil(2); m.row(14, 24, 10, 0); m.wall(18, 2, 19, 9, 1); m.flag = [32, 9]; },
    sol: [{ edits: [{ tool: 'filter', fcolor: 0 }] }] });
  add(3, '氷の降り口', { w: 40, tools: [], energy: 0, play: '氷に乗る前から速度を調整し、滑る距離を見込んで棚に降りる。勢い余ったときは下段から再挑戦する。',
    build(m) { m.floor(); m.blk(4, 9, 0); m.blk(6, 8, 0); m.row(8, 17, 8, 2); m.row(21, 24, 9, 0); m.row(26, 30, 8, 0); m.flag = [28, 7]; } });
  add(4, '片方だけ跳ねる廊下', { w: 40, tools: ['painter'], energy: 4, play: '安全な後半だけを矩形で緑に塗る。前半は歩き、天井が切れた地点からバネで上がる。',
    build(m) { m.floor(); m.row(6, 30, 10, 5); m.S(0, 0, 18, 2); for (let x = 6; x <= 18; x++) m.set(x, 3, '^'); m.blk(3, 7, 3); m.row(30, 34, 6, 0); m.flag = [32, 5]; },
    sol: [{ edits: [{ tool: 'painter', srcCell: [3, 7], rect: F(20, 10, 28, 10) }] }] });
  add(5, '一筆で二つの踏切', { w: 40, tools: ['painter'], energy: 4, play: '二枚だけを含む長方形で緑を写す。茶足場と着地棚を経て、二回の跳躍を一度の編集で用意する。',
    build(m) { m.floor(); m.row(8, 9, 10, 5); m.row(11, 13, 7, 0); m.row(16, 17, 7, 5); m.row(20, 23, 3, 5); m.blk(3, 5, 3); m.flag = [21, 2]; },
    sol: [{ edits: [{ tool: 'painter', srcCell: [3, 5], rect: F(8, 7, 17, 10) }] }] });

  // ===== 06-10 形と空間 =====
  add(6, '逆向きの階段', { w: 34, tools: ['transform'], energy: 8, play: '階段全体を左右反転する。低い段が入口側につき、右へ一段ずつ登れる。',
    build(m) { m.floor(); m.rect(10, 7, 10, 9, '#'); m.rect(11, 8, 11, 9, '#'); m.blk(12, 9); m.S(13, 6, 17, 6); m.flag = [16, 5]; },
    sol: [{ edits: [{ tool: 'transform', rect: F(10, 7, 12, 9), opts: { tf: 'flipH' } }] }] });
  add(7, '天井から降ろす足場', { w: 34, tools: ['transform'], energy: 8, play: '足場と下半分の空きを囲んで上下反転。ブロック数を増やさず、帰り道の高さに足場を移す。',
    build(m) { m.floor(); m.pit(10, 15); m.row(10, 15, 3, 0); m.flag = [30, 9]; },
    sol: [{ edits: [{ tool: 'transform', rect: F(10, 2, 15, 11), opts: { tf: 'flipV' } }] }] });
  add(8, '縦棒を橋にする', { w: 34, tools: ['transform'], energy: 8, play: '正方形を選んで90°回し、一本の橋にする。幅だけ広げた長方形では回せないこともプレビューで分かる。',
    build(m) { m.floor(); m.pit(10, 14); for (let y = 7; y <= 11; y++) m.blk(12, y, 0); m.flag = [30, 9]; },
    sol: [{ edits: [{ tool: 'transform', rect: F(10, 7, 14, 11), opts: { tf: 'rot' } }] }] });
  add(9, '軸をずらす鍵穴', { w: 36, tools: ['transform'], energy: 8, play: '足場と欠けが対称になるよう選択の端を一マス調整して左右反転。鋼の手前に着地先ができる。',
    build(m) { m.floor(); m.blk(7, 9, 0); m.S(19, 7, 24, 7); m.S(19, 8, 19, 9); m.flag = [22, 6]; },
    sol: [{ edits: [{ tool: 'transform', rect: F(7, 9, 17, 9), opts: { tf: 'flipH' } }] }] });
  add(10, '二つのL字を一度に回す', { w: 36, tools: ['transform'], energy: 8, play: '両方を一枠で回転し、一方を入口の踏み段、もう一方を出口の踊り場にする。片方ずつ回す予算はない。',
    build(m) { m.floor(); m.blk(15, 9); m.blk(14, 9); m.blk(15, 8); m.blk(12, 6); m.blk(13, 6); m.blk(12, 7); m.S(16, 6, 19, 6); m.flag = [18, 5]; },
    sol: [{ edits: [{ tool: 'transform', rect: F(12, 6, 15, 9), opts: { tf: 'rot' } }] }] });

  // ===== 11-15 寄せ方と仕切り =====
  add(11, '列の底が階段になる', { w: 36, tools: ['sort'], energy: 10, play: '三列まとめて下へ寄せる。列ごとの個数の違いがそのまま段差になり、上段の出口へ登れる。',
    build(m) { m.floor(); m.blk(10, 6); m.blk(11, 4); m.blk(11, 7); m.blk(12, 3); m.blk(12, 5); m.blk(12, 8); m.S(13, 6, 17, 6); m.flag = [16, 5]; },
    sol: [{ edits: [{ tool: 'sort', rect: F(10, 3, 12, 9), opts: { sort: 'D' } }] }] });
  add(12, '柱の両側に二つの橋', { w: 44, tools: ['sort'], energy: 10, play: '一度の右寄せで、左の材は柱際、右の材は選択範囲の端に集まる。左右の回廊をそれぞれの切れ目でつなぐ。',
    build(m) { m.floor(); m.pit(18, 21); m.pit(32, 35); m.S(22, 9, 22, 9); m.row(8, 11, 9, 0); m.row(24, 27, 9, 0); m.flag = [40, 9]; },
    sol: [{ edits: [{ tool: 'sort', rect: F(8, 9, 35, 9), opts: { sort: 'R' } }] }] });
  add(13, 'エナーが仕切りになる', { w: 36, tools: ['sort'], energy: 10, play: 'くぼみに立ってから右寄せする。左の材は体の手前で止まり、右の材は出口側に寄る。後者を足場に脱出する。',
    build(m) { m.floor(); [6, 7, 9, 16, 18, 20].forEach(x => m.blk(x, 9)); m.S(25, 7, 25, 9); m.start = [12, 9]; m.flag = [30, 9]; },
    sol: [{ edits: [{ tool: 'sort', rect: F(4, 9, 24, 9), opts: { sort: 'R' } }] }] });
  add(14, 'レール際の乗り場', { w: 34, tools: ['sort'], energy: 10, play: '左側の材を右へ寄せ、通り道の直前にホームを作る。リフトが横に並んだときに乗り移る。',
    build(m) { m.floor(); m.lift(18, 9, 2, 0, -5, 8, 0, 0); [6, 8, 10].forEach(x => m.blk(x, 9)); m.S(20, 5, 25, 5); m.flag = [22, 4]; },
    sol: [{ edits: [{ tool: 'sort', rect: F(4, 9, 17, 9), opts: { sort: 'R' } }] }] });
  add(15, '鍵を抜いて長く寄せる', { w: 36, tools: ['unprotect', 'sort'], energy: 16, play: '中央だけ保護解除してから右寄せ。元の仕切りも橋材に数え、四個をまとめて右岸に詰める。',
    build(m) { m.floor(); m.pit(16, 19); m.row(6, 8, 9, 0); m.blk(11, 9, 0, true); m.flag = [24, 9]; },
    sol: [{ edits: [{ tool: 'unprotect', rect: F(11, 9, 11, 9) }, { tool: 'sort', rect: F(6, 9, 19, 9), opts: { sort: 'R' } }] }] });

  // ===== 16-20 保護・フィルター・判定 =====
  add(16, '異色の着地点を残す', { w: 42, tools: ['protect', 'filter'], energy: 12, play: '青床を保護してから茶を残す。赤壁を抜け、鍵マークの青床に着地する。氷の滑りも見込む。',
    build(m) { m.floor(); m.ceil(2); m.row(8, 23, 10, 0); m.wall(14, 2, 15, 9, 1); m.pit(24, 25); m.row(26, 28, 10, 2); m.pit(29, 30); m.flag = [36, 9]; },
    sol: [{ edits: [{ tool: 'protect', rect: F(26, 10, 28, 10) }, { tool: 'filter', fcolor: 0 }] }] });
  add(17, '無料で戻る橋', { w: 42, tools: ['filter'], energy: 8, play: '茶で栓を抜け、鋼の上でフィルターを外す。青橋が戻り、残りエナジーがゼロでも渡れる。',
    build(m) { m.floor(); m.ceil(3); m.wall(16, 3, 17, 9, 1); m.S(22, 9, 25, 9); m.pit(26, 33); m.row(26, 33, 9, 2); m.flag = [38, 9]; },
    sol: [{ edits: [{ tool: 'filter', fcolor: 0 }, { tool: 'filter', fcolor: null }] }] });
  add(18, '消した壁で扉が閉じる', { w: 40, tools: ['filter'], energy: 8, play: '茶を残して壁を通り、鋼床でフィルターを外す。判定対象が再び存在し、編集終了後に扉が開く。',
    build(m) { m.floor(); m.ceil(2); m.wall(16, 2, 17, 9, 1); m.judge(16, 9, 'exist', 0, 0); m.door(30, 0, 10, 0); m.flag = [34, 9]; },
    sol: [{ edits: [{ tool: 'filter', fcolor: 0 }, { tool: 'filter', fcolor: null }] }] });
  add(19, '床と鍵を同じ色に', { w: 42, tools: ['painter', 'filter'], energy: 10, play: '判定位置を緑に塗り、緑を残す。壁を消しつつ判定も成立させ、開いた扉へ進む。',
    build(m) { m.floor(); m.ceil(2); m.blk(6, 5, 3); m.blk(16, 9, 5); m.judge(16, 9, 'color', 3, 0); m.wall(22, 2, 23, 9, 1); m.door(30, 0, 10, 0); m.flag = [36, 9]; },
    sol: [{ edits: [{ tool: 'painter', srcCell: [6, 5], rect: F(16, 9, 16, 9) }, { tool: 'filter', fcolor: 3 }] }] });
  add(20, '残す色を途中で替える', { w: 46, tools: ['filter'], energy: 16, play: '前半は茶、鋼の小部屋で青に切り替える。一枚のシートに常時一色しか残せないことが手順になる。',
    build(m) { m.floor(); m.ceil(2); m.wall(10, 2, 11, 9, 1); m.S(16, 9, 21, 9); m.wall(24, 2, 25, 9, 0); m.pit(28, 35); m.row(28, 35, 9, 2); m.flag = [42, 9]; },
    sol: [{ edits: [{ tool: 'filter', fcolor: 0 }, { tool: 'filter', fcolor: 2 }] }] });

  // ===== 21-25 跳ぶ・降りる・乗る =====
  add(21, '歩く踏切台', { w: 34, tools: [], energy: 0, play: '棚側へ来た敵を上から踏み、跳ね返りで棚へ乗る。一度で倒れるため、外した場合は下道で仕切り直す構成にする。',
    note: '踏み返りで届く幅は実機調整。下道は未実装', build(m) { m.floor(); m.pit(8, 10); m.pit(13, 17); m.ent('walker', 11, 9); m.flag = [24, 9]; } });
  add(22, 'こうらで二度跳ぶ', { w: 34, tools: [], energy: 0, play: '一度踏んで中段へ。残ったこうらが出口側に来たら中段から降りてもう一度踏み、最後の棚へ移る。',
    note: '踏み返りの高さは実機調整', build(m) { m.floor(); m.row(12, 15, 8, 0); m.row(19, 22, 7, 0); m.ent('guard', 16, 9); m.flag = [21, 6]; } });
  add(23, '空中で待ち合わせ', { w: 34, tools: [], energy: 0, play: '敵が手前へ戻る周期に合わせて跳び、下降中に上から踏む。踏み返りの横移動で対岸へ渡る。',
    note: '谷の幅は実機調整', build(m) { m.floor(); m.pit(10, 17); m.ent('flyer', 13, 7, { range: 24 }); m.flag = [24, 9]; } });
  add(24, '崩れる順に渡る', { w: 36, tools: [], energy: 0, play: '前半は止まらず横断し、最後の一枚だけ約0.5秒乗って崩す。穴が開いた場所から下段に降りる。',
    note: '上下二段の出口は簡略（下段のみ）', build(m) { m.floor(); m.pit(10, 16); for (let x = 10; x <= 16; x++) m.set(x, 10, 'c'); m.S(19, 6, 21, 6); m.flag = [26, 9]; } });
  add(25, 'ガラスの昇降台', { w: 34, tools: ['painter'], energy: 4, play: '高い位置でリフトを緑にし、横の乗り場から乗り移って跳ねる。移動するバネの位置と着地先を合わせる。',
    build(m) { m.floor(); m.lift(14, 9, 3, 0, -3, 8, 0, 5); m.blk(4, 6, 3); m.S(20, 2, 25, 2); m.flag = [23, 1]; },
    sol: [{ edits: [{ tool: 'painter', srcCell: [4, 6], rect: F(14, 9, 16, 9) }] }] });

  // ===== 26-30 敵の動きを読む =====
  add(26, '踏めない巡回員', { w: 40, tools: [], energy: 0, play: '上段で敵をやり過ごし、背後へ降りる。折り返すまでに出口へ届く長さにする。',
    build(m) { m.floor(); m.S(8, 9, 8, 9); m.S(28, 9, 28, 9); m.S(14, 8, 20, 8); m.ent('div0', 15, 9); m.flag = [34, 9]; } });
  add(27, '白い文字の足止め', { w: 34, tools: [], energy: 0, play: '横46px・縦30px以内に近づいて敵を誘い、切れ目を跳び戻る。ふちで止まった敵を上から踏んで本線へ進む。',
    build(m) { m.floor(); m.pit(14, 14); m.ent('moji', 21, 9); m.flag = [30, 9]; } });
  add(28, '角を曲がる順番', { w: 36, tools: [], energy: 0, play: '下辺を敵のすぐ後ろで横断。次の交差点では右辺を抜けたことを見て通る。二地点の安全な順番を読む。',
    note: '通路は床面の一か所で簡略', build(m) { m.floor(); m.ent('circ', 12, 5, { ranges: [[12, 5, 18, 9]] }); m.flag = [30, 9]; } });
  add(29, '発射を誘って切り返す', { w: 38, tools: [], energy: 0, play: '150px以内に入り、発光後に一方向へ動いて弾を誘う。発射後に切り返し、次弾までの間に抜ける。',
    build(m) { m.floor(); m.ent('turret', 26, 9); m.flag = [36, 9]; } });
  add(30, '偽の出口を見破る', { w: 36, tools: [], energy: 0, play: '近づくと約64pxで閉じた目、約30pxで開いた目が見える。壁と見抜いて別の入口から回り込む。',
    build(m) { m.floor(); m.S(16, 0, 16, 4); m.S(16, 7, 16, 7); m.ent('fake', 16, 8); m.ent('fake', 16, 9); m.blk(10, 9); m.blk(12, 8); m.S(14, 7, 15, 7); m.flag = [26, 9]; } });

  // ===== 31-35 オートフィル工房 =====
  add(31, '最後の一マスを待つ', { w: 34, tools: [], energy: 0, play: '狙いのマスの光を見て岸で待つ。最初の約1.5秒で材が生まれたら渡る。プレイヤーの編集を使わず橋が完成する。',
    note: '欠けは4マス（max=4）で、待ち時間を長めにした', build(m) { m.floor(); m.pit(11, 14); m.ent('autofill', 10, 9, { d: 1, max: 4, reach: 6 }); m.flag = [22, 9]; } });
  add(32, 'できた橋を上に寄せる', { w: 36, tools: ['sort'], energy: 10, play: '最後の材ができたら鋼岸から列全体を上寄せする。生成できる高さと、実際に橋を使いたい高さを分けて考える。',
    build(m) { m.floor(); m.S(0, 7, 9, 9); m.S(15, 7, 22, 9); m.pit(11, 14); m.ent('autofill', 10, 9, { d: 1, max: 4, reach: 6 }); m.start = [3, 6]; m.flag = [20, 6]; },
    sol: [{ wait: 9, edits: [{ tool: 'sort', rect: F(11, 7, 14, 10), opts: { sort: 'U' } }] }] });
  add(33, '三個目の前に止める', { w: 34, tools: [], energy: 0, play: '二個目を確認したら敵を踏む。橋を使って二個分進み、生成されずに残った三個目の穴から下へ降りる。',
    note: '下段へ降りる縦穴は未実装。3個で止める（max=3）に簡略', build(m) { m.floor(); m.pit(11, 14); m.ent('autofill', 10, 9, { d: 1, max: 3, reach: 6 }); m.flag = [22, 9]; } });
  add(34, '工場の在庫を空ける', { w: 36, tools: ['sort'], energy: 10, play: '在庫を上寄せして計数範囲の外へ運ぶと生成が再開する。上段に退路を残しながら、下段も足場で満たす。',
    note: '上段・下段の二層は簡略', build(m) { m.floor(); m.pit(11, 15); m.row(11, 13, 10, 0); m.ent('autofill', 10, 9, { d: 1, cap: 3, max: 9, reach: 8 }); m.flag = [22, 9]; },
    sol: [{ edits: [{ tool: 'sort', rect: F(11, 7, 13, 10), opts: { sort: 'U' } }] }] });
  add(35, '見本色を先に選ぶ', { w: 36, tools: ['transform'], energy: 8, play: '初回生成前に足もとの材と緑材を反転で交換する。緑の生成床を踏んで棚に上がる。敵本体のマスは空けておく。',
    build(m) { m.floor(); m.blk(8, 10, 0); m.pit(9, 11); m.blk(12, 10, 3); m.ent('autofill', 8, 9, { d: 1, max: 3, reach: 6 }); m.S(11, 6, 15, 6); m.flag = [14, 5]; },
    sol: [{ edits: [{ tool: 'transform', rect: F(8, 10, 12, 10), opts: { tf: 'flipH' } }] }] });

  // ===== 36-40 塗装と熱 =====
  add(36, '塗り屋を先に通す', { w: 36, tools: [], energy: 0, play: '足もとのガラスが緑になるまで待ち、敵が先へ進んでから踏む。塗り手を生かすことが出口への条件になる。',
    build(m) { m.floor(); m.row(10, 22, 10, 5); m.ent('bucket', 8, 9, { c: 3, dir: 1 }); m.S(24, 6, 28, 6); m.flag = [26, 5]; } });
  add(37, '塗り屋を倒して鍵を戻す', { w: 40, tools: [], energy: 0, play: '塗られて閉まった扉を確認し、上段から敵を踏む。敵が塗ったガラスが元に戻り、無色判定が復帰する。',
    build(m) { m.floor(); m.row(12, 20, 10, 5); m.judge(16, 10, 'color', 5, 0); m.door(28, 0, 10, 0); m.ent('bucket', 10, 9, { c: 1, dir: 1 }); m.S(14, 8, 18, 8); m.flag = [34, 9]; } });
  add(38, '塗らせない着地点', { w: 40, tools: ['protect'], energy: 4, play: '敵が到達する前にその一枚だけを保護。周囲が熱くなっても着地点はガラスのまま残り、安全に降りられる。',
    build(m) { m.floor(); m.row(10, 19, 10, 5); m.ent('bucket', 11, 9, { c: 1, dir: 1 }); m.S(9, 8, 17, 8); m.flag = [26, 9]; },
    sol: [{ edits: [{ tool: 'protect', rect: F(19, 10, 19, 10) }] }] });
  add(39, '色の波に一拍遅れて乗る', { w: 42, tools: [], energy: 0, play: '予告の点滅を見て、最初の島を安全な色の間に渡る。次の島が緑になる拍まで鋼で待ち、バネで出口へ進む。',
    build(m) { m.floor(); m.pit(9, 30); m.row(10, 12, 10, 0); m.S(15, 10, 17, 10); m.row(20, 22, 10, 0); m.S(24, 6, 30, 6); m.ent('condfmt', 18, 6, { ranges: [[10, 10, 12, 10], [20, 10, 22, 10]], seq: [0, 1, 3] }); m.flag = [34, 9]; } });
  add(40, '緑になった瞬間を保存', { w: 36, tools: ['protect'], energy: 4, play: '緑の間に編集を開いて足場を保護する。一周に何周期かかっても緑が残り、戻った地点で跳べる。',
    note: '「離れた場所を一周」は省略（足場の近くで待つ形）', build(m) { m.floor(); m.pit(11, 25); m.row(12, 13, 10, 0); m.S(16, 6, 22, 6); m.ent('condfmt', 12, 6, { ranges: [[12, 10, 13, 10]], seq: [0, 3, 1] }); m.flag = [20, 5]; },
    sol: [{ skip: '色の変化を待つ必要がある', edits: [{ tool: 'protect', rect: F(12, 10, 13, 10) }] }] });

  // ===== 41-45 敵の並べ替えと偽装壁 =====
  add(41, '交互に現れる桟橋', { w: 34, tools: [], energy: 0, play: '材が左に寄ったら中継棚へ、右に寄ったら次の棚へ進む。移動中の材に運ばれる動作に頼らず、寄せた後に渡る。',
    build(m) { m.floor(); m.pit(10, 25); m.S(17, 10, 18, 11); m.row(10, 13, 10, 0); m.row(19, 22, 10, 0); m.ent('shuffler', 17, 6, { axis: 'x', ranges: [[10, 10, 25, 10]], dir: 1 }); m.flag = [30, 9]; } });
  add(42, '磁石で寄せ幅を変える', { w: 34, tools: ['transform'], energy: 8, play: 'かたちで磁石を狙った位置へ移す。次の敵の寄せが磁石で区切られ、出口直下に昇り段が集まる。',
    note: '簡略版：磁石の位置替えを使わなくても渡れる配置。かたち(磁石の移動)の解は未実装', build(m) {
      m.floor(); m.pit(10, 25); m.set(16, 10, 'M'); m.set(17, 10, 'M'); m.row(10, 13, 10, 0); m.row(18, 22, 10, 0);
      m.ent('shuffler', 17, 6, { axis: 'x', ranges: [[10, 10, 25, 10]], dir: 1 }); m.flag = [30, 9]; } });
  add(43, 'ひび床で仕切りを外す', { w: 34, tools: [], energy: 0, play: 'ひび床に乗って崩すと二つの区画がつながる。次の右寄せで左の材まで右に集まり、長い橋になる。',
    note: '簡略版：ひび床で仕切りが外れるしくみだけを置いた。橋が出口に届く長さは実機で調整', build(m) {
      m.floor(); m.pit(10, 25); m.set(17, 10, 'c'); m.set(18, 10, 'c'); m.set(17, 11, 'S'); m.set(18, 11, 'S'); m.row(10, 13, 10, 0); m.row(19, 22, 10, 0);
      m.ent('shuffler', 17, 6, { axis: 'x', ranges: [[10, 10, 25, 10]], dir: 1 }); m.flag = [30, 9]; } });
  add(44, '赤を押し当てる', { w: 30, tools: ['sort'], energy: 10, play: '左側だけを右寄せし、赤を敵の左隣に置く。編集を終えると敵が右へ一マス逃げ、元の位置から降りられる。',
    note: '降り口は床の一マス窪み（旗が窪みの中）に簡略。赤は床穴へ「下寄せ」で落とす形', build(m) {
      m.floor(); m.pit(19, 19); m.pit(21, 21); m.set(20, 10, '.'); m.ent('fake', 20, 10); m.blk(19, 6, 1); m.flag = [20, 10]; },
    sol: [{ edits: [{ tool: 'sort', rect: F(19, 5, 19, 10), opts: { sort: 'D' } }] }] });
  add(45, '塗り屋が開ける抜け穴', { w: 30, tools: [], energy: 0, play: '無色のうちは待つ。塗り屋がガラスを赤くすると偽壁が右に逃げる。敵が離れたら空いた縦穴へ降りる。',
    note: '降り口は床の一マス窪み（旗が窪みの中）に簡略', build(m) {
      m.floor(); m.row(17, 19, 10, 5); m.set(20, 10, '.'); m.ent('fake', 20, 10); m.pit(21, 21); m.ent('bucket', 15, 9, { c: 1, dir: 1 }); m.flag = [20, 10]; } });

  // ===== 46-50 視界・時間停止・調査 =====
  add(46, '対岸に作業窓を残す', { w: 34, tools: ['printarea', 'sort'], energy: 16, fog: FOG, play: '高台で材と寄せ先を含む青枠を残す。下に降りてからその枠内で材を寄せ、帰り用の橋を作る。',
    note: '高台・下段の二段構えは簡略（同じ高さで枠を残す）', build(m) { m.floor(); m.pit(12, 18); m.row(4, 10, 9, 0); m.start = [8, 9]; m.flag = [24, 9]; },
    sol: [{ edits: [{ tool: 'printarea', rect: F(13, 9, 18, 9) }, { tool: 'sort', rect: F(4, 9, 18, 9), opts: { sort: 'R' } }] }] });
  add(47, '細く長く切り取る', { w: 36, tools: ['printarea', 'transform'], energy: 14, fog: FOG, play: '現在の視界に重なる細長い枠で両端を確保し、枠内で左右反転。40マス上限でも、一列なら離れた二点を一緒に扱える。',
    build(m) { m.floor(); m.pit(16, 18); m.row(7, 9, 9, 0); m.start = [8, 9]; m.flag = [24, 9]; },
    sol: [{ edits: [{ tool: 'printarea', rect: F(13, 9, 18, 9) }, { tool: 'transform', rect: F(7, 9, 18, 9), opts: { tf: 'flipH' } }] }] });
  add(48, 'ズームで次の角を見る', { w: 40, tools: ['zoom'], energy: 4, fog: FOG, play: '鋼の待機台でズームし、5秒間の広い視界で敵の回る向きを確かめる。通過順を決め、そのまま移動して抜ける。',
    note: '通路が巡回路に二度交差する形は、床面の一か所に簡略', build(m) { m.floor(); m.S(9, 9, 10, 9); m.ent('circ', 16, 5, { ranges: [[16, 5, 24, 9]] }); m.flag = [34, 9]; },
    sol: [{ edits: [{ tool: 'zoom' }] }] });
  add(49, '三枚の作業窓', { w: 46, tools: ['printarea', 'sort'], energy: 24, fog: FOG, play: '移動しながら必要な三枠を確保。終点で対象全体が見える状態を作り、一度の寄せで連続した足場を完成させる。',
    note: '四つ目の観察台は省略。枠は2か所で足りる配置（上限3か所）', build(m) { m.floor(); m.pit(24, 33); m.row(4, 13, 9, 0); m.start = [9, 9]; m.flag = [38, 9]; },
    sol: [{ edits: [{ tool: 'printarea', rect: F(14, 9, 23, 9) }, { tool: 'printarea', rect: F(23, 9, 33, 9) }, { tool: 'sort', rect: F(4, 9, 33, 9), opts: { sort: 'R' } }] }] });
  add(50, '動く標的に変わる床', { w: 36, tools: ['painter'], energy: 4, play: '二つが近づいた瞬間に編集して時間を止める。一つの矩形に両方を入れて緑を写し、地上とリフトから順に跳ぶ。',
    build(m) { m.floor(); m.row(14, 15, 10, 5); m.lift(18, 9, 2, 0, -4, 8, 0, 5); m.blk(4, 5, 3); m.S(21, 6, 23, 6); m.gem(22, 5); m.S(24, 2, 28, 2); m.flag = [26, 1]; },
    sol: [{ edits: [{ tool: 'painter', srcCell: [4, 5], rect: F(14, 9, 19, 10) }] }] });

  // ===== 51-55 資源と別解 =====
  add(51, '玉を取りに行く寄り道', { w: 44, tools: ['transform', 'sort'], energy: 18, play: '8使って玉へ行く。残り2から上限10まで回復し、最後の寄せを実行する。玉の回復量15と上限の関係を体験する。',
    note: 'エナジーの玉は regen（実験シート）面のみ。この面は上限18で、反転8＋寄せ10を続けて払える形に置きかえた', build(m) {
      m.floor(); m.rect(6, 7, 6, 9, '#'); m.rect(7, 8, 7, 9, '#'); m.blk(8, 9); m.S(9, 6, 13, 6); m.pit(20, 23); m.row(15, 18, 9, 0); m.flag = [28, 9]; },
    sol: [{ edits: [{ tool: 'transform', rect: F(6, 7, 8, 9), opts: { tf: 'flipH' } }, { tool: 'sort', rect: F(15, 9, 23, 9), opts: { sort: 'R' } }] }] });
  add(52, '四角の広さを試せる部屋', { w: 34, tools: ['transform'], energy: 8, play: '編集結果と出口を見比べる。低ければ元に戻して8を取り戻し、一列広く選び直す。誤った確定を学習に使える。',
    build(m) { m.floor(); m.rect(8, 7, 8, 9, '#'); m.rect(9, 8, 9, 9, '#'); m.blk(10, 9); m.S(11, 6, 14, 6); m.flag = [13, 5]; },
    sol: [{ edits: [{ tool: 'transform', rect: F(8, 7, 10, 9), opts: { tf: 'flipH' } }] }] });
  add(53, '二手の本道、一手の近道', { w: 50, tools: ['painter', 'protect', 'filter'], energy: 12, play: '上は2で済むが跳躍を合わせる。下は青床保護と茶フィルターの12で安定して歩ける。腕前と支出で道を選ぶ。',
    build(m) { m.floor(); m.row(6, 7, 10, 5); m.row(8, 23, 10, 0); m.wall(14, 7, 15, 9, 1); m.pit(24, 25); m.row(26, 28, 10, 2); m.pit(29, 30); m.S(9, 6, 34, 6); m.blk(3, 3, 3); m.flag = [38, 9]; },
    sol: [{ edits: [{ tool: 'painter', srcCell: [3, 3], rect: F(6, 10, 7, 10) }] }, { edits: [{ tool: 'protect', rect: F(26, 10, 28, 10) }, { tool: 'filter', fcolor: 0 }] }] });
  add(54, '敵に一手任せる', { w: 34, tools: ['sort'], energy: 10, play: '無料解は次の右寄せまで待つ。速い解は開始直後に自分で右寄せし、敵が左へ戻す前に渡る。',
    build(m) { m.floor(); m.pit(12, 15); m.row(6, 9, 9, 0); m.ent('shuffler', 10, 6, { axis: 'x', ranges: [[6, 9, 15, 9]], dir: -1 }); m.flag = [22, 9]; },
    sol: [{ edits: [{ tool: 'sort', rect: F(6, 9, 15, 9), opts: { sort: 'R' } }] }] });
  add(55, '崩れる橋か、残る橋か', { w: 50, tools: ['protect', 'filter'], energy: 12, play: '上は無編集で走り抜ける。下は青橋を保護して茶を残し、赤壁を透過する。上で落ちても残した予算で下から進める。',
    build(m) { m.floor(); m.row(10, 25, 10, 0); m.wall(16, 7, 17, 9, 1); m.pit(26, 29); m.row(30, 32, 10, 2); m.pit(33, 34); m.blk(4, 9); m.blk(6, 8); m.blk(8, 7); for (let x = 10; x <= 34; x++) m.set(x, 6, 'c'); m.flag = [40, 9]; },
    sol: [{ edits: [{ tool: 'protect', rect: F(30, 10, 32, 10) }, { tool: 'filter', fcolor: 0 }] }] });

  // ===== 56-60 複合ステージ =====
  add(56, '塗装工場の非常口', { w: 42, tools: ['protect'], energy: 4, play: '赤くなった瞬間に左隣の材を保護する。偽壁が退いた跡から下段へ降りる。次の色変化をまたいでも赤判定が保たれ、離れた非常扉まで歩ける。',
    note: '降り口は「偽壁が上へ退く」形に簡略（偽壁の下の床が赤くなると上へ逃げる）', build(m) {
      m.floor(); m.S(20, 2, 20, 7); m.ent('fake', 20, 9); m.blk(20, 10, 0); m.ent('condfmt', 14, 6, { ranges: [[20, 10, 20, 10]], seq: [0, 1, 2] }); m.judge(20, 10, 'color', 1, 0); m.door(34, 0, 10, 0); m.flag = [38, 9]; },
    sol: [{ skip: '色の変化を待つ必要がある', edits: [{ tool: 'protect', rect: F(20, 10, 20, 10) }] }] });
  add(57, '工場が作る色鍵', { w: 42, tools: ['filter'], energy: 8, play: '緑の生成を待つと判定が成立する。緑フィルターで赤壁だけを消し、生成材と判定を維持したまま扉に入る。',
    build(m) { m.floor(); m.ceil(2); m.pit(11, 11); m.ent('autofill', 10, 9, { d: 1, max: 1, c: 3, reach: 4 }); m.judge(11, 10, 'color', 3, 0); m.wall(24, 2, 25, 9, 1); m.door(34, 0, 10, 0); m.flag = [38, 9]; },
    sol: [{ wait: 3, edits: [{ tool: 'filter', fcolor: 3 }] }] });
  add(58, '足場を固定してから畳む', { w: 34, tools: ['protect', 'sort'], energy: 14, play: '中段の材を保護して上寄せ。下側の材はその直下に詰まり、隣列は天井まで寄る。高さの違う二つの足場を順に使う。',
    build(m) { m.floor(); m.ceil(2); m.S(0, 7, 9, 9); m.S(13, 7, 20, 9); m.pit(10, 12); m.blk(11, 6); m.blk(11, 8); m.blk(11, 9); m.blk(10, 9); m.blk(12, 9); m.blk(12, 8); m.start = [3, 6]; m.flag = [18, 6]; },
    sol: [{ edits: [{ tool: 'protect', rect: F(11, 6, 11, 6) }, { tool: 'sort', rect: F(10, 2, 12, 9), opts: { sort: 'U' } }] }] });
  add(59, '踏み返りで工場を止める', { w: 36, tools: [], energy: 0, play: '二枚目の時刻にふわふわを踏み、跳ね返りで工場の上へ届いて踏み止める。生成間隔と飛行の位相を合わせる面。',
    note: '簡略版：3個で止まる工場（max=3）とふわふわを並べた。踏み止めの高さは実機で調整', build(m) { m.floor(); m.pit(11, 14); m.ent('autofill', 10, 9, { d: 1, max: 3, reach: 6 }); m.ent('flyer', 12, 6, { range: 30 }); m.S(17, 8, 22, 8); m.flag = [20, 7]; } });
  add(60, '遠隔で開ける最後の扉', { w: 50, tools: ['printarea', 'transform', 'filter'], energy: 22, fog: FOG, play: '通過時に緑材と判定位置を青枠に残す。出口前から反転で緑材を判定位置へ移し、緑を残して赤壁を抜ける。',
    build(m) { m.floor(); m.ceil(2); m.blk(6, 9, 3); m.judge(12, 9, 'color', 3, 0); m.wall(36, 2, 37, 9, 1); m.door(42, 0, 10, 0); m.start = [9, 9]; m.flag = [46, 9]; },
    sol: [{ edits: [{ tool: 'printarea', rect: F(5, 9, 13, 9) }, { tool: 'transform', rect: F(6, 9, 12, 9), opts: { tf: 'flipH' } }, { tool: 'filter', fcolor: 3 }] }] });

  window.LEVELS_UC = L; window.LEVELS = L;
})();
