'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const CSP = "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'";

test('all user-facing pages share policy, branding, theme, and responsive viewport', () => {
  for (const page of ['index.html', 'app.html', 'methodology.html', 'docs.html', 'workflow.html']) {
    const html = read(page);
    assert.ok(html.includes(CSP), `${page} CSP`);
    assert.match(html, /Authorized testing only/i, `${page} authorization message`);
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
    assert.ok(html.includes('assets/logo.svg'));
    assert.ok(html.includes('css/styles.css?v=1.0.0'));
    assert.ok(html.includes('css/polish.css?v=1.0.0-r19'), `${page} shared product polish`);
    assert.match(html, /src="js\/ui\/[^"]+\.js\?v=1\.0\.0-r19"/);
    assert.ok(html.includes('js/ui/theme-boot.js?v=1.0.0-r19'), `${page} early theme boot`);
    assert.ok(html.indexOf('theme-boot.js') < html.indexOf('css/styles.css'), `${page} applies theme before CSS`);
  }
});

test('public navigation never sends users directly to raw Markdown or license text', () => {
  const html = ['index.html', 'app.html', 'methodology.html', 'docs.html', 'workflow.html'].map(read).join('\n');
  assert.doesNotMatch(html, /href="[^"]+\.md(?:[?#][^"]*)?"/);
  assert.doesNotMatch(html, /href="(?:SECURITY\.md|CONTRIBUTING\.md|LICENSE)"/);
  for (const link of ['methodology.html', 'docs.html?doc=operating', 'docs.html?doc=security', 'docs.html?doc=license']) assert.ok(html.includes(link), link);
});

test('documentation renderer uses a controlled document map and text-safe rendering', () => {
  const page = read('js/ui/docs-page.js');
  const markdown = read('js/ui/markdown.js');
  for (const key of ['operating', 'security', 'evidence-workflow', 'license']) assert.ok(page.includes(`${key}:`) || page.includes(`'${key}':`), key);
  assert.match(page, /Object\.hasOwn\(DOCUMENTS, requested\)/);
  for (const raw of ['SECURITY.md', 'docs/OPERATING.md', 'docs/EVIDENCE-WORKFLOW.md', 'LICENSE']) assert.ok(markdown.includes(`'${raw}'`) || markdown.includes(`${raw}:`), raw);
  assert.match(markdown, /docs\.html\?doc=\$\{key\}/);
  assert.doesNotMatch(markdown, /innerHTML|insertAdjacentHTML|document\.write/);
  assert.match(markdown, /textContent/);
});

test('maintainer-only material never resolves on the public documentation page', () => {
  const combined = `${read('js/ui/docs-page.js')}\n${read('js/ui/markdown.js')}`;
  for (const internal of ['QA.md', 'RESPONSIVE-QA.md', 'REFERENCE-QA.md', 'CONTENT-QA-REPORT.md', 'PHASE1', 'PHASE4', 'PHASE5', 'PHASE6', 'PHASE7', 'RELEASE.md', 'FEATURE-VERIFICATION.md', 'ARCHITECTURE.md', 'ENGINE.md', 'TAXONOMY.md', 'CONTENT-GUIDE.md', 'CONTRIBUTING.md', 'browser-qa', 'content-qa', 'feature-verification', 'content-guide']) {
    assert.ok(!combined.includes(internal), `${internal} must stay out of the public documentation map`);
  }
});

test('methodology page is manifest-driven and exposes real workflow content', () => {
  const html = read('methodology.html');
  const script = read('js/ui/methodology-page.js');
  assert.match(html, /A deliberate assessment sequence/);
  assert.match(html, /Decision-grade test design/);
  assert.match(html, /data-method-categories/);
  assert.match(script, /fetch\(asset\('checklist\/manifest\.json'\)/);
  assert.match(script, /app\.html#checklist\/\$\{category\.slug\}/);
});

test('sitemap includes designed methodology and documentation pages', () => {
  const sitemap = read('sitemap.xml');
  assert.ok(sitemap.includes('/methodology/'));
  assert.ok(sitemap.includes('/docs/'));
});

test('Burp workflow links route through the designed workflow page', () => {
  const payloads = read('js/ui/payloads.js');
  const workflow = read('js/ui/workflow-page.js');
  assert.match(payloads, /workflow\.html\?tool=\$\{slug\}/);
  assert.match(workflow, /Object\.hasOwn\(TOOLS, requested\)/);
  assert.match(workflow, /renderMarkdown/);
});

test('homepage presents the practical testing loop without loading the full catalog', () => {
  const html = read('index.html');
  const home = read('js/ui/home.js');
  assert.match(html, /Start testing/);
  assert.match(html, /See how it works/);
  assert.match(html, /CURRENT TESTING PLAN/);
  assert.match(html, /data-project-metric="production_items"/);
  assert.match(html, /data-project-metric="attack_chains"/);
  assert.match(html, /class="pipeline"/);
  assert.match(html, /data-chain-preview/);
  assert.match(home, /fetch\(asset\('release\.json'\)/);
  assert.match(home, /fetch\(asset\('attack-chains\/manifest\.json'\)/);
  assert.match(home, /IntersectionObserver/);
  assert.doesNotMatch(home, /checklist\/manifest\.json|evaluateApplicability/);
});
