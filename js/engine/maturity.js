// Explicit maturity states for a test check.
//
// We never pretend a catalog-only item has a full procedure. An overlay is a real
// authored playbook; a catalog item with no overlay is methodology until practical
// variants are written. Three states, and nothing is invented at runtime from a title.

export const MATURITY = Object.freeze({
  AUTHORED: 'authored',
  VARIANT_COMPLETE: 'variant-complete',
  CATALOG_ONLY: 'catalog-only'
});

// Standardised variant classes (item 5). Every fully-authored variant carries one of
// these plus a one-line `why`. The 623-item schema is untouched: these are playbook
// overlay fields, not checklist-item fields.
export const VARIANT_CLASSES = Object.freeze([
  'baseline',
  'mutation',
  'encoding',
  'parser-differential',
  'header-variant',
  'parameter-variant',
  'authentication-context',
  'authorization-context',
  'browser-context',
  'technology-specific',
  'protocol-variant',
  'tool-assisted',
  'out-of-band',
  'race-concurrency'
]);

export const MATURITY_LABEL = Object.freeze({
  [MATURITY.AUTHORED]: 'Step-by-step guide',
  [MATURITY.VARIANT_COMPLETE]: 'Guided variants',
  [MATURITY.CATALOG_ONLY]: 'Methodology reference'
});

export const MATURITY_NOTE = Object.freeze({
  [MATURITY.AUTHORED]: 'Named variants, payloads, validation, and safety guidance are included.',
  [MATURITY.VARIANT_COMPLETE]: 'Named variants are listed with payloads and expectations.',
  [MATURITY.CATALOG_ONLY]: 'Covered by the full methodology reference; open it to run this check.'
});

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isVariantClass(value) {
  return VARIANT_CLASSES.includes(value);
}

// A check is AUTHORED only when it carries real variants and every variant is fully
// described (a one-line why plus a recognised variant class). Variants that exist but
// are not yet fully described are VARIANT-COMPLETE. Zero variants is CATALOG-ONLY.
export function checkMaturity(check = {}) {
  const variants = Array.isArray(check.variants) ? check.variants : [];
  if (variants.length === 0) return MATURITY.CATALOG_ONLY;
  const complete = variants.every(
    (variant) => hasText(variant.why) && isVariantClass(variant.category)
  );
  return complete ? MATURITY.AUTHORED : MATURITY.VARIANT_COMPLETE;
}

// Variants embed their payload string so the validator's name/payload/expect rule
// holds. payload_ref points at a playbook-local payload object; resolve it here so the
// UI can surface the payload metadata (category, context, encoding, purpose, safe).
export function resolveVariant(variant, payloads = {}) {
  if (!variant || typeof variant !== 'object') return variant;
  if (!hasText(variant.payload_ref)) return variant;
  const ref = payloads[variant.payload_ref];
  if (!ref) return variant;
  return { ...variant, payloadObject: ref };
}
