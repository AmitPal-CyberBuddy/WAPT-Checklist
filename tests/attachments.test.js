'use strict';

// Evidence attachments: redacted screenshots and request files, stored as
// capped data URLs inside evidence packs, enforced by the state layer.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const stateModule = import(pathToFileURL(path.resolve(__dirname, '../js/engine/state.js')).href);
const exportModule = import(pathToFileURL(path.resolve(__dirname, '../js/ui/export.js')).href);

const PNG = (length = 64) => `data:image/png;base64,${'A'.repeat(length)}`;

async function packWithAttachments(attachments) {
  const { createState, setItemStatus, addFinding } = await stateModule;
  let state = createState();
  state = setItemStatus(state, 'WAPT-JWT-001', 'confirmed_finding');
  state = addFinding(state, { item_id: 'WAPT-JWT-001', title: 'Token tamper', severity: 'high', attachments });
  return state;
}

test('valid attachments survive creation with derived sizes', async () => {
  const state = await packWithAttachments([
    { id: 'att-demo-0001', name: 'proof.png', type: 'image/png', data: PNG() }
  ]);
  const [attachment] = state.findings[0].attachments;
  assert.equal(attachment.name, 'proof.png');
  assert.equal(attachment.type, 'image/png');
  assert.ok(attachment.size > 0, 'size derived from data length');
});

test('invalid attachments are dropped at set-state time', async () => {
  const { MAX_ATTACHMENT_BYTES } = await stateModule;
  const state = await packWithAttachments([
    { id: 'att-bad-0001', name: 'x.png', type: 'image/png', data: 'not-a-data-url' },      // shape
    { id: 'att-bad-0002', name: 'x.exe', type: 'application/x-msdownload', data: PNG() },   // type allowlist
    { id: 'att-big-0003', name: 'big.png', type: 'image/png', data: 'data:image/png;base64,' + 'B'.repeat(MAX_ATTACHMENT_BYTES + 1) }, // size
    { id: 'att-bad-0004', name: '', type: 'image/png', data: PNG() }                        // no id
  ]);
  assert.equal(state.findings[0].attachments.length, 0);
});

test('per-pack count cap enforced by the cleaner', async () => {
  const state = await packWithAttachments([1, 2, 3, 4, 5].map((n) => ({ id: `att-num-000${n}`, name: `a${n}.png`, type: 'image/png', data: PNG(32) })));
  assert.ok(state.findings[0].attachments.length <= 3);
});

test('setFindingAttachments replaces wholesale and enforces the budget', async () => {
  const { setFindingAttachments, MAX_ATTACHMENT_TOTAL_BYTES } = await stateModule;
  const state = await packWithAttachments([{ id: 'att-old-0001', name: 'old.png', type: 'image/png', data: PNG() }]);
  const pack = state.findings[0];
  const replaced = setFindingAttachments(state, pack.id, [{ id: 'att-new-0002', name: 'new.png', type: 'image/png', data: PNG(48) }]);
  assert.equal(replaced.findings[0].attachments[0].id, 'att-new-0002');
  // The engagement-wide budget guard fires at creation time: per-file-valid
  // attachments whose total exceeds the budget throw in addFinding.
  const big = 'data:image/png;base64,' + 'Q'.repeat(390_000);
  const { createState, setItemStatus, addFinding } = await stateModule;
  let fresh = createState();
  fresh = setItemStatus(fresh, 'WAPT-JWT-002', 'confirmed_finding');
  assert.throws(() => {
    for (let packIndex = 0; packIndex < 6; packIndex += 1) {
      fresh = addFinding(fresh, { item_id: 'WAPT-JWT-002', title: `P${packIndex}`, attachments: [
        { id: `att-hg-${packIndex}-01`, name: 'h1.png', type: 'image/png', data: big },
        { id: `att-hg-${packIndex}-02`, name: 'h2.png', type: 'image/png', data: big },
        { id: `att-hg-${packIndex}-03`, name: 'h3.png', type: 'image/png', data: big }
      ] });
    }
  }, /budget exceeded/);
  void MAX_ATTACHMENT_TOTAL_BYTES;
  assert.throws(() => setFindingAttachments(state, 'find-missing', []), /Unknown evidence pack/);
});

test('imported hostile state keeps only well-formed attachments', async () => {
  const { importState, serializeState } = await stateModule;
  const state = await packWithAttachments([{ id: 'att-ok-0001', name: 'ok.png', type: 'image/png', data: PNG() }]);
  const round = importState(serializeState(state));
  assert.equal(round.findings[0].attachments.length, 1);
  const hostile = JSON.parse(serializeState(state));
  hostile.findings[0].attachments.push({ id: 'att-evil-0002', name: 'x', type: 'text/html', data: 'data:text/html;base64,PHNjcmlwdD4=' });
  const cleaned = importState(JSON.stringify(hostile));
  assert.equal(cleaned.findings[0].attachments.length, 1, 'text/html attachment rejected');
  assert.ok(cleaned.findings[0].attachments.every((a) => a.type !== 'text/html'));
});

test('HTML report embeds image attachments and lists text attachments', async () => {
  const { composeReportHtml } = await exportModule;
  const { createState, setItemStatus, addFinding } = await stateModule;
  let state = createState();
  state = setItemStatus(state, 'WAPT-JWT-001', 'confirmed_finding');
  state = addFinding(state, {
    item_id: 'WAPT-JWT-001', title: 'Att check', severity: 'high',
    attachments: [
      { id: 'att-img-0001', name: 'proof.png', type: 'image/png', data: PNG(2048) },
      { id: 'att-txt-0002', name: 'request.txt', type: 'text/plain', data: 'data:text/plain;base64,' + Buffer.from('GET / HTTP/1.1').toString('base64') }
    ]
  });
  const items = [{ id: 'WAPT-JWT-001', title: 'T', category: 'jwt', severity: 'high' }];
  const html = composeReportHtml(items, state, { jwt: 'JWT' });
  assert.ok(html.includes('data:image/png;base64,'), 'image embedded as data URL');
  assert.ok(html.includes('proof.png'), 'image caption present');
  assert.ok(html.includes('request.txt'), 'text attachment listed');
  assert.ok(html.includes('GET / HTTP/1.1'), 'text content decoded in the report');
  assert.ok(!html.includes('<script'), 'no scripts');
});
