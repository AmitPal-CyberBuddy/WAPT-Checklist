# Burp Scanner workflow

> Authorized testing only. Use designated accounts and synthetic data. Redact secrets before saving or sharing evidence.

## When and why

Generate leads for authorized surfaces while keeping manual validation authoritative.

## Safe workflow

1. Restrict scan scope, insertion points, methods, and issue types to the approved plan.
2. Exclude logout, payment, messaging, destructive, file-processing, and expensive routes unless explicitly approved.
3. Review request count and audit items before active scanning.
4. Move each lead to the mapped checklist methodology for confirmation.

## Evidence to retain

- Checklist item ID and engagement context.
- Minimal redacted request/response or event sequence.
- Account, role, tenant, synthetic object, browser/protocol, and timing context.
- Control versus probe outcome and false-positive exclusions.
- Cleanup, revocation, purge, or rollback confirmation.

## Boundaries

- Scanner-only output is never a confirmed finding.
- Document false positives, auth context, safe proof, and root-cause remediation before reporting.

## What this tool does not prove

Tool output does not prove exploitability, authorization intent, business impact, or finding severity. Apply the linked checklist item's validation, false-positive, impact, evidence, safety, and remediation guidance.
