'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const stateModule = import('../js/engine/state.js');
const NOW = '2026-08-17T10:00:00.000Z';

test('new state has the complete v2 local-only shape', async () => {
  const { STATE_KEY, STATE_SCHEMA_VERSION, createState } = await stateModule;
  const state = createState();
  assert.equal(STATE_KEY, 'wapt.state.v1');
  assert.deepEqual(Object.keys(state), ['schema_version', 'engagement', 'answers', 'statuses', 'notes', 'overrides', 'retests', 'findings', 'updated_at']);
  assert.equal(state.schema_version, 2);
  assert.equal(STATE_SCHEMA_VERSION, 2);
  assert.deepEqual(state.findings, []);
  assert.equal(state.answers.mode, 'unknown');
  assert.deepEqual(state.answers.features, ['unknown']);
});

test('legacy schema v1 state migrates transparently to v2 with empty findings', async () => {
  const { normalizeState, importState, serializeState } = await stateModule;
  const legacy = {
    schema_version: 1,
    engagement: { name: 'Legacy portal', targetUrl: 'https://app.example.com', started_at: '2026-08-17T00:00:00.000Z' },
    answers: { mode: 'grey_box' },
    statuses: { 'WAPT-AUTHZ-001': 'passed' },
    notes: { 'WAPT-AUTHZ-001': 'Legacy note.' },
    overrides: {}, retests: {}, updated_at: '2026-08-17T00:00:00.000Z'
  };
  const migrated = normalizeState(legacy);
  assert.equal(migrated.schema_version, 2);
  assert.deepEqual(migrated.findings, []);
  assert.equal(migrated.engagement.name, 'Legacy portal');
  assert.equal(migrated.statuses['WAPT-AUTHZ-001'], 'passed');
  assert.equal(importState(JSON.stringify(legacy)).engagement.name, 'Legacy portal');
  assert.equal(JSON.parse(serializeState(migrated)).schema_version, 2);
});

test('status and note updates are immutable and timestamped', async () => {
  const { createState, setItemNote, setItemStatus } = await stateModule;
  const original = createState();
  const withStatus = setItemStatus(original, 'WAPT-AUTHZ-001', 'in_progress', NOW);
  const withNote = setItemNote(withStatus, 'WAPT-AUTHZ-001', 'Compared tenant A and B.', NOW);
  assert.deepEqual(original.statuses, {});
  assert.equal(withNote.statuses['WAPT-AUTHZ-001'], 'in_progress');
  assert.equal(withNote.notes['WAPT-AUTHZ-001'], 'Compared tenant A and B.');
  assert.equal(withNote.updated_at, NOW);
});

test('applicability override requires a meaningful reason', async () => {
  const { createState, setOverride } = await stateModule;
  assert.throws(() => setOverride(createState(), 'WAPT-GQL-001', '  ', NOW), /requires a reason/);
  const state = setOverride(createState(), 'WAPT-GQL-001', 'GraphQL was confirmed during recon.', NOW);
  assert.deepEqual(state.overrides['WAPT-GQL-001'], { active: true, reason: 'GraphQL was confirmed during recon.', updated_at: NOW });
});

test('retest flag is legal only for Confirmed Findings and clears on status change', async () => {
  const { createState, setItemStatus, setRetestFlag } = await stateModule;
  assert.throws(() => setRetestFlag(createState(), 'WAPT-AUTHZ-001', true, NOW), /Confirmed Finding/);
  let state = setItemStatus(createState(), 'WAPT-AUTHZ-001', 'confirmed_finding', NOW);
  state = setRetestFlag(state, 'WAPT-AUTHZ-001', true, NOW);
  assert.equal(state.retests['WAPT-AUTHZ-001'], true);
  state = setItemStatus(state, 'WAPT-AUTHZ-001', 'passed', NOW);
  assert.equal(state.retests['WAPT-AUTHZ-001'], undefined);
});

test('JSON export and import round-trip preserves valid engagement data', async () => {
  const { createState, importState, serializeState, setEngagement, setItemNote, setItemStatus } = await stateModule;
  let state = setEngagement(createState(), { name: 'Portal review', targetUrl: 'https://app.example.com', started_at: NOW }, NOW);
  state = setItemStatus(state, 'WAPT-AUTHZ-001', 'potential_finding', NOW);
  state = setItemNote(state, 'WAPT-AUTHZ-001', 'Needs second-account confirmation.', NOW);
  assert.deepEqual(importState(serializeState(state)), state);
});

test('strict import rejects invalid versions, invalid JSON, and oversized input', async () => {
  const { importState } = await stateModule;
  assert.throws(() => importState('{bad'), /not valid JSON/);
  assert.throws(() => importState('{"schema_version":3}'), /schema_version 2/);
  assert.throws(() => importState(' '.repeat(1_000_001)), /1 MB/);
});

test('normalization removes impossible retest flags and unknown item keys', async () => {
  const { normalizeState } = await stateModule;
  const state = normalizeState({
    schema_version: 1,
    statuses: { 'WAPT-AUTHZ-001': 'passed', '__proto__': 'confirmed_finding' },
    retests: { 'WAPT-AUTHZ-001': true },
    notes: { invalid: 'discard me' }
  });
  assert.deepEqual(state.retests, {});
  assert.deepEqual(state.notes, {});
});

test('evidence packs require a confirmed finding, normalize fields, and enforce limits', async () => {
  const { createState, setItemStatus, addFinding, updateFinding, removeFinding, setRetestVerdict, normalizeState, MAX_FINDINGS } = await stateModule;
  let state = setItemStatus(createState(), 'WAPT-AUTHZ-003', 'confirmed_finding', NOW);
  assert.throws(() => addFinding(createState(), { item_id: 'WAPT-AUTHZ-003' }), /Confirmed Finding/);
  assert.throws(() => addFinding(state, { item_id: 'not-an-item' }), /Invalid checklist item ID/);
  state = addFinding(state, {
    item_id: 'WAPT-AUTHZ-003', title: 'Cross-account object read', severity: 'critical',
    endpoint: 'GET /api/objects/1001', method: 'GET', parameter: 'id', auth_context: 'account A',
    baseline_request: 'GET /api/objects/1000', test_request: 'GET /api/objects/1001',
    observed_behavior: 'Response body contains account B object.', exploitability: 'proven',
    reportable: true, cleanup_performed: 'Synthetic records deleted.', root_cause: 'No per-object check.'
  }, NOW);
  const pack = state.findings[0];
  assert.match(pack.id, /^find-/);
  assert.equal(pack.severity, 'critical');
  assert.equal(pack.exploitability, 'proven');
  assert.equal(pack.retest_verdict, 'pending');
  assert.equal(pack.method, 'GET');

  state = updateFinding(state, pack.id, { severity: 'high', title: 'X'.repeat(500) }, NOW);
  assert.equal(state.findings[0].severity, 'high');
  assert.equal(state.findings[0].title.length, 120);

  state = setRetestVerdict(state, pack.id, 'partial', 'Adjacent bulk endpoint still reproduces.', NOW);
  assert.equal(state.findings[0].retest_verdict, 'partial');
  assert.equal(state.findings[0].retest_note, 'Adjacent bulk endpoint still reproduces.');
  assert.throws(() => setRetestVerdict(state, pack.id, 'maybe'), /Invalid retest verdict/);
  assert.throws(() => setRetestVerdict(state, 'find-missing', 'pass', ''), /Unknown evidence pack/);
  assert.throws(() => updateFinding(state, 'find-missing', { title: 'x' }), /Unknown evidence pack/);

  state = removeFinding(state, pack.id, NOW);
  assert.equal(state.findings.length, 0);
  assert.throws(() => removeFinding(state, pack.id), /Unknown evidence pack/);

  const oversize = normalizeState({ schema_version: 2, findings: Array.from({ length: MAX_FINDINGS + 5 }, (_, index) => ({ id: `find-000${index}`, item_id: 'WAPT-AUTHZ-001', severity: 'high' })) });
  assert.equal(oversize.findings.length, MAX_FINDINGS);
  const bad = normalizeState({ schema_version: 2, findings: [{ id: 'bad', item_id: 'WAPT-AUTHZ-001' }, { id: 'find-dupp', item_id: 'WAPT-AUTHZ-001' }, { id: 'find-dupp', item_id: 'WAPT-AUTHZ-001' }] });
  assert.equal(bad.findings.length, 1);
});
