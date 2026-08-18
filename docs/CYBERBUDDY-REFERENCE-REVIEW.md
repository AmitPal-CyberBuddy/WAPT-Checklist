# CyberBuddy as a product reference for WAPT Checklist

> Audit date 2026-08-18. Sources read in full: `AmitPal-CyberBuddy/CyberBuddy` (hub `index.html`, `js/app.js` registry, all 7 tool pages, all 7 guides, `documentation/`, `methodology/`, `css/app.css`, `REVIEW.md`, `README.md`) and the current WAPT Checklist working branch (post tester-first round 2).
>
> This document is the audit, the proposal, and the **decision record**. Section 3 states what was proposed, how each proposal was challenged, and what was implemented, trimmed, or rejected. Section 4 lists what was deliberately not copied. Section 5 records the verification of what shipped.

---

## 1. What CyberBuddy gets right (with evidence)

| # | Pattern | Where it lives | Why it works |
|---|---|---|---|
| C1 | **One data registry drives the whole product.** `TOOLS_MENU` in `js/app.js` holds `label · status · category · input · mode · evidence · desc · tags · std`. The header menu, hub grid, `/tools/` catalog, and footer all render from it. | `js/app.js:275-374`, `renderToolCards()`, `renderToolCatalog()` | Adding a tool is one data entry, and every surface stays consistent by construction. |
| C2 | **Every card answers the same four operator questions**: Input · Mode · Evidence · Standards, as a `<dl>` — not prose. | `renderToolCatalog()` catalog cards | An operator decides "can I run this now, and what will it give my report?" without opening the tool. |
| C3 | **Explicit capability transparency.** Mode strings say *"Contacts the target (read-only GET)"* or *"Local only — nothing sent, stored or relayed"*; the engine chip states hosted-vs-local capability on every page. | `TOOLS_MENU.mode`, engine popover | Removes the biggest trust question in a security tool before it is asked. |
| C4 | **"What CyberBuddy is — and is not"**, two columns: does / does not do (no exploitation, no auth bypass, GET only). | `index.html` scope cards | Sets scope expectations, and prevents over-claiming in reports. |
| C5 | **Strong single first action.** Hub = target field + suite picker + Run; suggested targets; recent scans; share links carry target + selection. | `index.html` suite bar | Zero-thinking entry point; resuming is a click. |
| C6 | **Suite grouping with per-tool membership.** Categories `assess` / `local`, and each tool declares `suite: true|false` with a visible badge ("part of Run suite" / "standalone"). | catalog badges | The operator knows what a bulk action will and will not include. |
| C7 | **Short, tool-connected guides.** One page per tool, always 5 sections: attack in a paragraph → how servers get it wrong → confirm it with the tool → the fix → go deeper (standards). | `guides/*/index.html` | Depth is available without bloating the tool; each guide ends by pointing back at the tool. |
| C8 | **An operator documentation page separate from the contributor README**: quick start · which engine answers · CLI · evidence & export · limits of the hosted build · what leaves your browser. | `documentation/index.html` | The reader-facing questions are answered in the product, not in a repo file. |
| C9 | **Evidence-first output.** Report cards are screenshot-ready; suite exports offer Markdown / JSON / CSV / HTML; every finding shows the raw value behind it. | suite export menu, report cards | The tool's output is the deliverable artefact, not a screen you must re-type. |
| C10 | **Review discipline.** `REVIEW.md` is a numbered, dated ledger of every round with verdicts and follow-ups. | `REVIEW.md` (27 rounds) | Changes are auditable; regressions get named. |
| C11 | **Consistent, professional console aesthetic** driven by design tokens with contrast comments in the CSS itself. | `css/app.css:1-60` | Looks like tooling, not marketing; accessibility is designed in. |

---

## 2. WAPT Checklist audited against those patterns

**Already equivalent (keep, do not touch):**

- Data-driven architecture (C1): `checklist/manifest.json`, 25 category files, `families.json`, `attack-chains/`, `payloads/`, `burp-workflows/` — the workspace renders entirely from data.
- Local-only transparency (C3): CSP, "Local-only workspace" card, `wapt.state.v1`, no telemetry, per-engagement export.
- Design tokens (C11): both products already share the same palette (`--paper #07090d`, `--brand #3ee0c2`, severity ramp) and IBM Plex Mono/Sora typography. Visual consistency across the two products is effectively already there.
- Documentation set (C8/C10): `docs/` has architecture, engine, taxonomy, content guide, QA, and now two dated UX review rounds.
- Evidence orientation (C9): evidence packs, reportability gate, retest verdicts, Markdown checklist/report export.

**Gaps against CyberBuddy's product thinking:**

| # | Gap in WAPT Checklist | Consequence during an engagement |
|---|---|---|
| W1 | **Family cards have no operator contract.** A family shows title, summary, counts. Nothing says what you need to run it (accounts, roles, tenants), whether it is manual, which tools it pairs with, what evidence it produces, or which standards it satisfies. | The tester opens families to find out they cannot run them yet (no second account), or finishes one without knowing what evidence the report needs. |
| W2 | **No statement of what a family proves — or does not cover.** Object-level and function-level authorization look interchangeable from the board. | Mis-scoped testing and duplicated work; weaker reporting boundaries. |
| W3 | **No suite-level action.** The board lists 196 families under 25 headings; the only bulk affordance is "open all checks". | Engagement planning happens per attack surface ("do the authorization suite today"), and the product does not support that unit. |
| W4 | **No tool-connected band.** 12 Burp workflow pages and 40 payload references exist but are only reachable from a separate nav item or a card's deep detail. | The tester re-navigates instead of launching the right Burp workflow from the family they are working. |
| W5 | **No operator-facing documentation page.** `methodology.html` explains the philosophy; nothing states the working vocabulary (tested vs N/A vs blocked vs finding), the keyboard model, export formats, or the honest limits. | New users mis-read coverage numbers; experienced users never discover `g t`, `e`, `n/p`, or the CSV-less export set. |
| W6 | **Export set is thinner than the deliverable needs.** Markdown checklist, Markdown report, JSON state — no CSV coverage sheet and no per-family copy block. | Coverage has to be re-typed into client trackers and status calls. |
| W7 | **Homepage still counts N/A and blocked as "tested"** (`js/ui/home.js` uses `status !== 'not_tested'`), inconsistent with the corrected coverage engine. | The landing page contradicts the workspace. (Bug — fixed as part of this round regardless of scope.) |
| W8 | **No recent-family jump list.** During a long engagement the only way back to a family is the board or the sidebar. | Small repeated friction over an 8-hour day. |
| W9 | **Home page has no "what this is / is not" block** and two competing first actions. | The product goal has to be inferred; CyberBuddy states it in one screen. |

---

## 3. Decisions — proposal, challenge, outcome

Each proposal was challenged against one test: *does an experienced tester move faster or make fewer mistakes during an engagement?* Items that only added text were dropped.

| # | Proposal | Challenge | Decision |
|---|---|---|---|
| 1.1 | Family contract: Needs · Mode · Evidence · Standards on every card | `mode` is `manual` for 183/196 families (near-zero information), and an aggregated *Evidence* blob would repeat the same four generic lines on every family — noise, not signal | **Implemented, trimmed.** Board rows show **Needs** (2 most decisive + overflow), a severity chip and a *tool-assisted* badge; the family header shows the full **Needs · Mode · Tools · Maps to** row. Evidence stays per check, where the evidence pack already lives. All fields derived, zero new prose |
| 1.2 | Authored `proves` + `not_covered` per family (196 lines) | `summary` already states what the family covers, in the tester's language. A second authored line would duplicate it and drift from it. The real gap is the *boundary*, and that is derivable | **Rejected as written; the useful half implemented.** No new prose. The family header now carries a derived **NOT HERE** line naming the sibling families that own the rest of the surface. 196 lines of near-duplicate content avoided |
| 1.3 | Attack-surface suites with "Continue this suite" | Real: engagements are planned per surface, and 196 families under 25 headings had no planning unit | **Implemented.** Each surface shows coverage %, families, blocked, N/A, confirmed, don't-miss totals and a Continue action that lands on the first family with *unexecuted* checks (falling back to one with open variants) |
| 1.4 | "Out of scope" badge for families with nothing executable | Cheap honesty; CyberBuddy's "standalone — not in Run suite" equivalent | **Implemented** (also a *blocked* badge when every executable check is blocked) |
| 2.1 | New `operating.html` page | A whole page shell duplicates `docs.html`, adds sitemap/test churn, and would drift | **Implemented as a document, not a page.** `docs/OPERATING.md` renders through the existing docs viewer (`docs.html?doc=operating`), linked from the workspace sidebar and the home hero |
| 2.2 | Copy-ready family coverage block | Status updates and notes are retyped by hand today | **Implemented.** One button emits a Markdown block: coverage, state breakdown, findings, variants still open, checks still open |
| 2.3 | CSV coverage export | Client trackers are spreadsheets; Markdown does not paste into them | **Implemented — with a formula-injection guard.** This project documents CSV formula injection; its own export must not commit it, so `=`, `+`, `-`, `@` are prefixed and quoted |
| 2.4 | Tool band per family | Burp workflow pages are deep-linkable (`workflow.html?tool=…`); payload references are not, so chips would dead-end in a library | **Implemented, split.** Burp workflows link out; the ≤ 40 payload references that match the family are rendered inline (id, title, value) instead of linking into a library search |
| 3.1 | Recent families jump list | Marginal next to Continue + position memory — but iterative engagements bounce between surfaces | **Implemented minimally**: a single chip row on the board, only when at least two families have been worked |
| 3.2 | Home first action + "is/is not" block | The dynamic action is clearly useful; a new is/is-not block would duplicate the existing "Safe by default" section and the new Operating page | **Half implemented.** The hero's primary button becomes *Continue \<engagement\>* when this browser holds progress, and the CTA set is reduced to four (Start / Test families / Methodology / How it works). The is/is-not content lives once, in the Operating document |
| 3.3 | Homepage stat semantics | Straight bug: it counted N/A and blocked as tested | **Fixed** |

## 4. Deliberately **not** copied from CyberBuddy

| Rejected | Why it would hurt WAPT Checklist |
|---|---|
| **A–F grades / 0–100 scores** | CyberBuddy grades *a target's* posture from measured evidence. WAPT coverage measures *the tester's* progress. Rendering "82% → B" would read as "the app is a B", which is false and dangerous in a report. Coverage stays a plain percentage with its state breakdown. |
| **Tool-per-page architecture** (`/tools/<slug>/`) | Families are not standalone utilities; splitting them into pages would break the single-workspace flow and lose engagement state continuity. Families keep deep links (`#family/<id>`) instead. |
| **Target-contacting engines, relay, DNS-over-HTTPS, consent gates** | WAPT Checklist must never touch the target. Its guarantee is stronger: nothing leaves the browser at all. |
| **"Run suite" automation** | There is nothing to execute — the tester executes. The translation is "continue this suite", not "run this suite". |
| **Engine/hosted-vs-local chip** | No engine exists; the equivalent honesty statement is the Needs/Mode contract per family plus the limits section. |
| **Marketing furniture** (demo console, ticker, animated hero counters) | Adds page weight and reading time to a tool used for hours; the brief explicitly asks to reduce decoration. |

---

## 5. Verification of what shipped

| Gate | Result |
|---|---|
| `node --test` | **251/251** (new: contract derivation across all 196 families, boundary, suites, CSV injection guard, copy block) |
| `tools/tester-audit.mjs` | **19/19** — added T16 contract readable from the board (196 rows), T17 suite Continue lands in the first open family, T18 needs/mode/tools/maps-to + boundary + workflow links, T19 copy block and 624-row CSV |
| `tools/functional-workflows.mjs` | **53/53**, no regressions |
| `validate.js --floors` · `check-references.js` · `audit-content.js` · `verify-links.js` | green — 623 items, 196 families, all local references resolve |

Notable assertion: every one of the 196 families produces a contract with at least one standard mapping and no raw applicability token ever leaks into the UI (`assert.doesNotMatch(need.label, /:/)`).

**NOT TESTED:** real-browser rendering of the new board density, and how the contract row reflows on a phone — jsdom cannot judge either; both stay on the manual QA matrix.
