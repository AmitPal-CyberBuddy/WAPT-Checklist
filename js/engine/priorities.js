import { contextHas } from './context.js';
import { APPLICABILITY, evaluateApplicability, evaluateConditionMap, isExecutable } from './applicability.js';

export const WORKFLOW_CATEGORIES = Object.freeze([
  'reconnaissance', 'http', 'authentication', 'session-management', 'authorization',
  'injection', 'xss', 'csrf', 'file-handling', 'business-logic', 'race-conditions',
  'api-security', 'graphql', 'jwt', 'oauth-sso-saml', 'websocket', 'client-side',
  'security-headers', 'cloud-storage', 'information-disclosure', 'rate-limiting',
  'ssrf', 'request-smuggling', 'advanced'
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
  if (item.category === 'api-security' && contextHas(context, 'app_type', ['api_only'])) add(30, 'api_only');
  if (item.category === 'graphql' && contextHas(context, 'api_style', ['graphql'])) add(28, 'graphql');
  if (item.category === 'websocket' && contextHas(context, 'api_style', ['websocket'])) add(28, 'websocket');
  if (['authorization', 'api-security'].includes(item.category) && contextHas(context, 'features', ['multi_tenant'])) add(24, 'multi_tenant');
  if (['business-logic', 'race-conditions'].includes(item.category) && contextHas(context, 'features', ['payments'])) add(28, 'payments');
  if (item.category === 'session-management' && contextHas(context, 'auth_mechanism', ['cookie', 'mixed'])) add(20, 'cookie_session');
  if (item.category === 'api-security' && contextHas(context, 'url_hints.api_subdomain', [true])) add(10, 'api_url_hint');

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

export function suggestedNext(items, context, options = {}) {
  const statuses = options.statuses || {};
  const limit = Number.isInteger(options.limit) ? Math.max(0, options.limit) : 8;
  return Object.freeze(items
    .filter((item) => (statuses[item.id] || 'not_tested') === 'not_tested')
    .map((item) => scoreItem(item, context, options))
    .filter(({ applicability }) => isExecutable(applicability))
    .sort((left, right) => right.score - left.score || left.item.id.localeCompare(right.item.id))
    .slice(0, limit));
}
