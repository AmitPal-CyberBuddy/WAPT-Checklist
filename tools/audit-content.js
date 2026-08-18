#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { CATEGORIES, validatePhase7, validateFamilies } = require('./validate.js');
const { offlineCheck } = require('./check-references.js');

const ROOT = path.resolve(__dirname, '..');
const RISKY_CATEGORIES = new Set(['request-smuggling', 'race-conditions']);
const RISKY_TAGS = new Set([
  'ssrf', 'xxe', 'external-entity', 'external-dtd', 'command-injection', 'deserialization',
  'redos', 'decompression-bomb', 'pixel-flood', 'zip-slip', 'remote-file-inclusion',
  'web-cache-poisoning', 'pause-based', 'client-side-desync'
]);
const IMPERATIVE = new Set([
  'accept','allow','allowlist','apply','assess','authorize','avoid','bind','block','bound','build',
  'catalog','classify','clear','confirm','constrain','consume','control','coordinate','create','decode',
  'define','deploy','derive','detect','disable','discover','document','encode','enforce','ensure','equalize',
  'establish','evaluate','exclude','expire','filter','generate','handle','identify','ignore','inspect','inventory',
  'isolate','keep','limit','locate','log','maintain','map','match','minimize','normalize','offer','partition',
  'preserve','prevent','protect','recalculate','recheck','record','recover','redirect','reject','remove','require',
  'resolve','resist','restrict','return','review','rotate','sanitize','scope','send','serve','set','store','trace',
  'account','align','authenticate','canonicalize','choose','compare','configure','correlate','count','demonstrate',
  'deny','distinguish','do','enumerate','escape','extract','fail','fingerprint','include','invalidate','issue',
  'let','make','neutralize','notify','propagate','rate','reauthorize','reconcile','retest','revalidate','terminate',
  'test','transmit','trust','treat','use','validate','verify'
]);
const NEAR_DUPLICATE_ALLOWLIST = new Set(['WAPT-SMUG-003|WAPT-SMUG-004']);

function readProduction() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'checklist', 'manifest.json'), 'utf8'));
  return manifest.categories.filter(({ count }) => count > 0).flatMap((category) => {
    const file = path.join(ROOT, 'checklist', category.file);
    return JSON.parse(fs.readFileSync(file, 'utf8')).items;
  });
}

function words(value) {
  return new Set(String(value).toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter((word) => word.length > 2 && !['the','and','for','with','from','into','through','using','only'].includes(word)));
}

function jaccard(left, right) {
  const a = words(left); const b = words(right);
  const intersection = [...a].filter((word) => b.has(word)).length;
  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
}

function audit(items) {
  const errors = [];
  const warnings = [];
  const metrics = {
    items: items.length,
    categories: new Set(items.map(({ category }) => category)).size,
    manual: items.filter(({ mode }) => mode === 'manual').length,
    automated: items.filter(({ mode }) => mode === 'automated').length,
    safetyNotes: items.filter(({ safety }) => Boolean(safety)).length,
    variants: items.reduce((sum, { variants }) => sum + variants.length, 0),
    references: items.reduce((sum, { references }) => sum + references.length, 0),
    uniqueReferences: new Set(items.flatMap(({ references }) => references.map(({ url }) => url))).size,
    relatedLinks: items.reduce((sum, { related }) => sum + related.length, 0),
    chainMemberships: items.reduce((sum, { attack_chains }) => sum + attack_chains.length, 0),
    doNotReport: items.filter(({ do_not_report }) => do_not_report?.length).length,
    retestGuidance: items.filter(({ retest_guidance }) => Boolean(retest_guidance)).length
  };
  const byId = new Map(items.map((item) => [item.id, item]));
  const titles = new Map(); const objectives = new Map();
  const sharedBoundaries = new Map();

  for (const item of items) {
    const at = item.id;
    const titleKey = item.title.toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, ' ').trim();
    const objectiveKey = item.objective.toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, ' ').trim();
    if (titles.has(titleKey)) errors.push(`${at}: duplicate title with ${titles.get(titleKey)}`); else titles.set(titleKey, at);
    if (objectives.has(objectiveKey)) errors.push(`${at}: duplicate objective with ${objectives.get(objectiveKey)}`); else objectives.set(objectiveKey, at);
    const first = titleKey.split(' ')[0];
    if (!IMPERATIVE.has(first)) warnings.push(`${at}: title may not begin with an imperative verb (${first})`);
    if (item.false_positives.length < 2) errors.push(`${at}: fewer than two false-positive explanations`);
    if (item.steps.length < 4) errors.push(`${at}: fewer than four controlled steps`);
    if (item.evidence.length < 3) errors.push(`${at}: incomplete evidence checklist`);
    if (!item.remediation || item.remediation.length < 40) errors.push(`${at}: missing root-cause remediation`);
    if (/\b(blacklist|whitelist)\b/i.test(JSON.stringify(item))) errors.push(`${at}: outdated allow/deny-list terminology`);
    if (/\b(TODO|TBD|lorem ipsum|fixme)\b/i.test(JSON.stringify(item))) errors.push(`${at}: authoring placeholder remains`);
    if (/https?:\/\/(?![^\s"']*(?:example\.(?:com|test)|owasp\.org|portswigger\.net|rfc-editor\.org|w3\.org|whatwg\.org|github\.com|oasis-open\.org|amazon\.com|google\.com|microsoft\.com|mitre\.org))/i.test(JSON.stringify(item.examples))) errors.push(`${at}: example may contain a non-reserved/non-authoritative URL`);
    if (RISKY_CATEGORIES.has(item.category) && !item.safety) errors.push(`${at}: risky category requires safety`);
    if (item.tags.some((tag) => RISKY_TAGS.has(tag)) && !item.safety) errors.push(`${at}: risky technique requires safety`);
    if (item.category === 'security-headers' && !/scanner output|missing|absence/i.test(item.validation + item.false_positives.join(' '))) errors.push(`${at}: header test lacks missing-header false-positive guard`);
    if (['X-XSS-Protection','HPKP','Expect-CT'].some((term) => item.title.includes(term)) && !item.tags.includes('obsolete')) errors.push(`${at}: obsolete header lacks obsolete tag`);
    if (item.safety && /(?:rm -rf|fork bomb|credential dump|web shell)/i.test(item.safety)) errors.push(`${at}: unsafe destructive phrase in safety guidance`);
    if (item.retest_guidance && item.retest_guidance.length < 40) errors.push(`${at}: retest guidance must describe concrete re-verification steps`);
    if (item.do_not_report) {
      for (const entry of item.do_not_report) {
        if (entry.length < 25) errors.push(`${at}: do-not-report entries must be specific, not generic`);
        const key = entry.toLocaleLowerCase('en-US').replace(/\s+/g, ' ').trim();
        if (sharedBoundaries.has(key)) errors.push(`${at}: do-not-report entry duplicated verbatim with ${sharedBoundaries.get(key)}`);
        else sharedBoundaries.set(key, at);
      }
    }
    for (const id of item.related) if (!byId.has(id)) errors.push(`${at}: unresolved related item ${id}`);
  }

  const reportabilityBoundaries = new Set([
    'WAPT-HTTP-001', 'WAPT-HTTP-015', 'WAPT-HTTP-016', 'WAPT-HTTP-017', 'WAPT-HTTP-018', 'WAPT-HTTP-019',
    'WAPT-API-031', 'WAPT-INFO-004', 'WAPT-INFO-009', 'WAPT-INFO-010', 'WAPT-INFO-015',
    'WAPT-RECON-003', 'WAPT-JWT-018', 'WAPT-SESS-019', 'WAPT-CLIENT-026'
  ]);
  for (const item of items) {
    const needsBoundary = reportabilityBoundaries.has(item.id) || item.category === 'security-headers' || item.category === 'rate-limiting';
    if (needsBoundary && !item.do_not_report?.length) {
      errors.push(`${item.id}: reportability-prone test requires an explicit do-not-report boundary`);
    }
  }

  const severitySpread = new Map();
  for (const item of items) {
    const severities = severitySpread.get(item.category) || new Set();
    severities.add(item.severity);
    severitySpread.set(item.category, severities);
  }
  for (const [category, severities] of severitySpread) {
    if (severities.size < 2) errors.push(`${category}: category contains fewer than two severity levels (possible padding or misrated content)`);
  }

  const families = validateFamilies(items.map((item) => ({ item, sample: false })));
  errors.push(...families.errors.map((error) => `families: ${error}`));
  metrics.families = families.familyCount;
  metrics.familyCategories = new Set(items.map(({ category }) => category).filter((category) => families.familyMap.size && [...families.familyMap.values()].length)).size;

  const phase7 = validatePhase7(new Set(items.map(({ id }) => id)));
  errors.push(...phase7.errors.map((error) => `phase7: ${error}`));
  metrics.attackChains = phase7.chainIds.size;
  metrics.payloadReferences = phase7.payloadCount;
  metrics.burpWorkflows = 12;
  const payloadManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'payloads', 'manifest.json'), 'utf8'));
  const payloads = payloadManifest.categories.flatMap(({ file }) => JSON.parse(fs.readFileSync(path.join(ROOT, 'payloads', file), 'utf8')).items);
  const forbiddenPayload = /(?:rm\s+-rf|fork\s*bomb|169\.254\.169\.254|\bcurl\s|\bwget\s|<script\b|onerror\s*=|Runtime\.getRuntime|__import__\s*\(|\$\{jndi:)/i;
  for (const payload of payloads) {
    if (forbiddenPayload.test(payload.payload)) errors.push(`${payload.id}: payload library contains forbidden destructive/sensitive-ready syntax`);
  }

  for (let left = 0; left < items.length; left += 1) {
    for (let right = left + 1; right < items.length; right += 1) {
      const a = items[left]; const b = items[right];
      const titleScore = jaccard(a.title, b.title);
      const objectiveScore = jaccard(a.objective, b.objective);
      const pair = `${a.id}|${b.id}`;
      if (titleScore >= 0.82 && objectiveScore >= 0.72 && !NEAR_DUPLICATE_ALLOWLIST.has(pair)) warnings.push(`${a.id} / ${b.id}: possible semantic duplicate (title ${titleScore.toFixed(2)}, objective ${objectiveScore.toFixed(2)})`);
    }
  }

  const referenceErrors = offlineCheck(items).errors;
  errors.push(...referenceErrors.map((error) => `reference: ${error}`));
  const categoryCounts = Object.fromEntries(Object.keys(CATEGORIES).map((category) => [category, items.filter((item) => item.category === category).length]));
  return { errors, warnings, metrics: { ...metrics, categoryCounts } };
}

function main() {
  const result = audit(readProduction());
  const reportPath = process.argv.find((arg) => arg.startsWith('--report='))?.slice('--report='.length);
  if (reportPath) fs.writeFileSync(path.resolve(ROOT, reportPath), JSON.stringify(result, null, 2) + '\n');
  if (result.errors.length) {
    console.error(`Content audit failed with ${result.errors.length} error(s):`);
    result.errors.forEach((error) => console.error(`  - ${error}`));
    process.exitCode = 1;
    return;
  }
  console.log(`Content audit passed for ${result.metrics.items} items across ${result.metrics.categories} categories.`);
  console.log(`Manual ${result.metrics.manual}; automated ${result.metrics.automated}; safety notes ${result.metrics.safetyNotes}; variants ${result.metrics.variants}; references ${result.metrics.references}.`);
  if (result.warnings.length) {
    console.log(`${result.warnings.length} review warning(s):`);
    result.warnings.forEach((warning) => console.log(`  - ${warning}`));
  } else console.log('No semantic duplicate or imperative-title warnings.');
}

if (require.main === module) main();
module.exports = { readProduction, audit, jaccard };
