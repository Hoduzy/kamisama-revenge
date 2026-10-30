// 대화창 (HTML 레이어 #ui 안). 에도 시대풍: 짙은 남색 반투명 패널 + 얇은 금색 테두리 + 모서리 벚꽃,
// 패널 위 왼쪽 빨간 이름표, 패널 위로 크게 튀어나온 초상화(말하는 쪽 왼/오른쪽, 안 말하는 쪽은 어둡게).
// 넘기기: Space / J / Enter / 화면 탭. 건너뛰기: Esc.
// story.json 캐릭터 설정: side('left'|'right', 기본 right), sprite(도트 초상화 시트 + 표정), image, portrait(도형)
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
          <div class="dlg-hint">Space · J · 탭 넘기기 &nbsp;·&nbsp; Esc 건너뛰기</div>
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
    root.classList.remove('show', 'open');
  }

  // sceneData: story.json 의 scenes[id], characters: story.json 의 characters
  start(sceneData, characters, onDone) {
    this.lines = sceneData.lines || [];
    this.characters = characters || {};
    this.onDone = onDone;
    this.index = -1;
    this.sideSpeaker = { left: null, right: null };
    for (const p of Object.values(this.portraits)) {
      p.className = p.className.replace(/\b(speaking|filled)\b/g, '').trim();
      p.style.backgroundImage = '';
    }
    this.active = true;
    this.root.classList.add('open');
    requestAnimationFrame(() => this.root.classList.add('show')); // 아래에서 살짝 올라오며 나타남
    document.body.classList.add('in-dialogue');
    this.nextLine();
  }

  // 초상화 그림: 도트 시트(표정) → image → 도형으로 만든 텍스처
  portraitStyle(id, ch, face) {
    const tex = this.scene.textures;
    if (ch.sprite && tex.exists(ch.sprite.key)) {
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
    const key = 'portrait-' + id;
    if (!tex.exists(key)) return null;
    if (!this.dataUrls) this.dataUrls = {};
    if (!this.dataUrls[key]) this.dataUrls[key] = ch.image || tex.getBase64(key);
    return { boxed: true, backgroundImage: `url(${this.dataUrls[key]})`, backgroundSize: '100% 100%', backgroundPosition: '0 0', width: '200px', height: '200px' };
  }

  nextLine() {
    this.index++;
    if (this.index >= this.lines.length) {
      this.finish();
      return;
    }
    const line = this.lines[this.index];
    const ch = this.characters[line.speaker] || {};
    const narration = !line.speaker || line.speaker === 'narration';

    // 초상화: 말하는 사람 쪽에 놓고 밝게, 반대쪽은 어둡게
    const side = narration ? null : (ch.side === 'left' ? 'left' : 'right');
    if (side) {
      const el = this.portraits[side];
      const style = this.portraitStyle(line.speaker, ch, line.face);
      if (style) {
        const changed = this.sideSpeaker[side] !== line.speaker;
        const { boxed, ...css } = style;
        Object.assign(el.style, css);
        el.classList.add('filled');
        el.classList.toggle('boxed', !!boxed); // 아직 도트 그림이 없는 임시 초상화는 금색 액자에
        if (changed) {
          el.classList.remove('enter');
          void el.offsetWidth;
          el.classList.add('enter'); // 새 사람이면 옆에서 미끄러져 들어옴
        }
        this.sideSpeaker[side] = line.speaker;
      }
    }
    for (const [s, el] of Object.entries(this.portraits)) el.classList.toggle('speaking', s === side);

    this.nameEl.textContent = narration ? '' : (ch.name || line.speaker);
    this.nameEl.style.display = narration ? 'none' : '';
    this.root.classList.toggle('narration', narration);
    this.root.classList.toggle('speaker-right', side === 'right');

    // 글자를 미리 다 깔아 두고(숨김) 하나씩 보이게 → 줄바꿈 위치가 도중에 바뀌지 않는다
    this.textEl.innerHTML = '';
    this.chars = [...line.text].map((c) => {
      const span = document.createElement('span');
      span.textContent = c;
      span.className = 'h';
      this.textEl.append(span);
      return span;
    });
    this.full = line.text;
    this.shown = 0;
    this.wait = 0;
    this.nextEl.classList.remove('on');
  }

  get typing() {
    return this.shown < this.chars.length;
  }

  reveal(n) {
    while (this.shown < n) this.chars[this.shown++].className = '';
  }

  update(dt, advance, skip) {
    if (!this.active) return;
    if (skip) {
      this.finish();
      return;
    }
    if (advance) {
      if (this.typing) {
        this.reveal(this.chars.length);
      } else {
        this.nextLine();
        if (!this.active) return;
      }
    }

    if (this.typing) {
      const D = TUNING.dialogue;
      this.wait -= dt;
      let n = this.shown;
      while (this.wait <= 0 && n < this.chars.length) {
        const c = this.chars[n++].textContent;
        this.wait += 1 / D.charsPerSecond + ('.!?…,'.includes(c) ? D.punctuationPause : 0);
      }
      this.reveal(n);
    }
    this.nextEl.classList.toggle('on', !this.typing); // 다 나오면 ▼ 깜빡임
  }

  finish() {
    this.active = false;
    document.body.classList.remove('in-dialogue');
    this.root.classList.remove('show');
    setTimeout(() => { if (!this.active) this.root.classList.remove('open'); }, 250);
    const done = this.onDone;
    this.onDone = null;
    if (done) done();
  }
}
