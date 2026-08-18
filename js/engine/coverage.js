import { APPLICABILITY, evaluateApplicability } from './applicability.js';

// Coverage confidence: tested work divided by executable work. Context-N/A items are scoped
// out and never counted in the denominator; credential-blocked items are counted separately
// so an uncredentialed engagement cannot report misleading coverage.
export function computeCoverage(items = [], context, statuses = {}) {
  let executable = 0;
  let tested = 0;
  let blocked = 0;
  let na = 0;
  let passed = 0;
  let confirmed = 0;
  let potential = 0;

  const perCategory = new Map();
  for (const item of items) {
    const applicability = evaluateApplicability(item, context);
    const status = statuses[item.id] || 'not_tested';
    const entry = perCategory.get(item.category) || {
      slug: item.category,
      executable: 0, tested: 0, blocked: 0, na: 0, passed: 0, confirmed: 0, potential: 0
    };
    if (applicability.state === APPLICABILITY.NA_CONTEXT) {
      entry.na += 1;
      na += 1;
    } else {
      entry.executable += 1;
      executable += 1;
      if (applicability.blocked) {
        entry.blocked += 1;
        blocked += 1;
      }
      if (status !== 'not_tested') {
        entry.tested += 1;
        tested += 1;
      }
      if (status === 'passed') {
        entry.passed += 1;
        passed += 1;
      }
      if (status === 'confirmed_finding') {
        entry.confirmed += 1;
        confirmed += 1;
      }
      if (status === 'potential_finding') {
        entry.potential += 1;
        potential += 1;
      }
    }
    perCategory.set(item.category, entry);
  }

  const ratio = (part, whole) => (whole ? Math.round((part / whole) * 100) : null);
  return Object.freeze({
    overall: Object.freeze({
      executable,
      tested,
      coverage: ratio(tested, executable),
      blocked,
      na,
      passed,
      confirmed,
      potential
    }),
    perCategory: Object.freeze([...perCategory.values()].map((entry) => Object.freeze({
      ...entry,
      coverage: ratio(entry.tested, entry.executable)
    })))
  });
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
