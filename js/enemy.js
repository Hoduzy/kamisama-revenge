// 적. 몸통 판정 사각형(보이지 않음) + 스프라이트(왼쪽을 보고 그려져 있어 오른쪽은 flipX).
// 스프라이트 프레임: 0 대기, 1 공격 준비(닌자는 투척), 2 공격, 3 사망. 보스는 1장.
// swordsman(근접 검사): 플레이어를 쫓아와 0.4초 빨간 예고 후 앞을 벤다.
// thrower(투척병): 거리를 두고 수리검을 던진다. 가까이 오면 뒤로 물러난다.
// dummy(허수아비): 프롤로그 연습장. 움직이지 않고 대쉬베기로만 쓰러진다.
// trainer(하루, 패링 연습): 근접 검사 AI 를 천천히. 피해를 받지 않고 그림은 NPC(하루)가 대신 보여 준다.
// barrier = true 면 금빛 막에 공격이 튕긴다 (프롤로그 하쿠야 패배 이벤트).
// 몸끼리 부딪히는 것만으로는 피해가 없다. 검과 수리검만 위험하다.
class Enemy {
  constructor(scene, data) {
    this.scene = scene;
    this.type = data.type;
    this.cfg = TUNING[data.type];
    this.minX = data.minX;
    this.maxX = data.maxX;
    this.w = this.cfg.body.width;
    this.h = this.cfg.body.height;
    this.dormant = !!data.dormant; // true 면 깨어날 때까지 가만히 있음
    this.group = data.group || null; // gameplay 'spawn' 으로 나타나는 무리
    this.barrier = false;

    // data.y 는 발을 딛는 바닥 높이
    this.obj = scene.add.rectangle(data.x, data.y - this.h / 2 - 1, this.w, this.h, COLORS.enemy);
    this.obj.enemy = this;
    scene.physics.add.existing(this.obj);
    this.body = this.obj.body;

    this.sheet = { swordsman: 'enemy_sword', thrower: 'enemy_ninja', boss: 'boss', dummy: 'scarecrow' }[data.type];
    this.sprite = null;
    if (data.type === 'trainer') {
      this.obj.setFillStyle(COLORS.enemy, 0); // 그림은 NPC 가 보여 준다
    } else if (data.type === 'dummy') {
      this.obj.setFillStyle(COLORS.enemy, 0);
      this.sprite = scene.add.image(data.x, data.y, 'scarecrow').setOrigin(0.5, 1).setDepth(6);
    } else if (Sprites.has(scene, this.sheet)) {
      this.obj.setFillStyle(COLORS.enemy, 0); // 판정 사각형은 숨기고 그림만 보인다
      this.sprite = scene.add.sprite(data.x, data.y, this.sheet, 0).setOrigin(0.5, 1).setDepth(6);
    }
    this.artHeight = data.type === 'dummy' ? 74 : Sprites.height(this.sheet, this.h); // 머리 위 '!' 위치용
    this.throwPose = 0; // 닌자: 던진 직후 투척 자세 유지 시간

    this.hp = this.cfg.hp;
    this.facing = Math.random() < 0.5 ? -1 : 1;
    this.state = data.type === 'trainer' ? 'chase' : 'patrol';
    this.stateTimer = 0;
    this.cooldown = 0.5 + Math.random() * 0.5;
    this.stun = 0;
    this.flash = 0;
    this.parryImmune = 0; // 한 번 패링당한 뒤 같은 공격으로 연속 패링되지 않게
    this.throwTimer = this.cfg.throwCooldown || 0;
    this.dead = false;

    // 예고 표시
    this.telegraph = scene.add.rectangle(0, 0, 10, 10, 0xff1f1f, 0.3)
      .setStrokeStyle(2, 0xff1f1f).setDepth(7).setVisible(false);
    this.alert = scene.add.text(0, 0, '!', {
      fontFamily: 'system-ui, sans-serif', fontSize: '26px', fontStyle: 'bold', color: '#ff1f1f',
      stroke: '#fff', strokeThickness: 4,
    }).setOrigin(0.5, 1).setDepth(15).setVisible(false);
    // 닌자: 던지기 직전 머리 위 반짝임
    this.glint = data.type === 'thrower' ? scene.add.image(0, 0, 'glint').setDepth(16).setVisible(false) : null;
  }

  get grounded() {
    return this.body.blocked.down || this.body.touching.down;
  }

  update(dt, player) {
    if (this.dead) return;
    const body = this.body;
    this.stun -= dt;
    this.flash -= dt;
    this.parryImmune -= dt;
    this.cooldown -= dt;

    if (this.dormant || this.type === 'dummy') {
      body.setVelocityX(0);
    } else if (this.stun > 0) {
      if (this.grounded) body.setVelocityX(body.velocity.x * Math.max(0, 1 - dt * 10));
    } else if (this.type === 'swordsman' || this.type === 'boss' || this.type === 'trainer') {
      this.updateSwordsman(dt, player);
    } else {
      this.updateThrower(dt, player);
    }

    if (body.top > LEVEL.height + 100) this.kill(false);
  }

  // 플레이어가 보이는지 (가로 거리, 세로 차이)
  sees(player, rangeX, rangeY) {
    if (player.dead) return false;
    const dx = player.body.center.x - this.body.center.x;
    const dy = player.body.center.y - this.body.center.y;
    return Math.abs(dx) < rangeX && Math.abs(dy) < rangeY;
  }

  // 범위 안에서만 움직인다 (구멍에 빠지지 않게)
  moveWithinBounds(vx) {
    const x = this.body.center.x;
    if ((vx < 0 && x <= this.minX + this.w / 2) || (vx > 0 && x >= this.maxX - this.w / 2)) vx = 0;
    this.body.setVelocityX(vx);
  }

  setState(state, time = 0) {
    this.state = state;
    this.stateTimer = time;
  }

  updateSwordsman(dt, player) {
    const S = this.cfg;
    const body = this.body;
    const dx = player.body.center.x - body.center.x;
    this.stateTimer -= dt;

    switch (this.state) {
      case 'patrol': {
        const x = body.center.x;
        if (x <= this.minX + this.w / 2 || body.blocked.left) this.facing = 1;
        else if (x >= this.maxX - this.w / 2 || body.blocked.right) this.facing = -1;
        body.setVelocityX(this.facing * S.patrolSpeed);
        if (this.sees(player, S.aggroRange, 90)) this.setState('chase');
        break;
      }
      case 'chase': {
        this.facing = Math.sign(dx) || this.facing;
        // 보스: 멀리 있으면 수리검을 부채꼴로 던짐
        if (S.throwCooldown) {
          this.throwTimer -= dt;
          if (this.throwTimer <= 0 && Math.abs(dx) > 160) {
            this.throwTimer = S.throwCooldown;
            for (const off of [-0.2, 0, 0.2]) this.scene.spawnShuriken(this, player, off);
          }
        }
        if (!this.sees(player, S.aggroRange * 1.3, 120)) {
          this.setState('patrol');
        } else if (Math.abs(dx) <= S.attackRange && this.cooldown <= 0 && this.grounded) {
          this.setState('windup', S.windup);
          body.setVelocityX(0);
        } else {
          this.moveWithinBounds(Math.abs(dx) > S.attackRange * 0.6 ? this.facing * S.chaseSpeed : 0);
        }
        break;
      }
      case 'windup':
        body.setVelocityX(0);
        if (this.stateTimer <= 0) {
          this.setState('attack', S.activeTime);
          this.attackHitDone = false;
          body.setVelocityX(this.facing * S.lunge);
          this.spawnSlashFx();
        }
        break;
      case 'attack':
        if (!this.attackHitDone && this.scene.enemySwordHit(this, this.getSwordRect())) this.attackHitDone = true;
        if (this.stateTimer <= 0) this.setState('recover', S.recover);
        break;
      case 'recover':
        body.setVelocityX(approach(body.velocity.x, 0, 2000 * dt));
        if (this.stateTimer <= 0) {
          this.cooldown = S.cooldown;
          this.setState('chase');
        }
        break;
    }
  }

  getSwordRect() {
    const S = this.cfg;
    const b = this.body;
    const x0 = this.facing > 0 ? b.right : b.left - S.reach;
    return new Phaser.Geom.Rectangle(x0, b.center.y - S.height / 2, S.reach, S.height);
  }

  spawnSlashFx() {
    const r = this.getSwordRect();
    const fx = Sprites.fx(this.scene, 'fx_slash', r.centerX, r.centerY,
      { flipX: this.facing > 0, tint: 0xff3b3b, depth: 12, scale: this.type === 'boss' ? 2 : 1 });
    if (fx) return;
    const line = this.scene.add.rectangle(r.centerX, r.centerY, r.width + 10, 5, 0x7a0000).setDepth(12);
    this.scene.tweens.add({ targets: line, scaleY: 0, alpha: 0, duration: 180, onComplete: () => line.destroy() });
  }

  updateThrower(dt, player) {
    const T = this.cfg;
    const body = this.body;
    const dx = player.body.center.x - body.center.x;
    this.stateTimer -= dt;
    const sees = this.sees(player, T.range, 260);

    if (this.state === 'windup') {
      body.setVelocityX(0);
      if (this.stateTimer <= 0) {
        this.scene.spawnShuriken(this, player);
        this.throwPose = 0.3;
        this.cooldown = T.cooldown;
        this.setState('patrol');
      }
      return;
    }

    if (!sees) {
      body.setVelocityX(0);
      return;
    }
    this.facing = Math.sign(dx) || this.facing;
    // 너무 가까우면 뒤로 물러남
    if (Math.abs(dx) < T.retreatRange && this.grounded) this.moveWithinBounds(-this.facing * T.retreatSpeed);
    else body.setVelocityX(0);

    if (this.cooldown <= 0 && this.grounded) this.setState('windup', T.windup);
  }

  // 피해를 줬으면 true. source: 'dashSlash' 등 (허수아비는 대쉬베기로만)
  hurt(dir, damage, knockback = 320, source = null) {
    if (this.dead) return false;
    const scene = this.scene;
    const b = this.body;
    if (this.type === 'dummy' && source !== 'dashSlash') {
      this.flash = 0.06;
      scene.popText(b.center.x, b.bottom - 96, '대쉬베기로!', '#cfcfcf');
      return false;
    }
    if (this.barrier) {
      // 금빛 막에 튕김: 피해 없음
      const ring = scene.add.circle(b.center.x, b.center.y, 46).setStrokeStyle(4, 0xffd166).setDepth(14);
      scene.tweens.add({ targets: ring, scale: 1.8, alpha: 0, duration: 300, onComplete: () => ring.destroy() });
      scene.popText(b.center.x, b.bottom - this.artHeight - 10, '튕김', '#ffd166');
      return false;
    }
    if (this.type === 'trainer') {
      // 연습 상대: 밀려나며 잠깐 멈출 뿐
      this.stun = 0.5;
      this.setState('chase');
      this.cooldown = Math.max(this.cooldown, 0.6);
      b.setVelocity(dir * knockback * 0.6, -120);
      return false;
    }
    this.hp -= damage;
    this.flash = 0.08;
    if (this.cfg.superArmor) {
      // 공격이 끊기지 않고 살짝만 밀림
      this.body.setVelocityX(dir * 80);
      if (this.hp <= 0) this.kill(true);
      return true;
    }
    this.stun = 0.28;
    // 맞으면 공격이 끊긴다
    if (this.state === 'windup' || this.state === 'attack') {
      this.setState(this.type === 'swordsman' ? 'chase' : 'patrol');
      this.cooldown = Math.max(this.cooldown, 0.3);
    }
    this.body.setVelocity(dir * knockback, -260);
    if (this.hp <= 0) this.kill(true);
    return true;
  }

  kill(withEffect) {
    if (this.dead) return;
    this.dead = true;
    if (withEffect) this.scene.spawnBurst(this.body.center.x, this.body.center.y, COLORS.enemy, this.type === 'boss' ? 40 : 10);
    // 충돌 콜백 도중일 수 있으므로 바로 지우지 않고 비활성화 후 다음 틱에 제거
    this.body.enable = false;
    this.obj.setVisible(false);
    this.telegraph.destroy();
    this.alert.destroy();
    if (this.glint) this.glint.destroy();
    if (this.sprite) {
      // 쓰러진 모습을 잠깐 보여 주고 사라진다 (보스는 1장이라 어둡게)
      const s = this.sprite;
      s.clearTint();
      if (this.type === 'boss') s.setTint(0x555566);
      else if (this.type === 'dummy') s.setAngle(this.facing > 0 ? -80 : 80);
      else s.setFrame(3);
      this.scene.tweens.add({ targets: s, alpha: 0, delay: withEffect ? 900 : 0, duration: 500, onComplete: () => s.destroy() });
    }
    this.scene.time.delayedCall(0, () => this.obj.destroy());
    this.scene.onEnemyKilled(this, withEffect);
  }

  // 물리 스텝 이후: 피격 깜빡임, 예고 표시 위치
  syncVisual(dt = 0) {
    if (this.dead) return;
    const b = this.body;
    const winding = this.state === 'windup';
    this.throwPose -= dt;
    if (this.npc) {
      // 연습 상대(하루): NPC 그림을 몸통 위치·자세에 맞춘다
      const n = this.npc;
      n.x = b.center.x;
      n.y = b.bottom;
      n.facing = this.facing;
      const pose = winding ? 'guard' : (this.state === 'attack' || this.state === 'recover') ? 'slash'
        : Math.abs(b.velocity.x) > 30 ? 'run' : 'idle';
      if (pose !== n.pose) n.setPose(pose);
      else n.sync();
      n.sprite.setTint(this.flash > 0 ? 0xffffff : winding && Math.floor(this.stateTimer * 10) % 2 ? 0xff9090 : 0xffc4d4);
    } else if (this.type === 'trainer') {
      // 그림 없음
    } else if (this.sprite) {
      const s = this.sprite;
      s.setPosition(b.center.x, b.bottom).setFlipX(this.facing > 0);
      let frame = 0;
      if (this.type === 'swordsman') frame = winding ? 1 : (this.state === 'attack' || this.state === 'recover') ? 2 : 0;
      else if (this.type === 'thrower') frame = this.throwPose > 0 ? 1 : 0;
      if (this.type !== 'boss' && this.type !== 'dummy') s.setFrame(frame);
      if (this.flash > 0) s.setTintFill(0xffffff);
      else if (winding && Math.floor(this.stateTimer * 16) % 2) s.setTint(0xff8080); // 공격 직전 붉게 깜빡임
      else s.clearTint();
    } else {
      this.obj.setFillStyle(this.flash > 0 ? 0xffffff : COLORS.enemy);
    }

    this.alert.setVisible(winding);
    this.alert.setPosition(b.center.x, b.bottom - this.artHeight - 2);
    if (this.glint) {
      this.glint.setVisible(winding);
      if (winding) {
        const t = 1 - Math.max(0, this.stateTimer) / this.cfg.windup; // 0 → 1
        this.glint.setPosition(b.center.x + 14, b.bottom - this.artHeight - 26)
          .setScale(1 + 0.8 * Math.abs(Math.sin(t * Math.PI * 3))).setAngle(t * 180);
        this.alert.setScale(1 + 0.25 * Math.sin(t * Math.PI * 4));
      }
    }

    const showRect = winding && this.type !== 'thrower';
    this.telegraph.setVisible(showRect);
    if (showRect) {
      const r = this.getSwordRect();
      const t = 1 - Math.max(0, this.stateTimer) / this.cfg.windup; // 0 → 1
      this.telegraph.setPosition(r.centerX, r.centerY).setSize(r.width, r.height);
      this.telegraph.setFillStyle(0xff1f1f, 0.15 + 0.35 * t);
      this.alert.setScale(1 + 0.3 * Math.sin(t * Math.PI * 4));
    } else if (winding && !this.sprite) {
      // 투척병: 던지기 직전 몸이 밝게 깜빡임
      if (Math.floor(this.stateTimer * 20) % 2) this.obj.setFillStyle(0xff8a8a);
    }
  }
}
