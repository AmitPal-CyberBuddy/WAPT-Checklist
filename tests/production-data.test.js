'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { CATEGORIES, validateFiles, validatePhase7 } = require('../tools/validate.js');

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

  const sqlContext = deriveContext({ app_type: 'hybrid', database: ['sql'], async_jobs: 'yes' });
  const noSqlContext = deriveContext({ app_type: 'hybrid', database: ['nosql'], async_jobs: 'yes' });
  for (const item of items.filter(({ tags }) => tags.includes('sqli') || tags.includes('orm-injection'))) {
    assert.equal(evaluateApplicability(item, sqlContext).state, APPLICABILITY.ACTIVE, item.id);
    assert.equal(evaluateApplicability(item, noSqlContext).state, APPLICABILITY.NA_CONTEXT, item.id);
  }
  // Asynchronous-report SQL injection stays Confirm until background jobs are confirmed.
  const sqlUnknownJobs = deriveContext({ app_type: 'hybrid', database: ['sql'] });
  assert.equal(evaluateApplicability(items.find(({ id }) => id === 'WAPT-INJ-008'), sqlUnknownJobs).state, APPLICABILITY.CONFIRM);
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
  // The SSRF category gates on confirmed outbound URL fetching: a confirmed
  // "none" removes the suite, while an unanswered scope keeps it visible as Confirm.
  const noFetch = deriveContext({ app_type: 'hybrid', outbound_fetch: ['none'] });
  assert.ok(items.every((item) => evaluateApplicability(item, noFetch).state === APPLICABILITY.NA_CONTEXT));
  const unknownFetch = deriveContext({ app_type: 'hybrid' });
  assert.ok(items.every((item) => evaluateApplicability(item, unknownFetch).state === APPLICABILITY.CONFIRM));
  const aws = deriveContext({ app_type: 'hybrid', cloud: 'aws', outbound_fetch: ['import'] });
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

test('request smuggling coverage includes required HTTP/1 and HTTP/2 variants without ready payloads', async () => {
  const [{ deriveContext }, { APPLICABILITY, evaluateApplicability }] = await Promise.all([
    import('../js/engine/context.js'), import('../js/engine/applicability.js')
  ]);
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'request-smuggling.json'), 'utf8'));
  for (const tag of ['cl-te', 'te-cl', 'te-te', 'h2-cl', 'h2-te', 'client-side-desync', 'pause-based', 'false-positive', 'retest']) {
    assert.ok(items.some(({ tags }) => tags.includes(tag)), `missing ${tag} coverage`);
  }
  assert.ok(items.every((item) => item.safety.startsWith('REVIEW ONLY.')));
  assert.ok(items.every((item) => item.examples.every(({ note }) => /No smuggling payload/.test(note))));
  const staticContext = deriveContext({ app_type: 'static' });
  assert.ok(items.every((item) => evaluateApplicability(item, staticContext).state === APPLICABILITY.ACTIVE));
});

test('desync methodology requires isolation, canaries, monitoring, and stop conditions', () => {
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'request-smuggling.json'), 'utf8'));
  for (const item of items) {
    assert.match(item.safety, /isolated/);
    assert.match(item.safety, /canary/);
    assert.match(item.safety, /stop/);
    assert.ok(item.evidence.some((entry) => /shared traffic|shared-user/i.test(entry)), item.id);
  }
});

test('business-logic methodology covers workflow, financial, approval, and abuse invariants contextually', async () => {
  const [{ deriveContext }, { APPLICABILITY, evaluateApplicability }] = await Promise.all([
    import('../js/engine/context.js'), import('../js/engine/applicability.js')
  ]);
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'business-logic.json'), 'utf8'));
  for (const tag of ['workflow-skip', 'price-manipulation', 'coupon', 'stored-value', 'payment', 'refund', 'subscription', 'usage-limit', 'separation-of-duties', 'idempotency', 'multi-tenant', 'time-window', 'application-misuse']) {
    assert.ok(items.some(({ tags }) => tags.includes(tag)), `missing ${tag} coverage`);
  }
  assert.ok(items.every((item) => item.safety?.length > 100));
  const noPayments = deriveContext({ app_type: 'hybrid', creds: 'high', features: ['search'] });
  for (const item of items.filter((candidate) => candidate.applies.any_of?.features?.includes('payments'))) {
    assert.equal(evaluateApplicability(item, noPayments).state, APPLICABILITY.NA_CONTEXT, item.id);
  }
  const payments = deriveContext({ app_type: 'hybrid', creds: 'high', features: ['payments'] });
  assert.ok(items.filter((item) => evaluateApplicability(item, payments).state === APPLICABILITY.ACTIVE).length >= 30);
  const staticContext = deriveContext({ app_type: 'static', creds: 'high', features: ['payments'] });
  assert.ok(items.every((item) => evaluateApplicability(item, staticContext).state === APPLICABILITY.NA_CONTEXT));
});

test('business-logic evidence requires authoritative state and cleanup', () => {
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'business-logic.json'), 'utf8'));
  for (const item of items) {
    assert.match(item.validation, /authoritative/);
    assert.ok(item.evidence.some((entry) => /cleanup|void/i.test(entry)), item.id);
    assert.match(item.safety, /never/i);
  }
});

test('race-condition methodology is bounded, contextual, and authoritative-state driven', async () => {
  const [{ deriveContext }, { APPLICABILITY, evaluateApplicability }] = await Promise.all([
    import('../js/engine/context.js'), import('../js/engine/applicability.js')
  ]);
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'race-conditions.json'), 'utf8'));
  for (const tag of ['duplicate-redemption', 'payment', 'inventory', 'toctou', 'single-use-token', 'authorization', 'idempotency-key', 'validation-race', 'partial-construction', 'last-byte-sync']) {
    assert.ok(items.some(({ tags }) => tags.includes(tag)), `missing ${tag} coverage`);
  }
  assert.ok(items.every((item) => item.safety.startsWith('REVIEW ONLY.')));
  assert.ok(items.every((item) => /authoritative/.test(item.validation)));
  const noPayments = deriveContext({ app_type: 'hybrid', creds: 'high', features: ['search'] });
  for (const item of items.filter((candidate) => candidate.applies.any_of?.features?.includes('payments'))) {
    assert.equal(evaluateApplicability(item, noPayments).state, APPLICABILITY.NA_CONTEXT, item.id);
  }
  const staticContext = deriveContext({ app_type: 'static', creds: 'high', features: ['payments'] });
  assert.ok(items.every((item) => evaluateApplicability(item, staticContext).state === APPLICABILITY.NA_CONTEXT));
});

test('race methodology prohibits floods and requires fresh disposable resources', () => {
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'race-conditions.json'), 'utf8'));
  for (const item of items) {
    assert.match(item.safety, /only a few requests/);
    assert.match(item.examples[0].note, /never use a flood/);
    assert.ok(item.steps.some((step) => /fresh equivalent disposable resource/.test(step)), item.id);
  }
});

test('client-side methodology preserves static-site coverage and spans browser trust boundaries', async () => {
  const [{ deriveContext }, { APPLICABILITY, evaluateApplicability }] = await Promise.all([
    import('../js/engine/context.js'), import('../js/engine/applicability.js')
  ]);
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'client-side.json'), 'utf8'));
  for (const tag of ['dom-xss', 'postmessage', 'browser-storage', 'service-worker', 'web-worker', 'broadcastchannel', 'prototype-pollution', 'dom-clobbering', 'window-name', 'reverse-tabnabbing', 'third-party-script', 'subresource-integrity', 'xssi', 'source-map', 'webcrypto']) {
    assert.ok(items.some(({ tags }) => tags.includes(tag)), `missing ${tag} coverage`);
  }
  const staticContext = deriveContext({ app_type: 'static' });
  assert.ok(items.every((item) => evaluateApplicability(item, staticContext).state === APPLICABILITY.ACTIVE));
});

test('client-side active proofs use controlled profiles and non-sensitive markers', () => {
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'client-side.json'), 'utf8'));
  for (const id of [
    'WAPT-CLIENT-003', 'WAPT-CLIENT-004', 'WAPT-CLIENT-005', 'WAPT-CLIENT-006',
    'WAPT-CLIENT-008', 'WAPT-CLIENT-013', 'WAPT-CLIENT-015', 'WAPT-CLIENT-018',
    'WAPT-CLIENT-019', 'WAPT-CLIENT-022', 'WAPT-CLIENT-027', 'WAPT-CLIENT-029'
  ]) {
    assert.ok(items.find((item) => item.id === id)?.safety?.length > 40, `${id} needs a concrete safety note`);
  }
  assert.ok(items.every((item) => item.examples[0].note.includes('inert local marker')));
});

test('WebSocket methodology follows protocol context and separates handshake from application authority', async () => {
  const [{ deriveContext }, { APPLICABILITY, evaluateApplicability }] = await Promise.all([
    import('../js/engine/context.js'), import('../js/engine/applicability.js')
  ]);
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'websocket.json'), 'utf8'));
  for (const tag of ['wss', 'origin-validation', 'authentication', 'token-leakage', 'message-authorization', 'subscription', 'message-schema', 'resource-consumption', 'replay', 'revocation']) {
    assert.ok(items.some(({ tags }) => tags.includes(tag)), `missing ${tag} coverage`);
  }
  const websocket = deriveContext({ api_style: ['websocket'], creds: 'high' });
  assert.ok(items.every((item) => evaluateApplicability(item, websocket).state === APPLICABILITY.ACTIVE));
  const rest = deriveContext({ api_style: ['rest'], creds: 'high' });
  assert.ok(items.every((item) => evaluateApplicability(item, rest).state === APPLICABILITY.NA_CONTEXT));
  const unknown = deriveContext();
  assert.ok(items.every((item) => evaluateApplicability(item, unknown).state === APPLICABILITY.CONFIRM));
  assert.ok(items.every((item) => /HTTP 101/.test(item.validation)));
});

test('WebSocket resource, replay, and revocation probes are bounded', () => {
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'websocket.json'), 'utf8'));
  for (const id of ['WAPT-WS-008', 'WAPT-WS-009', 'WAPT-WS-010']) {
    assert.ok(items.find((item) => item.id === id)?.safety?.length > 40, `${id} needs a concrete safety note`);
  }
});

test('security-header methodology requires contextual impact and handles obsolete policies correctly', async () => {
  const [{ deriveContext }, { APPLICABILITY, evaluateApplicability }] = await Promise.all([
    import('../js/engine/context.js'), import('../js/engine/applicability.js')
  ]);
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'security-headers.json'), 'utf8'));
  for (const tag of ['hsts', 'csp', 'frame-ancestors', 'nosniff', 'referrer-policy', 'permissions-policy', 'coop', 'coep', 'corp', 'cache-control', 'clear-site-data', 'content-disposition', 'x-xss-protection', 'hpkp', 'expect-ct', 'report-only']) {
    assert.ok(items.some(({ tags }) => tags.includes(tag)), `missing ${tag} coverage`);
  }
  assert.ok(items.every((item) => /missing header is not a vulnerability/i.test(item.examples[0].note)));
  assert.ok(items.some(({ mode }) => mode === 'manual'));
  assert.ok(items.some(({ mode }) => mode === 'automated'));
  for (const id of ['WAPT-HDR-019', 'WAPT-HDR-020', 'WAPT-HDR-021']) {
    assert.ok(items.find((item) => item.id === id).tags.includes('obsolete'), `${id} must be obsolete guidance`);
  }
  const staticContext = deriveContext({ app_type: 'static' });
  assert.ok(items.every((item) => evaluateApplicability(item, staticContext).state === APPLICABILITY.ACTIVE));
});

test('security-header validation rejects scanner-only conclusions', () => {
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'security-headers.json'), 'utf8'));
  for (const item of items) {
    assert.match(item.validation, /scanner output/);
    assert.ok(item.false_positives.length >= 2);
    assert.ok(item.evidence.some((entry) => /browser/i.test(entry)), item.id);
  }
});

test('cloud methodology follows provider context and covers identity, storage, metadata, and lifecycle', async () => {
  const [{ deriveContext }, { APPLICABILITY, evaluateApplicability, selectVariants }] = await Promise.all([
    import('../js/engine/context.js'), import('../js/engine/applicability.js')
  ]);
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'cloud-storage.json'), 'utf8'));
  for (const tag of ['public-access', 'public-listing', 'object-authorization', 'signed-url', 'presigned-upload', 'metadata', 'credential-exposure', 'iam', 'cross-account', 'origin-bypass', 'multi-tenant', 'versioning', 'retention', 'event-notification', 'audit-logging']) {
    assert.ok(items.some(({ tags }) => tags.includes(tag)), `missing ${tag} coverage`);
  }
  assert.ok(items.every((item) => item.references.some(({ url }) => url.includes('docs.aws.amazon.com'))));
  assert.ok(items.every((item) => item.references.some(({ url }) => url.includes('cloud.google.com'))));
  assert.ok(items.every((item) => item.references.some(({ url }) => url.includes('learn.microsoft.com'))));
  const none = deriveContext({ cloud: 'none', features: ['multi_tenant'], creds: 'high' });
  assert.ok(items.every((item) => evaluateApplicability(item, none).state === APPLICABILITY.NA_CONTEXT));
  const aws = deriveContext({ cloud: 'aws', features: ['multi_tenant'], creds: 'high' });
  assert.ok(items.every((item) => evaluateApplicability(item, aws).state === APPLICABILITY.ACTIVE));
  const metadata = items.find(({ id }) => id === 'WAPT-CLOUD-009');
  assert.ok(selectVariants(metadata, aws).some(({ notes }) => notes.includes('169.254.169.254')));
});

test('cloud write, metadata, IAM, and event tests use synthetic safety boundaries', () => {
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'cloud-storage.json'), 'utf8'));
  for (const id of [
    'WAPT-CLOUD-005', 'WAPT-CLOUD-006', 'WAPT-CLOUD-007', 'WAPT-CLOUD-009',
    'WAPT-CLOUD-010', 'WAPT-CLOUD-011', 'WAPT-CLOUD-012', 'WAPT-CLOUD-013',
    'WAPT-CLOUD-014', 'WAPT-CLOUD-016', 'WAPT-CLOUD-017'
  ]) {
    assert.ok(items.find((item) => item.id === id)?.safety?.length > 40, `${id} needs a concrete safety note`);
  }
});

test('information-disclosure methodology requires sensitive content and realistic utility', async () => {
  const [{ deriveContext }, { APPLICABILITY, evaluateApplicability }] = await Promise.all([
    import('../js/engine/context.js'), import('../js/engine/applicability.js')
  ]);
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'information-disclosure.json'), 'utf8'));
  for (const tag of ['stack-trace', 'debug-mode', 'client-secret', 'source-map', 'backup-file', 'git', 'environment-file', 'directory-listing', 'version-disclosure', 'metrics', 'log-disclosure', 'cache-disclosure', 'robots-txt', 'personal-data', 'document-metadata', 'stale-copy']) {
    assert.ok(items.some(({ tags }) => tags.includes(tag)), `missing ${tag} coverage`);
  }
  assert.ok(items.every((item) => /sensitivity\/validity|sensitive|utility/.test(item.validation)));
  assert.ok(items.every((item) => /leads; report only/.test(item.examples[0].note)));
  const staticContext = deriveContext({ app_type: 'static' });
  assert.ok(items.every((item) => evaluateApplicability(item, staticContext).state === APPLICABILITY.ACTIVE));
});

test('secret, debug, repository, log, and management checks constrain evidence handling', () => {
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'information-disclosure.json'), 'utf8'));
  for (const id of ['WAPT-INFO-002', 'WAPT-INFO-003', 'WAPT-INFO-006', 'WAPT-INFO-007', 'WAPT-INFO-008', 'WAPT-INFO-011', 'WAPT-INFO-013', 'WAPT-INFO-014', 'WAPT-INFO-017']) {
    assert.ok(items.find((item) => item.id === id)?.safety?.length > 40, `${id} needs a concrete safety note`);
  }
});

test('rate-limiting methodology covers identity, messaging, API, upload, search, and payment abuse contextually', async () => {
  const [{ deriveContext }, { APPLICABILITY, evaluateApplicability }] = await Promise.all([
    import('../js/engine/context.js'), import('../js/engine/applicability.js')
  ]);
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'rate-limiting.json'), 'utf8'));
  for (const tag of ['login', 'credential-stuffing', 'otp', 'push-fatigue', 'password-reset', 'registration', 'api', 'search', 'file-upload', 'fan-out', 'payments', 'forwarded-header']) {
    assert.ok(items.some(({ tags }) => tags.includes(tag)), `missing ${tag} coverage`);
  }
  assert.ok(items.every((item) => item.safety.startsWith('REVIEW ONLY.')));
  assert.ok(items.every((item) => /Never brute-force, flood, spray, spam/.test(item.examples[0].note)));
  const staticContext = deriveContext({ app_type: 'static', has_login: 'yes', features: ['payments', 'search', 'file_upload'] });
  assert.ok(items.every((item) => evaluateApplicability(item, staticContext).state === APPLICABILITY.NA_CONTEXT));
  const noSearch = deriveContext({ app_type: 'hybrid', features: ['payments'] });
  assert.equal(evaluateApplicability(items.find(({ id }) => id === 'WAPT-RATE-008'), noSearch).state, APPLICABILITY.NA_CONTEXT);
});

test('rate tests require measured limits rather than accepted-request extrapolation', () => {
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'rate-limiting.json'), 'utf8'));
  for (const item of items) {
    assert.match(item.validation, /Do not extrapolate/);
    assert.ok(item.evidence.some((entry) => /Exact request\/message count/.test(entry)), item.id);
  }
});

test('all 24 production categories pass their final release floors', () => {
  const files = productionFiles();
  const result = validateFiles(files, { enforceFloors: true });
  assert.deepEqual(result.errors, []);
  assert.equal(files.length, 24);
  assert.equal(Object.values(result.counts).reduce((sum, count) => sum + count, 0), 609);
});

test('advanced methodology covers cache, deserialization, parser, tenant, service, webhook, and chain boundaries', async () => {
  const [{ deriveContext }, { APPLICABILITY, evaluateApplicability }] = await Promise.all([
    import('../js/engine/context.js'), import('../js/engine/applicability.js')
  ]);
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'advanced.json'), 'utf8'));
  for (const tag of ['web-cache-poisoning', 'web-cache-deception', 'deserialization', 'json', 'url-parser', 'type-confusion', 'request-signing', 'shared-cache', 'custom-domain', 'confused-deputy', 'webhook', 'attack-chain', 'retest']) {
    assert.ok(items.some(({ tags }) => tags.includes(tag)), `missing ${tag} coverage`);
  }
  const java = deriveContext({ backend: ['java'], features: ['search'] });
  assert.equal(evaluateApplicability(items.find(({ id }) => id === 'WAPT-ADV-005'), java).state, APPLICABILITY.ACTIVE);
  assert.equal(evaluateApplicability(items.find(({ id }) => id === 'WAPT-ADV-006'), java).state, APPLICABILITY.NA_CONTEXT);
  const noTenant = deriveContext({ backend: ['go'], features: ['search'] });
  assert.equal(evaluateApplicability(items.find(({ id }) => id === 'WAPT-ADV-013'), noTenant).state, APPLICABILITY.NA_CONTEXT);
});

test('advanced high-risk probes use isolated synthetic boundaries', () => {
  const { items } = JSON.parse(fs.readFileSync(path.join(CHECKLIST, 'advanced.json'), 'utf8'));
  for (const id of [
    'WAPT-ADV-001', 'WAPT-ADV-002', 'WAPT-ADV-003', 'WAPT-ADV-004',
    'WAPT-ADV-005', 'WAPT-ADV-006', 'WAPT-ADV-007', 'WAPT-ADV-008',
    'WAPT-ADV-010', 'WAPT-ADV-012', 'WAPT-ADV-013', 'WAPT-ADV-014',
    'WAPT-ADV-015', 'WAPT-ADV-016', 'WAPT-ADV-017'
  ]) {
    assert.ok(items.find((item) => item.id === id)?.safety?.length > 40, `${id} needs a concrete safety note`);
  }
});

test('Phase 7 attack chains, payload references, and Burp workflows validate together', () => {
  const ids = new Set(productionFiles().flatMap((file) => JSON.parse(fs.readFileSync(file, 'utf8')).items.map(({ id }) => id)));
  const result = validatePhase7(ids);
  assert.deepEqual(result.errors, []);
  assert.equal(result.chainIds.size, 5);
  assert.equal(result.payloadCount, 40);
  const payloadManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'payloads/manifest.json'), 'utf8'));
  assert.equal(payloadManifest.categories.length, 24);
});

test('attack-chain memberships are bidirectional and every chain carries safety guidance', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'attack-chains/manifest.json'), 'utf8'));
  const itemMap = new Map(productionFiles().flatMap((file) => JSON.parse(fs.readFileSync(file, 'utf8')).items).map((item) => [item.id, item]));
  for (const entry of manifest.chains) {
    const chain = JSON.parse(fs.readFileSync(path.join(ROOT, 'attack-chains', entry.file), 'utf8'));
    assert.ok(chain.safety.length > 80);
    for (const { item_id: id } of chain.nodes) assert.ok(itemMap.get(id).attack_chains.includes(chain.id), `${id} missing ${chain.id}`);
  }
});

test('REVIEW-ONLY payloads stay explicitly marked and omit ready smuggling payloads', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'payloads/manifest.json'), 'utf8'));
  const payloads = manifest.categories.flatMap(({ file }) => JSON.parse(fs.readFileSync(path.join(ROOT, 'payloads', file), 'utf8')).items);
  const review = payloads.filter(({ review_only }) => review_only);
  assert.ok(review.length >= 7);
  assert.ok(review.every(({ tags }) => tags.includes('review-only')));
  const smuggling = payloads.filter(({ category }) => category === 'request-smuggling');
  assert.ok(smuggling.some(({ payload }) => payload.includes('No ready-to-run') || payload.includes('REVIEW-ONLY')));
  assert.ok(payloads.every(({ related }) => related.length > 0));
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

test('release-r4 scope wiring: intermediary, outbound fetch, asynchronous jobs, and LLM features', async () => {
  const { deriveContext, APPLICABILITY, evaluateApplicability } = await Promise.all([
    import('../js/engine/context.js'), import('../js/engine/applicability.js')
  ]).then(([contextModule, applicabilityModule]) => ({
    deriveContext: contextModule.deriveContext,
    APPLICABILITY: applicabilityModule.APPLICABILITY,
    evaluateApplicability: applicabilityModule.evaluateApplicability
  }));
  const read = (file) => JSON.parse(fs.readFileSync(path.join(CHECKLIST, file), 'utf8'));
  const advanced = read('advanced.json');
  const http = read('http.json');
  const smuggling = read('request-smuggling.json');
  const authorization = read('authorization.json');
  const injection = read('injection.json');
  const businessLogic = read('business-logic.json');
  const api = read('api-security.json');

  const find = (document, id) => document.items.find((item) => item.id === id);

  // Intermediary gating: cache poisoning/deception items require a CDN, proxy, or edge cache.
  for (const id of ['WAPT-ADV-001', 'WAPT-ADV-002', 'WAPT-ADV-003', 'WAPT-ADV-004']) {
    const item = find(advanced, id);
    assert.deepEqual(item.applies, { any_of: { intermediary: ['cdn', 'proxy'] } }, id);
    assert.equal(evaluateApplicability(item, deriveContext({ intermediary: ['cdn'] })).state, APPLICABILITY.ACTIVE, id);
    assert.equal(evaluateApplicability(item, deriveContext({})).state, APPLICABILITY.CONFIRM, id);
    assert.equal(evaluateApplicability(item, deriveContext({ intermediary: ['none'] })).state, APPLICABILITY.NA_CONTEXT, id);
    assert.equal(evaluateApplicability(item, deriveContext({ intermediary: ['waf'] })).state, APPLICABILITY.NA_CONTEXT, id);
  }
  // Shared-cache HTTP items stay reachable for application caches but get an intermediary priority boost.
  for (const id of ['WAPT-HTTP-021', 'WAPT-HTTP-022', 'WAPT-HTTP-023']) {
    assert.deepEqual(find(http, id).priority_when, { intermediary: ['cdn', 'proxy'] }, id);
  }
  // Desynchronization work gets an intermediary-driven priority boost.
  for (const item of smuggling.items) assert.deepEqual(item.priority_when, { intermediary: ['cdn', 'proxy', 'waf'] }, item.id);

  // Webhook-signature verification requires confirmed outbound webhooks.
  assert.deepEqual(find(advanced, 'WAPT-ADV-016').applies, { any_of: { outbound_fetch: ['webhooks'] } });
  assert.equal(evaluateApplicability(find(advanced, 'WAPT-ADV-016'), deriveContext({ outbound_fetch: ['webhooks'] })).state, APPLICABILITY.ACTIVE);
  assert.equal(evaluateApplicability(find(advanced, 'WAPT-ADV-016'), deriveContext({ outbound_fetch: ['none'] })).state, APPLICABILITY.NA_CONTEXT);
  // URL-fetching API items require a confirmed fetching surface on top of API relevance.
  for (const id of ['WAPT-API-027', 'WAPT-API-028']) {
    assert.ok(find(api, id).applies.requires.includes('outbound_fetch:webhooks|import'), id);
  }

  // Asynchronous-job-specific items gate on confirmed background processing.
  for (const [document, id] of [
    [authorization, 'WAPT-AUTHZ-012'], [businessLogic, 'WAPT-BL-025'], [businessLogic, 'WAPT-BL-026'],
    [businessLogic, 'WAPT-BL-027'], [injection, 'WAPT-INJ-008'], [injection, 'WAPT-INJ-028']
  ]) {
    assert.ok(find(document, id).applies.requires.includes('async_jobs:yes'), id);
  }

  // The LLM item exists, is gated on the ai_llm feature, and never hides on unknown scope.
  const llm = find(advanced, 'WAPT-ADV-019');
  assert.ok(llm, 'WAPT-ADV-019');
  assert.deepEqual(llm.applies, { any_of: { features: ['ai_llm'] } });
  assert.equal(evaluateApplicability(llm, deriveContext({ features: ['ai_llm'] })).state, APPLICABILITY.ACTIVE);
  assert.equal(evaluateApplicability(llm, deriveContext({})).state, APPLICABILITY.CONFIRM);
  assert.equal(evaluateApplicability(llm, deriveContext({ features: ['none'] })).state, APPLICABILITY.NA_CONTEXT);
  assert.ok(llm.safety.includes('Never'));
  assert.ok(llm.mappings.cwe.includes('CWE-20'));
});
