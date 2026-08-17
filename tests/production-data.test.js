'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { CATEGORIES, validateFiles } = require('../tools/validate.js');

const ROOT = path.resolve(__dirname, '..');
const CHECKLIST = path.join(ROOT, 'checklist');
const productionFiles = () => fs.readdirSync(CHECKLIST)
  .filter((name) => name.endsWith('.json') && !['manifest.json', 'sample.json'].includes(name))
  .map((name) => path.join(CHECKLIST, name));

test('every production category currently present passes its release floor', () => {
  const result = validateFiles(productionFiles(), { enforcePresentFloors: true });
  assert.deepEqual(result.errors, []);
});

test('reconnaissance IDs are contiguous and exceed the quality floor without duplicate objectives', () => {
  const document = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'reconnaissance.json'), 'utf8'));
  assert.equal(document.category, 'reconnaissance');
  assert.ok(document.items.length >= CATEGORIES.reconnaissance.floor);
  assert.deepEqual(
    document.items.map(({ id }) => id),
    document.items.map((_, index) => `WAPT-RECON-${String(index + 1).padStart(3, '0')}`)
  );
  assert.equal(new Set(document.items.map(({ objective }) => objective.toLowerCase())).size, document.items.length);
});

test('reconnaissance stays discovery-focused and carries explicit false-positive evidence', () => {
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'reconnaissance.json'), 'utf8'));
  for (const item of items) {
    assert.ok(item.false_positives.length >= 2, `${item.id} needs at least two realistic false positives`);
    assert.ok(item.evidence.length >= 3, `${item.id} needs reproducible evidence guidance`);
    assert.ok(item.references.every(({ url }) => url.includes('/v42/')), `${item.id} must pin WSTG v4.2`);
    assert.doesNotMatch(item.vulnerable_behavior, /missing header|scanner says/i, `${item.id} promotes an observation to a finding`);
  }
});

test('production category IDs are contiguous and document metadata stays consistent', () => {
  for (const file of productionFiles()) {
    const document = JSON.parse(fs.readFileSync(file, 'utf8'));
    const prefix = CATEGORIES[document.category].prefix;
    assert.deepEqual(
      document.items.map(({ id }) => id),
      document.items.map((_, index) => `${prefix}-${String(index + 1).padStart(3, '0')}`),
      document.category
    );
  }
});

test('unknown scope never silently hides reconnaissance or HTTP fundamentals', async () => {
  const [{ deriveContext }, { APPLICABILITY, evaluateApplicability }] = await Promise.all([
    import('../js/engine/context.js'), import('../js/engine/applicability.js')
  ]);
  const context = deriveContext();
  for (const file of productionFiles()) {
    const { items } = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const item of items) {
      assert.notEqual(evaluateApplicability(item, context).state, APPLICABILITY.NA_CONTEXT, item.id);
    }
  }
});

test('all production methodology carries decision and evidence depth', () => {
  for (const file of productionFiles()) {
    const { items } = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const item of items) {
      assert.ok(item.steps.length >= 4, `${item.id} needs at least four controlled steps`);
      assert.ok(item.false_positives.length >= 2, `${item.id} needs at least two false positives`);
      assert.ok(item.evidence.length >= 3, `${item.id} needs reproducible evidence guidance`);
      assert.ok(item.remediation?.length > 40, `${item.id} needs root-cause remediation`);
    }
  }
});

test('HTTP coverage includes CORS variants and safety boundaries for active techniques', () => {
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'http.json'), 'utf8'));
  const cors = items.filter(({ tags }) => tags.includes('cors'));
  assert.equal(cors.length, 5);
  assert.ok(items.find(({ id }) => id === 'WAPT-HTTP-016').variants.length >= 2);
  for (const id of ['WAPT-HTTP-002', 'WAPT-HTTP-013', 'WAPT-HTTP-018', 'WAPT-HTTP-021', 'WAPT-HTTP-022', 'WAPT-HTTP-024', 'WAPT-HTTP-025', 'WAPT-HTTP-026']) {
    assert.ok(items.find((item) => item.id === id)?.safety?.length > 40, `${id} needs a concrete safety note`);
  }
});

test('authentication coverage includes modern factors and bounded active testing', () => {
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'authentication.json'), 'utf8'));
  assert.ok(items.filter(({ tags }) => tags.includes('account-enumeration')).length >= 4);
  assert.ok(items.filter(({ tags }) => tags.includes('mfa')).length >= 8);
  assert.equal(items.filter(({ tags }) => tags.includes('webauthn')).length, 2);
  assert.ok(items.find(({ id }) => id === 'WAPT-AUTH-038').applies.any_of.auth_mechanism.includes('saml'));
  for (const id of [
    'WAPT-AUTH-003', 'WAPT-AUTH-006', 'WAPT-AUTH-008', 'WAPT-AUTH-014',
    'WAPT-AUTH-015', 'WAPT-AUTH-016', 'WAPT-AUTH-024', 'WAPT-AUTH-026',
    'WAPT-AUTH-031', 'WAPT-AUTH-032', 'WAPT-AUTH-034', 'WAPT-AUTH-036',
    'WAPT-AUTH-039', 'WAPT-AUTH-040', 'WAPT-AUTH-043', 'WAPT-AUTH-045'
  ]) {
    assert.ok(items.find((item) => item.id === id)?.safety?.length > 40, `${id} needs a concrete safety note`);
  }
});

test('static context removes authentication while no-credential black-box scope keeps blocked roadmap items', async () => {
  const [{ deriveContext }, { APPLICABILITY, evaluateApplicability }] = await Promise.all([
    import('../js/engine/context.js'), import('../js/engine/applicability.js')
  ]);
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'authentication.json'), 'utf8'));
  const staticContext = deriveContext({ app_type: 'static' });
  assert.ok(items.every((item) => evaluateApplicability(item, staticContext).state === APPLICABILITY.NA_CONTEXT));
  const blockedContext = deriveContext({ mode: 'black_box', creds: 'none', app_type: 'hybrid', has_login: 'yes' });
  const credentialItems = items.filter((item) => item.applies.requires?.includes('creds:low|high'));
  assert.ok(credentialItems.length >= 20);
  assert.ok(credentialItems.every((item) => evaluateApplicability(item, blockedContext).blocked));
});

test('disruptive reconnaissance techniques include safety boundaries', () => {
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'reconnaissance.json'), 'utf8'));
  const safetyRequired = new Set([
    'WAPT-RECON-003', 'WAPT-RECON-005', 'WAPT-RECON-012', 'WAPT-RECON-019',
    'WAPT-RECON-021', 'WAPT-RECON-027', 'WAPT-RECON-029', 'WAPT-RECON-030',
    'WAPT-RECON-033'
  ]);
  for (const id of safetyRequired) {
    const item = items.find((candidate) => candidate.id === id);
    assert.ok(item?.safety?.length > 40, `${id} needs a concrete safety note`);
  }
});
