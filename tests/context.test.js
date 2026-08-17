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
