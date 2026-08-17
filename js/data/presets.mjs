export const PRESETS = Object.freeze({
  static_marketing: Object.freeze({
    id: 'static_marketing',
    title: 'Static marketing site',
    description: 'Public content, no login, no application data layer.',
    answers: Object.freeze({
      mode: 'black_box', creds: 'none', app_type: 'static', has_login: 'no', registration: 'no', roles: 'one',
      auth_mechanism: ['unknown'], api_docs: 'unknown', source_access: 'none', backend: ['unknown'],
      api_style: ['none'], database: ['none'], cloud: 'unknown', features: ['unknown']
    })
  }),
  saas_jwt_api: Object.freeze({
    id: 'saas_jwt_api',
    title: 'SaaS multi-tenant app',
    description: 'JWT identity, REST API, many roles, tenant boundaries.',
    answers: Object.freeze({
      mode: 'grey_box', creds: 'high', app_type: 'spa', has_login: 'yes', registration: 'yes', roles: 'many',
      auth_mechanism: ['jwt'], api_docs: 'openapi', source_access: 'none', backend: ['node'],
      api_style: ['rest'], database: ['sql'], cloud: 'aws', features: ['multi_tenant']
    })
  }),
  corporate_portal: Object.freeze({
    id: 'corporate_portal',
    title: 'Corporate portal',
    description: 'Cookie sessions, SSO, multiple roles, hybrid delivery.',
    answers: Object.freeze({
      mode: 'grey_box', creds: 'high', app_type: 'hybrid', has_login: 'yes', registration: 'no', roles: 'many',
      auth_mechanism: ['cookie', 'oauth'], api_docs: 'unknown', source_access: 'none', backend: ['java'],
      api_style: ['rest'], database: ['sql', 'ldap'], cloud: 'self_hosted', features: ['file_upload']
    })
  }),
  ecommerce: Object.freeze({
    id: 'ecommerce',
    title: 'E-commerce with payments',
    description: 'Customer accounts, checkout workflows, uploads, and APIs.',
    answers: Object.freeze({
      mode: 'grey_box', creds: 'high', app_type: 'hybrid', has_login: 'yes', registration: 'yes', roles: 'few',
      auth_mechanism: ['cookie'], api_docs: 'unknown', source_access: 'none', backend: ['unknown'],
      api_style: ['rest'], database: ['sql'], cloud: 'unknown', features: ['payments', 'search', 'email', 'file_upload']
    })
  })
});

export const PRESET_LIST = Object.freeze(Object.values(PRESETS));
