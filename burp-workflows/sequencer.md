# Burp Sequencer workflow

> Authorized testing only. Use designated accounts and synthetic data. Redact secrets before saving or sharing evidence.

## When and why

Assess randomness only when token unpredictability is the real security boundary.

## Safe workflow

1. Collect tokens from disposable sessions under one controlled issuance path.
2. Strip fixed prefixes only when documented and preserve the analysis decision.
3. Use enough samples for a meaningful statistical review without stressing issuance.
4. Combine statistical output with implementation, entropy, lifecycle, and predictability evidence.

## Evidence to retain

- Checklist item ID and engagement context.
- Minimal redacted request/response or event sequence.
- Account, role, tenant, synthetic object, browser/protocol, and timing context.
- Control versus probe outcome and false-positive exclusions.
- Cleanup, revocation, purge, or rollback confirmation.

## Boundaries

- A failed statistical test does not alone prove practical prediction.
- Stop collection on rate limits, account alerts, or service impact.

## What this tool does not prove

Tool output does not prove exploitability, authorization intent, business impact, or finding severity. Apply the linked checklist item's validation, false-positive, impact, evidence, safety, and remediation guidance.
