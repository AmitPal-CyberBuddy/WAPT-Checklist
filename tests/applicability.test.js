'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const contextModule = import('../js/engine/context.js');
const applicabilityModule = import('../js/engine/applicability.js');

function item(overrides = {}) {
  return { id: 'WAPT-AUTHZ-999', category: 'authorization', applies: {}, variants: [], ...overrides };
}

test('known exclusions take precedence over unknown requirements', async () => {
  const { deriveContext } = await contextModule;
  const { APPLICABILITY, evaluateApplicability } = await applicabilityModule;
  const context = deriveContext({ app_type: 'static', has_login: 'unknown' });
  const evaluated = evaluateApplicability(item({ applies: { requires: ['has_login:yes'], excludes: ['app_type:static'] } }), context);
  assert.equal(evaluated.state, APPLICABILITY.NA_CONTEXT);
});

test('unknown prerequisite remains visible as Confirm', async () => {
  const { deriveContext } = await contextModule;
  const { APPLICABILITY, evaluateApplicability } = await applicabilityModule;
  const context = deriveContext({ app_type: 'hybrid', has_login: 'unknown' });
  const evaluated = evaluateApplicability(item({ applies: { requires: ['has_login:yes'] } }), context);
  assert.equal(evaluated.state, APPLICABILITY.CONFIRM);
  assert.equal(evaluated.blocked, false);
});

test('known failed requirement produces context N/A', async () => {
  const { deriveContext } = await contextModule;
  const { APPLICABILITY, evaluateApplicability } = await applicabilityModule;
  const context = deriveContext({ app_type: 'hybrid', has_login: 'no' });
  assert.equal(evaluateApplicability(item({ applies: { requires: ['has_login:yes'] } }), context).state, APPLICABILITY.NA_CONTEXT);
});

test('black-box without credentials keeps authenticated work as a blocked roadmap', async () => {
  const { deriveContext } = await contextModule;
  const { APPLICABILITY, evaluateApplicability, isExecutable } = await applicabilityModule;
  const context = deriveContext({ mode: 'black_box', creds: 'none', app_type: 'hybrid', has_login: 'yes' });
  const evaluated = evaluateApplicability(item({ applies: { requires: ['has_login:yes', 'creds:low|high'] } }), context);
  assert.equal(evaluated.state, APPLICABILITY.ACTIVE);
  assert.equal(evaluated.blocked, true);
  assert.equal(isExecutable(evaluated), false);
  assert.ok(evaluated.reasons.some(({ code }) => code === 'needs_credentials'));
});

test('any_of activates on one known branch and confirms on unknown-only branches', async () => {
  const { deriveContext } = await contextModule;
  const { APPLICABILITY, evaluateApplicability } = await applicabilityModule;
  const target = item({ category: 'injection', applies: { any_of: { database: ['sql'], backend: ['java'] } } });
  assert.equal(evaluateApplicability(target, deriveContext({ database: ['nosql'], backend: ['java'] })).state, APPLICABILITY.ACTIVE);
  assert.equal(evaluateApplicability(target, deriveContext({ database: ['nosql'], backend: ['unknown'] })).state, APPLICABILITY.CONFIRM);
  assert.equal(evaluateApplicability(target, deriveContext({ database: ['nosql'], backend: ['python'] })).state, APPLICABILITY.NA_CONTEXT);
});

test('a URL hint suggests confirmation rather than asserting a fact', async () => {
  const { deriveContext } = await contextModule;
  const { APPLICABILITY, evaluateApplicability } = await applicabilityModule;
  const target = item({ category: 'api-security', applies: { any_of: { 'url_hints.api_subdomain': [true] } } });
  const evaluated = evaluateApplicability(target, deriveContext({}, 'https://api.example.com'));
  assert.equal(evaluated.state, APPLICABILITY.CONFIRM);
  assert.ok(evaluated.reasons.some(({ code }) => code === 'hint_any_of_confirmation'));
});

test('methodology variants are selected without duplicating items', async () => {
  const { deriveContext } = await contextModule;
  const { selectVariants } = await applicabilityModule;
  const target = item({ variants: [
    { when: { auth_mechanism: ['cookie'] }, steps: ['cookie method'] },
    { when: { auth_mechanism: ['jwt'] }, steps: ['jwt method'] }
  ] });
  const selected = selectVariants(target, deriveContext({ auth_mechanism: ['cookie'] }));
  assert.equal(selected.length, 1);
  assert.equal(selected[0].steps[0], 'cookie method');
});
