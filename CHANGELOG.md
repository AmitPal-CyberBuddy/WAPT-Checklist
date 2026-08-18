# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses semantic versioning.

## [Unreleased]

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
