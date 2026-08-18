# Evidence, reportability, and retest workflow

> Phase 4 implementation contract — 2026-08-18

This document describes how the workspace carries a tester from a checklist observation to a reportable finding and a verified retest. The rules live in pure engine modules (`js/engine/state.js`, `reportability.js`, `coverage.js`) and are exercised by `tests/workflow-e2e.test.js`; the dashboard and report generator consume them.

## Decision workflow

```text
Checklist item (methodology)
        ↓
Observation (a recorded behavior change)
        ↓
Security weakness (behavior violates the item's secure_behavior)
        ↓
Exploitability demonstrated (proven or likely, with validation evidence)
        ↓
Reportable finding (explicit reportable flag + do-not-report boundary review)
        ↓
Evidence pack → Report → Remediation → Retest verdict → Residual risk
```

A checklist status alone never creates a finding. `potential_finding` marks work to validate; `confirmed_finding` is the only status that can receive an evidence pack.

## Evidence pack fields

Every pack records, with per-field length caps and strict import normalization:

- **Context:** checklist item ID, title, severity, endpoint, HTTP method, parameter, authentication context, precondition.
- **Proof:** baseline request, test request, observed behavior.
- **Decision:** exploitability (`not_demonstrated` / `likely` / `proven`), reportable flag.
- **Closure:** cleanup performed, root cause.
- **Retest:** verdict (`pending` / `pass` / `partial` / `fail`), retest note.

All user text must be redacted before recording: no credentials, tokens, personal data, or tenant identifiers. Exports escape everything HTML-safe; a pack can never outlive its Confirmed Finding status change because recording requires that status at creation time.

## Reportability gate

`classifyReportability()` reasons about recorded evidence only:

- No test request + observed behavior → **Observation**: "Record the test request and the observed behavior…".
- Evidence recorded → **Weakness** (baseline reminder included).
- Exploitability `proven`/`likely` → **Demonstrated**.
- Demonstrated + reportable flag → **Reportable**, with the item's `do_not_report` boundary surfaced for final review.

The Phase 2 `do_not_report` content and this gate share one purpose: a scanner lead, absent header, or theoretical path is not a finding until behavior and impact are demonstrated.

## Retest verdicts

| Verdict | Meaning | Guidance |
|---|---|---|
| `pending` | Not yet retested | Reproduce original evidence, verify root cause, then test adjacent variants. |
| `pass` | Original evidence no longer reproduces | Spot-check adjacent variants and confirm root-cause remediation before closing. |
| `partial` | Fixed, but an adjacent variant reproduces | Keep the finding open and extend remediation. |
| `fail` | Original evidence still reproduces | Escalate with new attempt details; confirm the fix reached every hop and cache. |

Variant suggestions derive from the item's related IDs plus a standard set: alternate and nested identifiers, bulk/export/batch equivalents, alternate API versions and mobile/GraphQL/WebSocket equivalents, and HTTP method/content-type variations.

## Coverage confidence

Coverage is **recorded work ÷ executable work**. Context-N/A items are scoped out of the denominator; credential-blocked items are counted separately. Coverage never inflates from inapplicable or untestable work, and N/A is never treated as tested.

## Where it lives

- `js/engine/state.js` — schema v2, evidence-pack CRUD, retest verdicts, v1 migration.
- `js/engine/reportability.js` — finding-decision gate and retest guidance.
- `js/engine/coverage.js` — coverage math and retest queue.
- `js/ui/workspace.js` — evidence form, evidence-pack cards, dashboard panels.
- `js/ui/export.js` — report sections for evidence packs and the retest matrix.
