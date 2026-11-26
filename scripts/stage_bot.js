/* ステージ検証ボット: ブラウザの コンソール(または 自動操作)で、ステージが ほんとうに クリアできるかを 探す。
   つかいかた(ゲームを ?uc=1 や ?pz=1 などで ひらいたあと):
     eval(await (await fetch('../scripts/stage_bot.js')).text());   // ← window.StageBot ができる
     const r = await StageBot.solve(levelIndex, { edits: [ {tool, rect, opts, srcCell, fcolor}, ... ], maxMs: 60000 });
   edits は「ステージを 解くために 使う 編集」を じゅんばんに ならべたもの。ボットは「いつ 編集するか」と「どう 歩くか」を 探す。
   しくみ: ゲームの状態(G)を まるごと 複製して、5フレームごとの 操作(左・右・なし × ジャンプ長押し・はなす)を 優先度つき探索(A*)で ためす。ダメージを うけた 道は すてる。 */
(function () {
  'use strict';
  const g = window.__geko, G = g.G, input = g.input, DT = 1 / 60, STEP = 5;
  const clone = () => { const lv = G.level; G.level = null; let c; try { c = structuredClone(G); } finally { G.level = lv; } c.level = null; return { c, inp: Object.assign({}, input) }; };
  const restore = (s) => { const lv = G.level; const r = structuredClone(s.c); r.level = lv; Object.assign(G, r); Object.assign(input, s.inp); };
  const press = (a) => {
    input.left = a.dir < 0; input.right = a.dir > 0;
    if (a.jump) { if (!input.jumpHeld) g.press('jump', true); } else if (input.jumpHeld) g.press('jump', false);
  };
  const ACTS = [];
  for (const d of [1, -1, 0]) for (const j of [1, 0]) ACTS.push({ dir: d, jump: j });
  function key(ph) {
    const p = G.p, dyn = (G.enemies.length || G.lifts.length) ? Math.floor(G.frame / 24) : 0;
    const doors = G.doors.map(d => d.open ? 1 : 0).join('');
    return [Math.floor(p.x / 3), Math.floor(p.y / 3), Math.round(p.vx / 45), Math.round(p.vy / 70), p.ground ? 1 : 0, input.jumpHeld ? 1 : 0, ph, dyn, doors, G.filter, G.zoomT > 0 ? 1 : 0].join(',');
  }
  async function solve(levelIndex, opt) {
    opt = opt || {}; let edits = (opt.edits || []).slice(), maxMs = opt.maxMs || 60000, W = opt.weight || 1.6;
    g.start(levelIndex); G.hitstop = 0; G.paused = false; G.mode = 'play'; input.left = input.right = false; input.jumpHeld = false;
    if (opt.applyFirst) { g.setEdit(true); for (const ed of edits) g.runTool(ed); g.setEdit(false); for (let f = 0; f < 4; f++) g.update(DT); opt = Object.assign({}, opt, { edits: [] }); edits.length = 0; }
    const fx = G.flag.x + 8, fy = G.flag.y + 28, t0 = performance.now();
    const K = opt.editBonus || 0, h = (ph) => { const p = G.p; return (Math.abs(p.x + 5 - fx) + 0.8 * Math.abs(p.y + 7 - fy)) / (105 * STEP / 60) + K * (edits.length - (ph || 0)); };
    const root = { s: clone(), ph: 0, gc: 0, path: [], hv: h(0) };
    const open = [root], seen = new Set([key(0)]); let n = 0, best = root;
    const pop = () => { let bi = 0, bf = Infinity; for (let i = 0; i < open.length; i++) { const f = open[i].gc + W * open[i].hv; if (f < bf) { bf = f; bi = i; } } return open.splice(bi, 1)[0]; };
    while (open.length && performance.now() - t0 < maxMs) {
      const nd = pop(); n++;
      const moves = ACTS.map(a => ({ a })); if (nd.ph < edits.length) moves.push({ edit: nd.ph });
      for (const mv of moves) {
        restore(nd.s); let ph = nd.ph;
        if (mv.edit !== undefined) {
          if (G.p.dead) continue; g.setEdit(true); if (!G.edit.on) continue; let ok = true;
          const ed = edits[mv.edit]; const r = g.runTool(ed); if (!r.ok) ok = false; g.setEdit(false); if (!ok) continue; ph++;
          for (let f = 0; f < 2; f++) g.update(DT);
        } else { press(mv.a); for (let f = 0; f < STEP; f++) { g.update(DT); if (G.cleared || G.p.dead) break; } }
        if (G.p.dead || G.p.hp < 3) continue;
        const path = nd.path.concat([mv.edit !== undefined ? { edit: mv.edit, at: G.frame } : mv.a]);
        if (G.cleared) { const res = { ok: true, nodes: n, ms: Math.round(performance.now() - t0), path, frames: G.frame, cost: G.spent, gems: G.gems }; return res; }
        const k = key(ph); if (seen.has(k)) continue; seen.add(k);
        const child = { s: clone(), ph, gc: nd.gc + 1, path, hv: h(ph) }; open.push(child); if (child.hv < best.hv) best = child;
      }
      if (n % 200 === 0) await new Promise(r => setTimeout(r, 0));
    }
    return { ok: false, nodes: n, ms: Math.round(performance.now() - t0), bestH: +best.hv.toFixed(1), bestPh: best.ph, pos: null };
  }
  // 解を あとから 再生して、ほんとうに クリアできるか 確かめる(再現性の チェック)
  function replay(levelIndex, path, edits) {
    g.start(levelIndex); G.hitstop = 0; G.paused = false; G.mode = 'play'; input.left = input.right = false; input.jumpHeld = false;
    for (const mv of path) {
      if (mv.edit !== undefined) { g.setEdit(true); g.runTool(edits[mv.edit]); g.setEdit(false); g.update(DT); g.update(DT); }
      else { press(mv); for (let f = 0; f < STEP; f++) { g.update(DT); if (G.cleared || G.p.dead) break; } }
      if (G.cleared) return { ok: true, frames: G.frame, hp: G.p.hp, gems: G.gems, cost: G.spent };
      if (G.p.dead) return { ok: false, why: 'dead' };
    }
    return { ok: false, why: 'end' };
  }
  window.StageBot = { solve, replay };
})();
