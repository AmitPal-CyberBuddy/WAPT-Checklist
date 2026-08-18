'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const stateModule = import('../js/engine/state.js');
const NOW = '2026-08-17T10:00:00.000Z';

test('new state has the complete v1 local-only shape', async () => {
  const { STATE_KEY, createState } = await stateModule;
  const state = createState();
  assert.equal(STATE_KEY, 'wapt.state.v1');
  assert.deepEqual(Object.keys(state), ['schema_version', 'engagement', 'answers', 'statuses', 'notes', 'overrides', 'retests', 'updated_at']);
  assert.equal(state.schema_version, 1);
  assert.equal(state.answers.mode, 'unknown');
  assert.deepEqual(state.answers.features, ['unknown']);
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
  assert.throws(() => importState('{"schema_version":2}'), /schema_version 1/);
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
