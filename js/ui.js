// 글자 전용 HTML 레이어. Phaser 캔버스(도트, pixelArt) 위에 같은 크기·위치로 겹쳐서
// 대사·HUD·피해 숫자 같은 글자를 브라우저가 매끈하게 그리게 한다.
// 안쪽 좌표는 게임 좌표(960×540) 그대로이고, 레이어 전체를 캔버스 크기에 맞게 scale 한다.
const UI = {
  root: null,
  scene: null,
  floats: [],
  skills: [],

  init(game) {
    this.game = game;
    this.root = document.getElementById('ui');
    this.root.style.width = GAME_WIDTH + 'px';
    this.root.style.height = GAME_HEIGHT + 'px';
    this.root.innerHTML = `
      <div class="hud-tl"><i class="hp"></i><span class="deaths">사망 0</span></div>
      <div class="hud-tr"><span class="ko">KO 0</span><span class="debug">판정 표시 (H)</span></div>
      <div class="hud-hint"></div>
      <div class="boss"><div class="boss-name"></div><div class="boss-bar"><div class="boss-fill"></div></div></div>
      <div class="skill-labels"></div>
      <div class="floats"></div>
      <div class="stage-title"><div class="t1"></div><div class="t2"></div></div>
      <div class="banner"></div>
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
      <div class="fx-skip"><svg viewBox="0 0 36 36"><circle class="bg" cx="18" cy="18" r="15"/><circle class="fg" cx="18" cy="18" r="15" pathLength="100"/></svg><span>건너뛰기</span></div>`;
    this.el = (sel) => this.root.querySelector(sel);
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
    this.el('.skill-labels').innerHTML = '';
    this.skills = [];
    this.boss(false);
    this.banner(null);
    this.el('.stage-title').classList.remove('show');
    this.fxReset();
    this.layout();
  },

  // ───────── 컷신 연출 (js/story-player.js 가 부른다) ─────────

  fxReset() {
    this.fade(0, 0);
    this.letterbox(false, true);
    this.skipGauge(0);
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

  titleCard(text, { color, style } = {}) {
    const el = this.el('.fx-title');
    el.className = 'fx-title show' + (color === 'red' ? ' red' : '') + (style === 'logo' ? ' logo' : '');
    return this.brush(el, text, 90);
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

  // CG: 화면 가득. assets/cg/cg번호.png 가 있으면 그 그림, 없으면 검은 화면에 'CG 번호 + 대본의 설명'
  cg(no, desc) {
    const el = this.el('.fx-cg');
    const img = el.querySelector('img');
    const ph = el.querySelector('.fx-cg-ph');
    const esc = (t) => String(t).replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
    ph.innerHTML = `<b>CG ${no}</b><span>${esc(desc || '')}</span><small class="dev-only">assets/cg/cg${no}.png</small>`;
    img.style.display = 'none';
    ph.style.display = '';
    img.onload = () => { img.style.display = ''; ph.style.display = 'none'; };
    img.onerror = () => { img.removeAttribute('src'); };
    img.src = `assets/cg/cg${no}.png`;
    el.classList.add('show');
  },

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

  setDeaths(n) { this.el('.deaths').textContent = '사망 ' + n; },
  setKO(n) { this.el('.ko').textContent = 'KO ' + n; },
  debug(on) { this.el('.debug').style.display = on ? '' : 'none'; },

  hint(text, ms = 4500) {
    const h = this.el('.hud-hint');
    h.textContent = text;
    h.classList.add('show');
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => h.classList.remove('show'), ms);
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

  banner(html) {
    const b = this.el('.banner');
    b.style.display = html ? '' : 'none';
    if (html) b.innerHTML = html;
  },

  // 스킬 아이콘(Phaser 그림) 위에 얹는 키 글자·남은 쿨타임 숫자
  addSkillLabel(x, y, key) {
    const d = document.createElement('div');
    d.className = 'skill-label';
    d.style.left = x + 'px';
    d.style.top = y + 'px';
    d.innerHTML = `<span class="key">${key}</span><span class="cd"></span>`;
    this.el('.skill-labels').append(d);
    this.skills.push(d.querySelector('.cd'));
    return this.skills.length - 1;
  },

  setCooldown(i, text) {
    const el = this.skills[i];
    if (el && el.textContent !== text) el.textContent = text;
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
