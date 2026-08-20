# Post-publish review — 2026-08-20

## Scope

Reviewed the public GitHub Pages experience and the release-candidate branch as a first-time tester, a returning tester, and a maintainer. The review covered public copy, page consistency, navigation, loading behavior, runtime cost, accessibility, responsive composition, privacy, local links, evidence workflows, and deployment cache parity.

## Published-site finding

The public URL was initially serving the previous `1.0.0-r7` experience. The rendered homepage exposed project statistics, content-authoring links, and internal terminology; the application still presented Assessment, Page playbooks, Test families, Advanced scope, and the methodology catalog as competing concepts. PR #8 merged the corrected `1.0.0-r8` product on 2026-08-20, and GitHub Pages deployment run `32393019602` completed successfully. A cache-busted read-back then confirmed the new homepage title, operator-console copy, release manifest, and `css/polish.css` on the public URL.

## Findings and resolutions

| Area | Review result | Resolution |
|---|---|---|
| Product hierarchy | Too many parallel concepts | Page/function-first Testing Plan is the primary loop; coverage and reference views are secondary. |
| Visual consistency | Public and operator pages used uneven spacing, density, and card treatments | Added one shared product-polish layer across homepage, console, methodology, help, and workflow pages. |
| Navigation | Hash navigation appeared to blank and then repopulate | Added same-document View Transitions, cross-document transitions, delayed route progress, and stable loading states. |
| Initial performance | Homepage and unscoped console could load more data than needed | Homepage never fetches the catalog; unscoped console loads only surface plans; catalog, families, and chains load after a surface is selected. |
| Plan rendering | Large plans created hidden payload and form DOM | Heavy test bodies mount only when opened; a closed 183-test plan has zero payload blocks and zero status controls. |
| Long-list rendering | Off-screen cards still incurred layout work | Added `content-visibility` and intrinsic-size containment to long views. |
| Reporting cost | Coverage tables, findings, and evidence rendered during active testing | Aggregate reporting tables render when the reporting drawer opens; small progress summaries and evidence remain ready. |
| Filters | Filters were either too limited in-plan or too dense in the full library | Added in-plan text, progress, severity, guide type, depth, and surface filters; specialist library filters moved under More filters. |
| Public copy | QA, release, architecture, taxonomy, and authoring material appeared in normal navigation | Public help now exposes only engagement guidance, evidence/retesting, security/disclosure, and licensing. Maintainer documents remain directly addressable but are not promoted to testers. |
| Homepage | Two statistics bands and internal maturity counts distracted from the product | Replaced them with one product-proof strip and a real static-page Testing Plan preview. |
| Error states | Some errors exposed HTTP/manifest/repository implementation detail | Replaced them with short recovery-oriented messages; details remain in the console. |
| Accessibility | New light-theme tertiary text initially fell below AA | Dark and light final-token contrast is now tested; all small text tokens meet 4.5:1. |
| Motion accessibility | Motion needed a complete fallback | All route, shimmer, and view transitions stop under `prefers-reduced-motion`. |
| Link integrity | External-link audit treated inert payload domains as dependencies | Link verifier now recognizes reserved `.example`, `.test`, localhost, and loopback values; all local and external checks pass. |
| Hosted caching | Existing `r7` URLs could retain stale JS/CSS after deployment | Bumped every browser asset and the release manifest to `1.0.0-r8`. |

## Runtime observations

- Static plan: 183 catalog-derived rows.
- Default Core set: 30 tests.
- Closed plan at initial render: 0 payload `<pre>` blocks and 0 status controls.
- Opening Host Header Injection mounts only its 11 practical payload blocks.
- In-plan search reduces the working set without navigation or a catalog rerender.
- Homepage requests only the small release summary initially; attack paths load near the viewport.

## Verification completed

- Node test suite: all tests green.
- Scripted tester audit: 19/19 checks green.
- Functional browser workflow: 53/53 checks green.
- Content validation: 623 items, all category floors green.
- References: all pinned mappings and reference checks green.
- Content audit: no unresolved warnings.
- Public local asset/link targets: all resolve.
- External host allowlist: green after excluding reserved inert test hosts.
- Working tree: clean after commit.

## Deployment acceptance check

Completed after PR #8 and Pages deployment:

1. **Pass** — homepage title is `WAPT Checklist — Practical VAPT operator console`.
2. **Pass** — release manifest and browser assets use `1.0.0-r8`.
3. **Pass** — `css/polish.css` is publicly available.
4. **Pass** — homepage shows the product-proof strip; Project statistics and QA links are absent.
5. **Pass** — console opens on Testing Plan and asks “What are you looking at?”.
6. **Pass** — Static / published page produces 183 applicable tests and a 30-test Core set.
7. **Pass** — all six in-plan filter dimensions work without navigation.
8. **Pass** — practical bodies mount per test rather than at plan startup.
9. **Pass** — coverage, findings, and reporting open on demand.
10. **Pass** — scripted runtime recorded no uncaught errors or cross-origin requests.

The remaining release-candidate gate is manual visual sign-off in current Chromium and Firefox on real phone, tablet, laptop, and wide-monitor viewports.

### Workflow maintenance note

The successful CI and Pages runs emitted GitHub's Node 20 action deprecation annotation for `actions/checkout@v4` and `actions/setup-node@v4`. Reviewed `@v5` replacements are ready in `docs/workflows/ci.yml` and `docs/workflows/deploy.yml`. The Arena GitHub App is not permitted to modify `.github/workflows/**`; a repository maintainer must copy those templates into the active paths. This does not affect the successful r8 deployment or application runtime.
