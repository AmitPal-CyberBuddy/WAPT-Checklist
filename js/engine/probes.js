// Overlay-only check builder.
//
// This module no longer synthesizes request/command/html variants from a checklist
// item's category + title. A title like "Test for HTTP Parameter Pollution" cannot
// become a real, pasteable procedure that way — it recreates the original problem of
// a nice UI with generic methodology generated from metadata.
//
// Authored playbook overlays win. A catalog item with no overlay is returned as
// CATALOG-ONLY: methodology available, practical variants pending. There is no fake
// Repeater block.

import { checkMaturity } from './maturity.js?v=1.0.0-r13';

export function variantsForItem(item, overlay, path = '/') {
  void item;
  void path;
  if (Array.isArray(overlay?.variants) && overlay.variants.length >= 2) return overlay.variants;
  return [];
}

export function checkFromItem(item, overlay, path = '/') {
  // An overlay is practical procedure for its primary catalog item. `related` IDs are
  // recommendation edges, not permission to relabel the same payload as several tests.
  // Keeping that boundary prevents an authored Host-header request, for example, from
  // masquerading as an authored cache or redirect procedure.
  const authoredOverlay = overlay?.item === item.id ? overlay : null;
  const variants = variantsForItem(item, authoredOverlay, path);
  const check = {
    id: authoredOverlay?.id || item.id.toLowerCase(),
    title: authoredOverlay?.title || item.title,
    item: item.id,
    category: item.category,
    difficulty: item.difficulty,
    tags: item.tags || [],
    tools: item.tools || [],
    related: [...new Set([...(item.related || []), ...(authoredOverlay?.related || [])])],
    severity: authoredOverlay?.severity || item.severity,
    tool: authoredOverlay?.tool,
    why: authoredOverlay?.why || item.objective,
    validate: authoredOverlay?.validate || item.validation,
    variants,
    authored: Boolean(authoredOverlay)
  };
  return { ...check, maturity: checkMaturity(check) };
}
