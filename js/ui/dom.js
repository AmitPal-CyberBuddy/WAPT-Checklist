// Shared DOM helpers and the status vocabulary used across every workspace view.
import { STATUS_LABELS } from './export.js?v=1.0.0-r16';
import { setItemStatus } from '../engine/state.js?v=1.0.0-r16';

export const SEVERITY_GLYPHS = Object.freeze({ critical: '▲', high: '◆', medium: '●', low: '■', informational: '○' });
export const STATUS_GLYPHS = Object.freeze({
  not_tested: '□', in_progress: '◐', passed: '✓', potential_finding: '△', confirmed_finding: '▲', na: '—', blocked: '⊘'
});
export const APP_LABELS = Object.freeze({ active: 'Active', confirm: 'Confirm applicability', na_context: 'N/A (context)' });

// Coverage state and finding verdict are different questions, so the tester answers them with
// two controls. They are stored in the one existing status value, so no state migration and no
// second source of truth: a finding always implies the check was executed.
export const COVERAGE_OPTIONS = Object.freeze([
  ['not_tested', 'Not tested'],
  ['in_progress', 'Testing now'],
  ['tested', 'Tested'],
  ['blocked', 'Blocked'],
  ['na', 'N/A']
]);
export const FINDING_OPTIONS = Object.freeze([
  ['none', 'No finding'],
  ['potential', 'Potential'],
  ['confirmed', 'Confirmed']
]);

export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function coverageValue(status) {
  if (['passed', 'potential_finding', 'confirmed_finding'].includes(status)) return 'tested';
  return status;
}

export function findingValue(status) {
  if (status === 'potential_finding') return 'potential';
  if (status === 'confirmed_finding') return 'confirmed';
  return 'none';
}

export function composeStatus(coverage, finding) {
  if (coverage !== 'tested') return coverage;
  if (finding === 'potential') return 'potential_finding';
  if (finding === 'confirmed') return 'confirmed_finding';
  return 'passed';
}

// One reusable pair of controls: coverage (did I run it?) and finding (is it a vulnerability?).
export function statusControls(item, status, { getState, commit, compact = false } = {}) {
  const wrap = element('div', compact ? 'status-controls compact' : 'status-controls');
  // The wrap carries the live status so the control pair can be color-scanned
  // (accent + glyph) without reading either select.
  wrap.dataset.status = status;
  const coverage = document.createElement('select');
  coverage.className = 'status-select';
  coverage.dataset.coverageControl = item.id;
  coverage.setAttribute('aria-label', `Coverage state for ${item.id}`);
  for (const [value, label] of COVERAGE_OPTIONS) coverage.append(new Option(label, value));
  coverage.value = coverageValue(status);

  const finding = document.createElement('select');
  finding.className = 'finding-select';
  finding.dataset.findingToggle = item.id;
  finding.setAttribute('aria-label', `Finding verdict for ${item.id}`);
  for (const [value, label] of FINDING_OPTIONS) finding.append(new Option(label, value));
  finding.value = findingValue(status);
  finding.disabled = coverageValue(status) === 'na';

  coverage.addEventListener('change', () => {
    const next = composeStatus(coverage.value, coverage.value === 'tested' ? finding.value : 'none');
    commit(setItemStatus(getState(), item.id, next));
  });
  finding.addEventListener('change', () => {
    // Recording a finding necessarily means the check was executed.
    const next = composeStatus(finding.value === 'none' ? coverageValue(status) === 'tested' ? 'tested' : coverage.value : 'tested', finding.value);
    commit(setItemStatus(getState(), item.id, next));
  });
  wrap.append(coverage, finding);
  return wrap;
}

export function statusChip(status) {
  const chip = element('span', `chip status-chip status-${status}`, `${STATUS_GLYPHS[status] || '□'} ${STATUS_LABELS[status]}`);
  return chip;
}

export function copyButton(text, label) {
  const button = element('button', 'copy-button', 'Copy');
  button.type = 'button';
  button.setAttribute('aria-label', `Copy ${label}`);
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(String(text || ''));
      button.textContent = 'Copied';
      setTimeout(() => { button.textContent = 'Copy'; }, 1200);
    } catch {
      button.textContent = 'Unavailable';
    }
  });
  return button;
}

export function section(title, values, ordered = false) {
  const wrapper = element('section', 'method-section');
  const heading = element('div', 'method-section-heading');
  heading.append(element('h4', '', title), copyButton(Array.isArray(values) ? values.join('\n') : values, title));
  wrapper.append(heading);
  if (!Array.isArray(values)) {
    wrapper.append(element('p', '', values || 'Not specified'));
    return wrapper;
  }
  const list = element(ordered ? 'ol' : 'ul');
  for (const value of values) list.append(element('li', '', value));
  wrapper.append(list);
  return wrapper;
}

export function coverageBar(tested, executable) {
  const bar = document.createElement('progress');
  bar.max = Math.max(1, executable);
  bar.value = tested;
  bar.className = 'coverage-bar';
  return bar;
}

// Compact "8/14 · 57%" style stat row used by the board, the family header, and the dashboard.
export function statRow(coverage, { variants } = {}) {
  const row = element('div', 'stat-row');
  const add = (label, value, className = '') => {
    if (value === undefined || value === null) return;
    const stat = element('span', `stat ${className}`.trim());
    stat.append(element('strong', '', String(value)), element('small', '', label));
    row.append(stat);
  };
  add('coverage', coverage.coverage === null ? '—' : `${coverage.coverage}%`, 'stat-primary');
  add('tested', coverage.tested);
  add('not tested', coverage.not_tested + coverage.active);
  add('blocked', coverage.blocked, coverage.blocked ? 'stat-blocked' : '');
  add('N/A', coverage.na, 'stat-muted');
  add('confirmed', coverage.confirmed, coverage.confirmed ? 'stat-finding' : '');
  if (variants) add("don't miss", `${variants.covered}/${variants.total}`, 'stat-variants');
  return row;
}

const STANDARD_LABELS = Object.freeze({ wstg: 'WSTG', asvs: 'ASVS', owasp_top10: 'OWASP', api_top10: 'API', cwe: 'CWE' });

// The family operator contract, rendered from one component everywhere it appears (board card,
// family header, dashboard gap row) so the same four facts always read the same way:
// what you need · how it runs · which tools drive it · what it maps to in the report.
export function contractRow(contract, { compact = false } = {}) {
  const row = element('div', compact ? 'contract-row compact' : 'contract-row');
  row.dataset.familyContract = contract.id;
  // The board shows the two decisive prerequisites; the family header shows the full set.
  const shown = compact ? contract.needs.slice(0, 2) : contract.needs;
  const overflow = contract.needs.length - shown.length;
  const needs = contract.needs.length
    ? `${shown.map(({ label, all }) => `${label}${all ? '' : ' (some)'}`).join(' · ')}${overflow > 0 ? ` +${overflow}` : ''}`
    : 'no scope prerequisites';
  const needsChip = element('span', 'contract-item contract-needs');
  needsChip.append(element('span', 'contract-key', 'NEEDS'), element('span', '', needs));
  row.append(needsChip);

  if (!compact) {
    const mode = element('span', 'contract-item');
    mode.append(element('span', 'contract-key', 'MODE'), element('span', '', contract.assisted ? `${contract.mode} · tool-assisted` : contract.mode));
    row.append(mode);
    if (contract.tools.length) {
      const tools = element('span', 'contract-item');
      tools.append(element('span', 'contract-key', 'TOOLS'));
      for (const tool of contract.tools) {
        const link = element('a', 'contract-tool', tool.label.replace(/^Burp /, ''));
        link.href = `workflow.html?tool=${tool.workflow}`;
        link.target = '_blank';
        link.rel = 'noreferrer noopener';
        tools.append(link);
      }
      row.append(tools);
    }
    if (contract.standards.length) {
      const standards = element('span', 'contract-item');
      standards.append(element('span', 'contract-key', 'MAPS TO'));
      standards.append(element('span', '', contract.standards.map(({ source, id }) => `${STANDARD_LABELS[source] || source} ${id}`).join(' · ')));
      row.append(standards);
    }
  }
  return row;
}
