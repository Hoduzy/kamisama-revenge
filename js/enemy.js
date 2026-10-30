// 적. 빨간 사각형.
// swordsman(근접 검사): 플레이어를 쫓아와 0.4초 빨간 예고 후 앞을 벤다.
// thrower(투척병): 거리를 두고 수리검을 던진다. 가까이 오면 뒤로 물러난다.
// 몸끼리 부딪히는 것만으로는 피해가 없다. 검과 수리검만 위험하다.
class Enemy {
  constructor(scene, data) {
    this.scene = scene;
    this.type = data.type;
    this.cfg = TUNING[data.type];
    this.minX = data.minX;
    this.maxX = data.maxX;
    const sizes = { swordsman: [30, 44], thrower: [28, 36], boss: [48, 72] };
    [this.w, this.h] = sizes[data.type];
    this.dormant = !!data.dormant; // true 면 깨어날 때까지 가만히 있음

    this.obj = scene.add.rectangle(data.x, data.y, this.w, this.h, COLORS.enemy);
    this.obj.enemy = this;
    scene.physics.add.existing(this.obj);
    this.body = this.obj.body;

    this.hp = this.cfg.hp;
    this.facing = Math.random() < 0.5 ? -1 : 1;
    this.state = 'patrol';
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

    if (this.dormant) {
      body.setVelocityX(0);
    } else if (this.stun > 0) {
      if (this.grounded) body.setVelocityX(body.velocity.x * Math.max(0, 1 - dt * 10));
    } else if (this.type === 'swordsman' || this.type === 'boss') {
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

  hurt(dir, damage, knockback = 320) {
    if (this.dead) return;
    this.hp -= damage;
    this.flash = 0.08;
    if (this.cfg.superArmor) {
      // 공격이 끊기지 않고 살짝만 밀림
      this.body.setVelocityX(dir * 80);
      if (this.hp <= 0) this.kill(true);
      return;
    }
    this.stun = 0.28;
    // 맞으면 공격이 끊긴다
    if (this.state === 'windup' || this.state === 'attack') {
      this.setState(this.type === 'swordsman' ? 'chase' : 'patrol');
      this.cooldown = Math.max(this.cooldown, 0.3);
    }
    this.body.setVelocity(dir * knockback, -260);
    if (this.hp <= 0) this.kill(true);
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
    this.scene.time.delayedCall(0, () => this.obj.destroy());
    this.scene.onEnemyKilled(this, withEffect);
  }

  // 물리 스텝 이후: 피격 깜빡임, 예고 표시 위치
  syncVisual() {
    if (this.dead) return;
    const b = this.body;
    this.obj.setFillStyle(this.flash > 0 ? 0xffffff : COLORS.enemy);

    const winding = this.state === 'windup';
    this.alert.setVisible(winding);
    this.alert.setPosition(b.center.x, b.top - 4);

    const showRect = winding && this.type !== 'thrower';
    this.telegraph.setVisible(showRect);
    if (showRect) {
      const r = this.getSwordRect();
      const t = 1 - Math.max(0, this.stateTimer) / this.cfg.windup; // 0 → 1
      this.telegraph.setPosition(r.centerX, r.centerY).setSize(r.width, r.height);
      this.telegraph.setFillStyle(0xff1f1f, 0.15 + 0.35 * t);
      this.alert.setScale(1 + 0.3 * Math.sin(t * Math.PI * 4));
    } else if (winding) {
      // 투척병: 던지기 직전 몸이 밝게 깜빡임
      if (Math.floor(this.stateTimer * 20) % 2) this.obj.setFillStyle(0xff8a8a);
    }
  }
}
