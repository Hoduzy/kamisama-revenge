// 주인공. 물리 바디(보이지 않는 몸통 사각형 28×60)와 그림(스프라이트)을 분리한다.
// 머리카락·칼은 그림에만 있고 판정에는 들어가지 않는다.
// 스프라이트가 없으면 예전처럼 검은 사각형을 늘이고 줄여(squash & stretch) 그린다.
function approach(value, target, amount) {
  if (value < target) return Math.min(value + amount, target);
  if (value > target) return Math.max(value - amount, target);
  return target;
}

class Player {
  constructor(scene, x, y) {
    this.scene = scene;
    this.width = TUNING.playerBody.width;
    this.height = TUNING.playerBody.height;

    this.obj = scene.add.rectangle(x, y, this.width, this.height, 0x000000, 0);
    scene.physics.add.existing(this.obj);
    this.body = this.obj.body;
    this.body.setMaxVelocity(4000, TUNING.maxFallSpeed);
    this.body.setCollideWorldBounds(false);

    this.useSprite = Sprites.has(scene, 'player_idle');
    if (this.useSprite) {
      // 그림은 오른쪽을 보고 있다. 왼쪽은 flipX. 원점(0.5, 1) = 발바닥 중앙 = 몸통 박스 아래 변 중앙
      this.visual = scene.add.sprite(x, y, 'player_idle', 0).setOrigin(0.5, 1).setDepth(10);
      this.visual.play('player_idle');
    } else {
      this.visual = scene.add.rectangle(x, y, this.width, this.height, COLORS.player).setOrigin(0.5, 1).setDepth(10);
    }
    this.slash = scene.add.rectangle(0, 0, TUNING.attackRange, TUNING.attackHeight, 0x000000, 0.22)
      .setDepth(11).setVisible(false);
    this.actionAnim = null; // 발도 베기·패링처럼 끝날 때까지 다른 동작으로 바꾸지 않는 애니메이션
    this.actionTimer = 0;
    this.landTimer = 0;

    this.facing = 1;
    this.scaleX = 1;
    this.scaleY = 1;

    this.coyote = 0;
    this.jumpBuffer = 0;
    this.isJumping = false; // 가변 점프용: 점프로 상승 중인지
    this.wasGrounded = false;

    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.dashDir = 1;
    this.airDashAvailable = true;
    this.afterimageTimer = 0;

    this.attackTimer = 0;
    this.attackCooldown = 0;
    this.attackBuffer = 0;
    this.attackHits = new Set();

    this.invuln = 0;
    this.hurtLock = 0;
    this.dead = false;
    this.alphaMul = 1; // 연출용 (꽃잎에 실려 사라질 때 0)
    this.scripted = null; // 배우 시스템(js/actors.js)이 정한 그림. 있으면 조작·상태와 상관없이 이 그림
    this.speedMul = 1;    // 느린 조작(slow) 모드: 0.6

    this.skills = new Skills(this);
  }

  get grounded() {
    return this.body.blocked.down || this.body.touching.down;
  }

  get dashing() {
    return this.dashTimer > 0;
  }

  update(dt, controls) {
    const T = TUNING;
    const body = this.body;
    const c = controls.state;
    const grounded = this.grounded;

    // 타이머
    this.dashCooldown -= dt;
    this.attackCooldown -= dt;
    this.invuln -= dt;
    this.hurtLock -= dt;
    this.jumpBuffer -= dt;
    this.attackBuffer -= dt;

    if (grounded) {
      this.coyote = T.coyoteTime;
      this.airDashAvailable = true;
      if (!this.wasGrounded) this.onLand();
    } else {
      this.coyote -= dt;
    }
    this.wasGrounded = grounded;

    if (c.jump.pressed) this.jumpBuffer = T.jumpBuffer;
    if (c.attack.pressed) this.attackBuffer = T.attackBuffer;

    const dir = this.hurtLock > 0 ? 0 : controls.dirX;
    if (dir !== 0 && !this.dashing && this.attackTimer <= 0 && !this.skills.busy) this.facing = dir;

    // 스킬 사용 중엔 일반 이동/점프/대시/공격을 하지 않음
    if (this.skills.update(dt, controls)) {
      this.updateScale(dt);
      return;
    }

    // 대시 시작
    if (c.dash.pressed && this.hurtLock <= 0 && this.dashCooldown <= 0 && !this.dashing &&
        (grounded || this.airDashAvailable)) {
      this.startDash(dir !== 0 ? dir : this.facing, grounded);
    }

    if (this.dashing) {
      this.dashTimer -= dt;
      // 지상 대시는 중력을 유지해서 땅에 붙어 있게(착지 판정 유지), 공중 대시는 수평으로 고정
      if (this.dashOnGround) body.setVelocityX(this.dashDir * T.dashSpeed);
      else body.setVelocity(this.dashDir * T.dashSpeed, 0);
      this.afterimageTimer -= dt;
      if (this.afterimageTimer <= 0) {
        this.afterimageTimer = 0.025;
        this.spawnAfterimage();
      }
      // 대시 중 점프로 캔슬 가능 (지상 대시이거나 코요테 시간 안)
      if (this.jumpBuffer > 0 && this.coyote > 0) {
        this.endDash();
        this.jump();
        body.setVelocityX(this.dashDir * T.maxRunSpeed * 1.25);
      } else if (this.dashTimer <= 0) {
        this.endDash();
        body.setVelocityX(this.dashDir * T.maxRunSpeed);
      }
    } else {
      // 수평 이동: 목표 속도로 빠르게 수렴
      if (this.hurtLock <= 0) {
        const vx = body.velocity.x;
        const maxRun = T.maxRunSpeed * this.speedMul;
        const target = dir * maxRun;
        let accel;
        if (dir === 0) {
          accel = grounded ? T.groundDecel : T.airDecel;
        } else if (vx !== 0 && Math.sign(vx) !== dir) {
          accel = grounded ? T.groundTurnAccel : T.airTurnAccel;
        } else if (Math.abs(vx) > maxRun) {
          accel = grounded ? T.groundDecel : T.airDecel; // 대시 후 초과 속도는 부드럽게 줄임
        } else {
          accel = grounded ? T.groundAccel : T.airAccel;
        }
        body.setVelocityX(approach(vx, target, accel * dt));
      }

      // 점프 (버퍼 + 코요테)
      if (this.jumpBuffer > 0 && this.coyote > 0 && this.hurtLock <= 0) {
        this.jump();
      }

      // 가변 점프: 상승 중 키를 떼면 상승 속도 컷
      if (this.isJumping) {
        if (body.velocity.y >= 0) {
          this.isJumping = false;
        } else if (!c.jump.down) {
          body.setVelocityY(body.velocity.y * T.jumpCutMultiplier);
          this.isJumping = false;
        }
      }

      // 중력 배율 (월드 중력에 추가로 더해지는 값)
      let mult = 1;
      if (!grounded) {
        if (Math.abs(body.velocity.y) < T.apexThreshold && c.jump.down) mult = T.apexGravityMult;
        else if (body.velocity.y > 0) mult = T.fallGravityMult;
      }
      body.setGravityY(T.gravity * (mult - 1));
    }

    // 공격
    if (this.attackBuffer > 0 && this.attackCooldown <= 0 && this.hurtLock <= 0) {
      this.attackBuffer = 0;
      this.attackTimer = T.attackActive;
      this.attackCooldown = T.attackCooldown;
      this.attackHits.clear();
      const r = this.getAttackRect();
      Sprites.fx(this.scene, 'fx_slash', r.centerX, r.centerY, { flipX: this.facing > 0, depth: 12 }); // 원본 궤적은 왼쪽으로 볼록
    }
    if (this.attackTimer > 0) this.attackTimer -= dt;
    this.landTimer -= dt;

    this.updateScale(dt);
  }

  // 끝까지 재생해야 하는 동작 (발도 베기, 패링 성공)
  playAction(key, duration) {
    if (!this.useSprite) return;
    this.actionAnim = key;
    this.actionTimer = duration;
    this.visual.play(key);
  }

  // 상태에 맞는 애니메이션을 고른다 (우선순위 순)
  updateAnim(dt) {
    if (!this.useSprite) return;
    const v = this.visual;
    const sk = this.skills;
    const HOLD_LAST = ['player_iaido_ready', 'player_death']; // 끝나면 마지막 프레임 유지
    const flags = this.scene.registry.get('storyFlags') || {};
    const A = this.scene.anims;
    // 프롤로그 옷차림: 비에 젖은 아카네(P-12 ~ P-14)는 느린 걸음 · 젖은 선 그림,
    // 칼을 받기 전(P-1 ~ P-3)은 <시트>_nosword 그림이 manifest 에 있으면 그것 (아직 없음 → 칼 찬 그림 그대로)
    const rain = flags.akaneRain && A.exists('akane_slow_walk');
    const bare = (k) => (flags.akaneNoSword && (A.exists(`${k}_nosword`) || this.scene.textures.exists(`${k}_nosword`)) ? `${k}_nosword` : k);
    const play = (key0) => {
      if (rain && key0 === 'player_run') key0 = 'akane_slow_walk';
      if (rain && key0 === 'player_idle') return still('akane_emote2', 6);
      const key = bare(key0);
      const same = v.anims.currentAnim?.key === key && v.texture.key === v.anims.currentAnim.frames[0].textureKey;
      if (!same || (!v.anims.isPlaying && !HOLD_LAST.includes(key))) v.play(key);
    };
    function still(sheet, frame) {
      v.anims.stop();
      v.setTexture(sheet === 'akane_emote2' ? sheet : bare(sheet), frame);
    }

    // 배우 시스템이 정한 그림 (컷신에서 걷기·앉기 …)
    const S = this.scripted;
    if (S) {
      if (S.sheet) return still(S.sheet, S.frame);
      const cur = v.anims.currentAnim?.key;
      if (cur !== S.anim || v.texture.key !== v.anims.currentAnim.frames[0].textureKey || (!v.anims.isPlaying && S.loop)) {
        v.play({ key: S.anim, repeat: S.loop ? -1 : 0 });
      }
      v.anims.timeScale = S.timeScale || 1;
      return;
    }
    if (v.anims.timeScale !== 1) v.anims.timeScale = 1;
    if (this.dead) return play('player_death'); // 1회 재생 후 마지막 프레임에서 정지
    if (this.actionTimer > 0) {
      this.actionTimer -= dt;
      if (this.actionTimer > 0) return;
      // 패링 뒤 발도 준비가 계속되면 진행도에 맞는 프레임부터 이어서 재생
      if (this.actionAnim === 'player_parry' && sk.charging) {
        const f = Math.min(5, Math.floor((sk.iaidoCharge / TUNING.iaido.chargeTime) * 6));
        v.play({ key: 'player_iaido_ready', startFrame: f });
      }
      this.actionAnim = null;
    }
    if (sk.charging) return play('player_iaido_ready');
    if (sk.slashing || this.dashing) return play('player_dash'); // 대쉬·대쉬베기: 1회 재생
    if (v.anims.currentAnim?.key === 'player_dash' && v.anims.isPlaying) return; // 대쉬 모션은 끝까지
    if (this.attackTimer > 0) return play('player_attack');
    if (v.anims.currentAnim?.key === 'player_attack' && v.anims.isPlaying) return;

    const vy = this.body.velocity.y;
    // 잠긴 컷신(물리 멈춤)에서 배우 명령으로 옮겨진 뒤에는 땅에 서 있는 것으로 (점프 그림에 멈춰 있지 않게)
    if (!this.grounded && !this.scene.cutscene) {
      // 점프: 속도에 따라 상승 / 최고점 / 낙하 프레임
      return still('player_jump', vy < -150 ? 1 : vy > 150 ? 3 : 2);
    }
    if (this.landTimer > 0) return still('player_jump', this.landTimer > 0.05 ? 4 : 5); // 착지 → 착지 마무리
    if (Math.abs(this.body.velocity.x) > 40) return play('player_run');
    play('player_idle');
  }

  // 머리끈의 붉은 방울: P-7 에서 받은 뒤부터 P-14 에서 천으로 감쌀 때까지, 아카네 그림 위에 빨간 점(2×2)을 따로 그려 흔든다.
  // 머리끈 자리(발 가운데 기준, 오른쪽을 볼 때)는 그림마다 다르다. 표에 없는 그림(앉기 · 쓰러짐 등)에서는 숨긴다
  updateBell() {
    const reg = this.scene.registry;
    const on = this.useSprite && (reg.get('items') || []).includes('붉은 방울') && !(reg.get('storyFlags') || {}).bellWrapped;
    const tie = on && Player.BELL_TIE[this.visual.texture.key];
    if (!tie) {
      if (this.bell) this.bell.setVisible(false);
      return;
    }
    if (!this.bell) this.bell = this.scene.add.rectangle(0, 0, 2, 2, 0xd62828).setOrigin(0, 0);
    const t = this.scene.time.now / 1000;
    // 흔들림: 천천히 좌우 1px + 움직일 때 뒤로 끌림
    const lag = Phaser.Math.Clamp(-this.body.velocity.x / 200, -1.5, 1.5);
    const sway = Math.round(Math.sin(t * 5) * 0.8 + lag);
    const dx = tie[0] * this.facing + sway - 1;
    this.bell.setPosition(Math.round(this.visual.x + dx), Math.round(this.visual.y + tie[1] + 3))
      .setDepth(this.visual.depth + 0.1).setVisible(true).setAlpha(this.visual.alpha);
  }

  // 사망: 사망 애니메이션을 1회 재생하고 멈춘다 (부활은 scene 이 처리)
  die() {
    this.dead = true;
    this.endDash();
    this.skills.reset();
    this.attackTimer = 0;
    this.actionTimer = 0;
    this.body.setVelocityX(0);
    if (this.useSprite) this.visual.play('player_death');
  }

  // 그림 크기 복원 (스프링처럼)
  updateScale(dt) {
    const k = Math.min(1, dt * 14);
    this.scaleX += (1 - this.scaleX) * k;
    this.scaleY += (1 - this.scaleY) * k;
  }

  jump() {
    this.body.setVelocityY(-TUNING.jumpVelocity);
    this.jumpBuffer = 0;
    this.coyote = 0;
    this.isJumping = true;
    this.scaleX = 0.72;
    this.scaleY = 1.32;
    this.scene.spawnDust(this.body.center.x, this.body.bottom, 5);
    // 프롤로그 P-7 에서 받은 붉은 방울: 점프할 때마다 아주 작게 딸랑 (P-14 에서 천으로 감싼 뒤엔 소리 없음)
    const reg = this.scene.registry;
    if ((reg.get('items') || []).includes('붉은 방울') && !(reg.get('storyFlags') || {}).bellWrapped) {
      CineSound.sfx('chime', { volume: 0.16, pitch: 0.08 });
    }
  }

  bounce(velocity) {
    this.body.setVelocityY(-velocity);
    this.isJumping = true;
    this.airDashAvailable = true;
    this.scaleX = 0.8;
    this.scaleY = 1.2;
  }

  startDash(dir, grounded) {
    this.dashDir = dir;
    this.facing = dir;
    this.dashTimer = TUNING.dashTime;
    this.dashCooldown = TUNING.dashCooldown;
    this.dashOnGround = grounded;
    if (!grounded) this.airDashAvailable = false;
    this.isJumping = false;
    this.body.setGravityY(0);
    if (!grounded) this.body.setAllowGravity(false);
    this.scaleX = 1.35;
    this.scaleY = 0.75;
    this.afterimageTimer = 0;
    this.scene.cameras.main.shake(60, 0.002);
  }

  endDash() {
    this.dashTimer = 0;
    this.body.setAllowGravity(true);
  }

  onLand() {
    this.landTimer = 0.1;
    this.scaleX = 1.3;
    this.scaleY = 0.72;
    this.isJumping = false;
    this.scene.spawnDust(this.body.center.x, this.body.bottom, 4);
  }

  // 발도 준비 후반에 맞았을 때: 죽지 않고 밀려나며 잠깐 조작 불가
  stagger(fromX) {
    const T = TUNING;
    this.invuln = T.interruptInvuln;
    this.hurtLock = T.hurtLockTime;
    this.endDash();
    this.isJumping = false;
    const away = this.body.center.x < fromX ? -1 : 1;
    this.body.setVelocity(away * T.hurtKnockX, -T.hurtKnockY);
    this.scaleX = 1.3;
    this.scaleY = 0.75;
  }

  respawn(x, y) {
    this.endDash();
    this.skills.reset();
    this.obj.setPosition(x, y);
    this.body.reset(x, y);
    this.isJumping = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.attackTimer = 0;
    this.hurtLock = 0;
    this.body.setVelocity(0, 0);
    this.dead = false;
    this.actionTimer = 0;
    this.landTimer = 0;
    this.facing = 1;
    this.scaleX = 0.7;
    this.scaleY = 1.35;
    this.invuln = TUNING.respawnInvuln;
  }

  // 현재 공격 판정 사각형 (공격 중이 아니면 null)
  getAttackRect() {
    if (this.attackTimer <= 0) return null;
    const T = TUNING;
    const cx = this.body.center.x + this.facing * (this.width / 2 + T.attackRange / 2 - 4);
    return new Phaser.Geom.Rectangle(cx - T.attackRange / 2, this.body.center.y - T.attackHeight / 2,
      T.attackRange, T.attackHeight);
  }

  spawnAfterimage() {
    let ghost;
    if (this.useSprite) {
      const v = this.visual;
      ghost = this.scene.add.image(v.x, v.y, v.texture.key, v.frame.name).setOrigin(0.5, 1).setFlipX(v.flipX)
        .setDepth(9).setTintFill(0x8b1e3f).setAlpha(0.45);
    } else {
      ghost = this.scene.add.rectangle(this.body.center.x, this.body.bottom,
        this.width * this.scaleX, this.height * this.scaleY, COLORS.player, 0.3).setOrigin(0.5, 1).setDepth(9);
    }
    this.scene.tweens.add({ targets: ghost, alpha: 0, duration: 160, onComplete: () => ghost.destroy() });
  }

  // 물리 스텝 이후 호출: 그림을 바디 위치에 맞춘다
  syncVisual(dt = 0) {
    this.visual.setPosition(this.body.center.x, this.body.bottom);
    if (this.useSprite) {
      this.visual.setFlipX(this.facing < 0); // 도트가 뭉개지지 않게 늘이고 줄이지 않는다
      this.updateAnim(dt);
    } else {
      this.visual.setScale(this.scaleX, this.scaleY);
    }
    // 무적 시간 동안 깜빡임
    this.visual.setAlpha((this.invuln > 0 && !this.dashing && !this.dead ? (Math.floor(this.invuln * 20) % 2 ? 0.3 : 1) : 1) * this.alphaMul);

    this.skills.syncVisual();
    this.updateBell();

    const rect = this.useSprite ? null : this.getAttackRect(); // 스프라이트일 땐 베기 궤적 이펙트가 대신한다
    this.slash.setVisible(!!rect);
    if (rect) {
      this.slash.setPosition(rect.centerX, rect.centerY);
      this.slash.setAlpha(0.15 + 0.25 * (this.attackTimer / TUNING.attackActive));
    }
  }
}

// 머리끈(방울 매듭) 자리: 그림 이름 → [발 가운데에서 x(오른쪽을 볼 때), 발에서 y]. tools 로 잰 값 (assets/sprites 의 player_idle · player_run)
Player.BELL_TIE = {
  player_idle: [-2, -77],
  player_run: [5, -63],
  player_jump: [-1, -70],
};
