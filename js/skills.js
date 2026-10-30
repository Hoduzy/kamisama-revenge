// 주인공 스킬: 대쉬베기(U), 발도(I), 벚꽃 스택.
// 수치는 모두 config.js 의 TUNING.dashSlash / TUNING.iaido / TUNING.sakuraMax 에 있다.
const SAKURA_COLORS = [0xffb7c5, 0xffc9d6, 0xff9eb8, 0xffd6e0];

class Skills {
  constructor(player) {
    this.player = player;
    this.scene = player.scene;
    this.sakura = 0;

    // 대쉬베기
    this.slashTimer = 0;
    this.slashCooldown = 0;
    this.slashDir = 1;
    this.slashStartX = 0;
    this.slashPrevX = 0;
    this.slashJustEnded = false;
    this.slashGrace = 0;
    this.slashHits = new Set();

    // 발도: iaidoCharge < 0 이면 준비 중이 아님
    this.iaidoCharge = -1;
    this.iaidoCooldown = 0;

    const scene = this.scene;
    this.chargeBarBg = scene.add.rectangle(0, 0, 40, 6, 0x000000, 0.2).setDepth(12).setVisible(false);
    this.chargeBar = scene.add.rectangle(0, 0, 40, 6, 0xff7aa2).setOrigin(0, 0.5).setDepth(13).setVisible(false);
    this.parryAura = scene.add.rectangle(0, 0, player.width + 16, player.height + 16).setStrokeStyle(3, 0xff7aa2).setDepth(9).setVisible(false);
  }

  get slashing() {
    return this.slashTimer > 0;
  }

  // 대쉬베기 중 + 끝난 직후 잠깐 무적
  get slashInvuln() {
    return this.slashing || this.slashGrace > 0;
  }

  get charging() {
    return this.iaidoCharge >= 0;
  }

  get parrying() {
    return this.charging && this.iaidoCharge < TUNING.iaido.parryWindow;
  }

  get busy() {
    return this.slashing || this.charging;
  }

  addSakura(n) {
    this.sakura = Math.min(TUNING.sakuraMax, this.sakura + n);
  }

  // true 를 반환하면 이번 프레임은 스킬이 이동을 제어한다 (일반 이동/점프/공격 생략)
  update(dt, controls) {
    const p = this.player;
    const c = controls.state;
    this.slashCooldown -= dt;
    this.iaidoCooldown -= dt;
    this.slashGrace -= dt;
    this.slashJustEnded = false;

    const canStart = p.hurtLock <= 0 && !this.busy;
    if (c.skill1.pressed && canStart && this.slashCooldown <= 0) this.startSlash();
    else if (c.skill2.pressed && canStart && this.iaidoCooldown <= 0) this.startIaido();

    if (this.slashing) {
      this.updateSlash(dt);
      return true;
    }
    if (this.charging) {
      this.updateIaido(dt);
      return true;
    }
    return false;
  }

  reset() {
    if (this.slashing) this.endSlash();
    this.iaidoCharge = -1;
  }

  // ───────── 스킬1: 대쉬베기 ─────────

  startSlash() {
    const p = this.player;
    const S = TUNING.dashSlash;
    if (p.dashing) p.endDash();
    p.attackTimer = 0;
    p.isJumping = false;
    this.slashDir = p.facing;
    this.slashTimer = S.time;
    this.slashCooldown = S.cooldown;
    this.slashHits.clear();
    this.slashStartX = this.slashPrevX = p.body.center.x;
    p.body.setAllowGravity(false);
    p.body.setGravityY(0);
    p.scaleX = 1.45;
    p.scaleY = 0.7;
    this.scene.cameras.main.shake(70, 0.003);
  }

  updateSlash(dt) {
    const p = this.player;
    const S = TUNING.dashSlash;
    this.slashTimer -= dt;
    p.body.setVelocity(this.slashDir * (S.distance / S.time), 0);
    p.spawnAfterimage();
    if (this.slashTimer <= 0) this.endSlash();
  }

  endSlash() {
    const p = this.player;
    this.slashTimer = 0;
    this.slashJustEnded = true;
    this.slashGrace = TUNING.dashSlash.endGrace;
    p.body.setAllowGravity(true);
    p.body.setVelocityX(this.slashDir * TUNING.maxRunSpeed);

    // 지나간 경로에 베기 궤적
    const x0 = this.slashStartX;
    const x1 = p.body.center.x;
    const line = this.scene.add.rectangle((x0 + x1) / 2, p.body.center.y, Math.abs(x1 - x0) + 30, 4, 0x111111)
      .setDepth(11);
    this.scene.tweens.add({ targets: line, scaleY: 0, alpha: 0, duration: 220, onComplete: () => line.destroy() });
  }

  // 이번 프레임에 지나간 구간 전체를 판정 (빠르게 움직여도 적을 건너뛰지 않게)
  checkSlashHits(enemies) {
    if (!this.slashing && !this.slashJustEnded) return;
    const p = this.player;
    const S = TUNING.dashSlash;
    const x = p.body.center.x;
    const left = Math.min(this.slashPrevX, x) - p.width / 2 - 6;
    const right = Math.max(this.slashPrevX, x) + p.width / 2 + 6;
    const rect = new Phaser.Geom.Rectangle(left, p.body.center.y - S.hitHeight / 2, right - left, S.hitHeight);
    this.slashPrevX = x;

    for (const e of enemies) {
      if (e.dead || this.slashHits.has(e)) continue;
      if (!Phaser.Geom.Rectangle.Overlaps(rect, this.scene.bodyRect(e.body))) continue;
      this.slashHits.add(e);
      const ex = e.body.center.x;
      const ey = e.body.center.y;
      e.hurt(this.slashDir, S.damage);
      this.addSakura(S.stacksPerHit);
      this.scene.showDamage(ex, ey - 20, S.damage, '#d6336c');
      this.scene.spawnPetals(ex, ey, 5, 50);
      Sprites.fx(this.scene, 'fx_slash', ex, ey, { flipX: this.slashDir > 0, depth: 14 });
      this.scene.hitImpact();
    }
  }

  // ───────── 스킬2: 발도 ─────────

  startIaido() {
    const p = this.player;
    if (p.dashing) p.endDash();
    p.attackTimer = 0;
    p.isJumping = false;
    this.iaidoCharge = 0;
    p.scaleX = 1.15;
    p.scaleY = 0.85;
  }

  updateIaido(dt) {
    const p = this.player;
    const I = TUNING.iaido;
    this.iaidoCharge += dt;
    // 제자리에서 자세를 잡는다 (중력은 그대로)
    p.body.setVelocityX(approach(p.body.velocity.x, 0, TUNING.groundDecel * dt));
    p.body.setGravityY(0);
    if (this.iaidoCharge >= I.chargeTime) this.releaseIaido();
  }

  // 준비 후반(패링 구간 이후)에 맞으면 호출
  interruptIaido() {
    this.iaidoCharge = -1;
    this.iaidoCooldown = TUNING.iaido.cooldown;
  }

  parry(enemy) {
    const p = this.player;
    const I = TUNING.iaido;
    const scene = this.scene;
    const dir = Math.sign(enemy.body.center.x - p.body.center.x) || p.facing;
    const ex = enemy.body.center.x;
    const ey = enemy.body.center.y;
    enemy.parryImmune = 0.5;
    enemy.hurt(dir, I.parryDamage, I.parryKnockback);

    scene.showDamage(ex, ey - 20, I.parryDamage, '#d6336c');
    this.parryFx((p.body.center.x + ex) / 2, ey);
  }

  // 패링 성공 연출 (검이든 수리검이든 공통)
  parryFx(x, y) {
    const p = this.player;
    const scene = this.scene;
    scene.popText(p.body.center.x, p.body.bottom - 110, '패링!', '#d6336c');
    p.playAction('player_parry', 0.3);
    Sprites.fx(scene, 'fx_parry_flash', x, y, { depth: 15, scale: 1 });
    const ring = scene.add.rectangle(p.body.center.x, p.body.center.y, 50, 60).setStrokeStyle(4, 0xff7aa2).setDepth(12);
    scene.tweens.add({ targets: ring, scale: 2.2, alpha: 0, duration: 260, onComplete: () => ring.destroy() });
    scene.spawnPetals(x, y, 8, 60);
    scene.doHitStop(0.1);
    scene.cameras.main.shake(120, 0.006);
  }

  releaseIaido() {
    const p = this.player;
    const I = TUNING.iaido;
    const scene = this.scene;
    const f = p.facing;
    const b = p.body;
    this.iaidoCharge = -1;
    this.iaidoCooldown = I.cooldown;

    const stacks = this.sakura;
    this.sakura = 0;
    const damage = I.baseDamage + stacks * I.damagePerStack;

    const x0 = f > 0 ? b.right : b.left - I.range;
    const cy = b.center.y;
    const rect = new Phaser.Geom.Rectangle(x0, cy - I.height / 2, I.range, I.height);

    let hits = 0;
    for (const e of scene.enemies) {
      if (e.dead || !Phaser.Geom.Rectangle.Overlaps(rect, scene.bodyRect(e.body))) continue;
      const ex = e.body.center.x;
      const ey = e.body.center.y;
      e.hurt(f, damage, 520);
      scene.showDamage(ex, ey - 24, damage, '#d6336c', 30);
      scene.spawnPetals(ex, ey, 6 + stacks * 3, 70);
      Sprites.fx(scene, 'fx_sakura_burst', ex, ey, { depth: 15 });
      hits++;
    }

    // 베기 연출: 큰 베기 궤적(3배) 또는 검은 일섬 + 분홍 띠, 그리고 스택만큼 벚꽃잎
    const cx = x0 + I.range / 2;
    p.playAction('player_iaido_slash', 0.3);
    if (!Sprites.fx(scene, 'fx_slash', cx, cy, { flipX: f > 0, scale: 3, depth: 13 })) {
      const band = scene.add.rectangle(cx, cy, I.range + 20, I.height, 0xff9eb8, 0.35).setDepth(11);
      const line = scene.add.rectangle(cx, cy, I.range + 40, 6, 0x111111).setDepth(12);
      scene.tweens.add({ targets: band, scaleY: 0, alpha: 0, duration: 260, onComplete: () => band.destroy() });
      scene.tweens.add({ targets: line, scaleY: 0, duration: 300, ease: 'Cubic.easeIn', onComplete: () => line.destroy() });
    }
    if (stacks > 0) Sprites.fx(scene, 'fx_sakura_burst', cx, cy, { depth: 14, scale: stacks >= 3 ? 2 : 1 });
    for (let i = 0; i < 4 + stacks * 12; i++) {
      scene.spawnPetals(x0 + Math.random() * I.range, cy + (Math.random() - 0.5) * I.height * 0.6, 1, 90);
    }

    p.body.setVelocityX(f * I.lungeSpeed);
    p.scaleX = 1.5;
    p.scaleY = 0.7;
    scene.doHitStop(hits ? I.hitStop : 0.05);
    scene.cameras.main.shake(hits ? 220 : 120, hits ? 0.012 : 0.005);
  }

  syncVisual() {
    const p = this.player;
    const show = this.charging;
    this.chargeBarBg.setVisible(show);
    this.chargeBar.setVisible(show);
    this.parryAura.setVisible(this.parrying);
    if (!show) return;
    const I = TUNING.iaido;
    const x = p.body.center.x;
    const y = p.body.bottom - 96; // 머리 위
    this.chargeBarBg.setPosition(x, y);
    this.chargeBar.setPosition(x - 20, y);
    this.chargeBar.setSize(40 * Math.min(1, this.iaidoCharge / I.chargeTime), 6);
    this.chargeBar.setFillStyle(this.parrying ? 0xff7aa2 : 0x333333);
    this.parryAura.setPosition(x, p.body.center.y);
    this.parryAura.setAlpha(0.5 + 0.5 * Math.sin(this.iaidoCharge * 40));
  }
}
