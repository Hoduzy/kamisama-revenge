// 벚꽃나무 = 체크포인트. 가까이 가면 꽃잎이 확 퍼지며 만개한다.
// 마지막으로 만개시킨 나무에서 부활한다.
class CherryTree {
  constructor(scene, x, groundY) {
    this.scene = scene;
    this.x = x;
    this.y = groundY;
    this.active = false;
    this.petalTimer = Math.random();

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
  }

  // 플레이어가 근처에 있는지
  isNear(body) {
    return Math.abs(body.center.x - this.x) < TUNING.treeActivateRadius && Math.abs(body.bottom - this.y) < 140;
  }

  bloom(withFx = true) {
    if (this.active) return;
    this.active = true;
    const scene = this.scene;
    if (!withFx) {
      this.canopy.setScale(1);
      this.buds.setVisible(false);
      return;
    }
    scene.tweens.add({ targets: this.canopy, scale: 1, duration: 520, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: this.buds, alpha: 0, duration: 200 });
    scene.spawnPetals(this.x, this.y - 104, 45, 170);
    scene.time.delayedCall(90, () => scene.spawnPetals(this.x, this.y - 104, 25, 110));
    const ring = scene.add.circle(this.x, this.y - 100, 30).setStrokeStyle(4, 0xff9eb8).setDepth(12);
    scene.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 450, onComplete: () => ring.destroy() });
    scene.popText(this.x, this.y - 180, '벚꽃나무', '#d6336c');
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
    const p = scene.add.image(this.x + Phaser.Math.Between(-50, 50), this.y - 104 + Phaser.Math.Between(-20, 20), 'petal')
      .setTint(Phaser.Utils.Array.GetRandom(SAKURA_COLORS)).setDepth(3).setAngle(Phaser.Math.Between(0, 360));
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
