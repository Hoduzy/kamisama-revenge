class GameScene extends Phaser.Scene {
  constructor() {
    super('game');
  }

  create() {
    const L = LEVEL;
    this.physics.world.setBounds(0, 0, L.width, L.height + 400);
    this.cameras.main.setBackgroundColor(COLORS.background);
    this.cameras.main.setBounds(0, 0, L.width, L.height);

    this.kills = 0;
    this.hitStopTimer = 0;
    this.cleared = false;
    this.gameOver = false;
    this.checkpoint = L.checkpoints[0];

    this.createBackground();

    // 땅 (사방 충돌)
    this.ground = this.physics.add.staticGroup();
    for (const r of L.ground) {
      this.ground.add(this.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, COLORS.ground));
    }

    // 얇은 발판 (위에서만 충돌)
    this.platforms = this.physics.add.staticGroup();
    for (const r of L.platforms) {
      const rect = this.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, COLORS.platform);
      this.platforms.add(rect);
      rect.body.checkCollision.down = false;
      rect.body.checkCollision.left = false;
      rect.body.checkCollision.right = false;
    }

    // 골
    const g = L.goal;
    this.add.rectangle(g.x, g.y - 70, 6, 140, 0x444444);
    this.add.rectangle(g.x + 22, g.y - 125, 40, 26, 0x444444);
    this.goalZone = new Phaser.Geom.Rectangle(g.x - 30, g.y - 160, 60, 160);

    this.controls = new Controls(this);
    this.player = new Player(this, L.spawn.x, L.spawn.y);

    this.enemies = [];
    this.enemyGroup = this.physics.add.group();
    for (const data of L.enemies) {
      const e = new Enemy(this, data);
      this.enemyGroup.add(e.obj);
      e.body.setMaxVelocity(2000, TUNING.maxFallSpeed); // 그룹 기본값 덮어쓰기
      this.enemies.push(e);
    }

    this.physics.add.collider(this.player.obj, this.ground);
    this.physics.add.collider(this.player.obj, this.platforms);
    this.physics.add.collider(this.enemyGroup, this.ground);
    this.physics.add.collider(this.enemyGroup, this.platforms);
    this.physics.add.overlap(this.player.obj, this.enemyGroup, (p, eObj) => this.onPlayerTouchEnemy(eObj.enemy));

    const cam = this.cameras.main;
    cam.startFollow(this.player.obj, true, 0.14, 0.12);
    cam.setDeadzone(60, 90);
    this.lookAhead = 0;

    this.createHud();

    this.input.keyboard.on('keydown-R', () => this.scene.restart());
    const sync = () => this.player.syncVisual();
    this.events.on('postupdate', sync);
    this.events.once('shutdown', () => {
      this.events.off('postupdate', sync);
      this.controls.destroy();
    });
  }

  createBackground() {
    const L = LEVEL;
    // 먼 산 / 가까운 건물 느낌의 사각형 (패럴랙스)
    const layers = [
      { factor: 0.25, color: 0xe4e0d8, minH: 120, maxH: 260, step: 180 },
      { factor: 0.5, color: 0xdad6cd, minH: 60, maxH: 180, step: 140 },
    ];
    for (const layer of layers) {
      const span = L.width * layer.factor + GAME_WIDTH + 200;
      let i = 0;
      for (let x = -100; x < span; x += layer.step) {
        // 결정적인 의사 난수
        const n = Math.abs(Math.sin(i * 12.9898 + layer.factor * 78.233) * 43758.5453) % 1;
        const h = layer.minH + n * (layer.maxH - layer.minH);
        const w = layer.step * (0.6 + n * 0.5);
        this.add.rectangle(x, L.height - 100, w, h * 2, layer.color)
          .setOrigin(0, 0.5).setScrollFactor(layer.factor, 1).setDepth(-10 + layer.factor);
        i++;
      }
    }
  }

  createHud() {
    this.hpPips = [];
    for (let i = 0; i < TUNING.maxHp; i++) {
      this.hpPips.push(this.add.rectangle(24 + i * 26, 24, 18, 18, COLORS.player)
        .setOrigin(0, 0).setScrollFactor(0).setDepth(100));
    }
    const style = { fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '20px', color: '#222' };
    this.koText = this.add.text(GAME_WIDTH - 24, 22, 'KO 0', style).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
    const hint = this.add.text(GAME_WIDTH / 2, 70,
      'A/D 이동 · Space 점프 · J 공격 · K 대시 · R 재시작',
      { ...style, fontSize: '18px', color: '#555' }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);
    this.tweens.add({ targets: hint, alpha: 0, delay: 4500, duration: 800 });

    this.bannerBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 520, 260, 0xffffff, 0.82)
      .setScrollFactor(0).setDepth(100).setVisible(false);
    this.banner = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, '',
      { ...style, fontSize: '48px', fontStyle: 'bold', color: '#111', align: 'center' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(101);
  }

  updateHud() {
    this.hpPips.forEach((pip, i) => pip.setFillStyle(i < this.player.hp ? COLORS.player : 0xbbbbbb));
    this.koText.setText('KO ' + this.kills);
  }

  update(time, delta) {
    const dt = Math.min(delta / 1000, 1 / 30);

    // 히트 스톱: 물리와 로직을 잠깐 멈춤 (입력 래치는 유지됨)
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      if (this.hitStopTimer > 0) return;
      this.physics.world.resume();
    }

    this.controls.update();

    if (this.cleared || this.gameOver) {
      const c = this.controls.state;
      if (this.canRestart && (c.jump.pressed || c.attack.pressed)) this.scene.restart();
      return;
    }

    const player = this.player;
    player.update(dt, this.controls);
    for (const e of this.enemies) e.update(dt, player);

    this.checkAttackHits();

    // 체크포인트
    for (const cp of LEVEL.checkpoints) {
      if (player.body.center.x >= cp.x && cp.x > this.checkpoint.x) this.checkpoint = cp;
    }

    // 낙사
    if (player.body.top > LEVEL.height + 60) {
      player.hp -= 1;
      this.cameras.main.shake(150, 0.006);
      if (player.hp <= 0) {
        this.triggerGameOver();
      } else {
        player.respawn(this.checkpoint.x, this.checkpoint.y);
      }
    }

    // 골
    if (Phaser.Geom.Rectangle.Overlaps(this.goalZone, this.bodyRect(player.body))) this.triggerClear();

    // 카메라 룩어헤드: 바라보는 방향을 더 보여줌
    this.lookAhead += (-player.facing * 90 - this.lookAhead) * Math.min(1, dt * 3);
    this.cameras.main.setFollowOffset(this.lookAhead, 40);

    this.updateHud();
  }

  bodyRect(body) {
    return new Phaser.Geom.Rectangle(body.x, body.y, body.width, body.height);
  }

  checkAttackHits() {
    const player = this.player;
    const rect = player.getAttackRect();
    if (!rect) return;
    for (const e of this.enemies) {
      if (e.dead || player.attackHits.has(e)) continue;
      if (!Phaser.Geom.Rectangle.Overlaps(rect, this.bodyRect(e.body))) continue;
      player.attackHits.add(e);
      e.hurt(player.facing, 1);
      this.spawnBurst(e.body.center.x, e.body.center.y, 0x111111, 4);
      if (!player.grounded && player.body.velocity.y > -TUNING.airHitBounce) {
        player.body.setVelocityY(-TUNING.airHitBounce);
      }
      this.doHitStop(TUNING.hitStop);
      this.cameras.main.shake(80, 0.004);
    }
  }

  onPlayerTouchEnemy(enemy) {
    const player = this.player;
    if (!enemy || enemy.dead || player.dead) return;
    const pb = player.body;
    const eb = enemy.body;

    // 위에서 밟기
    if (pb.velocity.y > 0 && pb.bottom - eb.top < 18) {
      enemy.hurt(Math.sign(eb.center.x - pb.center.x) || player.facing, 2);
      player.bounce(TUNING.stompBounce);
      this.doHitStop(TUNING.hitStop);
      this.cameras.main.shake(80, 0.004);
      return;
    }

    if (player.dashing) return; // 대시 중엔 몸통 무적
    if (player.hurt(eb.center.x)) {
      this.cameras.main.shake(160, 0.008);
      this.doHitStop(0.08);
      if (player.hp <= 0) this.triggerGameOver();
    }
  }

  onEnemyKilled(enemy, byPlayer) {
    if (byPlayer) this.kills += 1;
  }

  doHitStop(seconds) {
    this.hitStopTimer = Math.max(this.hitStopTimer, seconds);
    this.physics.world.pause();
  }

  triggerClear() {
    this.cleared = true;
    this.physics.world.pause();
    this.banner.setText('CLEAR!\nKO ' + this.kills + '\n\n점프 / 공격으로 다시 시작');
    this.banner.setFontSize(40);
    this.allowRestartSoon();
  }

  triggerGameOver() {
    this.gameOver = true;
    this.player.dead = true;
    this.player.hp = 0;
    this.updateHud();
    this.physics.world.pause();
    this.cameras.main.shake(250, 0.01);
    this.banner.setText('GAME OVER\n\n점프 / 공격으로 다시 시작');
    this.banner.setFontSize(40);
    this.allowRestartSoon();
  }

  allowRestartSoon() {
    this.bannerBg.setVisible(true);
    this.canRestart = false;
    this.time.delayedCall(500, () => { this.canRestart = true; });
  }

  spawnDust(x, y, count) {
    for (let i = 0; i < count; i++) {
      const d = this.add.rectangle(x, y - 2, 6, 6, 0x999999).setDepth(8);
      this.tweens.add({
        targets: d,
        x: x + Phaser.Math.Between(-30, 30),
        y: y - Phaser.Math.Between(4, 18),
        alpha: 0,
        scale: 0.3,
        duration: Phaser.Math.Between(180, 300),
        onComplete: () => d.destroy(),
      });
    }
  }

  spawnBurst(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      const s = Phaser.Math.Between(4, 10);
      const p = this.add.rectangle(x, y, s, s, color).setDepth(12);
      const angle = Math.random() * Math.PI * 2;
      const dist = Phaser.Math.Between(20, 70);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        angle: Phaser.Math.Between(-180, 180),
        duration: Phaser.Math.Between(220, 420),
        ease: 'Cubic.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }
}
