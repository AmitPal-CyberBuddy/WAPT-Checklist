import { normalizeAnswers } from './context.js';

export const STATE_KEY = 'wapt.state.v1';
export const STATE_SCHEMA_VERSION = 1;
export const ITEM_STATUSES = Object.freeze([
  'not_tested', 'in_progress', 'passed', 'potential_finding', 'confirmed_finding', 'na'
]);

const STATUS_SET = new Set(ITEM_STATUSES);
const ITEM_ID = /^WAPT-[A-Z]+-\d{3}$/;
const MAX_IMPORT_BYTES = 1_000_000;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isoOrNull(value) {
  if (typeof value !== 'string' || !value || Number.isNaN(Date.parse(value))) return null;
  return value;
}

function nowIso(now) {
  if (typeof now === 'string' && !Number.isNaN(Date.parse(now))) return now;
  if (now instanceof Date && !Number.isNaN(now.getTime())) return now.toISOString();
  return new Date().toISOString();
}

function cleanText(value, maximum) {
  return typeof value === 'string' ? value.slice(0, maximum) : '';
}

function cleanStatusMap(value) {
  const output = {};
  if (!isObject(value)) return output;
  for (const [id, status] of Object.entries(value)) {
    if (ITEM_ID.test(id) && STATUS_SET.has(status) && status !== 'not_tested') output[id] = status;
  }
  return output;
}

function cleanNotes(value) {
  const output = {};
  if (!isObject(value)) return output;
  for (const [id, note] of Object.entries(value)) {
    if (ITEM_ID.test(id) && typeof note === 'string' && note.trim()) output[id] = note.slice(0, 20_000);
  }
  return output;
}

function cleanOverrides(value) {
  const output = {};
  if (!isObject(value)) return output;
  for (const [id, override] of Object.entries(value)) {
    if (!ITEM_ID.test(id) || !isObject(override) || !override.active || typeof override.reason !== 'string' || !override.reason.trim()) continue;
    output[id] = {
      active: true,
      reason: override.reason.slice(0, 2_000),
      updated_at: isoOrNull(override.updated_at)
    };
  }
  return output;
}

function cleanRetests(value, statuses) {
  const output = {};
  if (!isObject(value)) return output;
  for (const [id, flag] of Object.entries(value)) {
    if (ITEM_ID.test(id) && flag === true && statuses[id] === 'confirmed_finding') output[id] = true;
  }
  return output;
}

export function createState() {
  return {
    schema_version: STATE_SCHEMA_VERSION,
    engagement: { name: '', targetUrl: '', started_at: null },
    answers: normalizeAnswers(),
    statuses: {},
    notes: {},
    overrides: {},
    retests: {},
    updated_at: null
  };
}

export function normalizeState(candidate, options = {}) {
  if (!isObject(candidate) || candidate.schema_version !== STATE_SCHEMA_VERSION) {
    if (options.strict) throw new TypeError(`State must use schema_version ${STATE_SCHEMA_VERSION}.`);
    return createState();
  }

  const engagement = isObject(candidate.engagement) ? candidate.engagement : {};
  const statuses = cleanStatusMap(candidate.statuses);
  return {
    schema_version: STATE_SCHEMA_VERSION,
    engagement: {
      name: cleanText(engagement.name, 120),
      targetUrl: cleanText(engagement.targetUrl, 2048),
      started_at: isoOrNull(engagement.started_at)
    },
    answers: normalizeAnswers(candidate.answers),
    statuses,
    notes: cleanNotes(candidate.notes),
    overrides: cleanOverrides(candidate.overrides),
    retests: cleanRetests(candidate.retests, statuses),
    updated_at: isoOrNull(candidate.updated_at)
  };
}

function assertItemId(id) {
  if (!ITEM_ID.test(id)) throw new TypeError(`Invalid checklist item ID: ${id}`);
}

function touch(state, patch, now) {
  return { ...state, ...patch, updated_at: nowIso(now) };
}

export function setEngagement(state, patch, now) {
  const current = normalizeState(state);
  const next = {
    ...current.engagement,
    ...(isObject(patch) ? patch : {})
  };
  return touch(current, {
    engagement: {
      name: cleanText(next.name, 120),
      targetUrl: cleanText(next.targetUrl, 2048),
      started_at: isoOrNull(next.started_at)
    }
  }, now);
}

export function setAnswers(state, patch, now) {
  const current = normalizeState(state);
  return touch(current, { answers: normalizeAnswers({ ...current.answers, ...(isObject(patch) ? patch : {}) }) }, now);
}

export function setItemStatus(state, id, status, now) {
  assertItemId(id);
  if (!STATUS_SET.has(status)) throw new TypeError(`Invalid item status: ${status}`);
  const current = normalizeState(state);
  const statuses = { ...current.statuses };
  const retests = { ...current.retests };
  if (status === 'not_tested') delete statuses[id];
  else statuses[id] = status;
  if (status !== 'confirmed_finding') delete retests[id];
  return touch(current, { statuses, retests }, now);
}

export function setItemNote(state, id, note, now) {
  assertItemId(id);
  const current = normalizeState(state);
  const notes = { ...current.notes };
  const clean = cleanText(note, 20_000);
  if (clean.trim()) notes[id] = clean;
  else delete notes[id];
  return touch(current, { notes }, now);
}

export function setOverride(state, id, reason, now) {
  assertItemId(id);
  if (typeof reason !== 'string' || !reason.trim()) throw new TypeError('An applicability override requires a reason.');
  const current = normalizeState(state);
  const updatedAt = nowIso(now);
  return touch(current, {
    overrides: {
      ...current.overrides,
      [id]: { active: true, reason: reason.slice(0, 2_000), updated_at: updatedAt }
    }
  }, updatedAt);
}

export function clearOverride(state, id, now) {
  assertItemId(id);
  const current = normalizeState(state);
  const overrides = { ...current.overrides };
  delete overrides[id];
  return touch(current, { overrides }, now);
}

export function setRetestFlag(state, id, enabled, now) {
  assertItemId(id);
  const current = normalizeState(state);
  if (enabled && current.statuses[id] !== 'confirmed_finding') {
    throw new TypeError('Retest can be enabled only for a Confirmed Finding.');
  }
  const retests = { ...current.retests };
  if (enabled) retests[id] = true;
  else delete retests[id];
  return touch(current, { retests }, now);
}

export function serializeState(state) {
  return JSON.stringify(normalizeState(state), null, 2);
}

export function importState(json) {
  if (typeof json !== 'string') throw new TypeError('Imported state must be JSON text.');
  if (new TextEncoder().encode(json).length > MAX_IMPORT_BYTES) throw new RangeError('Imported state exceeds the 1 MB limit.');
  let candidate;
  try { candidate = JSON.parse(json); }
  catch (error) { throw new SyntaxError(`Imported state is not valid JSON: ${error.message}`); }
  return normalizeState(candidate, { strict: true });
}
