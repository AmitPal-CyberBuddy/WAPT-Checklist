'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const stateModule = import('../js/engine/state.js');
const NOW = '2026-08-17T10:00:00.000Z';

test('new state has the complete v3 local-only shape', async () => {
  const { STATE_KEY, STATE_SCHEMA_VERSION, createState } = await stateModule;
  const state = createState();
  assert.equal(STATE_KEY, 'wapt.state.v1');
  assert.deepEqual(Object.keys(state), ['schema_version', 'engagement', 'answers', 'statuses', 'notes', 'overrides', 'retests', 'variants', 'position', 'findings', 'updated_at']);
  assert.equal(state.schema_version, 3);
  assert.equal(STATE_SCHEMA_VERSION, 3);
  assert.deepEqual(state.variants, {});
  assert.deepEqual(state.position, { view: '', family: '', category: '', item: '', updated_at: null });
  assert.deepEqual(state.findings, []);
  assert.equal(state.answers.mode, 'unknown');
  assert.deepEqual(state.answers.features, ['unknown']);
});

test('legacy schema v1 and v2 states migrate transparently to v3', async () => {
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
  assert.equal(migrated.schema_version, 3);
  assert.deepEqual(migrated.variants, {});
  assert.deepEqual(migrated.findings, []);
  assert.equal(migrated.engagement.name, 'Legacy portal');
  assert.equal(migrated.statuses['WAPT-AUTHZ-001'], 'passed');
  assert.equal(importState(JSON.stringify(legacy)).engagement.name, 'Legacy portal');
  assert.equal(JSON.parse(serializeState(migrated)).schema_version, 3);
  const v2 = normalizeState({ ...legacy, schema_version: 2, findings: [] });
  assert.equal(v2.schema_version, 3);
  assert.equal(v2.statuses['WAPT-AUTHZ-001'], 'passed');
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
  assert.throws(() => importState('{"schema_version":9}'), /schema_version 3/);
  assert.throws(() => importState(' '.repeat(5_000_001)), /5 MB/);
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

  const oversize = normalizeState({ schema_version: 3, findings: Array.from({ length: MAX_FINDINGS + 5 }, (_, index) => ({ id: `find-000${index}`, item_id: 'WAPT-AUTHZ-001', severity: 'high' })) });
  assert.equal(oversize.findings.length, MAX_FINDINGS);
  const bad = normalizeState({ schema_version: 3, findings: [{ id: 'bad', item_id: 'WAPT-AUTHZ-001' }, { id: 'find-dupp', item_id: 'WAPT-AUTHZ-001' }, { id: 'find-dupp', item_id: 'WAPT-AUTHZ-001' }] });
  assert.equal(bad.findings.length, 1);
});

test("don't-miss variant coverage and engagement position persist as separate state", async () => {
  const { createState, setVariantCovered, setPosition, normalizeState, serializeState } = await stateModule;
  const key = 'authorization-object-level#1a2b3c';
  const covered = setVariantCovered(createState(), key, true, NOW);
  assert.deepEqual(covered.variants, { [key]: true });
  assert.deepEqual(setVariantCovered(covered, key, false, NOW).variants, {});
  assert.throws(() => setVariantCovered(createState(), 'not a key', true, NOW), /variant key/);
  const positioned = setPosition(covered, { view: 'family', family: 'authorization-object-level' }, NOW);
  assert.equal(positioned.position.view, 'family');
  assert.equal(positioned.position.family, 'authorization-object-level');
  const round = normalizeState(JSON.parse(serializeState(positioned)));
  assert.deepEqual(round.variants, { [key]: true });
  assert.equal(round.position.family, 'authorization-object-level');
  // Hostile values are dropped rather than trusted.
  const dirty = normalizeState({ schema_version: 3, variants: { 'bad key': true, [key]: 'yes' }, position: { view: 'evil', family: '../etc' } });
  assert.deepEqual(dirty.variants, {});
  assert.equal(dirty.position.view, '');
  assert.equal(dirty.position.family, 'etc');
});

test('blocked is a first-class coverage state distinct from tested and N/A', async () => {
  const { createState, setItemStatus, ITEM_STATUSES } = await stateModule;
  assert.ok(ITEM_STATUSES.includes('blocked'));
  const blocked = setItemStatus(createState(), 'WAPT-AUTHZ-003', 'blocked', NOW);
  assert.equal(blocked.statuses['WAPT-AUTHZ-003'], 'blocked');
  assert.throws(() => setItemStatus(createState(), 'WAPT-AUTHZ-003', 'skipped', NOW), /Invalid item status/);
});
