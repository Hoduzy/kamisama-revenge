// 대화창 (HTML 레이어 #ui 안). 에도 시대풍: 대화창 틀(ui_dialogue_frame) + 붉은 이름표(ui_nameplate), 둘 다 9-slice.
// 나타날 때 붓으로 칠하듯 왼쪽 → 오른쪽으로 드러난다(style.css 의 brush-reveal).
// 초상화는 대화창 안쪽의 정사각형 칸(같은 틀 장식)에 통째로 들어간다. 말하는 사람이 왼쪽이면 칸이 왼쪽, 오른쪽이면 오른쪽,
// 글자는 칸 반대편에서 시작하고 이름표는 글자 시작점 바로 위(대화창 윗선에 걸침). 초상화가 없으면 칸 없이 글자가 전체 폭.
// 한 줄씩 보여 주는 방식: open() → line(명령) 을 await → close(). 컷신 엔진(js/story-player.js)이 부른다.
//   say   : 초상화 + 이름표 + 대사
//   think : 아카네 속마음. 초상화 반투명, 글자 회색
//   voice : 초상화·이름표 없이 글자만. style pink(하루) / goldTremble(하쿠야, 떨리는 금색) / plain
// 넘기기: Space / J / Enter / 화면 탭, 길게 누르면 장면 전체 건너뛰기 (조작 가능 컷신은 Enter·탭, 또는 자동으로 넘어감).
// 넘기기 안내는 화면 오른쪽 위 구석에, 게임을 처음 켠 뒤 대사 3개 동안만 (그 뒤로는 일시정지 → 조작 안내).
// 인물 설정(data/story/characters.json): sprite(도트 초상화 시트 + 표정), image, color. 둘 다 없으면 실루엣(js/portraits.js)
const KEY_HINT_STORE = 'kamisama-keyhint';
const KEY_HINT_LINES = 3;

class DialogueBox {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    let root = document.getElementById('dialogue');
    if (!root) {
      root = document.createElement('div');
      root.id = 'dialogue';
      root.innerHTML = `
        <div class="dlg-panel">
          <div class="dlg-face"><div class="dlg-portrait"></div></div>
          <div class="dlg-text"></div>
          <div class="dlg-next">▼</div>
        </div>
        <div class="dlg-name"></div>`;
      document.getElementById('ui').append(root);
      // 틀(ui_dialogue_frame)·이름표(ui_nameplate) 9-slice. 이름표는 패널 밖이라 패널의 붓 마스크에 잘리지 않는다
      UI.nine(root.querySelector('.dlg-panel'), 'ui_dialogue_frame', 0.4);
      UI.nine(root.querySelector('.dlg-name'), 'ui_nameplate', 0.35);
      // 초상화 칸: 대화창과 같은 틀 장식 (얇게. 귀퉁이가 칸에 맞게 가로세로 두께를 비슷하게)
      const face = root.querySelector('.dlg-face');
      UI.nine(face, 'ui_dialogue_frame', 0.2);
      face.style.borderLeftWidth = face.style.borderRightWidth = '9px';
    }
    this.root = root;
    this.faceEl = root.querySelector('.dlg-face');
    this.portraitEl = root.querySelector('.dlg-portrait');
    this.nameEl = root.querySelector('.dlg-name');
    this.textEl = root.querySelector('.dlg-text');
    this.nextEl = root.querySelector('.dlg-next');
    this.hintEl = document.querySelector('#ui .dlg-keys');
    root.classList.remove('show', 'open');
    this.pending = null;
  }

  // characters: data/story/characters.json. controllable: 플레이어가 움직이는 컷신(자동 넘김, Space/J 는 게임 조작)
  open(characters, { controllable = false } = {}) {
    this.characters = characters || {};
    this.controllable = controllable;
    this.faceSpeaker = null;
    this.root.classList.remove('has-face', 'face-left', 'face-right', 'thinking');
    this.portraitEl.style.backgroundImage = '';
    this.textEl.innerHTML = '';
    this.nameEl.style.display = 'none';
    this.active = true;
    this.root.classList.remove('show'); // 첫 대사가 나올 때 나타난다
    this.setControllable(controllable);
  }

  // 장면 도중 조작 모드가 바뀔 때 (auto ↔ play/slow, js/story-player.js 의 setMode)
  setControllable(controllable) {
    this.controllable = controllable;
    const touch = TouchPad.mode === 'touch';
    if (this.hintEl) this.hintEl.textContent = controllable
      ? (touch ? '자동으로 넘어감 · 화면 탭 넘기기 · 길게 누르면 건너뛰기' : '자동으로 넘어감 · Enter 넘기기 · 길게 누르거나 Esc 1초 건너뛰기')
      : (touch ? '탭 넘기기 · 길게 누르면 건너뛰기' : 'Space 넘기기 · 길게 누르거나 Esc 1초 건너뛰기');
    this.root.classList.toggle('controllable', controllable);
    document.body.classList.toggle('in-dialogue', this.active && !controllable);
  }

  // 대사가 없는 연출(자막, CG, 페이드 …) 동안은 대화창을 내린다
  hide() {
    this.root.classList.remove('show');
    UI.root.classList.remove('dlg-up');
    if (this.hintEl) this.hintEl.classList.remove('show');
  }

  show() {
    UI.root.classList.add('dlg-up'); // 아래쪽 레터박스는 대화창이 떠 있는 동안 걷는다
    if (this.root.classList.contains('show')) return;
    this.root.classList.add('open');
    void this.root.offsetWidth;
    this.root.classList.add('show'); // 아래에서 살짝 올라오며 나타남
  }

  close() {
    if (!this.active) return;
    this.active = false;
    this.resolvePending();
    document.body.classList.remove('in-dialogue');
    this.root.classList.remove('show');
    UI.root.classList.remove('dlg-up');
    if (this.hintEl) this.hintEl.classList.remove('show');
    setTimeout(() => { if (!this.active) this.root.classList.remove('open'); }, 250);
  }

  // 초상화 그림: 도트 시트(표정) → image → 실루엣 + 이름 첫 글자(임시). 칸 안쪽에 통째로 들어가게 줄인다
  portraitStyle(id, ch, face) {
    const f = ch.sprite && Sprites.face(ch.sprite, face);
    if (f && this.scene.textures.exists(f.key) && Sprites.sheet(f.key)) {
      const s = Sprites.sheet(f.key);
      const frame = f.frame;
      const iw = this.faceEl.clientWidth || 78;
      const ih = this.faceEl.clientHeight || 80;
      const k = Math.min(iw / s.frameWidth, ih / s.frameHeight);
      return {
        backgroundImage: `url(${SPRITE_DIR}${s.file})`,
        backgroundSize: `${s.frameWidth * s.frames * k}px ${s.frameHeight * k}px`,
        backgroundPosition: `${-frame * s.frameWidth * k}px 0`,
        width: s.frameWidth * k + 'px',
        height: s.frameHeight * k + 'px',
      };
    }
    if (!ch.name && !ch.image) return null;
    const url = ch.image || Portraits.silhouette(id, ch);
    return { backgroundImage: `url(${url})`, backgroundSize: '100% 100%', backgroundPosition: '0 0', width: '100%', height: '100%' };
  }

  // 한 줄 보여 주고, 넘길 때 끝나는 Promise
  line(c) {
    this.resolvePending();
    // 조작 가능 컷신: 대화창 대신 말하는 인물 머리 위 작은 말풍선 (인물이 화면에 있을 때)
    const actor = this.controllable && c.cmd !== 'voice' && this.scene.actors && this.scene.actors.get(c.speaker);
    if (actor && actor.visible !== false) return this.bubbleLine(c, actor);
    this.show();
    const ch = this.characters[c.speaker] || {};
    const kind = c.cmd; // say | think | voice
    const side = kind === 'voice' ? null : (c.side || (c.speaker === 'akane' ? 'left' : 'right'));
    // 칸 안에 초상화 (말하는 쪽으로 칸이 옮겨 가고, 글자는 반대편에서). 그림이 없으면 칸 없이 전체 폭
    const style = side && c.portrait !== false ? this.portraitStyle(c.speaker, ch, c.face) : null;
    const R = this.root.classList;
    R.toggle('has-face', !!style);
    R.toggle('face-left', !!style && side === 'left');
    R.toggle('face-right', !!style && side === 'right');
    R.toggle('thinking', kind === 'think'); // 속마음: 초상화 반투명
    if (style) {
      const el = this.portraitEl;
      Object.assign(el.style, style);
      const key = c.speaker + side;
      if (this.faceSpeaker !== key) {
        el.classList.remove('enter');
        void el.offsetWidth;
        el.classList.add('enter'); // 새 사람이면 살짝 밝아지며 나타남
      }
      this.faceSpeaker = key;
    } else {
      this.faceSpeaker = null;
    }

    // 이름표: 목소리는 이름 없이 글자만
    const name = ch.name || c.speaker || '';
    this.nameEl.textContent = kind === 'think' ? `${name} · 속마음` : name;
    this.nameEl.style.display = kind === 'voice' || !name ? 'none' : '';
    this.root.classList.toggle('narration', false);
    this.textEl.className = 'dlg-text' + (kind === 'think' ? ' think' : '') +
      (kind === 'voice' ? ` voice voice-${c.style || 'plain'}` : '');
    if (c.manner) this.nameEl.textContent += ` (${c.manner})`;

    // 글자를 미리 다 깔아 두고(숨김) 하나씩 보이게 → 줄바꿈 위치가 도중에 바뀌지 않는다
    this.textEl.innerHTML = '';
    this.chars = [...c.text].map((t, i) => {
      const span = document.createElement('span');
      span.textContent = t;
      span.className = 'h';
      if (c.style === 'goldTremble') span.style.animationDelay = `${-(i * 97) % 600}ms`;
      this.textEl.append(span);
      return span;
    });
    this.keyHint();
    this.shown = 0;
    this.wait = 0;
    this.readTimer = 0;
    this.nextEl.classList.remove('on');
    return new Promise((resolve) => { this.pending = resolve; });
  }

  // 넘기기 안내: 게임을 처음 켠 뒤 대화창 대사 3개 동안만 화면 오른쪽 위 구석에
  keyHint() {
    if (!this.hintEl) return;
    let n = 0;
    try { n = +localStorage.getItem(KEY_HINT_STORE) || 0; } catch (e) { n = DialogueBox.hintCount || 0; }
    const on = n < KEY_HINT_LINES;
    this.hintEl.classList.toggle('show', on);
    if (!on) return;
    DialogueBox.hintCount = n + 1;
    try { localStorage.setItem(KEY_HINT_STORE, String(n + 1)); } catch (e) { /* 저장 못 하면 이번 실행 동안만 센다 */ }
  }

  bubbleLine(c, a) {
    this.hide();
    // 말풍선 대화 멈춤: 장면이 talkStop 을 켰을 때만 (P-5 마을. 연습장 튜토리얼처럼 계속 조작하는 장면은 아님)
    if (this.scene.story && this.scene.story.talkStop) this.scene.story.beginTalk(a);
    const ch = this.characters[c.speaker] || {};
    const name = c.cmd === 'think' ? `${ch.name || ''} · 속마음` : (ch.name || '');
    const T = TUNING.story;
    const ms = (T.autoAdvanceBase + c.text.length * T.autoAdvancePerChar) * 1000 + 600;
    const f = UI.bubble(() => [a.x, a.headY - 6], c.text, { name, ms: ms + 400 });
    if (c.cmd === 'think') f.el.classList.add('think');
    // 말풍선 왼쪽에 작은 초상 (표정이 보이게, 초상 1칸을 0.6배로)
    const fc = ch.sprite && Sprites.face(ch.sprite, c.face);
    const sh = fc && Sprites.sheet(fc.key);
    if (sh) {
      const k = 0.6;
      const face = document.createElement('b');
      face.className = 'bubble-face';
      Object.assign(face.style, { backgroundImage: `url(${SPRITE_DIR}${sh.file})`, width: sh.frameWidth * k + 'px', height: sh.frameHeight * k + 'px',
        backgroundSize: `${sh.frameWidth * sh.frames * k}px ${sh.frameHeight * k}px`, backgroundPosition: `${-fc.frame * sh.frameWidth * k}px 0` });
      f.el.querySelector('.bubble-box').prepend(face);
      f.el.classList.add('has-face');
    }
    this.bubble = f;
    this.chars = [];
    this.bubbleLeft = ms / 1000;
    return new Promise((resolve) => { this.pending = resolve; });
  }

  resolvePending() {
    if (this.bubble) { this.bubble.until = 0; this.bubble = null; }
    const p = this.pending;
    this.pending = null;
    if (p) p();
  }

  get typing() {
    return this.chars && this.shown < this.chars.length;
  }

  reveal(n) {
    while (this.shown < n) this.chars[this.shown].className = this.chars[this.shown++].className.replace('h', '').trim();
  }

  // 매 프레임 (컷신 엔진이 부른다). advance: 넘기기 입력
  update(dt, advance) {
    if (!this.active || !this.pending) return;
    if (this.bubble) {
      this.bubbleLeft -= dt;
      if (advance || this.bubbleLeft <= 0) this.resolvePending();
      return;
    }
    if (advance) {
      if (this.typing) {
        this.reveal(this.chars.length);
      } else {
        this.resolvePending();
        return;
      }
    }
    if (this.typing) {
      const D = TUNING.dialogue;
      this.wait -= dt;
      let n = this.shown;
      while (this.wait <= 0 && n < this.chars.length) {
        const ch = this.chars[n++].textContent;
        this.wait += 1 / D.charsPerSecond + ('.!?…,'.includes(ch) ? D.punctuationPause : 0);
      }
      this.reveal(n);
    } else if (this.controllable) {
      // 조작 가능 컷신: 다 읽을 시간이 지나면 자동으로 넘어간다
      this.readTimer += dt;
      if (this.readTimer > TUNING.story.autoAdvanceBase + this.chars.length * TUNING.story.autoAdvancePerChar) this.resolvePending();
    }
    this.nextEl.classList.toggle('on', !this.typing); // 다 나오면 ▼ 깜빡임
  }
}
