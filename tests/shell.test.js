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
  assert.deepEqual(new Set(versions), new Set(['1.0.0-r5']));
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

test('homepage computes context-active statistics from production category content', () => {
  const html = read('index.html');
  const home = read('js/ui/home.js');
  assert.ok(html.includes('data-stat="active"'));
  assert.match(home, /evaluateApplicability\(item, context\)/);
  assert.match(home, /manifest\.categories\.filter\(\(\{ count \}\) => count > 0\)/);
});

test('workspace shell exposes Phase 5 search, reporting, import, export, and notes surfaces', () => {
  const html = read('app.html');
  const workspace = read('js/ui/workspace.js');
  for (const attribute of ['data-search-filters', 'data-checklist-results', 'data-export-report', 'data-export-json', 'data-import-file', 'data-suggested-next', 'data-findings-table']) {
    assert.ok(html.includes(attribute), `missing ${attribute}`);
  }
  assert.match(workspace, /Tester notes \(stored locally\)/);
  assert.match(workspace, /Override context N\/A/);
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
  const workspace = read('js/ui/workspace.js');
  assert.match(workspace, /section\('Reporting boundary', item\.do_not_report\)/);
  assert.match(workspace, /section\('Retest guidance', item\.retest_guidance\)/);
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
