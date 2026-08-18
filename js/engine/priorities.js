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

export function suggestedNext(items, context, options = {}) {
  const statuses = options.statuses || {};
  const limit = Number.isInteger(options.limit) ? Math.max(0, options.limit) : 8;
  const recent = Array.isArray(options.recent) ? options.recent : [];
  const families = options.families instanceof Map ? options.families : new Map();
  const relatedByItem = options.relatedByItem instanceof Map ? options.relatedByItem : new Map();

  // Tester-aware signals: related to recently touched work, and continuing a
  // family the tester is part-way through. Bounded, deterministic, additive.
  const recentSet = new Set(recent);
  const relatedTargets = new Set();
  for (const id of recent) for (const target of relatedByItem.get(id) || []) relatedTargets.add(target);
  const activeFamilies = new Set();
  for (const [familyId, memberIds] of families) {
    if (recent.some((id) => memberIds.includes(id))) activeFamilies.add(familyId);
  }
  const relatedBoost = 18;
  const familyBoost = 16;

  return Object.freeze(items
    .filter((item) => (statuses[item.id] || 'not_tested') === 'not_tested')
    .map((item) => {
      const base = scoreItem(item, context, options);
      const testerReasons = [];
      let bonus = 0;
      if (relatedTargets.has(item.id)) {
        bonus += relatedBoost;
        testerReasons.push('related to a test you just worked on');
      }
      if (families.size) {
        for (const [familyId, memberIds] of families) {
          if (activeFamilies.has(familyId) && memberIds.includes(item.id)) {
            bonus += familyBoost;
            testerReasons.push('continues a family you are part-way through');
            break;
          }
        }
      }
      if (!bonus) return base;
      return Object.freeze({
        ...base,
        score: base.score + bonus,
        breakdown: Object.freeze({ ...base.breakdown, tester: bonus }),
        contextReasons: Object.freeze([...base.contextReasons, ...testerReasons])
      });
    })
    .filter(({ applicability }) => isExecutable(applicability))
    .sort((left, right) => right.score - left.score || left.item.id.localeCompare(right.item.id))
    .slice(0, limit));
}
