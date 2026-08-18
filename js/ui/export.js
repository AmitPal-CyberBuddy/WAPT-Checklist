import { serializeState } from '../engine/state.js?v=1.0.0-r4';

export const STATUS_LABELS = Object.freeze({
  not_tested: 'Not Tested', in_progress: 'In Progress', passed: 'Passed',
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
  lines.push('', '## Retest matrix', '', '| ID | Finding | Retest requested | Retest guidance |', '|---|---|---|---|');
  const confirmedItems = findings.filter((item) => statusOf(item, state) === 'confirmed_finding');
  if (!confirmedItems.length) lines.push('| — | No confirmed findings recorded | — | — |');
  for (const item of confirmedItems) {
    lines.push(`| ${item.id} | ${cell(item.title)} | ${state.retests?.[item.id] ? 'Yes' : 'No'} | Reproduce the original evidence, verify root-cause remediation, then test adjacent variants and authorization contexts. |`);
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
