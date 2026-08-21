import { serializeState } from '../engine/state.js?v=1.0.0-r20';
import { RETEST_GUIDANCE } from '../engine/reportability.js?v=1.0.0-r20';

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

// ── HTML engagement report ─────────────────────────────────────────────────
// A single self-contained file the tester can hand to a client: inline styles
// in the console's own palette, no external requests, renders offline from
// file://. Content mirrors the Markdown report; secrets remain the tester's
// responsibility (the same redaction reminder is printed on the report).
const REPORT_SEVERITY_RANK = Object.freeze({ critical: 0, high: 1, medium: 2, low: 3, informational: 4 });

function reportEsc(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

export function composeReportHtml(items, state, categoryNames = {}) {
  const findings = [...findingItems(items, state)].sort((left, right) =>
    (REPORT_SEVERITY_RANK[left.severity] ?? 9) - (REPORT_SEVERITY_RANK[right.severity] ?? 9) || left.id.localeCompare(right.id));
  const statuses = Object.values(state.statuses || {});
  const tested = statuses.filter((status) => TESTED_STATUSES.includes(status)).length;
  const confirmed = statuses.filter((status) => status === 'confirmed_finding').length;
  const potential = statuses.filter((status) => status === 'potential_finding').length;
  const packs = Array.isArray(state.findings) ? state.findings : [];
  const custom = items.filter((item) => item.category === 'custom');
  const roleModel = state.engagement?.role_model || [];
  const generated = new Date().toISOString().slice(0, 10);
  const stat = (value, label) => `<div class="stat"><strong>${reportEsc(value)}</strong><span>${reportEsc(label)}</span></div>`;
  const findingRows = findings.length ? findings.map((item) => `
      <tr>
        <td class="mono">${reportEsc(item.id)}</td>
        <td>${reportEsc(item.title)}</td>
        <td>${reportEsc(categoryNames[item.category] || item.category)}</td>
        <td><span class="sev sev-${reportEsc(item.severity)}">${reportEsc(item.severity)}</span></td>
        <td>${reportEsc(STATUS_LABELS[statusOf(item, state)] || statusOf(item, state))}</td>
        <td>${reportEsc(state.notes?.[item.id] || '')}</td>
      </tr>`).join('') : '<tr><td colspan="6" class="empty">No potential or confirmed findings recorded.</td></tr>';
  const packBlocks = packs.map((pack) => `
      <section class="pack">
        <h3>${reportEsc(pack.title || 'Evidence pack')} <span class="mono">${reportEsc(pack.id)} · ${reportEsc(pack.item_id)}</span></h3>
        <dl>
          <div><dt>Severity</dt><dd>${reportEsc(pack.severity)}</dd></div>
          <div><dt>Endpoint</dt><dd class="mono">${reportEsc(pack.endpoint || '—')}</dd></div>
          <div><dt>Method</dt><dd>${reportEsc(pack.method || '—')}</dd></div>
          <div><dt>Exploitability</dt><dd>${reportEsc(pack.exploitability)}</dd></div>
          <div><dt>Reportable</dt><dd>${pack.reportable ? 'Yes' : 'No'}</dd></div>
          <div><dt>Retest</dt><dd>${reportEsc(pack.retest_verdict)}</dd></div>
        </dl>
        ${pack.observed_behavior ? `<p><strong>Observed.</strong> ${reportEsc(pack.observed_behavior)}</p>` : ''}
        ${pack.cleanup_performed ? `<p><strong>Cleanup.</strong> ${reportEsc(pack.cleanup_performed)}</p>` : ''}
        ${pack.root_cause ? `<p><strong>Root cause.</strong> ${reportEsc(pack.root_cause)}</p>` : ''}
      </section>`).join('') || '<p class="empty">No structured evidence packs recorded.</p>';
  const customRows = custom.map((item) => `<li><span class="mono">${reportEsc(item.id)}</span> ${reportEsc(item.title)} <em>(${reportEsc(STATUS_LABELS[statusOf(item, state)] || 'not tested')})</em></li>`).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${reportEsc(state.engagement?.name || 'WAPT engagement')} — Assessment report</title>
<style>
  :root{color-scheme:light}
  *{box-sizing:border-box}
  body{margin:0;background:#f4f7fb;color:#101828;font:400 14px/1.6 Sora,system-ui,-apple-system,"Segoe UI",sans-serif}
  .mono{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace}
  main{max-width:980px;margin:0 auto;padding:40px 24px 64px}
  header.hero{border:1px solid #d9e1ec;border-left:4px solid #087a6d;border-radius:14px;background:#fff;padding:22px 26px;margin-bottom:20px}
  .kicker{margin:0 0 6px;color:#087a6d;font:500 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.16em}
  h1{margin:0 0 4px;font-size:26px;letter-spacing:-.02em}
  .target{margin:0;color:#5c6672;font-size:13px}
  .stats{display:flex;flex-wrap:wrap;gap:1px;background:#d9e1ec;border:1px solid #d9e1ec;border-radius:12px;overflow:hidden;margin-bottom:28px}
  .stat{flex:1 1 140px;background:#fff;padding:14px 18px}
  .stat strong{display:block;font-size:26px;letter-spacing:-.02em;color:#087a6d}
  .stat span{color:#5c6672;font-size:11px;text-transform:uppercase;letter-spacing:.08em}
  h2{font-size:17px;margin:32px 0 10px;letter-spacing:-.01em}
  .ladder{margin:0 0 8px;padding:10px 14px;border:1px solid #cfe7e2;border-radius:10px;background:#eef9f7;font-size:13px}
  table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #d9e1ec;border-radius:12px;overflow:hidden;font-size:13px}
  th{text-align:left;padding:10px 12px;background:#edf2f7;color:#5c6672;font:500 10px/1 ui-monospace,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase}
  td{padding:10px 12px;border-top:1px solid #edf2f7;vertical-align:top}
  .sev{display:inline-block;padding:2px 8px;border-radius:100px;font-size:11px;font-weight:600}
  .sev-critical,.sev-high{background:#fde8ea;color:#c41212}
  .sev-medium{background:#fdf3e0;color:#a03e00}
  .sev-low{background:#e7f7f1;color:#016a3e}
  .sev-informational{background:#eaf1fe;color:#175cd3}
  .pack{background:#fff;border:1px solid #d9e1ec;border-radius:12px;padding:16px 18px;margin-bottom:12px}
  .pack h3{margin:0 0 8px;font-size:14px}
  .pack h3 .mono{color:#5c6672;font-weight:400;font-size:11px;margin-left:8px}
  .pack dl{display:flex;flex-wrap:wrap;gap:6px 24px;margin:0 0 8px}
  .pack dt{color:#5c6672;font-size:10px;text-transform:uppercase;letter-spacing:.08em}
  .pack dd{margin:0;font-size:13px}
  .pack p{margin:6px 0 0;font-size:13px}
  .empty{color:#5c6672;text-align:center;padding:18px}
  .note{margin-top:36px;padding:12px 16px;border:1px dashed #d9e1ec;border-radius:10px;color:#5c6672;font-size:12px}
  ul.custom{background:#fff;border:1px solid #d9e1ec;border-radius:12px;padding:14px 14px 14px 30px;font-size:13px}
  @media print{body{background:#fff}main{padding:0}.stats,.pack,table{border-color:#ccc}}
</style>
</head>
<body>
<main>
  <header class="hero">
    <p class="kicker">WAPT CHECKLIST · ASSESSMENT REPORT · ${reportEsc(generated)}</p>
    <h1>${reportEsc(state.engagement?.name || 'WAPT engagement')}</h1>
    <p class="target mono">${reportEsc(state.engagement?.targetUrl || 'Target not recorded')}</p>
  </header>
  <div class="stats">
    ${stat(items.length, 'Tests in scope')}
    ${stat(tested, 'Tested')}
    ${stat(potential, 'Potential findings')}
    ${stat(confirmed, 'Confirmed findings')}
    ${stat(packs.length, 'Evidence packs')}
    ${stat(custom.length, 'Custom checks')}
  </div>
  ${roleModel.length ? `<h2>Role ladder under test</h2><p class="ladder mono">${roleModel.map(({ name }) => reportEsc(name)).join('  &uarr;  ')}</p>` : ''}
  <h2>Findings</h2>
  <table>
    <thead><tr><th>ID</th><th>Title</th><th>Category</th><th>Severity</th><th>Status</th><th>Notes</th></tr></thead>
    <tbody>${findingRows}</tbody>
  </table>
  <h2>Evidence packs</h2>
  ${packBlocks}
  ${custom.length ? `<h2>Custom checks (target-specific)</h2><ul class="custom">${customRows}</ul>` : ''}
  <p class="note">Client-generated draft produced locally by WAPT Checklist. It contains tester notes and evidence descriptions — review and redact credentials, tokens, personal data, and tenant identifiers before distribution. Authorized testing only.</p>
</main>
</body>
</html>`;
}
