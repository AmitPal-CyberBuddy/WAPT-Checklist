# Security policy

## Supported version

The latest 1.0.x release and the latest commit on the default branch receive security fixes. Development snapshots and superseded patch releases are not supported.

## Reporting a vulnerability

Please do not open a public issue for a vulnerability in this repository or its deployed GitHub Pages application.

Use GitHub's private vulnerability reporting feature for `AmitPal-CyberBuddy/WAPT-Checklist`:

1. open the repository's **Security** tab;
2. choose **Advisories**;
3. select **Report a vulnerability**;
4. include affected files/version, prerequisites, reproduction steps, impact, and a suggested mitigation if available.

If private reporting is unavailable, contact the maintainer through the private contact method listed on the GitHub profile and ask for a secure reporting channel. **Do not send credentials, live target information, access tokens, or personal data.**

You should receive an acknowledgement within seven days. We will validate the report, agree on disclosure timing, prepare a fix, and credit the reporter if requested. Please allow reasonable remediation time before disclosure.

## Scope

Examples of in-scope project security concerns:

- imported state causing script or markup execution;
- CSP bypass introduced by project code;
- unintentional network transmission of target, answer, note, status, or finding data;
- unsafe persistence or export behavior;
- methodology behavior that silently expands review-only destructive material;
- dependency or deployment workflow compromise.

Content mapping disagreements, broken references, duplicate tests, and ordinary documentation corrections are not confidential vulnerabilities; report those through normal issues without including live engagement data.

## Deployment model

The application is static and has no project-operated backend. Engagement data is designed to remain in the user's browser under `wapt.state.v1` unless the user explicitly exports it. GitHub Pages and the user's browser remain part of the deployment trust boundary.

## Authorized use

This policy does not authorize testing third-party systems, GitHub infrastructure, or the maintainer's unrelated properties. Test only systems you own or are explicitly authorized to assess, and use the least disruptive proof.
