// Settings, progress and per-character stats, kept in localStorage under one key. Every
// read and write is guarded, so a blocked or full storage just means nothing persists.

const KEY = 'morse.v1';

export const DEFAULTS = {
  wpm: 20, // character speed
  eff: 10, // effective (Farnsworth) speed
  tone: 600, // Hz
  volume: 0.6,
  lesson: 1,
  seconds: 60, // length of a Koch session
  stats: {}, // per character: { right, wrong, ms }
  sessions: [], // { at, lesson, accuracy, chars }
  copyKind: 'words',
  keyMode: 'straight',
};

export function load(storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage.getItem(KEY));
    if (!saved || typeof saved !== 'object') return structuredClone(DEFAULTS);
    const out = { ...structuredClone(DEFAULTS), ...saved };
    // Clamp anything that could make the trainer unusable.
    out.wpm = clampNum(out.wpm, 5, 50, DEFAULTS.wpm);
    out.eff = clampNum(out.eff, 3, out.wpm, Math.min(DEFAULTS.eff, out.wpm));
    out.tone = clampNum(out.tone, 300, 1200, DEFAULTS.tone);
    out.volume = clampNum(out.volume, 0, 1, DEFAULTS.volume);
    out.lesson = clampNum(Math.round(out.lesson), 1, 40, 1);
    out.seconds = clampNum(out.seconds, 30, 600, 60);
    if (typeof out.stats !== 'object' || Array.isArray(out.stats)) out.stats = {};
    if (!Array.isArray(out.sessions)) out.sessions = [];
    return out;
  } catch {
    return structuredClone(DEFAULTS);
  }
}

function clampNum(v, lo, hi, fallback) {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback;
}

export function save(state, storage = globalThis.localStorage) {
  try {
    storage.setItem(KEY, JSON.stringify({ ...state, sessions: state.sessions.slice(-50) }));
  } catch { /* storage unavailable */ }
}

export function clear(storage = globalThis.localStorage) {
  try {
    storage.removeItem(KEY);
  } catch { /* nothing to clear */ }
}
