const $ = id => document.getElementById(id);
const labels = { idle: '待机', love: '开心', food: '吃东西', jump: '跳跃', sleep: '睡觉' };
let source = false;
let busy = false;
let result = null;
function update() {
  $('generate').disabled = busy || !source || !$('consent').checked || !$('key').value.trim();
  for (const id of ['choose', 'key', 'style', 'poses', 'consent']) $(id).disabled = busy;
  $('apply').disabled = busy || !result;
  $('cancel').hidden = !busy;
}
function preview(image) { $('preview').src = image; $('preview').hidden = false; $('empty').hidden = true; }
for (const id of ['key', 'consent']) $(id).addEventListener('input', update);
$('poses').addEventListener('change', () => {
  $('cost').textContent = $('poses').checked ? '完整套装会调用 5 次图像生成 API，按服务商价格收费。' : '仅生成待机形象，调用 1 次 API；互动使用动画效果。';
});
$('choose').addEventListener('click', async () => {
  try {
    const image = await window.studio.choose();
    if (!image) return;
    source = true; result = null; $('variants').replaceChildren(); preview(image);
    $('status').textContent = '参考图片已选择，配置密钥并允许上传后即可生成。';
  } catch (error) { $('status').textContent = error.message; }
  update();
});
$('generate').addEventListener('click', async () => {
  busy = true; result = null; $('variants').replaceChildren(); update();
  $('status').textContent = '正在生成，请稍候…';
  const key = $('key').value.trim();
  try {
    const response = await window.studio.generate({ key, style: $('style').value, allPoses: $('poses').checked, consent: $('consent').checked });
    if (!response.ok) throw new Error(response.error);
    result = response.images; preview(result.idle);
    for (const [state, image] of Object.entries(result)) {
      const button = document.createElement('button'); button.textContent = labels[state];
      button.setAttribute('aria-pressed', String(state === 'idle'));
      button.addEventListener('click', () => {
        preview(image);
        for (const item of $('variants').children) item.setAttribute('aria-pressed', String(item === button));
      });
      $('variants').append(button);
    }
    $('status').textContent = '生成完成！选择姿势预览，再设为桌面宠物。';
  } catch (error) { $('status').textContent = error.message; }
  finally { busy = false; update(); }
});
$('cancel').addEventListener('click', () => { window.studio.cancel(); $('status').textContent = '正在取消… 已完成的服务端请求可能仍会收费。'; });
$('apply').addEventListener('click', async () => {
  busy = true; update();
  try {
    const response = await window.studio.apply();
    if (!response.ok) throw new Error(response.error);
    $('status').textContent = '已设为桌面宠物，形象和互动姿势已保存。';
  } catch (error) { $('status').textContent = error.message; }
  finally { busy = false; update(); }
});
window.studio.onProgress(({ state, current, total }) => { $('status').textContent = `正在生成 ${labels[state]}（${current}/${total}），请稍候…`; });
window.addEventListener('beforeunload', () => { $('key').value = ''; });
