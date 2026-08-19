'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const { validatePhase7, validatePlaybooks } = require('../tools/validate.js');

function productionIds() {
  const checklist = path.join(ROOT, 'checklist');
  return new Set(fs.readdirSync(checklist)
    .filter((name) => name.endsWith('.json') && !['manifest.json', 'sample.json', 'families.json'].includes(name))
    .flatMap((name) => JSON.parse(fs.readFileSync(path.join(checklist, name), 'utf8')).items.map(({ id }) => id)));
}

function loadPlaybooks() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'playbooks/manifest.json'), 'utf8'));
  const documents = manifest.playbooks.map((entry) => JSON.parse(fs.readFileSync(path.join(ROOT, 'playbooks', entry.file), 'utf8')));
  return { manifest, documents };
}

test('playbooks validate and resolve every referenced checklist item', () => {
  const ids = productionIds();
  const result = validatePlaybooks(ids);
  assert.deepEqual(result.errors, []);
  assert.equal(result.playbookCount, 3);
  const phase7 = validatePhase7(ids);
  assert.deepEqual(phase7.errors, []);
  assert.equal(phase7.playbookCount, 3);
});

test('static-page playbook lists the tester-named checks with real payloads', () => {
  const { documents } = loadPlaybooks();
  const playbook = documents.find(({ id }) => id === 'static-page');
  assert.ok(playbook);
  const titles = playbook.groups.flatMap((group) => group.checks.map(({ title }) => title.toLowerCase()));
  for (const needle of [
    'clickjacking', 'missing security header', 'ssl config', 'hsts', 'csp',
    'directory enumeration', 'directory listing', 'path traversal',
    'absolute url', 'host header'
  ]) {
    assert.ok(titles.some((title) => title.includes(needle)), `static playbook missing ${needle}`);
  }
  const host = playbook.groups.flatMap((group) => group.checks).find(({ id }) => id === 'host-header');
  const names = host.variants.map(({ name }) => name.toLowerCase());
  for (const needle of ['arbitrary host', 'duplicate host', 'x-forwarded-host', 'forwarded', 'absolute-form']) {
    assert.ok(names.some((name) => name.includes(needle)), `host header missing ${needle}`);
  }
  assert.ok(host.variants.some(({ payload }) => payload.includes('Host: evil.example')));
  assert.ok(host.variants.some(({ payload }) => payload.includes('X-Forwarded-Host')));
  const traversal = playbook.groups.flatMap((group) => group.checks).find(({ id }) => id === 'path-traversal');
  assert.ok(traversal.variants.some(({ payload }) => payload.includes('..%2f') || payload.includes('../')));
});

test('playbook engine matches static scope to the static-page pack', async () => {
  const [{ deriveContext }, { indexPlaybooks, suggestedPlaybook, matchPlaybooks, probesForItem }] = await Promise.all([
    import('../js/engine/context.js'),
    import('../js/engine/playbooks.js')
  ]);
  const { PRESETS } = await import('../js/data/presets.mjs');
  const { manifest, documents } = loadPlaybooks();
  const index = indexPlaybooks(manifest, documents);
  const staticContext = deriveContext(PRESETS.static_marketing.answers);
  const suggested = suggestedPlaybook(index, staticContext);
  assert.equal(suggested.id, 'static-page');
  assert.ok(matchPlaybooks(index, staticContext).some(({ id }) => id === 'static-page'));
  const probes = probesForItem(index, 'WAPT-HDR-006');
  assert.ok(probes.some(({ check }) => check.id === 'clickjacking'));
  const apiContext = deriveContext(PRESETS.rest_api.answers);
  assert.equal(suggestedPlaybook(index, apiContext).id, 'api-endpoint');
});

test('workspace and app shell expose playbooks as a first-class view', () => {
  const appHtml = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
  const app = fs.readFileSync(path.join(ROOT, 'js/ui/app.js'), 'utf8');
  const workspace = fs.readFileSync(path.join(ROOT, 'js/ui/workspace.js'), 'utf8');
  const playbookUi = fs.readFileSync(path.join(ROOT, 'js/ui/playbook.js'), 'utf8');
  for (const marker of ['data-view="playbooks"', 'data-view="playbook"', 'data-playbook-board', 'data-playbook-root', 'data-view-link="playbooks"', 'data-playbook-banner']) {
    assert.ok(appHtml.includes(marker), `app.html missing ${marker}`);
  }
  assert.match(app, /playbooks', 'playbook'/);
  assert.match(app, /app_type === 'static' \? 'playbook\/static-page'/);
  assert.match(app, /event\.key === 'p'\) location\.hash = 'playbooks'/);
  assert.match(workspace, /loadPlaybooks/);
  assert.match(playbookUi, /LOOK FOR/);
  assert.match(playbookUi, /probe-payload/);
});
