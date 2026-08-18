# Second-Pass Tester-First UX Review

> Audit and rebuild performed 2026-08-18 against the running application (jsdom runtime harness against `python3 -m http.server`, real localStorage, real events), the full source, and all 623 production items / 196 test families.
>
> Round 1 (`docs/TESTER-UX-REVIEW.md`) proposed the tester-first model and shipped its first implementation. This round audits **what that implementation actually does in the browser**, then closes the gaps so families, coverage, Don't Miss, Quick Test, and Suggested next behave as one workflow.

## 1. How the audit was run

`tools/tester-audit.mjs` boots `app.html` in jsdom, completes the scope wizard with the SaaS/JWT preset, and then walks a real engagement: open a family, read the quick test, record coverage, mark N/A and blocked, confirm a finding, tick don't-miss variants, reload the browser, and continue. Every question from the brief is asserted against the DOM and against `localStorage`, not against the source.

```bash
python3 -m http.server 8000 --bind 0.0.0.0
npm i --prefix /tmp/wapt-jsdom jsdom
NODE_PATH=/tmp/wapt-jsdom/node_modules node tools/tester-audit.mjs      # tester-first workflow
NODE_PATH=/tmp/wapt-jsdom/node_modules node tools/functional-workflows.mjs  # full regression walk
node --test                                                            # 245 unit/contract tests
```

## 2. Audit of the previous implementation (evidence, not inspection)

| # | Question the tester asks | Result | Evidence from the running app |
|---|---|---|---|
| T1 | Does the dashboard tell me what I tested, missed, and should do next? | **PARTIAL** | Coverage + Suggested next existed; nothing named the *missed* work (`explicit-gaps=false`). Six decorative metric cards led the page. |
| T2 | Can I work from families? | **FAIL** | No families entry point at all (`sidebar=0 dashboard-links=0`). Families existed only as headers inside a category page. |
| T3 | Does the category page group checks into families? | **PASS** | 6 family groups rendered for Authorization. |
| T4 | Is Quick Test a real quick test? | **FAIL** | Card "QUICK TEST" was `item.steps.slice(0, 4)` — and 607 of 623 items have exactly 4 steps, so it was a **verbatim duplicate** of the Steps section further down the same card (204 chars, twice). |
| T5 | Is Don't Miss a coverage mechanism? | **FAIL** | 0 checkboxes. Static prose list, no state, no counts. |
| T6 | Does Suggested next continue what I just did? | **FAIL** | After recording BOLA-read, top 3 were `WAPT-RECON-036, WAPT-RECON-029, WAPT-RECON-038`. Family/related boosts existed (+16/+18) but were dwarfed by the workflow term (spread 960). |
| T7 | Is N/A distinct from tested? | **FAIL** | Marking one check N/A raised the dashboard "Tested" metric to 2. `coverage.js` counted `status !== 'not_tested'` as tested. |
| T8 | Does family coverage show every state? | **PARTIAL** | Family header showed only `tested/total`; N/A, blocked, and confirmed were not separated; N/A items sat in the denominator. |
| T9 | Are check, coverage, and finding separable? | **PARTIAL** | One `<select>` mixed "did I run it" with "is it a vulnerability". Blocked was not a state at all. |
| T10 | What else should I check after this? | **FAIL** | 0 cross-family links. `item.related` covered only 43 of 623 items and rendered as bare IDs. |
| T11 | Does the tool remember where I was? | **FAIL** | Every reload landed on the scope wizard. No position, no resume. |
| T12 | Do variant ticks persist? | **FAIL** | Nothing to tick. |
| T13 | Is the default screen scannable? | **NOT TESTED** | Blocked by the view-mode toggle sticking in Coverage mode across category changes (usability defect in its own right). |
| T14 | Runtime health | **PASS** | No console errors. |

Additional defects found while auditing:

- **PRE-EXISTING BUG** — the dashboard attack-chain and retest lists rendered `http://localhost:8000/app.html#chains` five times instead of chain titles: `element('li', '', anchorNode)` stringifies an anchor to its href through `textContent`.
- **PRE-EXISTING** — `passed` was labelled "Not Vulnerable" but the checklist export ticked `[x]` for *any* non-`not_tested` status, so an N/A item printed as completed work in the client-facing checklist.
- **REDUNDANCY** — Quick Test (level 1) and Steps (level 3) were the same four sentences; the card asked the tester to read the same procedure twice per check, 623 times.

## 3. What was kept

Nothing in the tester-first model was redesigned from scratch. Families, Quick Test, Don't Miss, Detailed Methodology, Suggested Next, Applicability, Coverage, and Attack Chains all remain, and the whole knowledge base (20 methodology sections per item, references, mappings, chains, payloads, Burp workflows, evidence packs, retest verdicts) is untouched. The adaptive scoping wizard, applicability reasons, credential-blocked roadmap, deterministic scoring, local-only portfolio, CSP posture, and print view are unchanged.

## 4. What changed

### 4.1 Families are the working unit

- New **Test families** view (`#families`): every family grouped by attack surface with `tested/executable`, coverage bar, blocked, N/A, confirmed, and don't-miss counts; filters for surface, free text, and "unfinished only"; and a **Continue** button that resumes the last family.
- New **family workspace** (`#family/<id>`): breadcrumb, coverage strip, authored Quick Test, tickable Don't Miss, dense check rows, "after this family", and "what else should I check?" — in one screen (~4.3k characters before anything is expanded).
- Category pages, search results, and the dashboard all link into families; every card carries its family chip so context survives navigation.

### 4.2 Coverage is honest

`js/engine/coverage.js` now classifies each check into exactly one bucket — `tested` (executed: not vulnerable / potential / confirmed), `active` (in progress), `blocked`, `na` (split into `na_context` and `na_user`), `not_tested` — and computes `coverage = tested / executable` where `executable` excludes both kinds of N/A but keeps blocked work in the denominator, because blocked work is still owed. `blocked` is a first-class status (`ITEM_STATUSES`), separate from the derived credential-blocked chip.

### 4.3 Check ≠ coverage ≠ finding

Each check now has two controls: **coverage** (Not tested · Testing now · Tested · Blocked · N/A) and **finding** (No finding · Potential · Confirmed). Recording a finding implies the check ran; recording coverage never invents a finding. Both map onto the existing single status value, so no state model was forked. Don't-miss ticks are a third, separate record (`state.variants`) and the family panel says so explicitly.

### 4.4 Quick Test is authored data

`checklist/families.json` is now schema 2.0.0: every one of the 196 families carries an explicit `quick_test` (3–5 imperative lines, ≤ 90 chars) and a one-line `validate`. These were written for the family, not derived from item steps, and the validator enforces length, count, imperative phrasing, and the validation line. A test asserts no family quick test is ever a verbatim copy of an item's step list. The item's own steps now appear once, under "Procedure & variants".

### 4.5 Don't Miss is coverage

Each `dont_miss` reminder is a checkbox keyed by `<family-id>#<content-hash>`, stored in `state.variants`, surfaced as `covered/total` on the board, in the family header, in the category coverage view, and in the dashboard gap list. Ticks persist across reloads and survive family reordering.

### 4.6 Suggested next is contextual

`js/engine/priorities.js` adds a bounded, deterministic proximity layer that outranks the global workflow ordering once the tester is working: focus family +1500, adjacent family +420 (derived from links/chains/flow), part-finished family +700, explicitly related test +500, same surface +150. Each row states why. A family workspace sets the focus explicitly, so the answer is right even on a cold start. Post-BOLA-read the top three are now `WAPT-AUTHZ-004, WAPT-AUTHZ-005, WAPT-AUTHZ-006`.

### 4.7 "What else should I check?" reuses existing relationships

`relatedFamilies()` derives cross-surface navigation from data that already exists — `item.related` links, attack-chain successors (only nodes *after* this family in the chain), same-surface siblings, and workflow adjacency — with per-category caps so the list stays varied. No parallel recommendation system:

```
Upload · Acceptance & validation → SSRF detection · Allowlists & schemes · Execution & sandboxing
                                   · Naming, collisions & headers · Archive handling · Reflected & stored XSS
SSRF detection                   → Cloud metadata & credentials (next in chain SSRF-01) · Metadata & egress …
MFA & factor lifecycle           → Session identity & account changes (next in chain ATO-01) · Token inventory …
```

### 4.8 Dashboard answers three questions

Question 1 *What have I tested?* (coverage %, tested / not tested / blocked / N/A / confirmed, then the metric cards) · Question 2 *What have I missed?* (family gap list, part-finished families first, plus a blocked list) · Question 3 *What should I test next?* (contextual suggestions and a Continue control). Retest queue, attack chains, surface progress, findings, and evidence packs follow.

### 4.9 Wide views became scan lists

"All tests" and Search previously rendered up to 623 full cards. They now render family-grouped **compact rows** — status glyph, ID, title, coverage and finding controls — that expand into the full card in place. A single attack surface keeps its card-first layout for deep work. Measured in the jsdom harness: search across the whole catalog went from **4 163 ms to 825 ms**, and the all-tests DOM dropped to ~9 100 nodes for 481 visible checks.

### 4.10 Engagement flow and density

Free navigation is unchanged (any view, any time) but the engagement now remembers its position (`state.position`) and reopens there; a fresh browser still starts at the wizard. Check rows are single-line (137 characters), the card shows ID · severity · title · objective · VALIDATE with everything else behind five disclosure levels, and `n` / `p` walk checks while `e` expands the focused one (`g t` opens families).

## 5. Post-implementation test results

`tools/tester-audit.mjs` — **15/15 PASS**:

| # | Check | Before | After |
|---|---|---|---|
| T1 | Dashboard answers tested / missed / next | PARTIAL | **PASS** (coverage + 6 gap rows + 8 suggestions) |
| T2 | Families are the primary working unit | FAIL | **PASS** (196 family rows, sidebar entry) |
| T3 | Family workspace shows all coverage states | — | **PASS** (14 checks; coverage/tested/not tested/blocked/N/A/confirmed/don't miss) |
| T4 | Quick Test authored, not copied from steps | FAIL | **PASS** (4 authored lines, no duplication) |
| T5 | Don't Miss tickable | FAIL | **PASS** (7 variant checkboxes) |
| T6 | Suggested next continues the family | FAIL | **PASS** (`AUTHZ-004/005/006`) |
| T7 | N/A and blocked never count as tested | FAIL | **PASS** (`tested=1 na=143 blocked=1`) |
| T8 | Category coverage separates every state | PARTIAL | **PASS** |
| T9 | Coverage and finding separable | PARTIAL | **PASS** (`status=confirmed_finding`, coverage stays `tested`) |
| T10 | Cross-family navigation with reasons | FAIL | **PASS** (6 related families, each with a reason) |
| T11 | Resume where the tester stopped | FAIL | **PASS** (boots into the family last worked) |
| T12 | Don't-miss ticks persist | FAIL | **PASS** (survives two reloads) |
| T13 | Default screen scannable | NOT TESTED | **PASS** (137-char rows, 4 282-char family screen) |
| T14 | Keyboard expand + walk | — | **PASS** (`e`, then `n` focuses the next check) |
| — | Search across 623 checks | 4 163 ms card wall | **825 ms** compact scan list |
| T15 | No console errors | PASS | **PASS** |

Regression suites: `tools/functional-workflows.mjs` **53/53 PASS** (full journey, chains, edge cases, import fuzz, print, theme, 130 same-origin requests, zero external) · `node --test` **245/245 PASS** · `node tools/validate.js --floors`, `check-references.js`, `audit-content.js` all green (623 items, 196 families).

Defect ledger for this round: 2 PRE-EXISTING BUGS fixed (anchor-stringified dashboard lists; N/A counted as completed work in coverage and checklist export), 1 redundancy removed (Quick Test duplicating Steps), 0 regressions detected. Intentional contract changes: state schema 2 → 3 (transparent migration, `variants` + `position` added, `blocked` status added), families schema 1.0.0 → 2.0.0 (`quick_test` + `validate`), coverage semantics (tested = executed only).

**NOT TESTED:** real-browser rendering (Chromium/Firefox/Safari), pointer/touch ergonomics, and screen-reader announcement of the two-control status pair — jsdom cannot judge these; they remain on the manual QA matrix in `docs/QA.md`.

## 6. Final walkthrough — testing a multi-tenant SaaS as an experienced tester

1. **Scope** — preset `saas_jwt_api`, dashboard opens: 0% coverage, 481 executable checks, 142 scoped out with reasons.
2. *What should I test?* — Question 2 names the largest open surfaces (Object-level authorization 0/14, Privilege & field 0/10, API object & field 0/8). One click opens the family.
3. *What do I actually do?* — the family header states the quick test: capture as A → replay as B changing only the object reference → repeat per method → repeat on bulk/nested/export/async. Validation bar: "not a cache replay".
4. *What have I covered?* — checks tick over to Tested as I go; the strip updates coverage %, not-tested, blocked, N/A, confirmed and don't-miss `3/7`.
5. *What might I forget?* — Don't Miss keeps DELETE, nested resources, bulk endpoints, export/report equivalents, signed URLs, search/filter ordering, and post-state-change rechecks in front of me until I tick them.
6. *Is this a finding?* — finding control set to Confirmed on WAPT-AUTHZ-006; coverage stays Tested, the evidence pack opens, the reportability gate says what is still missing, and the retest queue picks it up.
7. *What next?* — Continue jumps to the next uncovered check; when the family closes out, "After this family" and "What else should I check?" hand me API object & field authorization (next in chain IDOR-01) and tenant isolation.
8. *Blocked work* — the admin-only checks I cannot run are marked Blocked, stay in the denominator, and are listed on the dashboard so they are not quietly lost.
9. *Interruption* — close the laptop, reopen: the workspace returns to the same family with the same coverage, notes, ticks, and findings.

Every question in §17 of the brief now answers yes, with the runtime evidence recorded above.
