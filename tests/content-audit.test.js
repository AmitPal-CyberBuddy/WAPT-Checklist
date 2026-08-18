'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readProduction, audit, jaccard } = require('../tools/audit-content.js');

const ROOT = path.resolve(__dirname, '..');

test('content audit passes without errors or unresolved review warnings', () => {
  const result = audit(readProduction());
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.metrics.items, 609);
  assert.equal(result.metrics.categories, 24);
  assert.equal(result.metrics.attackChains, 5);
  assert.equal(result.metrics.payloadReferences, 40);
  assert.equal(result.metrics.burpWorkflows, 12);
});

test('machine-readable content QA report matches the audited catalog', () => {
  const report = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/content-audit-report.json'), 'utf8'));
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.warnings, []);
  assert.equal(report.metrics.manual + report.metrics.automated, 609);
  assert.equal(report.metrics.safetyNotes, 365);
  assert.equal(report.metrics.references, 809);
  assert.equal(Object.keys(report.metrics.categoryCounts).length, 24);
});

test('near-duplicate similarity catches equivalent wording', () => {
  assert.ok(jaccard('Prevent duplicate payment transaction', 'Prevent payment duplicate transaction') > 0.8);
  assert.ok(jaccard('Validate WebSocket Origin', 'Review source map secrets') < 0.3);
});
