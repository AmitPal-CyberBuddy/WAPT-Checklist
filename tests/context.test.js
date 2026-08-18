'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const contextModule = import('../js/engine/context.js');

test('context normalizes every answer with explicit confidence', async () => {
  const { ATTRIBUTE_OPTIONS, deriveContext } = await contextModule;
  const context = deriveContext({ mode: 'grey_box', auth_mechanism: ['jwt'], backend: ['invalid'] });
  assert.deepEqual(Object.keys(context).filter((key) => key !== 'url_hints'), Object.keys(ATTRIBUTE_OPTIONS));
  assert.deepEqual(context.mode, { value: 'grey_box', confidence: 'answer' });
  assert.deepEqual(context.auth_mechanism, { value: ['jwt'], confidence: 'answer' });
  assert.deepEqual(context.backend, { value: ['unknown'], confidence: 'unknown' });
  assert.deepEqual(context.roles, { value: 'unknown', confidence: 'unknown' });
});

test('multi-select unknown never coexists with asserted values', async () => {
  const { normalizeAnswers } = await contextModule;
  const answers = normalizeAnswers({ auth_mechanism: ['jwt', 'unknown', 'jwt'] });
  assert.deepEqual(answers.auth_mechanism, ['unknown']);
});

test('cross-field normalization removes contradictory hidden context', async () => {
  const { normalizeScopeAnswers } = await contextModule;
  const answers = normalizeScopeAnswers({
    mode: 'black_box', source_access: 'full', app_type: 'static', has_login: 'no',
    creds: 'high', registration: 'yes', roles: 'many', auth_mechanism: ['jwt'],
    api_style: ['none'], api_docs: 'openapi', backend: ['java'], database: ['sql']
  });
  assert.equal(answers.source_access, 'none');
  assert.deepEqual({ creds: answers.creds, registration: answers.registration, roles: answers.roles }, { creds: 'none', registration: 'no', roles: 'none' });
  assert.deepEqual(answers.auth_mechanism, ['none']);
  assert.deepEqual(answers.identity_features, ['none']);
  assert.equal(answers.api_docs, 'none');
  assert.deepEqual(answers.backend, ['none']);
  assert.deepEqual(answers.database, ['none']);
});

test('URL hints use exact labels and retain low-confidence evidence', async () => {
  const { deriveContext, deriveUrlHints } = await contextModule;
  const derived = deriveUrlHints('http://api.example.com:8443/path');
  assert.equal(derived.accepted, true);
  assert.equal(derived.hints.plain_http, true);
  assert.equal(derived.hints.unusual_tls_port, true);
  assert.equal(derived.hints.api_subdomain, true);
  assert.equal(derived.hints.admin_subdomain, false);

  const context = deriveContext({}, 'https://admin.example.com');
  assert.equal(context.url_hints.admin_subdomain.value, true);
  assert.equal(context.url_hints.admin_subdomain.confidence, 'url_hint');
  assert.match(context.url_hints.admin_subdomain.evidence, /admin/);
});

test('URL parser does not infer hints from substring labels or paths', async () => {
  const { deriveUrlHints } = await contextModule;
  const result = deriveUrlHints('https://notapi.example.com/path/api/admin');
  assert.equal(result.accepted, true);
  assert.equal(result.hints.api_subdomain, false);
  assert.equal(result.hints.admin_subdomain, false);
});

test('URL deny-list rejects credentials, local, private, link-local, and non-HTTP targets', async () => {
  const { deriveUrlHints } = await contextModule;
  const targets = [
    'https://user:secret@api.example.com', 'https://localhost', 'http://127.0.0.1',
    'http://10.2.3.4', 'http://169.254.169.254/latest/meta-data', 'http://192.168.1.2',
    'http://172.16.0.1', 'http://[::1]/', 'file:///etc/passwd', 'javascript:alert(1)'
  ];
  for (const target of targets) {
    assert.equal(deriveUrlHints(target).accepted, false, target);
  }
});

test('URL parser notes non-production and punycode labels conservatively', async () => {
  const { deriveUrlHints } = await contextModule;
  assert.equal(deriveUrlHints('https://staging.example.com').hints.nonproduction_subdomain, true);
  assert.equal(deriveUrlHints('https://dev.example.com').hints.nonproduction_subdomain, true);
  assert.equal(deriveUrlHints('https://bücher.example').hints.punycode_hostname, true);
});

test('intermediary, outbound-fetch, and asynchronous-job answers normalize and reconcile with delivery', async () => {
  const { normalizeScopeAnswers } = await contextModule;
  const answers = normalizeScopeAnswers({ intermediary: ['cdn', 'invalid'], outbound_fetch: ['webhooks'], async_jobs: 'yes' });
  assert.deepEqual(answers.intermediary, ['cdn']);
  assert.deepEqual(answers.outbound_fetch, ['webhooks']);
  assert.equal(answers.async_jobs, 'yes');
  const staticSite = normalizeScopeAnswers({ app_type: 'static', api_style: ['none'], outbound_fetch: ['webhooks'], async_jobs: 'yes' });
  assert.deepEqual(staticSite.outbound_fetch, ['none']);
  assert.equal(staticSite.async_jobs, 'no');
  const noApiDynamic = normalizeScopeAnswers({ app_type: 'hybrid', outbound_fetch: ['import'], async_jobs: 'no' });
  assert.deepEqual(noApiDynamic.outbound_fetch, ['import']);
  assert.equal(noApiDynamic.async_jobs, 'no');
});
