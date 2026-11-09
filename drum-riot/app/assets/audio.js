'use strict';
// ============================================================
//  DRUM RIOT - audio engine (everything is synthesized live)
// ============================================================
const A = (() => {
  let ctx = null, master, comp, analyser, musicBus, drumBus, revIn, dlyIn, dlyNode, noiseBuf, anData;
  const drums = {};
  let lastOpenHat = null;
  let smOff = null;
  const E = { ready: false };

  const rnd = () => Math.random() * 2 - 1;

  // ---------- offline DSP helpers ----------
  function mkBuf(dur, fn) {
    const sr = ctx.sampleRate, n = Math.floor(dur * sr);
    const b = ctx.createBuffer(1, n, sr);
    fn(b.getChannelData(0), sr, n);
    return b;
  }
  function biq(d, sr, type, f, q) {
    const w = 2 * Math.PI * f / sr, cs = Math.cos(w), sn = Math.sin(w), al = sn / (2 * q);
    let b0, b1, b2;
    if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2; }
    else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2; }
    else { b0 = al; b1 = 0; b2 = -al; }
    const a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < d.length; i++) {
      const x = d[i];
      const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
      x2 = x1; x1 = x; y2 = y1; y1 = y; d[i] = y;
    }
  }
  function norm(d, peak) {
    let m = 0;
    for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i]));
    if (m > 0) { const k = peak / m; for (let i = 0; i < d.length; i++) d[i] *= k; }
  }
  function metal(d, sr, base, hpf) {
    const r = [2, 3, 4.16, 5.43, 6.79, 8.21];
    const ph = r.map(() => Math.random());
    for (let i = 0; i < d.length; i++) {
      const t = i / sr;
      let s = 0;
      for (let k = 0; k < r.length; k++) s += ((ph[k] + base * r[k] * t) % 1) < 0.5 ? 1 : -1;
      d[i] = s / 6 * 0.6 + rnd() * 0.55;
    }
    biq(d, sr, 'hp', hpf, 0.7);
    biq(d, sr, 'hp', hpf, 0.7);
  }

  function buildDrums() {
    drums.kick = mkBuf(0.6, (d, sr) => {
      let ph = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        const f = 46 + 130 * Math.exp(-t * 30);
        ph += 2 * Math.PI * f / sr;
        let v = Math.sin(ph) * Math.exp(-t * 5.2);
        if (t < 0.005) v += rnd() * 0.5 * (1 - t / 0.005);
        d[i] = Math.tanh(v * 2.0);
      }
      norm(d, 0.95);
    });
    drums.snare = mkBuf(0.45, (d, sr) => {
      const n = new Float32Array(d.length);
      for (let i = 0; i < n.length; i++) n[i] = rnd();
      biq(n, sr, 'hp', 1500, 0.7);
      biq(n, sr, 'lp', 9000, 0.7);
      let p1 = 0, p2 = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        p1 += 2 * Math.PI * 185 * (1 + 0.35 * Math.exp(-t * 45)) / sr;
        p2 += 2 * Math.PI * 330 / sr;
        d[i] = (Math.sin(p1) * 0.7 + Math.sin(p2) * 0.3) * Math.exp(-t * 20) + n[i] * Math.exp(-t * 11) * 1.1;
      }
      norm(d, 0.9);
    });
    drums.clap = mkBuf(0.4, (d, sr) => {
      for (let i = 0; i < d.length; i++) d[i] = rnd();
      biq(d, sr, 'bp', 1300, 1.4);
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        let e = 0;
        for (const o of [0, 0.011, 0.022]) if (t >= o) e = Math.max(e, Math.exp(-(t - o) * 170));
        if (t >= 0.03) e = Math.max(e, 0.7 * Math.exp(-(t - 0.03) * 13));
        d[i] *= e;
      }
      norm(d, 0.85);
    });
    drums.hhc = mkBuf(0.12, (d, sr) => {
      metal(d, sr, 40, 7000);
      for (let i = 0; i < d.length; i++) d[i] *= Math.exp(-(i / sr) * 55);
      norm(d, 0.55);
    });
    drums.hho = mkBuf(0.7, (d, sr) => {
      metal(d, sr, 40, 6500);
      for (let i = 0; i < d.length; i++) { const t = i / sr; d[i] *= Math.exp(-t * 5.5) * Math.min(1, t * 400); }
      norm(d, 0.5);
    });
    drums.crash = mkBuf(2.4, (d, sr) => {
      metal(d, sr, 52, 3500);
      for (let i = 0; i < d.length; i++) { const t = i / sr; d[i] *= (Math.exp(-t * 2.0) * 0.8 + Math.exp(-t * 18) * 0.6) * Math.min(1, t * 600); }
      norm(d, 0.62);
    });
    drums.ride = mkBuf(1.6, (d, sr) => {
      metal(d, sr, 66, 5000);
      let p = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        p += 2 * Math.PI * 2650 / sr;
        d[i] = d[i] * 0.55 * Math.exp(-t * 3) + Math.sin(p) * 0.25 * Math.exp(-t * 6);
      }
      norm(d, 0.42);
    });
    const tom = (base) => mkBuf(0.7, (d, sr) => {
      let ph = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        ph += 2 * Math.PI * base * (1 + 0.55 * Math.exp(-t * 16)) / sr;
        d[i] = Math.tanh(1.4 * Math.sin(ph) * Math.exp(-t * 6.5)) + rnd() * 0.25 * Math.exp(-t * 50);
      }
      norm(d, 0.85);
    });
    drums.tom1 = tom(230); drums.tom2 = tom(170); drums.tom3 = tom(110);
    drums.cowbell = mkBuf(0.4, (d, sr) => {
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        d[i] = ((t * 560) % 1 < 0.5 ? 1 : -1) + ((t * 845) % 1 < 0.5 ? 1 : -1);
      }
      biq(d, sr, 'bp', 900, 2.5);
      for (let i = 0; i < d.length; i++) d[i] *= Math.exp(-(i / sr) * 13);
      norm(d, 0.5);
    });
    drums.stick = mkBuf(0.08, (d, sr) => {
      let p = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        p += 2 * Math.PI * 1900 / sr;
        d[i] = (Math.sin(p) * 0.7 + rnd() * 0.4) * Math.exp(-t * 70);
      }
      norm(d, 0.6);
    });
    drums.miss = mkBuf(0.25, (d, sr) => {
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        d[i] = (((t * 82) % 1) * 2 - 1 + ((t * 87.3) % 1) * 2 - 1) * Math.exp(-t * 14);
      }
      biq(d, sr, 'lp', 700, 1);
      norm(d, 0.35);
    });
    noiseBuf = mkBuf(2, (d) => { for (let i = 0; i < d.length; i++) d[i] = rnd(); });
  }

  function impulse(dur, decay) {
    const sr = ctx.sampleRate, n = Math.floor(sr * dur);
    const b = ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = rnd() * Math.pow(1 - i / n, decay);
    }
    return b;
  }

  function distCurve(k) {
    const n = 2048, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); }
    return c;
  }

  // ---------- init ----------
  E.init = function () {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = new AC(); }
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 8; comp.ratio.value = 4;
    comp.attack.value = 0.003; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = 0.9;
    analyser = ctx.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.6;
    anData = new Uint8Array(analyser.frequencyBinCount);
    master.connect(comp); comp.connect(analyser); analyser.connect(ctx.destination);

    const rev = ctx.createConvolver(); rev.buffer = impulse(2.4, 3.2);
    revIn = ctx.createGain(); revIn.gain.value = 0.35;
    revIn.connect(rev); rev.connect(master);

    dlyNode = ctx.createDelay(2); dlyNode.delayTime.value = 0.33;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const dlf = ctx.createBiquadFilter(); dlf.type = 'lowpass'; dlf.frequency.value = 3000;
    dlyIn = ctx.createGain(); dlyIn.gain.value = 1;
    dlyIn.connect(dlyNode); dlyNode.connect(dlf); dlf.connect(fb); fb.connect(dlyNode); dlf.connect(master);

    musicBus = ctx.createGain(); musicBus.connect(master);
    drumBus = ctx.createGain(); drumBus.connect(master);
    buildDrums();
    E.ready = true;
    if (ctx.state === 'suspended') ctx.resume();
  };

  E.resume = () => { if (ctx && ctx.state !== 'running') ctx.resume(); };
  E.suspend = () => { if (ctx && ctx.state === 'running') ctx.suspend(); };
  E.state = () => ctx ? ctx.state : 'none';
  E.ctxTime = () => ctx ? ctx.currentTime : 0;
  E.setVolumes = (m, d) => { if (!ctx) return; musicBus.gain.value = m; drumBus.gain.value = d; };
  E.setDelay = (sec) => { if (dlyNode) dlyNode.delayTime.setValueAtTime(Math.min(1.9, sec), ctx.currentTime); };

  // Time (in AudioContext seconds) of the sound currently reaching the speaker.
  E.now = function () {
    if (!ctx) return 0;
    const pn = performance.now() / 1000;
    let est;
    if (ctx.getOutputTimestamp) {
      const ts = ctx.getOutputTimestamp();
      if (ts && ts.contextTime > 0 && ts.performanceTime > 0) {
        est = ctx.state === 'running' ? ts.contextTime + (pn - ts.performanceTime / 1000) : ts.contextTime;
      }
    }
    if (est === undefined) est = ctx.currentTime - (ctx.baseLatency || 0.01) - (ctx.outputLatency || 0.03);
    if (ctx.state !== 'running') { smOff = null; return est; }
    const off = est - pn;
    if (smOff === null || Math.abs(off - smOff) > 0.04) smOff = off;
    else smOff += (off - smOff) * 0.05;
    return pn + smOff;
  };

  E.level = function () {
    if (!analyser) return 0;
    analyser.getByteFrequencyData(anData);
    let s = 0;
    for (let i = 1; i < 6; i++) s += anData[i];
    return s / (5 * 255);
  };

  // ---------- drums ----------
  const DVOL = { kick: 1.0, snare: 0.85, clap: 0.8, hhc: 0.6, hho: 0.55, crash: 0.7, ride: 0.6, tom1: 0.85, tom2: 0.85, tom3: 0.9, cowbell: 0.5, stick: 0.7, miss: 0.6 };
  const DPAN = { hhc: -0.3, hho: -0.3, crash: -0.35, ride: 0.35, tom1: -0.12, tom2: 0.12, tom3: 0.3, cowbell: 0.2 };
  const DREV = { snare: 0.25, crash: 0.3, tom1: 0.3, tom2: 0.3, tom3: 0.3, clap: 0.35, ride: 0.15 };
  E.drum = function (name, when, vel, rate) {
    if (!ctx || !drums[name]) return;
    const t = Math.max(when || 0, ctx.currentTime);
    const s = ctx.createBufferSource();
    s.buffer = drums[name];
    if (rate) s.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = (vel === undefined ? 1 : vel) * (DVOL[name] || 1);
    s.connect(g);
    let out = g;
    if (DPAN[name] && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner(); p.pan.value = DPAN[name]; g.connect(p); out = p;
    }
    out.connect(drumBus);
    if (DREV[name]) { const sg = ctx.createGain(); sg.gain.value = DREV[name]; out.connect(sg); sg.connect(revIn); }
    if (name === 'hhc' || name === 'hho') {
      if (lastOpenHat) { try { lastOpenHat.stop(t); } catch (e) { } lastOpenHat = null; }
      if (name === 'hho') lastOpenHat = s;
    }
    s.start(t);
  };

  // ---------- synth voices ----------
  E.makeOut = function (vol) {
    const out = ctx.createGain(); out.gain.value = vol === undefined ? 1 : vol;
    out.connect(musicBus);
    const gin = ctx.createGain(); gin.gain.value = 1;
    const sh = ctx.createWaveShaper(); sh.curve = distCurve(60); sh.oversample = '2x';
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200; lp.Q.value = 0.8;
    const pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 700; pk.gain.value = -5; pk.Q.value = 1;
    const go = ctx.createGain(); go.gain.value = 0.35;
    gin.connect(sh); sh.connect(lp); lp.connect(pk); pk.connect(go); go.connect(out);
    return { out, gtr: gin };
  };
  E.release = function (o) {
    if (!o || !ctx) return;
    o.out.gain.setTargetAtTime(0, ctx.currentTime, 0.06);
    setTimeout(() => { try { o.out.disconnect(); } catch (e) { } }, 900);
  };

  E.note = function (time, midi, dur, p, dest) {
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const a = p.a || 0.005, d = p.d || 0.1, s = p.s === undefined ? 0.7 : p.s, r = p.r || 0.1, gv = p.g || 0.1;
    dur = Math.max(dur, a + 0.02);
    const end = time + dur;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.Q.value = p.q || 1;
    const c0 = p.cut || 2000, ce = p.ce || 0;
    if (ce > 0) {
      filt.frequency.setValueAtTime(c0 + ce, time);
      filt.frequency.exponentialRampToValueAtTime(c0, time + (p.fd || 0.2));
    } else filt.frequency.value = c0;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, time);
    amp.gain.linearRampToValueAtTime(gv, time + a);
    amp.gain.setTargetAtTime(gv * s, time + a, d / 3);
    amp.gain.setTargetAtTime(0, end, r / 3);
    const det = p.det || [0];
    const oscs = [];
    let vib = null;
    if (p.vib) {
      vib = ctx.createOscillator(); vib.frequency.value = 5.5;
      const vg = ctx.createGain(); vg.gain.value = f * 0.007 * (p.vib / 5);
      vib.connect(vg);
      vib._g = vg;
    }
    const og = ctx.createGain(); og.gain.value = 1 / Math.sqrt(det.length + (p.sub ? 1 : 0));
    for (const dt of det) {
      const o = ctx.createOscillator(); o.type = p.w || 'sawtooth';
      o.frequency.value = f; o.detune.value = dt;
      if (vib) vib._g.connect(o.frequency);
      o.connect(og); oscs.push(o);
    }
    if (p.sub) {
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f / 2;
      const sg = ctx.createGain(); sg.gain.value = 0.5; o.connect(sg); sg.connect(og); oscs.push(o);
    }
    og.connect(filt); filt.connect(amp);
    const target = dest || { out: musicBus, gtr: musicBus };
    amp.connect(p.bus === 'gtr' ? target.gtr : target.out);
    if (p.rev) { const sg = ctx.createGain(); sg.gain.value = p.rev; amp.connect(sg); sg.connect(revIn); }
    if (p.dly) { const sg = ctx.createGain(); sg.gain.value = p.dly; amp.connect(sg); sg.connect(dlyIn); }
    const stopAt = end + r * 2 + 0.05;
    for (const o of oscs) { o.start(time); o.stop(stopAt); }
    if (vib) { vib.start(time); vib.stop(stopAt); }
  };

  E.riser = function (time, dur, dest) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3;
    bp.frequency.setValueAtTime(250, time); bp.frequency.exponentialRampToValueAtTime(9000, time + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time); g.gain.exponentialRampToValueAtTime(0.22, time + dur);
    g.gain.setTargetAtTime(0, time + dur, 0.05);
    s.connect(bp); bp.connect(g); g.connect(dest ? dest.out : musicBus);
    const sg = ctx.createGain(); sg.gain.value = 0.4; g.connect(sg); sg.connect(revIn);
    s.start(time); s.stop(time + dur + 0.5);
  };
  E.impact = function (time, dest) {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(120, time); o.frequency.exponentialRampToValueAtTime(35, time + 1.2);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.7, time); g.gain.exponentialRampToValueAtTime(0.001, time + 1.8);
    o.connect(g); g.connect(dest ? dest.out : musicBus);
    const sg = ctx.createGain(); sg.gain.value = 0.5; g.connect(sg); sg.connect(revIn);
    o.start(time); o.stop(time + 2);
  };

  E.fire = function (e, at, dest) {
    switch (e.k) {
      case 'n': E.note(at, e.m, e.d, PRESETS[e.p], dest); break;
      case 'd': E.drum(e.n, at, e.v, e.r); break;
      case 'riser': E.riser(at, e.d, dest); break;
      case 'imp': E.impact(at, dest); break;
    }
  };

  return E;
})();

// Instrument presets
const PRESETS = {
  bass:  { w: 'sawtooth', sub: 1, cut: 240, ce: 1100, fd: 0.16, q: 5, a: 0.004, d: 0.2, s: 0.6, r: 0.06, g: 0.34 },
  bassF: { w: 'square', cut: 450, ce: 2400, fd: 0.11, q: 9, a: 0.003, d: 0.12, s: 0.45, r: 0.05, g: 0.24 },
  sub:   { w: 'triangle', sub: 1, cut: 500, ce: 400, fd: 0.1, q: 1, a: 0.005, d: 0.3, s: 0.8, r: 0.08, g: 0.42 },
  pad:   { w: 'sawtooth', det: [-14, 0, 14], cut: 1400, q: 0.7, a: 0.35, d: 0.6, s: 0.8, r: 0.7, g: 0.045, rev: 0.6 },
  ssaw:  { w: 'sawtooth', det: [-26, -10, 0, 10, 26], cut: 3000, ce: 3000, fd: 0.18, q: 1, a: 0.005, d: 0.25, s: 0.5, r: 0.14, g: 0.05, rev: 0.35 },
  pluck: { w: 'square', det: [0, 8], cut: 800, ce: 3800, fd: 0.12, q: 4, a: 0.002, d: 0.15, s: 0.0, r: 0.12, g: 0.055, dly: 0.4 },
  lead:  { w: 'sawtooth', det: [-7, 7], cut: 1800, ce: 2600, fd: 0.25, q: 3, a: 0.012, d: 0.3, s: 0.7, r: 0.16, g: 0.085, dly: 0.35, vib: 5, rev: 0.2 },
  bell:  { w: 'triangle', det: [0, 1200], cut: 5000, q: 0.5, a: 0.003, d: 0.5, s: 0.15, r: 0.4, g: 0.09, dly: 0.35, rev: 0.4 },
  clav:  { w: 'square', cut: 1100, ce: 3200, fd: 0.08, q: 8, a: 0.002, d: 0.1, s: 0.1, r: 0.04, g: 0.065 },
  brass: { w: 'sawtooth', det: [-6, 6], cut: 900, ce: 2600, fd: 0.12, q: 2, a: 0.03, d: 0.2, s: 0.75, r: 0.1, g: 0.08, rev: 0.25 },
  gtr:   { w: 'sawtooth', det: [-9, 9], cut: 3200, q: 0.7, a: 0.004, d: 0.4, s: 0.75, r: 0.09, g: 0.2, bus: 'gtr' },
  gtrM:  { w: 'sawtooth', det: [-9, 9], cut: 800, ce: 1100, fd: 0.07, q: 1.5, a: 0.002, d: 0.08, s: 0.3, r: 0.04, g: 0.22, bus: 'gtr' },
  gtrL:  { w: 'sawtooth', det: [-4, 4], cut: 2600, ce: 1200, fd: 0.2, q: 2, a: 0.01, d: 0.3, s: 0.8, r: 0.15, g: 0.13, bus: 'gtr', vib: 6, dly: 0.25 },
};

// Sequencer: schedules a list of {t,...} events against the audio clock
class Seq {
  constructor(ev, start, loop, vol) {
    this.ev = ev; this.start = start; this.loop = loop || 0; this.i = 0;
    this.dest = A.makeOut(vol);
  }
  pump(ahead) {
    const now = A.ctxTime();
    ahead = ahead || 0.25;
    if (!this.ev.length) return;
    for (let guard = 0; guard < 4000; guard++) {
      if (this.i >= this.ev.length) {
        if (!this.loop) return;
        this.i = 0; this.start += this.loop;
      }
      const e = this.ev[this.i];
      const at = this.start + e.t;
      if (at > now + ahead) return;
      if (at > now - 0.06) A.fire(e, Math.max(at, now), this.dest);
      this.i++;
    }
  }
  stop() { A.release(this.dest); this.ev = []; }
}
