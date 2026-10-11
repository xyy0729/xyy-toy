const { app, BrowserWindow, ipcMain, Menu, screen, dialog, nativeImage } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const { generatePet, states } = require('./ai.cjs');
let pet;
let drag;
let appearance;
let studio;
let reference;
let generated;
let generation;
async function saveAppearance(value) {
  const directory = app.getPath('userData');
  await fs.mkdir(directory, { recursive: true });
  const temp = path.join(directory, `appearance-${randomUUID()}.tmp`);
  try {
    await fs.writeFile(temp, JSON.stringify(value));
    await fs.rename(temp, path.join(directory, 'appearance.json'));
  } finally { await fs.rm(temp, { force: true }); }
}
function checkStudio(event) {
  if (!studio || event.sender !== studio.webContents || event.senderFrame !== studio.webContents.mainFrame) throw new Error('无效的请求来源。');
}
function openStudio() {
  if (studio && !studio.isDestroyed()) { studio.show(); studio.focus(); return; }
  studio = new BrowserWindow({ width: 900, height: 800, minWidth: 680, minHeight: 650,
    webPreferences: { preload: path.join(__dirname, 'studio-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  studio.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  studio.webContents.on('will-navigate', event => event.preventDefault());
  studio.on('closed', () => { generation?.abort(); studio = null; reference = null; generated = null; });
  studio.loadFile('studio.html');
}
async function importAppearance() {
  const result = await dialog.showOpenDialog(pet, {
    title: '选择宠物形象（推荐透明 PNG）',
    filters: [{ name: '角色图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
    properties: ['openFile']
  });
  if (result.canceled) return;
  try {
    const file = result.filePaths[0];
    if ((await fs.stat(file)).size > 10 * 1024 * 1024) throw new Error('请选择小于 10 MB 的图片。');
    const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' }[path.extname(file).toLowerCase()];
    if (!mime) throw new Error('不支持此图片格式。');
    const next = `data:${mime};base64,${(await fs.readFile(file)).toString('base64')}`;
    if (nativeImage.createFromDataURL(next).isEmpty()) throw new Error('图片无法读取，请选择有效的角色图片。');
    await saveAppearance({ image: next });
    appearance = next;
    pet.webContents.send('pet:appearance', appearance);
  } catch (error) { dialog.showErrorBox('导入失败', error.message); }
}
app.whenReady().then(() => {
  ipcMain.handle('studio:choose', async event => {
    checkStudio(event);
    if (generation) throw new Error('请先等待或取消当前生成。');
    const result = await dialog.showOpenDialog(studio, { title: '选择角色参考图片', properties: ['openFile'], filters: [{ name: '参考图片', extensions: ['png', 'jpg', 'jpeg', 'webp'] }] });
    if (result.canceled) return null;
    const file = result.filePaths[0];
    if ((await fs.stat(file)).size > 10 * 1024 * 1024) throw new Error('图片不能超过 10 MB。');
    const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[path.extname(file).toLowerCase()];
    if (!mime) throw new Error('不支持此图片格式。');
    const image = `data:${mime};base64,${(await fs.readFile(file)).toString('base64')}`;
    if (nativeImage.createFromDataURL(image).isEmpty()) throw new Error('图片无法读取。');
    reference = image; generated = null;
    return reference;
  });
  ipcMain.handle('studio:generate', async (event, options) => {
    checkStudio(event);
    if (generation) return { ok: false, error: '已有生成任务进行中。' };
    if (!reference || options?.consent !== true) return { ok: false, error: '请选择参考图片并允许上传。' };
    const controller = new AbortController(); generation = controller; generated = null;
    const target = studio;
    try {
      const images = await generatePet({ source: reference, key: options.key, style: options.style, allPoses: options.allPoses === true, signal: controller.signal,
        progress: value => { if (!target.isDestroyed()) target.webContents.send('studio:progress', value); }
      });
      if (controller.signal.aborted || target.isDestroyed()) throw new Error('已取消生成。');
      for (const image of Object.values(images)) if (nativeImage.createFromDataURL(image).isEmpty()) throw new Error('服务返回的图片无法读取，请重新生成。');
      generated = images;
      return { ok: true, images };
    } catch (error) {
      return { ok: false, error: controller.signal.aborted ? '已取消生成，当前宠物未改变。' : error.name === 'TimeoutError' ? '生成超时，请稍后重试。' : error.message === 'fetch failed' ? '无法连接图像服务，请检查网络。' : error.message };
    } finally { if (generation === controller) generation = null; }
  });
  ipcMain.on('studio:cancel', event => { checkStudio(event); generation?.abort(); });
  ipcMain.handle('studio:apply', async event => {
    checkStudio(event);
    if (!generated || generation) return { ok: false, error: '请先完成生成。' };
    try {
      const next = { image: generated.idle, poses: generated };
      await saveAppearance(next);
      appearance = next;
      pet.webContents.send('pet:appearance', next);
      return { ok: true };
    } catch { return { ok: false, error: '保存失败，请检查本机应用数据目录的写入权限。' }; }
  });
  const area = screen.getPrimaryDisplay().workArea;
  pet = new BrowserWindow({
    width: 220, height: 240, x: area.x + area.width - 250, y: area.y + area.height - 270,
    transparent: true, frame: false, resizable: false, alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  pet.loadFile('index.html');
  pet.webContents.on('did-finish-load', async () => {
    try {
      const saved = JSON.parse(await fs.readFile(path.join(app.getPath('userData'), 'appearance.json'), 'utf8'));
      const valid = image => typeof image === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,/.test(image) && image.length < 21 * 1024 * 1024;
      if (valid(saved.image)) {
        const poses = Object.fromEntries(states.filter(state => valid(saved.poses?.[state])).map(state => [state, saved.poses[state]]));
        appearance = { image: saved.image, poses };
        pet.webContents.send('pet:appearance', appearance);
      }
    } catch { /* First launch uses the built-in cat. */ }
  });
  pet.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  pet.webContents.on('will-navigate', event => event.preventDefault());
  ipcMain.on('pet:drag-start', () => {
    drag = { cursor: screen.getCursorScreenPoint(), position: pet.getPosition() };
  });
  ipcMain.on('pet:drag-move', () => {
    if (!drag) return;
    const cursor = screen.getCursorScreenPoint();
    pet.setPosition(drag.position[0] + cursor.x - drag.cursor.x, drag.position[1] + cursor.y - drag.cursor.y);
  });
  ipcMain.on('pet:drag-end', () => { drag = null; });
  ipcMain.on('pet:menu', () => {
    Menu.buildFromTemplate([
      { label: 'AI 宠物创作室…', click: openStudio },
      { label: '导入角色图片…', click: importAppearance },
      { label: '恢复默认角色', click: async () => {
        try {
          await fs.rm(path.join(app.getPath('userData'), 'appearance.json'), { force: true });
          appearance = null;
          pet.webContents.send('pet:appearance', null);
        } catch (error) { dialog.showErrorBox('恢复失败', error.message); }
      } },
      { type: 'separator' },
      { label: '摸摸宠物', click: () => pet.webContents.send('pet:action', 'love') },
      { label: '喂食', click: () => pet.webContents.send('pet:action', 'food') },
      { label: '跳一跳', click: () => pet.webContents.send('pet:action', 'jump') },
      { label: '睡觉 / 唤醒', click: () => pet.webContents.send('pet:action', 'sleep') },
      { label: '始终置顶', type: 'checkbox', checked: pet.isAlwaysOnTop(), click: item => pet.setAlwaysOnTop(item.checked) },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() }
    ]).popup({ window: pet });
  });
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => generation?.abort());
