// 대본의 gameplay 명령({cmd:'gameplay', do: 동작, ...})을 실제 게임으로 옮긴다.
// 대본 변환기(tools/convert_story.py 의 GAMEPLAY 표)가 연출 메모를 이 명령으로 바꿔 둔다.
// 조작이 필요한 동작(튜토리얼, 전투)은 장면이 잠겨 있어도 그동안만 조작을 풀고, 건너뛰기 중에도 꼭 한다.
// 보여 주기만 하는 동작(인물 이동, 꽃잎 …)은 건너뛰기 중이면 결과 상태로 바로 간다.
class StoryGameplay {
  constructor(scene) {
    this.scene = scene;
  }

  get story() { return this.scene.story; }
  get player() { return this.scene.player; }
  npc(id) { return this.scene.npcs[id]; }
  point(name) { return (LEVEL.points || {})[name]; }

  async run(c, skip) {
    const fn = this['do_' + c.do];
    if (!fn) {
      UI.note(`[gameplay 미구현] ${c.do}: ${c.text || ''}`);
      return;
    }
    await fn.call(this, c, skip);
  }

  // 조건이 맞을 때까지 매 프레임 확인 (장면이 다시 시작되면 그대로 버림)
  until(test) {
    const scene = this.scene;
    return new Promise((resolve) => {
      const check = () => {
        if (!test()) return;
        scene.events.off('update', check);
        resolve();
      };
      scene.events.on('update', check);
      scene.events.once('shutdown', () => scene.events.off('update', check));
    });
  }

  // 잠긴 장면에서도 그동안만 조작 가능
  async unlocked(fn) {
    const st = this.story;
    const was = st.locked;
    st.lock(false);
    st.dialogue.hide();
    try {
      await fn();
    } finally {
      UI.prompt(null);
      if (was) st.lock(true);
    }
  }

  wait(ms, skip) {
    return skip ? Promise.resolve() : this.story.wait(ms, true);
  }

  // ───────── 화면 분위기 ─────────
  do_mood(c) {
    this.scene.setMood(c.mood);
  }

  // ───────── 튜토리얼 (프롤로그 연습장) ─────────
  async do_tutorial(c) {
    const scene = this.scene;
    const p = this.player;
    const x0 = p.body.center.x;
    const steps = {
      move: {
        // 대사 도중 이미 걸어 왔으면 바로 통과
        kb: 'A · D 로 걷기', touch: '◀ ▶ 로 걷기',
        // 대사 도중 이미 담 앞까지 걸어 왔으면 바로 통과 (담에 막혀 140px 를 더 못 가므로)
        done: () => Math.abs(p.body.center.x - x0) > 140 || x0 > this.point('wall') - 400,
      },
      jump: {
        kb: 'Space 로 점프해서 낮은 담 넘기', touch: '점프 버튼으로 낮은 담 넘기',
        done: () => p.body.left > this.point('wall') + 60 && p.grounded,
      },
      dashSlash: {
        kb: 'U 대쉬베기로 허수아비 3개 베기 — 벨 때마다 칼에 꽃잎이 쌓인다',
        touch: '베기 버튼(대쉬베기)으로 허수아비 3개 베기 — 벨 때마다 칼에 꽃잎이 쌓인다',
        start: () => scene.unlockSkill('dashSlash'),
        done: () => scene.groupAlive('dummies') === 0,
      },
      iaido: {
        kb: 'I 로 발도 — 1초 자세를 잡았다가 쌓인 꽃잎을 한 번에 터뜨린다',
        touch: '발도 버튼 — 1초 자세를 잡았다가 쌓인 꽃잎을 한 번에 터뜨린다',
        start: () => {
          scene.unlockSkill('iaido');
          this.iaidoDone = false;
          scene.events.once('iaido', () => { this.iaidoDone = true; });
        },
        done: () => this.iaidoDone,
      },
      parry: {
        kb: '하루가 벨 때 I — 자세를 잡는 첫 반 호흡(0.5초)은 무엇이든 받아낸다',
        touch: '하루가 벨 때 발도 버튼 — 자세를 잡는 첫 반 호흡(0.5초)은 무엇이든 받아낸다',
        start: () => this.startParryDrill(),
        done: () => this.parried,
        end: () => this.endParryDrill(),
      },
    };
    const s = steps[c.step];
    if (!s) return;
    await this.unlocked(async () => {
      if (s.start) s.start();
      UI.prompt({ kb: s.kb, touch: s.touch });
      await this.until(s.done);
      if (s.end) await s.end();
    });
  }

  // 패링 연습: 하루가 목검으로 천천히 벤다. 맞아도 죽지 않고, 패링에 성공할 때까지 반복
  startParryDrill() {
    const scene = this.scene;
    const haru = this.npc('haru');
    this.parried = false;
    const sk = this.player.skills;
    sk.iaidoCooldown = 0;
    this.trainer = scene.spawnTrainer(haru);
    this.onParry = (enemy) => {
      if (enemy !== this.trainer) return;
      this.parried = true;
    };
    scene.events.on('parry', this.onParry);
    // 연습 중엔 발도를 빨리 다시 쓸 수 있게
    this.drillTick = () => { sk.iaidoCooldown = Math.min(sk.iaidoCooldown, 0.6); };
    scene.events.on('update', this.drillTick);
    scene.nonLethal = (fromX) => {
      this.player.stagger(fromX);
      scene.popText(this.player.body.center.x, this.player.body.bottom - 110, '다시!', '#cfcfcf');
      scene.cameras.main.shake(120, 0.006);
    };
  }

  async endParryDrill() {
    const scene = this.scene;
    scene.events.off('parry', this.onParry);
    scene.events.off('update', this.drillTick);
    scene.nonLethal = null;
    // 성공: 하얀 섬광 + 짧은 슬로모션
    scene.cameras.main.flash(300, 255, 255, 255);
    this.story.startSlowmo(0.9, 0.3);
    await this.story.wait(900);
    scene.removeTrainer(this.trainer);
    this.trainer = null;
  }

  // ───────── 인물 ─────────
  targetX(c) {
    if (c.to === 'player') {
      // 주인공 옆, 보스가 있는 쪽 (하루가 아카네 앞을 막아선다)
      const px = this.player.body.center.x;
      const boss = this.scene.boss;
      const side = boss ? Math.sign(boss.body.center.x - px) || 1 : 1;
      return px + (c.offset || 0) * side;
    }
    return this.point(c.to);
  }

  async do_npcMove(c, skip) {
    const n = this.npc(c.who);
    const x = this.targetX(c);
    if (!n || x == null) return;
    if (skip) return n.place(x, Math.sign(x - n.x) || n.facing);
    const p = n.moveTo(x, c.speed || 150);
    if (c.wait) await p;
  }

  do_npcPlace(c) {
    const n = this.npc(c.who);
    if (n && this.point(c.at) != null) n.place(this.point(c.at), c.face);
  }

  do_npcFace(c) {
    const n = this.npc(c.who);
    if (n) n.face(c.dir);
  }

  do_npcPose(c) {
    const n = this.npc(c.who);
    if (n) n.setPose(c.pose);
  }

  // 다가가면 계속 (조작 가능 컷신에서 하루에게 걸어가기)
  async do_approach(c) {
    const n = this.npc(c.who);
    if (!n) return;
    const near = () => Math.abs(this.player.body.center.x - n.x) < 90;
    if (near()) return;
    await this.unlocked(async () => {
      UI.prompt({ kb: `${n.name}에게 다가가기`, touch: `${n.name}에게 다가가기` });
      await this.until(near);
    });
  }

  // ───────── 프롤로그 축제 → 불 ─────────
  do_festival() {
    this.scene.setMood('night');
    const haru = this.npc('haru');
    if (haru) haru.place(this.point('plazaTree') - 40, 1);
  }

  async do_bloomTree(c, skip) {
    const t = this.scene.decorTrees[c.tree];
    if (!t) return;
    t.bloom(!skip);
    await this.wait(900, skip);
  }

  do_cheer(c, skip) {
    if (skip) return;
    for (const n of Object.values(this.scene.npcs)) if (n.data.festival && n.visible) n.hop(3);
  }

  async do_fireArrows(c, skip) {
    const scene = this.scene;
    if (!skip) {
      const view = scene.cameras.main.worldView;
      for (let i = 0; i < 34; i++) {
        scene.time.delayedCall(i * 45, () => scene.fireArrow(view.x + Math.random() * (view.width + 300) - 100));
      }
      await this.wait(1700, skip);
    }
    scene.setMood('fire');
    // 마을 사람들은 비명을 지르며 양쪽으로 흩어지고, 하루는 광장으로 달려간다
    for (const n of Object.values(scene.npcs)) {
      if (n.data.festival) n.flee(n.data.flee, skip);
      else if (n.id === 'haru') n.hide();
    }
  }

  // ───────── 전투 ─────────
  do_spawn(c) {
    this.scene.spawnGroup(c.group);
    // 그 자리 마을 사람들(npcs 의 같은 이름 표시)은 도망친다
    for (const n of Object.values(this.scene.npcs)) if (n.data[c.group]) n.flee(n.data.flee);
  }

  async do_fight(c) {
    const scene = this.scene;
    scene.spawnGroup(c.group);
    await this.unlocked(async () => {
      // 마지막 한 명을 베는 순간 슬로모션
      const onKill = (enemy) => {
        if (!c.slowmoLast || enemy.group !== c.group || scene.groupAlive(c.group) > 0) return;
        this.story.startSlowmo(1.2, 0.3);
        scene.cameras.main.flash(200, 255, 255, 255);
      };
      scene.events.on('enemyKilled', onKill);
      await this.until(() => scene.groupAlive(c.group) === 0 && !this.player.dead);
      scene.events.off('enemyKilled', onKill);
      await this.story.wait(c.slowmoLast ? 1300 : 500);
    });
  }

  async do_roofCollapse(c, skip) {
    const scene = this.scene;
    const n = this.npc(c.who);
    if (!skip && n) {
      for (let i = 0; i < 26; i++) {
        scene.time.delayedCall(i * 30, () => scene.debris(n.x + Phaser.Math.Between(-90, 90), n.y));
      }
      scene.cameras.main.shake(500, 0.012);
      await this.wait(700, skip);
    }
    if (n) n.hide();
    // 하루는 불타는 광장에서 하쿠야와 마주 서 있다
    const haru = this.npc('haru');
    if (haru) haru.place(this.point('fireHaru'), 1);
  }

  // ───────── 하쿠야 패배 이벤트 ─────────
  async do_playerRun(c, skip) {
    const x = this.point(c.to);
    await this.scene.movePlayerTo(x, skip ? 0 : 160);
  }

  // 체력바가 줄지 않는 전투. 공격은 금빛 막에 튕긴다. seconds 초가 지나거나 hits 번 맞으면 끝
  async do_defeatBattle(c) {
    const scene = this.scene;
    const boss = scene.boss;
    if (!boss || boss.dead) return;
    const haru = this.npc('haru');
    if (haru) haru.moveTo(this.point('fireHaruAside'), 200);
    let hits = 0;
    let t = 0;
    // 금빛 막: 하쿠야를 감싸며 생겨나 전투 내내 따라다닌다
    const dome = Sprites.has(scene, 'fx_barrier')
      ? scene.add.sprite(boss.body.center.x, boss.body.bottom + 4, 'fx_barrier', 0).setOrigin(0.5, 1).setDepth(11).setAlpha(0.6)
      : null;
    if (dome) dome.play('fx_barrier');
    boss.playAnim('hakuya_barrier');
    const follow = () => { if (dome) dome.setPosition(boss.body.center.x, boss.body.bottom + 4); };
    scene.events.on('postupdate', follow);
    await this.unlocked(async () => {
      boss.barrier = true;
      boss.barrierFx = dome;
      scene.wakeBoss();
      scene.nonLethal = (fromX) => {
        hits++;
        this.player.stagger(fromX);
        this.player.invuln = 1.0;
        scene.cameras.main.shake(180, 0.01);
        scene.doHitStop(0.08);
      };
      const tick = (time, delta) => { t += delta / 1000; };
      scene.events.on('update', tick);
      await this.until(() => hits >= (c.hits || 3) || t >= (c.seconds || 20));
      scene.events.off('update', tick);
      scene.nonLethal = null;
      scene.clearShurikens();
      boss.dormant = true;
      boss.setState('patrol');
      UI.boss(false);
    });
    scene.events.off('postupdate', follow);
    if (dome) scene.tweens.add({ targets: dome, alpha: 0, duration: 500, onComplete: () => dome.destroy() });
    boss.barrierFx = null;
  }

  // 하쿠야의 발도: 단숨에 파고들어 베고, 아카네는 날아가 쓰러진다 (부활하지 않음)
  async do_hakuyaIaido(c, skip) {
    const scene = this.scene;
    const boss = scene.boss;
    const p = this.player;
    if (!boss) return;
    // 하쿠야는 언제나 오른쪽에서 파고들고 아카네는 왼쪽(넓은 쪽)으로 날아간다 — 전투 중 위치와 상관없이 같은 그림
    const dir = -1;
    boss.facing = dir;
    if (!skip) {
      scene.cameras.main.flash(120, 255, 220, 120);
      boss.playAnim('hakuya_iaido', true);
      await this.story.wait(350);
      scene.dashBossTo(p.body.center.x - dir * 70);
      Sprites.fx(scene, 'fx_slash', p.body.center.x, p.body.center.y, { flipX: dir > 0, tint: 0xffd166, depth: 15, scale: 3 });
      scene.cameras.main.flash(260, 255, 255, 255);
      scene.cameras.main.shake(420, 0.016);
      scene.spawnBurst(p.body.center.x, p.body.center.y, 0xd62828, 14);
    }
    p.die();
    await scene.knockPlayer(dir * 220, skip ? 0 : 600);
    await this.wait(700, skip);
  }

  async do_stab(c, skip) {
    const scene = this.scene;
    const n = this.npc(c.who);
    if (!n) return;
    if (scene.boss) scene.boss.playAnim('hakuya_thrust', true);
    if (!skip) {
      Sprites.fx(scene, 'fx_slash', n.x, n.y - 40, { flipX: true, tint: 0xffd166, depth: 15, scale: 2 });
      scene.cameras.main.flash(300, 200, 0, 0);
      scene.cameras.main.shake(260, 0.01);
      scene.spawnBurst(n.x, n.y - 40, 0xd62828, 16);
      await this.story.wait(300);
    }
    n.setPose('down');
    await this.wait(800, skip);
  }

  // 보스(하쿠야) 그림 한 번 재생: c.anim, c.hold = 끝난 그림 유지
  do_bossAnim(c) {
    if (this.scene.boss) this.scene.boss.playAnim(c.anim, !!c.hold);
  }

  async do_petal(c, skip) {
    if (skip) return;
    const scene = this.scene;
    const p = this.player;
    const pt = Sprites.petal(scene, p.body.center.x + 20, p.body.bottom - 220).setDepth(20).setScale(1.6);
    scene.tweens.add({
      targets: pt, y: p.body.bottom - 4, x: pt.x - 30, angle: 300, duration: 2200, ease: 'Sine.easeInOut',
      onComplete: () => scene.tweens.add({ targets: pt, alpha: 0, duration: 600, onComplete: () => pt.destroy() }),
    });
    await this.story.wait(1600, true);
  }

  async do_petalStorm(c, skip) {
    if (skip) return;
    const scene = this.scene;
    const p = this.player;
    const cx = p.body.center.x;
    const cy = p.body.center.y;
    for (let i = 0; i < 140; i++) {
      scene.time.delayedCall(i * 12, () => {
        const a = Math.random() * Math.PI * 2;
        const r = 40 + Math.random() * 120;
        const pt = Sprites.petal(scene, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.7).setDepth(20);
        scene.tweens.add({
          targets: pt, x: cx + Math.cos(a + 2.5) * r * 0.5, y: cy + Math.sin(a + 2.5) * r * 0.4 - 30,
          angle: 720, alpha: 0, duration: 1200 + Math.random() * 600, onComplete: () => pt.destroy(),
        });
      });
    }
    await this.story.wait(1500, true);
  }

  async do_carryAway(c, skip) {
    const scene = this.scene;
    const p = this.player;
    if (!skip) {
      scene.spawnPetals(p.body.center.x, p.body.center.y, 60, 160);
      await scene.liftPlayer(260, 1800);
    }
    p.alphaMul = 0;
  }
}
