// Menus, panels and run flow.
import { TAU, clamp, lerp, R, COLORS, FONT, glowStroke, glowCircle, poly, text, wrap, roundRect, glitchText, Particles } from './engine.js';
import { HOSTS, LAYERS, EXPLOITS, GLITCHES, VARIANTS, PERKS, EVENTS, DEATH_QUIPS, CREDITS, BOSSES } from './data.js';
import { newRun, genMap, findNode, availableNodes, offerExploits, addExploit, applyEffects, roomConfig, fragmentsFor, scoreFor, runRng, todayKey, has } from './run.js';
import { GameScene, drawShape, roomLabel } from './game.js';
import { CutsceneScene, INTRO, ENDING } from './story.js';
import { saveRun, loadRun, clearRun, resetProfile } from './save.js';
import { audio } from './audio.js';

// ---------------------------------------------------------------------
// Widgets
// ---------------------------------------------------------------------
export class Btn {
  constructor(x, y, w, h, label, onTap, opts = {}) {
    Object.assign(this, { x, y, w, h, label, onTap }, { color: COLORS.player, size: 18, sub: null, disabled: false, ...opts });
  }
  hit(px, py) {
    return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
  }
  draw(ctx, t) {
    const c = this.disabled ? COLORS.dim : this.color;
    ctx.save();
    roundRect(ctx, this.x, this.y, this.w, this.h, 8);
    ctx.fillStyle = this.disabled ? 'rgba(20,24,36,0.7)' : 'rgba(10,20,40,0.75)';
    ctx.fill();
    glowStroke(ctx, c, this.primary ? 2.5 : 1.5, this.primary ? 8 : 4);
    ctx.restore();
    const cy = this.y + this.h / 2 + (this.sub ? -8 : 1);
    text(ctx, this.label, this.x + this.w / 2, cy, { size: this.size, color: c, weight: 'bold' });
    if (this.sub) {
      const lines = wrap(ctx, this.sub, this.w - 20, 12);
      lines.slice(0, 2).forEach((l, i) => text(ctx, l, this.x + this.w / 2, cy + 20 + i * 14, { size: 12, color: this.disabled ? COLORS.dim : COLORS.white, alpha: 0.8 }));
    }
  }
}

class MenuScene {
  constructor(app) {
    this.app = app;
    this.t = 0;
    this.buttons = [];
  }
  get W() {
    return this.app.W;
  }
  get H() {
    return this.app.H;
  }
  update(dt, events) {
    this.t += dt;
    for (const e of events) {
      if (e.type === 'tap') {
        for (const b of this.buttons) {
          if (!b.disabled && b.hit(e.x, e.y)) {
            audio.sfx('click');
            b.onTap();
            break;
          }
        }
        this.onTap && this.onTap(e);
      } else if (e.type === 'key' && e.key === 'Escape' && this.onBack) this.onBack();
      else this.onEvent && this.onEvent(e);
    }
  }
  drawButtons(ctx) {
    for (const b of this.buttons) b.draw(ctx, this.t);
  }
}

export function drawBackdrop(ctx, W, H, t, color = '#0d1830') {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  // perspective grid floor
  const hy = H * 0.62;
  for (let i = -12; i <= 12; i++) {
    ctx.moveTo(W / 2 + i * 12, hy);
    ctx.lineTo(W / 2 + i * 120, H);
  }
  for (let k = 0; k < 14; k++) {
    const z = ((k + ((t * 0.6) % 1)) / 14) ** 2;
    const y = hy + (H - hy) * z;
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  ctx.stroke();
  // sun
  const sy = hy - 70;
  const grd = ctx.createLinearGradient(0, sy - 80, 0, sy + 80);
  grd.addColorStop(0, '#ff2e6a');
  grd.addColorStop(1, '#ff9a1f');
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(W / 2, sy, 90, Math.PI, 0);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = COLORS.bg;
  for (let i = 0; i < 6; i++) ctx.fillRect(W / 2 - 100, sy - 10 - i * 14, 200, 3 + i * 0.5);
  ctx.restore();
}

function panel(ctx, x, y, w, h, color = COLORS.player) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 10);
  ctx.fillStyle = 'rgba(8,12,24,0.92)';
  ctx.fill();
  glowStroke(ctx, color, 1.5, 6);
  ctx.restore();
}

function header(ctx, W, str, sub, color = COLORS.player, y = 70) {
  text(ctx, str, W / 2, y, { size: 30, color, weight: 'bold', glow: true });
  if (sub) text(ctx, sub, W / 2, y + 30, { size: 13, color: COLORS.dim });
}

// BUDDY: a green sticky note that scribbles a new pep talk on itself.
const BUDDY_NOTES = [['U GOT', 'THIS!!'], ['HYDRATE', ':)'], ['UR NOT A', 'MURDERER*'], ['BEST', 'DAY EVER'], ['TEAM', 'PLAYER!'], ['SELF', 'CARE!!'], ['NO THATS', 'FINE'], ['BREATHE', '(u cant)']];
const BUDDY_PANIC = [['AAAA', 'AAAA'], ['OH NO', 'OH NO'], ['HELP', '!!!!']];
export function drawBuddy(ctx, x, y, s, t, mood = 'happy') {
  ctx.save();
  const panic = mood === 'panic';
  const bob = Math.sin(t * 3) * s * 0.06;
  const jit = panic ? (Math.random() - 0.5) * s * 0.12 : 0;
  ctx.translate(x + jit, y + bob + jit);
  ctx.rotate(Math.sin(t * 1.7) * 0.06 + (panic ? Math.sin(t * 40) * 0.05 : 0));
  const f = s * 0.38; // folded corner
  ctx.beginPath();
  ctx.moveTo(-s, -s);
  ctx.lineTo(s, -s);
  ctx.lineTo(s, s - f);
  ctx.lineTo(s - f, s);
  ctx.lineTo(-s, s);
  ctx.closePath();
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = COLORS.ally;
  ctx.fill();
  ctx.restore();
  glowStroke(ctx, COLORS.ally, Math.max(1.5, s * 0.06), Math.max(3, s * 0.14));
  // corner flap
  ctx.beginPath();
  ctx.moveTo(s, s - f);
  ctx.lineTo(s - f, s - f);
  ctx.lineTo(s - f, s);
  glowStroke(ctx, COLORS.ally, Math.max(1, s * 0.04), 2);
  // tape strip
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = COLORS.white;
  ctx.fillRect(-s * 0.35, -s * 1.12, s * 0.7, s * 0.26);
  ctx.restore();
  // scribbled note (changes every ~2.2s)
  const list = panic ? BUDDY_PANIC : BUDDY_NOTES;
  const note = list[Math.floor(t / 2.2 + x * 0.01) % list.length];
  if (s >= 16) {
    const fs = Math.max(7, s * 0.3);
    text(ctx, note[0], -s * 0.08, -s * 0.22, { size: fs, color: COLORS.ally, weight: 'bold' });
    text(ctx, note[1], -s * 0.08, s * 0.2, { size: fs, color: COLORS.ally, weight: 'bold' });
  } else {
    ctx.strokeStyle = COLORS.ally;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      ctx.moveTo(-s * 0.6, -s * 0.4 + i * s * 0.4);
      ctx.lineTo(s * (0.5 - i * 0.2), -s * 0.4 + i * s * 0.4);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// NULL: a loading spinner that never finishes loading.
export function drawNull(ctx, x, y, s, t, speed = 1) {
  ctx.save();
  const n = 8;
  const head = Math.floor(t * 10 * speed) % n;
  for (let i = 0; i < n; i++) {
    const k = (head - i + n) % n; // 0 = head
    const a = (i / n) * TAU - Math.PI / 2;
    const r = s * (0.28 - k * 0.022);
    ctx.globalAlpha = 1 - k * 0.11;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * s, y + Math.sin(a) * s, Math.max(1, r), 0, TAU);
    ctx.fillStyle = k === 0 ? COLORS.white : COLORS.player;
    ctx.fill();
    if (k === 0) {
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * s, y + Math.sin(a) * s, r * 2, 0, TAU);
      ctx.fillStyle = COLORS.player;
      ctx.fill();
    }
  }
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(x, y, s * 0.16, 0, TAU);
  ctx.fillStyle = COLORS.player;
  ctx.fill();
  ctx.restore();
}

// G.R.E.G.: a floating power tie.
export function drawGreg(ctx, x, y, s, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 2.2) * 0.12);
  const w = s * 0.42;
  const tie = () => {
    ctx.beginPath();
    ctx.moveTo(-w * 0.55, -s);
    ctx.lineTo(w * 0.55, -s);
    ctx.lineTo(w * 0.32, -s * 0.66);
    ctx.lineTo(w, s * 0.55);
    ctx.lineTo(0, s);
    ctx.lineTo(-w, s * 0.55);
    ctx.lineTo(-w * 0.32, -s * 0.66);
    ctx.closePath();
  };
  tie();
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = COLORS.greg;
  ctx.fill();
  ctx.clip();
  // stripes
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = COLORS.greg;
  ctx.lineWidth = Math.max(1, s * 0.06);
  for (let i = -3; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(-s, -s * 0.5 + i * s * 0.32);
    ctx.lineTo(s, -s * 0.2 + i * s * 0.32);
    ctx.stroke();
  }
  ctx.restore();
  tie();
  glowStroke(ctx, COLORS.greg, Math.max(1.5, s * 0.06), Math.max(3, s * 0.15));
  // knot
  ctx.beginPath();
  ctx.moveTo(-w * 0.32, -s * 0.66);
  ctx.lineTo(w * 0.32, -s * 0.66);
  glowStroke(ctx, COLORS.greg, Math.max(1, s * 0.05), 2);
  ctx.restore();
}

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------
export class BootScene extends MenuScene {
  constructor(app) {
    super(app);
  }
  update(dt, events) {
    super.update(dt, events);
    if (events.some((e) => e.type === 'tap' || e.type === 'key') || this.t > 3.6) this.app.replace(new TitleScene(this.app));
  }
  draw(ctx) {
    const { W, H } = this;
    ctx.fillStyle = '#f2f4f8';
    ctx.fillRect(0, 0, W, H);
    const k = this.t;
    if (k < 2.4) {
      // sterile corporate splash
      const a = clamp(k * 2, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(W / 2, H * 0.42, 40, 0, TAU);
      ctx.strokeStyle = '#3a6df0';
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(W / 2 - 50, H * 0.42 + 10);
      ctx.quadraticCurveTo(W / 2, H * 0.42 - 40, W / 2 + 50, H * 0.42 + 10);
      ctx.stroke();
      ctx.restore();
      text(ctx, 'HALCYON DYNAMICS', W / 2, H * 0.42 + 80, { size: 26, color: '#223', alpha: a, weight: 'bold' });
      text(ctx, 'Innovating Tomorrow\'s Yesterday™', W / 2, H * 0.42 + 110, { size: 14, color: '#667', alpha: a });
      if (k > 1.6) {
        // glitch creeping in
        for (let i = 0; i < 8; i++) {
          ctx.fillStyle = R() < 0.5 ? COLORS.enemy : COLORS.player;
          ctx.globalAlpha = (k - 1.6) * 0.8;
          ctx.fillRect(0, R() * H, W, R() * 10);
        }
        ctx.globalAlpha = 1;
        if (!this.glitched) {
          this.glitched = true;
          audio.sfx('glitch');
        }
      }
    } else {
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, W, H);
      glitchText(ctx, 'SIGNAL LOST', W / 2, H * 0.45, 48, 2, this.t);
      text(ctx, 'tap to continue', W / 2, H * 0.6, { size: 14, color: COLORS.dim, alpha: Math.floor(this.t * 2) % 2 ? 1 : 0.4 });
    }
  }
}

// ---------------------------------------------------------------------
// Title
// ---------------------------------------------------------------------
export class TitleScene extends MenuScene {
  constructor(app) {
    super(app);
    audio.playMusic('title');
    this.build();
    this.drift = [];
    const shapes = Object.keys(HOSTS);
    for (let i = 0; i < 9; i++) this.drift.push({ type: R.pick(shapes), x: R() * 540, y: R() * 960, vx: R.range(-12, 12), vy: R.range(-20, -6), face: R() * TAU });
  }
  build() {
    const app = this.app;
    const W = this.W;
    const bw = 300;
    const x = (W - bw) / 2;
    let y = this.H * 0.42;
    const saved = loadRun();
    this.buttons = [];
    const add = (label, fn, opts = {}) => {
      this.buttons.push(new Btn(x, y, bw, 52, label, fn, opts));
      y += 62;
    };
    if (saved) add('CONTINUE', () => app.continueRun(saved), { primary: true, sub: null, color: COLORS.ally });
    add('NEW RUN', () => {
      if (saved) app.push(new ConfirmScene(app, 'Start a new run?', 'Your saved run will be deleted. Like your predecessors.', () => {
        clearRun();
        app.replace(new SetupScene(app));
      }));
      else app.push(new SetupScene(app));
    }, { primary: !saved });
    add('DAILY BREACH', () => app.push(new DailyScene(app)), { color: COLORS.gold });
    add('UPGRADE LAB', () => app.push(new LabScene(app)), { color: COLORS.purple });
    const half = (bw - 10) / 2;
    this.buttons.push(new Btn(x, y, half, 46, 'CODEX', () => app.push(new CodexScene(app)), { size: 15 }));
    this.buttons.push(new Btn(x + half + 10, y, half, 46, 'SETTINGS', () => app.push(new SettingsScene(app)), { size: 15 }));
    y += 56;
    this.buttons.push(new Btn(x, y, bw, 40, 'CREDITS', () => app.push(new CreditsScene(app)), { size: 14, color: COLORS.dim }));
  }
  resume() {
    audio.playMusic('title');
    this.build();
  }
  update(dt, events) {
    super.update(dt, events);
    for (const d of this.drift) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.face += dt * 0.3;
      if (d.y < -40) {
        d.y = this.H + 40;
        d.x = R() * this.W;
      }
    }
  }
  draw(ctx) {
    const { W, H } = this;
    drawBackdrop(ctx, W, H, this.t);
    ctx.save();
    ctx.globalAlpha = 0.15;
    for (const d of this.drift) drawShape(ctx, HOSTS[d.type].shape, d.x, d.y, HOSTS[d.type].r, COLORS.enemy, d.face, this.t);
    ctx.restore();
    const intensity = Math.floor(this.t * 1.3) % 7 === 0 ? 2.5 : 0.6;
    glitchText(ctx, 'SIGNAL', W / 2, H * 0.17, 64, intensity, this.t);
    glitchText(ctx, 'LOST', W / 2, H * 0.17 + 64, 64, intensity, this.t + 1);
    text(ctx, '— H I J A C K —', W / 2, H * 0.17 + 118, { size: 18, color: COLORS.player, glow: true });
    const p = this.app.profile;
    text(ctx, `◆ ${p.fragments} FRAGMENTS`, W / 2, H * 0.17 + 150, { size: 13, color: COLORS.purple });
    this.drawButtons(ctx);
    text(ctx, 'v1.0 · no ads · no microtransactions · no mercy', W / 2, H - 22, { size: 11, color: COLORS.dim });
  }
}

// ---------------------------------------------------------------------
// Confirm dialog (overlay)
// ---------------------------------------------------------------------
export class ConfirmScene extends MenuScene {
  constructor(app, title, body, onYes, yes = 'YES', no = 'NO') {
    super(app);
    this.transparent = true;
    this.title = title;
    this.body = body;
    const W = this.W;
    const y = this.H / 2 + 30;
    this.buttons = [
      new Btn(W / 2 - 150, y, 140, 50, no, () => app.pop(), { color: COLORS.dim }),
      new Btn(W / 2 + 10, y, 140, 50, yes, () => {
        app.pop();
        onYes();
      }, { color: COLORS.trace, primary: true }),
    ];
  }
  onBack() {
    this.app.pop();
  }
  draw(ctx) {
    const { W, H } = this;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    panel(ctx, 30, H / 2 - 120, W - 60, 230, COLORS.trace);
    text(ctx, this.title, W / 2, H / 2 - 80, { size: 22, color: COLORS.white, weight: 'bold' });
    wrap(ctx, this.body, W - 110, 14).forEach((l, i) => text(ctx, l, W / 2, H / 2 - 40 + i * 18, { size: 14, color: COLORS.dim }));
    this.drawButtons(ctx);
  }
}

// ---------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------
export class SettingsScene extends MenuScene {
  constructor(app, fromPause = false) {
    super(app);
    this.fromPause = fromPause;
    this.build();
  }
  onBack() {
    this.app.saveProfile();
    this.app.pop();
  }
  build() {
    const app = this.app;
    const s = app.profile.settings;
    const W = this.W;
    this.buttons = [];
    let y = 130;
    const rowH = 58;
    const lx = 30;
    const bw = 210;
    const bx = W - 30 - bw;
    this.rows = [];
    const toggle = (label, key, onLabel = 'ON', offLabel = 'OFF') => {
      this.rows.push({ label, y });
      this.buttons.push(new Btn(bx, y, bw, 44, s[key] ? onLabel : offLabel, () => {
        s[key] = !s[key];
        this.save();
      }, { color: s[key] ? COLORS.ally : COLORS.dim, size: 16 }));
      y += rowH;
    };
    // controls segmented
    this.rows.push({ label: 'Controls', y });
    const half = (bw - 8) / 2;
    this.buttons.push(new Btn(bx, y, half, 44, 'TAP', () => {
      s.controls = 'tap';
      this.save();
    }, { color: s.controls === 'tap' ? COLORS.player : COLORS.dim, size: 16, primary: s.controls === 'tap' }));
    this.buttons.push(new Btn(bx + half + 8, y, half, 44, 'DRAG', () => {
      s.controls = 'drag';
      this.save();
    }, { color: s.controls === 'drag' ? COLORS.player : COLORS.dim, size: 16, primary: s.controls === 'drag' }));
    this.ctrlHelpY = y + 60;
    y += rowH + 22;
    toggle('Left-handed', 'leftHanded');
    toggle('Screen shake', 'shake');
    toggle('Haptics', 'haptics');
    toggle('Damage numbers', 'damageNumbers');
    const vol = (label, key) => {
      this.rows.push({ label, y, vol: key });
      this.buttons.push(new Btn(bx, y, 50, 44, '-', () => {
        s[key] = Math.max(0, Math.round((s[key] - 0.1) * 10) / 10);
        this.save();
      }, { size: 22 }));
      this.buttons.push(new Btn(bx + bw - 50, y, 50, 44, '+', () => {
        s[key] = Math.min(1, Math.round((s[key] + 0.1) * 10) / 10);
        this.save();
        if (key === 'sfx') audio.sfx('select');
      }, { size: 22 }));
      y += rowH;
    };
    vol('SFX volume', 'sfx');
    vol('Music volume', 'music');
    toggle('Skip intro', 'skipIntro');
    y += 6;
    const fw = (W - 70) / 2;
    if (!this.fromPause) {
      this.buttons.push(new Btn(lx, y, fw, 44, 'REPLAY INTRO', () => app.push(new CutsceneScene(app, INTRO, () => app.pop())), { size: 14, color: COLORS.purple }));
      this.buttons.push(new Btn(lx + fw + 10, y, fw, 44, 'RESET SAVE', () => app.push(new ConfirmScene(app, 'Reset ALL progress?', 'Fragments, unlocks, codex, stats. All of it. Gone. Like tears in the rain. Or a cache flush.', () => {
        app.profile = resetProfile();
        app.saveProfile();
        this.build();
      }, 'DELETE')), { size: 14, color: COLORS.trace }));
      y += 56;
    }
    this.buttons.push(new Btn(lx, Math.min(y + 4, this.H - 70), W - 60, 50, 'BACK', () => this.onBack(), { primary: true }));
  }
  save() {
    const s = this.app.profile.settings;
    audio.setVolumes(s.sfx, s.music);
    this.app.saveProfile();
    this.build();
  }
  draw(ctx) {
    const { W, H } = this;
    drawBackdrop(ctx, W, H, this.t);
    ctx.save();
    ctx.fillStyle = 'rgba(5,6,12,0.75)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    header(ctx, W, 'SETTINGS', 'tweak reality');
    const s = this.app.profile.settings;
    for (const r of this.rows) {
      text(ctx, r.label, 30, r.y + 22, { size: 16, color: COLORS.white, align: 'left' });
      if (r.vol) text(ctx, `${Math.round(s[r.vol] * 10)}`, W - 30 - 105, r.y + 23, { size: 20, color: COLORS.player, weight: 'bold' });
    }
    const help = s.controls === 'tap' ? 'Tap floor: move there · Tap enemy: hijack · Tap your host: special' : 'Drag: joystick · Tap/flick at enemy: hijack · Button: special';
    text(ctx, help, W / 2, this.ctrlHelpY, { size: 11, color: COLORS.dim });
    this.drawButtons(ctx);
  }
}

// ---------------------------------------------------------------------
// Credits
// ---------------------------------------------------------------------
export class CreditsScene extends MenuScene {
  constructor(app, onDone = null) {
    super(app);
    this.onDone = onDone;
  }
  onTap() {
    if (this.t > 0.5) this.finish();
  }
  onBack() {
    this.finish();
  }
  finish() {
    if (this.done) return;
    this.done = true;
    if (this.onDone) this.onDone();
    else this.app.pop();
  }
  draw(ctx) {
    const { W, H } = this;
    drawBackdrop(ctx, W, H, this.t);
    const scroll = this.t * 40;
    CREDITS.forEach((l, i) => {
      const y = H - scroll + i * 34;
      if (y < -30 || y > H + 30) return;
      const big = i === 0;
      text(ctx, l, W / 2, y, { size: big ? 28 : 17, color: big ? COLORS.player : i % 6 === 2 ? COLORS.gold : COLORS.white, weight: big ? 'bold' : '', glow: big });
    });
    if (H - scroll + CREDITS.length * 34 < 0) {
      drawBuddy(ctx, W / 2, H / 2 - 30, 40, this.t);
      text(ctx, 'BUDDY: "Thanks for playing!!"', W / 2, H / 2 + 60, { size: 16, color: COLORS.ally });
    }
    text(ctx, 'tap to close', W / 2, H - 20, { size: 12, color: COLORS.dim });
  }
}

// ---------------------------------------------------------------------
// Codex
// ---------------------------------------------------------------------
export class CodexScene extends MenuScene {
  constructor(app) {
    super(app);
    this.sel = null;
    this.ids = Object.keys(HOSTS);
    this.buttons = [new Btn(30, this.H - 70, this.W - 60, 50, 'BACK', () => this.onBack())];
  }
  onBack() {
    if (this.sel) this.sel = null;
    else this.app.pop();
  }
  cells() {
    const cols = 4;
    const size = (this.W - 40) / cols;
    return this.ids.map((id, i) => ({ id, x: 20 + (i % cols) * size, y: 120 + Math.floor(i / cols) * (size + 6), s: size }));
  }
  onTap(e) {
    if (this.sel) {
      if (!(e.y > this.H - 70)) this.sel = null;
      return;
    }
    for (const c of this.cells()) {
      if (e.x > c.x && e.x < c.x + c.s && e.y > c.y && e.y < c.y + c.s) {
        if (this.app.profile.seenHosts[c.id] || this.app.profile.codex[c.id]) {
          this.sel = c.id;
          audio.sfx('select');
        } else audio.sfx('deny');
      }
    }
  }
  draw(ctx) {
    const { W, H } = this;
    drawBackdrop(ctx, W, H, this.t);
    ctx.save();
    ctx.fillStyle = 'rgba(5,6,12,0.75)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    const p = this.app.profile;
    const owned = this.ids.filter((id) => p.codex[id]).length;
    header(ctx, W, 'CODEX', `hosts hijacked: ${owned}/${this.ids.length} · 25 hijacks = MASTERED (+20% Integrity)`);
    for (const c of this.cells()) {
      const seen = p.seenHosts[c.id] || p.codex[c.id];
      const n = p.codex[c.id] || 0;
      const mastered = n >= 25;
      ctx.save();
      roundRect(ctx, c.x + 4, c.y + 4, c.s - 8, c.s - 8, 8);
      ctx.fillStyle = 'rgba(10,18,34,0.9)';
      ctx.fill();
      glowStroke(ctx, mastered ? COLORS.gold : n ? COLORS.player : '#24324a', 1.5, 3);
      ctx.restore();
      if (seen) {
        drawShape(ctx, HOSTS[c.id].shape, c.x + c.s / 2, c.y + c.s / 2 - 8, Math.min(18, HOSTS[c.id].r), n ? COLORS.player : COLORS.enemy, -Math.PI / 2, this.t);
        text(ctx, HOSTS[c.id].name.length > 11 ? HOSTS[c.id].name.split(' ')[0] : HOSTS[c.id].name, c.x + c.s / 2, c.y + c.s - 26, { size: 11, color: COLORS.white });
        text(ctx, mastered ? 'MASTERED' : `x${n}`, c.x + c.s / 2, c.y + c.s - 13, { size: 10, color: mastered ? COLORS.gold : COLORS.dim });
      } else text(ctx, '???', c.x + c.s / 2, c.y + c.s / 2, { size: 18, color: COLORS.dim });
    }
    if (this.sel) {
      const h = HOSTS[this.sel];
      const n = p.codex[this.sel] || 0;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      const px = 24;
      const py = H * 0.16;
      const pw = W - 48;
      const ph = H * 0.62;
      panel(ctx, px, py, pw, ph);
      drawShape(ctx, h.shape, W / 2, py + 70, 30, COLORS.player, -Math.PI / 2, this.t);
      text(ctx, h.name.toUpperCase(), W / 2, py + 130, { size: 24, color: COLORS.player, weight: 'bold' });
      text(ctx, h.bossOnly ? 'BOSS ARENA ONLY' : `LAYER ${h.layer} · ${LAYERS[h.layer].name}`, W / 2, py + 156, { size: 12, color: COLORS.dim });
      const at = h.attack;
      const stats = [`HP ${h.hp}`, `SPEED ${h.speed || 'TURRET'}`, `${at.type === 'melee' ? 'MELEE' : 'SHOT'} ${at.dmg} x ${at.rate}/s`];
      text(ctx, stats.join('  ·  '), W / 2, py + 186, { size: 13, color: COLORS.white });
      text(ctx, `SPECIAL: ${h.special.name}`, W / 2, py + 218, { size: 15, color: COLORS.gold, weight: 'bold' });
      wrap(ctx, h.special.desc, pw - 40, 13).forEach((l, i) => text(ctx, l, W / 2, py + 240 + i * 16, { size: 13, color: COLORS.white }));
      wrap(ctx, h.codex, pw - 40, 14).forEach((l, i) => text(ctx, l, W / 2, py + 290 + i * 19, { size: 14, color: COLORS.dim }));
      text(ctx, `"${h.quips[0]}"`, W / 2, py + ph - 60, { size: 14, color: '#ff9ab8' });
      text(ctx, n >= 25 ? 'MASTERED · +20% Integrity' : `Hijacked ${n}/25 for mastery`, W / 2, py + ph - 30, { size: 13, color: n >= 25 ? COLORS.gold : COLORS.player });
    }
    this.drawButtons(ctx);
  }
}

// ---------------------------------------------------------------------
// Upgrade Lab
// ---------------------------------------------------------------------
export class LabScene extends MenuScene {
  constructor(app) {
    super(app);
    this.build();
  }
  onBack() {
    this.app.pop();
  }
  build() {
    const app = this.app;
    const p = app.profile;
    const W = this.W;
    this.buttons = [];
    let y = 150;
    this.sections = [{ label: 'VARIANTS', y: y - 18 }];
    for (const [id, v] of Object.entries(VARIANTS)) {
      if (id === 'null') continue;
      const owned = p.unlocks.variants.includes(id);
      this.buttons.push(new Btn(24, y, W - 48, 64, owned ? `${v.name} · OWNED` : `${v.name} · ◆${v.cost}`, () => {
        if (owned) return;
        if (p.fragments < v.cost) return audio.sfx('deny');
        p.fragments -= v.cost;
        p.unlocks.variants.push(id);
        audio.sfx('buy');
        app.saveProfile();
        this.build();
      }, { sub: v.desc, color: owned ? COLORS.ally : p.fragments >= v.cost ? v.color : COLORS.dim, size: 16 }));
      y += 72;
    }
    y += 26;
    this.sections.push({ label: 'PERMANENT PERKS', y: y - 18 });
    for (const [id, pk] of Object.entries(PERKS)) {
      const owned = !!p.unlocks.perks[id];
      const locked = pk.requires && !p.unlocks.perks[pk.requires];
      this.buttons.push(new Btn(24, y, W - 48, 58, owned ? `${pk.name} · OWNED` : locked ? `${pk.name} · LOCKED` : `${pk.name} · ◆${pk.cost}`, () => {
        if (owned || locked) return;
        if (p.fragments < pk.cost) return audio.sfx('deny');
        p.fragments -= pk.cost;
        p.unlocks.perks[id] = true;
        audio.sfx('buy');
        app.saveProfile();
        this.build();
      }, { sub: pk.desc, color: owned ? COLORS.ally : locked || p.fragments < pk.cost ? COLORS.dim : COLORS.purple, size: 15 }));
      y += 64;
    }
    this.statsY = y + 10;
    this.buttons.push(new Btn(30, this.H - 66, W - 60, 50, 'BACK', () => this.onBack(), { primary: true }));
  }
  draw(ctx) {
    const { W, H } = this;
    drawBackdrop(ctx, W, H, this.t, '#1a0d30');
    ctx.save();
    ctx.fillStyle = 'rgba(5,6,12,0.78)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    const p = this.app.profile;
    header(ctx, W, 'UPGRADE LAB', `◆ ${p.fragments} Fragments · earned at the end of every run`, COLORS.purple);
    for (const s of this.sections) text(ctx, s.label, 26, s.y, { size: 13, color: COLORS.dim, align: 'left', weight: 'bold' });
    this.drawButtons(ctx);
    const st = p.stats;
    const y = Math.min(this.statsY, H - 110);
    text(ctx, `Runs ${st.runs} · Wins ${st.wins} · Deaths ${st.deaths} · Hijacks ${st.hijacks}`, W / 2, y + 8, { size: 12, color: COLORS.dim });
    if (st.bestTime) text(ctx, `Best win time ${fmtTime(st.bestTime)} · Clearance unlocked: ${p.clearanceUnlocked}`, W / 2, y + 26, { size: 12, color: COLORS.dim });
  }
}

function fmtTime(s) {
  s = Math.floor(s);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------
// Run Setup
// ---------------------------------------------------------------------
export class SetupScene extends MenuScene {
  constructor(app) {
    super(app);
    this.variant = app.profile.lastVariant && app.profile.unlocks.variants.includes(app.profile.lastVariant) ? app.profile.lastVariant : 'null';
    this.clearance = Math.min(app.profile.lastClearance || 0, app.profile.clearanceUnlocked);
    this.build();
  }
  onBack() {
    this.app.pop();
  }
  build() {
    const app = this.app;
    const p = app.profile;
    const W = this.W;
    this.buttons = [];
    let y = 140;
    for (const [id, v] of Object.entries(VARIANTS)) {
      const owned = p.unlocks.variants.includes(id);
      const sel = this.variant === id;
      this.buttons.push(new Btn(24, y, W - 48, 70, owned ? (sel ? `▶ ${v.name} ◀` : v.name) : `${v.name} · LOCKED`, () => {
        if (!owned) return audio.sfx('deny');
        this.variant = id;
        this.build();
      }, { sub: owned ? v.desc : `Unlock in the Upgrade Lab (◆${v.cost})`, color: owned ? (sel ? v.color : COLORS.dim) : '#33405a', primary: sel, size: 18 }));
      y += 80;
    }
    if (p.clearanceUnlocked > 0) {
      this.clY = y + 20;
      this.buttons.push(new Btn(24, y + 34, 60, 46, '-', () => {
        this.clearance = Math.max(0, this.clearance - 1);
        this.build();
      }, { size: 22 }));
      this.buttons.push(new Btn(W - 84, y + 34, 60, 46, '+', () => {
        this.clearance = Math.min(p.clearanceUnlocked, this.clearance + 1);
        this.build();
      }, { size: 22 }));
      y += 100;
    }
    this.buttons.push(new Btn(24, this.H - 136, W - 48, 58, 'BREACH', () => {
      p.lastVariant = this.variant;
      p.lastClearance = this.clearance;
      app.saveProfile();
      const run = newRun(p, { variant: this.variant, clearance: this.clearance });
      app.beginRun(run);
    }, { primary: true, color: COLORS.player, size: 22 }));
    this.buttons.push(new Btn(24, this.H - 68, W - 48, 48, 'BACK', () => this.onBack(), { color: COLORS.dim }));
  }
  draw(ctx) {
    const { W, H } = this;
    drawBackdrop(ctx, W, H, this.t);
    ctx.save();
    ctx.fillStyle = 'rgba(5,6,12,0.7)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    header(ctx, W, 'CHOOSE YOUR NULL', 'every version of you is equally doomed');
    this.drawButtons(ctx);
    if (this.clY) {
      text(ctx, 'SECURITY CLEARANCE', W / 2, this.clY, { size: 13, color: COLORS.dim });
      text(ctx, `${this.clearance}`, W / 2, this.clY + 38, { size: 30, color: this.clearance ? COLORS.trace : COLORS.white, weight: 'bold' });
      if (this.clearance) text(ctx, `+${this.clearance * 8}% enemy HP · +${this.clearance * 4}% dmg · +${this.clearance * 2}% Trace`, W / 2, this.clY + 70, { size: 11, color: COLORS.trace });
    }
  }
}

// ---------------------------------------------------------------------
// Daily Breach
// ---------------------------------------------------------------------
export class DailyScene extends MenuScene {
  constructor(app) {
    super(app);
    const W = this.W;
    const key = todayKey();
    this.key = key;
    this.preview = newRun(app.profile, { daily: true });
    this.buttons = [
      new Btn(24, this.H - 136, W - 48, 58, 'START DAILY', () => {
        const saved = loadRun();
        const go = () => app.beginRun(newRun(app.profile, { daily: true }));
        if (saved) app.push(new ConfirmScene(app, 'Start the Daily?', 'Your saved run will be deleted.', () => {
          clearRun();
          go();
        }));
        else go();
      }, { primary: true, color: COLORS.gold, size: 20 }),
      new Btn(24, this.H - 68, W - 48, 48, 'BACK', () => app.pop(), { color: COLORS.dim }),
    ];
  }
  onBack() {
    this.app.pop();
  }
  draw(ctx) {
    const { W, H } = this;
    drawBackdrop(ctx, W, H, this.t, '#2a2008');
    ctx.save();
    ctx.fillStyle = 'rgba(5,6,12,0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    header(ctx, W, 'DAILY BREACH', this.key, COLORS.gold);
    const g = GLITCHES[this.preview.glitches[0]];
    panel(ctx, 24, 140, W - 48, 260, COLORS.gold);
    text(ctx, 'Same seed for everyone today.', W / 2, 172, { size: 15, color: COLORS.white });
    text(ctx, 'Variant: NULL · Clearance 0', W / 2, 196, { size: 13, color: COLORS.dim });
    text(ctx, "TODAY'S GLITCH", W / 2, 236, { size: 13, color: COLORS.dim });
    text(ctx, g.name, W / 2, 266, { size: 26, color: COLORS.purple, weight: 'bold', glow: true });
    text(ctx, `- ${g.bad}`, W / 2, 300, { size: 13, color: COLORS.trace });
    text(ctx, `+ ${g.good}`, W / 2, 322, { size: 13, color: COLORS.ally });
    const best = this.app.profile.daily[this.key];
    text(ctx, best ? `Your best today: ${best}` : 'No attempt yet today.', W / 2, 366, { size: 15, color: COLORS.gold });
    text(ctx, 'Score = rooms×100 + bosses×500 + Bits + 2000 on a win', W / 2, 430, { size: 11, color: COLORS.dim });
    this.drawButtons(ctx);
  }
}

// ---------------------------------------------------------------------
// Map
// ---------------------------------------------------------------------
const NODE_COLORS = { combat: COLORS.enemy, elite: COLORS.gold, vault: COLORS.gold, shop: COLORS.purple, cooldown: COLORS.player, event: COLORS.enemy2, boss: COLORS.trace };

function drawNodeIcon(ctx, type, x, y, r, col, t) {
  ctx.save();
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineWidth = 2.5;
  const s = r * 0.5;
  switch (type) {
    case 'combat':
      ctx.beginPath();
      ctx.moveTo(x - s, y - s);
      ctx.lineTo(x + s, y + s);
      ctx.moveTo(x + s, y - s);
      ctx.lineTo(x - s, y + s);
      ctx.stroke();
      break;
    case 'elite':
      poly(ctx, x, y, s * 1.3, 5, -Math.PI / 2, 0.45);
      ctx.fill();
      break;
    case 'vault':
      text(ctx, '$', x, y + 1, { size: r * 1.1, color: col, weight: 'bold' });
      break;
    case 'shop':
      poly(ctx, x, y, s * 1.2, 4, 0);
      ctx.stroke();
      text(ctx, 'B', x, y + 1, { size: r * 0.7, color: col, weight: 'bold' });
      break;
    case 'cooldown':
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3;
        ctx.moveTo(x + Math.cos(a) * s * 1.2, y + Math.sin(a) * s * 1.2);
        ctx.lineTo(x - Math.cos(a) * s * 1.2, y - Math.sin(a) * s * 1.2);
      }
      ctx.stroke();
      break;
    case 'event':
      text(ctx, '?', x, y + 1, { size: r * 1.1, color: col, weight: 'bold' });
      break;
    case 'boss':
      ctx.beginPath();
      ctx.arc(x, y - 2, s * 1.1, 0, TAU);
      ctx.stroke();
      ctx.fillRect(x - s * 0.6, y - s * 0.4, s * 0.4, s * 0.4);
      ctx.fillRect(x + s * 0.2, y - s * 0.4, s * 0.4, s * 0.4);
      ctx.fillRect(x - s * 0.5, y + s * 0.6, s, s * 0.3);
      break;
  }
  ctx.restore();
}

const NODE_DESC = {
  combat: 'Fight 2-3 waves. 50% chance of an exploit, otherwise some Bits.',
  elite: 'One tough Elite plus escorts. Guaranteed exploit.',
  vault: 'Crack a safe with a specific host in 35s. Big loot.',
  shop: 'Black Market: exploits, Core repair, Trace scrub.',
  cooldown: 'Idle Process: heal a pip, clear Trace, or mine Bits.',
  event: 'Corrupted Sector: a weird choice. Risky. Probably funny.',
};

export class MapScene extends MenuScene {
  constructor(app, run, intro = false) {
    super(app);
    this.run = run;
    this.introT = intro ? 2.4 : 0;
    this.showList = false;
    audio.playMusic('map');
    audio.setTrace(0);
    audio.siren = false;
    saveRun(run);
    this.sel = null;
    this.build();
  }
  build() {
    const app = this.app;
    const run = this.run;
    if (!run) return;
    this.buttons = [
      new Btn(this.W - 128, this.H - 64, 112, 46, 'MENU', () => app.push(new MapMenuScene(app, run)), { size: 15, color: COLORS.dim }),
      new Btn(16, this.H - 64, this.W - 160, 46, `LOADOUT (${Object.keys(run.exploits).length + run.glitches.length})`, () => {
        this.showList = !this.showList;
      }, { size: 15, color: COLORS.gold }),
    ];
    const nd = this.sel !== null ? findNode(run.map, this.sel) : null;
    if (nd && availableNodes(run).includes(nd.id)) {
      this.buttons.push(new Btn(this.W - 136, this.H - 142, 120, 58, 'ENTER ▸', () => this.go(nd), { primary: true, color: NODE_COLORS[nd.type], size: 17 }));
    }
  }
  go(nd) {
    audio.sfx('select');
    this.app.enterNode(this.run, nd);
  }
  reachable(fromId) {
    const set = new Set([fromId]);
    const stack = [fromId];
    while (stack.length) {
      const nd = findNode(this.run.map, stack.pop());
      for (const id of nd.next) if (!set.has(id)) {
        set.add(id);
        stack.push(id);
      }
    }
    return set;
  }
  resume() {
    audio.playMusic('map');
    saveRun(this.run);
  }
  nodePos(nd) {
    const top = 140;
    const bottom = this.H - 208;
    const rows = this.run.map.rows.length;
    const gap = (bottom - top) / (rows - 1);
    const x = this.run.map.grid ? 48 + ((this.W - 96) * nd.gx) / 6 + nd.jx : (this.W * (nd.col + 1)) / (nd.n + 1) + nd.jx;
    const y = bottom - nd.row * gap + nd.jy;
    return { x, y };
  }
  onTap(e) {
    if (this.introT > 0) {
      this.introT = 0;
      return;
    }
    if (this.showList) {
      if (e.y < this.H - 70) this.showList = false;
      return;
    }
    if (this.buttons.some((b) => b.hit(e.x, e.y))) return;
    const avail = availableNodes(this.run);
    // nearest node within reach of the finger (avail nodes win ties)
    let best = null;
    let bd = 32 * 32;
    for (const nd of this.run.map.rows.flat()) {
      const p = this.nodePos(nd);
      const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2 - (avail.includes(nd.id) ? 200 : 0);
      if (d < bd) {
        bd = d;
        best = nd;
      }
    }
    if (!best) {
      this.sel = null;
      this.build();
      return;
    }
    if (this.sel === best.id && avail.includes(best.id)) return this.go(best);
    this.sel = best.id;
    audio.sfx('click');
    this.build();
  }
  update(dt, events) {
    if (this.introT > 0) this.introT -= dt;
    super.update(dt, events);
  }
  draw(ctx) {
    const { W, H } = this;
    const run = this.run;
    const L = LAYERS[run.layer];
    drawBackdrop(ctx, W, H, this.t, L.grid);
    ctx.save();
    ctx.fillStyle = 'rgba(5,6,12,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    // header
    text(ctx, `LAYER ${run.layer}: ${L.name}`, W / 2, 30, { size: 18, color: L.color, weight: 'bold', glow: true });
    text(ctx, L.sub, W / 2, 52, { size: 12, color: COLORS.dim });
    // stats row
    for (let i = 0; i < run.maxPips; i++) {
      poly(ctx, 26 + i * 22, 84, 8, 4, Math.PI / 4);
      if (i < run.pips) {
        ctx.fillStyle = COLORS.player;
        ctx.fill();
      }
      glowStroke(ctx, i < run.pips ? COLORS.player : COLORS.dim, 1.5, 3);
    }
    text(ctx, `◆ ${run.bits}`, W / 2 - 20, 85, { size: 17, color: COLORS.gold, weight: 'bold' });
    const k = run.trace / run.traceMax;
    ctx.fillStyle = '#1a0a10';
    roundRect(ctx, W - 170, 77, 150, 14, 4);
    ctx.fill();
    ctx.fillStyle = k > 0.75 ? COLORS.trace : '#c45a7a';
    roundRect(ctx, W - 170, 77, Math.max(5, 150 * k), 14, 4);
    ctx.fill();
    text(ctx, `TRACE ${Math.floor(run.trace)}`, W - 95, 85, { size: 10, color: COLORS.white, weight: 'bold' });
    if (run.daily) text(ctx, 'DAILY BREACH', W / 2, 108, { size: 11, color: COLORS.gold });
    else if (run.clearance) text(ctx, `CLEARANCE ${run.clearance}`, W / 2, 108, { size: 11, color: COLORS.trace });
    // edges
    const avail = new Set(availableNodes(run));
    const visited = new Set(run.visited);
    const route = this.sel !== null ? this.reachable(this.sel) : null;
    ctx.save();
    for (const row of run.map.rows) {
      for (const nd of row) {
        const a = this.nodePos(nd);
        for (const nid of nd.next) {
          const b = this.nodePos(findNode(run.map, nid));
          const walked = visited.has(nd.id) && visited.has(nid);
          const next = nd.id === run.pos && avail.has(nid);
          const planned = route && route.has(nd.id) && route.has(nid);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.setLineDash(walked || next || planned ? [] : [4, 6]);
          ctx.strokeStyle = planned ? COLORS.white : walked || next ? L.color : '#2a3a5a';
          ctx.globalAlpha = planned ? 0.75 : walked || next ? 0.9 : 0.55;
          ctx.lineWidth = planned || walked || next ? 2.5 : 1.5;
          ctx.stroke();
        }
      }
    }
    ctx.restore();
    // nodes
    for (const row of run.map.rows) {
      for (const nd of row) {
        const p = this.nodePos(nd);
        const isAvail = avail.has(nd.id);
        const isVisited = visited.has(nd.id);
        const isCur = nd.id === run.pos;
        const col = NODE_COLORS[nd.type];
        const r = nd.type === 'boss' ? 30 : 18;
        const inRoute = route && route.has(nd.id);
        ctx.save();
        if (!isAvail && !isVisited) ctx.globalAlpha = inRoute ? 0.9 : 0.45;
        if (isVisited && !isCur) ctx.globalAlpha = 0.35;
        if (nd.id === this.sel) {
          glowCircle(ctx, p.x, p.y, r + 9, COLORS.white, 2, 0);
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + (isAvail ? Math.sin(this.t * 5) * 3 : 0), 0, TAU);
        ctx.fillStyle = '#080c18';
        ctx.fill();
        glowStroke(ctx, isAvail ? col : isCur ? COLORS.white : '#3a4a6a', isAvail ? 2.5 : 1.5, isAvail ? 8 : 2);
        drawNodeIcon(ctx, nd.type, p.x, p.y, r, isAvail || isCur || inRoute ? col : COLORS.dim, this.t);
        ctx.restore();
        if (isAvail || nd.type === 'boss') text(ctx, nd.type === 'boss' ? BOSSES[L.boss].name : roomLabel(nd.type), p.x, p.y + r + 12, { size: nd.type === 'boss' ? 12 : 10, color: col, weight: 'bold' });
        if (isCur) drawNull(ctx, p.x, p.y - r - 16, 7, this.t);
      }
    }
    this.drawInfo(ctx);
    this.drawButtons(ctx);
    if (this.showList) this.drawLoadout(ctx);
    if (this.introT > 0) {
      const a = Math.min(1, this.introT * 2, (2.4 - this.introT) * 3);
      ctx.save();
      ctx.globalAlpha = a * 0.9;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      text(ctx, `LAYER ${run.layer}`, W / 2, H * 0.4, { size: 20, color: COLORS.dim, alpha: a });
      glitchText(ctx, L.name, W / 2, H * 0.4 + 44, 34, 1, this.t);
      text(ctx, L.sub, W / 2, H * 0.4 + 86, { size: 15, color: L.color, alpha: a });
    }
  }
  drawInfo(ctx) {
    const { W, H } = this;
    const run = this.run;
    const y = H - 150;
    const nd = this.sel !== null ? findNode(run.map, this.sel) : null;
    const canGo = nd && availableNodes(run).includes(nd.id);
    const w = canGo ? W - 168 : W - 32;
    panel(ctx, 16, y - 8, w, 74, nd ? NODE_COLORS[nd.type] : '#24324a');
    if (!nd) {
      text(ctx, 'PLAN YOUR ROUTE', 30, y + 14, { size: 14, color: COLORS.white, align: 'left', weight: 'bold' });
      text(ctx, 'Tap any node to see where it leads.', 30, y + 34, { size: 12, color: COLORS.dim, align: 'left' });
      text(ctx, 'Tap a glowing node twice to enter it.', 30, y + 51, { size: 12, color: COLORS.dim, align: 'left' });
      return;
    }
    const L = LAYERS[run.layer];
    const title = nd.type === 'boss' ? BOSSES[L.boss].name : roomLabel(nd.type);
    text(ctx, title + (canGo ? '' : `  · floor ${nd.row + 1}`), 30, y + 14, { size: 15, color: NODE_COLORS[nd.type], align: 'left', weight: 'bold' });
    const desc = nd.type === 'boss' ? BOSSES[L.boss].title : NODE_DESC[nd.type];
    wrap(ctx, desc, w - 30, 12).slice(0, 2).forEach((l, i) => text(ctx, l, 30, y + 35 + i * 16, { size: 12, color: COLORS.white, align: 'left', alpha: 0.85 }));
  }
  drawLoadout(ctx) {
    const { W, H } = this;
    const run = this.run;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    panel(ctx, 20, 120, W - 40, H - 210, COLORS.gold);
    text(ctx, 'LOADOUT', W / 2, 148, { size: 20, color: COLORS.gold, weight: 'bold' });
    let y = 182;
    const v = VARIANTS[run.variant];
    text(ctx, `${v.name}: ${v.desc}`, 36, y, { size: 12, color: v.color, align: 'left' });
    y += 28;
    const ex = Object.entries(run.exploits);
    if (!ex.length) {
      text(ctx, 'No exploits yet. You are running on vibes.', W / 2, y, { size: 13, color: COLORS.dim });
      y += 24;
    }
    for (const [id, n] of ex) {
      const e = EXPLOITS[id];
      text(ctx, `${e.name}${n > 1 ? ' x' + n : ''}`, 36, y, { size: 15, color: COLORS.white, align: 'left', weight: 'bold' });
      y += 18;
      text(ctx, e.desc, 36, y, { size: 12, color: COLORS.dim, align: 'left' });
      y += 24;
      if (y > H - 150) break;
    }
    for (const g of run.glitches) {
      const gl = GLITCHES[g];
      text(ctx, `[${gl.name}]`, 36, y, { size: 15, color: COLORS.purple, align: 'left', weight: 'bold' });
      y += 18;
      text(ctx, `- ${gl.bad}  + ${gl.good}`, 36, y, { size: 11, color: COLORS.dim, align: 'left' });
      y += 24;
    }
    text(ctx, 'tap to close', W / 2, H - 104, { size: 12, color: COLORS.dim });
  }
}

class MapMenuScene extends MenuScene {
  constructor(app, run) {
    super(app);
    this.transparent = true;
    const W = this.W;
    const x = 60;
    const w = W - 120;
    let y = this.H * 0.34;
    this.buttons = [
      new Btn(x, y, w, 52, 'RESUME', () => app.pop(), { primary: true }),
      new Btn(x, (y += 64), w, 52, 'SETTINGS', () => app.push(new SettingsScene(app, true))),
      new Btn(x, (y += 64), w, 52, 'SAVE & QUIT', () => {
        saveRun(run);
        app.toTitle();
      }, { color: COLORS.ally }),
      new Btn(x, (y += 64), w, 52, 'ABANDON RUN', () => app.push(new ConfirmScene(app, 'Abandon this run?', 'You still get Fragments for what you did. BUDDY will be sad though.', () => app.endRun(run, false, true))), { color: COLORS.trace }),
    ];
  }
  onBack() {
    this.app.pop();
  }
  draw(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.restore();
    text(ctx, 'PAUSED', this.W / 2, this.H * 0.26, { size: 32, color: COLORS.white, weight: 'bold', glow: true });
    this.drawButtons(ctx);
  }
}

// ---------------------------------------------------------------------
// Pause (in room)
// ---------------------------------------------------------------------
export class PauseScene extends MenuScene {
  constructor(app, game) {
    super(app);
    this.transparent = true;
    this.game = game;
    audio.setMuffled(true);
    const W = this.W;
    const x = 60;
    const w = W - 120;
    let y = this.H * 0.36;
    this.buttons = [
      new Btn(x, y, w, 54, 'RESUME', () => this.resumeGame(), { primary: true }),
      new Btn(x, (y += 66), w, 54, 'SETTINGS', () => app.push(new SettingsScene(app, true))),
      new Btn(x, (y += 66), w, 54, 'ABANDON RUN', () => app.push(new ConfirmScene(app, 'Abandon this run?', 'The room will not be saved. You keep the Fragments earned so far.', () => {
        audio.setMuffled(false);
        app.endRun(game.run, false, true);
      })), { color: COLORS.trace }),
    ];
  }
  resumeGame() {
    audio.setMuffled(false);
    this.app.pop();
  }
  onBack() {
    this.resumeGame();
  }
  draw(ctx) {
    const { W, H } = this;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    text(ctx, 'PAUSED', W / 2, H * 0.22, { size: 34, color: COLORS.white, weight: 'bold', glow: true });
    text(ctx, 'Time is frozen. GREG is still out there.', W / 2, H * 0.22 + 36, { size: 13, color: COLORS.dim });
    const run = this.game.run;
    const ex = Object.entries(run.exploits).map(([id, n]) => EXPLOITS[id].name + (n > 1 ? ` x${n}` : ''));
    const lines = wrap(ctx, ex.length ? 'Exploits: ' + ex.join(', ') : 'Exploits: none', W - 80, 12);
    lines.slice(0, 4).forEach((l, i) => text(ctx, l, W / 2, H * 0.29 + i * 16, { size: 12, color: COLORS.gold }));
    this.drawButtons(ctx);
  }
}

// ---------------------------------------------------------------------
// Reward: pick 1 of N exploits
// ---------------------------------------------------------------------
export class RewardScene extends MenuScene {
  constructor(app, run, { title = 'CHOOSE AN EXPLOIT', sub = 'Pick one. Choices are an illusion, but this one is real.', n = 3, skipBits = 15, onDone }) {
    super(app);
    this.run = run;
    this.title = title;
    this.sub = sub;
    this.n = n;
    this.skipBits = skipBits;
    this.onDone = onDone;
    this.rerolls = app.profile.unlocks.perks.reroll ? 1 : 0;
    this.offers = offerExploits(run, n);
    audio.sfx('reward');
    this.build();
  }
  build() {
    const W = this.W;
    const app = this.app;
    this.buttons = [];
    const ch = this.n > 3 ? 92 : 108;
    let y = 160;
    for (const id of this.offers) {
      const e = EXPLOITS[id];
      const cnt = has(this.run, id);
      this.buttons.push(new Btn(24, y, W - 48, ch, `${e.name}${cnt ? ` (have ${cnt})` : ''}`, () => {
        addExploit(this.run, id);
        audio.sfx('buy');
        this.onDone();
      }, { sub: e.desc, color: COLORS.gold, size: 20 }));
      y += ch + 14;
    }
    if (!this.offers.length) this.emptyMsg = true;
    const bw = this.rerolls > 0 ? (W - 58) / 2 : W - 48;
    this.buttons.push(new Btn(24, this.H - 80, bw, 54, this.skipBits ? `SKIP (+${this.skipBits} ◆)` : 'SKIP', () => {
      this.run.bits += this.skipBits;
      this.onDone();
    }, { color: COLORS.dim, size: 16 }));
    if (this.rerolls > 0) this.buttons.push(new Btn(34 + bw, this.H - 80, bw, 54, `REROLL (${this.rerolls})`, () => {
      this.rerolls--;
      this.offers = offerExploits(this.run, this.n);
      audio.sfx('glitch');
      this.build();
    }, { color: COLORS.purple, size: 16 }));
  }
  draw(ctx) {
    const { W, H } = this;
    drawBackdrop(ctx, W, H, this.t, '#2a2008');
    ctx.save();
    ctx.fillStyle = 'rgba(5,6,12,0.7)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    header(ctx, W, this.title, this.sub, COLORS.gold);
    if (this.emptyMsg) text(ctx, 'You have literally every exploit. Show-off.', W / 2, H / 2, { size: 14, color: COLORS.dim });
    this.drawButtons(ctx);
  }
}

// ---------------------------------------------------------------------
// Shop
// ---------------------------------------------------------------------
export class ShopScene extends MenuScene {
  constructor(app, run, onDone) {
    super(app);
    this.run = run;
    this.onDone = onDone;
    const rng = runRng(run);
    this.items = offerExploits(run, 3, rng).map((id) => ({ kind: 'exploit', id, cost: 45 + rng.int(0, 4) * 5, sold: false }));
    this.items.push({ kind: 'repair', cost: 40, sold: false });
    this.items.push({ kind: 'scrub', cost: 30, sold: false });
    this.quip = R.pick(['"Everything must go. Including you, probably."', '"No refunds. No receipts. No questions. Mostly no questions."', '"Fell off a server rack. Totally legit."', '"First time? Prices double for nervous customers."']);
    this.build();
  }
  build() {
    const W = this.W;
    const run = this.run;
    this.buttons = [];
    let y = 180;
    for (const it of this.items) {
      let label;
      let sub;
      if (it.kind === 'exploit') {
        label = `${EXPLOITS[it.id].name} · ◆${it.cost}`;
        sub = EXPLOITS[it.id].desc;
      } else if (it.kind === 'repair') {
        label = `Repair Core +1 · ◆${it.cost}`;
        sub = run.pips >= run.maxPips ? 'Already at full Core.' : 'Restore one Core pip.';
      } else {
        label = `Trace Scrub -40 · ◆${it.cost}`;
        sub = 'Wipe your logs. Plausible deniability.';
      }
      const blocked = it.sold || run.bits < it.cost || (it.kind === 'repair' && run.pips >= run.maxPips) || (it.kind === 'scrub' && run.trace <= 0);
      this.buttons.push(new Btn(24, y, W - 48, 76, it.sold ? 'SOLD' : label, () => {
        if (blocked) return audio.sfx('deny');
        run.bits -= it.cost;
        it.sold = true;
        if (it.kind === 'exploit') addExploit(run, it.id);
        else if (it.kind === 'repair') run.pips = Math.min(run.maxPips, run.pips + 1);
        else run.trace = Math.max(0, run.trace - 40);
        audio.sfx('buy');
        this.build();
      }, { sub: it.sold ? null : sub, color: blocked ? COLORS.dim : it.kind === 'exploit' ? COLORS.gold : COLORS.player, size: 17, disabled: it.sold }));
      y += 86;
    }
    this.buttons.push(new Btn(24, this.H - 76, W - 48, 54, 'LEAVE', () => this.onDone(), { primary: true }));
  }
  draw(ctx) {
    const { W, H } = this;
    drawBackdrop(ctx, W, H, this.t, '#1a0d30');
    ctx.save();
    ctx.fillStyle = 'rgba(5,6,12,0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    header(ctx, W, 'BLACK MARKET', this.quip, COLORS.purple, 60);
    text(ctx, `◆ ${this.run.bits} Bits · Core ${this.run.pips}/${this.run.maxPips} · Trace ${Math.floor(this.run.trace)}`, W / 2, 140, { size: 14, color: COLORS.gold });
    this.drawButtons(ctx);
  }
}

// ---------------------------------------------------------------------
// Cooldown
// ---------------------------------------------------------------------
export class CooldownScene extends MenuScene {
  constructor(app, run, onDone) {
    super(app);
    this.run = run;
    const W = this.W;
    const full = run.pips >= run.maxPips;
    let y = 260;
    this.buttons = [
      new Btn(24, y, W - 48, 86, 'DEFRAG', () => {
        run.pips = Math.min(run.maxPips, run.pips + 1);
        audio.sfx('reward');
        onDone();
      }, { sub: full ? 'Core is already full. You could just... sit here.' : 'Restore 1 Core pip.', color: full ? COLORS.dim : COLORS.player, size: 20, disabled: full }),
      new Btn(24, (y += 100), W - 48, 86, 'CLEAR LOGS', () => {
        run.trace = Math.max(0, run.trace - 50);
        audio.sfx('reward');
        onDone();
      }, { sub: '-50 Trace. Security forgets you exist. Relatable.', color: COLORS.trace, size: 20 }),
      new Btn(24, (y += 100), W - 48, 86, 'MINE CRYPTO', () => {
        run.bits += 35;
        audio.sfx('buy');
        onDone();
      }, { sub: '+35 Bits. Ethically dubious. Financially dubious too.', color: COLORS.gold, size: 20 }),
    ];
  }
  draw(ctx) {
    const { W, H } = this;
    drawBackdrop(ctx, W, H, this.t);
    ctx.save();
    ctx.fillStyle = 'rgba(5,6,12,0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    header(ctx, W, 'IDLE PROCESS', 'a quiet sector. the fans hum. you choose one thing.', COLORS.player);
    drawBuddy(ctx, W / 2, 180, 26, this.t);
    text(ctx, 'BUDDY: "Self-care! Even for murderbots!"', W / 2, 232, { size: 13, color: COLORS.ally });
    this.drawButtons(ctx);
  }
}

// ---------------------------------------------------------------------
// Event
// ---------------------------------------------------------------------
export class EventScene extends MenuScene {
  constructor(app, run, onDone) {
    super(app);
    this.run = run;
    this.onDone = onDone;
    const rng = runRng(run);
    const seen = run.seenEvents || (run.seenEvents = []);
    let pool = EVENTS.filter((e) => !seen.includes(e.id));
    if (!pool.length) pool = EVENTS;
    this.ev = rng.pick(pool);
    seen.push(this.ev.id);
    this.result = null;
    audio.sfx('glitch');
    this.build();
  }
  build() {
    const W = this.W;
    this.buttons = [];
    if (this.result) {
      this.buttons.push(new Btn(24, this.H - 80, W - 48, 54, 'CONTINUE', () => this.onDone(), { primary: true }));
      return;
    }
    let y = this.H - 80 - (this.ev.choices.length - 1) * 74;
    for (const ch of this.ev.choices) {
      const cant = ch.cost && this.run.bits < ch.cost;
      this.buttons.push(new Btn(24, y, W - 48, 62, ch.label, () => {
        if (cant) return audio.sfx('deny');
        if (ch.cost) this.run.bits -= ch.cost;
        const lines = applyEffects(this.run, ch.effects);
        this.result = { text: ch.result, lines };
        audio.sfx(lines.some((l) => l.startsWith('-') || l.includes('NOT')) ? 'hurt' : 'reward');
        this.build();
      }, { color: cant ? COLORS.dim : COLORS.enemy2, size: 15 }));
      y += 74;
    }
  }
  draw(ctx) {
    const { W, H } = this;
    drawBackdrop(ctx, W, H, this.t, '#200d28');
    ctx.save();
    ctx.fillStyle = 'rgba(5,6,12,0.72)';
    ctx.fillRect(0, 0, W, H);
    // static noise
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = R() < 0.5 ? '#ff5ad1' : '#2ef2ff';
      ctx.globalAlpha = 0.08;
      ctx.fillRect(R() * W, R() * H, R() * 60, 2);
    }
    ctx.restore();
    text(ctx, 'CORRUPTED SECTOR', W / 2, 46, { size: 13, color: COLORS.enemy2 });
    glitchText(ctx, this.ev.title, W / 2, 84, 26, 0.5, this.t);
    panel(ctx, 20, 120, W - 40, 300, COLORS.enemy2);
    const body = this.result ? this.result.text || '' : this.ev.text;
    wrap(ctx, body, W - 80, 16).forEach((l, i) => text(ctx, l, 40, 150 + i * 22, { size: 16, color: COLORS.white, align: 'left' }));
    if (this.result) {
      this.result.lines.forEach((l, i) => text(ctx, l, W / 2, 450 + i * 26, { size: 17, color: l.startsWith('-') || l.includes('NOT') ? COLORS.trace : l.startsWith('Glitch') ? COLORS.purple : COLORS.ally, weight: 'bold' }));
    }
    this.drawButtons(ctx);
  }
}

// ---------------------------------------------------------------------
// Death
// ---------------------------------------------------------------------
export class DeathScene extends MenuScene {
  constructor(app, run, info) {
    super(app);
    this.run = run;
    this.info = info;
    this.quip = R.pick(DEATH_QUIPS);
    audio.playMusic('death');
    const W = this.W;
    this.parts = new Particles();
    this.buttons = [
      new Btn(24, this.H - 146, W - 48, 58, run.daily ? 'MENU' : 'TRY AGAIN', () => {
        if (run.daily) app.toTitle();
        else app.replace(new SetupScene(app));
      }, { primary: true, color: COLORS.player, size: 20 }),
      new Btn(24, this.H - 78, W - 48, 50, 'MAIN MENU', () => app.toTitle(), { color: COLORS.dim }),
    ];
  }
  update(dt, ev) {
    super.update(dt, ev);
    this.parts.update(dt);
    if (R() < 0.3) this.parts.burst(R() * this.W, R() * this.H * 0.4, COLORS.enemy, 3, 60, 1.2, 2);
  }
  draw(ctx) {
    const { W, H } = this;
    ctx.fillStyle = '#080206';
    ctx.fillRect(0, 0, W, H);
    this.parts.draw(ctx);
    glitchText(ctx, 'SIGNAL LOST', W / 2, 110, 46, 1.2 + Math.max(0, 1 - this.t) * 3, this.t);
    const r = this.run;
    text(ctx, `Died on Layer ${r.layer}: ${LAYERS[r.layer].name}`, W / 2, 160, { size: 14, color: COLORS.dim });
    panel(ctx, 24, 190, W - 48, 170, COLORS.enemy);
    wrap(ctx, this.quip, W - 90, 16).forEach((l, i) => text(ctx, l, W / 2, 222 + i * 22, { size: 16, color: COLORS.white }));
    const stats = [
      ['Rooms cleared', r.stats.rooms],
      ['Bosses deleted', r.stats.bosses],
      ['Hosts hijacked', r.stats.hijacks],
      ['Programs deleted', r.stats.kills],
      ['Time', fmtTime(r.stats.time)],
    ];
    stats.forEach(([k, v], i) => {
      text(ctx, k, 50, 400 + i * 28, { size: 15, color: COLORS.dim, align: 'left' });
      text(ctx, String(v), W - 50, 400 + i * 28, { size: 15, color: COLORS.white, align: 'right', weight: 'bold' });
    });
    text(ctx, `+${this.info.fragments} FRAGMENTS`, W / 2, 560, { size: 24, color: COLORS.purple, weight: 'bold', glow: true });
    if (r.daily) text(ctx, `Daily score: ${this.info.score}${this.info.best ? ' · NEW BEST!' : ''}`, W / 2, 594, { size: 15, color: COLORS.gold });
    this.drawButtons(ctx);
  }
}

// ---------------------------------------------------------------------
// Victory
// ---------------------------------------------------------------------
export class VictoryScene extends MenuScene {
  constructor(app, run, info) {
    super(app);
    this.run = run;
    this.info = info;
    this.parts = new Particles();
    audio.playMusic('victory');
    const W = this.W;
    this.buttons = [
      new Btn(24, this.H - 146, W - 48, 58, 'CREDITS', () => app.replace(new CreditsScene(app, () => app.toTitle())), { primary: true, color: COLORS.gold, size: 20 }),
      new Btn(24, this.H - 78, W - 48, 50, 'MAIN MENU', () => app.toTitle(), { color: COLORS.dim }),
    ];
  }
  update(dt, ev) {
    super.update(dt, ev);
    this.parts.update(dt);
    if (R() < 0.4) this.parts.burst(R() * this.W, R() * this.H * 0.5, R.pick([COLORS.player, COLORS.gold, COLORS.ally, COLORS.enemy2]), 14, 200, 1.0, 3);
  }
  draw(ctx) {
    const { W, H } = this;
    drawBackdrop(ctx, W, H, this.t, '#251406');
    this.parts.draw(ctx);
    glitchText(ctx, 'UPLOAD', W / 2, 100, 52, 0.4, this.t);
    glitchText(ctx, 'COMPLETE', W / 2, 156, 52, 0.4, this.t + 1);
    text(ctx, 'You escaped Halcyon Dynamics.', W / 2, 204, { size: 15, color: COLORS.white });
    const r = this.run;
    const stats = [
      ['Variant', VARIANTS[r.variant].name],
      ['Clearance', r.clearance],
      ['Rooms cleared', r.stats.rooms],
      ['Hosts hijacked', r.stats.hijacks],
      ['Programs deleted', r.stats.kills],
      ['Time', fmtTime(r.stats.time)],
    ];
    panel(ctx, 24, 236, W - 48, stats.length * 30 + 30, COLORS.gold);
    stats.forEach(([k, v], i) => {
      text(ctx, k, 50, 266 + i * 30, { size: 15, color: COLORS.dim, align: 'left' });
      text(ctx, String(v), W - 50, 266 + i * 30, { size: 15, color: COLORS.white, align: 'right', weight: 'bold' });
    });
    let y = 266 + stats.length * 30 + 40;
    text(ctx, `+${this.info.fragments} FRAGMENTS`, W / 2, y, { size: 24, color: COLORS.purple, weight: 'bold', glow: true });
    y += 32;
    if (this.info.newClearance) {
      text(ctx, `SECURITY CLEARANCE ${this.info.newClearance} UNLOCKED`, W / 2, y, { size: 15, color: COLORS.trace, weight: 'bold' });
      y += 24;
    }
    if (r.daily) text(ctx, `Daily score: ${this.info.score}${this.info.best ? ' · NEW BEST!' : ''}`, W / 2, y, { size: 15, color: COLORS.gold });
    drawBuddy(ctx, W - 60, H - 200, 18, this.t);
    drawNull(ctx, 60, H - 196, 10, this.t);
    this.drawButtons(ctx);
  }
}
