export const PRESETS = Object.freeze({
  static_marketing: Object.freeze({
    id: 'static_marketing', title: 'Static marketing site',
    description: 'Public content, no identity, API, or application data layer.',
    answers: Object.freeze({
      mode: 'black_box', creds: 'none', app_type: 'static', has_login: 'no', registration: 'no', roles: 'none',
      auth_mechanism: ['none'], identity_features: ['none'], api_docs: 'none', source_access: 'none', backend: ['none'],
      api_style: ['none'], database: ['none'], cloud: 'unknown', features: ['none'], intermediary: ['unknown'], outbound_fetch: ['none'], async_jobs: 'no'
    })
  }),
  saas_jwt_api: Object.freeze({
    id: 'saas_jwt_api', title: 'SaaS multi-tenant app',
    description: 'SPA, JWT identity, REST API, several roles, and tenant boundaries.',
    answers: Object.freeze({
      mode: 'grey_box', creds: 'high', app_type: 'spa', has_login: 'yes', registration: 'yes', roles: 'many',
      auth_mechanism: ['jwt'], identity_features: ['password', 'mfa', 'recovery'], api_docs: 'openapi', source_access: 'none', backend: ['node'],
      api_style: ['rest'], database: ['sql'], cloud: 'aws', features: ['multi_tenant'], intermediary: ['unknown'], outbound_fetch: ['unknown'], async_jobs: 'unknown'
    })
  }),
  corporate_portal: Object.freeze({
    id: 'corporate_portal', title: 'Enterprise SSO portal',
    description: 'Cookie sessions, OIDC/SAML SSO, MFA, multiple roles, and hybrid delivery.',
    answers: Object.freeze({
      mode: 'grey_box', creds: 'high', app_type: 'hybrid', has_login: 'yes', registration: 'no', roles: 'many',
      auth_mechanism: ['cookie', 'oauth'], identity_features: ['mfa', 'recovery', 'remember_device'], api_docs: 'unknown', source_access: 'none', backend: ['java'],
      api_style: ['rest'], database: ['sql', 'ldap'], cloud: 'self_hosted', features: ['file_upload'], intermediary: ['unknown'], outbound_fetch: ['unknown'], async_jobs: 'unknown'
    })
  }),
  ecommerce: Object.freeze({
    id: 'ecommerce', title: 'E-commerce with payments',
    description: 'Customer identity, checkout workflows, uploads, search, email, and APIs.',
    answers: Object.freeze({
      mode: 'grey_box', creds: 'high', app_type: 'hybrid', has_login: 'yes', registration: 'yes', roles: 'few',
      auth_mechanism: ['cookie'], identity_features: ['password', 'mfa', 'recovery'], api_docs: 'unknown', source_access: 'none', backend: ['unknown'],
      api_style: ['rest'], database: ['sql'], cloud: 'unknown', features: ['payments', 'search', 'email', 'file_upload'],
      intermediary: ['unknown'], outbound_fetch: ['webhooks'], async_jobs: 'yes'
    })
  }),
  rest_api: Object.freeze({
    id: 'rest_api', title: 'REST API / mobile backend',
    description: 'API-only service with bearer identity, an OpenAPI contract, and mobile consumers.',
    answers: Object.freeze({
      mode: 'grey_box', creds: 'high', app_type: 'api_only', has_login: 'yes', registration: 'no', roles: 'few',
      auth_mechanism: ['jwt'], identity_features: ['unknown'], api_docs: 'openapi', source_access: 'none', backend: ['unknown'],
      api_style: ['rest'], database: ['unknown'], cloud: 'unknown', features: ['mobile_api'], intermediary: ['unknown'], outbound_fetch: ['unknown'], async_jobs: 'unknown'
    })
  }),
  graphql_api: Object.freeze({
    id: 'graphql_api', title: 'GraphQL application',
    description: 'Authenticated GraphQL API with granular roles and tenant-aware data access.',
    answers: Object.freeze({
      mode: 'grey_box', creds: 'high', app_type: 'api_only', has_login: 'yes', registration: 'unknown', roles: 'many',
      auth_mechanism: ['jwt'], identity_features: ['unknown'], api_docs: 'unknown', source_access: 'none', backend: ['node'],
      api_style: ['graphql'], database: ['sql'], cloud: 'unknown', features: ['multi_tenant'], intermediary: ['unknown'], outbound_fetch: ['unknown'], async_jobs: 'unknown'
    })
  }),
  document_portal: Object.freeze({
    id: 'document_portal', title: 'Document and upload portal',
    description: 'Authenticated file handling, previews, search, email, and role-separated workflows.',
    answers: Object.freeze({
      mode: 'grey_box', creds: 'high', app_type: 'server_rendered', has_login: 'yes', registration: 'no', roles: 'few',
      auth_mechanism: ['cookie'], identity_features: ['password', 'mfa', 'recovery'], api_docs: 'unknown', source_access: 'none', backend: ['unknown'],
      api_style: ['rest'], database: ['sql'], cloud: 'unknown', features: ['file_upload', 'search', 'email'], intermediary: ['unknown'], outbound_fetch: ['unknown'], async_jobs: 'unknown'
    })
  }),
  realtime_chat: Object.freeze({
    id: 'realtime_chat', title: 'Realtime chat application',
    description: 'SPA with REST and WebSocket transports, user content, and authenticated sessions.',
    answers: Object.freeze({
      mode: 'grey_box', creds: 'high', app_type: 'spa', has_login: 'yes', registration: 'yes', roles: 'few',
      auth_mechanism: ['cookie', 'jwt'], identity_features: ['password', 'recovery'], api_docs: 'unknown', source_access: 'none', backend: ['node'],
      api_style: ['rest', 'websocket'], database: ['nosql'], cloud: 'unknown', features: ['chat'], intermediary: ['unknown'], outbound_fetch: ['unknown'], async_jobs: 'unknown'
    })
  })
});

export const PRESET_LIST = Object.freeze(Object.values(PRESETS));

// ─────────────────────────────────────────────────────────────────────────────
// Assessment presets — the primary setup flow.
//
// A preset is NOT a template that locks the plan. It is an intelligent starting
// point: it pre-answers the questions implied by the assessment scenario, lists
// what the plan already assumes, and leaves only the relevant follow-up
// questions open (`focus`). Everything else stays "Not confirmed yet" and can be
// answered later from the review step or the dashboard context editor without
// losing progress.
// ─────────────────────────────────────────────────────────────────────────────
const U = 'unknown';

export const ASSESSMENTS = Object.freeze([
  Object.freeze({
    id: 'static_black_box',
    title: 'Static Website — Black Box Testing',
    blurb: 'Public-facing site with no authentication or internal access.',
    assumptions: Object.freeze([
      'Publicly accessible — no authentication surface assumed',
      'External attacker perspective, no internal access',
      'HTTP/HTTPS exposure and TLS testing apply',
      'Client-side and content-delivery testing apply',
      'Infrastructure, headers, and exposure testing apply'
    ]),
    focus: Object.freeze(['features', 'intermediary', 'cloud']),
    answers: Object.freeze({
      mode: 'black_box', creds: 'none', app_type: 'static', has_login: 'no', registration: 'no',
      roles: 'none', role_types: ['none'], auth_mechanism: ['none'], identity_features: ['none'],
      api_docs: 'none', source_access: 'none', backend: ['none'], api_style: ['none'], database: ['none'],
      cloud: U, features: [U], intermediary: [U], outbound_fetch: ['none'], async_jobs: 'no'
    })
  }),
  Object.freeze({
    id: 'web_black_box',
    title: 'Web Application — Black Box Testing',
    blurb: 'Test the application from an external attacker perspective.',
    assumptions: Object.freeze([
      'External attacker perspective only',
      'No implementation or internal access',
      'Discovery during testing drives the scope',
      'Unauthenticated starting point'
    ]),
    focus: Object.freeze(['app_type', 'has_login', 'api_style', 'features', 'intermediary']),
    answers: Object.freeze({
      mode: 'black_box', creds: 'none', app_type: U, has_login: U, registration: U,
      roles: U, role_types: [U], auth_mechanism: [U], identity_features: [U],
      api_docs: U, source_access: 'none', backend: [U], api_style: [U], database: [U],
      cloud: U, features: [U], intermediary: [U], outbound_fetch: [U], async_jobs: U
    })
  }),
  Object.freeze({
    id: 'web_grey_box',
    title: 'Web Application — Grey Box Testing',
    blurb: 'Authenticated access with available test accounts.',
    assumptions: Object.freeze([
      'Authenticated access with test accounts',
      'Application internals partially known',
      'Identity, session, and authorization testing apply',
      'Cross-role testing possible when multiple accounts exist'
    ]),
    focus: Object.freeze(['app_type', 'auth_mechanism', 'roles', 'api_style', 'features']),
    answers: Object.freeze({
      mode: 'grey_box', creds: 'high', app_type: U, has_login: 'yes', registration: U,
      roles: U, role_types: [U], auth_mechanism: [U], identity_features: [U],
      api_docs: U, source_access: 'none', backend: [U], api_style: [U], database: [U],
      cloud: U, features: [U], intermediary: [U], outbound_fetch: [U], async_jobs: U
    })
  }),
  Object.freeze({
    id: 'grey_box_multi_role',
    title: 'Grey Box Testing with Multiple User Roles',
    blurb: 'Authorization, privilege boundaries, and cross-user access.',
    assumptions: Object.freeze([
      'Authenticated access with multiple test accounts',
      'Vertical and horizontal privilege boundaries in scope',
      'Cross-role and cross-user data access testing applies',
      'Role-boundary and tenant isolation testing apply'
    ]),
    focus: Object.freeze(['role_types', 'auth_mechanism', 'app_type', 'api_style', 'features']),
    answers: Object.freeze({
      mode: 'grey_box', creds: 'high', app_type: U, has_login: 'yes', registration: 'no',
      roles: 'many', role_types: [U], auth_mechanism: [U], identity_features: [U],
      api_docs: U, source_access: 'none', backend: [U], api_style: [U], database: [U],
      cloud: U, features: [U], intermediary: [U], outbound_fetch: [U], async_jobs: U
    })
  }),
  Object.freeze({
    id: 'public_login_registration',
    title: 'Public-Facing Application with Login and Registration',
    blurb: 'Account creation, authentication, and session flows.',
    assumptions: Object.freeze([
      'Publicly reachable application',
      'Login and self-service registration present',
      'Authentication and session/token testing apply',
      'Account lifecycle and verification testing apply'
    ]),
    focus: Object.freeze(['auth_mechanism', 'identity_features', 'app_type', 'roles', 'api_style']),
    answers: Object.freeze({
      mode: 'black_box', creds: 'low', app_type: U, has_login: 'yes', registration: 'yes',
      roles: U, role_types: [U], auth_mechanism: [U], identity_features: [U],
      api_docs: U, source_access: 'none', backend: [U], api_style: [U], database: [U],
      cloud: U, features: [U], intermediary: [U], outbound_fetch: [U], async_jobs: U
    })
  }),
  Object.freeze({
    id: 'api_security',
    title: 'API Security Testing',
    blurb: 'REST, GraphQL, or other exposed APIs with test credentials.',
    assumptions: Object.freeze([
      'API-first scope — no first-party browser UI assumed',
      'Authenticated API access with test credentials',
      'Token, rate-limit, and abuse testing apply',
      'Object- and function-level authorization testing applies'
    ]),
    focus: Object.freeze(['api_style', 'auth_mechanism', 'api_docs', 'roles', 'features']),
    answers: Object.freeze({
      mode: 'grey_box', creds: 'high', app_type: 'api_only', has_login: 'yes', registration: U,
      roles: U, role_types: [U], auth_mechanism: [U], identity_features: [U],
      api_docs: U, source_access: 'none', backend: [U], api_style: [U], database: [U],
      cloud: U, features: [U], intermediary: [U], outbound_fetch: [U], async_jobs: U
    })
  }),
  Object.freeze({
    id: 'custom',
    title: 'Custom Assessment',
    blurb: 'Build the testing context manually, question by question.',
    assumptions: Object.freeze([]),
    askEverything: true,
    focus: Object.freeze([]),
    answers: null
  })
]);

export const ASSESSMENT_LIST = Object.freeze(ASSESSMENTS);

// Best-effort label for the dashboard: which assessment scenario does this context
// currently resemble? Matches only the answers a preset actually commits to.
export function matchAssessment(answers = {}) {
  let best = null;
  let bestScore = 0;
  let bestMatches = 0;
  for (const preset of ASSESSMENTS) {
    if (!preset.answers) continue;
    let matches = 0;
    let known = 0;
    for (const [key, value] of Object.entries(preset.answers)) {
      const expected = Array.isArray(value) ? value : [value];
      if (expected.includes(U)) continue;
      known += 1;
      const actual = answers[key];
      const values = Array.isArray(actual) ? actual : [actual];
      if (values.some((entry) => expected.includes(entry))) matches += 1;
    }
    // A preset resembles the context when the large majority of its committed
    // answers still hold; ties go to the more specific scenario (more committed
    // answers still matching), so multi-role beats generic grey-box.
    const score = known ? matches / known : 0;
    if (score >= 0.75 && matches >= 3 && (score > bestScore || (score === bestScore && matches > bestMatches))) {
      best = preset;
      bestScore = score;
      bestMatches = matches;
    }
  }
  return best;
}

