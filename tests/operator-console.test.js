'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function loadCatalog() {
  const skip = new Set(['manifest.json', 'sample.json', 'families.json']);
  return fs.readdirSync(path.join(ROOT, 'checklist'))
    .filter((name) => name.endsWith('.json') && !skip.has(name))
    .flatMap((name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'checklist', name), 'utf8')).items);
}

function loadPlaybooks() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'playbooks/manifest.json'), 'utf8'));
  return {
    manifest,
    documents: manifest.playbooks.map(({ file }) => JSON.parse(fs.readFileSync(path.join(ROOT, 'playbooks', file), 'utf8')))
  };
}

test('static operator plan is exhaustive underneath a usable 30-test core pass', async () => {
  const [{ deriveContext }, { indexPlaybooks }, { buildAssessmentPlan }, { PRESETS }] = await Promise.all([
    import('../js/engine/context.js'),
    import('../js/engine/playbooks.js'),
    import('../js/engine/assessment.js'),
    import('../js/data/presets.mjs')
  ]);
  const { manifest, documents } = loadPlaybooks();
  const index = indexPlaybooks(manifest, documents);
  const answers = PRESETS.static_marketing.answers;
  const plan = buildAssessmentPlan(index, deriveContext(answers), answers, loadCatalog(), { surfaceId: 'static-page' });
  const byTier = Object.fromEntries(plan.tiers.map((tier) => [tier.id, tier]));
  const total = plan.tiers.reduce((sum, tier) => sum + tier.checks.length, 0);
  const core = byTier['dont-miss'].checks.length + byTier['high-value'].checks.length;

  assert.equal(total, plan.applicableCount, 'progressive tiers must neither duplicate nor drop catalog items');
  assert.equal(byTier['dont-miss'].checks.length, 12);
  assert.ok(core >= 25 && core <= 40, `core should be usable in a real test session, got ${core}`);
  assert.ok(byTier.standard.checks.length > core, 'full breadth remains behind Extended');
  assert.ok(byTier.advanced.checks.length > 0, 'specialist work remains available');
  assert.equal(plan.currentSurface.id, 'static-page');

  const titles = byTier['dont-miss'].checks.map(({ title }) => title.toLowerCase());
  for (const needle of ['host header', 'directory enumeration', 'directory listing', '.git', 'source map', 'csp', 'hsts', 'clickjacking', 'ssl', 'https redirect', 'secret']) {
    assert.ok(titles.some((title) => title.includes(needle)), `Don't Miss missing ${needle}`);
  }
});

test('operator UI is assessment-first and keeps architecture behind disclosures', () => {
  const html = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
  const plan = fs.readFileSync(path.join(ROOT, 'js/ui/plan.js'), 'utf8');
  const profile = fs.readFileSync(path.join(ROOT, 'js/ui/profile.js'), 'utf8');
  const playbook = fs.readFileSync(path.join(ROOT, 'js/ui/playbook.js'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'css/operator-console.css'), 'utf8');

  assert.match(html, /> Testing plan</);
  assert.match(html, /> Search tests</);
  assert.match(html, /Reference &amp; coverage/);
  assert.match(html, /What are you assessing\?/);
  assert.match(profile, /EDIT ASSESSMENT CONTEXT/);
  assert.match(profile, /dataset\.contextEditor/);
  assert.match(plan, /COVERAGE DEPTH/);
  assert.match(plan, /FILTER THIS PLAN/);
  assert.match(plan, /Find a test, tool, variant, or ID/);
  assert.match(plan, /Any progress/);
  assert.match(plan, /Any severity/);
  assert.match(plan, /Step-by-step/);
  assert.match(plan, /Start core tests/);
  assert.match(plan, /Included because/);
  assert.match(playbook, /BECAUSE OF THIS TEST, ALSO CHECK/);
  assert.match(playbook, /TOOLS & WORKFLOWS/);
  assert.match(playbook, /renderOperatorCheck/);
  assert.match(css, /\.probe-check-summary/);
  assert.match(css, /\.plan-controls\{position:sticky/);
});

test('navigation and heavy test details are progressive rather than abrupt or eager', () => {
  const html = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
  const app = fs.readFileSync(path.join(ROOT, 'js/ui/app.js'), 'utf8');
  const plan = fs.readFileSync(path.join(ROOT, 'js/ui/plan.js'), 'utf8');
  const playbook = fs.readFileSync(path.join(ROOT, 'js/ui/playbook.js'), 'utf8');
  const polish = fs.readFileSync(path.join(ROOT, 'css/polish.css'), 'utf8');
  const docs = fs.readFileSync(path.join(ROOT, 'docs.html'), 'utf8');

  assert.match(html, /data-route-progress/);
  assert.match(app, /document\.startViewTransition/);
  assert.match(app, /beginNavigation/);
  assert.match(app, /finishNavigation/);
  assert.match(playbook, /const buildBody = \(\) =>/);
  assert.match(playbook, /article\.append\(buildBody\(\)\)/);
  assert.match(plan, /window\.requestAnimationFrame\(applyFilters\)/);
  assert.match(polish, /content-visibility:auto/);
  assert.match(polish, /@keyframes route-scan/);
  assert.doesNotMatch(docs, /Browser QA|Responsive QA|Reference QA|Content QA|Release &amp; deploy|Project docs|Content standard|Architecture|Adaptive engine|Contribute/);
});

test('variant taxonomy is translated into operator language and directory discovery is actionable', () => {
  const ui = fs.readFileSync(path.join(ROOT, 'js/ui/playbook.js'), 'utf8');
  assert.match(ui, /'parser-differential': 'Parser \/ routing'/);
  assert.match(ui, /'header-variant': 'Proxy trust'/);
  assert.match(ui, /request: 'Repeater request'/);

  const { documents } = loadPlaybooks();
  const staticPage = documents.find(({ id }) => id === 'static-page');
  const dir = staticPage.groups.flatMap(({ checks }) => checks).find(({ id }) => id === 'dir-enum');
  const text = dir.variants.map(({ name, payload, expect }) => `${name} ${payload} ${expect}`).join('\n').toLowerCase();
  for (const needle of ['burp content discovery', 'ffuf', 'gobuster', 'soft 404', 'response size', 'recursive']) {
    assert.ok(text.includes(needle), `directory enumeration missing ${needle}`);
  }
});
