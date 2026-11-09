// Room gameplay: hosts, jumping, AI, combat, bosses, HUD.
import { TAU, clamp, lerp, dist, dist2, angle, makeRng, R, COLORS, glowStroke, glowCircle, poly, text, wrap, roundRect, Particles, Floaters, buzz } from './engine.js';
import { HOSTS, LAYER_HOSTS, LAYERS, BOSSES, GLITCHES, BUDDY_TIPS, ROOM_CLEAR_QUIPS, EXPLOITS } from './data.js';
import { has, hasGlitch } from './run.js';
import { audio } from './audio.js';
import { drawNull, drawGreg } from './ui.js';

const JUMP_RANGE = 220;
const SPARK_SPEED = 270;
const ENEMY_SPECIALS = new Set(['dash', 'blast', 'shield', 'pursuit', 'restart', 'bomb']);

let UID = 1;

export class GameScene {
  constructor(app, run, cfg, onDone) {
    this.app = app;
    this.run = run;
    this.cfg = cfg;
    this.onDone = onDone;
    this.rng = makeRng(cfg.seed || 1);
    this.t = 0;
    this.units = [];
    this.bullets = [];
    this.hazards = [];
    this.pickups = [];
    this.spawnQueue = [];
    this.obstacles = [];
    this.parts = new Particles();
    this.floats = new Floaters();
    this.shakeAmt = 0;
    this.slowmo = 0;
    this.flash = 0;
    this.boss = null;
    this.lockdown = false;
    this.cleared = false;
    this.clearT = 0;
    this.dead = false;
    this.deadT = 0;
    this.banner = null; // {text, sub, t, color}
    this.tip = null; // {text, t}
    this.tutorial = app.profile.stats.runs === 0 && run.layer === 1 && run.stats.rooms === 0 && cfg.type !== 'boss';
    this.tutStep = 0;
    this.firstHostThisRoom = true;
    this.crashUsed = false;
    this.blueT = 25 + R() * 15;
    this.blueShow = 0;
    this.lagQueue = [];
    this.move = { target: null, holdId: null, joy: null, joyId: null, downUnit: null };
    this.timeLeft = cfg.time || 0;
    this.layout();
    this.cl = run.clearance || 0;
    this.layerDef = LAYERS[cfg.layer];
    this.pl = { mode: 'spark', host: null, x: this.W / 2, y: this.A.b - 90, vx: 0, vy: 0, inv: 2.2, ghost: 0, jump: null, lastJump: -9, tetherT: 0 };
    this.genObstacles();
    this.setupRoom();
    audio.playMusic(cfg.type === 'boss' ? 'boss' : this.layerDef.music);
    audio.siren = false;
  }

  layout() {
    this.W = this.app.W;
    this.H = this.app.H;
    this.A = { l: 10, r: this.W - 10, t: 92, b: this.H - 150 };
    const lh = this.run.glitches.length ? 1 : 0;
    this.A.t += lh * 6;
  }

  // ---------- setup ----------
  genObstacles() {
    if (this.cfg.type === 'boss') return;
    const n = this.rng.int(2, 4);
    const A = this.A;
    for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < 20; tries++) {
        const vertical = this.rng.chance(0.5);
        const w = vertical ? 34 : this.rng.int(90, 150);
        const h = vertical ? this.rng.int(90, 150) : 34;
        const x = this.rng.range(A.l + 50, A.r - 50 - w);
        const y = this.rng.range(A.t + 80, A.b - 140 - h);
        const o = { x, y, w, h };
        if (this.obstacles.some((p) => x < p.x + p.w + 50 && x + w + 50 > p.x && y < p.y + p.h + 50 && y + h + 50 > p.y)) continue;
        this.obstacles.push(o);
        break;
      }
    }
  }

  setupRoom() {
    const c = this.cfg;
    const L = c.layer;
    this.waves = [];
    const pool = LAYER_HOSTS[L];
    if (c.type === 'combat') {
      const nw = L >= 3 ? 3 : 2;
      for (let i = 0; i < nw; i++) {
        const n = Math.min(7, 2 + L + i);
        const w = [];
        for (let k = 0; k < n; k++) w.push({ type: this.rng.pick(pool) });
        this.waves.push(w);
      }
      if (this.tutorial) this.waves = [[{ type: 'crawler' }, { type: 'spambot' }, { type: 'crawler' }], [{ type: 'spambot' }, { type: 'firewall' }, { type: 'crawler' }, { type: 'spooler' }]];
    } else if (c.type === 'elite') {
      const et = this.rng.pick(pool.filter((h) => HOSTS[h].speed > 0 || this.rng.chance(0.3)));
      this.waves.push([{ type: et, elite: true }, { type: this.rng.pick(pool) }, { type: this.rng.pick(pool) }]);
      this.waves.push([{ type: this.rng.pick(pool) }, { type: this.rng.pick(pool) }, { type: this.rng.pick(pool) }, { type: this.rng.pick(pool), elite: L >= 3 }]);
    } else if (c.type === 'vault') {
      this.safe = { x: this.W / 2, y: this.A.t + 120, r: 30, hp: 260 + L * 60, maxHp: 260 + L * 60, req: c.required, broken: false };
      this.obstacles = this.obstacles.filter((o) => !(o.y < this.safe.y + 80 && o.y + o.h > this.safe.y - 80 && o.x < this.safe.x + 80 && o.x + o.w > this.safe.x - 80));
      this.waves.push([{ type: c.required }, { type: this.rng.pick(pool) }, { type: this.rng.pick(pool) }]);
      this.vaultSpawnT = 4;
      this.showBanner('VAULT', `Crack it using a ${HOSTS[c.required].name.toUpperCase()}`, COLORS.gold);
    } else if (c.type === 'boss') {
      const id = this.layerDef.boss;
      this.bossIntroT = 2.6;
      this.bossId = id;
      audio.sfx('boss');
    }
    if (this.run.allyHunter) {
      this.run.allyHunter = false;
      const u = this.makeUnit('hunter', this.W / 2 + 60, this.A.b - 100, { faction: 'ally' });
      u.allyT = Infinity;
      u.quip = 'reporting for duty!';
      u.quipT = 3;
    }
    this.waveIdx = 0;
    this.waveDelay = 0.6;
    if (this.tutorial) this.showTip(BUDDY_TIPS[0], 7);
  }

  // ---------- units ----------
  makeUnit(type, x, y, opts = {}) {
    const def = HOSTS[type];
    const enemy = (opts.faction || 'enemy') === 'enemy';
    const elite = !!opts.elite;
    const hpMul = (enemy ? 1 + 0.08 * this.cl : 1) * (elite ? 2.5 : 1);
    const u = {
      kind: 'unit', id: UID++, type, def, x, y, vx: 0, vy: 0,
      r: def.r * (elite ? 1.35 : 1),
      maxHp: def.hp * hpMul, hp: def.hp * hpMul,
      faction: opts.faction || 'enemy',
      speed: def.speed * (elite ? 0.9 : 1),
      atkCd: 0.6 + R() * 1.2,
      spCd: def.special.cd * (0.5 + R() * 0.6),
      dmgMul: (enemy ? 1 + 0.04 * this.cl : 1) * (elite ? 1.3 : 1),
      st: {}, elite, face: R() * TAU, quip: null, quipT: 2 + R() * 8, allyT: 0, hitFlash: 0, spawnT: 0.25,
      strafeDir: R() < 0.5 ? 1 : -1, wobble: R() * 10, path: [],
    };
    Object.assign(u, opts.extra || {});
    this.units.push(u);
    if (!this.app.profile.seenHosts[type]) this.app.profile.seenHosts[type] = true;
    return u;
  }

  queueSpawn(type, opts = {}, pos = null) {
    const p = pos || this.findSpawnPos();
    this.spawnQueue.push({ type, x: p.x, y: p.y, t: 0.8, opts });
  }

  findSpawnPos(minDist = 190) {
    const A = this.A;
    const px = this.playerX();
    const py = this.playerY();
    for (let i = 0; i < 40; i++) {
      const x = this.rng.range(A.l + 30, A.r - 30);
      const y = this.rng.range(A.t + 30, A.b - 30);
      if (dist(x, y, px, py) < minDist) continue;
      if (this.inObstacle(x, y, 24)) continue;
      return { x, y };
    }
    return { x: this.W / 2, y: A.t + 60 };
  }

  inObstacle(x, y, r = 0) {
    for (const o of this.obstacles) if (x + r > o.x && x - r < o.x + o.w && y + r > o.y && y - r < o.y + o.h) return o;
    return null;
  }

  playerX() {
    return this.pl.host ? this.pl.host.x : this.pl.x;
  }
  playerY() {
    return this.pl.host ? this.pl.host.y : this.pl.y;
  }

  enemies() {
    return this.units.filter((u) => !u.dead && u.faction === 'enemy');
  }

  // ---------- tips & banners ----------
  showTip(str, t = 5) {
    this.tip = { text: str, t, max: t };
  }
  showBanner(str, sub = '', color = COLORS.white, t = 2.2) {
    this.banner = { text: str, sub, color, t, max: t };
  }
  shake(a) {
    if (this.app.profile.settings.shake) this.shakeAmt = Math.max(this.shakeAmt, a);
  }

  // ---------- modifiers ----------
  // Bare spark: full 220. Inside a host: that host's own jump range (turrets reach furthest).
  jumpRange() {
    const h = this.pl.host;
    const base = h && this.pl.mode === 'host' ? h.def.jump || 160 : JUMP_RANGE;
    let r = base * (1 + 0.25 * has(this.run, 'longreach'));
    if (this.run.variant === 'rootkit') r *= 1.2;
    return r;
  }
  decayMul() {
    let m = Math.pow(1.3, has(this.run, 'overclock')) * Math.pow(0.75, has(this.run, 'slowrot'));
    if (this.run.variant === 'worm') m *= 2;
    return m;
  }
  playerDmgMul(host) {
    let m = Math.pow(1.3, has(this.run, 'overclock'));
    if (this.run.variant === 'phantom') m *= 0.75;
    if (host && host.inverted) m *= 2;
    if (host && host.st.buff > 0) m *= 1.5;
    return m;
  }
  jumpCost(target) {
    if (this.run.variant === 'worm') return 0;
    if (this.lockdown) return 0;
    if (has(this.run, 'chainjump') && this.t - this.pl.lastJump < 1) return 0;
    const weak = target.hp < target.maxHp * 0.5 || this.run.variant === 'rootkit';
    let c = weak ? 6 : 14;
    c *= Math.pow(0.75, has(this.run, 'vpn'));
    if (hasGlitch(this.run, 'bodyhorror')) c *= 0.7;
    c *= 1 + 0.02 * this.cl;
    return Math.round(c);
  }

  // ---------- jumping ----------
  canPossess(u) {
    return u && !u.dead && u.faction === 'enemy' && !u.isBossPart && !u.greg;
  }

  tryJump(target) {
    const pl = this.pl;
    if (pl.mode === 'jumping' || this.dead || this.cleared) return false;
    if (this.t - pl.lastJump < 0.35) return false;
    if (!this.canPossess(target)) {
      if (target && target.greg) {
        this.floats.add(target.x, target.y - target.r - 14, 'GREG IS IN THERE', COLORS.greg, 14);
        audio.sfx('deny');
      }
      return false;
    }
    const fx = this.playerX();
    const fy = this.playerY();
    if (dist(fx, fy, target.x, target.y) > this.jumpRange() + target.r) return false;
    const cost = this.jumpCost(target);
    const old = pl.host;
    if (old) this.leaveHost(old);
    pl.host = null;
    pl.mode = 'jumping';
    const instant = hasGlitch(this.run, 'bodyhorror');
    pl.jump = { fx, fy, target, t: 0, dur: instant ? 0.001 : 0.18 };
    pl.x = fx;
    pl.y = fy;
    target.st.frozen = Math.max(target.st.frozen || 0, 0.35);
    pl.lastJump = this.t;
    pl.tetherT = 0;
    this.slowmo = 0.08;
    audio.sfx('jump');
    buzz(15, this.app.profile.settings);
    if (cost > 0) {
      this.run.trace += cost;
      this.floats.add(fx, fy - 30, `+${cost} TRACE`, COLORS.trace, 13, 0.9);
    }
    if (this.run.trace >= this.run.traceMax && !this.lockdown) this.startLockdown();
    if (hasGlitch(this.run, 'forkbomb')) {
      const p = this.findSpawnPos(120);
      const cr = this.makeUnit('crawler', p.x, p.y);
      cr.hp = cr.maxHp = 15;
      const cp = this.makeUnit(target.type, fx + 20, fy, { faction: 'ally' });
      cp.allyT = 3;
      cp.hp = cp.maxHp * 0.5;
    }
    return true;
  }

  leaveHost(old) {
    const run = this.run;
    if (has(run, 'hotswap')) {
      const dmg = 20 * has(run, 'hotswap');
      this.aoe(old.x, old.y, 110, dmg, 'enemy');
      this.parts.burst(old.x, old.y, COLORS.gold, 18, 260, 0.4);
    }
    old.possessed = false;
    if (has(run, 'parasite') || old.type === 'mirror') {
      old.faction = 'ally';
      old.allyT = 4;
    } else {
      this.crash(old);
    }
  }

  crash(u) {
    u.dead = true;
    this.parts.burst(u.x, u.y, COLORS.player, 16, 200, 0.5);
    this.parts.burst(u.x, u.y, COLORS.white, 6, 120, 0.3, 2);
  }

  arrive() {
    const pl = this.pl;
    const target = pl.jump.target;
    pl.jump = null;
    if (!target || target.dead || target.faction !== 'enemy') {
      pl.mode = 'spark';
      pl.inv = Math.max(pl.inv, 0.6);
      return;
    }
    this.possess(target);
  }

  possess(u) {
    const pl = this.pl;
    const run = this.run;
    const prof = this.app.profile;
    pl.mode = 'host';
    pl.host = u;
    u.faction = 'player';
    u.possessed = true;
    u.st = { shield: 0 };
    u.quip = null;
    u.vx = u.vy = 0;
    u.restarted = false;
    run.hostCount++;
    run.stats.hijacks++;
    prof.stats.hijacks++;
    prof.codex[u.type] = (prof.codex[u.type] || 0) + 1;
    u.inverted = hasGlitch(run, 'inverted') && run.hostCount % 3 === 0;
    let hpMul = 1;
    if (hasGlitch(run, 'lag')) hpMul *= 1.5;
    if ((prof.codex[u.type] || 0) >= 25) hpMul *= 1.2;
    u.maxHp *= hpMul;
    u.hp *= hpMul;
    if (this.firstHostThisRoom && has(run, 'patchnotes')) {
      u.hp = u.maxHp;
      u.st.shield = 3;
    }
    this.firstHostThisRoom = false;
    u.spCd = Math.min(u.spCd, 1);
    u.atkCd = 0.1;
    this.parts.burst(u.x, u.y, COLORS.player, 26, 300, 0.45);
    this.parts.burst(u.x, u.y, COLORS.white, 10, 160, 0.3, 2);
    audio.sfx('land');
    this.floats.add(u.x, u.y - u.r - 18, u.def.name.toUpperCase(), COLORS.player, 15, 1.0);
    if (u.inverted) this.floats.add(u.x, u.y - u.r - 36, 'INVERTED x2', COLORS.purple, 13, 1.2);
    if (this.tutorial) {
      if (this.tutStep === 0) {
        this.tutStep = 1;
        this.showTip(BUDDY_TIPS[1], 6);
      } else if (this.tutStep === 2) {
        this.tutStep = 3;
        this.showTip(BUDDY_TIPS[2], 6);
      }
    }
  }

  ejectFrom(u) {
    const pl = this.pl;
    pl.host = null;
    pl.mode = 'spark';
    pl.x = u.x;
    pl.y = u.y;
    pl.inv = 1.0;
    if (has(this.run, 'ghost')) pl.ghost = 1.0;
    audio.sfx('eject');
    this.shake(6);
    buzz(40, this.app.profile.settings);
    if (this.tutorial && this.tutStep < 4) {
      this.tutStep = Math.max(this.tutStep, 2);
      this.showTip(BUDDY_TIPS[3], 5);
    }
    if (has(this.run, 'recursion') && R() < 0.2) {
      const t = this.nearest(u.x, u.y, (e) => this.canPossess(e), this.jumpRange());
      if (t) {
        pl.lastJump = -9;
        const saved = this.run.trace;
        this.tryJump(t);
        this.run.trace = saved;
        this.floats.add(u.x, u.y - 40, 'RECURSION!', COLORS.gold, 15);
      }
    }
  }

  // ---------- damage ----------
  damageUnit(u, dmg, src = null) {
    if (u.dead) return;
    if (u.st.dash > 0) return;
    if (u.possessed) {
      dmg *= Math.pow(0.85, has(this.run, 'thickskin'));
      if (this.pl.inv > 0) return;
    }
    if (u.st.marked > 0) dmg *= 2;
    u.hp -= dmg;
    u.hitFlash = 0.1;
    if (this.app.profile.settings.damageNumbers && dmg >= 1) {
      this.floats.add(u.x + R.range(-8, 8), u.y - u.r - 6, Math.round(dmg).toString(), u.possessed ? COLORS.enemy : COLORS.white, 13, 0.55, -60);
    }
    if (u.possessed) {
      this.shake(3);
      audio.sfx('hurt');
    } else audio.sfx('hit');
    if (u.hp <= 0) this.killUnit(u, src);
  }

  killUnit(u, src) {
    if (u.dead) return;
    u.dead = true;
    const run = this.run;
    if (u.possessed) {
      u.possessed = false;
      this.parts.burst(u.x, u.y, COLORS.player, 24, 260, 0.6);
      if (has(run, 'malware')) {
        this.aoe(u.x, u.y, 120, 30 * has(run, 'malware'), 'enemy');
        this.parts.burst(u.x, u.y, COLORS.gold, 30, 340, 0.5);
        audio.sfx('explode');
        this.shake(8);
      }
      this.ejectFrom(u);
      return;
    }
    this.parts.burst(u.x, u.y, u.greg ? COLORS.greg : u.faction === 'ally' ? COLORS.ally : COLORS.enemy, 20, 240, 0.5);
    audio.sfx('explode');
    if (u.faction === 'enemy') {
      run.stats.kills++;
      const n = Math.ceil(u.def.bits * (u.elite ? 4 : 1) * Math.pow(1.3, has(run, 'cryptominer')));
      for (let i = 0; i < n; i++) this.pickups.push({ x: u.x, y: u.y, vx: R.range(-120, 120), vy: R.range(-120, 120), t: 0 });
    }
    if (u.greg && this.boss && this.boss.onHostDeath) this.boss.onHostDeath(u);
    if (this.boss && this.boss.onUnitDeath) this.boss.onUnitDeath(u);
  }

  aoe(x, y, r, dmg, team) {
    for (const u of this.units) {
      if (u.dead) continue;
      const hostile = team === 'enemy' ? u.faction === 'enemy' : u.faction !== 'enemy';
      if (!hostile) continue;
      if (dist2(x, y, u.x, u.y) < (r + u.r) ** 2) this.damageUnit(u, dmg);
    }
    if (team === 'enemy') {
      if (this.boss && this.boss.hittable() && dist(x, y, this.boss.x, this.boss.y) < r + this.boss.r) this.boss.hit(dmg, null);
      if (this.safe && !this.safe.broken) {
        /* aoe never cracks vaults */
      }
    } else if (this.pl.mode === 'spark' && dist(x, y, this.pl.x, this.pl.y) < r + 8) this.hitSpark();
  }

  hitSpark() {
    const pl = this.pl;
    if (pl.inv > 0 || pl.mode !== 'spark' || this.dead) return;
    this.run.pips -= 1;
    pl.inv = 1.5;
    this.flash = 0.25;
    this.shake(12);
    audio.sfx('hurt');
    buzz(80, this.app.profile.settings);
    this.parts.burst(pl.x, pl.y, COLORS.white, 20, 260, 0.5);
    this.floats.add(pl.x, pl.y - 26, '-1 CORE', COLORS.enemy, 16, 1);
    if (this.run.pips <= 0) this.die();
  }

  hitPlayerTeam(target, dmg, src) {
    // target is player host or ally unit
    this.damageUnit(target, dmg, src);
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.deadT = 0;
    this.slowmo = 0;
    audio.sfx('death');
    audio.siren = false;
    this.parts.burst(this.pl.x, this.pl.y, COLORS.player, 60, 400, 1.2, 4);
    this.parts.burst(this.pl.x, this.pl.y, COLORS.white, 30, 250, 1.0, 3);
    buzz(300, this.app.profile.settings);
  }

  // ---------- lockdown ----------
  startLockdown() {
    this.lockdown = true;
    this.run.trace = this.run.traceMax;
    audio.sfx('lockdown');
    audio.siren = true;
    this.showBanner('LOCKDOWN', 'Security is coming. Kill the Hunters.', COLORS.trace, 2.5);
    this.shake(10);
    const n = 2 + this.cfg.layer;
    for (let i = 0; i < n; i++) {
      const A = this.A;
      const side = i % 4;
      const pos = side === 0 ? { x: A.l + 30, y: this.rng.range(A.t + 40, A.b - 40) } : side === 1 ? { x: A.r - 30, y: this.rng.range(A.t + 40, A.b - 40) } : side === 2 ? { x: this.rng.range(A.l + 40, A.r - 40), y: A.t + 30 } : { x: this.rng.range(A.l + 40, A.r - 40), y: A.b - 30 };
      this.queueSpawn('hunter', { extra: { lockHunter: true } }, pos);
    }
    if (has(this.run, 'honeypot')) this.queueSpawn('hunter', { faction: 'ally', extra: { allyT: Infinity } }, { x: this.playerX() + 40, y: this.playerY() });
  }

  checkLockdownEnd() {
    if (!this.lockdown) return;
    const hunters = this.units.some((u) => !u.dead && u.lockHunter && u.faction === 'enemy') || this.spawnQueue.some((s) => s.opts.extra && s.opts.extra.lockHunter);
    if (!hunters) {
      this.lockdown = false;
      this.run.trace = Math.min(this.run.trace, 40);
      audio.siren = false;
      this.showBanner('LOCKDOWN LIFTED', 'Trace reset to 40', COLORS.ally, 1.8);
    }
  }

  // ---------- specials ----------
  useSpecial(u, byPlayer) {
    if (!u || u.dead || u.spCd > 0) return false;
    if (u.st.stun > 0) return false;
    const sp = u.def.special;
    const team = u.faction === 'enemy' ? 'player' : 'enemy';
    const foes = (x, y, r) => this.units.filter((e) => !e.dead && (team === 'enemy' ? e.faction === 'enemy' : e.faction !== 'enemy') && dist(x, y, e.x, e.y) < r + e.r);
    const nearestFoe = () => (team === 'enemy' ? this.nearest(u.x, u.y, (e) => e.faction === 'enemy', 2000) : this.enemyTarget(u));
    switch (sp.id) {
      case 'dash': {
        let ang = u.face;
        if (byPlayer) {
          const mv = Math.hypot(u.vx, u.vy);
          if (mv > 10) ang = Math.atan2(u.vy, u.vx);
          else {
            const f = nearestFoe();
            if (f) ang = angle(u.x, u.y, f.x, f.y);
          }
        } else {
          const f = nearestFoe();
          if (!f) return false;
          ang = angle(u.x, u.y, f.x, f.y);
        }
        u.st.dash = 0.28;
        u.dashAng = ang;
        u.dashHit = new Set();
        break;
      }
      case 'blast':
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TAU + R() * 0.1;
          this.fireBullet(u, a, 6, 320, team, { color: u.faction === 'enemy' ? COLORS.enemy2 : COLORS.player });
        }
        break;
      case 'shield':
        u.st.shield = 3;
        break;
      case 'jam': {
        const f = nearestFoe();
        const a = f ? angle(u.x, u.y, f.x, f.y) : u.face;
        for (const e of foes(u.x, u.y, 300)) {
          const d = Math.abs(((angle(u.x, u.y, e.x, e.y) - a + Math.PI * 3) % TAU) - Math.PI);
          if (d < 0.8) {
            e.st.frozen = 2;
            this.floats.add(e.x, e.y - e.r - 10, 'JAMMED', '#9fd8ff', 12);
          }
        }
        this.hazards.push({ kind: 'cone', x: u.x, y: u.y, a, w: 1.6, r: 300, t: 0.35, max: 0.35, color: '#9fd8ff' });
        break;
      }
      case 'dive':
        u.st.hidden = 3;
        break;
      case 'replyall':
        for (const e of foes(u.x, u.y, 260)) this.damageUnit(e, 10 * this.playerDmgMul(u), u);
        if (this.boss && this.boss.hittable() && dist(u.x, u.y, this.boss.x, this.boss.y) < 260 + this.boss.r) this.boss.hit(10 * this.playerDmgMul(u), u);
        this.hazards.push({ kind: 'ring', x: u.x, y: u.y, rad: 10, max: 260, speed: 900, dmg: 0, team: 'none', color: COLORS.player, hit: new Set() });
        break;
      case 'schedule': {
        const f = nearestFoe();
        if (!f) return false;
        f.st.frozen = 4;
        this.floats.add(f.x, f.y - f.r - 12, 'IN A MEETING', '#9fd8ff', 13, 1.5);
        break;
      }
      case 'confuse':
        for (const e of foes(u.x, u.y, 200)) {
          e.st.confused = 3;
          this.floats.add(e.x, e.y - e.r - 10, '?!', COLORS.gold, 16);
        }
        this.hazards.push({ kind: 'ring', x: u.x, y: u.y, rad: 10, max: 200, speed: 700, dmg: 0, team: 'none', color: COLORS.gold, hit: new Set() });
        break;
      case 'restart':
        if (u.restarted) return false;
        u.restarted = true;
        u.hp = u.maxHp;
        u.st.stun = 1.5;
        this.floats.add(u.x, u.y - u.r - 12, 'RESTARTING...', COLORS.white, 13, 1.5);
        u.spCd = 9999;
        audio.sfx('special');
        return true;
      case 'unionize':
        for (const a of this.units) if (!a.dead && a.faction === u.faction && dist(a.x, a.y, u.x, u.y) < 200) a.st.buff = 4;
        this.hazards.push({ kind: 'ring', x: u.x, y: u.y, rad: 10, max: 200, speed: 700, dmg: 0, team: 'none', color: COLORS.ally, hit: new Set() });
        break;
      case 'zoom':
        u.zoomShots = 3;
        for (const e of this.units) if (e.st.hidden && e.faction === 'enemy') e.st.hidden = 0;
        break;
      case 'bomb': {
        const ang = Math.hypot(u.vx, u.vy) > 10 ? Math.atan2(u.vy, u.vx) : u.face;
        for (let i = 0; i < 5; i++) {
          const bx = u.x - Math.cos(ang) * i * 34;
          const by = u.y - Math.sin(ang) * i * 34;
          this.hazards.push({ kind: 'bomb', x: bx, y: by, t: 0.7 + i * 0.12, r: 58, dmg: 22 * (team === 'enemy' ? this.playerDmgMul(u) : u.dmgMul), team });
        }
        break;
      }
      case 'mark': {
        const f = nearestFoe();
        if (!f) return false;
        f.st.marked = 6;
        for (const e of foes(f.x, f.y, 250)) if (e !== f) {
          e.st.confused = 3;
          e.forceTarget = f;
        }
        break;
      }
      case 'pursuit':
        u.st.haste = 2.5;
        break;
      case 'sudo':
        if (this.lockdown) {
          this.floats.add(u.x, u.y - 30, 'sudo: permission denied (lockdown)', COLORS.trace, 12);
        } else {
          this.run.trace = Math.max(0, this.run.trace - 20);
          this.floats.add(u.x, u.y - 30, '-20 TRACE', COLORS.ally, 15);
        }
        break;
      case 'reflect':
        u.st.reflect = 2.5;
        break;
      case 'twin': {
        const tw = this.makeUnit(u.type, u.x + 34, u.y, { faction: 'ally' });
        tw.allyT = 5;
        tw.twin = u;
        tw.hp = tw.maxHp = u.maxHp;
        tw.spCd = 99;
        break;
      }
      case 'delegate': {
        const list = foes(u.x, u.y, 600).sort((a, b) => dist2(a.x, a.y, u.x, u.y) - dist2(b.x, b.y, u.x, u.y)).slice(0, 3);
        for (const e of list) {
          e.st.confused = 3;
          this.floats.add(e.x, e.y - e.r - 10, 'DELEGATED', COLORS.gold, 12);
        }
        break;
      }
    }
    u.spCd = sp.cd;
    if (byPlayer) {
      audio.sfx('special');
      this.floats.add(u.x, u.y - u.r - 22, sp.name + '!', COLORS.gold, 14, 0.8);
      buzz(20, this.app.profile.settings);
      if (this.tutorial && this.tutStep >= 4) this.tutStep = 9;
    }
    return true;
  }

  // ---------- shooting ----------
  fireBullet(u, a, dmg, speed, team, opts = {}) {
    this.bullets.push({
      x: u.x + Math.cos(a) * u.r * 0.8, y: u.y + Math.sin(a) * u.r * 0.8,
      vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      dmg, team, r: opts.size || 4, life: opts.life || 2.2,
      color: opts.color || (team === 'enemy' ? COLORS.player : COLORS.enemy),
      bounce: opts.bounce || 0, laser: opts.laser || false, src: u, srcType: u.type, hitSet: null,
    });
  }

  attack(u, target) {
    const at = u.def.attack;
    const isPlayer = u.faction !== 'enemy';
    const team = isPlayer ? 'enemy' : 'player';
    let dmg = at.dmg * (isPlayer ? (u.possessed ? this.playerDmgMul(u) : 1) : u.dmgMul);
    if (u.greg) dmg *= 2;
    if (!isPlayer && u.st.buff > 0) dmg *= 1.5;
    if (u.zoomShots > 0) {
      dmg *= 2;
      u.zoomShots--;
    }
    const a = angle(u.x, u.y, target.x, target.y);
    u.face = a;
    if (at.type === 'melee') {
      if (target.kind === 'boss') target.hit(dmg, u);
      else if (target.kind === 'gregspark') target.hit(dmg, u);
      else if (target.kind === 'safe') this.hitSafe(dmg, u);
      else if (target === this.pl) this.hitSpark();
      else this.damageUnit(target, dmg, u);
      this.parts.burst(lerp(u.x, target.x, 0.6), lerp(u.y, target.y, 0.6), isPlayer ? COLORS.player : COLORS.enemy, 6, 120, 0.25, 2);
      return;
    }
    const n = at.count || 1;
    for (let i = 0; i < n; i++) {
      const off = n > 1 ? (i - (n - 1) / 2) * (at.spread || 0.2) : 0;
      const jitter = isPlayer ? 0 : R.range(-0.06, 0.06);
      this.fireBullet(u, a + off + jitter, dmg, at.speed || 320, team, {
        size: at.size, bounce: at.bounce, laser: at.laser,
        color: u.greg ? COLORS.greg : isPlayer ? COLORS.player : u.faction === 'enemy' ? COLORS.enemy : COLORS.ally,
      });
    }
    if (isPlayer && u.possessed) audio.sfx('shoot');
    else if (R() < 0.5) audio.sfx('eshoot');
  }

  nearest(x, y, pred, maxD = Infinity) {
    let best = null;
    let bd = maxD * maxD;
    for (const u of this.units) {
      if (u.dead || !pred(u)) continue;
      const d = dist2(x, y, u.x, u.y);
      if (d < bd) {
        bd = d;
        best = u;
      }
    }
    return best;
  }

  // target choice for enemy-faction units (what they attack)
  enemyTarget(u) {
    if (u.st.confused > 0) {
      if (u.forceTarget && !u.forceTarget.dead) return u.forceTarget;
      return this.nearest(u.x, u.y, (e) => e !== u && e.faction === 'enemy', 600);
    }
    const pl = this.pl;
    let best = null;
    let bd = Infinity;
    const consider = (t, x, y) => {
      const d = dist2(u.x, u.y, x, y);
      if (d < bd) {
        bd = d;
        best = t;
      }
    };
    if (pl.mode === 'host' && pl.host && !(pl.host.st.hidden > 0)) consider(pl.host, pl.host.x, pl.host.y);
    if (pl.mode === 'spark' && pl.ghost <= 0) consider(pl, pl.x, pl.y);
    for (const a of this.units) if (!a.dead && a.faction === 'ally' && !(a.st.hidden > 0)) consider(a, a.x, a.y);
    return best;
  }

  // targets for player/ally units
  playerTargets(u, range) {
    let best = null;
    let bd = range * range;
    const consider = (t, x, y, r, prio = 0) => {
      const d = dist2(u.x, u.y, x, y) - (r * r) - prio;
      if (d < bd) {
        bd = d;
        best = t;
      }
    };
    for (const e of this.units) if (!e.dead && e.faction === 'enemy' && !(e.st.hidden > 0)) consider(e, e.x, e.y, e.r, e.st.marked > 0 ? 40000 : e.greg ? 70000 : 0);
    if (this.boss) {
      if (this.boss.hittable()) consider(this.boss, this.boss.x, this.boss.y, this.boss.r, 20000);
      if (this.boss.spark && this.boss.spark.active) consider(this.boss.spark, this.boss.spark.x, this.boss.spark.y, 14, 90000);
    }
    if (this.safe && !this.safe.broken && u.type === this.safe.req) consider(this.safeTarget(), this.safe.x, this.safe.y, this.safe.r, 60000);
    return best;
  }

  safeTarget() {
    if (!this._safeT) this._safeT = { kind: 'safe', x: this.safe.x, y: this.safe.y, r: this.safe.r };
    return this._safeT;
  }

  hitSafe(dmg, src) {
    const s = this.safe;
    if (!s || s.broken) return;
    if (!src || src.type !== s.req) {
      this.floats.add(s.x, s.y - 40, `NEEDS ${HOSTS[s.req].name.toUpperCase()}`, COLORS.gold, 12, 0.6);
      return;
    }
    s.hp -= dmg;
    this.parts.burst(s.x, s.y, COLORS.gold, 4, 120, 0.3, 2);
    if (s.hp <= 0) {
      s.broken = true;
      audio.sfx('bigexplode');
      this.shake(10);
      this.parts.burst(s.x, s.y, COLORS.gold, 70, 380, 1.0, 4);
      const n = 30 + this.cfg.layer * 10;
      for (let i = 0; i < n; i++) this.pickups.push({ x: s.x, y: s.y, vx: R.range(-260, 260), vy: R.range(-260, 260), t: 0 });
      this.vaultWon = true;
      this.showBanner('VAULT CRACKED', 'Loot acquired', COLORS.gold);
    }
  }

  // ---------- input ----------
  pointerOnButton(x, y) {
    const b = this.buttons();
    if (dist(x, y, b.pause.x, b.pause.y) < b.pause.r + 10) return 'pause';
    if (this.pl.host && dist(x, y, b.special.x, b.special.y) < b.special.r + 8) return 'special';
    if (hasGlitch(this.run, 'bluescreen') && !this.crashUsed && dist(x, y, b.crash.x, b.crash.y) < b.crash.r + 8) return 'crash';
    return null;
  }

  buttons() {
    const left = this.app.profile.settings.leftHanded;
    const sx = left ? 70 : this.W - 70;
    const cx = left ? this.W - 54 : 54;
    return {
      pause: { x: this.W - 30, y: 30, r: 20 },
      special: { x: sx, y: this.H - 76, r: 50 },
      crash: { x: cx, y: this.H - 70, r: 30 },
    };
  }

  unitAt(x, y) {
    let best = null;
    let bd = Infinity;
    for (const u of this.units) {
      if (u.dead || u.faction !== 'enemy') continue;
      const d = dist(x, y, u.x, u.y);
      if (d < u.r + 26 && d < bd) {
        bd = d;
        best = u;
      }
    }
    return best;
  }

  handleButton(b) {
    if (b === 'pause') this.app.pause(this);
    else if (b === 'special') this.useSpecial(this.pl.host, true);
    else if (b === 'crash') {
      this.crashUsed = true;
      for (const u of this.units) if (!u.dead && u.faction === 'enemy') u.st.frozen = 3;
      this.blueShow = 0.35;
      audio.sfx('glitch');
      this.showBanner(':( CRASH', 'Everything is stunned', '#4d7bff', 1.4);
    }
  }

  handleInput(events) {
    const scheme = this.app.profile.settings.controls;
    const mv = this.move;
    const inp = this.app.input;
    for (const e of events) {
      if (e.type === 'key') {
        if (e.key === 'Escape' || e.key === 'p') this.app.pause(this);
        if (e.key === ' ' && this.pl.host) this.useSpecial(this.pl.host, true);
        continue;
      }
      if (this.dead || this.cleared) continue;
      if (e.type === 'down') {
        const b = this.pointerOnButton(e.x, e.y);
        if (b) {
          this.handleButton(b);
          continue;
        }
        if (this.bossIntroT > 0) continue;
        const u = this.unitAt(e.x, e.y);
        if (scheme === 'tap') {
          if (u && this.tryJump(u)) continue;
          if (u && u.greg) continue;
          const h = this.pl.host;
          if (h && dist(e.x, e.y, h.x, h.y) < h.r + 16) {
            this.useSpecial(h, true);
            continue;
          }
          mv.target = { x: e.x, y: e.y };
          mv.holdId = e.id;
        } else {
          mv.joy = { ox: e.x, oy: e.y, dx: 0, dy: 0 };
          mv.joyId = e.id;
          mv.downUnit = u;
        }
      } else if (e.type === 'up') {
        if (e.id === mv.holdId) mv.holdId = null;
        if (e.id === mv.joyId) {
          mv.joy = null;
          mv.joyId = null;
        }
      } else if (e.type === 'tap' && scheme === 'drag') {
        const u = mv.downUnit || this.unitAt(e.x, e.y);
        mv.downUnit = null;
        if (u) this.tryJump(u);
      } else if (e.type === 'flick' && scheme === 'drag') {
        // jump to best enemy in flick direction
        const px = this.playerX();
        const py = this.playerY();
        let best = null;
        let bs = Infinity;
        for (const u of this.units) {
          if (!this.canPossess(u)) continue;
          const d = dist(px, py, u.x, u.y);
          if (d > this.jumpRange() + u.r) continue;
          const a = angle(px, py, u.x, u.y);
          const da = Math.abs(((a - Math.atan2(e.dy, e.dx) + Math.PI * 3) % TAU) - Math.PI);
          if (da > 0.6) continue;
          const s = da * 300 + d;
          if (s < bs) {
            bs = s;
            best = u;
          }
        }
        if (best) this.tryJump(best);
      }
    }
    // continuous
    if (mv.holdId !== null) {
      const p = inp.pointers.get(mv.holdId);
      if (p && !this.pointerOnButton(p.x, p.y)) mv.target = { x: p.x, y: p.y };
    }
    if (mv.joyId !== null && mv.joy) {
      const p = inp.pointers.get(mv.joyId);
      if (p) {
        let dx = p.x - mv.joy.ox;
        let dy = p.y - mv.joy.oy;
        const d = Math.hypot(dx, dy);
        const max = 60;
        if (d > max) {
          mv.joy.ox = p.x - (dx / d) * max;
          mv.joy.oy = p.y - (dy / d) * max;
          dx = (dx / d) * max;
          dy = (dy / d) * max;
        }
        mv.joy.dx = dx / max;
        mv.joy.dy = dy / max;
      }
    }
  }

  // desired movement direction for the controlled entity (unit vector * magnitude 0..1)
  moveIntent(px, py) {
    const mv = this.move;
    const keys = this.app.input.keys;
    let dx = 0;
    let dy = 0;
    if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
    if (keys.has('d') || keys.has('arrowright')) dx += 1;
    if (keys.has('w') || keys.has('arrowup')) dy -= 1;
    if (keys.has('s') || keys.has('arrowdown')) dy += 1;
    if (dx || dy) {
      mv.target = null;
      const d = Math.hypot(dx, dy);
      return { x: dx / d, y: dy / d };
    }
    if (this.app.profile.settings.controls === 'drag') {
      if (mv.joy && (Math.abs(mv.joy.dx) > 0.12 || Math.abs(mv.joy.dy) > 0.12)) return { x: mv.joy.dx, y: mv.joy.dy };
      return { x: 0, y: 0 };
    }
    if (mv.target) {
      const tx = mv.target.x - px;
      const ty = mv.target.y - py;
      const d = Math.hypot(tx, ty);
      if (d < 6) {
        if (mv.holdId === null) mv.target = null;
        return { x: 0, y: 0 };
      }
      const s = Math.min(1, d / 30);
      return { x: (tx / d) * s, y: (ty / d) * s };
    }
    return { x: 0, y: 0 };
  }

  // ---------- update ----------
  update(rdt, events) {
    if (this.app.W !== this.W || this.app.H !== this.H) this.layout();
    this.handleInput(events);
    let dt = rdt;
    if (this.slowmo > 0) {
      this.slowmo -= rdt;
      dt *= 0.3;
    }
    if (this.dead) {
      this.deadT += rdt;
      dt *= 0.25;
      if (this.deadT > 2.0 && !this.doneSent) {
        this.doneSent = true;
        this.onDone({ outcome: 'dead' });
      }
    }
    this.t += dt;
    this.run.stats.time += rdt;
    this.parts.update(dt);
    this.floats.update(dt);
    if (this.shakeAmt > 0) this.shakeAmt = Math.max(0, this.shakeAmt - rdt * 30);
    if (this.flash > 0) this.flash -= rdt;
    if (this.banner) {
      this.banner.t -= rdt;
      if (this.banner.t <= 0) this.banner = null;
    }
    if (this.tip) {
      this.tip.t -= rdt;
      if (this.tip.t <= 0) this.tip = null;
    }
    audio.setTrace(this.run.trace / this.run.traceMax * 100);

    if (this.bossIntroT > 0) {
      this.bossIntroT -= rdt;
      if (this.bossIntroT <= 0) this.spawnBoss();
      return;
    }

    // glitch: blue screen
    if (hasGlitch(this.run, 'bluescreen')) {
      this.blueT -= dt;
      if (this.blueT <= 0) {
        this.blueT = 35 + R() * 12;
        this.blueShow = 0.7;
        audio.sfx('glitch');
      }
    }
    if (this.blueShow > 0) this.blueShow -= rdt;

    this.updatePlayer(dt);
    this.updateUnits(dt);
    this.updateBullets(dt);
    this.updateHazards(dt);
    this.updatePickups(dt);
    if (this.boss) this.boss.update(dt);
    this.updateSpawns(dt);
    this.checkLockdownEnd();
    this.checkClear(rdt);
    // tutorial special prompt
    if (this.tutorial && this.tutStep === 3 && this.pl.host && this.t > 12) {
      this.tutStep = 4;
      this.showTip(BUDDY_TIPS[4], 6);
    }
    this.units = this.units.filter((u) => !u.dead);
  }

  updatePlayer(dt) {
    const pl = this.pl;
    if (pl.inv > 0) pl.inv -= dt;
    if (pl.ghost > 0) pl.ghost -= dt;
    if (this.dead) return;
    if (pl.mode === 'jumping') {
      const j = pl.jump;
      j.t += dt;
      const tt = clamp(j.t / j.dur, 0, 1);
      const tx = j.target.x;
      const ty = j.target.y;
      const nx = lerp(j.fx, tx, tt);
      const ny = lerp(j.fy, ty, tt);
      for (let i = 0; i < 3; i++) this.parts.spark(lerp(pl.x, nx, i / 3), lerp(pl.y, ny, i / 3), i % 2 ? COLORS.white : COLORS.player, R.range(-30, 30), R.range(-30, 30), 0.25, 3);
      pl.x = nx;
      pl.y = ny;
      if (tt >= 1) this.arrive();
      return;
    }
    let intentPos = { x: this.playerX(), y: this.playerY() };
    let intent = this.moveIntent(intentPos.x, intentPos.y);
    if (hasGlitch(this.run, 'lag')) {
      this.lagQueue.push({ t: this.t, i: intent });
      while (this.lagQueue.length > 1 && this.t - this.lagQueue[1].t > 0.25) this.lagQueue.shift();
      intent = this.t - this.lagQueue[0].t >= 0.25 ? this.lagQueue[0].i : { x: 0, y: 0 };
    }
    if (pl.mode === 'spark') {
      const sp = SPARK_SPEED * (this.run.variant === 'phantom' ? 1.2 : 1);
      pl.vx = intent.x * sp;
      pl.vy = intent.y * sp;
      pl.x += pl.vx * dt;
      pl.y += pl.vy * dt;
      pl.x = clamp(pl.x, this.A.l + 8, this.A.r - 8);
      pl.y = clamp(pl.y, this.A.t + 8, this.A.b - 8);
      const o = this.inObstacle(pl.x, pl.y, 6);
      if (o) this.pushOut(pl, o, 6);
      if (R() < 0.6) this.parts.spark(pl.x, pl.y, COLORS.player, R.range(-40, 40), R.range(-40, 40), 0.3, 2);
      return;
    }
    const h = pl.host;
    if (!h || h.dead) {
      pl.mode = 'spark';
      pl.host = null;
      return;
    }
    // movement
    let ix = intent.x;
    let iy = intent.y;
    if (h.inverted) {
      ix = -ix;
      iy = -iy;
    }
    if (h.st.dash > 0) {
      // handled in unit update
    } else if (h.st.stun > 0 || h.st.frozen > 0) {
      h.vx = h.vy = 0;
    } else {
      const sp = h.speed * (h.st.haste > 0 ? 2 : 1);
      h.vx = ix * sp;
      h.vy = iy * sp;
      if (Math.hypot(ix, iy) > 0.1) h.face = Math.atan2(iy, ix);
    }
    // decay
    if (!this.cleared) {
      h.hp -= h.maxHp * 0.04 * this.decayMul() * dt;
      if (h.hp <= 0) this.killUnit(h, null);
    }
    // tether (GREG phase 3)
  }

  updateUnits(dt) {
    const A = this.A;
    for (const u of this.units) {
      if (u.dead) continue;
      if (u.spawnT > 0) u.spawnT -= dt;
      if (u.hitFlash > 0) u.hitFlash -= dt;
      for (const k in u.st) if (u.st[k] > 0) u.st[k] -= dt;
      if (u.spCd > 0) u.spCd -= dt;
      if (u.atkCd > 0) u.atkCd -= dt;
      if (u.faction === 'ally' && u.allyT !== Infinity) {
        u.allyT -= dt;
        if (u.allyT <= 0) {
          this.crash(u);
          continue;
        }
      }
      u.wobble += dt;
      // quips
      if (u.faction === 'enemy' && !u.isBossPart) {
        u.quipT -= dt;
        if (u.quipT <= 0) {
          if (u.quip) {
            u.quip = null;
            u.quipT = 6 + R() * 10;
          } else {
            u.quip = R.pick(u.def.quips);
            u.quipT = 2.2;
          }
        }
      }
      const frozen = u.st.frozen > 0 || u.st.stun > 0;
      // dash movement
      if (u.st.dash > 0) {
        u.vx = Math.cos(u.dashAng) * 620;
        u.vy = Math.sin(u.dashAng) * 620;
        const team = u.faction === 'enemy' ? 'player' : 'enemy';
        for (const e of this.units) {
          if (e.dead || e === u || u.dashHit.has(e.id)) continue;
          const hostile = team === 'enemy' ? e.faction === 'enemy' : e.faction !== 'enemy';
          if (hostile && dist(u.x, u.y, e.x, e.y) < u.r + e.r + 4) {
            u.dashHit.add(e.id);
            this.damageUnit(e, 15 * (team === 'enemy' ? this.playerDmgMul(u) : u.dmgMul), u);
          }
        }
        if (team === 'player' && this.pl.mode === 'spark' && dist(u.x, u.y, this.pl.x, this.pl.y) < u.r + 8) this.hitSpark();
        if (team === 'enemy' && this.boss && this.boss.hittable() && !u.dashHit.has('boss') && dist(u.x, u.y, this.boss.x, this.boss.y) < u.r + this.boss.r) {
          u.dashHit.add('boss');
          this.boss.hit(15 * this.playerDmgMul(u), u);
        }
        if (R() < 0.8) this.parts.spark(u.x, u.y, u.possessed ? COLORS.player : COLORS.enemy, 0, 0, 0.25, 4);
      } else if (!u.possessed) {
        if (frozen) {
          u.vx *= 0.8;
          u.vy *= 0.8;
        } else this.ai(u, dt);
      }
      // attack
      if (!frozen && u.atkCd <= 0 && !(u.st.dash > 0)) {
        let target = null;
        const at = u.def.attack;
        const range = at.type === 'melee' ? at.range + u.r + 30 : at.range;
        if (u.faction === 'enemy') {
          target = this.enemyTarget(u);
          if (target) {
            const tr = target === this.pl ? 6 : target.r;
            const d = dist(u.x, u.y, target.x, target.y);
            if (at.type === 'melee' ? d > at.range + u.r + tr : d > range) target = null;
          }
        } else {
          target = this.playerTargets(u, range);
          if (target && at.type === 'melee' && dist(u.x, u.y, target.x, target.y) > at.range + u.r + (target.r || 14)) target = null;
        }
        if (target) {
          this.attack(u, target);
          const rateMul = u.possessed ? Math.pow(1.2, has(this.run, 'firerate')) : u.faction === 'enemy' ? R.range(0.8, 1.05) : 1;
          u.atkCd = 1 / (at.rate * rateMul);
        }
      }
      // enemy specials
      if (u.faction === 'enemy' && !frozen && u.spCd <= 0 && ENEMY_SPECIALS.has(u.def.special.id) && !u.isBossPart) {
        const t = this.enemyTarget(u);
        if (t) {
          const d = dist(u.x, u.y, t.x, t.y);
          const id = u.def.special.id;
          const want = (id === 'dash' && d < 220) || (id === 'blast' && d < 260) || (id === 'shield' && u.hp < u.maxHp * 0.8) || (id === 'pursuit' && d > 150) || (id === 'restart' && u.hp < u.maxHp * 0.3) || (id === 'bomb' && d < 160);
          if (want) {
            this.useSpecial(u, false);
            u.spCd = u.def.special.cd * R.range(1.2, 2.0);
          }
        }
      }
      // twin mirrors player host movement
      if (u.twin) {
        if (u.twin.dead || !u.twin.possessed) u.allyT = Math.min(u.allyT, 0.01);
        else {
          u.vx = u.twin.vx;
          u.vy = u.twin.vy;
        }
      }
      // integrate
      u.x += u.vx * dt;
      u.y += u.vy * dt;
      // obstacle & bounds
      if (!u.def.flying) {
        const o = this.inObstacle(u.x, u.y, u.r);
        if (o) this.pushOut(u, o, u.r);
      }
      if (u.x < A.l + u.r) u.x = A.l + u.r;
      if (u.x > A.r - u.r) u.x = A.r - u.r;
      if (u.y < A.t + u.r) u.y = A.t + u.r;
      if (u.y > A.b - u.r) u.y = A.b - u.r;
      // record path (for bombs)
    }
    // separation
    const list = this.units;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.dead || a.def.speed === 0) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.dead) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const rr = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 < rr * rr && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const push = (rr - d) * 0.5;
          const nx = dx / d;
          const ny = dy / d;
          const bm = b.def.speed === 0 ? 0 : 1;
          a.x -= nx * push * (bm ? 1 : 2);
          a.y -= ny * push * (bm ? 1 : 2);
          if (bm) {
            b.x += nx * push;
            b.y += ny * push;
          }
        }
      }
    }
  }

  pushOut(e, o, r) {
    const cx = clamp(e.x, o.x, o.x + o.w);
    const cy = clamp(e.y, o.y, o.y + o.h);
    let dx = e.x - cx;
    let dy = e.y - cy;
    let d = Math.hypot(dx, dy);
    if (d === 0) {
      // inside: push along smallest axis
      const l = e.x - o.x;
      const rr = o.x + o.w - e.x;
      const t = e.y - o.y;
      const b = o.y + o.h - e.y;
      const m = Math.min(l, rr, t, b);
      if (m === l) e.x = o.x - r;
      else if (m === rr) e.x = o.x + o.w + r;
      else if (m === t) e.y = o.y - r;
      else e.y = o.y + o.h + r;
      return;
    }
    if (d < r) {
      e.x = cx + (dx / d) * r;
      e.y = cy + (dy / d) * r;
    }
  }

  ai(u, dt) {
    let target;
    if (u.faction === 'enemy') target = this.enemyTarget(u);
    else target = this.playerTargets(u, 2000);
    const sp = u.speed * (u.st.haste > 0 ? 2 : 1) * (u.greg ? 1.15 : 1);
    if (!target || sp === 0) {
      u.vx *= 0.9;
      u.vy *= 0.9;
      if (target) u.face = angle(u.x, u.y, target.x, target.y);
      return;
    }
    const tx = target.x;
    const ty = target.y;
    const d = dist(u.x, u.y, tx, ty);
    const a = angle(u.x, u.y, tx, ty);
    u.face = a;
    const at = u.def.attack;
    let mx = 0;
    let my = 0;
    const style = u.faction === 'ally' && u.def.ai === 'static' ? 'static' : u.def.ai;
    if (style === 'chase') {
      const stop = at.type === 'melee' ? 0 : at.range * 0.55;
      if (d > stop) {
        mx = Math.cos(a);
        my = Math.sin(a);
      }
    } else if (style === 'kite') {
      const want = at.range * 0.65;
      if (d > want + 30) {
        mx = Math.cos(a);
        my = Math.sin(a);
      } else if (d < want - 30) {
        mx = -Math.cos(a);
        my = -Math.sin(a);
      }
      mx += Math.cos(a + Math.PI / 2) * 0.4 * u.strafeDir;
      my += Math.sin(a + Math.PI / 2) * 0.4 * u.strafeDir;
    } else if (style === 'strafe') {
      const want = at.range * 0.6;
      const radial = d > want + 20 ? 1 : d < want - 20 ? -1 : 0;
      mx = Math.cos(a) * radial + Math.cos(a + Math.PI / 2) * u.strafeDir;
      my = Math.sin(a) * radial + Math.sin(a + Math.PI / 2) * u.strafeDir;
      if (R() < dt * 0.4) u.strafeDir *= -1;
    }
    // wobble
    mx += Math.sin(u.wobble * 1.7) * 0.2;
    my += Math.cos(u.wobble * 1.3) * 0.2;
    const m = Math.hypot(mx, my) || 1;
    const tvx = (mx / m) * sp;
    const tvy = (my / m) * sp;
    u.vx = lerp(u.vx, tvx, Math.min(1, dt * 6));
    u.vy = lerp(u.vy, tvy, Math.min(1, dt * 6));
    // avoid getting stuck on obstacles: simple steer
    if (!u.def.flying) {
      const ahead = this.inObstacle(u.x + u.vx * 0.25, u.y + u.vy * 0.25, u.r);
      if (ahead) {
        const s = u.strafeDir;
        const nvx = -u.vy * s;
        const nvy = u.vx * s;
        u.vx = nvx;
        u.vy = nvy;
      }
    }
  }

  updateBullets(dt) {
    const A = this.A;
    const pl = this.pl;
    const out = [];
    for (const b of this.bullets) {
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.life <= 0 || b.x < A.l - 10 || b.x > A.r + 10 || b.y < A.t - 10 || b.y > A.b + 10) continue;
      if (this.inObstacle(b.x, b.y, 1)) {
        this.parts.burst(b.x, b.y, b.color, 3, 80, 0.2, 2);
        continue;
      }
      let hit = false;
      if (b.team === 'enemy') {
        for (const u of this.units) {
          if (u.dead || u.faction !== 'enemy') continue;
          if (b.hitSet && b.hitSet.has(u.id)) continue;
          if (dist2(b.x, b.y, u.x, u.y) < (u.r + b.r) ** 2) {
            if (u.st.shield > 0) {
              this.parts.burst(b.x, b.y, COLORS.white, 4, 100, 0.2, 2);
              hit = true;
              break;
            }
            this.damageUnit(u, b.dmg, b.src);
            hit = true;
            if (b.bounce > 0) {
              b.bounce--;
              b.hitSet = b.hitSet || new Set();
              b.hitSet.add(u.id);
              const nt = this.nearest(u.x, u.y, (e) => e.faction === 'enemy' && !b.hitSet.has(e.id), 220);
              if (nt) {
                const a = angle(b.x, b.y, nt.x, nt.y);
                const sp = Math.hypot(b.vx, b.vy);
                b.vx = Math.cos(a) * sp;
                b.vy = Math.sin(a) * sp;
                hit = false;
              }
            }
            break;
          }
        }
        if (!hit && this.boss) {
          const bs = this.boss;
          if (bs.spark && bs.spark.active && dist2(b.x, b.y, bs.spark.x, bs.spark.y) < (24 + b.r) ** 2) {
            bs.spark.hit(b.dmg, b.src);
            hit = true;
          } else if (bs.collides && bs.collides(b.x, b.y, b.r)) {
            if (bs.hittable()) bs.hit(b.dmg, b.src);
            else {
              this.parts.burst(b.x, b.y, COLORS.white, 4, 100, 0.2, 2);
              if (R() < 0.1) this.floats.add(b.x, b.y, 'SHIELDED', COLORS.white, 11, 0.5);
            }
            hit = true;
          }
        }
        if (!hit && this.safe && !this.safe.broken && dist2(b.x, b.y, this.safe.x, this.safe.y) < (this.safe.r + b.r) ** 2) {
          this.hitSafe(b.dmg, b.src);
          hit = true;
        }
      } else if (b.team === 'player') {
        // player host
        const h = pl.host;
        if (pl.mode === 'host' && h && !h.dead && dist2(b.x, b.y, h.x, h.y) < (h.r + b.r) ** 2) {
          if (h.st.reflect > 0) {
            b.vx = -b.vx;
            b.vy = -b.vy;
            b.team = 'enemy';
            b.color = COLORS.player;
            b.life = 1.5;
            b.src = h;
            out.push(b);
            continue;
          }
          if (h.st.shield > 0) {
            this.parts.burst(b.x, b.y, COLORS.player, 4, 100, 0.2, 2);
          } else this.damageUnit(h, b.dmg, b.src);
          hit = true;
        } else if (pl.mode === 'spark' && dist2(b.x, b.y, pl.x, pl.y) < (7 + b.r) ** 2) {
          if (pl.inv <= 0) {
            this.hitSpark();
            hit = true;
          }
        } else {
          for (const u of this.units) {
            if (u.dead || u.faction !== 'ally') continue;
            if (dist2(b.x, b.y, u.x, u.y) < (u.r + b.r) ** 2) {
              if (u.st.reflect > 0) {
                b.vx = -b.vx;
                b.vy = -b.vy;
                b.team = 'enemy';
                break;
              }
              this.damageUnit(u, b.dmg, b.src);
              hit = true;
              break;
            }
          }
        }
        // confused enemy bullets: team 'player' bullets also hit enemies if shooter confused
        if (!hit && b.src && b.src.st && b.src.st.confused > 0) {
          for (const u of this.units) {
            if (u.dead || u === b.src || u.faction !== 'enemy') continue;
            if (dist2(b.x, b.y, u.x, u.y) < (u.r + b.r) ** 2) {
              this.damageUnit(u, b.dmg, b.src);
              hit = true;
              break;
            }
          }
        }
      }
      if (hit) {
        this.parts.burst(b.x, b.y, b.color, 4, 90, 0.2, 2);
        continue;
      }
      out.push(b);
    }
    this.bullets = out;
  }

  updateHazards(dt) {
    const pl = this.pl;
    const keep = [];
    for (const h of this.hazards) {
      if (h.kind === 'bomb') {
        h.t -= dt;
        if (h.t <= 0) {
          this.aoe(h.x, h.y, h.r, h.dmg, h.team);
          this.parts.burst(h.x, h.y, h.team === 'enemy' ? COLORS.gold : COLORS.enemy, 18, 260, 0.4);
          audio.sfx('explode');
          this.shake(4);
          continue;
        }
      } else if (h.kind === 'ring') {
        h.rad += h.speed * dt;
        if (h.dmg > 0) {
          for (const u of this.units) {
            if (u.dead || h.hit.has(u.id)) continue;
            const hostile = h.team === 'enemy' ? u.faction === 'enemy' : u.faction !== 'enemy';
            if (!hostile) continue;
            const d = dist(h.x, h.y, u.x, u.y);
            if (Math.abs(d - h.rad) < u.r + 6) {
              h.hit.add(u.id);
              this.damageUnit(u, h.dmg);
            }
          }
          if (h.team === 'player' && pl.mode === 'spark' && !h.hit.has('spark') && Math.abs(dist(h.x, h.y, pl.x, pl.y) - h.rad) < 10) {
            h.hit.add('spark');
            this.hitSpark();
          }
        }
        if (h.rad >= h.max) continue;
      } else if (h.kind === 'fire') {
        h.t -= dt;
        if (h.t <= 0) {
          // detonate
          this.parts.burst(h.x, h.y, COLORS.enemy, 30, 300, 0.5);
          audio.sfx('explode');
          this.shake(6);
          if (pl.mode === 'host' && pl.host && dist(h.x, h.y, pl.host.x, pl.host.y) < h.r + pl.host.r) this.damageUnit(pl.host, h.dmg);
          if (pl.mode === 'spark' && dist(h.x, h.y, pl.x, pl.y) < h.r) this.hitSpark();
          for (const u of this.units) if (!u.dead && u.faction === 'ally' && dist(h.x, h.y, u.x, u.y) < h.r + u.r) this.damageUnit(u, h.dmg);
          if (h.label) this.floats.add(h.x, h.y - 20, h.label, COLORS.enemy, 18, 1);
          continue;
        }
      } else if (h.kind === 'cone' || h.kind === 'flash') {
        h.t -= dt;
        if (h.t <= 0) continue;
      } else if (h.kind === 'strike') {
        h.t -= dt;
        if (h.t <= 0) {
          this.parts.burst(h.x, h.y, COLORS.ally, 30, 300, 0.4);
          audio.sfx('explode');
          this.shake(8);
          if (pl.mode === 'host' && pl.host && dist(h.x, h.y, pl.host.x, pl.host.y) < 40 + pl.host.r) this.damageUnit(pl.host, h.dmg);
          if (pl.mode === 'spark' && dist(h.x, h.y, pl.x, pl.y) < 40) this.hitSpark();
          this.hazards.push({ kind: 'flash', x: h.x, y: h.y, sx: h.sx, sy: h.sy, t: 0.2, max: 0.2 });
          continue;
        }
      }
      keep.push(h);
    }
    this.hazards = keep;
  }

  updatePickups(dt) {
    const px = this.playerX();
    const py = this.playerY();
    const vac = this.cleared;
    const keep = [];
    for (const p of this.pickups) {
      p.t += dt;
      const d = dist(p.x, p.y, px, py);
      if (p.t > 0.35 && (d < 110 || vac)) {
        const a = angle(p.x, p.y, px, py);
        const sp = vac ? 900 : 520;
        p.vx = lerp(p.vx, Math.cos(a) * sp, 0.25);
        p.vy = lerp(p.vy, Math.sin(a) * sp, 0.25);
      } else {
        p.vx *= 0.9;
        p.vy *= 0.9;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.t > 0.35 && d < 18 && this.pl.mode !== 'jumping') {
        this.run.bits++;
        this.run.stats.bitsEarned++;
        audio.sfx('pickup');
        continue;
      }
      if (p.t > 14) continue;
      keep.push(p);
    }
    this.pickups = keep;
  }

  updateSpawns(dt) {
    // spawn portals
    const keep = [];
    for (const s of this.spawnQueue) {
      s.t -= dt;
      if (s.t <= 0) {
        const u = this.makeUnit(s.type, s.x, s.y, s.opts);
        this.parts.burst(s.x, s.y, u.faction === 'enemy' ? COLORS.enemy : COLORS.ally, 14, 180, 0.4);
        if (s.onSpawn) s.onSpawn(u);
        continue;
      }
      keep.push(s);
    }
    this.spawnQueue = keep;
    if (this.cleared || this.dead) return;
    const alive = this.enemies().filter((u) => !u.lockHunter).length;
    if (this.cfg.type === 'vault' && !this.safe.broken) {
      this.timeLeft -= dt;
      this.vaultSpawnT -= dt;
      const hasReq = this.units.some((u) => !u.dead && u.type === this.safe.req && u.faction === 'enemy') || this.spawnQueue.some((s) => s.type === this.safe.req) || (this.pl.host && this.pl.host.type === this.safe.req);
      if (!hasReq) this.queueSpawn(this.safe.req);
      if (this.vaultSpawnT <= 0 && alive < 5) {
        this.vaultSpawnT = 3.5;
        this.queueSpawn(this.rng.pick(LAYER_HOSTS[this.cfg.layer]));
      }
      if (this.timeLeft <= 0) {
        this.safe.broken = true;
        this.vaultLost = true;
        this.showBanner('VAULT LOCKED', 'Too slow. It\'s fine. Everything is fine.', COLORS.trace);
        audio.sfx('deny');
      }
      if (this.waveIdx < this.waves.length) {
        this.waveDelay -= dt;
        if (this.waveDelay <= 0) {
          for (const w of this.waves[this.waveIdx]) this.queueSpawn(w.type, { elite: w.elite });
          this.waveIdx++;
        }
      }
      return;
    }
    if (this.cfg.type === 'boss') return;
    if (this.waveIdx < this.waves.length) {
      const pending = this.spawnQueue.filter((s) => !(s.opts.extra && s.opts.extra.lockHunter)).length;
      if (alive <= 1 && pending === 0) {
        this.waveDelay -= dt;
        if (this.waveDelay <= 0) {
          for (const w of this.waves[this.waveIdx]) this.queueSpawn(w.type, { elite: w.elite });
          this.waveIdx++;
          this.waveDelay = 0.4;
          if (this.waveIdx > 1) this.floats.add(this.W / 2, this.A.t + 30, `WAVE ${this.waveIdx}/${this.waves.length}`, COLORS.dim, 14, 1.2, 0);
        }
      }
    }
  }

  spawnBoss() {
    const id = this.bossId;
    if (id === 'janitor') this.boss = new Janitor(this);
    else if (id === 'hrbot') this.boss = new HRBot(this);
    else if (id === 'oversight') this.boss = new Oversight(this);
    else if (id === 'greg') this.boss = new Greg(this);
    this.showTip(BOSSES[id].tip, 6);
  }

  checkClear(rdt) {
    if (this.dead) return;
    if (this.cleared) {
      this.clearT += rdt;
      if (this.clearT > 2.0 && !this.doneSent && this.pickups.length === 0) {
        this.doneSent = true;
        this.finish();
      } else if (this.clearT > 4 && !this.doneSent) {
        this.doneSent = true;
        this.finish();
      }
      return;
    }
    if (this.lockdown) return;
    if (this.spawnQueue.length) return;
    let done = false;
    if (this.cfg.type === 'boss') done = this.boss && this.boss.dead && this.boss.deathT > 2.2;
    else if (this.cfg.type === 'vault') done = this.safe.broken;
    else done = this.waveIdx >= this.waves.length && this.enemies().length === 0;
    if (done) {
      this.cleared = true;
      this.clearT = 0;
      // despawn leftovers
      for (const u of this.units) if (!u.dead && u.faction === 'enemy') this.crash(u);
      this.run.trace = Math.max(0, this.run.trace - 25);
      audio.sfx('clear');
      if (this.cfg.type !== 'boss') this.showBanner('ROOM CLEAR', R.pick(ROOM_CLEAR_QUIPS), COLORS.player, 2.2);
      if (this.tutorial) this.app.profile.tutorialDone = true;
    }
  }

  finish() {
    this.onDone({ outcome: 'clear', vaultWon: !!this.vaultWon, vaultLost: !!this.vaultLost, type: this.cfg.type });
  }

  // ---------- drawing ----------
  draw(ctx) {
    const W = this.W;
    const H = this.H;
    const A = this.A;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    if (this.shakeAmt > 0) ctx.translate(R.range(-1, 1) * this.shakeAmt, R.range(-1, 1) * this.shakeAmt);
    this.drawArena(ctx);
    if (this.safe) this.drawSafe(ctx);
    for (const h of this.hazards) this.drawHazard(ctx, h, 'under');
    for (const s of this.spawnQueue) this.drawPortal(ctx, s);
    for (const p of this.pickups) {
      ctx.fillStyle = COLORS.gold;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
      ctx.globalAlpha = 0.25;
      ctx.fillRect(p.x - 5, p.y - 5, 10, 10);
      ctx.globalAlpha = 1;
    }
    // jump range ring & targets
    this.drawJumpHints(ctx);
    if (this.boss) this.boss.drawUnder && this.boss.drawUnder(ctx);
    for (const u of this.units) drawUnit(ctx, u, this);
    if (this.boss) this.boss.draw(ctx);
    for (const h of this.hazards) this.drawHazard(ctx, h, 'over');
    this.drawBullets(ctx);
    this.drawPlayer(ctx);
    this.parts.draw(ctx);
    this.floats.draw(ctx);
    ctx.restore();
    // overlays
    if (this.lockdown) {
      ctx.save();
      ctx.globalAlpha = 0.08 + Math.sin(this.t * 6) * 0.05;
      ctx.fillStyle = COLORS.trace;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    if (this.flash > 0) {
      ctx.save();
      ctx.globalAlpha = this.flash * 1.2;
      ctx.fillStyle = '#ff2e6a';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    this.drawHUD(ctx);
    if (this.banner) this.drawBanner(ctx);
    if (this.tip) this.drawTip(ctx);
    if (this.bossIntroT > 0) this.drawBossIntro(ctx);
    if (this.blueShow > 0) this.drawBlueScreen(ctx);
    if (this.dead) {
      ctx.save();
      ctx.globalAlpha = clamp(this.deadT / 2, 0, 0.85);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      if (this.deadT > 0.6) text(ctx, 'SIGNAL LOST', W / 2, H / 2, { size: 44, color: COLORS.enemy, glow: true, weight: 'bold', alpha: clamp((this.deadT - 0.6) * 2, 0, 1) });
    }
  }

  drawArena(ctx) {
    const A = this.A;
    const L = this.layerDef;
    ctx.save();
    ctx.strokeStyle = L.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const off = (this.t * 10) % 40;
    for (let x = A.l; x <= A.r; x += 40) {
      ctx.moveTo(x, A.t);
      ctx.lineTo(x, A.b);
    }
    for (let y = A.t + off; y <= A.b; y += 40) {
      ctx.moveTo(A.l, y);
      ctx.lineTo(A.r, y);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(A.l, A.t, A.r - A.l, A.b - A.t);
    glowStroke(ctx, this.lockdown ? COLORS.trace : L.color, 2, 8);
    ctx.restore();
    for (const o of this.obstacles) {
      ctx.save();
      ctx.fillStyle = '#0b1222';
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.beginPath();
      ctx.rect(o.x, o.y, o.w, o.h);
      glowStroke(ctx, '#3a5a8a', 1.5, 5);
      // blinking LEDs
      const n = Math.floor(Math.max(o.w, o.h) / 18);
      for (let i = 0; i < n; i++) {
        const on = Math.sin(this.t * 3 + i * 1.7 + o.x) > 0.2;
        ctx.fillStyle = on ? (i % 3 === 0 ? COLORS.ally : COLORS.player) : '#1a2840';
        if (o.w > o.h) ctx.fillRect(o.x + 8 + i * 18, o.y + o.h / 2 - 2, 4, 4);
        else ctx.fillRect(o.x + o.w / 2 - 2, o.y + 8 + i * 18, 4, 4);
      }
      ctx.restore();
    }
  }

  drawSafe(ctx) {
    const s = this.safe;
    if (s.broken && this.vaultWon) return;
    ctx.save();
    poly(ctx, s.x, s.y, s.r, 8, this.t * 0.3);
    ctx.fillStyle = '#1a1405';
    ctx.fill();
    glowStroke(ctx, s.broken ? COLORS.dim : COLORS.gold, 3, 8);
    text(ctx, s.broken ? 'X' : '$', s.x, s.y + 1, { size: 26, color: s.broken ? COLORS.dim : COLORS.gold, weight: 'bold' });
    if (!s.broken) {
      // hp bar
      const w = 80;
      ctx.fillStyle = '#332200';
      ctx.fillRect(s.x - w / 2, s.y + s.r + 10, w, 6);
      ctx.fillStyle = COLORS.gold;
      ctx.fillRect(s.x - w / 2, s.y + s.r + 10, (w * s.hp) / s.maxHp, 6);
      text(ctx, `NEEDS: ${HOSTS[s.req].name.toUpperCase()}`, s.x, s.y + s.r + 28, { size: 12, color: COLORS.gold });
      text(ctx, `${Math.ceil(this.timeLeft)}s`, s.x, s.y - s.r - 14, { size: 18, color: this.timeLeft < 10 ? COLORS.trace : COLORS.gold, weight: 'bold' });
    }
    ctx.restore();
  }

  drawPortal(ctx, s) {
    const k = 1 - s.t / 0.8;
    ctx.save();
    const c = s.opts.faction === 'ally' ? COLORS.ally : COLORS.enemy;
    ctx.globalAlpha = 0.4 + k * 0.6;
    glowCircle(ctx, s.x, s.y, 6 + k * 18, c, 2, 0.1);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = this.t * 6 + (i * TAU) / 4;
      ctx.moveTo(s.x + Math.cos(a) * 26 * (1 - k), s.y + Math.sin(a) * 26 * (1 - k));
      ctx.lineTo(s.x + Math.cos(a) * 34 * (1 - k), s.y + Math.sin(a) * 34 * (1 - k));
    }
    ctx.strokeStyle = c;
    ctx.stroke();
    ctx.restore();
  }

  drawJumpHints(ctx) {
    const pl = this.pl;
    if (this.dead || this.cleared || pl.mode === 'jumping') return;
    const px = this.playerX();
    const py = this.playerY();
    const r = this.jumpRange();
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.setLineDash([6, 10]);
    ctx.beginPath();
    ctx.arc(px, py, r, 0, TAU);
    ctx.strokeStyle = COLORS.player;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    for (const u of this.units) {
      if (!this.canPossess(u)) continue;
      if (dist(px, py, u.x, u.y) > r + u.r) continue;
      const weak = u.hp < u.maxHp * 0.5 || this.run.variant === 'rootkit';
      ctx.save();
      ctx.globalAlpha = 0.55 + Math.sin(this.t * 8) * 0.2;
      const rr = u.r + 7;
      ctx.strokeStyle = weak ? COLORS.player : '#6fa8c0';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const a = (i * TAU) / 4 + Math.PI / 4 + this.t * 1.5;
        ctx.beginPath();
        ctx.arc(u.x, u.y, rr, a - 0.3, a + 0.3);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawHazard(ctx, h, layer) {
    ctx.save();
    if (h.kind === 'bomb' && layer === 'under') {
      const k = clamp(1 - h.t / 0.9, 0, 1);
      ctx.globalAlpha = 0.25 + k * 0.4;
      glowCircle(ctx, h.x, h.y, h.r * (0.3 + k * 0.7), h.team === 'enemy' ? COLORS.gold : COLORS.enemy, 1.5, 0.15);
    } else if (h.kind === 'ring' && layer === 'over') {
      ctx.globalAlpha = clamp(1 - h.rad / h.max, 0, 1);
      glowCircle(ctx, h.x, h.y, h.rad, h.color || COLORS.greg, 3, 0);
    } else if (h.kind === 'fire' && layer === 'under') {
      const k = clamp(1 - h.t / h.max, 0, 1);
      ctx.globalAlpha = 0.5;
      glowCircle(ctx, h.x, h.y, h.r, COLORS.enemy, 2, 0.08 + k * 0.25);
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r * k, 0, TAU);
      ctx.fillStyle = COLORS.enemy;
      ctx.globalAlpha = 0.25;
      ctx.fill();
      if (h.label) text(ctx, h.label, h.x, h.y, { size: 13, color: COLORS.enemy, alpha: 0.9, weight: 'bold' });
    } else if (h.kind === 'cone' && layer === 'over') {
      ctx.globalAlpha = (h.t / h.max) * 0.35;
      ctx.beginPath();
      ctx.moveTo(h.x, h.y);
      ctx.arc(h.x, h.y, h.r, h.a - h.w / 2, h.a + h.w / 2);
      ctx.closePath();
      ctx.fillStyle = h.color;
      ctx.fill();
    } else if (h.kind === 'strike' && layer === 'over') {
      const k = clamp(1 - h.t / h.max, 0, 1);
      ctx.globalAlpha = 0.3 + 0.5 * k;
      ctx.beginPath();
      ctx.moveTo(h.sx, h.sy);
      ctx.lineTo(h.x, h.y);
      ctx.setLineDash([8, 8]);
      ctx.strokeStyle = COLORS.ally;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
      glowCircle(ctx, h.x, h.y, 40, COLORS.ally, 2, 0.1 + k * 0.2);
    } else if (h.kind === 'flash' && layer === 'over') {
      ctx.globalAlpha = h.t / h.max;
      ctx.beginPath();
      ctx.moveTo(h.sx, h.sy);
      ctx.lineTo(h.x, h.y);
      glowStroke(ctx, COLORS.ally, 8, 16);
    }
    ctx.restore();
  }

  drawBullets(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.bullets) {
      ctx.fillStyle = b.color;
      if (b.laser) {
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - b.vx * 0.03, b.y - b.vy * 0.03);
        ctx.stroke();
        continue;
      }
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 3, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  drawPlayer(ctx) {
    const pl = this.pl;
    if (this.dead) return;
    if (pl.mode === 'host' && pl.host) {
      const h = pl.host;
      // host decor: cyan halo + crown spark
      ctx.save();
      ctx.globalAlpha = 0.25 + Math.sin(this.t * 5) * 0.1;
      glowCircle(ctx, h.x, h.y, h.r + 10, COLORS.player, 1, 0);
      ctx.restore();
      if (h.st.shield > 0) {
        ctx.save();
        ctx.globalAlpha = 0.6;
        poly(ctx, h.x, h.y, h.r + 14, 6, this.t);
        glowStroke(ctx, COLORS.white, 2, 6);
        ctx.restore();
      }
      if (h.st.reflect > 0) {
        ctx.save();
        ctx.globalAlpha = 0.6;
        glowCircle(ctx, h.x, h.y, h.r + 12, COLORS.purple, 2, 0.1);
        ctx.restore();
      }
      if (h.st.hidden > 0) {
        text(ctx, 'HIDDEN', h.x, h.y - h.r - 16, { size: 11, color: COLORS.dim });
      }
      return;
    }
    if (pl.mode === 'spark' || pl.mode === 'jumping') {
      const blink = pl.inv > 0 && Math.floor(this.t * 20) % 2 === 0;
      if (blink && pl.mode === 'spark') return;
      ctx.save();
      if (pl.ghost > 0) ctx.globalAlpha = 0.35;
      // NULL is a loading spinner. It spins faster mid-jump.
      drawNull(ctx, pl.x, pl.y, 12, this.t, pl.mode === 'jumping' ? 3 : 1.2);
      if (pl.mode === 'spark') {
        ctx.globalAlpha *= 0.5;
        glowCircle(ctx, pl.x, pl.y, 18 + Math.sin(this.t * 4) * 2, COLORS.player, 1, 0);
      }
      ctx.restore();
    }
  }

  drawHUD(ctx) {
    const W = this.W;
    const H = this.H;
    const run = this.run;
    // top bar
    ctx.save();
    ctx.fillStyle = 'rgba(5,6,12,0.85)';
    ctx.fillRect(0, 0, W, this.A.t - 4);
    // pips
    for (let i = 0; i < run.maxPips; i++) {
      const x = 22 + i * 24;
      const y = 26;
      poly(ctx, x, y, 9, 4, Math.PI / 4);
      if (i < run.pips) {
        ctx.fillStyle = COLORS.player;
        ctx.fill();
        glowStroke(ctx, COLORS.player, 1.5, 5);
      } else glowStroke(ctx, COLORS.dim, 1.5, 0);
    }
    // bits
    text(ctx, `◆ ${run.bits}`, 22 + run.maxPips * 24 + 16, 27, { size: 18, color: COLORS.gold, align: 'left', weight: 'bold' });
    // layer/room
    const L = this.layerDef;
    text(ctx, `L${this.cfg.layer} · ${L.name}`, W - 60, 22, { size: 12, color: L.color, align: 'right' });
    text(ctx, roomLabel(this.cfg.type), W - 60, 38, { size: 11, color: COLORS.dim, align: 'right' });
    // pause button
    const b = this.buttons();
    glowCircle(ctx, b.pause.x, b.pause.y, b.pause.r, COLORS.dim, 1.5, 0.1);
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(b.pause.x - 6, b.pause.y - 7, 4, 14);
    ctx.fillRect(b.pause.x + 2, b.pause.y - 7, 4, 14);
    // trace bar
    const tx = 14;
    const ty = 52;
    const tw = W - 28;
    const th = 14;
    const k = clamp(run.trace / run.traceMax, 0, 1);
    ctx.fillStyle = '#1a0a10';
    roundRect(ctx, tx, ty, tw, th, 4);
    ctx.fill();
    const col = this.lockdown ? (Math.floor(this.t * 6) % 2 ? COLORS.trace : COLORS.white) : k > 0.75 ? COLORS.trace : k > 0.4 ? '#ff7a45' : '#c45a7a';
    ctx.fillStyle = col;
    roundRect(ctx, tx, ty, Math.max(6, tw * k), th, 4);
    ctx.fill();
    text(ctx, this.lockdown ? '!! LOCKDOWN !!' : `TRACE ${Math.floor(run.trace)}/${run.traceMax}`, W / 2, ty + th / 2 + 1, { size: 11, color: COLORS.white, weight: 'bold' });
    // glitch tags
    if (run.glitches.length) {
      let gx = 14;
      for (const g of run.glitches) {
        const nm = GLITCHES[g].name;
        const jx = R() < 0.05 ? R.range(-3, 3) : 0;
        text(ctx, `[${nm}]`, gx + jx, 80, { size: 10, color: COLORS.purple, align: 'left' });
        gx += nm.length * 6.5 + 18;
      }
    }
    ctx.restore();
    // boss bar
    if (this.boss && !this.boss.dead) this.drawBossBar(ctx);
    // bottom HUD
    const by = this.A.b + 6;
    ctx.save();
    ctx.fillStyle = 'rgba(5,6,12,0.85)';
    ctx.fillRect(0, by, W, H - by);
    const pl = this.pl;
    const left = this.app.profile.settings.leftHanded;
    const ix = left ? 150 : 20;
    const iw = W - 170;
    if (pl.mode === 'host' && pl.host) {
      const h = pl.host;
      text(ctx, h.def.name.toUpperCase() + (h.elite ? ' ★' : ''), ix, by + 26, { size: 18, color: COLORS.player, align: 'left', weight: 'bold' });
      text(ctx, 'INTEGRITY', ix, by + 50, { size: 11, color: COLORS.dim, align: 'left' });
      const hk = clamp(h.hp / h.maxHp, 0, 1);
      ctx.fillStyle = '#08202a';
      roundRect(ctx, ix, by + 60, iw, 14, 4);
      ctx.fill();
      ctx.fillStyle = hk < 0.25 ? (Math.floor(this.t * 8) % 2 ? COLORS.trace : COLORS.player) : COLORS.player;
      roundRect(ctx, ix, by + 60, Math.max(4, iw * hk), 14, 4);
      ctx.fill();
      text(ctx, h.def.special.desc, ix, by + 96, { size: 11, color: COLORS.dim, align: 'left' });
      // special button
      const sb = b.special;
      const ready = h.spCd <= 0 && !(h.def.special.id === 'restart' && h.restarted);
      glowCircle(ctx, sb.x, sb.y, sb.r, ready ? COLORS.gold : COLORS.dim, 3, ready ? 0.2 : 0.06);
      if (!ready && h.spCd < 900) {
        const frac = clamp(h.spCd / h.def.special.cd, 0, 1);
        ctx.beginPath();
        ctx.moveTo(sb.x, sb.y);
        ctx.arc(sb.x, sb.y, sb.r - 4, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
        ctx.closePath();
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fill();
      }
      const nm = h.def.special.name;
      text(ctx, nm.length > 9 ? nm.split(' ')[0] : nm, sb.x, sb.y - 4, { size: nm.length > 7 ? 12 : 14, color: ready ? COLORS.gold : COLORS.dim, weight: 'bold' });
      text(ctx, ready ? 'SPECIAL' : h.def.special.id === 'restart' && h.restarted ? 'USED' : `${Math.ceil(h.spCd)}s`, sb.x, sb.y + 14, { size: 10, color: ready ? COLORS.gold : COLORS.dim });
    } else {
      const msg = pl.mode === 'jumping' ? 'JUMPING...' : 'NO HOST - YOU ARE A SPARK';
      text(ctx, msg, ix, by + 26, { size: 16, color: pl.mode === 'jumping' ? COLORS.player : COLORS.trace, align: 'left', weight: 'bold' });
      text(ctx, this.app.profile.settings.controls === 'tap' ? 'Tap an enemy in range to hijack it.' : 'Tap or flick toward an enemy to hijack it.', ix, by + 52, { size: 12, color: COLORS.dim, align: 'left' });
      text(ctx, 'One hit costs a Core pip.', ix, by + 72, { size: 12, color: COLORS.dim, align: 'left' });
    }
    // crash button
    if (hasGlitch(this.run, 'bluescreen')) {
      const cb = b.crash;
      const ok = !this.crashUsed;
      glowCircle(ctx, cb.x, cb.y, cb.r, ok ? '#4d7bff' : COLORS.dim, 2, ok ? 0.2 : 0.05);
      text(ctx, ':(', cb.x, cb.y - 3, { size: 16, color: ok ? '#4d7bff' : COLORS.dim, weight: 'bold' });
      text(ctx, 'CRASH', cb.x, cb.y + 13, { size: 9, color: ok ? '#4d7bff' : COLORS.dim });
    }
    ctx.restore();
    // drag joystick visual
    const mv = this.move;
    if (mv.joy && this.app.profile.settings.controls === 'drag') {
      ctx.save();
      ctx.globalAlpha = 0.35;
      glowCircle(ctx, mv.joy.ox, mv.joy.oy, 60, COLORS.player, 1.5, 0.05);
      glowCircle(ctx, mv.joy.ox + mv.joy.dx * 60, mv.joy.oy + mv.joy.dy * 60, 20, COLORS.player, 2, 0.3);
      ctx.restore();
    } else if (mv.target && this.app.profile.settings.controls === 'tap' && this.pl.mode !== 'jumping') {
      ctx.save();
      ctx.globalAlpha = 0.35;
      glowCircle(ctx, mv.target.x, mv.target.y, 8 + Math.sin(this.t * 10) * 2, COLORS.player, 1.5, 0);
      ctx.restore();
    }
  }

  drawBossBar(ctx) {
    const b = this.boss;
    const W = this.W;
    const y = this.A.t + 8;
    const w = W - 80;
    ctx.save();
    text(ctx, b.name, W / 2, y + 4, { size: 13, color: b.color || COLORS.enemy, weight: 'bold' });
    ctx.fillStyle = '#200810';
    roundRect(ctx, 40, y + 14, w, 9, 3);
    ctx.fill();
    ctx.fillStyle = b.hittable() ? b.color || COLORS.enemy : COLORS.dim;
    roundRect(ctx, 40, y + 14, Math.max(3, (w * Math.max(0, b.hp)) / b.maxHp), 9, 3);
    ctx.fill();
    if (b.phaseMarks) for (const m of b.phaseMarks) {
      ctx.fillStyle = COLORS.white;
      ctx.fillRect(40 + w * m - 1, y + 12, 2, 13);
    }
    if (!b.hittable() && b.shieldText) text(ctx, b.shieldText, W / 2, y + 34, { size: 11, color: COLORS.white });
    ctx.restore();
  }

  drawBanner(ctx) {
    const b = this.banner;
    const k = b.t / b.max;
    const a = k > 0.85 ? (1 - k) / 0.15 : k < 0.2 ? k / 0.2 : 1;
    const y = this.A.t + (this.A.b - this.A.t) * 0.32;
    ctx.save();
    ctx.globalAlpha = a * 0.75;
    ctx.fillStyle = '#05060c';
    ctx.fillRect(0, y - 40, this.W, b.sub ? 84 : 64);
    ctx.restore();
    text(ctx, b.text, this.W / 2, y - 8, { size: 36, color: b.color, weight: 'bold', glow: true, alpha: a });
    if (b.sub) {
      const lines = wrap(ctx, b.sub, this.W - 60, 14);
      lines.forEach((l, i) => text(ctx, l, this.W / 2, y + 24 + i * 16, { size: 14, color: COLORS.white, alpha: a }));
    }
  }

  drawTip(ctx) {
    const t = this.tip;
    const a = Math.min(1, t.t * 2, (t.max - t.t) * 4);
    const lines = wrap(ctx, t.text, this.W - 60, 15);
    const h = lines.length * 19 + 20;
    const y = this.A.b - h - 14;
    ctx.save();
    ctx.globalAlpha = a * 0.9;
    roundRect(ctx, 16, y, this.W - 32, h, 8);
    ctx.fillStyle = '#0a1426';
    ctx.fill();
    glowStroke(ctx, COLORS.ally, 1.5, 4);
    ctx.restore();
    lines.forEach((l, i) => text(ctx, l, 30, y + 20 + i * 19, { size: 15, color: COLORS.ally, align: 'left', alpha: a }));
  }

  drawBossIntro(ctx) {
    const B = BOSSES[this.bossId];
    const k = 1 - this.bossIntroT / 2.6;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.restore();
    const cy = this.H * 0.42;
    const x = this.W / 2 + (k < 0.15 ? (1 - k / 0.15) * 300 : 0);
    text(ctx, 'WARNING: BOSS PROCESS', this.W / 2, cy - 70, { size: 14, color: COLORS.trace, alpha: Math.floor(k * 12) % 2 ? 1 : 0.4 });
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, cy - 40, this.W, 80);
    ctx.fillStyle = '#12040a';
    ctx.fill();
    ctx.restore();
    text(ctx, B.name, x, cy - 6, { size: 42, color: BOSSCOLOR[this.bossId], weight: 'bold', glow: true });
    text(ctx, B.title, x, cy + 26, { size: 13, color: COLORS.dim });
    const lines = wrap(ctx, `"${B.intro}"`, this.W - 70, 16);
    lines.forEach((l, i) => text(ctx, l, this.W / 2, cy + 80 + i * 20, { size: 16, color: COLORS.white, alpha: clamp((k - 0.3) * 3, 0, 1) }));
  }

  drawBlueScreen(ctx) {
    ctx.save();
    ctx.fillStyle = '#1f3fbf';
    ctx.globalAlpha = 0.92;
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.globalAlpha = 1;
    text(ctx, ':(', 50, this.H * 0.3, { size: 80, color: '#fff', align: 'left' });
    const lines = wrap(ctx, 'Your PC ran into a problem and needs to restart. We\'re just collecting some error info, and then we\'ll ignore it.', this.W - 100, 18);
    lines.forEach((l, i) => text(ctx, l, 50, this.H * 0.42 + i * 24, { size: 18, color: '#fff', align: 'left' }));
    ctx.restore();
  }
}

export function roomLabel(type) {
  return { combat: 'COMBAT', elite: 'ELITE', vault: 'VAULT', boss: 'BOSS', shop: 'BLACK MARKET', cooldown: 'COOLDOWN', event: 'CORRUPTED SECTOR' }[type] || type.toUpperCase();
}

const BOSSCOLOR = { janitor: '#ffd84d', hrbot: '#ff5ad1', oversight: '#4dff8a', greg: '#ff9a1f' };

// =====================================================================
// Unit drawing
// =====================================================================
export function drawUnit(ctx, u, g) {
  const t = g ? g.t : performance.now() / 1000;
  let col = u.faction === 'enemy' ? (u.elite ? COLORS.gold : COLORS.enemy) : u.faction === 'ally' ? COLORS.ally : COLORS.player;
  if (u.greg) col = COLORS.greg;
  if (u.hitFlash > 0) col = COLORS.white;
  let x = u.x;
  let y = u.y;
  if (u.possessed && g && hasGlitch(g.run, 'bodyhorror')) {
    x += R.range(-2, 2);
    y += R.range(-2, 2);
  }
  ctx.save();
  if (u.spawnT > 0) ctx.globalAlpha = 1 - u.spawnT / 0.25;
  if (u.st.hidden > 0 && !u.possessed) ctx.globalAlpha *= 0.3;
  if (u.faction === 'ally' && u.allyT !== Infinity && u.allyT < 1) ctx.globalAlpha *= 0.4 + 0.6 * (Math.floor(t * 10) % 2);
  drawShape(ctx, u.def.shape, x, y, u.r, col, u.face, t, u);
  if (u.greg) drawGreg(ctx, x, y + u.r * 0.9, u.r * 0.55, t);
  // statuses
  if (u.st.frozen > 0) {
    ctx.globalAlpha = 0.6;
    poly(ctx, x, y, u.r + 6, 6, 0);
    glowStroke(ctx, '#9fd8ff', 1.5, 4);
    ctx.globalAlpha = 1;
  }
  if (u.st.confused > 0) text(ctx, '?', x + Math.sin(t * 6) * 6, y - u.r - 12, { size: 16, color: COLORS.gold, weight: 'bold' });
  if (u.st.marked > 0) {
    ctx.strokeStyle = COLORS.trace;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, u.r + 9, 0, TAU);
    ctx.moveTo(x - u.r - 14, y);
    ctx.lineTo(x - u.r - 4, y);
    ctx.moveTo(x + u.r + 4, y);
    ctx.lineTo(x + u.r + 14, y);
    ctx.stroke();
  }
  if (u.st.shield > 0 && !u.possessed) {
    ctx.globalAlpha = 0.6;
    poly(ctx, x, y, u.r + 10, 6, t);
    glowStroke(ctx, COLORS.white, 1.5, 4);
    ctx.globalAlpha = 1;
  }
  if (u.st.stun > 0) text(ctx, 'zzz', x, y - u.r - 12, { size: 12, color: COLORS.white });
  if (u.elite && u.faction === 'enemy') text(ctx, '★', x, y - u.r - 10, { size: 14, color: COLORS.gold });
  // hp bar for enemies if damaged
  if (!u.possessed && u.hp < u.maxHp && u.faction !== 'player') {
    const w = u.r * 2;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#300';
    ctx.fillRect(x - w / 2, y + u.r + 6, w, 3);
    ctx.fillStyle = u.hp < u.maxHp * 0.5 ? COLORS.player : col;
    ctx.fillRect(x - w / 2, y + u.r + 6, (w * Math.max(0, u.hp)) / u.maxHp, 3);
    ctx.globalAlpha = 1;
  }
  if (u.quip && u.faction === 'enemy') {
    text(ctx, u.quip, x, y - u.r - (u.elite ? 26 : 14), { size: 11, color: u.greg ? COLORS.greg : '#ff9ab8', alpha: 0.9 });
  }
  if (u.quip && u.faction === 'ally') text(ctx, u.quip, x, y - u.r - 14, { size: 11, color: COLORS.ally, alpha: 0.9 });
  ctx.restore();
}

export function drawShape(ctx, shape, x, y, r, col, face, t, u = null) {
  ctx.save();
  ctx.lineJoin = 'round';
  const fill = (a = 0.15) => {
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.fillStyle = col;
    ctx.fill();
    ctx.restore();
  };
  switch (shape) {
    case 'crawler': {
      poly(ctx, x, y, r, 3, face, 0.55);
      fill();
      glowStroke(ctx, col, 2);
      // legs
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = face + Math.PI / 2 + (i - 1) * 0.6;
        const w = Math.sin(t * 20 + i) * 3;
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * (r + 6 + w), y + Math.sin(a) * (r + 6 + w));
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a + Math.PI) * (r + 6 - w), y + Math.sin(a + Math.PI) * (r + 6 - w));
      }
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
    }
    case 'spambot': {
      poly(ctx, x, y, r, 4, t * 0.8);
      fill();
      glowStroke(ctx, col, 2);
      text(ctx, '$', x, y + 1, { size: r * 1.1, color: col, weight: 'bold' });
      break;
    }
    case 'firewall': {
      poly(ctx, x, y, r, 6, Math.PI / 6);
      fill(0.2);
      glowStroke(ctx, col, 2.5);
      ctx.beginPath();
      for (let i = -1; i <= 1; i++) {
        const fx = x + i * r * 0.4;
        const fh = r * 0.5 + Math.sin(t * 12 + i * 2) * 4;
        ctx.moveTo(fx - 4, y + r * 0.3);
        ctx.quadraticCurveTo(fx, y + r * 0.3 - fh, fx + 4, y + r * 0.3);
      }
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      break;
    }
    case 'spooler': {
      ctx.beginPath();
      ctx.rect(x - r, y - r * 0.7, r * 2, r * 1.4);
      fill();
      glowStroke(ctx, col, 2);
      const paper = 4 + ((t * 20) % 14);
      ctx.beginPath();
      ctx.rect(x - r * 0.55, y + r * 0.7, r * 1.1, paper);
      ctx.strokeStyle = COLORS.white;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - r * 0.6, y - r * 0.2);
      ctx.lineTo(x + r * 0.6, y - r * 0.2);
      ctx.strokeStyle = col;
      ctx.stroke();
      break;
    }
    case 'trashbin': {
      ctx.beginPath();
      ctx.moveTo(x - r * 0.8, y - r * 0.6);
      ctx.lineTo(x + r * 0.8, y - r * 0.6);
      ctx.lineTo(x + r * 0.6, y + r);
      ctx.lineTo(x - r * 0.6, y + r);
      ctx.closePath();
      fill();
      glowStroke(ctx, col, 2);
      ctx.beginPath();
      const lid = Math.sin(t * 4) * 0.2;
      ctx.moveTo(x - r, y - r * 0.8 + lid * 10);
      ctx.lineTo(x + r, y - r * 0.8 - lid * 10);
      glowStroke(ctx, col, 2);
      break;
    }
    case 'email': {
      ctx.beginPath();
      ctx.rect(x - r, y - r * 0.65, r * 2, r * 1.3);
      fill();
      glowStroke(ctx, col, 2);
      ctx.beginPath();
      ctx.moveTo(x - r, y - r * 0.65);
      ctx.lineTo(x, y + r * 0.1);
      ctx.lineTo(x + r, y - r * 0.65);
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      break;
    }
    case 'calendar': {
      ctx.beginPath();
      ctx.rect(x - r * 0.85, y - r * 0.75, r * 1.7, r * 1.6);
      fill();
      glowStroke(ctx, col, 2);
      ctx.beginPath();
      ctx.moveTo(x - r * 0.85, y - r * 0.3);
      ctx.lineTo(x + r * 0.85, y - r * 0.3);
      ctx.moveTo(x - r * 0.4, y - r * 1.0);
      ctx.lineTo(x - r * 0.4, y - r * 0.55);
      ctx.moveTo(x + r * 0.4, y - r * 1.0);
      ctx.lineTo(x + r * 0.4, y - r * 0.55);
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      text(ctx, '31', x, y + r * 0.3, { size: r * 0.75, color: col });
      break;
    }
    case 'captcha': {
      ctx.beginPath();
      ctx.rect(x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6);
      fill();
      glowStroke(ctx, col, 2);
      ctx.beginPath();
      ctx.moveTo(x - r * 0.4, y);
      ctx.lineTo(x - r * 0.05, y + r * 0.35);
      ctx.lineTo(x + r * 0.5, y - r * 0.4);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      break;
    }
    case 'updater': {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      fill();
      glowStroke(ctx, col, 2);
      ctx.beginPath();
      const a0 = t * 4;
      ctx.arc(x, y, r * 0.55, a0, a0 + 4.5);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.stroke();
      const ax = x + Math.cos(a0 + 4.5) * r * 0.55;
      const ay = y + Math.sin(a0 + 4.5) * r * 0.55;
      poly(ctx, ax, ay, 4, 3, a0 + 4.5 + Math.PI / 2);
      ctx.fillStyle = col;
      ctx.fill();
      break;
    }
    case 'employee': {
      ctx.beginPath();
      ctx.arc(x, y - r * 0.45, r * 0.42, 0, TAU);
      fill();
      glowStroke(ctx, col, 2);
      ctx.beginPath();
      ctx.moveTo(x - r * 0.7, y + r * 0.9);
      ctx.lineTo(x - r * 0.5, y + r * 0.05);
      ctx.lineTo(x + r * 0.5, y + r * 0.05);
      ctx.lineTo(x + r * 0.7, y + r * 0.9);
      ctx.closePath();
      fill();
      glowStroke(ctx, col, 2);
      ctx.beginPath();
      ctx.moveTo(x, y + r * 0.05);
      ctx.lineTo(x - 3, y + r * 0.5);
      ctx.lineTo(x, y + r * 0.7);
      ctx.lineTo(x + 3, y + r * 0.5);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
      break;
    }
    case 'camera': {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      fill(0.1);
      glowStroke(ctx, col, 2);
      ctx.beginPath();
      ctx.arc(x + Math.cos(face) * r * 0.35, y + Math.sin(face) * r * 0.35, r * 0.4, 0, TAU);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + Math.cos(face) * r * 0.45, y + Math.sin(face) * r * 0.45, r * 0.13, 0, TAU);
      ctx.fillStyle = '#000';
      ctx.fill();
      break;
    }
    case 'drone': {
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i * TAU) / 4;
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      glowStroke(ctx, col, 2);
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i * TAU) / 4;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * r, y + Math.sin(a) * r, 7, 2.5, t * 30 + i, 0, TAU);
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(x, y, r * 0.35, 0, TAU);
      ctx.fillStyle = col;
      ctx.fill();
      break;
    }
    case 'facerec': {
      const s = r * 0.9;
      ctx.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        ctx.moveTo(x + sx * s, y + sy * s * 0.4);
        ctx.lineTo(x + sx * s, y + sy * s);
        ctx.lineTo(x + sx * s * 0.4, y + sy * s);
      }
      glowStroke(ctx, col, 2);
      ctx.fillStyle = col;
      ctx.fillRect(x - r * 0.35, y - r * 0.25, 4, 4);
      ctx.fillRect(x + r * 0.35 - 4, y - r * 0.25, 4, 4);
      ctx.beginPath();
      ctx.arc(x, y + r * 0.1, r * 0.3, 0.3, Math.PI - 0.3);
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // scan line
      const sy = y + Math.sin(t * 4) * s;
      ctx.beginPath();
      ctx.moveTo(x - s, sy);
      ctx.lineTo(x + s, sy);
      ctx.globalAlpha *= 0.5;
      ctx.stroke();
      break;
    }
    case 'hunter': {
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(face) * r * 1.3, y + Math.sin(face) * r * 1.3);
      ctx.lineTo(x + Math.cos(face + 2.5) * r, y + Math.sin(face + 2.5) * r);
      ctx.lineTo(x + Math.cos(face + Math.PI) * r * 0.3, y + Math.sin(face + Math.PI) * r * 0.3);
      ctx.lineTo(x + Math.cos(face - 2.5) * r, y + Math.sin(face - 2.5) * r);
      ctx.closePath();
      fill(0.25);
      glowStroke(ctx, col, 2.5);
      break;
    }
    case 'admin': {
      poly(ctx, x, y, r, 6, 0);
      fill();
      glowStroke(ctx, col, 2);
      text(ctx, '#', x, y + 1, { size: r * 1.1, color: col, weight: 'bold' });
      break;
    }
    case 'mirror': {
      poly(ctx, x, y, r, 4, 0);
      fill();
      glowStroke(ctx, col, 2);
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x, y + r);
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.save();
      ctx.globalAlpha *= 0.5;
      poly(ctx, x, y, r * 0.5, 4, t);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'quantum': {
      const o = Math.sin(t * 5) * r * 0.45;
      ctx.beginPath();
      ctx.arc(x - o, y, r * 0.7, 0, TAU);
      fill(0.1);
      glowStroke(ctx, col, 1.5);
      ctx.beginPath();
      ctx.arc(x + o, y, r * 0.7, 0, TAU);
      fill(0.1);
      glowStroke(ctx, COLORS.purple, 1.5);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, TAU);
      ctx.fillStyle = COLORS.white;
      ctx.fill();
      break;
    }
    case 'manager': {
      ctx.beginPath();
      ctx.rect(x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6);
      fill();
      glowStroke(ctx, col, 2);
      ctx.beginPath();
      ctx.moveTo(x, y - r * 0.8);
      ctx.lineTo(x - 4, y);
      ctx.lineTo(x, y + r * 0.5);
      ctx.lineTo(x + 4, y);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
      // briefcase
      ctx.beginPath();
      ctx.rect(x + r * 0.9, y + r * 0.2, r * 0.6, r * 0.45);
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      break;
    }
    default: {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      fill();
      glowStroke(ctx, col, 2);
    }
  }
  ctx.restore();
}

// =====================================================================
// Bosses
// =====================================================================
class BossBase {
  constructor(g, id) {
    this.g = g;
    this.id = id;
    this.kind = 'boss';
    const B = BOSSES[id];
    this.name = B.name;
    this.maxHp = B.hp * (1 + 0.08 * g.cl);
    this.hp = this.maxHp;
    this.dead = false;
    this.deathT = 0;
    this.t = 0;
    this.hitFlash = 0;
    this.quipT = 4;
    this.quip = null;
    this.color = BOSSCOLOR[id];
  }
  hittable() {
    return !this.dead;
  }
  collides(x, y, r) {
    return !this.dead && dist2(x, y, this.x, this.y) < (this.r + r) ** 2;
  }
  hit(dmg, src) {
    if (this.dead || !this.hittable()) return;
    this.hp -= dmg;
    this.hitFlash = 0.08;
    const g = this.g;
    if (g.app.profile.settings.damageNumbers) g.floats.add(this.x + R.range(-20, 20), this.y - this.r - 8, Math.round(dmg).toString(), COLORS.white, 14, 0.6, -60);
    audio.sfx('hit');
    if (this.hp <= 0) this.die();
  }
  die() {
    this.dead = true;
    this.deathT = 0;
    const g = this.g;
    audio.sfx('bigexplode');
    g.shake(16);
    g.parts.burst(this.x, this.y, this.color, 90, 450, 1.4, 5);
    g.parts.burst(this.x, this.y, COLORS.white, 40, 300, 1.0, 3);
    g.run.stats.bosses++;
    g.app.profile.stats.bossKills++;
    for (let i = 0; i < 40; i++) g.pickups.push({ x: this.x, y: this.y, vx: R.range(-300, 300), vy: R.range(-300, 300), t: 0 });
    g.showBanner(`${this.name} DELETED`, this.deathLine || '', this.color, 2.4);
    for (const u of g.units) if (!u.dead && u.faction === 'enemy') g.crash(u);
  }
  baseUpdate(dt) {
    this.t += dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.dead) {
      this.deathT += dt;
      if (R() < 0.5) this.g.parts.burst(this.x + R.range(-40, 40), this.y + R.range(-40, 40), this.color, 6, 200, 0.5);
      return false;
    }
    this.quipT -= dt;
    if (this.quipT <= 0) {
      if (this.quip) {
        this.quip = null;
        this.quipT = 5 + R() * 5;
      } else {
        this.quip = R.pick(BOSSES[this.id].quips);
        this.quipT = 2.5;
      }
    }
    return true;
  }
  drawQuip(ctx) {
    if (this.quip && !this.dead) text(ctx, this.quip, this.x, this.y - this.r - 18, { size: 13, color: this.color, alpha: 0.95 });
  }
  targetPos() {
    const g = this.g;
    return { x: g.playerX(), y: g.playerY() };
  }
  shootAt(x, y, a, dmg, speed, color, size = 5) {
    const g = this.g;
    g.bullets.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, dmg: dmg * (1 + 0.04 * g.cl), team: 'player', r: size, life: 3, color, bounce: 0, src: null });
  }
  keepAdds(n, pool, interval, dt) {
    this.addT = (this.addT || 2) - dt;
    if (this.addT > 0) return;
    this.addT = interval;
    const g = this.g;
    const alive = g.units.filter((u) => !u.dead && u.faction === 'enemy' && !u.isBossPart).length + g.spawnQueue.length;
    if (alive < n) g.queueSpawn(R.pick(pool));
  }
}

class Janitor extends BossBase {
  constructor(g) {
    super(g, 'janitor');
    this.x = g.W / 2;
    this.y = g.A.t + 170;
    this.r = 42;
    this.ang = 0;
    this.binT = 1.5;
    this.shotT = 3;
    this.beamLen = 640;
    this.deathLine = 'Who will mop the floors now? (Nobody. Nobody ever did.)';
    this.phaseMarks = [0.5];
  }
  update(dt) {
    if (!this.baseUpdate(dt)) return;
    const g = this.g;
    const p2 = this.hp < this.maxHp * 0.5;
    const tp = this.targetPos();
    const a = angle(this.x, this.y, tp.x, tp.y);
    if (dist(this.x, this.y, tp.x, tp.y) > 140) {
      this.x += Math.cos(a) * 40 * dt;
      this.y += Math.sin(a) * 40 * dt;
    }
    this.x = clamp(this.x, g.A.l + this.r, g.A.r - this.r);
    this.y = clamp(this.y, g.A.t + this.r + 30, g.A.b - this.r);
    this.ang += dt * (p2 ? 1.05 : 0.8);
    // beam damage
    const beams = p2 ? 2 : 1;
    this.tick = (this.tick || 0) - dt;
    const doTick = this.tick <= 0;
    if (doTick) this.tick = 0.1;
    for (let i = 0; i < beams; i++) {
      const ba = this.ang + i * Math.PI;
      const ex = this.x + Math.cos(ba) * this.beamLen;
      const ey = this.y + Math.sin(ba) * this.beamLen;
      const pl = g.pl;
      if (pl.mode === 'host' && pl.host) {
        const h = pl.host;
        if (segDist(h.x, h.y, this.x, this.y, ex, ey) < h.r + 6 && doTick) {
          const immune = h.type === 'trashbin' && h.st.hidden > 0;
          if (!immune) g.damageUnit(h, (h.type === 'trashbin' ? 0.25 : 1) * 4.5 * (1 + 0.04 * g.cl));
        }
      } else if (pl.mode === 'spark' && segDist(pl.x, pl.y, this.x, this.y, ex, ey) < 9) g.hitSpark();
      for (const u of g.units) if (!u.dead && u.faction === 'ally' && doTick && segDist(u.x, u.y, this.x, this.y, ex, ey) < u.r + 6) g.damageUnit(u, 4.5);
      if (R() < 0.5) {
        const k = R();
        g.parts.spark(lerp(this.x, ex, k), lerp(this.y, ey, k), '#8fe8ff', R.range(-20, 20), R.range(-20, 20), 0.3, 3);
      }
    }
    // trash bins
    this.binT -= dt;
    const bins = g.units.filter((u) => !u.dead && u.type === 'trashbin' && u.faction === 'enemy').length;
    if (this.binT <= 0) {
      this.binT = 6.5;
      if (bins < 3) {
        g.queueSpawn('trashbin');
        if (bins < 1) g.queueSpawn('trashbin');
      }
    }
    // dirty water ring
    this.shotT -= dt;
    if (this.shotT <= 0) {
      this.shotT = p2 ? 2.6 : 3.6;
      const n = p2 ? 12 : 8;
      for (let i = 0; i < n; i++) this.shootAt(this.x, this.y, (i / n) * TAU + this.t, 7, 210, '#8fe8ff', 6);
      audio.sfx('eshoot');
    }
    this.keepAdds(p2 ? 4 : 3, ['crawler', 'crawler', 'spambot'], 4, dt);
  }
  hit(dmg, src) {
    super.hit(dmg * (src && src.type === 'trashbin' ? 2 : 1), src);
  }
  draw(ctx) {
    const g = this.g;
    if (this.dead && this.deathT > 1.5) return;
    const col = this.hitFlash > 0 ? COLORS.white : this.color;
    // beams
    if (!this.dead) {
      const beams = this.hp < this.maxHp * 0.5 ? 2 : 1;
      for (let i = 0; i < beams; i++) {
        const ba = this.ang + i * Math.PI;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + Math.cos(ba) * this.beamLen, this.y + Math.sin(ba) * this.beamLen);
        ctx.globalAlpha = 0.8;
        glowStroke(ctx, '#8fe8ff', 5, 14);
        ctx.restore();
        // mop head
        const mx = this.x + Math.cos(ba) * (this.r + 20);
        const my = this.y + Math.sin(ba) * (this.r + 20);
        ctx.save();
        poly(ctx, mx, my, 14, 5, ba + this.t * 4, 0.6);
        glowStroke(ctx, COLORS.white, 2);
        ctx.restore();
      }
    }
    ctx.save();
    if (this.dead) ctx.globalAlpha = 1 - this.deathT / 1.5;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, TAU);
    ctx.fillStyle = '#1a1405';
    ctx.fill();
    glowStroke(ctx, col, 3, 10);
    // bucket hat & face
    ctx.beginPath();
    ctx.rect(this.x - 26, this.y - this.r - 6, 52, 14);
    glowStroke(ctx, col, 2);
    ctx.fillStyle = col;
    ctx.fillRect(this.x - 16, this.y - 8, 8, 4);
    ctx.fillRect(this.x + 8, this.y - 8, 8, 4);
    ctx.beginPath();
    ctx.moveTo(this.x - 14, this.y + 14);
    ctx.lineTo(this.x + 14, this.y + 14);
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    this.drawQuip(ctx);
  }
}

class HRBot extends BossBase {
  constructor(g) {
    super(g, 'hrbot');
    this.x = g.W / 2;
    this.y = g.A.t + 120;
    this.r = 40;
    this.dir = 1;
    this.formT = 2;
    this.fireT = 4;
    this.shieldDown = 0;
    this.links = [];
    this.rehire = [];
    this.deathLine = 'HR_BOT has been let go. Effective immediately. Please return your badge.';
    this.shieldText = 'SHIELDED - HIJACK THE EMPLOYEES';
    this.phaseMarks = [0.5];
    this.hire(3);
  }
  hire(n) {
    const g = this.g;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + R() * 0.5;
      const pos = { x: clamp(this.x + Math.cos(a) * 170, g.A.l + 30, g.A.r - 30), y: clamp(this.y + 160 + Math.sin(a) * 120, g.A.t + 60, g.A.b - 60) };
      g.spawnQueue.push({ type: 'employee', x: pos.x, y: pos.y, t: 0.8, opts: {}, onSpawn: (u) => {
        u.linked = true;
        this.links.push(u);
      } });
    }
    g.floats.add(this.x, this.y + this.r + 20, 'NOW HIRING!', COLORS.enemy2, 16, 1.4);
  }
  hittable() {
    return !this.dead && this.activeLinks().length === 0 && !this.g.spawnQueue.some((s) => s.type === 'employee');
  }
  activeLinks() {
    return this.links.filter((u) => !u.dead && u.linked && u.faction === 'enemy');
  }
  onUnitDeath(u) {
    if (u.linked && u.faction === 'enemy' && !this.dead) {
      // killed instead of hijacked: HR rehires the position
      u.linked = false;
      this.rehire.push(2.5);
      this.g.floats.add(u.x, u.y - 20, 'POSITION REOPENED', COLORS.enemy2, 12, 1.2);
    }
  }
  update(dt) {
    if (!this.baseUpdate(dt)) return;
    const g = this.g;
    const p2 = this.hp < this.maxHp * 0.5;
    // links broken by possession
    for (const u of this.links) if (u.linked && (u.faction !== 'enemy' || u.possessed)) {
      u.linked = false;
      g.floats.add(u.x, u.y - 24, 'QUIT!', COLORS.player, 16, 1.2);
      audio.sfx('glitch');
    }
    for (let i = this.rehire.length - 1; i >= 0; i--) {
      this.rehire[i] -= dt;
      if (this.rehire[i] <= 0) {
        this.rehire.splice(i, 1);
        this.hire(1);
      }
    }
    const active = this.activeLinks().length;
    const pending = g.spawnQueue.some((s) => s.type === 'employee') || this.rehire.length > 0;
    if (active === 0 && !pending) {
      if (this.shieldDown <= 0 && !this.wasDown) {
        this.shieldDown = 9;
        this.wasDown = true;
        g.showBanner('SHIELD DOWN', 'Hit HR_BOT now!', COLORS.player, 1.6);
        audio.sfx('reward');
      }
      if (this.shieldDown > 0) {
        this.shieldDown -= dt;
        if (this.shieldDown <= 0) {
          this.wasDown = false;
          this.links = this.links.filter((u) => !u.dead && u.linked);
          this.hire(p2 ? 4 : 3);
        }
      }
    }
    // movement
    this.x += this.dir * 40 * dt;
    if (this.x > g.A.r - this.r - 20) this.dir = -1;
    if (this.x < g.A.l + this.r + 20) this.dir = 1;
    // attacks
    const tp = this.targetPos();
    this.formT -= dt;
    if (this.formT <= 0) {
      this.formT = p2 ? 1.8 : 2.5;
      const a = angle(this.x, this.y, tp.x, tp.y);
      for (let i = -2; i <= 2; i++) this.shootAt(this.x, this.y + 20, a + i * 0.18, 7, 260, COLORS.white, 5);
      audio.sfx('eshoot');
    }
    this.fireT -= dt;
    if (this.fireT <= 0) {
      this.fireT = p2 ? 3.2 : 4.5;
      g.hazards.push({ kind: 'fire', x: tp.x, y: tp.y, r: 62, t: 1.3, max: 1.3, dmg: 30 * (1 + 0.04 * g.cl), label: "YOU'RE FIRED" });
      audio.sfx('warn');
    }
    this.keepAdds(p2 ? 3 : 2, ['email', 'calendar', 'captcha'], 5, dt);
  }
  draw(ctx) {
    const g = this.g;
    if (this.dead && this.deathT > 1.5) return;
    // links
    for (const u of this.activeLinks()) {
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(this.t * 8) * 0.2;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(u.x, u.y);
      ctx.setLineDash([4, 6]);
      ctx.lineDashOffset = -this.t * 40;
      glowStroke(ctx, COLORS.enemy2, 1.5, 5);
      ctx.restore();
    }
    const col = this.hitFlash > 0 ? COLORS.white : this.color;
    ctx.save();
    if (this.dead) ctx.globalAlpha = 1 - this.deathT / 1.5;
    roundRect(ctx, this.x - this.r, this.y - this.r * 0.8, this.r * 2, this.r * 1.6, 14);
    ctx.fillStyle = '#1a0518';
    ctx.fill();
    glowStroke(ctx, col, 3, 10);
    // smiley
    ctx.fillStyle = col;
    ctx.fillRect(this.x - 16, this.y - 10, 6, 8);
    ctx.fillRect(this.x + 10, this.y - 10, 6, 8);
    ctx.beginPath();
    ctx.arc(this.x, this.y + 2, 16, 0.2, Math.PI - 0.2);
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    ctx.stroke();
    // lanyard
    ctx.beginPath();
    ctx.moveTo(this.x - 14, this.y + this.r * 0.8);
    ctx.lineTo(this.x, this.y + this.r * 0.8 + 18);
    ctx.lineTo(this.x + 14, this.y + this.r * 0.8);
    ctx.stroke();
    ctx.fillRect(this.x - 7, this.y + this.r * 0.8 + 16, 14, 10);
    if (!this.hittable() && !this.dead) {
      ctx.globalAlpha = 0.5;
      poly(ctx, this.x, this.y, this.r + 16, 6, this.t * 0.6);
      glowStroke(ctx, COLORS.white, 2, 8);
    }
    ctx.restore();
    if (this.shieldDown > 0 && this.hittable()) text(ctx, `${Math.ceil(this.shieldDown)}s`, this.x, this.y + this.r + 40, { size: 16, color: COLORS.player, weight: 'bold' });
    this.drawQuip(ctx);
  }
}

class Oversight extends BossBase {
  constructor(g) {
    super(g, 'oversight');
    this.x = g.W / 2;
    this.y = (g.A.t + g.A.b) / 2 - 30;
    this.r = 52;
    this.cone = 0;
    this.coneW = 0.8;
    this.watch = 0;
    this.shotT = 2.5;
    this.taken = 0;
    this.cams = [];
    this.camRespawn = [];
    this.deathLine = 'OVERSIGHT has closed its eye. Forever. Finally, some privacy.';
    this.phaseMarks = [0.5];
    const A = g.A;
    this.camSpots = [
      { x: A.l + 40, y: A.t + 70 },
      { x: A.r - 40, y: A.t + 70 },
      { x: A.l + 40, y: A.b - 60 },
      { x: A.r - 40, y: A.b - 60 },
    ];
    this.camSpots.forEach((p, i) => this.spawnCam(i));
  }
  spawnCam(i) {
    const p = this.camSpots[i];
    this.g.spawnQueue.push({ type: 'camera', x: p.x, y: p.y, t: 0.8, opts: { extra: { secCam: i } }, onSpawn: (u) => {
      this.cams[i] = u;
      u.quip = 'SECURITY CAM';
      u.quipT = 99;
    } });
  }
  onUnitDeath(u) {
    if (u.secCam !== undefined && !u.counted && !this.dead) this.camRespawn.push({ i: u.secCam, t: 5 });
  }
  update(dt) {
    if (!this.baseUpdate(dt)) return;
    const g = this.g;
    const p2 = this.hp < this.maxHp * 0.5;
    // camera hijacks
    for (const u of this.cams) {
      if (u && u.secCam !== undefined && !u.counted && u.possessed) {
        u.counted = true;
        this.taken++;
        this.hp -= this.maxHp * 0.15;
        this.hitFlash = 0.3;
        g.showBanner('CAMERA HIJACKED', `OVERSIGHT is ${this.taken * 25}% blind`, COLORS.ally, 1.6);
        g.shake(8);
        audio.sfx('glitch');
        if (this.hp <= 0) this.die();
      }
    }
    for (let i = this.camRespawn.length - 1; i >= 0; i--) {
      const c = this.camRespawn[i];
      c.t -= dt;
      if (c.t <= 0) {
        this.camRespawn.splice(i, 1);
        this.spawnCam(c.i);
      }
    }
    // once a cam is counted and later destroyed, respawn an uncounted one? No: blinded quarters stay blind.
    const width = this.coneW * (1 - 0.18 * this.taken);
    const tp = this.targetPos();
    const ta = angle(this.x, this.y, tp.x, tp.y);
    let diff = ((ta - this.cone + Math.PI * 3) % TAU) - Math.PI;
    this.cone += clamp(diff, -1, 1) * dt * (p2 ? 0.9 : 0.6) + dt * 0.35;
    // in cone?
    const pl = g.pl;
    const hidden = pl.mode === 'jumping' || (pl.host && pl.host.st.hidden > 0) || (pl.mode === 'spark' && pl.ghost > 0);
    diff = Math.abs(((ta - this.cone + Math.PI * 3) % TAU) - Math.PI);
    const inCone = !hidden && diff < width / 2 && dist(this.x, this.y, tp.x, tp.y) < 760;
    if (inCone) {
      this.watch += dt;
      if (Math.floor(this.watch * 10) !== Math.floor((this.watch - dt) * 10)) audio.sfx('warn');
    } else this.watch = Math.max(0, this.watch - dt * 1.5);
    if (this.watch >= 0.8) {
      this.watch = 0;
      g.hazards.push({ kind: 'strike', x: tp.x, y: tp.y, sx: this.x, sy: this.y, t: 0.55, max: 0.55, dmg: 34 * (1 + 0.04 * g.cl) });
      g.floats.add(tp.x, tp.y - 30, 'SPOTTED', COLORS.ally, 16, 0.8);
    }
    this.shotT -= dt;
    if (this.shotT <= 0) {
      this.shotT = p2 ? 2.0 : 2.8;
      const a = angle(this.x, this.y, tp.x, tp.y);
      this.burst = [{ t: 0, a }, { t: 0.12, a }, { t: 0.24, a }];
    }
    if (this.burst) {
      for (const b of this.burst) {
        b.t -= dt;
        if (b.t <= 0 && !b.done) {
          b.done = true;
          this.shootAt(this.x, this.y, b.a + R.range(-0.1, 0.1), 8, 330, COLORS.ally, 5);
        }
      }
      if (this.burst.every((b) => b.done)) this.burst = null;
    }
    this.keepAdds(p2 ? 3 : 2, ['drone', 'facerec', 'crawler'], 4.5, dt);
  }
  draw(ctx) {
    if (this.dead && this.deathT > 1.5) return;
    const g = this.g;
    const width = this.coneW * (1 - 0.18 * this.taken);
    if (!this.dead) {
      ctx.save();
      ctx.globalAlpha = 0.1 + this.watch * 0.25;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.arc(this.x, this.y, 760, this.cone - width / 2, this.cone + width / 2);
      ctx.closePath();
      ctx.fillStyle = this.watch > 0.4 ? COLORS.trace : COLORS.ally;
      ctx.fill();
      ctx.restore();
    }
    const col = this.hitFlash > 0 ? COLORS.white : this.color;
    ctx.save();
    if (this.dead) ctx.globalAlpha = 1 - this.deathT / 1.5;
    // eye
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, this.r * 1.3, this.r * 0.8, 0, 0, TAU);
    ctx.fillStyle = '#04140a';
    ctx.fill();
    glowStroke(ctx, col, 3, 12);
    const px = this.x + Math.cos(this.cone) * 18;
    const py = this.y + Math.sin(this.cone) * 12;
    ctx.beginPath();
    ctx.arc(px, py, 22, 0, TAU);
    ctx.fillStyle = col;
    ctx.globalAlpha *= 0.8;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px, py, 9, 0, TAU);
    ctx.fillStyle = '#000';
    ctx.fill();
    // blind quarters
    for (let i = 0; i < this.taken; i++) {
      ctx.beginPath();
      ctx.moveTo(this.x - this.r * 1.3 + i * 30, this.y - this.r * 0.9);
      ctx.lineTo(this.x - this.r * 1.3 + i * 30 + 20, this.y + this.r * 0.9);
      ctx.strokeStyle = COLORS.trace;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();
    this.drawQuip(ctx);
  }
}

class Greg extends BossBase {
  constructor(g) {
    super(g, 'greg');
    this.r = 18;
    this.x = g.W / 2;
    this.y = g.A.t + 100;
    this.state = 'exposed';
    this.exposedT = 1.5;
    this.host = null;
    this.ringT = 4;
    this.deathLine = 'G.R.E.G. has been... let go. The org chart is free.';
    this.phaseMarks = [1 / 3, 2 / 3];
    this.spark = { kind: 'gregspark', active: true, x: this.x, y: this.y, r: 14, hit: (d, s) => this.sparkHit(d, s) };
    this.vx = 0;
    this.vy = 0;
    this.lastPhase = 1;
    // initial crowd
    for (let i = 0; i < 4; i++) g.queueSpawn(R.pick(LAYER_HOSTS[4]));
  }
  phase() {
    return this.hp > this.maxHp * 2 / 3 ? 1 : this.hp > this.maxHp / 3 ? 2 : 3;
  }
  hittable() {
    return false; // only the spark can be hit
  }
  collides() {
    return false;
  }
  sparkHit(dmg, src) {
    if (this.state !== 'exposed' || this.dead) return;
    const before = this.phase();
    dmg *= 2; // it's his real body
    this.hp -= dmg;
    this.hitFlash = 0.08;
    const g = this.g;
    if (g.app.profile.settings.damageNumbers) g.floats.add(this.x, this.y - 22, Math.round(dmg).toString(), COLORS.greg, 15, 0.6, -60);
    audio.sfx('hit');
    if (this.hp <= 0) {
      this.spark.active = false;
      this.die();
      return;
    }
    if (this.phase() !== before) {
      g.showBanner(`PHASE ${this.phase()}`, this.phase() === 2 ? 'GREG: "Let\'s SYNERGIZE, champ!"' : 'GREG: "HOSTILE TAKEOVER TIME!"', COLORS.greg, 2);
      g.shake(10);
      for (let i = 0; i < 3; i++) g.queueSpawn(R.pick(LAYER_HOSTS[4]));
      this.exposedT = Math.min(this.exposedT, 0.4);
    }
  }
  onHostDeath(u) {
    if (u !== this.host) return;
    this.host = null;
    this.state = 'exposed';
    this.x = u.x;
    this.y = u.y;
    this.exposedT = this.phase() === 3 ? 2.8 : 3.4;
    this.dazed = 1.0;
    this.g.floats.add(u.x, u.y - 30, 'GREG EXPOSED!', COLORS.greg, 18, 1.2);
    this.quip = R.pick(['ow, my synergy', 'that\'s not a growth mindset', 'HR will hear about this', 'I\'m vulnerable rn']);
    this.quipT = 2;
    audio.sfx('eject');
  }
  takeHost(u) {
    this.host = u;
    this.state = 'host';
    u.greg = true;
    u.maxHp *= 1.5;
    u.hp = u.maxHp;
    u.r *= 1.15;
    u.speed *= 1.1;
    u.quip = R.pick(BOSSES.greg.quips);
    u.quipT = 2.5;
    this.g.parts.burst(u.x, u.y, COLORS.greg, 24, 280, 0.5);
    audio.sfx('land');
  }
  update(dt) {
    if (!this.baseUpdate(dt)) {
      this.spark.active = false;
      return;
    }
    const g = this.g;
    const ph = this.phase();
    this.spark.active = this.state === 'exposed';
    if (this.state === 'host') {
      const h = this.host;
      if (!h || h.dead) {
        this.state = 'exposed';
        this.exposedT = 2;
      } else {
        this.x = h.x;
        this.y = h.y;
        // phase 2+: synergy rings
        if (ph >= 2) {
          this.ringT -= dt;
          if (this.ringT <= 0) {
            this.ringT = ph === 3 ? 3.2 : 4;
            g.hazards.push({ kind: 'ring', x: h.x, y: h.y, rad: 10, max: 300, speed: 220, dmg: 14 * (1 + 0.04 * g.cl), team: 'player', color: COLORS.greg, hit: new Set() });
            g.floats.add(h.x, h.y - 40, 'SYNERGY!', COLORS.greg, 15, 0.9);
          }
        }
        // phase 3: tether
        const pl = g.pl;
        if (ph === 3 && pl.mode === 'host' && pl.host && dist(h.x, h.y, pl.host.x, pl.host.y) < 460) {
          pl.tetherT += dt;
          this.tethering = true;
          if (pl.tetherT >= 2) {
            pl.tetherT = 0;
            const stolen = pl.host;
            g.floats.add(stolen.x, stolen.y - 30, 'HOSTILE TAKEOVER', COLORS.greg, 18, 1.4);
            g.run.pips -= 1;
            g.flash = 0.3;
            g.shake(14);
            stolen.possessed = false;
            stolen.faction = 'enemy';
            g.ejectFrom(stolen);
            g.pl.inv = 1.5;
            if (g.run.pips <= 0) g.die();
            // greg moves into the stolen host
            const old = this.host;
            old.greg = false;
            g.crash(old);
            this.takeHost(stolen);
          }
        } else {
          this.tethering = false;
          pl.tetherT = Math.max(0, pl.tetherT - dt * 2);
        }
      }
    } else if (this.state === 'exposed') {
      this.tethering = false;
      this.exposedT -= dt;
      // flee from player erratically
      const tp = this.targetPos();
      const a = angle(tp.x, tp.y, this.x, this.y) + Math.sin(this.t * 3) * 1.2;
      this.dazed = (this.dazed || 0) - dt;
      const sp = this.dazed > 0 ? 0 : 85;
      this.vx = lerp(this.vx, Math.cos(a) * sp, dt * 3);
      this.vy = lerp(this.vy, Math.sin(a) * sp, dt * 3);
      this.x = clamp(this.x + this.vx * dt, g.A.l + 20, g.A.r - 20);
      this.y = clamp(this.y + this.vy * dt, g.A.t + 40, g.A.b - 20);
      this.spark.x = this.x;
      this.spark.y = this.y;
      if (R() < 0.7) g.parts.spark(this.x, this.y, COLORS.greg, R.range(-40, 40), R.range(-40, 40), 0.3, 3);
      // spark touching player spark hurts player
      if (g.pl.mode === 'spark' && dist(this.x, this.y, g.pl.x, g.pl.y) < 20) g.hitSpark();
      if (this.exposedT <= 0) {
        const t = g.nearest(this.x, this.y, (u) => u.faction === 'enemy' && !u.greg && u.spawnT <= 0, 2000);
        if (t) {
          this.state = 'jumping';
          this.jump = { fx: this.x, fy: this.y, t: 0, target: t };
        } else {
          this.exposedT = 0.5;
          if (!g.spawnQueue.length) for (let i = 0; i < 2; i++) g.queueSpawn(R.pick(LAYER_HOSTS[4]));
        }
      }
    } else if (this.state === 'jumping') {
      const j = this.jump;
      j.t += dt / 0.3;
      if (j.target.dead || j.target.faction !== 'enemy') {
        this.state = 'exposed';
        this.exposedT = 0.6;
      } else {
        this.x = lerp(j.fx, j.target.x, Math.min(1, j.t));
        this.y = lerp(j.fy, j.target.y, Math.min(1, j.t));
        this.spark.x = this.x;
        this.spark.y = this.y;
        g.parts.spark(this.x, this.y, COLORS.greg, 0, 0, 0.3, 4);
        if (j.t >= 1) this.takeHost(j.target);
      }
    }
    this.keepAdds(3 + ph, LAYER_HOSTS[4].concat(['crawler', 'spambot', 'email']), 2.2, dt);
  }
  draw(ctx) {
    const g = this.g;
    if (this.dead && this.deathT > 1.5) return;
    if (this.tethering && this.host && g.pl.host) {
      const k = g.pl.tetherT / 2;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(this.host.x, this.host.y);
      const hx = g.pl.host.x;
      const hy = g.pl.host.y;
      const mx = (this.host.x + hx) / 2 + Math.sin(this.t * 20) * 10;
      const my = (this.host.y + hy) / 2 + Math.cos(this.t * 17) * 10;
      ctx.quadraticCurveTo(mx, my, hx, hy);
      ctx.globalAlpha = 0.4 + k * 0.6;
      glowStroke(ctx, COLORS.greg, 1 + k * 4, 8);
      ctx.restore();
      text(ctx, `TAKEOVER ${Math.floor(k * 100)}% - JUMP!`, hx, hy - g.pl.host.r - 30, { size: 13, color: COLORS.greg, weight: 'bold' });
    }
    if (this.state === 'host') {
      this.drawQuipAt(ctx, this.x, this.y - (this.host ? this.host.r : 20) - 30);
      return;
    }
    // GREG out of a host: just the power tie, flapping around.
    ctx.save();
    if (this.dead) ctx.globalAlpha = 1 - this.deathT / 1.5;
    if (this.hitFlash > 0) ctx.globalAlpha *= 0.5;
    drawGreg(ctx, this.x, this.y, 18, this.t * (this.dazed > 0 ? 6 : 2));
    ctx.restore();
    if (this.state === 'exposed' && !this.dead) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      glowCircle(ctx, this.x, this.y, 26, COLORS.greg, 1.5, 0);
      ctx.restore();
      text(ctx, 'SHOOT HIM!', this.x, this.y + 36, { size: 12, color: COLORS.greg, weight: 'bold', alpha: Math.floor(this.t * 6) % 2 ? 1 : 0.5 });
    }
    this.drawQuipAt(ctx, this.x, this.y - 34);
  }
  drawQuipAt(ctx, x, y) {
    if (this.quip && !this.dead) text(ctx, this.quip, x, y, { size: 13, color: COLORS.greg, alpha: 0.95 });
  }
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  return dist(px, py, ax + t * dx, ay + t * dy);
}
