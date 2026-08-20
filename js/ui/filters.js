import { searchableText } from './catalog.js?v=1.0.0-r8';

export const EMPTY_FILTERS = Object.freeze({
  query: '', category: '', severity: '', difficulty: '', status: '', mode: '',
  applicability: '', technology: '', tool: '', tag: '', testId: ''
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
    if (f.technology && ![...(item.tags || []), ...(item.applies?.any_of ? Object.values(item.applies.any_of).flat() : [])].some((value) => includes(value, f.technology))) return false;
    if (f.tool && !(item.tools || []).some((value) => includes(value, f.tool))) return false;
    if (f.tag && !(item.tags || []).some((value) => includes(value, f.tag))) return false;
    if (f.testId && !includes(item.id, f.testId)) return false;
    return true;
  });
}
