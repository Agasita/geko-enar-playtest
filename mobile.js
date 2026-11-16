(() => {
  'use strict';
  const frame = document.querySelector('#game');
  const gameArea = document.querySelector('.game-area');
  function fitGame() {
    frame.style.setProperty('--game-scale',Math.min(gameArea.clientWidth/960,gameArea.clientHeight/540));
  }
  new ResizeObserver(fitGame).observe(gameArea);
  fitGame();
  // 画風: URLの ?theme=classic|soft|flat をゲームへ引き継ぐ(未指定ならゲーム側の既定)。
  const theme = ['classic','soft','flat'].find(name=>name===new URLSearchParams(location.search).get('theme'))||'';
  if (theme) document.documentElement.dataset.theme = theme;
  const pointers = new Map();
  const keys = new Map();
  let started = false, desiredMode = 'exploration', selectedMode = false;
  let state = {}, helperPaused = false, startedAt = 0;
  const codes = {ArrowLeft:37,ArrowUp:38,ArrowRight:39,ArrowDown:40,Space:32,Enter:13,Tab:9,ShiftLeft:16,KeyJ:74,KeyE:69,KeyF:70,KeyA:65,KeyK:75,KeyZ:90,KeyB:66,KeyC:67,KeyI:73,KeyM:77,KeyW:87,KeyU:85,KeyD:68,KeyH:72,KeyV:86,KeyR:82,F2:113};
  function emit(code, down) {
    try {
      const win = frame.contentWindow;
      const target = win.document.querySelector('canvas') || win.document;
      const key = code.startsWith('Key') ? code.slice(3).toLowerCase() : code==='Space' ? ' ' : code==='ShiftLeft' ? 'Shift' : code;
      target.dispatchEvent(new win.KeyboardEvent(down?'keydown':'keyup', {key,code,keyCode:codes[code],which:codes[code],location:code==='ShiftLeft'?1:0,bubbles:true,cancelable:true}));
    } catch (_) { /* 起動前・再読み込み中は入力を送らない。 */ }
  }
  function hold(code, id) {
    if (!started || !codes[code]) return;
    let owners = keys.get(code);
    if (!owners) { owners = new Set(); keys.set(code,owners); emit(code,true); }
    owners.add(id);
  }
  function release(code,id) {
    const owners = keys.get(code);
    if (!owners) return;
    owners.delete(id);
    if (!owners.size) { keys.delete(code); emit(code,false); }
  }
  function releaseAll() {
    for (const code of keys.keys()) emit(code,false);
    keys.clear(); pointers.clear();
    document.querySelectorAll('.pressed').forEach(el=>el.classList.remove('pressed'));
  }
  function pulse(code) {
    const id = `pulse-${code}-${performance.now()}`;
    hold(code,id); setTimeout(()=>release(code,id),90);
  }
  for (const button of document.querySelectorAll('[data-key]')) {
    button.addEventListener('pointerdown',event=>{
      if (event.button>0) return;
      event.preventDefault();
      const code = button.dataset.key;
      pointers.set(event.pointerId,{button,code});
      button.setPointerCapture(event.pointerId);
      button.classList.add('pressed');
      hold(code,event.pointerId);
    });
    const end = event=>{
      const held = pointers.get(event.pointerId);
      if (!held) return;
      release(held.code,event.pointerId); pointers.delete(event.pointerId);
      if (![...pointers.values()].some(p=>p.button===button)) button.classList.remove('pressed');
    };
    button.addEventListener('pointerup',end);
    button.addEventListener('pointercancel',end);
    button.addEventListener('lostpointercapture',end);
    button.addEventListener('contextmenu',event=>event.preventDefault());
  }
  window.addEventListener('keydown',event=>{
    if (!started || document.querySelector('#help-dialog').open || !codes[event.code]) return;
    event.preventDefault();
    hold(event.code,'keyboard');
  });
  window.addEventListener('keyup',event=>{ if(codes[event.code]) {event.preventDefault();release(event.code,'keyboard');} });
  window.addEventListener('blur',()=>{ if(document.activeElement!==frame) releaseAll(); });
  document.addEventListener('visibilitychange',()=>{ if(document.hidden) releaseAll(); });
  window.addEventListener('pagehide',releaseAll);
  document.addEventListener('contextmenu',event=>event.preventDefault());

  function launch(mode) {
    releaseAll(); desiredMode=mode; selectedMode=false; state={}; started=true; startedAt=performance.now();
    document.querySelector('#launch-screen').hidden=true;
    document.querySelector('#loading').hidden=false;
    document.querySelector('#retry').hidden=true;
    document.querySelector('#loading-detail').textContent='最初の読み込みには時間がかかる場合があります。';
    frame.src=`game.html?v=2d50a8f0da8a${theme?'&theme='+theme:''}`;
  }
  document.querySelectorAll('.launch').forEach(button=>button.addEventListener('click',()=>launch(button.dataset.mode)));
  document.querySelector('#retry').addEventListener('click',()=>launch(desiredMode));
  function refreshGame() {
    releaseAll();
    const url=new URL(location.href);
    url.searchParams.set('update',Date.now().toString(36));
    location.replace(url.href);
  }
  document.querySelector('#refresh-game').addEventListener('click',refreshGame);
  document.querySelector('.brand').addEventListener('click',event=>{event.preventDefault();refreshGame();});
  document.querySelector('#fullscreen').addEventListener('click',async()=>{
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else document.querySelector('#touch-hint').textContent='Safariでは共有メニューから「ホーム画面に追加」すると広く表示できます。';
    } catch (_) { document.querySelector('#touch-hint').textContent='端末を横持ちにすると画面を広く使えます。'; }
  });
  const dialog = document.querySelector('#help-dialog');
  document.querySelector('#show-help').addEventListener('click',()=>{
    releaseAll();
    helperPaused = started && state.ready && !state.menu && !state.help && !state.dialogue && !state.map;
    if(helperPaused) pulse('KeyH');
    dialog.showModal();
  });
  function closeHelp() { dialog.close(); }
  document.querySelector('#close-help').addEventListener('click',closeHelp);
  dialog.addEventListener('close',()=>{releaseAll();if(helperPaused) pulse('KeyH');helperPaused=false;});

  function updateControls(next) {
    state=next;
    document.body.classList.toggle('editing',!!state.editing);
    document.querySelectorAll('.edit-only').forEach(el=>el.hidden=!state.editing || state.menu);
    document.querySelectorAll('.menu-only').forEach(el=>el.hidden=!state.menu);
    document.querySelectorAll('.play-only').forEach(el=>el.hidden=!!state.editing || !!state.menu);
    document.querySelector('#stage-name').textContent=state.menu?'ステージを選ぶ':state.stage;
    const jump=document.querySelector('#jump'), attack=document.querySelector('#attack'), interact=document.querySelector('#interact');
    jump.dataset.key=state.cleared?'Enter':'Space';
    jump.textContent=state.cleared?'次へ':state.editing?'実行':state.menu?'選ぶ':'ジャンプ';
    interact.textContent=state.editing?'マージ／範囲':state.dialogue?'会話を進める':'調べる／話す';
    attack.hidden=!!state.editing || !!state.menu;
    document.querySelector('#edit').textContent=state.editing?'編集を終える':'編集';
    document.querySelector('#map').textContent=state.map?'地図を閉じる':'地図';
    document.querySelector('#touch-hint').textContent=state.editing?'マージ／範囲を押し続け＋方向キーで範囲選択。離すと確定。':state.menu?'方向キーの上下でステージを選び、「選ぶ」で開始。':state.dialogue?'「会話を進める」で次のセリフへ。':state.cleared?'「次へ」で進むか、ステージ一覧へ戻れます。':'方向キー＋ジャンプ。ダッシュを押しながら移動。';
  }
  setInterval(()=>{
    if(!started) return;
    try {
      if(!state.ready && frame.contentWindow.document.querySelector('#pyxel-prompt')) {
        document.querySelector('#loading').hidden=true;
        document.querySelector('#stage-name').textContent='画面をタップして開始';
        document.querySelector('#touch-hint').textContent='中央のゲーム画面を一度タップすると開始します。';
      }
      const raw=frame.contentWindow.gekoState;
      if(raw) {
        const next=typeof raw==='string'?JSON.parse(raw):raw;
        if(next.ready) {
          document.querySelector('#loading').hidden=true;
          updateControls(next);
          if(!selectedMode && next.menu) {selectedMode=true;pulse(desiredMode==='vertical'?'KeyU':desiredMode==='exploration'?'KeyW':'KeyD');}
        }
      }
    } catch (_) { /* ページの切替中は次回の更新を待つ。 */ }
    if(!state.ready && performance.now()-startedAt>90000) {
      document.querySelector('#loading-detail').textContent='読み込みに時間がかかっています。通信状態を確認し、しばらく待つか再読み込みしてください。';
      document.querySelector('#retry').hidden=false;
    }
  },100);
  window.addEventListener('message',event=>{
    if(event.source!==frame.contentWindow || event.origin!==location.origin) return;
    try {
      const message=typeof event.data==='string'?JSON.parse(event.data):event.data;
      if(message.type==='geko-error' && !state.ready) {
        document.querySelector('#loading-detail').textContent='ゲームを読み込めませんでした。通信状態を確認して、もう一度読み込んでください。';
        document.querySelector('#retry').hidden=false;
      }
    } catch (_) {}
  });
})();
