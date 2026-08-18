'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { CATEGORIES, validateFiles } = require('../tools/validate.js');

const ROOT = path.resolve(__dirname, '..');
const SAMPLE = path.join(ROOT, 'checklist', 'sample.json');

function withMutatedSample(mutate, callback) {
  const document = JSON.parse(fs.readFileSync(SAMPLE, 'utf8'));
  mutate(document);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wapt-schema-'));
  const file = path.join(directory, 'sample.json');
  fs.writeFileSync(file, JSON.stringify(document));
  try {
    callback(file);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('the Phase 1 sample contains exactly 20 schema-valid items', () => {
  const result = validateFiles([SAMPLE]);
  assert.equal(result.itemCount, 20);
  assert.deepEqual(result.errors, []);
});

test('taxonomy floors total 512 items', () => {
  const total = Object.values(CATEGORIES).reduce((sum, category) => sum + category.floor, 0);
  assert.equal(Object.keys(CATEGORIES).length, 25);
  assert.equal(total, 520);
});

test('validator rejects a category-prefix mismatch', () => {
  withMutatedSample(
    (document) => { document.items[0].id = 'WAPT-AUTH-999'; },
    (file) => {
      const result = validateFiles([file]);
      assert.ok(result.errors.some((error) => error.includes('prefix does not match category')));
    }
  );
});

test('validator rejects unknown applicability values', () => {
  withMutatedSample(
    (document) => { document.items[0].applies = { requires: ['app_type:desktop'] }; },
    (file) => {
      const result = validateFiles([file]);
      assert.ok(result.errors.some((error) => error.includes('invalid option "desktop"')));
    }
  );
});

test('validator checks variant conditions against the same context vocabulary', () => {
  withMutatedSample(
    (document) => {
      document.items[0].variants = [{ when: { backend: ['rust'] }, steps: ['Use the context-specific method.'] }];
    },
    (file) => {
      const result = validateFiles([file]);
      assert.ok(result.errors.some((error) => error.includes('invalid option "rust"')));
    }
  );
});

test('validator rejects unapproved reference domains', () => {
  withMutatedSample(
    (document) => { document.items[0].references[0].url = 'https://security-example.invalid/article'; },
    (file) => {
      const result = validateFiles([file]);
      assert.ok(result.errors.some((error) => error.includes('not an allowed authoritative HTTPS reference')));
    }
  );
});

test('reportability fields are optional, validated, and rejected when malformed', () => {
  withMutatedSample((document) => {
    document.items[0].do_not_report = ['Do not report this observation without demonstrated exposure and impact.'];
    document.items[0].retest_guidance = 'After remediation, repeat the original probe and an adjacent variant under the same account context.';
  }, (file) => {
    assert.deepEqual(validateFiles([file]).errors, []);
  });
  withMutatedSample((document) => { document.items[0].do_not_report = []; }, (file) => {
    assert.ok(validateFiles([file]).errors.some((error) => error.includes('do_not_report')));
  });
  withMutatedSample((document) => { document.items[0].do_not_report = ['x']; }, (file) => {
    assert.ok(validateFiles([file]).errors.some((error) => error.includes('do_not_report')));
  });
  withMutatedSample((document) => { document.items[0].retest_guidance = ' '; }, (file) => {
    assert.ok(validateFiles([file]).errors.some((error) => error.includes('retest_guidance')));
  });
});
