# Version 1.0.0 release and deployment

> Release candidate prepared 2026-08-18

## Release contents

- 608 production methodology items across 24 categories;
- context wizard, eight presets, conservative URL hints, and pure adaptive engine;
- local statuses, notes, overrides, retesting, import/export, reports, and print;
- full-text search and combined filters;
- five attack chains, 40 contextual payload references, and 12 Burp workflows;
- authoritative source snapshots, live-source catalog, content audit, and 158 Node tests;
- Apache-2.0 project license with retained third-party font and OWASP attribution.

`release.json` is the machine-readable release manifest.

## Installed workflows

A repository maintainer installed the reviewed workflow templates on 2026-08-18 because the Arena GitHub App cannot push `.github/workflows/**` without GitHub's workflows permission. The active files are:

- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`

The byte-matching review and recovery copies remain at `docs/workflows/ci.yml` and `docs/workflows/deploy.yml`. Any future workflow change must update the active file and template together in a maintainer-reviewed pull request.

## GitHub Pages deployment

GitHub Pages is enabled with **GitHub Actions** as its source and HTTPS enforcement. A successful push to `main` runs every release gate before publishing the static repository root. The public project URL is:

`https://amitpal-cyberbuddy.github.io/WAPT-Checklist/`

For every deployment:

1. merge a reviewed pull request into `main`; do not deploy a session branch as the permanent Pages source;
2. confirm both `CI` and `Deploy GitHub Pages` complete successfully;
3. verify the homepage, `/app.html#wizard`, methodology, documentation, Burp workflows, connected JSON, and static assets;
4. check both themes, narrow and laptop layouts, project-relative navigation, CSP, and runtime network requests;
5. set the repository homepage field to the Pages URL if repository-admin permission is available.

The release remains a candidate until the current reviewed `main` deployment completes this verification. The agent must not merge its own pull request.

## Mandatory release gates

```bash
node --test
node tools/validate.js checklist/sample.json
node tools/validate.js --floors
node tools/check-references.js
node tools/audit-content.js
python3 -m http.server 8000 --bind 0.0.0.0
```

Expected automated results for 1.0.0:

- 158/158 tests pass;
- 608 production items and all 24 category floors pass;
- five attack chains, 40 payload references, and 12 Burp workflows pass;
- reference QA covers 229 unique reference/mapping URLs, 83 WSTG pages, 153 used ASVS IDs, 104 CWE weaknesses, and 42 live-verified non-WSTG URLs;
- content audit reports zero errors and zero unresolved warnings.

## Browser and deployment smoke

Run `docs/QA.md` and `docs/RESPONSIVE-QA.md` in at least current Chromium and Firefox, dark and light themes, desktop and narrow viewport. In addition:

- inspect the Network panel for zero third-party runtime assets and no target URL request;
- confirm CSP has no violation and all fonts/modules/category JSON are same-origin;
- complete every preset and check Active/Confirm/N/A behavior;
- search CORS, JWT, BOLA, a tool, tag, and exact ID;
- record status/notes, reload, export/import JSON, and generate a report/retest matrix;
- open Chains and Payloads, verify REVIEW-ONLY entries remain collapsed;
- print dashboard and a filtered checklist;
- verify root-relative repository Pages paths under `/WAPT-Checklist/`;
- test 404 navigation back to the root because GitHub Pages has no SPA rewrite requirement.

## Release publication

After Pages and browser smoke pass:

1. update `release.json` status from `release-candidate` to `released` in a reviewed follow-up commit;
2. set the repository homepage URL;
3. create Git tag `v1.0.0` from the reviewed `main` commit;
4. create a GitHub release using the `CHANGELOG.md` 1.0.0 notes;
5. attach no local-state or assessment exports to the public release;
6. retain the machine QA reports and source snapshots in the repository.

## Rollback

GitHub Pages artifacts are immutable per workflow run. To roll back, revert the faulty commit on `main`, let the deploy workflow publish the reverted root, and verify the same release gates. Never restore a release by weakening CSP, bypassing validators, or deleting stable published IDs.
