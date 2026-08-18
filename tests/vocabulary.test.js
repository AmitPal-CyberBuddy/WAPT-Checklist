'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const contextModule = import('../js/engine/context.js');
const { OPTIONS } = require('../tools/validate.js');

test('validator context vocabulary stays byte-identical with the engine', async () => {
  const { ATTRIBUTE_OPTIONS, MULTI_ATTRIBUTES } = await contextModule;
  assert.deepEqual(Object.keys(OPTIONS), Object.keys(ATTRIBUTE_OPTIONS), 'attribute keys diverged between tools/validate.js and js/engine/context.js');
  for (const [key, values] of Object.entries(OPTIONS)) {
    assert.deepEqual(values, [...ATTRIBUTE_OPTIONS[key]], `${key} values diverged`);
    assert.equal(MULTI_ATTRIBUTES.has(key), ['auth_mechanism', 'identity_features', 'backend', 'api_style', 'database', 'features', 'intermediary', 'outbound_fetch'].includes(key), `${key} cardinality diverged`);
  }
});
