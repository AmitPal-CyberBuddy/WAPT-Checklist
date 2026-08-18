# Responsive layout QA

> Release 1.0.0 structural review — 2026-08-18

Responsiveness is implemented as layout recomposition, not global scaling. Typography retains readable minimums, controls remain native-sized, and dense desktop surfaces become different mobile compositions.

## Intended screen compositions

| Viewport | Intended composition |
|---|---|
| 2560–1920 px monitor | Centered content capped at 1180 px on the homepage and 1240 px in the workspace; persistent 272 px app sidebar; two-column hero; four dashboard metrics; two-column methodology/chain/payload surfaces where useful. Extra monitor width becomes calm margin rather than overlong lines. |
| 1440–1280 px desktop/laptop | Persistent sidebar; full workspace header; four dashboard metrics where space permits; filter grid reflows across rows; cards preserve side-by-side controls. |
| 1024 px small laptop | Persistent sidebar remains usable; dashboard changes to two metrics per row and one dashboard content column; homepage hero intentionally becomes one column; filters use four/two logical columns rather than shrinking controls. |
| 960–768 px tablet | Sidebar becomes an off-canvas drawer with scrim, focus transfer, Escape close, `inert`, and `aria-hidden` while closed; workspace receives the full screen width; filters become two columns; dashboard panels stack. |
| 600–390 px phone | One-column cards, filters, option/preset grids, chains, and payloads; compact search button; action groups wrap; tables scroll horizontally; methodology behavior columns stack; no desktop sidebar footprint. |
| 380–320 px compact phone | Wizard footer becomes a vertical action stack; dashboard metrics become one compact row-card each; panel actions and workflow links become one column; the engagement manager compresses to an icon-labelled New control plus a retained, visible delete button (the 1.0.0-r3 build hid delete here); smaller page gutters while preserving touch targets. |

## Structural protections

- `min-width: 0`, ellipsis, `overflow-wrap`, and `word-break` handle long engagement names, target URLs, IDs, mappings, and references.
- Code/request examples wrap and retain horizontal overflow where needed.
- Findings tables use contained horizontal scrolling rather than forcing page overflow.
- The workspace has a readable maximum width on large monitors.
- Sidebar navigation is removed from the mobile focus order while off-canvas.
- Mobile menu open moves focus to Close; Escape/close returns focus to the menu button.
- Reduced-motion rules disable meaningful transitions.
- Print is a separate A4 composition rather than a screenshot of the desktop layout.

## Automated assertions

`tests/responsive.test.js` verifies breakpoint presence and the expected structural changes for dashboard columns, sidebar drawer, filters, wizard actions, chains/payloads, tables, and long text. These checks prevent accidental removal during CSS refactoring. `tests/privacy.test.js` additionally pins the same-origin fetch, single-storage-key, and CSP invariants.

## Manual visual sign-off still required

This sandbox has no Chromium/Firefox screenshot runner, so no claim is made that automated source assertions replace visual inspection. Before deployment, run the responsive section of `docs/QA.md` in current Chromium and Firefox at:

- 320 × 568 and 375 × 812;
- 768 × 1024;
- 1024 × 768;
- 1366 × 768 and 1440 × 900;
- 1920 × 1080 and, if available, 2560 × 1440;
- 200% browser zoom and OS large-text settings.

Check homepage, wizard, dashboard, one expanded methodology card, search filters/results, findings table, chains, payloads, and print preview. Record screenshots and browser/version in the release PR. The live sandbox preview is available for this review.
