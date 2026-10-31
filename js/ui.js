// 글자 전용 HTML 레이어. Phaser 캔버스(도트, pixelArt) 위에 같은 크기·위치로 겹쳐서
// 대사·HUD·피해 숫자 같은 글자를 브라우저가 매끈하게 그리게 한다.
// 안쪽 좌표는 게임 좌표(960×540) 그대로이고, 레이어 전체를 캔버스 크기에 맞게 scale 한다.
// UI 그림(assets/ui/, tools/process_ui.py)은 틀이면 9-slice(border-image)로 늘려 쓴다. 정보는 assets/ui/ui.json
const UI_DIR = 'assets/ui/';

const UI = {
  root: null,
  scene: null,
  floats: [],
  meta: {},

  init(game, meta) {
    this.game = game;
    this.meta = meta || {};
    this.root = document.getElementById('ui');
    this.root.style.width = GAME_WIDTH + 'px';
    this.root.style.height = GAME_HEIGHT + 'px';
    const sockets = (this.meta.ui_scabbard && this.meta.ui_scabbard.sockets) || [];
    this.root.innerHTML = `
      <div class="hud-counters"><div class="plaque"><b>死</b><span class="deaths">0</span></div><div class="plaque"><b>斬</b><span class="kills">0</span></div></div>
      <div class="hud-tr"><button type="button" class="pause-btn" tabindex="-1" aria-label="일시정지"><i></i><i></i></button><span class="debug">판정 표시 (H)</span></div>
      <div class="boss"><div class="boss-name"></div><div class="boss-bar"><div class="boss-fill"></div></div></div>
      <div class="hud-skills">
        <div class="scabbard">${sockets.map(() => '<i class="sock"><span></span></i>').join('')}</div>
        <div class="sk" data-skill="slash"><div class="sk-icon"></div><div class="sk-ink"></div><div class="sk-frame"></div><b class="sk-key">U</b></div>
        <div class="sk" data-skill="iaido"><div class="sk-icon"></div><div class="sk-ink"></div><div class="sk-frame"></div><b class="sk-key">I</b></div>
      </div>
      <div class="floats"></div>
      <div class="ctx-hints"></div>
      <div class="stage-title"><div class="t1"></div><div class="t2"></div></div>
      <div class="result"></div>
      <div class="loading"><span>불러오는 중</span></div>
      <div class="fx-fade"></div>
      <div class="fx-lb top"></div><div class="fx-lb bottom"></div>
      <div class="fx-cg"><img alt=""><div class="fx-cg-ph"></div></div>
      <div class="fx-caption"></div>
      <div class="fx-title"></div>
      <div class="fx-bossname"></div>
      <div class="fx-item"><small>획득</small><b></b></div>
      <div class="fx-choice"></div>
      <div class="fx-voice"></div>
      <div class="fx-audio"></div>
      <div class="fx-notes"></div>
      <div class="fx-prompt"></div>
      <div class="fx-skip"><svg viewBox="0 0 36 36"><circle class="bg" cx="18" cy="18" r="15"/><circle class="fg" cx="18" cy="18" r="15" pathLength="100"/></svg><span>건너뛰기</span></div>`;
    this.el = (sel) => this.root.querySelector(sel);
    this.setupSkillHud(sockets);
    // 일시정지 버튼 (화면 오른쪽 위). 포커스를 가져가지 않게 해서 Space 가 버튼을 다시 누르지 않도록
    this.el('.pause-btn').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      PauseMenu.open();
    });
    document.addEventListener('inputmodechange', () => {
      if (this.promptText) this.prompt(this.promptText);
      this.refreshCtxHints();
    });
    const layout = () => this.layout();
    window.addEventListener('resize', layout);
    game.scale.on('resize', layout);
    // 캔버스 위치가 정해진 뒤에도 한 번 더
    requestAnimationFrame(layout);
    setTimeout(layout, 300);
  },

  layout() {
    const r = this.game.canvas.getBoundingClientRect();
    if (!r.width) return;
    this.root.style.left = r.left + 'px';
    this.root.style.top = r.top + 'px';
    this.root.style.transform = `scale(${r.width / GAME_WIDTH})`;
  },

  // 장면이 (재)시작될 때 이전 표시를 비운다
  reset(scene) {
    this.scene = scene;
    this.floats.forEach((f) => f.el.remove());
    this.floats = [];
    this.el('.floats').innerHTML = '';
    this.boss(false);
    this.hideResult();
    this.setCounters(0, 0);
    this.el('.ctx-hints').innerHTML = '';
    this.ctxHints = {};
    this.skillState = null;
    this.el('.stage-title').classList.remove('show');
    this.fxReset();
    this.layout();
  },

  // ───────── 컷신 연출 (js/story-player.js 가 부른다) ─────────

  fxReset() {
    this.fade(0, 0);
    this.letterbox(false, true);
    this.skipGauge(0);
    this.prompt(null);
    for (const s of ['.fx-cg', '.fx-caption', '.fx-title', '.fx-bossname', '.fx-item', '.fx-choice', '.fx-voice']) {
      this.el(s).classList.remove('show');
    }
    this.el('.fx-notes').innerHTML = '';
  },

  // 화면을 검게(1) / 밝게(0). 대사·자막은 검은 화면 위에 보인다
  fade(to, sec) {
    const f = this.el('.fx-fade');
    f.style.transitionDuration = sec + 's';
    f.style.opacity = to;
  },

  letterbox(on, instant = false) {
    for (const b of this.root.querySelectorAll('.fx-lb')) {
      b.style.transitionDuration = instant ? '0s' : '';
      b.classList.toggle('on', on);
    }
    this.root.classList.toggle('cinema', on); // 레터박스 중엔 HUD 를 숨긴다
  },

  // 붓 자막: 글자가 한 획씩 써지듯 차례로 번진다. 다 써지는 데 걸리는 ms 를 돌려준다
  brush(el, text, perChar = 70) {
    el.innerHTML = '';
    [...text].forEach((ch, i) => {
      const s = document.createElement('span');
      s.textContent = ch;
      s.style.animationDelay = i * perChar + 'ms';
      el.append(s);
    });
    return text.length * perChar + 450;
  },

  caption(text) {
    const el = this.el('.fx-caption');
    el.classList.add('show');
    return this.brush(el, text);
  },
  hide(sel) { this.el(sel).classList.remove('show'); },

  // 장 제목 카드. style 'logo' = 게임 타이틀: 로고 문양(logo_emblem) 위에 붓글씨로 GAME_TITLE 을 쓴다 (대본의 글자 대신)
  titleCard(text, { color, style } = {}) {
    const el = this.el('.fx-title');
    el.className = 'fx-title show' + (color === 'red' ? ' red' : '') + (style === 'logo' ? ' logo' : '');
    if (style !== 'logo') return this.brush(el, text, 90);
    el.innerHTML = `<img class="logo-emblem" src="${SPRITE_DIR}logo_emblem.png" alt=""><div class="logo-text"></div>`;
    return this.brush(el.querySelector('.logo-text'), GAME_TITLE, 260) + 600;
  },

  bossName(text) {
    const el = this.el('.fx-bossname');
    el.classList.add('show');
    return this.brush(el, text, 80);
  },

  item(name) {
    const el = this.el('.fx-item');
    el.querySelector('b').textContent = name;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  },

  // CG: 화면 가득. assets/cg/cg_번호(두 자리).png 가 있으면 그 그림, 없으면 검은 화면에 'CG 번호 + 대본의 설명'
  // 그림은 장을 시작할 때 CgCache 가 미리 불러 둔다. 자리표시는 파일이 정말 없을 때만 (불러오는 중이면 검은 화면)
  // c: 대본의 cg 명령 { no | image, desc, motion: 'zoom'(1.0→1.05 천천히 확대) | 'pan'(천천히 옆으로) }
  cg(c) {
    const file = CgCache.path(c);
    const el = this.el('.fx-cg');
    const img = el.querySelector('img');
    const ph = el.querySelector('.fx-cg-ph');
    const esc = (t) => String(t).replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
    const label = c.no != null ? `CG ${c.no}` : '';
    ph.innerHTML = `<b>${label}</b><span>${esc(c.desc || '')}</span><small class="dev-only">${file}</small>`;
    const showImg = () => { img.style.display = ''; ph.style.display = 'none'; };
    const showPh = () => { img.style.display = 'none'; ph.style.display = ''; };
    img.style.display = 'none';
    ph.style.display = 'none';
    img.className = 'motion-' + (c.motion || 'zoom');
    const st = CgCache.status(file);
    if (st === 'ok') {
      img.src = file; // 이미 디코딩되어 있어 바로 그려진다
      showImg();
    } else if (st === 'missing') {
      showPh();
    } else {
      // 미리 불러오지 못한 그림(예외): 다 불러올 때까지 검은 화면, 없을 때만 자리표시
      CgCache.load(file).then((ok) => { if (ok) { img.src = file; showImg(); } else showPh(); });
    }
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  },

  // CG 걷기: sec 초 동안 페이드아웃. 걸리는 ms 를 돌려준다 (떠 있지 않으면 0)
  cgHide(sec = 0.8) {
    const el = this.el('.fx-cg');
    if (!el.classList.contains('show')) return 0;
    el.style.transitionDuration = sec + 's';
    el.classList.remove('show');
    setTimeout(() => { el.style.transitionDuration = ''; }, sec * 1000 + 50);
    return sec * 1000;
  },

  loading(on) { this.el('.loading').classList.toggle('show', on); },

  // 길게 눌러 건너뛰기 게이지 (0~1, 0 이면 숨김)
  skipGauge(r) {
    const el = this.el('.fx-skip');
    el.classList.toggle('show', r > 0);
    el.style.setProperty('--p', Math.min(1, r));
  },

  // 선택지. 고른 option.id 를 돌려주는 Promise. 키보드는 엔진이 choiceMove/choiceConfirm 으로 넘겨준다
  choice(options) {
    const el = this.el('.fx-choice');
    el.innerHTML = '';
    this.choiceIndex = 0;
    this.choiceButtons = options.map((o, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = `<span>〈${o.text}〉</span>`;
      b.onpointerdown = (e) => { e.stopPropagation(); this.choiceIndex = i; this.choiceConfirm(); };
      el.append(b);
      return b;
    });
    this.choiceMove(0);
    el.classList.add('show');
    return new Promise((resolve) => { this.choiceResolve = (i) => resolve(options[i].id); });
  },
  choiceMove(d) {
    if (!this.choiceButtons) return;
    const n = this.choiceButtons.length;
    this.choiceIndex = (this.choiceIndex + d + n) % n;
    this.choiceButtons.forEach((b, i) => b.classList.toggle('sel', i === this.choiceIndex));
  },
  choiceConfirm() {
    if (!this.choiceResolve) return;
    const r = this.choiceResolve;
    this.choiceResolve = null;
    this.choiceButtons = null;
    this.hide('.fx-choice');
    r(this.choiceIndex);
  },

  // 게임을 멈추지 않는 목소리 (체크포인트에서 하루 목소리 등)
  voiceToast(text, style, ms = 3000) {
    const el = this.el('.fx-voice');
    el.className = `fx-voice voice-${style || 'plain'}`;
    el.textContent = text;
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(this.voiceTimer);
    this.voiceTimer = setTimeout(() => el.classList.remove('show'), ms);
  },

  // 개발 모드에서만: 지금 나오는 BGM·효과음 이름을 화면 오른쪽 위에 작게
  audioCue(text) {
    const el = this.el('.fx-audio');
    const d = document.createElement('div');
    d.textContent = text;
    el.append(d);
    setTimeout(() => d.remove(), 2200);
  },

  // 연출 메모(note): 개발 모드에서만 왼쪽 위 구석에 작게 보인다
  note(text) {
    const el = this.el('.fx-notes');
    const d = document.createElement('div');
    d.textContent = '▶ ' + text;
    el.append(d);
    while (el.children.length > 4) el.firstChild.remove();
    setTimeout(() => d.remove(), 6000);
  },

  // 말풍선: 인물 머리 위를 따라다니며 ms 뒤 사라진다 (게임을 멈추지 않음)
  bubble(target, text, { name, ms = 3000 } = {}) {
    const el = document.createElement('div');
    el.className = 'float bubble';
    el.innerHTML = `<div class="bubble-box">${name ? `<i>${name}</i>` : ''}${text}</div>`;
    this.el('.floats').append(el);
    const f = { el, target, until: performance.now() + ms };
    this.floats.push(f);
    this.place(f);
  },

  // 튜토리얼 안내 (화면 위쪽 가운데, 끝날 때까지 떠 있음). { kb, touch } — 조작 방식에 맞는 글. null 이면 숨김
  prompt(p) {
    const el = this.el('.fx-prompt');
    this.promptText = p;
    if (!p) return el.classList.remove('show');
    el.textContent = TouchPad.mode === 'touch' ? p.touch : p.kb;
    el.classList.add('show');
  },

  // 인물 머리 위 이름표 (지울 때까지 남음). { el, remove }
  tag(target, text) {
    const el = document.createElement('div');
    el.className = 'float npc-tag';
    el.innerHTML = `<span>${text}</span>`;
    this.el('.floats').append(el);
    const f = { el, target, until: Infinity };
    this.floats.push(f);
    this.place(f);
    return { el, remove: () => { f.until = 0; } };
  },

  debug(on) { this.el('.debug').style.display = on ? '' : 'none'; },

  // ───────── 9-slice ─────────
  // el 에 UI 그림 name 을 9-slice 틀로 입힌다. scale: 그림 1px 이 화면 몇 px 인지 (모서리 장식 크기)
  nine(el, name, scale = 1) {
    const m = this.meta[name];
    if (!m || !m.slice) return;
    const [t, r, b, l] = m.slice;
    Object.assign(el.style, {
      borderStyle: 'solid',
      borderWidth: `${t * scale}px ${r * scale}px ${b * scale}px ${l * scale}px`,
      borderImageSource: `url(${UI_DIR}${m.file})`,
      borderImageSlice: `${t} ${r} ${b} ${l}${m.fill ? ' fill' : ''}`,
      borderImageRepeat: 'stretch',
    });
  },

  // ───────── 상단 카운터 (나무 명패: 死 사망 · 斬 처치) ─────────
  setCounters(deaths, kills) {
    const d = this.el('.deaths');
    const k = this.el('.kills');
    if (d.textContent !== String(deaths)) d.textContent = deaths;
    if (k.textContent !== String(kills)) k.textContent = kills;
  },

  // ───────── 스킬 칸 · 칼집 게이지 (왼쪽 아래) ─────────
  setupSkillHud(sockets) {
    const fa = this.meta.ui_skill_frame_a;
    const fb = this.meta.ui_skill_frame_b;
    const sc = this.meta.ui_scabbard;
    const S = 0.385; // 스킬 틀 187×167 → 약 72×64
    this.el('.hud-skills').querySelectorAll('.sk').forEach((el, i) => {
      const f = i === 0 ? fa : fb;
      if (!f) return;
      const [x0, y0, x1, y1] = f.window;
      el.style.width = f.width * S + 'px';
      el.style.height = f.height * S + 'px';
      el.querySelector('.sk-frame').style.backgroundImage = `url(${UI_DIR}${f.file})`;
      // 아이콘·먹물은 틀 안쪽 창에
      for (const c of ['.sk-icon', '.sk-ink']) {
        Object.assign(el.querySelector(c).style, {
          left: x0 * S + 'px', top: y0 * S + 'px', width: (x1 - x0) * S + 'px', height: (y1 - y0) * S + 'px',
        });
      }
      el.querySelector('.sk-icon').style.backgroundPosition = `${i === 0 ? 0 : 100 / 3}% 0`;
    });
    if (sc) {
      const SS = 0.46; // 칼집 555×96 → 약 255×44
      const box = this.el('.scabbard');
      box.style.width = sc.width * SS + 'px';
      box.style.height = sc.height * SS + 'px';
      box.style.backgroundImage = `url(${UI_DIR}${sc.file})`;
      const r = sc.socketRadius * SS;
      box.querySelectorAll('.sock').forEach((s, i) => {
        const [x, y] = sockets[i];
        Object.assign(s.style, { left: x * SS - r + 'px', top: y * SS - r + 'px', width: r * 2 + 'px', height: r * 2 + 'px' });
      });
    }
  },

  // st: { slash: { frac, active, locked }, iaido: {...}, sakura, sakuraLocked }  frac: 남은 쿨타임 비율(1 → 0)
  updateSkills(st) {
    const prev = this.skillState || {};
    const hud = this.el('.hud-skills');
    hud.querySelectorAll('.sk').forEach((el) => {
      const s = st[el.dataset.skill];
      const p = prev[el.dataset.skill] || {};
      if (s.locked !== p.locked) el.classList.toggle('locked', s.locked);
      if (s.active !== p.active) el.classList.toggle('active', s.active);
      // 먹물: 쿨타임이 시작되면 칸을 가득 덮고, 위에서부터 빠져 아래로 내려간다
      const h = Math.round(s.frac * 1000) / 10;
      if (h !== p.h) el.querySelector('.sk-ink').style.setProperty('--f', h / 100);
      if (h === 0 && p.h > 0) {
        el.classList.remove('ready');
        void el.offsetWidth;
        el.classList.add('ready'); // 다 빠지면 톡 빛남
      }
      s.h = h;
    });
    if (st.sakuraLocked !== prev.sakuraLocked) this.el('.scabbard').classList.toggle('locked', st.sakuraLocked);
    // 벚꽃 스택: 소켓에 꽃이 하나씩 피어난다. 발도로 쓰면 흩날린다
    const n = st.sakura;
    const was = prev.sakura || 0;
    if (n !== was) {
      this.el('.scabbard').querySelectorAll('.sock').forEach((s, i) => {
        if (i < n && i >= was) {
          s.classList.remove('scatter');
          s.classList.add('on');
        } else if (i >= n && i < was) {
          s.classList.remove('on');
          s.classList.add('scatter');
        }
      });
    }
    this.skillState = st;
  },

  // ───────── 1-1 조작 안내: 그 행동이 필요한 자리에 작게 ─────────
  // h: { id, x, y, kb, touch }  (월드 좌표)
  showCtxHint(h) {
    if (this.ctxHints[h.id]) return;
    const el = document.createElement('div');
    el.className = 'float ctx-hint';
    this.el('.ctx-hints').append(el);
    const f = { el, wx: h.x, wy: h.y, until: Infinity, hint: h };
    this.ctxHints[h.id] = f;
    this.floats.push(f);
    this.renderCtxHint(f);
    this.place(f);
  },

  renderCtxHint(f) {
    const text = TouchPad.mode === 'touch' ? f.hint.touch : f.hint.kb;
    // [키] 설명 — 대괄호 안은 키 모양으로
    f.el.innerHTML = `<span>${text.replace(/\[([^\]]+)\]/g, '<kbd>$1</kbd>')}</span>`;
  },

  refreshCtxHints() {
    for (const f of Object.values(this.ctxHints || {})) this.renderCtxHint(f);
  },

  hideCtxHint(id) {
    const f = this.ctxHints[id];
    if (!f) return;
    delete this.ctxHints[id];
    f.el.classList.add('out');
    f.until = performance.now() + 400;
  },

  boss(visible, name = '', ratio = 1) {
    const b = this.el('.boss');
    b.style.display = visible ? '' : 'none';
    if (!visible) return;
    this.el('.boss-name').textContent = name;
    this.el('.boss-fill').style.width = Math.max(0, ratio) * 100 + '%';
  },

  stageTitle(title, sub) {
    const s = this.el('.stage-title');
    s.querySelector('.t1').textContent = title;
    s.querySelector('.t2').textContent = sub || '';
    s.classList.remove('show');
    void s.offsetWidth; // 애니메이션 다시 시작
    s.classList.add('show');
  },

  // ───────── 결과창: 두루마리 ─────────
  // 닫힌 두루마리가 위에서 내려와 좌우로 펼쳐지고 → 붓글씨 「討伐」을 한 획씩 → 붉은 도장 쾅(onStamp) → 처치·사망 수.
  // 다 나오는 데 걸리는 ms 를 돌려준다
  result({ kills = 0, deaths = 0, onStamp } = {}) {
    const el = this.el('.result');
    const m = this.meta;
    const P = 1.55; // 두루마리 그림 배율
    const paper = m.ui_scroll_paper || { width: 326, height: 193 };
    const rl = m.ui_scroll_roller_l || { width: 40 };
    const rr = m.ui_scroll_roller_r || { width: 38 };
    const H = paper.height * P;
    const W = paper.width * P;
    // 붓글씨: 획마다 path, 획 길이에 비례한 시간으로 차례로 쓴다
    let t = 0;
    const strokes = [];
    const glyph = (ch, ox) => (KANJI_STROKES[ch] || []).map((d) => {
      strokes.push(t);
      t += 0.16;
      return `<path d="${d}" transform="translate(${ox} 0)" style="--d:${strokes[strokes.length - 1]}s"/>`;
    }).join('');
    const svg = `<svg class="rs-kanji" viewBox="0 0 218 109"><defs><filter id="rs-brush" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3"/>
      <feDisplacementMap in="SourceGraphic" scale="2.6"/></filter></defs><g>${glyph('討', 0)}${glyph('伐', 109)}</g></svg>`;
    const write0 = 1.45; // 펼쳐진 뒤 쓰기 시작
    const stampAt = write0 + t + 0.25;
    const touch = TouchPad.mode === 'touch';
    el.style.setProperty('--write0', write0 + 's');
    el.style.setProperty('--stamp', stampAt + 's');
    el.innerHTML = `
      <div class="rs-drop"><img class="rs-closed" src="${UI_DIR}ui_scroll_closed.png" alt=""></div>
      <div class="rs-open" style="width:${W + (rl.width + rr.width) * P}px;height:${H}px">
        <div class="rs-paper" style="left:${rl.width * P}px;width:${W}px;height:${H}px">
          ${svg}
          <div class="rs-seal"><span>仇</span><span>討</span></div>
          <div class="rs-stats"><span>斬 ${kills}</span><span>死 ${deaths}</span></div>
          <div class="rs-again">${touch ? '화면을 누르면' : '점프 · 공격으로'} 다시 시작</div>
        </div>
        <img class="rs-roller l" src="${UI_DIR}ui_scroll_roller_l.png" alt="" style="width:${rl.width * P}px">
        <img class="rs-roller r" src="${UI_DIR}ui_scroll_roller_r.png" alt="" style="width:${rr.width * P}px">
      </div>`;
    el.querySelector('.rs-paper').style.backgroundImage = `url(${UI_DIR}${paper.file || 'ui_scroll_paper.png'})`;
    el.querySelectorAll('.rs-kanji path').forEach((p) => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = len;
      p.style.strokeDashoffset = len;
    });
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(this.stampTimer);
    this.stampTimer = setTimeout(() => {
      el.classList.add('stamped');
      if (onStamp) onStamp();
    }, stampAt * 1000 + 120);
    return (stampAt + 0.9) * 1000;
  },

  hideResult() {
    const el = this.el('.result');
    clearTimeout(this.stampTimer);
    el.classList.remove('show', 'stamped');
    el.innerHTML = '';
  },

  // 월드 좌표에 붙어 떠오르는 글자 (피해 숫자, '패링!' 등). kind: 'damage' | 'pop'
  float(wx, wy, text, { color = '#fff', size = 20, kind = 'damage', ms = 700 } = {}) {
    const el = document.createElement('div');
    el.className = 'float ' + kind;
    el.innerHTML = `<span style="color:${color};font-size:${size}px;animation-duration:${ms}ms">${text}</span>`;
    this.el('.floats').append(el);
    const f = { el, wx, wy, until: performance.now() + ms };
    this.floats.push(f);
    this.place(f);
  },

  place(f) {
    const cam = this.scene && this.scene.cameras.main;
    if (!cam) return;
    if (f.target) [f.wx, f.wy] = f.target();
    f.el.style.transform = `translate(${Math.round(f.wx - cam.scrollX)}px, ${Math.round(f.wy - cam.scrollY)}px)`;
  },

  // 매 프레임: 떠 있는 글자를 카메라에 맞춰 옮기고 끝난 것은 지운다
  update() {
    const now = performance.now();
    this.floats = this.floats.filter((f) => {
      if (now > f.until) {
        f.el.remove();
        return false;
      }
      this.place(f);
      return true;
    });
  },
};
