class GameScene extends Phaser.Scene {
  constructor() {
    super('game');
  }

  create() {
    // 스토리: data/story 의 장면을 컷신 엔진(StoryPlayer)으로 재생한다. 위치 ↔ 장면은 STORY_MAP[장], 맵은 levelFor(장)
    //   ?chapter=ch1  몇 장으로 시작할지 (기본 ch1. 개발 메뉴에서 장면을 고르면 그 장으로 바뀜)
    //   ?scene=S0-7   그 장면 하나만 바로 재생 (테스트용. ?scene=TEST = 모든 연출 명령 확인)
    //   ?memories=18  기억 조각 개수 (진엔딩 분기 확인용)
    //   ?dev=1        개발 모드 (F1 개발 메뉴에서도 켜고 끔)
    const params = new URLSearchParams(location.search);
    // ?scene= 만 주면 그 장면이 속한 장(맵)으로 시작한다
    const sceneParam = params.get('scene');
    const sceneChapter = sceneParam && STORY_FILES.find((id) => {
      const ch = this.cache.json.get('story-' + id);
      return ch && STORY_MAP[id] && ch.scenes.some((s) => s.id === sceneParam);
    });
    this.chapter = this.registry.get('chapterOverride') || params.get('chapter') || sceneChapter || 'ch1';
    this.chapterNo = STORY_FILES.indexOf(this.chapter);
    this.storyMap = STORY_MAP[this.chapter] || {};
    window.LEVEL = levelFor(this.chapter);
    const L = LEVEL;
    UI.reset(this); // 글자 레이어 비우기 (이름표 등을 만들기 전에)
    this.physics.world.setBounds(0, 0, L.width, L.height + 400);
    this.cameras.main.setBackgroundColor(COLORS.background);
    this.cameras.main.setBounds(0, 0, L.width, L.height);

    this.hitStopTimer = 0;
    this.kills = 0;  // 斬 (결과창·상단 카운터)
    this.deaths = 0; // 死
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
          // 윗면 한 줄 = 갓돌 있는 돌담 타일, 그 아래는 돌담 타일을 더 어둡게 (검은 띠 대신).
          // 배경과 어울리게 밝기 70% (아래는 55%)
          if (Sprites.has(this, GROUND_TILES.fill)) {
            this.add.tileSprite(r.x, r.y, r.w, r.h, GROUND_TILES.fill).setOrigin(0).setDepth(1).setTint(GROUND_TINT.fill);
          } else {
            this.add.rectangle(r.x, r.y, r.w, r.h, COLORS.groundFill).setOrigin(0).setDepth(1);
          }
          this.add.tileSprite(r.x, r.y, r.w, Math.min(32, r.h), GROUND_TILES.top).setOrigin(0).setDepth(1).setTint(GROUND_TINT.top);
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
        this.add.tileSprite(r.x, r.y, r.w, r.h, GROUND_TILES.platform).setOrigin(0).setDepth(1).setTint(GROUND_TINT.top);
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

    // 적. group 이 있는 무리는 gameplay 'spawn' 때 나타난다
    this.enemies = [];
    this.enemyGroup = this.physics.add.group();
    this.pendingGroups = {};
    for (const data of L.enemies) {
      if (data.group) (this.pendingGroups[data.group] = this.pendingGroups[data.group] || []).push(data);
      else this.addEnemy(data);
    }

    // 장식 나무, 이야기 속 인물, 막힌 길, 기억 조각, 화면 분위기
    this.decorTrees = {};
    for (const d of L.decorTrees || []) this.decorTrees[d.id] = this.createDecorTree(d);
    this.npcs = {};
    for (const d of L.npcs || []) this.npcs[d.id] = new Npc(this, d);
    this.gameplay = new StoryGameplay(this);
    this.nonLethal = null; // 튜토리얼·패배 이벤트: 맞아도 죽지 않을 때 (fromX) => {}
    this.gates = this.physics.add.staticGroup();
    for (const g of L.gates || []) {
      const rect = this.add.rectangle(g.x, L.height / 2, 20, L.height * 2).setVisible(false);
      rect.until = g.until;
      this.gates.add(rect);
    }
    this.createMemories(L);
    this.setupCtxHints(L);
    this.mood = null;
    this.moodLayer = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0).setOrigin(0).setScrollFactor(0).setDepth(-60);
    this.emberTimer = 0;

    this.physics.add.collider(this.player.obj, this.ground);
    this.physics.add.collider(this.player.obj, this.platforms);
    this.physics.add.collider(this.player.obj, this.gates);
    this.physics.add.collider(this.enemyGroup, this.ground);
    this.physics.add.collider(this.enemyGroup, this.platforms);
    this.physics.add.overlap(this.player.obj, this.enemyGroup, (p, eObj) => this.onPlayerTouchEnemy(eObj.enemy));

    const cam = this.cameras.main;
    cam.startFollow(this.player.obj, true, 0.14, 0.12);
    cam.setDeadzone(60, 90);
    this.lookAhead = 0;

    this.boss = this.enemies.find((e) => e.type === 'boss');
    // 프롤로그: 대쉬베기·발도는 연습장에서 배우기 전엔 못 씀
    this.skillLocks = new Set(L === LEVELS.prologue ? ['dashSlash', 'iaido'] : []);
    this.createHud();
    this.setMood(L.mood || null);

    this.setStage(1);
    this.checkpointNo = 0;
    this.bossDisplayName = '???';
    if (params.get('memories') && this.registry.get('memories') == null) {
      this.registry.set('memories', Array.from({ length: +params.get('memories') }, (_, i) => i + 1));
    }
    this.story = new StoryPlayer(this);
    this.openGates();
    this.events.on('storySceneEnd', () => this.openGates());
    this.firedTriggers = new Set();
    this.firedBossHp = new Set();
    this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.tapped = false;
    this.input.on('pointerdown', () => { this.tapped = true; });
    const only = this.registry.get('devPlay') || (!this.registry.get('sceneTestDone') && (params.get('scene') || params.get('story')));
    this.registry.remove('devPlay');
    const startStory = () => {
      UI.loading(false);
      if (only) {
        // 장면 하나만 (개발 메뉴 / ?scene=). 맵 위치 장면이 줄줄이 따라 나오지 않게 위치 트리거는 막아 둔다
        (this.storyMap.triggers || []).forEach((t, i) => this.firedTriggers.add(i));
        this.registry.set('sceneTestDone', true);
        this.registry.set('chapterStarted', true);
        this.story.play(only === 'test_dialogue' ? 'TEST' : only);
      } else if (!this.registry.get('chapterStarted')) {
        // 장 시작 장면들 (R 재시작 시엔 생략)
        this.registry.set('chapterStarted', true);
        this.story.playEntries(this.storyMap.start).then(() => {
          if (this.storyMap.then === 'clear') this.triggerClear();
        });
      }
    };
    // 로딩 화면: 이 장(과 따로 재생할 장면의 장)의 CG·컷신 그림을 모두 불러온 뒤 시작 (컷신 도중에 불러오지 않게)
    const onlyScene = only && this.story.scenes[only === 'test_dialogue' ? 'TEST' : only];
    const chapters = [this.chapter, onlyScene && onlyScene.chapter].filter(Boolean);
    const paths = CgCache.pathsOf(this.story, chapters);
    if (paths.every((p) => CgCache.status(p) === 'ok' || CgCache.status(p) === 'missing')) {
      startStory();
    } else {
      this.storyLoading = true;
      UI.loading(true);
      CgCache.preload(this.story, chapters).then(() => {
        if (!this.sys.isActive() && !this.sys.isPaused()) return; // 그사이 장면이 다시 시작됨
        this.storyLoading = false;
        UI.loading(false);
        startStory();
      });
    }

    this.input.keyboard.on('keydown-R', () => this.restartChapter());

    // 디버그: H 로 판정 박스 표시 (재시작해도 유지)
    this.debugGfx = this.add.graphics().setDepth(500);
    const applyDebug = () => {
      const on = !!this.registry.get('debugHitbox');
      this.debugGfx.setVisible(on);
      UI.debug(on);
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
    if (!this.textures.exists('scarecrow')) {
      // 연습장 허수아비: 짚 몸통 + 나무 십자 + 삿갓
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x5a4030).fillRect(21, 20, 6, 60).fillRect(4, 34, 40, 5);
      g.fillStyle(0xc9a35a).fillRoundedRect(12, 30, 24, 34, 6);
      g.fillStyle(0xa8823e).fillRect(12, 44, 24, 3).fillRect(12, 54, 24, 3);
      g.fillStyle(0xe0c48a).fillCircle(24, 22, 9);
      g.fillStyle(0x6b5a3a).fillTriangle(8, 18, 40, 18, 24, 4);
      g.generateTexture('scarecrow', 48, 80);
      g.destroy();
    }
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
    this.stageBgs = [];
    if (LEVEL.backgrounds) return this.createStageBackgrounds(groundScrollY);
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

  // 구역 배경: 한 장짜리 그림을 구역마다. 그림 아래 바닥 띠(floorBand) 윗선이 땅 윗면에 온다 (screenBottom).
  // 텍스처는 '반전A, A, 반전A' 띠라 구역 안에서 어디로 가도 빈 곳이 없다
  createStageBackgrounds(groundScrollY) {
    LEVEL.backgrounds.forEach((d, i) => {
      const s = Sprites.sheet(d.key);
      if (!s || !this.textures.exists(d.key)) return;
      const S = s.displayScale;
      const p = s.parallax;
      const W = s.width;
      // 카메라 중심이 anchorX 일 때 그림의 anchor 위치(가운데 A 기준)가 화면 가운데
      const x = GAME_WIDTH / 2 + (d.anchorX - GAME_WIDTH / 2) * p - (W + s.anchor * W) * S;
      const y = s.screenBottom - s.height * S + groundScrollY * p;
      const img = this.add.image(x, y, d.key).setOrigin(0, 0).setScale(S).setScrollFactor(p, p).setDepth(-90 + i);
      this.stageBgs.push({ ...d, img });
    });
    this.updateStageBackgrounds();
  }

  // 구역 경계 앞뒤 BG_FADE px 동안 다음 배경이 겹쳐 나타난다 (앞 배경은 그 밑에 그대로)
  updateStageBackgrounds() {
    const F = 160;
    const cx = this.cameras.main.scrollX + GAME_WIDTH / 2;
    this.stageBgs.forEach((b, i) => {
      const on = cx >= b.x0 - F && cx <= b.x1 + F;
      b.img.setVisible(on);
      if (on) b.img.setAlpha(i === 0 ? 1 : Phaser.Math.Clamp((cx - (b.x0 - F)) / (2 * F), 0, 1));
    });
  }

  // HUD(카운터·스킬 칸·칼집 게이지·보스·결과)는 모두 HTML 글자 레이어(UI)에. 그림만 캔버스에
  createHud() {
    this.touchSkillBtns = {
      slash: document.querySelector('.btn[data-action="skill1"]'),
      iaido: document.querySelector('.btn[data-action="skill2"]'),
    };
    this.applySkillLocks();
  }

  updateHud() {
    const boss = this.boss;
    const bossOn = !!boss && !boss.dormant && !boss.dead;
    UI.boss(bossOn, this.bossDisplayName, bossOn ? boss.hp / boss.cfg.hp : 0);
    UI.setCounters(this.deaths, this.kills);

    const sk = this.player.skills;
    const lock = this.skillLocks;
    const slash = Phaser.Math.Clamp(sk.slashCooldown / TUNING.dashSlash.cooldown, 0, 1);
    const iaido = Phaser.Math.Clamp(sk.iaidoCooldown / TUNING.iaido.cooldown, 0, 1);
    UI.updateSkills({
      slash: { frac: slash, active: sk.slashing, locked: lock.has('dashSlash') },
      iaido: { frac: iaido, active: sk.charging, locked: lock.has('iaido') }, // 발도는 준비 중이면 테두리 빛남
      sakura: sk.sakura,
      sakuraLocked: lock.has('dashSlash'),
    });
    // 터치 버튼도 쿨타임 동안 흐리게
    for (const [k, frac] of [['slash', slash], ['iaido', iaido]]) {
      const btn = this.touchSkillBtns[k];
      const cd = frac > 0;
      if (btn && btn.classList.contains('cooldown') !== cd) btn.classList.toggle('cooldown', cd);
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

    if (this.storyLoading) return; // 장 시작 로딩 중
    this.controls.update();
    const tapped = this.tapped;
    this.tapped = false;

    // 컷신 엔진: 잠긴 컷신이면 게임은 여기서 멈춘다 (조작 가능 컷신이면 계속 진행)
    const c = this.controls.state;
    const enter = Phaser.Input.Keyboard.JustDown(this.enterKey);
    const pointerHeld = this.input.manager.pointers.some((p) => p.isDown);
    this.story.update(dt, {
      advance: c.jump.pressed || c.attack.pressed || tapped || enter,
      advanceSoft: tapped || enter,
      hold: c.jump.down || c.attack.down || this.enterKey.isDown || pointerHeld,
      holdSoft: this.enterKey.isDown || pointerHeld,
      skip: Phaser.Input.Keyboard.JustDown(this.escKey),
      left: c.left.pressed, right: c.right.pressed,
      confirm: c.jump.pressed || c.attack.pressed || enter,
    });
    if (this.story.blocking) return;

    if (this.cleared) {
      const c = this.controls.state;
      if (this.canRestart && (c.jump.pressed || c.attack.pressed || tapped)) this.scene.restart();
      return;
    }

    const player = this.player;
    if (!player.dead) player.update(dt, this.controls);
    for (const e of this.enemies) e.update(dt, player);
    for (const t of this.trees) t.update(dt);
    for (const t of Object.values(this.decorTrees)) t.update(dt);
    if (this.stageBgs.length) this.updateStageBackgrounds();
    this.updateCtxHints();
    this.updateMood(dt);
    this.updateMemories();

    this.checkAttackHits();
    player.skills.checkSlashHits(this.enemies);
    this.updateShurikens(dt);

    // 맵 위치 트리거 (STORY_MAP[장].triggers). 같은 프레임의 체크포인트보다 먼저
    (this.storyMap.triggers || []).forEach((t, i) => {
      if (this.firedTriggers.has(i) || player.body.center.x < t.x || player.dead) return;
      this.firedTriggers.add(i);
      this.onStoryTrigger(t);
    });
    // 벚꽃나무 활성화 = 체크포인트. 그 나무에 붙은 장면이 있으면 재생, 없으면 한마디(풀)
    this.trees.forEach((t, i) => {
      if (!t.active && t.isNear(player.body)) {
        t.bloom();
        this.activeTree = t;
        this.onCheckpoint(i);
      }
    });

    // 낙사
    if (!player.dead && player.body.top > LEVEL.height + 60) this.killPlayer(true);

    // 보스전 중 체력 조건 장면 (STORY_MAP[장].boss.hp)
    if (this.boss && !this.boss.dormant && !this.boss.dead) {
      const ratio = this.boss.hp / this.boss.cfg.hp;
      ((this.storyMap.boss || {}).hp || []).forEach((h, i) => {
        if (this.firedBossHp.has(i) || ratio > h.below) return;
        this.firedBossHp.add(i);
        this.story.playEntries(h.scene);
      });
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
    if (this.nonLethal) {
      this.nonLethal(fromX);
      return 'hurt';
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
    this.deaths += 1;
    const x = player.body.center.x;
    const y = Math.min(player.body.center.y, LEVEL.height - 20);
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
          if (e.hurt(Math.sign(s.vx) || 1, S.reflectDamage)) this.showDamage(e.body.center.x, e.body.center.y - 20, S.reflectDamage, '#ff8fb1');
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
    this.events.emit('enemyKilled', enemy);
    if (byPlayer && enemy.type !== 'dummy') this.kills += 1;
    if (enemy.type === 'boss') {
      this.doHitStop(0.25);
      this.cameras.main.shake(400, 0.015);
      this.spawnPetals(enemy.body.center.x, enemy.body.center.y, 60, 200);
      // 보스 후 → 장 끝 장면을 보고 클리어
      this.time.delayedCall(1200, async () => {
        await this.story.playEntries((this.storyMap.boss || {}).after);
        this.triggerClear();
      });
    }
  }

  // ───────── 스토리 트리거 (STORY_MAP) ─────────
  setStage(no) {
    this.stageNo = no;
    this.stageName = this.chapterNo === 0 ? `P-${no}` : `${this.chapterNo}-${no}`;
    this.stageCheckpoint = 0;
  }

  async onStoryTrigger(t) {
    if (t.stage) this.setStage(t.stage);
    await this.story.playEntries(t.scene);
    if (t.then === 'wakeBoss') this.wakeBoss();
    else if (t.then === 'clear') this.triggerClear();
    else if (t.then === 'nextChapter') this.goToChapter(this.storyMap.next);
  }

  // 다음 장으로 (프롤로그 → 1장)
  goToChapter(chapter) {
    if (!chapter) return this.triggerClear();
    const reg = this.registry;
    reg.set('chapterOverride', chapter);
    reg.set('chapterStarted', false);
    UI.fade(1, 0);
    this.scene.restart();
  }

  // R: 보통은 마지막 벚꽃나무 기준으로 다시. 프롤로그처럼 연출이 이어진 장은 처음부터
  restartChapter() {
    if (this.storyMap.restartFromBeginning) {
      const reg = this.registry;
      const mine = (id) => this.story.scenes[id] && this.story.scenes[id].chapter === this.chapter;
      reg.set('storyPlayed', reg.get('storyPlayed').filter((id) => !mine(id)));
      reg.set('storyDone', reg.get('storyDone').filter((id) => !mine(id)));
      reg.set('chapterStarted', false);
      StoryAudio.stopBgm(0.2);
    }
    this.scene.restart();
  }

  // 그 장면을 끝까지 본 막힌 길은 사라진다
  openGates() {
    for (const g of this.gates.getChildren().slice()) {
      if (this.story.done(g.until)) g.destroy();
    }
  }

  // ───────── 적 무리 / 연습 상대 ─────────
  addEnemy(data) {
    const e = new Enemy(this, data);
    this.enemyGroup.add(e.obj);
    e.body.setMaxVelocity(2000, TUNING.maxFallSpeed); // 그룹 기본값 덮어쓰기
    this.enemies.push(e);
    return e;
  }

  // 무리가 연기와 함께 나타난다 (이미 나왔으면 그대로)
  spawnGroup(group) {
    const list = this.pendingGroups[group];
    if (!list) return;
    delete this.pendingGroups[group];
    for (const d of list) {
      const e = this.addEnemy(d);
      this.spawnDust(d.x, d.y, 8);
    }
  }

  groupAlive(group) {
    if (this.pendingGroups[group]) return this.pendingGroups[group].length;
    return this.enemies.filter((e) => e.group === group && !e.dead).length;
  }

  // 패링 연습: NPC(하루) 자리에 보이지 않는 연습 상대를 두고 그림은 NPC 가 따라간다
  spawnTrainer(npc) {
    const e = this.addEnemy({ type: 'trainer', x: npc.x, y: npc.y, minX: npc.x - 400, maxX: npc.x + 400 });
    e.npc = npc;
    e.facing = Math.sign(this.player.body.center.x - npc.x) || -1;
    e.cooldown = 1.2;
    return e;
  }

  removeTrainer(e) {
    if (!e) return;
    const n = e.npc;
    e.npc = null;
    e.kill(false);
    this.enemies = this.enemies.filter((x) => x !== e);
    if (n) {
      n.sprite.clearTint();
      n.place(n.x, Math.sign(this.player.body.center.x - n.x) || -1);
    }
  }

  // ───────── 스킬 잠금 (프롤로그 튜토리얼) ─────────
  unlockSkill(name) {
    this.skillLocks.delete(name);
    this.applySkillLocks();
    // 새로 배운 칸이 톡 튀어나온다
    const el = UI.el(`.sk[data-skill="${name === 'dashSlash' ? 'slash' : 'iaido'}"]`);
    if (el && el.animate) el.animate([{ transform: 'scale(1.5)', filter: 'brightness(2)' }, { transform: 'scale(1)', filter: 'none' }], { duration: 350, easing: 'ease-out' });
  }

  // 배우기 전(프롤로그)엔 스킬 칸·칼집 게이지·터치 버튼을 숨긴다 (HUD 는 updateHud 가 잠금 상태를 넘김)
  applySkillLocks() {
    const lock = this.skillLocks;
    this.touchSkillBtns.slash.style.visibility = lock.has('dashSlash') ? 'hidden' : '';
    this.touchSkillBtns.iaido.style.visibility = lock.has('iaido') ? 'hidden' : '';
  }

  // ───────── 장식 나무 / 화면 분위기 / 연출 도우미 ─────────
  createDecorTree(d) {
    const t = new CherryTree(this, d.x, d.y);
    t.noLabel = true;
    if (t.sprite) t.sprite.setScale(d.scale || 1).setDepth(0);
    t.canopyY = d.y - (d.y - t.canopyY) * (d.scale || 1);
    t.canopyW *= d.scale || 1;
    if (d.bloomed) t.bloom(false);
    if (d.burning && t.sprite) t.sprite.setTint(0xff8a5a);
    if (d.hidden) {
      // 배경 그림 속 나무를 쓴다: 나무 그림은 숨기고 꽃잎 효과 위치만 맞춘다
      if (t.sprite) t.sprite.setVisible(false);
      if (t.container) t.container.setVisible(false);
      if (d.canopy) {
        t.canopyY = d.canopy.y;
        t.canopyW = d.canopy.w;
      }
    }
    t.burning = !!d.burning;
    return t;
  }

  // dusk(해 질 녘 주황) / night / fire(붉은빛 + 불티)
  setMood(mood) {
    this.mood = mood;
    // 구역 배경 그림이 있는 맵은 그림에 이미 색이 있어 불(fire)만 살짝 붉게 + 불티
    const tone = this.stageBgs.length ? { fire: [0xff3010, 0.12] }[mood]
      : { dusk: [0xff8a3d, 0.16], night: [0x101040, 0.12], fire: [0xff3010, 0.2] }[mood];
    if (tone) this.moodLayer.setFillStyle(tone[0], tone[1]);
    else this.moodLayer.setFillStyle(0, 0);
  }

  updateMood(dt) {
    if (this.mood !== 'fire') return;
    this.emberTimer -= dt;
    if (this.emberTimer > 0) return;
    this.emberTimer = 0.05;
    const view = this.cameras.main.worldView;
    const x = view.x + Math.random() * view.width;
    const e = this.add.rectangle(x, view.bottom + 4, 3, 3, Math.random() < 0.5 ? 0xffa040 : 0xff5a20).setDepth(18);
    this.tweens.add({
      targets: e, y: view.bottom - 200 - Math.random() * 260, x: x + Phaser.Math.Between(-60, 60), alpha: 0,
      duration: 1600 + Math.random() * 1200, onComplete: () => e.destroy(),
    });
  }

  // 불화살 하나: 하늘에서 비스듬히 떨어져 땅에 꽂히며 불꽃
  fireArrow(x) {
    const view = this.cameras.main.worldView;
    const y1 = 600 + Math.random() * 20;
    const a = this.add.rectangle(x - 220, view.y - 20, 26, 3, 0xffc070).setDepth(17).setAngle(55);
    this.tweens.add({
      targets: a, x, y: y1, duration: 520, ease: 'Quad.easeIn',
      onComplete: () => {
        a.destroy();
        this.spawnBurst(x, y1, 0xff6a20, 5);
      },
    });
  }

  // 무너지는 지붕 조각
  debris(x, groundY) {
    const view = this.cameras.main.worldView;
    const d = this.add.rectangle(x, view.y - 20, Phaser.Math.Between(14, 34), Phaser.Math.Between(8, 18), 0x2a1d17).setDepth(17);
    this.tweens.add({
      targets: d, y: groundY - 6, angle: Phaser.Math.Between(-90, 90), duration: 420 + Math.random() * 200, ease: 'Quad.easeIn',
      onComplete: () => this.spawnDust(d.x, groundY, 3),
    });
  }

  // 잠긴 장면에서 주인공을 걷게 (물리가 멈춰 있어 위치를 직접 옮긴다). 멀면 가까이 옮긴 뒤 걷는다
  movePlayerTo(x, speed) {
    if (x == null) return Promise.resolve(); // 이 맵에 없는 위치
    const p = this.player;
    const b = p.body;
    const y = b.y;
    if (!speed || Math.abs(x - b.center.x) > 700) b.reset(x - Math.sign(x - b.center.x || 1) * 120, b.center.y);
    if (!speed) {
      b.reset(x, b.center.y);
      return Promise.resolve();
    }
    const from = b.center.x;
    p.facing = Math.sign(x - from) || p.facing;
    if (p.useSprite) p.visual.play('player_run');
    return new Promise((resolve) => {
      const o = { x: from };
      this.tweens.add({
        targets: o, x, duration: (Math.abs(x - from) / speed) * 1000,
        onUpdate: () => b.reset(o.x, b.center.y),
        onComplete: () => {
          if (p.useSprite) p.visual.play('player_idle');
          resolve();
        },
      });
    });
  }

  // 쓰러지는 주인공을 dx 만큼 날려 보낸다
  knockPlayer(dx, ms) {
    const b = this.player.body;
    const x0 = b.center.x;
    const y0 = b.center.y;
    // 맵 밖으로 날아가지 않게
    dx = Phaser.Math.Clamp(x0 + dx, 80, LEVEL.width - 80) - x0;
    if (!ms) {
      b.reset(x0 + dx, y0);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const o = { t: 0 };
      this.tweens.add({
        targets: o, t: 1, duration: ms, ease: 'Quad.easeOut',
        onUpdate: () => b.reset(x0 + dx * o.t, y0 - Math.sin(o.t * Math.PI) * 90),
        onComplete: resolve,
      });
    });
  }

  // 꽃잎에 실려 하늘로
  liftPlayer(dy, ms) {
    const p = this.player;
    const b = p.body;
    const x0 = b.center.x;
    const y0 = b.center.y;
    return new Promise((resolve) => {
      const o = { t: 0 };
      this.tweens.add({
        targets: o, t: 1, duration: ms, ease: 'Sine.easeIn',
        onUpdate: () => {
          b.reset(x0, y0 - dy * o.t);
          p.alphaMul = 1 - o.t;
          if (Math.random() < 0.5) this.spawnPetals(x0, y0 - dy * o.t, 2, 40);
        },
        onComplete: resolve,
      });
    });
  }

  // 보스가 단숨에 x 까지 파고든다 (하쿠야의 발도)
  dashBossTo(x) {
    const boss = this.boss;
    if (!boss) return;
    const b = boss.body;
    x = Phaser.Math.Clamp(x, 60, LEVEL.width - 60);
    for (let i = 0; i < 5; i++) {
      const gx = b.center.x + ((x - b.center.x) * i) / 5;
      if (boss.sprite) {
        const g = this.add.image(gx, b.bottom, boss.sheet, 0).setOrigin(0.5, 1).setFlipX(boss.facing > 0)
          .setTintFill(0xffd166).setAlpha(0.5).setDepth(5);
        this.tweens.add({ targets: g, alpha: 0, duration: 350, onComplete: () => g.destroy() });
      }
    }
    b.reset(x, b.center.y);
  }

  // ───────── 1-1 조작 안내 (LEVEL.hints): 처음 한 번, 그 행동이 필요한 자리에 작게 ─────────
  setupCtxHints(L) {
    this.hintsDone = new Set();
    try { JSON.parse(localStorage.getItem('kamisama-hints') || '[]').forEach((id) => this.hintsDone.add(id)); } catch (e) { /* 저장소를 못 쓰면 이번만 */ }
    this.ctxHints = this.chapter === 'ch1' ? (L.hints || []).filter((h) => !this.hintsDone.has(h.id)) : [];
  }

  updateCtxHints() {
    if (!this.ctxHints.length) return;
    const c = this.controls.state;
    const did = { move: c.left.down || c.right.down, jump: c.jump.pressed, attack: c.attack.pressed,
      dash: c.dash.pressed, skill1: c.skill1.pressed, skill2: c.skill2.pressed };
    const x = this.player.body.center.x;
    const quiet = this.story.blocking || this.player.dead;
    this.ctxHints = this.ctxHints.filter((h) => {
      if (did[h.act]) {
        // 이미 해 봤으면 다시 안 나온다
        UI.hideCtxHint(h.id);
        this.hintsDone.add(h.id);
        try { localStorage.setItem('kamisama-hints', JSON.stringify([...this.hintsDone])); } catch (e) { /* 무시 */ }
        return false;
      }
      if (!quiet && this.stageNo === 1 && x >= h.from && x <= h.to) UI.showCtxHint(h);
      else UI.hideCtxHint(h.id);
      return true;
    });
  }

  // ───────── 기억 조각 (data/story/memories.json, 위치는 LEVEL.memories) ─────────
  createMemories(L) {
    const data = this.cache.json.get('story-memories') || {};
    const frags = data.fragments || [];
    const have = this.registry.get('memories') || [];
    this.memoryPickups = [];
    for (const m of L.memories || []) {
      if (m.chapter && m.chapter !== this.chapter) continue;
      if (have.includes(m.no)) continue;
      const info = frags.find((f) => f.no === m.no) || {};
      const glow = this.add.circle(m.x, m.y, 14, 0xffd166, 0.25).setDepth(4);
      const core = this.add.star(m.x, m.y, 5, 4, 9, 0xfff1c2).setDepth(5);
      this.tweens.add({ targets: [glow, core], y: m.y - 6, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: glow, scale: 1.4, alpha: 0.1, duration: 900, yoyo: true, repeat: -1 });
      this.memoryPickups.push({ ...m, info, objs: [glow, core] });
    }
  }

  updateMemories() {
    const pb = this.player.body;
    for (const m of this.memoryPickups) {
      if (m.taken || Math.abs(pb.center.x - m.x) > 26 || Math.abs(pb.center.y - m.y) > 46) continue;
      m.taken = true;
      const have = this.registry.get('memories') || [];
      if (!have.includes(m.no)) have.push(m.no);
      this.registry.set('memories', have);
      m.objs.forEach((o) => o.destroy());
      this.spawnPetals(m.x, m.y, 16, 70);
      UI.item(`기억 조각 ${m.no} · ${m.info.title || ''}`);
    }
  }

  onCheckpoint(treeIndex) {
    this.checkpointNo += 1;
    this.stageCheckpoint += 1;
    const ids = this.story.resolve((this.storyMap.trees || {})[treeIndex]);
    if (ids.length) this.story.playAll(ids);
    else this.story.checkpointChatter(this.chapter, this.stageCheckpoint === 1);
  }

  // 게임 쪽 사건(예: '한 명 쓰러짐') → STORY_MAP[장].events 의 장면
  storyEvent(name) {
    return this.story.playEntries((this.storyMap.events || {})[name]);
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

  // 결과창: 두루마리가 내려와 펼쳐지고 「討伐」 → 도장이 찍힐 때 화면이 살짝 흔들린다
  triggerClear() {
    this.cleared = true;
    this.physics.world.pause();
    const ms = UI.result({
      kills: this.kills,
      deaths: this.deaths,
      onStamp: () => this.cameras.main.shake(180, 0.006),
    });
    this.allowRestartSoon(ms);
  }

  allowRestartSoon(ms = 500) {
    this.canRestart = false;
    this.time.delayedCall(ms, () => { this.canRestart = true; });
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
