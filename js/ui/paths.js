// Asset paths for pages that are also published at clean directory URLs
// (/app/, /docs/, /methodology/, /workflow/). The published directory copies
// carry data-asset-root="../" on <html>; pages served from the repository root
// have no attribute and resolve exactly as before. Repo-root files stay the
// source of truth — the publish step only adds the attribute.
export const ASSET_ROOT = (typeof document !== 'undefined' && document.documentElement?.dataset?.assetRoot) || '';

export function asset(path) {
  return `${ASSET_ROOT}${path}`;
}
