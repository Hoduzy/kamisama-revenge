// 둥근모꼴(DungGeunMo, assets/fonts) 한 글꼴로 게임 전체 글자를 그린다.
// - 16px 격자 픽셀 글꼴이라 글자 크기는 16 · 32 · 48px 만 쓴다 (PixelFont.size 로 맞춤)
// - 화면 배율은 기기 픽셀 기준 정수배 (PixelFont.fitZoom) → 글자와 도트가 흐려지지 않는다
// - 캔버스(Phaser Text) 글자는 안티앨리어싱으로 생긴 반투명 가장자리를 없앤다
// - 글꼴에 없는 ▶ ▼ ◀ ▲ 는 4px 네모로 쌓은 픽셀 화살표로 바꿔 그린다 (글자가 DOM 에 들어오는 순간 자동으로)
const PixelFont = (() => {
  const FAMILY = 'DungGeunMo';
  const STACK = `'${FAMILY}', monospace`;
  const SIZES = [16, 32, 48];

  // ───────── 글꼴 읽기: 게임 시작 전에 한 번 ─────────
  function ready(timeoutMs = 4000) {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const load = Promise.all(SIZES.map((s) => document.fonts.load(`${s}px ${FAMILY}`, '가A1'))).catch(() => {});
    return Promise.race([load, new Promise((r) => setTimeout(r, timeoutMs))]);
  }

  // 가장 가까운 허용 크기
  function size(px) {
    return SIZES.reduce((a, b) => (Math.abs(b - px) < Math.abs(a - px) ? b : a));
  }

  // Phaser 텍스트 스타일 (크기는 16/32/48 로 맞춤)
  function style(px, extra = {}) {
    return { fontFamily: STACK, fontSize: `${size(px)}px`, ...extra };
  }

  // ───────── 정수배 화면 ─────────
  // 기기 픽셀(devicePixelRatio 포함) 기준으로 게임 1px 이 정수 개의 화면 픽셀이 되게 한다.
  // 창이 게임(960×540)보다 작아 정수배로 맞추면 화면이 너무 작아질 때(minFill 보다 작게 채움)만 비정수 배율을 쓴다.
  function fitZoom(w = window.innerWidth, h = window.innerHeight) {
    const S = TUNING.screen || {};
    const dpr = window.devicePixelRatio || 1;
    const fit = Math.min(w / GAME_WIDTH, h / GAME_HEIGHT);
    if (S.integerScale === false) return fit;
    const k = Math.floor(fit * dpr + 1e-6);
    if (k >= 1 && k / dpr >= fit * (S.minFill ?? 0.7)) return k / dpr;
    return fit;
  }

  function attachScale(game) {
    const apply = () => {
      if (!game.isBooted || !game.canvas) return;
      const z = fitZoom();
      if (Math.abs(game.scale.zoom - z) > 1e-6) game.scale.setZoom(z);
      else game.scale.refresh();
    };
    window.addEventListener('resize', apply);
    // devicePixelRatio 가 바뀌어도 (브라우저 확대·다른 모니터로 옮김)
    const watchDpr = () => {
      if (!window.matchMedia) return;
      const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      const on = () => { mq.removeEventListener('change', on); apply(); watchDpr(); };
      mq.addEventListener('change', on);
    };
    watchDpr();
    if (game.isBooted) apply();
    else game.events.once('ready', apply);
  }

  // ───────── 캔버스 글자: 안티앨리어싱 끄기 ─────────
  // fillText 자체에는 안티앨리어싱 끄는 옵션이 없어서, 글자를 그린 직후 반투명 픽셀을 0 / 255 로 나눈다.
  function crisp(canvas, ctx) {
    const w = canvas.width;
    const h = canvas.height;
    if (!w || !h) return;
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 110 ? 255 : 0;
    ctx.putImageData(img, 0, 0);
  }

  function patchPhaserText() {
    const Text = Phaser.GameObjects.Text;
    const orig = Text.prototype.updateText;
    Text.prototype.updateText = function (...args) {
      const ctx = this.context;
      if (ctx && !ctx.__pixelFont) {
        ctx.__pixelFont = true;
        const self = this;
        const restore = ctx.restore;
        // updateText 는 글자를 다 그린 뒤 restore() 하고 바로 GPU 로 올린다 → 그 사이에 가장자리를 정리
        ctx.restore = function () {
          restore.call(this);
          if (self.__pfDrawing) crisp(self.canvas, ctx);
        };
      }
      if (ctx) ctx.imageSmoothingEnabled = false;
      this.__pfDrawing = true;
      try {
        return orig.apply(this, args);
      } finally {
        this.__pfDrawing = false;
      }
    };
  }

  // ───────── 픽셀 화살표 (▶ ▼ ◀ ▲) ─────────
  const ARROWS = { '▶': 'r', '◀': 'l', '▼': 'd', '▲': 'u' };
  const ARROW_RE = /[▶◀▼▲]/;

  // 글자 노드 안의 화살표를 <i class="px-arrow r"></i> 로
  function replaceIn(node) {
    if (node.nodeType === 3) {
      const t = node.nodeValue;
      if (!ARROW_RE.test(t)) return;
      const p = node.parentNode;
      if (!p || p.closest && p.closest('script,style,textarea')) return;
      const frag = document.createDocumentFragment();
      let buf = '';
      for (const ch of t) {
        if (ARROWS[ch]) {
          if (buf) frag.append(buf);
          buf = '';
          const i = document.createElement('i');
          i.className = 'px-arrow ' + ARROWS[ch];
          i.setAttribute('aria-hidden', 'true');
          frag.append(i);
        } else buf += ch;
      }
      if (buf) frag.append(buf);
      p.replaceChild(frag, node);
      return;
    }
    if (node.nodeType !== 1 || /^(SCRIPT|STYLE|TEXTAREA|INPUT)$/.test(node.nodeName)) return;
    if (!ARROW_RE.test(node.textContent)) return;
    [...node.childNodes].forEach(replaceIn);
  }

  function watchArrows(root = document.body) {
    replaceIn(root);
    new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === 'characterData') replaceIn(m.target);
        else m.addedNodes.forEach(replaceIn);
      }
    }).observe(root, { childList: true, subtree: true, characterData: true });
  }

  return { FAMILY, STACK, SIZES, ready, size, style, fitZoom, attachScale, patchPhaserText, watchArrows, crisp };
})();
