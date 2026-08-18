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

// ---------------------------------------------------------------------------------------
// Family operator contract.
//
// Borrowed from CyberBuddy's tool registry, which states Input / Mode / Evidence / Standards
// on every card so an operator can decide "can I run this now, and what will it give my
// report?" before opening anything. Here the same question is asked of a test family — and
// every field is DERIVED from content that already exists (applicability expressions, item
// mode, tools, mappings, severity), so no new prose is introduced and nothing can drift.

const NEED_LABELS = Object.freeze({
  'has_login:yes': 'an authenticated session',
  'creds:low|high': 'test credentials',
  'creds:low': 'a low-privilege account',
  'creds:high': 'a privileged account',
  'creds:low|high|none': 'any account state',
  'roles:many': 'several roles',
  'roles:two': 'two roles',
  'roles:many|two': 'more than one role',
  'registration:yes': 'self-registration',
  'features:multi_tenant': 'a second tenant',
  'features:payments': 'a payment flow',
  'features:file_upload': 'an upload feature',
  'features:ai_llm': 'an LLM feature',
  'features:webhooks': 'webhook configuration',
  'features:search': 'a search feature',
  'features:export': 'an export feature',
  'api_style:graphql': 'a GraphQL endpoint',
  'api_style:websocket': 'a WebSocket channel',
  'api_style:rest': 'a REST API',
  'auth_mechanism:jwt': 'JWT tokens',
  'auth_mechanism:oauth': 'OAuth or SSO',
  'auth_mechanism:saml': 'SAML federation',
  'auth_mechanism:cookie': 'cookie sessions',
  'app_type:api_only': 'an API-only surface',
  'outbound_fetch:yes': 'server-side URL fetching',
  'async_jobs:yes': 'asynchronous jobs',
  'source_access:yes': 'source or configuration access',
  'intermediary:cdn': 'a CDN hop',
  'intermediary:proxy': 'a proxy hop',
  'intermediary:waf': 'a WAF in path',
  'cloud:aws': 'AWS hosting',
  'cloud:azure': 'Azure hosting',
  'cloud:gcp': 'GCP hosting'
});

const TOOL_WORKFLOWS = Object.freeze({
  'burp proxy': 'proxy', 'burp repeater': 'repeater', 'burp intruder': 'intruder',
  'burp scanner': 'scanner', 'burp comparer': 'comparer', 'burp decoder': 'decoder',
  'burp sequencer': 'sequencer', 'burp logger': 'logger', 'burp collaborator': 'collaborator',
  'burp autorize': 'autorize', autorize: 'autorize', 'param miner': 'param-miner',
  'burp param miner': 'param-miner', 'turbo intruder': 'turbo-intruder',
  'burp turbo intruder': 'turbo-intruder'
});

// Tooling that means "this family can be driven semi-automatically" — worth flagging, because
// a manual-only family and a tool-assisted family are planned differently.
const ASSISTED_TOOLS = new Set(['autorize', 'intruder', 'turbo-intruder', 'param-miner', 'scanner', 'sequencer', 'collaborator']);

const SEVERITY_ORDER = Object.freeze(['critical', 'high', 'medium', 'low', 'informational']);

function needTokens(item) {
  const applies = item.applies || {};
  const tokens = [...(applies.requires || [])];
  for (const [attribute, values] of Object.entries(applies.any_of || {})) {
    for (const value of values) tokens.push(`${attribute}:${value}`);
  }
  return tokens;
}

export function familyContract(family, items = []) {
  const members = (family.items || []).map((id) => items.find?.((item) => item.id === id) || (items.get ? items.get(id) : null)).filter(Boolean);
  const total = members.length || 1;

  const needCounts = new Map();
  for (const member of members) {
    for (const token of new Set(needTokens(member))) {
      const label = NEED_LABELS[token];
      if (!label) continue;
      needCounts.set(label, (needCounts.get(label) || 0) + 1);
    }
  }
  const needs = [...needCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 4)
    .map(([label, count]) => Object.freeze({ label, all: count >= total, count }));

  const toolCounts = new Map();
  for (const member of members) for (const tool of member.tools || []) toolCounts.set(tool, (toolCounts.get(tool) || 0) + 1);
  const tools = [...toolCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([label]) => Object.freeze({ label, workflow: TOOL_WORKFLOWS[label.toLowerCase()] || '' }));
  const workflows = tools.filter(({ workflow }) => workflow).slice(0, 4);
  const assisted = members.some((member) => member.mode === 'automated') || workflows.some(({ workflow }) => ASSISTED_TOOLS.has(workflow));

  const standardCounts = new Map();
  for (const member of members) {
    for (const [source, values] of Object.entries(member.mappings || {})) {
      if (source === 'portswigger') continue;
      for (const value of values) {
        const key = `${source}:${value}`;
        standardCounts.set(key, (standardCounts.get(key) || 0) + 1);
      }
    }
  }
  // One identifier per standard family, most-used first: enough to cite the family in a report.
  const bySource = new Map();
  for (const [key, count] of [...standardCounts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))) {
    const [source, ...rest] = key.split(':');
    if (!bySource.has(source)) bySource.set(source, rest.join(':'));
  }
  const standards = ['wstg', 'asvs', 'owasp_top10', 'api_top10', 'cwe']
    .filter((source) => bySource.has(source))
    .map((source) => Object.freeze({ source, id: bySource.get(source) }));

  const severity = SEVERITY_ORDER.find((level) => members.some((member) => member.severity === level)) || 'medium';
  const modes = new Set(members.map((member) => member.mode));

  return Object.freeze({
    id: family.id,
    needs: Object.freeze(needs),
    tools: Object.freeze(workflows),
    standards: Object.freeze(standards),
    severity,
    assisted,
    mode: modes.size > 1 ? 'mixed' : ([...modes][0] || 'manual'),
    checks: members.length
  });
}

// The boundary question CyberBuddy answers with "what it does not do": the sibling families
// that own the rest of this attack surface. Derived from the category, so it never drifts.
export function familyBoundary(familyId, index) {
  const family = index?.byId?.get(familyId);
  if (!family) return Object.freeze([]);
  return Object.freeze((index.byCategory.get(family.category) || []).filter(({ id }) => id !== familyId));
}

// Attack-surface suites: the planning unit above a family. Coverage is summed from the
// families a tester can actually execute in this engagement.
export function surfaceSuites(index, recordsByFamily, state = {}, { categoryNames = {} } = {}) {
  const suites = [];
  for (const [slug, families] of index.byCategory) {
    let tested = 0;
    let executable = 0;
    let blocked = 0;
    let na = 0;
    let confirmed = 0;
    let variantsCovered = 0;
    let variantsTotal = 0;
    let loaded = 0;
    let nextFamily = '';
    let variantOnlyFamily = '';
    for (const family of families) {
      const records = recordsByFamily.get(family.id) || [];
      if (!records.length) continue;
      loaded += 1;
      const coverage = familyCoverage(family, records, state);
      tested += coverage.checks.tested;
      executable += coverage.checks.executable;
      blocked += coverage.checks.blocked;
      na += coverage.checks.na;
      confirmed += coverage.checks.confirmed;
      variantsCovered += coverage.variants.covered;
      variantsTotal += coverage.variants.total;
      // Continue means "unexecuted work first". A family whose checks are all recorded but
      // whose don't-miss variants are still open is a review task, so it is the fallback.
      if (coverage.checks.executable > 0 && !nextFamily && coverage.checks.tested < coverage.checks.executable) nextFamily = family.id;
      if (coverage.checks.executable > 0 && !variantOnlyFamily && !coverage.complete) variantOnlyFamily = family.id;
    }
    if (!loaded) continue;
    suites.push(Object.freeze({
      slug,
      name: categoryNames[slug] || slug,
      families: families.length,
      tested,
      executable,
      blocked,
      na,
      confirmed,
      variantsCovered,
      variantsTotal,
      nextFamily: nextFamily || variantOnlyFamily,
      coverage: executable ? Math.round((tested / executable) * 100) : null,
      complete: executable > 0 && tested === executable && variantsCovered === variantsTotal
    }));
  }
  return Object.freeze(suites);
}
