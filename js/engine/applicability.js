import { contextEntry, contextHas, contextIsUnknown } from './context.js';

export const APPLICABILITY = Object.freeze({
  ACTIVE: 'active',
  CONFIRM: 'confirm',
  NA_CONTEXT: 'na_context'
});

const STATIC_NA_CATEGORIES = new Set([
  'authentication', 'session-management', 'authorization', 'csrf', 'jwt',
  'oauth-sso-saml', 'business-logic', 'race-conditions'
]);

const CONTEXTUAL_CATEGORY_GATES = Object.freeze({
  jwt: { key: 'auth_mechanism', values: ['jwt', 'mixed'], code: 'jwt_not_selected' },
  'oauth-sso-saml': { key: 'auth_mechanism', values: ['oauth', 'saml', 'mixed'], code: 'federation_not_selected' },
  graphql: { key: 'api_style', values: ['graphql'], code: 'graphql_not_selected' },
  websocket: { key: 'api_style', values: ['websocket'], code: 'websocket_not_selected' }
});

function result(kind, details = {}) {
  return Object.freeze({ kind, ...details });
}

function compare(context, key, expected) {
  const entry = contextEntry(context, key);
  if (contextIsUnknown(context, key)) return result('unknown', { key, expected, actual: entry.value });
  if (contextHas(context, key, expected)) {
    return result(entry.confidence === 'url_hint' ? 'suggested' : 'match', { key, expected, actual: entry.value });
  }
  return result('mismatch', { key, expected, actual: entry.value });
}

function parseToken(token) {
  const separator = token.indexOf(':');
  return { key: token.slice(0, separator), expected: token.slice(separator + 1).split('|').map((value) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  }) };
}

export function evaluateConditionMap(conditions = {}, context) {
  const checks = Object.entries(conditions).map(([key, expected]) => compare(context, key, expected));
  return Object.freeze({
    matches: checks.length > 0 && checks.every(({ kind }) => kind === 'match' || kind === 'suggested'),
    certain: checks.length > 0 && checks.every(({ kind }) => kind === 'match'),
    unknown: checks.some(({ kind }) => kind === 'unknown' || kind === 'suggested'),
    checks
  });
}

function categoryDerivation(item, context) {
  if (contextHas(context, 'app_type', ['static']) && STATIC_NA_CATEGORIES.has(item.category)) {
    return { state: APPLICABILITY.NA_CONTEXT, reason: { code: 'static_dynamic_surface', attribute: 'app_type' } };
  }

  const gate = CONTEXTUAL_CATEGORY_GATES[item.category];
  if (!gate) return null;
  if (contextIsUnknown(context, gate.key)) {
    return { state: APPLICABILITY.CONFIRM, reason: { code: `${gate.code}_unknown`, attribute: gate.key } };
  }
  if (!contextHas(context, gate.key, gate.values)) {
    return { state: APPLICABILITY.NA_CONTEXT, reason: { code: gate.code, attribute: gate.key } };
  }
  return null;
}

function isCredentialRoadmap(check, context) {
  return check.key === 'creds'
    && check.expected.some((value) => value === 'low' || value === 'high')
    && contextHas(context, 'mode', ['black_box'])
    && contextHas(context, 'creds', ['none']);
}

export function evaluateApplicability(item, context) {
  const reasons = [];
  let blocked = false;
  let uncertain = false;

  const derived = categoryDerivation(item, context);
  if (derived?.state === APPLICABILITY.NA_CONTEXT) {
    return Object.freeze({ state: APPLICABILITY.NA_CONTEXT, blocked: false, reasons: Object.freeze([derived.reason]) });
  }
  if (derived?.state === APPLICABILITY.CONFIRM) {
    uncertain = true;
    reasons.push(derived.reason);
  }

  const applies = item.applies || {};

  for (const token of applies.excludes || []) {
    const parsed = parseToken(token);
    const check = compare(context, parsed.key, parsed.expected);
    if (check.kind === 'match') {
      reasons.push({ code: 'excluded_by_context', operator: 'excludes', ...check });
      return Object.freeze({ state: APPLICABILITY.NA_CONTEXT, blocked: false, reasons: Object.freeze(reasons) });
    }
    if (check.kind === 'suggested' || check.kind === 'unknown') {
      uncertain = true;
      reasons.push({ code: check.kind === 'suggested' ? 'hint_may_exclude' : 'unknown_exclusion', operator: 'excludes', ...check });
    }
  }

  for (const token of applies.requires || []) {
    const parsed = parseToken(token);
    const check = compare(context, parsed.key, parsed.expected);
    if (check.kind === 'mismatch') {
      if (isCredentialRoadmap(parsed, context)) {
        blocked = true;
        reasons.push({ code: 'needs_credentials', operator: 'requires', ...check });
        continue;
      }
      reasons.push({ code: 'failed_requirement', operator: 'requires', ...check });
      return Object.freeze({ state: APPLICABILITY.NA_CONTEXT, blocked: false, reasons: Object.freeze(reasons) });
    }
    if (check.kind === 'unknown' || check.kind === 'suggested') {
      uncertain = true;
      reasons.push({ code: check.kind === 'suggested' ? 'hint_requires_confirmation' : 'unknown_requirement', operator: 'requires', ...check });
    }
  }

  if (applies.any_of && Object.keys(applies.any_of).length) {
    const checks = Object.entries(applies.any_of).map(([key, expected]) => compare(context, key, expected));
    const certainMatch = checks.some(({ kind }) => kind === 'match');
    const suggestedMatch = checks.some(({ kind }) => kind === 'suggested');
    const unknownBranch = checks.some(({ kind }) => kind === 'unknown');
    if (!certainMatch && !suggestedMatch && !unknownBranch) {
      reasons.push({ code: 'no_any_of_match', operator: 'any_of', checks });
      return Object.freeze({ state: APPLICABILITY.NA_CONTEXT, blocked: false, reasons: Object.freeze(reasons) });
    }
    if (!certainMatch) {
      uncertain = true;
      reasons.push({ code: suggestedMatch ? 'hint_any_of_confirmation' : 'unknown_any_of', operator: 'any_of', checks });
    }
  }

  return Object.freeze({
    state: uncertain ? APPLICABILITY.CONFIRM : APPLICABILITY.ACTIVE,
    blocked,
    reasons: Object.freeze(reasons)
  });
}

export function selectVariants(item, context) {
  return Object.freeze((item.variants || []).filter((variant) => evaluateConditionMap(variant.when, context).matches));
}

export function isExecutable(applicability) {
  return applicability.state !== APPLICABILITY.NA_CONTEXT && !applicability.blocked;
}
