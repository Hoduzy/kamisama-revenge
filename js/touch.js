// 아이패드/모바일용 화면 버튼.
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

  function enableTouchUI() {
    document.body.classList.add('touch');
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

    if (('ontouchstart' in window) || navigator.maxTouchPoints > 0) enableTouchUI();
    window.addEventListener('touchstart', enableTouchUI, { once: true, passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    isDown: (action) => !!held[action],
    consume: (action) => {
      const v = !!latched[action];
      latched[action] = false;
      return v;
    },
  };
})();
