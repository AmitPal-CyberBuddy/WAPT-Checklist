# Responsive layout QA

> Release 1.0.0 structural review — 2026-08-18

Responsiveness is implemented as layout recomposition, not global scaling. Typography retains readable minimums, controls remain native-sized, and dense desktop surfaces become different mobile compositions.

## Intended screen compositions

| Viewport | Intended composition |
|---|---|
| 2560–1920 px monitor | Centered content capped at 1180 px on the homepage and 1240 px in the workspace; persistent 272 px app sidebar; two-column hero; six dashboard metrics in three columns plus retest-queue and attack-path panels; homepage shows five project metrics and a six-step pipeline in one row. Extra monitor width becomes calm margin rather than overlong lines. |
| 1440–1280 px desktop/laptop | Persistent sidebar; full workspace header; six dashboard metrics where space permits; filter grid reflows across rows with removable active-filter chips; cards preserve side-by-side controls. |
| 1024 px small laptop | Persistent sidebar remains usable; dashboard changes to two metrics per row and one dashboard content column; homepage hero intentionally becomes one column; filters use four/two logical columns rather than shrinking controls. |
| 960–768 px tablet | Sidebar becomes an off-canvas drawer with scrim, focus transfer, Escape close, `inert`, and `aria-hidden` while closed; workspace receives the full screen width; filters become two columns; dashboard panels stack. |
| 600–390 px phone | One-column cards, filters, option/preset grids, chains, and payloads; compact search button; action groups wrap; tables scroll horizontally; methodology behavior columns stack; the homepage pipeline becomes a vertical flow with down arrows; no desktop sidebar footprint. |
| 380–320 px compact phone | Wizard footer becomes a vertical action stack; dashboard metrics become one compact row-card each; panel actions and workflow links become one column; the engagement manager compresses to an icon-labelled New control plus a retained, visible delete button (the 1.0.0-r3 build hid delete here); smaller page gutters while preserving touch targets. |

## Structural protections

- `min-width: 0`, ellipsis, `overflow-wrap`, and `word-break` handle long engagement names, target URLs, IDs, mappings, and references.
- Code/request examples wrap and retain horizontal overflow where needed.
- Findings tables use contained horizontal scrolling rather than forcing page overflow.
- The workspace has a readable maximum width on large monitors.
- Sidebar navigation is removed from the mobile focus order while off-canvas.
- Mobile menu open moves focus to Close; Escape/close returns focus to the menu button.
- Reduced-motion rules disable meaningful transitions.
- Coarse-pointer devices get 44 px minimum touch targets on primary controls.
- Compact-phone typography floors raised: chips stay at 0.54rem and the authorization bar at 0.62rem instead of sub-0.5rem text.
- Skeleton shimmer is a single CSS animation, disabled under prefers-reduced-motion.
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

## Vertical density budget (2026-08-18)

A scope question is answered twenty times in a row, so the wizard is the tightest vertical
budget in the product. Measured from the CSS box model at a 1440-wide viewport:

| Layer | Before | After |
| --- | ---: | ---: |
| Fixed chrome above the first option (bar, sticky header, page padding, heading, intro, persistence block, shell meta, body padding, question text) | 697 px | 330 px |
| 4-option question, full page height | 974 px | 534 px |
| 6-option question | 1 055 px | 598 px |
| 8-option question (now 3 columns) | 1 136 px | 598 px |
| 11-option question (`features`) | 1 298 px | 662 px |

Usable viewport is ≈ 650 px on a 1366×768 laptop and ≈ 780 px on a 1440×900 laptop, so every
question except the largest now fits without scrolling, and the largest is 12 px over on the
smallest laptop — where the **sticky wizard footer** keeps Continue on screen regardless.

Changes that produced this: compact wizard heading, one-line intro (hidden under 720 px tall),
the local-storage explanation collapsed into a `<details>` summary, no fixed `min-height` on
`.wizard-body` at any breakpoint, denser option cards, an automatic third column at seven or
more options (fourth at ten or more on ≥ 1500 px), the step counter merged into the question
heading, and a sticky footer.

Workspace views were tightened in the same pass: `.view` padding `4rem → 1.75rem` max, heading
`h1` `3.1rem → 2rem` max, heading margin `2.5rem → 1.1rem` — 300 px of chrome before content
became 218 px on the dashboard, families board, and family workspace.

`tests/wizard-layout.test.js` re-derives these numbers from `css/styles.css` on every run and
fails if the chrome grows past 400 px or a question stops fitting 650 px.

**Still manual:** real-browser confirmation at 1366×768 and 1280×720, and the sticky footer's
appearance over a scrolling option grid in Safari (`overflow: clip` support).
