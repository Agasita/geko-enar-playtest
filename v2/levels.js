/* ゲコ＆エナー v2 — ステージ定義。
   マスの記号: . 空き / # 石(編集できる) / S 鋼(編集できない) / c ひび割れ(攻撃・ダッシュで壊れる)
              b ばね / ^ トゲ / B 奥の石(奥の層) / P 開始位置 / F ゴール
   敵・アイテムは builder の m.ent / m.gem / m.spark / m.check で置く。座標は「マス」(x, y)。 */
(function () {
  'use strict';
  function make(def) {
    const w = def.w, h = 12;
    const front = [], back = [];
    for (let y = 0; y < h; y++) { front.push(new Array(w).fill('.')); back.push(new Array(w).fill('.')); }
    const m = {
      ents: [], gems: [], sparks: [], checks: [], start: [2, 9], flag: [w - 4, 9],
      set(x, y, ch) { front[y][x] = ch; },
      setBack(x, y) { back[y][x] = 'B'; },
      rect(x0, y0, x1, y1, ch) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) front[y][x] = ch; },
      rectBack(x0, y0, x1, y1) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) back[y][x] = 'B'; },
      floor() { m.rect(0, 10, w - 1, 11, 'S'); },
      pit(x0, x1) { m.rect(x0, 10, x1, 11, '.'); },
      ent(type, x, y, extra) { m.ents.push(Object.assign({ type, x, y }, extra || {})); },
      gem(x, y) { m.gems.push([x, y]); },
      spark(x, y) { m.sparks.push([x, y]); },
      check(x, y) { m.checks.push([x, y]); },
    };
    def.build(m);
    return {
      id: def.id, name: def.name, world: def.world, w, h, tools: def.tools || [], energy: def.energy !== undefined ? def.energy : 60,
      front: front.map(r => r.join('')), back: back.map(r => r.join('')),
      ents: m.ents, gems: m.gems, sparks: m.sparks, checks: m.checks, start: m.start, flag: m.flag,
      hints: def.hints || [], solution: def.solution || [], bg: def.bg, bg2: def.bg2, par: def.par || 0,
    };
  }

  const L = [];

  // ---- ワールド1: スタートアップ ----
  L.push(make({
    id: '1-1', name: 'はじめの一歩', world: 1, w: 56, tools: [], energy: 0, bg: '#42B8C2', bg2: '#3AA7B1',
    hints: [
      { x: 1, text: '◀ ▶ で移動。A でジャンプ（長押しで高く）' },
      { x: 14, text: '穴は、ジャンプでとびこえよう' },
      { x: 26, text: 'B でレンチ攻撃。敵をたおすとエナジーが出るよ' },
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
    id: '1-2', name: '橋をかけよう', world: 1, w: 62, tools: ['build'], energy: 60, bg: '#42B8C2', bg2: '#3AA7B1', par: 40,
    hints: [
      { x: 1, text: '「編集」で時間が止まる。エナーが世界を直せるよ' },
      { x: 12, text: '広い穴だ！ 編集→「つくる」で、ドラッグして橋をかけよう' },
      { x: 34, text: '高い壁は、階段をつくって越えよう' },
    ],
    build(m) {
      m.floor(); m.pit(20, 25);
      m.rect(41, 6, 41, 9, '#');
      m.gem(22, 8); m.gem(41, 5); m.gem(53, 8);
      m.ent('walker', 31, 9); m.ent('walker', 49, 9);
      m.spark(18, 9); m.spark(30, 9); m.spark(46, 9);
      m.check(36, 9);
      m.flag = [58, 9];
    },
    solution: [
      { x: 17, edits: [{ tool: 'build', x0: 20, y0: 10, x1: 25, y1: 10 }] },
      { x: 37, edits: [{ tool: 'build', x0: 39, y0: 8, x1: 40, y1: 9 }] },
    ],
  }));

  L.push(make({
    id: '1-3', name: 'ダッシュと割れ壁', world: 1, w: 66, tools: ['build'], energy: 40, bg: '#42B8C2', bg2: '#3AA7B1', par: 20,
    hints: [
      { x: 8, text: '広い穴は C でダッシュしながらジャンプ！' },
      { x: 26, text: '盾の敵は、ダッシュでぶつかるとたおせる' },
      { x: 42, text: 'ひび割れた壁は、攻撃かダッシュで壊れる' },
    ],
    build(m) {
      m.floor(); m.pit(18, 21);
      m.ent('guard', 33, 9);
      m.rect(46, 7, 46, 9, 'c'); m.gem(49, 9);
      m.rect(54, 9, 55, 9, '^');
      m.gem(30, 6); m.gem(38, 7); m.set(38, 8, '#');
      m.spark(12, 9); m.spark(29, 9); m.spark(44, 9);
      m.check(40, 9);
      m.flag = [62, 9];
    },
  }));

  // ---- ワールド2: ソーター（「奥へ」が使える） ----
  L.push(make({
    id: '2-1', name: 'ぬける壁', world: 2, w: 56, tools: ['build', 'back'], energy: 60, bg: '#F3C9A0', bg2: '#E9B88A', par: 20,
    hints: [
      { x: 1, text: '新しい力「奥へ」: ブロックを奥の層へ送ると、通りぬけられる' },
      { x: 18, text: '壁は高すぎて越えられない。編集→「奥へ」で下をぬけよう' },
    ],
    build(m) {
      m.floor(); m.rect(0, 0, 55, 3, 'S');
      m.rect(26, 4, 28, 9, '#');
      m.rectBack(31, 8, 33, 9);
      m.gem(30, 9); m.gem(27, 3); m.gem(45, 8);
      m.set(27, 3, '.');
      m.ent('walker', 38, 9); m.ent('flyer', 44, 6);
      m.spark(20, 9); m.spark(35, 9);
      m.flag = [52, 9];
    },
    solution: [{ x: 22, edits: [{ tool: 'back', x0: 26, y0: 8, x1: 28, y1: 9 }] }],
  }));

  L.push(make({
    id: '2-2', name: 'うらみち', world: 2, w: 66, tools: ['build', 'back'], energy: 60, bg: '#F3C9A0', bg2: '#E9B88A', par: 30,
    hints: [
      { x: 6, text: '奥の層にある石は、「奥へ」で手前にもどせる。橋にしよう' },
      { x: 36, text: '壁は、足もとだけ奥へ送ればOK' },
    ],
    build(m) {
      m.floor(); m.pit(20, 27); m.rectBack(20, 10, 27, 10);
      m.rect(44, 5, 44, 9, '#'); m.rect(0, 0, 65, 3, 'S');
      m.gem(24, 8); m.gem(44, 4); m.gem(56, 8);
      m.set(44, 4, '.');
      m.ent('flyer', 34, 7); m.ent('walker', 50, 9); m.ent('turret', 58, 9);
      m.spark(16, 9); m.spark(31, 9); m.spark(40, 9);
      m.check(31, 9);
      m.flag = [62, 9];
    },
    solution: [
      { x: 17, edits: [{ tool: 'back', x0: 20, y0: 10, x1: 27, y1: 10 }] },
      { x: 40, edits: [{ tool: 'back', x0: 44, y0: 8, x1: 44, y1: 9 }] },
    ],
  }));

  // ---- ワールド3: フローズン（「ぬる」＝ばね） ----
  L.push(make({
    id: '3-1', name: 'ばねの床', world: 3, w: 60, tools: ['build', 'back', 'paint'], energy: 60, bg: '#C7B9EE', bg2: '#B8A8E6', par: 20,
    hints: [
      { x: 6, text: '「ぬる」でブロックをばねにすると、高く跳べる' },
      { x: 20, text: '天井の穴の下の石をばねにして、上の通路へ！' },
      { x: 27, text: '上に出たら、いちばん高いところで C（ダッシュ）で前へ！' },
    ],
    build(m) {
      m.floor(); m.rect(0, 0, 59, 3, 'S');
      m.rect(24, 6, 59, 6, 'S'); m.rect(29, 6, 32, 6, '.');
      m.rect(56, 7, 59, 9, 'S');
      m.rect(30, 10, 31, 10, '#');
      m.gem(31, 8); m.gem(40, 5); m.gem(48, 5);
      m.ent('walker', 20, 9); m.ent('walker', 46, 5);
      m.spark(14, 9); m.spark(36, 5);
      m.check(26, 9);
      m.flag = [55, 5];
    },
    solution: [{ x: 24, edits: [{ tool: 'paint', x0: 30, y0: 10, x1: 31, y1: 10, mat: 'bounce' }] }],
  }));

  // ---- ワールド4: メインフレーム（「かためる」） ----
  L.push(make({
    id: '4-1', name: 'かためる', world: 4, w: 62, tools: ['build', 'back', 'paint', 'freeze'], energy: 60, bg: '#9ADBC0', bg2: '#86CEB0', par: 20,
    hints: [
      { x: 6, text: '新しい力「かためる」: 敵を石にして、足場にできる（8秒）' },
      { x: 14, text: '飛んでいる敵が穴の真ん中に来たら、編集→「かためる」！' },
    ],
    build(m) {
      m.floor(); m.pit(20, 26);
      m.ent('flyer', 23, 9, { range: 28 });
      m.gem(23, 7); m.gem(36, 8); m.gem(48, 8);
      m.ent('walker', 38, 9); m.ent('guard', 47, 9);
      m.spark(16, 9); m.spark(33, 9);
      m.check(30, 9);
      m.flag = [58, 9];
    },
    solution: [{ x: 17, when: 'flyer', edits: [{ tool: 'freeze', target: 'flyer' }] }],
  }));

  L.push(make({
    id: '4-2', name: 'メインフレーム', world: 4, w: 92, tools: ['build', 'back', 'paint', 'freeze'], energy: 100, bg: '#3C4170', bg2: '#343863', par: 70,
    hints: [
      { x: 6, text: '最終ステージ。これまでの力を、ぜんぶ使おう' },
      { x: 56, text: '天井の穴の下をばねにして、上の通路へ。いちばん高いところで C（ダッシュ）！' },
    ],
    build(m) {
      m.floor(); m.rect(0, 0, 91, 3, 'S');
      m.pit(14, 19);
      m.ent('walker', 28, 9);
      m.rect(36, 4, 36, 9, '#');
      m.ent('guard', 44, 9);
      m.pit(52, 58); m.ent('flyer', 55, 9, { range: 28 });
            m.rect(62, 6, 91, 6, 'S'); m.rect(65, 6, 68, 6, '.');
      m.rect(88, 7, 91, 9, 'S');
      m.rect(66, 10, 67, 10, '#');
      m.gem(16, 8); m.gem(36, 3); m.gem(55, 7);
      m.set(36, 3, '.');
      m.spark(10, 9); m.spark(30, 9); m.spark(48, 9); m.spark(60, 9);
      m.check(24, 9); m.check(48, 9); m.check(61, 9);
      m.flag = [86, 5];
    },
    solution: [
      { x: 11, edits: [{ tool: 'build', x0: 14, y0: 10, x1: 19, y1: 10 }] },
      { x: 32, edits: [{ tool: 'back', x0: 36, y0: 8, x1: 36, y1: 9 }] },
      { x: 49, when: 'flyer', edits: [{ tool: 'freeze', target: 'flyer' }] },
      { x: 62, edits: [{ tool: 'paint', x0: 66, y0: 10, x1: 67, y1: 10, mat: 'bounce' }] },
    ],
  }));

  window.LEVELS = L;
})();
