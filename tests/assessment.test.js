'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function loadPlaybooks() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'playbooks/manifest.json'), 'utf8'));
  const documents = manifest.playbooks.map((entry) => JSON.parse(fs.readFileSync(path.join(ROOT, 'playbooks', entry.file), 'utf8')));
  return { manifest, documents };
}

test('assessment plan lists every matching surface, not one playbook', async () => {
  const [{ deriveContext }, { indexPlaybooks }, { assessmentSurfaces, assessmentChecks, composeAssessmentMarkdown }, { PRESETS }] = await Promise.all([
    import('../js/engine/context.js'),
    import('../js/engine/playbooks.js'),
    import('../js/engine/assessment.js'),
    import('../js/data/presets.mjs')
  ]);
  const { manifest, documents } = loadPlaybooks();
  const index = indexPlaybooks(manifest, documents);

  const staticPlan = assessmentSurfaces(index, deriveContext(PRESETS.static_marketing.answers));
  assert.deepEqual(staticPlan.matches.map(({ playbook }) => playbook.id), ['static-page']);
  assert.ok(!staticPlan.surfaces.some(({ playbook }) => playbook.id === 'login-page'));
  assert.ok(staticPlan.hidden.some(({ id }) => id === 'login-page'));
  assert.ok(staticPlan.hidden.some(({ id }) => id === 'jwt-token'));
  const staticMarkdown = composeAssessmentMarkdown({
    name: 'Marketing',
    targetUrl: 'https://www.example.com',
    chips: ['Static website', 'No authentication'],
    surfaces: staticPlan.surfaces,
    hidden: staticPlan.hidden
  });
  assert.match(staticMarkdown, /Static \/ published page/);
  assert.match(staticMarkdown, /Host Header/i);
  assert.doesNotMatch(staticMarkdown, /## Login/);
  assert.match(staticMarkdown, /Hidden until the profile includes them/);
  assert.match(staticMarkdown, /Login \/ identity page/);

  const saasPlan = assessmentSurfaces(index, deriveContext(PRESETS.saas_jwt_api.answers));
  const saasIds = saasPlan.surfaces.map(({ playbook }) => playbook.id);
  for (const id of ['login-page', 'spa-client', 'api-endpoint', 'jwt-token', 'account-profile']) {
    assert.ok(saasIds.includes(id), `SaaS assessment missing ${id}, got ${saasIds.join(',')}`);
  }
  assert.ok(assessmentChecks(saasPlan.surfaces).length > assessmentChecks(staticPlan.surfaces).length);

  const shopPlan = assessmentSurfaces(index, deriveContext(PRESETS.ecommerce.answers));
  const shopIds = shopPlan.surfaces.map(({ playbook }) => playbook.id);
  for (const id of ['checkout', 'file-upload', 'search-page', 'login-page']) {
    assert.ok(shopIds.includes(id), `e-commerce assessment missing ${id}`);
  }
});

test('share payload round-trips answers and never carries findings', async () => {
  const { encodeShare, decodeShare, parseShareHash, shareHref, engagementIsBlank } = await import('../js/engine/share.js');
  const { PRESETS } = await import('../js/data/presets.mjs');
  const { createState } = await import('../js/engine/state.js');

  const encoded = encodeShare({
    name: 'Acme portal',
    targetUrl: 'https://app.example.com',
    answers: PRESETS.saas_jwt_api.answers
  });
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
  const decoded = decodeShare(encoded);
  assert.equal(decoded.name, 'Acme portal');
  assert.equal(decoded.targetUrl, 'https://app.example.com');
  assert.equal(decoded.answers.app_type, 'spa');
  assert.equal(decoded.answers.has_login, 'yes');
  assert.deepEqual(decoded.answers.auth_mechanism, ['jwt']);
  assert.equal(decoded.statuses, undefined);
  assert.equal(decoded.findings, undefined);
  assert.doesNotMatch(JSON.stringify(decoded), /confirmed_finding|find-/);

  const href = shareHref({ name: 'Acme portal', targetUrl: 'https://app.example.com', answers: PRESETS.saas_jwt_api.answers }, 'https://example.test/app.html#dashboard');
  assert.match(href, /^https:\/\/example\.test\/app\.html#share\//);
  assert.deepEqual(parseShareHash(href.slice(href.indexOf('#'))), decoded);
  assert.equal(decodeShare('!!!'), null);
  assert.equal(parseShareHash('#dashboard'), null);
  assert.equal(engagementIsBlank(createState()), true);
  assert.equal(engagementIsBlank({ engagement: { name: 'Kept' }, answers: {}, statuses: {} }), false);
});

test('wizard finish starts testing and the assessment can be shared', () => {
  const wizard = fs.readFileSync(path.join(ROOT, 'js/ui/wizard.js'), 'utf8');
  const plan = fs.readFileSync(path.join(ROOT, 'js/ui/plan.js'), 'utf8');
  const app = fs.readFileSync(path.join(ROOT, 'js/ui/app.js'), 'utf8');
  const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.match(wizard, /Start testing →/);
  assert.match(wizard, /every matching surface/);
  assert.match(plan, /Copy share link/);
  assert.match(plan, /dataset\.shareLink/);
  assert.match(plan, /dataset\.shareMarkdown/);
  assert.match(plan, /assessmentSurfaces/);
  assert.match(app, /parseShareHash/);
  assert.match(app, /function applyShare/);
  assert.match(app, /location.hash = 'dashboard'/);
  assert.match(home, /app\.html#wizard/);
  assert.match(home, /Start testing/);
});
