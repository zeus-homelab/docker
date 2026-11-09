// Boot, scaling, main loop, scene stack and run flow.
import { COLORS, R } from './engine.js';
import { Input } from './input.js';
import { audio } from './audio.js';
import { loadProfile, saveProfile, saveRun, clearRun } from './save.js';
import { genMap, findNode, roomConfig, fragmentsFor, scoreFor, runRng } from './run.js';
import { GameScene } from './game.js';
import { CutsceneScene, INTRO, ENDING } from './story.js';
import { BootScene, TitleScene, MapScene, RewardScene, ShopScene, CooldownScene, EventScene, DeathScene, VictoryScene, PauseScene } from './ui.js';

const BASE_W = 540;
const BASE_H = 960;

class App {
  constructor() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.profile = loadProfile();
    this.scenes = [];
    this.fade = 0;
    this.W = BASE_W;
    this.H = BASE_H;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
    this.input = new Input(this.canvas, (cx, cy) => this.toGame(cx, cy));
    const unlock = () => {
      audio.init();
      audio.setVolumes(this.profile.settings.sfx, this.profile.settings.music);
    };
    this.canvas.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        const top = this.top();
        if (top instanceof GameScene && !top.dead && !top.cleared) this.pause(top);
        if (top instanceof MapScene) saveRun(top.run);
      }
    });
    this.makeOverlay();
    this.push(new BootScene(this));
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const cw = window.innerWidth;
    const ch = window.innerHeight;
    this.scale = Math.min(cw / BASE_W, ch / BASE_H);
    this.W = BASE_W;
    this.H = Math.max(BASE_H, Math.round(ch / this.scale));
    if (this.H * this.scale > ch + 1) this.scale = ch / this.H;
    this.offX = (cw - this.W * this.scale) / 2;
    this.offY = (ch - this.H * this.scale) / 2;
    this.canvas.width = Math.round(cw * dpr);
    this.canvas.height = Math.round(ch * dpr);
    this.canvas.style.width = cw + 'px';
    this.canvas.style.height = ch + 'px';
    this.dpr = dpr;
    this.makeOverlay();
    for (const s of this.scenes) if (s.build) s.build();
  }

  toGame(cx, cy) {
    return { x: (cx - this.offX) / this.scale, y: (cy - this.offY) / this.scale };
  }

  makeOverlay() {
    // scanlines + vignette, cached
    const c = document.createElement('canvas');
    c.width = this.W;
    c.height = this.H;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < this.H; y += 3) g.fillRect(0, y, this.W, 1);
    const grd = g.createRadialGradient(this.W / 2, this.H / 2, this.H * 0.3, this.W / 2, this.H / 2, this.H * 0.75);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = grd;
    g.fillRect(0, 0, this.W, this.H);
    this.overlay = c;
  }

  // ---------- scene stack ----------
  top() {
    return this.scenes[this.scenes.length - 1];
  }
  push(s) {
    this.scenes.push(s);
    this.fade = Math.max(this.fade, s.transparent ? 0 : 0.5);
  }
  pop() {
    this.scenes.pop();
    const t = this.top();
    if (t && t.resume) t.resume();
  }
  replace(s) {
    this.scenes.pop();
    this.push(s);
  }
  reset(s) {
    this.scenes = [];
    this.push(s);
  }
  saveProfile() {
    saveProfile(this.profile);
  }

  // ---------- loop ----------
  frame(now) {
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;
    const events = this.input.take();
    // window.__speed is a debug hook for automated soak tests (runs N sim steps per frame)
    const steps = window.__speed || 1;
    for (let i = 0; i < steps; i++) {
      const top = this.top();
      if (top) top.update(dt, i === 0 ? events : []);
    }
    if (this.fade > 0) this.fade = Math.max(0, this.fade - dt * 3);
    this.draw();
    requestAnimationFrame((t) => this.frame(t));
  }

  draw() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.scale * this.dpr, 0, 0, this.scale * this.dpr, this.offX * this.dpr, this.offY * this.dpr);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, this.W, this.H);
    ctx.clip();
    // draw from the last opaque scene upward
    let start = this.scenes.length - 1;
    while (start > 0 && this.scenes[start].transparent) start--;
    for (let i = start; i < this.scenes.length; i++) this.scenes[i].draw(ctx);
    ctx.drawImage(this.overlay, 0, 0);
    if (this.fade > 0) {
      ctx.globalAlpha = this.fade;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, this.W, this.H);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // ---------- flow ----------
  toTitle() {
    this.reset(new TitleScene(this));
  }

  pause(game) {
    if (this.top() === game) this.push(new PauseScene(this, game));
  }

  beginRun(run) {
    saveRun(run);
    const startPick = () => {
      this.reset(new RewardScene(this, run, {
        title: 'STARTING EXPLOIT',
        sub: 'A gift from BUDDY. He found it in the lost & found.',
        n: this.profile.unlocks.perks.choice ? 4 : 3,
        skipBits: 0,
        onDone: () => {
          run.startPicked = true;
          this.reset(new MapScene(this, run, true));
        },
      }));
    };
    if (!this.profile.seenIntro && !this.profile.settings.skipIntro) {
      this.profile.seenIntro = true;
      this.saveProfile();
      this.reset(new CutsceneScene(this, INTRO, startPick));
    } else startPick();
  }

  continueRun(run) {
    if (!run.startPicked) return this.beginRun(run);
    this.reset(new MapScene(this, run, false));
  }

  toMap(run, intro = false) {
    this.reset(new MapScene(this, run, intro));
  }

  commitNode(run, node) {
    run.pos = node.id;
    if (!run.visited.includes(node.id)) run.visited.push(node.id);
  }

  enterNode(run, node) {
    const done = () => {
      this.commitNode(run, node);
      this.toMap(run);
    };
    switch (node.type) {
      case 'shop':
        this.reset(new ShopScene(this, run, done));
        break;
      case 'cooldown':
        this.reset(new CooldownScene(this, run, done));
        break;
      case 'event':
        this.reset(new EventScene(this, run, done));
        break;
      default: {
        const cfg = roomConfig(run, node);
        this.reset(new GameScene(this, run, cfg, (res) => this.roomDone(run, node, res)));
      }
    }
  }

  roomDone(run, node, res) {
    this.saveProfile();
    if (res.outcome === 'dead') return this.endRun(run, false);
    this.commitNode(run, node);
    run.stats.rooms++;
    const reward = (opts, next) => this.reset(new RewardScene(this, run, { ...opts, onDone: next }));
    const back = () => this.toMap(run);
    if (node.type === 'boss') {
      if (run.layer >= 4) {
        this.reset(new CutsceneScene(this, ENDING, () => this.endRun(run, true)));
        return;
      }
      run.pips = Math.min(run.maxPips, run.pips + 1);
      reward({ title: 'BOSS LOOT', sub: 'Core +1 restored. Take something shiny.' }, () => {
        run.layer++;
        run.map = genMap(run, run.layer);
        run.pos = null;
        run.visited = [];
        this.toMap(run, true);
      });
      return;
    }
    if (node.type === 'elite' || res.vaultWon) return reward({}, back);
    if (node.type === 'combat') {
      const rng = runRng(run);
      if (rng() < 0.5) return reward({}, back);
      run.bits += 10;
    }
    back();
  }

  endRun(run, won, abandoned = false) {
    const p = this.profile;
    const fragments = fragmentsFor(run, won);
    p.fragments += fragments;
    p.stats.runs++;
    if (won) {
      p.stats.wins++;
      if (!p.stats.bestTime || run.stats.time < p.stats.bestTime) p.stats.bestTime = run.stats.time;
    } else p.stats.deaths++;
    let newClearance = 0;
    if (won && !run.daily && run.clearance >= p.clearanceUnlocked && p.clearanceUnlocked < 20) {
      p.clearanceUnlocked = run.clearance + 1;
      newClearance = p.clearanceUnlocked;
    }
    const score = scoreFor(run, won);
    let best = false;
    if (run.daily) {
      const k = run.dailyKey;
      if (!p.daily[k] || score > p.daily[k]) {
        p.daily[k] = score;
        best = true;
      }
    }
    clearRun();
    this.saveProfile();
    const info = { fragments, score, best, newClearance, abandoned };
    if (won) this.reset(new VictoryScene(this, run, info));
    else this.reset(new DeathScene(this, run, info));
  }
}

window.addEventListener('load', () => {
  window.app = new App();
});

if ('serviceWorker' in navigator && location.protocol !== 'file:' && !window.Capacitor) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
