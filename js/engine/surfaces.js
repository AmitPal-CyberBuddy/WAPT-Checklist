// Attack-surface families are the tester-facing grouping.
// Page playbooks stay as packs; the assessment regroups their authored tests by surface.
import { contextHas, contextIsUnknown } from './context.js?v=1.0.0-r13';

export const SURFACES = Object.freeze([
  Object.freeze({ id: 'tls', title: 'TLS / Transport Security', summary: 'Protocols, ciphers, certificates, HTTP→HTTPS, mixed content.' }),
  Object.freeze({ id: 'headers', title: 'Security Headers', summary: 'CSP, HSTS, clickjacking, nosniff, referrer, permissions, CORP, cache.' }),
  Object.freeze({ id: 'http', title: 'HTTP / Server Configuration', summary: 'Host, methods, paths, traversal, leftovers, redirects, smuggling.' }),
  Object.freeze({ id: 'client', title: 'Client-Side Security', summary: 'DOM XSS, redirects, secrets, maps, prototype pollution, postMessage, third-party JS.' }),
  Object.freeze({ id: 'auth', title: 'Authentication', summary: 'Login, reset, MFA, enumeration, credential transport.' }),
  Object.freeze({ id: 'session', title: 'Session Management', summary: 'Cookie flags, fixation, logout, tokens in URLs.' }),
  Object.freeze({ id: 'authz', title: 'Authorization', summary: 'IDOR/BOLA, privilege, mass assignment, admin access.' }),
  Object.freeze({ id: 'upload', title: 'File Upload / Download', summary: 'Type confusion, XSS in files, filename traversal, download IDOR.' }),
  Object.freeze({ id: 'api', title: 'API', summary: 'Auth, object/function authorization, verb swaps, mass assignment, SSRF-shaped fields.' }),
  Object.freeze({ id: 'graphql', title: 'GraphQL', summary: 'Introspection, node(id), field/mutation authorization, batching, cost.' }),
  Object.freeze({ id: 'jwt', title: 'JWT / Bearer Tokens', summary: 'alg=none, key confusion, claims, expiry, tokens in URLs.' }),
  Object.freeze({ id: 'oauth', title: 'OAuth / SSO / SAML', summary: 'redirect_uri, state, PKCE, code reuse, SAML signatures.' }),
  Object.freeze({ id: 'websocket', title: 'WebSocket / Realtime', summary: 'WSS, Origin, socket auth, per-message authorization.' }),
  Object.freeze({ id: 'business', title: 'Business Logic', summary: 'Checkout, races, coupons, workflow invariants.' }),
  Object.freeze({ id: 'ai', title: 'AI / LLM', summary: 'Prompt injection, tool calls, retrieval authorization.' })
]);

const GROUP_SURFACE = Object.freeze({
  transport: 'tls',
  headers: 'headers',
  'host-authority': 'http',
  paths: 'http',
  client: 'client',
  dom: 'client',
  trust: 'client',
  xss: 'client',
  enumeration: 'auth',
  'reset-session': 'auth',
  identity: 'auth',
  activation: 'auth',
  mail: 'auth',
  token: 'auth',
  flags: 'session',
  lifecycle: 'session',
  authz: 'authz',
  change: 'authz',
  access: 'authz',
  'authz-abuse': 'authz',
  accept: 'upload',
  retrieve: 'upload',
  amounts: 'business',
  pay: 'business',
  protocol: 'api',
  schema: 'graphql',
  graphql: 'graphql',
  handshake: 'websocket',
  messages: 'websocket',
  oauth: 'oauth',
  saml: 'oauth',
  crypto: 'jwt',
  claims: 'jwt',
  injection: 'http'
});

const PLAYBOOK_SURFACE = Object.freeze({
  'static-page': 'http',
  'login-page': 'auth',
  registration: 'auth',
  'password-reset': 'auth',
  'account-profile': 'authz',
  session: 'session',
  'file-upload': 'upload',
  'search-page': 'http',
  checkout: 'business',
  'admin-panel': 'authz',
  'api-endpoint': 'api',
  graphql: 'graphql',
  websocket: 'websocket',
  'oauth-sso': 'oauth',
  'jwt-token': 'jwt',
  'spa-client': 'client'
});

const HIDDEN_ON_STATIC = new Set(['auth', 'session', 'authz', 'upload', 'api', 'graphql', 'jwt', 'oauth', 'websocket', 'business', 'ai']);

// Catalog item.category → attack-surface family. Used when a catalog item has no
// authored playbook overlay to pin a more specific surface. Static keeps cloud-storage,
// rate-limiting, and advanced grouped under http so a static site never lights up
// upload / business / AI surfaces (which STATIC_NA_CATEGORIES already excludes).
export const CATEGORY_SURFACE = Object.freeze({
  reconnaissance: 'http',
  http: 'http',
  'security-headers': 'headers',
  'information-disclosure': 'http',
  'client-side': 'client',
  xss: 'client',
  csrf: 'session',
  authentication: 'auth',
  'session-management': 'session',
  authorization: 'authz',
  'file-handling': 'upload',
  'api-security': 'api',
  graphql: 'graphql',
  jwt: 'jwt',
  'oauth-sso-saml': 'oauth',
  ssrf: 'api',
  'request-smuggling': 'http',
  'business-logic': 'business',
  'race-conditions': 'business',
  websocket: 'websocket',
  'cloud-storage': 'http',
  'rate-limiting': 'http',
  advanced: 'http',
  'ai-llm-security': 'ai'
});

// Surface for a catalog item: an authored overlay's own surface, then the overlay's
// playbook group surface, then the category default.
export function surfaceForItem(item, overlay = null, group = null) {
  if (overlay?.surface && SURFACES.some(({ id }) => id === overlay.surface)) return overlay.surface;
  if (group?.surface && SURFACES.some(({ id }) => id === group.surface)) return group.surface;
  if (item?.category && CATEGORY_SURFACE[item.category]) return CATEGORY_SURFACE[item.category];
  return 'http';
}

export function surfaceFor(check, group, playbook) {
  if (check?.surface && SURFACES.some(({ id }) => id === check.surface)) return check.surface;
  if (group?.surface && SURFACES.some(({ id }) => id === group.surface)) return group.surface;
  if (group?.id && GROUP_SURFACE[group.id]) return GROUP_SURFACE[group.id];
  if (playbook?.id && PLAYBOOK_SURFACE[playbook.id]) return PLAYBOOK_SURFACE[playbook.id];
  return 'http';
}

export function surfaceMeta(id) {
  return SURFACES.find((surface) => surface.id === id) || { id, title: id, summary: '' };
}

// Why is this category in the plan? Every rule names the context answer that put it
// here, so the tester can audit the plan and knows what to change to remove it.
const SURFACE_RULES = Object.freeze([
  { id: 'tls', key: null, label: 'Applies to every external web assessment.' },
  { id: 'headers', key: null, label: 'Applies to every external web assessment.' },
  { id: 'http', key: null, label: 'Applies to every external web assessment.' },
  { id: 'client', key: 'app_type', values: ['server_rendered', 'spa', 'hybrid'], label: 'The application runs first-party code in a browser.', fallback: 'Browser-reachable delivery is still to confirm.' },
  { id: 'auth', key: 'has_login', values: ['yes'], label: 'User authentication is present.', fallback: 'Authentication presence is still to confirm.' },
  { id: 'session', key: 'auth_mechanism', values: ['cookie'], label: 'Cookie / session-based authentication was selected.', also: [
    { key: 'auth_mechanism', values: ['jwt'], label: 'Bearer tokens carry the authenticated session.' },
    { key: 'auth_mechanism', values: ['oauth', 'saml'], label: 'Federation sessions carry the authenticated state.' },
    { key: 'has_login', values: ['yes'], label: 'Authenticated state is in scope.' }
  ], fallback: 'Session or token handling is still to confirm.' },
  { id: 'authz', key: 'creds', values: ['low', 'high'], label: 'Authenticated test access is available.', also: [
    { key: 'roles', values: ['few', 'many'], label: 'Multiple user roles are in scope.' },
    { key: 'role_types', values: ['privileged', 'admin'], label: 'A privilege ladder exists — vertical escalation applies.' }
  ], fallback: 'Authorization depth depends on test-account access.' },
  { id: 'upload', key: 'features', values: ['file_upload'], label: 'File upload / document handling was selected.', fallback: 'File handling is still to confirm.' },
  { id: 'api', key: 'api_style', values: ['rest', 'soap', 'grpc'], label: 'HTTP APIs are in scope.', also: [
    { key: 'api_style', values: ['graphql', 'websocket'], label: 'Exposed interface styles put API-wide checks in scope.' },
    { key: 'app_type', values: ['api_only'], label: 'The scope is API-first.' }
  ], fallback: 'API presence is still to confirm.' },
  { id: 'graphql', key: 'api_style', values: ['graphql'], label: 'GraphQL was selected.', fallback: 'GraphQL is still to confirm.' },
  { id: 'jwt', key: 'auth_mechanism', values: ['jwt'], label: 'JWT / token-based authentication was selected.', fallback: 'Token type is still to confirm.' },
  { id: 'oauth', key: 'auth_mechanism', values: ['oauth', 'saml'], label: 'OAuth / SSO federation was selected.', fallback: 'Federation is still to confirm.' },
  { id: 'websocket', key: 'api_style', values: ['websocket'], label: 'WebSocket channels were selected.', fallback: 'Realtime channels are still to confirm.' },
  { id: 'business', key: 'features', values: ['payments', 'chat', 'other', 'search'], label: 'Business workflows (commerce, user content, or transactions) were selected.', fallback: 'Business workflows are still to confirm.' },
  { id: 'ai', key: 'features', values: ['ai_llm'], label: 'AI / LLM features were selected.', fallback: 'AI features are still to confirm.' }
]);

export function surfaceRationale(surfaceId, context) {
  const rule = SURFACE_RULES.find((entry) => entry.id === surfaceId);
  if (!rule) return ['Applies to this assessment context.'];
  if (!rule.key) return [rule.label];
  const lines = [];
  if (contextHas(context, rule.key, rule.values)) lines.push(rule.label);
  for (const extra of rule.also || []) {
    if (contextHas(context, extra.key, extra.values) && !lines.includes(extra.label)) lines.push(extra.label);
  }
  if (!lines.length) lines.push(contextIsUnknown(context, rule.key) ? rule.fallback : 'Applies to the current assessment context.');
  return lines;
}

// Privilege ladder for cross-role testing: the order testers should walk when
// several role tiers exist. Custom roles slot beside standard users.
export const ROLE_LADDER = Object.freeze(['admin', 'privileged', 'support', 'standard', 'custom']);

export function roleLadderLabels(roleTypes = []) {
  const present = ROLE_LADDER.filter((tier) => roleTypes.includes(tier));
  const labels = { admin: 'Administrator', privileged: 'Privileged user', support: 'Support / internal', standard: 'Standard user', custom: 'Custom roles' };
  return present.map((tier) => labels[tier]);
}


export function isHiddenSurface(id, answers = {}) {
  if (answers.app_type === 'static' && answers.has_login === 'no') return HIDDEN_ON_STATIC.has(id);
  return false;
}

export { GROUP_SURFACE, PLAYBOOK_SURFACE, HIDDEN_ON_STATIC };
