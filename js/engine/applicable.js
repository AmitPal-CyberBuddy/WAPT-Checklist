import { APPLICABILITY, evaluateApplicability } from './applicability.js';

// The canonical Applicable Test Count (item 1).
//
// Applicable = catalog items that evaluate as Active or Confirm for the current profile.
// This is NOT the playbooks/manifest.json `count` (which is authored-overlay checks only)
// and NOT a synthesized expansion. Every dashboard, playbook hero, share-markdown, and
// test number that means "how many tests apply here" must come from this function.

export function applicableItems(items = [], context) {
  return items.filter((item) => {
    const result = evaluateApplicability(item, context);
    return result.state === APPLICABILITY.ACTIVE || result.state === APPLICABILITY.CONFIRM;
  });
}

export function applicableCount(items = [], context) {
  return applicableItems(items, context).length;
}

// Authored overlays: catalog items that carry a real playbook check with variants/payloads.
// Pass the applicable items and the playbook index; returns the subset with an authored
// overlay and the subset that is methodology-only.
export function authoredOverlayIds(index, itemIds = []) {
  const ids = new Set();
  for (const { playbook } of index?.playbooks || []) {
    for (const group of playbook.groups || []) {
      for (const check of group.checks || []) {
        if (check.item) ids.add(check.item);
        for (const id of check.related || []) ids.add(id);
      }
    }
  }
  return itemIds.filter((id) => ids.has(id));
}
