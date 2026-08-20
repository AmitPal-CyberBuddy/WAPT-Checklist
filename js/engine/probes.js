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

import { checkMaturity } from './maturity.js?v=1.0.0-r7';

export function variantsForItem(item, overlay, path = '/') {
  void item;
  void path;
  if (Array.isArray(overlay?.variants) && overlay.variants.length >= 2) return overlay.variants;
  return [];
}

export function checkFromItem(item, overlay, path = '/') {
  const variants = variantsForItem(item, overlay, path);
  const check = {
    id: overlay?.id || item.id.toLowerCase(),
    title: overlay?.title || item.title,
    item: item.id,
    related: overlay?.related || [],
    severity: overlay?.severity || item.severity,
    tool: overlay?.tool,
    why: overlay?.why || item.objective,
    validate: overlay?.validate || item.validation,
    variants,
    authored: Boolean(overlay)
  };
  return { ...check, maturity: checkMaturity(check) };
}
