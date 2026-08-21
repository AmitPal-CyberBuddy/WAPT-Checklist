# Evidence, reportability, and retest workflow

This document describes how the workspace carries a tester from a checklist observation to a reportable finding and a verified retest. The rules live in pure engine modules (`js/engine/state.js`, `reportability.js`, `coverage.js`); the dashboard and report generator consume them.

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

The `do_not_report` guidance and this gate share one purpose: a scanner lead, absent header, or theoretical path is not a finding until behavior and impact are demonstrated.

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

## Where the data lives

Everything above runs locally in your browser. Evidence packs, verdicts, statuses, and notes are part of your engagement state in this browser's local storage — export JSON regularly and treat exports as sensitive. The report and coverage exports described here never leave your device unless you send them.
