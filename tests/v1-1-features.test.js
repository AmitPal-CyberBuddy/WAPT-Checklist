'use strict';

// v1.1 features: named role ladder, custom checks in the plan pipeline, and
// the self-contained HTML report.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const surfaces = import(pathToFileURL(path.resolve(__dirname, '../js/engine/surfaces.js')).href);
const exportModule = import(pathToFileURL(path.resolve(__dirname, '../js/ui/export.js')).href);
const stateModule = import(pathToFileURL(path.resolve(__dirname, '../js/engine/state.js')).href);

test('named role model renders as a privilege-ordered ladder', async () => {
  const { roleModelLadder } = await surfaces;
  assert.deepEqual(
    roleModelLadder([{ name: 'Analyst', tier: 'standard' }, { name: 'Root Admin', tier: 'admin' }, { name: 'Manager', tier: 'privileged' }]),
    ['Root Admin', 'Manager', 'Analyst']
  );
  assert.equal(roleModelLadder([]), null);
  assert.equal(roleModelLadder([{ name: 'X', tier: 'nope' }]), null);
});

test('custom surface explains itself and stays out of the static hidden set', async () => {
  const { surfaceRationale, SURFACES, isHiddenSurface, CATEGORY_SURFACE } = await surfaces;
  assert.ok(SURFACES.some(({ id }) => id === 'custom'));
  assert.equal(CATEGORY_SURFACE.custom, 'custom');
  assert.ok(surfaceRationale('custom', {}).some((line) => line.includes('target-specific')));
  assert.equal(isHiddenSurface('custom', { app_type: 'static', has_login: 'no' }), false);
});

test('HTML report is self-contained and carries ladder, findings, and custom checks', async () => {
  const { composeReportHtml } = await exportModule;
  const { createState, setEngagement, setItemStatus, setCustomChecks } = await stateModule;
  let state = createState();
  state = setEngagement(state, { name: 'HTML <injection> check', targetUrl: 'https://x.test', role_model: [
    { name: 'Root Admin', tier: 'admin' }, { name: 'Analyst', tier: 'standard' }
  ] });
  state = setItemStatus(state, 'WAPT-JWT-001', 'confirmed_finding');
  state = setCustomChecks(state, [{ id: 'WAPT-CUSTOM-001', title: 'Export caps', surface: 'authz', severity: 'high', objective: 'x' }]);
  const items = [
    { id: 'WAPT-JWT-001', title: 'JWT <signature> bypass', category: 'jwt', severity: 'high' },
    { id: 'WAPT-CUSTOM-001', title: 'Export caps', category: 'custom', severity: 'high' }
  ];
  const html = composeReportHtml(items, state, { jwt: 'JWT' });
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.includes('<style>'));
  assert.ok(html.includes('Root Admin'), 'ladder present');
  assert.ok(html.includes('WAPT-CUSTOM-001'), 'custom check present');
  assert.ok(html.includes('JWT &lt;signature&gt; bypass'), 'titles escaped');
  assert.ok(!html.includes('<script'), 'no scripts');
  assert.ok(!/src="https?:/.test(html), 'no external resources');
  assert.ok(html.includes('review and redact', ), 'redaction reminder');
});
