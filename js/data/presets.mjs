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
