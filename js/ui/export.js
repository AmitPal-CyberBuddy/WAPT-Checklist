import { serializeState } from '../engine/state.js?v=1.0.0-r7';
import { RETEST_GUIDANCE } from '../engine/reportability.js?v=1.0.0-r7';

export const STATUS_LABELS = Object.freeze({
  not_tested: 'Not tested', in_progress: 'Testing now', passed: 'Tested — not vulnerable',
  potential_finding: 'Potential finding', confirmed_finding: 'Confirmed finding',
  na: 'N/A', blocked: 'Blocked'
});
// Coverage counts only executed checks: N/A, blocked, and in-progress are not "tested".
export const TESTED_STATUSES = Object.freeze(['passed', 'potential_finding', 'confirmed_finding']);

function safe(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function cell(value) {
  return safe(value).replaceAll('|', '\\|').replace(/\r?\n/g, '<br>');
}

function statusOf(item, state) {
  return state.statuses?.[item.id] || 'not_tested';
}

function grouped(items) {
  return Map.groupBy ? Map.groupBy(items, (item) => item.category) : items.reduce((map, item) => {
    const group = map.get(item.category) || [];
    group.push(item);
    map.set(item.category, group);
    return map;
  }, new Map());
}

export function composeChecklistMarkdown(items, state, categoryNames = {}) {
  const lines = [
    `# ${safe(state.engagement?.name || 'WAPT engagement')} — Checklist`, '',
    `- Target: ${safe(state.engagement?.targetUrl || 'Not provided')}`,
    `- Started: ${safe(state.engagement?.started_at || 'Not recorded')}`,
    `- Updated: ${safe(state.updated_at || 'Not recorded')}`, '',
    '> Authorized testing only. Secrets, tokens, credentials, personal data, and tenant identifiers must be redacted.', ''
  ];
  for (const [category, categoryItems] of grouped(items)) {
    lines.push(`## ${safe(categoryNames[category] || category)}`, '');
    for (const item of categoryItems) {
      const status = statusOf(item, state);
      const checked = TESTED_STATUSES.includes(status) ? 'x' : ' ';
      lines.push(`- [${checked}] **${item.id}** ${safe(item.title)} — ${STATUS_LABELS[status]}`);
      if (state.notes?.[item.id]) lines.push(`  - Notes: ${safe(state.notes[item.id]).replace(/\r?\n/g, ' / ')}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function findingItems(items, state) {
  return items.filter((item) => ['potential_finding', 'confirmed_finding'].includes(statusOf(item, state)));
}

export function composeReportMarkdown(items, state, categoryNames = {}) {
  const findings = findingItems(items, state);
  const tested = items.filter((item) => TESTED_STATUSES.includes(statusOf(item, state))).length;
  const confirmed = findings.filter((item) => statusOf(item, state) === 'confirmed_finding').length;
  const lines = [
    `# ${safe(state.engagement?.name || 'WAPT engagement')} — Assessment Report`, '',
    '## Engagement summary', '',
    `- **Target:** ${safe(state.engagement?.targetUrl || 'Not provided')}`,
    `- **Started:** ${safe(state.engagement?.started_at || 'Not recorded')}`,
    `- **Coverage recorded:** ${tested} of ${items.length} tests`,
    `- **Potential findings:** ${findings.length - confirmed}`,
    `- **Confirmed findings:** ${confirmed}`, '',
    '> This client-generated draft contains local tester notes. Review and redact it before distribution.', '',
    '## Findings', '',
    '| ID | Title | Category | Severity | Status | CVSS 3.1 | Notes |',
    '|---|---|---|---|---|---|---|'
  ];
  if (!findings.length) lines.push('| — | No potential or confirmed findings recorded | — | — | — | — | — |');
  for (const item of findings) {
    lines.push(`| ${item.id} | ${cell(item.title)} | ${cell(categoryNames[item.category] || item.category)} | ${item.severity} | ${STATUS_LABELS[statusOf(item, state)]} | Not scored | ${cell(state.notes?.[item.id] || '')} |`);
  }
  lines.push('', '## Evidence packs', '');
  const packs = Array.isArray(state.findings) ? state.findings : [];
  if (!packs.length) lines.push('| — | No structured evidence packs recorded | — | — | — | — | — | — | — |');
  else {
    lines.push('| ID | Item | Title | Severity | Endpoint | Method | Exploitability | Reportable | Retest verdict |');
    lines.push('|---|---|---|---|---|---|---|---|---|');
    for (const pack of packs) {
      lines.push(`| ${pack.id} | ${pack.item_id} | ${cell(pack.title) || '—'} | ${pack.severity} | ${cell(pack.endpoint) || '—'} | ${cell(pack.method) || '—'} | ${pack.exploitability} | ${pack.reportable ? 'Yes' : 'No'} | ${pack.retest_verdict} |`);
      if (pack.observed_behavior) lines.push(`| | | Observed: ${cell(pack.observed_behavior)} | | | | | | |`);
      if (pack.cleanup_performed) lines.push(`| | | Cleanup: ${cell(pack.cleanup_performed)} | | | | | | |`);
    }
  }
  lines.push('', '## Retest matrix', '', '| ID | Finding | Retest requested | Verdict | Residual risk / guidance |', '|---|---|---|---|---|');
  const confirmedItems = findings.filter((item) => statusOf(item, state) === 'confirmed_finding');
  const verdictFor = (itemId) => packs.find(({ item_id: id }) => id === itemId)?.retest_verdict || null;
  if (!confirmedItems.length && !packs.length) lines.push('| — | No confirmed findings recorded | — | — | — |');
  for (const item of confirmedItems) {
    const verdict = verdictFor(item.id);
    const residual = verdict ? RETEST_GUIDANCE[verdict] : 'Reproduce the original evidence, verify root-cause remediation, then test adjacent variants and authorization contexts.';
    lines.push(`| ${item.id} | ${cell(item.title)} | ${state.retests?.[item.id] ? 'Yes' : 'No'} | ${verdict || '—'} | ${residual} |`);
  }
  for (const pack of packs) {
    if (!confirmedItems.some((item) => item.id === pack.item_id)) {
      lines.push(`| ${pack.id} | ${cell(pack.title) || pack.item_id} | — | ${pack.retest_verdict} | ${RETEST_GUIDANCE[pack.retest_verdict] || 'Reproduce the original evidence and re-verify root cause.'} |`);
    }
  }
  lines.push('', '## Reporting quality gate', '',
    '- Do not report informational observations as vulnerabilities.',
    '- Do not report missing headers without meaningful exposure and impact.',
    '- Do not report theoretical attacks without demonstrated exploitability.',
    '- Do not report scanner output without manual confirmation and false-positive analysis.', '',
    '## Methodology coverage', '');
  for (const [category, categoryItems] of grouped(items)) {
    const complete = categoryItems.filter((item) => TESTED_STATUSES.includes(statusOf(item, state))).length;
    const na = categoryItems.filter((item) => statusOf(item, state) === 'na').length;
    const blocked = categoryItems.filter((item) => statusOf(item, state) === 'blocked').length;
    const suffix = [na ? `${na} N/A` : '', blocked ? `${blocked} blocked` : ''].filter(Boolean).join(', ');
    lines.push(`- ${safe(categoryNames[category] || category)}: ${complete}/${categoryItems.length} tested${suffix ? ` (${suffix})` : ''}`);
  }
  return lines.join('\n');
}

export function composeStateJson(state) {
  return serializeState(state);
}

export function downloadText(filename, text, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// CSV escaping that also neutralises spreadsheet formula injection. This project documents
// that attack (WAPT-INJ export family); its own exports must not commit it.
function csvCell(value) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${guarded.replaceAll('"', '""')}"`;
}

const COVERAGE_STATE = Object.freeze({
  not_tested: 'not tested', in_progress: 'testing now', passed: 'tested',
  potential_finding: 'tested', confirmed_finding: 'tested', na: 'N/A', blocked: 'blocked'
});
const FINDING_STATE = Object.freeze({
  potential_finding: 'potential', confirmed_finding: 'confirmed'
});

// Coverage sheet for client trackers and retest matrices: one row per check, with the
// coverage state and the finding verdict kept in separate columns.
export function composeCoverageCsv(items, state, familyIndex, categoryNames = {}) {
  const rows = [[
    'Attack surface', 'Test family', 'Check ID', 'Check', 'Severity',
    'Coverage state', 'Finding', 'Retest required', 'Notes recorded'
  ].map(csvCell).join(',')];
  const ordered = familyIndex?.families?.length
    ? familyIndex.families.flatMap((family) => (family.items || [])
      .map((id) => ({ family, item: items.find((candidate) => candidate.id === id) }))
      .filter(({ item }) => item))
    : items.map((item) => ({ family: null, item }));
  const covered = new Set(ordered.map(({ item }) => item.id));
  for (const item of items) if (!covered.has(item.id)) ordered.push({ family: null, item });
  for (const { family, item } of ordered) {
    const status = statusOf(item, state);
    rows.push([
      categoryNames[item.category] || item.category,
      family ? family.title : '—',
      item.id,
      item.title,
      item.severity,
      COVERAGE_STATE[status] || status,
      FINDING_STATE[status] || 'none',
      state.retests?.[item.id] ? 'yes' : 'no',
      state.notes?.[item.id] ? 'yes' : 'no'
    ].map(csvCell).join(','));
  }
  return `${rows.join('\n')}\n`;
}

// A paste-ready status block for engagement notes and daily updates: the coverage answer the
// tester would otherwise retype into a chat or a report.
export function composeFamilyCoverageBlock(family, coverage, state, categoryNames = {}) {
  const checks = coverage.checks;
  const lines = [
    `### ${family.title} — ${categoryNames[family.category] || family.category}`,
    '',
    `- Coverage: ${checks.coverage === null ? '—' : `${checks.coverage}%`} (${checks.tested}/${checks.executable} executable checks tested)`,
    `- Not tested: ${checks.not_tested + checks.active} · Blocked: ${checks.blocked} · N/A: ${checks.na}`,
    `- Confirmed findings: ${checks.confirmed} · Potential: ${checks.potential}`,
    `- Don't-miss variants covered: ${coverage.variants.covered}/${coverage.variants.total}`,
    ''
  ];
  const uncoveredVariants = coverage.variants.entries.filter(({ covered }) => !covered);
  if (uncoveredVariants.length) {
    lines.push('Variants still open:');
    for (const variant of uncoveredVariants) lines.push(`- [ ] ${safe(variant.text)}`);
    lines.push('');
  }
  const remaining = (family.items || []).filter((id) => !TESTED_STATUSES.includes(state.statuses?.[id] || 'not_tested'));
  if (remaining.length) {
    lines.push('Checks still open:');
    for (const id of remaining) lines.push(`- [ ] ${id} — ${STATUS_LABELS[state.statuses?.[id] || 'not_tested']}`);
    lines.push('');
  }
  return lines.join('\n');
}
