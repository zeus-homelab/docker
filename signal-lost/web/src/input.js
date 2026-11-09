// Pointer input translated into game-space gestures.
// Emits per-frame state + discrete events: tap, flick. Scenes read input.events each frame.

export class Input {
  constructor(canvas, toGame) {
    this.canvas = canvas;
    this.toGame = toGame; // (clientX, clientY) => {x,y}
    this.pointers = new Map();
    this.events = [];
    this.primary = null; // {id, sx, sy, x, y, t0, moved}
    const opts = { passive: false };
    canvas.addEventListener('pointerdown', (e) => this.down(e), opts);
    window.addEventListener('pointermove', (e) => this.move(e), opts);
    window.addEventListener('pointerup', (e) => this.up(e), opts);
    window.addEventListener('pointercancel', (e) => this.up(e, true), opts);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.keys = new Set();
    window.addEventListener('keydown', (e) => {
      if (!e.repeat) this.events.push({ type: 'key', key: e.key });
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }
  now() {
    return performance.now() / 1000;
  }
  down(e) {
    e.preventDefault();
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch (_) {}
    const p = this.toGame(e.clientX, e.clientY);
    const rec = { id: e.pointerId, sx: p.x, sy: p.y, x: p.x, y: p.y, px: p.x, py: p.y, t0: this.now(), moved: false, hist: [{ x: p.x, y: p.y, t: this.now() }] };
    this.pointers.set(e.pointerId, rec);
    if (!this.primary) this.primary = rec;
    this.events.push({ type: 'down', x: p.x, y: p.y, id: e.pointerId, primary: this.primary === rec });
  }
  move(e) {
    const rec = this.pointers.get(e.pointerId);
    if (!rec) return;
    e.preventDefault();
    const p = this.toGame(e.clientX, e.clientY);
    rec.x = p.x;
    rec.y = p.y;
    const t = this.now();
    rec.hist.push({ x: p.x, y: p.y, t });
    while (rec.hist.length > 2 && t - rec.hist[0].t > 0.12) rec.hist.shift();
    if ((rec.x - rec.sx) ** 2 + (rec.y - rec.sy) ** 2 > 14 * 14) rec.moved = true;
  }
  up(e, cancel = false) {
    const rec = this.pointers.get(e.pointerId);
    if (!rec) return;
    this.pointers.delete(e.pointerId);
    const t = this.now();
    const dur = t - rec.t0;
    const isPrimary = this.primary === rec;
    if (isPrimary) this.primary = null;
    if (cancel) return;
    this.events.push({ type: 'up', x: rec.x, y: rec.y, id: e.pointerId, primary: isPrimary, dur, moved: rec.moved });
    if (!rec.moved && dur < 0.35) {
      this.events.push({ type: 'tap', x: rec.sx, y: rec.sy, primary: isPrimary });
    } else {
      // flick detection from recent history
      const h = rec.hist;
      const a = h[0];
      const b = h[h.length - 1];
      const dt = Math.max(0.016, b.t - a.t);
      const vx = (b.x - a.x) / dt;
      const vy = (b.y - a.y) / dt;
      const sp = Math.hypot(vx, vy);
      if (sp > 1100 && dur < 0.6) this.events.push({ type: 'flick', x: rec.sx, y: rec.sy, ex: b.x, ey: b.y, dx: vx / sp, dy: vy / sp, primary: isPrimary });
    }
  }
  // consume events for this frame
  take() {
    const e = this.events;
    this.events = [];
    return e;
  }
}
