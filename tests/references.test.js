'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { productionItems, offlineCheck, wstgPath } = require('../tools/check-references.js');

const ROOT = path.resolve(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/reference-catalog.json'), 'utf8'));
const liveCatalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/live-source-catalog.json'), 'utf8'));

test('all production references and versioned mappings pass the authoritative offline catalog', () => {
  const items = productionItems();
  const result = offlineCheck(items);
  assert.equal(items.length, 623);
  assert.deepEqual(result.errors, []);
  assert.ok(result.urls.size >= 220);
});

test('every pinned WSTG URL exists in the verified v4.2 repository path snapshot', () => {
  const known = new Set(catalog.wstg_paths);
  const references = productionItems().flatMap(({ references }) => references).filter(({ source }) => source === 'OWASP WSTG');
  assert.ok(references.length >= 400);
  for (const reference of references) assert.ok(known.has(wstgPath(reference.url)), reference.url);
  assert.equal(known.size, 84);
  assert.equal(catalog.wstg_ids.length, 81);
});

test('all used ASVS mappings exist in official ASVS 5.0.0 data', () => {
  const known = new Set(catalog.asvs_ids);
  const used = new Set(productionItems().flatMap(({ mappings }) => mappings.asvs));
  assert.ok(known.size >= 340);
  assert.equal(used.size, 153);
  for (const id of used) assert.ok(known.has(id), id);
});

test('all CWE mappings resolve to current MITRE weakness entries rather than prohibited categories', () => {
  const known = new Set(catalog.cwe_ids);
  const used = new Set(productionItems().flatMap(({ mappings }) => mappings.cwe));
  assert.equal(used.size, 104);
  assert.ok(!used.has('CWE-16'));
  assert.ok(!used.has('CWE-840'));
  for (const id of used) assert.ok(known.has(id), id);
});

test('Top 10 mappings always name their edition and supported identifier', () => {
  const web = new Set(catalog.owasp_top10_ids);
  const api = new Set(catalog.api_top10_ids);
  for (const item of productionItems()) {
    for (const id of item.mappings.owasp_top10) assert.ok(web.has(id), `${item.id}: ${id}`);
    for (const id of item.mappings.api_top10) assert.ok(api.has(id), `${item.id}: ${id}`);
  }
});

test('all non-WSTG source and PortSwigger mapping URLs have a successful live-verification snapshot', () => {
  assert.equal(liveCatalog.verification_channel, 'Arena fetch_page authoritative page retrieval');
  assert.equal(liveCatalog.verified_urls.length, 46);
  const verified = new Set(liveCatalog.verified_urls);
  for (const item of productionItems()) {
    for (const reference of item.references) {
      if (reference.source !== 'OWASP WSTG') assert.ok(verified.has(reference.url), `${item.id}: ${reference.url}`);
    }
    for (const url of item.mappings.portswigger) assert.ok(verified.has(url), `${item.id}: ${url}`);
  }
});

test('reference titles and source labels contain no authoring placeholders', () => {
  for (const item of productionItems()) {
    for (const reference of item.references) {
      assert.doesNotMatch(reference.title, /placeholder|example title|owasp reference:/i, item.id);
      if (reference.source === 'OWASP WSTG') assert.doesNotMatch(reference.url, /\/latest\//, `${item.id} must not use mutable WSTG latest links`);
    }
  }
});
