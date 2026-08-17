# Manual browser QA

Automated tests use Node's standard library. This checklist covers browser behavior that cannot be fully verified in the sandbox. Run it against both `python3 -m http.server` and the GitHub Pages deployment before a release.

## Phase 2 smoke test

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

- [ ] Complete all 14 questions with Back, Continue, and Use Unknown.
- [ ] Verify every question can be left Unknown.
- [ ] Select multiple values and verify selecting Unknown clears specific selections and vice versa.
- [ ] Select white-box mode and verify the credential-availability step is skipped while source access remains.
- [ ] Apply each of the four presets and verify every answer is editable afterward.
- [ ] Enter HTTP, `api.`, `admin.`, `dev.`/`staging.`, ports 8443/9443, and punycode target examples; verify hints are low-confidence and no URL is fetched.
- [ ] Enter localhost, loopback, private, link-local, credential-bearing, malformed, and non-HTTP URLs; verify no hints are produced and no request is made.
- [ ] Reload mid-wizard and verify saved answers, target, and engagement name remain (the current step may return to the beginning).
- [ ] Finish scope and verify the dashboard opens and `started_at` is set once.
- [ ] Rerun and reset scope; verify existing statuses and notes are retained.
- [ ] Inspect localStorage and confirm the project writes only `wapt.state.v1`.

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

- [ ] Check 320 px, 768 px, 1024 px, and wide desktop layouts.
- [ ] Confirm sidebar becomes a dismissible drawer and does not trap hidden focus on mobile.
- [ ] Confirm long engagement names, URLs, and category names do not cause horizontal page overflow.
- [ ] Print the dashboard and wizard review; verify navigation/action chrome is omitted and content remains legible.

### Persistence failure

- [ ] Disable or exhaust localStorage and confirm the UI remains usable with an explanatory console warning rather than crashing.
- [ ] Put malformed JSON under `wapt.state.v1`; reload and confirm safe defaults are used.
- [ ] Put an unsupported schema version under the key; reload and confirm safe defaults are used.

Record browser/version, operating system, viewport, theme, server mode, failures, and screenshots in the release PR.
