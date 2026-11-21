// BGM・ジングルの演奏エンジン（WebAudio）。楽譜は music_data.js（scripts/make_music_data.py で自動生成）。
// 音色: 矩形波(p25/p12)・三角波(tri)・FM(bell/ep/fmbass/pad)・ドラム(kick/snare/hat)
// 使い方: BGM.attach(ctxを返す関数, ミュート中か返す関数) → BGM.want('title') / BGM.jingle('clear') / BGM.duck(true)
(function () {
  'use strict';
  const D = window.MUSIC_DATA;
  if (!D) { window.BGM = null; return; }
  const MASTER = 0.3;       // BGM全体の音量（効果音とのバランスは ここで 調整）
  const DUCK_VOL = 0.28;    // 「なおす」中・ミス中の音量
  const DUCK_LP = 900;      // 同じく、こもらせる周波数
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // ---- 波形・ノイズ（コンテキストごとに1回つくる） ----
  const cache = new WeakMap();
  function res(ctx) {
    let r = cache.get(ctx); if (r) return r;
    const pulse = (d) => {
      const N = 32, re = new Float32Array(N), im = new Float32Array(N);
      for (let k = 1; k < N; k++) { re[k] = 2 / (k * Math.PI) * Math.sin(k * Math.PI * d); im[k] = 2 / (k * Math.PI) * (1 - Math.cos(k * Math.PI * d)); }
      return ctx.createPeriodicWave(re, im);
    };
    const nb = ctx.createBuffer(1, ctx.sampleRate >> 1, ctx.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    r = { p25: pulse(0.25), p12: pulse(0.125), noise: nb }; cache.set(ctx, r); return r;
  }

  // ---- 音色 ----
  const FM = {
    bell: { r: 1, i: 1.6, id: 2.2, ad: 0.9, at: 0.008, rl: 0.3, vib: 1 },
    ep: { r: 1, i: 2.2, id: 4, ad: 1.6, at: 0.005, rl: 0.2 },
    fmbass: { r: 1, i: 2.2, id: 5, ad: 0.5, at: 0.01, rl: 0.1 },
    pad: { r: 2, i: 0.6, id: 0.3, ad: 0, at: 0.5, rl: 0.6 },
  };
  function fmNote(ctx, out, p, t, dur, midi, vol, det) {
    const f = hz(midi) * (det || 1);
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    car.frequency.value = f; mod.frequency.value = f * p.r;
    mg.gain.setValueAtTime(p.i * f * p.r, t); mg.gain.setTargetAtTime(0, t, 1 / p.id);
    mod.connect(mg); mg.connect(car.frequency); car.connect(g); g.connect(out);
    const end = t + dur;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + p.at);
    if (p.ad > 0) g.gain.exponentialRampToValueAtTime(Math.max(vol * Math.exp(-p.ad * dur), 0.0001), Math.max(end, t + p.at + 0.01));
    else g.gain.setValueAtTime(vol, Math.max(end, t + p.at + 0.01));
    g.gain.setTargetAtTime(0, Math.max(end, t + p.at + 0.01), p.rl / 5);
    const stop = Math.max(end, t + p.at + 0.01) + p.rl + 0.1;
    car.start(t); mod.start(t); car.stop(stop); mod.stop(stop);
    if (p.vib) {
      const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5.2; lg.gain.value = f * 0.0035;
      l.connect(lg); lg.connect(car.frequency); l.start(t); l.stop(stop);
    }
  }
  function simple(ctx, out, type, t, dur, midi, vol, decayTo, tc) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    if (type === 'tri') o.type = 'triangle'; else o.setPeriodicWave(res(ctx)[type]);
    o.frequency.value = hz(midi); o.connect(g); g.connect(out);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.setTargetAtTime(vol * decayTo, t + 0.004, tc);
    g.gain.setTargetAtTime(0, t + dur, 0.015);
    o.start(t); o.stop(t + dur + 0.15);
  }
  function noiseHit(ctx, out, t, dur, vol, hp) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = res(ctx).noise; f.type = 'highpass'; f.frequency.value = hp;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.02);
  }
  function voice(ctx, out, inst, t, dur, midi, vol) {
    switch (inst) {
      case 'bell': case 'ep': case 'fmbass': fmNote(ctx, out, FM[inst], t, dur, midi, vol); break;
      case 'pad': fmNote(ctx, out, FM.pad, t, dur, midi, vol, 0.998); fmNote(ctx, out, FM.pad, t, dur, midi, vol, 1.002); break;
      case 'p25': simple(ctx, out, 'p25', t, dur * 0.92, midi, vol, 0.55, dur * 0.6); break;
      case 'p12': simple(ctx, out, 'p12', t, dur, midi, vol, 0.3, dur * 0.35); break;
      case 'tri': simple(ctx, out, 'tri', t, dur * 0.9, midi, vol, 0.6, dur); break;
      case 'kick': {
        const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.1);
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.18); break;
      }
      case 'snare': noiseHit(ctx, out, t, 0.11, vol * 1.6, 1500); break;
      case 'hat': noiseHit(ctx, out, t, 0.04, vol * 1.6, 6000); break;
    }
  }

  // ---- 曲の下ごしらえ ----
  function prep(tr) {
    if (tr._ev) return tr;
    tr.s16 = 60 / tr.bpm / 4; tr._ev = Array.from({ length: tr.steps }, () => []);
    tr.voices.forEach((v) => { const n = v[2]; for (let i = 0; i < n.length; i += 3) tr._ev[n[i]].push([v[0], v[1], n[i + 1], n[i + 2]]); });
    return tr;
  }
  function playStep(ctx, out, tr, step, t) { const ev = tr._ev[step]; for (let i = 0; i < ev.length; i++) voice(ctx, out, ev[i][0], t, ev[i][2] * tr.s16, ev[i][3], ev[i][1]); }
  // 曲ごとのバス（エコー付き）
  function makeBus(ctx, dest, tr) {
    const inp = ctx.createGain(), out = ctx.createGain(); inp.connect(out); out.connect(dest);
    if (tr.echo) {
      const d = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain(); d.delayTime.value = 0.34; fb.gain.value = 0.35; wet.gain.value = 0.3;
      inp.connect(d); d.connect(fb); fb.connect(d); d.connect(wet); wet.connect(out);
    }
    return { inp, out };
  }

  // ---- 再生の管理 ----
  let getCtx = () => null, isMuted = () => false;
  let wanted = null, wantedDelay = 0.15, cur = null, chain = null, duckOn = false, jingleUntil = 0;
  function ensureChain(ctx) {
    if (chain && chain.ctx === ctx) return chain;
    const master = ctx.createGain(), lp = ctx.createBiquadFilter(), jbus = ctx.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 18000; master.gain.value = MASTER; jbus.gain.value = MASTER;
    master.connect(lp); lp.connect(ctx.destination); jbus.connect(ctx.destination);
    chain = { ctx, master, lp, jbus }; applyDuck(); return chain;
  }
  function applyDuck() {
    if (!chain) return; const t = chain.ctx.currentTime, jg = performance.now() < jingleUntil;
    chain.master.gain.setTargetAtTime(jg ? 0.12 : (duckOn ? DUCK_VOL : MASTER), t, 0.06);
    chain.lp.frequency.setTargetAtTime(duckOn ? DUCK_LP : 18000, t, 0.08);
  }
  function startTrack(ctx, name, delay) {
    const tr = D.tracks[name]; if (!tr) return null; prep(tr);
    const c = ensureChain(ctx), bus = makeBus(ctx, c.master, tr), now = ctx.currentTime;
    bus.out.gain.setValueAtTime(0, now); bus.out.gain.linearRampToValueAtTime(tr.gain || 1, now + delay + 0.3);
    return { name, tr, bus, t0: now + delay + 0.05, n: 0 };
  }
  function stopTrack(c, fade) {
    const ctx = chain && chain.ctx; if (!ctx) return;
    c.bus.out.gain.cancelScheduledValues(ctx.currentTime); c.bus.out.gain.setTargetAtTime(0, ctx.currentTime, fade / 4);
    setTimeout(() => { try { c.bus.out.disconnect(); } catch (e) { /* ignore */ } }, fade * 1000 + 600);
  }
  function tick() {
    const ctx = getCtx(); if (!ctx || ctx.state !== 'running') return;
    ensureChain(ctx);
    if (jingleUntil && performance.now() >= jingleUntil) { jingleUntil = 0; applyDuck(); }
    if (isMuted()) { if (cur) { stopTrack(cur, 0.05); cur = null; } return; }
    if ((cur ? cur.name : null) !== wanted) {
      if (cur) { stopTrack(cur, 0.5); cur = null; }
      if (wanted) cur = startTrack(ctx, wanted, wantedDelay);
    }
    if (!cur) return;
    const s16 = cur.tr.s16, steps = cur.tr.steps;
    while (cur.t0 + cur.n * s16 < ctx.currentTime + 0.25) {
      const t = cur.t0 + cur.n * s16;
      if (t >= ctx.currentTime - 0.05) playStep(ctx, cur.bus.inp, cur.tr, cur.n % steps, t);
      cur.n++;
    }
  }
  setInterval(tick, 60);
  document.addEventListener('visibilitychange', () => { const c = getCtx(); if (!c) return; try { if (document.hidden) c.suspend(); else c.resume(); } catch (e) { /* ignore */ } });

  window.BGM = {
    attach(ctxFn, mutedFn) { getCtx = ctxFn; isMuted = mutedFn; },
    want(name, delay) { wanted = name || null; if (delay !== undefined) wantedDelay = delay; },
    duck(on) { on = !!on; if (on !== duckOn) { duckOn = on; applyDuck(); } },
    jingle(name) {
      const ctx = getCtx(), tr = D.jingles[name]; if (!ctx || !tr || ctx.state !== 'running' || isMuted()) return;
      prep(tr); const c = ensureChain(ctx), t0 = ctx.currentTime + 0.02, bus = makeBus(ctx, c.jbus, tr); bus.out.gain.value = tr.gain || 1;
      for (let s = 0; s < tr.steps; s++) playStep(ctx, bus.inp, tr, s, t0 + s * tr.s16);
      jingleUntil = performance.now() + (tr.steps * tr.s16 + 0.4) * 1000; applyDuck();
    },
    state() { return { wanted, playing: cur ? cur.name : null, ctx: (getCtx() || {}).state, duck: duckOn }; },
    names() { return { tracks: Object.keys(D.tracks), jingles: Object.keys(D.jingles) }; },
    // 試聴ファイル用: 曲(または ジングル)を 1周ぶん、じっさいの音色で 書きだす（OfflineAudioContext）
    render(name, sampleRate) {
      const tr = prep(D.tracks[name] || D.jingles[name]), sr = sampleRate || 44100, len = tr.steps * tr.s16 + 2.5;
      const ctx = new OfflineAudioContext(2, Math.ceil(len * sr), sr), out = ctx.createGain(); out.gain.value = MASTER; out.connect(ctx.destination);
      const bus = makeBus(ctx, out, tr); bus.out.gain.value = tr.gain || 1;
      for (let s = 0; s < tr.steps; s++) playStep(ctx, bus.inp, tr, s, 0.05 + s * tr.s16);
      return ctx.startRendering();
    },
  };
})();
