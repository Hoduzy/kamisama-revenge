// 이야기 속 인물(NPC): 그림만 있고 판정은 없다. 대본의 gameplay 명령(js/gameplay.js)이 움직인다.
// look: 'haru' / 'soichiro' = 프롤로그 인물 시트 (tools/process_prologue.py)
//       'villager' = 마을 사람 시트(data.sheet, 색 변형 _v1~_v3 포함). 춤(dance) · 도망(flee)
//       'silhouette' = 그림이 없을 때 검은 실루엣 + 이름표
// 자세(pose) → 애니메이션(또는 [시트, 칸]). run 이 없으면 idle 을 재생한 채로 미끄러진다
const NPC_POSES = {
  haru: { idle: 'haru_idle', run: 'haru_idle', guard: ['haru_attack', 0], slash: ['haru_attack', 3],
    attack: 'haru_attack', down: 'haru_death', reach: 'haru_reach' },
  soichiro: { idle: ['soichiro_give', 0], run: ['soichiro_give', 0], forge: 'soichiro_forge', give: 'soichiro_give',
    guard: 'soichiro_guard', attack: 'soichiro_attack', kneel: 'soichiro_kneel', down: 'soichiro_kneel' },
};

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
    if (data.look === 'villager' && Sprites.has(scene, data.sheet)) {
      this.poses = { idle: `${data.sheet}_dance`, dance: `${data.sheet}_dance`, run: `${data.sheet}_flee`, flee: `${data.sheet}_flee` };
    } else if (NPC_POSES[data.look] && Sprites.has(scene, [].concat(NPC_POSES[data.look].idle)[0])) {
      this.poses = NPC_POSES[data.look];
    }
    if (this.poses) {
      const first = this.poses.idle;
      const key = Array.isArray(first) ? first[0] : first;
      const tex = scene.anims.exists(key) ? scene.anims.get(key).frames[0].textureKey : key;
      this.sheetFacing = (Sprites.sheet(tex) || {}).facing || 'right';
      this.sprite = scene.add.sprite(this.x, this.y, tex, 0).setOrigin(0.5, 1).setDepth(8);
      // 축제 사람들은 같은 춤을 같은 박자로 추지 않게 시작 칸을 흩뜨린다
      this.applyPose('idle', true);
    } else {
      const key = Npc.silhouetteTexture(scene, data);
      this.sprite = scene.add.image(this.x, this.y, key).setOrigin(0.5, 1).setDepth(8);
    }
    // 이름표 (HTML 글자, 머리 위를 따라다님). 마을 사람은 이름표 없음
    this.tag = UI.tag(() => [this.x, this.y - this.sprite.displayHeight - 8], data.look === 'villager' ? '' : this.name);
    this.sync();
  }

  // 자세 → 그림. 애니메이션 이름이면 재생, [시트, 칸] 이면 멈춘 그림
  applyPose(pose, randomStart = false) {
    const p = this.poses[pose] || this.poses.idle;
    const s = this.sprite;
    if (Array.isArray(p)) {
      s.anims.stop();
      s.setTexture(p[0], p[1]);
    } else if (this.scene.anims.exists(p)) {
      const anim = this.scene.anims.get(p);
      s.play({ key: p, startFrame: randomStart ? Math.floor(Math.random() * anim.frames.length) : 0 }, true);
    }
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
    // 그림이 바라보는 쪽(sheetFacing)과 다르면 뒤집는다
    // 지금 보이는 시트가 그려진 방향(manifest 의 facing)과 가려는 방향이 다르면 뒤집는다
    const drawn = this.poses ? ((Sprites.sheet(s.texture.key) || {}).facing || this.sheetFacing) : 'right';
    s.setFlipX((this.facing < 0) === (drawn === 'right'));
    s.setVisible(this.visible);
    this.tag.el.style.display = this.visible && this.name && this.data.look !== 'villager' && this.pose !== 'down' ? '' : 'none';
  }

  setPose(pose) {
    this.pose = pose;
    const s = this.sprite;
    s.setAngle(0).setScale(1);
    if (this.poses) {
      this.applyPose(pose);
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

  // 축제 → 불: 도망치는 그림으로 화면 밖까지 달려가 사라진다
  flee(dir = this.data.flee || -1, skip = false) {
    if (skip || !this.visible) return this.hide();
    const target = this.x + dir * 700;
    this.moveTo(target, 260 + Math.random() * 80).then(() => this.hide());
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
