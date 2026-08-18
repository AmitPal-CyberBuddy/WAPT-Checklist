'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const contextModule = import('../js/engine/context.js');
const prioritiesModule = import('../js/engine/priorities.js');

function item(id, category, overrides = {}) {
  return { id, category, severity: 'medium', applies: {}, priority_when: undefined, ...overrides };
}

test('suggested next is deterministic and follows workflow before bounded boosts', async () => {
  const { deriveContext } = await contextModule;
  const { suggestedNext } = await prioritiesModule;
  const items = [
    item('WAPT-AUTH-002', 'authentication'),
    item('WAPT-RECON-002', 'reconnaissance', { severity: 'low' }),
    item('WAPT-RECON-001', 'reconnaissance', { severity: 'low' })
  ];
  const result = suggestedNext(items, deriveContext({ app_type: 'hybrid' }), { limit: 3 });
  assert.deepEqual(result.map(({ item: entry }) => entry.id), ['WAPT-RECON-001', 'WAPT-RECON-002', 'WAPT-AUTH-002']);
});

test('many roles and multi-tenant context boost authorization tests', async () => {
  const { deriveContext } = await contextModule;
  const { scoreItem } = await prioritiesModule;
  const target = item('WAPT-AUTHZ-001', 'authorization');
  const baseline = scoreItem(target, deriveContext({ roles: 'one', features: ['unknown'], app_type: 'hybrid' }));
  const boosted = scoreItem(target, deriveContext({ roles: 'many', features: ['multi_tenant'], app_type: 'hybrid' }));
  assert.ok(boosted.score > baseline.score);
  assert.deepEqual(boosted.contextReasons, ['many_roles', 'multi_tenant']);
});

test('priority_when and met prerequisites contribute bounded score components', async () => {
  const { deriveContext } = await contextModule;
  const { scoreItem } = await prioritiesModule;
  const target = item('WAPT-INJ-001', 'injection', { priority_when: { backend: ['java'] } });
  const result = scoreItem(target, deriveContext({ backend: ['java'] }), { prerequisitesMet: { 'WAPT-INJ-001': 20 } });
  assert.equal(result.breakdown.context, 30);
  assert.equal(result.breakdown.prerequisites, 24);
});

test('a completed chain prerequisite boosts its next item', async () => {
  const { deriveContext } = await contextModule;
  const { scoreItem } = await prioritiesModule;
  const target = item('WAPT-AUTH-002', 'authentication');
  const result = scoreItem(target, deriveContext({ app_type: 'hybrid' }), {
    statuses: { 'WAPT-RECON-001': 'passed' },
    chains: [{ id: 'ATO-01', prerequisites: ['WAPT-RECON-001'], next: 'WAPT-AUTH-002' }]
  });
  assert.equal(result.breakdown.chain, 15);
  assert.deepEqual(result.unlockedBy, ['ATO-01']);
});

test('suggested next excludes tested, context-N/A, and credential-blocked work', async () => {
  const { deriveContext } = await contextModule;
  const { suggestedNext } = await prioritiesModule;
  const items = [
    item('WAPT-RECON-001', 'reconnaissance'),
    item('WAPT-AUTH-001', 'authentication', { applies: { requires: ['creds:low|high'] } }),
    item('WAPT-GQL-001', 'graphql')
  ];
  const result = suggestedNext(items, deriveContext({ mode: 'black_box', creds: 'none', app_type: 'hybrid', api_style: ['rest'] }), {
    statuses: { 'WAPT-RECON-001': 'passed' }
  });
  assert.deepEqual(result, []);
});

test('tester proximity ranks uncovered family variants above unrelated high-severity work', async () => {
  const [{ suggestedNext }] = [await import('../js/engine/priorities.js')];
  const { deriveContext } = await import('../js/engine/context.js');
  const context = deriveContext({});
  const items = [
    { id: 'WAPT-AUTHZ-001', category: 'authorization', severity: 'medium', applies: {}, variants: [] },
    { id: 'WAPT-AUTHZ-002', category: 'authorization', severity: 'medium', applies: {}, variants: [] },
    { id: 'WAPT-AUTHZ-003', category: 'authorization', severity: 'medium', applies: {}, variants: [], related: [] },
    { id: 'WAPT-RECON-001', category: 'reconnaissance', severity: 'critical', applies: {}, variants: [] },
    { id: 'WAPT-API-001', category: 'api-security', severity: 'medium', applies: {}, variants: [] }
  ];
  const families = new Map([
    ['authorization-object-level', { id: 'authorization-object-level', title: 'Object-level authorization', items: ['WAPT-AUTHZ-001', 'WAPT-AUTHZ-002', 'WAPT-AUTHZ-003'] }]
  ]);
  const relatedByItem = new Map([['WAPT-AUTHZ-001', ['WAPT-API-001']]]);
  const options = { recent: ['WAPT-AUTHZ-001'], families, relatedByItem, statuses: { 'WAPT-AUTHZ-001': 'passed' } };
  const suggestions = suggestedNext(items, context, options);
  const order = suggestions.map(({ item }) => item.id);

  // Same family first, then the explicitly related test, and only then the workflow-early
  // critical reconnaissance item that would otherwise dominate.
  assert.deepEqual(order.slice(0, 2), ['WAPT-AUTHZ-002', 'WAPT-AUTHZ-003']);
  assert.ok(order.indexOf('WAPT-API-001') < order.indexOf('WAPT-RECON-001'));

  const sibling = suggestions.find(({ item }) => item.id === 'WAPT-AUTHZ-002');
  assert.ok(sibling.reasons.some((reason) => reason.includes('Object-level authorization')));
  // A family workspace can set the focus explicitly, with no recorded history at all.
  const focused = suggestedNext(items, context, { families, focusFamily: 'authorization-object-level' });
  assert.equal(focused[0].item.id, 'WAPT-AUTHZ-001');
  assert.ok(focused[0].reasons.some((reason) => reason.includes('the family you are working')));
  assert.equal(sibling.breakdown.tester, 1500);
  const api = suggestions.find(({ item }) => item.id === 'WAPT-API-001');
  assert.ok(api.reasons.some((reason) => reason.includes('linked from WAPT-AUTHZ-001')));

  const again = suggestedNext(items, context, options);
  assert.deepEqual(again.map(({ item }) => item.id), order);
  const cold = suggestedNext(items, context, {});
  assert.ok(cold.every(({ breakdown }) => breakdown.tester === 0 || breakdown.tester === undefined));
  assert.equal(cold[0].item.id, 'WAPT-RECON-001');
});

test('suggested next keeps in-progress work visible', async () => {
  const { suggestedNext } = await import('../js/engine/priorities.js');
  const { deriveContext } = await import('../js/engine/context.js');
  const items = [
    { id: 'WAPT-AUTHZ-001', category: 'authorization', severity: 'medium', applies: {}, variants: [] },
    { id: 'WAPT-AUTHZ-002', category: 'authorization', severity: 'medium', applies: {}, variants: [] }
  ];
  const suggestions = suggestedNext(items, deriveContext({}), { statuses: { 'WAPT-AUTHZ-001': 'in_progress', 'WAPT-AUTHZ-002': 'passed' } });
  assert.deepEqual(suggestions.map(({ item }) => item.id), ['WAPT-AUTHZ-001']);
  assert.ok(suggestions[0].reasons.includes('already started'));
});
