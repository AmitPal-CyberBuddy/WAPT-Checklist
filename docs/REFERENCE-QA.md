# Phase 8 — references and mapping QA

> Complete — 2026-08-18

## Deterministic verification completed

`node tools/check-references.js` validates the complete production catalog without network access:

- 609 production items;
- 229 unique reference and generated mapping URLs;
- 83 distinct WSTG 4.2 page paths verified against the OWASP WSTG repository tree;
- 153 used ASVS mappings verified against all 345 requirements in the official ASVS 5.0.0 flat JSON;
- OWASP Top 10 IDs restricted to seven reviewed `2021` → `2025` category pairs, preventing silent edition renumbering;
- API Security Top 10 IDs restricted to `API1:2023` through `API10:2023`;
- 104 used CWE mappings verified in one official MITRE CWE API weakness query;
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
| CWE | 531 | 104 |
| PortSwigger Academy | 203 | 14 |

All 609 production items have at least one non-empty mapping family and at least one authoritative reference. The catalog contains 809 item-reference entries over 124 unique reference URLs.

## Live link checker

```bash
node tools/check-references.js --live
```

Live mode checks every unique reference, PortSwigger mapping URL, and generated CWE definition URL with bounded concurrency, redirects, timeouts, and retries. It writes the ignored local artifact `tools/link-report.json` for investigation.

The sandbox blocks direct outbound HTTP from Node and curl at the transport layer; the optional checker detects this condition separately instead of misreporting 229 broken links. Arena's independent page-retrieval channel successfully opened all 42 non-WSTG source/mapping URLs: PortSwigger Academy topics, RFC Editor documents, OWASP API Security 2023 pages, W3C CSP/WebAuthn, WHATWG Fetch, OASIS SAML, ASVS, and AWS/GCP/Azure storage documentation. `tools/live-source-catalog.json` records that successful live snapshot. WSTG pages were fetched from the official GitHub repository, and all used CWE IDs were accepted together by the official MITRE CWE API weakness endpoint.

## Corrections already made

- Removed the invented `WSTG-v42-SESS-10` JWT mapping; WSTG 4.2 has session scenarios 01–09 and no JWT scenario.
- Kept Local/Remote File Inclusion subsection references without inventing decimal WSTG mapping IDs.
- Removed parent `WSTG-v42-INPV-05` mappings from NoSQL and ORM subsection items because those referenced v4.2 pages do not declare that scenario ID.
- Removed prohibited category mappings `CWE-16` and `CWE-840`; replaced configuration cases with specific current weaknesses where appropriate.
- Adopted ASVS 5.0.0 IDs from the official May 2025 stable release rather than carrying ASVS 4 identifiers forward.
- Added edition-qualified OWASP Top 10 mappings so 2021 and 2025 renumbering remains explicit.
- Added OASIS and official AWS, Google Cloud, and Microsoft documentation to the authoritative source policy.

## Release maintenance

- Run `--live` from a network-enabled release environment to detect changes after this snapshot.
- Refresh WSTG, ASVS, CWE, and live-source snapshots intentionally and review every diff.
- Remove approximate mappings rather than forcing framework coverage.
- Refresh the final live report immediately before each content freeze or release.
