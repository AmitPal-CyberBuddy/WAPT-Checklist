# Phase 9 — content and safety QA report

> Complete — 2026-08-18

## Result

The production methodology passes the zero-dependency content audit with **0 errors and 0 unresolved warnings**.

```bash
node tools/audit-content.js --report=tools/content-audit-report.json
node tools/check-references.js
node tools/validate.js --floors
node --test
```

## Catalog metrics

| Metric | Result |
|---|---:|
| Production items | 623 |
| Categories | 25 |
| Manual / automated | 582 / 26 |
| Items with explicit safety notes | 364 |
| Conditional methodology variants | 19 |
| Reference entries / unique URLs | 836 / 127 |
| Related-item links | 28 |
| Attack-chain memberships | 20 |
| Attack chains | 5 |
| Payload/reference entries | 40 |
| Burp workflows | 12 |

## Checks performed

### Duplication and contradictions

- Exact normalized title and objective duplicates are rejected.
- Every pair of production items is compared with token-set similarity for near-duplicate title/objective combinations.
- The only high-similarity pair is the deliberate CL.TE versus TE.CL protocol pair; it is explicitly documented in the audit allowlist because front-end/back-end framing direction makes these different tests.
- Secure and vulnerable decision boundaries, validation, and false-positive text remain separate required fields.
- Cross-category overlap was retained only where the objective changes—for example, discovery versus exploitation confirmation, generic authorization versus API transport, and business invariant versus concurrency mechanism.

### Terminology and currency

- Imperative-title vocabulary is checked across all production items.
- `allowlist`/`denylist` terminology is required; deprecated blacklist/whitelist wording is rejected.
- TODO/TBD/FIXME and authoring placeholders are rejected.
- X-XSS-Protection, HPKP, and Expect-CT appear only as explicitly tagged obsolete guidance.
- OWASP editions, ASVS 5.0.0 IDs, WSTG 4.2 page IDs, API Top 10:2023, and CWE weakness IDs are enforced by Phase 8 snapshots.

### False-positive and evidence quality

Every item has at least:

- four controlled steps;
- two realistic false-positive explanations;
- three evidence requirements;
- root-cause remediation;
- an authoritative reference and non-empty mapping family.

Security-header checks must explicitly reject scanner-only or missing-header-only conclusions. Reference titles and examples are checked for placeholder/live-target content.

### Safety

- Request-smuggling and race-condition items require REVIEW-ONLY safety boundaries.
- SSRF, XXE/external entities, command injection, deserialization, ReDoS, archive/pixel/decompression, remote inclusion, and cache-poisoning techniques require safety notes.
- Payload values are checked for destructive commands, metadata addresses, ready script tags/events, JNDI strings, and similar unsafe ready-to-run syntax.
- Phase 7 validation ensures REVIEW-ONLY payload flags/tags and collapsed UI behavior.
- Evidence guidance requires designated identities, synthetic data, redaction, cleanup, and stop conditions according to technique risk.

## Issues found and resolved

1. Replaced a synthetic HTML comment containing `TODO`, which looked like an unresolved authoring placeholder.
2. Added an explicit bounded safety note to the regular-expression metacharacter test.
3. Documented CL.TE and TE.CL as an intentional near-title pair rather than merging two directionally distinct parser-disagreement tests.
4. Removed seven incorrect WSTG parent mappings from NoSQL/ORM subsection content during Phase 8.
5. Removed prohibited CWE category mappings (`CWE-16`, `CWE-840`) and used specific weaknesses or honest empty CWE mappings.
6. Expanded payload coverage to all 24 categories while keeping destructive/DOS references REVIEW-ONLY and non-executable.

## Artifacts

- Human report: `docs/CONTENT-QA-REPORT.md`
- Machine report: `tools/content-audit-report.json`
- Audit implementation: `tools/audit-content.js`
- Reference QA: `docs/REFERENCE-QA.md`
- Manual browser smoke checklist: `docs/QA.md`
