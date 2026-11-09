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
  ['combat', 46],
  ['elite', 12],
  ['vault', 4],
  ['shop', 11],
  ['event', 20],
  ['cooldown', 7],
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

export const MAP_ROWS = 8; // floors before the boss
export const MAP_COLS = 7; // lanes
export const TREASURE_ROW = 4; // all vaults
const NO_REPEAT = new Set(['elite', 'shop', 'cooldown', 'vault']);

// Slay-the-Spire style: trace 6 random non-crossing paths up a 7x8 grid.
export function genMap(run, layer) {
  const rng = runRng(run);
  const ROWS = MAP_ROWS;
  const COLS = MAP_COLS;
  const cell = []; // cell[r][c] = node | undefined
  for (let r = 0; r < ROWS; r++) cell.push([]);
  const edges = new Set(); // "r,c>c2"
  const crosses = (r, c, c2) => c2 !== c && edges.has(`${r},${c2}>${c}`);
  let firstStart = -1;
  for (let w = 0; w < 6; w++) {
    let c = rng.int(0, COLS - 1);
    // first two paths start on different columns so floor 0 always has a choice
    if (w === 0) firstStart = c;
    if (w === 1) while (c === firstStart) c = rng.int(0, COLS - 1);
    for (let r = 0; r < ROWS; r++) {
      if (!cell[r][c]) cell[r][c] = { row: r, gx: c, next: [] };
      if (r === ROWS - 1) break;
      let c2 = c;
      for (let tries = 0; tries < 8; tries++) {
        c2 = Math.max(0, Math.min(COLS - 1, c + rng.int(-1, 1)));
        if (!crosses(r, c, c2)) break;
        c2 = c;
      }
      edges.add(`${r},${c}>${c2}`);
      c = c2;
    }
  }
  // build node list
  let idc = 0;
  const rows = [];
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      const nd = cell[r][c];
      if (!nd) continue;
      Object.assign(nd, { id: idc++, col: c, n: COLS, type: null, jx: rng.range(-12, 12), jy: rng.range(-8, 8) });
      row.push(nd);
    }
    rows.push(row);
  }
  for (const e of edges) {
    const [rc, c2] = e.split('>');
    const [r, c] = rc.split(',').map(Number);
    const a = cell[r][c];
    const b = cell[r + 1][+c2];
    if (!a.next.includes(b.id)) a.next.push(b.id);
  }
  // parents
  const parents = {};
  for (const row of rows) for (const nd of row) for (const id of nd.next) (parents[id] = parents[id] || []).push(nd);
  // assign types floor by floor
  for (const row of rows) {
    for (const nd of row) {
      const r = nd.row;
      if (r === 0) nd.type = 'combat';
      else if (r === TREASURE_ROW) nd.type = 'vault';
      else if (r === ROWS - 1) nd.type = 'cooldown';
      else {
        let w = NODE_WEIGHTS;
        if (r < 2) w = w.filter(([k]) => k !== 'elite' && k !== 'cooldown');
        if (r === ROWS - 2) w = w.filter(([k]) => k !== 'cooldown'); // rest floor is next
        if (r === TREASURE_ROW - 1 || r === TREASURE_ROW + 1) w = w.filter(([k]) => k !== 'vault');
        const par = parents[nd.id] || [];
        let t = weightedPick(rng, w);
        for (let k = 0; k < 6 && NO_REPEAT.has(t) && par.some((p) => p.type === t); k++) t = weightedPick(rng, w);
        if (NO_REPEAT.has(t) && par.some((p) => p.type === t)) t = 'combat';
        nd.type = t;
      }
    }
  }
  // at least one shop on floors 1..6
  const mids = rows.slice(1, ROWS - 1).flat().filter((nd) => nd.row !== TREASURE_ROW);
  if (!mids.some((nd) => nd.type === 'shop')) {
    const cand = mids.filter((nd) => nd.row >= 2 && (nd.type === 'event' || nd.type === 'combat'));
    if (cand.length) rng.pick(cand).type = 'shop';
  }
  // boss
  const boss = { id: idc++, row: ROWS, col: 3, gx: 3, n: 1, type: 'boss', next: [], jx: 0, jy: 0 };
  for (const nd of rows[ROWS - 1]) nd.next.push(boss.id);
  rows.push([boss]);
  return { layer, rows, grid: true };
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
