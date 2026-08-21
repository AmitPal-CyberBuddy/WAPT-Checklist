import { normalizeScopeAnswers, deriveContext } from './context.js?v=1.0.0-r22';
import { applicableItems } from './applicable.js?v=1.0.0-r22';

// Scope snapshots and diff: "what changed since we started" is the client-facing
// story behind a plan that grew. Pure engine — the workspace supplies items for
// the category impact computation.

export const MAX_SCOPE_SNAPSHOTS = 10;
const SNAPSHOT_ID = /^snap-[a-z0-9-]{4,64}$/;
const SNAPSHOT_LABEL_MAX = 60;

export const ANSWER_LABELS = Object.freeze({
  mode: 'Assessment mode', creds: 'Test-account access', app_type: 'Delivery',
  has_login: 'Authentication present', registration: 'Account creation', roles: 'Role model',
  role_types: 'Role tiers', auth_mechanism: 'Authentication mechanisms', identity_features: 'Identity capabilities',
  api_style: 'API styles', api_docs: 'API definition', source_access: 'Implementation access',
  backend: 'Backend stacks', database: 'Data layers', cloud: 'Hosting',
  features: 'Features in scope', intermediary: 'Intermediaries', outbound_fetch: 'Outbound fetching',
  async_jobs: 'Background jobs'
});

function display(value) {
  const list = Array.isArray(value) ? value : [value];
  const meaningful = list.filter((entry) => entry !== 'unknown' && entry !== 'none' || list.length === 1);
  return (meaningful.length ? meaningful : list).map((entry) => String(entry).replaceAll('_', ' ')).join(', ');
}

export function snapshotScope(answers, label, now = new Date().toISOString()) {
  const cleanLabel = String(label || '').slice(0, SNAPSHOT_LABEL_MAX).trim() || `Checkpoint ${now.slice(0, 10)}`;
  const id = `snap-${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`.slice(0, 64);
  return Object.freeze({ id, label: cleanLabel, taken_at: now, answers: normalizeScopeAnswers(answers) });
}

export function cleanScopeSnapshots(value) {
  const output = [];
  if (!Array.isArray(value)) return output;
  for (const entry of value.slice(0, MAX_SCOPE_SNAPSHOTS)) {
    if (!entry || typeof entry !== 'object' || !SNAPSHOT_ID.test(entry.id || '')) continue;
    if (output.some(({ id }) => id === entry.id)) continue;
    output.push({
      id: entry.id,
      label: String(entry.label || '').slice(0, SNAPSHOT_LABEL_MAX).trim() || 'Checkpoint',
      taken_at: typeof entry.taken_at === 'string' ? entry.taken_at : '',
      answers: normalizeScopeAnswers(entry.answers || {})
    });
  }
  return output.slice(-MAX_SCOPE_SNAPSHOTS);
}

// Per-answer changes between two checkpoints. 'unknown' counts as absent so the
// diff reads like scope decisions, not schema noise.
export function diffAnswers(before = {}, after = {}) {
  const keys = [...new Set([...Object.keys(ANSWER_LABELS), ...Object.keys(before), ...Object.keys(after)])];
  const changes = [];
  for (const key of keys) {
    if (!(key in ANSWER_LABELS)) continue;
    const had = key in before && before[key] !== undefined;
    const has = key in after && after[key] !== undefined;
    const wasUnknown = !had || (Array.isArray(before[key]) ? before[key].includes('unknown') : before[key] === 'unknown');
    const isUnknown = !has || (Array.isArray(after[key]) ? after[key].includes('unknown') : after[key] === 'unknown');
    const same = JSON.stringify(before[key]) === JSON.stringify(after[key]);
    if (same) continue;
    const entry = { key, label: ANSWER_LABELS[key] };
    if (isUnknown && !wasUnknown) changes.push({ ...entry, direction: 'removed', from: display(before[key]), to: 'not confirmed' });
    else if (!isUnknown && wasUnknown) changes.push({ ...entry, direction: 'added', from: 'not confirmed', to: display(after[key]) });
    else if (!isUnknown && !wasUnknown) changes.push({ ...entry, direction: 'changed', from: display(before[key]), to: display(after[key]) });
    else if (isUnknown && wasUnknown) changes.push({ ...entry, direction: 'changed', from: display(before[key]), to: display(after[key]) });
  }
  return changes;
}

// Which checklist categories gain or lose applicable tests between two scopes.
// Items come from the workspace (catalog already loaded); the comparison is the
// same applicability engine the plan uses, so the diff cannot disagree with the
// plan the tester sees.
export function categoryImpact(items, beforeAnswers, afterAnswers, targetUrl = '') {
  const before = deriveContext(normalizeScopeAnswers(beforeAnswers), targetUrl);
  const after = deriveContext(normalizeScopeAnswers(afterAnswers), targetUrl);
  const countBy = (context) => {
    const counts = new Map();
    for (const item of applicableItems(items, context)) {
      counts.set(item.category, (counts.get(item.category) || 0) + 1);
    }
    return counts;
  };
  const beforeCounts = countBy(before);
  const afterCounts = countBy(after);
  const impact = [];
  for (const category of new Set([...beforeCounts.keys(), ...afterCounts.keys()])) {
    const a = beforeCounts.get(category) || 0;
    const b = afterCounts.get(category) || 0;
    if (a === b) continue;
    impact.push({ category, before: a, after: b, direction: b > a ? 'on' : 'off' });
  }
  impact.sort((left, right) => right.after - right.before - (left.after - left.before));
  return impact;
}

