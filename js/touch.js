// 아이패드/모바일용 화면 버튼 + 조작 방식(터치 / 키보드) 선택.
// 조작 방식: 화면 오른쪽 위 버튼이나 주소의 ?input=touch|keyboard 로 고르고 브라우저가 기억한다.
// 고르지 않았으면 터치 화면이 있는 기기는 터치, 아니면 키보드.
// 손가락(pointerId)마다 현재 올라가 있는 버튼을 추적하므로
// 손가락을 떼지 않고 ◀ → ▶ 로 미끄러뜨려도 동작한다.
window.TouchPad = (function () {
  const held = {};    // action -> 현재 눌려 있는지
  const latched = {}; // action -> 다음 프레임에 '눌림'으로 처리할지
  const pointers = new Map(); // pointerId -> action | null

  function actionAt(x, y) {
    const el = document.elementFromPoint(x, y);
    const btn = el && el.closest ? el.closest('.btn[data-action]') : null;
    return btn ? btn.dataset.action : null;
  }

  function refresh() {
    const next = {};
    pointers.forEach((action) => { if (action) next[action] = true; });
    document.querySelectorAll('#touch-controls .btn').forEach((btn) => {
      const a = btn.dataset.action;
      if (next[a] && !held[a]) latched[a] = true;
      held[a] = !!next[a];
      btn.classList.toggle('active', held[a]);
    });
  }

  function onDown(e) {
    e.preventDefault();
    pointers.set(e.pointerId, actionAt(e.clientX, e.clientY));
    refresh();
  }

  function onMove(e) {
    if (!pointers.has(e.pointerId)) return;
    e.preventDefault();
    pointers.set(e.pointerId, actionAt(e.clientX, e.clientY));
    refresh();
  }

  function onUp(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    refresh();
  }

  function releaseAll() {
    pointers.clear();
    refresh();
  }

  // 조작 방식
  const MODE_KEY = 'kamisama-input';
  let chosen = null;         // 'touch' | 'keyboard' | null(자동)
  let touchDevice = false;
  try { chosen = localStorage.getItem(MODE_KEY); } catch (e) { /* 저장소를 못 쓰면 자동 */ }
  const q = new URLSearchParams(location.search).get('input');
  if (q === 'touch' || q === 'keyboard') chosen = q;
  if (chosen !== 'touch' && chosen !== 'keyboard') chosen = null;

  const mode = () => chosen || (touchDevice ? 'touch' : 'keyboard');

  function apply() {
    const touch = mode() === 'touch';
    document.body.classList.toggle('touch', touch);
    if (!touch) releaseAll();
    document.dispatchEvent(new CustomEvent('inputmodechange', { detail: mode() }));
  }

  function setMode(m) {
    chosen = m;
    try { localStorage.setItem(MODE_KEY, m); } catch (e) { /* 무시 */ }
    apply();
  }

  function enableTouchUI() {
    touchDevice = true;
    apply();
  }

  function init() {
    const root = document.getElementById('touch-controls');
    root.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('blur', releaseAll);
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    // iOS 더블탭 확대·핀치 방지
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());

    touchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    apply();
    window.addEventListener('touchstart', enableTouchUI, { once: true, passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    get mode() { return mode(); },
    setMode,
    toggleMode: () => setMode(mode() === 'touch' ? 'keyboard' : 'touch'),
    isDown: (action) => !!held[action],
    consume: (action) => {
      const v = !!latched[action];
      latched[action] = false;
      return v;
    },
  };
})();
