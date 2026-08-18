import { EXPLOITABILITY_LEVELS } from './state.js';

// Finding-decision workflow: Observation → Weakness → Exploitability demonstrated → Reportable.
// The classifier is a workflow gate over recorded evidence, not an oracle: it reasons about
// what the tester recorded, and it surfaces the item's do-not-report boundary for final review.
export const REPORTABILITY_STAGES = Object.freeze(['observation', 'weakness', 'demonstrated', 'reportable']);

export const STAGE_LABELS = Object.freeze({
  observation: 'Observation',
  weakness: 'Security weakness',
  demonstrated: 'Exploitability demonstrated',
  reportable: 'Reportable finding'
});

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function classifyReportability(finding = {}, options = {}) {
  const reasons = [];
  const item = options.item || null;

  const hasEvidence = hasText(finding.test_request) && hasText(finding.observed_behavior);
  const hasBaseline = hasText(finding.baseline_request);
  if (!hasEvidence) {
    reasons.push('Record the test request and the observed behavior before classifying the observation.');
    return Object.freeze({ stage: 'observation', reportable: false, reasons: Object.freeze(reasons) });
  }

  let stage = 'weakness';
  if (!hasBaseline) reasons.push('Attach the baseline request so the change in behavior is reproducible.');
  reasons.push('The recorded behavior differs from the documented secure behavior and is attributed to the manipulation.');

  const demonstrated = finding.exploitability === 'proven' || finding.exploitability === 'likely';
  if (demonstrated) {
    stage = 'demonstrated';
    reasons.push(`Exploitability is recorded as ${finding.exploitability}; attach the validation evidence that supports this level.`);
  } else {
    reasons.push('Exploitability is not demonstrated: confirm the validation evidence or lower the finding to an observation.');
  }

  if (demonstrated && finding.reportable === true) {
    stage = 'reportable';
    reasons.push('The finding is marked reportable; attach redacted evidence and confirm impact before delivery.');
  } else if (finding.reportable === true) {
    reasons.push('Reportable is selected but exploitability is not demonstrated; demonstrate it first.');
  }

  if (stage === 'reportable' && item?.do_not_report?.length) {
    reasons.push('Review the item reporting boundary before finalizing: do not report without the demonstrated exposure described there.');
  }

  return Object.freeze({ stage, reportable: stage === 'reportable', reasons: Object.freeze(reasons) });
}

export const RETEST_GUIDANCE = Object.freeze({
  pass: 'Original evidence no longer reproduces; spot-check adjacent variants and confirm root-cause remediation before closing.',
  partial: 'The original evidence is fixed but an adjacent variant still reproduces; keep the finding open and extend remediation.',
  fail: 'The original evidence still reproduces; escalate with the new attempt details and confirm the fix reached every hop and cache.'
});

export function suggestedRetestTargets(item = {}) {
  const targets = [];
  if (item.related?.length) {
    targets.push(`Related methodology: ${item.related.join(', ')}`);
  }
  targets.push('Alternate identifier and nested object paths');
  targets.push('Bulk, export, and batch equivalents of the endpoint');
  targets.push('Alternate API versions, mobile endpoints, and GraphQL/WebSocket equivalents where present');
  targets.push('HTTP method and content-type variations of the same operation');
  return Object.freeze(targets);
}

export { EXPLOITABILITY_LEVELS };
