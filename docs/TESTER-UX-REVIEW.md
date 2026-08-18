# Tester-First UX & Workflow Review

> Audit performed 2026-08-18 from the perspective of an experienced WAPT tester, using the running application (jsdom runtime harness, 41/41 functional checks), the full source, and the live content data. This document is the analysis deliverable; no redesign is implemented until it is reviewed.

## 1. Current flow (as a tester actually experiences it)

1. **Entry** — homepage → "Start a WAPT" → wizard: engagement name + target URL → 18 adaptive scope questions (or one of 8 presets) → review → dashboard.
2. **Dashboard** — six metric cards, coverage panel, Suggested next (8 explained rows), category progress bars, retest queue, attack-chain overview, findings table + evidence packs.
3. **Checklist** — sidebar lists 25 categories; picking one renders **every item as a full card**; 11 filters above; a "All tests" view renders all 623 cards.
4. **A card's default state** — chips (ID, severity, difficulty, mode, applicability) + title + one-line objective + a status `<select>`, and a single collapsed `<details>` labelled "Open methodology".
5. **Inside the details** — 20 sections in fixed order: Objective, Prerequisites, Steps, Variants, Examples, Manipulate, Secure behavior, Vulnerable behavior, Validation, False positives, Reporting boundary, Impact, Root-cause remediation, Retest guidance, Evidence, Tools, References and mappings, Attack chains, Tester notes, Evidence pack form.
6. **Search/chains/payloads/reports** — same cards in search; chain graphs with per-node status; payload library; Burp workflow pages; report export.

## 2. UX problems (evidence-based, tester perspective)

| # | Problem | Evidence | Severity |
|---|---|---|---|
| P1 | **The quick answer is buried.** The one thing an experienced tester wants — "what do I do now" — sits at position 3–4 inside a 20-section expansion. Staying at "Level 1" is impossible today: a collapsed card shows only ID/title/objective/status, and `steps`/`validation` are invisible without expanding. | Card DOM; the only collapsed content is the header | **High** |
| P2 | **"Don't Miss" is not first-class.** Coverage of overlooked variants exists only implicitly (context `variants` = 19 conditional methodology sets; `false_positives` = FP guidance, not coverage). There is no per-family list of methods/bulk/export/mobile/legacy/version/GraphQL/tenant/role/field boundaries anywhere in the UI. | schema has no such field; no card or category surface renders one | **High** |
| P3 | **Related-test navigation has data but no UI.** `item.related` (43 items, 64 links) is never rendered — the spec's "RELATED TESTS" column is a dead data path. And 64 links cannot carry family navigation for 623 items on their own. | `grep item.related js/ui/workspace.js` → zero renders | **High** |
| P4 | **No test-family structure.** Items are flat within a category; there is no Object-level / Function-level / Tenant / Field grouping, no family headers, no "work through the family" context. | manifest has `category` only; no grouping entity | **High** |
| P5 | **Suggested next is plan-level, not tester-level.** It scores workflow+severity+context+chains globally; after marking a BOLA-Read passed it does not surface "next: BOLA-Write / BFLA / Bulk / Export / Tenant". Explanations exist, but **proximity to what the tester just did** is not a signal. | `priorities.js` has no related/family/recent-touch term | Medium-High |
| P6 | **One view serves two different questions.** Coverage ("have I covered everything?") and testing ("what next?") share the same card list + progress bars. There is no compact family-tick coverage mode. | checklist renderer is the only mode | Medium |
| P7 | **Status vocabulary blurs states.** `passed` reads as "done" rather than "verified secure"; the plan's requested distinction between NOT STARTED / NOT VULNERABLE / N/A / BLOCKED / RETEST is expressible today (statuses + applicability chips + verdicts) but labels don't communicate it. | `STATUS_LABELS`: Passed | Low-Medium |
| P8 | **No next/previous test navigation** and no keyboard way to walk a family; long sessions depend on scrolling + sidebar clicks. | no j/k or n/p handler | Low-Medium |
| P9 | **Status control scrolls away** while reading long methodology; returning to it costs a scroll-back per item. | select lives only in the card header | Low |
| P10 | **Endpoint/attack-surface thinking is absent.** Nothing lets a tester say "POST /api/user/update" and see the auth/authz/input/state/business/CSRF/race checks that should surround it. | no endpoint entity in state or UI | Feature gap (see §6, stretch) |
| P11 | **Category-level "Don't Miss" (core vs advanced) does not exist.** | no category coverage checklist surface | Medium |

What already works well and must be preserved: adaptive scoping, applicability chips with reasons, credential-blocked visibility, deterministic explained suggestions, coverage math (N/A excluded), evidence packs + verdicts, filter chips, skeletons, shortcuts, contrast-fixed themes, and the detailed methodology itself (spec §17).

## 3. Recommended tester-first flow

```
ENGAGEMENT → ATTACK SURFACE (wizard/presets/rationale) → CATEGORY/FAMILY
→ QUICK CHECK (Level 1) → DON'T MISS (Level 2, family-level)
→ VALIDATE → status → RELATED/NEXT TEST → COVERAGE (family + category ticks)
→ jump anywhere, any time (no forced linear order)
```

Every card answers, at a glance: **what am I checking** (title + one-line objective) · **what do I do** (Quick Test) · **what variants** (Don't Miss) · **what must I not forget** (family list) · **how do I know it's vulnerable** (Validate) · **what next** (Related / Next).

## 4. Proposed information architecture

**Four levels of progressive disclosure per item (all existing content preserved):**

- **Level 1 — Quick Check** (always visible): ID, severity, mode, applicability chip, status select, title, one-line objective, **Quick Test** (first 3–4 `steps` condensed, plus `manipulate` as the one-change line), **Validate** (one line from `validation`).
- **Level 2 — Don't Miss & Related** (collapsed, one click): family don't-miss checklist (methods, bulk, export, mobile, legacy, versions, GraphQL/WS equivalents, tenant/role/field boundaries — derived from the family definition + item tags/variants), **Related tests** as clickable chips (`related` + family siblings + retest-target suggestions), **Next test** hint.
- **Level 3 — Detailed methodology** (collapsed): the existing 20 sections, unchanged.
- **Level 4 — References & mappings** (collapsed): existing references/mappings/attack chains.

**Two views on the checklist page:**
- **Coverage view** — compact: families as groups with tick lists (✓/□ per item), family + category "don't miss" panels, and the category percentage; no card walls.
- **Testing view** — the Level-1/2 cards above; sticky quick actions; keyboard walk (`j`/`k` or `n`/`p` between cards, `x`-style status cycling via the select).

**Tester-aware Suggested next** — add two bounded, deterministic signals to the existing scorer: (a) **related proximity** (untested items linked from, or in the same family as, recently touched items — reason: "related to WAPT-AUTHZ-003 you just tested"), and (b) **family completion** (first untested member of a family the tester is part-way through — reason: "continues the Authorization · object-level family"). Everything else (workflow/severity/context/chain) stays.

**Status vocabulary** (engine values unchanged — labels only): `not_tested` → **Not Started** · `in_progress` → **Active** · `passed` → **Not Vulnerable** · `potential_finding` → **Potential Finding** · `confirmed_finding` → **Confirmed Finding** · `na` → **N/A** · applicability **Confirm** and credential **Blocked** remain first-class chips; **Retest** stays the verdict/pending queue. Reports reuse the same labels, so exports stay consistent.

**Family data model** — new `checklist/families.json` (validated, machine-checked): per category, named families with member item IDs, a family summary line, and a **family-level don't-miss list**. Validator rules: IDs resolve, every production item belongs to exactly one family per category (completeness gate so coverage is honest), don't-miss entries ≥ 25 chars. Content authors fill families incrementally; the validator fails the build on unresolved or duplicated membership. This avoids rewriting 623 items while giving P2/P4/P6/P11 one data source. (The 5 attack chains stay as cross-category paths, unchanged.)

## 5. Proposed checklist / test-card structure (target)

```
AUTHORIZATION — object-level                82% COVERED  (family header, coverage view)

WAPT-AUTHZ-003  HIGH · manual · Active · [status ▼]        ← Level 1
Object authorization — Read (BOLA)
CHECK   Object access is authorized against the caller, not the supplied ID.
QUICK TEST
  • Capture the request as User A
  • Replace the object identifier with User B's object
  • Compare response/state; repeat per method and endpoint class
VALIDATE  Confirmed unauthorized read across controlled accounts; not a same-role hit.

[▼ Don't Miss & Related]                                   ← Level 2
  DON'T MISS  □ GET □ POST □ PUT/PATCH □ DELETE □ nested □ bulk □ export
              □ legacy/v2 □ mobile □ GraphQL □ tenant □ role □ field
  RELATED  → WAPT-AUTHZ-004 write · WAPT-API-001 · WAPT-AUTHZ-021 tenant
  NEXT     WAPT-AUTHZ-004 — BOLA write

[▼ Detailed Methodology]                                    ← Level 3 (unchanged)
[▼ References & Mappings]                                   ← Level 4
[Notes · Evidence pack]                                     ← tester records (collapsed)
```

## 6. Implementation plan (incremental; test after each change; nothing removed)

| Step | Change | Files | Risk | Gate |
|---|---|---|---|---|
| 1 | **Card reorganization (Levels 1–4).** Split the single details into: always-visible Quick Check (objective + condensed `steps` + `validate`) and three nested details (Don't Miss & Related, Detailed Methodology, References & Mappings). All 20 sections preserved. | `js/ui/workspace.js`, CSS, tests | Low — render-only | harness + unit tests |
| 2 | **Related navigation.** Render `related` chips + retest-target suggestions at Level 2; clicking jumps to the category card and focuses it. | same + `app.js` hash-focus | Low | harness check |
| 3 | **Families data + validation.** `checklist/families.json` + validator completeness/uniqueness rules + author the first families (Authorization, Authentication, API Security, File Handling) with don't-miss lists. | new data file, `tools/validate.js`, `tests/production-data.test.js` | Low (additive data) | validator + audit |
| 4 | **Coverage view.** Family-grouped tick list + family/category don't-miss panels + category %; toggle Coverage ⇄ Testing (hash-persisted, default Testing). | workspace renderers, CSS, tests | Medium | harness |
| 5 | **Tester-aware Suggested next.** Add related-proximity + family-continuation signals (bounded, deterministic, with reasons); keep global suggestions for cold starts. | `priorities.js`, tests | Low — additive scoring | scenario tests incl. determinism |
| 6 | **Status labels + next/prev navigation + sticky quick bar.** Label-only status change (engine values untouched), `n`/`p` card walk with focus, duplicate compact status control in the expanded footer. | `export.js`, `app.js`, workspace, CSS, tests | Low | harness + keyboard checks |
| 7 | **Remaining families** authored for the other 21 categories. | data file | Low | validator |
| 8 | **(Stretch — needs approval)** Endpoint ledger: per-engagement `endpoints[]` (method+path+notes) with a view listing the relevant check families per endpoint. This is a new state-v2 field and a real feature; it best serves "endpoint thinking" but touches persistence/migration, so it is proposed separately. | state v2.1, new view | Medium | full FFV suite |

Deferrals: no new animations, no visual redesign beyond the card hierarchy, no removal of detailed methodology, no change to engine applicability semantics.

## 7. Implementation status (approved and shipped)

1. ✅ **Card reorganization** — four progressive disclosure levels: Level 1 Quick Check (always visible: condensed steps, one-condition line, validation), Level 2 Don't miss & related (family don't-miss list, context variants, related chips, next-in-family hint), Level 3 Detailed methodology (unchanged knowledge base), Level 4 References & mappings; separate Tester notes & evidence drawer.
2. ✅ **Related navigation** — related-test chips render and resolve categories from ID prefixes; next-in-family hint keeps the tester inside the family.
3. ✅ **Families data** — `checklist/families.json` with **196 families covering all 623 items across all 25 categories exactly once** (validator-gated for resolution, uniqueness, specificity, and completeness); `tools/build-families.py` documents the authoring.
4. ✅ **Coverage view** — Testing/Coverage toggle; coverage mode shows category summary (tested/executable/percent/scoped-out) and family tick lists with statuses and progress bars; rows jump back into Testing mode.
5. ✅ **Tester-aware Suggested next** — related-proximity and family-continuation signals (bounded, deterministic, with reasons) fed by recent-touched tracking.
6. ✅ **Status vocabulary + navigation** — Not Started / Active / Not Vulnerable / Potential / Confirmed / N/A (engine values unchanged); `n`/`p` card walk; duplicate quick status control in each card's records drawer.
7. ✅ **All 25 categories familied** — 196 families total.
8. ⏸️ **Endpoint ledger** — deferred as a documented stretch (requires a state-schema addition and migration; will be its own reviewed change).

Runtime verification: `tools/functional-workflows.mjs` now runs 51 checks including Quick Test visibility without expansion, family group headers with counts, don't-miss rendering, coverage-view journey, label checks, and the n-key walk — all PASS.

## 8. Decisions needed before implementation (historical)

1. Proceed with steps 1–7 as planned (families data file is the one new data entity)?
2. Include the endpoint ledger (step 8) in this cycle, or keep it as a documented stretch?
3. Status label change (`passed` → "Not Vulnerable") — acceptable across UI + reports, with engine values unchanged?
