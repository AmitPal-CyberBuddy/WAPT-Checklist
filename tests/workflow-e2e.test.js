'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

test('end-to-end assessment workflow: scope → prioritize → confirm → evidence → verdict → coverage → report', async () => {
  const [{ deriveContext }, { evaluateApplicability, APPLICABILITY }, { suggestedNext },
    { createState, setEngagement, setAnswers, setItemStatus, addFinding, setRetestVerdict },
    { computeCoverage, retestQueue }, { classifyReportability }] = await Promise.all([
    import('../js/engine/context.js'), import('../js/engine/applicability.js'), import('../js/engine/priorities.js'),
    import('../js/engine/state.js'), import('../js/engine/coverage.js'), import('../js/engine/reportability.js')
  ]);
  const { composeReportMarkdown } = await import('../js/ui/export.js');
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'checklist/manifest.json'), 'utf8'));
  const all = [];
  for (const category of manifest.categories) {
    const document = JSON.parse(fs.readFileSync(path.join(ROOT, 'checklist', category.file), 'utf8'));
    all.push(...document.items);
  }
  const NOW = '2026-08-18T12:00:00.000Z';

  let state = createState();
  state = setEngagement(state, { name: 'Acme SaaS review', targetUrl: 'https://app.example.com', started_at: NOW }, NOW);
  state = setAnswers(state, { app_type: 'spa', has_login: 'yes', auth_mechanism: ['jwt'], features: ['multi_tenant'] }, NOW);

  const context = deriveContext(state.answers, state.engagement.targetUrl);
  const items = all.map((item) => ({ item, applicability: evaluateApplicability(item, context) }));
  const executable = items.filter(({ applicability }) => applicability.state !== APPLICABILITY.NA_CONTEXT);
  assert.ok(executable.length > 400, 'scoped plan should be substantial');
  const suggestions = suggestedNext(all, context, { statuses: state.statuses, limit: 8 });
  assert.equal(suggestions.length, 8);
  assert.ok(suggestions.every(({ applicability }) => applicability.state !== APPLICABILITY.NA_CONTEXT && !applicability.blocked));

  const target = suggestions[0].item;
  state = setItemStatus(state, target.id, 'confirmed_finding', NOW);
  state = addFinding(state, {
    item_id: target.id, title: 'Verified cross-tenant read', severity: 'high',
    endpoint: 'GET /api/objects/1001', method: 'GET', parameter: 'id', auth_context: 'tenant A user',
    baseline_request: 'GET /api/objects/1000', test_request: 'GET /api/objects/1001',
    observed_behavior: 'Response contains tenant B object.', exploitability: 'proven', reportable: true,
    cleanup_performed: 'Synthetic records deleted.', root_cause: 'No tenant dimension in the query.'
  }, NOW);
  const pack = state.findings[0];
  const classification = classifyReportability(pack, { item: target });
  assert.equal(classification.stage, 'reportable');
  state = setRetestVerdict(state, pack.id, 'partial', 'Bulk export still reproduces.', NOW);

  const coverage = computeCoverage(all, context, state.statuses);
  assert.equal(coverage.overall.executable, executable.length);
  assert.equal(coverage.overall.tested, 1);
  assert.ok(coverage.overall.coverage <= 1);
  assert.equal(retestQueue(state).closed[0].retest_verdict, 'partial');

  const markdown = composeReportMarkdown(all, state, Object.fromEntries(manifest.categories.map(({ slug, name }) => [slug, name])));
  assert.match(markdown, /## Evidence packs/);
  assert.match(markdown, /partial/);
  assert.match(markdown, /tenant B object/);
});
