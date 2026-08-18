# Burp Autorize workflow

> Authorized testing only. Use designated accounts and synthetic data. Redact secrets before saving or sharing evidence.

## When and why

Accelerate paired authorization comparisons while preserving two-account manual proof.

## Safe workflow

1. Configure only designated low/high account credentials and verify header replacement.
2. Seed synthetic objects owned by each account.
3. Browse normal workflows, then review every flagged response for body, state, ownership, and sharing policy.
4. Reproduce confirmed candidates in Repeater with only identity/object changed.

## Evidence to retain

- Checklist item ID and engagement context.
- Minimal redacted request/response or event sequence.
- Account, role, tenant, synthetic object, browser/protocol, and timing context.
- Control versus probe outcome and false-positive exclusions.
- Cleanup, revocation, purge, or rollback confirmation.

## Boundaries

- Automatic similarity decisions can miss or invent authorization flaws.
- Never use real customer identities or objects.

## What this tool does not prove

Tool output does not prove exploitability, authorization intent, business impact, or finding severity. Apply the linked checklist item's validation, false-positive, impact, evidence, safety, and remediation guidance.
