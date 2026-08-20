import { contextHas, contextIsUnknown } from './context.js';

// Explainable "why is this suite relevant" signals, consumed by the checklist view.
// Active signals confirm applicability; unknown signals explain the Confirm state.
const ACTIVE_SIGNALS = Object.freeze([
  { slug: 'jwt', key: 'auth_mechanism', values: ['jwt', 'mixed'], label: 'JWT or bearer authentication is selected', confirm: 'Confirm whether JWT or bearer authentication is in scope' },
  { slug: 'oauth-sso-saml', key: 'auth_mechanism', values: ['oauth', 'saml', 'mixed'], label: 'OAuth/OIDC or SAML federation is selected', confirm: 'Confirm whether OAuth/OIDC or SAML federation is in scope' },
  { slug: 'graphql', key: 'api_style', values: ['graphql'], label: 'GraphQL is selected as an API style', confirm: 'Confirm whether GraphQL is in scope' },
  { slug: 'websocket', key: 'api_style', values: ['websocket'], label: 'WebSocket channels are selected', confirm: 'Confirm whether WebSocket channels are in scope' },
  { slug: 'ssrf', key: 'outbound_fetch', values: ['webhooks', 'import'], label: 'Outbound URL fetching is confirmed', confirm: 'Confirm whether server-side URL fetching is in scope' },
  { slug: 'ai-llm-security', key: 'features', values: ['ai_llm'], label: 'AI/LLM features are selected', confirm: 'Confirm whether AI/LLM features are in scope' }
]);

const BOOST_SIGNALS = Object.freeze([
  { slug: 'authorization', key: 'roles', values: ['many'], label: 'Many-role model boosts this suite' },
  { slug: 'authorization', key: 'role_types', values: ['privileged', 'admin'], label: 'Privileged tiers selected — vertical escalation matrix enabled' },
  { slug: 'authorization', key: 'role_types', values: ['support', 'custom'], label: 'Support or custom roles selected — cross-user access testing enabled' },
  { slug: 'authorization', key: 'features', values: ['multi_tenant'], label: 'Multi-tenant scope boosts tenant-boundary tests' },
  { slug: 'api-security', key: 'features', values: ['multi_tenant'], label: 'Multi-tenant scope boosts API isolation tests' },
  { slug: 'api-security', key: 'app_type', values: ['api_only'], label: 'API-only delivery boosts this suite' },
  { slug: 'business-logic', key: 'features', values: ['payments'], label: 'Payment workflows boost business-logic tests' },
  { slug: 'race-conditions', key: 'features', values: ['payments'], label: 'Payment workflows boost race testing' },
  { slug: 'session-management', key: 'auth_mechanism', values: ['cookie', 'mixed'], label: 'Cookie sessions boost session-lifecycle tests' },
  { slug: 'request-smuggling', key: 'intermediary', values: ['cdn', 'proxy', 'waf'], label: 'Intermediary hops boost desynchronization planning' }
]);

export function categoryRationale(slug, context) {
  const reasons = [];
  for (const signal of ACTIVE_SIGNALS) {
    if (signal.slug !== slug) continue;
    if (contextHas(context, signal.key, signal.values)) reasons.push(signal.label);
    else if (contextIsUnknown(context, signal.key)) reasons.push(signal.confirm);
  }
  for (const signal of BOOST_SIGNALS) {
    if (signal.slug === slug && contextHas(context, signal.key, signal.values)) reasons.push(signal.label);
  }
  return reasons;
}
