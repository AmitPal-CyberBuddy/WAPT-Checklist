'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const reportabilityModule = import('../js/engine/reportability.js');

test('classifier moves from observation to reportable only on recorded evidence', async () => {
  const { classifyReportability, REPORTABILITY_STAGES } = await reportabilityModule;
  assert.equal(classifyReportability({}).stage, 'observation');
  assert.equal(classifyReportability({ test_request: 'GET /x', observed_behavior: '' }).stage, 'observation');
  assert.equal(classifyReportability({ test_request: 'GET /x', observed_behavior: 'changed' }).stage, 'weakness');
  assert.equal(classifyReportability({ test_request: 'GET /x', observed_behavior: 'changed', exploitability: 'not_demonstrated' }).stage, 'weakness');
  assert.equal(classifyReportability({ test_request: 'GET /x', observed_behavior: 'changed', exploitability: 'likely' }).stage, 'demonstrated');
  assert.equal(classifyReportability({ test_request: 'GET /x', observed_behavior: 'changed', exploitability: 'proven', reportable: true }).stage, 'reportable');
  assert.equal(classifyReportability({ test_request: 'GET /x', observed_behavior: 'changed', exploitability: 'not_demonstrated', reportable: true }).stage, 'weakness');
  assert.deepEqual([...REPORTABILITY_STAGES], ['observation', 'weakness', 'demonstrated', 'reportable']);
});

test('classifier surfaces the item do-not-report boundary before finalizing', async () => {
  const { classifyReportability } = await reportabilityModule;
  const item = { id: 'WAPT-HTTP-015', do_not_report: ['Do not report ACAO reflection by itself; demonstrate readable sensitive data.'] };
  const result = classifyReportability({ test_request: 'GET /x', observed_behavior: 'changed', exploitability: 'proven', reportable: true }, { item });
  assert.equal(result.stage, 'reportable');
  assert.ok(result.reasons.some((reason) => /reporting boundary/.test(reason)));
  assert.equal(result.reportable, true);
});

test('retest guidance distinguishes pass, partial, and fail', async () => {
  const { RETEST_GUIDANCE } = await reportabilityModule;
  assert.match(RETEST_GUIDANCE.pass, /no longer reproduces/);
  assert.match(RETEST_GUIDANCE.partial, /adjacent variant still reproduces/);
  assert.match(RETEST_GUIDANCE.fail, /still reproduces/);
});
