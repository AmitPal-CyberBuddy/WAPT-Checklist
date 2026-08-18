import { APPLICABILITY, evaluateApplicability } from './applicability.js';

// Coverage vocabulary (kept deliberately narrow and honest):
//
//   tested      the check was executed  (passed | potential_finding | confirmed_finding)
//   active      the tester started it   (in_progress)  — NOT tested
//   blocked     cannot be executed now  (status blocked, or credential-blocked by context) — NOT tested
//   na          out of scope            (context-N/A, or the tester marked it N/A)       — NOT executable
//   not_tested  nothing recorded yet
//
// N/A is never counted as tested and never inflates the denominator; blocked work stays in
// the denominator because it is real work that is still owed to the engagement.
export const TESTED = Object.freeze(['passed', 'potential_finding', 'confirmed_finding']);
const TESTED_SET = new Set(TESTED);

function emptyEntry(slug) {
  return {
    slug,
    total: 0,
    executable: 0,
    tested: 0,
    active: 0,
    not_tested: 0,
    blocked: 0,
    credential_blocked: 0,
    na: 0,
    na_context: 0,
    na_user: 0,
    passed: 0,
    confirmed: 0,
    potential: 0
  };
}

// Classify one item into exactly one coverage bucket plus its finding contribution.
export function classifyItem(item, applicability, status = 'not_tested') {
  const contextNa = applicability?.state === APPLICABILITY.NA_CONTEXT;
  if (contextNa) return { bucket: 'na', reason: 'na_context' };
  if (status === 'na') return { bucket: 'na', reason: 'na_user' };
  if (TESTED_SET.has(status)) return { bucket: 'tested', reason: status };
  if (status === 'blocked') return { bucket: 'blocked', reason: 'blocked_manual' };
  if (applicability?.blocked) return { bucket: 'blocked', reason: 'needs_credentials' };
  if (status === 'in_progress') return { bucket: 'active', reason: 'in_progress' };
  return { bucket: 'not_tested', reason: 'not_started' };
}

function applyTo(entry, item, applicability, status) {
  const { bucket, reason } = classifyItem(item, applicability, status);
  entry.total += 1;
  if (bucket === 'na') {
    entry.na += 1;
    if (reason === 'na_context') entry.na_context += 1;
    else entry.na_user += 1;
    return;
  }
  entry.executable += 1;
  if (applicability?.blocked) entry.credential_blocked += 1;
  if (bucket === 'tested') {
    entry.tested += 1;
    if (status === 'passed') entry.passed += 1;
    if (status === 'confirmed_finding') entry.confirmed += 1;
    if (status === 'potential_finding') entry.potential += 1;
    return;
  }
  if (bucket === 'blocked') { entry.blocked += 1; return; }
  if (bucket === 'active') { entry.active += 1; return; }
  entry.not_tested += 1;
}

const ratio = (part, whole) => (whole ? Math.round((part / whole) * 100) : null);

function finalize(entry) {
  return Object.freeze({
    ...entry,
    remaining: entry.executable - entry.tested,
    coverage: ratio(entry.tested, entry.executable)
  });
}

export function computeCoverage(items = [], context, statuses = {}) {
  const overall = emptyEntry('overall');
  const perCategory = new Map();
  for (const item of items) {
    const applicability = evaluateApplicability(item, context);
    const status = statuses[item.id] || 'not_tested';
    const entry = perCategory.get(item.category) || emptyEntry(item.category);
    applyTo(entry, item, applicability, status);
    applyTo(overall, item, applicability, status);
    perCategory.set(item.category, entry);
  }
  return Object.freeze({
    overall: finalize(overall),
    perCategory: Object.freeze([...perCategory.values()].map(finalize))
  });
}

// Coverage for an arbitrary bucket of records (used for test families), where the caller has
// already resolved applicability, including any tester override.
export function coverageOfRecords(records = [], statuses = {}, slug = 'group') {
  const entry = emptyEntry(slug);
  for (const record of records) {
    const item = record.item || record;
    const applicability = record.applicability || { state: APPLICABILITY.ACTIVE, blocked: false };
    applyTo(entry, item, applicability, statuses[item.id] || 'not_tested');
  }
  return finalize(entry);
}

export function retestQueue(state = {}) {
  const findings = Array.isArray(state.findings) ? state.findings : [];
  const pending = findings.filter(({ retest_verdict }) => retest_verdict === 'pending');
  const closed = findings.filter(({ retest_verdict }) => retest_verdict !== 'pending');
  return Object.freeze({
    pending: Object.freeze(pending),
    closed: Object.freeze(closed),
    total: findings.length
  });
}
