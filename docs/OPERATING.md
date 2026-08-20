# How to run an engagement with this workspace

Operator documentation: what this tool is for, the working vocabulary, the loop it supports, and its honest limits.

## Quick start

1. **Start testing** — open the assessment workspace. Set **application type**, **authentication**, and **features**. Optionally add the target URL (never fetched).
2. **Read the plan** — the dashboard lists **every applicable test** for that profile, grouped as TLS, Security Headers, HTTP / Server, Client-Side, and (when in scope) Authentication, Session, Authorization, API, JWT, upload, checkout. A static site hides login, IDOR, and privilege tests. The **Applicable tests** number is catalog-derived (how many of the 623 checks are Active or Confirm for this profile) — not the number of authored overlays. It is split into **authored playbooks** (named variants + payloads) and **methodology-only** (the checklist item with practical variants still to run).
3. **Run a test** — authored tests open a Quick Test, named attack hypotheses you tick as you cover them (coverage only, never findings), a one-line Why per variant, copyable payloads, CHECK FOR, VALIDATE, and DO NOT REPORT. A **methodology-only** row shows its maturity chip and opens the full methodology instead of a fabricated request. **Copy share link** sends the scope as a URL (never findings). Advanced 18-question scope remains available.
4. **Open Test families** — the board lists every attack surface, its coverage, and where work is open. Pick a family, or press **Continue this suite** on a surface.
5. **Work the family** — read the Quick Test, run the checks, tick the Don't Miss variants, record coverage and any finding.
6. **Follow the next test** — the family's *After this family* and *What else should I check?* panels, or the dashboard's *What should I test next?*.
7. **Report** — export the Markdown report, the checklist, or the coverage CSV; keep evidence packs with their retest verdicts.

The engagement is saved continuously in this browser only. Closing the tab is safe; the workspace reopens on the family you were last working.

## What this is — and is not

| It is | It is not |
| --- | --- |
| An engagement checklist, coverage tracker, and memory aid for someone who already knows how to test | A scanner, an exploit tool, or a replacement for testing skill |
| A knowledge base of 623 decision-grade checks across 25 surfaces, grouped into 196 test families | A tutorial platform — depth is available, but the default view is the working layer |
| A local-first workspace: state lives in `wapt.state.v1` in this browser | A hosted service — there is no account, backend, sync, or telemetry |
| A record of what *you* covered and confirmed | Evidence that the target is secure. Coverage measures the tester, not the application |

**This workspace never contacts the target.** It issues no requests to any host you enter, it has no engine, and it cannot confirm anything for you. Every result in it is what you recorded.

## Coverage vocabulary

Coverage is only honest if these states stay distinct. They are separate on purpose:

| State | Meaning | Counts as tested? | In the coverage denominator? |
| --- | --- | --- | --- |
| **Not tested** | nothing recorded yet | no | yes |
| **Testing now** | started, not finished | no | yes |
| **Tested** | the check was executed | yes | yes |
| **Blocked** | cannot be executed right now (credentials, environment, client instruction) | no | yes — it is still owed |
| **N/A** | out of scope: by the scope answers (context-N/A) or marked by you | no | no |

`coverage = tested ÷ executable`, where `executable = total − N/A`.

**Finding is a separate question.** Each check carries a coverage control *and* a finding verdict (`No finding` · `Potential` · `Confirmed`). Recording a finding implies the check ran; recording coverage never implies a vulnerability. A completed checklist item is not a finding, and a confirmed finding is not a report until the evidence gate (observation → weakness → demonstrated → reportable) is satisfied.

**Don't Miss ticks are a third record.** They mark that you covered a variant (a method, a nested path, an export equivalent, a tenant boundary). They never imply a finding and never move the check's status.

## The family contract

Every family states four facts before you open it, all derived from the checks inside it:

- **Needs** — the scope prerequisites (two accounts, a second tenant, an upload feature, a GraphQL endpoint). If you do not have them, the family is not today's work.
- **Mode** — manual, mixed, or tool-assisted.
- **Tools** — the Burp workflows that drive it, linked to their safe-use pages.
- **Maps to** — WSTG · ASVS · OWASP · API · CWE identifiers for the report.

Plus a boundary line: **NOT HERE** names the sibling families that own the rest of that attack surface, so object-level, function-level, field-level, and tenant authorization never blur together.

## Keyboard

| Key | Action |
| --- | --- |
| `/` | Search the methodology |
| `g` `d` | Dashboard |
| `g` `p` | Page playbooks |
| `g` `t` | Test families |
| `g` `c` | All tests |
| `g` `f` | Findings |
| `n` / `p` | Next / previous check |
| `e` | Expand or collapse the focused check |
| `?` | Shortcut reference |
| `Esc` | Close a drawer or dialog |

## Output and evidence

| Output | Use it for |
| --- | --- |
| **Copy share link** (assessment) | URL that rebuilds the same applicable plan from scope answers only |
| **Copy plan Markdown** (assessment) | Paste-ready checklist of matching surfaces and tests |
| **Copy coverage** (family header) | Markdown block for engagement notes, stand-ups, and status updates |
| **Export coverage CSV** | Client trackers and retest matrices: one row per check, coverage state and finding in separate columns |
| **Export checklist (Markdown)** | The engagement checklist with per-surface tested/N/A/blocked counts |
| **Generate report (Markdown)** | Findings, evidence packs, retest verdicts, reporting-quality gate, and methodology coverage |
| **Export JSON** | The whole engagement, for backup or moving browsers. Treat it as sensitive |

Redact credentials, tokens, personal data, and tenant identifiers before anything leaves the browser. Exports are produced locally by your browser; nothing is uploaded.

## Limits

- **Coverage is not a grade.** There is no A–F score, and there never will be — a percentage of *your* checklist is not a statement about the application's security.
- **Suggestions are heuristics.** The next-test engine ranks by proximity, scope, chains, and severity; it does not know your target. Ignore it whenever your judgement disagrees.
- **Applicability is conservative.** Unknown scope keeps a check visible as *Confirm* rather than hiding it. Context-N/A is overridable with a written reason.
- **Attack chains are hypotheses**, not proof. Every prerequisite still has to be validated.
- **Local storage is not a backup.** Clearing site data deletes the engagement. Export JSON regularly.
