# How to run an engagement with this workspace

Operator documentation: what this tool is for, the working vocabulary, the loop it supports, and its honest limits. Contributor-facing detail lives in [Architecture](docs.html?doc=architecture) and [Adaptive engine](docs.html?doc=engine).

## Quick start

1. **Start a WAPT** — give the engagement a name and, optionally, the target URL. Nothing is ever sent to that target; the URL is stored locally for labelling and low-confidence hints only.
2. **Scope it** — answer the adaptive questions or pick a preset. `Not confirmed yet` is a real answer: affected checks stay visible as *Confirm*, never silently dropped.
3. **Open Test families** — the board lists every attack surface, its coverage, and where work is open. Pick a family, or press **Continue this suite** on a surface.
4. **Work the family** — read the Quick Test, run the checks, tick the Don't Miss variants, record coverage and any finding.
5. **Follow the next test** — the family's *After this family* and *What else should I check?* panels, or the dashboard's *What should I test next?*.
6. **Report** — export the Markdown report, the checklist, or the coverage CSV; keep evidence packs with their retest verdicts.

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
