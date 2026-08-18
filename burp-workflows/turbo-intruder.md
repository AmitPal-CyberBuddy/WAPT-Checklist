# Burp Turbo Intruder workflow

> Authorized testing only. Use designated accounts and synthetic data. Redact secrets before saving or sharing evidence.

## When and why

Deliver a tiny synchronized request set for explicitly approved race or timing tests.

## Safe workflow

1. Begin with a sequential invariant control and fresh disposable resource.
2. Set an explicit request count and concurrency in code before running.
3. Prefer last-byte or gate synchronization to volume.
4. Collect every response and verify authoritative ledger/object state once.

## Evidence to retain

- Checklist item ID and engagement context.
- Minimal redacted request/response or event sequence.
- Account, role, tenant, synthetic object, browser/protocol, and timing context.
- Control versus probe outcome and false-positive exclusions.
- Cleanup, revocation, purge, or rollback confirmation.

## Boundaries

- REVIEW ONLY: never flood, stress, spray, or test shared production resources.
- Stop on latency, errors, duplicate effects, or impact outside the test object.

## What this tool does not prove

Tool output does not prove exploitability, authorization intent, business impact, or finding severity. Apply the linked checklist item's validation, false-positive, impact, evidence, safety, and remediation guidance.
