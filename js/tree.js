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
      // 캐릭터(6~10)·인물(8)보다 뒤, 땅 타일(1)보다도 뒤
      this.sprite = scene.add.sprite(x, groundY, 'tree', 0).setOrigin(0.5, 1).setDepth(0.5);
      this.canopyY = groundY - Sprites.height('tree', 190) * 0.62; // 꽃이 모인 높이
      this.canopyW = 120;
      return;
    }

    const c = this.container = scene.add.container(x, groundY).setDepth(0.5);
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

  // 큰 벚나무 단계 (프롤로그): bare(앙상함) · bloom(만개) · burning(불타는) · burnt(검게 탄).
  // 그림: tree 시트 0 = 앙상함, 1 = 만개. 불타는 · 검게 탄 그림(tree_burning · tree_burnt)이 manifest 에 있으면 그 그림,
  // 없으면 만개 그림을 불빛 색으로 + 불티 / 앙상한 그림을 검게 물들여 대신한다
  // wipe: 초. 새 그림을 위에서 아래로 닦아내듯 덮어 바꾼다 (P-9 불이 꼭대기부터 번짐)
  setStage(stage, show = true, wipe = 0) {
    const s = this.sprite;
    this.stage = stage;
    if (!s) return;
    if (wipe > 0 && s.visible) {
      // 지금 그림을 복사해 두고 그 위를 새 그림이 위에서부터 덮는다: 새 그림을 바로 적용한 뒤 옛 그림 사본의 위쪽을 잘라 내려간다
      const old = this.scene.add.image(s.x, s.y, s.texture.key, s.frame.name).setOrigin(s.originX, s.originY)
        .setScale(s.scaleX, s.scaleY).setDepth(s.depth + 0.01).setFlipX(s.flipX);
      if (s.isTinted) old.setTint(s.tintTopLeft);
      const fh = old.frame.height;
      this.setStage(stage, show, 0);
      const o = { t: 0 };
      this.scene.tweens.add({ targets: o, t: 1, duration: wipe * 1000, ease: 'Sine.easeIn',
        onUpdate: () => old.setCrop(0, fh * o.t, old.frame.width, fh * (1 - o.t)),
        onComplete: () => old.destroy() });
      return;
    }
    if (show) s.setVisible(true);
    const sc = this.scene;
    if (this.fire) { this.fire.destroy(); this.fire = null; }
    // painted: 배경 그림(bg_pro_burning)에 이미 불타는 큰 나무가 그려져 있는 곳 → 나무 그림은 숨기고 불티만 (P-0 · P-11 광장)
    if (stage === 'painted') {
      s.setVisible(false);
      this.active = false;
      this.fire = sc.add.particles(this.x, this.canopyY, sc.textures.exists('cine-dot') ? 'cine-dot' : 'petal', {
        lifespan: 1600, frequency: 45, speedY: { min: -110, max: -40 }, speedX: { min: -30, max: 30 },
        tint: [0xffb040, 0xff6020, 0xffe090], alpha: { start: 1, end: 0 }, blendMode: 'ADD',
        emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-this.canopyW, -40, this.canopyW * 2, 120) },
      }).setDepth(2);
      sc.events.once('shutdown', () => { if (this.fire) this.fire.destroy(); });
      return;
    }
    const own = { burning: 'tree_burning', burnt: 'tree_charred', charred: 'tree_charred' }[stage];
    if (own && Sprites.has(sc, own)) {
      s.setTexture(own, 0).clearTint();
      // 불타는 그림에 이미 불길 · 연기가 그려져 있다 → 입자는 불티만 조금
    } else {
      // 불타는 단계 그림(tree_burning)이 없으면: 꽃이 타 버린 앙상한 가지를 그을린 색으로 + 가지 곳곳 불길 입자 (만개 그림에 붉은 필터를 씌우지 않는다)
      s.setTexture('tree', stage === 'bloom' ? 1 : 0);
      if (stage === 'burning') s.setTint(0x7a3424);
      else if (stage === 'burnt') s.setTint(0x2a2222);
      else s.clearTint();
    }
    this.active = stage === 'bloom'; // 꽃잎은 만개일 때만
    if (stage === 'burning' && !(own && Sprites.has(sc, own))) {
      // 도트 불꽃: 3px 네모가 커졌다 작아지며 올라감 (흐린 원은 도트 그림과 안 어울림)
      this.fire = sc.add.particles(this.x, this.canopyY, sc.textures.exists('cine-dot') ? 'cine-dot' : 'petal', {
        lifespan: 1000, frequency: 10, speedY: { min: -110, max: -40 }, speedX: { min: -20, max: 20 },
        scale: { start: 2, end: 0.7 }, tint: [0xffb040, 0xff6020, 0xffe090, 0xff4010], alpha: { start: 1, end: 0 }, blendMode: 'ADD',
        emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-this.canopyW, -70, this.canopyW * 2, 170) },
      }).setDepth(2);
      this.fire.noLight = true;
      sc.events.once('shutdown', () => { if (this.fire) this.fire.destroy(); });
    }
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
    if (!this.noLabel) scene.popText(this.x, this.y - Sprites.height('tree', 150) - 16, '벚꽃나무', '#ff8fb1'); // 장식 나무는 체크포인트가 아니라 글자 없음
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
