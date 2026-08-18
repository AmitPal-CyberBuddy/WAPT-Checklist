#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'checklist', 'manifest.json'), 'utf8'));
const items = [];
for (const category of manifest.categories) {
  items.push(...JSON.parse(fs.readFileSync(path.join(ROOT, 'checklist', category.file), 'utf8')).items);
}

function ms(start) {
  return Number((Number(process.hrtime.bigint() - start) / 1e6).toFixed(1));
}

async function main() {
  const [{ deriveContext }, { evaluateApplicability }, { suggestedNext }] = await Promise.all([
    import('../js/engine/context.js'), import('../js/engine/applicability.js'), import('../js/engine/priorities.js')
  ]);
  const { filterItems } = await import('../js/ui/filters.js');
  const { computeCoverage } = await import('../js/engine/coverage.js');
  const { createState, setItemStatus, addFinding, serializeState, importState } = await import('../js/engine/state.js');
  const { composeReportMarkdown } = await import('../js/ui/export.js');

  const context = deriveContext({});
  const records = items.map((item) => ({ item, applicability: evaluateApplicability(item, context) }));
  const state = createState();

  const report = { items: items.length, categories: manifest.categories.length };

  let start = process.hrtime.bigint();
  for (const query of ['jwt', 'CORS', 'authorization', 'passkey', 'prompt injection', 'race condition']) {
    filterItems(records, { query }, state);
  }
  report.searchSixQueriesMs = ms(start);

  start = process.hrtime.bigint();
  filterItems(records, { category: 'authorization', severity: 'high', technology: 'jwt' }, state);
  report.combinedFilterMs = ms(start);

  start = process.hrtime.bigint();
  suggestedNext(items, context, { limit: 8 });
  report.suggestedNextMs = ms(start);

  start = process.hrtime.bigint();
  computeCoverage(items, context, state.statuses);
  report.coverageMs = ms(start);

  start = process.hrtime.bigint();
  composeReportMarkdown(items, state, {});
  report.reportEmptyMs = ms(start);

  let big = state;
  for (let index = 0; index < 50; index += 1) {
    const id = `WAPT-AUTHZ-${String((index % 43) + 1).padStart(3, '0')}`;
    big = setItemStatus(big, id, 'confirmed_finding', '2026-08-18T00:00:00.000Z');
    try {
      big = addFinding(big, {
        item_id: id, title: `Finding ${index}`, baseline_request: 'GET /x '.repeat(50),
        test_request: 'POST /x '.repeat(50), observed_behavior: 'Changed behavior.',
        exploitability: 'proven', reportable: true
      }, '2026-08-18T00:00:00.000Z');
    } catch { /* duplicate IDs are skipped; timing remains representative */ }
  }
  start = process.hrtime.bigint();
  composeReportMarkdown(items, big, {});
  report.reportWithFindingsMs = ms(start);

  const exported = serializeState(big);
  report.exportBytes = exported.length;
  start = process.hrtime.bigint();
  importState(exported);
  report.importRoundTripMs = ms(start);

  start = process.hrtime.bigint();
  evaluateApplicability(items[0], context);
  report.singleApplicabilityMs = ms(start);

  // Engagement-size simulation: small / medium / large active plans
  report.engagementSizesMs = {};
  for (const size of [20, 150, 500]) {
    const subset = items.slice(0, size);
    const subsetRecords = subset.map((item) => ({ item, applicability: evaluateApplicability(item, context) }));
    let sizeStart = process.hrtime.bigint();
    filterItems(subsetRecords, { query: 'auth' }, createState());
    const searchMs = ms(sizeStart);
    sizeStart = process.hrtime.bigint();
    suggestedNext(subset, context, { limit: 8 });
    const nextMs = ms(sizeStart);
    sizeStart = process.hrtime.bigint();
    composeReportMarkdown(subset, createState(), {});
    const reportMs = ms(sizeStart);
    sizeStart = process.hrtime.bigint();
    computeCoverage(subset, context, {});
    const coverageMs = ms(sizeStart);
    report.engagementSizesMs[size] = { searchMs, nextMs, reportMs, coverageMs };
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
