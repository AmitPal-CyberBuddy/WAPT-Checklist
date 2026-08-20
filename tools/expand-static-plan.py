#!/usr/bin/env python3
"""Expand static-page playbook with the named tests from the product spec."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / 'playbooks' / 'static-page.json'


def check(**kwargs):
    return kwargs


def v(name, kind, payload, expect, observe=None):
    row = {'name': name, 'kind': kind, 'payload': payload, 'expect': expect}
    if observe:
        row['observe'] = observe
    return row


NEW = {
    'transport': [
        check(
            id='deprecated-tls',
            title='Deprecated TLS versions',
            item='WAPT-RECON-007',
            related=['WAPT-HTTP-014'],
            severity='high',
            tool='testssl.sh',
            why='SSLv2/3 and TLS 1.0/1.1 still offered on the public host.',
            validate='A real client completes a handshake on a deprecated protocol. A scanner grade alone is not a finding.',
            variants=[
                v('TLS 1.0 handshake', 'command',
                  'echo | openssl s_client -connect www.example.com:443 -servername www.example.com -tls1 2>/dev/null | head -n 20',
                  'Handshake refused (good) or completed (reportable if a browser or library can still negotiate it).',
                  ['Handshake success vs alert', 'Certificate still presented on TLS 1.0']),
                v('TLS 1.1 handshake', 'command',
                  'echo | openssl s_client -connect www.example.com:443 -servername www.example.com -tls1_1 2>/dev/null | head -n 20',
                  'Same as TLS 1.0. Repeat with -tls1_2 and -tls1_3 as the control.',
                  ['Which protocol versions complete', 'ALPN / cipher on the deprecated handshake']),
            ],
        ),
        check(
            id='weak-ciphers',
            title='Weak cipher suites',
            item='WAPT-RECON-007',
            related=['WAPT-HTTP-014'],
            severity='high',
            tool='testssl.sh',
            why='NULL, export, RC4, 3DES, or anonymous DH suites are still offered.',
            validate='testssl or openssl lists a weak suite that a client can actually negotiate — not a historic cipher in documentation.',
            variants=[
                v('Cipher inventory', 'command',
                  'testssl.sh -E https://www.example.com',
                  'No NULL/EXPORT/RC4/3DES/anon. Prefer AEAD (AES-GCM / CHACHA20-POLY1305).',
                  ['Offered suites', 'Whether a weak suite is selectable']),
                v('Force a weak suite', 'command',
                  'echo | openssl s_client -connect www.example.com:443 -servername www.example.com -cipher "RC4-SHA:DES-CBC3-SHA:NULL" 2>/dev/null | head -n 15',
                  'Handshake must fail. Success is the finding.',
                  ['Handshake result', 'Negotiated cipher name']),
            ],
        ),
        check(
            id='certificate',
            title='Certificate configuration',
            item='WAPT-RECON-007',
            related=['WAPT-HTTP-014'],
            severity='medium',
            tool='testssl.sh',
            why='Expired, hostname-mismatched, incomplete-chain, or wrong-SAN certificates break trust or enable look-alike hosts.',
            validate='A real client rejects the chain, or a SAN does not cover the host users type. Do not report a missing CT log as a finding.',
            variants=[
                v('Names and dates', 'command',
                  'echo | openssl s_client -connect www.example.com:443 -servername www.example.com 2>/dev/null | openssl x509 -noout -dates -subject -issuer -ext subjectAltName',
                  'NotBefore/NotAfter cover now. SAN includes www and the apex if users hit both.',
                  ['Validity window', 'SAN vs Host users type', 'Issuer']),
                v('Chain completeness', 'command',
                  'testssl.sh -S https://www.example.com',
                  'Intermediates are served. A leaf-only chain that still works via AIA is a lead, not always a finding.',
                  ['Chain length', 'Trust in a stock browser']),
            ],
        ),
        check(
            id='mixed-content',
            title='Mixed content',
            item='WAPT-HTTP-014',
            related=['WAPT-HDR-002', 'WAPT-CLIENT-023'],
            severity='medium',
            why='An HTTPS page still loads scripts, styles, or form actions over http://.',
            validate='A script, stylesheet, or form target is fetched or submitted over HTTP on the live page. An http:// in a comment is not a finding.',
            variants=[
                v('Active mixed content', 'note',
                  'View-source and DevTools Network on https://www.example.com/\nGrep: src="http://  href="http://  action="http://  url(http://',
                  'Any script/style/iframe/form over HTTP on an HTTPS page. Images are passive mixed content — lower impact.',
                  ['http:// requests on an https document', 'Whether a script actually executed', 'Form action scheme']),
                v('Upgrade-Insecure-Requests', 'request',
                  'GET / HTTP/1.1\nHost: www.example.com\nConnection: close',
                  'Content-Security-Policy: upgrade-insecure-requests is a control, not a substitute for fixing the URLs.',
                  ['CSP upgrade-insecure-requests present?', 'Whether http:// URLs remain in markup']),
            ],
        ),
    ],
    'headers': [
        check(
            id='x-content-type-options',
            title='X-Content-Type-Options',
            item='WAPT-HDR-008',
            related=['WAPT-HDR-001'],
            severity='low',
            why='User-influenced or downloadable bodies can be sniffed as HTML without nosniff.',
            validate='A realistic content-type mismatch is executed as HTML, or a downloadable user file is sniffed. Missing nosniff on a brochure is informational.',
            variants=[
                v('Read nosniff', 'request',
                  'GET / HTTP/1.1\nHost: www.example.com\nConnection: close',
                  'X-Content-Type-Options: nosniff on HTML and on any user-influenced or downloadable body.',
                  ['Header present on /', 'Header present on a .js / download URL']),
                v('HTML vs download', 'request',
                  'GET /assets/app.js HTTP/1.1\nHost: www.example.com\nConnection: close',
                  'Assets and error pages often drop nosniff. Compare / , a .js, and a 404.',
                  ['Content-Type', 'X-Content-Type-Options', 'Whether the body is user-influenced']),
            ],
        ),
        check(
            id='referrer-policy',
            title='Referrer Policy',
            item='WAPT-HDR-010',
            related=['WAPT-HDR-001'],
            severity='low',
            why='Tokens or internal paths in the URL leak cross-origin via Referer.',
            validate='A cross-origin navigation from a token-bearing URL actually sends the secret. Missing Referrer-Policy on a brochure with no secrets is informational.',
            variants=[
                v('Read the policy', 'request',
                  'GET / HTTP/1.1\nHost: www.example.com\nConnection: close',
                  'Referrer-Policy: strict-origin-when-cross-origin or stricter. unsafe-url is the weak case.',
                  ['Header value', 'Whether any URL on this origin carries a token']),
                v('Meta vs header', 'note',
                  '<meta name="referrer" content="no-referrer">',
                  'A meta referrer can override or conflict with the header. Record which one a browser applied.',
                  ['Header', 'Meta referrer', 'Actual Referer on a cross-origin click']),
            ],
        ),
        check(
            id='permissions-policy',
            title='Permissions Policy',
            item='WAPT-HDR-011',
            related=['WAPT-HDR-001'],
            severity='low',
            why='Camera, geolocation, payment, and similar powerful features stay available to this origin or its iframes.',
            validate='A powerful feature that this page does not need can be invoked, or an embedded frame inherits it. Absence on a static brochure is informational.',
            variants=[
                v('Read Permissions-Policy', 'request',
                  'GET / HTTP/1.1\nHost: www.example.com\nConnection: close',
                  'Permissions-Policy (or Feature-Policy leftover). camera=(), geolocation=(), microphone=(), payment=() for pages that do not use them.',
                  ['Which features are allowed', 'Whether an iframe inherits them']),
                v('Feature-Policy leftover', 'note',
                  'Feature-Policy: camera \'none\'; geolocation \'none\'',
                  'Feature-Policy is obsolete. Browsers honour Permissions-Policy. Do not report a missing Feature-Policy.',
                  ['Permissions-Policy vs Feature-Policy', 'Actual feature availability in DevTools']),
            ],
        ),
        check(
            id='corp',
            title='Cross-Origin Resource Policy',
            item='WAPT-HDR-014',
            related=['WAPT-HDR-012', 'WAPT-HDR-013'],
            severity='low',
            why='Sensitive responses can be included cross-origin as no-cors resources without CORP.',
            validate='A cross-origin no-cors read of a non-public body is possible. CORP missing on public marketing HTML is informational.',
            variants=[
                v('Read CORP', 'request',
                  'GET / HTTP/1.1\nHost: www.example.com\nConnection: close',
                  'Cross-Origin-Resource-Policy: same-origin or same-site on responses that must not be embedded cross-origin.',
                  ['CORP value', 'COOP / COEP companions', 'Whether the body is sensitive']),
                v('no-cors embed', 'html',
                  '<script>fetch("https://www.example.com/private.json", {mode:"no-cors"})</script>',
                  'Opaque success is not a finding. A readable non-public body is. Public HTML does not need CORP.',
                  ['Opaque vs readable', 'Status', 'Body sensitivity']),
            ],
        ),
        check(
            id='cache-control',
            title='Cache-Control',
            item='WAPT-HDR-015',
            related=['WAPT-HTTP-020', 'WAPT-HTTP-021'],
            severity='medium',
            why='Personalized or authenticated HTML stored in a shared cache is served to the next user.',
            validate='A shared cache or another browser session receives a personalized body. Public marketing HTML may be cacheable.',
            variants=[
                v('Read caching headers', 'request',
                  'GET / HTTP/1.1\nHost: www.example.com\nConnection: close',
                  'Cache-Control, Pragma, Expires, Vary. Authenticated or personalized HTML must be private / no-store.',
                  ['Cache-Control', 'Set-Cookie vs public', 'Vary']),
                v('Shared vs private', 'note',
                  'Cache-Control: public, max-age=31536000',
                  'Fine on hashed static assets. A finding on HTML that differs per user or carries a session.',
                  ['Is the body user-specific?', 'CDN cache hit on a second client']),
            ],
        ),
    ],
    'host-authority': [
        check(
            id='http-methods',
            title='HTTP method handling',
            item='WAPT-HTTP-001',
            related=['WAPT-HTTP-002', 'WAPT-HTTP-003'],
            severity='medium',
            why='TRACE, PUT, DELETE, or method override changes behaviour the page did not intend.',
            validate='An unexpected method returns a body, echoes input (TRACE), or changes state. OPTIONS listing a method is a lead, not a finding.',
            variants=[
                v('OPTIONS', 'request',
                  'OPTIONS / HTTP/1.1\nHost: www.example.com\nConnection: close',
                  'Allow / Access-Control-Allow-Methods. TRACE, PUT, DELETE on a static origin should not be live.',
                  ['Allow header', 'Status', 'Body']),
                v('TRACE', 'request',
                  'TRACE / HTTP/1.1\nHost: www.example.com\nX-WAPT: probe\nConnection: close',
                  'TRACE must not echo headers (XST). 405/501 is the secure case.',
                  ['Status', 'Whether X-WAPT is reflected in the body']),
                v('PUT / DELETE', 'request',
                  'PUT /wapt-method-probe.txt HTTP/1.1\nHost: www.example.com\nContent-Type: text/plain\nContent-Length: 4\nConnection: close\n\nwapt',
                  'Must not store a file. Follow with GET of the same path. Stop after one confirmed write and delete the object.',
                  ['PUT status', 'Follow-up GET', 'DELETE to clean up']),
            ],
        ),
        check(
            id='open-redirect',
            title='Open redirect',
            item='WAPT-HTTP-013',
            related=['WAPT-HTTP-010', 'WAPT-CLIENT-004'],
            severity='medium',
            why='A parameter or generated link accepts an absolute or protocol-relative URL and navigates off-origin.',
            validate='The browser or a Location header ends on an origin you control. Reflected text without navigation is not enough.',
            variants=[
                v('Absolute HTTPS', 'request',
                  'GET /?next=https://evil.example/ HTTP/1.1\nHost: www.example.com\nConnection: close',
                  'No 3xx to evil.example. Repeat for next, url, redirect, return, dest, continue, redir, target.',
                  ['Location header', 'Status', 'Refresh / meta / JS navigation']),
                v('Protocol-relative', 'request',
                  'GET /?next=//evil.example/ HTTP/1.1\nHost: www.example.com\nConnection: close',
                  'Rejected or treated as a relative path. Vulnerable if Location becomes //evil.example/.',
                  ['Location', 'Whether the path is treated as relative']),
                v('Backslash parse', 'request',
                  'GET /?next=/\\evil.example/ HTTP/1.1\nHost: www.example.com\nConnection: close',
                  'Some parsers treat /\\evil.example as scheme-relative. Also try /%2f%2fevil.example/.',
                  ['Location', 'Browser vs server parse']),
            ],
        ),
        check(
            id='request-smuggling',
            title='HTTP request smuggling',
            item='WAPT-SMUG-003',
            related=['WAPT-SMUG-001', 'WAPT-SMUG-004'],
            severity='high',
            why='Front-end and origin disagree on Content-Length vs Transfer-Encoding, so a second request can be prepended.',
            validate='A desync is demonstrated with a harmless marker on an authorized target, then stopped. Do not desync production traffic. Mapping hops first is mandatory.',
            variants=[
                v('Map the hops first', 'note',
                  'Record CDN / proxy / origin. Confirm a maintenance window. One paired probe at a time. Stop on queue anomalies.',
                  'Do not spray. WAPT-SMUG-001 is the prerequisite. This check is Confirm until hops are known.',
                  ['Hops', 'HTTP/1.1 vs HTTP/2', 'Authorization to probe']),
                v('CL.TE probe shape (authorized lab only)', 'request',
                  'POST / HTTP/1.1\nHost: www.example.com\nContent-Length: 6\nTransfer-Encoding: chunked\nConnection: close\n\n0\r\n\r\nX',
                  'A 400/timeout/desynced next response is a lead. Confirm with a single follow-up GET for a marker you placed. Never poison shared-user traffic.',
                  ['Status of the probe', 'Behaviour of the next request', 'Whether to STOP']),
            ],
        ),
    ],
    'paths': [
        check(
            id='sensitive-files',
            title='Sensitive file exposure',
            item='WAPT-INFO-008',
            related=['WAPT-INFO-006', 'WAPT-INFO-011'],
            severity='high',
            why='Environment, config, or debug endpoints are published on the origin.',
            validate='The retrieved file contains secrets or internals — not an empty 200 or a generic error page.',
            variants=[
                v('Environment file', 'request',
                  'GET /.env HTTP/1.1\nHost: www.example.com\nConnection: close',
                  'KEY=value content. Also /.env.local, /.env.production, /config.json, /appsettings.json. Redact secrets in evidence.',
                  ['Status', 'Body looks like KEY=value?', 'Whether values are live']),
                v('Debug and health', 'note',
                  '/server-status\n/server-info\n/phpinfo.php\n/actuator\n/metrics\n/debug\n/__debug__',
                  'A debug page or metrics with internals is in-scope. A public health 200 with no secrets is informational.',
                  ['Status', 'Body content class', 'Secrets vs liveness']),
            ],
        ),
        check(
            id='backup-files',
            title='Backup file exposure',
            item='WAPT-INFO-006',
            related=['WAPT-INFO-007'],
            severity='high',
            why='Editor swap files, old deploys, and archives sit next to live objects.',
            validate='The retrieved file is a real backup or source tree, not an empty 200.',
            variants=[
                v('Paired leftovers', 'note',
                  '/index.html.bak\n/index.html~\n/index.html.old\n/index.html.save\n/app.js.bak\n/dist.zip\n/release.tar.gz\n/backup.zip\n/www.zip\n/dump.sql',
                  'Pair each live file with .bak / ~ / .old / archives.',
                  ['Status', 'Body is a real backup?', 'Secrets inside']),
                v('Archive download', 'request',
                  'GET /backup.zip HTTP/1.1\nHost: www.example.com\nConnection: close',
                  'A 200 with a zip/tar body is the finding if it contains source or data. Confirm Content-Type and magic bytes.',
                  ['Status', 'Magic bytes', 'Whether to stop after one confirmed archive']),
            ],
        ),
        check(
            id='git-exposure',
            title='.git exposure',
            item='WAPT-INFO-007',
            related=['WAPT-INFO-006'],
            severity='high',
            why='A published .git tree lets an attacker reconstruct source and history.',
            validate='HEAD confirms a repo and objects are reachable. Do not mass-extract. Record HEAD and that config/objects respond.',
            variants=[
                v('HEAD', 'request',
                  'GET /.git/HEAD HTTP/1.1\nHost: www.example.com\nConnection: close',
                  'ref: refs/heads/… confirms a repo. Follow with /.git/config — redact remotes if they contain tokens.',
                  ['Status', 'Body starts with ref:', 'config reachable']),
                v('Directory vs forbidden', 'request',
                  'GET /.git/ HTTP/1.1\nHost: www.example.com\nConnection: close',
                  'A listing is extra impact. A 403 on / .git/ with 200 on HEAD is still a finding if objects are reachable.',
                  ['Listing vs 403', 'objects/pack or HEAD still 200']),
            ],
        ),
        check(
            id='source-maps',
            title='Source map exposure',
            item='WAPT-INFO-004',
            related=['WAPT-CLIENT-026', 'WAPT-RECON-015'],
            severity='medium',
            why='Published maps reconstruct original source and sometimes embed secrets.',
            validate='A live secret, internal URL, or non-public source tree is in the map. Readable client code alone is not a finding.',
            variants=[
                v('Direct map URL', 'request',
                  'GET /assets/app.js.map HTTP/1.1\nHost: www.example.com\nConnection: close',
                  'JSON source map with sourcesContent. Grep for secrets and internal hosts.',
                  ['JSON map?', 'sourcesContent present?', 'Secrets / internal URLs']),
                v('sourceMappingURL comment', 'note',
                  '//# sourceMappingURL=app.js.map',
                  'Follow every sourceMappingURL in published JS, including absolute CDN URLs.',
                  ['Comment present', 'Fetched map body', 'Secrets inside']),
            ],
        ),
        check(
            id='cloud-storage',
            title='Cloud storage exposure',
            item='WAPT-CLOUD-002',
            related=['WAPT-CLOUD-001', 'WAPT-CLOUD-003'],
            severity='high',
            why='A public bucket, listing, or world-readable object sits behind a static origin or a sibling hostname.',
            validate='An object you should not read is retrieved, or a listing names private keys. Do not write to the bucket.',
            variants=[
                v('Guess the bucket host', 'note',
                  'files.example.com\ncdn.example.com\nstatic.example.com\nexample-prod.s3.amazonaws.com\nstorage.googleapis.com/example',
                  'Inventory from JS, DNS, and certificate SANs. Confirm with a GET of a known public object first.',
                  ['Candidate hosts', 'DNS / cert SANs', 'Whether listing is enabled']),
                v('Listing probe', 'request',
                  'GET /?list-type=2 HTTP/1.1\nHost: files.example.com\nConnection: close',
                  'S3 ListBucketResult or GCS XML. Also try ?prefix=&delimiter=/. A listing of private keys is the finding.',
                  ['XML listing?', 'Object names', 'Whether a non-public object GETs']),
            ],
        ),
    ],
    'client': [
        check(
            id='dom-xss',
            title='DOM XSS',
            item='WAPT-XSS-004',
            related=['WAPT-CLIENT-001', 'WAPT-XSS-010'],
            severity='high',
            why='hash, search, or a path segment is written into innerHTML, eval, or a javascript: URL.',
            validate='A marker in the URL executes in the real page. A sink in a bundle that is never reached is not a finding.',
            variants=[
                v('Hash to HTML', 'note',
                  'https://www.example.com/#<img src=x onerror=alert(1)>\nhttps://www.example.com/?q=<img src=x onerror=alert(1)>',
                  'Grep the bundle for location.hash, location.search, document.write, innerHTML, insertAdjacentHTML.',
                  ['Sink in first-party JS', 'Marker executes', 'Encoding at the sink']),
                v('javascript: navigation', 'note',
                  'https://www.example.com/#javascript:alert(1)\nhttps://www.example.com/?next=javascript:alert(1)',
                  'Must not become location.href / window.open. data:text/html is the same class.',
                  ['Navigation sink', 'javascript: accepted?']),
            ],
        ),
        check(
            id='dom-redirect',
            title='DOM open redirect',
            item='WAPT-CLIENT-004',
            related=['WAPT-HTTP-013', 'WAPT-XSS-011'],
            severity='medium',
            why='Client-side navigation (location, router, window.open) accepts an absolute or javascript: URL.',
            validate='The page navigates off-origin or into a javascript: URL. A reflected string that is not used as a URL is not enough.',
            variants=[
                v('Absolute next', 'note',
                  'https://www.example.com/?next=https://evil.example/\nhttps://www.example.com/?next=//evil.example/',
                  'Watch location.assign / href / replace / router.push after load.',
                  ['Does the SPA navigate off-origin?', 'Which API was called']),
                v('javascript: next', 'note',
                  'https://www.example.com/?next=javascript:alert(1)',
                  'Must be rejected. This is XSS, not just a redirect.',
                  ['javascript: executed?', 'Sanitization']),
            ],
        ),
        check(
            id='js-secrets',
            title='Client-side secrets',
            item='WAPT-CLIENT-027',
            related=['WAPT-INFO-003', 'WAPT-RECON-014'],
            severity='critical',
            why='The published bundle contains a live privileged secret, not a public site key.',
            validate='A retrieved value authenticates as a privileged identity or signs a privileged request. A public Stripe pk_ or Mapbox token is not a finding.',
            variants=[
                v('Grep the bundle', 'note',
                  'api[_-]?key|secret|password|token|AKIA[0-9A-Z]{16}|sk_live_|ghp_|xox[baprs]-|Bearer [A-Za-z0-9._-]+',
                  'Confirm any hit is a live credential.',
                  ['Match in first-party JS', 'Does the value authenticate?', 'Public vs privileged']),
                v('Inline and comments', 'note',
                  'View-source: <script> blocks, data- attributes, HTML comments.',
                  'Same validation as the bundle. Redact in evidence.',
                  ['Inline script secrets', 'data-* attributes']),
            ],
        ),
        check(
            id='prototype-pollution',
            title='Prototype pollution',
            item='WAPT-CLIENT-018',
            related=['WAPT-CLIENT-019'],
            severity='high',
            why='Query, hash, or JSON is merged into an object without blocking __proto__ / constructor / prototype.',
            validate='A gadget you control changes application behaviour (XSS sink, bypass, or privilege). A silent merge into Object.prototype without impact is a weakness, not yet a reportable finding.',
            variants=[
                v('Query gadget', 'note',
                  'https://www.example.com/?__proto__[polluted]=wapt\nhttps://www.example.com/?constructor[prototype][polluted]=wapt',
                  'After load, Object.prototype.polluted === "wapt" in the console is the weakness. Then hunt a gadget.',
                  ['Object.prototype polluted?', 'Reachable gadget', 'Impact']),
                v('JSON merge', 'note',
                  '{"__proto__": {"polluted": "wapt"}}',
                  'Any JSON.parse + recursive merge of user JSON (config, postMessage, storage) is in scope.',
                  ['Merge utility in the bundle', 'User-controlled JSON', 'Gadget']),
            ],
        ),
        check(
            id='postmessage',
            title='postMessage security',
            item='WAPT-CLIENT-009',
            related=['WAPT-CLIENT-010', 'WAPT-XSS-005'],
            severity='high',
            why='The page listens for message and trusts event.data without checking event.origin.',
            validate='A page you control can drive a sink or an authenticated action. A listener that ignores unknown origins is not a finding.',
            variants=[
                v('Listener inventory', 'note',
                  "addEventListener('message', …)\nonmessage = …",
                  'For each listener, record whether origin is compared to an exact allowlist (===, not indexOf).',
                  ['Listeners', 'origin check', 'data used as HTML / nav / token']),
                v('Drive from an opener', 'html',
                  "<script>const w = window.open('https://www.example.com/');\nsetTimeout(() => w.postMessage({type:'setToken', token:'wapt'}, '*'), 1500);</script>",
                  'Must be ignored. A token or HTML sink accepting this is the finding. Use a test account.',
                  ['Was the message accepted?', 'Sink / action triggered']),
            ],
        ),
        check(
            id='third-party-js',
            title='Third-party JavaScript',
            item='WAPT-CLIENT-023',
            related=['WAPT-RECON-031', 'WAPT-HDR-003'],
            severity='medium',
            why='Analytics, widgets, and tag managers run with the origin\'s privileges.',
            validate='A third-party script can read sensitive DOM or cookies, or a compromised supply-chain host would execute here. Presence of analytics is not a finding.',
            variants=[
                v('Inventory', 'note',
                  'Document every script[src] host. Compare with CSP script-src.',
                  'Unexpected hosts, http:// scripts on https, or a tag manager that can inject arbitrary JS.',
                  ['Script hosts', 'CSP allows them?', 'Whether they see authenticated DOM']),
                v('SRI and CSP', 'request',
                  'GET / HTTP/1.1\nHost: www.example.com\nConnection: close',
                  'integrity= on third-party scripts; CSP script-src pinning. Missing SRI on a static brochure is a lead.',
                  ['integrity attributes', 'CSP script-src', 'Whether a host can be swapped']),
            ],
        ),
    ],
}


def main():
    data = json.loads(PATH.read_text())
    groups = {g['id']: g for g in data['groups']}
    for gid, extras in NEW.items():
        group = groups[gid]
        existing = {c['id'] for c in group['checks']}
        for extra in extras:
            if extra['id'] in existing:
                continue
            group['checks'].append(extra)
        group['surface'] = {
            'transport': 'tls',
            'headers': 'headers',
            'host-authority': 'http',
            'paths': 'http',
            'client': 'client',
        }[gid]
    # surface on existing groups already set; add observe to host-header / path-traversal / csp
    host = next(c for c in groups['host-authority']['checks'] if c['id'] == 'host-header')
    observes = {
        'Arbitrary Host': ['Status', 'Location / generated links', 'Whether evil.example is trusted'],
        'Duplicate Host': ['Which Host is processed', 'Front-end vs origin', 'Cache key'],
        'Duplicate Host reversed': ['Order sensitivity', 'Routing'],
        'Host normalization': ['Case / trailing dot / :443 vs canonical'],
        'Host with port': ['Generated URLs', 'Parse tricks'],
        'Absolute-form request target': ['Routing follows evil.example?', 'Generated links'],
        'X-Forwarded-Host': ['Location / links use evil.example?', 'Trusted proxy?'],
        'X-Host / X-Forwarded-Server': ['Same as X-Forwarded-Host'],
        'Forwarded (RFC 7239)': ['host= and proto= trusted?'],
        'X-Forwarded-Proto downgrade': ['http:// cookies or redirects'],
        'Line-wrapped / padded Host': ['Substring allowlist bypass'],
    }
    for variant in host['variants']:
        if variant['name'] in observes and 'observe' not in variant:
            variant['observe'] = observes[variant['name']]
    path = next(c for c in groups['paths']['checks'] if c['id'] == 'path-traversal')
    for variant in path['variants']:
        variant.setdefault('observe', [
            'Status vs a control file',
            'Body is the canary / outside the alias?',
            'Normalization differences',
        ])
    csp = next(c for c in groups['headers']['checks'] if c['id'] == 'csp')
    for variant in csp['variants']:
        variant.setdefault('observe', [
            'Enforced vs Report-Only',
            'unsafe-inline / unsafe-eval / wildcards',
            'Missing directives that matter on this page',
        ])

    PATH.write_text(json.dumps(data, indent=2) + '\n')
    count = sum(len(g['checks']) for g in data['groups'])
    print(f'wrote {PATH} with {count} checks')
    return count


if __name__ == '__main__':
    main()
