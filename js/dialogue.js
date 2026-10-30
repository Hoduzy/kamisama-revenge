// 화면 아래 대화창. 왼쪽 초상화, 이름, 한 글자씩 나오는 대사.
// 넘기기: Space / J / Enter / 화면 탭. 건너뛰기: Esc.
class DialogueBox {
  constructor(scene) {
    this.scene = scene;
    this.active = false;

    const font = 'system-ui, -apple-system, sans-serif';
    const BOX_X = 30;
    const BOX_Y = 396;
    this.textX = 200;      // 초상화가 있을 때 대사 시작 위치
    this.narrationX = 64;  // 내레이션(초상화 없음)

    const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.28).setOrigin(0);
    const box = scene.add.rectangle(BOX_X, BOX_Y, 900, 128, 0x141214, 0.92).setOrigin(0)
      .setStrokeStyle(2, 0xff9eb8, 0.7);
    this.portraitFrame = scene.add.rectangle(44, 370, 136, 136, 0x000000).setOrigin(0).setStrokeStyle(3, 0xff9eb8);
    this.portrait = scene.add.image(48, 374, '__DEFAULT').setOrigin(0);
    this.name = scene.add.text(this.textX, 406, '', { fontFamily: font, fontSize: '20px', fontStyle: 'bold', color: '#fff' });
    this.text = scene.add.text(this.textX, 436, '', {
      fontFamily: font, fontSize: '21px', color: '#f2f2f2', lineSpacing: 6,
      wordWrap: { width: 700, useAdvancedWrap: true },
    });
    this.next = scene.add.text(904, 496, '▼', { fontFamily: font, fontSize: '16px', color: '#ff9eb8' });
    const hint = scene.add.text(922, 400, 'Space·J·탭 넘기기  ·  Esc 건너뛰기', { fontFamily: font, fontSize: '12px', color: '#8a8a8a' })
      .setOrigin(1, 0);

    this.root = scene.add.container(0, 0, [dim, box, this.portraitFrame, this.portrait, this.name, this.text, this.next, hint])
      .setScrollFactor(0).setDepth(200).setVisible(false);
  }

  // scene: story.json 의 scenes[id], characters: story.json 의 characters
  start(sceneData, characters, onDone) {
    this.lines = sceneData.lines || [];
    this.characters = characters || {};
    this.onDone = onDone;
    this.index = -1;
    this.lastSpeaker = null;
    this.active = true;
    this.root.setVisible(true);
    this.root.setAlpha(0);
    this.scene.tweens.add({ targets: this.root, alpha: 1, duration: 150 });
    document.body.classList.add('in-dialogue');
    this.nextLine();
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
    const portraitKey = 'portrait-' + line.speaker;
    const hasPortrait = !narration && this.scene.textures.exists(portraitKey);

    this.portraitFrame.setVisible(hasPortrait);
    this.portrait.setVisible(hasPortrait);
    if (hasPortrait) {
      this.portrait.setTexture(portraitKey).setDisplaySize(PORTRAIT_SIZE, PORTRAIT_SIZE);
      if (line.speaker !== this.lastSpeaker) {
        // 말하는 사람이 바뀌면 초상화가 살짝 미끄러져 들어온다
        this.portrait.setAlpha(0).setX(30);
        this.scene.tweens.add({ targets: this.portrait, alpha: 1, x: 48, duration: 160, ease: 'Cubic.easeOut' });
      }
    }
    this.lastSpeaker = line.speaker;

    const x = hasPortrait ? this.textX : this.narrationX;
    this.name.setX(x).setText(narration ? '' : (ch.name || line.speaker)).setColor(ch.color || '#ffffff');
    this.text.setX(x).setY(narration ? 420 : 436)
      .setColor(narration ? '#cfcfcf' : '#f2f2f2')
      .setFontStyle(narration ? 'italic' : '');
    this.text.setWordWrapWidth(hasPortrait ? 700 : 840, true);

    // 줄바꿈을 미리 계산해 두어야 글자가 나오는 도중 단어가 다음 줄로 튀지 않는다
    this.full = this.text.getWrappedText(line.text).join('\n');
    this.shown = 0;
    this.wait = 0;
    this.text.setText('');
  }

  get typing() {
    return this.shown < this.full.length;
  }

  update(dt, advance, skip) {
    if (!this.active) return;
    if (skip) {
      this.finish();
      return;
    }
    if (advance) {
      if (this.typing) {
        this.shown = this.full.length;
        this.text.setText(this.full);
      } else {
        this.nextLine();
        if (!this.active) return;
      }
    }

    if (this.typing) {
      const D = TUNING.dialogue;
      this.wait -= dt;
      while (this.wait <= 0 && this.typing) {
        this.shown++;
        const c = this.full[this.shown - 1];
        this.wait += 1 / D.charsPerSecond + ('.!?…,'.includes(c) ? D.punctuationPause : 0);
      }
      this.text.setText(this.full.slice(0, this.shown));
    }
    this.next.setVisible(!this.typing && Math.floor(this.scene.time.now / 350) % 2 === 0);
  }

  finish() {
    this.active = false;
    document.body.classList.remove('in-dialogue');
    this.scene.tweens.add({ targets: this.root, alpha: 0, duration: 150, onComplete: () => this.root.setVisible(false) });
    const done = this.onDone;
    this.onDone = null;
    if (done) done();
  }
}
