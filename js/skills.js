// 주인공 스킬: 대쉬베기(U), 발도(I), 벚꽃 스택.
// 수치는 모두 config.js 의 TUNING.dashSlash / TUNING.iaido / TUNING.sakuraMax 에 있다 (F1 → 연출 시험 → 스킬 슬라이더).
//
// 스킬1 대쉬베기: 적에게 닿아도 멈추지 않고 늘 최대 거리까지 나간다. 벽 · 낭떠러지 끝에서만 멈춘다.
//   지나가는 길의 적을 한 번씩 벤다(히트스톱 · 베기 궤적 · 벚꽃 스택 +1). 등 뒤에 fx_dash_wake, 끝나면 지나간 길에 fx_dash_trail.
// 스킬2 발도: 준비 1초(fx_iaido_charge: 패링 구간 흰색 → 뒤 구간 분홍) → 1차 원형 타격(fx_blade_storm + fx_shock_ring)
//   → 돌진(스킬1 거리 × dashRatio, 무적, 지나는 적도 벰) → 2차 원형 타격(반대로 도는 소용돌이 + 충격파, 벚꽃 스택을 모두 터뜨림).
//   같은 적은 1차 · 돌진 · 2차에서 각각 한 번씩만 맞는다.
const SAKURA_COLORS = [0xffb7c5, 0xffc9d6, 0xff9eb8, 0xffd6e0];
// 이펙트 그림의 가장 큰 칸 지름(px) — 반경 R 에 맞춰 늘이고 줄인다 (tools/process_skillfx.py)
const SKILL_FX_DIAMETER = { fx_blade_storm: 205, fx_shock_ring: 220 };
const DASH_TRAIL_LEN = 190; // fx_dash_trail 가장 긴 칸의 길이(px)

class Skills {
  constructor(player) {
    this.player = player;
    this.scene = player.scene;
    this.sakura = 0;

    // 돌진 (대쉬베기 · 발도 돌진이 같이 쓴다): { kind: 'slash' | 'iaido', dir, speed, left, startX, prevX, hits, grounded }
    this.run = null;
    this.slashCooldown = 0;
    this.slashJustEnded = false;
    this.slashGrace = 0;

    // 발도: iaidoCharge < 0 이면 준비 중이 아님
    this.iaidoCharge = -1;
    this.iaidoCooldown = 0;

    // 판정 표시(H)용: 최근 원형 타격 { x, y, r, t }
    this.debugCircles = [];

    const scene = this.scene;
    this.chargeBarBg = scene.add.rectangle(0, 0, 40, 6, 0x000000, 0.2).setDepth(12).setVisible(false);
    this.chargeBar = scene.add.rectangle(0, 0, 40, 6, 0xff7aa2).setOrigin(0, 0.5).setDepth(13).setVisible(false);
    this.chargeFx = null;
  }

  get slashing() {
    return !!this.run && this.run.kind === 'slash';
  }

  get iaidoDashing() {
    return !!this.run && this.run.kind === 'iaido';
  }

  // 돌진 중 + 끝난 직후 잠깐 무적 (발도 돌진도)
  get slashInvuln() {
    return !!this.run || this.slashGrace > 0;
  }

  get charging() {
    return this.iaidoCharge >= 0;
  }

  get parrying() {
    return this.charging && this.iaidoCharge < TUNING.iaido.parryWindow;
  }

  get busy() {
    return !!this.run || this.charging;
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
    for (const d of this.debugCircles) d.t -= dt;
    this.debugCircles = this.debugCircles.filter((d) => d.t > 0);

    const canStart = p.hurtLock <= 0 && !this.busy;
    const locks = this.scene.skillLocks; // 프롤로그: 튜토리얼에서 배우기 전엔 못 씀
    if (c.skill1.pressed && canStart && this.slashCooldown <= 0 && !locks.has('dashSlash')) this.startSlash();
    else if (c.skill2.pressed && canStart && this.iaidoCooldown <= 0 && !locks.has('iaido')) this.startIaido();

    if (this.run) {
      this.updateRun(dt);
      return true;
    }
    if (this.charging) {
      this.updateIaido(dt);
      return true;
    }
    return false;
  }

  reset() {
    if (this.run) this.endRun(true);
    this.iaidoCharge = -1;
    this.stopChargeFx();
  }

  // ───────── 돌진 (스킬1 · 발도 돌진 공통) ─────────

  startRun(kind, distance, time) {
    const p = this.player;
    if (p.dashing) p.endDash();
    p.attackTimer = 0;
    p.isJumping = false;
    p.flipTimer = 0; // 2단 점프 공중제비를 끊고 바로 스킬 동작으로
    const dir = p.facing;
    this.run = {
      kind, dir, speed: distance / time, left: distance,
      startX: p.body.center.x, prevX: p.body.center.x, lastX: p.body.center.x, hits: new Set(),
      grounded: p.grounded, wake: this.attachWake(dir),
    };
    p.body.setAllowGravity(false);
    p.body.setGravityY(0);
    p.body.setVelocity(dir * this.run.speed, 0);
  }

  updateRun(dt) {
    // 지난 물리 단계에서 움직인 구간을 먼저 판정 (돌진이 이 프레임에 끝나도 마지막 구간의 적을 놓치지 않게)
    this.checkSlashHits(this.scene.enemies);
    const p = this.player;
    const r = this.run;
    const b = p.body;
    // 실제로 움직인 거리만큼 남은 거리를 줄인다 (히트스톱으로 멈춘 프레임은 세지 않는다)
    r.left -= Math.abs(b.center.x - r.lastX);
    r.lastX = b.center.x;
    const blocked = r.dir > 0 ? b.blocked.right : b.blocked.left;
    // 낭떠러지: 이번 프레임에 갈 거리 안에서 발밑 땅이 끊기는 곳을 미리 찾아 거기까지만 간다 (프레임이 길어도 지나치지 않게)
    if (r.grounded && !r.ledgeStop) {
      const d = this.ledgeDist(r.dir, r.speed * Math.max(dt, 1 / 30) * 1.5 + 8);
      if (d < r.left) { r.left = d; r.ledgeStop = true; }
    }
    if (r.left <= 0.5 || blocked) {
      this.endRun(false, blocked || r.ledgeStop); // 벽 · 낭떠러지: 그 자리에 멈춘다 (앞으로 미끄러지지 않게)
      return;
    }
    b.setVelocity(r.dir * Math.min(r.speed, r.left / Math.max(dt, 1 / 240)), 0);
    this.syncWake();
  }

  // 땅에서 시작한 돌진은 낭떠러지 끝에서 멈춘다: 몸 앞쪽부터 max px 안에서 발밑 땅 · 발판이 처음 끊기는 거리 (없으면 Infinity)
  ledgeDist(dir, max) {
    const b = this.player.body;
    const front = dir > 0 ? b.right : b.left;
    for (let d = 0; d <= max; d += 4) {
      const x = front + dir * d;
      if (!this.scene.physics.overlapRect(x - 1, b.bottom + 1, 2, 8, false, true).length) return Math.max(0, d - 4);
    }
    return Infinity;
  }

  endRun(silent = false, stopDead = false) {
    const p = this.player;
    const r = this.run;
    this.run = null;
    this.slashJustEnded = true;
    this.slashGrace = TUNING.dashSlash.endGrace;
    p.body.setAllowGravity(true);
    p.body.setVelocityX(r.kind === 'slash' && !stopDead ? r.dir * TUNING.maxRunSpeed : 0);
    if (r.wake) this.releaseWake(r.wake);
    if (silent) return;
    this.playTrail(r.startX, p.body.center.x, p.body.center.y, r.dir);
    if (r.kind === 'iaido') this.iaidoHit2();
  }

  // 등 뒤 분홍 돌진 기운: 시작 1-2칸 → 반복 3-6칸. 오른쪽 끝(=등)이 아카네 등에 붙는다. 왼쪽으로 가면 좌우 반전
  attachWake(dir) {
    const s = this.scene;
    if (!s.anims.exists('fx_dash_wake_start')) return null;
    const w = s.add.sprite(0, 0, 'fx_dash_wake', 0).setDepth(9).setOrigin(dir > 0 ? 1 : 0, 0.5).setFlipX(dir < 0);
    w.dir = dir;
    w.play('fx_dash_wake_start');
    w.once('animationcomplete', () => { if (w.active && !w.ending) w.play('fx_dash_wake_loop'); });
    this.wake = w;
    this.syncWake();
    return w;
  }

  syncWake() {
    const w = this.wake;
    if (!w || w.ending) return;
    const b = this.player.body;
    // 등: 몸통 판정의 뒤쪽 가장자리에서 조금 안쪽
    w.setPosition(Math.round(w.dir > 0 ? b.left + 6 : b.right - 6), Math.round(b.center.y - 4));
  }

  // 끝 7-8칸은 그 자리에 남기고 재생한 뒤 사라진다
  releaseWake(w) {
    this.syncWake();
    w.ending = true;
    this.wake = null;
    w.play('fx_dash_wake_end');
    w.once('animationcomplete', () => w.destroy());
  }

  // 지나간 길: fx_dash_trail 을 대쉬 거리에 맞춰 늘려 한 번
  playTrail(x0, x1, y, dir) {
    const s = this.scene;
    const len = Math.abs(x1 - x0);
    if (len < 8) return;
    if (!s.anims.exists('fx_dash_trail')) {
      const line = s.add.rectangle((x0 + x1) / 2, y, len + 30, 4, 0x111111).setDepth(11);
      s.tweens.add({ targets: line, scaleY: 0, alpha: 0, duration: 220, onComplete: () => line.destroy() });
      return;
    }
    const t = s.add.sprite((x0 + x1) / 2, y, 'fx_dash_trail', 0).setDepth(11).setFlipX(dir < 0);
    t.setScale(len / DASH_TRAIL_LEN, 1);
    t.play('fx_dash_trail');
    t.once('animationcomplete', () => t.destroy());
  }

  // 이번 프레임에 지나간 구간 전체를 판정 (빠르게 움직여도 적을 건너뛰지 않게)
  checkSlashHits(enemies) {
    const r = this.run;
    if (!r) return;
    const p = this.player;
    const S = TUNING.dashSlash;
    const x = p.body.center.x;
    const left = Math.min(r.prevX, x) - p.width / 2 - 6;
    const right = Math.max(r.prevX, x) + p.width / 2 + 6;
    const rect = new Phaser.Geom.Rectangle(left, p.body.center.y - S.hitHeight / 2, right - left, S.hitHeight);
    r.prevX = x;
    const damage = r.kind === 'iaido' ? TUNING.iaido.dashDamage : S.damage;
    for (const e of enemies) {
      if (e.dead || r.hits.has(e)) continue;
      if (!Phaser.Geom.Rectangle.Overlaps(rect, this.scene.bodyRect(e.body))) continue;
      r.hits.add(e);
      this.slashEnemy(e, r.dir, damage, 'dashSlash');
    }
  }

  // 한 번 베기: 피해 · 벚꽃 스택 +1 · 그 적 자리에 베기 궤적 · 히트스톱
  slashEnemy(e, dir, damage, source) {
    const scene = this.scene;
    const ex = e.body.center.x;
    const ey = e.body.center.y;
    if (e.hurt(dir, damage, undefined, source)) {
      this.addSakura(TUNING.dashSlash.stacksPerHit);
      scene.showDamage(ex, ey - 20, damage, '#ff8fb1');
    }
    scene.spawnPetals(ex, ey, 5, 50);
    Sprites.fx(scene, 'fx_slash', ex, ey, { flipX: dir > 0, depth: 14 });
    scene.doHitStop(TUNING.dashSlash.hitStop);
  }

  // ───────── 스킬1: 대쉬베기 ─────────

  startSlash() {
    const S = TUNING.dashSlash;
    this.slashCooldown = S.cooldown;
    this.startRun('slash', S.distance, S.time);
    const p = this.player;
    p.scaleX = 1.45;
    p.scaleY = 0.7;
    this.scene.cameras.main.shake(70, 0.003);
  }

  // ───────── 스킬2: 발도 ─────────

  startIaido() {
    const p = this.player;
    if (p.dashing) p.endDash();
    p.attackTimer = 0;
    p.isJumping = false;
    p.flipTimer = 0;
    this.iaidoCharge = 0;
    p.scaleX = 1.15;
    p.scaleY = 0.85;
    const s = this.scene;
    if (s.anims.exists('fx_iaido_charge')) {
      this.chargeFx = s.add.sprite(p.body.center.x, p.body.center.y, 'fx_iaido_charge', 0).setDepth(11);
      this.chargeFx.play('fx_iaido_charge');
    }
  }

  stopChargeFx() {
    if (this.chargeFx) this.chargeFx.destroy();
    this.chargeFx = null;
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
    this.stopChargeFx();
  }

  parry(enemy) {
    const p = this.player;
    const I = TUNING.iaido;
    const scene = this.scene;
    const dir = Math.sign(enemy.body.center.x - p.body.center.x) || p.facing;
    const ex = enemy.body.center.x;
    const ey = enemy.body.center.y;
    enemy.parryImmune = 0.5;
    if (enemy.hurt(dir, I.parryDamage, I.parryKnockback)) scene.showDamage(ex, ey - 20, I.parryDamage, '#ff8fb1');
    scene.events.emit('parry', enemy);
    this.parryFx((p.body.center.x + ex) / 2, ey);
  }

  // 패링 성공 연출 (검이든 수리검이든 공통)
  parryFx(x, y) {
    const p = this.player;
    const scene = this.scene;
    scene.popText(p.body.center.x, p.body.bottom - 110, '패링!', '#ff8fb1');
    p.playAction('player_parry', 0.3);
    Sprites.fx(scene, 'fx_parry_flash', x, y, { depth: 15, scale: 1 });
    const ring = scene.add.rectangle(p.body.center.x, p.body.center.y, 50, 60).setStrokeStyle(4, 0xff7aa2).setDepth(12);
    scene.tweens.add({ targets: ring, scale: 2.2, alpha: 0, duration: 260, onComplete: () => ring.destroy() });
    scene.spawnPetals(x, y, 8, 60);
    scene.doHitStop(0.1);
    scene.cameras.main.shake(120, 0.006);
  }

  // 원형 타격: (x, y) 반경 r 안의 적 (이미 맞은 적 제외). 맞힌 수
  circleHit(x, y, r, damage, hitSet, dir) {
    const scene = this.scene;
    const circle = new Phaser.Geom.Circle(x, y, r);
    this.debugCircles.push({ x, y, r, t: 0.6 });
    let n = 0;
    for (const e of scene.enemies) {
      if (e.dead || hitSet.has(e)) continue;
      if (!Phaser.Geom.Intersects.CircleToRectangle(circle, scene.bodyRect(e.body))) continue;
      hitSet.add(e);
      const ex = e.body.center.x;
      const ey = e.body.center.y;
      const d = Math.sign(ex - x) || dir;
      if (e.hurt(d, damage, 420, 'iaido')) scene.showDamage(ex, ey - 24, damage, '#ff8fb1', 30);
      scene.spawnPetals(ex, ey, 6, 70);
      n++;
    }
    return n;
  }

  // 원형 이펙트: 반경 r 에 맞춘 크기. reverse = 반대로 휘몰아침(좌우 반전)
  circleFx(x, y, r, reverse) {
    const s = this.scene;
    for (const key of ['fx_blade_storm', 'fx_shock_ring']) {
      const fx = Sprites.fx(s, key, x, y, { depth: key === 'fx_shock_ring' ? 13 : 14, flipX: key === 'fx_blade_storm' && reverse });
      if (fx) fx.setScale((r * 2) / SKILL_FX_DIAMETER[key]);
    }
    if (!s.anims.exists('fx_blade_storm')) {
      const ring = s.add.circle(x, y, r).setStrokeStyle(4, 0xff7aa2).setDepth(13);
      s.tweens.add({ targets: ring, scale: 1.2, alpha: 0, duration: 300, onComplete: () => ring.destroy() });
    }
  }

  // 1차 원형 타격 → 돌진 (돌진이 끝나면 endRun 이 2차 타격)
  releaseIaido() {
    const p = this.player;
    const I = TUNING.iaido;
    const scene = this.scene;
    this.iaidoCharge = -1;
    this.iaidoCooldown = I.cooldown;
    this.stopChargeFx();
    scene.events.emit('iaido');

    const cx = p.body.center.x;
    const cy = p.body.center.y;
    this.iaidoHits1 = new Set();
    this.circleHit(cx, cy, I.radius, I.hit1Damage, this.iaidoHits1, p.facing);
    this.circleFx(cx, cy, I.radius, false);
    p.playAction('player_iaido_slash', 0.25);
    scene.doHitStop(I.hitStop1);
    scene.cameras.main.shake(I.shake1Ms, I.shake1);

    this.startRun('iaido', TUNING.dashSlash.distance * I.dashRatio, I.dashTime);
    p.scaleX = 1.4;
    p.scaleY = 0.75;
  }

  // 2차 원형 타격: 도착 지점. 벚꽃 스택을 모두 터뜨린다 (피해 + 스택당, 반경 · 이펙트 스택당 radiusPerStack 배)
  iaidoHit2() {
    const p = this.player;
    const I = TUNING.iaido;
    const scene = this.scene;
    const stacks = this.sakura;
    this.sakura = 0;
    const r = I.radius * (1 + I.radiusPerStack * stacks);
    const damage = I.baseDamage + stacks * I.damagePerStack;
    const cx = p.body.center.x;
    const cy = p.body.center.y;
    this.circleHit(cx, cy, r, damage, new Set(), p.facing);
    this.circleFx(cx, cy, r, true);
    if (stacks > 0) {
      const burst = Sprites.fx(scene, 'fx_sakura_burst', cx, cy, { depth: 15 });
      if (burst) burst.setScale((r * 2) / 160);
      for (let i = 0; i < 4 + stacks * 10; i++) {
        const a = Math.random() * Math.PI * 2;
        scene.spawnPetals(cx + Math.cos(a) * r * Math.random(), cy + Math.sin(a) * r * Math.random() * 0.6, 1, 90);
      }
    }
    p.playAction('player_iaido_slash', 0.3);
    scene.doHitStop(I.hitStop2);
    scene.cameras.main.shake(I.shake2Ms, I.shake2);
    scene.cameras.main.flash(120, 255, 255, 255);
  }

  syncVisual() {
    const p = this.player;
    const show = this.charging;
    this.chargeBarBg.setVisible(show);
    this.chargeBar.setVisible(show);
    if (this.wake) this.syncWake();
    if (!show) return;
    const I = TUNING.iaido;
    const x = p.body.center.x;
    const y = p.body.bottom - 96; // 머리 위
    this.chargeBarBg.setPosition(x, y);
    this.chargeBar.setPosition(x - 20, y);
    this.chargeBar.setSize(40 * Math.min(1, this.iaidoCharge / I.chargeTime), 6);
    this.chargeBar.setFillStyle(this.parrying ? 0xffffff : 0xff7aa2);
    // 발도 기운: 패링 구간은 흰색, 뒤 구간은 분홍(그림 색 그대로)
    if (this.chargeFx) {
      this.chargeFx.setPosition(x, p.body.center.y);
      if (this.parrying) this.chargeFx.setTintFill(0xffffff).setAlpha(0.85);
      else this.chargeFx.clearTint().setAlpha(1);
    }
  }
}
