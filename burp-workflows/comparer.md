# Burp Comparer workflow

> Authorized testing only. Use designated accounts and synthetic data. Redact secrets before saving or sharing evidence.

## When and why

Compare paired identities, protocol variants, and control/probe responses without relying on visual memory.

## Safe workflow

1. Normalize volatile dates, request IDs, CSRF tokens, and synthetic object IDs before comparison.
2. Compare words and bytes for authorization, cache, parser, and error-response tests.
3. Keep the raw unnormalized evidence alongside the comparison.
4. Explain every security-relevant difference and benign variance.

## Evidence to retain

- Checklist item ID and engagement context.
- Minimal redacted request/response or event sequence.
- Account, role, tenant, synthetic object, browser/protocol, and timing context.
- Control versus probe outcome and false-positive exclusions.
- Cleanup, revocation, purge, or rollback confirmation.

## Boundaries

- A difference is a lead, not a vulnerability.
- Do not normalize away the field that carries the security decision.

## What this tool does not prove

Tool output does not prove exploitability, authorization intent, business impact, or finding severity. Apply the linked checklist item's validation, false-positive, impact, evidence, safety, and remediation guidance.
