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
  return classifyPlaybook(playbook, context) !== 'none';
}

// match = this surface is in the scoped target (certain `when`)
// relevant = also applies (also_when, or a hinted/unknown when)
// browse = still openable; not claimed by this scope
export function classifyPlaybook(playbook, context) {
  if (!playbook?.when || !Object.keys(playbook.when).length) return 'browse';
  const primary = evaluateConditionMap(playbook.when, context);
  if (primary.certain) return 'match';
  if (primary.matches) return 'relevant';
  if (playbook.also_when && Object.keys(playbook.also_when).length) {
    const extra = evaluateConditionMap(playbook.also_when, context);
    if (extra.certain || extra.matches) return 'relevant';
    if (extra.unknown && !primary.unknown) return 'relevant';
  }
  if (primary.unknown) return 'browse';
  return 'none';
}

export function isPrimaryPlaybook(playbook, context) {
  return (playbook?.default_for || []).some((value) => contextHas(context, 'app_type', [value]));
}

export function matchPlaybooks(index, context) {
  return (index?.playbooks || []).filter((playbook) => {
    const kind = classifyPlaybook(playbook, context);
    return kind === 'match' || kind === 'relevant';
  });
}

export function suggestedPlaybook(index, context) {
  const playbooks = index?.playbooks || [];
  const certain = playbooks.filter((playbook) => classifyPlaybook(playbook, context) === 'match');
  const primaryCertain = certain.find((playbook) => isPrimaryPlaybook(playbook, context));
  if (primaryCertain) return primaryCertain;
  if (certain.length) return certain[0];
  const relevant = playbooks.filter((playbook) => classifyPlaybook(playbook, context) === 'relevant');
  const primaryRelevant = relevant.find((playbook) => isPrimaryPlaybook(playbook, context));
  return primaryRelevant || relevant[0] || playbooks[0] || null;
}

export function probesForItem(index, itemId) {
  return Object.freeze(index?.byItem?.get(itemId) || []);
}
