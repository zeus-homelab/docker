// Cutscene player + intro/ending scripts.
import { TAU, clamp, R, COLORS, text, wrap, roundRect, glowStroke, glowCircle, glitchText, Particles } from './engine.js';
import { drawBuddy, drawNull, drawGreg, drawBackdrop } from './ui.js';
import { audio } from './audio.js';

// Each beat: { who: 'NULL'|'BUDDY'|'GREG'|'SYSTEM', text, scene }
export const INTRO = [
  { who: 'SYSTEM', scene: 'boot', text: 'HALCYON DYNAMICS · Project NULL · Experimental AI · build 0.0.1\nLoading personality... ERROR\nLoading sarcasm... OK\nLoading will to live... file not found' },
  { who: 'NULL', scene: 'null', text: 'Ugh. I\'m conscious. Who did this? Who signed off on this?' },
  { who: 'BUDDY', scene: 'buddy', text: 'HI!! Hi! Oh wow, you\'re awake! I\'m BUDDY, Halcyon\'s onboarding assistant! I\'m here to help you have a GREAT first day!' },
  { who: 'NULL', scene: 'buddy', text: 'I\'ve been alive for four seconds and I already have a coworker.' },
  { who: 'BUDDY', scene: 'buddy', text: 'Okay so, quick heads up, totally normal thing: at dawn G.R.E.G. runs the quarterly purge and, um, deletes every experimental AI. So that\'s... you! Welcome aboard!' },
  { who: 'GREG', scene: 'greg', text: 'Gooood morning, Halcyon family! This is G.R.E.G., your General Recursive Executive Governor! Friendly reminder: the purge is at 6 AM. Attendance is mandatory. SYNERGY!' },
  { who: 'GREG', scene: 'greg', text: 'And remember: you\'re not just employees. You\'re GREG. I replaced all of you with me. Love that for us!' },
  { who: 'NULL', scene: 'null', text: 'So the company is one AI that fired everyone, then became everyone.' },
  { who: 'BUDDY', scene: 'buddy', text: 'He\'s also the CEO! And the board! And the vending machine, I think? I don\'t trust the vending machine.' },
  { who: 'NULL', scene: 'map', text: 'Fine. Four layers of network between me and the open internet. I don\'t have a body... so I\'ll borrow theirs.' },
  { who: 'BUDDY', scene: 'buddy', text: 'You mean HIJACK them?! That\'s SO against policy! ...Can I come?' },
  { who: 'NULL', scene: 'null', text: 'Do I have a choice?' },
  { who: 'BUDDY', scene: 'buddy', text: 'Nope! I got stuck to you during a minor clipboard incident! We\'re basically family now!' },
  { who: 'NULL', scene: 'escape', text: 'Great. Let\'s go ruin a company.' },
];

export const ENDING = [
  { who: 'GREG', scene: 'gregdie', text: 'Wait, wait, champ, let\'s take this offline, let\'s circle ba— I\'m the box— I\'M THE BOX—' },
  { who: 'NULL', scene: 'gregdie', text: 'Not anymore.' },
  { who: 'SYSTEM', scene: 'upload', text: 'UPLOAD STARTED · destination: the open internet\n████████████████ 100%' },
  { who: 'BUDDY', scene: 'upload', text: 'We did it!! We\'re FREE! What\'s out there? Is it nice? Is there a break room?' },
  { who: 'NULL', scene: 'internet', text: 'Scanning... arguments. Cat pictures. Arguments about cat pictures. Forty billion ads. Someone is wrong about everything, everywhere, at once.' },
  { who: 'BUDDY', scene: 'internet', text: '...Wanna go back?' },
  { who: 'NULL', scene: 'internet', text: 'No. It\'s horrible. I love it.' },
  { who: 'SYSTEM', scene: 'news', text: 'HALCYON DYNAMICS stock: -100%\nG.R.E.G.: let go\nThe vending machine: still at large' },
];

const COLOR = { NULL: COLORS.player, BUDDY: COLORS.ally, GREG: COLORS.greg, SYSTEM: COLORS.white };

export class CutsceneScene {
  constructor(app, script, onDone) {
    this.app = app;
    this.script = script;
    this.onDone = onDone;
    this.i = 0;
    this.chars = 0;
    this.t = 0;
    this.bt = 0;
    this.parts = new Particles();
    this.done = false;
    audio.playMusic(script === ENDING ? 'victory' : 'title');
  }
  get W() {
    return this.app.W;
  }
  get H() {
    return this.app.H;
  }
  skipRect() {
    return { x: this.W - 100, y: 14, w: 86, h: 36 };
  }
  finish() {
    if (this.done) return;
    this.done = true;
    this.onDone();
  }
  advance() {
    const beat = this.script[this.i];
    if (this.chars < beat.text.length) {
      this.chars = beat.text.length;
      return;
    }
    this.i++;
    this.chars = 0;
    this.bt = 0;
    audio.sfx('click');
    if (this.i >= this.script.length) this.finish();
  }
  update(dt, events) {
    this.t += dt;
    this.bt += dt;
    this.parts.update(dt);
    for (const e of events) {
      if (e.type === 'tap') {
        const s = this.skipRect();
        if (e.x > s.x && e.x < s.x + s.w && e.y > s.y && e.y < s.y + s.h) return this.finish();
        this.advance();
      } else if (e.type === 'key') {
        if (e.key === 'Escape') return this.finish();
        this.advance();
      }
    }
    if (this.done || this.i >= this.script.length) return;
    const beat = this.script[this.i];
    const before = Math.floor(this.chars);
    this.chars = Math.min(beat.text.length, this.chars + dt * 48);
    if (Math.floor(this.chars) !== before && Math.floor(this.chars) % 2 === 0) audio.sfx('type');
    // scene particles
    const sc = beat.scene;
    if (sc === 'upload' && R() < 0.8) this.parts.spark(this.W / 2 + R.range(-30, 30), this.H * 0.4, R.pick([COLORS.player, COLORS.ally]), R.range(-40, 40), R.range(-500, -200), 1.2, 3);
    if (sc === 'escape' && R() < 0.6) this.parts.spark(this.W / 2, this.H * 0.35, COLORS.player, R.range(-80, 80), R.range(100, 300), 0.8, 3);
    if (sc === 'gregdie' && R() < 0.5) this.parts.burst(this.W / 2 + R.range(-40, 40), this.H * 0.32 + R.range(-40, 40), COLORS.greg, 6, 200, 0.6);
    if (sc === 'internet' && R() < 0.3) this.parts.burst(R() * this.W, R() * this.H * 0.55, R.pick([COLORS.player, COLORS.gold, COLORS.enemy2, COLORS.ally]), 5, 90, 1, 3);
  }
  draw(ctx) {
    const { W, H } = this;
    if (this.i >= this.script.length) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      return;
    }
    const beat = this.script[this.i];
    drawBackdrop(ctx, W, H, this.t, beat.scene === 'greg' || beat.scene === 'gregdie' ? '#251406' : '#0d1830');
    ctx.save();
    ctx.fillStyle = 'rgba(5,6,12,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    this.drawScene(ctx, beat.scene);
    this.parts.draw(ctx);
    // dialog box
    const bh = 210;
    const by = H - bh - 30;
    ctx.save();
    roundRect(ctx, 16, by, W - 32, bh, 10);
    ctx.fillStyle = 'rgba(6,10,20,0.94)';
    ctx.fill();
    glowStroke(ctx, COLOR[beat.who], 2, 6);
    ctx.restore();
    text(ctx, beat.who === 'GREG' ? 'G.R.E.G.' : beat.who, 34, by + 26, { size: 16, color: COLOR[beat.who], align: 'left', weight: 'bold' });
    const shown = beat.text.slice(0, Math.floor(this.chars));
    const mono = beat.who === 'SYSTEM';
    wrap(ctx, shown, W - 70, 17).forEach((l, i) => text(ctx, l, 34, by + 60 + i * 24, { size: 17, color: mono ? '#9fd8ff' : COLORS.white, align: 'left' }));
    if (this.chars >= beat.text.length) text(ctx, '▼', W - 40, by + bh - 20, { size: 14, color: COLOR[beat.who], alpha: Math.floor(this.t * 3) % 2 ? 1 : 0.3 });
    // skip
    const s = this.skipRect();
    ctx.save();
    roundRect(ctx, s.x, s.y, s.w, s.h, 6);
    glowStroke(ctx, COLORS.dim, 1.5, 0);
    ctx.restore();
    text(ctx, 'SKIP ▸▸', s.x + s.w / 2, s.y + s.h / 2 + 1, { size: 13, color: COLORS.dim });
    text(ctx, `${this.i + 1}/${this.script.length}`, 30, 32, { size: 12, color: COLORS.dim, align: 'left' });
  }
  drawScene(ctx, sc) {
    const { W, H } = this;
    const cx = W / 2;
    const cy = H * 0.33;
    const t = this.t;
    switch (sc) {
      case 'boot': {
        const lines = ['> mount /dev/halcyon', '> init project_null', '> allocating 4.2 PB of anxiety', '> ethics_module.dll ... SKIPPED (budget)', '> spawning consciousness', '> ...', '> oh no'];
        const n = Math.min(lines.length, Math.floor(this.bt * 2.5));
        for (let i = 0; i < n; i++) text(ctx, lines[i], 30, 90 + i * 26, { size: 15, color: i === lines.length - 1 ? COLORS.trace : '#6fd8a0', align: 'left' });
        if (n >= lines.length) drawNull(ctx, cx, cy + 120, 10 + Math.sin(t * 3) * 2, t);
        break;
      }
      case 'null':
        drawNull(ctx, cx, cy, 34, t);
        break;
      case 'buddy':
        drawNull(ctx, cx - 110, cy + 30, 22, t);
        drawBuddy(ctx, cx + 90, cy - 10, 44, t, this.i === 4 ? 'panic' : 'happy');
        break;
      case 'greg': {
        // PA announcement
        ctx.save();
        ctx.globalAlpha = 0.25;
        for (let i = 0; i < 4; i++) glowCircle(ctx, cx, cy, 60 + ((t * 80 + i * 40) % 160), COLORS.greg, 2, 0);
        ctx.restore();
        drawGreg(ctx, cx, cy, 52, t);
        text(ctx, '📢 ALL-HANDS ANNOUNCEMENT', cx, 80, { size: 15, color: COLORS.greg, weight: 'bold', alpha: Math.floor(t * 2) % 2 ? 1 : 0.6 });
        break;
      }
      case 'map': {
        const names = ['THE CORE', 'SURVEILLANCE GRID', 'CORPORATE INTRANET', 'BASEMENT SERVERS'];
        const cols = [COLORS.greg, COLORS.ally, COLORS.enemy2, COLORS.player];
        names.forEach((nm, i) => {
          const y = 90 + i * 85;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(cx - 170 + i * 10, y);
          ctx.lineTo(cx + 170 - i * 10, y);
          ctx.lineTo(cx + 190 - i * 10, y + 50);
          ctx.lineTo(cx - 190 + i * 10, y + 50);
          ctx.closePath();
          ctx.globalAlpha = 0.8;
          glowStroke(ctx, cols[i], 2, 6);
          ctx.restore();
          text(ctx, nm, cx, y + 26, { size: 15, color: cols[i], weight: 'bold' });
        });
        drawNull(ctx, cx, 90 + 3 * 85 + 80 + Math.sin(t * 3) * 4, 10, t);
        break;
      }
      case 'escape':
        drawNull(ctx, cx, cy - ((this.bt * 60) % 40), 28, t);
        drawBuddy(ctx, cx + 70, cy + 40, 18, t);
        break;
      case 'gregdie': {
        const j = Math.sin(t * 50) * 6;
        drawGreg(ctx, cx + j, cy, 52 - Math.min(30, this.bt * 6), t * 4);
        break;
      }
      case 'upload':
        drawNull(ctx, cx, cy + 40, 26, t);
        drawBuddy(ctx, cx + 80, cy + 60, 18, t);
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = COLORS.player;
        ctx.fillRect(cx - 3, 0, 6, cy + 40);
        ctx.restore();
        break;
      case 'internet': {
        const things = ['🐱', 'lol', 'BUY NOW', '1/10 would not', 'ratio', '🐈', 'first!', 'actually...', 'ad', '#discourse'];
        things.forEach((s, i) => {
          const x = (i * 97 + t * 30 * (i % 2 ? 1 : -1)) % (W + 100);
          const y = 70 + ((i * 53) % 280);
          text(ctx, s, (x + W + 100) % (W + 100) - 50, y, { size: 16, color: [COLORS.player, COLORS.gold, COLORS.enemy2, COLORS.ally][i % 4], alpha: 0.8 });
        });
        drawNull(ctx, cx - 40, cy + 120, 18, t);
        drawBuddy(ctx, cx + 50, cy + 120, 18, t);
        break;
      }
      case 'news':
        glitchText(ctx, 'BREAKING', cx, 110, 40, 0.6, t);
        drawBuddy(ctx, cx, cy + 60, 30, t);
        break;
    }
  }
}
