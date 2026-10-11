const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generatePet } = require('./ai.cjs');
const source = 'data:image/png;base64,aW1hZ2U=';
test('generates five poses using generated idle as subsequent reference', async () => {
  const calls = [], progress = [];
  const images = await generatePet({ source, key: 'test-key', style: 'chibi', allPoses: true, progress: p => progress.push(p), fetchImpl: async (url, request) => {
    calls.push({ url, request, reference: Buffer.from(await request.body.get('image').arrayBuffer()).toString() });
    return { ok: true, json: async () => ({ data: [{ b64_json: Buffer.from(`pose${calls.length}`).toString('base64') }] }) };
  } });
  assert.equal(calls.length, 5);
  assert.equal(calls[0].reference, 'image');
  assert.equal(calls[1].reference, 'pose1');
  assert.deepEqual(Object.keys(images), ['idle', 'love', 'food', 'jump', 'sleep']);
  assert.equal(progress[4].current, 5);
  assert.equal(calls[0].url, 'https://api.openai.com/v1/images/edits');
  assert.equal(calls[0].request.body.get('background'), 'transparent');
});
test('single-image mode requests once', async () => {
  let count = 0;
  const images = await generatePet({ source, key: 'test', style: 'pixel', allPoses: false, fetchImpl: async () => { count++; return { ok: true, json: async () => ({ data: [{ b64_json: 'aW1hZ2U=' }] }) }; } });
  assert.equal(count, 1); assert.deepEqual(Object.keys(images), ['idle']);
});
test('reports authorization error without exposing key', async () => {
  await assert.rejects(generatePet({ source, key: 'never-log-this', style: 'chibi', fetchImpl: async () => ({ ok: false, status: 401 }) }), /密钥无效/);
});
test('rejects invalid model output and invalid input', async () => {
  await assert.rejects(generatePet({ source, key: 'test', style: 'chibi', fetchImpl: async () => ({ ok: true, json: async () => ({ data: [] }) }) }), /有效的 PNG/);
  await assert.rejects(generatePet({ source: 'invalid', key: 'test', style: 'chibi' }), /参考图片/);
});
test('cancellation reaches network request', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(generatePet({ source, key: 'test', style: 'chibi', signal: controller.signal, fetchImpl: async (_url, request) => { request.signal.throwIfAborted(); } }), { name: 'AbortError' });
});
