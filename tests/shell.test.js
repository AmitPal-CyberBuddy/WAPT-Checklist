'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const REQUIRED_CSP = "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'";

test('every HTML page carries the required restrictive CSP and authorized-use message', () => {
  for (const page of ['index.html', 'app.html']) {
    const html = read(page);
    assert.ok(html.includes(REQUIRED_CSP), `${page} CSP differs`);
    assert.match(html, /Authorized testing only/i);
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>|<style[^>]*>[\s\S]*?<\/style>/i, `${page} contains inline executable content`);
  }
});

test('all page CSS and JavaScript entry URLs share one cache version', () => {
  const versions = [];
  for (const page of ['index.html', 'app.html']) {
    for (const match of read(page).matchAll(/(?:href|src)="(?:css|js)\/[^"?]+\?v=([^"]+)"/g)) versions.push(match[1]);
  }
  assert.ok(versions.length >= 5);
  assert.deepEqual(new Set(versions), new Set(['1.0.0-r8']));
});

test('font assets are self-hosted WOFF2 files', () => {
  const css = read('css/styles.css');
  for (const font of ['sora-400.woff2', 'sora-600.woff2', 'ibm-plex-mono-400.woff2', 'ibm-plex-mono-500.woff2']) {
    assert.ok(css.includes(font));
    assert.ok(fs.statSync(path.join(ROOT, 'assets/fonts', font)).size > 1_000);
  }
  assert.doesNotMatch(css, /https?:\/\//);
});

test('manifest matches the architecture taxonomy and production files', () => {
  const manifest = JSON.parse(read('checklist/manifest.json'));
  assert.equal(manifest.categories.length, 25);
  assert.equal(manifest.sample_count, 20);
  assert.equal(manifest.categories.reduce((sum, category) => sum + category.floor, 0), 520);
  for (const category of manifest.categories) {
    const file = path.join(ROOT, 'checklist', category.file);
    if (!fs.existsSync(file)) {
      assert.equal(category.count, 0, `${category.slug} has a count but no production file`);
      continue;
    }
    const document = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(document.category, category.slug);
    assert.equal(document.items.length, category.count, `${category.slug} manifest count differs`);
  }
});

test('homepage stays light and shows only useful product and local-progress counts', () => {
  const html = read('index.html');
  const home = read('js/ui/home.js');
  assert.ok(html.includes('data-project-metric="production_items"'));
  assert.ok(html.includes('data-stat="tested"'));
  assert.ok(html.includes('data-stat="findings"'));
  assert.match(home, /fetch\('release\.json'/);
  assert.doesNotMatch(home, /checklist\/manifest\.json|evaluateApplicability/);
});

test('workspace shell exposes Phase 5 search, reporting, import, export, and notes surfaces', () => {
  const html = read('app.html');
  const workspace = read('js/ui/workspace.js');
  for (const attribute of ['data-search-filters', 'data-checklist-results', 'data-export-report', 'data-export-json', 'data-import-file', 'data-suggested-next', 'data-findings-table']) {
    assert.ok(html.includes(attribute), `missing ${attribute}`);
  }
  const card = read('js/ui/card.js');
  assert.match(card, /Tester notes \(stored locally\)/);
  assert.match(card, /Override context N\/A/);
  assert.doesNotMatch(html, /id="shell-search"[^>]*disabled/);
});

test('workspace shell exposes rendered Phase 7 chain and payload browsers', () => {
  const html = read('app.html');
  const workspace = read('js/ui/workspace.js');
  assert.ok(html.includes('data-chain-browser'));
  assert.ok(html.includes('data-payload-browser'));
  assert.doesNotMatch(html, /Attack chains <small>Soon|Payloads <small>Soon/);
  assert.match(workspace, /chainStore\.priorityEdges\(\)/);
  assert.match(workspace, /payloadStore\.render/);
});

test('wizard source defines all 18 question keys and the one localStorage key', () => {
  const wizard = read('js/ui/wizard.js');
  const app = read('js/ui/app.js');
  const engineState = read('js/engine/state.js');
  const theme = read('js/ui/theme.js');
  const themeBoot = read('js/ui/theme-boot.js');
  const questionKeys = [...wizard.matchAll(/\{ key: '([a-z_]+)'/g)].map((match) => match[1]);
  assert.deepEqual(questionKeys, ['mode', 'app_type', 'has_login', 'creds', 'registration', 'roles', 'auth_mechanism', 'identity_features', 'api_style', 'api_docs', 'source_access', 'backend', 'database', 'cloud', 'features', 'intermediary', 'outbound_fetch', 'async_jobs']);
  assert.match(engineState, /STATE_KEY = 'wapt\.state\.v1'/);
  assert.match(app, /localStorage\.setItem\(STATE_KEY/);
  assert.equal((app.match(/localStorage\.setItem/g) || []).length, 1);
  assert.match(theme, /STORAGE_KEY = 'wapt\.state\.v1'/);
  assert.match(themeBoot, /STORAGE_KEY = 'wapt\.state\.v1'/);
  assert.doesNotMatch(`${theme}\n${themeBoot}`, /sessionStorage/);
});

test('methodology cards surface reportability and retest boundaries', () => {
  const card = read('js/ui/card.js');
  assert.match(card, /section\('Reporting boundary', item\.do_not_report\)/);
  assert.match(card, /section\('Retest guidance', item\.retest_guidance\)/);
});

test('report generator includes evidence packs and retest verdicts with residual guidance', async () => {
  const { composeReportMarkdown } = await import('../js/ui/export.js');
  const items = [{ id: 'WAPT-AUTHZ-003', category: 'authorization', title: 'Enforce horizontal read authorization', severity: 'high' }];
  const state = {
    engagement: { name: 'Review <script>alert(1)</script>', targetUrl: 'https://app.example.com', started_at: '2026-08-18T00:00:00.000Z' },
    statuses: { 'WAPT-AUTHZ-003': 'confirmed_finding' },
    notes: { 'WAPT-AUTHZ-003': 'Account B object readable <b>as</b> account A.' },
    retests: { 'WAPT-AUTHZ-003': true },
    findings: [{
      id: 'find-0001', item_id: 'WAPT-AUTHZ-003', title: 'Cross-account read', severity: 'high',
      endpoint: 'GET /api/objects/1001', method: 'GET', parameter: 'id', auth_context: 'account A',
      precondition: 'Two accounts.', baseline_request: 'GET /api/objects/1000', test_request: 'GET /api/objects/1001',
      observed_behavior: 'Response contains account B object.', exploitability: 'proven', reportable: true,
      cleanup_performed: 'Synthetic data removed.', root_cause: 'No per-object check.',
      retest_verdict: 'partial', retest_note: 'Bulk endpoint still reproduces.', created_at: '2026-08-18T00:00:00.000Z', updated_at: '2026-08-18T00:00:00.000Z'
    }],
    updated_at: '2026-08-18T00:00:00.000Z'
  };
  const markdown = composeReportMarkdown(items, state, { authorization: 'Authorization' });
  assert.match(markdown, /## Evidence packs/);
  assert.match(markdown, /find-0001/);
  assert.match(markdown, /partial/);
  assert.match(markdown, /adjacent variant still reproduces/);
  assert.doesNotMatch(markdown, /<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(markdown, /<b>as<\/b>/);
  assert.match(markdown, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test('Phase 5 dashboard composition, retest queue, chain overview, and shortcuts', () => {
  const appHtml = read('app.html');
  const app = read('js/ui/app.js');
  const workspace = read('js/ui/workspace.js');
  const chains = read('js/ui/chains.js');
  for (const marker of ['data-dashboard-blocked', 'data-dashboard-na', 'data-retest-queue', 'data-chain-overview',
    'data-coverage-summary', 'id="shortcuts-dialog"', 'data-shortcuts-open', 'id="findings-panel"']) {
    assert.ok(appHtml.includes(marker), `app.html missing ${marker}`);
  }
  assert.match(app, /shortcutsDialog\.showModal\(\)/);
  assert.match(app, /pendingShortcut/);
  assert.match(app, /event\.key === '\?'/);
  assert.match(app, /if \(editable \|\| event\.altKey \|\| event\.ctrlKey \|\| event\.metaKey\)/);
  assert.match(workspace, /function renderRetestQueue\(/);
  assert.match(workspace, /function renderChainOverview\(/);
  const dom = read('js/ui/dom.js');
  assert.match(dom, /SEVERITY_GLYPHS = Object\.freeze/);
  assert.match(dom, /STATUS_GLYPHS = Object\.freeze/);
  assert.match(workspace, /SEVERITY_GLYPHS, STATUS_GLYPHS/);
  assert.match(workspace, /filter-chips/);
  assert.match(chains, /STATUS_GLYPHS\[status\]/);
});

test('checklist page renders family groups for authored categories', () => {
  const workspace = read('js/ui/workspace.js');
  assert.match(workspace, /groupByFamily/);
  assert.match(workspace, /familyIndex\.byItem\.get\(record\.item\.id\)/);
  assert.match(workspace, /familyGroupHeader\(family, members\)/);
});

test('test families are a first-class view with board, workspace, and resume', () => {
  const appHtml = read('app.html');
  const app = read('js/ui/app.js');
  const workspace = read('js/ui/workspace.js');
  const familyView = read('js/ui/family-view.js');
  for (const marker of ['data-view="families"', 'data-view="family"', 'data-family-board', 'data-family-root',
    'data-family-gaps', 'data-blocked-list', 'data-resume', 'data-view-link="families"']) {
    assert.ok(appHtml.includes(marker), `app.html missing ${marker}`);
  }
  assert.match(app, /VIEWS = new Set\(\['dashboard', 'playbooks', 'playbook', 'families', 'family'/);
  assert.match(app, /function initialHash/);
  assert.match(workspace, /rememberPosition\(\{ view: 'family'/);
  assert.match(familyView, /data-dont-miss|dontMiss/);
  assert.match(familyView, /setVariantCovered/);
  assert.match(familyView, /relatedFamilies\(/);
});

test('operator documentation is registered in every place docs are wired', () => {
  const docsPage = read('js/ui/docs-page.js');
  const markdown = read('js/ui/markdown.js');
  const docsHtml = read('docs.html');
  const appHtml = read('app.html');
  assert.match(docsPage, /operating: \{ title: 'How to run an engagement'/);
  assert.match(markdown, /'docs\/OPERATING\.md': 'operating'/);
  assert.match(docsHtml, /data-doc-link="operating"/);
  assert.match(appHtml, /docs\.html\?doc=operating/);
  const operating = read('docs/OPERATING.md');
  // The document must carry the coverage vocabulary and the honest limits, not marketing.
  for (const marker of ['Coverage vocabulary', 'Blocked', 'N/A', 'never contacts the target', 'Coverage is not a grade', 'family contract']) {
    assert.ok(operating.toLowerCase().includes(marker.toLowerCase()), `OPERATING.md missing ${marker}`);
  }
});

test('family contract, suites, and deliverable exports are wired into the UI', () => {
  const dom = read('js/ui/dom.js');
  const familyView = read('js/ui/family-view.js');
  const workspace = read('js/ui/workspace.js');
  const exportSource = read('js/ui/export.js');
  const appHtml = read('app.html');
  assert.match(dom, /export function contractRow/);
  assert.match(familyView, /familyContract\(family, itemList\)/);
  assert.match(familyView, /dataset\.familyBoundary/);
  assert.match(familyView, /dataset\.suiteContinue/);
  assert.match(familyView, /dataset\.toolBand/);
  assert.match(familyView, /workflow\.html\?tool=/);
  assert.match(workspace, /composeCoverageCsv/);
  assert.match(workspace, /composeFamilyCoverageBlock/);
  assert.match(appHtml, /data-export-csv/);
  // CSV formula injection is a documented weakness in this catalog; the exporter guards it.
  assert.match(exportSource, /\^\[=\+\\-@\\t\\r\]/);
});
