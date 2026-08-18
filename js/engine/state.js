import { normalizeScopeAnswers } from './context.js';

export const STATE_KEY = 'wapt.state.v1';
export const STATE_SCHEMA_VERSION = 3;
export const LEGACY_STATE_SCHEMA_VERSIONS = Object.freeze([1, 2]);
// Coverage state of one check. 'blocked' means the tester cannot execute it right now
// (environment, credentials, or client instruction) — it is NOT tested and NOT N/A.
export const ITEM_STATUSES = Object.freeze([
  'not_tested', 'in_progress', 'passed', 'potential_finding', 'confirmed_finding', 'na', 'blocked'
]);
// Statuses that mean "this check has actually been executed".
export const TESTED_STATUSES = Object.freeze(['passed', 'potential_finding', 'confirmed_finding']);
// Statuses that mean "this check is not part of executable work".
export const SCOPED_OUT_STATUSES = Object.freeze(['na']);

export const FINDING_SEVERITIES = Object.freeze(['critical', 'high', 'medium', 'low', 'informational']);
export const EXPLOITABILITY_LEVELS = Object.freeze(['not_demonstrated', 'likely', 'proven']);
export const RETEST_VERDICTS = Object.freeze(['pending', 'pass', 'partial', 'fail']);
export const MAX_FINDINGS = 200;

const STATUS_SET = new Set(ITEM_STATUSES);
const SEVERITY_SET = new Set(FINDING_SEVERITIES);
const EXPLOITABILITY_SET = new Set(EXPLOITABILITY_LEVELS);
const VERDICT_SET = new Set(RETEST_VERDICTS);
const ITEM_ID = /^WAPT-[A-Z]+-\d{3}$/;
const FINDING_ID = /^find-[a-z0-9-]{4,100}$/;
// Don't-miss variant keys are "<family-id>#<content-hash>" so a tick stays attached to the
// reminder it was recorded against even if the family list is reordered.
const VARIANT_KEY = /^[a-z0-9-]{2,64}#[a-z0-9]{1,12}$/;
const POSITION_VIEWS = new Set(['dashboard', 'families', 'family', 'checklist', 'search', 'chains', 'payloads']);
const MAX_IMPORT_BYTES = 5_000_000;

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

function cleanBoolean(value) {
  return value === true;
}

function cleanEnum(value, allowed, fallback) {
  return allowed.has(value) ? value : fallback;
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

function cleanVariants(value) {
  const output = {};
  if (!isObject(value)) return output;
  for (const [key, flag] of Object.entries(value)) {
    if (VARIANT_KEY.test(key) && flag === true) output[key] = true;
  }
  return output;
}

function cleanPosition(value) {
  if (!isObject(value)) return { view: '', family: '', category: '', item: '', updated_at: null };
  const view = POSITION_VIEWS.has(value.view) ? value.view : '';
  return {
    view,
    family: typeof value.family === 'string' ? value.family.slice(0, 64).replace(/[^a-z0-9-]/g, '') : '',
    category: typeof value.category === 'string' ? value.category.slice(0, 64).replace(/[^a-z0-9-]/g, '') : '',
    item: ITEM_ID.test(value.item || '') ? value.item : '',
    updated_at: isoOrNull(value.updated_at)
  };
}

function cleanRetests(value, statuses) {
  const output = {};
  if (!isObject(value)) return output;
  for (const [id, flag] of Object.entries(value)) {
    if (ITEM_ID.test(id) && flag === true && statuses[id] === 'confirmed_finding') output[id] = true;
  }
  return output;
}

function cleanFinding(value) {
  if (!isObject(value) || typeof value.id !== 'string' || !FINDING_ID.test(value.id.trim())) return null;
  if (!ITEM_ID.test(value.item_id || '')) return null;
  return {
    id: value.id.trim().slice(0, 100),
    item_id: value.item_id,
    title: cleanText(value.title, 120),
    severity: cleanEnum(value.severity, SEVERITY_SET, 'medium'),
    endpoint: cleanText(value.endpoint, 300),
    method: cleanText(value.method, 20),
    parameter: cleanText(value.parameter, 200),
    auth_context: cleanText(value.auth_context, 200),
    precondition: cleanText(value.precondition, 2_000),
    baseline_request: cleanText(value.baseline_request, 8_000),
    test_request: cleanText(value.test_request, 8_000),
    observed_behavior: cleanText(value.observed_behavior, 2_000),
    exploitability: cleanEnum(value.exploitability, EXPLOITABILITY_SET, 'not_demonstrated'),
    reportable: cleanBoolean(value.reportable),
    cleanup_performed: cleanText(value.cleanup_performed, 2_000),
    root_cause: cleanText(value.root_cause, 2_000),
    retest_verdict: cleanEnum(value.retest_verdict, VERDICT_SET, 'pending'),
    retest_note: cleanText(value.retest_note, 2_000),
    created_at: isoOrNull(value.created_at),
    updated_at: isoOrNull(value.updated_at)
  };
}

function cleanFindings(value) {
  const output = [];
  if (!Array.isArray(value)) return output;
  const seen = new Set();
  for (const candidate of value.slice(0, MAX_FINDINGS)) {
    const finding = cleanFinding(candidate);
    if (!finding || seen.has(finding.id)) continue;
    seen.add(finding.id);
    output.push(finding);
  }
  return output;
}

export function createState() {
  return {
    schema_version: STATE_SCHEMA_VERSION,
    engagement: { name: '', targetUrl: '', started_at: null },
    answers: normalizeScopeAnswers(),
    statuses: {},
    notes: {},
    overrides: {},
    retests: {},
    variants: {},
    position: { view: '', family: '', category: '', item: '', updated_at: null },
    findings: [],
    updated_at: null
  };
}

function normalizeFields(candidate) {
  const engagement = isObject(candidate.engagement) ? candidate.engagement : {};
  const statuses = cleanStatusMap(candidate.statuses);
  return {
    engagement: {
      name: cleanText(engagement.name, 120),
      targetUrl: cleanText(engagement.targetUrl, 2048),
      started_at: isoOrNull(engagement.started_at)
    },
    answers: normalizeScopeAnswers(candidate.answers),
    statuses,
    notes: cleanNotes(candidate.notes),
    overrides: cleanOverrides(candidate.overrides),
    retests: cleanRetests(candidate.retests, statuses),
    variants: cleanVariants(candidate.variants),
    position: cleanPosition(candidate.position),
    updated_at: isoOrNull(candidate.updated_at)
  };
}

export function normalizeState(candidate, options = {}) {
  if (!isObject(candidate)) {
    if (options.strict) throw new TypeError(`State must use schema_version ${STATE_SCHEMA_VERSION}.`);
    return createState();
  }
  const version = candidate.schema_version;
  const isLegacy = LEGACY_STATE_SCHEMA_VERSIONS.includes(version);
  if (!isLegacy && version !== STATE_SCHEMA_VERSION) {
    if (options.strict) throw new TypeError(`State must use schema_version ${STATE_SCHEMA_VERSION} (legacy version 1 is migrated).`);
    return createState();
  }
  return {
    schema_version: STATE_SCHEMA_VERSION,
    ...normalizeFields(candidate),
    findings: cleanFindings(candidate.findings)
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
  return touch(current, { answers: normalizeScopeAnswers({ ...current.answers, ...(isObject(patch) ? patch : {}) }) }, now);
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

// Don't-miss variant coverage: an explicit tick that the tester covered this variant.
// It is coverage bookkeeping only and never implies a finding.
export function setVariantCovered(state, key, covered, now) {
  if (typeof key !== 'string' || !VARIANT_KEY.test(key)) throw new TypeError(`Invalid don't-miss variant key: ${key}`);
  const current = normalizeState(state);
  const variants = { ...current.variants };
  if (covered) variants[key] = true;
  else delete variants[key];
  return touch(current, { variants }, now);
}

// Where the tester currently is, so the engagement can be resumed without hunting.
export function setPosition(state, patch, now) {
  const current = normalizeState(state);
  const timestamp = nowIso(now);
  return touch(current, {
    position: cleanPosition({ ...current.position, ...(isObject(patch) ? patch : {}), updated_at: timestamp })
  }, timestamp);
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

function makeFindingId(existing) {
  let id;
  do {
    id = globalThis.crypto?.randomUUID?.()
      ? `find-${globalThis.crypto.randomUUID()}`
      : `find-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  } while (existing.has(id));
  return id;
}

const FINDING_FIELDS = Object.freeze([
  'title', 'severity', 'endpoint', 'method', 'parameter', 'auth_context', 'precondition',
  'baseline_request', 'test_request', 'observed_behavior', 'exploitability', 'reportable',
  'cleanup_performed', 'root_cause'
]);

function findingFieldValue(field, value) {
  if (field === 'title') return cleanText(value, 120);
  if (field === 'severity') return cleanEnum(value, SEVERITY_SET, 'medium');
  if (field === 'endpoint') return cleanText(value, 300);
  if (field === 'method') return cleanText(value, 20);
  if (field === 'parameter') return cleanText(value, 200);
  if (field === 'auth_context') return cleanText(value, 200);
  if (field === 'precondition') return cleanText(value, 2_000);
  if (field === 'baseline_request') return cleanText(value, 8_000);
  if (field === 'test_request') return cleanText(value, 8_000);
  if (field === 'observed_behavior') return cleanText(value, 2_000);
  if (field === 'exploitability') return cleanEnum(value, EXPLOITABILITY_SET, 'not_demonstrated');
  if (field === 'reportable') return cleanBoolean(value);
  if (field === 'cleanup_performed') return cleanText(value, 2_000);
  if (field === 'root_cause') return cleanText(value, 2_000);
  return undefined;
}

export function addFinding(state, fields, now) {
  const current = normalizeState(state);
  const itemId = fields?.item_id;
  assertItemId(itemId);
  if (current.statuses[itemId] !== 'confirmed_finding') {
    throw new TypeError('An evidence pack can be recorded only for a Confirmed Finding.');
  }
  if (current.findings.length >= MAX_FINDINGS) {
    throw new RangeError(`A maximum of ${MAX_FINDINGS} evidence packs is supported per engagement.`);
  }
  const patch = isObject(fields) ? fields : {};
  const timestamp = nowIso(now);
  const finding = {
    id: makeFindingId(new Set(current.findings.map(({ id }) => id))),
    item_id: itemId,
    title: cleanText(patch.title, 120),
    severity: cleanEnum(patch.severity, SEVERITY_SET, 'medium'),
    endpoint: cleanText(patch.endpoint, 300),
    method: cleanText(patch.method, 20),
    parameter: cleanText(patch.parameter, 200),
    auth_context: cleanText(patch.auth_context, 200),
    precondition: cleanText(patch.precondition, 2_000),
    baseline_request: cleanText(patch.baseline_request, 8_000),
    test_request: cleanText(patch.test_request, 8_000),
    observed_behavior: cleanText(patch.observed_behavior, 2_000),
    exploitability: cleanEnum(patch.exploitability, EXPLOITABILITY_SET, 'not_demonstrated'),
    reportable: cleanBoolean(patch.reportable),
    cleanup_performed: cleanText(patch.cleanup_performed, 2_000),
    root_cause: cleanText(patch.root_cause, 2_000),
    retest_verdict: 'pending',
    retest_note: '',
    created_at: timestamp,
    updated_at: timestamp
  };
  return touch(current, { findings: [...current.findings, finding] }, timestamp);
}

export function updateFinding(state, id, patch, now) {
  const current = normalizeState(state);
  const index = current.findings.findIndex(({ id: existing }) => existing === id);
  if (index < 0) throw new TypeError('Unknown evidence pack ID.');
  if (!isObject(patch)) throw new TypeError('An evidence pack update requires a field patch.');
  const updated = { ...current.findings[index] };
  for (const field of FINDING_FIELDS) {
    if (Object.hasOwn(patch, field)) updated[field] = findingFieldValue(field, patch[field]);
  }
  const timestamp = nowIso(now);
  updated.updated_at = timestamp;
  const findings = [...current.findings];
  findings[index] = updated;
  return touch(current, { findings }, timestamp);
}

export function setRetestVerdict(state, id, verdict, note, now) {
  const current = normalizeState(state);
  const index = current.findings.findIndex(({ id: existing }) => existing === id);
  if (index < 0) throw new TypeError('Unknown evidence pack ID.');
  if (!VERDICT_SET.has(verdict)) throw new TypeError(`Invalid retest verdict: ${verdict}`);
  const updated = {
    ...current.findings[index],
    retest_verdict: verdict,
    retest_note: cleanText(note, 2_000),
    updated_at: nowIso(now)
  };
  const findings = [...current.findings];
  findings[index] = updated;
  return touch(current, { findings }, now);
}

export function removeFinding(state, id, now) {
  const current = normalizeState(state);
  if (!current.findings.some(({ id: existing }) => existing === id)) throw new TypeError('Unknown evidence pack ID.');
  return touch(current, { findings: current.findings.filter(({ id: existing }) => existing !== id) }, now);
}

export function serializeState(state) {
  return JSON.stringify(normalizeState(state), null, 2);
}

export function importState(json) {
  if (typeof json !== 'string') throw new TypeError('Imported state must be JSON text.');
  if (new TextEncoder().encode(json).length > MAX_IMPORT_BYTES) throw new RangeError('Imported state exceeds the 5 MB limit.');
  let candidate;
  try { candidate = JSON.parse(json); }
  catch (error) { throw new SyntaxError(`Imported state is not valid JSON: ${error.message}`); }
  return normalizeState(candidate, { strict: true });
}
