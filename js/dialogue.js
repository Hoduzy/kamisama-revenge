// 대화창 (HTML 레이어 #ui 안). 에도 시대풍: 짙은 남색 반투명 패널 + 얇은 금색 테두리 + 모서리 벚꽃,
// 패널 위 왼쪽 빨간 이름표, 패널 위로 크게 튀어나온 초상화(말하는 쪽 왼/오른쪽, 안 말하는 쪽은 어둡게).
// 한 줄씩 보여 주는 방식: open() → line(명령) 을 await → close(). 컷신 엔진(js/story-player.js)이 부른다.
//   say   : 초상화 + 이름표 + 대사
//   think : 아카네 속마음. 초상화 반투명, 글자 회색
//   voice : 초상화·이름표 없이 글자만. style pink(하루) / goldTremble(하쿠야, 떨리는 금색) / plain
// 넘기기: Space / J / Enter / 화면 탭, 길게 누르면 장면 전체 건너뛰기 (조작 가능 컷신은 Enter·탭, 또는 자동으로 넘어감).
// 인물 설정(data/story/characters.json): sprite(도트 초상화 시트 + 표정), image, color. 둘 다 없으면 실루엣(js/portraits.js)
const SAKURA_SVG = `<svg viewBox="-10 -10 20 20" aria-hidden="true">${[0, 72, 144, 216, 288]
  .map((a) => `<ellipse cx="0" cy="-5" rx="3.6" ry="5" transform="rotate(${a})"/>`).join('')}<circle r="2" class="c"/></svg>`;

class DialogueBox {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    let root = document.getElementById('dialogue');
    if (!root) {
      root = document.createElement('div');
      root.id = 'dialogue';
      root.innerHTML = `
        <div class="dlg-portrait left"></div>
        <div class="dlg-portrait right"></div>
        <div class="dlg-panel">
          ${['tl', 'tr', 'bl', 'br'].map((c) => `<span class="dlg-corner ${c}">${SAKURA_SVG}</span>`).join('')}
          <div class="dlg-name"></div>
          <div class="dlg-hint"></div>
          <div class="dlg-text"></div>
          <div class="dlg-next">▼</div>
        </div>`;
      document.getElementById('ui').append(root);
    }
    this.root = root;
    this.portraits = { left: root.querySelector('.dlg-portrait.left'), right: root.querySelector('.dlg-portrait.right') };
    this.nameEl = root.querySelector('.dlg-name');
    this.textEl = root.querySelector('.dlg-text');
    this.nextEl = root.querySelector('.dlg-next');
    this.hintEl = root.querySelector('.dlg-hint');
    root.classList.remove('show', 'open');
    this.pending = null;
  }

  // characters: data/story/characters.json. controllable: 플레이어가 움직이는 컷신(자동 넘김, Space/J 는 게임 조작)
  open(characters, { controllable = false } = {}) {
    this.characters = characters || {};
    this.controllable = controllable;
    this.sideSpeaker = { left: null, right: null };
    for (const p of Object.values(this.portraits)) {
      p.className = p.className.replace(/\b(speaking|filled|boxed|thinking|enter)\b/g, '').replace(/\s+/g, ' ').trim();
      p.style.backgroundImage = '';
    }
    this.textEl.innerHTML = '';
    this.nameEl.style.display = 'none';
    this.hintEl.textContent = controllable ? '자동으로 넘어감 · Enter·탭 넘기기 · 길게 누르면 건너뛰기' : 'Space·탭 넘기기 · 길게 누르면 건너뛰기';
    this.root.classList.toggle('controllable', controllable);
    this.active = true;
    this.root.classList.remove('show'); // 첫 대사가 나올 때 나타난다
    if (!controllable) document.body.classList.add('in-dialogue');
  }

  // 대사가 없는 연출(자막, CG, 페이드 …) 동안은 대화창을 내린다
  hide() {
    this.root.classList.remove('show');
  }

  show() {
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
    setTimeout(() => { if (!this.active) this.root.classList.remove('open'); }, 250);
  }

  // 초상화 그림: 도트 시트(표정) → image → 실루엣 + 이름 첫 글자(임시)
  portraitStyle(id, ch, face) {
    if (ch.sprite && this.scene.textures.exists(ch.sprite.key)) {
      const s = Sprites.sheet(ch.sprite.key);
      const frame = ch.sprite.faces[face] ?? ch.sprite.faces.neutral ?? 0;
      const k = 2.5; // 도트 1칸 = 2.5px
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
    return { boxed: true, backgroundImage: `url(${url})`, backgroundSize: '100% 100%', backgroundPosition: '0 0', width: '200px', height: '200px' };
  }

  // 한 줄 보여 주고, 넘길 때 끝나는 Promise
  line(c) {
    this.resolvePending();
    this.show();
    const ch = this.characters[c.speaker] || {};
    const kind = c.cmd; // say | think | voice
    const side = kind === 'voice' ? null : (c.side || (c.speaker === 'akane' ? 'left' : 'right'));
    const showPortrait = side && c.portrait !== false;

    if (showPortrait) {
      const el = this.portraits[side];
      const style = this.portraitStyle(c.speaker, ch, c.face);
      if (style) {
        const changed = this.sideSpeaker[side] !== c.speaker;
        const { boxed, ...css } = style;
        Object.assign(el.style, css);
        el.classList.add('filled');
        el.classList.toggle('boxed', !!boxed); // 아직 도트 그림이 없는 임시 초상화는 금색 액자에
        if (changed) {
          el.classList.remove('enter');
          void el.offsetWidth;
          el.classList.add('enter'); // 새 사람이면 옆에서 미끄러져 들어옴
        }
        this.sideSpeaker[side] = c.speaker;
      }
    }
    for (const [s, el] of Object.entries(this.portraits)) {
      el.classList.toggle('speaking', s === side && showPortrait);
      el.classList.toggle('thinking', s === side && kind === 'think');
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
    this.shown = 0;
    this.wait = 0;
    this.readTimer = 0;
    this.nextEl.classList.remove('on');
    return new Promise((resolve) => { this.pending = resolve; });
  }

  resolvePending() {
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
