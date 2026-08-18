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

test('family validation passes for ALL 25 categories with exact membership', () => {
  const result = validateFamilies(allItems);
  assert.deepEqual(result.errors, []);
  assert.equal(result.familyCount, families.length);
  assert.equal(result.familyCount, 196);
  assert.equal(result.familyMap.size, allItems.length, 'every production item belongs to exactly one family');
});

test('every family carries an explicit, authored Quick Test and validation line', () => {
  for (const family of families) {
    assert.ok(Array.isArray(family.quick_test), `${family.id} quick_test missing`);
    assert.ok(family.quick_test.length >= 3 && family.quick_test.length <= 5, `${family.id} quick_test length`);
    for (const line of family.quick_test) {
      assert.ok(line.length >= 12 && line.length <= 90, `${family.id} quick_test line length: ${line}`);
      assert.doesNotMatch(line, /^(the|a|an|this)\s/i, `${family.id} quick_test must be imperative`);
    }
    assert.ok(family.validate.length >= 30 && family.validate.length <= 160, `${family.id} validate length`);
  }
});

test('Quick Test is authored content, never a copy of the item methodology steps', () => {
  const stepsById = new Map(allItems.map(({ item }) => [item.id, item.steps]));
  let duplicates = 0;
  for (const family of families) {
    for (const id of family.items) {
      const steps = stepsById.get(id) || [];
      if (steps.join('|') === family.quick_test.join('|')) duplicates += 1;
    }
  }
  assert.equal(duplicates, 0, 'no family quick test duplicates an item step list verbatim');
});

test('family validator rejects generated or oversized quick tests', () => {
  const entry = 'Check every HTTP method against the same object identifier';
  const base = { id: 'x-family', category: 'authorization', title: 'T', summary: 'S', items: ['WAPT-AUTHZ-003'], dont_miss: [entry], validate: 'Confirmed with two controlled accounts and an authoritative read.' };
  const short = validateFamilies(allItems, { families: [{ ...base, quick_test: ['Capture as A', 'Swap the id'] }] });
  assert.ok(short.errors.some((error) => error.includes('quick_test must contain 3 to 5')));
  const verbose = validateFamilies(allItems, { families: [{ ...base, quick_test: ['Capture the request as user A', 'Swap the identifier', 'x'.repeat(120)] }] });
  assert.ok(verbose.errors.some((error) => error.includes('12 to 90 characters')));
  const descriptive = validateFamilies(allItems, { families: [{ ...base, quick_test: ['The tester should capture a request', 'Swap the identifier for B', 'Compare the responses'] }] });
  assert.ok(descriptive.errors.some((error) => error.includes('imperative')));
  const noValidate = validateFamilies(allItems, { families: [{ ...base, validate: 'too short', quick_test: ['Capture the request as A', 'Swap the identifier for B', 'Compare the responses'] }] });
  assert.ok(noValidate.errors.some((error) => error.includes('validate must be a single')));
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

test('every category is fully covered exactly once by its families', () => {
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
  assert.equal(membership.size, 623, 'all 623 items are assigned exactly once');
  for (const [category, all] of categoryItems) {
    const assigned = new Set([...membership.keys()].filter((id) => all.has(id)));
    assert.equal(assigned.size, all.size, `${category} must be fully covered`);
    assert.equal([...new Set(families.filter((f) => f.category === category).map((f) => f.id))].length, families.filter((f) => f.category === category).length, `${category} family ids unique`);
  }
  assert.equal(new Set(families.map((f) => f.category)).size, 25, 'all 25 categories have families');
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
