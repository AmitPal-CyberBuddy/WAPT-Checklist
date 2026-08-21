// Compact application profile — the tester-facing scope.
// Maps onto the existing 18-answer engine so applicability, families, and playbooks stay valid.
import { normalizeScopeAnswers } from './context.js?v=1.0.0-r13';

export const APP_TYPES = Object.freeze([
  ['static', 'Static website', 'Published files. No first-party runtime backend.'],
  ['server_rendered', 'Dynamic web application', 'HTML composed by the server.'],
  ['spa', 'Single-page application', 'Client-rendered shell backed by services.'],
  ['hybrid', 'Hybrid web application', 'Mixed server and client rendering.'],
  ['api_only', 'REST API / mobile backend', 'No first-party browser UI.'],
  ['graphql', 'GraphQL API', 'GraphQL queries, mutations, or subscriptions.'],
  ['websocket', 'WebSocket application', 'Persistent bidirectional messages.']
]);

export const AUTH_OPTIONS = Object.freeze([
  ['none', 'No authentication', 'No user identity flow in scope.'],
  ['password', 'Username / password', 'Password sign-in or password changes.'],
  ['mfa', 'OTP / MFA', 'Additional factors, OTPs, or recovery codes.'],
  ['oauth', 'OAuth / SSO', 'Delegated authorization, OIDC, or SAML.'],
  ['jwt', 'JWT / bearer', 'JSON Web Tokens or similar bearer flows.'],
  ['cookie', 'Cookie session', 'Browser ambient session cookies.']
]);

export const FEATURE_OPTIONS = Object.freeze([
  ['none', 'None of these', 'No listed application workflow.'],
  ['file_upload', 'File upload', 'Upload, import, preview, or conversion.'],
  ['search', 'Search', 'Queries, filters, exports, indexing.'],
  ['registration', 'User registration', 'Open or self-service signup.'],
  ['payments', 'Payment / checkout', 'Price, coupon, credit, or settlement.'],
  ['admin', 'Admin panel', 'Privileged UI or many roles.'],
  ['api', 'API', 'First-party HTTP API besides the page itself.'],
  ['webhooks', 'Webhooks', 'Outbound callbacks or provider notifications.'],
  ['ai_llm', 'AI / LLM', 'Prompts, retrieval, tool calls, generated content.'],
  ['chat', 'Chat / user content', 'User-to-user content and delivery.']
]);

function list(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

export function answersToProfile(answers = {}) {
  let appType = answers.app_type || 'unknown';
  const api = list(answers.api_style);
  if (appType === 'api_only' && api.includes('graphql')) appType = 'graphql';
  else if (api.includes('websocket') && (appType === 'spa' || appType === 'hybrid')) appType = 'websocket';

  const auth = [];
  if (answers.has_login === 'no' || list(answers.auth_mechanism).includes('none')) auth.push('none');
  else {
    const identity = list(answers.identity_features);
    const mech = list(answers.auth_mechanism);
    if (identity.includes('password')) auth.push('password');
    if (identity.includes('mfa')) auth.push('mfa');
    if (mech.includes('oauth') || mech.includes('saml')) auth.push('oauth');
    if (mech.includes('jwt')) auth.push('jwt');
    if (mech.includes('cookie')) auth.push('cookie');
    if (!auth.length && answers.has_login === 'yes') auth.push('password');
  }
  if (!auth.length) auth.push('unknown');

  const features = [];
  const raw = list(answers.features).filter((value) => value !== 'unknown');
  if (raw.includes('none')) features.push('none');
  else {
    for (const value of raw) {
      if (['file_upload', 'search', 'payments', 'ai_llm', 'chat'].includes(value)) features.push(value);
    }
    if (answers.registration === 'yes') features.push('registration');
    if (answers.roles === 'many') features.push('admin');
    if (api.includes('rest') && answers.app_type !== 'api_only') features.push('api');
    if (list(answers.outbound_fetch).includes('webhooks')) features.push('webhooks');
    if (!features.length) features.push('unknown');
  }
  return { app_type: appType, auth: [...new Set(auth)], features: [...new Set(features)] };
}

export function profileToAnswers(profile = {}, current = {}) {
  const base = { ...current };
  const type = profile.app_type;
  if (type === 'static') base.app_type = 'static';
  else if (type === 'graphql') {
    base.app_type = 'api_only';
    base.api_style = ['graphql'];
  } else if (type === 'websocket') {
    base.app_type = base.app_type === 'api_only' ? 'api_only' : 'spa';
    const api = list(base.api_style).filter((value) => value !== 'none' && value !== 'unknown');
    if (!api.includes('websocket')) base.api_style = [...api, 'websocket'];
  } else if (type === 'api_only') {
    base.app_type = 'api_only';
    if (!list(base.api_style).includes('rest') && !list(base.api_style).includes('graphql')) base.api_style = ['rest'];
  } else if (type && type !== 'unknown') {
    base.app_type = type;
  }

  const auth = list(profile.auth);
  if (auth.includes('none')) {
    base.has_login = 'no';
    base.creds = 'none';
    base.registration = 'no';
    base.roles = 'none';
    base.auth_mechanism = ['none'];
    base.identity_features = ['none'];
  } else if (auth.some((value) => value !== 'unknown')) {
    base.has_login = 'yes';
    if (!base.creds || base.creds === 'none' || base.creds === 'unknown') base.creds = 'high';
    const mech = [];
    if (auth.includes('jwt')) mech.push('jwt');
    if (auth.includes('cookie')) mech.push('cookie');
    if (auth.includes('oauth')) mech.push('oauth');
    if (!mech.length) mech.push('cookie');
    base.auth_mechanism = mech;
    const identity = [];
    if (auth.includes('password')) identity.push('password');
    if (auth.includes('mfa')) identity.push('mfa');
    if (auth.includes('oauth')) identity.push('recovery');
    if (!identity.length) identity.push('password');
    base.identity_features = identity;
  }

  const features = list(profile.features);
  if (features.includes('none')) {
    if (type === 'static') {
      base.api_style = ['none'];
      base.features = ['none'];
      base.backend = ['none'];
      base.database = ['none'];
      base.outbound_fetch = ['none'];
      base.async_jobs = 'no';
      base.api_docs = 'none';
    } else {
      base.features = ['none'];
    }
  } else if (features.some((value) => value !== 'unknown')) {
    const mapped = features.filter((value) => ['file_upload', 'search', 'payments', 'ai_llm', 'chat'].includes(value));
    base.features = mapped.length ? mapped : ['other'];
    if (features.includes('registration')) base.registration = 'yes';
    if (features.includes('admin')) base.roles = 'many';
    if (features.includes('webhooks')) base.outbound_fetch = ['webhooks'];
    if (features.includes('api') && type !== 'api_only' && type !== 'graphql') {
      const api = list(base.api_style).filter((value) => value !== 'none' && value !== 'unknown');
      base.api_style = api.includes('rest') ? api : [...api, 'rest'];
    }
  }

  if (type === 'static' && auth.includes('none') && (features.includes('none') || !features.length)) {
    base.mode = base.mode && base.mode !== 'unknown' ? base.mode : 'black_box';
    base.source_access = 'none';
  }
  return normalizeScopeAnswers(base);
}

export function profileIsScoped(profile = {}) {
  return Boolean(profile.app_type && profile.app_type !== 'unknown');
}

// A context "carries" an assessment once the tester has committed to anything
// meaningful about it — delivery, authentication, access, or accounts. Assessment
// presets always qualify (they answer mode/creds/has_login up front) even when
// delivery is deliberately left open as a follow-up.
export function answersCarryContext(answers = {}) {
  if (profileIsScoped(answersToProfile(answers))) return true;
  for (const key of ['mode', 'creds', 'has_login', 'registration', 'roles', 'app_type']) {
    const value = answers[key];
    if (value && value !== 'unknown') return true;
  }
  return false;
}
