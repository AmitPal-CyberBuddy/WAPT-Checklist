'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function loadPlaybooks() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'playbooks/manifest.json'), 'utf8'));
  const documents = manifest.playbooks.map((entry) => JSON.parse(fs.readFileSync(path.join(ROOT, 'playbooks', entry.file), 'utf8')));
  return { manifest, documents };
}

function loadCatalog() {
  const skip = new Set(['manifest.json', 'sample.json', 'families.json']);
  return fs.readdirSync(path.join(ROOT, 'checklist'))
    .filter((name) => name.endsWith('.json') && !skip.has(name))
    .flatMap((name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'checklist', name), 'utf8')).items);
}

test('static assessment is attack-surface families, not one page pack', async () => {
  const [{ deriveContext }, { indexPlaybooks }, { buildAssessmentPlan, composeAssessmentMarkdown }, { evaluateApplicability, APPLICABILITY }, { PRESETS }] = await Promise.all([
    import('../js/engine/context.js'),
    import('../js/engine/playbooks.js'),
    import('../js/engine/assessment.js'),
    import('../js/engine/applicability.js'),
    import('../js/data/presets.mjs')
  ]);
  const { manifest, documents } = loadPlaybooks();
  const index = indexPlaybooks(manifest, documents);
  const items = loadCatalog();
  const answers = PRESETS.static_marketing.answers;
  const context = deriveContext(answers);
  const catalogApplicable = items.filter((item) => {
    const r = evaluateApplicability(item, context);
    return r.state === APPLICABILITY.ACTIVE || r.state === APPLICABILITY.CONFIRM;
  }).length;
  const plan = buildAssessmentPlan(index, context, answers, items);
  const familyIds = plan.families.map(({ id }) => id);
  for (const id of ['http', 'headers', 'tls', 'client']) {
    assert.ok(familyIds.includes(id), `static missing family ${id}`);
  }
  assert.ok(!familyIds.includes('auth'));
  assert.ok(!familyIds.includes('authz'));
  // The dashboard number is the catalog Active+Confirm count, never the manifest overlay count.
  assert.equal(plan.applicableCount, catalogApplicable);
  assert.ok(plan.applicableCount >= 150, `static applicable count should be the catalog count, got ${plan.applicableCount}`);
  assert.ok(plan.applicableCount !== 49, 'applicable count must not be the authored overlay count');
  assert.ok(plan.methodologyCount > 0, 'static plan must include methodology-only catalog rows');
  assert.ok(plan.authoredCount > 0, 'static plan must include full-playbook authored rows');
  const titles = plan.checks.map(({ title }) => title.toLowerCase());
  for (const needle of [
    'host header', 'http method', 'absolute url', 'directory enumeration', 'directory listing',
    'path traversal', 'clickjacking', 'csp', 'hsts', 'permissions policy',
    'https redirect', 'dom xss', 'prototype pollution', 'postmessage', '.git',
    'robots.txt', 'sitemap', 'well-known', 'dns records', 'certificate transparency',
    'service worker', 'web storage', 'method override', 'normalization'
  ]) {
    assert.ok(titles.some((title) => title.includes(needle)), `static plan missing ${needle}`);
  }
  const markdown = composeAssessmentMarkdown({
    name: 'Marketing',
    targetUrl: 'https://www.example.com',
    chips: ['Static website', 'No authentication'],
    families: plan.families,
    hiddenFamilies: plan.hiddenFamilies,
    applicableCount: plan.applicableCount,
    authoredCount: plan.authoredCount,
    methodologyCount: plan.methodologyCount
  });
  assert.match(markdown, /HTTP \/ Server Configuration/);
  assert.match(markdown, /Security Headers/);
  assert.match(markdown, /TLS \/ Transport Security/);
  assert.match(markdown, /Client-Side Security/);
  assert.match(markdown, /Host Header/i);
  assert.match(markdown, /Applicable tests: \d+ \(\d+ with playbooks · \d+ methodology-only\)/);
  assert.equal(plan.applicableCount, plan.authoredCount + plan.methodologyCount);
  assert.doesNotMatch(markdown, /## Authentication/);
  assert.match(markdown, /Hidden until the profile includes them/);
});

test('SaaS and e-commerce profiles add auth, API, and feature families', async () => {
  const [{ deriveContext }, { indexPlaybooks }, { buildAssessmentPlan }, { PRESETS }] = await Promise.all([
    import('../js/engine/context.js'),
    import('../js/engine/playbooks.js'),
    import('../js/engine/assessment.js'),
    import('../js/data/presets.mjs')
  ]);
  const { manifest, documents } = loadPlaybooks();
  const index = indexPlaybooks(manifest, documents);
  const items = loadCatalog();
  const saas = buildAssessmentPlan(index, deriveContext(PRESETS.saas_jwt_api.answers), PRESETS.saas_jwt_api.answers, items);
  const saasIds = saas.families.map(({ id }) => id);
  for (const id of ['auth', 'jwt', 'api', 'client', 'authz']) {
    assert.ok(saasIds.includes(id), `SaaS missing ${id}, got ${saasIds.join(',')}`);
  }
  const shop = buildAssessmentPlan(index, deriveContext(PRESETS.ecommerce.answers), PRESETS.ecommerce.answers, items);
  const shopIds = shop.families.map(({ id }) => id);
  for (const id of ['business', 'upload', 'auth']) {
    assert.ok(shopIds.includes(id), `e-commerce missing ${id}`);
  }
  assert.ok(saas.applicableCount > 40);
  assert.ok(saas.applicableCount > 200, 'SaaS applicable count should be catalog-scale');
});

test('catalog-only checks carry no synthesized variants; authored checks keep real ones', async () => {
  const [{ deriveContext }, { indexPlaybooks }, { buildAssessmentPlan }, { PRESETS }] = await Promise.all([
    import('../js/engine/context.js'),
    import('../js/engine/playbooks.js'),
    import('../js/engine/assessment.js'),
    import('../js/data/presets.mjs')
  ]);
  const { manifest, documents } = loadPlaybooks();
  const index = indexPlaybooks(manifest, documents);
  const items = loadCatalog();
  const plan = buildAssessmentPlan(index, deriveContext(PRESETS.static_marketing.answers), PRESETS.static_marketing.answers, items);
  const catalogOnly = plan.checks.filter((check) => check.maturity === 'catalog-only');
  const authored = plan.checks.filter((check) => check.maturity !== 'catalog-only');
  assert.ok(catalogOnly.length > 0, 'catalog-only rows must exist');
  assert.ok(catalogOnly.every((check) => (check.variants || []).length === 0), 'catalog-only checks must have ZERO synthesized variants');
  assert.ok(authored.length > 0, 'authored rows must exist');
  assert.ok(authored.every((check) => (check.variants || []).length >= 2), 'authored checks need real variants');
  // Host header, path traversal, and CSP must be fully authored with why lines.
  for (const id of ['host-header', 'path-traversal', 'csp']) {
    const check = plan.checks.find((c) => c.id === id);
    assert.ok(check, `missing ${id}`);
    assert.equal(check.maturity, 'authored', `${id} should be AUTHORED`);
    assert.ok(check.variants.length >= 2);
    assert.ok(check.variants.every((v) => v.why && v.category), `${id} variants need why + category`);
  }
});

test('compact profile maps onto engine answers', async () => {
  const { profileToAnswers, answersToProfile, profileIsScoped } = await import('../js/engine/profile.js');
  const staticAnswers = profileToAnswers({ app_type: 'static', auth: ['none'], features: ['none'] });
  assert.equal(staticAnswers.app_type, 'static');
  assert.equal(staticAnswers.has_login, 'no');
  assert.deepEqual(staticAnswers.api_style, ['none']);
  assert.ok(profileIsScoped(answersToProfile(staticAnswers)));

  const saas = profileToAnswers({ app_type: 'spa', auth: ['jwt', 'password'], features: ['api', 'registration'] });
  assert.equal(saas.app_type, 'spa');
  assert.equal(saas.has_login, 'yes');
  assert.ok(saas.auth_mechanism.includes('jwt'));
  assert.equal(saas.registration, 'yes');
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
  const decoded = decodeShare(encoded);
  assert.equal(decoded.name, 'Acme portal');
  assert.equal(decoded.answers.app_type, 'spa');
  assert.doesNotMatch(JSON.stringify(decoded), /confirmed_finding|find-/);
  const href = shareHref({ name: 'Acme portal', targetUrl: 'https://app.example.com', answers: PRESETS.saas_jwt_api.answers }, 'https://example.test/app.html#dashboard');
  assert.match(href, /^https:\/\/example\.test\/app\.html#share\//);
  assert.deepEqual(parseShareHash(href.slice(href.indexOf('#'))), decoded);
  assert.equal(decodeShare('!!!'), null);
  assert.equal(engagementIsBlank(createState()), true);
});

test('workspace starts from the profile, not the category catalog', () => {
  const appHtml = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
  const plan = fs.readFileSync(path.join(ROOT, 'js/ui/plan.js'), 'utf8');
  const profile = fs.readFileSync(path.join(ROOT, 'js/ui/profile.js'), 'utf8');
  const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const playbookUi = fs.readFileSync(path.join(ROOT, 'js/ui/playbook.js'), 'utf8');
  assert.ok(appHtml.includes('data-app-profile'));
  assert.ok(appHtml.includes('data-assessment-plan'));
  assert.match(plan, /buildAssessmentPlan/);
  assert.doesNotMatch(plan, /plan-chips/);
  assert.match(plan, /export function featureChips/);
  assert.match(plan, /authored playbooks/);
  assert.match(plan, /methodology-only/);
  assert.match(profile, /Generate test plan/);
  assert.match(home, /app\.html#dashboard/);
  assert.match(home, /Start testing/);
  assert.match(playbookUi, /CHECK FOR/);
  assert.match(playbookUi, /variantWithMeta\.observe/);
});

test('homepage demo card uses a real object-level authorization item', () => {
  const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const authz = JSON.parse(fs.readFileSync(path.join(ROOT, 'checklist/authorization.json'), 'utf8'));
  const item = authz.items.find(({ id }) => id === 'WAPT-AUTHZ-003');
  assert.ok(item);
  assert.match(item.title, /horizontal read authorization/i);
  assert.match(home, /WAPT-AUTHZ-003/);
  assert.match(home, /Object-level authorization/);
  assert.doesNotMatch(home, /WAPT-AUTHZ-014/);
  assert.doesNotMatch(home, /Authorization suite boosted/);
  assert.match(home, /CURRENT ASSESSMENT/);
  assert.match(home, /hero-preview/);
  assert.doesNotMatch(home, /signal-card/);
});
