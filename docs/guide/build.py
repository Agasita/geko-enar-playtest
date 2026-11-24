#!/usr/bin/env python3
"""ゲームガイド（PDF）を つくる。
 - guide.html を、ゲームの コードと いっしょに ひらいて、ゲーム画面を じどうで うつして ならべる
 - Microsoft Edge（または Chrome）の ヘッドレスで、A4よこの PDF に する
つかいかた:  python docs/guide/build.py  （PowerShell か コマンドプロンプトから。Git Bash では うごかないことが ある）
できるもの:  docs/V2_GAME_GUIDE.pdf
"""
import os, shutil, subprocess, sys, tempfile, threading, http.server, functools

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'docs', 'V2_GAME_GUIDE.pdf')
CANDIDATES = [
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    '/usr/bin/microsoft-edge', '/usr/bin/google-chrome', '/usr/bin/chromium',
]


def main():
    browser = next((c for c in CANDIDATES if os.path.exists(c)), None) or shutil.which('msedge') or shutil.which('chrome')
    if not browser:
        sys.exit('Edge か Chrome が みつかりません')
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    handler.log_message = lambda *a, **k: None
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    prof = tempfile.mkdtemp(prefix='guide_prof_')
    try:
        if os.path.exists(OUT):
            os.remove(OUT)
        subprocess.run([browser, '--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--user-data-dir=' + prof,
                        '--virtual-time-budget=240000', '--print-to-pdf=' + OUT, 'http://127.0.0.1:%d/docs/guide/guide.html' % port],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=300)
    finally:
        srv.shutdown(); shutil.rmtree(prof, ignore_errors=True)
    if not os.path.exists(OUT):
        sys.exit('PDF が つくれませんでした')
    print('できました:', OUT, os.path.getsize(OUT) // 1024, 'KB')


if __name__ == '__main__':
    main()
