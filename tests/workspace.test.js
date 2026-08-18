'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const filtersModule = import('../js/ui/filters.js');
const exportModule = import('../js/ui/export.js');
const contextModule = import('../js/engine/context.js');
const applicabilityModule = import('../js/engine/applicability.js');
const stateModule = import('../js/engine/state.js');

function coreItems() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'checklist/manifest.json'), 'utf8'));
  return manifest.categories.filter(({ count }) => count > 0).flatMap(({ file }) => JSON.parse(fs.readFileSync(path.join(ROOT, 'checklist', file), 'utf8')).items);
}

test('full-text filters return exactly every item containing CORS in indexed methodology fields', async () => {
  const [{ filterItems }, { searchableText }, { deriveContext }, { evaluateApplicability }] = await Promise.all([
    filtersModule, import('../js/ui/catalog.js'), contextModule, applicabilityModule
  ]);
  const items = coreItems();
  const context = deriveContext();
  const records = items.map((item) => ({ item, applicability: evaluateApplicability(item, context) }));
  const expected = items.filter((item) => searchableText(item).includes('cors')).map(({ id }) => id).sort();
  const actual = filterItems(records, { query: 'CORS' }, {}).map(({ item }) => item.id).sort();
  assert.ok(expected.length >= 5);
  assert.deepEqual(actual, expected);
});

test('structured filters combine status, mode, tool, tag, and test ID', async () => {
  const { filterItems } = await filtersModule;
  const items = coreItems();
  const records = items.map((item) => ({ item, applicability: { state: 'active' } }));
  const target = items.find(({ id }) => id === 'WAPT-AUTHZ-003');
  const result = filterItems(records, {
    category: 'authorization', severity: target.severity, difficulty: target.difficulty,
    status: 'in_progress', mode: target.mode, tool: 'Repeater', tag: 'idor', testId: 'AUTHZ-003'
  }, { statuses: { [target.id]: 'in_progress' } });
  assert.deepEqual(result.map(({ item }) => item.id), [target.id]);
});

test('checklist Markdown escapes raw HTML from local tester notes', async () => {
  const [{ composeChecklistMarkdown }, { createState, setItemNote, setItemStatus }] = await Promise.all([exportModule, stateModule]);
  const item = coreItems()[0];
  let state = setItemStatus(createState(), item.id, 'passed', '2026-08-18T10:00:00.000Z');
  state = setItemNote(state, item.id, '<script>alert(1)</script>', '2026-08-18T10:00:00.000Z');
  const output = composeChecklistMarkdown([item], state, { [item.category]: 'Reconnaissance' });
  assert.doesNotMatch(output, /<script>/);
  assert.match(output, /&lt;script&gt;/);
  assert.match(output, /- \[x\]/);
});

test('report generator includes findings summary and confirmed-finding retest matrix', async () => {
  const [{ composeReportMarkdown }, { createState, setItemNote, setItemStatus, setRetestFlag }] = await Promise.all([exportModule, stateModule]);
  const [potential, confirmed] = coreItems().slice(0, 2);
  let state = setItemStatus(createState(), potential.id, 'potential_finding', '2026-08-18T10:00:00.000Z');
  state = setItemStatus(state, confirmed.id, 'confirmed_finding', '2026-08-18T10:00:00.000Z');
  state = setItemNote(state, confirmed.id, 'Validated with synthetic object.', '2026-08-18T10:00:00.000Z');
  state = setRetestFlag(state, confirmed.id, true, '2026-08-18T10:00:00.000Z');
  const output = composeReportMarkdown([potential, confirmed], state, {});
  assert.match(output, /Potential findings:\*\* 1/);
  assert.match(output, /Confirmed findings:\*\* 1/);
  assert.match(output, new RegExp(`\\| ${confirmed.id} .*\\| Yes \\|`));
  assert.match(output, /Do not report scanner output without manual confirmation/);
});

test('chain and payload stores load static manifests and expose priority/search data', async () => {
  const [{ createChainStore }, { createPayloadStore }] = await Promise.all([
    import('../js/ui/chains.js'), import('../js/ui/payloads.js')
  ]);
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const file = path.join(ROOT, String(url));
    return { ok: true, json: async () => JSON.parse(fs.readFileSync(file, 'utf8')) };
  };
  try {
    const chains = createChainStore();
    const payloads = createPayloadStore();
    assert.equal((await chains.loadAll()).length, 5);
    assert.ok(chains.priorityEdges().length >= 15);
    const loadedPayloads = await payloads.loadAll();
    assert.equal(loadedPayloads.length, 40);
    assert.ok(loadedPayloads.some(({ review_only }) => review_only));
  } finally {
    global.fetch = originalFetch;
  }
});

test('catalog loader fetches each category once and caches it', async () => {
  const { createCatalog } = await import('../js/ui/catalog.js');
  const document = JSON.parse(fs.readFileSync(path.join(ROOT, 'checklist/reconnaissance.json'), 'utf8'));
  let calls = 0;
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => { calls += 1; return document; } });
  try {
    const catalog = createCatalog();
    catalog.setManifest({ categories: [{ slug: 'reconnaissance', file: 'reconnaissance.json', count: 38 }] });
    const first = await catalog.loadCategory('reconnaissance');
    const second = await catalog.loadCategory('reconnaissance');
    assert.equal(first.length, 38);
    assert.equal(second, first);
    assert.equal(calls, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test('workspace surfaces coverage, evidence packs, retest verdicts, and chain node states', () => {
  const workspace = read('js/ui/workspace.js');
  const chains = read('js/ui/chains.js');
  const appHtml = read('app.html');
  assert.match(workspace, /computeCoverage\(itemList, context\(\)/);
  assert.match(workspace, /renderCoverageSummary\(/);
  assert.match(workspace, /renderEvidencePacks\(/);
  assert.match(workspace, /classifyReportability\(collect\(\)/);
  assert.match(workspace, /setRetestVerdict\(getState\(\), pack\.id/);
  assert.match(workspace, /removeFinding\(getState\(\), pack\.id\)/);
  assert.match(workspace, /addFinding\(getState\(\), collect\(\)\)/);
  assert.match(appHtml, /data-coverage-summary/);
  assert.match(appHtml, /data-evidence-packs/);
  assert.match(chains, /status-chip/);
  assert.match(chains, /unlocked\.add\(edge\.to\)/);
  assert.match(workspace, /statuses: getState\(\)\.statuses/);
});

test('renderChainOverview receives the chain store as a parameter (runtime crash regression)', () => {
  const workspace = read('js/ui/workspace.js');
  assert.match(workspace, /function renderChainOverview\(root, itemList, statuses, chainsStore\)/);
  assert.match(workspace, /renderChainOverview\(document\.querySelector\('\x5bdata-chain-overview\x5d'\), itemList, state\.statuses, chainStore\)/);
  assert.doesNotMatch(workspace, /function renderChainOverview[\s\S]{0,120}const chains = chainStore\.getChains/);
});
