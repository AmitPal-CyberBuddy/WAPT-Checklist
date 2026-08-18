'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const contextModule = import('../js/engine/context.js');
const rationaleModule = import('../js/engine/rationale.js');

test('category rationale explains active, boosted, and unknown relevance', async () => {
  const [{ deriveContext }, { categoryRationale }] = await Promise.all([contextModule, rationaleModule]);
  const ai = deriveContext({ features: ['ai_llm'] });
  assert.deepEqual(categoryRationale('ai-llm-security', ai), ['AI/LLM features are selected']);
  assert.deepEqual(categoryRationale('ai-llm-security', deriveContext({})), ['Confirm whether AI/LLM features are in scope']);
  assert.deepEqual(categoryRationale('ai-llm-security', deriveContext({ features: ['payments'] })), []);

  const authz = deriveContext({ roles: 'many', features: ['multi_tenant'] });
  const reasons = categoryRationale('authorization', authz);
  assert.ok(reasons.includes('Many-role model boosts this suite'));
  assert.ok(reasons.includes('Multi-tenant scope boosts tenant-boundary tests'));

  const ssrf = deriveContext({ outbound_fetch: ['webhooks'] });
  assert.deepEqual(categoryRationale('ssrf', ssrf), ['Outbound URL fetching is confirmed']);
  assert.deepEqual(categoryRationale('reconnaissance', deriveContext({})), []);
});
