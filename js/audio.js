/* 소리: 바람, 나뭇잎, 새·갈매기, 폭포, 파도, 차·보트 엔진, 물속 먹먹함. 파일 없이 브라우저에서 직접 만든다 */
(function (T) {
  let ctx = null, master, muffle, wind, windFilter, leaves, fallLow, fallHigh, fallPan, engine, engineGain, engineFilter, surf, surfFilter, noiseBuf;
  let enabled = true, started = false, amb = { wind: 0.1, birds: false, surf: 0 };
  let nextBird = 0, nextBubble = 0;

  function makeNoise() {
    const len = ctx.sampleRate * 3;
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w * 0.6 + last * 3; }
    return b;
  }
  function loop() { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.start(); return s; }
  function panner(v) { const p = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain(); if (p.pan) p.pan.value = v; return p; }

  function start() {
    if (started || !enabled) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { return; }
    started = true;
    noiseBuf = makeNoise();
    master = ctx.createGain(); master.gain.value = 0.8;
    muffle = ctx.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 18000;
    master.connect(muffle); muffle.connect(ctx.destination);

    windFilter = ctx.createBiquadFilter(); windFilter.type = 'lowpass'; windFilter.frequency.value = 420; windFilter.Q.value = 0.8;
    wind = ctx.createGain(); wind.gain.value = 0;
    loop().connect(windFilter); windFilter.connect(wind); wind.connect(master);

    const lf = ctx.createBiquadFilter(); lf.type = 'bandpass'; lf.frequency.value = 3200; lf.Q.value = 0.5;
    leaves = ctx.createGain(); leaves.gain.value = 0;
    loop().connect(lf); lf.connect(leaves); leaves.connect(master);

    fallPan = panner(0); fallPan.connect(master);
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 900;
    fallLow = ctx.createGain(); fallLow.gain.value = 0;
    loop().connect(fl); fl.connect(fallLow); fallLow.connect(fallPan);
    const fh = ctx.createBiquadFilter(); fh.type = 'bandpass'; fh.frequency.value = 2400; fh.Q.value = 0.6;
    fallHigh = ctx.createGain(); fallHigh.gain.value = 0;
    loop().connect(fh); fh.connect(fallHigh); fallHigh.connect(fallPan);

    surfFilter = ctx.createBiquadFilter(); surfFilter.type = 'lowpass'; surfFilter.frequency.value = 700;
    surf = ctx.createGain(); surf.gain.value = 0;
    loop().connect(surfFilter); surfFilter.connect(surf); surf.connect(master);

    engine = ctx.createOscillator(); engine.type = 'sawtooth'; engine.frequency.value = 45;
    engineFilter = ctx.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 380;
    engineGain = ctx.createGain(); engineGain.gain.value = 0;
    engine.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(master);
    engine.start();
    nextBird = ctx.currentTime + 1.5;
  }

  function chirp() {
    const t0 = ctx.currentTime + 0.02;
    const pan = panner(Math.random() * 1.6 - 0.8); pan.connect(master);
    const notes = 2 + Math.floor(Math.random() * 4), base = 2200 + Math.random() * 1800;
    for (let i = 0; i < notes; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      const st = t0 + i * (0.09 + Math.random() * 0.08), du = 0.06 + Math.random() * 0.07;
      const f0 = base * (0.85 + Math.random() * 0.4);
      o.frequency.setValueAtTime(f0, st);
      o.frequency.exponentialRampToValueAtTime(f0 * (1.2 + Math.random() * 0.5), st + du);
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(0.035, st + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, st + du);
      o.connect(g); g.connect(pan);
      o.start(st); o.stop(st + du + 0.02);
    }
  }
  function gull() {
    const t0 = ctx.currentTime + 0.02;
    const pan = panner(Math.random() * 1.6 - 0.8); pan.connect(master);
    const calls = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < calls; i++) {
      const st = t0 + i * 0.32, du = 0.26;
      const o = ctx.createOscillator(), g = ctx.createGain(), bp = ctx.createBiquadFilter();
      o.type = 'sawtooth'; bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 2.5;
      const f0 = 1500 + Math.random() * 300;
      o.frequency.setValueAtTime(f0 * 0.75, st);
      o.frequency.linearRampToValueAtTime(f0, st + 0.05);
      o.frequency.exponentialRampToValueAtTime(f0 * 0.55, st + du);
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(0.03, st + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, st + du);
      o.connect(bp); bp.connect(g); g.connect(pan);
      o.start(st); o.stop(st + du + 0.02);
    }
  }
  function bubble() {
    const t0 = ctx.currentTime + 0.01;
    const o = ctx.createOscillator(), g = ctx.createGain();
    const f0 = 300 + Math.random() * 500;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(f0 * 2.2, t0 + 0.08);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + 0.1);
  }

  /* 엘리베이터: 딩동, 잔잔한 음악, 움직이는 소리, 지나가는 층에서 새어 드는 소리 */
  let music = null, hum = null;
  const CHORDS = [[174.6, 220, 261.6, 329.6], [164.8, 196, 246.9, 293.7], [146.8, 174.6, 220, 261.6], [196, 246.9, 293.7, 349.2]];
  function tone(freq, t0, dur, gain, type, dest) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.08, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function musicBar(bar) {
    if (!music) return;
    const t0 = ctx.currentTime + 0.05, chord = CHORDS[bar % CHORDS.length];
    chord.forEach(f => tone(f, t0, 2.6, 0.012, 'triangle', music.bus));
    const pent = [chord[1] * 2, chord[2] * 2, chord[3] * 2, chord[2] * 4];
    for (let i = 0; i < 3; i++) if (Math.random() < 0.75) tone(pent[Math.floor(Math.random() * pent.length)], t0 + 0.3 + i * 0.6 + Math.random() * 0.2, 1.4, 0.018, 'sine', music.bus);
    tone(chord[0] / 2, t0, 1.1, 0.02, 'sine', music.bus);
    tone(chord[0] / 2 * 1.5, t0 + 1.2, 1.1, 0.015, 'sine', music.bus);
  }

  /* 음악 파일 재생: 파일을 받아 두었다가 소리 엔진으로 직접 튼다 */
  const trackData = {};
  T.audio = {
    preload(url) {
      if (trackData[url]) return trackData[url];
      trackData[url] = fetch(url).then(r => { if (!r.ok) throw new Error('load failed'); return r.arrayBuffer(); });
      return trackData[url];
    },
    playTrack(url, volume) {
      const ctl = { gain: null, src: null, stopped: false };
      ctl.fade = ms => {
        ctl.stopped = true;
        if (!ctx || !ctl.gain) return;
        ctl.gain.gain.setTargetAtTime(0, ctx.currentTime, (ms || 2000) / 3000);
        const s = ctl.src; setTimeout(() => { try { s && s.stop(); } catch (e) { } }, (ms || 2000) + 200);
      };
      if (!ctx) start();
      if (!ctx) return ctl;
      T.audio.preload(url).then(buf => ctx.decodeAudioData(buf.slice(0))).then(decoded => {
        if (ctl.stopped) return;
        const src = ctx.createBufferSource(); src.buffer = decoded;
        const g = ctx.createGain(); g.gain.value = volume == null ? 0.9 : volume;
        src.connect(g); g.connect(master);
        src.start();
        ctl.src = src; ctl.gain = g;
      }).catch(() => {});
      return ctl;
    },
    /* 인트로 물방울 소리 */
    drip(pan) {
      if (!ctx || !enabled) return;
      const t0 = ctx.currentTime + 0.01;
      const p = panner(Math.max(-0.8, Math.min(0.8, pan || 0)));
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(1300, t0); o.frequency.exponentialRampToValueAtTime(420, t0 + 0.09);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.06, t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
      o.connect(g); g.connect(lp); lp.connect(p); p.connect(master);
      o.start(t0); o.stop(t0 + 0.4);
    },
    /* 대화 목소리 비프: 말하는 사람마다 높이와 음색이 다르다 */
    beep(v) {
      if (!ctx || !enabled) return;
      const t0 = ctx.currentTime;
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = v.wave || 'square';
      o.frequency.value = (v.pitch || 240) * (0.94 + Math.random() * 0.14);
      f.type = 'lowpass'; f.frequency.value = 2400;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.03, t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.055);
      o.connect(f); f.connect(g); g.connect(master);
      o.start(t0); o.stop(t0 + 0.07);
    },
    chime() {
      if (!ctx || !enabled) return;
      const t0 = ctx.currentTime + 0.02;
      tone(659.3, t0, 1.6, 0.07, 'sine');
      tone(1318.5, t0, 0.8, 0.012, 'sine');
      tone(523.3, t0 + 0.55, 2.0, 0.07, 'sine');
      tone(1046.5, t0 + 0.55, 1.0, 0.012, 'sine');
    },
    music(on) {
      if (!ctx || !enabled) return;
      if (on && !music) {
        const bus = ctx.createGain(); bus.gain.value = 1;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2600;
        bus.connect(f); f.connect(master);
        music = { bus, bar: 0 };
        musicBar(music.bar++);
        music.timer = setInterval(() => musicBar(music && music.bar++), 2400);
        const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
        const hf = ctx.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 140;
        const hg = ctx.createGain(); hg.gain.value = 0;
        const o = ctx.createOscillator(); o.frequency.value = 52; const og = ctx.createGain(); og.gain.value = 0;
        s.connect(hf); hf.connect(hg); hg.connect(master); o.connect(og); og.connect(master);
        s.start(); o.start();
        hum = { s, hg, o, og };
      } else if (!on && music) {
        clearInterval(music.timer);
        const m = music; m.bus.gain.setTargetAtTime(0, ctx.currentTime, 0.6);
        setTimeout(() => m.bus.disconnect(), 3000);
        music = null;
        if (hum) { const h = hum; h.hg.gain.setTargetAtTime(0, ctx.currentTime, 0.3); h.og.gain.setTargetAtTime(0, ctx.currentTime, 0.3); setTimeout(() => { h.s.stop(); h.o.stop(); }, 1500); hum = null; }
      }
    },
    moving(on) {
      if (!ctx || !hum) return;
      hum.hg.gain.setTargetAtTime(on ? 0.35 : 0.0, ctx.currentTime, 0.4);
      hum.og.gain.setTargetAtTime(on ? 0.02 : 0.0, ctx.currentTime, 0.4);
    },
    bleed(kind) {
      if (!ctx || !enabled) return;
      const t0 = ctx.currentTime;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      const g = ctx.createGain(); g.gain.value = 0.6; lp.connect(g); g.connect(master);
      if (kind === 'birds') {
        for (let i = 0; i < 2; i++) tone(2600 + Math.random() * 1200, t0 + i * 0.12, 0.08, 0.02, 'sine', lp);
      } else if (kind === 'surf') {
        const s = ctx.createBufferSource(); s.buffer = noiseBuf;
        const sg = ctx.createGain(); sg.gain.setValueAtTime(0.0001, t0); sg.gain.exponentialRampToValueAtTime(0.25, t0 + 0.3); sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4);
        s.connect(sg); sg.connect(lp); s.start(t0, Math.random()); s.stop(t0 + 1.5);
      } else if (kind === 'machine') {
        const s = ctx.createBufferSource(); s.buffer = noiseBuf;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 220; bp.Q.value = 3;
        const sg = ctx.createGain(); sg.gain.setValueAtTime(0.0001, t0); sg.gain.exponentialRampToValueAtTime(0.5, t0 + 0.03); sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
        s.connect(bp); bp.connect(sg); sg.connect(g); s.start(t0, Math.random()); s.stop(t0 + 0.6);
        tone(110, t0, 0.4, 0.03, 'square', lp);
      } else {
        tone(80 + Math.random() * 30, t0, 0.6, 0.012, 'sine', lp);
      }
    },
    start,
    setEnabled(on) {
      enabled = on;
      if (on && !started) return;
      if (ctx) master.gain.setTargetAtTime(on ? 0.8 : 0, ctx.currentTime, 0.2);
    },
    setAmbience(a) { amb = Object.assign({ wind: 0.1, birds: false, surf: 0 }, a || {}); },
    /* 큰 파도가 해안에서 부서지는 소리 */
    crash(strength) {
      if (!ctx || !enabled) return;
      const t0 = ctx.currentTime;
      const s = ctx.createBufferSource(); s.buffer = noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(400, t0); f.frequency.linearRampToValueAtTime(2200, t0 + 0.6); f.frequency.exponentialRampToValueAtTime(300, t0 + 3.2);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.001, 0.5 * strength), t0 + 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.4);
      s.connect(f); f.connect(g); g.connect(master);
      s.start(t0, Math.random() * 1.5); s.stop(t0 + 3.5);
    },
    quiet: false,
    update(s) {
      if (!ctx || !enabled) return;
      const t = ctx.currentTime;
      /* 인트로 동안에는 층의 주변 소리를 끄고 음악만 들리게 한다 */
      if (T.audio.quiet) {
        [wind, leaves, fallLow, fallHigh, surf, engineGain].forEach(g => g.gain.setTargetAtTime(0, t, 0.2));
        return;
      }
      muffle.frequency.setTargetAtTime(s.underwater ? 500 : 18000, t, 0.08);
      const gust = amb.wind * (0.6 + 0.4 * Math.sin(t * 0.23) * Math.sin(t * 0.61 + 1.3)) * (1 + s.speed * 0.02);
      wind.gain.setTargetAtTime(s.underwater ? 0 : gust, t, 0.6);
      windFilter.frequency.setTargetAtTime(320 + gust * 1600, t, 0.6);
      leaves.gain.setTargetAtTime(s.underwater ? 0 : gust * 0.12 * s.trees, t, 0.6);
      const near = Math.pow(1 - T.smooth(40, 750, s.fallDist), 1.4);
      fallLow.gain.setTargetAtTime(near * 0.75, t, 0.3);
      fallHigh.gain.setTargetAtTime(near * 0.22, t, 0.3);
      if (fallPan.pan) fallPan.pan.setTargetAtTime(Math.max(-0.9, Math.min(0.9, Math.sin(s.fallAngle))), t, 0.2);
      const lap = 0.6 + 0.4 * Math.sin(t * 0.8) * Math.sin(t * 0.37 + 2);
      surf.gain.setTargetAtTime(amb.surf * (0.35 + 0.65 * s.shore) * lap * (s.underwater ? 1.6 : 1), t, 0.4);
      surfFilter.frequency.setTargetAtTime(450 + lap * 500, t, 0.4);
      const boat = s.vehicle === 'boat';
      engineGain.gain.setTargetAtTime(s.driving ? (boat ? 0.025 : 0.03) + Math.min(0.04, s.speed * (boat ? 0.002 : 0.001)) : 0, t, 0.15);
      engine.frequency.setTargetAtTime((boat ? 58 : 42) + s.speed * (boat ? 4.5 : 2.6), t, 0.1);
      engineFilter.frequency.setTargetAtTime(boat ? 650 : 380, t, 0.2);
      if (amb.birds && !s.underwater && t > nextBird) {
        if (near < 0.5) (amb.birds === 'gulls' ? gull : chirp)();
        nextBird = t + (amb.birds === 'gulls' ? 4 : 1.2) + Math.random() * 6;
      }
      if (s.underwater && t > nextBubble) { bubble(); nextBubble = t + 0.4 + Math.random() * 2.5; }
    }
  };
})(window.Tower);
