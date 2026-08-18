'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const familiesModule = import('../js/engine/families.js');
const document = JSON.parse(fs.readFileSync(path.join(ROOT, 'checklist', 'families.json'), 'utf8'));

const record = (id, state = 'active', blocked = false) => ({
  item: { id, category: 'authorization', severity: 'medium' },
  applicability: { state, blocked }
});

test('family index resolves families by id, item, and category', async () => {
  const { indexFamilies } = await familiesModule;
  const index = indexFamilies(document);
  assert.equal(index.families.length, 196);
  assert.equal(index.byItem.get('WAPT-AUTHZ-003').id, 'authorization-object-level');
  assert.equal(index.byCategory.get('authorization').length, 6);
  assert.ok(index.byId.get('authorization-object-level').quick_test.length >= 3);
});

test("don't-miss variant keys are stable, per family, and content bound", async () => {
  const { variantKey, familyVariants, indexFamilies } = await familiesModule;
  const index = indexFamilies(document);
  const family = index.byId.get('authorization-object-level');
  const key = variantKey(family.id, family.dont_miss[0]);
  assert.match(key, /^authorization-object-level#[a-z0-9]+$/);
  assert.equal(key, variantKey(family.id, family.dont_miss[0]), 'stable across calls');
  assert.notEqual(key, variantKey('authorization-function-level', family.dont_miss[0]), 'scoped per family');
  const variants = familyVariants(family, { [key]: true });
  assert.equal(variants.total, family.dont_miss.length);
  assert.equal(variants.covered, 1);
  assert.equal(variants.entries[0].covered, true);
});

test('family coverage separates checks, variants, and findings', async () => {
  const { familyCoverage, indexFamilies, variantKey } = await familiesModule;
  const index = indexFamilies(document);
  const family = index.byId.get('authorization-object-level');
  const records = family.items.map((id) => record(id));
  const state = {
    statuses: {
      [family.items[0]]: 'passed',
      [family.items[1]]: 'confirmed_finding',
      [family.items[2]]: 'na',
      [family.items[3]]: 'blocked'
    },
    variants: { [variantKey(family.id, family.dont_miss[0])]: true }
  };
  const coverage = familyCoverage(family, records, state);
  assert.equal(coverage.checks.tested, 2);
  assert.equal(coverage.checks.na, 1);
  assert.equal(coverage.checks.blocked, 1);
  assert.equal(coverage.findings, 1, 'confirmed findings are counted separately from coverage');
  assert.equal(coverage.variants.covered, 1);
  assert.equal(coverage.complete, false);
});

test('nextInFamily walks forward from the current check and skips finished work', async () => {
  const { nextInFamily, indexFamilies } = await familiesModule;
  const family = indexFamilies(document).byId.get('authorization-object-level');
  const [first, second, third] = family.items;
  assert.equal(nextInFamily(family, {}, ''), first);
  assert.equal(nextInFamily(family, { [first]: 'passed' }, ''), second);
  assert.equal(nextInFamily(family, {}, second), third);
  assert.equal(nextInFamily(family, { [second]: 'in_progress' }, ''), first);
  const done = Object.fromEntries(family.items.map((id) => [id, 'passed']));
  assert.equal(nextInFamily(family, done, ''), '');
});

test('related families come from existing links, chains, and workflow adjacency', async () => {
  const { relatedFamilies, indexFamilies } = await familiesModule;
  const index = indexFamilies(document);
  const itemsById = new Map([['WAPT-AUTHZ-003', { id: 'WAPT-AUTHZ-003', related: ['WAPT-API-001'] }]]);
  const chains = [{ id: 'IDOR-01', nodes: [{ item_id: 'WAPT-AUTHZ-003' }, { item_id: 'WAPT-AUTHZ-021' }] }];
  const related = relatedFamilies('authorization-object-level', { index, itemsById, chains, limit: 6 });
  assert.ok(related.length >= 3);
  assert.ok(related.every(({ id }) => id !== 'authorization-object-level'));
  const linked = related.find(({ id }) => id === index.byItem.get('WAPT-API-001').id);
  assert.ok(linked, 'explicit item.related link produces a family suggestion');
  assert.ok(linked.reasons.some((reason) => reason.includes('linked from WAPT-AUTHZ-003')));
  const chained = related.find(({ id }) => id === index.byItem.get('WAPT-AUTHZ-021').id);
  assert.ok(chained.reasons.some((reason) => reason.includes('IDOR-01')));
  const again = relatedFamilies('authorization-object-level', { index, itemsById, chains, limit: 6 });
  assert.deepEqual(again.map(({ id }) => id), related.map(({ id }) => id), 'deterministic');
});

test('family gaps rank part-finished families before untouched ones', async () => {
  const { familyGaps, indexFamilies, variantKey } = await familiesModule;
  const index = indexFamilies(document);
  const objects = index.byId.get('authorization-object-level');
  const tenants = index.byId.get('authorization-tenant-isolation');
  const recordsByFamily = new Map([
    [objects.id, objects.items.map((id) => record(id))],
    [tenants.id, tenants.items.map((id) => record(id))]
  ]);
  const gaps = familyGaps(index, recordsByFamily, { statuses: { [tenants.items[0]]: 'passed' }, variants: {} }, { limit: 5 });
  assert.equal(gaps[0].family.id, tenants.id, 'the family already opened comes first');
  assert.ok(gaps.some(({ family }) => family.id === objects.id));
  const complete = Object.fromEntries(objects.items.map((id) => [id, 'passed']));
  const variants = Object.fromEntries(objects.dont_miss.map((text) => [variantKey(objects.id, text), true]));
  const closed = familyGaps(index, new Map([[objects.id, objects.items.map((id) => record(id))]]), { statuses: complete, variants }, { limit: 5 });
  assert.equal(closed.length, 0, 'a fully covered family is not a gap');
});
