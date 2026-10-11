const cat = document.querySelector('#cat');
const bubble = document.querySelector('#bubble');
const customPet = document.querySelector('#custom-pet');
const effect = document.querySelector('#effect');
let bubbleTimer;
let animationTimer;
let dragging = false;
let sleeping = false;
let poseImages = {};
let idleImage = 'assets/character-idle.png';
function showPose(state) {
  const image = poseImages[state] || idleImage;
  if (image) customPet.src = image;
}
function react(action) {
  clearTimeout(bubbleTimer);
  clearTimeout(animationTimer);
  cat.classList.remove('happy', 'jump', 'eating', 'sleeping');
  if (action === 'sleep') sleeping = !sleeping;
  else sleeping = false;
  showPose(action === 'sleep' ? sleeping ? 'sleep' : 'idle' : action);
  const messages = { food: '啊呜！好好吃～', jump: '看我跳起来！', love: '呼噜呼噜，喜欢你！', sleep: sleeping ? '晚安… Zzz' : '醒啦！继续陪你～' };
  const effects = { food: '🍪', jump: '✨', love: '💕', sleep: sleeping ? 'Zzz' : '☀️' };
  bubble.textContent = messages[action] || messages.love;
  effect.textContent = effects[action] || effects.love;
  bubble.classList.remove('hidden');
  void cat.offsetWidth;
  cat.classList.add(sleeping ? 'sleeping' : action === 'jump' ? 'jump' : action === 'food' ? 'eating' : 'happy');
  animationTimer = setTimeout(() => {
    cat.classList.remove('happy', 'jump', 'eating');
    if (!sleeping) { effect.textContent = ''; showPose('idle'); }
  }, 1600);
  bubbleTimer = setTimeout(() => bubble.classList.add('hidden'), 3500);
}
cat.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  dragging = true;
  cat.setPointerCapture(event.pointerId);
  window.pet?.dragStart();
});
cat.addEventListener('pointermove', () => { if (dragging) window.pet?.dragMove(); });
function endDrag() { dragging = false; window.pet?.dragEnd(); }
cat.addEventListener('pointerup', endDrag);
cat.addEventListener('pointercancel', endDrag);
cat.addEventListener('lostpointercapture', endDrag);
window.addEventListener('blur', endDrag);
cat.addEventListener('dblclick', () => react('love'));
cat.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') react('love'); });
document.addEventListener('contextmenu', event => { event.preventDefault(); window.pet?.menu(); });
window.pet?.onAction(react);
window.pet?.onAppearance?.(value => {
  const image = (typeof value === 'string' ? value : value?.image) || 'assets/character-idle.png';
  poseImages = value?.poses || {};
  idleImage = image || null;
  customPet.onload = null;
  customPet.onerror = null;
  sleeping = false;
  clearTimeout(animationTimer);
  cat.classList.remove('happy', 'jump', 'eating', 'sleeping');
  effect.textContent = '';
  if (!image) {
    customPet.hidden = true;
    customPet.removeAttribute('src');
    cat.classList.remove('custom');
    return;
  }
  customPet.onload = () => {
    customPet.onload = null;
    customPet.hidden = false;
    cat.classList.add('custom');
    bubble.textContent = '新形象登场！双击和我互动吧';
    bubble.classList.remove('hidden');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.add('hidden'), 4000);
  };
  customPet.onerror = () => {
    customPet.hidden = true;
    cat.classList.remove('custom');
    bubble.textContent = '图片无法读取，请换一张图片';
    bubble.classList.remove('hidden');
  };
  customPet.src = image;
});
bubbleTimer = setTimeout(() => bubble.classList.add('hidden'), 4000);
