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

    this.createTextures();
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

  createTextures() {
    if (this.textures.exists('petal')) return;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    // 흩날리는 꽃잎
    g.fillStyle(0xffffff).fillEllipse(6, 4, 12, 8);
    g.generateTexture('petal', 12, 8);
    // HUD용 벚꽃 아이콘 (켜짐/꺼짐)
    const flower = (key, fill, center) => {
      g.clear();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
        g.fillStyle(fill).fillEllipse(12 + Math.cos(a) * 6, 12 + Math.sin(a) * 6, 10, 10);
      }
      g.fillStyle(center).fillCircle(12, 12, 3);
      g.generateTexture(key, 24, 24);
    };
    flower('sakura-on', 0xff9eb8, 0xd6336c);
    flower('sakura-off', 0xc8c4bc, 0xaaa69e);
    g.destroy();
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
      'A/D 이동 · Space 점프 · J 공격 · K 대시 · U 대쉬베기 · I 발도 · R 재시작',
      { ...style, fontSize: '18px', color: '#555' }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);
    this.tweens.add({ targets: hint, alpha: 0, delay: 4500, duration: 800 });

    this.createSkillHud();

    this.bannerBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 520, 260, 0xffffff, 0.82)
      .setScrollFactor(0).setDepth(100).setVisible(false);
    this.banner = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, '',
      { ...style, fontSize: '48px', fontStyle: 'bold', color: '#111', align: 'center' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(101);
  }

  // 화면 하단: 스킬 쿨타임 2칸 + 벚꽃 스택 5칸
  createSkillHud() {
    const cx = GAME_WIDTH / 2;
    const y = GAME_HEIGHT - 40;
    const depth = 100;
    this.add.rectangle(cx, y, 330, 64, 0xffffff, 0.6).setScrollFactor(0).setDepth(depth);

    const makeIcon = (x, name, key) => {
      const icon = {};
      icon.bg = this.add.rectangle(x, y, 48, 48, 0x222222).setScrollFactor(0).setDepth(depth);
      icon.label = this.add.text(x, y + 2, name, { fontFamily: 'system-ui, sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#fff' })
        .setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);
      this.add.text(x - 21, y - 22, key, { fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: '#999' })
        .setScrollFactor(0).setDepth(depth + 3);
      // 쿨타임 동안 위에서부터 덮이는 막
      icon.shade = this.add.rectangle(x, y + 24, 48, 48, 0xffffff, 0.65).setOrigin(0.5, 1)
        .setScrollFactor(0).setDepth(depth + 2);
      icon.time = this.add.text(x, y, '', { fontFamily: 'system-ui, sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#111' })
        .setOrigin(0.5).setScrollFactor(0).setDepth(depth + 3);
      icon.border = this.add.rectangle(x, y, 52, 52).setStrokeStyle(3, 0xff7aa2).setScrollFactor(0)
        .setDepth(depth + 3).setVisible(false);
      return icon;
    };
    this.skillIcons = {
      slash: makeIcon(cx - 130, '베기', 'U'),
      iaido: makeIcon(cx - 74, '발도', 'I'),
    };

    this.sakuraIcons = [];
    for (let i = 0; i < TUNING.sakuraMax; i++) {
      this.sakuraIcons.push(this.add.image(cx - 20 + i * 30, y, 'sakura-off').setScrollFactor(0).setDepth(depth));
    }
    this.lastSakura = 0;

    this.touchSkillBtns = {
      slash: document.querySelector('.btn[data-action="skill1"]'),
      iaido: document.querySelector('.btn[data-action="skill2"]'),
    };
  }

  updateSkillIcon(icon, btn, remaining, total, active) {
    const frac = Phaser.Math.Clamp(remaining / total, 0, 1);
    icon.shade.setVisible(frac > 0);
    icon.shade.setSize(48, 48 * frac);
    icon.time.setText(frac > 0 ? remaining.toFixed(1) : '');
    icon.label.setVisible(frac <= 0);
    icon.border.setVisible(active);
    if (btn) {
      const cls = frac > 0 ? 'cooldown' : '';
      if (btn.dataset.cd !== cls) {
        btn.dataset.cd = cls;
        btn.classList.toggle('cooldown', frac > 0);
      }
    }
  }

  updateHud() {
    this.hpPips.forEach((pip, i) => pip.setFillStyle(i < this.player.hp ? COLORS.player : 0xbbbbbb));
    this.koText.setText('KO ' + this.kills);

    const sk = this.player.skills;
    this.updateSkillIcon(this.skillIcons.slash, this.touchSkillBtns.slash, sk.slashCooldown,
      TUNING.dashSlash.cooldown, sk.slashing);
    // 발도는 준비 중이면 테두리 강조
    this.updateSkillIcon(this.skillIcons.iaido, this.touchSkillBtns.iaido, sk.iaidoCooldown,
      TUNING.iaido.cooldown, sk.charging);

    if (sk.sakura !== this.lastSakura) {
      this.sakuraIcons.forEach((icon, i) => {
        const on = i < sk.sakura;
        icon.setTexture(on ? 'sakura-on' : 'sakura-off');
        // 새로 켜진 칸은 톡 튀게
        if (on && i >= this.lastSakura) {
          icon.setScale(1.6);
          this.tweens.add({ targets: icon, scale: 1, duration: 200, ease: 'Back.easeOut' });
        }
      });
      this.lastSakura = sk.sakura;
    }
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
    player.skills.checkSlashHits(this.enemies);

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
      e.hurt(player.facing, TUNING.attackDamage);
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
    const skills = player.skills;

    if (skills.slashInvuln) return; // 대쉬베기 중(+직후 잠깐) 무적

    if (skills.charging) {
      // 발도 준비 전반: 패링. 공격한 적이 피해를 받음
      if (skills.parrying) {
        if (enemy.parryImmune <= 0) skills.parry(enemy);
        return;
      }
      // 준비 후반: 맞으면 스킬이 끊기고 쿨타임 시작. 죽지는 않음
      if (player.hurt(eb.center.x, true)) {
        skills.interruptIaido();
        this.popText(pb.center.x, pb.top - 30, '끊김', '#555');
        this.cameras.main.shake(160, 0.008);
        this.doHitStop(0.08);
      }
      return;
    }

    // 위에서 밟기
    if (pb.velocity.y > 0 && pb.bottom - eb.top < 18) {
      enemy.hurt(Math.sign(eb.center.x - pb.center.x) || player.facing, TUNING.stompDamage);
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

  showDamage(x, y, amount, color = '#111', size = 20) {
    const t = this.add.text(x, y, String(amount), {
      fontFamily: 'system-ui, sans-serif', fontSize: size + 'px', fontStyle: 'bold', color,
      stroke: '#fff', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(20);
    this.tweens.add({ targets: t, y: y - 36, alpha: 0, duration: 650, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  popText(x, y, text, color) {
    const t = this.add.text(x, y, text, {
      fontFamily: 'system-ui, sans-serif', fontSize: '22px', fontStyle: 'bold', color,
      stroke: '#fff', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(20).setScale(0.6);
    this.tweens.add({ targets: t, scale: 1, y: y - 20, duration: 160, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: 450, duration: 250, onComplete: () => t.destroy() });
  }

  // 벚꽃잎이 사방으로 터졌다가 천천히 떨어진다
  spawnPetals(x, y, count, spread) {
    for (let i = 0; i < count; i++) {
      const p = this.add.image(x, y, 'petal').setDepth(13)
        .setTint(Phaser.Utils.Array.GetRandom(SAKURA_COLORS))
        .setAngle(Phaser.Math.Between(0, 360))
        .setScale(Phaser.Math.FloatBetween(0.7, 1.3));
      const angle = Math.random() * Math.PI * 2;
      const dist = Phaser.Math.Between(spread * 0.3, spread);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * dist + Phaser.Math.Between(-20, 20),
        y: y + Math.sin(angle) * dist * 0.6 + Phaser.Math.Between(30, 70),
        angle: p.angle + Phaser.Math.Between(-300, 300),
        alpha: 0,
        duration: Phaser.Math.Between(600, 1100),
        ease: 'Sine.easeOut',
        onComplete: () => p.destroy(),
      });
    }
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
