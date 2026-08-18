'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { OPTIONS } = require('../tools/validate.js');

const PRESETS_URL = pathToFileURL(path.resolve(__dirname, '../js/data/presets.mjs')).href;
const EXPECTED_KEYS = [
  'mode', 'creds', 'app_type', 'has_login', 'registration', 'roles', 'auth_mechanism',
  'identity_features', 'api_docs', 'source_access', 'backend', 'api_style', 'database', 'cloud', 'features'
];
const MULTI_KEYS = new Set(['auth_mechanism', 'identity_features', 'backend', 'api_style', 'database', 'features']);

test('eight analyst presets use the complete controlled context vocabulary', async () => {
  const { PRESET_LIST } = await import(PRESETS_URL);
  assert.equal(PRESET_LIST.length, 8);
  assert.deepEqual(PRESET_LIST.map(({ id }) => id), [
    'static_marketing', 'saas_jwt_api', 'corporate_portal', 'ecommerce',
    'rest_api', 'graphql_api', 'document_portal', 'realtime_chat'
  ]);

  for (const preset of PRESET_LIST) {
    assert.deepEqual(Object.keys(preset.answers), EXPECTED_KEYS, `${preset.id} must answer all 15 questions`);
    for (const [key, value] of Object.entries(preset.answers)) {
      const values = Array.isArray(value) ? value : [value];
      assert.equal(Array.isArray(value), MULTI_KEYS.has(key), `${preset.id}.${key} has the wrong cardinality`);
      assert.ok(values.length > 0, `${preset.id}.${key} cannot be empty`);
      for (const option of values) assert.ok(OPTIONS[key].includes(option), `${preset.id}.${key} contains ${option}`);
    }
  }
});

test('static preset collapses dynamic surfaces at the answer layer', async () => {
  const { PRESETS } = await import(PRESETS_URL);
  assert.equal(PRESETS.static_marketing.answers.app_type, 'static');
  assert.equal(PRESETS.static_marketing.answers.has_login, 'no');
  assert.deepEqual(PRESETS.static_marketing.answers.api_style, ['none']);
  assert.deepEqual(PRESETS.static_marketing.answers.database, ['none']);
});

test('SaaS preset carries JWT, REST, many-role, and tenant context', async () => {
  const { PRESETS } = await import(PRESETS_URL);
  const answers = PRESETS.saas_jwt_api.answers;
  assert.deepEqual(answers.auth_mechanism, ['jwt']);
  assert.deepEqual(answers.api_style, ['rest']);
  assert.equal(answers.roles, 'many');
  assert.ok(answers.features.includes('multi_tenant'));
});

test('specialized presets preserve distinct identity, protocol, and workflow contexts', async () => {
  const { PRESETS } = await import(PRESETS_URL);
  assert.ok(PRESETS.corporate_portal.answers.auth_mechanism.includes('oauth'));
  assert.ok(PRESETS.corporate_portal.answers.identity_features.includes('mfa'));
  assert.ok(PRESETS.ecommerce.answers.features.includes('payments'));
  assert.equal(PRESETS.rest_api.answers.app_type, 'api_only');
  assert.deepEqual(PRESETS.graphql_api.answers.api_style, ['graphql']);
  assert.ok(PRESETS.document_portal.answers.features.includes('file_upload'));
  assert.ok(PRESETS.realtime_chat.answers.api_style.includes('websocket'));
});
