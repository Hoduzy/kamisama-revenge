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
      <div class="banner"></div>`;
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
    this.layout();
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
