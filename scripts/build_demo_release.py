#!/usr/bin/env python3
"""体験版の「公開用フォルダ」を つくる（べつの 公開リポジトリに そのまま のせる ため）。
  python3 scripts/build_demo_release.py [--url https://ユーザー名.github.io/リポジトリ名/] [--author 名前]
できるもの: dist/demo-release/（と dist/enar-sheet-demo.zip）
  - 体験版に ひつような ファイルだけ（ステージ作成・ほかの ステージ・設計メモ・古い版・想定の 解きかた は ふくまない）
  - index.html は ふつうの 1フォルダ構成（<base>なし）。そのまま GitHub Pages で ひらける。
"""
import os, sys, shutil, subprocess, zipfile, argparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'scripts'))
import make_demo  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--url', default='https://agasita.github.io/enar-sheet-demo/')
    ap.add_argument('--author', default=make_demo.AUTHOR)
    a = ap.parse_args()
    url = a.url if a.url.endswith('/') else a.url + '/'
    out = os.path.join(ROOT, 'dist', 'demo-release')
    shutil.rmtree(out, ignore_errors=True); os.makedirs(out)
    # 1) ほんたいの ファイル(げんてい の ステージは levels.js を つくりなおす)
    for f in ['sprites.js', 'gfx_snes.js', 'gfx_excel.js', 'music_data.js', 'music.js', 'game.js', 'style.css']:
        shutil.copy(os.path.join(ROOT, 'v2', f), os.path.join(out, f))
    lv = subprocess.run(['node', os.path.join(ROOT, 'scripts', 'export_levels.js'), os.path.join(ROOT, 'v2', 'levels.js'), ','.join(make_demo.STAGES)], capture_output=True, text=True, check=True).stdout
    open(os.path.join(out, 'levels.js'), 'w', encoding='utf-8').write(lv)
    # 2) ページ・SNS画像
    open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(make_demo.build_html(standalone=True, base_url=url, author=a.author))
    shutil.copy(os.path.join(ROOT, 'demo', 'ogp.png'), os.path.join(out, 'ogp.png'))
    open(os.path.join(out, '.nojekyll'), 'w').write('')
    open(os.path.join(out, 'README.md'), 'w', encoding='utf-8').write(
        '# エナーとふしぎのシート 体験版\n\n時間を止めて、ブロックを動かして進むパズルアクションの体験版です。\n\n- 遊ぶ: %s\n\n'
        '© 2026 %s　絵・音・文章はすべて自作です。無断転載・転用はご遠慮ください。\n' % (url, a.author))
    # 3) zip
    zp = os.path.join(ROOT, 'dist', 'enar-sheet-demo.zip')
    if os.path.exists(zp): os.remove(zp)
    with zipfile.ZipFile(zp, 'w', zipfile.ZIP_DEFLATED) as z:
        for dp, _, fs in os.walk(out):
            for f in fs:
                p = os.path.join(dp, f); z.write(p, os.path.relpath(p, out))
    print('つくりました:', out); print('zip:', zp); print('ファイル:', sorted(os.listdir(out)))


if __name__ == '__main__':
    main()
