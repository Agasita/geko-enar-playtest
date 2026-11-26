#!/usr/bin/env python3
"""BGM・ジングルの楽譜データを つくる。
  python3 scripts/make_music_data.py
→ v2/music_data.js（ゲームが よむ楽譜）と、music/*.mid（DTMで ひらく用）を 書きだす。
曲を かえたいときは、この ファイルの メロディ（MEL_*）・コード進行（PROG_*）を 直して、もういちど 実行する。

メロディの書き方: 1小節＝8つの「8分音符」。 音名(c5, f#5, bb4) / '-'=のばす / 'r'=休み
コード: C, Am, F, G7, Fmaj7, Em7, Gsus4 ... (1小節に1つ)
"""
import json, os, struct

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PC = {'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11}
QUAL = {'': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'maj7': [0, 4, 7, 11], 'm7': [0, 3, 7, 10], 'sus4': [0, 5, 7]}


def note(s):
    """'f#5' -> MIDI番号"""
    p = PC[s[0]]; i = 1
    while s[i] in '#b':
        p += 1 if s[i] == '#' else -1; i += 1
    return 12 * (int(s[i:]) + 1) + p


def chord(name):
    pc = PC[name[0].lower()]; i = 1
    while i < len(name) and name[i] in '#b':
        pc += 1 if name[i] == '#' else -1; i += 1
    pc %= 12
    return pc, QUAL[name[i:]]


def melody(bars):
    out = []
    for bi, b in enumerate(bars):
        toks = b.split(); assert len(toks) == 8, (bi, b)
        cur = None
        for i, t in enumerate(toks):
            if t == '-':
                if cur: cur[1] += 2
            else:
                cur = None
                if t != 'r':
                    cur = [bi * 16 + i * 2, 2, note(t)]; out.append(cur)
    return out


def flat(notes):
    r = []
    for s, l, m in notes: r += [s, l, m]
    return r


def arps(prog, step=2, pat3=(0, 1, 2, 1, 2, 1, 0, 1), pat4=(0, 1, 2, 3, 2, 1, 2, 1), up=12):
    out = []
    for bi, name in enumerate(prog):
        pc, iv = chord(name); base = 53 + ((pc - 5) % 12)
        ns = [base + x for x in iv]; pat = pat4 if len(ns) == 4 else pat3
        for i in range(16 // step): out.append((bi * 16 + i * step, step, ns[pat[i % len(pat)] % len(ns)] + up))
    return out


def pads(prog):
    out = []
    for bi, name in enumerate(prog):
        pc, iv = chord(name); base = 53 + ((pc - 5) % 12)
        for x in iv: out.append((bi * 16, 16, base + x))
    return out


def bass(prog, pat=((0, 6, 0), (6, 2, 7), (8, 6, 0), (14, 2, 7))):
    out = []
    for bi, name in enumerate(prog):
        pc, _ = chord(name); r = 36 + pc
        for s, l, off in pat: out.append((bi * 16 + s, l, r + off))
    return out


def bass8(prog):  # 8分で ルート・オクターブ
    out = []
    for bi, name in enumerate(prog):
        pc, _ = chord(name); r = 36 + pc
        for i, off in enumerate([0, 0, 12, 0, 0, 0, 12, 0]): out.append((bi * 16 + i * 2, 2, r + off))
    return out


def drums(bars, kick=(0, 8), snare=(4, 12), hat=2, kick2=()):
    k, s, h = [], [], []
    for b in range(bars):
        for i in range(16):
            if i in kick or i in kick2: k.append((b * 16 + i, 1, 0))
            if i in snare: s.append((b * 16 + i, 1, 0))
            if hat and i % hat == 0: h.append((b * 16 + i, 1, 0))
    return k, s, h


# ================= タイトル（FM・やさしい） 80BPM =================
MEL_TITLE = ["a5 - c6 - a5 - g5 -", "g5 - b5 - g5 - e5 -", "f5 - a5 - c6 - a5 f5", "d5 - g5 - b5 - - -",
             "c6 - a5 - c6 - d6 -", "e6 - b5 - g5 - b5 -", "a5 - c6 - e6 - c6 a5", "g5 - - - d5 - g5 b5",
             "a5 - f5 - a5 - c6 -", "b5 - d6 - b5 - g5 f5", "e5 - g5 - c6 - b5 -", "a5 - e5 - a5 - c6 e6",
             "d6 - c6 - a5 - f5 -", "g5 - b5 - d6 - f6 -", "e6 - - - d6 - c6 -", "d6 - - - r r r r"]
PROG_TITLE = ['Fmaj7', 'Em7', 'Dm7', 'G7', 'Fmaj7', 'Em7', 'Am7', 'G', 'Dm7', 'G7', 'Cmaj7', 'Am7', 'Dm7', 'G7', 'Cmaj7', 'Gsus4']
# ================= ステージ選択（FM・おだやか） 72BPM =================
MEL_SELECT = ["g5 - e5 - c5 - e5 -", "a5 - e5 - c5 - e5 -", "a5 - f5 - c5 - f5 -", "b5 - g5 - d5 - g5 b5",
              "c6 - g5 - e5 - g5 -", "e5 - a5 - c6 - b5 a5", "a5 - g5 - f5 - e5 -", "d5 - e5 - d5 - - -"]
PROG_SELECT = ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G']
# ================= ステージA（チップチューン・明るい） 128BPM =================
MEL_A = ["e5 - g5 - e5 d5 c5 -", "c5 - e5 - a5 - g5 e5", "a5 - c6 - a5 g5 f5 -", "g5 f5 e5 d5 g4 - b4 d5",
         "e5 - g5 - c6 - b5 g5", "a5 - e5 - c5 e5 a5 -", "f5 - a5 - d6 - c6 a5", "g5 - f5 e5 d5 - b4 d5",
         "f5 a5 c6 a5 f5 a5 c6 -", "d6 b5 g5 b5 d6 - b5 -", "e5 g5 b5 g5 e5 g5 b5 -", "c6 a5 e5 a5 c6 - e6 -",
         "a5 - f5 - c5 - f5 a5", "b5 - g5 - d5 - g5 b5", "c6 - e6 - g6 - e6 c6", "d6 - b5 - g5 - d5 -"]
PROG_A = ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm', 'G', 'F', 'G', 'Em', 'Am', 'F', 'G', 'C', 'G']
# ================= ステージB（FMポップ・はずむ） 108BPM  Gメジャー =================
MEL_B = ["b5 - d6 - b5 g5 a5 -", "g5 - b5 - e6 - d6 b5", "c6 - b5 - g5 - e5 g5", "a5 - f#5 - d5 - a5 -",
         "b5 - d6 - g6 - d6 b5", "e6 - b5 - g5 - b5 -", "a5 - c6 - e6 - c6 a5", "f#5 - a5 - d6 - c6 a5",
         "e6 - - g6 e6 - c6 -", "d6 - a5 - f#5 - a5 d6", "b5 - d6 - f#6 - d6 b5", "g6 - e6 - b5 - e6 -",
         "c6 - e6 - g6 - e6 c6", "d6 - a5 - d6 - f#6 -", "g6 - - - d6 - b5 -", "a5 - - - f#5 - a5 -"]
PROG_B = ['G', 'Em', 'C', 'D', 'G', 'Em', 'Am', 'D', 'C', 'D', 'Bm', 'Em', 'C', 'D', 'G', 'D']
# ================= ステージC（ふしぎ・Aマイナー） 112BPM =================
MEL_C = ["e6 - c6 - a5 - c6 e6", "f6 - c6 - a5 - c6 -", "e6 - g6 - e6 - c6 -", "d6 - b5 - g5 - b5 d6",
         "e6 - c6 - a5 - e6 -", "f6 - a6 - f6 - c6 a5", "d6 - f6 - a6 - f6 d6", "g#5 - b5 - e6 - d6 b5",
         "a5 - c6 - f6 - e6 c6", "b5 - d6 - g6 - f6 d6", "c6 - e6 - a6 - e6 c6", "a5 - c6 - e6 - - -",
         "f6 - e6 - c6 - a5 -", "g5 - b5 - d6 - b5 g5", "a5 - e6 - a6 - - -", "g#5 - b5 - d6 - e6 -"]
PROG_C = ['Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E7', 'F', 'G', 'Am', 'Am', 'F', 'G', 'Am', 'E7']

# ================= ステージ制作（チップチューン・スロー・おだやか） 66BPM  Aマイナー / 主旋律=矩形波 =================
MEL_EDIT = ["e5 - a5 - c6 - b5 -", "a5 - f5 - a5 - c6 -", "e6 - c6 - g5 - e5 -", "d5 - g5 - b5 - d6 -",
            "c6 - b5 - a5 - e5 -", "f5 - a5 - c6 - a5 -", "b5 - g5 - d5 - g5 b5", "e5 - - - g5 - b5 -",
            "a5 - c6 - f6 - e6 c6", "d6 - b5 - g5 - b5 d6", "c6 - e6 - a5 - c6 -", "e6 - - - c6 - g5 -",
            "a5 - c6 - a5 - f5 -", "g5 - b5 - d6 - b5 -", "e5 - g5 - c6 - e6 -", "d6 - - - b5 - r r"]
PROG_EDIT = ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'Em', 'F', 'G', 'Am', 'C', 'F', 'G', 'C', 'G']


def track(bpm, steps, voices, echo=False, gain=1.0):
    return {'bpm': bpm, 'steps': steps, 'echo': echo, 'gain': gain, 'voices': [[v[0], v[1], flat(v[2])] for v in voices if v[2]]}


def build():
    T = {}
    # --- タイトル
    k, s, h = drums(16, kick=(0, 10), snare=(4, 12), hat=2)
    T['title'] = track(80, 256, [('bell', .30, melody(MEL_TITLE)), ('ep', .11, arps(PROG_TITLE)), ('fmbass', .30, bass(PROG_TITLE)),
                                 ('pad', .022, pads(PROG_TITLE)), ('hat', .05, h), ('snare', .06, s), ('kick', .35, k)], echo=True, gain=0.85)
    # --- ステージ選択（ドラムなし）
    T['select'] = track(72, 128, [('bell', .26, melody(MEL_SELECT)), ('ep', .10, arps(PROG_SELECT)), ('fmbass', .26, bass(PROG_SELECT)),
                                  ('pad', .02, pads(PROG_SELECT))], echo=True, gain=1.1)
    # --- ステージA
    k, s, h = drums(16, kick=(0, 8), snare=(4, 12), hat=2)
    # FM音源（ステージBと同じ ベル・エレピ・FMベース）。ステージAだけ チップチューンっぽかったので そろえた
    T['stageA'] = track(128, 256, [('bell', .26, melody(MEL_A)), ('ep', .10, arps(PROG_A, step=2, pat3=(0, 1, 2, 1), pat4=(0, 1, 2, 1))),
                                   ('fmbass', .30, bass8(PROG_A)), ('kick', .2, k), ('snare', .16, s), ('hat', .05, h)], echo=True, gain=0.8)
    # --- ステージB
    k, s, h = drums(16, kick=(0, 6, 8), snare=(4, 12), hat=2)
    T['stageB'] = track(108, 256, [('bell', .26, melody(MEL_B)), ('ep', .10, arps(PROG_B)), ('fmbass', .30, bass8(PROG_B)),
                                   ('kick', .25, k), ('snare', .12, s), ('hat', .05, h)], echo=True, gain=0.65)
    # --- ステージC
    k, s, h = drums(16, kick=(0, 4, 8, 12), snare=(4, 12), hat=2, kick2=())
    T['stageC'] = track(112, 256, [('p25', .15, melody(MEL_C)), ('p12', .05, arps(PROG_C, step=1, pat3=(0, 1, 2, 1), pat4=(0, 1, 2, 3))),
                                   ('pad', .02, pads(PROG_C)), ('tri', .30, bass(PROG_C, pat=((0, 4, 0), (4, 4, 0), (8, 4, 0), (12, 2, 7), (14, 2, 0)))),
                                   ('kick', .18, k), ('snare', .12, s), ('hat', .04, h)], echo=True, gain=1.35)
    # --- ステージ制作（ドラムなし。矩形波の主旋律 + やわらかい矩形波アルペジオ + 三角波ベース）
    T['editor'] = track(66, 256, [('p25', .13, melody(MEL_EDIT)), ('p12', .05, arps(PROG_EDIT, step=4, pat3=(0, 1, 2, 1), pat4=(0, 1, 2, 3))),
                                  ('pad', .018, pads(PROG_EDIT)), ('tri', .26, bass(PROG_EDIT, pat=((0, 6, 0), (8, 6, 7))))], echo=True, gain=1.3)
    J = {}
    n = note
    J['clear'] = track(150, 16, [('p25', .17, [(0, 1, n('g5')), (1, 1, n('c6')), (2, 1, n('e6')), (3, 1, n('g6')), (4, 8, n('c7'))]),
                                 ('bell', .22, [(4, 10, n('c6')), (4, 10, n('e6')), (4, 10, n('g6'))]), ('fmbass', .25, [(0, 4, n('c3')), (4, 10, n('c3'))])], gain=0.9)
    J['perfect'] = track(150, 28, [('p25', .16, [(i, 1, n(x)) for i, x in enumerate(['c5', 'e5', 'g5', 'c6', 'e6', 'g6', 'c7'])] + [(8, 4, n('e7')), (12, 12, n('g6'))]),
                                   ('bell', .24, [(7, 18, n('c6')), (7, 18, n('e6')), (7, 18, n('g6')), (7, 18, n('c7'))]),
                                   ('ep', .12, [(12, 2, n('g6')), (14, 2, n('c7')), (16, 2, n('e7')), (18, 6, n('g7'))]), ('fmbass', .25, [(0, 7, n('c3')), (7, 18, n('c3'))])], gain=0.85)
    J['miss'] = track(110, 14, [('p25', .12, [(0, 2, n('g4')), (2, 2, n('e4')), (4, 2, n('c4')), (6, 8, n('g3'))]),
                                ('tri', .22, [(0, 2, n('g3')), (2, 2, n('e3')), (4, 2, n('c3')), (6, 8, n('g2'))])], gain=1.7)
    J['check'] = track(160, 6, [('bell', .20, [(0, 2, n('g5')), (2, 4, n('c6'))]), ('ep', .08, [(0, 2, n('g6')), (2, 4, n('c7'))])], gain=1.4)
    return T, J


def write_midi(path, tr, progs):
    TPQ = 480; T16 = TPQ // 4
    def vlq(v):
        b = [v & 0x7f]; v >>= 7
        while v: b.append((v & 0x7f) | 0x80); v >>= 7
        return bytes(reversed(b))
    chans = []
    for ch, (inst, vel, prog, drum) in enumerate(progs):
        v = next((x for x in tr['voices'] if x[0] == inst), None)
        if v: chans.append((9 if drum is not None else ch, prog, v, vel, drum))
    def trk(ch, prog, v, vel, drum):
        ev = [(0, bytes([0xC0 | ch, prog]))]; ns = v[2]
        for i in range(0, len(ns), 3):
            s, l, m = ns[i:i + 3]
            if drum is not None: m = drum
            ev.append((s * T16, bytes([0x90 | ch, m, vel]))); ev.append(((s + l) * T16 - 2, bytes([0x80 | ch, m, 0])))
        ev.sort(key=lambda x: x[0]); d = b''; t = 0
        for tt, b in ev: d += vlq(tt - t) + b; t = tt
        d += vlq(0) + b'\xff\x2f\x00'; return b'MTrk' + struct.pack('>I', len(d)) + d
    tempo = vlq(0) + b'\xff\x51\x03' + struct.pack('>I', int(60e6 / tr['bpm']))[1:] + vlq(0) + b'\xff\x2f\x00'
    tracks = [b'MTrk' + struct.pack('>I', len(tempo)) + tempo] + [trk(*c) for c in chans]
    open(path, 'wb').write(b'MThd' + struct.pack('>IHHH', 6, 1, len(tracks), TPQ) + b''.join(tracks))


MIDI_MAP = {  # 音色名: (ベロシティ, GMプログラム, ドラムなら音番号)
    'bell': (95, 11, None), 'p25': (95, 80, None), 'ep': (60, 4, None), 'p12': (55, 81, None), 'fmbass': (90, 33, None),
    'tri': (90, 38, None), 'pad': (40, 50, None), 'kick': (100, 0, 36), 'snare': (95, 0, 38), 'hat': (60, 0, 42)}


def main():
    T, J = build()
    js = '// 自動生成: scripts/make_music_data.py（このファイルは 直接 編集しない）\nwindow.MUSIC_DATA = ' + json.dumps({'tracks': T, 'jingles': J}, separators=(',', ':')) + ';\n'
    open(os.path.join(ROOT, 'v2', 'music_data.js'), 'w', encoding='utf-8').write(js)
    os.makedirs(os.path.join(ROOT, 'music'), exist_ok=True)
    for name, tr in T.items():
        progs = [(v[0],) + MIDI_MAP[v[0]] for v in tr['voices']]
        write_midi(os.path.join(ROOT, 'music', 'bgm_%s.mid' % name), tr, progs)
    print('v2/music_data.js:', len(js), 'bytes /', len(T), 'tracks,', len(J), 'jingles')


if __name__ == '__main__':
    main()
