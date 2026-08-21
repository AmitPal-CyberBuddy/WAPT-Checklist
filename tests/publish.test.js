'use strict';

// The publish tree is what the public actually hosts: an explicit allowlist
// (no maintainer material), clean directory URLs, and legacy redirect stubs.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'wapt-publish-'));

test('publish tree builds cleanly', () => {
  const result = spawnSync(process.execPath, [path.join(ROOT, 'tools/build-publish.mjs'), '--out', OUT], { encoding: 'utf8', cwd: ROOT });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Publish tree ready/);
});

test('only the public allowlist is hosted — maintainer material stays in the repository', () => {
  for (const absent of [
    'tests', 'tools', 'schema', '.github', 'node_modules',
    'README.md', 'CHANGELOG.md', 'CONTRIBUTING.md',
    'docs/RESPONSIVE-QA.md', 'docs/QA.md', 'docs/PHASE1-ASSESSMENT.md',
    'docs/RELEASE.md', 'docs/ARCHITECTURE.md', 'docs/TAXONOMY.md',
    'docs/CONTENT-GUIDE.md', 'docs/POST-PUBLISH-REVIEW.md',
    'js/ui/package.json', 'js/engine/package.json'
  ]) {
    assert.ok(!fs.existsSync(path.join(OUT, absent)), `${absent} must not be hosted`);
  }
  for (const present of [
    'index.html', '404.html', 'robots.txt', 'sitemap.xml', '.nojekyll',
    'release.json', 'SECURITY.md', 'LICENSE',
    'docs/OPERATING.md', 'docs/EVIDENCE-WORKFLOW.md',
    'js/ui/paths.js', 'js/ui/legacy-redirect.js',
    'burp-workflows/proxy.md', 'checklist/manifest.json', 'playbooks/manifest.json',
    'payloads/manifest.json', 'attack-chains/manifest.json'
  ]) {
    assert.ok(fs.existsSync(path.join(OUT, present)), `${present} must be hosted (runtime dependency)`);
  }
});

test('secondary pages are published at clean directory URLs with rebased assets', () => {
  for (const page of ['app', 'methodology', 'docs', 'workflow']) {
    const index = fs.readFileSync(path.join(OUT, page, 'index.html'), 'utf8');
    assert.match(index, new RegExp(`<html[^>]*data-asset-root="\\.\\./"`), `${page}/index.html must declare the asset root`);
    assert.match(index, /src="\.\.\/js\/ui\//, `${page}/index.html must load scripts from ../js/`);
    assert.match(index, new RegExp(`rel="canonical" href="[^"]*/${page}/"`), `${page}/index.html needs a canonical clean URL`);
    assert.doesNotMatch(index, /src="js\//, `${page}/index.html must not keep root-relative script paths`);
    assert.doesNotMatch(index, /href="(css|assets)\//, `${page}/index.html must not keep root-relative asset paths`);

    // The legacy .html address is a noindex redirect stub preserving query and hash.
    const stub = fs.readFileSync(path.join(OUT, `${page}.html`), 'utf8');
    assert.match(stub, new RegExp(`data-redirect="${page}"`));
    assert.match(stub, /noindex/);
    assert.match(stub, /legacy-redirect\.js/);
    assert.match(stub, new RegExp(`http-equiv="refresh" content="0; url=${page}/"`));
  }
});

test('cross-page links and the sitemap use clean URLs; the 404 recovers extensionless paths', () => {
  const home = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
  assert.match(home, /href="app\/#dashboard"/);
  assert.match(home, /href="docs\/\?doc=operating"/);
  assert.match(home, /href="methodology\/"/);
  assert.doesNotMatch(home, /href="(app|docs|methodology|workflow)\.html/);

  const appIndex = fs.readFileSync(path.join(OUT, 'app/index.html'), 'utf8');
  assert.match(appIndex, /href="\.\.\/docs\/\?doc=operating"/);
  assert.match(appIndex, /href="\.\.\/methodology\/"/);

  const sitemap = fs.readFileSync(path.join(OUT, 'sitemap.xml'), 'utf8');
  for (const page of ['app/', 'methodology/', 'docs/', 'workflow/']) assert.ok(sitemap.includes(`/${page}<`), `sitemap must list /${page}`);
  assert.doesNotMatch(sitemap, /\.(app|docs|methodology|workflow)\.html</);

  const notFound = fs.readFileSync(path.join(OUT, '404.html'), 'utf8');
  assert.match(notFound, /data-redirect="auto"/);
  assert.match(notFound, /legacy-redirect\.js/);
  assert.match(notFound, /Page not found/);

  const redirect = fs.readFileSync(path.join(OUT, 'js/ui/legacy-redirect.js'), 'utf8');
  assert.match(redirect, /\$\{location\.search\}\$\{location\.hash\}/);
});

test('the running app from /app/ references only rebased runtime paths', () => {
  const appIndex = fs.readFileSync(path.join(OUT, 'app/index.html'), 'utf8');
  // Every runtime fetch in the UI goes through asset(); the published page sets the root.
  const sources = ['app.js', 'catalog.js', 'workspace.js', 'chains.js', 'payloads.js', 'workflow-page.js', 'docs-page.js', 'home.js', 'methodology-page.js'];
  for (const file of sources) {
    const source = fs.readFileSync(path.join(OUT, 'js/ui', file), 'utf8');
    const literals = [...source.matchAll(/fetch\(\s*['"]([^'"]+)['"]/g)].map((match) => match[1]);
    for (const literal of literals) assert.doesNotMatch(literal, /^(checklist|playbooks|payloads|attack-chains|burp-workflows|release\.json|docs\/)/, `${file} must fetch via asset(): ${literal}`);
  }
  void appIndex;
});
