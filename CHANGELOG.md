# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses semantic versioning.

## [Unreleased]

### Changed (Phase 2 — operator-console visual and responsive pass)

- **One operator console.** Homepage hero preview, dashboard, playbook, wizard, families, and search now share the same night-ops canvas (mint signal, violet secondary, Sora + IBM Plex Mono) and the same card/terminal language. The homepage hero preview mirrors the real assessment dashboard, including the catalog-derived `applicable · full playbooks · methodology-only` split.
- **Fluid design tokens.** Added `--faint`, `--on-brand`, `--brand-ring`, `--terminal`/`--terminal-line`, and a fluid type/spacing scale (`--fs-h1…--fs-lead`, `--space-section`, `--card-pad`, `--grid-gap`) plus quiet inset-highlight + soft-drop shadows. Documented breakpoint ladder: 560 / 768 / 1060 / 1440 / 1920 / 2560.
- **Named hypotheses are the visual unit of a test.** A variant is a tickable hypothesis with a one-line Why, class/kind/safe/encoding chips, and a terminal payload block. Catalog-only checks render an honest "◐ Methodology available — practical variants pending" state, never a fabricated request.
- **Responsive recomposition (not scaling).** Assessment stats, playbook/probe heads, chips, and hypothesis rows reflow at tablet and phone; wide monitors get a calm 1240→1460→1680px column cap. `overflow-x: clip` and `scroll-padding-top` keep sticky-header navigation and decorative gradients from causing horizontal scroll or hidden anchors.
- **Motion.** Quiet view-in / rise-in enters only; removed the leftover `signal-float` loop. `prefers-reduced-motion: reduce` disables all animation and transforms.
- **AA contrast.** Light theme brand raised to `#0b756b` (5.18:1) with an `--on-brand` text token for buttons/toggles; small secondary metadata uses `--faint` (AA). Severity, status, and maturity chips keep AA in both themes.
- **Cache bump to `1.0.0-r7`** for the restyled CSS and page assets; every pinned reference (pages, modules, tests) updated together. Payload library still 40.

### Changed (Post-merge corrections — catalog-derived Applicable Test Count and honest maturity)

- **One canonical Applicable Test Count.** The dashboard, playbook hero, share Markdown, and tests now use the catalog count: how many of the 623 checklist items evaluate as **Active or Confirm** for the current profile (`js/engine/applicable.js`). This is **not** `playbooks/manifest.json` `count`, which stays the authored-overlay count only. A static profile now reports its real catalog count (≈ 183, not the 49 authored overlays), shown as **N applicable · A with authored playbooks · M methodology-only**.
- **No more synthesized procedures from titles.** `js/engine/probes.js` no longer invents request variants from a checklist item's category + title (`synthesize()` / `categoryFallback()` deleted). Overlay merge is the only path. Expansion attaches the applicable catalog remainder as **catalog-only** — zero fabricated Repeater blocks.
- **Three explicit maturity states** (`js/engine/maturity.js`): **AUTHORED** (named variants, payloads, Why, CHECK FOR, VALIDATE, safety), **VARIANT-COMPLETE** (variants exist; per-variant why/class pending), **CATALOG-ONLY** (methodology available — practical variants pending, open the full methodology).
- **Static authored coverage widened** — robots.txt (`WAPT-RECON-008`), sitemap.xml (`WAPT-RECON-009`), `.well-known` (`WAPT-RECON-010`), DNS records (`WAPT-RECON-003`), certificate-transparency hostnames (`WAPT-RECON-002`), dangling-DNS/takeover identification (`WAPT-RECON-038`), method override (`WAPT-HTTP-003`), URL normalization (`WAPT-HTTP-008`), Web Storage (`WAPT-CLIENT-011`), and service worker (`WAPT-CLIENT-014`) are now named, runnable checks with real variants and payloads.
- **Feature-aware planning, not page-type-primary.** `buildAssessmentPlan()` starts from the applicable catalog items and attaches authored overlays, grouped by attack surface (`CATEGORY_SURFACE` in `surfaces.js`). Playbook matching still lights up the right surfaces; static still hides auth/session/authz/upload/api/graphql/jwt/oauth/websocket/business/ai.
- **Standardised variant taxonomy.** Every authored variant across every playbook carries `name, kind, payload, expect, category` (one of 14 allowed classes), a one-line `why`, optional `observe[]` and `payload_ref`. Validator checks `category` enum, non-empty `why` when present, and `payload_ref` resolution. Applied product-wide, not just static: all 16 playbooks render at **AUTHORED** maturity.
- **Payloads as first-class objects.** Optional playbook-level `payloads` map; variants reference it via `payload_ref`. Host Header Injection on `static-page.json` is the reference implementation, and the map is now exercised across the other major playbooks too (login, reset, API, JWT, WebSocket, OAuth, GraphQL, upload, search, session). No new payload-library entries (count stays 40).
- **UI: named hypotheses, not "Variant N".** Authored checks render a tickable named-attack-hypothesis list with a one-line Why; coverage ticks use the existing `setVariantCovered` / `variantKey`. Catalog-only rows show the maturity chip, "Practical variants pending", and a methodology link.
- **Tests rewritten** — `tests/playbooks.test.js` and `tests/assessment.test.js` no longer require every expanded check to have synthesized payloads; authored checks still need ≥2 real variants and catalog-only checks must have zero.

### Changed (Context-driven testing workspace)

- **Start testing** opens a compact **application profile** (type · authentication · features), not 623 checks and not an 18-question wizard. The wizard remains as Advanced scope.
- The dashboard is the **applicable test plan**, grouped as TLS / Security Headers / HTTP / Client-Side (and Auth, Session, Authorization, API, JWT, upload, checkout when the profile includes them). A static site lists the named practical tests (Host Header, methods, traversal, CSP, mixed content, DOM XSS, prototype pollution, postMessage, .git, …) and hides login/IDOR/privilege.
- Clicking a test is a **practical playbook**: Quick Test, numbered variants with copyable payloads, CHECK FOR (including per-variant observe bullets), VALIDATE, DO NOT REPORT. Methodology stays under Reporting and reference.
- **Share the plan:** Copy share link encodes answers only (`#share/…`). Copy plan Markdown is the paste-ready checklist.

### Added (Page playbooks — reported: looking at a page type should show every applicable test with variants and payloads, not methodology prose)

- **Page playbooks** (`#playbooks`, `#playbook/<id>`): tester-facing packs for the surface in front of you. Sixteen packs: static/published page, login, registration, password reset, account/profile, session/cookies, file upload, search, checkout, admin, REST API, GraphQL, WebSocket, OAuth/SSO/SAML, JWT, and SPA/client-side. Opening a pack lists **every applicable check** for that page type (the catalog Active+Confirm count, e.g. a static profile ≈ 183) — not a curated shortlist. Authored start-here probes keep the named variants (Host header arbitrary/duplicate/X-Forwarded-Host, CSP, testssl, BOLA, alg=none…); the rest of the catalog expands as **methodology-only** rows, never fabricated requests.
- The playbook board groups packs as **Matches this scope** / **Also relevant** / **Other surfaces**. A SaaS scope lights up login + SPA + API + JWT + profile together; an e-commerce scope lights up checkout + upload + search + login.
- Scoping a **static marketing site** lands on the static-page playbook. Every other finished wizard lands on the playbook board, not the dashboard. `g p` opens the board. The dashboard banner lists every matching surface.
- Methodology cards that a playbook covers now surface the same variants under *Procedure & variants*.
- `playbooks/*.json` is validated: IDs resolve, every check has at least two named variants, manifest counts match.

### Fixed (Layout density — reported: every scope question needed scrolling on a laptop)

- **Scope wizard fits one screen.** The wizard spent 697 px of vertical chrome before the first option, so a 4-option question rendered a 974 px page against a ~650 px laptop viewport. Now 330 px of chrome and a 534 px page: compact heading, one-line intro (hidden below 720 px tall), the local-storage explanation collapsed into a `<details>` summary instead of a permanent block, the step counter merged into the question heading, denser option cards, and the removal of the fixed `min-height` on `.wizard-body` (including a 500 px phone rule).
- **Continue is always reachable** — the wizard footer is sticky, so the longest question (11 options, now laid out in three columns) keeps Back / Use Unknown / Continue on screen.
- **Step changes land on the question** — focus moves without scrolling and the shell scrolls itself back to the top, instead of inheriting the previous step's scroll position.
- **Workspace views tightened** — `.view` padding 4rem → 1.75rem, heading `h1` 3.1rem → 2rem, heading margin 2.5rem → 1.1rem: 300 px → 218 px of chrome before content on the dashboard, families board, and family workspace.
- The review step no longer prints the local-storage warning twice.
- `tests/wizard-layout.test.js` re-derives the vertical budget from the stylesheet and fails if the chrome grows past 400 px or a question stops fitting a 650 px viewport.

### Added (Product round — CyberBuddy patterns translated to an engagement workflow)

- **Family operator contract** (derived, no new prose): every family states **Needs** (scope prerequisites read from the items' `applies` expressions — "a second tenant", "an upload feature", "two accounts"), **Mode** (manual / mixed / tool-assisted), **Tools** (linked to the Burp workflow pages), **Maps to** (WSTG · ASVS · OWASP · API · CWE), and its top severity. Rendered from one component on the board, in the family header, and on gap rows.
- **Attack-surface suites** on the families board: per-surface coverage, families, blocked, N/A, confirmed and don't-miss totals, plus **Continue this suite** — which lands on the first family with unexecuted checks (falling back to one with open variants).
- **Family boundary line** (`NOT HERE`): the sibling families that own the rest of the surface, derived from the category, so object/function/field/tenant authorization never blur.
- **Tool band per family**: Burp workflow deep links plus the payload references that match the family, rendered inline instead of linking into a library search.
- **Deliverable output**: `Copy coverage` (Markdown block with coverage, state breakdown, findings, variants and checks still open) and **Export coverage CSV** (one row per check, coverage state and finding in separate columns, with a spreadsheet-formula-injection guard).
- **Operator documentation** `docs/OPERATING.md`, rendered at `docs.html?doc=operating` and linked from the workspace sidebar and the home page: quick start, what this is and is not, the coverage vocabulary table, the family contract, keyboard model, outputs, and explicit limits.
- **Recent families** chip row on the board, and the home page's primary action becomes *Continue \<engagement\>* when this browser already holds progress.
- `docs/CYBERBUDDY-REFERENCE-REVIEW.md`: audit of both repositories, the proposal, the challenge of each item, and what was rejected (A–F grades, per-family authored `proves` lines, tool-per-page architecture, "run suite" automation).

### Fixed (Product round)

- Homepage statistics counted N/A and blocked checks as tested, contradicting the corrected coverage engine.

### Added (Tester-first round 2 — families as the working unit)

- **Test families view** (`#families`) and **family workspace** (`#family/<id>`): every attack surface with `tested/executable`, coverage bar, blocked, N/A, confirmed and don't-miss counts; surface/text/"unfinished only" filters; a Continue control that resumes the last family; and per-family quick test, tickable don't-miss list, dense check rows, "after this family", and "what else should I check?".
- **Authored Quick Test data** — `checklist/families.json` is now schema 2.0.0: all 196 families carry an explicit `quick_test` (3–5 imperative lines) and a one-line `validate`, validated for count, length, and imperative phrasing. Quick Test is no longer derived from methodology steps.
- **Don't Miss as coverage** — each reminder is a checkbox keyed `<family-id>#<content-hash>`, stored in `state.variants`, counted on the board, family header, category coverage view, and dashboard gaps, and persisted across reloads.
- **Coverage state separation** — `blocked` is a first-class status; `coverage.js` classifies each check as tested / active / blocked / N/A (context or tester) / not tested, and `coverage = tested / executable` excludes N/A while keeping blocked work owed.
- **Check ≠ coverage ≠ finding** — two controls per check (coverage and finding verdict) composing into the existing single status; recording a finding implies execution, recording coverage never invents a finding.
- **Contextual Suggested next** — bounded proximity layer (focus family +1500, adjacent family +420, part-finished family +700, related test +500, same surface +150) with plain-language reasons; a family workspace sets the focus explicitly, so the answer is right on a cold start.
- **"What else should I check?"** — `js/engine/families.js` derives cross-family navigation from existing data only: `item.related`, attack-chain successors, same-surface siblings, and workflow adjacency, with per-surface caps for variety.
- **Dashboard rebuilt around three questions** — what have I tested / what have I missed (family gaps + blocked list) / what should I test next (suggestions + Continue), with retest queue, chains, surface progress, findings, and evidence packs below.
- **Engagement memory** — `state.position` records the last view/family/category; the workspace reopens there while a fresh browser still starts at the wizard.
- **Keyboard** — `g t` (families), `e` (expand the focused check), `n`/`p` now walk family check rows as well as cards.
- **Compact scan lists** — "All tests" and Search render family-grouped one-line check rows that expand into the full card in place; searching the whole catalog dropped from 4 163 ms to 825 ms in the jsdom harness.
- `tools/tester-audit.mjs` (15 tester-workflow checks) and `tools/jsdom-harness.mjs` (shared runtime harness), plus `docs/TESTER-UX-REVIEW-2.md` with the before/after evidence tables.

### Changed (Tester-first round 2)

- Card hierarchy: level 1 is ID · severity · title · objective · VALIDATE with the status controls; procedure, methodology, references, and notes/evidence sit behind progressive disclosure; the family's quick test appears once per family instead of once per card.
- Status labels: `Not tested`, `Testing now`, `Tested — not vulnerable`, `Potential finding`, `Confirmed finding`, `N/A`, `Blocked`; reports and exports use the same vocabulary and report per-category N/A and blocked counts.
- Engagement state schema 2 → 3 (transparent migration; `variants` and `position` added).
- UI split into `js/ui/dom.js`, `js/ui/card.js`, and `js/ui/family-view.js`, with `js/ui/workspace.js` as the orchestrator.

### Fixed (Tester-first round 2 — found by running the application)

- **PRE-EXISTING BUG:** dashboard attack-chain and retest lists rendered the anchor's href as text (`element('li', '', anchorNode)` stringifies a node), so five identical URLs appeared instead of chain titles.
- **PRE-EXISTING BUG:** N/A counted as tested — the dashboard "Tested" metric, coverage percentage, category progress, and the exported checklist all treated a scoped-out or blocked item as completed work.
- **Redundancy removed:** the card's "Quick Test" was `steps.slice(0, 4)` while 607 of 623 items have exactly four steps, so every card printed the same procedure twice.

### Added (Functionality testing — test the application, not just the code)

- `tools/functional-workflows.mjs`: executes the REAL application (app.html + all UI modules) inside a jsdom window with real HTTP against the local server, real localStorage, real event dispatch, and simulated browser reloads. 41/41 checks: Workflow 1 (full WAPT journey: wizard → preset → dashboard → search → filters → methodology → status → note → evidence pack → report → export → reload → import), Workflow 2 (attack chain: prerequisite completion → node unlock → status chips), 12 edge cases, keyboard/theme/print, and a runtime audit (123 requests, all same-origin, zero external, zero console errors).
- `docs/FUNCTIONAL-TEST-REPORT.md` with the feature matrix, workflows, and bug ledger.

### Fixed (found by actually running the application)

- Dashboard crash: `ReferenceError: chainStore is not defined` in the Phase 5 chain-overview panel blocked Suggested next (REGRESSION) — the store is now passed as a parameter with a regression test.
- Card and evidence handlers captured render-time state; a write through a replaced DOM node could clobber a newer status change (latent stale-closure bug) — all handlers now read live state through an accessor, with an explicit stale-node regression check.
- Evidence-pack decision stage only refreshed on text `input` events; select and checkbox changes never updated it (PRE-EXISTING) — stage refresh now binds `input` and `change`.

### Added (FFV round 3 — baseline comparison & per-phase regression proof)

- `tools/regression-history.sh`: mechanically runs the Node suite at the baseline commit and every phase commit (worktree-based, reproducible).
- `tools/baseline-probe.mjs`: behavior probe that runs unchanged at baseline and current — URL hints, applicability, Suggested-next determinism, state round trip, import rejection.
- Recorded evidence: baseline `f043197` 158/158 green; two early commits transiently red by commit atomicity (4 + 10 stale assertions, resolved at `6a0bc05`); 9 later commits all green (172→220). Original baseline tests run against current code: 136/158 pass unchanged, 22 intentional contract changes, 0 regressions. Probe parity confirmed for all unchanged engine behavior; intentional deltas documented (3 new attributes, SSRF gate Active→Confirm, state v2 + migration, 1 MB→5 MB import cap).

### Added (FFV round 2 — strict parameter re-audit)

- Payload reference values now expose a copy control (clipboard with fallback and accessible label) — the only "Copy works" parameter that had no implementation.
- Verification additions: every filter key exercised individually over all 623 items, per-category count equality, preset-edit preservation, simulated browser reload of the portfolio, note deletion, import fuzz for missing fields/unknown IDs/invalid statuses/wrong types, full five-severity report matrix with long text/code blocks/CRLF, all three retest verdicts, engagement-size performance (20/150/500 items), and per-host external reachability classification.
- Neutral chip text contrast asserted in both themes.

### Fixed (FFV round 2)

- Light-theme `--muted` chip text at 4.34:1 on chip surfaces (PRE-EXISTING accessibility bug) — token deepened to `#5c6672` (5.09 on chips, 5.43 on paper).

### Added (FFV — full functionality verification)

- `tools/verify-links.js` link audit (97 local references resolve; 15 external hosts allowlist-classified) and `tools/measure-performance.js` benchmark recorder.
- `tests/verification.test.js` (11 scenarios: search/filter correctness over all 623 items, status state machine, retest-evidence immutability, malicious-import fuzzing, export/import equivalence, report injection matrix, chain resolution/boost, payload/Burp completeness, data consistency, no-eval sweep, performance ceilings).
- `tests/accessibility-contrast.test.js`: computed WCAG contrast for body, muted, brand, and all severity chips in both themes.
- `docs/FEATURE-VERIFICATION.md`: full verification matrix with the 17-section report, defect classification register, performance measurements, and honest NOT TESTED rows.

### Fixed (FFV)

- Light-theme severity-chip contrast below WCAG AA (high 4.28, medium 4.31, low 4.30) — tokens deepened to #c41212 / #a03e00 / #016a3e; all chip text now ≥ 4.5:1 (PRE-EXISTING BUG).
- Stale counts in methodology.html and README after the Phase 3 bump (609/24 → 623/25) (NEW REGRESSION, documentation).
- Import cap raised 1 MB → 5 MB so legitimate evidence-pack exports round-trip (PRE-EXISTING design bug amplified by Phase 4).
- workflow.html added to sitemap.xml (PRE-EXISTING documentation gap).

### Added (Phase 6+7 — QA, automation, and release hardening)

- Vocabulary parity test: the validator's context vocabulary and the engine's `ATTRIBUTE_OPTIONS` must stay byte-identical.
- Severity-diversity audit rule: a category with fewer than two severity levels fails content audit; HTTP re-rated honestly (CORS credentialed-read, compression-oracle, and framing-translation items raised to high; open-redirect item lowered to low).
- End-to-end workflow test: scope → prioritized queue → confirmed finding → evidence pack → reportable gate → retest verdict → coverage → report generation.
- Dashboard hydration split: metrics render from the manifest before the full catalog loads.
- New `docs/EVIDENCE-WORKFLOW.md` (designed documentation page) covering the finding-decision gate, evidence-pack fields, retest verdicts, and coverage math.
- Release-state matrix in `docs/RELEASE.md` with honest per-dimension status: content/reference/automated/security QA green, browser and visual QA pending maintainer sign-off, deployment pending merge.

### Added (Phase 5 — visual and interaction modernization)

- Dashboard command center: six metrics (catalog, tested, potential, confirmed, credential-blocked, scoped-out), coverage-confidence panel, retest queue panel, and attack-chain progress panel — answering "what should I test next" at a glance.
- Homepage: project metrics driven by `release.json` (validated tests, security domains, attack chains, payload references, Burp workflows), a six-step assessment-loop pipeline (scope → discover → prioritize → test & validate → report → retest), and an attack-chain preview linking into the workspace; CTAs restructured around "Start a WAPT".
- Removable active-filter chips with clear buttons above checklist/search results; fixed category views shown as context chips.
- Skeleton loading states replacing bare "Loading…" lines; the only animation is a reduced-motion-safe shimmer.
- Severity and status glyphs (with text labels, color-independent) across cards, findings, evidence chips, and chain nodes.
- Keyboard shortcuts dialog (`?`), `g d` / `g c` / `g f` navigation with findings focus, `/` search, `Esc` close — all inert inside inputs, notes, and filters.
- Accessibility and readability: 44 px minimum touch targets on coarse pointers, chip and authorization-bar typography floors raised at compact widths, hover elevation restrained to pointer devices.
- Homepage performance: applicability statistics fetch the catalog only when a scoped engagement exists; project metrics come from the small `release.json`.
- Payload library empty state now tells the user how to recover from an empty result set.

### Added (Phase 4 — attack paths, evidence, findings, and retesting)

- Engagement state schema v2 with structured evidence packs: finding ID, checklist item, title, severity, endpoint, method, parameter, authentication context, precondition, baseline/test requests, observed behavior, exploitability, reportable flag, cleanup, root cause, retest verdict (`pending`/`pass`/`partial`/`fail`) and retest note. Schema v1 records and exports migrate transparently in `normalizeState`, `importState`, and the portfolio loader.
- Evidence packs can only be recorded for Confirmed Findings; 200-pack cap, per-field length caps, strict import of unknown schema versions.
- Pure finding-decision engine (`reportability.js`): observation → weakness → exploitability demonstrated → reportable, driven by recorded evidence and surfacing the item's do-not-report boundary; residual-risk guidance per retest verdict plus retest variant suggestions.
- Pure coverage-confidence engine (`coverage.js`): recorded work over executable work, with context-N/A scoped out of the denominator and credential-blocked work counted separately; dashboard coverage panel and executable-based category progress.
- Evidence-pack workflow in the dashboard: inline record form on confirmed cards with live decision-stage feedback, evidence pack cards with verdict controls, and a retest queue count.
- Attack-chain nodes now render per-node status chips and unlock-ready state from engagement progress.
- Report generator gains an Evidence packs table and a retest matrix with verdicts and residual-risk guidance, all HTML-safe.

### Added (Phase 3 — modern coverage and attack-surface intelligence)

- New gated AI / LLM security category (25th category, `WAPT-AI`, floor 8): eleven original items covering direct and indirect prompt injection, system-prompt disclosure, retrieval authorization and corpus poisoning, tool-call argument injection, excessive agency, insecure output handling, cross-tenant context leakage, model-assisted SSRF, and generation/tool-loop cost abuse — all mapped to PortSwigger Web LLM attacks, the OWASP LLM Top 10, and the OWASP GenAI LLM Top 10 2026 (live-verified), with CWE mappings and per-item safety boundaries.
- XS-Leaks cross-site-channel assessment and back-forward-cache state-resurfacing tests in the client-side category (WAPT-CLIENT-030/031).
- Subdomain-takeover identification in reconnaissance (WAPT-RECON-038) with a hard safety boundary: identification and reporting only, never claiming third-party resources; pinned to the newly verified WSTG v4.2 CONF-10 page.
- Explainable category rationale in the checklist view (`js/engine/rationale.js`): each gated or boosted suite now shows why it is active, boosted, or awaiting confirmation.
- AI/LLM context boost in the priority engine; the new category sits in the advanced workflow stage.
- Reference snapshot extended: WSTG v4.2 CONF-10 pinned (84 paths), OWASP GenAI LLM Top 10 2026 and WHATWG HTML session-history pages verified (46 live-verified non-WSTG URLs).
- Catalog now 623 production items across 25 categories; cache version promoted to `1.0.0-r5`.

### Added (Phase 2 — reportability)

- Phase 2 reportability layer: optional `do_not_report` (minimum 25 characters, verbatim reuse rejected) and `retest_guidance` (minimum 40 characters) fields in the item contract, validator, and content audit.
- Explicit reporting boundaries authored for all 24 security-header tests, all 12 rate-limiting tests, CORS (HTTP-015–019, API-031), version/source-map/directory/robots disclosure, DNS records, JWT and session token storage, client-code readability, and HTTP method findings — 51 items total, each entry item-specific.
- Concrete retest guidance for policy deployment, CORS allowlists, throttling, token-storage migration, and version-disclosure remediations (12 items).
- Methodology cards surface "Reporting boundary" and "Retest guidance" sections.
- Content-audit rules: boundary-prone items must carry `do_not_report`; duplicated boundary wording fails; audit report metrics track `doNotReport` and `retestGuidance`.

### Added (post-release review)

- Three new adaptive scoping questions: intermediary layers (CDN, reverse proxy/gateway, WAF), server-side outbound URL fetching (webhooks/callbacks, import/preview/rendering), and asynchronous jobs. The wizard now exposes 18 questions; static delivery with no API reconciles outbound-fetch and asynchronous-job answers automatically.
- Category gate for SSRF on confirmed outbound URL fetching, with unknown scope keeping the whole suite visible as Confirm.
- `ai_llm` feature option plus a gated LLM prompt/tool-call authority test (WAPT-ADV-019) mapped to PortSwigger Web LLM attacks and the OWASP Top 10 for LLM Applications, with CWE-20; production catalog is now 609 items.
- Cache-poisoning and cache-deception tests (WAPT-ADV-001–004) now gate on a confirmed CDN/proxy layer; shared-cache HTTP tests and the request-smuggling suite receive intermediary-driven priority boosts.
- Asynchronous-job-specific authorization, injection, and business-logic tests now require confirmed background processing; URL-fetching API tests require a confirmed fetching surface; webhook-signature verification requires confirmed webhooks.
- Suggested next rows now explain the recommendation: applicability state, category, severity, context reasons, and chain unlocks.
- Privacy regression suite pinning same-origin-only fetches, the single `wapt.state.v1` storage key, the identical restrictive CSP, and collapsed REVIEW-ONLY payload content.

### Fixed

- Compact-phone engagement manager no longer hides the delete control; the switcher recomposes to keep new and delete visible at 320–430 px.
- Removed `aria-live` announcements from large re-rendered test lists (summaries remain live), and corrected `aria-label` usage on decorative homepage/methodology groups.
- Cache version promoted to `1.0.0-r4` consistently across every HTML entry point and browser module import.

### Changed

- E-commerce preset now asserts realistic payment-callback (`webhooks`) and asynchronous-order context; other presets answer the new questions conservatively as unknown.
- Reference snapshot extended with live-verified OWASP LLM Top 10 and PortSwigger Web LLM attack URLs (44 verified non-WSTG URLs).

## [1.0.0] - 2026-08-18

### Added

- Adaptive wizard branching that skips identity questions when authentication is absent and runtime/data/API-definition questions when earlier scope answers make them irrelevant.
- Identity-capability scoping for MFA, passkeys, recovery, passwordless, and trusted devices, plus API-only delivery support that removes browser-runtime work and improves protocol suggestions.
- Eight analyst presets covering static sites, SaaS, enterprise SSO, commerce, REST/mobile APIs, GraphQL, document portals, and realtime chat.
- Broader explicit “none,” “mixed / other,” and modern mechanism choices across role, identity, backend, data, hosting, API, and workflow questions.
- Multiple independently resumable local engagements with switching, creation, deletion, automatic legacy-state migration, and clear local-storage/no-backup disclosure.
- Version 1.0.0 release manifest, deployment runbook, release consistency tests, final CI/deploy quality gates, and cache-version promotion.
- Responsive release hardening for monitor width caps, laptop dashboard recomposition, tablet off-canvas navigation, compact-phone action stacks, long-content overflow, and mobile focus isolation.
- Designed methodology and documentation experiences for security, contributing, licensing, architecture, QA, release guidance, and Burp workflows, replacing user-facing raw text/Markdown navigation.
- Phase 9 zero-dependency content audit for exact/near duplicates, imperative wording, terminology, placeholders, evidence/false-positive depth, risky-technique safety, payload syntax, and integrated reference/Phase 7 validation.
- Human and machine content QA reports covering all 608 items, with zero unresolved errors or warnings.
- Phase 8 authoritative reference catalog and zero-dependency offline/live checker for WSTG paths, ASVS IDs, edition-qualified Top 10 mappings, PortSwigger URLs, CWE links, and source domains.
- Reference QA tests covering all 608 production items, 83 pinned WSTG pages, 153 used ASVS 5.0.0 requirements, 104 MITRE-verified CWE weaknesses, 42 live-verified non-WSTG URLs, and mapping editions.
- Removed prohibited CWE category mappings (`CWE-16`, `CWE-840`) and replaced configuration cases with specific weakness mappings where appropriate.
- Phase 7 directed attack-chain library with five validated DAGs, bidirectional checklist memberships, linked UI cards, and Suggested next unlock boosts.
- Contextual payload/reference library with 24 safety-labeled entries, searchable browser UI, related test IDs, and collapsed REVIEW-ONLY content.
- Safe Burp workflows for Proxy, Repeater, Intruder, Scanner, Comparer, Decoder, Sequencer, Logger, Param Miner, Autorize, Turbo Intruder, and Collaborator.
- Extended semantic validation for chain resolution/acyclicity, payload schema/count/safety, and Burp workflow completeness.
- Completed Phase 6 with 260 advanced production items and 608 total items across all 24 categories; every independent floor passes.
- Phase 5 lazy category workspace, complete methodology cards, adaptive applicability presentation, reasoned overrides, status/retest controls, and local tester notes.
- Full-text methodology search and combined category, severity, difficulty, status, mode, applicability, technology, tool, tag, and test-ID filters.
- Dashboard category progress, context-aware Suggested next queue, findings table, and live sidebar tested counts.
- Client-side Markdown checklist/report generation, findings summary, retest matrix, strict JSON import/export, HTML-safe notes, and A4 print view.
- Phase 5 tests for exact CORS indexing, combined filters, category fetch caching, safe Markdown, report/retest composition, and workspace shell controls.
- Completed Phase 4 categories 01–10 with 348 original, context-aware production items; every core category floor passes without counting review samples.
- Incremental production-floor validation (`--floors-present`), production document envelope checks, manifest/file count tests, and reconnaissance safety/content QA assertions.
- Phase 3 pure context, applicability, priority, and state engines shared by the browser and Node tests.
- Active, Confirm, and context-N/A evaluation with machine-readable reasons, URL-hint uncertainty, visible blocked credential work, and conditional variants.
- Deterministic Suggested next scoring with bounded workflow, severity, prerequisite, context, and attack-chain components.
- Strict local-state normalization, immutable item updates, reasoned overrides, JSON import/export, and Confirmed Finding retest rules.
- Unit and scenario coverage for every derivation rule, all eight presets, URL-hint hardening, state round trips, and priority behavior.
- Phase 2 static homepage and application workspace shell.
- Eight editable analyst presets spanning static, SaaS, SSO, commerce, REST, GraphQL, document, and realtime applications.
- Optional target and engagement fields plus all 15 context questions.
- Local-only persistence under `wapt.state.v1`, wizard navigation, progress, reset, and keyboard behavior.
- Manifest-driven 24-category navigation and honest live project/engagement statistics.
- Independent dark/light design tokens, responsive application layout, print baseline, logo, favicon, and self-hosted Sora and IBM Plex Mono fonts.
- Restrictive page CSP, authorized-use notices, reduced-motion support, and visible focus treatment.
- Apache-2.0 license, contributor guide, security policy, sitemap, robots policy, and ready-to-apply GitHub Pages/CI workflow templates.
- Phase 2 preset and static-shell test coverage.

## [0.1.0] - 2026-08-17

### Added

- Phase 1 architecture, taxonomy, content guidance, item schema, semantic validator, and 20-item review sample.
- Stable 24-category ID system with a quality-gated floor of 512 production items.
- ASVS 5.0.0 and WSTG 4.2 versioning policy.

### Added (Tester-first UX — steps 1–7 of docs/TESTER-UX-REVIEW.md)

- Four-level tester-first cards: always-visible Quick Test + Validate, Don't miss & related (family don't-miss, variants, related chips, next-in-family), unchanged Detailed methodology, References & mappings, and a Tester notes & evidence drawer with a second quick status control.
- `checklist/families.json`: 196 test families covering all 623 items across all 25 categories exactly once, each with a specific don't-miss coverage list; validator gates resolution, uniqueness, specificity, and per-category completeness (`tools/build-families.py` documents authoring).
- Category views group cards under family headers with summaries and tested/total counts; Coverage ⇄ Testing view toggle with family tick lists, progress bars, and scoped-out summaries.
- Tester-aware Suggested next: related-proximity (+18) and family-continuation (+16) signals with reasons, fed by recent-touched status tracking.
- Status vocabulary relabeled (Not Started / Active / Not Vulnerable / Potential Finding / Confirmed Finding / N/A; engine values unchanged), `n`/`p` card walk, and `Esc`/shortcut coexistence.
- Runtime harness now 51 checks including the four-level card, family groups, coverage journey, labels, and keyboard walk.
