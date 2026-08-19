'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const { validatePhase7, validatePlaybooks } = require('../tools/validate.js');

const EXPECTED_PLAYBOOKS = [
  'static-page', 'login-page', 'registration', 'password-reset', 'account-profile',
  'session', 'file-upload', 'search-page', 'checkout', 'admin-panel',
  'api-endpoint', 'graphql', 'websocket', 'oauth-sso', 'jwt-token', 'spa-client'
];

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
  assert.equal(result.playbookCount, EXPECTED_PLAYBOOKS.length);
  const phase7 = validatePhase7(ids);
  assert.deepEqual(phase7.errors, []);
  assert.equal(phase7.playbookCount, EXPECTED_PLAYBOOKS.length);
});

test('catalog covers every tester surface with named variants and real payloads', () => {
  const { manifest, documents } = loadPlaybooks();
  assert.deepEqual(manifest.playbooks.map(({ id }) => id), EXPECTED_PLAYBOOKS);
  for (const playbook of documents) {
    const checks = playbook.groups.flatMap((group) => group.checks);
    assert.ok(checks.length >= 5, `${playbook.id} is too thin`);
    for (const check of checks) {
      assert.ok(check.variants.length >= 2, `${playbook.id}/${check.id} needs variants`);
      assert.ok(check.variants.every(({ name, payload, expect }) => name && payload && expect));
      assert.ok(check.variants.some(({ kind }) => ['request', 'command', 'html', 'note'].includes(kind)));
    }
  }
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

test('login, upload, jwt, and graphql packs carry concrete request variants', () => {
  const { documents } = loadPlaybooks();
  const byId = Object.fromEntries(documents.map((doc) => [doc.id, doc]));
  const loginTitles = byId['login-page'].groups.flatMap((group) => group.checks.map(({ title }) => title.toLowerCase()));
  for (const needle of ['sql injection', 'nosql', 'host-poisoned', 'account enumeration']) {
    assert.ok(loginTitles.some((title) => title.includes(needle)), `login missing ${needle}`);
  }
  const upload = byId['file-upload'].groups.flatMap((group) => group.checks);
  assert.ok(upload.some((check) => check.variants.some(({ payload }) => /svg|onerror|GIF89a|\.\.\//i.test(payload))));
  const jwt = byId['jwt-token'].groups.flatMap((group) => group.checks);
  assert.ok(jwt.some((check) => /alg=none|none/.test(check.title) || check.variants.some(({ payload }) => /none/i.test(payload))));
  const gql = byId.graphql.groups.flatMap((group) => group.checks);
  assert.ok(gql.some((check) => check.variants.some(({ payload }) => payload.includes('__schema') || payload.includes('node(id'))));
});

test('playbook engine matches each preset to the surfaces a tester would open', async () => {
  const [{ deriveContext }, engine] = await Promise.all([
    import('../js/engine/context.js'),
    import('../js/engine/playbooks.js')
  ]);
  const { indexPlaybooks, suggestedPlaybook, matchPlaybooks, classifyPlaybook, probesForItem } = engine;
  const { PRESETS } = await import('../js/data/presets.mjs');
  const { manifest, documents } = loadPlaybooks();
  const index = indexPlaybooks(manifest, documents);

  const staticContext = deriveContext(PRESETS.static_marketing.answers);
  assert.equal(suggestedPlaybook(index, staticContext).id, 'static-page');
  assert.equal(classifyPlaybook(index.byId.get('static-page'), staticContext), 'match');
  assert.ok(!matchPlaybooks(index, staticContext).some(({ id }) => id === 'login-page'));

  const apiContext = deriveContext(PRESETS.rest_api.answers);
  assert.equal(suggestedPlaybook(index, apiContext).id, 'api-endpoint');
  assert.equal(classifyPlaybook(index.byId.get('api-endpoint'), apiContext), 'match');

  const gqlContext = deriveContext(PRESETS.graphql_api.answers);
  assert.equal(classifyPlaybook(index.byId.get('graphql'), gqlContext), 'match');
  assert.notEqual(classifyPlaybook(index.byId.get('api-endpoint'), gqlContext), 'match');

  const saasContext = deriveContext(PRESETS.saas_jwt_api.answers);
  const saasIds = matchPlaybooks(index, saasContext).map(({ id }) => id);
  for (const id of ['login-page', 'spa-client', 'api-endpoint', 'jwt-token', 'account-profile']) {
    assert.ok(saasIds.includes(id), `SaaS should match ${id}, got ${saasIds.join(',')}`);
  }

  const shopContext = deriveContext(PRESETS.ecommerce.answers);
  const shopIds = matchPlaybooks(index, shopContext).map(({ id }) => id);
  for (const id of ['checkout', 'file-upload', 'search-page', 'login-page']) {
    assert.ok(shopIds.includes(id), `e-commerce should match ${id}`);
  }

  const probes = probesForItem(index, 'WAPT-HDR-006');
  assert.ok(probes.some(({ check }) => check.id === 'clickjacking'));
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
  assert.match(app, /: 'playbooks'/);
  assert.match(app, /event\.key === 'p'\) location\.hash = 'playbooks'/);
  assert.match(workspace, /loadPlaybooks/);
  assert.match(workspace, /view === 'playbooks'/);
  assert.match(workspace, /view === 'playbook'/);
  assert.match(playbookUi, /LOOK FOR/);
  assert.match(playbookUi, /probe-payload/);
  assert.match(playbookUi, /Matches this scope/);
});
