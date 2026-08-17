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

test('all Phase 4 core categories are present and pass their release floors', () => {
  const files = productionFiles();
  const result = validateFiles(files, { enforceCoreFloors: true });
  assert.deepEqual(result.errors, []);
  assert.ok(files.length >= 10);
  assert.equal(Object.values(result.counts).slice(0, 10).reduce((sum, count) => sum + count, 0), 348);
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

test('session coverage handles cookie and token lifecycles contextually', async () => {
  const [{ deriveContext }, { APPLICABILITY, evaluateApplicability }] = await Promise.all([
    import('../js/engine/context.js'), import('../js/engine/applicability.js')
  ]);
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'session-management.json'), 'utf8'));
  assert.ok(items.filter(({ tags }) => tags.includes('cookie')).length >= 5);
  assert.ok(items.filter(({ tags }) => tags.includes('session-revocation')).length >= 3);
  assert.ok(items.every((item) => item.applies.requires?.includes('creds:low|high')));
  const jwtContext = deriveContext({ app_type: 'spa', has_login: 'yes', creds: 'low', auth_mechanism: ['jwt'] });
  for (const item of items.filter((candidate) => candidate.applies.any_of?.auth_mechanism?.includes('cookie'))) {
    assert.equal(evaluateApplicability(item, jwtContext).state, APPLICABILITY.NA_CONTEXT, item.id);
  }
  const cookieContext = deriveContext({ app_type: 'hybrid', has_login: 'yes', creds: 'low', auth_mechanism: ['cookie'] });
  assert.ok(items.filter((item) => evaluateApplicability(item, cookieContext).state === APPLICABILITY.ACTIVE).length >= 24);
});

test('session techniques that alter identity state carry cleanup boundaries', () => {
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'session-management.json'), 'utf8'));
  for (const id of [
    'WAPT-SESS-009', 'WAPT-SESS-011', 'WAPT-SESS-020', 'WAPT-SESS-021',
    'WAPT-SESS-022', 'WAPT-SESS-023', 'WAPT-SESS-024', 'WAPT-SESS-026',
    'WAPT-SESS-027', 'WAPT-SESS-028'
  ]) {
    assert.ok(items.find((item) => item.id === id)?.safety?.length > 40, `${id} needs a concrete safety note`);
  }
});

test('sample mappings do not claim a non-existent WSTG 4.2 JWT scenario', () => {
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'sample.json'), 'utf8'));
  const jwt = items.find(({ id }) => id === 'WAPT-JWT-001');
  assert.deepEqual(jwt.mappings.wstg, []);
  assert.ok(jwt.references.every(({ url }) => !url.includes('Testing_JSON_Web_Tokens')));
});

test('authorization coverage is detailed across object, function, field, and tenant boundaries', async () => {
  const [{ deriveContext }, { APPLICABILITY, evaluateApplicability }] = await Promise.all([
    import('../js/engine/context.js'), import('../js/engine/applicability.js')
  ]);
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'authorization.json'), 'utf8'));
  assert.ok(items.filter(({ tags }) => tags.includes('bola') || tags.includes('idor')).length >= 10);
  assert.ok(items.filter(({ tags }) => tags.includes('multi-tenant')).length >= 4);
  assert.ok(items.filter(({ tags }) => tags.includes('field-level') || tags.includes('bopla')).length >= 2);
  assert.ok(items.every((item) => item.applies.requires?.includes('creds:low|high')));

  const singleTenant = deriveContext({ app_type: 'hybrid', has_login: 'yes', creds: 'high', features: ['search'] });
  for (const item of items.filter((candidate) => candidate.applies.any_of?.features?.includes('multi_tenant'))) {
    assert.equal(evaluateApplicability(item, singleTenant).state, APPLICABILITY.NA_CONTEXT, item.id);
  }
  const multiTenant = deriveContext({ app_type: 'hybrid', has_login: 'yes', creds: 'high', features: ['multi_tenant'], roles: 'many' });
  assert.ok(items.filter((item) => evaluateApplicability(item, multiTenant).state === APPLICABILITY.ACTIVE).length >= 38);
});

test('authorization mutations use synthetic state and explicit restoration boundaries', () => {
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'authorization.json'), 'utf8'));
  for (const id of [
    'WAPT-AUTHZ-004', 'WAPT-AUTHZ-005', 'WAPT-AUTHZ-007', 'WAPT-AUTHZ-016',
    'WAPT-AUTHZ-017', 'WAPT-AUTHZ-019', 'WAPT-AUTHZ-021', 'WAPT-AUTHZ-023',
    'WAPT-AUTHZ-024', 'WAPT-AUTHZ-026', 'WAPT-AUTHZ-027', 'WAPT-AUTHZ-028',
    'WAPT-AUTHZ-029', 'WAPT-AUTHZ-030', 'WAPT-AUTHZ-034', 'WAPT-AUTHZ-035'
  ]) {
    assert.ok(items.find((item) => item.id === id)?.safety?.length > 40, `${id} needs a concrete safety note`);
  }
});

test('injection coverage spans required interpreters and follows database context', async () => {
  const [{ deriveContext }, { APPLICABILITY, evaluateApplicability }] = await Promise.all([
    import('../js/engine/context.js'), import('../js/engine/applicability.js')
  ]);
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'injection.json'), 'utf8'));
  for (const tag of ['sqli', 'nosqli', 'ldap-injection', 'xpath-injection', 'xml-injection', 'command-injection', 'ssti', 'crlf-injection', 'http-parameter-pollution', 'csv-injection', 'host-header']) {
    assert.ok(items.some(({ tags }) => tags.includes(tag)), `missing ${tag} coverage`);
  }
  const ssti = items.find(({ id }) => id === 'WAPT-INJ-030');
  assert.ok(ssti.variants.length >= 3);

  const sqlContext = deriveContext({ app_type: 'hybrid', database: ['sql'] });
  const noSqlContext = deriveContext({ app_type: 'hybrid', database: ['nosql'] });
  for (const item of items.filter(({ tags }) => tags.includes('sqli') || tags.includes('orm-injection'))) {
    assert.equal(evaluateApplicability(item, sqlContext).state, APPLICABILITY.ACTIVE, item.id);
    assert.equal(evaluateApplicability(item, noSqlContext).state, APPLICABILITY.NA_CONTEXT, item.id);
  }
  for (const item of items.filter(({ tags }) => tags.includes('nosqli'))) {
    assert.equal(evaluateApplicability(item, noSqlContext).state, APPLICABILITY.ACTIVE, item.id);
  }
});

test('dangerous injection families carry strict least-impact boundaries', () => {
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'injection.json'), 'utf8'));
  for (const id of [
    'WAPT-INJ-003', 'WAPT-INJ-021', 'WAPT-INJ-022', 'WAPT-INJ-024',
    'WAPT-INJ-025', 'WAPT-INJ-026', 'WAPT-INJ-027', 'WAPT-INJ-028',
    'WAPT-INJ-029', 'WAPT-INJ-030', 'WAPT-INJ-033', 'WAPT-INJ-034',
    'WAPT-INJ-035', 'WAPT-INJ-036', 'WAPT-INJ-037', 'WAPT-INJ-038',
    'WAPT-INJ-045', 'WAPT-INJ-048', 'WAPT-INJ-049', 'WAPT-INJ-054',
    'WAPT-INJ-055'
  ]) {
    assert.ok(items.find((item) => item.id === id)?.safety?.length > 40, `${id} needs a concrete safety note`);
  }
});

test('XSS coverage uses context sub-steps and preserves static-site DOM testing', async () => {
  const [{ deriveContext }, { APPLICABILITY, evaluateApplicability }] = await Promise.all([
    import('../js/engine/context.js'), import('../js/engine/applicability.js')
  ]);
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'xss.json'), 'utf8'));
  const contextItem = items.find(({ id }) => id === 'WAPT-XSS-001');
  for (const contextName of ['HTML text', 'quoted or unquoted attributes', 'JavaScript strings', 'URL attributes']) {
    assert.ok(contextItem.steps.some((step) => step.includes(contextName)), `missing ${contextName} sub-step`);
  }
  for (const tag of ['reflected-xss', 'stored-xss', 'dom-xss', 'mutation-xss', 'svg', 'markdown', 'trusted-types']) {
    assert.ok(items.some(({ tags }) => tags.includes(tag)), `missing ${tag} coverage`);
  }
  const staticContext = deriveContext({ app_type: 'static' });
  assert.ok(items.filter((item) => evaluateApplicability(item, staticContext).state === APPLICABILITY.ACTIVE).length >= 17);
  assert.equal(evaluateApplicability(items.find(({ id }) => id === 'WAPT-XSS-002'), staticContext).state, APPLICABILITY.NA_CONTEXT);
});

test('XSS proof guidance prohibits sensitive-data collection', () => {
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'xss.json'), 'utf8'));
  for (const id of [
    'WAPT-XSS-002', 'WAPT-XSS-003', 'WAPT-XSS-008', 'WAPT-XSS-012',
    'WAPT-XSS-013', 'WAPT-XSS-015', 'WAPT-XSS-019', 'WAPT-XSS-022',
    'WAPT-XSS-023', 'WAPT-XSS-024', 'WAPT-XSS-026', 'WAPT-XSS-027',
    'WAPT-XSS-028', 'WAPT-XSS-030'
  ]) {
    assert.ok(items.find((item) => item.id === id)?.safety?.length > 40, `${id} needs a concrete safety note`);
  }
  assert.match(items.find(({ id }) => id === 'WAPT-XSS-030').safety, /Never read or transmit cookies, tokens, personal data, or credentials/);
});

test('CSRF coverage models browser credential transport and protocol-specific actions', async () => {
  const [{ deriveContext }, { APPLICABILITY, evaluateApplicability, selectVariants }] = await Promise.all([
    import('../js/engine/context.js'), import('../js/engine/applicability.js')
  ]);
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'csrf.json'), 'utf8'));
  assert.ok(items.every((item) => item.applies.requires?.includes('creds:low|high')));
  for (const tag of ['token', 'origin-validation', 'samesite', 'login-csrf', 'multipart', 'graphql', 'cors']) {
    assert.ok(items.some(({ tags }) => tags.includes(tag)), `missing ${tag} coverage`);
  }
  const jwtContext = deriveContext({ app_type: 'spa', has_login: 'yes', creds: 'low', auth_mechanism: ['jwt'] });
  const sameSite = items.find(({ id }) => id === 'WAPT-CSRF-009');
  assert.equal(evaluateApplicability(sameSite, jwtContext).state, APPLICABILITY.ACTIVE);
  assert.ok(selectVariants(sameSite, jwtContext).some(({ notes }) => notes.includes('Token format')));
  const staticContext = deriveContext({ app_type: 'static' });
  assert.ok(items.every((item) => evaluateApplicability(item, staticContext).state === APPLICABILITY.NA_CONTEXT));
});

test('CSRF state changes use reversible actions and explicit stopping points', () => {
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'csrf.json'), 'utf8'));
  for (const id of [
    'WAPT-CSRF-004', 'WAPT-CSRF-005', 'WAPT-CSRF-012', 'WAPT-CSRF-013',
    'WAPT-CSRF-014', 'WAPT-CSRF-015', 'WAPT-CSRF-016', 'WAPT-CSRF-018'
  ]) {
    assert.ok(items.find((item) => item.id === id)?.safety?.length > 40, `${id} needs a concrete safety note`);
  }
});

test('file-handling coverage spans uploads, downloads, archives, traversal, inclusion, and active formats', async () => {
  const [{ deriveContext }, { APPLICABILITY, evaluateApplicability }] = await Promise.all([
    import('../js/engine/context.js'), import('../js/engine/applicability.js')
  ]);
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'file-handling.json'), 'utf8'));
  for (const tag of ['file-type', 'code-execution', 'zip-slip', 'symlink', 'decompression-bomb', 'svg', 'polyglot', 'download', 'path-traversal', 'local-file-inclusion', 'remote-file-inclusion']) {
    assert.ok(items.some(({ tags }) => tags.includes(tag)), `missing ${tag} coverage`);
  }
  const noUpload = deriveContext({ app_type: 'hybrid', features: ['search'] });
  for (const item of items.filter((candidate) => candidate.applies.any_of?.features?.includes('file_upload'))) {
    assert.equal(evaluateApplicability(item, noUpload).state, APPLICABILITY.NA_CONTEXT, item.id);
  }
  const staticContext = deriveContext({ app_type: 'static' });
  assert.ok(items.every((item) => evaluateApplicability(item, staticContext).state === APPLICABILITY.NA_CONTEXT));
});

test('file-handling safety rules prohibit destructive payloads and sensitive-file access', () => {
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'file-handling.json'), 'utf8'));
  for (const id of [
    'WAPT-UPLOAD-004', 'WAPT-UPLOAD-005', 'WAPT-UPLOAD-007', 'WAPT-UPLOAD-008',
    'WAPT-UPLOAD-009', 'WAPT-UPLOAD-010', 'WAPT-UPLOAD-012', 'WAPT-UPLOAD-014',
    'WAPT-UPLOAD-015', 'WAPT-UPLOAD-016', 'WAPT-UPLOAD-019', 'WAPT-UPLOAD-021',
    'WAPT-UPLOAD-022', 'WAPT-UPLOAD-025'
  ]) {
    assert.ok(items.find((item) => item.id === id)?.safety?.length > 40, `${id} needs a concrete safety note`);
  }
  const inclusion = items.filter(({ tags }) => tags.includes('local-file-inclusion') || tags.includes('remote-file-inclusion'));
  assert.ok(inclusion.every((item) => item.mappings.wstg.length === 0), 'subsection pages must not invent WSTG scenario IDs');
});

test('API security covers every 2023 risk and responds to protocol and URL-hint context', async () => {
  const [{ deriveContext }, { APPLICABILITY, evaluateApplicability }] = await Promise.all([
    import('../js/engine/context.js'), import('../js/engine/applicability.js')
  ]);
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'api-security.json'), 'utf8'));
  for (let risk = 1; risk <= 10; risk += 1) {
    assert.ok(items.some(({ mappings }) => mappings.api_top10.includes(`API${risk}:2023`)), `missing API${risk}:2023`);
  }
  const noApi = deriveContext({ api_style: ['none'], features: ['search'] });
  assert.ok(items.every((item) => evaluateApplicability(item, noApi).state === APPLICABILITY.NA_CONTEXT));
  const rest = deriveContext({ api_style: ['rest'], features: ['search'], creds: 'high' });
  assert.ok(items.filter((item) => evaluateApplicability(item, rest).state === APPLICABILITY.ACTIVE).length >= 35);
  const hinted = deriveContext({}, 'https://api.example.com');
  assert.ok(items.every((item) => evaluateApplicability(item, hinted).state === APPLICABILITY.CONFIRM));
});

test('API resource, business-flow, SSRF, and upstream tests carry safety ceilings', () => {
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'api-security.json'), 'utf8'));
  for (const id of [
    'WAPT-API-015', 'WAPT-API-016', 'WAPT-API-017', 'WAPT-API-018',
    'WAPT-API-019', 'WAPT-API-024', 'WAPT-API-025', 'WAPT-API-026',
    'WAPT-API-027', 'WAPT-API-028', 'WAPT-API-035', 'WAPT-API-037',
    'WAPT-API-038', 'WAPT-API-039', 'WAPT-API-040'
  ]) {
    assert.ok(items.find((item) => item.id === id)?.safety?.length > 40, `${id} needs a concrete safety note`);
  }
});

test('GraphQL methodology gates on protocol context and covers schema, authorization, and cost', async () => {
  const [{ deriveContext }, { APPLICABILITY, evaluateApplicability }] = await Promise.all([
    import('../js/engine/context.js'), import('../js/engine/applicability.js')
  ]);
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'graphql.json'), 'utf8'));
  for (const tag of ['introspection', 'bola', 'field-authorization', 'mutation', 'depth-limit', 'query-cost', 'alias', 'batch', 'subscription']) {
    assert.ok(items.some(({ tags }) => tags.includes(tag)), `missing ${tag} coverage`);
  }
  const graphql = deriveContext({ api_style: ['graphql'], creds: 'high' });
  assert.ok(items.every((item) => evaluateApplicability(item, graphql).state === APPLICABILITY.ACTIVE));
  const soap = deriveContext({ api_style: ['soap'], creds: 'high' });
  assert.ok(items.every((item) => evaluateApplicability(item, soap).state === APPLICABILITY.NA_CONTEXT));
  const unknown = deriveContext();
  assert.ok(items.every((item) => evaluateApplicability(item, unknown).state === APPLICABILITY.CONFIRM));
});

test('GraphQL resource probes carry strict query ceilings', () => {
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'graphql.json'), 'utf8'));
  for (const id of ['WAPT-GQL-006', 'WAPT-GQL-007', 'WAPT-GQL-008', 'WAPT-GQL-009', 'WAPT-GQL-010', 'WAPT-GQL-011', 'WAPT-GQL-012', 'WAPT-GQL-013', 'WAPT-GQL-014']) {
    assert.ok(items.find((item) => item.id === id)?.safety?.length > 40, `${id} needs a concrete safety note`);
  }
});

test('JWT methodology follows auth mechanism context and avoids invented WSTG mappings', async () => {
  const [{ deriveContext }, { APPLICABILITY, evaluateApplicability }] = await Promise.all([
    import('../js/engine/context.js'), import('../js/engine/applicability.js')
  ]);
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'jwt.json'), 'utf8'));
  for (const tag of ['signature-verification', 'algorithm-confusion', 'weak-secret', 'issuer', 'audience', 'token-type', 'kid', 'jku', 'refresh-token']) {
    assert.ok(items.some(({ tags }) => tags.includes(tag)), `missing ${tag} coverage`);
  }
  assert.ok(items.every((item) => item.mappings.wstg.length === 0));
  const jwt = deriveContext({ app_type: 'spa', auth_mechanism: ['jwt'], creds: 'low' });
  assert.ok(items.every((item) => evaluateApplicability(item, jwt).state === APPLICABILITY.ACTIVE));
  const cookie = deriveContext({ app_type: 'hybrid', auth_mechanism: ['cookie'], creds: 'low' });
  assert.ok(items.every((item) => evaluateApplicability(item, cookie).state === APPLICABILITY.NA_CONTEXT));
  const unknown = deriveContext();
  assert.ok(items.every((item) => evaluateApplicability(item, unknown).state === APPLICABILITY.CONFIRM));
});

test('JWT key, forgery, replay, and refresh tests use synthetic safety boundaries', () => {
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'jwt.json'), 'utf8'));
  for (const id of [
    'WAPT-JWT-004', 'WAPT-JWT-005', 'WAPT-JWT-010', 'WAPT-JWT-011',
    'WAPT-JWT-012', 'WAPT-JWT-013', 'WAPT-JWT-015', 'WAPT-JWT-016'
  ]) {
    assert.ok(items.find((item) => item.id === id)?.safety?.length > 40, `${id} needs a concrete safety note`);
  }
});

test('federation methodology selects OAuth and SAML groups independently', async () => {
  const [{ deriveContext }, { APPLICABILITY, evaluateApplicability }] = await Promise.all([
    import('../js/engine/context.js'), import('../js/engine/applicability.js')
  ]);
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'oauth-sso-saml.json'), 'utf8'));
  for (const tag of ['redirect-uri', 'state', 'pkce', 'mix-up', 'refresh-token', 'signature-wrapping', 'inresponseto', 'relaystate']) {
    assert.ok(items.some(({ tags }) => tags.includes(tag)), `missing ${tag} coverage`);
  }
  assert.ok(items.every((item) => item.mappings.wstg.length === 0));
  assert.ok(items.filter(({ tags }) => tags.includes('saml')).every((item) => item.references.some(({ source }) => source === 'OASIS')));

  const oauth = deriveContext({ app_type: 'hybrid', has_login: 'yes', creds: 'high', auth_mechanism: ['oauth'] });
  assert.ok(items.filter((item) => evaluateApplicability(item, oauth).state === APPLICABILITY.ACTIVE).length >= 14);
  assert.ok(items.filter((item) => item.id !== 'WAPT-OAUTH-022' && item.tags.includes('saml')).every((item) => evaluateApplicability(item, oauth).state === APPLICABILITY.NA_CONTEXT));
  const saml = deriveContext({ app_type: 'hybrid', has_login: 'yes', creds: 'high', auth_mechanism: ['saml'] });
  assert.equal(items.filter((item) => evaluateApplicability(item, saml).state === APPLICABILITY.ACTIVE).length, 8);
});

test('federation redirect, token, assertion, and role tests use controlled identities', () => {
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'oauth-sso-saml.json'), 'utf8'));
  for (const id of [
    'WAPT-OAUTH-001', 'WAPT-OAUTH-002', 'WAPT-OAUTH-004', 'WAPT-OAUTH-005',
    'WAPT-OAUTH-011', 'WAPT-OAUTH-013', 'WAPT-OAUTH-014', 'WAPT-OAUTH-015',
    'WAPT-OAUTH-016', 'WAPT-OAUTH-018', 'WAPT-OAUTH-020', 'WAPT-OAUTH-021',
    'WAPT-OAUTH-022'
  ]) {
    assert.ok(items.find((item) => item.id === id)?.safety?.length > 40, `${id} needs a concrete safety note`);
  }
});

test('SSRF methodology covers parser, redirect, metadata, renderer, and egress boundaries', async () => {
  const [{ deriveContext }, { APPLICABILITY, evaluateApplicability, selectVariants }] = await Promise.all([
    import('../js/engine/context.js'), import('../js/engine/applicability.js')
  ]);
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'ssrf.json'), 'utf8'));
  for (const tag of ['blind-ssrf', 'scheme', 'host-allowlist', 'ip-address', 'redirect', 'dns-rebinding', 'cloud-metadata', 'parser-differential', 'document-renderer', 'second-order', 'egress']) {
    assert.ok(items.some(({ tags }) => tags.includes(tag)), `missing ${tag} coverage`);
  }
  assert.ok(items.every((item) => item.safety?.length > 80));
  const staticContext = deriveContext({ app_type: 'static' });
  assert.ok(items.every((item) => evaluateApplicability(item, staticContext).state === APPLICABILITY.NA_CONTEXT));
  const aws = deriveContext({ app_type: 'hybrid', cloud: 'aws' });
  const metadata = items.find(({ id }) => id === 'WAPT-SSRF-008');
  assert.ok(selectVariants(metadata, aws).some(({ notes }) => notes.includes('169.254.169.254')));
  assert.equal(evaluateApplicability(metadata, aws).state, APPLICABILITY.ACTIVE);
});

test('SSRF runtime guidance never endorses sensitive destinations', () => {
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'ssrf.json'), 'utf8'));
  for (const item of items) {
    assert.match(item.safety, /never|Never|Do not/);
    assert.ok(item.evidence.some((entry) => /callback|egress|destination/i.test(entry)), item.id);
  }
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
