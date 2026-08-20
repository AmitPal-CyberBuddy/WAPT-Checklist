const UNKNOWN = 'unknown';

export const ATTRIBUTE_OPTIONS = Object.freeze({
  mode: Object.freeze(['black_box', 'grey_box', 'white_box', UNKNOWN]),
  creds: Object.freeze(['none', 'low', 'high', UNKNOWN]),
  app_type: Object.freeze(['server_rendered', 'spa', 'static', 'hybrid', 'api_only', UNKNOWN]),
  has_login: Object.freeze(['yes', 'no', UNKNOWN]),
  registration: Object.freeze(['yes', 'no', UNKNOWN]),
  roles: Object.freeze(['none', 'one', 'few', 'many', UNKNOWN]),
  role_types: Object.freeze(['none', 'standard', 'privileged', 'admin', 'support', 'custom', UNKNOWN]),
  auth_mechanism: Object.freeze(['none', 'cookie', 'jwt', 'oauth', 'saml', 'ldap', 'mixed', UNKNOWN]),
  identity_features: Object.freeze(['password', 'mfa', 'passkey', 'recovery', 'passwordless', 'remember_device', 'none', UNKNOWN]),
  api_docs: Object.freeze(['openapi', 'none', UNKNOWN]),
  source_access: Object.freeze(['full', 'partial', 'none', UNKNOWN]),
  backend: Object.freeze(['none', 'node', 'java', 'dotnet', 'python', 'php', 'ruby', 'go', 'other', UNKNOWN]),
  api_style: Object.freeze(['rest', 'graphql', 'soap', 'websocket', 'grpc', 'none', UNKNOWN]),
  database: Object.freeze(['sql', 'nosql', 'ldap', 'other', 'none', UNKNOWN]),
  cloud: Object.freeze(['aws', 'gcp', 'azure', 'self_hosted', 'none', 'other', UNKNOWN]),
  features: Object.freeze(['file_upload', 'payments', 'search', 'email', 'chat', 'multi_tenant', 'mobile_api', 'ai_llm', 'other', 'none', UNKNOWN]),
  intermediary: Object.freeze(['cdn', 'proxy', 'waf', 'none', UNKNOWN]),
  outbound_fetch: Object.freeze(['webhooks', 'import', 'none', UNKNOWN]),
  async_jobs: Object.freeze(['yes', 'no', UNKNOWN])
});

// Which role tiers exist across the authenticated surface. Feeds the cross-role /
// privilege-hierarchy parts of the plan; only meaningful with more than one role.
export const MULTI_ATTRIBUTES = Object.freeze(new Set(['auth_mechanism', 'identity_features', 'role_types', 'backend', 'api_style', 'database', 'features', 'intermediary', 'outbound_fetch']));
export const URL_HINT_KEYS = Object.freeze([
  'plain_http', 'unusual_tls_port', 'api_subdomain', 'admin_subdomain',
  'nonproduction_subdomain', 'punycode_hostname'
]);

const PRIVATE_V4 = /^(?:127\.|10\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/;
const DOCUMENTATION_V4 = /^(?:192\.0\.2\.|198\.51\.100\.|203\.0\.113\.)/;

function unknownValue(attribute) {
  return MULTI_ATTRIBUTES.has(attribute) ? [UNKNOWN] : UNKNOWN;
}

function cleanMulti(value, allowed) {
  const candidates = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  const unique = [...new Set(candidates.filter((entry) => allowed.includes(entry)))];
  if (!unique.length || unique.includes(UNKNOWN)) return [UNKNOWN];
  if (unique.includes('none')) return ['none'];
  return unique;
}

function cleanSingle(value, allowed) {
  return allowed.includes(value) ? value : UNKNOWN;
}

function isIpv6Denied(host) {
  const bare = host.replace(/^\[|\]$/g, '').toLowerCase();
  return bare === '::1' || bare.startsWith('fe80:') || bare.startsWith('fc') || bare.startsWith('fd');
}

export function deriveUrlHints(rawUrl) {
  const empty = Object.fromEntries(URL_HINT_KEYS.map((key) => [key, false]));
  const result = { accepted: false, hints: empty, evidence: {}, reason: 'empty' };
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return result;
  if (rawUrl.length > 2048 || /[\u0000-\u001f\u007f]/.test(rawUrl)) return { ...result, reason: 'invalid_characters' };

  let parsed;
  try { parsed = new URL(rawUrl); }
  catch { return { ...result, reason: 'invalid_url' }; }

  if (!['http:', 'https:'].includes(parsed.protocol)) return { ...result, reason: 'unsupported_scheme' };
  if (parsed.username || parsed.password) return { ...result, reason: 'credentials_in_url' };

  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || PRIVATE_V4.test(host) || isIpv6Denied(host)) {
    return { ...result, reason: 'denied_host' };
  }

  const hints = { ...empty };
  const evidence = {};
  const add = (key, detail) => { hints[key] = true; evidence[key] = detail; };
  const firstLabel = host.split('.')[0];

  if (parsed.protocol === 'http:') add('plain_http', 'URL uses the http scheme');
  if (['8443', '9443'].includes(parsed.port)) add('unusual_tls_port', `URL uses port ${parsed.port}`);
  if (firstLabel === 'api') add('api_subdomain', 'Left-most hostname label is api');
  if (firstLabel === 'admin') add('admin_subdomain', 'Left-most hostname label is admin');
  if (['dev', 'staging'].includes(firstLabel)) add('nonproduction_subdomain', `Left-most hostname label is ${firstLabel}`);
  if (host.split('.').some((label) => label.startsWith('xn--'))) add('punycode_hostname', 'Hostname contains an xn-- label');

  return {
    accepted: true,
    hints,
    evidence,
    reason: DOCUMENTATION_V4.test(host) ? 'documentation_address' : null
  };
}

export function normalizeAnswers(answers = {}) {
  const source = answers && typeof answers === 'object' && !Array.isArray(answers) ? answers : {};
  return Object.fromEntries(Object.entries(ATTRIBUTE_OPTIONS).map(([attribute, allowed]) => [
    attribute,
    MULTI_ATTRIBUTES.has(attribute) ? cleanMulti(source[attribute], allowed) : cleanSingle(source[attribute], allowed)
  ]));
}

// Cross-field reconciliation prevents hidden, stale answers from influencing applicability.
export function normalizeScopeAnswers(answers = {}) {
  const normalized = normalizeAnswers(answers);
  if (normalized.mode === 'black_box') normalized.source_access = 'none';
  if (normalized.has_login === 'no') {
    Object.assign(normalized, { creds: 'none', registration: 'no', roles: 'none', role_types: ['none'], auth_mechanism: ['none'], identity_features: ['none'] });
  }
  if (normalized.roles === 'none') normalized.role_types = ['none'];
  if (normalized.api_style.includes('none')) normalized.api_docs = 'none';
  if (normalized.app_type === 'static' && normalized.api_style.includes('none')) {
    normalized.backend = ['none'];
    normalized.database = ['none'];
    normalized.outbound_fetch = ['none'];
    normalized.async_jobs = 'no';
  }
  return normalized;
}

export function deriveContext(answers = {}, targetUrl = '') {
  const normalized = normalizeScopeAnswers(answers);
  const context = {};
  for (const [attribute, value] of Object.entries(normalized)) {
    const unknown = Array.isArray(value) ? value.includes(UNKNOWN) : value === UNKNOWN;
    context[attribute] = Object.freeze({ value, confidence: unknown ? 'unknown' : 'answer' });
  }

  const url = deriveUrlHints(targetUrl);
  context.url_hints = Object.freeze(Object.fromEntries(URL_HINT_KEYS.map((key) => [
    key,
    Object.freeze({
      value: url.hints[key],
      confidence: url.hints[key] ? 'url_hint' : 'unknown',
      evidence: url.evidence[key] || null
    })
  ])));
  return Object.freeze(context);
}

export function contextEntry(context, key) {
  if (key.startsWith('url_hints.')) return context?.url_hints?.[key.slice('url_hints.'.length)] || { value: false, confidence: 'unknown' };
  return context?.[key] || { value: unknownValue(key), confidence: 'unknown' };
}

export function contextHas(context, key, expectedValues) {
  const entry = contextEntry(context, key);
  const actual = Array.isArray(entry.value) ? entry.value : [entry.value];
  const expected = Array.isArray(expectedValues) ? expectedValues : [expectedValues];
  return actual.some((value) => expected.includes(value));
}

export function contextIsUnknown(context, key) {
  const entry = contextEntry(context, key);
  const values = Array.isArray(entry.value) ? entry.value : [entry.value];
  return entry.confidence === 'unknown' || values.includes(UNKNOWN);
}
