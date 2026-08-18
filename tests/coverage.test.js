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

test('N/A, blocked, and in-progress are never counted as tested', async () => {
  const [{ deriveContext }, { computeCoverage }] = await Promise.all([contextModule, coverageModule]);
  const items = [
    item('WAPT-AUTHZ-001', 'authorization'),
    item('WAPT-AUTHZ-002', 'authorization'),
    item('WAPT-AUTHZ-003', 'authorization'),
    item('WAPT-AUTHZ-004', 'authorization'),
    item('WAPT-AUTHZ-005', 'authorization')
  ];
  const coverage = computeCoverage(items, deriveContext({}), {
    'WAPT-AUTHZ-001': 'passed',
    'WAPT-AUTHZ-002': 'na',
    'WAPT-AUTHZ-003': 'blocked',
    'WAPT-AUTHZ-004': 'in_progress'
  });
  const overall = coverage.overall;
  assert.equal(overall.total, 5);
  assert.equal(overall.tested, 1, 'only the executed check counts as tested');
  assert.equal(overall.na, 1);
  assert.equal(overall.na_user, 1);
  assert.equal(overall.na_context, 0);
  assert.equal(overall.blocked, 1);
  assert.equal(overall.active, 1);
  assert.equal(overall.not_tested, 1);
  assert.equal(overall.executable, 4, 'tester N/A leaves the denominator, blocked stays in it');
  assert.equal(overall.coverage, 25);
  assert.equal(overall.remaining, 3);
});

test('credential-blocked context work is reported as blocked, not as progress', async () => {
  const [{ deriveContext }, { computeCoverage, classifyItem }] = await Promise.all([contextModule, coverageModule]);
  const context = deriveContext({ mode: 'black_box', has_login: 'yes', creds: 'none' });
  const items = [item('WAPT-AUTHZ-900', 'authorization', { requires: ['has_login:yes', 'creds:low|high'] })];
  const coverage = computeCoverage(items, context, {});
  assert.equal(coverage.overall.blocked, 1);
  assert.equal(coverage.overall.tested, 0);
  assert.equal(classifyItem(items[0], { state: 'active', blocked: true }, 'not_tested').bucket, 'blocked');
  assert.equal(classifyItem(items[0], { state: 'active', blocked: false }, 'confirmed_finding').bucket, 'tested');
  assert.equal(classifyItem(items[0], { state: 'na_context', blocked: false }, 'passed').bucket, 'na');
});

test('coverageOfRecords aggregates a family bucket with resolved applicability', async () => {
  const { coverageOfRecords } = await coverageModule;
  const records = [
    { item: item('WAPT-AUTHZ-001', 'authorization'), applicability: { state: 'active', blocked: false } },
    { item: item('WAPT-AUTHZ-002', 'authorization'), applicability: { state: 'na_context', blocked: false } },
    { item: item('WAPT-AUTHZ-003', 'authorization'), applicability: { state: 'active', blocked: true } }
  ];
  const coverage = coverageOfRecords(records, { 'WAPT-AUTHZ-001': 'confirmed_finding' }, 'authorization-object-level');
  assert.equal(coverage.slug, 'authorization-object-level');
  assert.equal(coverage.executable, 2);
  assert.equal(coverage.tested, 1);
  assert.equal(coverage.confirmed, 1);
  assert.equal(coverage.blocked, 1);
  assert.equal(coverage.na_context, 1);
  assert.equal(coverage.coverage, 50);
});
