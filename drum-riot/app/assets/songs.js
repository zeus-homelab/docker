'use strict';
// ============================================================
//  DRUM RIOT - original songs + chart generator
// ============================================================

// Drum patterns: 16 steps per bar. Rows:
// K kick, S snare, H closed hat, O open hat, R ride, T hi tom, M mid tom, F floor tom, C crash
const DP = {
  hatsK:   { K: 'x.......x.......', H: 'x.x.x.x.x.x.x.x.' },
  rock:    { K: 'x.......x.x.....', S: '....x.......x...', H: 'x.x.x.x.x.x.x.x.' },
  rockB:   { K: 'x.....x.x.x.....', S: '....x.......x...', H: 'x.x.x.x.x.x.x.x.' },
  rockR:   { K: 'x.......x.x.....', S: '....x.......x...', R: 'x.x.x.x.x.x.x.x.' },
  drive:   { K: 'x...x...x...x...', S: '....x.......x...', H: 'x.x.x.x.x.x.x.x.' },
  synth:   { K: 'x.......x.......', S: '....x.......x...', H: 'x.x.x.x.x.x.x.x.' },
  disco:   { K: 'x...x...x...x...', S: '....x.......x...', H: 'x...x...x...x...', O: '..x...x...x...x.' },
  half:    { K: 'x.........x.....', S: '........x.......', H: 'x.x.x.x.x.x.x.x.' },
  funk:    { K: 'x..x......x..x..', S: '....x..x.x..x...', H: 'x.xxx.xxx.xxx...', O: '..............x.' },
  funkB:   { K: 'x..x..x...x.....', S: '....x.......x..x', H: 'x.x.x.x.x.x.x...', O: '..............x.' },
  funkIn:  { K: 'x.........x.....', H: 'x.x.x.x.x.x.x.x.' },
  tomGroove: { K: 'x.......x.......', T: '....x.......x...', F: '..x...x...x...x.' },
  metal:   { K: 'x.x.x.x.x.x.x.x.', S: '....x.......x...', R: 'x...x...x...x...' },
  gallop:  { K: 'x.xxx.xxx.xxx.xx', S: '....x.......x...', C: 'x.......x.......' },
  breakdown: { K: 'x..x..x...x..x..', S: '........x.......', C: 'x...............', R: '....x.......x...' },
  build4:  { S: 'x...x...x...x...' },
  build8:  { S: 'x.x.x.x.x.x.x.x.' },
  build16: { S: 'xxxxxxxxxxxxxxxx' },
  drop:    { K: 'x...x...x...x...', S: '....x.......x...', H: 'x...x...x...x...', O: '..x...x...x...x.' },
  hits:    { K: 'x.......x.......', C: 'x.......x.......' },
  end:     { K: 'x...............', C: 'x...............' },
};

// Fills: 8-step fills replace the 2nd half of the last bar; full:true replaces the whole bar
const FILL = {
  f8a:  { K: 'x.......', S: 'x.x.x.x.' },
  f8b:  { K: 'x.......', S: 'x.x.....', T: '....x...', F: '......x.' },
  f8c:  { S: 'x.x.', T: '....x.', M: '......', F: '......xx' },
  f16a: { S: 'xxxx....', T: '....xx..', F: '......xx' },
  f16b: { K: 'x...x...', S: 'x.xxx.xx' },
  big:  { full: true, K: 'x.......x.......', S: 'x.x.x.x.........', T: '........x.x.....', F: '............x.x.' },
  big16:{ full: true, K: 'x...............', S: 'xxxx....xx......', T: '....xxxx..xx....', F: '............xxxx' },
  roll: { full: true, S: 'x.x.x.x.xxxxxxxx' },
};

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  penta: [0, 3, 5, 7, 10],
};

const SONGS = [
  {
    id: 'starlight', title: 'Starlight Chase', artist: 'Paper Satellites', genre: 'Synth Pop', bpm: 96, theme: 'ocean', level: 1,
    scale: 'major', leadRoot: 72, bassLo: 33, leadP: 'bell', jam: 2,
    hooks: { A: '5:4 3:4 1:4 3:4 2:4 5:4 7:4 5:4 6:4 5:2 3:2 1:8 4:4 3:4 2:8' },
    sec: [
      { n: 'Intro', b: 4, ch: ['C', 'G', 'Am', 'F'], dr: 'hatsK', pad: 1, arp: 'arp8', fill: 'f8a' },
      { n: 'Verse', b: 8, ch: ['C', 'G', 'Am', 'F'], dr: 'rock', bass: 'root8', pad: 1, arp: 'arp8', fill: 'f8a', crash: 1 },
      { n: 'Chorus', b: 8, ch: ['F', 'G', 'C', 'Am'], dr: 'rock', bass: 'octave', pad: 1, arp: 'arp16', lead: 'A', fill: 'f8b', crash: 4 },
      { n: 'Verse', b: 8, ch: ['C', 'G', 'Am', 'F'], dr: 'rockB', bass: 'root8', pad: 1, arp: 'arp8', fill: 'f8a', crash: 1 },
      { n: 'Chorus', b: 8, ch: ['F', 'G', 'C', 'Am'], dr: 'rock', bass: 'octave', pad: 1, arp: 'arp16', lead: 'A', fill: 'big', crash: 4 },
      { n: 'Outro', b: 4, ch: ['C', 'G', 'Am', 'C'], dr: 'rock', bass: 'root8', pad: 1, lead: 'A', crash: 1, end: true },
    ],
  },
  {
    id: 'neon', title: 'Neon Highway', artist: 'VHS Dreamers', genre: 'Synthwave', bpm: 112, theme: 'neon', level: 2,
    scale: 'minor', leadRoot: 69, bassLo: 33, leadP: 'lead', jam: 2,
    hooks: { A: '5:4 4:2 3:2 5:4 8:4 6:6 5:2 3:4 1:4 3:4 5:4 7:4 8:2 7:2 7:6 5:2 4:4 2:4' },
    sec: [
      { n: 'Intro', b: 4, ch: ['Am', 'F', 'C', 'G'], dr: 'hatsK', pad: 1, arp: 'arp16', fill: 'f8a', fx: 'riser' },
      { n: 'Verse', b: 8, ch: ['Am', 'F', 'C', 'G'], dr: 'synth', bass: 'octave', pad: 1, arp: 'arp16', fill: 'f8b', crash: 1 },
      { n: 'Chorus', b: 8, ch: ['Am', 'F', 'C', 'G'], dr: 'drive', bass: 'octave', pad: 2, arp: 'arp16', lead: 'A', fill: 'f8b', crash: 4, imp: 1 },
      { n: 'Verse', b: 8, ch: ['Am', 'F', 'C', 'G'], dr: 'synth', bass: 'octave', pad: 1, arp: 'arp16', fill: 'f16a', crash: 1 },
      { n: 'Chorus', b: 8, ch: ['Am', 'F', 'C', 'G'], dr: 'drive', bass: 'octave', pad: 2, arp: 'arp16', lead: 'A', fill: 'f8c', crash: 4 },
      { n: 'Bridge', b: 4, ch: ['F', 'G', 'Em', 'Am'], dr: 'half', bass: 'sub', pad: 1, lead: 'A', fill: 'roll', fx: 'riser' },
      { n: 'Chorus', b: 8, ch: ['Am', 'F', 'C', 'G'], dr: 'drive', bass: 'octave', pad: 2, arp: 'arp16', lead: 'A', fill: 'big16', crash: 4, imp: 1 },
      { n: 'Outro', b: 4, ch: ['Am', 'F', 'G', 'Am'], dr: 'synth', bass: 'octave', pad: 1, arp: 'arp16', crash: 1, end: true },
    ],
  },
  {
    id: 'funk', title: 'Midnight Funk Machine', artist: 'Groove Syndicate', genre: 'Funk', bpm: 104, theme: 'funk', level: 3,
    scale: 'dorian', leadRoot: 64, bassLo: 28, leadP: 'brass', jam: 2,
    hooks: { A: '8:2 .:2 7:2 5:2 .:2 4:2 5:4 3:2 4:2 3:2 1:2 .:8' },
    sec: [
      { n: 'Intro', b: 4, ch: ['Em7', 'A7'], dr: 'funkIn', clav: 1, fill: 'f8a' },
      { n: 'Groove', b: 8, ch: ['Em7', 'A7'], dr: 'funkB', bass: 'funk', clav: 1, fill: 'f8b', crash: 1 },
      { n: 'Hook', b: 8, ch: ['Em7', 'A7'], dr: 'funk', bass: 'funk', clav: 1, pad: 1, lead: 'A', leadOct: 12, fill: 'f16b', crash: 4 },
      { n: 'Break', b: 4, ch: ['Cmaj7', 'B7'], dr: 'funkIn', bass: 'funk', pad: 1, fill: 'big' },
      { n: 'Groove', b: 8, ch: ['Em7', 'A7'], dr: 'funkB', bass: 'funk', clav: 1, fill: 'f8b', crash: 1 },
      { n: 'Hook', b: 8, ch: ['Em7', 'A7'], dr: 'funk', bass: 'funk', clav: 1, pad: 1, lead: 'A', leadOct: 12, fill: 'f16a', crash: 4 },
      { n: 'Outro', b: 4, ch: ['Em7', 'A7', 'Em7', 'Em7'], dr: 'funkB', bass: 'funk', clav: 1, crash: 1, end: true },
    ],
  },
  {
    id: 'drop', title: 'Drop Zone', artist: 'Kilowatt', genre: 'EDM', bpm: 128, theme: 'edm', level: 3,
    scale: 'minor', leadRoot: 65, bassLo: 29, leadP: 'lead', jam: 2,
    hooks: { A: '5:3 5:3 6:2 5:2 4:2 3:4 1:3 1:3 3:2 4:4 3:4 5:3 5:3 6:2 8:4 7:4 5:6 4:2 3:8' },
    sec: [
      { n: 'Intro', b: 4, ch: ['Fm', 'Db', 'Ab', 'Eb'], dr: 'disco', bass: 'pump', pad: 1, arp: 'arp16', fill: 'f8a' },
      { n: 'Build', b: 8, ch: ['Fm', 'Db', 'Ab', 'Eb'], dr: ['build4', 'build4', 'build4', 'build4', 'build8', 'build8', 'build16', 'build16'], pad: 1, arp: 'arp16', fx: 'riser' },
      { n: 'Drop', b: 8, ch: ['Fm', 'Db', 'Ab', 'Eb'], dr: 'drop', bass: 'pump', stab: 1, lead: 'A', fill: 'f8b', crash: 4, imp: 1 },
      { n: 'Break', b: 8, ch: ['Db', 'Eb', 'Fm', 'Fm'], dr: 'half', bass: 'sub', pad: 1, arp: 'arp8', fill: 'f8a', crash: 1 },
      { n: 'Build', b: 8, ch: ['Fm', 'Db', 'Ab', 'Eb'], dr: ['build4', 'build4', 'build4', 'build4', 'build8', 'build8', 'build16', 'build16'], pad: 1, arp: 'arp16', fx: 'riser' },
      { n: 'Drop', b: 8, ch: ['Fm', 'Db', 'Ab', 'Eb'], dr: 'drop', bass: 'pump', stab: 1, lead: 'A', fill: 'big16', crash: 4, imp: 1 },
      { n: 'Outro', b: 4, ch: ['Fm', 'Db', 'Eb', 'Fm'], dr: 'disco', bass: 'pump', pad: 1, crash: 1, end: true },
    ],
  },
  {
    id: 'steel', title: 'Steel Thunder', artist: 'Voltage Kings', genre: 'Hard Rock', bpm: 138, theme: 'fire', level: 4,
    scale: 'penta', leadRoot: 64, bassLo: 28, gtrLo: 40, leadP: 'gtrL', jam: 2,
    hooks: { A: '6:4 5:2 4:2 5:4 4:2 3:2 4:8 3:4 2:4 1:4 2:2 3:2 4:4 5:4 6:12 .:4' },
    sec: [
      { n: 'Intro', b: 4, ch: ['E5', 'E5', 'G5', 'A5'], dr: 'tomGroove', gtr: 'sus', fill: 'big' },
      { n: 'Verse', b: 8, ch: ['E5', 'D5', 'C5', 'D5'], dr: 'rock', bass: 'root8', gtr: 'p8', fill: 'f8b', crash: 1 },
      { n: 'Chorus', b: 8, ch: ['C5', 'D5', 'E5', 'E5'], dr: 'rockB', bass: 'root8', gtr: 'drive', lead: 'A', fill: 'f16a', crash: 2 },
      { n: 'Verse', b: 8, ch: ['E5', 'D5', 'C5', 'D5'], dr: 'rock', bass: 'root8', gtr: 'p8', fill: 'f8c', crash: 1 },
      { n: 'Chorus', b: 8, ch: ['C5', 'D5', 'E5', 'E5'], dr: 'rockB', bass: 'root8', gtr: 'drive', lead: 'A', fill: 'big', crash: 2 },
      { n: 'Solo', b: 8, ch: ['A5', 'G5', 'E5', 'D5'], dr: 'rockR', bass: 'root8', gtr: 'p8', arp: 'arp16', arpP: 'gtrL', fill: 'big16', crash: 4 },
      { n: 'Chorus', b: 8, ch: ['C5', 'D5', 'E5', 'E5'], dr: 'rockB', bass: 'root8', gtr: 'drive', lead: 'A', fill: 'f16a', crash: 2 },
      { n: 'Outro', b: 4, ch: ['E5', 'G5', 'A5', 'E5'], dr: 'hits', bass: 'root4', gtr: 'half', crash: 1, end: true },
    ],
  },
  {
    id: 'inferno', title: 'Inferno Engine', artist: 'Molten Skull', genre: 'Metal', bpm: 150, theme: 'lava', level: 5,
    scale: 'minor', leadRoot: 62, bassLo: 26, gtrLo: 38, leadP: 'gtrL', jam: 2,
    hooks: { A: '8:2 7:2 6:2 5:2 6:4 5:4 4:2 3:2 2:2 3:2 4:4 5:4' },
    sec: [
      { n: 'Intro', b: 4, ch: ['D5', 'D5', 'Bb5', 'A5'], dr: 'tomGroove', gtr: 'sus', fill: 'big16', fx: 'riser' },
      { n: 'Verse', b: 8, ch: ['D5', 'Bb5', 'C5', 'A5'], dr: 'metal', bass: 'root8', gtr: 'p8', fill: 'f8b', crash: 1, imp: 1 },
      { n: 'Chorus', b: 8, ch: ['D5', 'Bb5', 'C5', 'A5'], dr: 'gallop', bass: 'gallop', gtr: 'gal', lead: 'A', leadOct: 12, fill: 'f16a', crash: 1 },
      { n: 'Verse', b: 8, ch: ['D5', 'Bb5', 'C5', 'A5'], dr: 'metal', bass: 'root8', gtr: 'p8', fill: 'f16b', crash: 1 },
      { n: 'Chorus', b: 8, ch: ['D5', 'Bb5', 'C5', 'A5'], dr: 'gallop', bass: 'gallop', gtr: 'gal', lead: 'A', leadOct: 12, fill: 'big', crash: 1 },
      { n: 'Solo', b: 8, ch: ['Bb5', 'C5', 'D5', 'D5'], dr: 'metal', bass: 'root8', gtr: 'p8', arp: 'arp16', arpP: 'gtrL', fill: 'big16', crash: 4 },
      { n: 'Breakdown', b: 4, ch: ['D5', 'D5', 'D5', 'A5'], dr: 'breakdown', bass: 'root4', gtr: 'half', fill: 'big16' },
      { n: 'Outro', b: 4, ch: ['D5', 'Bb5', 'A5', 'D5'], dr: 'gallop', bass: 'gallop', gtr: 'gal', crash: 1, end: true },
    ],
  },
];

const THEMES = {
  ocean: { sky: ['#020024', '#0b1d5a', '#2fb8ff'], sun: ['#ffffff', '#5fd8ff'], grid: '#3fa9ff', floor: ['#06103a', '#01020c'], mount: ['#071548', '#0c2470'], edge: '#a0f0ff', laser: '#7df9ff', accent: '#5fd8ff' },
  neon:  { sky: ['#0b0221', '#2a0845', '#ff2e88'], sun: ['#ffe53b', '#ff2e88'], grid: '#ff2bd6', floor: ['#14002e', '#05000d'], mount: ['#1a0536', '#2b0a52'], edge: '#00f0ff', laser: '#00f0ff', accent: '#ff2bd6' },
  funk:  { sky: ['#120024', '#3b0a5e', '#ffb300'], sun: ['#fff0a0', '#ff6ad5'], grid: '#c86bff', floor: ['#1d0236', '#07000f'], mount: ['#24063f', '#3a0c5c'], edge: '#ffcc00', laser: '#ff6ad5', accent: '#ffcc00' },
  edm:   { sky: ['#000814', '#001d3d', '#00c98a'], sun: ['#d9ff00', '#00ffa3'], grid: '#00ffd5', floor: ['#001428', '#000208'], mount: ['#00182e', '#00284a'], edge: '#7cff00', laser: '#00ff6a', accent: '#00ffd5' },
  fire:  { sky: ['#0a0000', '#3a0505', '#ff5a00'], sun: ['#fff27a', '#ff3b00'], grid: '#ff4d00', floor: ['#1a0300', '#050000'], mount: ['#200000', '#3a0a00'], edge: '#ffae00', laser: '#ff2200', accent: '#ff8800' },
  lava:  { sky: ['#000000', '#1a0000', '#9b0000'], sun: ['#ffcc00', '#ff0000'], grid: '#ff1a1a', floor: ['#140000', '#000000'], mount: ['#1a0000', '#2e0000'], edge: '#ff6600', laser: '#ff0000', accent: '#ff3300' },
  rage:  { sky: ['#1a0a00', '#5a2a00', '#ffd000'], sun: ['#ffffff', '#ffb000'], grid: '#ffd000', floor: ['#2a1400', '#080300'], mount: ['#2a1200', '#4a2200'], edge: '#fff27a', laser: '#ffe066', accent: '#ffd000' },
};

// ---------- music theory helpers ----------
const NN = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const QUAL = { '': [0, 4, 7], m: [0, 3, 7], '5': [0, 7, 12], m7: [0, 3, 7, 10], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], sus2: [0, 2, 7], sus4: [0, 5, 7] };
function parseChord(name) {
  const m = name.match(/^([A-G][#b]?)(.*)$/);
  return { r: NN[m[1]], iv: QUAL[m[2]] || QUAL[''] };
}
const inR = (pc, lo) => lo + ((((pc - lo) % 12) + 12) % 12);
function parseHook(str) {
  const notes = []; let pos = 0;
  for (const tok of str.trim().split(/\s+/)) {
    const [d, l] = tok.split(':'); const len = +l;
    if (d !== '.') notes.push([pos, +d, len]);
    pos += len;
  }
  return { notes, len: pos };
}
function degToMidi(S, d) {
  const sc = SCALES[S.scale], i = d - 1;
  const o = Math.floor(i / sc.length);
  return S.leadRoot + sc[((i % sc.length) + sc.length) % sc.length] + 12 * o;
}

const FUNK_BASS = [[0, 0, 2], [3, 12, 1], [4, 0, 1], [6, 10, 2], [8, 0, 1], [10, 0, 2], [11, 12, 1], [13, 7, 1], [14, 10, 2]];
const GAL = 'x.xxx.xxx.xxx.xx';
const CLAV = '..x..x.x..x..x.x';

// ---------- music generation for one bar ----------
function genMusic(S, sec, b, barT, st, ev, last) {
  const cpb = sec.cpb || 1, seg = 16 / cpb;
  const add = (s, m, len, p) => ev.push({ t: barT + s * st, k: 'n', m, d: len * st, p });
  for (let h = 0; h < cpb; h++) {
    const C = parseChord(sec.ch[(b * cpb + h) % sec.ch.length]);
    const s0 = h * seg, s1 = s0 + seg;
    const br = inR(C.r, S.bassLo || 33);
    const tones = C.iv.map(iv => C.r + iv);
    if (last && sec.end) {
      if (h === 0) {
        add(0, br, 24, 'sub');
        if (sec.gtr) { const gr = inR(C.r, S.gtrLo || 40); [gr, gr + 7, gr + 12].forEach(m => add(0, m, 24, 'gtr')); }
        tones.slice(0, 4).forEach(pc => add(0, inR(pc % 12, 57), 28, 'pad'));
      }
      continue;
    }
    switch (sec.bass) {
      case 'root8': for (let s = s0; s < s1; s += 2) add(s, br, 1.7, 'bass'); break;
      case 'root4': for (let s = s0; s < s1; s += 4) add(s, br, 3.5, 'bass'); break;
      case 'octave': for (let s = s0; s < s1; s += 2) add(s, br + ((s / 2) % 2 ? 12 : 0), 1.6, 'bass'); break;
      case 'sub': add(s0, br, seg - 0.5, 'sub'); break;
      case 'pump': for (let s = s0; s < s1; s += 4) { add(s + 2, br, 1.8, 'sub'); add(s + 3, br + 12, 0.8, 'bass'); } break;
      case 'funk': for (const [s, iv, l] of FUNK_BASS) if (s >= s0 && s < s1) add(s, br + iv, l, 'bassF'); break;
      case 'gallop': for (let s = s0; s < s1; s++) if (GAL[s] === 'x') add(s, br, 0.9, 'bass'); break;
    }
    if (sec.gtr) {
      const gr = inR(C.r, S.gtrLo || 40);
      const pc = [gr, gr + 7, gr + 12];
      const chord = (s, len, p) => pc.forEach(m => add(s, m, len, p));
      switch (sec.gtr) {
        case 'sus': chord(s0, seg - 0.3, 'gtr'); break;
        case 'p8': for (let s = s0; s < s1; s += 2) chord(s, 1.4, 'gtrM'); break;
        case 'drive': chord(s0, 7.5, 'gtr'); for (let s = s0 + 8; s < s1; s += 2) chord(s, 1.4, 'gtrM'); break;
        case 'gal': for (let s = s0; s < s1; s++) if (GAL[s] === 'x') chord(s, 0.9, 'gtrM'); break;
        case 'half': chord(s0, 7.5, 'gtr'); chord(s0 + 8, 7.5, 'gtr'); break;
      }
    }
    if (sec.pad) {
      const p = sec.pad === 2 ? 'ssaw' : 'pad';
      const vo = tones.slice(0, 4).map(pc => inR(pc % 12, 57));
      if (p === 'pad') vo.forEach(m => add(s0, m, seg, p));
      else for (let s = s0; s < s1; s += 4) vo.forEach(m => add(s + 2, m + 12, 1.5, p));
    }
    if (sec.stab) {
      const vo = tones.slice(0, 3).map(pc => inR(pc % 12, 60));
      for (let s = s0; s < s1; s += 4) vo.forEach(m => add(s + 2, m, 1.4, 'ssaw'));
      add(s0, inR(C.r, 48), seg, 'pad');
    }
    if (sec.clav) {
      const vo = tones.slice(0, 4).map(pc => inR(pc % 12, 60));
      for (let s = s0; s < s1; s++) if (CLAV[s] === 'x') vo.forEach(m => add(s, m, 0.8, 'clav'));
    }
    if (sec.arp) {
      const base = [...new Set(tones.map(pc => inR(pc % 12, sec.arpP ? 52 : 64)))].sort((a, c) => a - c);
      const up = base.concat(base.map(m => m + 12));
      const seq = up.concat(up.slice(1, -1).reverse());
      const stp = sec.arp === 'arp8' ? 2 : 1;
      for (let s = s0; s < s1; s += stp) add(s, seq[(s / stp) % seq.length], stp * 0.9, sec.arpP || 'pluck');
    }
  }
  if (sec.lead && !(last && sec.end)) {
    const H = parseHook(S.hooks[sec.lead]);
    const off = (b * 16) % H.len;
    for (const [pos, d, len] of H.notes) {
      if (pos >= off && pos < off + 16) {
        ev.push({ t: barT + (pos - off) * st, k: 'n', m: degToMidi(S, d) + (sec.leadOct || 0), d: len * st * 0.95, p: S.leadP || 'lead' });
      }
    }
  }
  if (b === 0 && sec.fx === 'riser') ev.push({ t: barT, k: 'riser', d: sec.b * 16 * st });
  if (b === 0 && sec.imp) ev.push({ t: barT, k: 'imp' });
}

// ---------- drum chart for one bar ----------
const LANEMAP = { K: [4, 'kick'], S: [0, 'snare'], H: [1, 'hhc'], O: [1, 'hho'], R: [1, 'ride'], T: [2, 'tom1'], M: [2, 'tom2'], F: [3, 'tom3'], C: [3, 'crash'] };
const PRI = { C: 5, S: 4, K: 4, F: 3, T: 3, M: 3, O: 2, H: 1, R: 1 };
function genDrums(sec, b, barT, st, notes, last, gBase) {
  let name = Array.isArray(sec.dr) ? sec.dr[b % sec.dr.length] : sec.dr;
  if (!name) return;
  if (last && sec.end) name = 'end';
  const rows = {};
  for (const k in DP[name]) rows[k] = DP[name][k].split('');
  const blank = () => '................'.split('');
  if (last && sec.fill && !sec.end) {
    const F = FILL[sec.fill];
    if (F.full) {
      for (const k in rows) delete rows[k];
      for (const k in F) if (k !== 'full') rows[k] = F[k].split('');
    } else {
      for (const k in rows) for (let s = 8; s < 16; s++) rows[k][s] = '.';
      for (const k in F) {
        if (!rows[k]) rows[k] = blank();
        for (let i = 0; i < F[k].length; i++) rows[k][8 + i] = F[k][i];
      }
    }
  }
  const cr = sec.crash;
  if (cr && (cr === 1 ? b === 0 : b % cr === 0) && !(last && sec.end)) {
    rows.C = rows.C || blank(); rows.C[0] = 'x';
    for (const k of ['H', 'R', 'O']) if (rows[k]) rows[k][0] = '.';
    rows.K = rows.K || blank(); rows.K[0] = 'x';
  }
  for (let s = 0; s < 16; s++) {
    const byLane = {};
    for (const k in rows) {
      if (rows[k][s] !== 'x') continue;
      const [lane, snd] = LANEMAP[k];
      if (!byLane[lane] || PRI[k] > PRI[byLane[lane].k]) byLane[lane] = { k, lane, snd };
    }
    for (const l in byLane) {
      const o = byLane[l];
      notes.push({ t: barT + s * st, lane: o.lane, snd: o.snd, k: o.k, gs: gBase + s });
    }
  }
}

function filterDiff(notes, diff) {
  if (diff >= 2) return notes;
  const groups = new Map();
  for (const n of notes) { if (!groups.has(n.gs)) groups.set(n.gs, []); groups.get(n.gs).push(n); }
  const out = [];
  for (const [gs, grp] of groups) {
    const s = gs % 16;
    const kick = grp.find(n => n.lane === 4);
    let hands = grp.filter(n => n.lane !== 4).sort((a, b) => PRI[b.k] - PRI[a.k]);
    if (diff === 0) {
      if (kick && s % 4 === 0) out.push(kick);
      if (s % 4 !== 0) hands = [];
      const strong = hands.filter(n => !'HOR'.includes(n.k));
      if (strong.length) hands = [strong[0]];
      else hands = (!kick && s % 8 === 0 && hands.length) ? [hands[0]] : [];
      out.push(...hands);
    } else {
      if (kick && s % 2 === 0) out.push(kick);
      if (s % 2 === 0) out.push(...hands.slice(0, 2));
    }
  }
  return out;
}

// ---------- full song build ----------
function buildSong(S, diff) {
  const st = 60 / S.bpm / 4;
  const ev = [], notes = [];
  let bar = 0;
  const sections = [];
  for (const sec of S.sec) {
    sections.push({ n: sec.n, t: bar * 16 * st });
    for (let b = 0; b < sec.b; b++) {
      const barT = bar * 16 * st;
      const last = b === sec.b - 1;
      genMusic(S, sec, b, barT, st, ev, last);
      genDrums(sec, b, barT, st, notes, last, bar * 16);
      bar++;
    }
  }
  ev.sort((a, b) => a.t - b.t);
  const chart = filterDiff(notes, diff).sort((a, b) => a.t - b.t || a.lane - b.lane);
  return { ev, chart, dur: bar * 16 * st, bars: bar, st, spb: st * 4, sections };
}

// A loop of one section (music only) for menus, previews and free-play jams
function buildLoop(S, secIdx) {
  const sec = S.sec[secIdx];
  const st = 60 / S.bpm / 4;
  const ev = [];
  const s2 = Object.assign({}, sec, { fx: null, imp: 0, end: false });
  for (let b = 0; b < sec.b; b++) genMusic(S, s2, b, b * 16 * st, st, ev, b === sec.b - 1);
  ev.sort((a, b) => a.t - b.t);
  return { ev, len: sec.b * 16 * st, st };
}

// Drum groove loop for previews (so menus have drums too)
function buildDrumLoop(S, secIdx) {
  const sec = S.sec[secIdx];
  const st = 60 / S.bpm / 4;
  const notes = [];
  for (let b = 0; b < sec.b; b++) genDrums(sec, b, b * 16 * st, st, notes, b === sec.b - 1, b * 16);
  return notes.map(n => ({ t: n.t, k: 'd', n: n.snd, v: 0.7 }));
}
