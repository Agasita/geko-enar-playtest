#!/usr/bin/env python3
"""体験版を、v2/index.html から つくる。
  python3 scripts/make_demo.py            -> demo/index.html（この リポジトリの 中で つかう版。ゲームの ほんたいは v2 を つかう）
  python3 scripts/build_demo_release.py   -> 体験版だけの 「公開用 フォルダ／zip」（べつの 公開リポジトリ 用）
v2/index.html を かえたら、もういちど これを 実行する。
"""
import os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STAGES = ['1-1', '1-2', '1-3', '2-1', '3-1', '4-1', '5-1', '5-2']   # 体験版で 遊べる ステージ(この じゅん)
AUTHOR = 'agasita'                                                   # 権利表記の 名前


def build_html(standalone=False, base_url='https://agasita.github.io/geko-enar-playtest/demo/', author=AUTHOR):
    t = open(os.path.join(ROOT, 'v2', 'index.html'), encoding='utf-8').read()
    # 1) ほんたいの ファイルの よみこみ先: リポジトリ内版=v2 / 公開用=おなじ フォルダ
    if not standalone:
        t = t.replace('<head>', '<head>\n<base href="../v2/">', 1)
    # 2) 体験版の せってい(game.js より さきに よむ)
    t = t.replace("<script>\n// まいかい", "<script>window.DEMO = { levels: %s };</script>\n<script>\n// まいかい" % repr(STAGES).replace("'", '"'), 1)
    # 3) タイトル・SNSカード
    t = re.sub(r'<title>.*?</title>', '<title>エナーとふしぎのシート 体験版</title>', t, count=1)
    ogp = ('<meta property="og:type" content="website">\n<meta property="og:title" content="エナーとふしぎのシート 体験版">\n'
           '<meta property="og:description" content="時間を止めて、ブロックを動かして進むパズルアクション。体験版（%d ステージ）を遊べます。">\n'
           '<meta property="og:image" content="%sogp.png">\n<meta name="twitter:card" content="summary_large_image">\n'
           '<meta name="description" content="時間を止めて、ブロックを動かして進むパズルアクション。体験版（%d ステージ）。">') % (len(STAGES), base_url, len(STAGES))
    t = t.replace('<title>エナーとふしぎのシート 体験版</title>', '<title>エナーとふしぎのシート 体験版</title>\n' + ogp, 1)
    t = t.replace('<h1>エナーと<span>ふしぎ</span>のシート</h1>', '<h1>エナーと<span>ふしぎ</span>のシート</h1>\n      <div class="demo-badge">体験版</div>', 1)
    # 4) あそびかた(「編集中」は ステージ作成と まぎらわしい ので「なおす中」)・権利表記。ステージ作成や ほかの 版への リンクは けす
    t = re.sub(r'<p class="keys">.*?</p>', '<p class="keys">PC：← → 移動／Z・Space はばたき（長押しでふわり）／E「なおす」（時間を止めてブロックを動かす）／R 最初から<br>「なおす」中：ドラッグで範囲を選ぶ／1〜9 道具／Z 戻す／Y やり直す　　スマホ：画面の ◀ ▶ とボタン</p>', t, count=1, flags=re.S)
    t = re.sub(r'\s*<p class="themes">.*?(?=\n\s*</section>)', '\n      <p class="credit">© 2026 %s　絵・音・文章はすべて自作です（音はプログラムで作っています）。文字は、お使いの端末のフォントを使います。進み具合は、この端末のブラウザの中にだけ保存されます。</p>' % author, t, count=1, flags=re.S)
    t = t.replace('<button id="btn-editor" class="ghost tiny">ステージを作る</button> ', '', 1)
    t = t.replace('<h2>ステージ選択</h2>', '<h2>ステージ選択（体験版）</h2>', 1)
    return t


def main():
    t = build_html()
    os.makedirs(os.path.join(ROOT, 'demo'), exist_ok=True)
    open(os.path.join(ROOT, 'demo', 'index.html'), 'w', encoding='utf-8').write(t)
    print('demo/index.html を つくりました（ステージ %d こ）' % len(STAGES))


if __name__ == '__main__':
    main()
