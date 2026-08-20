# Architecture

> Version 1.0.0 implemented architecture — 2026-08-18

WAPT Checklist is a static, context-aware assessment workspace for authorized web application penetration tests. It is not a scanner and does not transmit target, engagement, note, or finding data.

## Architectural drivers

1. **Static first:** GitHub Pages serves HTML, CSS, ES modules, Markdown, fonts, and JSON. There is no build requirement, backend, telemetry, service worker, or runtime package dependency.
2. **Context is a first-class input:** questionnaire answers and conservative URL hints produce a normalized context. Pure engine functions evaluate content; UI code only renders their results.
3. **Content is data:** stable IDs, a documented schema, and CI validation let methodology evolve independently of presentation.
4. **Safe by default:** content assumes explicit authorization. Disruptive techniques require a `safety` note. Destructive or denial-of-service payloads are marked `review_only` and never expanded automatically.
5. **Portable private state:** one versioned localStorage portfolio stores multiple independent engagements, the active engagement, and the UI theme preference. Engagement state is schema version 3 — structured evidence packs, don't-miss variant coverage, and the tester's last position — and schema version 1 and 2 states migrate transparently on load. Per-engagement JSON export/import provides user-controlled portability.
6. **Families are the working unit:** `checklist/families.json` groups every production item into exactly one test family per category and carries the family's authored quick test, validation line, and don't-miss reminders. The workspace routes engagement → family → coverage → checks → don't miss → validate → next, while free navigation between any view stays available.
6. **Progressive loading:** the manifest supplies metadata and counts. Category JSON is fetched on demand with same-origin relative URLs.
7. **Accessible and dependency-free:** semantic HTML, keyboard operation, visible focus, WCAG AA themes, reduced-motion support, and self-hosted fonts.

## Runtime boundaries

```text
Browser
 ├─ Pages: index.html, app.html
 ├─ UI modules (DOM-aware)
 │   ├─ wizard / dashboard / search / filters
 │   └─ import, export, reporting, print
 ├─ Engine modules (pure, DOM-free)
 │   ├─ context: normalize answers and derive conservative URL hints
 │   ├─ applicability: Active | Confirm | N/A (context)
 │   ├─ priorities: deterministic suggested-next scoring
 │   ├─ rationale: explainable category relevance
 │   ├─ coverage: bucket classification (tested/active/blocked/N/A) and coverage math
 │   ├─ families: family index, family coverage, next-in-family, related families
 │   ├─ reportability: observation → weakness → demonstrated → reportable gate
 │   ├─ state: validate, serialize, findings, retest verdicts, and immutable updates
 │   └─ portfolio: migrate, select, add, and remove engagements under wapt.state.v1
 └─ Same-origin data
     ├─ checklist/manifest.json → checklist/<category>.json
     ├─ playbooks/manifest.json → playbooks/<surface>.json
     ├─ attack-chains/*.json
     ├─ payloads/**
     └─ burp-workflows/*.md
```

The engine runs unchanged under `node --test`. It does not import browser globals. Storage access belongs in the thin UI adapters (`js/ui/app.js`, `js/ui/theme.js`, and the pre-paint `js/ui/theme-boot.js`); `state.js` receives and returns plain values. A directory-scoped `js/engine/package.json` marks these `.js` files as ES modules without changing the repository's CommonJS validator and test harness.

## Data flow

1. The wizard collects optional answers. `Unknown` is represented explicitly, never inferred as `no`.
2. `context.js` normalizes all attributes to the controlled vocabulary in `docs/TAXONOMY.md`. URL hints are low-confidence suggestions and cannot overwrite answers.
3. `applicability.js` evaluates each item's declarative `applies` expression and returns a state plus machine-readable reasons.
4. Active and Confirm items enter search, workflow, and priority calculations. Context-N/A items are hidden by default but remain discoverable and overrideable with a required reason.
5. `priorities.js` scores only Active/Confirm, Not Tested items. Workflow order is the primary ordering signal; severity, met prerequisites, `priority_when`, and chain unlocks are bounded boosts. Item ID breaks ties, keeping output deterministic.
6. UI updates item status and notes through immutable state helpers, replaces that record in the local portfolio, and persists the entire portfolio under `wapt.state.v1` so every engagement can resume independently.

## Assessment plan and test maturity

The assessment plan is **feature-aware, not page-type-primary**: `js/engine/assessment.js` builds it from the **applicable catalog items** for the profile (`js/engine/applicable.js` — items that evaluate as Active or Confirm), attaches authored playbook overlays where they exist, and groups the result by attack surface (`CATEGORY_SURFACE` in `surfaces.js`). Playbook matching still lights up the surfaces a scope implies, but the plan list is the catalog, so a static profile reports the real catalog count (≈ 183), not the authored-overlay count (49).

Every check has an explicit maturity (`js/engine/maturity.js`): **AUTHORED** (named variants, payloads, a one-line Why per variant, CHECK FOR, VALIDATE, safety), **VARIANT-COMPLETE** (variants exist; per-variant why/class pending), or **CATALOG-ONLY** (methodology available, practical variants pending). Procedures are never synthesized from a title — a catalog-only row renders its maturity chip and opens the full methodology rather than a fabricated request. Variants carry a standardised taxonomy (`category` class, `why`, optional `observe[]`, optional `payload_ref` into a playbook-local `payloads` map). This is applied to every authored variant in every playbook, so all 16 authored packs are at AUTHORED maturity; only the expanded catalog-only remainder is methodology.

## Applicability semantics

`applies` supports three conjunction groups:

- `any_of`: at least one listed attribute/value branch must match;
- `requires`: every token must match;
- `excludes`: any known match makes the item context-N/A.

Within one token, `|` means alternatives, for example `creds:low|high`. Multi-select attributes match when their set intersects the expected values. An answered mismatch makes a required item N/A. An unknown prerequisite makes it **Confirm**, unless a known exclusion already establishes N/A. Absent `applies` means Active.

Precedence is: known exclusion → known failed requirement/any-of → unknown dependency → active. The evaluator returns all reasons, not only the first. User overrides do not mutate the content expression and require a free-text reason.

Authenticated items in black-box context with `creds:none` are a special **blocked roadmap** presentation: they remain visible, are not suggested as executable next actions, and carry `needs_credentials`. This is derived state, not a status value.

## Context model

Every normalized attribute has `{ value, confidence }`, where confidence is `answer`, `url_hint`, or `unknown`. Multi-select values are arrays. `url_hints` records named booleans and evidence separately; it never promotes a hint into a confirmed stack or feature answer.

URL analysis is deliberately narrow:

- accept only HTTP(S) URLs;
- detect plain HTTP, ports 8443/9443, exact left-most labels `api`, `admin`, `dev`, and `staging`, and an `xn--` hostname label;
- reject credentials, control characters, non-HTTP schemes, localhost, loopback, link-local, and private-address hosts from hint analysis;
- preserve the user's target string locally, but never fetch it or send it anywhere.

The deny-list limits misleading or dangerous parsing. A hint is always labeled “suggested by URL — confirm.”

## Content loading and manifest

The production manifest contains:

```json
{
  "schema_version": "1.0.0",
  "lastmod": "2026-08-17",
  "categories": [
    { "slug": "authorization", "file": "authorization.json", "prefix": "WAPT-AUTHZ", "floor": 35, "count": 35 }
  ]
}
```

Each category file contains `{ "schema_version", "category", "items" }`. The Phase 1 `checklist/sample.json` is explicitly marked as a sample and is not a production category or included in live counts.

The homepage's catalog total comes from manifest counts. Engagement values (active, tested, findings) are computed from loaded content plus state; they are never hardcoded.

## State contract

Exactly one browser key, `wapt.state.v1`, is used. It contains the portfolio envelope, its theme preference, and each independent engagement state:

```json
{
  "kind": "wapt-engagement-portfolio",
  "portfolio_version": 1,
  "preferences": { "theme": "light" },
  "active_id": "engagement-id",
  "engagements": [{
    "id": "engagement-id",
    "state": {
      "schema_version": 3,
      "engagement": { "name": "", "targetUrl": "", "started_at": null },
      "answers": {},
      "statuses": {},
      "notes": {},
      "overrides": {},
      "retests": {},
      "variants": { "authorization-object-level#1a2b3c": true },
      "position": { "view": "family", "family": "authorization-object-level", "category": "authorization", "item": "", "updated_at": null },
      "findings": [],
      "updated_at": null
    }
  }]
}
```

The theme is applied by a small same-origin external script before CSS loads, preventing a dark-to-light flash while retaining the restrictive no-inline-script CSP. Theme updates preserve the portfolio and portfolio updates preserve the theme. Allowed item statuses are `not_tested`, `in_progress`, `passed`, `potential_finding`, `confirmed_finding`, `na`, and `blocked`. The UI presents them as two questions — coverage (Not tested · Testing now · Tested · Blocked · N/A) and finding (No finding · Potential · Confirmed) — that compose into this single value, so "check executed" is never confused with "vulnerability found". `variants` records don't-miss coverage ticks keyed `<family-id>#<content-hash>`; `position` records the last view/family/category so an engagement resumes where the tester stopped. Both are coverage bookkeeping and never imply findings. A retest flag may be true only while the corresponding item is `confirmed_finding`. Re-running scope does not erase status or notes. Import validates one engagement's shape and schema version before replacing that engagement; per-engagement export excludes the portfolio preference.

## Security controls

Every HTML response is designed for this CSP, also expressed as a page meta policy on GitHub Pages:

```text
default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'
```

No inline scripts/styles, third-party resources, dynamic code evaluation, HTML injection, or remote target requests are permitted. User/content strings render with `textContent`. JSON imports are size-limited, parsed as data, and schema-validated. Exported Markdown treats user text as text and prevents raw HTML injection.

All CSS/JS page URLs carry the same release query value (for example `?v=1.0.0`); one release changes every occurrence together.

## Repository responsibilities

- `js/engine/`: pure policy and state logic.
- `js/ui/`: DOM, storage adapter, events, rendering, and export download.
- `checklist/`: validated methodology data; one production file per category.
- `schema/`: human/tool-readable JSON Schema contracts.
- `tools/validate.js`: zero-dependency structural and semantic lint.
- `tests/`: Node standard-library units, scenarios, and data contracts.
- `docs/`: architecture, taxonomy, content rules, and manual QA.

## Testing strategy

- Unit-test context normalization, every URL hint, applicability precedence, deterministic priority scoring, state migrations, retest invariants, and import/export round trips.
- Scenario-test every derivation rule and all eight presets.
- Validate all content: IDs, category floors, enums, expression vocabulary, references, mappings, links between entities, duplicate titles, and safety requirements.
- Keep link checking separate from offline domain/format validation so normal CI remains deterministic.
- Maintain a manual browser matrix for keyboard, focus, both themes, narrow viewport, print, localStorage, import error handling, and GitHub Pages path behavior.

## Delivery decisions

- Serve from repository root so relative URLs work both at `/WAPT-Checklist/` and under `python3 -m http.server`.
- Use ASVS **5.0.0**, the latest stable release available before the 2026-08-17 content freeze. Store versioned IDs such as `v5.0.0-8.2.2`; do not silently reuse ASVS 4 IDs.
- Pin WSTG references to `v42` URLs and versioned mapping IDs (`WSTG-v42-ATHZ-04`).
- Record OWASP Top 10 mappings by edition because 2025 renumbered several categories.
- Preserve published item IDs forever. Superseded tests remain as redirects/tombstones in manifest metadata rather than being reassigned.
