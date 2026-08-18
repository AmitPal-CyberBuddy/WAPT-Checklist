# Burp Repeater workflow

> Authorized testing only. Use designated accounts and synthetic data. Redact secrets before saving or sharing evidence.

## When and why

Perform paired manual controls and preserve exact request/response evidence.

## Safe workflow

1. Duplicate the baseline into control and probe tabs.
2. Change one method, parameter, header, token, object, or body field at a time.
3. Repeat control/probe/control to exclude cache, timing, WAF, and asynchronous variance.
4. Name tabs with checklist ID, account alias, and object alias; redact before export.

## Evidence to retain

- Checklist item ID and engagement context.
- Minimal redacted request/response or event sequence.
- Account, role, tenant, synthetic object, browser/protocol, and timing context.
- Control versus probe outcome and false-positive exclusions.
- Cleanup, revocation, purge, or rollback confirmation.

## Boundaries

- Use reversible synthetic state and confirm authoritative before/after effects.
- Do not use successful status codes as proof without data or committed-state validation.

## What this tool does not prove

Tool output does not prove exploitability, authorization intent, business impact, or finding severity. Apply the linked checklist item's validation, false-positive, impact, evidence, safety, and remediation guidance.
