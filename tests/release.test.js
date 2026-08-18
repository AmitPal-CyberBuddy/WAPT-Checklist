'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('release manifest matches catalog and connected-library counts', () => {
  const release = JSON.parse(read('release.json'));
  const manifest = JSON.parse(read('checklist/manifest.json'));
  const chains = JSON.parse(read('attack-chains/manifest.json'));
  const payloads = JSON.parse(read('payloads/manifest.json'));
  assert.equal(release.version, '1.0.0');
  assert.equal(release.cache_version, '1.0.0-r3');
  assert.equal(release.status, 'release-candidate');
  assert.equal(release.production_items, manifest.categories.reduce((sum, category) => sum + category.count, 0));
  assert.equal(release.categories, manifest.categories.length);
  assert.equal(release.attack_chains, chains.chains.length);
  assert.equal(release.payload_references, payloads.categories.reduce((sum, category) => sum + category.count, 0));
  assert.equal(release.burp_workflows, fs.readdirSync(path.join(ROOT, 'burp-workflows')).filter((file) => file.endsWith('.md')).length);
});

test('release cache version is consistent across pages and browser modules', () => {
  const files = ['index.html', 'app.html', ...fs.readdirSync(path.join(ROOT, 'js/ui')).filter((file) => file.endsWith('.js')).map((file) => `js/ui/${file}`)];
  const versions = files.flatMap((file) => [...read(file).matchAll(/\?v=([0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9.]+)?)/g)].map((match) => match[1]));
  assert.ok(versions.length >= 20);
  assert.deepEqual(new Set(versions), new Set(['1.0.0-r3']));
  assert.match(read('app.html'), /WAPT Checklist v1\.0\.0/);
});

test('deployment templates run every release quality gate', () => {
  for (const file of ['docs/workflows/ci.yml', 'docs/workflows/deploy.yml']) {
    const workflow = read(file);
    for (const command of ['node --test', 'node tools/validate.js --floors', 'node tools/check-references.js', 'node tools/audit-content.js']) {
      assert.ok(workflow.includes(command), `${file} missing ${command}`);
    }
  }
});

test('release-critical public files are present', () => {
  for (const file of ['LICENSE', 'README.md', 'CONTRIBUTING.md', 'SECURITY.md', 'CHANGELOG.md', 'index.html', 'app.html', 'methodology.html', 'docs.html', 'workflow.html', 'robots.txt', 'sitemap.xml', '.nojekyll']) {
    assert.ok(fs.existsSync(path.join(ROOT, file)), file);
  }
});
