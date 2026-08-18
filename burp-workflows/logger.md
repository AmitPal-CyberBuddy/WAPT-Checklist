# Burp Logger workflow

> Authorized testing only. Use designated accounts and synthetic data. Redact secrets before saving or sharing evidence.

## When and why

Trace cross-tool, extension, background, and asynchronous traffic during complex workflows.

## Safe workflow

1. Filter to approved hosts and high-value fields.
2. Use unique synthetic correlation markers for jobs, callbacks, webhooks, and retries.
3. Reconstruct ordering across Proxy, Repeater, Scanner, extensions, and background requests.
4. Export only the minimal redacted event sequence needed for evidence.

## Evidence to retain

- Checklist item ID and engagement context.
- Minimal redacted request/response or event sequence.
- Account, role, tenant, synthetic object, browser/protocol, and timing context.
- Control versus probe outcome and false-positive exclusions.
- Cleanup, revocation, purge, or rollback confirmation.

## Boundaries

- Logger can capture secrets from every tool; apply aggressive redaction.
- Do not leave broad logging enabled beyond the test window.

## What this tool does not prove

Tool output does not prove exploitability, authorization intent, business impact, or finding severity. Apply the linked checklist item's validation, false-positive, impact, evidence, safety, and remediation guidance.
