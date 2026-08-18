'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const contextModule = import('../js/engine/context.js');
const coverageModule = import('../js/engine/coverage.js');
const stateModule = import('../js/engine/state.js');

function item(id, category, applies = {}) {
  return { id, category, severity: 'medium', applies, variants: [] };
}

test('coverage excludes context-N/A from the denominator and counts blocked separately', async () => {
  const [{ deriveContext }, { computeCoverage }] = await Promise.all([contextModule, coverageModule]);
  const context = deriveContext({ auth_mechanism: ['jwt'] });
  const items = [
    item('WAPT-JWT-900', 'jwt', { any_of: { auth_mechanism: ['jwt'] } }),
    item('WAPT-JWT-901', 'jwt', { any_of: { auth_mechanism: ['jwt'] } }),
    item('WAPT-OAUTH-900', 'oauth-sso-saml', { any_of: { auth_mechanism: ['oauth'] } }),
    item('WAPT-AUTHZ-900', 'authorization', { requires: ['creds:low|high'] })
  ];
  const coverage = computeCoverage(items, context, { 'WAPT-JWT-900': 'passed' });
  assert.equal(coverage.overall.executable, 3);
  assert.equal(coverage.overall.na, 1);
  assert.equal(coverage.overall.tested, 1);
  assert.equal(coverage.overall.coverage, 33);
  assert.equal(coverage.overall.passed, 1);
  assert.equal(coverage.overall.blocked, 0);
  const jwt = coverage.perCategory.find(({ slug }) => slug === 'jwt');
  assert.equal(jwt.executable, 2);
  assert.equal(jwt.na, 0);
});

test('all-unknown scope keeps everything executable and coverage tracks confirmed findings', async () => {
  const [{ deriveContext }, { computeCoverage }] = await Promise.all([contextModule, coverageModule]);
  const items = [item('WAPT-AUTHZ-001', 'authorization'), item('WAPT-AUTHZ-002', 'authorization')];
  const coverage = computeCoverage(items, deriveContext({}), { 'WAPT-AUTHZ-001': 'confirmed_finding', 'WAPT-AUTHZ-002': 'passed' });
  assert.equal(coverage.overall.executable, 2);
  assert.equal(coverage.overall.coverage, 100);
  assert.equal(coverage.overall.confirmed, 1);
});

test('retest queue splits pending from closed evidence packs', async () => {
  const { retestQueue } = await coverageModule;
  const { createState } = await stateModule;
  const queue = retestQueue({ findings: [
    { id: 'find-a', item_id: 'WAPT-AUTHZ-001', retest_verdict: 'pending' },
    { id: 'find-b', item_id: 'WAPT-AUTHZ-002', retest_verdict: 'partial' }
  ] });
  assert.equal(queue.pending.length, 1);
  assert.equal(queue.closed.length, 1);
  assert.equal(queue.total, 2);
  assert.equal(retestQueue(createState()).total, 0);
});
