// 使いかた: node scripts/export_levels.js <levels.js> <ステージID,ステージID,...> > 出力.js
// 体験版の 公開用に、えらんだ ステージだけの levels.js を つくる。想定の 解きかた(solution)は けす。
const fs = require('fs'), vm = require('vm');
const [src, ids] = process.argv.slice(2);
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(src, 'utf8'), sandbox);
const keep = ids.split(',');
const out = keep.map(id => { const l = sandbox.window.LEVELS.find(q => q.id === id); if (!l) throw new Error('no level ' + id); const c = JSON.parse(JSON.stringify(l)); c.solution = []; return c; });
process.stdout.write('/* エナーとふしぎのシート 体験版: ステージデータ */\nwindow.LEVELS = ' + JSON.stringify(out) + ';\n');
