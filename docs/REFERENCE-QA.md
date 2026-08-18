# Phase 8 — references and mapping QA

> In progress — 2026-08-18

## Deterministic verification completed

`node tools/check-references.js` validates the complete production catalog without network access:

- 608 production items;
- 231 unique reference and generated mapping URLs;
- 83 distinct WSTG 4.2 page paths verified against the OWASP WSTG repository tree;
- 153 used ASVS mappings verified against all 345 requirements in the official ASVS 5.0.0 flat JSON;
- OWASP Top 10 IDs restricted to explicit `2021` and `2025` editions;
- API Security Top 10 IDs restricted to `API1:2023` through `API10:2023`;
- WSTG references pinned to `v42`, never mutable `latest` paths;
- authoritative source-domain allowlisting and non-placeholder titles;
- duplicate per-item reference rejection.

The committed `tools/reference-catalog.json` records the source snapshot date, exact official sources, WSTG page-to-ID declarations, and all ASVS requirement IDs. Updating WSTG or ASVS mappings requires intentionally refreshing this snapshot and reviewing the diff.

### Mapping coverage

| Mapping family | Items mapped | Distinct IDs/URLs |
|---|---:|---:|
| WSTG 4.2 | 409 | 79 |
| ASVS 5.0.0 | 375 | 153 |
| OWASP Top 10 2021/2025 | 503 | 13 |
| API Security Top 10:2023 | 477 | 10 |
| CWE | 568 | 106 |
| PortSwigger Academy | 203 | 14 |

All 608 production items have at least one non-empty mapping family and at least one authoritative reference. The catalog contains 807 item-reference entries over 122 unique reference URLs.

## Live link checker

```bash
node tools/check-references.js --live
```

Live mode checks every unique reference, PortSwigger mapping URL, and generated CWE definition URL with bounded concurrency, redirects, timeouts, and retries. It writes the ignored local artifact `tools/link-report.json` for investigation.

The current sandbox blocks direct outbound HTTP from Node and curl at the transport layer; all URLs fail with `fetch failed` rather than an HTTP status. The checker detects this condition and exits separately instead of misreporting 231 broken links. Arena's page-retrieval channel was used to independently open the non-WSTG source families, including PortSwigger Academy topics, RFC Editor documents, OWASP API Security 2023 pages, W3C CSP/WebAuthn, WHATWG Fetch, OASIS SAML, and AWS/GCP/Azure storage documentation. A connected maintainer/CI environment must run `--live` at the Phase 8 release gate.

## Corrections already made

- Removed the invented `WSTG-v42-SESS-10` JWT mapping; WSTG 4.2 has session scenarios 01–09 and no JWT scenario.
- Kept Local/Remote File Inclusion subsection references without inventing decimal WSTG mapping IDs.
- Removed parent `WSTG-v42-INPV-05` mappings from NoSQL and ORM subsection items because those referenced v4.2 pages do not declare that scenario ID.
- Adopted ASVS 5.0.0 IDs from the official May 2025 stable release rather than carrying ASVS 4 identifiers forward.
- Added edition-qualified OWASP Top 10 mappings so 2021 and 2025 renumbering remains explicit.
- Added OASIS and official AWS, Google Cloud, and Microsoft documentation to the authoritative source policy.

## Remaining Phase 8 review

- Run the live checker from a network-enabled environment and resolve true non-success responses.
- Perform a reviewer-led semantic sample of every mapping family, prioritizing items with multiple framework mappings.
- Record any intentionally approximate mapping removal; never force a framework mapping merely for coverage.
- Refresh the final link report immediately before content freeze/release.
