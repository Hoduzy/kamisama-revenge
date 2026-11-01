// 일시정지 메뉴: ESC 또는 화면 오른쪽 위 버튼. 나무 현판(ui_plaque, 2배 그대로) 위에
// 이어 하기 · 처음부터 · 조작 방식(키보드/터치) · 조작 안내 · 연출 시험 · 개발 메뉴 (F1 이 안 눌리는 기기에서도 열 수 있게).
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
    // 현판 그림은 늘리지 않고 2배 그대로 (장식이 찌그러지지 않게), 글은 종이 부분(PAPER)에만
    el.innerHTML = `
      <div class="pm-wrap">
        <h2>잠시 멈춤</h2>
        <div class="pm-board">
          <div class="pm-paper">
            <div class="pm-page pm-main">
              <button type="button" data-act="resume">이어 하기</button>
              <button type="button" data-act="restart">처음부터 다시</button>
              <button type="button" data-act="mode"></button>
              <button type="button" data-act="controls">조작 안내</button>
              <button type="button" data-act="cine">연출 시험</button>
              <button type="button" data-act="dev">개발 메뉴</button>
            </div>
            <div class="pm-page pm-help"><dl class="pm-controls"></dl><button type="button" data-act="back" class="pm-back">돌아가기</button></div>
          </div>
        </div>
      </div>`;
    document.getElementById('ui').append(el);
    this.el = el;
    this.page = 'main';
    this.buttons = [...el.querySelectorAll('.pm-main button')];
    for (const b of el.querySelectorAll('button')) {
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const i = this.buttons.indexOf(b);
        if (i >= 0) this.sel = i;
        this.activate(b.dataset.act);
      });
    }
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
    if (this.page === 'help') {
      if (['Escape', 'Enter', ' ', 'j', 'J'].includes(e.key)) this.showPage('main');
      return;
    }
    // 2열 × 3줄: 좌우 = 옆 칸, 위아래 = 윗줄·아랫줄
    const k = e.key;
    if (k === 'Escape') this.close();
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') this.move(1);
    else if (k === 'ArrowLeft' || k === 'a' || k === 'A') this.move(-1);
    else if (k === 'ArrowDown' || k === 's' || k === 'S') this.move(2);
    else if (k === 'ArrowUp' || k === 'w' || k === 'W') this.move(-2);
    else if (k === 'Enter' || k === ' ' || k === 'j' || k === 'J') this.activate();
  },

  move(d) {
    this.sel = (this.sel + d + this.buttons.length) % this.buttons.length;
    this.render();
  },

  render() {
    if (!this.el) return;
    const touch = TouchPad.mode === 'touch';
    this.buttons[2].textContent = `조작 : ${touch ? '터치' : '키보드'}`;
    this.buttons.forEach((b, i) => b.classList.toggle('sel', i === this.sel));
    this.el.querySelector('.pm-controls').innerHTML = this.CONTROLS[touch ? 'touch' : 'keyboard']
      .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  },

  showPage(p) {
    this.page = p;
    this.el.querySelector('.pm-main').classList.toggle('show', p === 'main');
    this.el.querySelector('.pm-help').classList.toggle('show', p === 'help');
  },

  open() {
    const gs = this.gameScene;
    if (this.isOpen || !gs || !gs.sys.isActive()) return;
    this.isOpen = true;
    this.sel = 0;
    this.showPage('main');
    this.render();
    this.el.classList.add('show');
    this.game.input.keyboard.enabled = false;
    this.freeze(true);
  },

  // keepPaused: 멈춘 채로 다른 창(개발 메뉴)에 넘긴다 — 그 창이 닫힐 때 다시 움직인다
  close(keepPaused = false) {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.classList.remove('show');
    this.game.input.keyboard.enabled = true;
    this.gameScene.input.keyboard.resetKeys();
    if (keepPaused) UI.root.classList.remove('game-paused');
    else this.freeze(false);
  },

  // 게임을 정말로 멈춘다: 장면(물리·트윈·애니메이션·장면 시계 → 컷신 대기까지), 글자 레이어의 CSS 애니메이션, 음악
  freeze(on) {
    const gs = this.gameScene;
    if (on && gs.scene.isActive()) gs.scene.pause();
    if (!on && gs.scene.isPaused()) gs.scene.resume();
    UI.root.classList.toggle('game-paused', on);
    document.body.classList.toggle('game-paused', on); // 터치 버튼도 숨김
    for (const a of [StoryAudio.bgm, CineSound.bgmEl]) {
      if (!a) continue;
      if (on) a.pause(); else a.play().catch(() => {});
    }
  },

  activate(act = this.buttons[this.sel].dataset.act) {
    if (act === 'resume') this.close();
    else if (act === 'restart') {
      this.close();
      this.gameScene.restartChapter();
    } else if (act === 'mode') {
      TouchPad.toggleMode();
      this.render();
    } else if (act === 'controls') {
      this.showPage('help');
    } else if (act === 'back') {
      this.showPage('main');
    } else if (act === 'cine') {
      // 연출 시험 창은 게임이 움직이는 채로 쓴다
      this.close();
      CineLab.open();
    } else if (act === 'dev') {
      this.close(true);
      DevMenu.open();
    }
  },
};
