'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const wizardModule = import('../js/ui/wizard.js');

test('no-login scope removes credential, registration, role, and auth questions', async () => {
  const { applicableQuestions } = await wizardModule;
  const keys = applicableQuestions({ app_type: 'static', has_login: 'no', api_style: ['none'] }).map(({ key }) => key);
  for (const irrelevant of ['creds', 'registration', 'roles', 'auth_mechanism', 'identity_features', 'api_docs', 'backend', 'database']) {
    assert.ok(!keys.includes(irrelevant), `${irrelevant} should be skipped`);
  }
  for (const relevant of ['mode', 'app_type', 'has_login', 'source_access', 'cloud', 'features']) assert.ok(keys.includes(relevant));
});

test('authenticated dynamic API scope retains identity, runtime, data, and API questions', async () => {
  const { applicableQuestions } = await wizardModule;
  const keys = applicableQuestions({ app_type: 'hybrid', has_login: 'yes', api_style: ['rest', 'graphql'] }).map(({ key }) => key);
  for (const expected of ['creds', 'registration', 'roles', 'auth_mechanism', 'identity_features', 'api_style', 'api_docs', 'backend', 'database']) {
    assert.ok(keys.includes(expected), `${expected} should remain applicable`);
  }
});

test('black-box mode skips the contradictory implementation-access question', async () => {
  const { applicableQuestions } = await wizardModule;
  const blackBox = applicableQuestions({ mode: 'black_box' }).map(({ key }) => key);
  const greyBox = applicableQuestions({ mode: 'grey_box' }).map(({ key }) => key);
  assert.ok(!blackBox.includes('source_access'));
  assert.ok(greyBox.includes('source_access'));
});

test('every supported dependency combination has a coherent question sequence', async () => {
  const { applicableQuestions } = await wizardModule;
  for (const mode of ['black_box', 'grey_box', 'white_box', 'unknown']) {
    for (const app_type of ['server_rendered', 'spa', 'static', 'hybrid', 'api_only', 'unknown']) {
      for (const has_login of ['yes', 'no', 'unknown']) {
        for (const api_style of [['rest'], ['graphql'], ['none'], ['unknown']]) {
          const keys = applicableQuestions({ mode, app_type, has_login, api_style }).map(({ key }) => key);
          assert.equal(new Set(keys).size, keys.length, 'question keys must stay unique');
          if (has_login === 'no') for (const key of ['creds', 'registration', 'roles', 'auth_mechanism', 'identity_features']) assert.ok(!keys.includes(key));
          if (api_style.includes('none')) assert.ok(!keys.includes('api_docs'));
          if (app_type === 'static' && api_style.includes('none')) for (const key of ['backend', 'database']) assert.ok(!keys.includes(key));
          if (mode === 'black_box') assert.ok(!keys.includes('source_access'));
        }
      }
    }
  }
});

test('unknown answers conservatively retain questions for confirmation', async () => {
  const { applicableQuestions, QUESTIONS } = await wizardModule;
  assert.equal(applicableQuestions({}).length, QUESTIONS.length);
});

test('new intermediary, outbound-fetch, and asynchronous-job questions appear for dynamic scopes', async () => {
  const { applicableQuestions } = await wizardModule;
  const keys = applicableQuestions({ app_type: 'hybrid', has_login: 'unknown', api_style: ['rest'] }).map(({ key }) => key);
  for (const expected of ['intermediary', 'outbound_fetch', 'async_jobs']) assert.ok(keys.includes(expected), expected);
});

test('static delivery with no API hides outbound-fetch and asynchronous-job questions', async () => {
  const { applicableQuestions } = await wizardModule;
  const keys = applicableQuestions({ app_type: 'static', has_login: 'no', api_style: ['none'] }).map(({ key }) => key);
  assert.ok(!keys.includes('outbound_fetch'));
  assert.ok(!keys.includes('async_jobs'));
  assert.ok(keys.includes('intermediary'));
});

test('all-unknown scope exposes all 18 adaptive questions for confirmation', async () => {
  const { applicableQuestions, QUESTIONS } = await wizardModule;
  assert.equal(QUESTIONS.length, 18);
  assert.equal(applicableQuestions({}).length, 18);
});
