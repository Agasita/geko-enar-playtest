#!/usr/bin/env python3
"""ゲーム内テキストの書き出し・取りこみ。

  python3 scripts/ingame_text.py export   -> docs/ingame_text.txt と docs/ingame_text_map.json を作る
  python3 scripts/ingame_text.py apply 修整ずみ.txt  -> 変えた行だけを、ソースにもどす

対象: v2/index.html(画面の文字), v2/game.js(メッセージ・どうぐ・ずかん), v2/levels.js(ステージ名・ヒント)
(コメントと、日本語を ふくまない 文字列は、対象外)
"""
import re, sys, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = ['v2/index.html', 'v2/game.js', 'v2/levels.js']
MAP = os.path.join(ROOT, 'docs', 'ingame_text_map.json')
OUT = os.path.join(ROOT, 'docs', 'ingame_text.txt')
JP = re.compile(r'[\u3040-\u30ff\u3400-\u9fff\uff00-\uffef]')


def read(rel):
    return open(os.path.join(ROOT, rel), encoding='utf-8').read()


def unescape(raw, q):
    out, i = [], 0
    while i < len(raw):
        c = raw[i]
        if c == '\\' and i + 1 < len(raw):
            n = raw[i + 1]
            out.append({'n': '\n', 't': '\t'}.get(n, n)); i += 2
        else:
            out.append(c); i += 1
    return ''.join(out)


def escape(text, q):
    s = text.replace('\\', '\\\\').replace('\n', '\\n').replace('\t', '\\t')
    return s.replace(q, '\\' + q)


def js_literals(src):
    """JSの 文字列リテラルを (start, end, quote, raw) で かえす。コメント・正規表現は とばす。"""
    res, i, n, prev = [], 0, len(src), ''
    while i < n:
        c = src[i]
        if c == '/' and i + 1 < n and src[i + 1] == '/':
            j = src.find('\n', i); i = n if j < 0 else j; continue
        if c == '/' and i + 1 < n and src[i + 1] == '*':
            j = src.find('*/', i + 2); i = n if j < 0 else j + 2; continue
        if c in '\'"`':
            q, j = c, i + 1
            while j < n:
                if src[j] == '\\': j += 2; continue
                if src[j] == q: break
                j += 1
            res.append((i + 1, j, q, src[i + 1:j])); i = j + 1; prev = q; continue
        if c == '/' and prev in ('', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>'):
            j, incls = i + 1, False
            while j < n:
                if src[j] == '\\': j += 2; continue
                if src[j] == '[': incls = True
                elif src[j] == ']': incls = False
                elif src[j] == '/' and not incls: break
                elif src[j] == '\n': break
                j += 1
            i = j + 1; prev = ')'; continue
        if not c.isspace(): prev = c
        i += 1
    return res


def html_texts(src):
    """HTMLの 文字(タグの あいだ・属性の title/aria-label/placeholder)。<script>と<style>の中は とばす。"""
    res = []
    # script/style を さけた 区間
    spans, pos = [], 0
    for m in re.finditer(r'<(script|style)\b.*?</\1>', src, flags=re.S | re.I):
        spans.append((pos, m.start())); pos = m.end()
    spans.append((pos, len(src)))
    for a, b in spans:
        seg = src[a:b]
        for m in re.finditer(r'>([^<>]+)<', seg):
            t = m.group(1)
            if JP.search(t) and t.strip():
                s = a + m.start(1); lead = len(t) - len(t.lstrip()); trail = len(t.rstrip())
                res.append((s + lead, s + trail, '', t.strip()))
        for m in re.finditer(r'(?:aria-label|title|placeholder|alt)="([^"]*)"', seg):
            if JP.search(m.group(1)):
                res.append((a + m.start(1), a + m.end(1), '"', m.group(1)))
    # 文字列の ちゅうの <br> などを ふくむ <p>... は、タグで 分かれて 出る
    res.sort()
    return res


def line_of(src, pos):
    return src.count('\n', 0, pos) + 1


def context(rel, src, start, q):
    if rel.endswith('levels.js'):
        before = src[:start]
        ids = re.findall(r"id: '([^']+)'", before)
        lvl = ids[-1] if ids else ''
        line = src[src.rfind('\n', 0, start) + 1:start].rstrip('\'"`')
        kind = 'なまえ' if re.search(r"name:\s*$", line) else ('ヒント' if re.search(r"text:\s*$", line) else '')
        if not kind and re.search(r"name:", line): kind = 'なまえ'
        return 'ステージ %s %s' % (lvl, kind) if kind else 'ステージ %s' % lvl
    if rel.endswith('index.html'):
        sec = re.findall(r'<(?:section|div|aside) id="([^"]+)"', src[:start])
        names = {'screen-title': 'タイトル画面', 'screen-select': 'ステージえらび画面', 'screen-guide': 'ブロックのずかん画面', 'screen-result': 'クリア画面', 'ribbon': '上のバー(リボン)', 'rb-bar': '上のバー(リボン)', 'pane': 'ペイン(キー操作のせつめい)', 'touch': 'タッチボタン', 'editbar': 'なおす画面', 'hud': 'ゲーム中の表示', 'game': 'ゲーム画面', 'stage': 'ゲーム画面'}
        key = sec[-1] if sec else ''
        for k in reversed(sec):
            if k in names: key = k; break
        return names.get(key, key or 'ページ')
    line = src[src.rfind('\n', 0, start) + 1:start].rstrip('\'"`')
    key = re.search(r"(\w+):\s*$", line) or re.search(r"(\w+)\(\s*$", line)
    ident = re.findall(r"id: '(\w+)'", line)
    k = key.group(1) if key else ''
    names = {'n': 'なまえ', 'fx': 'せつめい', 'name': 'なまえ', 'help': 'せつめい', 'label': 'ボタンの もじ', 'text': 'ことば', 'fail': 'できないとき の メッセージ', 'toast': 'おしらせ(ふきだし)', 'msg': 'メッセージ', 'hint': 'ヒント'}
    ids = re.findall(r"id: '(\w+)'", src[max(0, start - 400):start])
    base = names.get(k, k or re.sub(r'\s+', ' ', line.strip())[-26:])
    return (base + ('  (' + ids[-1] + ')' if ids and k in ('name', 'help') else '')).strip()


def extract():
    items = []
    for rel in FILES:
        src = read(rel)
        lits = html_texts(src) if rel.endswith('.html') else [x for x in js_literals(src)]
        seen = {}
        for (s, e, q, raw) in lits:
            if not JP.search(raw): continue
            text = raw if rel.endswith('.html') else unescape(raw, q)
            if rel.endswith('.html') and q == '"': text = raw
            k = seen.get((rel, text), 0); seen[(rel, text)] = k + 1
            items.append({'file': rel, 'line': line_of(src, s), 'q': q, 'text': text, 'k': k, 'ctx': context(rel, src, s, q)})
    for n, it in enumerate(items, 1): it['id'] = 'T%04d' % n
    return items


def export():
    items = extract()
    json.dump({it['id']: it for it in items}, open(MAP, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    head = ['# ゲーム内テキスト 一覧（ゲコ＆エナー v2）',
            '# 書きかた: 「[T0001] …」の 次の 行が 本文。本文だけ 直してください（[Txxxx] の 行は 変えない・消さない）。',
            '# ・本文の「\\n」は 改行の しるしです（そのまま のこす）。',
            '# ・「▼」から はじまる 行は せつめい です（直しても はんえい されません）。',
            '# ・数字や 文字を つなげて 出す 文（例:「びょう　ダメージ」）は、ほかの ことばと 組み合わさって 表示されます。',
            '# ・ステージの なまえ・ヒント、どうぐの せつめい、メッセージ、タイトル画面 などを ふくみます。',
            '# 合計 %d こ' % len(items), '']
    cur = None
    body = []
    for it in items:
        sec = {'v2/index.html': '【画面の 文字（タイトル・ステージえらび・ずかん・けっか など）】', 'v2/game.js': '【ゲームの 文言（どうぐ・メッセージ・ずかん・ボタン など）】', 'v2/levels.js': '【ステージの なまえ・ヒント】'}[it['file']]
        if sec != cur: body += ['', '=' * 40, sec, '=' * 40, '']; cur = sec
        body.append('▼ %s:%d  %s' % (it['file'].split('/')[-1], it['line'], it['ctx']))
        body.append('[%s] %s' % (it['id'], it['text'].replace('\n', '\\n')))
        body.append('')
    open(OUT, 'w', encoding='utf-8').write('\n'.join(head + body))
    print('書き出し:', len(items), 'こ ->', OUT)


def apply(path):
    amap = json.load(open(MAP, encoding='utf-8'))
    edited = {}
    for line in open(path, encoding='utf-8').read().split('\n'):
        m = re.match(r'^\[(T\d{4})\] ?(.*)$', line)
        if m: edited[m.group(1)] = m.group(2).replace('\\n', '\n')
    changes = {}
    for tid, text in edited.items():
        if tid not in amap: print('！ しらない ID:', tid); continue
        if text != amap[tid]['text']: changes.setdefault(amap[tid]['file'], []).append((amap[tid], text))
    if not changes: print('へんこうは ありません'); return
    total = 0
    for rel, lst in changes.items():
        src = read(rel)
        lits = html_texts(src) if rel.endswith('.html') else js_literals(src)
        cand = {}
        for (s, e, q, raw) in lits:
            if not JP.search(raw): continue
            text = raw if rel.endswith('.html') else unescape(raw, q)
            cand.setdefault(text, []).append((s, e, q))
        edits = []
        for it, new in lst:
            pos = cand.get(it['text'], [])
            if it['k'] >= len(pos): print('！ みつかりません（ソースが かわった？）:', it['id'], it['text'][:30]); continue
            s, e, q = pos[it['k']]
            if rel.endswith('.html'):
                if q == '"': repl = new.replace('"', '&quot;')
                else: repl = new.replace('&', '&amp;') if '&amp;' not in it['text'] else new
            else:
                repl = escape(new, q)
            edits.append((s, e, repl, it['id']))
        for s, e, repl, tid in sorted(edits, reverse=True):
            src = src[:s] + repl + src[e:]; total += 1
        open(os.path.join(ROOT, rel), 'w', encoding='utf-8').write(src)
    print('はんえい:', total, 'こ')
    export()  # 新しい 状態で 書きなおす


if __name__ == '__main__':
    if len(sys.argv) >= 2 and sys.argv[1] == 'export': export()
    elif len(sys.argv) >= 3 and sys.argv[1] == 'apply': apply(sys.argv[2])
    else: print(__doc__)
