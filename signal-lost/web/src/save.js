// Persistence: profile (meta) and run (resumable at the map).

const PROFILE_KEY = 'signallost.profile.v1';
const RUN_KEY = 'signallost.run.v1';

export const DEFAULT_SETTINGS = {
  controls: 'tap', // 'tap' | 'drag'
  leftHanded: false,
  shake: true,
  haptics: true,
  damageNumbers: true,
  sfx: 0.8,
  music: 0.55,
  skipIntro: false,
};

function defaultProfile() {
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS },
    fragments: 0,
    unlocks: { variants: ['null'], perks: {} },
    codex: {}, // hostId -> count possessed
    seenHosts: {}, // hostId -> true (encountered)
    stats: { runs: 0, wins: 0, deaths: 0, hijacks: 0, bestTime: 0, bossKills: 0 },
    clearanceUnlocked: 0, // max clearance selectable
    seenIntro: false,
    daily: {}, // 'YYYY-MM-DD' -> best score
  };
}

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (_) {
    return null;
  }
}
function safeSet(key, val) {
  try {
    localStorage.setItem(key, val);
  } catch (_) {}
}
function safeDel(key) {
  try {
    localStorage.removeItem(key);
  } catch (_) {}
}

export function loadProfile() {
  const raw = safeGet(PROFILE_KEY);
  const base = defaultProfile();
  if (!raw) return base;
  try {
    const p = JSON.parse(raw);
    return {
      ...base,
      ...p,
      settings: { ...base.settings, ...(p.settings || {}) },
      unlocks: { ...base.unlocks, ...(p.unlocks || {}), perks: { ...((p.unlocks || {}).perks || {}) } },
      stats: { ...base.stats, ...(p.stats || {}) },
    };
  } catch (_) {
    return base;
  }
}

export function saveProfile(p) {
  safeSet(PROFILE_KEY, JSON.stringify(p));
}

export function resetProfile() {
  safeDel(PROFILE_KEY);
  safeDel(RUN_KEY);
  return defaultProfile();
}

export function loadRun() {
  const raw = safeGet(RUN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}
export function saveRun(r) {
  safeSet(RUN_KEY, JSON.stringify(r));
}
export function clearRun() {
  safeDel(RUN_KEY);
}
