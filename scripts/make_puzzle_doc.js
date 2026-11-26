/* パズル・アクション資料(HTML)を つくる: node scripts/make_puzzle_doc.js
   よみこむもの: v2/levels_pz.js（ステージ）、docs/puzzle/bot_results.json（検証ボットの結果）
   できるもの:   docs/puzzle/puzzles.html  → Edge/Chrome で PDF にする（docs/PUZZLE_STAGES.pdf） */
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const ctx = { window: {}, location: { search: '?pz=1' }, console }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'v2/levels_pz.js'), 'utf8') + '\nthis.__L = window.LEVELS;', ctx);
const LV = ctx.__L;
let BOT = {}; try { BOT = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/puzzle/bot_results.json'), 'utf8')); } catch (e) { /* なし */ }

const COL = ['#C9A15E', '#E8563F', '#6FD6E8', '#58B368', '#8C6A3A', '#DCEBF3'];
const ENT = { walker: ['て', '#C0504D'], guard: ['こ', '#7F6000'], flyer: ['ふ', '#2E75B6'], bucket: ['塗', '#C55A11'], turret: ['た', '#404040'], div0: ['#', '#C00000'], autofill: ['オ', '#548235'], moji: ['文', '#7F7F7F'], condfmt: ['書', '#7030A0'], shuffler: ['並', '#2F5597'], circ: ['循', '#843C0C'], fake: ['偽', '#9E480E'] };
const esc = (s) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function svg(lv) {
  const C = 15, pad = 2, W = lv.w * C + pad * 2, H = lv.h * C + pad * 2; const X = (x) => pad + x * C, Y = (y) => pad + y * C;
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" style="width:min(100%,' + (lv.w * 22) + 'px);display:block;border:1px solid #C9D0E2;border-radius:2mm;background:#fff">';
  s += '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#FAFBFD"/>';
  for (let x = 0; x <= lv.w; x++) s += '<line x1="' + X(x) + '" y1="' + Y(0) + '" x2="' + X(x) + '" y2="' + Y(lv.h) + '" stroke="#E6EAF2" stroke-width=".5"/>';
  for (let y = 0; y <= lv.h; y++) s += '<line x1="' + X(0) + '" y1="' + Y(y) + '" x2="' + X(lv.w) + '" y2="' + Y(y) + '" stroke="#E6EAF2" stroke-width=".5"/>';
  // 列・行の目盛り
  for (let x = 0; x < lv.w; x += 5) s += '<text x="' + (X(x) + 1) + '" y="' + (Y(lv.h) + 0) + '" font-size="5" fill="#8E98B5" dy="-.5">' + x + '</text>';
  // リフトのレール
  for (const l of lv.lifts) { const x0 = Math.min(l.x, l.x + l.dx), y0 = Math.min(l.y, l.y + l.dy), x1 = Math.max(l.x, l.x + l.dx) + l.w, y1 = Math.max(l.y, l.y + l.dy) + 1; s += '<rect x="' + X(x0) + '" y="' + Y(y0) + '" width="' + (x1 - x0) * C + '" height="' + (y1 - y0) * C + '" fill="#E7F0FF" stroke="#7BA3E8" stroke-dasharray="2 2" stroke-width=".7"/>'; }
  for (let y = 0; y < lv.h; y++) for (let x = 0; x < lv.w; x++) {
    const ch = lv.front[y][x]; if (ch === '.') continue; const px = X(x), py = Y(y);
    if (ch === 'S') s += '<rect x="' + px + '" y="' + py + '" width="' + C + '" height="' + C + '" fill="#7A869F" stroke="#5B6781" stroke-width=".5"/>';
    else if (ch === '^') s += '<polygon points="' + px + ',' + (py + C) + ' ' + (px + C / 2) + ',' + py + ' ' + (px + C) + ',' + (py + C) + '" fill="#555"/>';
    else if (ch === 'M') s += '<rect x="' + px + '" y="' + py + '" width="' + C + '" height="' + C + '" fill="#B5495B"/><text x="' + (px + 4) + '" y="' + (py + 11) + '" font-size="9" fill="#fff">M</text>';
    else if (ch === 'c') s += '<rect x="' + px + '" y="' + py + '" width="' + C + '" height="' + C + '" fill="#8C6A3A" stroke="#4A3318" stroke-width=".6" stroke-dasharray="2 1"/>';
    else { const c = lv.color[y][x]; s += '<rect x="' + px + '" y="' + py + '" width="' + C + '" height="' + C + '" fill="' + COL[c] + '" stroke="' + (c === 5 ? '#9DB9C8' : '#00000040') + '" stroke-width=".6"/>'; if (lv.lock[y][x]) s += '<text x="' + (px + 3) + '" y="' + (py + 11) + '" font-size="9">🔒</text>'; }
  }
  // 判定セル・扉
  for (const j of lv.judges) { const col = j[2] === 'exist' ? '#8A4FD0' : j[2] === 'empty' ? '#4D4D4D' : COL[j[3]]; s += '<rect x="' + (X(j[0]) + 1) + '" y="' + (Y(j[1]) + 1) + '" width="' + (C - 2) + '" height="' + (C - 2) + '" fill="none" stroke="' + (j[2] === 'color' ? '#8A4FD0' : col) + '" stroke-width="1.6" stroke-dasharray="3 1.5"/><text x="' + (X(j[0]) + 2) + '" y="' + (Y(j[1]) + 10) + '" font-size="7" fill="#8A4FD0" font-weight="700">' + (j[2] === 'exist' ? '在' : j[2] === 'empty' ? '空' : '色') + (j[4] + 1) + '</text>'; }
  for (const d of lv.doors) s += '<rect x="' + (X(d[0]) + 4) + '" y="' + Y(d[1]) + '" width="7" height="' + d[2] * C + '" fill="#F2B100" fill-opacity=".55" stroke="#B38600"/><text x="' + (X(d[0]) + 2) + '" y="' + (Y(d[1]) + 10) + '" font-size="8" fill="#7F5F00" font-weight="700">扉' + (d[3] + 1) + '</text>';
  for (const l of lv.lifts) s += '<rect x="' + X(l.x) + '" y="' + Y(l.y) + '" width="' + l.w * C + '" height="' + C * .5 + '" fill="' + COL[l.col] + '" stroke="#333" stroke-width=".7"/>';
  // かけら・旗・スタート
  for (const g of lv.gems) s += '<text x="' + (X(g[0]) + 2) + '" y="' + (Y(g[1]) + 12) + '" font-size="12" fill="#C9A100" font-weight="700">Σ</text>';
  s += '<rect x="' + (X(lv.flag[0]) + 6) + '" y="' + (Y(lv.flag[1]) - C + 2) + '" width="2" height="' + 2 * C - 4 + '" fill="#333"/><polygon points="' + (X(lv.flag[0]) + 8) + ',' + (Y(lv.flag[1]) - C + 2) + ' ' + (X(lv.flag[0]) + 17) + ',' + (Y(lv.flag[1]) - C + 6) + ' ' + (X(lv.flag[0]) + 8) + ',' + (Y(lv.flag[1]) - C + 10) + '" fill="#2E8B57"/>';
  s += '<polygon points="' + (X(lv.start[0]) + 2) + ',' + (Y(lv.start[1]) + 14) + ' ' + (X(lv.start[0]) + 7.5) + ',' + (Y(lv.start[1]) + 2) + ' ' + (X(lv.start[0]) + 13) + ',' + (Y(lv.start[1]) + 14) + '" fill="#3E8EDE" fill-opacity=".85"/><text x="' + (X(lv.start[0]) + 3) + '" y="' + (Y(lv.start[1]) + 13) + '" font-size="6" fill="#fff" font-weight="700">ス</text>';
  // 敵
  for (const e of lv.ents) { const a = ENT[e.type] || ['?', '#000']; const cx = X(e.x) + C / 2, cy = Y(e.y) + C / 2;
    if (e.ranges) for (const r of e.ranges) s += '<rect x="' + X(Math.min(r[0], r[2])) + '" y="' + Y(Math.min(r[1], r[3])) + '" width="' + (Math.abs(r[2] - r[0]) + 1) * C + '" height="' + (Math.abs(r[3] - r[1]) + 1) * C + '" fill="' + a[1] + '" fill-opacity=".10" stroke="' + a[1] + '" stroke-dasharray="1 2" stroke-width=".8"/>';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="6.5" fill="' + a[1] + '" stroke="#fff" stroke-width="1"/><text x="' + cx + '" y="' + (cy + 3.5) + '" font-size="9.5" fill="#fff" text-anchor="middle" font-weight="700">' + a[0] + '</text>'; }
  // 解法の編集範囲(番号つき)
  const ed = lv.solution && lv.solution[0] ? lv.solution[0].edits : [];
  const tn = { painter: 'いろコピー', transform: 'かたち', sort: 'ならべかえ', filter: 'フィルター', protect: 'まもる', unprotect: 'まもりをはずす', printarea: '印刷範囲', zoom: 'ズーム' };
  ed.forEach((e, i) => { const n = '①②③④⑤⑥'[i];
    if (e.rect) { const r = e.rect; s += '<rect x="' + (X(r.x0) - 1) + '" y="' + (Y(r.y0) - 1) + '" width="' + (r.x1 - r.x0 + 1) * C + '" height="' + (r.y1 - r.y0 + 1) * C + '" fill="#1F6FEB" fill-opacity=".10" stroke="#1F6FEB" stroke-width="1.6" stroke-dasharray="4 2"/><text x="' + (X(r.x0)) + '" y="' + (Y(r.y0) - 2) + '" font-size="11" fill="#1F6FEB" font-weight="700" stroke="#fff" stroke-width=".2">' + n + '</text>'; }
    if (e.srcCell) s += '<circle cx="' + (X(e.srcCell[0]) + C / 2) + '" cy="' + (Y(e.srcCell[1]) + C / 2) + '" r="9" fill="none" stroke="#1F6FEB" stroke-width="1.6" stroke-dasharray="3 2"/><text x="' + (X(e.srcCell[0]) + 10) + '" y="' + (Y(e.srcCell[1]) - 1) + '" font-size="9" fill="#1F6FEB" font-weight="700">' + n + '見本</text>';
  });
  return s + '</svg>';
}

const CAT = require('./puzzle_ideas.js');
const css = `
@page { size: A4 landscape; margin: 11mm 13mm 13mm; }
* { box-sizing: border-box; }
body { font-family: "Yu Gothic UI","Yu Gothic","Meiryo","Noto Sans JP",sans-serif; color:#1F2A44; font-size:9.4pt; line-height:1.55; -webkit-print-color-adjust:exact; print-color-adjust:exact; margin:0; }
h1 { font-size:20pt; margin:0 0 3mm; border-bottom:3px solid #F5C842; padding-bottom:2mm; }
h2 { font-size:12.5pt; margin:0 0 1.5mm; border-left:4px solid #F5C842; padding-left:2.5mm; }
h3 { font-size:10.5pt; margin:2mm 0 1mm; color:#2F5597; }
p { margin:0 0 1.6mm; } ul { margin:0 0 1.5mm; padding-left:4.5mm; } li { margin:0 0 .5mm; }
.pg { page-break-after:always; } .pg:last-child { page-break-after:auto; }
.cols { display:grid; gap:6mm; } .c2 { grid-template-columns:1fr 1fr; } .c3 { grid-template-columns:1fr 1fr 1fr; }
.card { border:1px solid #DCE1EE; border-radius:2.5mm; padding:2.5mm 3.5mm 1mm; margin:0 0 3mm; break-inside:avoid; }
table { border-collapse:collapse; width:100%; font-size:8.6pt; margin:1mm 0 2.5mm; } th { background:#1F2A44; color:#fff; text-align:left; padding:1mm 2mm; } td { padding:1mm 2mm; border-bottom:1px solid #E3E7F0; vertical-align:top; } tr:nth-child(even) td { background:#F5F7FB; }
.tag { display:inline-block; background:#F5C842; color:#1F2A44; border-radius:99px; padding:0 2.5mm; font-size:7.8pt; font-weight:700; margin-right:1.5mm; }
.tag2 { display:inline-block; background:#E3EAFB; color:#2F5597; border-radius:99px; padding:0 2.2mm; font-size:7.8pt; margin-right:1mm; }
.star { color:#E0A100; letter-spacing:.1em; font-size:11pt; }
.ok { color:#1F7A4A; font-weight:700; } .muted { color:#6B7590; font-size:8pt; }
.cover { display:flex; flex-direction:column; justify-content:center; height:182mm; } .cover h1 { font-size:30pt; border:0; } .cover .sub { font-size:12pt; color:#6B7590; }
ol { margin:0 0 2mm; padding-left:5mm; } ol li { margin:0 0 1mm; }
.stg { page-break-after:always; } .stg:last-child { page-break-after:auto; }
.meta { font-size:8.6pt; color:#4A5570; }
.idea li b { color:#2F5597; }
`;

let h = '<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>パズル・アクション アイデア集とステージ集</title><style>' + css + '</style></head><body>';
// 表紙
h += '<section class="pg cover"><h1>パズル・アクション<br>アイデア集とステージ集</h1><p class="sub">エナーとふしぎのシート（v2）　編集機能・ブロック・敵キャラから考えた発想と、実際に遊べる検証済みステージ13面</p>'
  + '<p class="muted">この資料の盤面は、すべて遊べる形（v2/index.html?pz=1）で実装し、検証ボットが「ほんとうにクリアできる」ことを確かめたものです。<br>作成 2026-11-26 ／ 長さの単位は「マス」（1マス＝16px）。</p></section>';
// アイデア
for (const sec of CAT.sections) {
  h += '<section class="pg"><h1>' + esc(sec.title) + '</h1>' + (sec.lead ? '<p>' + esc(sec.lead) + '</p>' : '') + '<div class="cols c2">';
  for (const col of sec.cols) { h += '<div>'; for (const grp of col) { h += '<div class="card idea"><h2>' + esc(grp.h) + '</h2><ul>' + grp.items.map(t => '<li>' + t + '</li>').join('') + '</ul></div>'; } h += '</div>'; }
  h += '</div></section>';
}
// 検証と一覧
h += '<section class="pg"><h1>検証のしかたと、ステージ一覧</h1><p>人が遊ぶ前に、ステージが「ほんとうに解ける」ことを機械で確かめました。ゲームの本物の物理（歩き・ジャンプ・ふわり・ダメージ）を使い、解法の編集を適当なタイミングで挟みながら、左右・ジャンプの操作を探索（A*）して、旗までたどり着けるかを調べるボットです（scripts/stage_bot.js）。ダメージを受けた道は捨てるので、「ノーミスで」クリアできることも確認できています。</p>'
  + '<table><tr><th>面</th><th>名前</th><th>難しさ</th><th>使う道具・仕掛け</th><th>サイズ</th><th>コスト</th><th>ボットの結果</th></tr>';
for (const lv of LV) { const m = lv.meta, b = BOT[lv.id] || {}; const cost = lv.solution[0].edits.reduce((a, e) => a + ({ painter: 2, transform: 8, sort: 10, filter: e.fcolor === null ? 0 : 8, protect: 4, unprotect: 6, printarea: 6, zoom: 4 }[e.tool] || 0), 0);
  h += '<tr><td><b>' + lv.id + '</b></td><td>' + esc(lv.name) + '</td><td class="star">' + '★'.repeat(m.star) + '</td><td>' + (m.tags || []).map(t => '<span class="tag2">' + esc(t) + '</span>').join('') + '</td><td>' + lv.w + '×' + lv.h + '</td><td>' + (lv.energy ? cost + ' / ' + lv.energy : '編集なし') + '</td><td class="ok">' + (b.ok ? 'クリア確認（約' + b.sec + '秒・ノーミス）' : '未確認') + '</td></tr>'; }
h += '</table><p class="muted">コスト：解法に使う編集の合計 / ステージの上限。ボットの「秒」は、操作の長さ（ゲーム内の時間）。実際の人は、もっとゆっくり、あるいは別の手順で解いてもよい。</p></section>';
// ステージ
for (const lv of LV) {
  const m = lv.meta, b = BOT[lv.id] || {};
  const edits = lv.solution[0].edits; const tn = { painter: 'いろコピー', transform: 'かたち', sort: 'ならべかえ', filter: 'フィルター', protect: 'シートをまもる', unprotect: 'まもりをはずす', printarea: '印刷範囲の設定', zoom: 'ズーム' };
  const desc = (e) => { const o = { flipH: '左右反転', flipV: '上下反転', rot: '90°回転', L: '←よせ', R: 'よせ→', U: '↑よせ', D: 'よせ↓' }; const fc = ['茶', '赤', '青', '緑', 'ひび', 'ガラス']; let t = tn[e.tool]; if (e.opts) t += '（' + (o[e.opts.tf || e.opts.sort] || '') + '）'; if (e.tool === 'filter') t += e.fcolor === null ? '（外す）' : '（' + fc[e.fcolor] + 'を残す）'; if (e.rect) t += ' 範囲 x' + e.rect.x0 + '〜' + e.rect.x1 + ', y' + e.rect.y0 + '〜' + e.rect.y1; if (e.srcCell) t += ' 見本 (' + e.srcCell[0] + ',' + e.srcCell[1] + ')'; return t; };
  h += '<section class="stg"><h1>' + lv.id + '　' + esc(lv.name) + '　<span class="star">' + '★'.repeat(m.star) + '</span></h1>';
  h += '<p class="meta">' + (m.tags || []).map(t => '<span class="tag">' + esc(t) + '</span>').join('') + '　サイズ ' + lv.w + '×' + lv.h + '　使える道具：' + (lv.tools.length ? lv.tools.map(t => tn[t]).join('・') : 'なし（はばたきだけ）') + '　コスト上限 ' + lv.energy + '　かけら ' + lv.gems.length + '</p>';
  h += svg(lv);
  h += '<p class="muted" style="margin:1mm 0 2mm">凡例：灰＝鋼　茶/赤/青/緑＝セルの色　白青＝ガラス　🔒＝保護　Σ＝かけら　ス＝スタート　旗＝ゴール　青い点線の枠＝解法の編集範囲（①②…は編集の順）　敵：て＝てくてく こ＝かたいこうら ふ＝ふわふわ 塗＝塗りつぶし オ＝オートフィル 並＝並べ替え 偽＝にせブロック　在/色＝判定セル　扉＝扉</p>';
  h += '<div class="cols c2"><div><h2>ねらい</h2><p>' + esc(m.aim) + '</p><h2 style="margin-top:2mm">解法</h2>' + (m.steps && m.steps.length ? '<ol>' + m.steps.map(t => '<li>' + esc(t) + '</li>').join('') + '</ol>' : '<p>編集なし（はばたきだけ）。</p>') + '</div>'
    + '<div><h2>編集の手順（機械的な書き方）</h2>' + (edits.length ? '<ol>' + edits.map(e => '<li>' + esc(desc(e)) + '</li>').join('') + '</ol>' : '<p>なし</p>') + '<h2 style="margin-top:2mm">検証</h2><p><span class="ok">' + (b.ok ? 'ボットがノーミスでクリア' : '未確認') + '</span>' + (b.ok ? '（探索 ' + b.nodes + ' 手、操作の長さ 約' + b.sec + '秒、編集 ' + edits.length + ' 回）' : '') + '</p>'
    + (m.note ? '<p class="muted">' + esc(m.note) + '</p>' : '') + '<p class="muted">URL：…/v2/index.html?pz=1 のステージ選択から「' + lv.id + '」</p></div></div>';
  h += '</section>';
}
h += '</body></html>';
fs.mkdirSync(path.join(ROOT, 'docs/puzzle'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'docs/puzzle/puzzles.html'), h);
console.log('docs/puzzle/puzzles.html', h.length);
