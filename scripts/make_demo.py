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
    # 3b) あそびかたの せつめいを わかりやすく(「編集中」は ステージ作成と まぎらわしい ので「なおす中」)
    t = re.sub(r'<p class="keys">.*?</p>', '<p class="keys">PC：← → 移動／Z・Space はばたき（長押しでふわり）／E「なおす」（時間を止めてブロックを動かす）／R 最初から<br>「なおす」中：ドラッグで範囲を選ぶ／1〜9 道具／Z 戻す／Y やり直す　　スマホ：画面の ◀ ▶ とボタン</p>', t, count=1, flags=re.S)
    # 3c) SNSで ひらいた ときの カード(OGP)
    ogp = ('<meta property="og:type" content="website">\n<meta property="og:title" content="エナーとふしぎのシート 体験版">\n'
           '<meta property="og:description" content="時間を止めて、ブロックを動かして進むパズルアクション。体験版（8ステージ）を遊べます。">\n'
           '<meta property="og:image" content="https://agasita.github.io/geko-enar-playtest/demo/ogp.png">\n<meta name="twitter:card" content="summary_large_image">\n'
           '<meta name="description" content="時間を止めて、ブロックを動かして進むパズルアクション。体験版（8ステージ）。">')
    t = t.replace('<title>エナーとふしぎのシート 体験版</title>', '<title>エナーとふしぎのシート 体験版</title>\n' + ogp, 1)
    t = re.sub(r'\s*<p class="themes">.*?(?=\n\s*</section>)', '\n      <p class="demo-note">※ 体験版です。遊べるステージは一部で、自分でステージを作る機能は含まれません。</p>\n      <p class="credit">© 2026 agasita　絵・音・文章はすべて自作です（音はプログラムで作っています）。文字は、お使いの端末のフォントを使います。進み具合は、この端末のブラウザの中にだけ保存されます。</p>', t, count=1, flags=re.S)
    t = t.replace('<button id="btn-editor" class="ghost tiny">ステージを作る</button> ', '', 1)
    t = t.replace('<h2>ステージ選択</h2>', '<h2>ステージ選択（体験版）</h2>', 1)
    os.makedirs(os.path.join(ROOT, 'demo'), exist_ok=True)
    open(os.path.join(ROOT, 'demo', 'index.html'), 'w', encoding='utf-8').write(t)
    print('demo/index.html を つくりました（ステージ %d こ）' % len(STAGES))


if __name__ == '__main__':
    main()
