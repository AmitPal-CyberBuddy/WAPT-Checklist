'use strict';

// The assessment-preset setup flow: scenario presets provide initial context, ask
// only relevant follow-ups, and every answer keeps driving applicability.

const test = require('node:test');
const assert = require('node:assert/strict');
const { OPTIONS } = require('../tools/validate.js');

const presetsUrl = import('../js/data/presets.mjs');
const surfacesUrl = import('../js/engine/surfaces.js');
const contextUrl = import('../js/engine/context.js');
const wizardUrl = import('../js/ui/wizard.js');

const MULTI_KEYS = new Set(['auth_mechanism', 'identity_features', 'role_types', 'backend', 'api_style', 'database', 'features', 'intermediary', 'outbound_fetch']);

test('seven assessment presets cover the common VAPT engagement scenarios', async () => {
  const { ASSESSMENT_LIST } = await presetsUrl;
  assert.deepEqual(ASSESSMENT_LIST.map(({ id }) => id), [
    'static_black_box', 'web_black_box', 'web_grey_box', 'grey_box_multi_role',
    'public_login_registration', 'api_security', 'custom'
  ]);
  for (const preset of ASSESSMENT_LIST) {
    assert.ok(preset.title && preset.blurb, `${preset.id} needs a title and blurb`);
    assert.ok(Array.isArray(preset.assumptions), `${preset.id} assumptions must be a list`);
    if (preset.id !== 'custom') assert.ok(preset.assumptions.length >= 3, `${preset.id} should state its initial context`);
    assert.ok(Array.isArray(preset.focus), `${preset.id} focus must be a list`);
  }
});

test('assessment preset answers use the complete controlled vocabulary', async () => {
  const { ASSESSMENT_LIST } = await presetsUrl;
  for (const preset of ASSESSMENT_LIST) {
    if (!preset.answers) continue;
    for (const [key, value] of Object.entries(preset.answers)) {
      assert.ok(OPTIONS[key], `${preset.id}.${key} is not a context attribute`);
      const values = Array.isArray(value) ? value : [value];
      assert.equal(Array.isArray(value), MULTI_KEYS.has(key), `${preset.id}.${key} has the wrong cardinality`);
      assert.ok(values.length > 0, `${preset.id}.${key} cannot be empty`);
      for (const option of values) assert.ok(OPTIONS[key].includes(option), `${preset.id}.${key} contains ${option}`);
    }
  }
});

test('preset focus keys are real questions and the scenario answer is coherent', async () => {
  const [{ ASSESSMENT_LIST }, { QUESTIONS }, { normalizeScopeAnswers }] = await Promise.all([presetsUrl, wizardUrl, contextUrl]);
  const questionKeys = new Set(QUESTIONS.map(({ key }) => key));
  for (const preset of ASSESSMENT_LIST) {
    for (const key of preset.focus) assert.ok(questionKeys.has(key), `${preset.id} focuses unknown question ${key}`);
    if (!preset.answers) continue;
    const normalized = normalizeScopeAnswers(structuredClone(preset.answers));
    // Every focus question must actually stay open (unknown) after normalization.
    for (const key of preset.focus) {
      const value = normalized[key];
      const open = value === 'unknown' || (Array.isArray(value) && value.includes('unknown'));
      assert.ok(open, `${preset.id} focus ${key} is already answered by the preset`);
    }
  }
});

test('static black-box preset collapses dynamic surfaces at the answer layer', async () => {
  const [{ ASSESSMENT_LIST }, { normalizeScopeAnswers }] = await Promise.all([presetsUrl, contextUrl]);
  const preset = ASSESSMENT_LIST.find(({ id }) => id === 'static_black_box');
  const normalized = normalizeScopeAnswers(structuredClone(preset.answers));
  assert.equal(normalized.app_type, 'static');
  assert.equal(normalized.has_login, 'no');
  assert.deepEqual(normalized.auth_mechanism, ['none']);
  assert.deepEqual(normalized.api_style, ['none']);
  assert.deepEqual(normalized.backend, ['none']);
  assert.deepEqual(normalized.database, ['none']);
});

test('multi-role preset keeps the role and privilege-tier questions open', async () => {
  const [{ ASSESSMENT_LIST }, { QUESTIONS }] = await Promise.all([presetsUrl, wizardUrl]);
  const preset = ASSESSMENT_LIST.find(({ id }) => id === 'grey_box_multi_role');
  assert.equal(preset.answers.roles, 'many');
  assert.ok(preset.focus.includes('role_types'));
  assert.ok(QUESTIONS.some(({ key }) => key === 'role_types' && key === 'role_types'));
});

test('matchAssessment labels a context by its closest scenario', async () => {
  const [{ ASSESSMENT_LIST, matchAssessment }, { normalizeScopeAnswers }] = await Promise.all([presetsUrl, contextUrl]);
  const staticPreset = ASSESSMENT_LIST.find(({ id }) => id === 'static_black_box');
  assert.equal(matchAssessment(normalizeScopeAnswers(structuredClone(staticPreset.answers)))?.id, 'static_black_box');
  const multiRole = ASSESSMENT_LIST.find(({ id }) => id === 'grey_box_multi_role');
  assert.equal(matchAssessment(normalizeScopeAnswers(structuredClone(multiRole.answers)))?.id, 'grey_box_multi_role');
  assert.equal(matchAssessment(normalizeScopeAnswers({})), null);
  // JWT-only drifted context still resembles the API scenario weakly — no label force-fits.
  assert.notEqual(matchAssessment(normalizeScopeAnswers({ app_type: 'spa', auth_mechanism: ['jwt'] }))?.id, 'static_black_box');
});

test('surface rationale explains why each category is included', async () => {
  const { surfaceRationale, roleLadderLabels } = await surfacesUrl;
  const { deriveContext } = await contextUrl;
  const jwtContext = deriveContext({ app_type: 'spa', has_login: 'yes', auth_mechanism: ['jwt'] });
  assert.ok(surfaceRationale('jwt', jwtContext).some((line) => line.includes('JWT / token-based authentication was selected.')));
  assert.ok(surfaceRationale('session', jwtContext).some((line) => line.includes('Bearer tokens carry the authenticated session.')));
  const cookieContext = deriveContext({ app_type: 'hybrid', has_login: 'yes', auth_mechanism: ['cookie'] });
  assert.ok(surfaceRationale('session', cookieContext).some((line) => line.includes('Cookie / session-based authentication was selected.')));
  const staticContext = deriveContext({ app_type: 'static' });
  assert.ok(surfaceRationale('tls', staticContext).some((line) => line.includes('every external web assessment')));
  assert.ok(surfaceRationale('upload', deriveContext({ app_type: 'hybrid', features: ['file_upload'] })).some((line) => line.includes('File upload / document handling was selected.')));
  assert.ok(surfaceRationale('graphql', deriveContext({ app_type: 'api_only', api_style: ['graphql'] })).some((line) => line.includes('GraphQL was selected.')));
  assert.deepEqual(roleLadderLabels(['standard', 'admin', 'privileged']), ['Administrator', 'Privileged user', 'Standard user']);
});

test('preset flow asks only its relevant follow-up questions', async () => {
  const [{ ASSESSMENT_LIST }, { openQuestionKeys }, { normalizeScopeAnswers }] = await Promise.all([presetsUrl, wizardUrl, contextUrl]);
  const byId = (id) => ASSESSMENT_LIST.find((preset) => preset.id === id);
  const openFor = (preset) => openQuestionKeys(normalizeScopeAnswers(structuredClone(preset.answers)), preset);

  // Static black box: only interactive-functionality, intermediary, and hosting remain,
  // in the preset's interview order.
  assert.deepEqual(openFor(byId('static_black_box')), ['features', 'intermediary', 'cloud']);

  // Public app with login+registration: the auth mechanism question leads the follow-ups.
  const publicApp = openFor(byId('public_login_registration'));
  assert.equal(publicApp[0], 'auth_mechanism');
  assert.ok(publicApp.includes('identity_features'));

  // Multi-role grey box: role tiers are asked, and identity plumbing is not re-asked.
  const multiRole = openFor(byId('grey_box_multi_role'));
  assert.ok(multiRole.includes('role_types'));
  assert.equal(byId('grey_box_multi_role').answers.roles, 'many');

  // Without a preset every applicable unknown question is a step (custom build).
  assert.equal(openQuestionKeys(normalizeScopeAnswers({}), byId('custom')).length, 19);

  // Discovering a login mid-assessment reveals the identity questions as new steps.
  const revealed = new Set(['creds', 'registration', 'roles', 'role_types', 'auth_mechanism', 'identity_features']);
  const blackBox = byId('web_black_box');
  const answers = normalizeScopeAnswers({ ...structuredClone(blackBox.answers), has_login: 'yes' });
  const reopened = openQuestionKeys(answers, blackBox, revealed);
  assert.ok(reopened.includes('auth_mechanism'), 'a discovered login must open the mechanism question');
  assert.ok(reopened.includes('role_types') === false || answers.roles !== 'one');
});

test('privilege tiers boost authorization scoring and rationale', async () => {
  const [{ deriveContext }, { scoreItem }, { categoryRationale }] = await Promise.all([contextUrl, import('../js/engine/priorities.js'), import('../js/engine/rationale.js')]);
  const item = { id: 'WAPT-AUTHZ-900', category: 'authorization', severity: 'medium' };
  const flat = scoreItem(item, deriveContext({ app_type: 'hybrid', roles: 'many' }));
  const tiered = scoreItem(item, deriveContext({ app_type: 'hybrid', roles: 'many', role_types: ['admin', 'standard'] }));
  assert.ok(tiered.score > flat.score, 'privilege tiers should raise authorization priority');
  assert.ok(categoryRationale('authorization', deriveContext({ app_type: 'hybrid', roles: 'many', role_types: ['admin'] }))
    .some((reason) => reason.includes('vertical escalation')));
});
