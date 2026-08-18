import { coverageOfRecords } from './coverage.js';

// Test families are the tester's working unit: one attack surface, its checks, its
// don't-miss variants, and the surfaces that naturally follow it. This module is pure —
// it indexes the family data, computes family coverage, and derives navigation from
// relationships that already exist in the content (item.related, attack chains, category).

// Stable 32-bit FNV-1a, used to key a don't-miss tick to its reminder text.
export function hashText(value) {
  let hash = 0x811c9dc5;
  const text = String(value ?? '');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

export function variantKey(familyId, text) {
  return `${familyId}#${hashText(text)}`;
}

export function indexFamilies(data) {
  const families = Array.isArray(data?.families) ? data.families : [];
  const byId = new Map();
  const byItem = new Map();
  const byCategory = new Map();
  const order = new Map();
  for (const [position, family] of families.entries()) {
    byId.set(family.id, family);
    order.set(family.id, position);
    for (const id of family.items || []) byItem.set(id, family);
    const list = byCategory.get(family.category) || [];
    list.push(family);
    byCategory.set(family.category, list);
  }
  return Object.freeze({ families, byId, byItem, byCategory, order });
}

export function familyVariants(family, variants = {}) {
  const entries = (family?.dont_miss || []).map((text) => {
    const key = variantKey(family.id, text);
    return { key, text, covered: variants[key] === true };
  });
  const covered = entries.filter(({ covered: flag }) => flag).length;
  return Object.freeze({ entries: Object.freeze(entries), covered, total: entries.length });
}

// Family coverage: checks by state, variant ticks, and confirmed findings — three separate
// numbers, because "check done" is not "variant covered" and neither is "finding confirmed".
export function familyCoverage(family, records = [], state = {}) {
  const statuses = state.statuses || {};
  const checks = coverageOfRecords(records, statuses, family.id);
  const variants = familyVariants(family, state.variants || {});
  return Object.freeze({
    id: family.id,
    title: family.title,
    category: family.category,
    checks,
    variants,
    findings: checks.confirmed,
    potential: checks.potential,
    complete: checks.executable > 0 && checks.tested === checks.executable && variants.covered === variants.total
  });
}

// The next check the tester has not executed inside this family, walking forward from the
// current item so "continue" follows the family order rather than restarting it.
export function nextInFamily(family, statuses = {}, fromId = '') {
  const ids = family?.items || [];
  const start = fromId ? ids.indexOf(fromId) : -1;
  const ordered = start >= 0 ? [...ids.slice(start + 1), ...ids.slice(0, start)] : ids;
  return ordered.find((id) => {
    const status = statuses[id] || 'not_tested';
    return status === 'not_tested' || status === 'in_progress';
  }) || '';
}

const WORKFLOW_ADJACENCY = Object.freeze({
  reconnaissance: ['http', 'authentication', 'api-security'],
  http: ['security-headers', 'request-smuggling', 'information-disclosure'],
  authentication: ['session-management', 'rate-limiting', 'oauth-sso-saml', 'jwt'],
  'session-management': ['authorization', 'jwt', 'csrf'],
  authorization: ['api-security', 'business-logic', 'graphql'],
  injection: ['api-security', 'file-handling', 'advanced'],
  xss: ['client-side', 'csrf', 'security-headers'],
  csrf: ['session-management', 'client-side'],
  'file-handling': ['ssrf', 'xss', 'cloud-storage'],
  'business-logic': ['race-conditions', 'authorization', 'rate-limiting'],
  'race-conditions': ['business-logic', 'api-security'],
  'api-security': ['authorization', 'graphql', 'rate-limiting'],
  graphql: ['api-security', 'authorization'],
  jwt: ['authentication', 'session-management', 'oauth-sso-saml'],
  'oauth-sso-saml': ['session-management', 'jwt'],
  websocket: ['authorization', 'api-security'],
  'client-side': ['xss', 'information-disclosure'],
  'security-headers': ['client-side', 'http'],
  'cloud-storage': ['ssrf', 'authorization', 'information-disclosure'],
  'information-disclosure': ['reconnaissance', 'client-side'],
  'rate-limiting': ['authentication', 'business-logic'],
  ssrf: ['cloud-storage', 'api-security', 'advanced'],
  'request-smuggling': ['http', 'advanced'],
  'ai-llm-security': ['api-security', 'ssrf'],
  advanced: ['http', 'authorization']
});

// "What else should I check?" — derived from data that already exists: explicit item.related
// links, shared attack chains, and the workflow adjacency of the surface. No parallel
// recommendation system, no hand-maintained duplicate graph.
export function relatedFamilies(familyId, { index, itemsById = new Map(), chains = [], limit = 6 } = {}) {
  const family = index?.byId?.get(familyId);
  if (!family) return Object.freeze([]);
  const scores = new Map();
  const add = (id, weight, reason) => {
    if (!id || id === familyId) return;
    const entry = scores.get(id) || { id, weight: 0, reasons: [] };
    entry.weight += weight;
    if (!entry.reasons.includes(reason)) entry.reasons.push(reason);
    scores.set(id, entry);
  };

  for (const itemId of family.items || []) {
    const item = itemsById.get(itemId);
    for (const relatedId of item?.related || []) {
      const target = index.byItem.get(relatedId);
      if (target) add(target.id, 6, `linked from ${itemId}`);
    }
  }

  for (const chain of chains) {
    const nodeIds = (chain.nodes || []).map(({ item_id: id }) => id);
    const own = nodeIds.map((id, position) => ((family.items || []).includes(id) ? position : -1)).filter((position) => position >= 0);
    if (!own.length) continue;
    // Only what comes *after* this family in the chain: a tester leaving object-level
    // authorization wants the next hop, not the recon step that fed it.
    const from = Math.max(...own);
    for (const id of nodeIds.slice(from + 1)) {
      const target = index.byItem.get(id);
      if (target) add(target.id, 4, `next in attack chain ${chain.id}`);
    }
  }

  for (const sibling of index.byCategory.get(family.category) || []) {
    add(sibling.id, 2, 'same attack surface');
  }

  // Adjacent surfaces, strongest first: the closer the surface sits to this one in a real
  // engagement, the higher it ranks against same-surface siblings.
  const neighbours = WORKFLOW_ADJACENCY[family.category] || [];
  for (const [position, neighbour] of neighbours.entries()) {
    const weight = Math.max(1, 3 - position);
    for (const candidate of index.byCategory.get(neighbour) || []) {
      add(candidate.id, weight, `follows ${family.category.replaceAll('-', ' ')} in the usual flow`);
    }
  }

  const ranked = [...scores.values()]
    .map((entry) => ({ ...entry, family: index.byId.get(entry.id) }))
    .filter(({ family: target }) => Boolean(target))
    .sort((left, right) => right.weight - left.weight
      || (index.order.get(left.id) ?? 0) - (index.order.get(right.id) ?? 0)
      || left.id.localeCompare(right.id));

  // Keep the answer to "what else should I check?" varied: at most three families from this
  // surface and two from any other, so adjacent surfaces are never crowded out by siblings.
  const perCategory = new Map();
  const picked = [];
  const overflow = [];
  for (const entry of ranked) {
    const used = perCategory.get(entry.family.category) || 0;
    const cap = entry.family.category === family.category ? 3 : 2;
    if (used >= cap) { overflow.push(entry); continue; }
    perCategory.set(entry.family.category, used + 1);
    picked.push(entry);
    if (picked.length === limit) break;
  }
  for (const entry of overflow) {
    if (picked.length >= limit) break;
    picked.push(entry);
  }
  return Object.freeze(picked.map((entry) => Object.freeze({
    id: entry.id, family: entry.family, weight: entry.weight, reasons: Object.freeze(entry.reasons.slice(0, 2))
  })));
}

// Families with executable work left, worst coverage first: the "what have I missed?" list.
export function familyGaps(index, recordsByFamily, state = {}, { limit = 8, category = '' } = {}) {
  const rows = [];
  for (const family of index.families) {
    if (category && family.category !== category) continue;
    const records = recordsByFamily.get(family.id) || [];
    if (!records.length) continue;
    const coverage = familyCoverage(family, records, state);
    if (coverage.checks.executable === 0) continue;
    const remaining = coverage.checks.executable - coverage.checks.tested;
    const variantsLeft = coverage.variants.total - coverage.variants.covered;
    if (remaining === 0 && variantsLeft === 0) continue;
    rows.push(Object.freeze({ family, coverage, remaining, variantsLeft, started: coverage.checks.tested > 0 || coverage.variants.covered > 0 }));
  }
  return Object.freeze(rows
    .sort((left, right) => {
      // Part-finished families first (a tester should close what they opened), then the
      // largest untouched gaps, then stable by id.
      if (left.started !== right.started) return left.started ? -1 : 1;
      if (right.remaining !== left.remaining) return right.remaining - left.remaining;
      return left.family.id.localeCompare(right.family.id);
    })
    .slice(0, limit));
}
