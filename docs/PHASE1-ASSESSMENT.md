# Phase 1 — Architecture, Content, and UI Audit + Modernization Plan

> Prepared 2026-08-18 against `arena/01a01429-wapt-checklist` (PR #3 branch, 609 production items).
> This document is the **Phase 1 deliverable only**. No phases 2–7 work begins until it is reviewed.

## 1. Executive summary

The repository is a genuinely solid static, local-first WAPT workspace: a pure adaptive engine shared verbatim between browser and Node tests, a validated 609-item content catalog with an honest quality model, five attack chains, 40 safety-labeled payload references, 12 Burp workflows, a restrictive CSP, and a green zero-dependency CI/Pages pipeline. The previous review pass (PR #3) already verified the baseline gates, fixed five verified defects, and added three scope dimensions (`intermediary`, `outbound_fetch`, `async_jobs`) plus one gated LLM item.

The gap between today's product and the stated end state ("assessment operating system") is **not** checklist volume. It is four things, in priority order:

1. **Reportability is implicit.** Only 5 of 609 items contain explicit "do not report" language; the schema has no `do_not_report` field. The Observation → Weakness → Exploitability → Finding decision exists in spirit (validation/false-positives fields) but is not a first-class, testable, teachable artifact.
2. **No structured findings/evidence model.** Evidence guidance is per-item prose; captured state is item status + free-text note + one retest boolean. The Evidence Pack and retest PASS/PARTIAL/FAIL workflow require a state-schema v2 with migration.
3. **Thin modern coverage in two verified areas.** AI/LLM (1 gated item), XS-Leaks family (0 items). Everything else on the requested Phase 3 list already has real coverage (API, cloud, multi-tenant, payments, JWT/OAuth/SAML, smuggling, cache poisoning).
4. **Workflow presentation.** Attack chains are static lists without per-node state; there is no coverage-confidence metric; Suggested next (already deterministic and now explainable) is the only "what next" surface.

Everything else in the plan — visual polish, skeletons, shortcuts, dashboard composition — is valuable but secondary, and must respect the two hard constraints discovered in review: **no headless browser exists in this environment** (visual changes can only be source-asserted + manually signed off), and **`gh` cannot push `.github/workflows/**`** (workflow changes remain maintainer-installed).

## 2. Architecture assessment

### 2.1 Runtime architecture

```text
Browser (GitHub Pages, project subpath, no build step)
 ├─ Static pages: index / app / methodology / docs / workflow (identical restrictive CSP)
 ├─ UI modules (DOM-aware, cache-busted ES modules, ?v=1.0.0-r4)
 │   ├─ app.js          portfolio bootstrap, routing, sidebar, shortcuts (/)
 │   ├─ wizard.js       18 adaptive questions + 8 presets + local URL hints
 │   ├─ workspace.js    dashboard, checklist/search renderers, cards, suggested next
 │   ├─ catalog.js      lazy category fetch with promise de-duplication and caching
 │   ├─ chains.js / payloads.js / export.js / filters.js / markdown.js
 │   └─ theme.js + theme-boot.js (pre-paint, same storage key)
 ├─ Engine modules (pure, DOM-free; identical under node --test)
 │   ├─ context.js          normalize + reconcile answers, URL hints
 │   ├─ applicability.js    Active / Confirm / N/A + category gates + credential roadmap
 │   ├─ priorities.js       deterministic suggested-next scoring
 │   ├─ state.js            engagement CRUD, notes, overrides, retest flag, import/export
 │   └─ portfolio.js        multi-engagement localStorage portfolio + legacy migration
 └─ Same-origin data
     ├─ checklist/manifest.json → 24 category JSON files (~2.36 MB total, lazy-loaded)
     ├─ attack-chains/*.json (5 DAGs) · payloads/** (40 refs, 14 REVIEW-ONLY) · burp-workflows/*.md (12)
```

Key property: **policy lives in `js/engine/`, presentation in `js/ui/`.** Every applicability/priority/state rule is exercised by Node tests against the same source the browser imports. Storage access is confined to the UI adapters; `state.js` is a pure transform. This is the architecture to preserve and extend, not replace.

### 2.2 Content contract

Every item carries the schema-required decision procedure: `objective`, `prerequisites`, ordered `steps`, sanitized `examples`, `manipulate`, `secure_behavior` / `vulnerable_behavior`, `validation`, ≥2 `false_positives`, conditional `impact`, ≥3 `evidence`, `tools`, authoritative `references`, versioned `mappings`, `related`, `tags`, `attack_chains`, declarative `applies`, and `variants`; `safety` (365/609), `remediation` (609/609), and `priority_when` (140/609) where applicable. Validators enforce the contract, category floors, reference allowlists, and a content audit with no unresolved errors or warnings.

### 2.3 State and persistence model

One key, `wapt.state.v1`, holds a versioned portfolio (`kind: wapt-engagement-portfolio`, v1): up to 100 engagements, one active ID, per-engagement state (`schema_version 1`: answers, statuses, notes, overrides, retests) and the theme preference. Normalization strips unknown fields, bounds text, validates item IDs; import is strict (≤1 MB, schema-version checked, malformed JSON rejected); the legacy single-engagement document migrates automatically. Confirmed-finding retest flags are invariantly tied to status.

### 2.4 Delivery and QA pipeline

GitHub Pages (workflow build, `main`, HTTPS enforced). CI + deploy run the identical gates: `node --test`, sample validation, `--floors`, `check-references.js`, `audit-content.js`. Reference QA uses pinned WSTG 4.2 snapshot paths, a 5.0.0 ASVS ID set, MITRE-verified CWE IDs, edition-qualified Top 10 pairs, and a live-verified URL snapshot. The deploy workflow itself is byte-matched with `docs/workflows/` templates because this session's GitHub App cannot push `.github/workflows/**`.

### 2.5 Verified metrics (this branch)

| Dimension | Value |
|---|---|
| Production items / categories | 609 / 24 (floors all green) |
| Tests | 172 pass (58 production-data, 23 scenarios, 8 wizard-adaptive, …) |
| Content fields | 365 safety, 609 remediation, 19 variant sets, 809 references |
| Contextualization | 277 items with `requires`, 220 with `excludes`, 204 with `any_of`; 140 `priority_when`; **139 fully unconditional** |
| References/mappings | 231 unique URLs, 83 WSTG pages, 153 ASVS, 104 CWE, 534 CWE + 477 ASVS + 421 WSTG mapping entries |
| Connected libraries | 5 chains, 40 payloads (14 REVIEW-ONLY, collapsed), 12 Burp workflows |
| Data payload | manifest 6.9 KB; all 24 category files ~2.36 MB (dashboard loads all of them) |
| Runtime dependencies | 0 (no build, no CDN, self-hosted fonts) |
| Storage keys | exactly `wapt.state.v1` (pinned by `tests/privacy.test.js`) |
| Deployment | Pages active; last deploy successful on `main` @ f043197; PR #3 CI green |

## 3. Current strengths (preserve these)

1. **Pure engine, dual-runtime.** DOM-free policy modules tested identically in Node and browser — the single most valuable architectural decision in the repo.
2. **Explicit uncertainty.** Unknown answers produce Confirm, never silent hiding; credential-blocked work stays visible with reasons; overrides require written justification. This is exactly the right safety posture for an assessment tool.
3. **Content quality is enforced, not aspirational.** Floors, schema, reference allowlists, CWE/ASVS/WSTG verification, near-duplicate detection, imperative-title checks, and terminology rules all run in CI.
4. **Safe-by-default libraries.** REVIEW-ONLY payloads never auto-expand; smuggling/race/SSRF items carry per-item stop conditions; no smuggling payload bytes are shipped at all.
5. **Privacy architecture.** No backend, no telemetry, no external request, target URL parsed locally and never fetched, restrictive CSP, single storage key, local-only disclosures present on every relevant surface.
6. **Honest reporting posture.** The report generator ships with a reporting quality gate and the UI repeats "scanner lead ≠ finding" in the findings empty state.
7. **Backward compatibility discipline.** Legacy state migration, strict imports, stable IDs, cache-version promotion with a consistency test.

## 4. Current weaknesses and technical debt (verified)

### 4.1 Product-level

| # | Issue | Evidence | Severity |
|---|---|---|---|
| W1 | **Reportability is not a first-class field.** No `do_not_report` in the schema; explicit do-not-report phrasing appears in **5/609** items; `false_positives` mentions reporting in 10/609. The CORS/JWT-in-localStorage/headers/rate-limiting guidance requested in plan §2.2/2.3 is implicit in `validation` at best. | audit + grep | **High** |
| W2 | **No structured finding/evidence records.** Captured evidence = per-item note (free text, 20 KB) + status + retest boolean. The Evidence Pack (plan §4.2) and retest PASS/PARTIAL/FAIL (§4.4) cannot be modeled on state v1. | `state.js` | **High** |
| W3 | **No coverage-confidence metric.** Progress is tested/count per category; N/A is excluded implicitly rather than shown as scoped-out; no Blocked/Needs-Review/Retest rollup (§4.5). | `workspace.js` | Medium |
| W4 | **Attack chains are static renders.** Nodes show ID + unlock condition only; no per-node status, severity, findings, or progress state (§4.1/5.10). | `chains.js` | Medium |
| W5 | **AI/LLM coverage is one item** (WAPT-ADV-019, added in PR #3) inside `advanced`, not a dedicated surface (§3.1). | content probe | Medium |
| W6 | **XS-Leaks / cross-site-leak family absent (0 items);** no bfcache or explicit cache-partitioning item (0 items). Trusted Types has exactly 1 (XSS-029); postMessage/workers/DOM-clobbering/prototype-pollution each have 1–3 focused items, which is adequate depth. | content probe | Medium |
| W7 | **Subdomain takeover absent (0 items).** Defensible, but the identification half (dangling CNAME/NS records) is reportable-worthy reconnaissance and currently unrepresented. Note: *claiming* third-party resources can never be part of an item; an identification-only item with a stop condition is the honest version. | content probe | Low |
| W8 | **139/609 items are fully unconditional** (http 25/26, security-headers 24/24, information-disclosure 18/18, request-smuggling 14/14). Mostly legitimate universals, but several could gain `any_of` gates (e.g., desync work on `intermediary`, disclosure tests on `cloud`, OPTIONS/TRACE on `app_type`). PR #3 already added `priority_when` for smuggling rather than hiding; the same pattern should be audited per item. | content probe | Low |

### 4.2 Performance

- Dashboard `ensureAll()` fetches **all 24 category files (~2.36 MB)** before first render; category view is lazy, dashboard/search/chains are not. On a warm Pages cache this is fine; on slow links it delays the operational surface. **Recommendation:** dashboard renders metrics from the manifest immediately, then hydrates; or fetch categories lazily with a progress state.
- Checklist/search re-render **all matching cards from scratch on every status change** (no diffing/virtualization); "All tests" = 609 full cards. Acceptable at this scale, but the retest/findings work in Phase 4 should introduce stable rows and incremental updates.
- `styles.css` is one ~50 KB file of dense single-line rules with **two overlapping responsive systems** (homepage breakpoints at 1050/820/600 and app breakpoints at 1150/960/820/600/520/430/380). Works today; refactoring risk is real — Phase 5 must be incremental.

### 4.3 Tooling debt

- No headless browser → no visual regression (plan §6.6) is possible in CI here; substitute source-level CSS/DOM assertions + a manual sign-off matrix.
- `tools/validate.js` duplicates the context vocabulary from `js/engine/context.js` (both updated in PR #3; a divergence test should pin them together).
- UI coverage is source-assertion based (workspace 6, shell 8, responsive 4 tests); engine/content coverage is strong (production-data 58, scenarios 23).

## 5. Content gaps (verified, prioritized)

1. **Do-not-report boundary per item** (plan §2.2/2.3) — highest value, additive field, no behavior risk. Targets: CORS items (HTTP-015/016/018), every security-header item, JWT storage (JWT-018/SESS-019), rate-limiting (RATE-*), version disclosure (INFO-010), robots/sitemap (INFO-015), source maps (CLIENT-026/INFO-004), TRACE/OPTIONS (HTTP-001), DNS (RECON-003), directory listing (INFO-009).
2. **AI/LLM category** (plan §3.1) — a focused, gated category (~8–12 items) covering: direct/indirect prompt injection; retrieval (RAG) authorization and poisoning; tool-call authorization and excessive agency; model output handling (XSS/CSRF-adjacent sinks); generated-code execution (SQL/command via model output); cross-user/tenant context leakage; model-assisted SSRF (fetch tools); denial-of-cost. Explicitly **excluded**: "jailbreak prompt" catalogs, model-agnostic theory without a web surface, anything unreachable behind `features:ai_llm`.
3. **XS-Leaks family** (plan §3.2) — 1–2 items: cross-site search/leak channels via cache timing, scroll/event oracle, and browser partitioning assumptions; plus one bfcache/persistent-cache item folded into session/info disclosure retest guidance.
4. **Subdomain takeover identification** — one recon/cloud item with "identify and report dangling CNAME/NS records; never claim or point third-party resources" safety boundary.
5. **Attack-surface → methodology mapping** (plan §3.4) — the engine already boosts these families (JWT, GraphQL, WS, multi-tenant, payments, API-only, intermediary). What is missing is *visible explanation*: the Suggested-next reason line (added in PR #3) is the first step; extend it to category-level "why this suite is active" summaries on the dashboard/catalog cards.

## 6. UI/UX issues

### Fixed in PR #3 (verified defects)
- Wizard option focus invisible (`opacity:0` inputs) → visible ring via `:has(input:focus-visible)`.
- Engagement delete hidden <430 px → recomposed compact manager.
- `aria-live` on huge re-rendered lists → removed (summaries stay live).
- `aria-label` on plain divs → `role="group"`.
- Suggested-next rows now explain state/category/severity/reasons/chain unlocks.

### Remaining (ordered by value)
1. **Dashboard composition** (plan §5.3): currently metrics + Suggested next + progress + findings. Add coverage confidence (W3), a retest queue surface, and blocked/needs-credentials counts. Pure additions to existing panels.
2. **Attack-chain nodes** (plan §5.10): render per-node status from state (needs statuses passed into `chains.js`), link nodes to `#checklist/<category>` anchors, show unlock state. Static HTML still — no canvas library, per Rule 7.
3. **Status iconography** (plan §5.6): labels already exist; add icon-only color-safe indicators (chip glyphs) — low risk.
4. **Active-filter chips + clear all** (plan §5.9): filter state already exists; render chips above results. Low risk.
5. **Loading skeletons** (plan §5.12): replace `loading-line` text with lightweight skeleton blocks; keep reduced-motion-safe.
6. **Keyboard shortcuts** (plan §5.18): `/` exists. Add only non-interfering chords: `g d` (dashboard), `g c` (categories), `g f` (findings), `?` (shortcut help), `Esc` already closes drawer. No single-letter global shortcuts (would break typing).
7. **Typography/scale fixes at 380px**: `.chip {font-size:.48rem}` and `.authorization-bar {font-size:.53rem}` are below readable size at 200% zoom targets — verify in browser and raise floors.
8. **Empty states** (plan §5.13) mostly exist and already tell users what to do next; only retest-queue and coverage empties are new.
9. **Homepage metrics** (plan §5.2): live stats already render; add attack-chain/payload/workflow counts as static, manifest-driven figures (not fetched counts) so the page stays honest.

### Deferred without a browser (honest constraint)
Full visual redesign sweep (5.1, 5.14–5.16 polish pass), animation retiming (5.11), and visual regression (6.6) require screenshots. This environment has no Chromium/Firefox. They are planned as source-asserted changes plus the manual sign-off matrix in `docs/QA.md`, not silently claimed as verified.

## 7. Security and privacy concerns

**No open findings.** Verified in the previous pass and now pinned by `tests/privacy.test.js`:

- Same-origin-only fetches (all relative; target URL never requested anywhere).
- Exactly one localStorage key, `wapt.state.v1`; theme shares it; no sessionStorage.
- Identical restrictive CSP on all five pages (no inline script/style; self-hosted fonts).
- Strict import (1 MB cap, schema check, malformed JSON rejected), HTML-safe note escaping in exports, legacy migration, engagement isolation.
- REVIEW-ONLY payloads collapsed; authorized-testing and redaction guidance visible on all surfaces.

Residual notes for the plan: (a) the export file name embeds the engagement name — safeFilename already sanitizes it; (b) localStorage has no encryption — the disclosure copy already says so, keep it accurate; (c) any future finding/evidence records must reuse the same strict normalization discipline (no unbounded text, redaction hints per field).

## 8. Recommended architecture changes (all additive, backward-compatible)

| Change | Rationale | Compatibility |
|---|---|---|
| **A. Content schema v1.1** — optional `do_not_report[]` and `retest_guidance` fields; validator + audit + content-QA rules; no required-field changes | W1, plan §2.2/2.3 | Additive; old items validate unchanged |
| **B. State schema v2 + migration** — per-engagement structured `findings[]` (id, checklist id, title, endpoint/method/param, auth context, baseline/test requests, observed behavior, exploitability, reportability, cleanup, root cause, retest verdict `pass|partial|fail|pending`) with redaction field rules | W2, plan §4.2/4.4 | `portfolio.js` already migrates legacy v1 → portfolio; add portfolio_v2 + finding schema with v1→v2 upgrade in `normalizePortfolio`; exports include findings; v1 imports still accepted |
| C. **Pure `reportability.js` engine module** — `classify(observation) → {weakness?, exploitability?, reportable?, reasons}` consuming `validation`/`false_positives`/`do_not_report`; UI surfaces the decision in the findings flow | W1, plan §4.3 | Engine-only; DOM-free tests |
| D. **`coverage.js`** — status-weighted category + overall confidence (exclude N/A from denominator, show it as scoped-out; count blocked separately) | W3, plan §4.5 | Engine-only; dashboard consumes |
| E. **Chain node state** — pass `statuses`/`findings` into `chains.js` render; nodes show tested/confirmed/unlocked | W4, plan §5.10 | Render-only |
| F. **AI/LLM category** — new manifest entry `ai-llm-security` (prefix `WAPT-AI`, floor ~8), gated on `features:ai_llm`, new payload references REVIEW-ONLY as appropriate | W5, plan §3.1 | New category + gate; no existing IDs touched |
| G. **Vocabulary single-sourcing** — validator imports `ATTRIBUTE_OPTIONS` from `js/engine/context.js` (it is CommonJS-compatible via a small loader) or a JSON vocabulary file both consume | tooling debt | Internal refactor with a divergence test |
| H. **Dashboard hydration split** — manifest metrics render first; category data streams in behind them | §4.2 | Render-order only |

**Explicit non-goals:** no framework, no build step, no backend/telemetry, no CDN assets, no service worker (offline-first conflicts with the "reload from Pages" cache model), no canvas graph library, no item-count inflation.

## 9. Phase 2–7 implementation plan

### Phase 2 — Methodology engine & content quality
- **Files:** `schema/item.schema.json`, `tools/validate.js`, `tools/audit-content.js`, 24 category JSONs (targeted), `tests/schema.test.js`, `tests/production-data.test.js`, `docs/CONTENT-GUIDE.md`.
- **Tasks:** add `do_not_report[]` + `retest_guidance` (optional); author explicit boundaries for the W1 target list (CORS, headers, JWT storage, rate limits, version disclosure, robots, source maps, OPTIONS/TRACE, DNS, directory listing); merge/split review per §2.4 (no count inflation); extend audit with do-not-report coverage checks; regenerate content-QA report.
- **Tests:** schema round-trip for new fields; every item in the W1 list has non-empty `do_not_report`; validator/audit still green; total stays 609 unless splits/merges are justified per item.
- **Gate:** `node --test`, all four quality gates, `git diff --check`.
- **Defer:** finding-decision UI (Phase 4 consumes `reportability.js`).

### Phase 3 — Modern coverage & attack-surface intelligence
- **Files:** new `checklist/ai-llm-security.json` + manifest entry; `client-side.json`/`reconnaissance.json` (XS-Leaks, bfcache note, subdomain-takeover identification); `payloads/` new reference set; `js/engine/context.js` already has the gate (`ai_llm`); `js/ui/workspace.js` for visible "why active" explanations.
- **Tasks:** author ~8–12 gated AI items (direct/indirect injection, RAG authz+poisoning, tool authorization, output handling, generated-code execution, cross-tenant context leakage, model-assisted SSRF, cost-abuse) with real methodology + PortSwigger/OWASP GenAI references (live-verified before adding to snapshot); 1–2 XS-Leaks items; 1 identification-only subdomain-takeover item with hard safety boundary; category-level applicability explanations on dashboard/catalog.
- **Tests:** scenarios for the new category gate; reference snapshot additions; floor validation; near-duplicate audit against injection/xss/ssrf (AI items must not duplicate existing objectives).
- **Gate:** same as Phase 2, plus an updated reference snapshot.
- **Defer:** any agentic-AI or model-supply-chain testing that exceeds web-application scope.

### Phase 4 — Attack paths, evidence, findings, retesting
- **Files:** `js/engine/state.js`, `js/engine/portfolio.js` (v2 + migration), new `js/engine/reportability.js`, `js/engine/coverage.js`, `js/ui/workspace.js`, `js/ui/chains.js`, `js/ui/export.js`, `tests/state.test.js`, `tests/portfolio.test.js`, new `tests/reportability.test.js`/`coverage.test.js`.
- **Tasks:** state v2 with structured findings + redaction rules; v1→v2 migration with tests; reportability classifier; coverage dashboard panel + retest queue; interactive chain nodes with status; findings report section gains evidence/retest-verdict tables; retest variant suggestions (alternate IDs, bulk, export, API version, GraphQL equivalent) as content-driven related-ID hints.
- **Tests:** migration fixtures (v1 single + portfolio), malformed finding imports rejected, retest invariants (verdict only on confirmed findings), coverage math excludes N/A, chain node states.
- **Gate:** all gates + round-trip export/import with findings.
- **Defer:** screenshot/attachment support (local files bloat storage; notes can reference external filenames).

### Phase 5 — UI/UX modernization
- **Files:** `css/styles.css` (incremental), `app.html`, `js/ui/workspace.js`, `js/ui/chains.js`, `js/ui/payloads.js`, `js/ui/app.js` (shortcuts), `tests/responsive.test.js`, `docs/QA.md` sign-off matrix.
- **Tasks (in value order):** dashboard composition + coverage/blocked/retest surfaces; chain node states; active-filter chips; status iconography; skeletons; safe shortcuts; 380px typography floors; homepage metric cards; then the polish pass (tokens already sound — layered surfaces, restrained brand use — so "modernization" is incremental, not a redesign).
- **Tests:** CSS/HTML source assertions for each change; shortcuts gated to non-editable contexts; reduced-motion preserved; all manual sign-offs listed in `docs/QA.md`.
- **Gate:** all gates + **explicit manual browser matrix** (8 viewports, zoom, large text, both themes, keyboard, print) — marked as pending-maintainer, not falsely green.
- **Defer:** any animation rework beyond micro-durations; visual redesign beyond token-level polish.

### Phase 6 — Data quality, standards, automation, QA
- **Files:** `tools/validate.js` (vocabulary single-sourcing), `tools/check-references.js`, `tools/audit-content.js`, `tests/*`, CI templates (`docs/workflows/*`).
- **Tasks:** divergence test between validator vocabulary and `context.js`; audit §6.2 additions (mapping consistency, severity/difficulty distribution checks); engine QA extension (reportability, coverage, migration); UI source-QA extension; browser smoke = manual matrix + the existing `public-pages`/`privacy` suites; visual regression **cannot** run without a browser — implement static snapshot assertions (HTML structure/CSS rules) and document the limitation.
- **Gate:** same as Phase 2, plus updated CI templates (maintainer-installed).
- **Defer:** pixel-level visual regression until a browser-capable runner exists.

### Phase 7 — Final polish, release hardening, documentation
- **Files:** README, docs/* (architecture, engine, content guide, taxonomy, QA, release), CHANGELOG, `release.json`, `methodology.html`/`docs.html` copy.
- **Tasks:** performance pass (dashboard hydration split, render stability); security/privacy re-verification with the extended privacy suite; documentation for AI category, evidence/reporting, retest workflow, shortcuts, design tokens; release-state matrix in `docs/RELEASE.md` with honest per-dimension status (deployment pending maintainer merge stays visible); three-perspective final review checklist (tester / manager / CISO) added to `docs/QA.md`.
- **Gate:** full gate suite + deployment-path check + PR review; release metadata bumped with cache version promotion.
- **Defer:** nothing unstated.

## 10. Already done (PR #3 overlap map)

| Plan item | Status |
|---|---|
| §3.4 attack-surface → methodology mapping (JWT/GraphQL/WS/multi-tenant/payments/CDN boosts) | Done (existing + `intermediary` boost) |
| §2.6 safety metadata not auto-hiding tests | Done (Confirm/blocked model verified) |
| §3.1 AI/LLM — first gated item WAPT-ADV-019 | Done (started; full category deferred to Phase 3) |
| Suggested-next determinism + explanations | Done (PR #3) |
| Compact-phone engagement controls, wizard focus visibility, SR noise, valid ARIA | Done (PR #3) |
| Privacy regression suite | Done (`tests/privacy.test.js`) |

## 11. Decisions required before Phase 2

1. **AI/LLM**: dedicated `ai-llm-security` category (~8–12 items, recommended) vs extending `advanced`?
2. **Evidence pack**: structured state-schema v2 findings with migration (recommended) vs keeping free-text notes?
3. **UI scope**: incremental token-level polish (recommended) vs broader visual redesign?
4. **Sequencing**: proceed Phase 2 → 7 in order on this branch, or wait for maintainer review of this document first?

## 12. Constraints and risks

- **No headless browser here** — visual claims are limited to source assertions; the manual matrix stays an explicit release gate.
- **Workflow files** must be installed by a maintainer; templates in `docs/workflows/` stay the source of truth.
- **Rule 10 (backward compatibility)** is enforced by the migration design in §8-B; existing v1 exports keep importing after v2 ships.
- **Rule 2 (no count inflation)** is respected: target catalog after Phase 2–3 is ~620–625 items, each added against a verified gap, with the audit running at every phase.

## Phase status log

| Phase | Gate | Status | Evidence |
|---|---|---|---|
| 2 — Reportability | All gates green | **Complete** | `do_not_report` on 59 boundary-prone items, `retest_guidance` on 17; schema/validator/audit + UI cards + tests |
| 3 — Modern coverage | All gates green | **Complete** | AI/LLM category (11 items, 25th category), XS-Leaks + bfcache, subdomain-takeover identification, rationale engine; catalog 623 |
| 4 — Evidence & retesting | All gates green | **Complete** | State schema v2 + v1 migration, evidence packs, reportability classifier, coverage confidence, chain node states, retest verdicts |
| 5 — UI/UX modernization | All gates green | **Complete** | Dashboard command center, retest queue, chain overview, homepage project metrics + pipeline + chain preview, filter chips, skeletons, glyphs, shortcuts dialog, touch/typography floors |
| 6 — QA & automation | All gates green | **Complete** | Vocabulary parity test, severity-diversity audit rule (+4 honest HTTP re-ratings), end-to-end workflow test (196 tests) |
| 7 — Release hardening | All gates green | **Complete** | Dashboard hydration split, evidence-workflow doc, honest release-state matrix, roadmap, changelog, PR refreshed |
| FFV — Full functionality verification | All gates green | **Complete** | 220 tests; link audit (97 refs / 15 allowlisted hosts, per-host reachability classified); contrast audit (2 pre-existing bugs fixed); consistency audit (1 regression + 2 pre-existing docs fixed); payload copy control added; all filter keys, per-category counts, reload simulation, import fuzz, full report matrix verified; perf measured at 20/150/500-item sizes |
