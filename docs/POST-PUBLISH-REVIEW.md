# Post-publish review — 2026-08-20

## Scope

Reviewed the public GitHub Pages experience and the release-candidate branch as a first-time tester, a returning tester, and a maintainer. The review covered public copy, page consistency, navigation, loading behavior, runtime cost, accessibility, responsive composition, privacy, local links, evidence workflows, and deployment cache parity.

## Published-site finding

The public URL was still serving the previous `1.0.0-r7` experience during this review. The rendered homepage exposed project statistics, content-authoring links, and internal terminology; the application still presented Assessment, Page playbooks, Test families, Advanced scope, and the methodology catalog as competing concepts. The corrected product is packaged as `1.0.0-r8` on this branch. GitHub Pages will receive it when this branch is merged and the deployment workflow completes.

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

After merge and Pages deployment, verify:

1. Homepage title is `WAPT Checklist — Practical VAPT operator console`.
2. HTML and browser assets reference `1.0.0-r8`.
3. `css/polish.css` returns 200.
4. The homepage shows one product-proof strip, not Project statistics or QA links.
5. The console opens on Testing Plan and asks “What are you looking at?”.
6. Selecting Static / published page shows 183 applicable tests and a 30-test Core set.
7. Search, progress, severity, guide-type, depth, and surface filters work without navigation.
8. Opening a test mounts its practical body without blocking the rest of the plan.
9. Coverage, findings, and reporting open on demand.
10. Browser console has no uncaught errors and no cross-origin runtime requests.
