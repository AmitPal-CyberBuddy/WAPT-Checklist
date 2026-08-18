# Manual browser QA

Automated tests use Node's standard library. This checklist covers browser behavior that cannot be fully verified in the sandbox. Run it against both `python3 -m http.server` and the GitHub Pages deployment before a release.

## Browser smoke test (Phases 2–5)

### Pages and policy

- [ ] Load `/` and `/app.html` without console errors or CSP violations.
- [ ] Confirm the Network panel shows no third-party font, script, style, analytics, or API request.
- [ ] Confirm the target URL field does not trigger a request to the entered host.
- [ ] Confirm all font requests are same-origin WOFF2 files.
- [ ] Confirm authorized-testing messaging appears on both pages.

### Homepage

- [ ] Verify category and catalog counts equal `checklist/manifest.json`.
- [ ] Verify tested/finding counts reflect only local state and are not hardcoded.
- [ ] Test Start testing, Browse checklist, Search, documentation, and footer links.
- [ ] Toggle dark/light theme and verify body text, controls, focus, and brand/severity tokens retain AA contrast.

### Wizard

- [ ] Complete a fully unknown scope with Back, Continue, and Use Not confirmed yet; verify all 18 possible questions remain available.
- [ ] Select multiple values and verify selecting Not confirmed yet or None clears specific selections and vice versa.
- [ ] Choose no authentication and verify credential, registration, role, and authentication-mechanism questions are skipped and represented as None in review.
- [ ] Choose black-box mode and verify the contradictory implementation-access question is skipped and normalized to None; verify it remains available for grey-box and white-box scopes.
- [ ] Choose a static site with no API and verify API-definition, backend, data-layer, outbound-fetch, and asynchronous-job questions are skipped; confirm source access, hosting, feature, and intermediary questions remain.
- [ ] Open a gated category (JWT, GraphQL, WebSocket, SSRF, AI/LLM) from the sidebar and verify the rationale line explains why it is active, boosted, or awaiting confirmation; select AI/LLM features in the wizard and confirm the AI suite activates.
- [ ] Verify the intermediary question gates cache-poisoning/deception tests (None removes them, Unknown keeps them as Confirm) and that the SSRF category follows the outbound-fetch answer the same way.
- [ ] Return to earlier answers, make identity/API/runtime scope relevant again, and verify the conditional questions return without navigation or progress errors.
- [ ] Apply each of the eight presets and verify every applicable answer is editable afterward.
- [ ] Enter HTTP, `api.`, `admin.`, `dev.`/`staging.`, ports 8443/9443, and punycode target examples; verify hints are low-confidence and no URL is fetched.
- [ ] Enter localhost, loopback, private, link-local, credential-bearing, malformed, and non-HTTP URLs; verify no hints are produced and no request is made.
- [ ] Reload mid-wizard and verify saved answers, target, and engagement name remain (the current step may return to the beginning).
- [ ] Finish scope and verify the dashboard opens and `started_at` is set once.
- [ ] Rerun and reset scope; verify existing statuses and notes are retained.
- [ ] Create two engagements, give them distinct names/statuses/notes, switch between them, and reload; verify each resumes independently.
- [ ] Delete one engagement, confirm its destructive warning, and verify the other remains. Verify the final remaining record cannot be deleted from the header.
- [ ] At 320–430 px verify the engagement switcher keeps the new and delete controls visible and usable rather than hiding them.
- [ ] Start with an original single-engagement v1 fixture and verify it migrates into the portfolio without data loss.
- [ ] Verify the automatic-save notice clearly explains same-browser/origin persistence, clearing/private-mode risks, no backup/sync, and JSON export.
- [ ] Inspect localStorage and confirm the project writes only `wapt.state.v1`.

### Phase 5 workspace

- [ ] Open one category and confirm its JSON is loaded lazily; global dashboard/search may then load all published categories.
- [ ] Verify homepage Active tests changes with static, API, and unknown saved scope.
- [ ] Search `CORS`, `JWT`, `BOLA`, a tool, tag, technology, and exact test ID.
- [ ] Combine every structured filter and reset it; text fields must retain focus while typing.
- [ ] Confirm Active and Confirm cards appear by default while context-N/A requires its filter.
- [ ] Override a context-N/A item with a reason and then clear the override.
- [ ] Exercise every status, multiline notes, reload persistence, Confirmed Finding retest, and retest clearing after status change.
- [ ] Export checklist Markdown, JSON state, and report Markdown; inspect warnings, findings, and retest matrix.
- [ ] Import valid exported JSON plus malformed, wrong-version, and oversized fixtures; only valid v1 state should replace local data.
- [ ] Print dashboard and a filtered checklist; verify light A4 output and intentionally expanded methodology sections.

### Keyboard and accessibility

- [ ] Use the skip link on both pages.
- [ ] Complete the wizard without a pointer.
- [ ] Verify forward navigation moves focus to the new step heading.
- [ ] Verify arrow keys move among choices and native Space toggles them.
- [ ] Press `/` outside an input to open Search.
- [ ] Open/close mobile navigation with keyboard and Escape.
- [ ] Verify all controls have visible focus and an accessible name.
- [ ] At 200% zoom, verify no content or action is lost.
- [ ] With reduced motion enabled, verify movement is effectively removed.

### Responsive and print

Use the intended compositions and evidence checklist in [RESPONSIVE-QA.md](RESPONSIVE-QA.md).

- [ ] Check 320×568, 375×812, 768×1024, 1024×768, 1366×768, 1440×900, 1920×1080, and 2560×1440 where available.
- [ ] Confirm layouts recompose: one-column compact phone, two-column tablet filters, stacked laptop dashboard panels, persistent desktop sidebar, and capped monitor content.
- [ ] Confirm sidebar becomes a dismissible drawer, transfers focus correctly, and cannot receive hidden focus while closed.
- [ ] Confirm long engagement names, URLs, mapping lines, code samples, category names, and findings tables do not cause page-level horizontal overflow.
- [ ] Repeat at 200% zoom and OS/browser large text.
- [ ] Print the dashboard and wizard review; verify navigation/action chrome is omitted and content remains legible.

### Persistence failure

- [ ] Disable or exhaust localStorage and confirm the UI remains usable with an explanatory console warning rather than crashing.
- [ ] Put malformed JSON under `wapt.state.v1`; reload and confirm safe defaults are used.
- [ ] Put an unsupported schema version under the key; reload and confirm safe defaults are used.

Record browser/version, operating system, viewport, theme, server mode, failures, and screenshots in the release PR.
