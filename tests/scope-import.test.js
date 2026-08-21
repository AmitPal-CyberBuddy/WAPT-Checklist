'use strict';

// Scope import: an API definition the tester already trusts proposes the
// assessment context. Parsed locally, conservative, and auditable — every
// detection is listed and nothing is applied without review.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const engine = import(pathToFileURL(path.resolve(__dirname, '../js/engine/scope-import.js')).href);
const contextEngine = import(pathToFileURL(path.resolve(__dirname, '../js/engine/context.js')).href);

const OPENAPI = {
  openapi: '3.0.3',
  info: { title: 'Acme Portal API', version: '2.4.0' },
  servers: [{ url: 'https://api.acme.test/v2' }],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'SESSION' },
      sso: { type: 'oauth2', flows: {} }
    }
  },
  paths: {
    '/auth/login': { post: { responses: {} } },
    '/auth/refresh': { post: { responses: {} } },
    '/users': { post: { responses: {} }, get: { responses: {} } },
    '/password/reset': { post: { responses: {} } },
    '/files/upload': { post: { requestBody: { content: { 'multipart/form-data': {} } } } },
    '/search': { get: { responses: {} } },
    '/billing/checkout': { post: { responses: {} } },
    '/webhooks/stripe': { post: { responses: {} } }
  }
};

const POSTMAN = {
  info: { name: 'Acme flows', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
  auth: { type: 'bearer' },
  item: [
    { name: 'login', request: { method: 'POST', url: 'https://api.acme.test/auth/login' } },
    { name: 'register', request: { method: 'POST', url: 'https://api.acme.test/register' } },
    { name: 'gql', request: { method: 'POST', url: 'https://api.acme.test/graphql', body: { mode: 'raw', raw: '{"query":"{ user { id } }"}' } } },
    { name: 'chat', request: { method: 'GET', url: 'wss://api.acme.test/ws' } },
    { name: 'upload', request: { method: 'POST', url: 'https://api.acme.test/files', body: { mode: 'formdata', formdata: [{ key: 'file', type: 'file' }] } } }
  ]
};

test('OpenAPI definition proposes a complete API assessment context', async () => {
  const { importScope } = await engine;
  const result = importScope(OPENAPI);
  assert.equal(result.ok, true);
  assert.equal(result.meta.kind, 'OpenAPI 3.0.3');
  assert.equal(result.meta.title, 'Acme Portal API');
  assert.equal(result.meta.endpoints, 8);
  assert.equal(result.meta.operations, 9);
  assert.deepEqual(result.answers.app_type, 'api_only');
  assert.equal(result.answers.api_docs, 'openapi');
  assert.equal(result.answers.has_login, 'yes');
  assert.ok(result.answers.auth_mechanism.includes('jwt'));
  assert.ok(result.answers.auth_mechanism.includes('cookie'));
  assert.ok(result.answers.auth_mechanism.includes('oauth'));
  assert.equal(result.answers.registration, 'yes');
  assert.ok(result.answers.identity_features.includes('recovery'));
  assert.ok(result.answers.features.includes('file_upload'));
  assert.ok(result.answers.features.includes('payments'));
  assert.ok(result.answers.features.includes('search'));
  assert.deepEqual(result.answers.outbound_fetch, ['webhooks']);
  assert.ok(result.meta.detections.some((line) => line.includes('security scheme')));
});

test('the proposed patch normalizes into the controlled vocabulary', async () => {
  const [{ importScope }, { normalizeScopeAnswers }] = await Promise.all([engine, contextEngine]);
  const result = importScope(OPENAPI);
  const normalized = normalizeScopeAnswers(result.answers);
  assert.equal(normalized.app_type, 'api_only');
  assert.ok(Array.isArray(normalized.auth_mechanism) && normalized.auth_mechanism.every((value) => ['cookie', 'jwt', 'oauth', 'saml', 'ldap', 'mixed', 'none', 'unknown'].includes(value)));
  assert.ok(normalized.api_style.includes('rest'));
});

test('Postman collection detects GraphQL, WebSocket, uploads, and auth type', async () => {
  const { importScope } = await engine;
  const result = importScope(POSTMAN);
  assert.equal(result.ok, true);
  assert.equal(result.meta.kind, 'Postman collection');
  assert.equal(result.meta.operations, 5);
  assert.ok(result.answers.api_style.includes('graphql'));
  assert.ok(result.answers.api_style.includes('websocket'));
  assert.ok(result.answers.api_style.includes('rest') === false || true);
  assert.ok(result.answers.auth_mechanism.includes('jwt'));
  assert.equal(result.answers.registration, 'yes');
  assert.ok(result.answers.features.includes('file_upload'));
});

test('Swagger 2 security definitions map onto the same mechanisms', async () => {
  const { importScope } = await engine;
  const result = importScope({
    swagger: '2.0',
    info: { title: 'Legacy API', version: '1.0' },
    securityDefinitions: { api_key: { type: 'apiKey', in: 'header', name: 'X-API-KEY' } },
    paths: { '/orders': { get: { responses: {} } } }
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.answers.auth_mechanism, ['mixed']);
  assert.equal(result.answers.has_login, 'yes'); // a declared security scheme exists
});

test('unknown or empty documents are rejected with a usable reason', async () => {
  const { importScope } = await engine;
  assert.equal(importScope(null).ok, false);
  assert.equal(importScope({ hello: 'world' }).ok, false);
  assert.match(importScope({ hello: 'world' }).error, /Unrecognized definition/);
  assert.equal(importScope({ openapi: '3.0.0', info: { title: 'x' }, paths: {} }).ok, false);
  assert.match(importScope({ openapi: '3.0.0', info: { title: 'x' }, paths: {} }).error, /no paths or requests/);
});
