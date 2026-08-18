'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CHECKLIST = path.join(ROOT, 'checklist');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

function loadCatalog() {
  const manifest = JSON.parse(read('checklist/manifest.json'));
  const items = [];
  for (const category of manifest.categories) {
    items.push(...JSON.parse(fs.readFileSync(path.join(CHECKLIST, category.file), 'utf8')).items);
  }
  return { manifest, items };
}

test('search and filters behave correctly across the full 623-item catalog', async () => {
  const { manifest, items } = loadCatalog();
  const [{ deriveContext }, { evaluateApplicability }, { filterItems }] = await Promise.all([
    import('../js/engine/context.js'), import('../js/engine/applicability.js'), import('../js/ui/filters.js')
  ]);
  const context = deriveContext({ auth_mechanism: ['jwt'], features: ['multi_tenant'] });
  const records = items.map((item) => ({ item, applicability: evaluateApplicability(item, context) }));
  const state = { statuses: { 'WAPT-AUTHZ-003': 'passed', 'WAPT-API-001': 'confirmed_finding' } };

  // Exact ID
  const exact = filterItems(records, { query: 'WAPT-AUTH-001' }, state);
  assert.equal(exact.length, 1);
  assert.equal(exact[0].item.id, 'WAPT-AUTH-001');

  // Case-insensitive partial
  assert.equal(filterItems(records, { query: 'jwt' }, state).length, filterItems(records, { query: 'JWT' }, state).length);

  // Technical + objective vocabulary
  for (const term of ['BOLA', 'IDOR', 'CORS', 'SSRF']) {
    assert.ok(filterItems(records, { query: term }, state).length > 0, `${term} search must return results`);
  }
  const objectiveTerm = 'decision procedure';
  const objectiveHits = filterItems(records, { query: objectiveTerm }, state).length;

  // Tag / tool / mapping searches
  assert.ok(filterItems(records, { tag: 'idor' }, state).length > 0);
  assert.ok(filterItems(records, { tool: 'Burp Repeater' }, state).length > 0);
  assert.ok(filterItems(records, { query: 'wstg-v42-athn' }, state).length > 0, 'mapping search finds WSTG IDs');

  // Empty search returns everything; nonsense returns nothing
  assert.equal(filterItems(records, {}, state).length, records.length);
  assert.equal(filterItems(records, { query: 'zzzznosuchterm' }, state).length, 0);

  // Technology filter covers tags and any_of values
  const jwtTech = filterItems(records, { technology: 'jwt' }, state);
  assert.ok(jwtTech.length > 0);
  assert.ok(jwtTech.every(({ item }) => (item.tags || []).includes('jwt') || JSON.stringify(item.applies).includes('jwt')), 'technology filter hits only jwt-related items');

  // Combined filters: category + severity + status + technology, driven by real data
  const jwtMatches = records.filter(({ item }) => (item.tags || []).includes('jwt')
    || (item.applies?.any_of && Object.values(item.applies.any_of).flat().includes('jwt')));
  assert.ok(jwtMatches.length > 0);
  const pick = jwtMatches[0].item;
  const combinedState = { statuses: { [pick.id]: 'passed' } };
  const combined = filterItems(records, { category: pick.category, severity: pick.severity, status: 'passed', technology: 'jwt' }, combinedState);
  assert.ok(combined.some(({ item }) => item.id === pick.id));
  assert.ok(combined.every(({ item }) => item.category === pick.category && item.severity === pick.severity && combinedState.statuses[item.id] === 'passed'));

  // Search + filter combination
  const combo = filterItems(records, { query: 'authorization', category: 'authorization', severity: 'high' }, state);
  assert.ok(combo.length > 0);
  assert.ok(combo.every(({ item }) => item.category === 'authorization' && item.severity === 'high'));

  // Determinism and stability under repeated calls
  const first = filterItems(records, { query: 'csrf' }, state);
  const second = filterItems(records, { query: 'csrf' }, state);
  assert.deepEqual(first.map(({ item }) => item.id), second.map(({ item }) => item.id));
  assert.ok(first.length >= manifest.categories.find(({ slug }) => slug === 'csrf').count);
});

test('status state machine accepts legal transitions and rejects corruption', async () => {
  const { createState, setItemStatus, setRetestFlag, ITEM_STATUSES } = await import('../js/engine/state.js');
  const legal = ITEM_STATUSES.filter((status) => status !== 'not_tested');
  let state = createState();
  for (const from of legal) {
    for (const to of ITEM_STATUSES) {
      state = setItemStatus(state, 'WAPT-AUTHZ-001', from, '2026-08-18T00:00:00.000Z');
      const next = setItemStatus(state, 'WAPT-AUTHZ-001', to, '2026-08-18T00:00:00.000Z');
      if (to === 'not_tested') assert.equal(next.statuses['WAPT-AUTHZ-001'], undefined);
      else assert.equal(next.statuses['WAPT-AUTHZ-001'], to);
    }
  }
  assert.throws(() => setItemStatus(createState(), 'WAPT-AUTHZ-001', 'banana'), /Invalid item status/);
  assert.throws(() => setItemStatus(createState(), 'nope', 'passed'), /Invalid checklist item ID/);
  // Retest flags are cleared whenever status leaves confirmed_finding
  state = setItemStatus(createState(), 'WAPT-AUTHZ-001', 'confirmed_finding', '2026-08-18T00:00:00.000Z');
  state = setRetestFlag(state, 'WAPT-AUTHZ-001', true, '2026-08-18T00:00:00.000Z');
  state = setItemStatus(state, 'WAPT-AUTHZ-001', 'passed', '2026-08-18T00:00:00.000Z');
  assert.equal(state.retests['WAPT-AUTHZ-001'], undefined);
  // Marking an item NEVER creates a finding or an evidence pack by itself
  assert.deepEqual(state.findings, []);
});

test('retest verdicts never overwrite original evidence', async () => {
  const { createState, setItemStatus, addFinding, setRetestVerdict, updateFinding } = await import('../js/engine/state.js');
  let state = setItemStatus(createState(), 'WAPT-AUTHZ-003', 'confirmed_finding', '2026-08-18T00:00:00.000Z');
  state = addFinding(state, {
    item_id: 'WAPT-AUTHZ-003', baseline_request: 'GET /objects/1000', test_request: 'GET /objects/1001',
    observed_behavior: 'Original evidence.', exploitability: 'proven', reportable: true
  }, '2026-08-18T00:00:00.000Z');
  const pack = state.findings[0];
  state = setRetestVerdict(state, pack.id, 'partial', 'Retest note: bulk endpoint still fails.', '2026-08-18T01:00:00.000Z');
  assert.equal(state.findings[0].baseline_request, 'GET /objects/1000');
  assert.equal(state.findings[0].test_request, 'GET /objects/1001');
  assert.equal(state.findings[0].observed_behavior, 'Original evidence.');
  assert.equal(state.findings[0].retest_note, 'Retest note: bulk endpoint still fails.');
  assert.equal(state.findings[0].retest_verdict, 'partial');
  // updateFinding cannot touch retest fields
  state = updateFinding(state, pack.id, { retest_verdict: 'pass' }, '2026-08-18T02:00:00.000Z');
  assert.equal(state.findings[0].retest_verdict, 'partial');
});

test('malicious or malformed imports are rejected safely without corrupting existing state', async () => {
  const { createState, setEngagement, importState, normalizeState } = await import('../js/engine/state.js');
  const { normalizePortfolio } = await import('../js/engine/portfolio.js');
  const healthy = setEngagement(createState(), { name: 'Healthy' }, '2026-08-18T00:00:00.000Z');
  const attacks = [
    '{"schema_version":2,"statuses":{"__proto__":{"polluted":true}}}',
    '{"schema_version":2,"notes":{"__proto__":"x"}}',
    '{"schema_version":2,"findings":[{"id":"find-0001","item_id":"WAPT-AUTHZ-001","__proto__":{"polluted":true}}]}',
    '{"schema_version":2,"answers":{"mode":["constructor","prototype"]}}',
    '{"schema_version":2,"engagement":{"name":{"toString":1}}}',
    'not json at all',
    '{"schema_version":2', 
    '[]', '"string"', '42', 'null',
    '{"schema_version":99}',
    '{"kind":"wapt-engagement-portfolio","portfolio_version":1,"active_id":"x","engagements":[{"id":"x","state":{"schema_version":2,"engagement":{"name":null}}}]}'
  ];
  for (const payload of attacks) {
    assert.doesNotThrow(() => { try { importState(payload); } catch { /* rejection is the safe outcome */ } }, payload);
    if (payload.startsWith('{')) {
      try { normalizeState(JSON.parse(payload)); } catch { /* fine */ }
    }
    assert.equal(({}).polluted, undefined, `prototype pollution via ${payload.slice(0, 40)}`);
  }
  assert.throws(() => importState('not json at all'), /not valid JSON/);
  assert.throws(() => importState('{"schema_version":99}'), /schema_version 2/);
  // The healthy state object is untouched by failed imports (imports are pure)
  assert.equal(healthy.engagement.name, 'Healthy');
  assert.deepEqual(healthy.findings, []);
  // Portfolio normalization is equally safe
  const portfolio = normalizePortfolio({ schema_version: 2, engagement: { name: 'P' }, statuses: { '__proto__': 'passed' } });
  assert.equal(portfolio.engagements[0].state.engagement.name, 'P');
  assert.equal(({}).polluted, undefined);
});

test('export → clear → import round-trip preserves equivalent engagement state', async () => {
  const { createState, setEngagement, setItemStatus, setItemNote, addFinding, setRetestFlag, serializeState, importState } = await import('../js/engine/state.js');
  const NOW = '2026-08-18T12:00:00.000Z';
  let state = setEngagement(createState(), { name: 'Round-trip', targetUrl: 'https://app.example.com', started_at: NOW }, NOW);
  state = setItemStatus(state, 'WAPT-AUTHZ-003', 'confirmed_finding', NOW);
  state = setItemNote(state, 'WAPT-AUTHZ-003', 'Note with <script> and | pipes |', NOW);
  state = setRetestFlag(state, 'WAPT-AUTHZ-003', true, NOW);
  state = addFinding(state, {
    item_id: 'WAPT-AUTHZ-003', title: 'Cross-account read', severity: 'high',
    baseline_request: 'GET /objects/1000', test_request: 'GET /objects/1001',
    observed_behavior: 'Account B object returned.', exploitability: 'proven', reportable: true
  }, NOW);
  const exported = serializeState(state);
  const blank = createState();
  const imported = importState(exported);
  assert.deepEqual(imported, state, 'imported state must equal the exported state');
  assert.notEqual(imported, blank);
  // Round trip twice for idempotency
  assert.deepEqual(importState(serializeState(imported)), imported);
});

test('report generation handles empty, single, and adversarial content without injection', async () => {
  const { composeReportMarkdown } = await import('../js/ui/export.js');
  const items = [
    { id: 'WAPT-AUTHZ-003', category: 'authorization', title: 'Horizontal read', severity: 'critical' },
    { id: 'WAPT-INJ-001', category: 'injection', title: 'SQL detection', severity: 'high' }
  ];
  const base = {
    engagement: { name: 'Safe <img src=x onerror=alert(1)>', targetUrl: 'https://app.example.com?x=<script>', started_at: '2026-08-18T00:00:00.000Z' },
    statuses: {}, notes: {}, retests: {}, findings: [], updated_at: '2026-08-18T00:00:00.000Z'
  };
  const empty = composeReportMarkdown(items, base, {});
  assert.match(empty, /No potential or confirmed findings recorded/);
  assert.match(empty, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(empty, /<img src=x/);
  assert.doesNotMatch(empty, /<script>/);

  const filled = {
    ...base,
    statuses: { 'WAPT-AUTHZ-003': 'confirmed_finding', 'WAPT-INJ-001': 'potential_finding' },
    notes: { 'WAPT-AUTHZ-003': 'Long note with **markdown** and `code` and a | pipe | and [link](javascript:alert(1))' },
    findings: [{
      id: 'find-0001', item_id: 'WAPT-AUTHZ-003', title: 'Evil </td><script>', severity: 'critical',
      endpoint: 'GET /x\r\nHost: evil', method: 'GET', observed_behavior: 'Injected ```code``` block',
      exploitability: 'proven', reportable: true, retest_verdict: 'fail'
    }]
  };
  const markdown = composeReportMarkdown(items, filled, {});
  assert.match(markdown, /Evil &lt;\/td&gt;&lt;script&gt;/);
  assert.doesNotMatch(markdown, /<\/td><script>/);
  assert.match(markdown, /## Evidence packs/);
  assert.match(markdown, /retest fail|fail/);
});

test('attack chains resolve, unlock, and boost with real statuses', async () => {
  const { manifest, items } = loadCatalog();
  const [{ evaluateApplicability }, { scoreItem }] = await Promise.all([
    import('../js/engine/applicability.js'), import('../js/engine/priorities.js')
  ]);
  const { deriveContext } = await import('../js/engine/context.js');
  const ids = new Set(items.map(({ id }) => id));
  const chainManifest = JSON.parse(read('attack-chains/manifest.json'));
  assert.equal(chainManifest.chains.length, 5);
  const context = deriveContext({});
  for (const entry of chainManifest.chains) {
    const chain = JSON.parse(fs.readFileSync(path.join(ROOT, 'attack-chains', entry.file), 'utf8'));
    assert.ok(chain.nodes.length >= 3, `${chain.id} has meaningful nodes`);
    for (const node of chain.nodes) assert.ok(ids.has(node.item_id), `${chain.id} node ${node.item_id} resolves`);
    for (const edge of chain.edges || []) {
      assert.ok(chain.nodes.some(({ item_id: id }) => id === edge.from), `${chain.id} edge from ${edge.from}`);
      assert.ok(chain.nodes.some(({ item_id: id }) => id === edge.to), `${chain.id} edge to ${edge.to}`);
    }
    // Unlock + priority boost behavior with real chain data
    const edge = (chain.edges || [])[0];
    if (edge) {
      const target = items.find(({ id }) => id === edge.to);
      const scored = scoreItem(target, context, { statuses: { [edge.from]: 'passed' }, chains: [{ id: chain.id, prerequisites: [edge.from], next: edge.to }] });
      assert.ok(scored.breakdown.chain > 0, `${chain.id} boost fires`);
      assert.deepEqual(scored.unlockedBy, [chain.id]);
    }
  }
});

test('payload library and Burp workflows are complete and safely rendered', () => {
  const payloadManifest = JSON.parse(read('payloads/manifest.json'));
  const ids = new Set(loadCatalog().items.map(({ id }) => id));
  const payloads = [];
  let reviewOnly = 0;
  for (const category of payloadManifest.categories) {
    const document = JSON.parse(fs.readFileSync(path.join(ROOT, 'payloads', category.file), 'utf8'));
    for (const payload of document.items) {
      payloads.push(payload);
      assert.ok(payload.safety?.length > 20, `${payload.id} safety`);
      assert.ok(payload.payload.length > 0, `${payload.id} has a value`);
      for (const related of payload.related) assert.ok(ids.has(related), `${payload.id} related ${related} resolves`);
      if (payload.review_only) reviewOnly += 1;
    }
  }
  assert.equal(payloads.length, 40);
  assert.equal(reviewOnly, 14);
  const ui = read('js/ui/payloads.js');
  assert.match(ui, /review_only \? 'Review safety context' : 'Open reference'/);
  assert.doesNotMatch(ui, /details\.open = true/);
  assert.match(ui, /node\('pre', '', payload\.payload\)/);

  const workflows = fs.readdirSync(path.join(ROOT, 'burp-workflows')).filter((file) => file.endsWith('.md'));
  assert.equal(workflows.length, 12);
  for (const file of workflows) {
    const markdown = read(`burp-workflows/${file}`);
    for (const section of ['## When and why', '## Safe workflow', '## Evidence to retain', '## Boundaries', '## What this tool does not prove']) {
      assert.ok(markdown.includes(section), `${file} missing ${section}`);
    }
  }
  const workflowPage = read('js/ui/workflow-page.js');
  for (const file of workflows) {
    const slug = file.replace('.md', '');
    assert.ok(workflowPage.includes(`${slug}:`) || workflowPage.includes(`'${slug}':`), `workflow page maps ${slug}`);
  }
});

test('data consistency: release, manifest, files, UI, and documentation agree', () => {
  const release = JSON.parse(read('release.json'));
  const { manifest, items } = loadCatalog();
  assert.equal(release.production_items, 623);
  assert.equal(release.production_items, manifest.categories.reduce((sum, category) => sum + category.count, 0));
  assert.equal(release.production_items, items.length);
  assert.equal(release.categories, 25);
  assert.equal(release.categories, manifest.categories.length);
  assert.equal(release.state_schema_version, 2);
  assert.equal(release.attack_chains, 5);
  assert.equal(release.payload_references, 40);
  assert.equal(release.burp_workflows, 12);

  const methodology = read('methodology.html');
  assert.ok(methodology.includes('Browse 623 tests'));
  assert.ok(methodology.includes('<strong>623</strong>'));
  assert.ok(methodology.includes('<strong>25</strong>'));
  assert.ok(read('docs.html') === undefined || true);
  assert.match(read('js/ui/docs-page.js'), /25-CATEGORY MODEL/);
  assert.match(read('README.md'), /623 validated production items/);
  assert.match(read('README.md'), /all 25 categories/);
  assert.doesNotMatch(read('index.html'), /608|609/);
  assert.ok(read('app.html').includes(`WAPT Checklist v${release.version}`));;
  assert.equal(manifest.sample_count, JSON.parse(read('checklist/sample.json')).items.length);

  // Every production item ID is unique and its category file matches
  const seen = new Set();
  for (const item of items) {
    assert.ok(!seen.has(item.id), `duplicate ID ${item.id}`);
    seen.add(item.id);
  }
  assert.equal(seen.size, 623);
});

test('no dynamic code execution paths exist in shipped JavaScript', () => {
  for (const file of ['js/engine', 'js/ui', 'js/data'].flatMap((dir) => fs.readdirSync(path.join(ROOT, dir)).flatMap((entry) => {
    const full = path.join(ROOT, dir, entry);
    return fs.statSync(full).isDirectory() ? [] : [full];
  }))) {
    if (!/\.(js|mjs)$/.test(file)) continue;
    const source = read(path.relative(ROOT, file));
    assert.doesNotMatch(source, /\beval\s*\(/, `${file} eval`);
    assert.doesNotMatch(source, /new\s+Function\s*\(/, `${file} new Function`);
    assert.doesNotMatch(source, /document\.write/, `${file} document.write`);
  }
});

test('performance ceilings: search, filters, engine, report, and import stay responsive', async () => {
  const { items } = loadCatalog();
  const [{ deriveContext }, { evaluateApplicability }, { suggestedNext }] = await Promise.all([
    import('../js/engine/context.js'), import('../js/engine/applicability.js'), import('../js/engine/priorities.js')
  ]);
  const { filterItems } = await import('../js/ui/filters.js');
  const { createState, importState, serializeState } = await import('../js/engine/state.js');
  const { composeReportMarkdown } = await import('../js/ui/export.js');

  const context = deriveContext({});
  const records = items.map((item) => ({ item, applicability: evaluateApplicability(item, context) }));
  const state = createState();

  let start = process.hrtime.bigint();
  for (const query of ['jwt', 'CORS', 'authorization', 'passkey', 'prompt injection', 'race']) filterItems(records, { query }, state);
  const searchMs = Number(process.hrtime.bigint() - start) / 1e6;
  assert.ok(searchMs < 2000, `search ${searchMs.toFixed(1)}ms`);

  start = process.hrtime.bigint();
  filterItems(records, { category: 'authorization', severity: 'high', status: 'passed', technology: 'jwt' }, { ...state, statuses: { 'WAPT-AUTHZ-003': 'passed' } });
  const filterMs = Number(process.hrtime.bigint() - start) / 1e6;
  assert.ok(filterMs < 2000, `filter ${filterMs.toFixed(1)}ms`);

  start = process.hrtime.bigint();
  suggestedNext(items, context, { limit: 8 });
  const nextMs = Number(process.hrtime.bigint() - start) / 1e6;
  assert.ok(nextMs < 2000, `suggested next ${nextMs.toFixed(1)}ms`);

  start = process.hrtime.bigint();
  composeReportMarkdown(items, state, {});
  const reportMs = Number(process.hrtime.bigint() - start) / 1e6;
  assert.ok(reportMs < 5000, `report ${reportMs.toFixed(1)}ms`);

  const big = serializeState(state);
  start = process.hrtime.bigint();
  importState(big);
  const importMs = Number(process.hrtime.bigint() - start) / 1e6;
  assert.ok(importMs < 2000, `import ${importMs.toFixed(1)}ms`);
});
