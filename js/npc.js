// 이야기 속 인물(NPC): 그림만 있고 판정은 없다. 대본의 gameplay 명령(js/gameplay.js)이 움직인다.
// look: 'haru' = 주인공 그림을 분홍빛으로 물들여 씀(하루는 아카네의 엄마) / 'silhouette' = 검은 실루엣 + 이름표
class Npc {
  constructor(scene, data) {
    this.scene = scene;
    this.id = data.id;
    this.name = data.name;
    this.look = data.look;
    this.data = data;
    this.x = data.x;
    this.y = data.y;
    this.facing = data.face || 1;
    this.pose = 'idle';
    this.visible = true;
    this.useSprite = data.look === 'haru' && Sprites.has(scene, 'player_idle');
    if (this.useSprite) {
      // 주인공 그림은 오른쪽을 보고 있다
      this.sprite = scene.add.sprite(this.x, this.y, 'player_idle', 0).setOrigin(0.5, 1).setDepth(8)
        .setTint(0xffc4d4).setScale(1.12);
      this.sprite.play('player_idle');
      // 아카네와 구분되게 분홍 윤곽 빛 (WebGL 일 때)
      if (this.sprite.preFX) this.sprite.preFX.addGlow(0xff9eb8, 2, 0, false, 0.1, 8);
    } else {
      const key = Npc.silhouetteTexture(scene, data);
      this.sprite = scene.add.image(this.x, this.y, key).setOrigin(0.5, 1).setDepth(8);
    }
    // 이름표 (HTML 글자, 머리 위를 따라다님)
    this.tag = UI.tag(() => [this.x, this.y - this.sprite.displayHeight - 8], this.name);
    this.sync();
  }

  // 실루엣 그림: 머리·몸통·소매. 키(tall)·아이(small)에 따라 크기만 다르다
  static silhouetteTexture(scene, d) {
    const key = `npc-sil-${d.small ? 's' : d.tall ? 't' : 'm'}`;
    if (scene.textures.exists(key)) return key;
    const h = d.small ? 54 : d.tall ? 92 : 80;
    const w = 44;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x0a0b16);
    const head = h * 0.14;
    g.fillCircle(w / 2, head + 2, head);
    g.fillRoundedRect(w / 2 - 13, head * 2, 26, h - head * 2 - 10, 6);
    g.fillRect(w / 2 - 11, h - 12, 8, 12).fillRect(w / 2 + 3, h - 12, 8, 12);
    g.lineStyle(2, 0xd9b25a, 0.55).strokeCircle(w / 2, head + 2, head);
    g.generateTexture(key, w, h);
    g.destroy();
    return key;
  }

  get groundY() {
    // 그 x 의 땅 높이 (담 위로 올라서기도 한다)
    let y = this.data.y;
    for (const r of LEVEL.ground) {
      if (this.x >= r.x && this.x <= r.x + r.w && r.y < y && r.y > this.data.y - 80) y = r.y;
    }
    return y;
  }

  sync() {
    const s = this.sprite;
    s.setPosition(Math.round(this.x), Math.round(this.y));
    s.setFlipX(this.useSprite ? this.facing < 0 : this.facing < 0);
    s.setVisible(this.visible);
    this.tag.el.style.display = this.visible && this.pose !== 'down' ? '' : 'none';
  }

  setPose(pose) {
    this.pose = pose;
    const s = this.sprite;
    s.setAngle(0).setScale(this.useSprite ? 1.12 : 1);
    if (this.useSprite) {
      if (pose === 'run') s.play('player_run', true);
      else if (pose === 'idle') s.play('player_idle', true);
      else if (pose === 'guard') { s.anims.stop(); s.setTexture('player_iaido_ready', 3); }
      else if (pose === 'slash') { s.anims.stop(); s.setTexture('player_iaido_slash', 3); }
      else if (pose === 'down') s.play('player_death');
    } else if (pose === 'kneel') {
      s.setScale(1, 0.7);
    } else if (pose === 'down') {
      s.setAngle(this.facing > 0 ? -90 : 90);
    }
    this.sync();
  }

  place(x, face) {
    this.x = x;
    this.y = this.groundY;
    if (face) this.facing = face;
    this.visible = true;
    this.setPose('idle');
  }

  face(dir) {
    this.facing = dir;
    this.sync();
  }

  hide() {
    this.visible = false;
    this.sync();
  }

  // x 까지 걸어간다. 도착하면 끝나는 Promise
  moveTo(x, speed = 150) {
    if (this.moveTween) this.moveTween.stop();
    const dist = Math.abs(x - this.x);
    if (dist < 2) return Promise.resolve();
    this.facing = Math.sign(x - this.x);
    this.setPose('run');
    return new Promise((resolve) => {
      this.moveTween = this.scene.tweens.add({
        targets: this, x, duration: (dist / speed) * 1000,
        onUpdate: () => {
          this.y += (this.groundY - this.y) * 0.4;
          this.sync();
        },
        onComplete: () => {
          this.moveTween = null;
          this.y = this.groundY;
          this.setPose('idle');
          resolve();
        },
      });
    });
  }

  // 제자리 깡충 (환호)
  hop(times = 2) {
    const s = this.sprite;
    this.scene.tweens.add({ targets: s, y: s.y - 14, duration: 140, yoyo: true, repeat: times - 1, ease: 'Sine.easeOut' });
  }

  destroy() {
    if (this.moveTween) this.moveTween.stop();
    this.sprite.destroy();
    this.tag.remove();
  }
}
