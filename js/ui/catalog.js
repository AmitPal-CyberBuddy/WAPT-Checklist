import { asset } from './paths.js?v=1.0.0-r16';

const ITEM_ID = /^WAPT-[A-Z]+-\d{3}$/;

function assertDocument(document, category) {
  if (!document || document.category !== category.slug || !Array.isArray(document.items)) {
    throw new TypeError(`Invalid checklist document for ${category.slug}.`);
  }
  if (document.items.some((item) => !ITEM_ID.test(item?.id || '') || item.category !== category.slug)) {
    throw new TypeError(`Invalid checklist item in ${category.file}.`);
  }
  return document.items;
}

export function createCatalog() {
  let categories = [];
  const pending = new Map();
  const loaded = new Map();

  function setManifest(manifest) {
    categories = Array.isArray(manifest?.categories) ? manifest.categories.filter(({ count }) => count > 0) : [];
  }

  async function loadCategory(slug) {
    if (loaded.has(slug)) return loaded.get(slug);
    if (pending.has(slug)) return pending.get(slug);
    const category = categories.find((candidate) => candidate.slug === slug);
    if (!category) return [];
    const request = fetch(asset(`checklist/${category.file}`), { headers: { Accept: 'application/json' } })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load ${category.name}: HTTP ${response.status}`);
        return response.json();
      })
      .then((document) => {
        const items = assertDocument(document, category);
        loaded.set(slug, items);
        pending.delete(slug);
        return items;
      })
      .catch((error) => {
        pending.delete(slug);
        throw error;
      });
    pending.set(slug, request);
    return request;
  }

  async function loadAll() {
    const groups = await Promise.all(categories.map(({ slug }) => loadCategory(slug)));
    return groups.flat();
  }

  return Object.freeze({
    setManifest,
    loadCategory,
    loadAll,
    getLoaded: () => [...loaded.values()].flat(),
    isLoaded: (slug) => loaded.has(slug),
    getCategories: () => [...categories]
  });
}

export function searchableText(item) {
  return [
    item.id, item.title, item.objective, item.manipulate, item.secure_behavior,
    item.vulnerable_behavior, item.impact, ...(item.steps || []), ...(item.tags || []),
    ...(item.tools || []), ...Object.values(item.mappings || {}).flat()
  ].join(' ').toLocaleLowerCase('en-US');
}
