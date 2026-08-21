import { searchableText } from './catalog.js?v=1.0.0-r17';

export const EMPTY_FILTERS = Object.freeze({
  query: '', category: '', severity: '', difficulty: '', status: '', mode: '',
  applicability: '', technology: '', tool: '', tag: '', testId: '', standard: '', sort: ''
});

export const STANDARD_OPTIONS = Object.freeze([
  ['wstg', 'OWASP WSTG'], ['asvs', 'OWASP ASVS'], ['owasp_top10', 'OWASP Top 10'],
  ['api_top10', 'API Security Top 10'], ['cwe', 'CWE'], ['portswigger', 'PortSwigger research']
]);

const SEVERITY_RANK = Object.freeze({ critical: 0, high: 1, medium: 2, low: 3, informational: 4 });
const DIFFICULTY_RANK = Object.freeze({ low: 0, medium: 1, high: 2 });
const STATUS_RANK = Object.freeze({
  confirmed_finding: 0, potential_finding: 1, in_progress: 2, blocked: 3, not_tested: 4, na: 5
});

function includes(value, query) {
  return String(value || '').toLocaleLowerCase('en-US').includes(query.toLocaleLowerCase('en-US').trim());
}

export function itemStatus(item, state) {
  return state?.statuses?.[item.id] || 'not_tested';
}

export function filterItems(records, filters = EMPTY_FILTERS, state = {}) {
  const f = { ...EMPTY_FILTERS, ...filters };
  const words = f.query.toLocaleLowerCase('en-US').trim().split(/\s+/).filter(Boolean);
  return records.filter(({ item, applicability }) => {
    const haystack = searchableText(item);
    if (words.some((word) => !haystack.includes(word))) return false;
    if (f.category && item.category !== f.category) return false;
    if (f.severity && item.severity !== f.severity) return false;
    if (f.difficulty && item.difficulty !== f.difficulty) return false;
    if (f.status && itemStatus(item, state) !== f.status) return false;
    if (f.mode && item.mode !== f.mode) return false;
    if (f.applicability && applicability.state !== f.applicability) return false;
    if (f.standard && !(item.mappings?.[f.standard] || []).length) return false;
    if (f.technology && ![...(item.tags || []), ...(item.applies?.any_of ? Object.values(item.applies.any_of).flat() : [])].some((value) => includes(value, f.technology))) return false;
    if (f.tool && !(item.tools || []).some((value) => includes(value, f.tool))) return false;
    if (f.tag && !(item.tags || []).some((value) => includes(value, f.tag))) return false;
    if (f.testId && !includes(item.id, f.testId)) return false;
    return true;
  });
}

// Sorting is a view concern, never a data mutation: the catalog order is the default.
export function sortRecords(records, sort, state = {}) {
  if (!sort) return records;
  const sorted = [...records];
  if (sort === 'severity') {
    sorted.sort((a, b) => (SEVERITY_RANK[a.item.severity] ?? 9) - (SEVERITY_RANK[b.item.severity] ?? 9) || a.item.id.localeCompare(b.item.id));
  } else if (sort === 'difficulty') {
    sorted.sort((a, b) => (DIFFICULTY_RANK[a.item.difficulty] ?? 9) - (DIFFICULTY_RANK[b.item.difficulty] ?? 9) || a.item.id.localeCompare(b.item.id));
  } else if (sort === 'status') {
    sorted.sort((a, b) => (STATUS_RANK[itemStatus(a.item, state)] ?? 9) - (STATUS_RANK[itemStatus(b.item, state)] ?? 9) || a.item.id.localeCompare(b.item.id));
  } else if (sort === 'id') {
    sorted.sort((a, b) => a.item.id.localeCompare(b.item.id));
  } else if (sort === 'title') {
    sorted.sort((a, b) => a.item.title.localeCompare(b.item.title));
  }
  return sorted;
}
