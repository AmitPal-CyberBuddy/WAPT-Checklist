'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const contextModule = import('../js/engine/context.js');
const applicabilityModule = import('../js/engine/applicability.js');
const prioritiesModule = import('../js/engine/priorities.js');
const presetsModule = import('../js/data/presets.mjs');

function item(id, category, applies = {}, extras = {}) {
  return { id, category, severity: 'medium', applies, variants: [], ...extras };
}

async function engine() {
  const [{ deriveContext }, { APPLICABILITY, evaluateApplicability }, { scoreItem }] = await Promise.all([
    contextModule, applicabilityModule, prioritiesModule
  ]);
  return { deriveContext, APPLICABILITY, evaluateApplicability, scoreItem };
}

test('scenario: static delivery collapses dynamic suites but retains recon, headers, client, and disclosure', async () => {
  const { deriveContext, APPLICABILITY, evaluateApplicability } = await engine();
  const context = deriveContext({ app_type: 'static' });
  for (const category of ['authentication', 'session-management', 'authorization', 'business-logic', 'csrf']) {
    assert.equal(evaluateApplicability(item(`WAPT-${category === 'business-logic' ? 'BL' : 'AUTH'}-900`, category), context).state, APPLICABILITY.NA_CONTEXT, category);
  }
  for (const category of ['reconnaissance', 'security-headers', 'client-side', 'information-disclosure']) {
    assert.equal(evaluateApplicability(item('WAPT-RECON-900', category), context).state, APPLICABILITY.ACTIVE, category);
  }
});

test('scenario: JWT activates JWT methodology while cookie-only context removes it', async () => {
  const { deriveContext, APPLICABILITY, evaluateApplicability } = await engine();
  const jwtItem = item('WAPT-JWT-900', 'jwt');
  assert.equal(evaluateApplicability(jwtItem, deriveContext({ app_type: 'spa', auth_mechanism: ['jwt'] })).state, APPLICABILITY.ACTIVE);
  assert.equal(evaluateApplicability(jwtItem, deriveContext({ app_type: 'hybrid', auth_mechanism: ['cookie'] })).state, APPLICABILITY.NA_CONTEXT);
});

test('scenario: cookie sessions activate session work and boost rotation/logout methodology', async () => {
  const { deriveContext, APPLICABILITY, evaluateApplicability, scoreItem } = await engine();
  const session = item('WAPT-SESS-900', 'session-management', { any_of: { auth_mechanism: ['cookie', 'mixed'] } });
  const cookieContext = deriveContext({ app_type: 'hybrid', auth_mechanism: ['cookie'] });
  const jwtContext = deriveContext({ app_type: 'hybrid', auth_mechanism: ['jwt'] });
  assert.equal(evaluateApplicability(session, cookieContext).state, APPLICABILITY.ACTIVE);
  assert.equal(evaluateApplicability(session, jwtContext).state, APPLICABILITY.NA_CONTEXT);
  assert.ok(scoreItem(session, cookieContext).score > scoreItem(session, jwtContext).score);
});

test('scenario: OAuth and SAML activate federation tests', async () => {
  const { deriveContext, APPLICABILITY, evaluateApplicability } = await engine();
  const federation = item('WAPT-OAUTH-900', 'oauth-sso-saml');
  for (const mechanism of ['oauth', 'saml']) {
    assert.equal(evaluateApplicability(federation, deriveContext({ app_type: 'hybrid', auth_mechanism: [mechanism] })).state, APPLICABILITY.ACTIVE, mechanism);
  }
  assert.equal(evaluateApplicability(federation, deriveContext({ app_type: 'hybrid', auth_mechanism: ['cookie'] })).state, APPLICABILITY.NA_CONTEXT);
});

test('scenario: identity capabilities activate only matching MFA, passkey, and recovery work', async () => {
  const { deriveContext, APPLICABILITY, evaluateApplicability } = await engine();
  for (const feature of ['mfa', 'passkey', 'recovery']) {
    const target = item('WAPT-AUTH-900', 'authentication', { requires: [`identity_features:${feature}`] });
    assert.equal(evaluateApplicability(target, deriveContext({ has_login: 'yes', identity_features: [feature] })).state, APPLICABILITY.ACTIVE);
    assert.equal(evaluateApplicability(target, deriveContext({ has_login: 'yes', identity_features: ['password'] })).state, APPLICABILITY.NA_CONTEXT);
    assert.equal(evaluateApplicability(target, deriveContext({ has_login: 'yes' })).state, APPLICABILITY.CONFIRM);
  }
});

test('scenario: API-only delivery boosts API work and removes browser-runtime tests', async () => {
  const { deriveContext, APPLICABILITY, evaluateApplicability, scoreItem } = await engine();
  const context = deriveContext({ app_type: 'api_only', api_style: ['rest'] });
  const api = item('WAPT-API-900', 'api-security');
  const browser = item('WAPT-CLIENT-900', 'client-side', { excludes: ['app_type:api_only'] });
  assert.ok(scoreItem(api, context).contextReasons.includes('api_only'));
  assert.equal(evaluateApplicability(browser, context).state, APPLICABILITY.NA_CONTEXT);
});

test('scenario: GraphQL activates only for GraphQL and remains N/A for SOAP-only scope', async () => {
  const { deriveContext, APPLICABILITY, evaluateApplicability } = await engine();
  const graphql = item('WAPT-GQL-900', 'graphql');
  assert.equal(evaluateApplicability(graphql, deriveContext({ api_style: ['graphql'] })).state, APPLICABILITY.ACTIVE);
  assert.equal(evaluateApplicability(graphql, deriveContext({ api_style: ['soap'] })).state, APPLICABILITY.NA_CONTEXT);
});

test('scenario: many roles boosts authorization and role-matrix work', async () => {
  const { deriveContext, scoreItem } = await engine();
  const authorization = item('WAPT-AUTHZ-900', 'authorization');
  const one = scoreItem(authorization, deriveContext({ app_type: 'hybrid', roles: 'one' }));
  const many = scoreItem(authorization, deriveContext({ app_type: 'hybrid', roles: 'many' }));
  assert.ok(many.score > one.score);
  assert.ok(many.contextReasons.includes('many_roles'));
});

test('scenario: no black-box credentials creates a visible blocked authenticated roadmap', async () => {
  const { deriveContext, APPLICABILITY, evaluateApplicability } = await engine();
  const authenticated = item('WAPT-AUTHZ-900', 'authorization', { requires: ['has_login:yes', 'creds:low|high'] });
  const result = evaluateApplicability(authenticated, deriveContext({ mode: 'black_box', creds: 'none', app_type: 'hybrid', has_login: 'yes' }));
  assert.equal(result.state, APPLICABILITY.ACTIVE);
  assert.equal(result.blocked, true);
});

test('scenario: payments activate and boost payment and race methodology', async () => {
  const { deriveContext, APPLICABILITY, evaluateApplicability, scoreItem } = await engine();
  const context = deriveContext({ app_type: 'hybrid', features: ['payments'] });
  for (const [id, category] of [['WAPT-BL-900', 'business-logic'], ['WAPT-RACE-900', 'race-conditions']]) {
    const target = item(id, category, { any_of: { features: ['payments'] } });
    assert.equal(evaluateApplicability(target, context).state, APPLICABILITY.ACTIVE);
    assert.ok(scoreItem(target, context).contextReasons.includes('payments'));
  }
});

test('scenario: multi-tenant scope boosts tenant authorization and API isolation', async () => {
  const { deriveContext, scoreItem } = await engine();
  const context = deriveContext({ app_type: 'hybrid', features: ['multi_tenant'] });
  for (const [id, category] of [['WAPT-AUTHZ-900', 'authorization'], ['WAPT-API-900', 'api-security']]) {
    assert.ok(scoreItem(item(id, category), context).contextReasons.includes('multi_tenant'));
  }
});

test('scenario: backend selections activate only their stack-specific advanced tests', async () => {
  const { deriveContext, APPLICABILITY, evaluateApplicability } = await engine();
  const cases = [
    ['java', 'deserialization-el'], ['python', 'jinja-pickle'], ['php', 'object-injection'], ['dotnet', 'viewstate-deserialization']
  ];
  for (const [backend, label] of cases) {
    const target = item('WAPT-ADV-900', 'advanced', { any_of: { backend: [backend] } }, { tags: [label] });
    assert.equal(evaluateApplicability(target, deriveContext({ backend: [backend] })).state, APPLICABILITY.ACTIVE, backend);
    assert.equal(evaluateApplicability(target, deriveContext({ backend: ['go'] })).state, APPLICABILITY.NA_CONTEXT, backend);
  }
});

test('scenario: each cloud provider activates only its provider-specific storage and metadata item', async () => {
  const { deriveContext, APPLICABILITY, evaluateApplicability } = await engine();
  for (const cloud of ['aws', 'gcp', 'azure']) {
    const target = item('WAPT-CLOUD-900', 'cloud-storage', { any_of: { cloud: [cloud] } });
    assert.equal(evaluateApplicability(target, deriveContext({ cloud })).state, APPLICABILITY.ACTIVE, cloud);
    assert.equal(evaluateApplicability(target, deriveContext({ cloud: 'self_hosted' })).state, APPLICABILITY.NA_CONTEXT, cloud);
  }
});

test('scenario: NoSQL and LDAP data layers activate their matching injection tests', async () => {
  const { deriveContext, APPLICABILITY, evaluateApplicability } = await engine();
  for (const database of ['nosql', 'ldap']) {
    const target = item('WAPT-INJ-900', 'injection', { any_of: { database: [database] } });
    assert.equal(evaluateApplicability(target, deriveContext({ database: [database] })).state, APPLICABILITY.ACTIVE, database);
    assert.equal(evaluateApplicability(target, deriveContext({ database: ['sql'] })).state, APPLICABILITY.NA_CONTEXT, database);
  }
});

test('scenario: api URL hint suggests API discovery, BOLA, and data checks without asserting scope', async () => {
  const { deriveContext, APPLICABILITY, evaluateApplicability, scoreItem } = await engine();
  const context = deriveContext({}, 'https://api.example.com');
  const target = item('WAPT-API-900', 'api-security', { any_of: { 'url_hints.api_subdomain': [true] } });
  assert.equal(evaluateApplicability(target, context).state, APPLICABILITY.CONFIRM);
  assert.ok(scoreItem(target, context).contextReasons.includes('api_url_hint'));
});

test('preset scenario: static marketing site produces a static-safe plan', async () => {
  const { deriveContext, APPLICABILITY, evaluateApplicability } = await engine();
  const { PRESETS } = await presetsModule;
  const context = deriveContext(PRESETS.static_marketing.answers);
  assert.equal(evaluateApplicability(item('WAPT-AUTH-900', 'authentication'), context).state, APPLICABILITY.NA_CONTEXT);
  assert.equal(evaluateApplicability(item('WAPT-HDR-900', 'security-headers'), context).state, APPLICABILITY.ACTIVE);
});

test('preset scenario: SaaS JWT API activates JWT, REST, tenant, and many-role signals', async () => {
  const { deriveContext, APPLICABILITY, evaluateApplicability, scoreItem } = await engine();
  const { PRESETS } = await presetsModule;
  const context = deriveContext(PRESETS.saas_jwt_api.answers);
  assert.equal(evaluateApplicability(item('WAPT-JWT-900', 'jwt'), context).state, APPLICABILITY.ACTIVE);
  const scored = scoreItem(item('WAPT-AUTHZ-900', 'authorization'), context);
  assert.ok(scored.contextReasons.includes('many_roles'));
  assert.ok(scored.contextReasons.includes('multi_tenant'));
});

test('preset scenario: corporate portal activates cookie sessions and federation', async () => {
  const { deriveContext, APPLICABILITY, evaluateApplicability } = await engine();
  const { PRESETS } = await presetsModule;
  const context = deriveContext(PRESETS.corporate_portal.answers);
  assert.equal(evaluateApplicability(item('WAPT-SESS-900', 'session-management', { any_of: { auth_mechanism: ['cookie'] } }), context).state, APPLICABILITY.ACTIVE);
  assert.equal(evaluateApplicability(item('WAPT-OAUTH-900', 'oauth-sso-saml'), context).state, APPLICABILITY.ACTIVE);
});

test('preset scenario: e-commerce activates payment integrity and race work', async () => {
  const { deriveContext, APPLICABILITY, evaluateApplicability } = await engine();
  const { PRESETS } = await presetsModule;
  const context = deriveContext(PRESETS.ecommerce.answers);
  const applies = { any_of: { features: ['payments'] } };
  assert.equal(evaluateApplicability(item('WAPT-BL-900', 'business-logic', applies), context).state, APPLICABILITY.ACTIVE);
  assert.equal(evaluateApplicability(item('WAPT-RACE-900', 'race-conditions', applies), context).state, APPLICABILITY.ACTIVE);
});

test('specialized API, GraphQL, document, and realtime presets activate their intended surfaces', async () => {
  const { deriveContext, APPLICABILITY, evaluateApplicability, scoreItem } = await engine();
  const { PRESETS } = await presetsModule;
  const rest = deriveContext(PRESETS.rest_api.answers);
  assert.ok(scoreItem(item('WAPT-API-900', 'api-security'), rest).contextReasons.includes('api_only'));
  assert.equal(evaluateApplicability(item('WAPT-CLIENT-900', 'client-side', { excludes: ['app_type:api_only'] }), rest).state, APPLICABILITY.NA_CONTEXT);

  const graphql = deriveContext(PRESETS.graphql_api.answers);
  assert.equal(evaluateApplicability(item('WAPT-GQL-900', 'graphql'), graphql).state, APPLICABILITY.ACTIVE);
  assert.ok(scoreItem(item('WAPT-GQL-900', 'graphql'), graphql).contextReasons.includes('graphql'));

  const documents = deriveContext(PRESETS.document_portal.answers);
  assert.equal(evaluateApplicability(item('WAPT-UPLOAD-900', 'file-handling', { any_of: { features: ['file_upload'] } }), documents).state, APPLICABILITY.ACTIVE);

  const realtime = deriveContext(PRESETS.realtime_chat.answers);
  assert.equal(evaluateApplicability(item('WAPT-WS-900', 'websocket'), realtime).state, APPLICABILITY.ACTIVE);
  assert.ok(scoreItem(item('WAPT-WS-900', 'websocket'), realtime).contextReasons.includes('websocket'));
});

test('scenario: intermediary layers gate cache work and boost desynchronization planning', async () => {
  const { deriveContext, APPLICABILITY, evaluateApplicability, scoreItem } = await engine();
  const cacheItem = item('WAPT-ADV-900', 'advanced', { any_of: { intermediary: ['cdn', 'proxy'] } });
  assert.equal(evaluateApplicability(cacheItem, deriveContext({ intermediary: ['cdn'] })).state, APPLICABILITY.ACTIVE);
  assert.equal(evaluateApplicability(cacheItem, deriveContext({ intermediary: ['waf'] })).state, APPLICABILITY.NA_CONTEXT);
  assert.equal(evaluateApplicability(cacheItem, deriveContext({})).state, APPLICABILITY.CONFIRM);
  const smugglingItem = item('WAPT-SMUG-900', 'request-smuggling');
  const withProxy = deriveContext({ intermediary: ['proxy'] });
  assert.ok(scoreItem(smugglingItem, withProxy).contextReasons.includes('intermediary_hops'));
  assert.ok(scoreItem(smugglingItem, withProxy).score > scoreItem(smugglingItem, deriveContext({})).score);
});

test('scenario: confirmed outbound URL fetching activates SSRF and webhook-signature work', async () => {
  const { deriveContext, APPLICABILITY, evaluateApplicability } = await engine();
  const ssrfItem = item('WAPT-SSRF-900', 'ssrf');
  assert.equal(evaluateApplicability(ssrfItem, deriveContext({ outbound_fetch: ['webhooks'] })).state, APPLICABILITY.ACTIVE);
  assert.equal(evaluateApplicability(ssrfItem, deriveContext({})).state, APPLICABILITY.CONFIRM);
  assert.equal(evaluateApplicability(ssrfItem, deriveContext({ outbound_fetch: ['none'] })).state, APPLICABILITY.NA_CONTEXT);
  const webhookSig = item('WAPT-ADV-901', 'advanced', { any_of: { outbound_fetch: ['webhooks'] } });
  assert.equal(evaluateApplicability(webhookSig, deriveContext({ outbound_fetch: ['import'] })).state, APPLICABILITY.NA_CONTEXT);
  assert.equal(evaluateApplicability(webhookSig, deriveContext({ outbound_fetch: ['webhooks'] })).state, APPLICABILITY.ACTIVE);
});

test('scenario: asynchronous jobs gate job-specific authorization and business-logic work', async () => {
  const { deriveContext, APPLICABILITY, evaluateApplicability } = await engine();
  const jobItem = item('WAPT-AUTHZ-900', 'authorization', { requires: ['creds:low|high', 'async_jobs:yes'] });
  assert.equal(evaluateApplicability(jobItem, deriveContext({ creds: 'high', async_jobs: 'yes' })).state, APPLICABILITY.ACTIVE);
  assert.equal(evaluateApplicability(jobItem, deriveContext({ creds: 'high' })).state, APPLICABILITY.CONFIRM);
  assert.equal(evaluateApplicability(jobItem, deriveContext({ creds: 'high', async_jobs: 'no' })).state, APPLICABILITY.NA_CONTEXT);
});

test('scenario: AI/LLM features activate and boost the dedicated AI suite', async () => {
  const { deriveContext, APPLICABILITY, evaluateApplicability, scoreItem } = await engine();
  const aiItem = item('WAPT-AI-900', 'ai-llm-security', { any_of: { features: ['ai_llm'] } });
  assert.equal(evaluateApplicability(aiItem, deriveContext({ features: ['ai_llm'] })).state, APPLICABILITY.ACTIVE);
  assert.equal(evaluateApplicability(aiItem, deriveContext({})).state, APPLICABILITY.CONFIRM);
  assert.equal(evaluateApplicability(aiItem, deriveContext({ features: ['none'] })).state, APPLICABILITY.NA_CONTEXT);
  const withAI = deriveContext({ features: ['ai_llm'] });
  assert.ok(scoreItem(aiItem, withAI).contextReasons.includes('ai_llm'));
  assert.ok(scoreItem(aiItem, withAI).score > scoreItem(aiItem, deriveContext({})).score);
});
