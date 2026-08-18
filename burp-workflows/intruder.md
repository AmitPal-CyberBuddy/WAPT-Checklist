# Burp Intruder workflow

> Authorized testing only. Use designated accounts and synthetic data. Redact secrets before saving or sharing evidence.

## When and why

Run a small, bounded input matrix when manual variation is insufficient.

## Safe workflow

1. Define one payload position and a tiny reviewed list.
2. Use resource pools with explicit concurrency and delay.
3. Grep for stable semantic markers rather than response length alone.
4. Manually reproduce every lead in Repeater.

## Evidence to retain

- Checklist item ID and engagement context.
- Minimal redacted request/response or event sequence.
- Account, role, tenant, synthetic object, browser/protocol, and timing context.
- Control versus probe outcome and false-positive exclusions.
- Cleanup, revocation, purge, or rollback confirmation.

## Boundaries

- Never use credential stuffing, broad enumeration, storage exhaustion, or denial-of-service payloads.
- Stop on lockout, throttling, latency, errors, alerts, or effects outside the disposable object.

## What this tool does not prove

Tool output does not prove exploitability, authorization intent, business impact, or finding severity. Apply the linked checklist item's validation, false-positive, impact, evidence, safety, and remediation guidance.
