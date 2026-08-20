import { contextHas } from './context.js';
import { APPLICABILITY, evaluateApplicability, evaluateConditionMap, isExecutable } from './applicability.js';

export const WORKFLOW_CATEGORIES = Object.freeze([
  'reconnaissance', 'http', 'authentication', 'session-management', 'authorization',
  'injection', 'xss', 'csrf', 'file-handling', 'business-logic', 'race-conditions',
  'api-security', 'graphql', 'jwt', 'oauth-sso-saml', 'websocket', 'client-side',
  'security-headers', 'cloud-storage', 'information-disclosure', 'rate-limiting',
  'ssrf', 'request-smuggling', 'ai-llm-security', 'advanced'
]);

const SEVERITY_WEIGHT = Object.freeze({ critical: 50, high: 40, medium: 28, low: 16, informational: 6 });
const READY_CHAIN_STATUSES = new Set(['passed', 'confirmed_finding']);

function categoryWeight(category) {
  const index = WORKFLOW_CATEGORIES.indexOf(category);
  return 1200 - (index < 0 ? WORKFLOW_CATEGORIES.length : index) * 40;
}

function contextualBoost(item, context) {
  let boost = 0;
  const reasons = [];
  const add = (points, code) => { boost += points; reasons.push(code); };

  if (item.category === 'authorization' && contextHas(context, 'roles', ['many'])) add(28, 'many_roles');
  if (item.category === 'authorization' && contextHas(context, 'role_types', ['privileged', 'admin'])) add(22, 'role_hierarchy');
  if (item.category === 'authorization' && contextHas(context, 'role_types', ['support', 'custom'])) add(14, 'cross_role');
  if (item.category === 'api-security' && contextHas(context, 'app_type', ['api_only'])) add(30, 'api_only');
  if (item.category === 'graphql' && contextHas(context, 'api_style', ['graphql'])) add(28, 'graphql');
  if (item.category === 'websocket' && contextHas(context, 'api_style', ['websocket'])) add(28, 'websocket');
  if (['authorization', 'api-security'].includes(item.category) && contextHas(context, 'features', ['multi_tenant'])) add(24, 'multi_tenant');
  if (['business-logic', 'race-conditions'].includes(item.category) && contextHas(context, 'features', ['payments'])) add(28, 'payments');
  if (item.category === 'session-management' && contextHas(context, 'auth_mechanism', ['cookie', 'mixed'])) add(20, 'cookie_session');
  if (item.category === 'api-security' && contextHas(context, 'url_hints.api_subdomain', [true])) add(10, 'api_url_hint');
  if (item.category === 'request-smuggling' && contextHas(context, 'intermediary', ['cdn', 'proxy', 'waf'])) add(24, 'intermediary_hops');
  if (item.category === 'ai-llm-security' && contextHas(context, 'features', ['ai_llm'])) add(28, 'ai_llm');

  if (item.priority_when && Object.keys(item.priority_when).length) {
    const condition = evaluateConditionMap(item.priority_when, context);
    if (condition.matches) add(condition.certain ? 30 : 12, condition.certain ? 'priority_when' : 'priority_when_hint');
  }
  return { boost, reasons };
}

function chainBoost(item, statuses, chains) {
  const unlockedBy = [];
  for (const chain of chains || []) {
    if (chain.next !== item.id || !Array.isArray(chain.prerequisites) || !chain.prerequisites.length) continue;
    if (chain.prerequisites.every((id) => READY_CHAIN_STATUSES.has(statuses[id]))) unlockedBy.push(chain.id || 'chain');
  }
  return { boost: Math.min(30, unlockedBy.length * 15), unlockedBy };
}

export function scoreItem(item, context, options = {}) {
  const statuses = options.statuses || {};
  const applicability = options.applicability || evaluateApplicability(item, context);
  const contextResult = contextualBoost(item, context);
  const chainResult = chainBoost(item, statuses, options.chains || []);
  const prerequisitesMet = Math.max(0, Number(options.prerequisitesMet?.[item.id] || 0));
  const breakdown = Object.freeze({
    workflow: categoryWeight(item.category),
    severity: SEVERITY_WEIGHT[item.severity] || 0,
    prerequisites: Math.min(24, prerequisitesMet * 6),
    context: contextResult.boost,
    chain: chainResult.boost,
    confirmation: applicability.state === APPLICABILITY.CONFIRM ? -8 : 0
  });
  const score = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  return Object.freeze({
    item,
    score,
    breakdown,
    applicability,
    contextReasons: Object.freeze(contextResult.reasons),
    unlockedBy: Object.freeze(chainResult.unlockedBy)
  });
}

// Tester proximity: after a check is recorded, the most useful next action is nearly always
// the uncovered variant beside it — same family first, then explicitly related tests, then the
// same attack surface. These boosts deliberately outrank the global workflow ordering, which
// only decides where to start when the tester has not touched anything yet.
const FOCUS_FAMILY_BOOST = 1500;
const RECENT_FAMILY_BOOST = 700;
const RELATED_BOOST = 500;
const NEAR_FAMILY_BOOST = 420;
const SAME_CATEGORY_BOOST = 150;

function normalizeFamilies(families) {
  const map = new Map();
  if (!(families instanceof Map)) return map;
  for (const [id, value] of families) {
    if (Array.isArray(value)) map.set(id, { id, title: id, items: value });
    else map.set(id, { id, title: value.title || id, items: value.items || [] });
  }
  return map;
}

export function suggestedNext(items, context, options = {}) {
  const statuses = options.statuses || {};
  const limit = Number.isInteger(options.limit) ? Math.max(0, options.limit) : 8;
  const recent = Array.isArray(options.recent) ? options.recent : [];
  const families = normalizeFamilies(options.families);
  const relatedByItem = options.relatedByItem instanceof Map ? options.relatedByItem : new Map();
  const itemsById = new Map(items.map((item) => [item.id, item]));

  const familyOf = new Map();
  for (const family of families.values()) for (const id of family.items) familyOf.set(id, family);

  // The focus family is whatever the tester is looking at (family workspace) or, failing that,
  // the family of the check they last recorded.
  const focusFamily = (options.focusFamily && families.get(options.focusFamily))
    || (recent.length ? familyOf.get(recent[0]) : null);
  const focusCategory = recent.length ? itemsById.get(recent[0])?.category : '';
  const recentFamilies = new Map();
  for (const id of recent) {
    const family = familyOf.get(id);
    if (family && !recentFamilies.has(family.id)) recentFamilies.set(family.id, id);
  }
  // Families the caller already knows are adjacent (shared links, chains, or workflow order).
  const nearFamilies = new Set(Array.isArray(options.nearFamilies) ? options.nearFamilies : []);
  const relatedTargets = new Map();
  for (const id of recent) for (const target of relatedByItem.get(id) || []) if (!relatedTargets.has(target)) relatedTargets.set(target, id);

  return Object.freeze(items
    .filter((item) => {
      const status = statuses[item.id] || 'not_tested';
      return status === 'not_tested' || status === 'in_progress';
    })
    .map((item) => {
      const base = scoreItem(item, context, options);
      const reasons = [];
      let bonus = 0;
      const family = familyOf.get(item.id);
      if (focusFamily && family?.id === focusFamily.id) {
        bonus += FOCUS_FAMILY_BOOST;
        reasons.push(`uncovered check in ${focusFamily.title}, the family you are working`);
      } else if (family && recentFamilies.has(family.id)) {
        bonus += RECENT_FAMILY_BOOST;
        reasons.push(`${family.title} is part-way through`);
      }
      if (family && nearFamilies.has(family.id) && (!focusFamily || family.id !== focusFamily.id)) {
        bonus += NEAR_FAMILY_BOOST;
        reasons.push(`${family.title} is adjacent to the surface you are working`);
      }
      if (relatedTargets.has(item.id)) {
        bonus += RELATED_BOOST;
        reasons.push(`linked from ${relatedTargets.get(item.id)}`);
      }
      if (!bonus && focusCategory && item.category === focusCategory) {
        bonus += SAME_CATEGORY_BOOST;
        reasons.push('same attack surface as your last test');
      }
      if ((statuses[item.id] || 'not_tested') === 'in_progress') reasons.push('already started');
      for (const chainId of base.unlockedBy) reasons.push(`unlocked by ${chainId}`);
      if (!reasons.length) reasons.push(`${item.category.replaceAll('-', ' ')} · severity ${item.severity}`);
      return Object.freeze({
        ...base,
        score: base.score + bonus,
        breakdown: Object.freeze({ ...base.breakdown, tester: bonus }),
        family: family || null,
        reasons: Object.freeze(reasons.slice(0, 3)),
        contextReasons: base.contextReasons
      });
    })
    .filter(({ applicability }) => isExecutable(applicability))
    .sort((left, right) => right.score - left.score || left.item.id.localeCompare(right.item.id))
    .slice(0, limit));
}
