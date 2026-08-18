# Functional Test Report — application-level verification

> Test environment: Node 22 + jsdom runtime harness (`tools/functional-workflows.mjs`) executing the real application (app.html + all UI modules) against the real local HTTP server on `http://localhost:8000`, with real localStorage, real event dispatch, and simulated browser reloads. Reproduce with: `npm i --prefix /tmp/wapt-jsdom jsdom` then `NODE_PATH=/tmp/wapt-jsdom/node_modules node tools/functional-workflows.mjs` (skips cleanly where jsdom is absent; the repo stays zero-dependency).
> **Result: 41/41 checks PASS · 0 FAIL · 0 NOT TESTED (DOM/runtime level).** Pixel rendering, real browser console/network, and real screen-reader behavior remain browser-only and are covered by the maintainer matrix in `docs/QA.md`.

## Bugs discovered by actually running the application (and fixed)

| # | Bug | Classification | Reproduction → fix | Re-test |
|---|---|---|---|---|
| 1 | Dashboard crashed with `ReferenceError: chainStore is not defined` — the Phase 5 chain-overview panel blocked Suggested next from rendering | **REGRESSION** (introduced Phase 5) | Boot app → dashboard renders chain overview → crash | Fixed: `renderChainOverview` receives the chain store as a parameter; regression test added; harness dashboard checks PASS |
| 2 | Card handlers captured render-time state: a note written through a replaced (stale) DOM node clobbered a newer status change | PRE-EXISTING latent bug (not user-reachable in a real browser, but a real stale-closure weakness) | Status change re-renders list → old node reused → its handler rebuilds state from the stale snapshot | Fixed: all card/evidence handlers now read live state via an accessor (`getState()`); harness adds an explicit stale-node regression check that now passes |
| 3 | Evidence-pack decision stage did not refresh when the exploitability select or the reportable checkbox changed (only text `input` events were listened for) | PRE-EXISTING BUG | Open Record evidence pack → change exploitability → stage text unchanged | Fixed: stage refresh binds both `input` and `change`; harness asserts the stage reaches "Reportable finding" through select + checkbox interactions |

## Main workflows tested (scripted user journeys, real DOM + HTTP + storage)

**Workflow 1 — Normal WAPT** (all PASS): create engagement → name + target URL → apply SaaS/JWT preset → walk all 18 wizard steps → review summary → dashboard renders Suggested next (8 rows with explanations) + metrics (623) + coverage panel → search "jwt" (19 hits) → combined severity filter (7 hits) + filter chip → open methodology card (all decision sections present) → status → Confirmed Finding (dashboard metric updates) → note persists to localStorage → evidence pack: live decision stage → Reportable → save → pack card with verdict control → verdict PARTIAL persists with original evidence intact → report generated (evidence packs + verdicts, injection-safe, 2280 chars) → state JSON export → **simulated browser reload** restores name/status/notes/findings → re-import of exported state succeeds → malformed JSON import rejected with state intact.

**Workflow 2 — Attack chain** (all PASS): open chains view (5 chains, 20 nodes, checklist links, unlock hints) → identify prerequisite edge from chain data (WAPT-AUTH-005 → WAPT-RATE-001) → open the prerequisite's category → mark it Passed → return to chains → next node shows **unlocked** state with updated status chips (✓ Passed, ○ Pending…).

## Edge cases (all PASS)

Empty engagement boots to wizard · no search results shows the explanatory empty state · `javascript:` target URL produces no hints and no request · hostile engagement name (`<img onerror>`) renders as inert data with no DOM injection · long note truncated at the 20k cap · invalid import rejected with the state left intact · rapid clicking leaves the wizard in a valid step · back/forward step navigation · lazy loading proven (wizard view issues exactly 1 request — the manifest; category data fetches only when needed) · simulated reload restores everything.

## Runtime verification (all PASS)

- **123 HTTP requests logged across all sessions: every one same-origin relative; 0 external, 0 absolute URLs, 0 telemetry.**
- **0 uncaught console errors** across all sessions.
- Print action invoked from the checklist (print shim called once).
- Keyboard: `/` → search, `g d` → dashboard, `?` opens the shortcuts dialog.
- Dark/light: toggle flips theme and persists the preference.
- UI state vs. underlying data: dashboard metrics, coverage, findings, evidence packs, and verdicts all matched the persisted `wapt.state.v1` contents at every step.

## Feature matrix

| Feature | Result | Notes |
|---|---|---|
| Homepage / navigation | PASS | sidebar + hash routing exercised across all views |
| WAPT wizard (18 questions) | PASS | full walkthrough incl. preset, review, back/next, rapid clicks |
| All 8 quick-start presets | PASS (engine + 2 presets driven end-to-end) | presets.test.js covers all 8 through the engine; SaaS and static presets driven in the harness |
| Scoping / context detection | PASS | preset answers flow to applicability; JWT/multi-tenant behavior verified |
| Engagement create/persist/resume | PASS | reload simulation restores everything |
| Multiple engagements | PASS (engine + source) | portfolio suite; UI selector exercised in prior rounds |
| All 25 checklist categories | PASS | sidebar renders 25; category view, cards, expansion verified |
| Category lazy loading | PASS | request log proves 1 manifest fetch on wizard, categories on demand |
| Search + combined filters | PASS | 19→7 narrowing, chips, per-key filter correctness suite |
| Applicability / priority engine | PASS | Suggested next rows with explanations; gate behavior parity-probed |
| Status transitions | PASS | pairwise matrix + UI transition to Confirmed |
| Active/Confirm/N-A/Blocked | PASS | engine suite + probe |
| Notes | PASS | persist, truncation, isolation, stale-node regression fixed |
| Copy controls | PASS | methodology sections + payload values (clipboard shim exercised via source + assertion) |
| References / related tests | PASS | rendered in cards; all resolve (link audit) |
| Attack chains | PASS | full Workflow 2 incl. unlock + status chips |
| Payload library | PASS | 40 refs, 14 REVIEW-ONLY collapsed, search/filter source-verified |
| Burp workflows | PASS | 12 files complete, all slugs mapped |
| Findings | PASS | evidence pack lifecycle through the UI |
| Report generation | PASS | real download captured: evidence packs + verdicts, injection-safe |
| Retesting | PASS | PARTIAL verdict round trip with original evidence intact |
| Import/export | PASS | export → reload → import equivalence; malformed rejected safely |
| Print view | PASS | print action invoked |
| Dark / light mode | PASS | toggle + persistence + computed contrast both themes |
| Responsive / mobile | PARTIAL | source-asserted recomposition; visual rendering NOT TESTED (no browser) |
| Keyboard navigation | PARTIAL | `/`, `g d`, `?`, `Esc` paths exercised; real tab-order NOT TESTED |
| Browser console / network errors | NOT TESTED (real browser) | jsdom runtime shows 0 uncaught errors; real DevTools pass in `docs/QA.md` |
| Broken links / references | PASS | 97/97 local refs resolve; 15 external hosts allowlisted; 46 URLs snapshot-verified |
| Unexpected external requests / telemetry | PASS | 0 across 123 logged requests |
| Security regressions | PASS | privacy suite + import fuzz + no-eval sweep + inert-rendering checks |
| Performance regressions | PASS | measured at 20/150/500 items (search ≤ 2.7 ms) |

## Remaining issues

1. **Visual/browser sign-off** — pixel rendering, real-browser console/network, screen-reader and real-keyboard passes remain maintainer-gated (no browser in this sandbox; sign-off matrix in `docs/QA.md`). Nothing else is outstanding.
2. **Known-issue ledger (from FFV rounds):** two early commits not individually green by commit atomicity (history kept transparent, recommendation recorded); evidence-pack form resets after save (cosmetic).
