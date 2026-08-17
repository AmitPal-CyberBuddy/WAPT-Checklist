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
