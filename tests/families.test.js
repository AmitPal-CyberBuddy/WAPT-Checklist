'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const { validateFamilies } = require('../tools/validate.js');

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'checklist', 'manifest.json'), 'utf8'));
const allItems = [];
for (const category of manifest.categories) {
  const document = JSON.parse(fs.readFileSync(path.join(ROOT, 'checklist', category.file), 'utf8'));
  for (const item of document.items) allItems.push({ item, sample: false });
}
const families = JSON.parse(fs.readFileSync(path.join(ROOT, 'checklist', 'families.json'), 'utf8')).families;

test('family validation passes for the authored categories with exact membership', () => {
  const result = validateFamilies(allItems);
  assert.deepEqual(result.errors, []);
  assert.equal(result.familyCount, families.length);
  assert.equal(result.familyMap.size, allItems.filter(({ item }) => families.some((f) => f.category === item.category)).length);
});

test('every authored family has a specific dont-miss list and valid metadata', () => {
  for (const family of families) {
    assert.match(family.id, /^[a-z0-9-]{4,80}$/, family.id);
    assert.ok(manifest.categories.some(({ slug }) => slug === family.category), family.id);
    assert.ok(family.title.length > 0 && family.summary.length > 0, family.id);
    assert.ok(family.items.length > 0, family.id);
    for (const entry of family.dont_miss) assert.ok(entry.length >= 25, `${family.id} dont-miss entry too generic`);
  }
});

test('authored categories (authorization, authentication, api-security, file-handling) are fully covered exactly once', () => {
  const categoryItems = new Map();
  for (const { item } of allItems) {
    const set = categoryItems.get(item.category) || new Set();
    set.add(item.id);
    categoryItems.set(item.category, set);
  }
  const membership = new Map();
  for (const family of families) {
    for (const id of family.items) {
      assert.ok(!membership.has(id), `duplicate membership ${id}`);
      membership.set(id, family.id);
    }
  }
  for (const category of ['authorization', 'authentication', 'api-security', 'file-handling']) {
    const all = categoryItems.get(category);
    const assigned = new Set([...membership.keys()].filter((id) => all.has(id)));
    assert.equal(assigned.size, all.size, `${category} must be fully covered`);
  }
  // the four initial categories carry 154 items across 32 families
  assert.equal(membership.size, 154);
});

test('family validator rejects unresolved, duplicated, cross-category, and generic dont-miss data', () => {
  const entry = 'An entry long enough to pass the specificity gate.';
  const unresolved = validateFamilies(allItems, { families: [{ id: 'x-bad-family', category: 'authorization', title: 'T', summary: 'S', items: ['WAPT-NOPE-001'], dont_miss: [entry] }] });
  assert.ok(unresolved.errors.some((e) => e.includes('unresolved item WAPT-NOPE-001')), JSON.stringify(unresolved.errors));

  const duplicate = validateFamilies(allItems, { families: [
    { id: 'family-a', category: 'authorization', title: 'T', summary: 'S', items: ['WAPT-AUTHZ-003'], dont_miss: [entry] },
    { id: 'family-b', category: 'authorization', title: 'T', summary: 'S', items: ['WAPT-AUTHZ-003'], dont_miss: [entry] }
  ] });
  assert.ok(duplicate.errors.some((e) => e.includes('already assigned to family')));

  const cross = validateFamilies(allItems, { families: [{ id: 'cross-cat', category: 'authentication', title: 'T', summary: 'S', items: ['WAPT-AUTHZ-003'], dont_miss: [entry] }] });
  assert.ok(cross.errors.some((e) => e.includes('belongs to authorization')));

  const generic = validateFamilies(allItems, { families: [{ id: 'generic-dm', category: 'authorization', title: 'T', summary: 'S', items: ['WAPT-AUTHZ-003'], dont_miss: ['x'] }] });
  assert.ok(generic.errors.some((e) => e.includes('minimum 25 characters')));

  const incomplete = validateFamilies(allItems, { families: [{ id: 'partial-cat', category: 'authorization', title: 'T', summary: 'S', items: ['WAPT-AUTHZ-003'], dont_miss: [entry] }] });
  assert.ok(incomplete.errors.some((e) => e.includes('is not assigned to any family')));
});
