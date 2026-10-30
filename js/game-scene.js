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
    this.deaths = 0;
    this.cleared = false;
    this.shurikens = [];

    this.createTextures();
    this.createBackground();

    // 땅 (사방 충돌). 타일이 있으면 판정 사각형은 숨기고 타일로 그린다
    const tiled = Sprites.has(this, GROUND_TILES.top) && Sprites.has(this, GROUND_TILES.platform);
    this.ground = this.physics.add.staticGroup();
    for (const r of L.ground) {
      const rect = this.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, COLORS.ground);
      this.ground.add(rect);
      if (tiled) {
        rect.setVisible(false);
        if (r.x >= 0 && r.x < L.width) {
          // 윗면 한 줄 = 갓돌 있는 돌담 타일, 그 아래는 어두운 돌색
          this.add.rectangle(r.x, r.y, r.w, r.h, COLORS.groundFill).setOrigin(0).setDepth(1);
          this.add.tileSprite(r.x, r.y, r.w, Math.min(32, r.h), GROUND_TILES.top).setOrigin(0).setDepth(1);
        }
      }
    }

    // 얇은 발판 (위에서만 충돌)
    this.platforms = this.physics.add.staticGroup();
    for (const r of L.platforms) {
      const rect = this.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, COLORS.platform);
      this.platforms.add(rect);
      if (tiled) {
        rect.setVisible(false);
        this.add.tileSprite(r.x, r.y, r.w, r.h, GROUND_TILES.platform).setOrigin(0).setDepth(1);
      }
      rect.body.checkCollision.down = false;
      rect.body.checkCollision.left = false;
      rect.body.checkCollision.right = false;
    }

    // 벚꽃나무 (첫 나무는 처음부터 만개)
    this.trees = L.trees.map((t) => new CherryTree(this, t.x, t.y));
    this.trees[0].bloom(false);
    this.activeTree = this.trees[0];

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

    this.boss = this.enemies.find((e) => e.type === 'boss');
    this.createHud();

    // 스토리: data/story 의 장면을 연출 엔진으로 재생한다
    //   ?chapter=ch1  이 맵을 몇 장으로 쓸지 (기본 ch1)
    //   ?scene=S0-7   그 장면 하나만 바로 재생 (테스트용. ?scene=TEST = 모든 연출 명령 확인)
    //   ?memories=18  기억 조각 개수 (진엔딩 분기 확인용)
    const params = new URLSearchParams(location.search);
    this.chapter = params.get('chapter') || 'ch1';
    this.chapterNo = Math.max(1, STORY_FILES.indexOf(this.chapter));
    this.stageNo = 1;
    this.stageName = `${this.chapterNo}-1`;
    this.checkpointNo = 0;
    this.stageCheckpoint = 0;
    this.bossDisplayName = '???';
    if (params.get('memories')) this.registry.set('memories', Array.from({ length: +params.get('memories') }, (_, i) => i + 1));
    this.story = new StoryEngine(this);
    this.firedTriggers = new Set();
    this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.tapped = false;
    this.input.on('pointerdown', () => { this.tapped = true; });
    const only = params.get('scene') || params.get('story');
    if (only && !this.registry.get('sceneTestDone')) {
      this.registry.set('sceneTestDone', true);
      this.registry.set('chapterStarted', true);
      this.story.play(only === 'test_dialogue' ? 'TEST' : only);
    } else if (!this.registry.get('chapterStarted')) {
      // 장 시작 장면 → 첫 스테이지 시작 장면 (R 재시작 시엔 생략)
      this.registry.set('chapterStarted', true);
      const S = this.story;
      S.playAll([...S.find(this.chapter, (t) => t.type === 'chapterStart'),
        ...S.find(this.chapter, (t) => t.type === 'stageStart' && t.stage === this.stageName)]);
    }

    this.input.keyboard.on('keydown-R', () => this.scene.restart());

    // 디버그: H 로 판정 박스 표시 (재시작해도 유지)
    this.debugGfx = this.add.graphics().setDepth(500);
    const applyDebug = () => {
      const on = !!this.registry.get('debugHitbox');
      this.debugGfx.setVisible(on);
      UI.debug(on);
      document.body.classList.toggle('debug-notes', on); // 연출 메모(note)도 함께 표시
      if (!on) this.debugGfx.clear();
    };
    applyDebug();
    this.input.keyboard.on('keydown-H', () => {
      this.registry.set('debugHitbox', !this.registry.get('debugHitbox'));
      applyDebug();
    });
    const sync = () => {
      const dt = Math.min(this.game.loop.delta / 1000, 1 / 30);
      this.player.syncVisual(dt);
      for (const e of this.enemies) e.syncVisual(dt);
      if (this.debugGfx.visible) this.drawDebug();
      UI.update();
    };
    this.events.on('postupdate', sync);
    this.events.once('shutdown', () => {
      this.events.off('postupdate', sync);
      this.controls.destroy();
    });
  }

  createTextures() {
    if (this.textures.exists('shuriken')) return;
    // 수리검(1.5배): 흰 테두리 + 빨간 빛. 어두운 배경에서도 보이도록 캔버스 그림자로 빛을 낸다
    const star = (ctx, cx, cy, outer, inner) => {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4, r = i % 2 === 0 ? outer : inner;
        ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      ctx.closePath();
    };
    const sh = this.textures.createCanvas('shuriken', 48, 48);
    let ctx = sh.getContext();
    ctx.shadowColor = 'rgba(255, 40, 40, 0.95)';
    ctx.shadowBlur = 10;
    star(ctx, 24, 24, 13.5, 4);
    ctx.fillStyle = '#2b2b2b';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(24, 24, 2.2, 0, Math.PI * 2); ctx.fill();
    sh.refresh();
    // 닌자 던지기 예고용 반짝임
    const gl = this.textures.createCanvas('glint', 32, 32);
    ctx = gl.getContext();
    ctx.shadowColor = 'rgba(255, 50, 50, 1)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(16, 3); ctx.lineTo(18.5, 13.5); ctx.lineTo(29, 16); ctx.lineTo(18.5, 18.5);
    ctx.lineTo(16, 29); ctx.lineTo(13.5, 18.5); ctx.lineTo(3, 16); ctx.lineTo(13.5, 13.5);
    ctx.closePath(); ctx.fill();
    gl.refresh();
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

  // 맨 뒤부터: 남색 그라데이션(빈틈 메우기) → bg_far(밤하늘·달, 0.05) → bg_mid(마을, 0.3) → bg_near(난간, 0.6)
  // 위치·배율은 manifest 에 기록된 값(screenBottom, displayScale, parallax)을 따른다
  createBackground() {
    const g = this.add.graphics().setScrollFactor(0).setDepth(-100);
    g.fillGradientStyle(0x0b0d22, 0x0b0d22, 0x262a52, 0x262a52, 1).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    const groundScrollY = LEVEL.height - GAME_HEIGHT; // 땅에 서 있을 때 카메라 위치
    ['bg_far', 'bg_mid', 'bg_near'].forEach((name, i) => {
      const s = Sprites.sheet(name);
      if (!s || !this.textures.exists(name)) return;
      const S = s.displayScale;
      const p = s.parallax;
      const y = s.screenBottom - s.height * S + groundScrollY * p;
      const img = this.add.image(0, y, name).setOrigin(0, 0).setScale(S).setScrollFactor(p, p).setDepth(-90 + i * 10);
      // 앞쪽 레이어일수록 어둡게 (manifest 의 tint) — 캐릭터가 배경에 묻히지 않게
      if (s.tint) img.setTint(Phaser.Display.Color.HexStringToColor(s.tint).color);
    });
  }

  // 글자(사망·KO·안내·보스 이름·결과)는 HTML 글자 레이어(UI)에 그린다. 그림만 캔버스에
  createHud() {
    UI.reset(this);
    UI.setDeaths(0);
    UI.setKO(0);
    UI.hint('A/D 이동 · Space 점프 · J 공격 · K 대시 · U 대쉬베기 · I 발도 · R 재시작');
    this.createSkillHud();
  }

  // 화면 하단: 스킬 쿨타임 2칸 + 벚꽃 스택 5칸
  createSkillHud() {
    const cx = GAME_WIDTH / 2;
    const y = GAME_HEIGHT - 40;
    const depth = 100;
    this.add.rectangle(cx, y, 330, 64, 0x0d0c16, 0.55).setScrollFactor(0).setDepth(depth);
    const icons = Sprites.has(this, 'ui_icons');

    // frame: ui_icons 의 칸 (0 대쉬 스킬, 1 발도 스킬)
    const makeIcon = (x, name, key, frame) => {
      const icon = {};
      if (icons) {
        icon.bg = this.add.image(x, y, 'ui_icons', frame).setScrollFactor(0).setDepth(depth);
        icon.label = this.add.text(0, 0, '').setVisible(false);
      } else {
        icon.bg = this.add.rectangle(x, y, 48, 48, 0x222222).setScrollFactor(0).setDepth(depth);
        icon.label = this.add.text(x, y + 2, name, { fontFamily: 'system-ui, sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#fff' })
          .setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);
      }
      // 쿨타임 동안 위에서부터 덮이는 막 (그림) + 키 글자·남은 초 (HTML)
      icon.shade = this.add.rectangle(x, y + 24, 48, 48, 0x0d0c16, 0.7).setOrigin(0.5, 1)
        .setScrollFactor(0).setDepth(depth + 2);
      icon.label_i = UI.addSkillLabel(x, y, key);
      icon.border = this.add.rectangle(x, y, 52, 52).setStrokeStyle(3, 0xff7aa2).setScrollFactor(0)
        .setDepth(depth + 3).setVisible(false);
      return icon;
    };
    this.skillIcons = {
      slash: makeIcon(cx - 130, '베기', 'U', 0),
      iaido: makeIcon(cx - 74, '발도', 'I', 1),
    };

    // 벚꽃 스택: ui_icons 2번(빈칸) / 3번(채움)을 반 크기로
    this.sakuraTex = icons ? { off: ['ui_icons', 2], on: ['ui_icons', 3], scale: 0.5 } : { off: ['sakura-off'], on: ['sakura-on'], scale: 1 };
    this.sakuraIcons = [];
    for (let i = 0; i < TUNING.sakuraMax; i++) {
      this.sakuraIcons.push(this.add.image(cx - 20 + i * 30, y, ...this.sakuraTex.off).setScale(this.sakuraTex.scale)
        .setScrollFactor(0).setDepth(depth));
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
    UI.setCooldown(icon.label_i, frac > 0 ? remaining.toFixed(1) : '');
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
    UI.setDeaths(this.deaths);
    UI.setKO(this.kills);
    const boss = this.boss;
    const bossOn = !!boss && !boss.dormant && !boss.dead;
    UI.boss(bossOn, this.bossDisplayName, bossOn ? boss.hp / boss.cfg.hp : 0);

    const sk = this.player.skills;
    this.updateSkillIcon(this.skillIcons.slash, this.touchSkillBtns.slash, sk.slashCooldown,
      TUNING.dashSlash.cooldown, sk.slashing);
    // 발도는 준비 중이면 테두리 강조
    this.updateSkillIcon(this.skillIcons.iaido, this.touchSkillBtns.iaido, sk.iaidoCooldown,
      TUNING.iaido.cooldown, sk.charging);

    if (sk.sakura !== this.lastSakura) {
      this.sakuraIcons.forEach((icon, i) => {
        const on = i < sk.sakura;
        icon.setTexture(...(on ? this.sakuraTex.on : this.sakuraTex.off));
        // 새로 켜진 칸은 톡 튀게
        if (on && i >= this.lastSakura) {
          const base = this.sakuraTex.scale;
          icon.setScale(base * 1.6);
          this.tweens.add({ targets: icon, scale: base, duration: 200, ease: 'Back.easeOut' });
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
      if (!this.cutscene) this.physics.world.resume();
    }

    this.controls.update();
    const tapped = this.tapped;
    this.tapped = false;

    // 연출 엔진: 멈추는 컷신이면 게임은 여기서 멈춘다 (조작 가능 컷신이면 계속 진행)
    const c = this.controls.state;
    const enter = Phaser.Input.Keyboard.JustDown(this.enterKey);
    this.story.update(dt, {
      advance: c.jump.pressed || c.attack.pressed || tapped || enter,
      advanceSoft: tapped || enter,
      skip: Phaser.Input.Keyboard.JustDown(this.escKey),
      left: c.left.pressed, right: c.right.pressed,
      confirm: c.jump.pressed || c.attack.pressed || enter,
    });
    if (this.story.blocking) return;

    if (this.cleared) {
      const c = this.controls.state;
      if (this.canRestart && (c.jump.pressed || c.attack.pressed)) this.scene.restart();
      return;
    }

    const player = this.player;
    if (!player.dead) player.update(dt, this.controls);
    for (const e of this.enemies) e.update(dt, player);
    for (const t of this.trees) t.update(dt);

    this.checkAttackHits();
    player.skills.checkSlashHits(this.enemies);
    this.updateShurikens(dt);

    // 맵 위치 트리거: 스테이지 시작 / 보스 전 (같은 프레임의 체크포인트보다 먼저)
    LEVEL.storyTriggers.forEach((t, i) => {
      if (this.firedTriggers.has(i) || player.body.center.x < t.x || player.dead) return;
      this.firedTriggers.add(i);
      if (t.event === 'stageStart') this.onStageStart(t.stage);
      else if (t.event === 'bossBefore') this.onBossBefore();
    });
    // 벚꽃나무 활성화 = 체크포인트. 그 번호의 장면이 있으면 재생, 없으면 한마디(풀)
    for (const t of this.trees) {
      if (!t.active && t.isNear(player.body)) {
        t.bloom();
        this.activeTree = t;
        this.onCheckpoint();
      }
    }

    // 낙사
    if (!player.dead && player.body.top > LEVEL.height + 60) this.killPlayer(true);

    // 보스전 중 체력 조건 장면
    if (this.boss && !this.boss.dormant && !this.boss.dead) {
      const ratio = this.boss.hp / this.boss.cfg.hp;
      const ids = this.story.find(this.chapter, (t) => t.type === 'bossCondition' && t.condition && t.condition.hpBelow > 0 &&
        ratio <= t.condition.hpBelow && !t.condition.phase);
      if (ids.length) this.story.playAll(ids);
    }

    // 카메라 룩어헤드: 바라보는 방향을 더 보여줌
    this.lookAhead += (-player.facing * 90 - this.lookAhead) * Math.min(1, dt * 3);
    this.cameras.main.setFollowOffset(this.lookAhead, 40);

    this.updateHud();
  }

  // 판정 표시: 초록 = 주인공 몸통, 빨강 = 적 몸통, 노랑 = 주인공 공격, 주황 = 적 베기, 분홍 = 발도 범위, 흰 원 = 수리검
  drawDebug() {
    const g = this.debugGfx;
    g.clear();
    const box = (r, color, alpha = 1, fill = 0) => {
      if (fill) g.fillStyle(color, fill).fillRect(r.x, r.y, r.width, r.height);
      g.lineStyle(1, color, alpha).strokeRect(r.x + 0.5, r.y + 0.5, r.width - 1, r.height - 1);
    };
    const p = this.player;
    box(this.bodyRect(p.body), 0x16a34a, 1, 0.15);
    const atk = p.getAttackRect();
    if (atk) box(atk, 0xeab308, 1, 0.25);
    if (p.skills.charging) {
      const I = TUNING.iaido, b = p.body;
      const x0 = p.facing > 0 ? b.right : b.left - I.range;
      box(new Phaser.Geom.Rectangle(x0, b.center.y - I.height / 2, I.range, I.height), 0xff7aa2, 0.9);
    }
    for (const e of this.enemies) {
      if (e.dead) continue;
      box(this.bodyRect(e.body), 0xdc2626, 1, 0.12);
      if (e.type !== 'thrower' && (e.state === 'windup' || e.state === 'attack')) {
        box(e.getSwordRect(), 0xf97316, 1, e.state === 'attack' ? 0.3 : 0);
      }
    }
    g.lineStyle(1, 0xffffff, 1);
    for (const s of this.shurikens) g.strokeCircle(s.x, s.y, TUNING.shuriken.radius);
  }

  bodyRect(body) {
    return new Phaser.Geom.Rectangle(body.x, body.y, body.width, body.height);
  }

  // 적을 벨 때 공통 타격감: 짧은 히트스톱 + 화면 흔들림
  hitImpact() {
    this.doHitStop(TUNING.hitStop);
    this.cameras.main.shake(TUNING.hitShake.duration, TUNING.hitShake.intensity);
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
      this.hitImpact();
    }
  }

  // 적의 공격이 플레이어에게 닿았을 때.
  // 반환: 'ignored'(무적) / 'parried'(발도 패링) / 'interrupted'(발도 끊김) / 'killed'
  hitPlayer(fromX) {
    const player = this.player;
    const skills = player.skills;
    if (player.dead || this.cleared) return 'ignored';
    if (skills.parrying) return 'parried';
    if (player.invuln > 0 || skills.slashInvuln || player.dashing) return 'ignored';
    if (skills.charging) {
      // 발도 준비 후반: 스킬이 끊기고 쿨타임 시작. 죽지는 않음
      skills.interruptIaido();
      player.stagger(fromX);
      this.popText(player.body.center.x, player.body.bottom - 110, '끊김', '#cfcfcf');
      this.cameras.main.shake(160, 0.008);
      this.doHitStop(0.08);
      return 'interrupted';
    }
    this.killPlayer();
    return 'killed';
  }

  // 검사의 베기 판정. 맞혔으면(무시되지 않았으면) true
  enemySwordHit(enemy, rect) {
    if (!Phaser.Geom.Rectangle.Overlaps(rect, this.bodyRect(this.player.body))) return false;
    const result = this.hitPlayer(enemy.body.center.x);
    if (result === 'parried') this.player.skills.parry(enemy);
    return result !== 'ignored';
  }

  // fell: 구멍에 떨어짐 → 바로 부활. 아니면 사망 애니메이션을 보여 준 뒤 부활
  killPlayer(fell = false) {
    const player = this.player;
    if (player.dead) return;
    const x = player.body.center.x;
    const y = Math.min(player.body.center.y, LEVEL.height - 20);
    this.deaths += 1;
    this.spawnBurst(x, y, 0xd62828, 12);
    this.cameras.main.shake(220, 0.01);
    this.clearShurikens();
    if (fell || !player.useSprite) {
      this.respawnPlayer();
      return;
    }
    player.die();
    this.time.delayedCall(TUNING.deathAnimTime * 1000, () => this.respawnPlayer());
  }

  // 마지막으로 만개시킨 벚꽃나무에서 부활
  respawnPlayer() {
    const player = this.player;
    const t = this.activeTree;
    player.respawn(t.x + 24, t.y - TUNING.playerBody.height / 2 - 2);
    this.cameras.main.centerOn(t.x + 24 + 90, t.y - 100);
    this.lookAhead = -90;
    this.spawnPetals(t.x, t.y - 60, 18, 80);
  }

  // ───────── 수리검 ─────────

  spawnShuriken(enemy, player, angleOffset = 0) {
    const S = TUNING.shuriken;
    const x = enemy.body.center.x + enemy.facing * 14;
    const y = enemy.body.center.y - 6;
    const angle = Math.atan2(player.body.center.y - y, player.body.center.x - x) + angleOffset;
    const img = this.add.image(x, y, 'shuriken').setDepth(14);
    this.shurikens.push({
      img, x, y, vx: Math.cos(angle) * S.speed, vy: Math.sin(angle) * S.speed,
      life: S.life, owner: 'enemy', source: enemy, trail: 0,
    });
  }

  updateShurikens(dt) {
    const S = TUNING.shuriken;
    const player = this.player;
    const playerRect = this.bodyRect(player.body);
    const attackRect = player.getAttackRect();

    for (let i = this.shurikens.length - 1; i >= 0; i--) {
      const s = this.shurikens[i];
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.img.setPosition(s.x, s.y);
      s.img.angle += 1100 * dt; // 회전
      // 짧은 잔상 꼬리
      s.trail -= dt;
      if (s.trail <= 0) {
        s.trail = S.trailInterval;
        const ghost = this.add.image(s.x, s.y, 'shuriken').setDepth(13).setAngle(s.img.angle)
          .setTint(s.owner === 'enemy' ? 0xff5050 : 0xff9eb8).setAlpha(0.5);
        this.tweens.add({ targets: ghost, alpha: 0, scale: 0.55, duration: 150, onComplete: () => ghost.destroy() });
      }

      if (s.life <= 0 || this.isSolidAt(s.x, s.y)) {
        this.removeShuriken(i, true);
        continue;
      }
      const circle = new Phaser.Geom.Circle(s.x, s.y, S.radius);

      if (s.owner === 'enemy') {
        // 기본 공격으로 쳐낼 수 있다
        if (attackRect && Phaser.Geom.Intersects.CircleToRectangle(circle, attackRect)) {
          this.removeShuriken(i, true);
          this.doHitStop(0.03);
          continue;
        }
        if (!Phaser.Geom.Intersects.CircleToRectangle(circle, playerRect)) continue;
        const result = this.hitPlayer(s.x);
        if (result === 'parried') {
          this.reflectShuriken(s);
          player.skills.parryFx(s.x, s.y);
        } else if (result === 'killed') {
          break; // 사망 시 수리검은 모두 정리되었음
        } else if (result !== 'ignored') {
          this.removeShuriken(i, false);
        }
      } else {
        // 패링으로 되돌아간 수리검은 적을 맞힌다
        for (const e of this.enemies) {
          if (e.dead || !Phaser.Geom.Intersects.CircleToRectangle(circle, this.bodyRect(e.body))) continue;
          e.hurt(Math.sign(s.vx) || 1, S.reflectDamage);
          this.showDamage(e.body.center.x, e.body.center.y - 20, S.reflectDamage, '#ff8fb1');
          this.hitImpact();
          this.removeShuriken(i, true);
          break;
        }
      }
    }
  }

  reflectShuriken(s) {
    const S = TUNING.shuriken;
    const speed = Math.hypot(s.vx, s.vy) * S.reflectSpeedMult;
    if (s.source && !s.source.dead) {
      const a = Math.atan2(s.source.body.center.y - s.y, s.source.body.center.x - s.x);
      s.vx = Math.cos(a) * speed;
      s.vy = Math.sin(a) * speed;
    } else {
      s.vx = -s.vx * S.reflectSpeedMult;
      s.vy = -s.vy * S.reflectSpeedMult;
    }
    s.owner = 'player';
    s.life = S.life;
    s.img.setTint(0xff7aa2);
  }

  removeShuriken(i, withSpark) {
    const s = this.shurikens[i];
    if (withSpark) this.spawnBurst(s.x, s.y, 0x555555, 4);
    s.img.destroy();
    this.shurikens.splice(i, 1);
  }

  clearShurikens() {
    for (let i = this.shurikens.length - 1; i >= 0; i--) this.removeShuriken(i, false);
  }

  // 수리검은 땅·벽에 박히고 얇은 발판은 통과한다
  isSolidAt(x, y) {
    if (y > LEVEL.height + 50 || x < -50 || x > LEVEL.width + 50) return true;
    return LEVEL.ground.some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  }

  // 몸끼리 부딪히는 건 피해가 없다. 위에서 떨어지면 밟기만 판정
  onPlayerTouchEnemy(enemy) {
    const player = this.player;
    if (!enemy || enemy.dead || player.dead || player.skills.busy) return;
    const pb = player.body;
    const eb = enemy.body;
    if (pb.velocity.y > 0 && pb.bottom - eb.top < 18) {
      enemy.hurt(Math.sign(eb.center.x - pb.center.x) || player.facing, TUNING.stompDamage);
      player.bounce(TUNING.stompBounce);
      this.hitImpact();
    }
  }

  onEnemyKilled(enemy, byPlayer) {
    if (byPlayer) this.kills += 1;
    if (enemy.type === 'boss') {
      this.doHitStop(0.25);
      this.cameras.main.shake(400, 0.015);
      this.spawnPetals(enemy.body.center.x, enemy.body.center.y, 60, 200);
      // 보스 후 → 장 끝 장면을 보고 클리어
      this.time.delayedCall(1200, async () => {
        const S = this.story;
        await S.playAll([...S.find(this.chapter, (t) => t.type === 'bossAfter'), ...S.find(this.chapter, (t) => t.type === 'chapterEnd')]);
        this.triggerClear();
      });
    }
  }

  // ───────── 스토리 트리거 ─────────
  onCheckpoint() {
    this.checkpointNo += 1;
    this.stageCheckpoint += 1;
    const n = this.checkpointNo;
    const ids = this.story.find(this.chapter, (t) => t.type === 'checkpoint' && (t.n === n || (Array.isArray(t.n) && t.n.includes(n))));
    if (ids.length) this.story.playAll(ids.slice(0, 1));
    else this.story.checkpointChatter(this.chapter, this.stageCheckpoint === 1);
  }

  onStageStart(no) {
    this.stageNo = no;
    this.stageName = `${this.chapterNo}-${no}`;
    this.stageCheckpoint = 0;
    this.story.playAll(this.story.find(this.chapter, (t) => t.type === 'stageStart' && t.stage === this.stageName));
  }

  async onBossBefore() {
    await this.story.playAll(this.story.find(this.chapter, (t) => t.type === 'bossBefore'));
    this.wakeBoss();
  }

  showStageTitle(title, subtitle) {
    UI.stageTitle(title, subtitle);
  }

  wakeBoss() {
    if (!this.boss || this.boss.dead) return;
    this.boss.dormant = false;
    this.boss.setState('chase');
  }

  doHitStop(seconds) {
    this.hitStopTimer = Math.max(this.hitStopTimer, seconds);
    this.physics.world.pause();
  }

  triggerClear() {
    this.cleared = true;
    this.physics.world.pause();
    UI.banner(`<b>끝</b>처치 ${this.kills} &nbsp;·&nbsp; 사망 ${this.deaths}<small>점프 / 공격으로 다시 시작</small>`);
    this.allowRestartSoon();
  }

  allowRestartSoon() {
    this.canRestart = false;
    this.time.delayedCall(500, () => { this.canRestart = true; });
  }

  // 떠오르는 글자는 HTML 레이어에 (월드 좌표를 따라 움직임)
  showDamage(x, y, amount, color = '#fff', size = 20) {
    UI.float(x, y, String(amount), { color, size, kind: 'damage', ms: 650 });
  }

  popText(x, y, text, color) {
    UI.float(x, y, text, { color, size: 24, kind: 'pop', ms: 750 });
  }

  // 벚꽃잎이 사방으로 터졌다가 천천히 떨어진다
  spawnPetals(x, y, count, spread) {
    for (let i = 0; i < count; i++) {
      const p = Sprites.petal(this, x, y).setDepth(13).setAngle(Phaser.Math.Between(0, 360));
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
