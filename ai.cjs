const states = ['idle', 'love', 'food', 'jump', 'sleep'];
const poses = {
  idle: 'Standing relaxed, friendly neutral expression, full body visible.',
  love: 'Happy affectionate pose, both hands near cheeks, smiling with eyes closed.',
  food: 'Happily holding and eating a small cookie.',
  jump: 'An excited little jump, feet lifted, arms raised, full body visible.',
  sleep: 'Curled up sleeping peacefully, eyes closed, full body visible.'
};
async function generatePet({ source, key, style, allPoses, signal, progress = () => {}, fetchImpl = fetch }) {
  if (!key || typeof key !== 'string') throw new Error('请先输入 OpenAI API 密钥。');
  if (!['chibi', 'pixel'].includes(style)) throw new Error('请选择有效的画风。');
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(source || '');
  if (!match) throw new Error('请选择 PNG、JPEG 或 WebP 参考图片。');
  const selected = allPoses ? states : ['idle'];
  const images = {};
  for (const [index, state] of selected.entries()) {
    progress({ state, current: index + 1, total: selected.length });
    const reference = state === 'idle' ? source : images.idle;
    const [, mime, b64] = /^data:(image\/[^;]+);base64,(.+)$/.exec(reference);
    const body = new FormData();
    body.set('model', 'gpt-image-1');
    body.set('image', new Blob([Buffer.from(b64, 'base64')], { type: mime }), `reference.${mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1]}`);
    body.set('prompt', `Create one desktop pet character from this reference. Preserve the character's distinctive hair, face, outfit, colors and accessories. ${style === 'pixel' ? 'Crisp charming pixel art.' : 'Cute chibi anime illustration, oversized head and small body.'} ${poses[state]} Transparent background, no text, no panels, no other characters, no background scenery. Center the character with generous transparent margins; keep the entire character in frame. For an existing chibi reference, preserve its exact design and proportions.`);
    body.set('size', '1024x1024');
    body.set('quality', 'medium');
    body.set('background', 'transparent');
    body.set('output_format', 'png');
    const response = await fetchImpl('https://api.openai.com/v1/images/edits', {
      method: 'POST', headers: { Authorization: `Bearer ${key}` }, body,
      signal: AbortSignal.any([signal || new AbortController().signal, AbortSignal.timeout(180000)])
    });
    if (!response.ok) {
      const hints = { 401: 'API 密钥无效，请重新输入。', 403: '账号没有此图像模型的访问权限，请检查服务端权限。', 429: '额度不足或请求过于频繁，请检查账户余额并稍后重试。' };
      throw new Error(hints[response.status] || `图像服务返回 HTTP ${response.status}，请稍后重试。`);
    }
    const result = await response.json();
    const output = result.data?.[0]?.b64_json;
    if (typeof output !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(output) || output.length > 20 * 1024 * 1024) throw new Error('生成服务没有返回有效的 PNG 图片。');
    images[state] = `data:image/png;base64,${output}`;
  }
  return images;
}
module.exports = { generatePet, states };
