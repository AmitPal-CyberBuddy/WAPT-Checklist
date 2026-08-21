import { createState, normalizeState, STATE_SCHEMA_VERSION, LEGACY_STATE_SCHEMA_VERSIONS } from './state.js?v=1.0.0-r12';

export const PORTFOLIO_KIND = 'wapt-engagement-portfolio';
export const PORTFOLIO_VERSION = 1;
export const MAX_ENGAGEMENTS = 100;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function makeId(existing = new Set()) {
  let id;
  do {
    id = globalThis.crypto?.randomUUID?.() || `eng-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  } while (existing.has(id));
  return id;
}

function cleanRecord(record) {
  if (!isObject(record) || typeof record.id !== 'string' || !record.id.trim()) return null;
  return { id: record.id.slice(0, 100), state: normalizeState(record.state) };
}

function cleanPreferences(value) {
  return { theme: value?.theme === 'light' || value?.theme === 'dark' ? value.theme : null };
}

export function createPortfolio(initialState = createState(), preferences = {}) {
  const id = makeId();
  return {
    kind: PORTFOLIO_KIND,
    portfolio_version: PORTFOLIO_VERSION,
    preferences: cleanPreferences(preferences),
    active_id: id,
    engagements: [{ id, state: normalizeState(initialState) }]
  };
}

export function normalizePortfolio(candidate) {
  const preferences = cleanPreferences(candidate?.preferences);
  // Seamlessly migrate the original single-engagement document kept under wapt.state.v1,
  // including records still written by schema version 1.
  if (isObject(candidate) && (candidate.schema_version === STATE_SCHEMA_VERSION || LEGACY_STATE_SCHEMA_VERSIONS.includes(candidate.schema_version))) {
    return createPortfolio(candidate, preferences);
  }
  if (!isObject(candidate) || candidate.kind !== PORTFOLIO_KIND || candidate.portfolio_version !== PORTFOLIO_VERSION) {
    return createPortfolio(createState(), preferences);
  }

  const seen = new Set();
  const engagements = [];
  for (const candidateRecord of Array.isArray(candidate.engagements) ? candidate.engagements : []) {
    const record = cleanRecord(candidateRecord);
    if (!record || seen.has(record.id) || engagements.length >= MAX_ENGAGEMENTS) continue;
    seen.add(record.id);
    engagements.push(record);
  }
  if (!engagements.length) return createPortfolio(createState(), preferences);
  const activeId = engagements.some(({ id }) => id === candidate.active_id) ? candidate.active_id : engagements[0].id;
  return { kind: PORTFOLIO_KIND, portfolio_version: PORTFOLIO_VERSION, preferences, active_id: activeId, engagements };
}

export function activeEngagement(portfolio) {
  const current = normalizePortfolio(portfolio);
  return current.engagements.find(({ id }) => id === current.active_id).state;
}

export function updateActiveEngagement(portfolio, nextState) {
  const current = normalizePortfolio(portfolio);
  return {
    ...current,
    engagements: current.engagements.map((record) => record.id === current.active_id
      ? { ...record, state: normalizeState(nextState) }
      : record)
  };
}

export function addEngagement(portfolio) {
  const current = normalizePortfolio(portfolio);
  if (current.engagements.length >= MAX_ENGAGEMENTS) throw new RangeError(`A maximum of ${MAX_ENGAGEMENTS} local engagements is supported.`);
  const id = makeId(new Set(current.engagements.map((record) => record.id)));
  return { ...current, active_id: id, engagements: [...current.engagements, { id, state: createState() }] };
}

export function selectEngagement(portfolio, id) {
  const current = normalizePortfolio(portfolio);
  if (!current.engagements.some((record) => record.id === id)) throw new TypeError('Unknown engagement ID.');
  return { ...current, active_id: id };
}

export function removeEngagement(portfolio, id) {
  const current = normalizePortfolio(portfolio);
  const engagements = current.engagements.filter((record) => record.id !== id);
  if (engagements.length === current.engagements.length) throw new TypeError('Unknown engagement ID.');
  if (!engagements.length) return createPortfolio(createState(), current.preferences);
  return {
    ...current,
    active_id: current.active_id === id ? engagements[0].id : current.active_id,
    engagements
  };
}
