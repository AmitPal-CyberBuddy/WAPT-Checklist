import { serializeState } from '../engine/state.js?v=1.0.0-r6';
import { RETEST_GUIDANCE } from '../engine/reportability.js?v=1.0.0-r6';

export const STATUS_LABELS = Object.freeze({
  not_tested: 'Not Started', in_progress: 'Active', passed: 'Not Vulnerable',
  potential_finding: 'Potential Finding', confirmed_finding: 'Confirmed Finding', na: 'N/A'
});

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
      const checked = status === 'not_tested' ? ' ' : 'x';
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
  const tested = items.filter((item) => statusOf(item, state) !== 'not_tested').length;
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
    const complete = categoryItems.filter((item) => statusOf(item, state) !== 'not_tested').length;
    lines.push(`- ${safe(categoryNames[category] || category)}: ${complete}/${categoryItems.length}`);
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
