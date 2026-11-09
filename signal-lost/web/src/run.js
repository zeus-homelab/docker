// Run state, map generation and node outcomes.
import { makeRng, hashString } from './engine.js';
import { EXPLOITS, GLITCHES, VARIANTS, LAYER_HOSTS, HOSTS } from './data.js';

export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function newRun(profile, { variant = 'null', clearance = 0, daily = false } = {}) {
  const seed = daily ? hashString('signal-lost-daily-' + todayKey()) : (Math.random() * 2 ** 32) >>> 0;
  const perks = profile.unlocks.perks;
  const run = {
    seed,
    rngCount: 0,
    daily,
    dailyKey: daily ? todayKey() : null,
    variant: daily ? 'null' : variant,
    clearance: daily ? 0 : clearance,
    layer: 1,
    map: null,
    pos: null, // current node id (null = before row 0)
    visited: [],
    pips: 3,
    maxPips: 3,
    trace: 0,
    traceMax: 100,
    bits: 0,
    exploits: {},
    glitches: [],
    hostCount: 0,
    allyHunter: false,
    startPicked: false,
    stats: { rooms: 0, bosses: 0, hijacks: 0, kills: 0, time: 0, bitsEarned: 0 },
  };
  if (run.variant === 'phantom') run.pips = run.maxPips = 5;
  if (run.variant === 'rootkit') run.traceMax = 70;
  run.bits += (perks.bits1 ? 25 : 0) + (perks.bits2 ? 25 : 0) + (perks.bits3 ? 25 : 0);
  if (daily) {
    const rng = runRng(run);
    run.glitches.push(rng.pick(Object.keys(GLITCHES)));
  }
  run.map = genMap(run, 1);
  return run;
}

export function runRng(run) {
  run.rngCount++;
  return makeRng(hashString(`${run.seed}:${run.rngCount}`));
}

const NODE_WEIGHTS = [
  ['combat', 44],
  ['elite', 12],
  ['vault', 10],
  ['shop', 12],
  ['event', 16],
  ['cooldown', 6],
];

function weightedPick(rng, list) {
  const total = list.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [k, w] of list) {
    r -= w;
    if (r <= 0) return k;
  }
  return list[0][0];
}

export function genMap(run, layer) {
  const rng = runRng(run);
  const ROWS = 6;
  const rows = [];
  let idc = 0;
  for (let r = 0; r < ROWS; r++) {
    const n = r === 0 ? rng.int(2, 3) : rng.int(2, 3);
    const row = [];
    for (let i = 0; i < n; i++) {
      let type;
      if (r === 0) type = 'combat';
      else if (r === ROWS - 1) type = i === 0 ? 'cooldown' : rng.pick(['shop', 'cooldown', 'event']);
      else {
        let w = NODE_WEIGHTS;
        if (r === 1) w = w.filter(([k]) => k !== 'elite' && k !== 'cooldown');
        type = weightedPick(rng, w);
      }
      row.push({ id: idc++, row: r, col: i, n, type, next: [], jx: rng.range(-18, 18), jy: rng.range(-10, 10) });
    }
    rows.push(row);
  }
  // ensure a shop exists in rows 2..4
  if (!rows.slice(1, ROWS - 1).some((row) => row.some((nd) => nd.type === 'shop'))) {
    const row = rows[rng.int(2, 4)];
    row[rng.int(0, row.length - 1)].type = 'shop';
  }
  // no row of all-elite
  // boss row
  rows.push([{ id: idc++, row: ROWS, col: 0, n: 1, type: 'boss', next: [], jx: 0, jy: 0 }]);
  // edges
  for (let r = 0; r < rows.length - 1; r++) {
    const a = rows[r];
    const b = rows[r + 1];
    for (const nd of a) {
      const pos = a.length === 1 ? 0.5 : nd.col / (a.length - 1);
      const target = Math.round(pos * (b.length - 1));
      nd.next.push(b[target].id);
      if (b.length > 1 && rng.chance(0.55)) {
        const alt = target + (rng.chance(0.5) ? 1 : -1);
        if (alt >= 0 && alt < b.length && !nd.next.includes(b[alt].id)) nd.next.push(b[alt].id);
      }
    }
    // every node in b reachable
    for (const nb of b) {
      if (!a.some((nd) => nd.next.includes(nb.id))) {
        const pos = b.length === 1 ? 0.5 : nb.col / (b.length - 1);
        a[Math.round(pos * (a.length - 1))].next.push(nb.id);
      }
    }
  }
  return { layer, rows };
}

export function findNode(map, id) {
  for (const row of map.rows) for (const n of row) if (n.id === id) return n;
  return null;
}

export function availableNodes(run) {
  const map = run.map;
  if (run.pos === null) return map.rows[0].map((n) => n.id);
  const cur = findNode(map, run.pos);
  return cur ? cur.next : [];
}

export function has(run, ex) {
  return run.exploits[ex] || 0;
}
export function hasGlitch(run, g) {
  return run.glitches.includes(g);
}

export function offerExploits(run, n = 3, rng = null) {
  rng = rng || runRng(run);
  const pool = Object.keys(EXPLOITS).filter((k) => !(EXPLOITS[k].unique && run.exploits[k]));
  rng.shuffle(pool);
  return pool.slice(0, n);
}

export function addExploit(run, id) {
  run.exploits[id] = (run.exploits[id] || 0) + 1;
  if (id === 'backup') {
    run.maxPips += 1;
    run.pips = Math.min(run.maxPips, run.pips + 1);
  }
}

export function addGlitch(run, rng) {
  const pool = Object.keys(GLITCHES).filter((g) => !run.glitches.includes(g));
  if (!pool.length) return null;
  const g = (rng || runRng(run)).pick(pool);
  run.glitches.push(g);
  return g;
}

// Apply an event effect list. Returns array of human-readable result lines.
export function applyEffects(run, effects) {
  const out = [];
  for (const eff of effects) {
    const [kind, a, b, c] = eff;
    switch (kind) {
      case 'bits':
        run.bits = Math.max(0, run.bits + a);
        out.push(a >= 0 ? `+${a} Bits` : `${a} Bits`);
        break;
      case 'pip':
        run.pips = Math.min(run.maxPips, run.pips + a);
        out.push(a >= 0 ? `+${a} Core pip` : `${a} Core pip`);
        break;
      case 'maxpip':
        run.maxPips += a;
        run.pips += a;
        out.push(`+${a} max Core pip`);
        break;
      case 'trace':
        run.trace = Math.max(0, Math.min(run.traceMax - 1, run.trace + a));
        out.push(a >= 0 ? `+${a} Trace` : `${a} Trace`);
        break;
      case 'exploit': {
        const [id] = offerExploits(run, 1);
        if (id) {
          addExploit(run, id);
          out.push(`Exploit: ${EXPLOITS[id].name}`);
        }
        break;
      }
      case 'glitch': {
        const g = addGlitch(run);
        if (g) out.push(`Glitch: ${GLITCHES[g].name}`);
        break;
      }
      case 'allyhunter':
        run.allyHunter = true;
        out.push('Ally: Hunter (next room)');
        break;
      case 'chance': {
        const rng = runRng(run);
        const ok = rng() < a;
        out.push(ok ? 'It worked!' : 'It did NOT work.');
        out.push(...applyEffects(run, ok ? b : c));
        break;
      }
    }
  }
  if (run.pips <= 0) run.pips = 1; // events never kill you outright, they just hurt
  return out;
}

// Room config for a node
export function roomConfig(run, node) {
  const rng = runRng(run);
  const layer = run.layer;
  const pool = LAYER_HOSTS[layer];
  const cfg = { type: node.type, layer, seed: rng.int(1, 2 ** 30) };
  if (node.type === 'vault') {
    cfg.required = rng.pick(pool.filter((h) => HOSTS[h].layer === layer));
    cfg.time = 35;
  }
  return cfg;
}

export function fragmentsFor(run, won) {
  return run.stats.rooms + run.stats.bosses * 5 + (won ? 25 : 0);
}

export function scoreFor(run, won) {
  return run.stats.rooms * 100 + run.stats.bosses * 500 + run.stats.bitsEarned + (won ? 2000 : 0);
}

export function variantInfo(run) {
  return VARIANTS[run.variant];
}
