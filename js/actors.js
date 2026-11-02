// 배우(Actor) 시스템: 컷신에서 인물들이 대본대로 스스로 움직인다. 아카네(주인공)도 같은 명령으로 움직인다.
// 컷신 엔진(js/story-player.js)이 대본 명령을 여기로 넘긴다. 명령 표는 docs/cinematics.md '배우' 절.
//
//   배우 이름: 'akane' | '아카네' | 'player' = 주인공, 그 밖엔 맵의 인물(LEVEL.npcs) id 나 이름(characters.json)
//   위치(x)  : 숫자 | 맵의 points 이름 | 배우 이름 (+ offset) | { x }
//   속도     : walk(걷기) | run(달리기) | slow(천천히) | 숫자(px/초)
//
// 장면을 건너뛰면(길게 누르기 · Esc 1초) 움직이는 중인 것도 바로 끝 상태로 간다: 위치·자세·보이기/숨기기·등장은 그대로 남는다.
// 그림이 없는 자세(아카네 앉기 등)는 비슷한 그림으로 대신한다 (ACTOR_POSES, 아래).

// 자세 그림. [시트, 칸] = 멈춘 그림, 문자열 = 애니메이션. 없으면 서 있는 그림을 조금 낮춰(세로 80%) 대신한다
const ACTOR_POSES = {
  akane: {
    idle: 'player_idle', walk: 'player_run', run: 'player_run',
    sit: 'akane_seiza',               // 정좌 (akane_emote1). 그림이 없으면 아래 대신 그림
    kneel: 'akane_seiza',
    jumpUp: ['player_jump', 1], jumpDown: ['player_jump', 3], land: ['player_jump', 4],
    down: ['player_death', 5],
  },
  // 비에 젖은 아카네 (P-12 ~ P-14, 이야기 깃발 akaneRain): akane_emote2
  akaneRain: {
    sit: ['akane_emote2', 3], kneel: ['akane_emote2', 3], down: ['akane_emote2', 0],
    walk: 'akane_slow_walk', run: 'akane_slow_walk',
  },
  // 새 그림이 없을 때 대신 그림
  akaneFallback: {
    sit: ['player_iaido_ready', 0], kneel: ['player_iaido_ready', 5],
  },
};

// 머리 위 감정 아이콘 (9칸 안팎 도트 그림을 말풍선에 넣어 2배로). 글자: k 먹 · r 빨강 · b 파랑 · w 흰 · p 분홍
const EMOTE_ART = {
  '!': ['..rrr..', '..rrr..', '..rrr..', '..rrr..', '...r...', '...r...', '.......', '..rrr..', '..rrr..'],
  '?': ['.bbbbb.', 'bb...bb', '.....bb', '...bbb.', '..bb...', '..bb...', '.......', '..bb...', '..bb...'],
  '…': ['.........', '.........', '.........', 'kk.kk.kk.', 'kk.kk.kk.', '.........', '.........'],
  sweat: ['...b...', '..bbb..', '.bbbbb.', 'bbwbbbb', 'bwbbbbb', 'bbbbbbb', '.bbbbb.', '..bbb..'],
  heart: ['.pp...pp.', 'pppp.pppp', 'ppwpppppp', 'pwppppppp', 'ppppppppp', '.ppppppp.', '..ppppp..', '...ppp...', '....p....'],
  palm: ['.k.k.k.', '.k.k.k.', 'kk.k.k.', 'kkkkkk.', 'kkkkkkk', '.kkkkk.', '..kkk..'],     // 손바닥 (묘목에 손 대기)
  basket: ['..kkk..', '.k...k.', 'kkkkkkk', 'kbkbkbk', 'kkkkkkk', '.kbkbk.', '..kkk..'],   // 바구니 (심부름 중)
  note: ['...kk...', '...k.k..', '...k..k.', '...k....', '...k....', '.kkk....', 'kkkk....', 'kkk.....'],
};
const EMOTE_ALIAS = { '...': '…', 'dots': '…', '땀': 'sweat', '하트': 'heart', '음표': 'note', '♪': 'note', '느낌표': '!', '물음표': '?' };
const EMOTE_COLORS = { k: 0x2a1a14, r: 0xd23a3a, b: 0x4a86d6, w: 0xffffff, p: 0xff5f8f };

// 주인공을 배우로 다루는 겉껍데기 (Npc 와 같은 모양의 함수들)
class PlayerActor {
  constructor(scene) {
    this.scene = scene;
    this.id = 'akane';
    this.name = '아카네';
    this.poses = ACTOR_POSES.akane;
  }

  get p() { return this.scene.player; }
  get x() { return this.p.body.center.x; }
  get y() { return this.p.body.bottom; }
  get facing() { return this.p.facing; }
  get headY() { return this.p.body.bottom - (this.p.useSprite ? 82 : this.p.height); }
  get displayObject() { return this.p.obj; }
  get visible() { return this.p.alphaMul > 0; }

  place(x, face) {
    const b = this.p.body;
    b.reset(x, b.center.y);
    b.setVelocity(0, 0);
    if (face) this.p.facing = face;
  }

  setY(footY) {
    const b = this.p.body;
    b.reset(b.center.x, footY - this.p.height / 2);
  }

  face(dir) { this.p.facing = dir; }

  // 그림 고정: null 이면 원래대로 (상태에 따라 알아서). { anim, loop, timeScale } | { sheet, frame }
  script(s) { this.p.scripted = s; }

  pose(name) {
    const flags = this.scene.registry.get('storyFlags') || {};
    const ok = (v) => v && (Array.isArray(v) ? this.scene.textures.exists(v[0]) : this.scene.anims.exists(v));
    let p = this.poses[name];
    if (flags.akaneRain && ok(ACTOR_POSES.akaneRain[name])) p = ACTOR_POSES.akaneRain[name];
    else if (p && !ok(p) && ACTOR_POSES.akaneFallback[name]) p = ACTOR_POSES.akaneFallback[name];
    if (name === 'idle' || name === 'stand' || !p) return this.script(null);
    this.script(Array.isArray(p) ? { sheet: p[0], frame: p[1] } : { anim: p, loop: true });
  }

  anim(key, loop) {
    if (!this.scene.anims.exists(key) && this.scene.anims.exists('player_' + key)) key = 'player_' + key;
    if (this.poses[key] && !this.scene.anims.exists(key)) return this.pose(key);
    this.script({ anim: key, loop });
  }

  setAlpha(a) { this.p.alphaMul = a; }
  get alpha() { return this.p.alphaMul; }
}

class ActorDirector {
  // 빛 점: 분홍빛 작은 원 (지름 3픽셀, 가장자리는 옅게)
  static glowTexture(scene) {
    const key = 'glow_dot';
    if (scene.textures.exists(key)) return key;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xff9eb8, 0.5).fillRect(0, 1, 5, 3).fillRect(1, 0, 3, 5);
    g.fillStyle(0xffd6e2, 1).fillRect(1, 1, 3, 3);
    g.fillStyle(0xffffff, 1).fillRect(2, 2, 1, 1);
    g.generateTexture(key, 5, 5);
    g.destroy();
    return key;
  }

  constructor(scene) {
    this.scene = scene;
    this.akane = new PlayerActor(scene);
    this.running = new Set(); // 진행 중인 움직임 (건너뛰면 바로 끝 상태로)
    this.emotes = new Set();
    this.follow = null; // 카메라가 따라가는 배우 (주인공이 아닐 때)
    this.points = [];   // 조사 지점 (inspect 명령으로 생김, 이 맵에 있는 동안 남음)
    this.props = {};    // 소품 (prop 명령). 그림이 없으면 단색 네모 + 이름표 (js/placeholders.js)
    this.near = null;   // 지금 다가가 있는 조사 지점
    const tick = () => this.update();
    scene.events.on('postupdate', tick);
    scene.events.once('shutdown', () => {
      scene.events.off('postupdate', tick);
      this.running.clear();
      for (const p of Object.values(this.props)) if (p.tag) p.tag.remove();
    });
  }

  get T() { return TUNING.actors; }
  get story() { return this.scene.story; }

  // ───────── 배우 찾기 ─────────
  idOf(name) {
    if (name == null) return null;
    if (typeof name !== 'string') return name;
    if (['akane', 'player', '아카네', '주인공'].includes(name)) return 'akane';
    if (this.scene.npcs[name]) return name;
    const chars = this.story ? this.story.characters : {};
    if (chars[name]) return name;
    const found = Object.entries(chars).find(([, c]) => c.name === name);
    if (found) return found[0];
    const npc = Object.values(this.scene.npcs).find((n) => n.name === name);
    return npc ? npc.id : name;
  }

  get(name) {
    const id = this.idOf(name);
    if (id === 'akane') return this.akane;
    return this.scene.npcs[id] || null;
  }

  // 위치 → x. v: 숫자 | 맵 points 이름 | 배우 | { x }. offset: 더할 px (배우 기준이면 그 배우가 보는 쪽이 +)
  xOf(v, offset = 0) {
    if (v == null) return null;
    // 방 시스템: 대본의 숫자 · 지점 이름은 예전 한 줄 맵 기준 → 지금 방 자리로 (js/rooms.js)
    if (typeof v === 'number') return (LEVEL.rooms ? Rooms.mapX(v) : v) + offset;
    if (typeof v === 'object') return v.x + offset;
    const pt = LEVEL.rooms ? Rooms.pointX(v) : (LEVEL.points || {})[v];
    if (pt != null) return pt + offset;
    const a = this.get(v);
    if (a) return a.x + offset;
    return null;
  }

  groundAt(x) {
    let y = null;
    for (const r of LEVEL.ground) {
      if (x >= r.x && x <= r.x + r.w && r.y > 300 && (y == null || r.y < y)) y = r.y;
    }
    return y ?? LEVEL.height - 100;
  }

  speedOf(s) {
    if (typeof s === 'number') return s;
    return this.T[s] || this.T.walk;
  }

  // ───────── 진행 중인 움직임 ─────────
  // step(t: 0→1) 을 duration 동안 부르고, 끝나면(또는 건너뛰면) finish() 로 끝 상태를 만든다
  op(duration, step, finish, skip) {
    if (skip || duration <= 0) {
      finish();
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const o = { t: 0 };
      let done = false;
      const rec = {};
      const tw = this.scene.tweens.add({ targets: o, t: 1, duration, onUpdate: () => step(o.t), onComplete: () => rec.end() });
      rec.end = () => {
        if (done) return;
        done = true;
        tw.stop();
        this.running.delete(rec);
        finish();
        resolve();
      };
      this.running.add(rec);
    });
  }

  // 건너뛰기: 움직이던 것 모두 끝 상태로
  finishAll() {
    for (const r of [...this.running]) r.end();
    for (const e of [...this.emotes]) e.end(true);
  }

  // 장면이 끝날 때: 아카네 그림 고정을 풀고(앉아 있었으면 일어남) 카메라는 다시 아카네를 따라간다
  endScene() {
    this.akane.script(null);
    const cine = this.scene.cine;
    if (this.follow || cine.lookAtPanned) {
      this.follow = null;
      cine.lookAtPanned = false;
      cine.resetCamera();
    }
  }

  // ───────── 동작 ─────────
  moveTo(a, x, speed, skip) {
    if (!a || x == null) return Promise.resolve();
    const from = a.x;
    const dist = Math.abs(x - from);
    const dir = Math.sign(x - from) || a.facing;
    const v = this.speedOf(speed);
    a.face(dir);
    if (a === this.akane) {
      if (dist < 2) return Promise.resolve();
      const sheetSpeed = 300; // player_run 12fps 가 어울리는 속도
      a.script({ anim: ((this.scene.registry.get('storyFlags') || {}).akaneRain && this.scene.anims.exists('akane_slow_walk')) ? 'akane_slow_walk' : a.poses.walk, loop: true, timeScale: Phaser.Math.Clamp(v / sheetSpeed, 0.35, 1.3), walk: speed !== 'run' });
      return this.op((dist / v) * 1000, (t) => a.place(from + (x - from) * t), () => {
        a.place(x, dir);
        a.script(null);
      }, skip);
    }
    if (a.moveTween) a.moveTween.stop();
    if (dist < 2) return Promise.resolve();
    a.setPose('run');
    const walkAnim = a.poses && a.poses.run !== a.poses.idle && !Array.isArray(a.poses.run);
    if (walkAnim && a.sprite.anims) a.sprite.anims.timeScale = Phaser.Math.Clamp(v / 200, 0.4, 1.3);
    const t0 = this.scene.time.now;
    return this.op((dist / v) * 1000, (t) => {
      a.x = from + (x - from) * t;
      a.y += (a.groundY - a.y) * 0.4;
      a.sync();
      // 걷는 그림이 없는 인물은 2px 씩 통통 (미끄러지지 않게)
      if (!walkAnim) a.sprite.y -= Math.floor((this.scene.time.now - t0) / (v > 180 ? 90 : 140)) % 2 ? 2 : 0;
    }, () => {
      a.x = x;
      a.y = a.groundY;
      a.facing = dir;
      if (a.sprite.anims) a.sprite.anims.timeScale = 1;
      a.setPose('idle');
    }, skip);
  }

  face(a, dir) {
    if (!a) return;
    if (dir === 'left') dir = -1;
    else if (dir === 'right') dir = 1;
    else if (typeof dir === 'string') {
      const b = this.get(dir);
      if (!b) return;
      dir = Math.sign(b.x - a.x) || a.facing;
    }
    a.face(dir);
  }

  setPose(a, pose) {
    if (!a) return;
    if (a === this.akane) return a.pose(pose);
    a.setPose(pose === 'stand' ? 'idle' : pose);
  }

  anim(a, key, loop) {
    if (!a) return;
    if (a === this.akane) return a.anim(key, loop);
    a.playAnim(key, loop);
  }

  // 제자리에서 x 로 뛰어 건너간다 (포물선)
  jump(a, x, skip, height) {
    if (!a) return Promise.resolve();
    const from = a.x;
    if (x == null) x = from;
    const dir = Math.sign(x - from) || a.facing;
    a.face(dir);
    const H = height ?? this.T.jumpHeight; // height: 높은 담을 넘을 때
    const ms = this.T.jumpMs + Math.abs(x - from) * 0.6;
    if (a === this.akane) {
      const y0 = this.groundAt(from);
      const y1 = this.groundAt(x);
      return this.op(ms, (t) => {
        a.place(from + (x - from) * t);
        a.setY(y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * H);
        a.pose(t < 0.5 ? 'jumpUp' : 'jumpDown');
      }, () => {
        a.place(x, dir);
        a.setY(this.groundAt(x));
        a.script(null);
      }, skip);
    }
    if (a.moveTween) a.moveTween.stop();
    const y0 = a.y;
    return this.op(ms, (t) => {
      a.x = from + (x - from) * t;
      const ground = a.groundY;
      a.y = y0 + (ground - y0) * t - Math.sin(t * Math.PI) * H;
      a.sync();
    }, () => {
      a.x = x;
      a.y = a.groundY;
      a.sync();
    }, skip);
  }

  // 나타나기 / 사라지기 (fade 초, 0 이면 바로)
  appear(a, on, fade, skip) {
    if (!a) return Promise.resolve();
    const sec = fade === false ? 0 : fade ?? this.T.fade;
    if (a === this.akane) {
      const from = a.alpha;
      const to = on ? 1 : 0;
      return this.op(sec * 1000, (t) => a.setAlpha(from + (to - from) * t), () => a.setAlpha(to), skip);
    }
    const s = a.sprite;
    if (on) {
      const from = a.visible ? s.alpha : 0;
      a.visible = true;
      a.sync();
      s.setAlpha(from);
      return this.op(sec * 1000, (t) => s.setAlpha(from + (1 - from) * t), () => s.setAlpha(1), skip);
    }
    if (!a.visible) return Promise.resolve();
    const from = s.alpha;
    return this.op(sec * 1000, (t) => s.setAlpha(from * (1 - t)), () => {
      a.hide();
      s.setAlpha(1);
    }, skip);
  }

  // 맵에 없는 인물을 그 자리에 세운다 (이미 있으면 옮기기만). opts: look, sheet, name, face, fade
  spawn(name, at, opts = {}, skip) {
    const id = this.idOf(name);
    const x = this.xOf(at, opts.offset || 0) ?? this.scene.player.body.center.x;
    const face = opts.face === 'left' ? -1 : opts.face === 'right' ? 1 : opts.face;
    if (id === 'akane') {
      this.akane.place(x, face);
      this.akane.setY(this.groundAt(x));
      return this.appear(this.akane, true, opts.fade ?? 0, skip);
    }
    let n = this.scene.npcs[id];
    if (!n) {
      const ch = (this.story && this.story.characters[id]) || {};
      const look = opts.look || (NPC_POSES[id] ? id : opts.sheet ? 'villager' : 'silhouette');
      n = new Npc(this.scene, { id, name: opts.name || ch.name || id, look, sheet: opts.sheet, x, y: this.groundAt(x), face: face || 1,
        tall: opts.tall, small: opts.small, hat: opts.hat });
      this.scene.npcs[id] = n;
      n.visible = false;
    } else {
      const was = n.visible;
      n.place(x, face);
      n.visible = was;
    }
    n.sync();
    return this.appear(n, true, opts.fade ?? 0, skip);
  }

  // ───────── 소품 ─────────
  // prop: id, key(그림 이름), at/x, y(발 높이, 기본 땅) · dy, w·h·color(임시 그림), depth, flip, angle, alpha, fade,
  //       screen: { x, y } (화면 고정, 앞쪽 큰 꽃잎처럼), label(이름표, '' = 없음)
  prop(c, skip) {
    const s = this.scene;
    this.propOff({ id: c.id }, true);
    // glow: 분홍빛 작은 원(코드 입자) — 깜빡이며 떠오르는 빛 점 (P-2 손끝, P-8 나무를 타고 오르는 빛)
    // optional: 그림이 없으면 아무것도 그리지 않는다 (단색 네모 대신 생략. 예: 바닥의 작은 불 fx_fire_small)
    if (c.optional && !(s.textures.exists(c.key) && Sprites.sheet(c.key))) return Promise.resolve();
    const ph = c.key === 'glow' ? { key: ActorDirector.glowTexture(s), real: true } : Placeholders.prop(s, c.key || c.id, c.w, c.h, c.color);
    let x;
    let y;
    if (c.screen) {
      x = c.screen.x;
      y = c.screen.y;
    } else {
      x = this.xOf(c.at ?? c.x, c.offset || 0) ?? s.player.body.center.x;
      y = (c.y ?? this.groundAt(x)) + (c.dy || 0);
    }
    // anim: 애니메이션을 한 번 재생한 뒤 key 그림으로 (교단 문양이 번져 나타남)
    const animKey = c.anim && ph.real && s.anims.exists(c.anim) ? c.anim : null;
    const img = (animKey ? s.add.sprite(Math.round(x), Math.round(y), c.anim, 0) : s.add.image(Math.round(x), Math.round(y), ph.key, c.frame))
      .setOrigin(0.5, c.originY ?? 1).setDepth(c.depth ?? 7);
    if (animKey && c.loop) img.play({ key: animKey, repeat: -1 }); // 계속 (바닥 불)
    else if (animKey) {
      img.play(animKey);
      img.once('animationcomplete', () => { if (img.active) img.setTexture(ph.key); });
    }
    if (c.screen) img.setScrollFactor(0);
    if (c.flip) img.setFlipX(true);
    if (c.angle) img.setAngle(c.angle);
    if (c.scale) img.setScale(c.scale);
    if (c.tint) img.setTint(Phaser.Display.Color.HexStringToColor(c.tint).color); // 같은 그림을 탄 것처럼 (P-13 찜통)
    const label = ph.real ? '' : (c.label ?? ph.label); // 이름표는 그림이 없을 때(임시 네모)만
    const p = { id: c.id, img, real: ph.real, head: c.head || null, dy: c.dy || 0 };
    if (label && !c.screen) p.tag = UI.tag(() => [img.x, img.y - img.displayHeight - 4], label);
    if (p.tag) p.tag.el.classList.add('prop-tag');
    this.props[c.id] = p;
    const to = c.alpha ?? 1;
    const sec = c.fade ?? 0;
    img.setAlpha(sec ? 0 : to);
    if (c.key === 'glow') {
      img.setBlendMode(Phaser.BlendModes.ADD);
      p.flicker = s.tweens.add({ targets: img, alpha: { from: to, to: to * 0.35 }, duration: 160, yoyo: true, repeat: -1, delay: sec * 1000 });
    }
    return this.op(sec * 1000, (t) => img.setAlpha(to * t), () => img.setAlpha(to), skip);
  }

  propOff(c, skip) {
    const p = this.props[c.id];
    if (!p) return Promise.resolve();
    const img = p.img;
    if (p.flicker) p.flicker.stop();
    const a0 = img.alpha;
    return this.op((c.fade ?? 0) * 1000, (t) => img.setAlpha(a0 * (1 - t)), () => {
      img.destroy();
      if (p.tag) p.tag.remove();
      if (this.props[c.id] === p) delete this.props[c.id];
    }, skip);
  }

  // 옮기기: x/to, y/dy, angle, seconds, ease (떨어지는 삿갓, 무너지는 기둥 …)
  propMove(c, skip) {
    const p = this.props[c.id];
    if (!p) return Promise.resolve();
    const img = p.img;
    const x0 = img.x;
    const y0 = img.y;
    const r0 = img.angle;
    const x1 = c.x != null || c.to != null ? this.xOf(c.x ?? c.to, c.offset || 0) : x0;
    const y1 = c.y != null ? c.y : c.ground ? this.groundAt(x1) : y0 + (c.dy || 0);
    const r1 = c.angle ?? r0;
    const ease = Phaser.Tweens.Builders.GetEaseFunction(c.ease || 'Sine.easeInOut');
    return this.op((c.seconds ?? 1) * 1000, (t) => {
      const k = ease(t);
      img.setPosition(Math.round(x0 + (x1 - x0) * k), Math.round(y0 + (y1 - y0) * k)).setAngle(r0 + (r1 - r0) * k);
    }, () => img.setPosition(Math.round(x1), Math.round(y1)).setAngle(r1), skip);
  }

  // 색 바꾸기 (꽃이 재가 됨): color, seconds, alpha
  propTint(c, skip) {
    const p = this.props[c.id];
    if (!p) return Promise.resolve();
    const img = p.img;
    const from = Phaser.Display.Color.ValueToColor(img.tintTopLeft);
    const to = Phaser.Display.Color.HexStringToColor(c.color || '#555555');
    const a0 = img.alpha;
    const a1 = c.alpha ?? a0;
    const set = (t) => {
      const k = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 100, Math.round(t * 100));
      img.setTint(Phaser.Display.Color.GetColor(k.r, k.g, k.b)).setAlpha(a0 + (a1 - a0) * t);
    };
    return this.op((c.seconds ?? 1) * 1000, set, () => set(1), skip);
  }

  // ───────── 동작 (그림이 없으면 머리 위에 동작 이름) ─────────
  // act: actor, name(동작 이름, 예 '머리끈을 묶는다'), anim(그림 이름), loop, seconds
  act(c, skip) {
    const a = this.get(c.actor ?? c.who);
    if (!a) return Promise.resolve();
    const sec = c.seconds ?? 1.6;
    const A = this.scene.anims;
    const key = c.anim && (A.exists(c.anim) ? c.anim : a.look && A.exists(`${a.look}_${c.anim}`) ? `${a.look}_${c.anim}` : null);
    if (key) {
      this.anim(a, key, !!c.loop);
      return skip ? Promise.resolve() : this.story.wait(sec * 1000, true);
    }
    if (skip || !c.name) return Promise.resolve();
    const tag = UI.tag(() => [a.x, a.headY - 20], `(${c.name})`);
    tag.el.classList.add('act-tag');
    this.scene.time.delayedCall(sec * 1000, () => tag.remove());
    return this.story.wait(sec * 1000, true);
  }

  // ───────── 머리 위 감정 아이콘 ─────────
  emoteTexture(kind) {
    const key = 'emote-' + kind;
    if (this.scene.textures.exists(key)) return key;
    const art = EMOTE_ART[kind];
    const gw = Math.max(...art.map((r) => r.length));
    const gh = art.length;
    const W = gw + 6;
    const H = gh + 6 + 3; // 아래 꼬리 3칸
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    // 말풍선: 흰 바탕 + 먹색 테두리 (모서리 한 칸씩 깎음) + 아래 꼬리
    const bw = W;
    const bh = gh + 6;
    g.fillStyle(0x2a1a14);
    g.fillRect(1, 0, bw - 2, bh).fillRect(0, 1, bw, bh - 2);
    g.fillRect(Math.floor(bw / 2) - 2, bh - 1, 4, 2).fillRect(Math.floor(bw / 2) - 1, bh + 1, 2, 2);
    g.fillStyle(0xfdf6e8);
    g.fillRect(2, 1, bw - 4, bh - 2).fillRect(1, 2, bw - 2, bh - 4);
    g.fillRect(Math.floor(bw / 2) - 1, bh - 1, 2, 2);
    art.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (!EMOTE_COLORS[ch]) return;
        g.fillStyle(EMOTE_COLORS[ch]).fillRect(3 + x + Math.floor((gw - row.length) / 2), 3 + y, 1, 1);
      });
    });
    g.generateTexture(key, W, H);
    g.destroy();
    return key;
  }

  // 배우 머리 위에 seconds 초 동안. 돌려주는 Promise 는 튀어나오는 동작(0.35초)이 끝나면 풀린다
  emote(a, kind, seconds, skip) {
    kind = EMOTE_ALIAS[kind] || kind;
    if (!a || skip || !EMOTE_ART[kind]) return Promise.resolve();
    const s = this.scene;
    const img = s.add.image(a.x, a.headY - 4, this.emoteTexture(kind)).setOrigin(0.5, 1).setScale(2).setDepth(30).setAlpha(0);
    const e = { a, img, dy: 10, end: null };
    let done = false;
    e.end = (instant) => {
      if (done) return;
      done = true;
      this.emotes.delete(e);
      if (instant) { img.destroy(); return; }
      s.tweens.add({ targets: img, alpha: 0, duration: 200, onComplete: () => img.destroy() });
    };
    this.emotes.add(e);
    s.tweens.add({ targets: img, alpha: 1, duration: 120 });
    s.tweens.add({ targets: e, dy: 0, duration: 350, ease: 'Back.easeOut' });
    s.time.delayedCall((seconds ?? this.T.emoteSec) * 1000, () => e.end());
    return new Promise((r) => s.time.delayedCall(350, r));
  }

  // 머리 위 아이콘을 계속 띄워 두기 (조사 지점 …): 돌려준 것의 end() 로 지움
  emoteHold(a, kind) {
    const s = this.scene;
    // 'img:<그림 이름>' 이면 그 그림을 그대로 (심부름 바구니 manju_basket). 그림이 없으면 도트 아이콘
    const imgKey = kind.startsWith('img:') && Sprites.has(s, kind.slice(4)) ? kind.slice(4) : null;
    const tex = imgKey || this.emoteTexture(EMOTE_ALIAS[kind] || (kind.startsWith('img:') ? 'basket' : kind));
    const img = s.add.image(a.x, a.headY - 4, tex).setOrigin(0.5, 1).setScale(imgKey ? 1 : 2).setDepth(30);
    const e = { a, img, dy: 0, hold: true };
    e.end = () => { this.emotes.delete(e); img.destroy(); };
    this.emotes.add(e);
    return e;
  }

  // ───────── 조사 지점 (대본의 〔조사〕) ─────────
  // 다가가면 아카네 머리 위에 … 와 키(E / 터치 '조사' 버튼). 누르면 속마음 대사가 말풍선으로 짧게 (게임은 멈추지 않음).
  // 조사한 것은 registry 'inspected' 에 { id: group } 으로 남는다 → 대본 조건 { inspected: id } / { inspectedAtLeast: n, group }
  get inspected() {
    const reg = this.scene.registry;
    if (!reg.get('inspected')) reg.set('inspected', {});
    return reg.get('inspected');
  }

  inspectCount(group) {
    return Object.entries(this.inspected).filter(([, g]) => group == null || g === group).length;
  }

  addPoint(c) {
    const x = this.xOf(c.at ?? c.x, c.offset || 0);
    if (x == null) {
      UI.note(`[조사] 위치 없음: ${c.id} ${c.label || ''} (at 을 채워야 함)`);
      return;
    }
    this.removePoint(c.id);
    const lines = c.lines || (c.text ? [{ speaker: c.speaker || 'akane', text: c.text }] : []);
    // recall: 조사하면 그 자리에서 과거 대사가 떠올라 흘러내림 (회상 자막, P-13)
    this.points.push({ id: c.id, x, radius: c.radius ?? 60, lines, group: c.group ?? null, once: !!c.once,
      recall: c.recall || null, recallColor: c.recallColor });
  }

  removePoint(id) {
    this.points = this.points.filter((p) => id != null && p.id !== id);
    if (this.near && !this.points.includes(this.near)) this.setNear(null);
  }

  setNear(pt) {
    if (this.near === pt) return;
    this.near = pt;
    if (this.nearIcon) { this.nearIcon.end(); this.nearIcon = null; }
    if (this.nearKey) { this.nearKey.remove(); this.nearKey = null; }
    document.body.classList.toggle('can-inspect', !!pt);
    if (!pt) return;
    const a = this.akane;
    this.nearIcon = this.emoteHold(a, '…');
    if (TouchPad.mode !== 'touch') {
      this.nearKey = UI.tag(() => [a.x + 30, a.headY - 14], 'E');
      this.nearKey.el.className = 'float inspect-key';
    }
  }

  inspect(pt) {
    const st = this.inspected;
    st[pt.id] = pt.group || '';
    const names = this.story ? this.story.characters : {};
    const a = this.akane;
    let t = 0;
    for (const ln of pt.lines) {
      const ms = Math.max(1600, 900 + ln.text.length * 70);
      const who = names[ln.speaker] || {};
      this.scene.time.delayedCall(t, () => {
        UI.bubble(() => [a.x, a.headY - 30], ln.text, { name: ln.speaker && ln.speaker !== 'akane' ? who.name : '아카네 · 속마음', ms });
        const els = document.querySelectorAll('.float.bubble');
        if (els.length) els[els.length - 1].classList.add('inspect');
      });
      t += ms;
    }
    if (pt.recall) {
      const nm = Object.fromEntries(Object.entries(names).map(([id, ch]) => [id, ch.name]));
      UI.recall(pt.recall, pt.x, this.groundAt(pt.x), nm, pt.recallColor);
    }
    this.scene.events.emit('inspect', pt.id);
    if (pt.once) this.removePoint(pt.id);
  }

  updatePoints() {
    const s = this.scene;
    const st = s.story;
    if (!this.points.length || (st && st.blocking) || s.player.dead) return this.setNear(null);
    const px = this.akane.x;
    let best = null;
    for (const p of this.points) {
      const d = Math.abs(p.x - px);
      if (d <= p.radius && (!best || d < Math.abs(best.x - px))) best = p;
    }
    this.setNear(best);
    if (best && s.controls.state.interact && s.controls.state.interact.pressed) this.inspect(best);
  }

  update() {
    this.updatePoints();
    // 머리 위에 얹은 소품 (축제 가면): 그 배우를 따라다닌다
    for (const p of Object.values(this.props)) {
      if (!p.head) continue;
      const a = this.get(p.head);
      if (!a) continue;
      p.img.setPosition(Math.round(a.x), Math.round(a.headY + p.dy)).setVisible(a.visible !== false);
      if (a.facing != null) p.img.setFlipX(a.facing < 0);
    }
    for (const e of this.emotes) {
      const bob = e.hold ? Math.floor(this.scene.time.now / 400) % 2 * 2 : 0;
      // 이름표가 있는 인물은 이름표 위로
      const tag = e.a.tag && e.a.tag.el.style.display !== 'none' && e.a.name ? 30 : 0;
      e.img.setPosition(Math.round(e.a.x), Math.round(e.a.headY - 4 - tag + e.dy - bob));
      e.img.setVisible(e.a.visible !== false);
    }
  }

  // ───────── 카메라 ─────────
  camFollow(name) {
    const a = this.get(name);
    const cine = this.scene.cine;
    if (!a || a === this.akane) {
      this.follow = null;
      cine.follow();
      return;
    }
    this.follow = a;
    cine.following = false; // 룩어헤드는 아카네를 따라갈 때만
    this.scene.cameras.main.setFollowOffset(0, 40);
    this.scene.cameras.main.startFollow(a.sprite, true, TUNING.cine.followLerpX, TUNING.cine.followLerpY);
  }

  // ───────── 대본 명령 ─────────
  // 처리했으면 true. 기다릴 것은 Promise 로 (wait: false 면 안 기다림)
  async command(c, skip) {
    const a = this.get(c.actor ?? c.who);
    let r = null;
    switch (c.cmd) {
      case 'moveTo': {
        let x = this.xOf(c.x ?? c.to, c.offset || 0);
        // near: 대상 배우 바로 앞(gap 50px)에서 멈춤 — 다가오는 쪽에서
        const t = c.near && this.get(c.x ?? c.to);
        if (t && a) x = t.x - (Math.sign(t.x - a.x) || 1) * (c.gap ?? 50) + (c.offset || 0);
        r = this.moveTo(a, x, c.speed, skip);
        break;
      }
      case 'face': this.face(a, c.dir ?? c.to); break;
      case 'anim': this.anim(a, c.anim ?? c.name, !!c.loop); break;
      case 'stopAnim': this.setPose(a, 'idle'); break;
      case 'jump': r = this.jump(a, this.xOf(c.x ?? c.to, c.offset || 0), skip, c.height); break;
      case 'sit': this.setPose(a, 'sit'); break;
      case 'kneel': this.setPose(a, 'kneel'); break;
      case 'standUp': this.setPose(a, 'idle'); break;
      case 'pose': this.setPose(a, c.pose); break;
      case 'emote': r = this.emote(a, c.kind ?? c.type, c.seconds, skip); break;
      case 'appear': r = this.appear(a, true, c.fade, skip); break;
      case 'disappear': r = this.appear(a, false, c.fade, skip); break;
      case 'spawn': r = this.spawn(c.actor ?? c.who, c.at ?? c.x, c, skip); break;
      case 'camFollow': this.camFollow(c.actor ?? c.who); break;
      case 'inspect': this.addPoint(c); break;            // 건너뛰어도 지점은 생긴다
      case 'emoteHold': {
        // 머리 위 아이콘을 계속 (심부름 중 바구니 등). on: false 면 지움
        this.held = this.held || {};
        const key = `${c.actor}:${c.kind}`;
        if (this.held[key]) { this.held[key].end(); delete this.held[key]; }
        if (c.on !== false && a) this.held[key] = this.emoteHold(a, c.kind);
        break;
      }
      case 'tremble': {
        // 손이 떨림 (그림을 2px 씩 몇 번 흔든다)
        if (skip || !a) break;
        const obj = a === this.akane ? a.p.visual : a.sprite;
        const x0 = obj.x;
        this.scene.tweens.add({ targets: obj, x: x0 + 2, duration: 40, yoyo: true, repeat: (c.times ?? 3) * 2 - 1 });
        break;
      }
      case 'prop': r = this.prop(c, skip); break;
      case 'propSwap': { const p = this.props[c.id]; if (p) p.img.setTexture(c.key, c.frame); break; } // 그림만 바꾸기 (떨어진 등롱 줄)
      case 'earTwitch': {
        // 귀 까딱: 그림 위쪽(귀) 몇 줄만 1px 옆으로 밀린 사본을 한 프레임 겹친다
        if (skip || !a) break;
        const obj = a === this.akane ? a.p.visual : a.sprite;
        const f = obj.frame;
        const rows = c.rows ?? 14;
        const ear = this.scene.add.image(obj.x + (obj.flipX ? -1 : 1), obj.y, obj.texture.key, f.name)
          .setOrigin(obj.originX, obj.originY).setFlipX(obj.flipX).setDepth(obj.depth + 0.05).setCrop(0, 0, f.width, rows);
        this.scene.time.delayedCall(90, () => ear.destroy());
        break;
      }
      case 'propOff': r = this.propOff(c, skip); break;
      case 'propMove': r = this.propMove(c, skip); break;
      case 'propTint': r = this.propTint(c, skip); break;
      case 'act': r = this.act(c, skip); break;
      case 'treeStage': {
        // 큰 벚나무 단계: tree(decorTrees id), stage: bare · bloom · burning · burnt, show
        const t = this.scene.decorTrees[c.tree];
        if (t && t.setStage) t.setStage(c.stage, c.show !== false, skip ? 0 : c.wipe || 0);
        break;
      }
      case 'stageBg': this.scene.setStageBg(c.id, c.key, c.tint != null ? Phaser.Display.Color.HexStringToColor(c.tint).color : undefined); break;
      case 'inspectClear': this.removePoint(c.id ?? null); break;
      default: return false;
    }
    if (r && c.wait !== false) await r;
    return true;
  }
}
