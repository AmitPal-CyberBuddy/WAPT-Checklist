// Attack-surface families are the tester-facing grouping.
// Page playbooks stay as packs; the assessment regroups their authored tests by surface.
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

export function isHiddenSurface(id, answers = {}) {
  if (answers.app_type === 'static' && answers.has_login === 'no') return HIDDEN_ON_STATIC.has(id);
  return false;
}

export { GROUP_SURFACE, PLAYBOOK_SURFACE, HIDDEN_ON_STATIC };
