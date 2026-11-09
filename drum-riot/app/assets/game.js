'use strict';
// ============================================================
//  DRUM RIOT - game, visuals, menus, free play
// ============================================================
(() => {
  const $ = id => document.getElementById(id);
  const cv = $('cv'), g = cv.getContext('2d');
  let W = 0, H = 0, DPR = 1;

  // ---------- settings / saves ----------
  const DEF = { music: 0.8, drums: 1, speed: 1, offset: 30, autoKick: false, vibe: true, low: false };
  const ST = Object.assign({}, DEF);
  try { Object.assign(ST, JSON.parse(localStorage.getItem('dr_settings') || '{}')); } catch (e) { }
  const saveSettings = () => { try { localStorage.setItem('dr_settings', JSON.stringify(ST)); } catch (e) { } };
  let BEST = {};
  try { BEST = JSON.parse(localStorage.getItem('dr_best') || '{}'); } catch (e) { }
  const saveBest = () => { try { localStorage.setItem('dr_best', JSON.stringify(BEST)); } catch (e) { } };

  const LC = ['#ff2d55', '#ffd60a', '#2f8bff', '#2ee879', '#ff8c1a'];
  const LANE_SND = ['snare', 'hhc', 'tom1', 'crash', 'kick'];
  const DIFF = ['EASY', 'MEDIUM', 'HARD'];
  const AUTO = new URLSearchParams(location.search).has('auto');
  const vibe = ms => { if (ST.vibe && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { } };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }
  const fmt = n => Math.round(n).toLocaleString('en-US');

  // ---------- screens ----------
  let screen = 'splash';
  function show(id) {
    document.querySelectorAll('.scr').forEach(s => s.classList.remove('on'));
    $('scr-' + id).classList.add('on');
    screen = id;
  }
  const overlay = (id, on) => $('scr-' + id).classList.toggle('on', on);

  // ============================================================
  //  BACKGROUND
  // ============================================================
  const BG = { th: THEMES.neon, stars: [], mtn: [], sun: null, sunR: 1, dirty: true, scroll: 0, energy: 0, pulse: 0, lasers: 0, laserT: 0, bpm: 112, embers: [] };
  for (let i = 0; i < 150; i++) BG.stars.push({ x: Math.random(), y: Math.random() * 0.55, s: Math.random() * 1.8 + 0.4, p: Math.random() * 6.28 });
  function genMtn(amp) {
    const N = 48, p = [Math.random() * 6, Math.random() * 6, Math.random() * 6], out = [];
    for (let i = 0; i < N; i++) {
      let h = 0.5 + 0.5 * (Math.sin(i * 0.45 + p[0]) * 0.5 + Math.sin(i * 1.2 + p[1]) * 0.3 + Math.sin(i * 2.7 + p[2]) * 0.2);
      h *= 0.25 + 0.75 * Math.abs(i / (N - 1) - 0.5) * 2;
      out.push(h * amp);
    }
    return out;
  }
  BG.mtn = [genMtn(1), genMtn(1)];
  for (let i = 0; i < 40; i++) BG.embers.push({ x: Math.random(), y: Math.random(), v: 0.02 + Math.random() * 0.06, s: 1 + Math.random() * 2.5, p: Math.random() * 6 });

  function setTheme(name) { BG.th = THEMES[name]; BG.dirty = true; }
  function renderSun() {
    const R = Math.max(20, Math.round(H * 0.25));
    const c = document.createElement('canvas'); c.width = c.height = R * 2;
    const x = c.getContext('2d');
    const gr = x.createLinearGradient(0, 0, 0, R * 2);
    gr.addColorStop(0, BG.th.sun[0]); gr.addColorStop(1, BG.th.sun[1]);
    x.fillStyle = gr; x.beginPath(); x.arc(R, R, R, 0, Math.PI * 2); x.fill();
    x.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 8; i++) x.fillRect(0, R * 1.02 + i * R * 0.12, R * 2, 2 + i * R * 0.017);
    BG.sun = c; BG.sunR = R; BG.dirty = false;
  }
  function drawMtn(h, hz, maxH, fill, edge, ea) {
    g.beginPath(); g.moveTo(0, hz);
    for (let i = 0; i < h.length; i++) g.lineTo(i / (h.length - 1) * W, hz - h[i] * maxH);
    g.lineTo(W, hz); g.closePath();
    g.fillStyle = fill; g.fill();
    g.globalAlpha = ea; g.strokeStyle = edge; g.lineWidth = 2; g.stroke(); g.globalAlpha = 1;
  }
  function drawBG(dt, tm) {
    if (BG.dirty) renderSun();
    const th = BG.th, hz = H * 0.56, en = BG.energy;
    BG.scroll += dt * (BG.bpm / 60) * (G && G.rageOn && screen === 'game' ? 2 : 1);
    BG.pulse = Math.max(0, BG.pulse - dt * 3.5);
    // sky
    let gr = g.createLinearGradient(0, 0, 0, hz);
    gr.addColorStop(0, th.sky[0]); gr.addColorStop(0.62, th.sky[1]); gr.addColorStop(1, th.sky[2]);
    g.fillStyle = gr; g.fillRect(0, 0, W, hz + 1);
    // stars
    g.fillStyle = '#fff';
    for (const s of BG.stars) {
      g.globalAlpha = (0.35 + 0.65 * Math.abs(Math.sin(tm * 1.3 + s.p))) * (1 - s.y / 0.6);
      g.fillRect(s.x * W, s.y * H, s.s, s.s);
    }
    g.globalAlpha = 1;
    // sun + glow
    const sR = BG.sunR * (1 + en * 0.1 + BG.pulse * 0.05);
    const sx = W / 2, sy = hz - BG.sunR * 0.38;
    gr = g.createRadialGradient(sx, sy, sR * 0.4, sx, sy, sR * 2.4);
    gr.addColorStop(0, hexA(th.sun[1], 0.55 + en * 0.3)); gr.addColorStop(1, hexA(th.sun[1], 0));
    g.fillStyle = gr; g.fillRect(sx - sR * 2.4, sy - sR * 2.4, sR * 4.8, sR * 4.8);
    g.drawImage(BG.sun, sx - sR, sy - sR, sR * 2, sR * 2);
    // lasers
    if (BG.lasers > 0.02 && !ST.low) {
      BG.laserT += dt * (0.6 + BG.lasers);
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 7; i++) {
        const ox = W * (0.08 + i * 0.14);
        const ang = -Math.PI / 2 + Math.sin(BG.laserT * (0.7 + i * 0.17) + i * 1.7) * 0.75;
        const len = H * 1.3, w = 3 + BG.pulse * 5;
        const ex = ox + Math.cos(ang) * len, ey = hz + Math.sin(ang) * len;
        const lg = g.createLinearGradient(ox, hz, ex, ey);
        const col = i % 2 ? th.laser : th.edge;
        lg.addColorStop(0, hexA(col, 0.75 * BG.lasers)); lg.addColorStop(1, hexA(col, 0));
        g.strokeStyle = lg; g.lineWidth = w; g.beginPath(); g.moveTo(ox, hz); g.lineTo(ex, ey); g.stroke();
        g.lineWidth = w * 4; g.globalAlpha = 0.25; g.stroke(); g.globalAlpha = 1;
      }
      g.globalCompositeOperation = 'source-over';
    }
    // mountains
    drawMtn(BG.mtn[1], hz, H * 0.2, th.mount[1], th.edge, 0.35);
    drawMtn(BG.mtn[0], hz, H * 0.12, th.mount[0], th.edge, 0.85);
    // floor
    gr = g.createLinearGradient(0, hz, 0, H);
    gr.addColorStop(0, th.floor[0]); gr.addColorStop(1, th.floor[1]);
    g.fillStyle = gr; g.fillRect(0, hz, W, H - hz);
    // grid
    const boost = clamp(0.45 + en * 0.7 + BG.pulse * 0.5, 0, 1.4);
    g.strokeStyle = th.grid;
    const ph = BG.scroll % 1;
    for (let i = 0; i < 24; i++) {
      const d = i + 1 - ph;
      const y = hz + (H - hz) * 1.4 / (d + 0.6);
      if (y > H + 2) continue;
      const k = (y - hz) / (H - hz);
      g.globalAlpha = clamp(k * 3, 0, 1) * boost * 0.9;
      g.lineWidth = 1 + k * 2.5;
      g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
    }
    g.globalAlpha = 0.7 * boost; g.lineWidth = 1.5;
    for (let i = -16; i <= 16; i++) {
      g.beginPath(); g.moveTo(W / 2 + i * W * 0.012, hz); g.lineTo(W / 2 + i * W * 0.17, H); g.stroke();
    }
    g.globalAlpha = 1;
    // horizon glow
    gr = g.createLinearGradient(0, hz - 30, 0, hz + 30);
    gr.addColorStop(0, hexA(th.edge, 0)); gr.addColorStop(0.5, hexA(th.edge, 0.45 + BG.pulse * 0.3)); gr.addColorStop(1, hexA(th.edge, 0));
    g.fillStyle = gr; g.fillRect(0, hz - 30, W, 60);
    // embers
    if (!ST.low) {
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = th.accent;
      for (const e of BG.embers) {
        e.y -= e.v * dt * (1 + en * 3);
        if (e.y < 0) { e.y = 1; e.x = Math.random(); }
        g.globalAlpha = 0.5 * Math.sin(e.y * Math.PI);
        g.fillRect(e.x * W + Math.sin(tm + e.p) * 12, e.y * H, e.s, e.s);
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    // vignette
    gr = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }

  // ============================================================
  //  FX
  // ============================================================
  const parts = [], rings = [], texts = [];
  function burst(x, y, col, n, spd) {
    if (ST.low) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = spd * (0.3 + Math.random());
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - spd * 0.4, life: 1, dec: 1.4 + Math.random() * 1.5, col, sz: 2 + Math.random() * 3.5 });
    }
    if (parts.length > 600) parts.splice(0, parts.length - 600);
  }
  const ring = (x, y, col, r, sy, grow) => rings.push({ x, y, col, r, sy: sy || 1, life: 1, grow: grow || 260 });
  const ftext = (txt, x, y, col, size, life) => texts.push({ txt, x, y, col, size: size || 22, life: life || 0.6, max: life || 0.6 });
  function drawFX(dt) {
    g.globalCompositeOperation = 'lighter';
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt * p.dec;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * dt;
      g.globalAlpha = p.life; g.fillStyle = p.col;
      const s = p.sz * (0.5 + p.life);
      g.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.life -= dt * 2.8;
      if (r.life <= 0) { rings.splice(i, 1); continue; }
      r.r += dt * r.grow;
      g.globalAlpha = r.life; g.strokeStyle = r.col; g.lineWidth = 2 + 6 * r.life;
      g.beginPath(); g.ellipse(r.x, r.y, r.r, r.r * r.sy, 0, 0, Math.PI * 2); g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      t.life -= dt;
      if (t.life <= 0) { texts.splice(i, 1); continue; }
      const k = t.life / t.max;
      const sc = 1 + Math.max(0, k - 0.8) * 2.5;
      t.y -= dt * 40;
      g.globalAlpha = Math.min(1, k * 2.5);
      g.font = `italic 900 ${Math.round(t.size * sc)}px Roboto, system-ui, sans-serif`;
      g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.strokeText(t.txt, t.x, t.y);
      g.fillStyle = t.col; g.fillText(t.txt, t.x, t.y);
    }
    g.globalAlpha = 1;
  }

  // ============================================================
  //  MENU MUSIC / PREVIEWS
  // ============================================================
  let menuSeq = null, menuDrums = null, menuStart = 0, menuSpb = 0.5, menuBeat = -1, menuIdx = -1;
  function playLoop(idx, withDrums, vol) {
    stopLoop();
    if (!A.ready) return;
    const S = SONGS[idx], L = buildLoop(S, S.jam);
    menuStart = A.ctxTime() + 0.15;
    menuSeq = new Seq(L.ev, menuStart, L.len, vol);
    if (withDrums) menuDrums = new Seq(buildDrumLoop(S, S.jam), menuStart, L.len, 1);
    menuSpb = 60 / S.bpm; menuIdx = idx; menuBeat = -1;
    A.setDelay(menuSpb * 0.75);
    BG.bpm = S.bpm;
  }
  function stopLoop() {
    if (menuSeq) menuSeq.stop();
    if (menuDrums) menuDrums.stop();
    menuSeq = menuDrums = null; menuIdx = -1;
  }

  // ============================================================
  //  SONG SELECT
  // ============================================================
  let selSong = 0, selDiff = 1;
  try { selDiff = +(localStorage.getItem('dr_diff') || 1); } catch (e) { }
  const songInfo = SONGS.map(S => {
    const d = buildSong(S, 2);
    return { dur: d.dur, notes: [0, 1, 2].map(k => buildSong(S, k).chart.length) };
  });
  const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  function buildSongList() {
    const list = $('song-list');
    list.innerHTML = '';
    SONGS.forEach((S, i) => {
      const el = document.createElement('div');
      el.className = 'song';
      el.style.setProperty('--c', THEMES[S.theme].accent);
      el.innerHTML = `<div class="num">${i + 1}</div><div class="info"><div class="t">${S.title}</div><div class="a">${S.artist} · ${S.genre}</div></div><div class="lv">${'★'.repeat(S.level)}<span style="opacity:.25">${'★'.repeat(5 - S.level)}</span></div>`;
      el.addEventListener('click', () => selectSong(i));
      list.appendChild(el);
    });
  }
  function selectSong(i, quiet) {
    selSong = i;
    const S = SONGS[i];
    document.querySelectorAll('.song').forEach((el, k) => el.classList.toggle('sel', k === i));
    $('song-detail').style.setProperty('--c', THEMES[S.theme].accent);
    $('sd-genre').textContent = S.genre.toUpperCase();
    $('sd-title').textContent = S.title;
    $('sd-artist').textContent = 'by ' + S.artist;
    setTheme(S.theme);
    updateDetail();
    if (!quiet) playLoop(i, true, 0.9);
  }
  function updateDetail() {
    const S = SONGS[selSong], inf = songInfo[selSong];
    $('sd-meta').textContent = `${S.bpm} BPM  ·  ${mmss(inf.dur)}  ·  ${inf.notes[selDiff]} NOTES`;
    document.querySelectorAll('#diffs button').forEach(b => b.classList.toggle('on', +b.dataset.d === selDiff));
    const b = BEST[S.id + '_' + selDiff];
    $('sd-best').innerHTML = b ? `BEST: <b>${fmt(b.score)}</b> &nbsp;${'★'.repeat(b.stars)}${'☆'.repeat(5 - b.stars)} &nbsp;(${b.grade})` : 'Not played yet — go get it!';
  }
  document.querySelectorAll('#diffs button').forEach(b => b.addEventListener('click', () => {
    selDiff = +b.dataset.d;
    try { localStorage.setItem('dr_diff', selDiff); } catch (e) { }
    updateDetail();
  }));

  // ============================================================
  //  GAMEPLAY
  // ============================================================
  let G = null;
  const WIN = { p: 0.05, g: 0.095, o: 0.145 };
  const songT = () => A.now() - G.start - ST.offset / 1000;
  function calcMax(n) { let s = 0; for (let k = 1; k <= n; k++) s += 100 * Math.min(4, 1 + Math.floor(k / 10)); return s; }

  function startGame() {
    stopLoop();
    A.resume();
    parts.length = rings.length = texts.length = 0;
    const S = SONGS[selSong];
    const data = buildSong(S, selDiff);
    let chart = data.chart.map(n => Object.assign({}, n));
    const ev = data.ev.slice();
    if (ST.autoKick) {
      chart = chart.filter(n => {
        if (n.lane === 4) { ev.push({ t: n.t, k: 'd', n: 'kick', v: 1 }); return false; }
        return true;
      });
    }
    const spb = data.spb;
    for (let k = 0; k < 4; k++) ev.push({ t: -(4 - k) * spb, k: 'd', n: 'stick', v: k === 0 ? 1 : 0.8, r: k === 0 ? 1.3 : 1 });
    ev.sort((a, b) => a.t - b.t);
    A.setDelay(spb * 0.75);
    const start = A.ctxTime() + 0.6 + 4 * spb;
    G = {
      S, data, chart, start, seq: new Seq(ev, start, 0, 1), first: 0,
      score: 0, combo: 0, maxCombo: 0, mult: 1, rage: 0, rageOn: false,
      cnt: { p: 0, g: 0, o: 0, m: 0 }, total: chart.length, ended: false, paused: false, pauseT: 0,
      look: 1.5 / ST.speed, lastBeat: -99, laneHit: [0, 0, 0, 0, 0], maxScore: calcMax(chart.length),
      shake: 0, secIdx: -1, secName: '', secT: 0, spb,
    };
    setTheme(S.theme); BG.bpm = S.bpm;
    show('game');
    updateRageBtn();
  }

  function hwLayout() {
    const bw = Math.min(W * 0.5, H * 1.02);
    return { cx: W / 2, sy: H * 0.85, hy: H * 0.02, bw, left: W / 2 - bw / 2, right: W / 2 + bw / 2 };
  }
  const laneAt = x => { const L = hwLayout(); return (x >= L.left && x <= L.right) ? Math.min(3, Math.floor((x - L.left) / (L.bw / 4))) : 4; };
  const laneX = (L, lane, s) => L.cx + (-0.5 + (lane + 0.5) / 4) * L.bw * s;

  function gameHit(lane) {
    if (!G || G.paused || G.ended) return;
    const t = songT();
    G.laneHit[lane] = 1;
    let best = null, bd = 1e9;
    for (let i = G.first; i < G.chart.length; i++) {
      const n = G.chart[i];
      if (n.t > t + WIN.o) break;
      if (n.res || n.lane !== lane) continue;
      const d = Math.abs(n.t - t);
      if (d < bd) { bd = d; best = n; }
    }
    const L = hwLayout();
    const px = lane === 4 ? L.cx : laneX(L, lane, 1);
    if (best && bd <= WIN.o) {
      const j = bd <= WIN.p ? 'p' : bd <= WIN.g ? 'g' : 'o';
      best.res = j; G.cnt[j]++;
      A.drum(best.snd, 0, 1);
      G.combo++; G.maxCombo = Math.max(G.maxCombo, G.combo);
      G.mult = Math.min(4, 1 + Math.floor(G.combo / 10));
      G.score += { p: 100, g: 70, o: 40 }[j] * G.mult * (G.rageOn ? 2 : 1);
      if (!G.rageOn) G.rage = Math.min(1, G.rage + { p: 0.014, g: 0.008, o: 0.003 }[j]);
      const col = G.rageOn ? '#ffe066' : LC[lane];
      if (lane === 4) {
        for (let k = 0; k < 4; k++) burst(L.left + L.bw * (0.15 + k * 0.233), L.sy, col, 6, 260);
        G.shake = 1;
        BG.pulse = Math.max(BG.pulse, 0.7);
      } else {
        burst(px, L.sy, col, 16, 380);
        ring(px, L.sy, col, L.bw / 10, 0.42, 300);
      }
      const jt = { p: ['PERFECT!', '#fff27a'], g: ['GREAT', '#7dffb2'], o: ['GOOD', '#9cd8ff'] }[j];
      ftext(jt[0], px, L.sy - (lane === 4 ? 95 : 60), jt[1], lane === 4 ? 20 : 22, 0.45);
      if (G.combo % 50 === 0) { ftext(`${G.combo} NOTE STREAK!`, W / 2, H * 0.42, '#ffd000', 40, 1.5); BG.pulse = 1; vibe(40); }
      if (G.combo === 10 * (G.mult - 1) && G.mult > 1) ftext(`x${G.mult} MULTIPLIER`, W / 2, H * 0.52, '#ff2bd6', 26, 1);
      vibe(lane === 4 ? 22 : 12);
    } else {
      A.drum(LANE_SND[lane], 0, 0.75);
      if (lane < 4) ring(px, L.sy, LC[lane], L.bw / 12, 0.42, 160);
      vibe(8);
    }
    updateRageBtn();
  }

  function activateRage() {
    if (!G || G.paused || G.rageOn || G.rage < 0.5) return;
    G.rageOn = true;
    A.drum('crash', 0, 1); A.impact(A.ctxTime());
    ftext('RAGE MODE!', W / 2, H * 0.45, '#ffd000', 54, 1.6);
    ftext('DOUBLE POINTS', W / 2, H * 0.56, '#fff', 22, 1.6);
    setTheme('rage'); BG.pulse = 1; vibe(80);
    updateRageBtn();
  }
  let rageCls = '';
  function updateRageBtn() {
    const c = !G ? '' : G.rageOn ? 'active' : G.rage >= 0.5 ? 'ready' : '';
    if (c !== rageCls) { $('b-rage').className = c; rageCls = c; }
  }

  function updateGame(dt) {
    if (G.paused) return;
    const t = songT();
    G.seq.pump(0.3);
    if (AUTO) {
      for (let i = G.first; i < G.chart.length; i++) {
        const n = G.chart[i];
        if (n.t > t) break;
        if (!n.res) gameHit(n.lane);
      }
    }
    for (let i = G.first; i < G.chart.length; i++) {
      const n = G.chart[i];
      if (n.t > t - WIN.o) break;
      if (!n.res) {
        n.res = 'm'; G.cnt.m++;
        if (G.combo >= 10) { A.drum('miss', 0, 0.8); ftext('COMBO BROKEN', W / 2, H * 0.5, '#ff5577', 24, 0.8); }
        G.combo = 0; G.mult = 1;
        const L = hwLayout();
        ftext('MISS', n.lane === 4 ? L.cx : laneX(L, n.lane, 1), L.sy - 60, '#ff4466', 20, 0.45);
      }
    }
    while (G.first < G.chart.length && G.chart[G.first].res && G.chart[G.first].t < t - 0.6) G.first++;
    // beat pulse + sections
    const beat = Math.floor(t / G.spb);
    if (beat !== G.lastBeat && t >= 0) { G.lastBeat = beat; BG.pulse = Math.max(BG.pulse, beat % 4 === 0 ? 0.8 : 0.4); }
    const secs = G.data.sections;
    let si = -1;
    for (let i = 0; i < secs.length; i++) if (t >= secs[i].t - 0.05) si = i;
    if (si !== G.secIdx && si >= 0) {
      G.secIdx = si; G.secName = secs[si].n.toUpperCase(); G.secT = 2;
    }
    G.secT = Math.max(0, G.secT - dt);
    const hype = /CHORUS|DROP|HOOK|SOLO|DRUM|HEAD/.test(G.secName);
    BG.lasers += ((G.rageOn ? 1 : hype ? 0.6 : 0.05) - BG.lasers) * dt * 3;
    if (G.rageOn) {
      G.rage -= dt * 0.06;
      if (G.rage <= 0) { G.rage = 0; G.rageOn = false; setTheme(G.S.theme); ftext('RAGE OVER', W / 2, H * 0.45, '#ffaa66', 28, 1); }
      updateRageBtn();
    }
    for (let i = 0; i < 5; i++) G.laneHit[i] = Math.max(0, G.laneHit[i] - dt * 5);
    G.shake = Math.max(0, G.shake - dt * 8);
    if (!G.ended && t > G.data.dur + 2.2) endGame();
  }

  function rr(x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  function drawGame(dt) {
    const L = hwLayout();
    const t = G.paused ? G.pauseT : songT();
    const look = G.look;
    const sh = G.shake * 4;
    g.save();
    if (sh) g.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
    const P = (f, s) => [L.cx + f * L.bw * s, L.hy + (L.sy - L.hy) * s];
    const sFar = 0.2, sNear = 1.3;
    const accent = G.rageOn ? '#ffd000' : BG.th.accent;
    // highway body
    const [x1, y1] = P(-0.5, sFar), [x2] = P(0.5, sFar), [x3, y3] = P(0.5, sNear), [x4] = P(-0.5, sNear);
    let gr = g.createLinearGradient(0, y1, 0, L.sy);
    gr.addColorStop(0, 'rgba(6,0,22,0.25)'); gr.addColorStop(1, 'rgba(6,0,22,0.88)');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y1); g.lineTo(x3, y3); g.lineTo(x4, y3); g.closePath(); g.fill();
    // lane flashes
    for (let i = 0; i < 4; i++) {
      if (G.laneHit[i] <= 0) continue;
      const fa = -0.5 + i / 4, fb = fa + 0.25;
      const [ax, ay] = P(fa, 0.45), [bx] = P(fb, 0.45), [cx2, cy2] = P(fb, 1.05), [dx] = P(fa, 1.05);
      gr = g.createLinearGradient(0, ay, 0, cy2);
      gr.addColorStop(0, hexA(LC[i], 0)); gr.addColorStop(1, hexA(LC[i], 0.45 * G.laneHit[i]));
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, ay); g.lineTo(cx2, cy2); g.lineTo(dx, cy2); g.closePath(); g.fill();
    }
    // lane separators
    g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1.5;
    for (const f of [-0.25, 0, 0.25]) {
      const [a, b] = P(f, sFar), [c, d] = P(f, sNear);
      g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke();
    }
    // beat lines
    const spb = G.spb;
    for (let b = Math.ceil((t - look * 0.05) / spb); b * spb < t + look; b++) {
      const z = (b * spb - t) / look;
      const s = 1 / (1 + 4 * z);
      const [ax, ay] = P(-0.5, s), [bx] = P(0.5, s);
      g.globalAlpha = clamp((1 - z) * 4, 0, 1) * (b % 4 === 0 ? 0.4 : 0.15);
      g.strokeStyle = '#fff'; g.lineWidth = (b % 4 === 0 ? 3 : 1.5) * s;
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, ay); g.stroke();
    }
    g.globalAlpha = 1;
    // rails
    for (const f of [-0.5, 0.5]) {
      const [a, b] = P(f, sFar), [c, d] = P(f, sNear);
      g.strokeStyle = hexA(accent, 0.25); g.lineWidth = 12;
      g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke();
      g.strokeStyle = accent; g.lineWidth = 3; g.stroke();
    }
    // strike line (kick bar)
    const [kx1] = P(-0.5, 1), [kx2] = P(0.5, 1);
    const kh = G.laneHit[4];
    g.fillStyle = hexA(LC[4], 0.35 + kh * 0.65);
    rr(kx1, L.sy - 5, kx2 - kx1, 10, 5); g.fill();
    if (kh > 0) { g.fillStyle = hexA(LC[4], kh * 0.25); rr(kx1, L.sy - 18, kx2 - kx1, 36, 18); g.fill(); }
    // targets
    const rxT = L.bw / 4 * 0.38, ryT = rxT * 0.42;
    for (let i = 0; i < 4; i++) {
      const x = laneX(L, i, 1), y = L.sy;
      g.fillStyle = G.laneHit[i] > 0 ? hexA(LC[i], 0.4 + G.laneHit[i] * 0.6) : 'rgba(0,0,0,0.55)';
      g.beginPath(); g.ellipse(x, y, rxT, ryT, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = LC[i]; g.lineWidth = 4;
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(x, y, rxT * 0.6, ryT * 0.6, 0, 0, Math.PI * 2); g.stroke();
    }
    // notes
    const vis = [];
    for (let i = G.first; i < G.chart.length; i++) {
      const n = G.chart[i];
      const z = (n.t - t) / look;
      if (z > 1) break;
      if (z < -0.12) continue;
      if (n.res && n.res !== 'm') continue;
      vis.push([n, z]);
    }
    vis.sort((a, b) => b[1] - a[1] || (a[0].lane === 4 ? -1 : 1));
    for (const [n, z] of vis) {
      const s = 1 / (1 + 4 * z);
      const y = L.hy + (L.sy - L.hy) * s;
      const missed = n.res === 'm';
      g.globalAlpha = clamp((1 - z) * 5, 0, 1) * (missed ? 0.3 : 1);
      if (n.lane === 4) {
        const w = L.bw * 0.96 * s, h = Math.max(4, L.bw * 0.035 * s);
        gr = g.createLinearGradient(0, y - h, 0, y + h);
        const c = missed ? '#666' : G.rageOn ? '#ffe066' : LC[4];
        gr.addColorStop(0, '#fff'); gr.addColorStop(0.35, c); gr.addColorStop(1, hexA(c, 0.6));
        g.fillStyle = gr; rr(L.cx - w / 2, y - h / 2, w, h, h / 2); g.fill();
      } else {
        const x = laneX(L, n.lane, s);
        const rx = L.bw / 4 * 0.4 * s, ry = rx * 0.45;
        const c = missed ? '#666' : G.rageOn ? '#ffd000' : LC[n.lane];
        g.fillStyle = 'rgba(0,0,0,0.6)';
        g.beginPath(); g.ellipse(x, y + ry * 0.4, rx, ry, 0, 0, Math.PI * 2); g.fill();
        gr = g.createRadialGradient(x - rx * 0.3, y - ry * 0.5, 1, x, y, rx);
        gr.addColorStop(0, '#fff'); gr.addColorStop(0.35, c); gr.addColorStop(1, hexA(c, 0.85));
        g.fillStyle = gr;
        g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = Math.max(1, 2.5 * s); g.stroke();
        if ('HORC'.includes(n.k)) {
          g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = Math.max(1, 2 * s);
          g.beginPath(); g.ellipse(x, y, rx * 0.55, ry * 0.55, 0, 0, Math.PI * 2); g.stroke();
        }
        if (G.rageOn && !missed) {
          g.strokeStyle = 'rgba(255,240,120,0.5)'; g.lineWidth = 6 * s;
          g.beginPath(); g.ellipse(x, y, rx * 1.15, ry * 1.2, 0, 0, Math.PI * 2); g.stroke();
        }
      }
    }
    g.globalAlpha = 1;
    // kick zones
    const zw = L.left - 24;
    if (zw > 50) {
      for (const zx of [12, L.right + 12]) {
        const zy = H * 0.6, zh = H * 0.4 - 12;
        g.fillStyle = hexA(LC[4], 0.08 + kh * 0.45);
        rr(zx, zy, zw, zh, 18); g.fill();
        g.strokeStyle = hexA(LC[4], 0.55 + kh * 0.45); g.lineWidth = 3; g.stroke();
        // pedal icon
        const pw = Math.min(zw * 0.35, 60), ph = pw * 1.5, px = zx + zw / 2 - pw / 2, py = zy + zh / 2 - ph / 2 - 10;
        g.fillStyle = hexA('#ffffff', 0.18 + kh * 0.5); rr(px, py, pw, ph, 10); g.fill();
        g.fillStyle = hexA(LC[4], 0.9);
        g.font = `italic 900 ${Math.round(Math.min(26, zw * 0.18))}px Roboto, system-ui, sans-serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('KICK', zx + zw / 2, py + ph + 20);
      }
    }
    g.restore();
    drawHUD(L, t);
  }

  function drawHUD(L, t) {
    const S = G.S;
    g.textBaseline = 'alphabetic';
    // score
    g.textAlign = 'left';
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.font = '900 12px Roboto, system-ui, sans-serif';
    g.fillText('SCORE', 18, 24);
    g.fillStyle = '#fff'; g.font = 'italic 900 32px Roboto, system-ui, sans-serif';
    g.fillText(fmt(G.score), 18, 56);
    // multiplier
    const mx = 58, my = 112, mr = 34;
    const m = G.mult * (G.rageOn ? 2 : 1);
    const mc = G.rageOn ? '#ffd000' : ['#fff', '#fff', '#ffd60a', '#2ee879', '#ff2bd6'][G.mult];
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.15)'; g.lineWidth = 6; g.stroke();
    const prog = G.mult >= 4 ? 1 : (G.combo % 10) / 10;
    g.strokeStyle = mc; g.beginPath(); g.arc(mx, my, mr, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2); g.stroke();
    g.fillStyle = mc; g.textAlign = 'center'; g.font = 'italic 900 28px Roboto, system-ui, sans-serif';
    g.fillText('x' + m, mx, my + 10);
    if (G.combo >= 5) {
      g.font = 'italic 900 18px Roboto, system-ui, sans-serif'; g.fillStyle = '#fff'; g.textAlign = 'left';
      g.fillText(G.combo + ' COMBO', 102, my + 7);
    }
    // rage meter
    const rx = 18, ry = 168, rw = Math.min(170, L.left - 36), rh = 12;
    if (rw > 40) {
      g.fillStyle = 'rgba(255,255,255,0.6)'; g.font = '900 11px Roboto, system-ui, sans-serif'; g.textAlign = 'left';
      g.fillText(G.rageOn ? 'RAGE MODE ACTIVE' : G.rage >= 0.5 ? 'RAGE READY! TAP ▶' : 'RAGE', rx, ry - 6);
      g.fillStyle = 'rgba(0,0,0,0.6)'; rr(rx, ry, rw, rh, 6); g.fill();
      const gg = g.createLinearGradient(rx, 0, rx + rw, 0);
      gg.addColorStop(0, '#ff3b00'); gg.addColorStop(1, '#ffd000');
      g.fillStyle = gg; if (G.rage > 0.01) { rr(rx, ry, rw * G.rage, rh, 6); g.fill(); }
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.5; rr(rx, ry, rw, rh, 6); g.stroke();
      g.fillStyle = '#fff'; g.fillRect(rx + rw * 0.5 - 1, ry - 2, 2, rh + 4);
    }
    // title + progress
    g.textAlign = 'center';
    g.font = 'italic 900 15px Roboto, system-ui, sans-serif'; g.fillStyle = '#fff';
    g.fillText(S.title.toUpperCase(), W / 2, 20);
    g.font = '700 11px Roboto, system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,0.6)';
    g.fillText(`${S.artist} · ${DIFF[selDiff]}`, W / 2, 35);
    const pw = Math.min(260, W * 0.3), pp = clamp(t / G.data.dur, 0, 1);
    g.fillStyle = 'rgba(255,255,255,0.15)'; rr(W / 2 - pw / 2, 42, pw, 5, 2.5); g.fill();
    g.fillStyle = BG.th.accent; rr(W / 2 - pw / 2, 42, Math.max(5, pw * pp), 5, 2.5); g.fill();
    // section name
    if (G.secT > 0 && t > 0) {
      g.globalAlpha = Math.min(1, G.secT);
      g.font = 'italic 900 22px Roboto, system-ui, sans-serif'; g.fillStyle = BG.th.accent;
      g.fillText('— ' + G.secName + ' —', W / 2, H * 0.3);
      g.globalAlpha = 1;
    }
    // countdown
    if (t < 0) {
      const n = Math.ceil(-t / G.spb);
      const f = (-t / G.spb) % 1;
      if (n <= 4) {
        g.font = `italic 900 ${Math.round(90 + f * 50)}px Roboto, system-ui, sans-serif`;
        g.globalAlpha = 0.4 + f * 0.6;
        g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.strokeText(n, W / 2, H * 0.48);
        g.fillStyle = '#fff'; g.fillText(n, W / 2, H * 0.48);
        g.globalAlpha = 1;
      }
      g.font = 'italic 900 18px Roboto, system-ui, sans-serif'; g.fillStyle = '#ffd000';
      g.fillText('GET READY!', W / 2, H * 0.6);
    }
  }

  function pauseGame() {
    if (!G || G.paused || G.ended) return;
    G.pauseT = songT(); G.paused = true;
    A.suspend();
    overlay('pause', true);
  }
  function resumeGame() {
    if (!G) return;
    overlay('pause', false);
    A.resume();
    G.paused = false;
  }
  function quitGame() {
    if (G) { G.seq.stop(); G = null; }
    A.resume();
    BG.lasers = 0;
    toSongs();
  }

  function endGame() {
    G.ended = true;
    const S = G.S, c = G.cnt, N = Math.max(1, G.total);
    const acc = (c.p + c.g * 0.7 + c.o * 0.4) / N;
    const ratio = G.score / Math.max(1, G.maxScore);
    const stars = [0.12, 0.3, 0.5, 0.72, 0.9].filter(x => ratio >= x).length;
    const grade = acc >= 0.95 && c.m === 0 ? 'S' : acc >= 0.9 ? 'A' : acc >= 0.78 ? 'B' : acc >= 0.6 ? 'C' : 'D';
    const key = S.id + '_' + selDiff;
    const isNew = !BEST[key] || G.score > BEST[key].score;
    if (isNew) { BEST[key] = { score: G.score, stars, grade }; saveBest(); }
    $('r-head').textContent = c.m === 0 ? 'FULL COMBO!!' : stars >= 4 ? 'YOU ROCKED IT!' : stars >= 2 ? 'SONG COMPLETE!' : 'KEEP PRACTICING!';
    $('r-song').textContent = `${S.title} — ${S.artist} · ${DIFF[selDiff]}`;
    $('r-grade').textContent = grade;
    $('r-score').textContent = fmt(G.score);
    $('r-stars').innerHTML = '★'.repeat(stars) + `<span class="off">${'★'.repeat(5 - stars)}</span>`;
    $('r-new').style.display = isNew && G.score > 0 ? 'block' : 'none';
    $('r-grid').innerHTML = `<div>Perfect <b>${c.p}</b></div><div>Great <b>${c.g}</b></div><div>Good <b>${c.o}</b></div>` +
      `<div>Miss <b>${c.m}</b></div><div>Max Combo <b>${G.maxCombo}</b></div><div>Accuracy <b>${Math.round(acc * 100)}%</b></div>`;
    overlay('results', true);
    for (let i = 0; i < 6; i++) setTimeout(() => burst(Math.random() * W, Math.random() * H * 0.6, ['#ffd000', '#ff2bd6', '#00f0ff', '#2ee879'][i % 4], 40, 500), i * 180);
    if (stars >= 3) A.drum('crash', 0, 1);
    setTheme(S.theme);
  }

  // ============================================================
  //  FREE PLAY
  // ============================================================
  const PADS = [
    { id: 'crash', x: 0.22, y: 0.27, r: 0.17, snd: 'crash', cym: 1, col: '#2ee879', label: 'CRASH', key: 'q' },
    { id: 'tom1', x: 0.57, y: 0.26, r: 0.14, snd: 'tom1', col: '#2f8bff', label: 'TOM 1', key: 'w' },
    { id: 'tom2', x: 0.87, y: 0.26, r: 0.14, snd: 'tom2', col: '#7a5cff', label: 'TOM 2', key: 'e' },
    { id: 'ride', x: 1.24, y: 0.30, r: 0.19, snd: 'ride', cym: 1, col: '#00e5ff', label: 'RIDE', key: 'r' },
    { id: 'hhc', x: 0.20, y: 0.64, r: 0.16, snd: 'hhc', cym: 1, col: '#ffd60a', label: 'HI-HAT', key: 'a' },
    { id: 'hho', x: 0.38, y: 0.90, r: 0.065, snd: 'hho', cym: 1, col: '#ffd60a', label: 'OPEN', key: 'z' },
    { id: 'snare', x: 0.53, y: 0.62, r: 0.155, snd: 'snare', col: '#ff2d55', label: 'SNARE', key: 's' },
    { id: 'kick', x: 0.88, y: 0.75, r: 0.2, snd: 'kick', col: '#ff8c1a', label: 'KICK', kick: 1, key: ' ' },
    { id: 'floor', x: 1.26, y: 0.68, r: 0.17, snd: 'tom3', col: '#2ee879', label: 'FLOOR', key: 'd' },
    { id: 'clap', x: 1.50, y: 0.55, r: 0.07, snd: 'clap', col: '#ff6ad5', label: 'CLAP', key: 'f' },
    { id: 'cow', x: 1.50, y: 0.88, r: 0.075, snd: 'cowbell', col: '#ffb000', label: 'COW', key: 'c' },
  ];
  const KIT_W = 1.6;
  const FL = { sc: 1, ox: 0, oy: 0 };
  function layoutFree() {
    const top = 66, aw = W - 20, ah = H - top - 8;
    FL.sc = Math.min(aw / KIT_W, ah);
    FL.ox = (W - KIT_W * FL.sc) / 2;
    FL.oy = top + (ah - FL.sc) / 2;
  }
  const F = { flash: {}, jam: -1, jamSeq: null, jamStart: 0, jamLen: 0, bpm: 100, metro: false, metroNext: 0, metroBeat: 0, rec: false, loop: [], loopStart: 0, loopLen: 0, schedTo: 0, lastBeat: -1 };

  function padAt(px, py) {
    let best = null, bd = 1e9;
    for (const p of PADS) {
      const cx = FL.ox + p.x * FL.sc, cy = FL.oy + p.y * FL.sc, r = p.r * FL.sc;
      const d = Math.hypot(px - cx, py - cy) / r;
      if (d < 1.12 && d < bd) { bd = d; best = p; }
    }
    return best;
  }
  function freeHit(p) {
    A.drum(p.snd, 0, 1);
    F.flash[p.id] = 1;
    const cx = FL.ox + p.x * FL.sc, cy = FL.oy + p.y * FL.sc, r = p.r * FL.sc;
    burst(cx, cy, p.col, p.kick ? 26 : 14, p.kick ? 520 : 360);
    ring(cx, cy, p.col, r * 0.9, 1, 220);
    if (p.kick) BG.pulse = 1;
    if (p.cym) BG.pulse = Math.max(BG.pulse, 0.5);
    if (F.rec && F.loopLen) {
      const L = F.loopLen;
      const off = (((A.now() - ST.offset / 1000) - F.loopStart) % L + L) % L;
      F.loop.push({ off, snd: p.snd, id: p.id });
    }
    vibe(p.kick ? 20 : 10);
  }
  function enterFree() {
    stopLoop();
    F.flash = {};
    show('free');
    updateFreeBar();
  }
  function leaveFree() {
    if (F.jamSeq) { F.jamSeq.stop(); F.jamSeq = null; }
    F.jam = -1; F.metro = false; F.rec = false; F.loop = []; F.loopLen = 0;
    BG.lasers = 0;
    toTitle();
  }
  function gridBase() { return F.jamSeq ? F.jamStart : A.ctxTime(); }
  function setJam(idx) {
    if (F.jamSeq) { F.jamSeq.stop(); F.jamSeq = null; }
    F.jam = idx;
    if (idx >= 0) {
      const S = SONGS[idx], L = buildLoop(S, S.jam);
      F.jamStart = A.ctxTime() + 0.12;
      F.jamSeq = new Seq(L.ev, F.jamStart, L.len, 0.95);
      F.jamLen = L.len;
      F.bpm = S.bpm;
      A.setDelay(60 / S.bpm * 0.75);
      setTheme(S.theme);
      if (F.metro) F.metroNext = F.jamStart, F.metroBeat = 0;
    } else setTheme('neon');
    F.lastBeat = -1;
    updateFreeBar();
  }
  function updateFreeBar() {
    $('b-jam').textContent = F.jam < 0 ? 'JAM: OFF' : 'JAM: ' + SONGS[F.jam].title.toUpperCase();
    $('b-jam').classList.toggle('on', F.jam >= 0);
    $('bpm-v').textContent = F.bpm;
    $('b-metro').classList.toggle('on', F.metro);
    const rb = $('b-rec');
    rb.classList.toggle('on', F.rec);
    rb.classList.toggle('loop', !F.rec && F.loop.length > 0);
    rb.textContent = F.rec ? '● REC' : F.loop.length ? '▶ LOOP' : '● REC';
  }
  function updateFree(dt) {
    const now = A.ctxTime(), to = now + 0.2;
    if (F.jamSeq) F.jamSeq.pump(0.25);
    const spb = 60 / F.bpm;
    if (F.metro) {
      if (F.metroNext < now - 0.1) {
        const base = gridBase();
        const k = Math.ceil((now - base) / spb);
        F.metroNext = base + k * spb; F.metroBeat = k;
      }
      while (F.metroNext < to) {
        const acc = F.metroBeat % 4 === 0;
        A.drum('stick', F.metroNext, acc ? 1 : 0.55, acc ? 1.4 : 1);
        F.metroNext += spb; F.metroBeat++;
      }
    }
    if (F.loop.length && F.loopLen) {
      const L = F.loopLen;
      for (const h of F.loop) {
        let k = Math.ceil((F.schedTo - F.loopStart - h.off) / L);
        let tt = F.loopStart + h.off + k * L;
        while (tt < to) {
          if (tt >= F.schedTo) {
            A.drum(h.snd, tt, 0.85);
            const id = h.id, delay = (tt - now) * 1000;
            setTimeout(() => { F.flash[id] = Math.max(F.flash[id] || 0, 0.6); }, Math.max(0, delay));
          }
          tt += L;
        }
      }
    }
    F.schedTo = to;
    for (const k in F.flash) F.flash[k] = Math.max(0, F.flash[k] - dt * 4);
    BG.bpm = F.bpm;
    const hb = A.now() - gridBase();
    const beat = Math.floor(hb / spb);
    if ((F.jamSeq || F.metro) && beat !== F.lastBeat) { F.lastBeat = beat; BG.pulse = Math.max(BG.pulse, 0.5); }
    BG.lasers += ((F.jamSeq ? 0.55 : 0.08) - BG.lasers) * dt * 2;
  }
  function drawPad(p) {
    const cx = FL.ox + p.x * FL.sc, cy = FL.oy + p.y * FL.sc;
    const fl = F.flash[p.id] || 0;
    const r = p.r * FL.sc * (1 - fl * 0.06);
    // glow
    if (fl > 0) {
      const gl = g.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 1.6);
      gl.addColorStop(0, hexA(p.col, 0.6 * fl)); gl.addColorStop(1, hexA(p.col, 0));
      g.fillStyle = gl; g.beginPath(); g.arc(cx, cy, r * 1.6, 0, Math.PI * 2); g.fill();
    }
    // shadow
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.beginPath(); g.ellipse(cx, cy + r * 0.12, r * 1.02, r * 1.02, 0, 0, Math.PI * 2); g.fill();
    if (p.cym) {
      const gr = g.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.05, cx, cy, r);
      gr.addColorStop(0, '#fff6c8'); gr.addColorStop(0.45, '#e0b440'); gr.addColorStop(1, '#8a5a10');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(90,50,0,0.35)'; g.lineWidth = 1;
      for (let k = 0.3; k < 1; k += 0.1) { g.beginPath(); g.arc(cx, cy, r * k, 0, Math.PI * 2); g.stroke(); }
      g.fillStyle = '#c99a2e'; g.beginPath(); g.arc(cx, cy, r * 0.2, 0, Math.PI * 2); g.fill();
      g.strokeStyle = hexA(p.col, 0.7 + fl * 0.3); g.lineWidth = 3 + fl * 3;
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
    } else {
      // shell rim
      g.fillStyle = p.col; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2; g.stroke();
      // head
      const hr = r * (p.kick ? 0.86 : 0.84);
      const gr = g.createRadialGradient(cx - hr * 0.3, cy - hr * 0.35, hr * 0.1, cx, cy, hr);
      if (p.kick) { gr.addColorStop(0, '#3a2a4a'); gr.addColorStop(1, '#0d0618'); }
      else { gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#c9c9d6'); }
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, hr, 0, Math.PI * 2); g.fill();
      if (fl > 0) { g.fillStyle = hexA(p.col, fl * 0.55); g.fill(); }
      // lugs
      g.fillStyle = '#ddd';
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; g.beginPath(); g.arc(cx + Math.cos(a) * r * 0.93, cy + Math.sin(a) * r * 0.93, r * 0.04, 0, Math.PI * 2); g.fill(); }
      if (p.kick) {
        g.save(); g.translate(cx, cy); g.rotate(-0.12);
        g.font = `italic 900 ${Math.round(r * 0.34)}px Roboto, system-ui, sans-serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = '#ff2bd6'; g.fillText('DRUM', 0, -r * 0.16);
        g.fillStyle = '#ffb300'; g.fillText('RIOT', 0, r * 0.2);
        g.restore();
      }
    }
    // label
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const fs = Math.max(10, Math.round(Math.min(18, r * 0.3)));
    g.font = `900 ${fs}px Roboto, system-ui, sans-serif`;
    const ly = p.kick ? cy + r * 0.62 : (p.r < 0.1 ? cy : cy + r * 0.55);
    const light = p.cym || p.kick || p.r < 0.1;
    if (light) { g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.strokeText(p.label, cx, ly); }
    g.fillStyle = light ? '#fff' : '#3a3a4a';
    g.fillText(p.label, cx, ly);
  }
  function drawFree() {
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, W, H);
    for (const p of PADS) drawPad(p);
    if (F.loopLen && (F.rec || F.loop.length)) {
      const L = F.loopLen;
      const ph = (((A.now() - F.loopStart) % L) + L) % L / L;
      const w = Math.min(300, W * 0.35), x = W / 2 - w / 2, y = 62;
      g.fillStyle = 'rgba(0,0,0,0.5)'; rr(x, y, w, 6, 3); g.fill();
      g.fillStyle = F.rec ? '#ff1744' : '#2ee879'; rr(x, y, Math.max(6, w * ph), 6, 3); g.fill();
      for (const h of F.loop) { g.fillStyle = '#fff'; g.fillRect(x + w * h.off / L - 1, y - 2, 2, 10); }
    }
  }

  // ============================================================
  //  NAV
  // ============================================================
  function toTitle() {
    show('title');
    setTheme('neon');
    if (menuIdx !== 1) playLoop(1, false, 0.7);
  }
  function toSongs() {
    show('songs');
    buildSongList();
    selectSong(selSong);
  }
  function buildSettings() {
    const rngs = { music: v => Math.round(v * 100) + '%', drums: v => Math.round(v * 100) + '%', speed: v => 'x' + (+v).toFixed(1), offset: v => v + 'ms' };
    for (const k in rngs) {
      const el = $('s-' + k), lb = $('v-' + k);
      el.value = ST[k]; lb.textContent = rngs[k](ST[k]);
      el.oninput = () => { ST[k] = +el.value; lb.textContent = rngs[k](ST[k]); A.setVolumes(ST.music, ST.drums); saveSettings(); };
    }
    for (const k of ['autoKick', 'vibe', 'low']) {
      const el = $('s-' + k);
      el.checked = !!ST[k];
      el.onchange = () => { ST[k] = el.checked; saveSettings(); if (k === 'low') resize(); };
    }
    $('s-drums').addEventListener('change', () => A.drum('snare', 0, 1));
  }

  const tap = (id, fn) => $(id).addEventListener('click', fn);
  $('scr-splash').addEventListener('click', () => {
    A.init();
    A.setVolumes(ST.music, ST.drums);
    toTitle();
  });
  tap('b-play', toSongs);
  tap('b-free', enterFree);
  tap('b-settings', () => { show('settings'); buildSettings(); });
  document.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => toTitle()));
  tap('b-go', startGame);
  tap('b-pause', pauseGame);
  tap('b-resume', resumeGame);
  tap('b-restart', () => { overlay('pause', false); if (G) G.seq.stop(); A.resume(); startGame(); });
  tap('b-quit', quitGame);
  tap('b-again', () => { if (G) G.seq.stop(); startGame(); });
  tap('b-next', () => { if (G) G.seq.stop(); G = null; toSongs(); });
  $('b-rage').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); activateRage(); });
  tap('b-free-back', leaveFree);
  tap('b-jam', () => setJam(F.jam + 1 >= SONGS.length ? -1 : F.jam + 1));
  tap('b-bpm-', () => { if (F.jam >= 0) setJam(-1); F.bpm = Math.max(50, F.bpm - 5); updateFreeBar(); });
  tap('b-bpm+', () => { if (F.jam >= 0) setJam(-1); F.bpm = Math.min(220, F.bpm + 5); updateFreeBar(); });
  tap('b-metro', () => { F.metro = !F.metro; F.metroNext = 0; updateFreeBar(); });
  tap('b-rec', () => {
    if (!F.rec) {
      if (!F.loopLen || !F.loop.length) {
        F.loopLen = 8 * 60 / F.bpm;
        F.loopStart = F.jamSeq ? F.jamStart : A.now() - ST.offset / 1000;
        F.schedTo = A.ctxTime();
        F.loop = [];
      }
      F.rec = true;
    } else F.rec = false;
    updateFreeBar();
  });
  tap('b-clear', () => { F.loop = []; F.rec = false; F.loopLen = 0; updateFreeBar(); });

  // ---------- input ----------
  cv.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (screen === 'game') gameHit(laneAt(e.clientX));
    else if (screen === 'free') { const p = padAt(e.clientX, e.clientY); if (p) freeHit(p); }
  }, { passive: false });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('contextmenu', e => e.preventDefault());
  const GKEYS = { d: 0, f: 1, j: 2, k: 3, ' ': 4, x: 4 };
  window.addEventListener('keydown', e => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') { window.androidBack(); return; }
    if (screen === 'game') {
      if (k in GKEYS) { e.preventDefault(); gameHit(GKEYS[k]); }
      else if (k === 'enter') activateRage();
    } else if (screen === 'free') {
      const p = PADS.find(p => p.key === k);
      if (p) { e.preventDefault(); freeHit(p); }
    }
  });

  // ---------- android bridge ----------
  window.androidBack = () => {
    switch (screen) {
      case 'game':
        if (G && !G.ended) { if (G.paused) quitGame(); else pauseGame(); }
        else { if (G) G.seq.stop(); G = null; toSongs(); }
        return true;
      case 'songs': case 'settings': toTitle(); return true;
      case 'free': leaveFree(); return true;
      default: return false;
    }
  };
  window.appPause = () => { if (screen === 'game' && G && !G.paused && !G.ended) pauseGame(); else A.suspend(); };
  window.appResume = () => { if (!(screen === 'game' && G && G.paused)) A.resume(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) window.appPause(); else window.appResume(); });

  // ---------- main loop ----------
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, ST.low ? 1 : 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    BG.dirty = true;
    layoutFree();
  }
  window.addEventListener('resize', resize);
  resize();

  let lastTs = performance.now();
  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (ts - lastTs) / 1000));
    lastTs = ts;
    const tm = ts / 1000;
    if (A.ready) BG.energy += (A.level() - BG.energy) * 0.3;
    if (menuSeq) {
      menuSeq.pump(); if (menuDrums) menuDrums.pump();
      const b = Math.floor((A.now() - menuStart) / menuSpb);
      if (b !== menuBeat && b >= 0) { menuBeat = b; BG.pulse = Math.max(BG.pulse, b % 4 === 0 ? 0.8 : 0.35); }
      BG.lasers += (0.45 - BG.lasers) * dt * 2;
    } else if (screen === 'splash') BG.lasers += (0.3 - BG.lasers) * dt;
    if (screen === 'game' && G) updateGame(dt);
    if (screen === 'free') updateFree(dt);
    drawBG(dt, tm);
    if (screen === 'game' && G) drawGame(dt);
    else if (screen === 'free') drawFree();
    drawFX(dt);
  }
  requestAnimationFrame(frame);
})();
