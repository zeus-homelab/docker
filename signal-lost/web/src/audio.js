// Fully synthesized audio: SFX + procedural synthwave music. No audio files.

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.sfxVol = 0.8;
    this.musicVol = 0.55;
    this.track = null; // current track name
    this.trace = 0;
    this.siren = false;
    this.lastPlay = {};
  }
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain();
    // music chain: dry + distorted mix
    this.musicDry = ctx.createGain();
    this.musicWet = ctx.createGain();
    this.musicWet.gain.value = 0;
    this.shaper = ctx.createWaveShaper();
    this.shaper.curve = makeCurve(40);
    this.musicLP = ctx.createBiquadFilter();
    this.musicLP.type = 'lowpass';
    this.musicLP.frequency.value = 9000;
    this.musicBus.connect(this.musicDry);
    this.musicBus.connect(this.shaper);
    this.shaper.connect(this.musicWet);
    this.musicDry.connect(this.musicLP);
    this.musicWet.connect(this.musicLP);
    this.musicLP.connect(this.master);
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.0, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    this.seqStep = 0;
    this.nextTime = 0;
    this.timer = setInterval(() => this.schedule(), 50);
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend();
      else this.ctx.resume();
    });
  }
  setVolumes(sfx, music) {
    this.sfxVol = sfx;
    this.musicVol = music;
    this.applyVolumes();
  }
  applyVolumes() {
    if (!this.ctx) return;
    this.sfxBus.gain.value = this.sfxVol * 0.6;
    this.musicBus.gain.value = this.musicVol * 0.32;
  }
  setTrace(v) {
    this.trace = v;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const wet = Math.max(0, (v - 40) / 60) * 0.7;
    this.musicWet.gain.setTargetAtTime(wet, t, 0.3);
    this.musicDry.gain.setTargetAtTime(1 - wet * 0.5, t, 0.3);
  }
  setMuffled(on) {
    if (!this.ctx) return;
    this.musicLP.frequency.setTargetAtTime(on ? 900 : 9000, this.ctx.currentTime, 0.15);
  }
  playMusic(name) {
    if (this.track === name) return;
    this.track = name;
    this.seqStep = 0;
    if (this.ctx) this.nextTime = this.ctx.currentTime + 0.1;
  }

  // ---------- primitive voices ----------
  tone({ type = 'square', f = 440, f2 = null, dur = 0.15, vol = 0.3, attack = 0.005, bus = null, when = 0, detune = 0, q = 0, lp = 0 }) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = (when || ctx.currentTime) + 0.001;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    o.detune.value = detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (lp) {
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = lp;
      filt.Q.value = q;
      node.connect(filt);
      node = filt;
    }
    node.connect(g);
    g.connect(bus || this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  noise({ dur = 0.2, vol = 0.3, hp = 0, lp = 0, when = 0, bus = null, sweep = 0 }) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = (when || ctx.currentTime) + 0.001;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    let node = s;
    if (hp) {
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = hp;
      node.connect(f);
      node = f;
    }
    if (lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(lp, t);
      if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
      node.connect(f);
      node = f;
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    node.connect(g);
    g.connect(bus || this.sfxBus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  // ---------- SFX ----------
  sfx(name) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // rate-limit spammy sounds
    const lim = { shoot: 0.045, hit: 0.03, pickup: 0.03, eshoot: 0.06 }[name];
    if (lim) {
      if (this.lastPlay[name] && now - this.lastPlay[name] < lim) return;
      this.lastPlay[name] = now;
    }
    const r = () => 0.9 + Math.random() * 0.2;
    switch (name) {
      case 'shoot':
        this.tone({ type: 'square', f: 880 * r(), f2: 320, dur: 0.07, vol: 0.08, lp: 3000 });
        break;
      case 'eshoot':
        this.tone({ type: 'sawtooth', f: 420 * r(), f2: 180, dur: 0.09, vol: 0.05, lp: 1800 });
        break;
      case 'hit':
        this.noise({ dur: 0.06, vol: 0.15, hp: 1500 });
        this.tone({ type: 'square', f: 220 * r(), f2: 90, dur: 0.06, vol: 0.08 });
        break;
      case 'hurt':
        this.tone({ type: 'sawtooth', f: 160, f2: 60, dur: 0.18, vol: 0.2 });
        this.noise({ dur: 0.12, vol: 0.2, lp: 1200 });
        break;
      case 'jump':
        this.tone({ type: 'sawtooth', f: 200, f2: 2400, dur: 0.16, vol: 0.14, lp: 6000 });
        this.tone({ type: 'square', f: 1200, f2: 3000, dur: 0.1, vol: 0.06, when: now + 0.05 });
        this.noise({ dur: 0.14, vol: 0.12, hp: 3000 });
        break;
      case 'land':
        this.tone({ type: 'triangle', f: 1800, f2: 600, dur: 0.12, vol: 0.14 });
        this.noise({ dur: 0.08, vol: 0.1, hp: 5000 });
        break;
      case 'eject':
        this.tone({ type: 'square', f: 600, f2: 120, dur: 0.3, vol: 0.14 });
        this.noise({ dur: 0.25, vol: 0.18, lp: 3000, sweep: 300 });
        break;
      case 'explode':
        this.noise({ dur: 0.45, vol: 0.32, lp: 2400, sweep: 120 });
        this.tone({ type: 'sine', f: 120, f2: 35, dur: 0.4, vol: 0.3 });
        break;
      case 'bigexplode':
        this.noise({ dur: 1.2, vol: 0.4, lp: 3000, sweep: 60 });
        this.tone({ type: 'sine', f: 90, f2: 25, dur: 1.0, vol: 0.4 });
        break;
      case 'pickup':
        this.tone({ type: 'square', f: 1320 * r(), f2: 1760, dur: 0.05, vol: 0.05 });
        break;
      case 'special':
        this.tone({ type: 'sawtooth', f: 300, f2: 900, dur: 0.22, vol: 0.14, lp: 4000, q: 8 });
        this.tone({ type: 'square', f: 600, f2: 1800, dur: 0.18, vol: 0.06, when: now + 0.06 });
        break;
      case 'click':
        this.tone({ type: 'square', f: 1400, dur: 0.035, vol: 0.06 });
        break;
      case 'select':
        this.tone({ type: 'square', f: 660, dur: 0.06, vol: 0.08 });
        this.tone({ type: 'square', f: 990, dur: 0.08, vol: 0.08, when: now + 0.06 });
        break;
      case 'deny':
        this.tone({ type: 'square', f: 180, dur: 0.12, vol: 0.12 });
        this.tone({ type: 'square', f: 140, dur: 0.15, vol: 0.12, when: now + 0.1 });
        break;
      case 'type':
        this.tone({ type: 'square', f: 900 + Math.random() * 500, dur: 0.02, vol: 0.025 });
        break;
      case 'lockdown':
        for (let i = 0; i < 3; i++) {
          this.tone({ type: 'sawtooth', f: 440, f2: 880, dur: 0.35, vol: 0.12, when: now + i * 0.4, lp: 3000 });
        }
        break;
      case 'clear':
        [523, 659, 784, 1047].forEach((f, i) => this.tone({ type: 'square', f, dur: 0.14, vol: 0.08, when: now + i * 0.07 }));
        break;
      case 'reward':
        [784, 988, 1175, 1568].forEach((f, i) => this.tone({ type: 'triangle', f, dur: 0.25, vol: 0.12, when: now + i * 0.08 }));
        break;
      case 'death':
        this.tone({ type: 'sawtooth', f: 440, f2: 30, dur: 1.4, vol: 0.25, lp: 2000 });
        this.noise({ dur: 1.0, vol: 0.25, lp: 4000, sweep: 100 });
        break;
      case 'boss':
        this.tone({ type: 'sawtooth', f: 55, dur: 1.2, vol: 0.3, lp: 600, attack: 0.05 });
        this.tone({ type: 'sawtooth', f: 82.4, dur: 1.2, vol: 0.2, lp: 600, attack: 0.05 });
        this.noise({ dur: 1.2, vol: 0.15, lp: 800 });
        break;
      case 'beam':
        this.tone({ type: 'sawtooth', f: 90, f2: 60, dur: 0.5, vol: 0.12, lp: 900 });
        break;
      case 'warn':
        this.tone({ type: 'square', f: 1200, dur: 0.06, vol: 0.07 });
        break;
      case 'glitch':
        for (let i = 0; i < 5; i++) this.tone({ type: 'square', f: 200 + Math.random() * 2000, dur: 0.03, vol: 0.06, when: now + i * 0.035 });
        break;
      case 'buy':
        this.tone({ type: 'square', f: 1046, dur: 0.06, vol: 0.08 });
        this.tone({ type: 'square', f: 1568, dur: 0.12, vol: 0.08, when: now + 0.07 });
        break;
    }
  }

  // ---------- Music sequencer ----------
  schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.track || ctx.state !== 'running') return;
    const song = SONGS[this.track];
    if (!song) return;
    const spb = 60 / song.bpm / 4; // 16th notes
    if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + 0.25) {
      this.playStep(song, this.seqStep, this.nextTime, spb);
      this.seqStep++;
      this.nextTime += spb;
    }
  }
  playStep(song, step, t, spb) {
    const bus = this.musicBus;
    const s16 = step % 16;
    const bar = Math.floor(step / 16) % song.prog.length;
    const root = song.root + song.prog[bar];
    const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
    // drums
    if (song.kick[s16] === 'x') {
      this.tone({ type: 'sine', f: 150, f2: 40, dur: 0.25, vol: 0.9, when: t, bus });
    }
    if (song.snare[s16] === 'x') this.noise({ dur: 0.16, vol: 0.35, hp: 1200, when: t, bus });
    if (song.hat[s16] === 'x') this.noise({ dur: 0.04, vol: 0.12, hp: 7000, when: t, bus });
    // bass
    const bn = song.bass[s16];
    if (bn !== null && bn !== undefined) {
      this.tone({ type: 'sawtooth', f: hz(root - 24 + bn), dur: spb * 1.8, vol: 0.35, when: t, bus, lp: 700, q: 6 });
    }
    // arp
    if (song.arp) {
      const chord = song.minor ? [0, 3, 7, 10, 12, 15] : [0, 4, 7, 11, 12, 16];
      const n = chord[(step * (song.arpDir || 1)) % chord.length < 0 ? 0 : (step * (song.arpDir || 1)) % chord.length];
      if (step % song.arp === 0) this.tone({ type: 'square', f: hz(root + 12 + n), dur: spb * 0.9, vol: 0.07, when: t, bus, lp: 2500 });
    }
    // pad on bar start
    if (s16 === 0 && song.pad) {
      const chord = song.minor ? [0, 3, 7] : [0, 4, 7];
      for (const c of chord) this.tone({ type: 'sawtooth', f: hz(root + c), dur: spb * 16, vol: 0.05, attack: 0.4, when: t, bus, lp: 1400, detune: (Math.random() - 0.5) * 14 });
    }
    // lead motif
    if (song.lead) {
      const ln = song.lead[step % song.lead.length];
      if (ln !== null && ln !== undefined) this.tone({ type: 'triangle', f: hz(song.root + 24 + ln), dur: spb * 2.2, vol: 0.08, when: t, bus });
    }
    // lockdown siren overlay
    if (this.siren && step % 8 === 0) this.tone({ type: 'sawtooth', f: 600, f2: 900, dur: spb * 6, vol: 0.05, when: t, bus, lp: 2000 });
  }
}

function makeCurve(k) {
  const n = 1024;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    c[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return c;
}

const _ = null;
const SONGS = {
  title: {
    bpm: 92, root: 57, minor: true, prog: [0, -4, -7, -2],
    kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.',
    bass: [0, _, _, 0, _, _, 0, _, 0, _, _, 0, _, _, 12, _], arp: 2, pad: true,
    lead: [12, _, _, _, 10, _, 7, _, _, _, _, _, 3, _, 5, _, 7, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  },
  layer1: {
    bpm: 118, root: 52, minor: true, prog: [0, 0, -4, -2],
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...xx',
    bass: [0, _, 0, _, 12, _, 0, _, 0, _, 0, _, 12, _, 10, _], arp: 2, pad: false,
  },
  layer2: {
    bpm: 124, root: 55, minor: false, prog: [0, -3, -5, -7],
    kick: 'x...x...x...x...', snare: '....x.......x..x', hat: 'xxxxxxxxxxxxxxxx',
    bass: [0, 0, _, 0, _, 0, 12, _, 0, 0, _, 0, _, 7, _, 12], arp: 2, pad: true,
  },
  layer3: {
    bpm: 112, root: 50, minor: true, prog: [0, 1, 0, -2],
    kick: 'x.....x...x.....', snare: '....x.......x...', hat: '..x.x.x...x.x.x.',
    bass: [0, _, _, 0, _, _, 0, _, _, 1, _, _, 0, _, _, _], arp: 1, arpDir: 1, pad: true,
  },
  layer4: {
    bpm: 132, root: 53, minor: true, prog: [0, -4, -2, -5],
    kick: 'x..xx...x..xx...', snare: '....x.......x...', hat: 'x.xxx.xxx.xxx.xx',
    bass: [0, 12, 0, 12, 0, 12, 0, 12, 0, 12, 0, 12, 10, 12, 7, 12], arp: 1, pad: true,
  },
  boss: {
    bpm: 140, root: 45, minor: true, prog: [0, 1, 0, -1],
    kick: 'x.x.x.x.x.x.x.x.', snare: '....x.......x.x.', hat: 'xxxxxxxxxxxxxxxx',
    bass: [0, 0, 12, 0, 0, 12, 0, 13, 0, 0, 12, 0, 0, 12, 10, 12], arp: 1, pad: false,
  },
  map: {
    bpm: 84, root: 57, minor: true, prog: [0, -5, -4, -7],
    kick: 'x...............', snare: '........x.......', hat: '....x.......x...',
    bass: [0, _, _, _, _, _, _, _, 7, _, _, _, _, _, _, _], arp: 4, pad: true,
  },
  victory: {
    bpm: 100, root: 60, minor: false, prog: [0, 5, 7, 9],
    kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.',
    bass: [0, _, 0, _, 7, _, 0, _, 0, _, 0, _, 7, _, 12, _], arp: 2, pad: true,
    lead: [12, _, 16, _, 19, _, 24, _, _, _, 23, _, 19, _, 16, _],
  },
  death: {
    bpm: 70, root: 45, minor: true, prog: [0, -1],
    kick: 'x...............', snare: '................', hat: '................',
    bass: [0, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _], arp: 0, pad: true,
  },
};

export const audio = new AudioEngine();
