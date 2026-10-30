// 일시정지 메뉴: ESC 또는 화면 오른쪽 위 버튼. 나무 현판(ui_plaque, 9-slice) 위에
// 이어 하기 · 처음부터 · 조작 방식(키보드/터치) 바꾸기 · 조작 안내.
// 컷신이 재생 중일 때 ESC 는 장면 건너뛰기라 메뉴를 열지 않는다.
const PauseMenu = {
  isOpen: false,
  sel: 0,

  CONTROLS: {
    keyboard: [
      ['A · D', '이동'], ['Space', '점프'], ['J', '공격'], ['K', '대시'],
      ['U', '대쉬베기'], ['I', '발도 · 받아치기'],
      ['Space', '대사 넘기기'], ['길게', '장면 건너뛰기'], ['R', '다시 시작'], ['ESC', '일시정지'],
    ],
    touch: [
      ['◀ ▶', '이동'], ['점프', '점프'], ['공격', '공격'], ['대시', '대시'],
      ['베기', '대쉬베기'], ['발도', '발도 · 받아치기'],
      ['탭', '대사 넘기기'], ['길게', '장면 건너뛰기'],
    ],
  },

  init(game) {
    if (this.game) return;
    this.game = game;
    const el = document.createElement('div');
    el.id = 'pause-menu';
    el.innerHTML = `
      <div class="pm-board">
        <h2>잠시 멈춤</h2>
        <div class="pm-items">
          <button type="button" data-act="resume">이어 하기</button>
          <button type="button" data-act="restart">처음부터 다시</button>
          <button type="button" data-act="mode"></button>
        </div>
        <dl class="pm-controls"></dl>
      </div>`;
    document.getElementById('ui').append(el);
    this.el = el;
    UI.nine(el.querySelector('.pm-board'), 'ui_plaque', 0.9);
    this.buttons = [...el.querySelectorAll('.pm-items button')];
    this.buttons.forEach((b, i) => {
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.sel = i;
        this.activate();
      });
    });
    el.addEventListener('pointerdown', (e) => { if (e.target === el) this.close(); });
    window.addEventListener('keydown', (e) => this.onKey(e));
    document.addEventListener('inputmodechange', () => this.render());
  },

  get gameScene() {
    return this.game && this.game.scene.keys.game;
  },

  onKey(e) {
    if (DevMenu.isOpen) return;
    if (!this.isOpen) {
      // 컷신 중 ESC 는 건너뛰기 (StoryPlayer)
      const gs = this.gameScene;
      if (e.key === 'Escape' && gs && gs.sys.isActive() && !gs.story.busy && !gs.cleared) this.open();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') this.close();
    else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') this.move(1);
    else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') this.move(-1);
    else if (e.key === 'Enter' || e.key === ' ' || e.key === 'j' || e.key === 'J') this.activate();
  },

  move(d) {
    this.sel = (this.sel + d + this.buttons.length) % this.buttons.length;
    this.render();
  },

  render() {
    if (!this.el) return;
    const touch = TouchPad.mode === 'touch';
    this.buttons[2].textContent = `조작 방식 : ${touch ? '터치' : '키보드'}`;
    this.buttons.forEach((b, i) => b.classList.toggle('sel', i === this.sel));
    this.el.querySelector('.pm-controls').innerHTML = this.CONTROLS[touch ? 'touch' : 'keyboard']
      .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  },

  open() {
    const gs = this.gameScene;
    if (this.isOpen || !gs || !gs.sys.isActive()) return;
    this.isOpen = true;
    this.sel = 0;
    this.render();
    this.el.classList.add('show');
    this.game.input.keyboard.enabled = false;
    gs.scene.pause();
  },

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.classList.remove('show');
    this.game.input.keyboard.enabled = true;
    const gs = this.gameScene;
    gs.input.keyboard.resetKeys();
    if (gs.scene.isPaused()) gs.scene.resume();
  },

  activate() {
    const act = this.buttons[this.sel].dataset.act;
    if (act === 'resume') this.close();
    else if (act === 'restart') {
      this.close();
      this.gameScene.restartChapter();
    } else if (act === 'mode') {
      TouchPad.toggleMode();
      this.render();
    }
  },
};
