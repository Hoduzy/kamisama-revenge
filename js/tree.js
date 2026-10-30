// 벚꽃나무 = 체크포인트. 가까이 가면 꽃잎이 확 퍼지며 만개한다.
// 마지막으로 만개시킨 나무에서 부활한다.
// 스프라이트 tree: 0번 앙상함 → 1번 만개. 없으면 도형으로 그린다.
class CherryTree {
  constructor(scene, x, groundY) {
    this.scene = scene;
    this.x = x;
    this.y = groundY;
    this.active = false;
    this.petalTimer = Math.random();

    if (Sprites.has(scene, 'tree')) {
      this.sprite = scene.add.sprite(x, groundY, 'tree', 0).setOrigin(0.5, 1).setDepth(2);
      this.canopyY = groundY - Sprites.height('tree', 190) * 0.62; // 꽃이 모인 높이
      this.canopyW = 120;
      return;
    }

    const c = this.container = scene.add.container(x, groundY).setDepth(2);
    const bark = 0x4a3b35;
    c.add(scene.add.rectangle(0, -45, 14, 90, bark));
    c.add(scene.add.rectangle(-16, -92, 6, 46, bark).setAngle(-38));
    c.add(scene.add.rectangle(17, -86, 6, 40, bark).setAngle(42));
    c.add(scene.add.rectangle(2, -104, 5, 30, bark).setAngle(8));

    // 앙상한 상태의 꽃봉오리
    this.buds = scene.add.container(0, 0);
    for (const [bx, by] of [[-30, -108], [31, -100], [5, -120], [-12, -96], [18, -114]]) {
      this.buds.add(scene.add.circle(bx, by, 3, 0xe6cfd5));
    }
    c.add(this.buds);

    // 만개 상태의 꽃 덩어리
    this.canopy = scene.add.container(0, -104).setScale(0);
    const blobs = [
      [-36, 6, 26], [0, -14, 32], [34, 2, 26], [-18, 22, 22], [20, 22, 24],
      [-50, 24, 16], [50, 22, 16], [0, 12, 28], [-20, -20, 20], [22, -18, 20],
    ];
    blobs.forEach(([bx, by, r], i) => {
      this.canopy.add(scene.add.circle(bx, by, r, SAKURA_COLORS[i % SAKURA_COLORS.length]));
    });
    c.add(this.canopy);
    this.canopyY = groundY - 104;
    this.canopyW = 50;
  }

  // 플레이어가 근처에 있는지
  isNear(body) {
    return Math.abs(body.center.x - this.x) < TUNING.treeActivateRadius && Math.abs(body.bottom - this.y) < 140;
  }

  bloom(withFx = true) {
    if (this.active) return;
    this.active = true;
    const scene = this.scene;
    if (this.sprite) {
      this.sprite.setFrame(1);
    } else if (!withFx) {
      this.canopy.setScale(1);
      this.buds.setVisible(false);
    } else {
      scene.tweens.add({ targets: this.canopy, scale: 1, duration: 520, ease: 'Back.easeOut' });
      scene.tweens.add({ targets: this.buds, alpha: 0, duration: 200 });
    }
    if (!withFx) return;

    // 벚꽃 폭발 이펙트 + 꽃잎(effects 의 꽃잎 4종)이 확 퍼진다
    for (const [dx, dy] of [[0, 0], [-this.canopyW * 0.45, 12], [this.canopyW * 0.45, 8]]) {
      Sprites.fx(scene, 'fx_sakura_burst', this.x + dx, this.canopyY + dy, { depth: 13, scale: 2 });
    }
    scene.spawnPetals(this.x, this.canopyY, 45, 170);
    scene.time.delayedCall(90, () => scene.spawnPetals(this.x, this.canopyY, 25, 110));
    const ring = scene.add.circle(this.x, this.canopyY, 30).setStrokeStyle(4, 0xff9eb8).setDepth(12);
    scene.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 450, onComplete: () => ring.destroy() });
    scene.popText(this.x, this.y - Sprites.height('tree', 150) - 16, '벚꽃나무', '#ff8fb1');
    scene.cameras.main.shake(120, 0.004);
  }

  // 만개한 나무에서 꽃잎이 천천히 떨어진다 (화면 근처일 때만)
  update(dt) {
    if (!this.active) return;
    const view = this.scene.cameras.main.worldView;
    if (this.x < view.x - 100 || this.x > view.right + 100) return;
    this.petalTimer -= dt;
    if (this.petalTimer > 0) return;
    this.petalTimer = 0.18 + Math.random() * 0.2;

    const scene = this.scene;
    const w = this.canopyW;
    const p = Sprites.petal(scene, this.x + Phaser.Math.Between(-w, w), this.canopyY + Phaser.Math.Between(-30, 30))
      .setDepth(3).setAngle(Phaser.Math.Between(0, 360));
    scene.tweens.add({
      targets: p,
      x: p.x + Phaser.Math.Between(-60, 30),
      y: this.y - Phaser.Math.Between(0, 10),
      angle: p.angle + Phaser.Math.Between(-240, 240),
      alpha: 0,
      duration: Phaser.Math.Between(1600, 2400),
      ease: 'Sine.easeIn',
      onComplete: () => p.destroy(),
    });
  }
}
