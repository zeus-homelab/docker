// Core helpers: math, seeded RNG, particles, drawing.

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;
export const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));
export const angle = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
export const easeOut = (t) => 1 - (1 - t) ** 3;
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

// Mulberry32 seeded RNG
export function makeRng(seed) {
  let a = seed >>> 0;
  const rng = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.range = (lo, hi) => lo + rng() * (hi - lo);
  rng.int = (lo, hi) => Math.floor(lo + rng() * (hi - lo + 1));
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  rng.chance = (p) => rng() < p;
  rng.shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  rng.state = () => a;
  return rng;
}

export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Unseeded cosmetic RNG
export const R = makeRng((Math.random() * 2 ** 32) >>> 0);

export const COLORS = {
  bg: '#05060c',
  grid: '#0d1830',
  player: '#2ef2ff',
  enemy: '#ff2e6a',
  enemy2: '#ff5ad1',
  greg: '#ff9a1f',
  ally: '#4dff8a',
  gold: '#ffd84d',
  white: '#e8f6ff',
  dim: '#5a6f8f',
  trace: '#ff3355',
  purple: '#a46bff',
};

export const FONT = '"Share Tech Mono", "Roboto Mono", "Courier New", monospace';

// Neon glow stroke: wide translucent pass then bright thin pass.
export function glowStroke(ctx, color, width = 2, glow = 6) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha *= 0.22;
  ctx.lineWidth = width + glow;
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

export function glowCircle(ctx, x, y, r, color, width = 2, fillAlpha = 0.12) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  if (fillAlpha > 0) {
    ctx.save();
    ctx.globalAlpha *= fillAlpha;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }
  glowStroke(ctx, color, width);
}

export function poly(ctx, x, y, r, sides, rot = 0, spikes = 0) {
  ctx.beginPath();
  const n = spikes ? sides * 2 : sides;
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    const rr = spikes && i % 2 ? r * spikes : r;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function text(ctx, str, x, y, opts = {}) {
  const { size = 20, color = COLORS.white, align = 'center', base = 'middle', glow = false, alpha = 1, weight = '' } = opts;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  if (glow) {
    ctx.globalAlpha *= 0.35;
    ctx.fillStyle = color;
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) ctx.fillText(str, x + dx, y + dy);
    ctx.globalAlpha /= 0.35;
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.restore();
}

// Word-wrap a string into lines that fit maxWidth.
export function wrap(ctx, str, maxWidth, size) {
  ctx.save();
  ctx.font = `${size}px ${FONT}`;
  const out = [];
  for (const para of String(str).split('\n')) {
    const words = para.split(' ');
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        out.push(line);
        line = w;
      } else line = test;
    }
    out.push(line);
  }
  ctx.restore();
  return out;
}

export function roundRect(ctx, x, y, w, h, r = 8) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Glitchy text: draws RGB-split copies with random slice offsets.
export function glitchText(ctx, str, x, y, size, intensity = 1, t = 0) {
  const j = intensity;
  text(ctx, str, x - 3 * j + Math.sin(t * 13) * j, y, { size, color: '#ff2e6a', alpha: 0.7, weight: 'bold' });
  text(ctx, str, x + 3 * j + Math.cos(t * 11) * j, y, { size, color: '#2ef2ff', alpha: 0.7, weight: 'bold' });
  text(ctx, str, x, y, { size, color: COLORS.white, weight: 'bold', glow: true });
  if (R() < 0.15 * j) {
    // slice displacement
    const h = size * R.range(0.1, 0.35);
    const sy = y - size / 2 + R() * size;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, sy, 4000, h);
    ctx.clip();
    text(ctx, str, x + R.range(-14, 14) * j, y, { size, color: COLORS.white, weight: 'bold' });
    ctx.restore();
  }
}

// ---------- Particles ----------
export class Particles {
  constructor() {
    this.list = [];
  }
  burst(x, y, color, n = 12, speed = 160, life = 0.5, size = 3) {
    for (let i = 0; i < n; i++) {
      const a = R() * TAU;
      const s = speed * (0.3 + R() * 0.9);
      this.list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.5 + R() * 0.7), max: life, color, size: size * (0.6 + R() * 0.8), sq: R() < 0.5 });
    }
  }
  spark(x, y, color, vx, vy, life = 0.3, size = 2) {
    this.list.push({ x, y, vx, vy, life, max: life, color, size, sq: true });
  }
  update(dt) {
    const l = this.list;
    for (let i = l.length - 1; i >= 0; i--) {
      const p = l[i];
      p.life -= dt;
      if (p.life <= 0) {
        l[i] = l[l.length - 1];
        l.pop();
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
    }
    if (l.length > 900) l.splice(0, l.length - 900);
  }
  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.list) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      const s = p.size;
      if (p.sq) ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, s / 2, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

// Floating text (damage numbers, status lines)
export class Floaters {
  constructor() {
    this.list = [];
  }
  add(x, y, str, color = COLORS.white, size = 16, life = 0.8, vy = -40) {
    this.list.push({ x, y, str, color, size, life, max: life, vy });
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i];
      f.life -= dt;
      f.y += f.vy * dt;
      if (f.life <= 0) this.list.splice(i, 1);
    }
  }
  draw(ctx) {
    for (const f of this.list) text(ctx, f.str, f.x, f.y, { size: f.size, color: f.color, alpha: clamp(f.life / f.max * 1.5, 0, 1), weight: 'bold' });
  }
}

// Haptics helper
export function buzz(ms, settings) {
  if (settings && settings.haptics && navigator.vibrate) {
    try {
      navigator.vibrate(ms);
    } catch (_) {}
  }
}
