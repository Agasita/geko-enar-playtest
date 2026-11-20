#!/usr/bin/env python3
"""体験版(demo/index.html)を、v2/index.html から つくる。
 - ゲームの ほんたい(v2/*.js, style.css)は そのまま つかう(<base href="../v2/">)
 - ステージ作成・ほかのバージョンへの リンクを けす／ステージを 一部に しぼる／タイトルに「体験版」
v2/index.html を かえたら、もういちど これを 実行する:  python3 scripts/make_demo.py
"""
import os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STAGES = ['1-1', '1-2', '1-3', '2-1', '3-1', '4-1', '5-1', '5-2']   # 体験版で 遊べる ステージ(この じゅん)


def main():
    t = open(os.path.join(ROOT, 'v2', 'index.html'), encoding='utf-8').read()
    # 1) 同じ フォルダの ファイルを v2 から よむ
    t = t.replace('<head>', '<head>\n<base href="../v2/">', 1)
    # 2) 体験版の せってい(game.js より さきに よむ)
    t = t.replace("<script>\n// まいかい", "<script>window.DEMO = { levels: %s };</script>\n<script>\n// まいかい" % repr(STAGES).replace("'", '"'), 1)
    # 3) タイトル
    t = re.sub(r'<title>.*?</title>', '<title>エナーとふしぎのシート 体験版</title>', t, count=1)
    t = t.replace('<h1>エナーと<span>ふしぎ</span>のシート</h1>', '<h1>エナーと<span>ふしぎ</span>のシート</h1>\n      <div class="demo-badge">体験版</div>', 1)
    # 4) ステージ作成・テーマ・むかしのバージョンの リンクを けす
    t = re.sub(r'\s*<p class="themes">.*?(?=\n\s*</section>)', '\n      <p class="demo-note">※ 体験版です。遊べるステージは一部で、ステージを作る機能はありません。</p>', t, count=1, flags=re.S)
    t = t.replace('<button id="btn-editor" class="ghost tiny">ステージを作る</button> ', '', 1)
    t = t.replace('<h2>ステージ選択</h2>', '<h2>ステージ選択（体験版）</h2>', 1)
    os.makedirs(os.path.join(ROOT, 'demo'), exist_ok=True)
    open(os.path.join(ROOT, 'demo', 'index.html'), 'w', encoding='utf-8').write(t)
    print('demo/index.html を つくりました（ステージ %d こ）' % len(STAGES))


if __name__ == '__main__':
    main()
