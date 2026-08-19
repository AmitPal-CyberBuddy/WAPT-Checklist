// Surface playbooks: page-type packs of named test variants and payloads.
// Matching uses the same condition-map vocabulary as item.applies / variants.when.
import { contextHas } from './context.js?v=1.0.0-r6';
import { evaluateConditionMap } from './applicability.js?v=1.0.0-r6';

export function indexPlaybooks(manifest, documents = []) {
  const byId = new Map();
  const byItem = new Map();
  const playbooks = [];
  const files = new Map((documents || []).map((document) => [document.id, document]));
  for (const entry of manifest?.playbooks || []) {
    const document = files.get(entry.id);
    if (!document) continue;
    const playbook = Object.freeze({
      ...document,
      title: document.title || entry.title,
      summary: document.summary || entry.summary,
      groups: Object.freeze((document.groups || []).map((group) => Object.freeze({
        ...group,
        checks: Object.freeze(group.checks || [])
      })))
    });
    playbooks.push(playbook);
    byId.set(playbook.id, playbook);
    for (const check of playbookChecks(playbook)) {
      for (const itemId of checkItemIds(check)) {
        const bucket = byItem.get(itemId) || [];
        bucket.push({ playbook, check });
        byItem.set(itemId, bucket);
      }
    }
  }
  return Object.freeze({ playbooks: Object.freeze(playbooks), byId, byItem });
}

export function playbookChecks(playbook) {
  return (playbook?.groups || []).flatMap((group) => (group.checks || []).map((check) => ({ ...check, group })));
}

export function checkItemIds(check) {
  const ids = [];
  if (check?.item) ids.push(check.item);
  for (const id of check?.related || []) if (!ids.includes(id)) ids.push(id);
  return ids;
}

export function playbookMatches(playbook, context) {
  if (!playbook?.when || !Object.keys(playbook.when).length) return true;
  const primary = evaluateConditionMap(playbook.when, context);
  if (primary.matches || primary.unknown) return true;
  if (playbook.also_when && Object.keys(playbook.also_when).length) {
    const extra = evaluateConditionMap(playbook.also_when, context);
    if (extra.matches || extra.unknown) return true;
  }
  return false;
}

export function isPrimaryPlaybook(playbook, context) {
  return (playbook?.default_for || []).some((value) => contextHas(context, 'app_type', [value]));
}

export function matchPlaybooks(index, context) {
  return (index?.playbooks || []).filter((playbook) => playbookMatches(playbook, context));
}

export function suggestedPlaybook(index, context) {
  const matches = matchPlaybooks(index, context);
  const primary = matches.find((playbook) => isPrimaryPlaybook(playbook, context));
  if (primary) return primary;
  const certain = matches.find((playbook) => playbook.when && evaluateConditionMap(playbook.when, context).certain);
  return certain || matches[0] || null;
}

export function probesForItem(index, itemId) {
  return Object.freeze(index?.byItem?.get(itemId) || []);
}
