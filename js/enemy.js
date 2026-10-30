// 적. 빨간 사각형.
// walker: 순찰 범위 안에서 좌우로 걷는다.
// hopper: 플레이어가 가까우면 그쪽으로 점프한다.
class Enemy {
  constructor(scene, data) {
    this.scene = scene;
    this.type = data.type;
    this.minX = data.minX;
    this.maxX = data.maxX;
    this.size = data.type === 'hopper' ? 30 : 34;

    this.obj = scene.add.rectangle(data.x, data.y, this.size, this.size, COLORS.enemy);
    this.obj.enemy = this;
    scene.physics.add.existing(this.obj);
    this.body = this.obj.body;

    this.hp = 3;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.speed = this.type === 'hopper' ? 0 : 90;
    this.stun = 0;
    this.flash = 0;
    this.hopTimer = 0.6 + Math.random() * 0.6;
    this.dead = false;
  }

  get grounded() {
    return this.body.blocked.down || this.body.touching.down;
  }

  update(dt, player) {
    if (this.dead) return;
    const body = this.body;
    this.stun -= dt;
    this.flash -= dt;
    this.obj.setFillStyle(this.flash > 0 ? 0xffffff : COLORS.enemy);

    if (this.stun > 0) {
      if (this.grounded) body.setVelocityX(body.velocity.x * Math.max(0, 1 - dt * 10));
      return;
    }

    if (this.type === 'walker') {
      const x = body.center.x;
      if (x <= this.minX + this.size / 2) this.dir = 1;
      else if (x >= this.maxX - this.size / 2) this.dir = -1;
      if (body.blocked.left) this.dir = 1;
      if (body.blocked.right) this.dir = -1;
      body.setVelocityX(this.dir * this.speed);
    } else if (this.type === 'hopper') {
      if (this.grounded) {
        body.setVelocityX(0);
        this.hopTimer -= dt;
        const dx = player.body.center.x - body.center.x;
        if (this.hopTimer <= 0 && Math.abs(dx) < 520) {
          this.hopTimer = 0.9 + Math.random() * 0.5;
          let dir = Math.sign(dx) || 1;
          // 순찰 범위를 벗어나는 점프는 하지 않음 (구멍에 빠지지 않게)
          if ((dir < 0 && body.center.x < this.minX + 80) || (dir > 0 && body.center.x > this.maxX - 80)) dir = -dir;
          body.setVelocity(dir * 200, -620);
        }
      }
    }

    if (body.top > LEVEL.height + 100) this.kill(false);
  }

  hurt(dir, damage) {
    if (this.dead) return;
    this.hp -= damage;
    this.flash = 0.08;
    this.stun = 0.28;
    this.body.setVelocity(dir * 320, -260);
    if (this.hp <= 0) this.kill(true);
  }

  kill(withEffect) {
    if (this.dead) return;
    this.dead = true;
    if (withEffect) this.scene.spawnBurst(this.body.center.x, this.body.center.y, COLORS.enemy);
    // 충돌 콜백 도중일 수 있으므로 바로 지우지 않고 비활성화 후 다음 틱에 제거
    this.body.enable = false;
    this.obj.setVisible(false);
    this.scene.time.delayedCall(0, () => this.obj.destroy());
    this.scene.onEnemyKilled(this, withEffect);
  }
}
