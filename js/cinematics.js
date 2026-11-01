// 연출 도구 (Cinematics). 모든 장에서 쓰는 카메라 · 시간 · 화면 효과 · 빛과 입자 · 길 안내 · 소리.
// GameScene 마다 하나: scene.cine = new Cinematics(scene). 소리는 장면과 상관없이 CineSound 하나.
// 대본(data/story)에서는 같은 이름의 연출 명령으로 쓴다 (story-player.js → cine.command(c)). 명령 표: docs/cinematics.md
// 도트 느낌을 지키려고 셰이더는 쓰지 않는다: 색 오버레이(사각형/HTML), 캔버스 CSS 필터, Phaser Light2D, 입자.
// 수치는 config.js 의 TUNING.cine. F1 → '연출 시험'에서 바꿔 볼 수 있다.

// 브라우저에 저장해 둔 연출 수치(연출 시험에서 '브라우저에 저장')가 있으면 config.js 값 위에 덮는다
(function applySavedCine() {
  try {
    const saved = JSON.parse(localStorage.getItem('kamisama-cine') || 'null');
    if (!saved) return;
    const merge = (dst, src) => {
      for (const [k, v] of Object.entries(src)) {
        if (v && typeof v === 'object' && dst[k] && typeof dst[k] === 'object') merge(dst[k], v);
        else if (k in dst) dst[k] = v;
      }
    };
    merge(TUNING.cine, saved);
  } catch (e) { /* 저장소를 못 쓰면 config.js 값 그대로 */ }
})();

// 화면 색감 (컬러 오버레이)
const CINE_MOODS = {
  none: [0x000000, 0],
  dusk: [0xff8a3d, 0.17],   // 따뜻한 주황 (해 질 녘)
  night: [0x1a2258, 0.3],   // 밤 남색
  fire: [0xff3410, 0.24],   // 불타는 붉은색
};

// 플래시 색
const CINE_FLASH = { white: [255, 255, 255], red: [255, 40, 40], gold: [255, 206, 92] };

// 점광원 프리셋: 반지름 · 색 · 세기 · 깜빡임 정도
const CINE_LIGHTS = {
  lantern: { radius: 170, color: 0xffb060, intensity: 1.8, flicker: 0.08 },  // 등롱
  brazier: { radius: 210, color: 0xff8a34, intensity: 1.9, flicker: 0.16 },  // 화로
  torch: { radius: 170, color: 0xff9a40, intensity: 1.7, flicker: 0.22 },    // 횃불
  fire: { radius: 360, color: 0xff5a26, intensity: 2.8, flicker: 0.3 },      // 불길
};

// 입자 프리셋. area: 화면 전체에 흩뿌림(화면 고정) / burst: 한 점에서 터짐 / point: 한 점에서 계속
const CINE_PARTICLES = {
  petals: { kind: 'area', tex: 'fx_petals', frames: [0, 1, 2, 3], fallback: 'petal', tint: [0xffc4d4, 0xffb0c4, 0xffffff],
    lifespan: 5200, frequency: 90, speedY: [30, 70], wind: 70, scale: [1, 1], alpha: [1, 0.6], rotate: [0, 360] },
  embers: { kind: 'point', tex: 'cine-dot', tint: [0xffb040, 0xff7020, 0xffe090], blend: 'ADD',
    lifespan: 1600, frequency: 40, speedY: [-90, -40], speedX: [-25, 25], scale: [1, 0.3], alpha: [1, 0], area: 60 },
  smoke: { kind: 'point', tex: 'cine-soft', tint: [0x3a3438, 0x4a4448], lifespan: 3000, frequency: 160,
    speedY: [-40, -18], speedX: [-12, 12], scale: [0.6, 2.4], alpha: [0.45, 0], area: 40 },
  ash: { kind: 'area', tex: 'fx_petals', frames: [0, 1, 2, 3], fallback: 'petal', tint: [0x8a8a8a, 0x6a6a6a, 0xb0b0b0],
    lifespan: 6000, frequency: 110, speedY: [20, 45], wind: 25, scale: [0.9, 0.9], alpha: [0.9, 0.3], rotate: [0, 360] },
  straw: { kind: 'burst', tex: 'cine-line', tint: [0xd8b860, 0xc9a050, 0xe8d090], count: 14, lifespan: 900,
    speed: [120, 260], angle: [200, 340], gravityY: 700, scale: [1, 1], alpha: [1, 0], rotate: [0, 360] },
  sparks: { kind: 'burst', tex: 'cine-dot', tint: [0xfff0a0, 0xffc040, 0xffffff], blend: 'ADD', count: 18, lifespan: 420,
    speed: [160, 340], angle: [200, 340], gravityY: 800, scale: [1, 0.2], alpha: [1, 0] },
  steam: { kind: 'point', tex: 'cine-soft', tint: [0xffffff, 0xe8eef2], lifespan: 1700, frequency: 70,
    speedY: [-80, -40], speedX: [-20, 20], scale: [0.4, 2], alpha: [0.55, 0], area: 30 },
  dust: { kind: 'burst', tex: 'cine-soft', tint: [0x9a8a78, 0x7a6a5a], count: 10, lifespan: 600,
    speed: [30, 90], angle: [190, 350], gravityY: -20, scale: [0.3, 0.9], alpha: [0.6, 0] },
};

// 전경 실루엣: 캐릭터 앞을 1.3배 속도로 지나간다 (화면 높이는 고정, y = 화면 좌표)
const CINE_FOREGROUND = {
  lanterns: { tex: 'cine-fg-lanterns', y: 0, origin: [0.5, 0] },   // 위쪽 등롱 줄
  branch: { tex: 'cine-fg-branch', y: 0, origin: [0.5, 0] },       // 위쪽 벚꽃 가지
  pillar: { tex: 'cine-fg-pillar', y: GAME_HEIGHT, origin: [0.5, 1] }, // 아래에서 솟은 불타는 기둥
};

// 컷인: 초상화 시트마다 두 눈 한가운데 위치 (칸 폭·높이에 대한 비율, 그림을 보고 잼)
const CINE_EYES = {
  portraits: { x: 0.44, y: 0.61 },          // 아카네
  portraits_haru: { x: 0.45, y: 0.47 },
  portraits_soichiro: { x: 0.52, y: 0.55 },
  portraits_hakuya: { x: 0.5, y: 0.52 },
  portraits_village: { x: 0.5, y: 0.5 },
};

// 행동 안내: 행동 → 키 글자 / 터치 버튼
const CINE_ACTIONS = {
  move: { kb: 'A D', touch: '◀ ▶', buttons: ['left', 'right'] },
  jump: { kb: 'Space', touch: '점프', buttons: ['jump'] },
  attack: { kb: 'J', touch: '공격', buttons: ['attack'] },
  dash: { kb: 'K', touch: '대시', buttons: ['dash'] },
  skill1: { kb: 'U', touch: '베기', buttons: ['skill1'] },
  skill2: { kb: 'I', touch: '발도', buttons: ['skill2'] },
};

class Cinematics {
  constructor(scene) {
    this.scene = scene;
    this.cfg = TUNING.cine;
    this.lookDir = 1;
    this.lookX = 0;
    this.tiltY = 0;
    this.lookAheadOn = true;
    this.following = true;
    this.emitters = {};   // id → 입자
    this.lightsOn = false;
    this.lightList = {};  // id → { light, base }
    this.foregrounds = [];
    this.guide = { target: null, idle: 0, lastX: null, wind: null, exits: [], hint: null };
    this.slow = null;
    this.makeTextures();

    // 화면 색감 오버레이 (월드 위, 글자 HUD 아래). 줌아웃해도 가장자리가 비지 않게 넉넉히
    this.moodRect = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH * 3, GAME_HEIGHT * 3, 0x000000, 0)
      .setScrollFactor(0).setDepth(30);
    this.moodName = 'none';
    // 캔버스 CSS 필터 (탈색 · 흑백 컷)
    this.filter = { sat: 1, mono: false };
    this.applyFilter();
    // Light2D: 이후에 생기는 그림에도 빛을 입힌다
    this.onAdded = (go) => { if (this.lightsOn) this.light2d(go); };
    scene.events.on('addedtoscene', this.onAdded);
    scene.events.once('shutdown', () => this.destroy());
  }

  destroy() {
    const s = this.scene;
    s.events.off('addedtoscene', this.onAdded);
    this.filter = { sat: 1, mono: false };
    this.applyFilter();
    cancelAnimationFrame(this.slowRaf);
    UI.cineVignette(0, 0);
    UI.cineObjective(null);
    UI.cineArrow(null);
    this.clearActionHint(true);
  }

  // ───────── 임시 텍스처 (입자·전경 실루엣·출구 빛) ─────────
  makeTextures() {
    const s = this.scene;
    const T = s.textures;
    const g = () => s.make.graphics({ x: 0, y: 0 }, false);
    if (!T.exists('cine-dot')) { const q = g(); q.fillStyle(0xffffff).fillRect(0, 0, 3, 3); q.generateTexture('cine-dot', 3, 3); q.destroy(); }
    if (!T.exists('cine-line')) { const q = g(); q.fillStyle(0xffffff).fillRect(0, 0, 7, 2); q.generateTexture('cine-line', 7, 2); q.destroy(); }
    if (!T.exists('cine-soft')) {
      const c = T.createCanvas('cine-soft', 24, 24);
      const x = c.getContext();
      const r = x.createRadialGradient(12, 12, 0, 12, 12, 12);
      r.addColorStop(0, 'rgba(255,255,255,1)');
      r.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = r;
      x.fillRect(0, 0, 24, 24);
      c.refresh();
    }
    if (!T.exists('cine-pillar')) {
      // 출구 빛기둥: 아래가 진하고 위로 갈수록 사라짐, 가운데가 밝음
      const c = T.createCanvas('cine-pillar', 64, 260);
      const x = c.getContext();
      const v = x.createLinearGradient(0, 260, 0, 0);
      v.addColorStop(0, 'rgba(255,214,140,0.95)');
      v.addColorStop(1, 'rgba(255,214,140,0)');
      x.fillStyle = v;
      x.fillRect(0, 0, 64, 260);
      x.globalCompositeOperation = 'destination-in';
      const h = x.createLinearGradient(0, 0, 64, 0);
      h.addColorStop(0, 'rgba(0,0,0,0)');
      h.addColorStop(0.5, 'rgba(0,0,0,1)');
      h.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = h;
      x.fillRect(0, 0, 64, 260);
      c.refresh();
    }
    const dark = 0x07060c;
    if (!T.exists('cine-fg-lanterns')) {
      // 늘어진 줄에 매달린 등롱 실루엣 (불빛 점만 살짝)
      const q = g();
      q.lineStyle(3, dark).beginPath();
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const px = t * 600;
        const py = 30 + Math.sin(t * Math.PI) * 50;
        if (i === 0) q.moveTo(px, py); else q.lineTo(px, py);
      }
      q.strokePath();
      for (let k = 1; k < 6; k++) {
        const px = k * 100;
        const py = 30 + Math.sin((px / 600) * Math.PI) * 50;
        // 등롱: 검은 뚜껑·받침 + 안에서 빛나는 붉은 종이
        q.fillStyle(dark).fillRect(px - 1, py, 2, 10).fillRect(px - 9, py + 9, 18, 4).fillRect(px - 9, py + 42, 18, 4);
        q.fillStyle(0x9a2418).fillRoundedRect(px - 13, py + 12, 26, 31, 9);
        q.fillStyle(0xff8a3a, 0.85).fillRoundedRect(px - 8, py + 16, 16, 23, 6);
        q.fillStyle(0x5a120c).fillRect(px - 13, py + 22, 26, 2).fillRect(px - 13, py + 31, 26, 2);
      }
      q.generateTexture('cine-fg-lanterns', 600, 140);
      q.destroy();
    }
    if (!T.exists('cine-fg-branch')) {
      // 위에서 늘어진 벚꽃 가지 실루엣
      const q = g();
      q.lineStyle(9, dark).lineBetween(300, 0, 210, 70).lineStyle(6, dark).lineBetween(210, 70, 120, 110)
        .lineStyle(4, dark).lineBetween(210, 70, 230, 150).lineBetween(120, 110, 40, 120).lineBetween(150, 95, 160, 170);
      q.fillStyle(0x1a0c14);
      for (const [cx, cy, r] of [[120, 110, 26], [40, 120, 20], [230, 150, 24], [160, 172, 18], [190, 60, 22], [80, 95, 16], [260, 120, 16]]) {
        q.fillCircle(cx, cy, r);
      }
      q.generateTexture('cine-fg-branch', 300, 200);
      q.destroy();
    }
    if (!T.exists('cine-fg-pillar')) {
      // 불타는 기둥: 검은 기둥 + 가장자리 불빛 + 부러진 끝
      const q = g();
      q.fillStyle(dark).fillRect(16, 40, 40, 500).fillTriangle(16, 40, 56, 40, 40, 0);
      q.fillStyle(0xff5a1e, 0.85).fillRect(14, 120, 4, 90).fillRect(54, 220, 4, 120).fillRect(14, 300, 4, 60);
      q.fillStyle(0xffb040, 0.8).fillRect(30, 30, 6, 12).fillRect(42, 60, 4, 10);
      q.generateTexture('cine-fg-pillar', 72, 540);
      q.destroy();
    }
  }

  // ───────── 매 프레임 (GameScene.update 끝에서) ─────────
  update(dt) {
    this.updateCamera(dt);
    this.updateLights();
    this.updateGuide(dt);
  }

  // ───────── 카메라 ─────────
  // 룩어헤드: 움직이는 방향으로 화면 폭의 lookAhead(15%)만큼 앞을 비춘다. 멈추면 마지막 방향 유지
  updateCamera(dt) {
    const p = this.scene.player;
    if (!p || !this.following) return;
    const vx = p.body.velocity.x;
    if (Math.abs(vx) > 40) this.lookDir = Math.sign(vx);
    const want = this.lookAheadOn ? this.lookDir * GAME_WIDTH * this.cfg.lookAhead : 0;
    this.lookX += (want - this.lookX) * Math.min(1, dt * this.cfg.lookAheadLerp);
    // followOffset 은 카메라를 반대로 민다 (음수 = 오른쪽을 더 보여줌)
    this.scene.cameras.main.setFollowOffset(-this.lookX, 40 + this.tiltY);
  }

  // 부활처럼 순간 이동했을 때: 앞을 보는 쪽으로 바로 맞춘다
  snapCamera(dir = 1) {
    this.lookDir = dir;
    this.lookX = dir * GAME_WIDTH * this.cfg.lookAhead;
  }

  follow() {
    const cam = this.scene.cameras.main;
    this.following = true;
    cam.startFollow(this.scene.player.obj, true, this.cfg.followLerpX, this.cfg.followLerpY);
  }

  // 줌: 배율 · 시간(ms) · 이징. 끝나면 풀리는 Promise
  zoom(z = this.cfg.zoomIn, ms = this.cfg.zoomMs, ease = 'Sine.easeInOut') {
    const cam = this.scene.cameras.main;
    cam.zoomTo(z, ms, ease, true);
    return this.sleep(ms);
  }

  // target: 'player' | NPC id | { x, y } | x(숫자). hold 초 동안 머문 뒤 back 이면 주인공에게 돌아온다
  async pan(target, { ms = 900, hold = 0.8, back = true, ease = 'Sine.easeInOut' } = {}) {
    const s = this.scene;
    const cam = s.cameras.main;
    const pt = this.pointOf(target);
    if (!pt) return;
    cam.stopFollow();
    this.following = false;
    cam.pan(pt.x, pt.y, ms, ease, true);
    await this.sleep(ms + hold * 1000);
    if (!back) return;
    const p = s.player.body;
    cam.pan(p.center.x - this.lookX * -1, p.center.y - 40 - this.tiltY, ms, ease, true);
    await this.sleep(ms);
    this.follow();
  }

  // 위아래 틸트: dy(px, 음수 = 위를 더 보여줌)로 ms 동안
  tilt(dy, ms = 700) {
    return new Promise((resolve) => {
      this.scene.tweens.add({ targets: this, tiltY: dy, duration: ms, ease: 'Sine.easeInOut', onComplete: resolve });
    });
  }

  resetCamera(ms = 500) {
    const cam = this.scene.cameras.main;
    if (cam.zoom !== 1) cam.zoomTo(1, ms, 'Sine.easeInOut', true);
    if (this.tiltY) this.tilt(0, ms);
    if (!this.following) this.follow();
  }

  pointOf(t) {
    const s = this.scene;
    if (t == null || t === 'player') { const b = s.player.body; return { x: b.center.x, y: b.center.y - 40 }; }
    if (typeof t === 'number') return { x: t, y: s.player.body.center.y - 40 };
    if (typeof t === 'string') {
      const n = s.npcs && s.npcs[t];
      if (n) return { x: n.x, y: n.y - 60 };
      if (t === 'boss' && s.boss) return { x: s.boss.body.center.x, y: s.boss.body.center.y - 20 };
      const px = (LEVEL.points || {})[t];
      return px != null ? { x: px, y: s.player.body.center.y - 40 } : null;
    }
    return { x: t.x, y: t.y ?? s.player.body.center.y - 40 };
  }

  // 흔들림: level weak | mid | strong, dir: 'both' | 'v'(위에서 내리꽂는 충격) | 'h'
  shake(level = 'mid', dir = 'both') {
    const L = this.cfg.shake[level] || this.cfg.shake.mid;
    const a = L.amount;
    const v = new Phaser.Math.Vector2(dir === 'v' ? 0 : a, dir === 'h' ? 0 : a * (GAME_WIDTH / GAME_HEIGHT));
    this.scene.cameras.main.shake(L.ms, v, true);
  }

  // 레터박스: 위아래 검은 띠가 letterboxSec(0.4초) 동안 미끄러져 들어온다
  letterbox(on) {
    UI.letterbox(on, false, this.cfg.letterboxSec);
    return this.sleep(this.cfg.letterboxSec * 1000);
  }

  // ───────── 시간 ─────────
  // 히트스톱: sec 동안 물리·애니메이션·트윈·입자 모두 정지
  hitStop(sec = this.cfg.hitStop) {
    const s = this.scene;
    s.doHitStop(sec);
    if (this.frozen) return;
    this.frozen = true;
    s.tweens.pauseAll();
    s.anims.pauseAll();
    for (const e of Object.values(this.emitters)) if (e.pause) e.pause();
  }

  // GameScene 의 히트스톱이 끝날 때 부른다
  onHitStopEnd() {
    if (!this.frozen) return;
    this.frozen = false;
    const s = this.scene;
    s.tweens.resumeAll();
    s.anims.resumeAll();
    for (const e of Object.values(this.emitters)) if (e.resume) e.resume();
  }

  // 슬로모션: scale 배 속도로 sec 초, 끝날 때 back 초 동안 부드럽게 1배로
  slowmo(scale = this.cfg.slowmoScale, sec = this.cfg.slowmoSec, back = this.cfg.slowmoReturn) {
    cancelAnimationFrame(this.slowRaf);
    this.setTimeScale(scale);
    const t0 = performance.now();
    const step = () => {
      const t = (performance.now() - t0) / 1000;
      if (t < sec) { this.slowRaf = requestAnimationFrame(step); return; }
      const k = back > 0 ? Math.min(1, (t - sec) / back) : 1;
      this.setTimeScale(scale + (1 - scale) * (1 - (1 - k) * (1 - k)));
      if (k < 1) this.slowRaf = requestAnimationFrame(step);
    };
    this.slowRaf = requestAnimationFrame(step);
    return this.sleep((sec + back) * 1000);
  }

  endSlowmo() {
    cancelAnimationFrame(this.slowRaf);
    this.setTimeScale(1);
  }

  setTimeScale(k) {
    const s = this.scene;
    if (!s.physics || !s.physics.world) return;
    s.physics.world.timeScale = 1 / k; // Arcade 는 값이 클수록 느려진다
    s.tweens.timeScale = k;
    s.anims.globalTimeScale = k;
    for (const e of Object.values(this.emitters)) if (e.timeScale != null) e.timeScale = k;
  }

  // ───────── 화면 효과 ─────────
  flash(color = 'white', ms = 260) {
    const c = CINE_FLASH[color] || CINE_FLASH.white;
    this.scene.cameras.main.flash(ms, c[0], c[1], c[2], true);
  }

  // 비네트: 가장자리를 어둡게 (0 = 없음). sec 동안 바뀐다
  vignette(amount = this.cfg.vignette, sec = 0.6) {
    UI.cineVignette(amount, sec);
  }

  // 장면 색감: none | dusk | night | fire 로 sec(2초) 동안 서서히
  mood(name, sec = this.cfg.moodSec) {
    const [c1, a1] = CINE_MOODS[name] || CINE_MOODS.none;
    const r = this.moodRect;
    const from = Phaser.Display.Color.ValueToColor(r.fillColor);
    const to = Phaser.Display.Color.ValueToColor(name === 'none' ? r.fillColor : c1);
    const a0 = r.fillAlpha;
    this.moodName = name;
    if (this.moodTween) this.moodTween.stop();
    const o = { t: 0 };
    this.moodTween = this.scene.tweens.add({
      targets: o, t: 100, duration: sec * 1000, ease: 'Sine.easeInOut',
      onUpdate: () => {
        const c = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 100, o.t);
        r.setFillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), a0 + (a1 - a0) * (o.t / 100));
      },
    });
    return this.sleep(sec * 1000);
  }

  // 흑백 컷: frames 프레임(기본 1) 동안 흑백 고대비 (강한 일격)
  monoCut(frames = 1) {
    this.filter.mono = true;
    this.applyFilter();
    setTimeout(() => { this.filter.mono = false; this.applyFilter(); }, Math.max(1, frames) * 1000 / 60 + 8);
  }

  // 화면 전체 탈색: amount 0(그대로) ~ 1(흑백)로 sec 동안
  desaturate(amount = 0.8, sec = 0.6) {
    const from = 1 - this.filter.sat;
    const t0 = performance.now();
    cancelAnimationFrame(this.satRaf);
    const step = () => {
      const k = sec > 0 ? Math.min(1, (performance.now() - t0) / (sec * 1000)) : 1;
      this.filter.sat = 1 - (from + (amount - from) * k);
      this.applyFilter();
      if (k < 1) this.satRaf = requestAnimationFrame(step);
    };
    step();
  }

  applyFilter() {
    const c = this.scene.game.canvas;
    if (!c) return;
    const f = [];
    if (this.filter.mono) f.push('grayscale(1)', 'contrast(1.9)', 'brightness(1.15)');
    else if (this.filter.sat < 1) f.push(`saturate(${this.filter.sat.toFixed(3)})`);
    c.style.filter = f.join(' ');
  }

  // 컷인: 화면 가운데 가로 띠가 0.3초 만에 열리고, 그 안에 초상화의 눈 부분만 크게 → hold 초 → 닫힘
  cutIn(speaker, { face, hold = this.cfg.cutInHold } = {}) {
    const ch = (this.scene.story && this.scene.story.characters[speaker]) || {};
    UI.cineCutIn(ch, face, hold, (ch.sprite && CINE_EYES[ch.sprite.key]) || { x: 0.5, y: 0.45 });
    return this.sleep(300 + hold * 1000 + 220);
  }

  // ───────── 빛 (Phaser Light2D) ─────────
  // 밤 장면: ambient 를 낮추면 빛이 있는 곳만 따뜻하게 보인다. WebGL 이 아니면 아무것도 하지 않는다
  lights(on, ambient = 0x4a4a68) {
    const s = this.scene;
    if (s.game.renderer.type !== Phaser.WEBGL) return;
    this.lightsOn = on;
    if (on) {
      s.lights.enable().setAmbientColor(ambient);
      s.children.list.forEach((go) => this.light2d(go));
    } else {
      s.children.list.forEach((go) => { if (go.cineLit) { go.resetPipeline(); go.cineLit = false; } });
      for (const id of Object.keys(this.lightList)) this.lightOff(id);
      s.lights.disable();
    }
  }

  // 빛을 받는 그림: 이미지·스프라이트·타일 (빛나는 것 = ADD 혼합, 화면 고정 오버레이는 제외)
  light2d(go) {
    if (!go || go.cineLit || go.noLight || !go.setPipeline) return;
    const G = Phaser.GameObjects;
    if (!(go instanceof G.Image || go instanceof G.Sprite || go instanceof G.TileSprite)) return;
    if (go.blendMode === Phaser.BlendModes.ADD || go.scrollFactorX === 0) return;
    try { go.setPipeline('Light2D'); go.cineLit = true; } catch (e) { /* 이 그림은 빛을 못 받음 */ }
  }

  // 점광원 하나: preset lantern | brazier | torch | fire, 위치(x, y) 또는 at(NPC id 등)
  light(preset, x, y, id = `${preset}-${Object.keys(this.lightList).length}`) {
    const s = this.scene;
    if (!this.lightsOn) this.lights(true);
    if (!this.lightsOn) return null;
    const P = CINE_LIGHTS[preset] || CINE_LIGHTS.lantern;
    const l = s.lights.addLight(x, y, P.radius, P.color, P.intensity);
    this.lightList[id] = { light: l, base: P, seed: Math.random() * 100, n: 0 };
    return id;
  }

  lightOff(id) {
    const L = this.lightList[id];
    if (!L) return;
    this.scene.lights.removeLight(L.light);
    delete this.lightList[id];
  }

  // 깜빡임: 부드럽게 흔들리는 잡음 (불은 크게, 등롱은 살짝)
  updateLights() {
    const t = performance.now() / 1000;
    for (const L of Object.values(this.lightList)) {
      const f = L.base.flicker;
      const n = Math.sin(t * 7.3 + L.seed) * 0.5 + Math.sin(t * 13.1 + L.seed * 2) * 0.3 + (Math.random() - 0.5) * 0.4;
      L.n += (n - L.n) * 0.3;
      L.light.intensity = L.base.intensity * (1 + f * L.n);
      L.light.radius = L.base.radius * (1 + f * 0.35 * L.n);
    }
  }

  // ───────── 입자 ─────────
  // preset: petals | embers | smoke | ash | straw | sparks | steam | dust
  // opts: x, y (월드. area 프리셋은 없어도 됨), dir(바람 -1/1), seconds(그 뒤 멈춤), count(burst), id
  particles(preset, opts = {}) {
    const s = this.scene;
    const P = CINE_PARTICLES[preset];
    if (!P) return null;
    const tex = s.textures.exists(P.tex) ? P.tex : (P.fallback || 'cine-dot');
    const range = (r) => (Array.isArray(r) ? { min: r[0], max: r[1] } : r);
    const cfg = {
      lifespan: P.lifespan, tint: P.tint, alpha: { start: P.alpha[0], end: P.alpha[1] },
      scale: { start: P.scale[0], end: P.scale[1] }, emitting: P.kind !== 'burst',
    };
    if (P.frames && tex === P.tex) cfg.frame = P.frames;
    if (P.blend) cfg.blendMode = P.blend;
    if (P.rotate) cfg.rotate = range(P.rotate);
    if (P.gravityY) cfg.gravityY = P.gravityY;
    let em;
    if (P.kind === 'area') {
      // 화면 위쪽 넓게 → 바람 방향으로 흘러내림 (화면 고정)
      const dir = opts.dir ?? 1;
      Object.assign(cfg, {
        frequency: P.frequency, quantity: 1,
        speedY: range(P.speedY), speedX: { min: dir * P.wind * 0.6, max: dir * P.wind * 1.4 },
        emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-GAME_WIDTH * 0.3, -30, GAME_WIDTH * 1.6, 10) },
      });
      em = s.add.particles(0, 0, tex, cfg).setScrollFactor(0).setDepth(19);
    } else if (P.kind === 'point') {
      const a = P.area || 0;
      Object.assign(cfg, {
        frequency: P.frequency, speedY: range(P.speedY), speedX: range(P.speedX),
        emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-a / 2, -4, a, 8) },
      });
      em = s.add.particles(opts.x ?? s.player.body.center.x, opts.y ?? s.player.body.bottom, tex, cfg).setDepth(18);
    } else {
      Object.assign(cfg, { speed: range(P.speed), angle: range(P.angle) });
      em = s.add.particles(0, 0, tex, cfg).setDepth(18);
      em.explode(opts.count ?? P.count, opts.x ?? s.player.body.center.x, opts.y ?? s.player.body.center.y);
      s.time.delayedCall(P.lifespan + 200, () => em.destroy());
      return em;
    }
    em.noLight = true;
    const id = opts.id || `${preset}-${Date.now()}`;
    if (this.emitters[id]) this.emitters[id].destroy();
    this.emitters[id] = em;
    if (opts.seconds) s.time.delayedCall(opts.seconds * 1000, () => this.particlesStop(id));
    return id;
  }

  // 멈춤: 새로 만들지 않고 남은 입자가 다 사라지면 지운다
  particlesStop(id) {
    const ids = id ? [id] : Object.keys(this.emitters);
    for (const k of ids) {
      const em = this.emitters[k];
      if (!em) continue;
      delete this.emitters[k];
      em.stop();
      this.scene.time.delayedCall(6500, () => em.destroy());
    }
  }

  // ───────── 전경 실루엣 (캐릭터 앞, 1.3배 패럴랙스) ─────────
  // x: 카메라 가운데가 x 일 때 화면 가운데 보이는 월드 위치
  foreground(preset, x) {
    const P = CINE_FOREGROUND[preset];
    if (!P) return null;
    const k = this.cfg.foregroundParallax;
    const img = this.scene.add.image(GAME_WIDTH / 2 + (x - GAME_WIDTH / 2) * k, P.y, P.tex)
      .setOrigin(...P.origin).setScrollFactor(k, 0).setDepth(25);
    img.noLight = true;
    this.foregrounds.push(img);
    return img;
  }

  foregroundClear() {
    this.foregrounds.forEach((f) => f.destroy());
    this.foregrounds = [];
  }

  // ───────── 길 안내 ─────────
  // 목적지(x): 안 움직이고 guideIdle 초가 지나면 화면 끝에 붓 화살표가 맥박처럼. null 이면 끔
  guideTo(x) {
    this.guide.target = x;
    this.guide.idle = 0;
    this.guide.since = 0;
    if (x == null) UI.cineArrow(null);
  }

  // 목적지 쪽으로 흘러가는 벚꽃잎(petals) 또는 불티(embers) 바람. x = null 이면 멈춤
  guideWind(x, kind = 'petals', dir) {
    const s = this.scene;
    if (this.guide.wind) { this.guide.wind.stop(); const w = this.guide.wind; s.time.delayedCall(4000, () => w.destroy()); this.guide.wind = null; }
    this.guide.windX = x;
    this.guide.windKind = kind;
    if (x == null) return;
    const d = dir || Math.sign(x - s.player.body.center.x) || 1;
    this.guide.windDir = d;
    const tex = kind === 'embers' ? 'cine-dot' : (s.textures.exists('fx_petals') ? 'fx_petals' : 'petal');
    const em = s.add.particles(0, 0, tex, {
      frame: tex === 'fx_petals' ? [0, 1, 2, 3] : undefined,
      lifespan: 2600, frequency: 70, quantity: 1,
      speedX: { min: d * 160, max: d * 260 }, speedY: { min: -20, max: 20 },
      alpha: { start: 0.9, end: 0 }, rotate: { min: 0, max: 360 },
      tint: kind === 'embers' ? [0xffb040, 0xff7020] : [0xffc4d4, 0xffffff],
      blendMode: kind === 'embers' ? 'ADD' : 'NORMAL',
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(0, 120, 10, GAME_HEIGHT - 220) },
    }).setScrollFactor(0).setDepth(19);
    em.setPosition(d > 0 ? -20 : GAME_WIDTH + 10, 0); // 화면 한쪽 끝에서 목적지 쪽으로
    em.noLight = true;
    this.guide.wind = em;
  }

  // 왼쪽 위 목표 자막 (붓글씨). 새 목표는 화면 위쪽 가운데에 크게 → 작아지며 구석으로
  objective(text) {
    UI.cineObjective(text);
  }

  // 행동 안내: action(move | jump | attack | dash | skill1 | skill2) 키를 머리 위에. 그 행동을 하면 먹물처럼 번지며 사라짐
  actionHint(action) {
    this.clearActionHint(true);
    const A = CINE_ACTIONS[action];
    if (!A) return;
    const p = this.scene.player;
    const el = UI.cineActionHint(() => [p.body.center.x, p.body.top - 34], A);
    this.guide.hint = { action, el, buttons: A.buttons };
    for (const b of A.buttons) {
      const btn = document.querySelector(`.btn[data-action="${b}"]`);
      if (btn) btn.classList.add('cine-glow');
    }
  }

  clearActionHint(instant = false) {
    const h = this.guide.hint;
    if (!h) return;
    this.guide.hint = null;
    UI.cineActionHintDone(h.el, instant);
    for (const b of h.buttons) {
      const btn = document.querySelector(`.btn[data-action="${b}"]`);
      if (btn) btn.classList.remove('cine-glow');
    }
  }

  // NPC 가 가리키는 출구: 땅에서 솟는 빛기둥(맥박) + 올라가는 빛 입자. 돌려준 것을 지우려면 exitGlowOff(it)
  exitGlow(x) {
    const s = this.scene;
    const ground = (LEVEL.ground || []).find((r) => x >= r.x && x <= r.x + r.w && r.y > 300);
    const y = ground ? ground.y : LEVEL.height - 100;
    const img = s.add.image(x, y, 'cine-pillar').setOrigin(0.5, 1).setDepth(3).setBlendMode('ADD').setAlpha(0.5).setScale(1.4, 1);
    img.noLight = true;
    s.tweens.add({ targets: img, alpha: 0.95, scaleX: 1.8, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const em = s.add.particles(x, y, 'cine-dot', {
      lifespan: 1400, frequency: 90, speedY: { min: -90, max: -40 }, speedX: { min: -6, max: 6 },
      alpha: { start: 1, end: 0 }, tint: [0xffe0a0, 0xffffff], blendMode: 'ADD',
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-16, -6, 32, 6) },
    }).setDepth(3);
    em.noLight = true;
    const it = { img, em, x };
    this.guide.exits.push(it);
    return it;
  }

  exitGlowOff(it) {
    const list = it ? [it] : this.guide.exits.slice();
    for (const e of list) {
      e.img.destroy();
      e.em.destroy();
      this.guide.exits = this.guide.exits.filter((q) => q !== e);
    }
  }

  updateGuide(dt) {
    const s = this.scene;
    const p = s.player;
    if (!p) return;
    const G = this.guide;
    // 행동 안내: 그 행동을 했으면 번지며 사라짐
    if (G.hint) {
      const c = s.controls.state;
      const did = G.hint.action === 'move' ? (c.left.down || c.right.down) : c[G.hint.action] && c[G.hint.action].pressed;
      if (did) this.clearActionHint();
    }
    // 바람: 목적지에 닿으면 멈춤, 아니면 그쪽으로
    if (G.wind && G.windX != null) {
      const d = Math.sign(G.windX - p.body.center.x);
      if (Math.abs(G.windX - p.body.center.x) < 60) this.guideWind(null);
      else if (d && d !== G.windDir) this.guideWind(G.windX, G.windKind, d); // 지나쳤으면 바람도 돌아선다
    }
    // 화살표: 목적지가 있고 일정 시간 안 움직이면
    if (G.target == null) return;
    const x = p.body.center.x;
    if (Math.abs(G.target - x) < 50) { this.guideTo(null); return; }
    const moved = G.lastX != null && Math.abs(x - G.lastX) > 0.5;
    G.lastX = x;
    // 멈춰 있던 시간은 실제 시간으로 잰다 (프레임이 떨어져도 같은 초)
    const now = performance.now();
    if (moved || s.story.blocking || !G.since) G.since = now;
    G.idle = (now - G.since) / 1000;
    UI.cineArrow(G.idle >= this.cfg.guideIdle ? Math.sign(G.target - x) : null);
  }

  // ───────── 대본 명령 ─────────
  // story-player 가 모르는 명령은 여기로 온다. 처리했으면 true. skip: 장면 건너뛰는 중 (보여 주기만 하는 것은 생략)
  async command(c, skip) {
    const r = this.runCommand(c, skip);
    if (r === false) return false;
    if (r && r.then && c.wait !== false && !skip) await r;
    return true;
  }

  runCommand(c, skip) {
    const S = CineSound;
    switch (c.cmd) {
      case 'camZoom':
        if (skip) { this.scene.cameras.main.setZoom(c.zoom ?? 1); return null; }
        return this.zoom(c.zoom, c.ms, c.ease);
      case 'camPan': return skip ? null : this.pan(c.to, c);
      case 'camTilt': return this.tilt(c.y ?? 0, skip ? 0 : c.ms ?? 700);
      case 'camReset': this.resetCamera(c.ms); return null;
      case 'lookAhead': this.lookAheadOn = c.on !== false; return null;
      case 'hitStop': if (!skip) this.hitStop(c.seconds); return null;
      case 'monoCut': if (!skip) this.monoCut(c.frames); return null;
      case 'desaturate': this.desaturate(c.amount ?? 0.8, skip ? 0 : c.seconds ?? 0.6); return null;
      case 'vignette': this.vignette(c.amount ?? this.cfg.vignette, skip ? 0 : c.seconds ?? 0.6); return null;
      case 'mood': return this.mood(c.to, skip ? 0 : c.seconds ?? this.cfg.moodSec);
      case 'cutIn': return skip ? null : this.cutIn(c.speaker, c);
      case 'lights': this.lights(c.on !== false, c.ambient != null ? Phaser.Display.Color.HexStringToColor(c.ambient).color : undefined); return null;
      case 'light': { const pt = c.at ? this.pointOf(c.at) : { x: c.x, y: c.y }; if (pt) this.light(c.preset, pt.x, pt.y, c.id); return null; }
      case 'lightOff': this.lightOff(c.id); return null;
      case 'particles': {
        const pt = c.at ? this.pointOf(c.at) : { x: c.x, y: c.y };
        this.particles(c.preset, { ...c, x: pt && pt.x, y: pt && pt.y });
        return null;
      }
      case 'particlesStop': this.particlesStop(c.id); return null;
      case 'foreground': this.foreground(c.preset, c.x); return null;
      case 'foregroundClear': this.foregroundClear(); return null;
      case 'guideArrow': this.guideTo(c.to == null ? null : this.pointOf(c.to).x); return null;
      case 'guideWind': this.guideWind(c.to == null ? null : this.pointOf(c.to).x, c.kind); return null;
      case 'objective': this.objective(c.text || null); return null;
      case 'actionHint': if (c.action) this.actionHint(c.action); else this.clearActionHint(); return null;
      case 'exitGlow': if (c.on === false) this.exitGlowOff(); else this.exitGlow(this.pointOf(c.to ?? c.x).x); return null;
      case 'bgmDuck': S.duck(c.on !== false, c.seconds); return null;
      case 'silence': S.silence(); return null;
      default: return false;
    }
  }

  sleep(ms) {
    const st = this.scene.story;
    return st ? st.wait(ms) : new Promise((r) => setTimeout(r, ms));
  }
}

// ───────── 소리 ─────────
// sfx(id): assets/sfx/<id>.ogg|.mp3|.wav 가 있으면 그 파일, 없으면 ZzFX 로 만든 임시 소리.
// 파일은 처음 켤 때 한 번 찾아본다 → 나중에 같은 이름의 파일을 넣기만 하면 자동으로 바뀐다.
// bgm(id): assets/bgm/<id>.ogg|.mp3 (없으면 조용히). bgmDuck: 대사 중 음악 작게. silence: 모든 BGM 즉시 끊기
const CineSound = {
  // ZzFX 매개변수 [볼륨, 무작위, 주파수, 어택, 서스테인, 릴리즈, 파형, 곡선, 슬라이드, 델타슬라이드, 음 점프, 점프 시각,
  //   반복, 노이즈, 변조, 비트크러시, 지연, 서스테인 볼륨, 디케이, 트레몰로, 필터]
  PRESETS: {
    slash: [1.1, 0.05, 520, 0.01, 0.02, 0.12, 4, 1.6, -18, 0, 0, 0, 0, 4, 0, 0, 0, 0.7, 0.03],
    hit: [1.5, 0.05, 180, 0, 0.02, 0.15, 4, 2.4, -8, 0, 0, 0, 0, 0.9, 0, 0.2, 0, 0.6, 0.04],
    heavy: [2, 0.05, 60, 0.01, 0.1, 0.5, 4, 3, -2, 0, 0, 0, 0, 1, 0, 0.4, 0.1, 0.5, 0.2],
    parry: [1.2, 0.05, 1200, 0, 0.02, 0.28, 1, 1.8, 0, 0, 500, 0.03, 0, 0, 0, 0, 0, 0.6, 0.02],
    dash: [0.8, 0.05, 260, 0.02, 0.04, 0.18, 4, 0.5, 10, 0, 0, 0, 0, 2, 0, 0, 0, 0.5, 0.04],
    iaido: [1.6, 0.05, 700, 0.01, 0.05, 0.4, 4, 2, -20, 0, 0, 0, 0, 3, 0, 0.1, 0, 0.7, 0.05],
    hammer: [1.4, 0.05, 900, 0, 0.01, 0.3, 2, 3, 0, 0, -300, 0.01, 0, 0.2, 0, 0.3, 0.04, 0.6, 0.06],
    steam: [0.7, 0.3, 1000, 0.05, 0.6, 0.6, 4, 0, 0, 0, 0, 0, 0, 30, 0, 0, 0, 0.5, 0.3],
    bell: [1, 0.01, 520, 0.01, 0.3, 1.8, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0.1, 0.6, 0.4, 0.05],
    fire: [0.6, 0.5, 200, 0, 0.3, 0.3, 4, 0, 0, 0, 0, 0, 0.05, 9, 0, 0.3],
    arrow: [0.9, 0.05, 900, 0.02, 0.08, 0.3, 0, 2, -60, 0, 0, 0, 0, 1],
    step: [0.4, 0.1, 90, 0, 0.01, 0.05, 4, 2, 0, 0, 0, 0, 0, 2],
    swish: [0.3, 0.2, 1600, 0.1, 0.1, 0.3, 0, 0, 8],
    ui_click: [0.6, 0.01, 880, 0, 0.01, 0.04, 1],
    ui_confirm: [0.7, 0.01, 660, 0, 0.04, 0.15, 1, 1, 0, 0, 220, 0.05],
    drum: [1.6, 0.05, 70, 0.005, 0.05, 0.4, 0, 2, -3, 0, 0, 0, 0, 0.3, 0, 0, 0, 0.6, 0.1],
    boom: [2, 0.1, 40, 0.02, 0.3, 1.2, 4, 3, -1, 0, 0, 0, 0, 2, 0, 0.6, 0.1, 0.4, 0.4],
    wind: [0.5, 0.5, 300, 0.5, 1, 0.8, 4, 0, 0, 0, 0, 0, 0, 20, 0, 0, 0, 0.4, 0.4],
    heartbeat: [1.2, 0, 55, 0.005, 0.02, 0.2, 0, 2, -2, 0, 0, 0, 0.35],
  },
  EXT: ['ogg', 'mp3', 'wav'],
  files: {},     // id → 찾은 파일 경로 | null
  zz: {},        // id → ZZFXSound
  bgmEl: null,
  bgmId: null,
  ducked: false,

  // assets/sfx/ 에 같은 이름의 파일이 있는지 찾아 둔다 (id 마다 한 번). 장 시작 로딩 때 그 장 대본이 쓰는 id 를,
  // 그 밖의 id 는 처음 울릴 때 찾는다 (없는 파일을 한꺼번에 찾으면 콘솔이 404 로 가득 차서)
  probing: {},
  probe(ids = []) {
    return Promise.all(ids.map((id) => {
      if (this.probing[id]) return this.probing[id];
      this.probing[id] = this.EXT.reduce((p, ext) => p.then((hit) => hit || fetch(`assets/sfx/${id}.${ext}`, { method: 'HEAD' })
        .then((r) => (r.ok ? `assets/sfx/${id}.${ext}` : null), () => null)), Promise.resolve(null))
        .then((hit) => { this.files[id] = hit; });
      return this.probing[id];
    }));
  },

  // 대본 장들이 쓰는 효과음 id (조건·선택지 안쪽까지)
  idsOf(story, chapters) {
    const out = new Set();
    const walk = (cmds) => {
      for (const c of cmds || []) {
        if (c.cmd === 'sfx' && c.id) out.add(c.id);
        for (const k of ['then', 'else', 'commands']) walk(c[k]);
        for (const o of [...(c.options || []), ...(c.cases || [])]) walk(o.commands);
      }
    };
    for (const id of chapters) {
      const ch = story.chapters[id];
      if (ch) for (const sc of ch.scenes) { walk(sc.commands); Object.values(sc.blocks || {}).forEach(walk); }
    }
    return [...out];
  },

  // 효과음: volume(0~1), pitch 무작위 폭(±), distant(멀리서 = 작게)
  sfx(id, { volume = 1, pitch = 0.05, distant = false } = {}) {
    const v = volume * TUNING.cine.sfxVolume * (distant ? 0.4 : 1);
    const rate = 1 + (Math.random() * 2 - 1) * pitch;
    if (!(id in this.files)) this.probe([id]); // 처음: 찾는 동안은 임시 소리, 찾으면 다음부터 파일
    const file = this.files[id];
    if (file) {
      const a = new Audio(file);
      a.volume = Math.min(1, v);
      a.playbackRate = rate;
      a.play().catch(() => {});
      return;
    }
    const P = this.PRESETS[id];
    if (!P || typeof ZZFX === 'undefined') return;
    if (ZZFX.audioContext.state === 'suspended') ZZFX.audioContext.resume();
    if (!this.zz[id]) this.zz[id] = new ZZFXSound(P.slice());
    this.zz[id].play(v, rate, 0);
  },

  // BGM: assets/bgm/<id>.ogg|.mp3 를 fade 초 동안 바꿔 튼다 (파일이 없으면 조용히)
  bgm(id, fade = 1) {
    if (id === this.bgmId) return;
    this.stopBgm(fade);
    if (!id) return;
    const a = new Audio();
    const exts = ['ogg', 'mp3'];
    let i = 0;
    a.addEventListener('error', () => { if (++i < exts.length) { a.src = `assets/bgm/${id}.${exts[i]}`; a.play().catch(() => {}); } });
    a.src = `assets/bgm/${id}.${exts[0]}`;
    a.loop = true;
    a.volume = 0;
    a.play().catch(() => {});
    this.bgmEl = a;
    this.bgmId = id;
    this.fadeTo(a, this.target(), fade);
  },

  target() {
    return TUNING.story.bgmVolume * (this.ducked ? TUNING.cine.duckVolume : 1);
  },

  stopBgm(fade = 0.8) {
    const a = this.bgmEl;
    this.bgmEl = null;
    this.bgmId = null;
    if (a) this.fadeTo(a, 0, fade, () => a.pause());
  },

  // 대사 중 음악 작게 (StoryAudio 의 BGM 도 함께)
  duck(on, sec = 0.4) {
    this.ducked = on;
    if (this.bgmEl) this.fadeTo(this.bgmEl, this.target(), sec);
    if (StoryAudio.bgm) this.fadeTo(StoryAudio.bgm, TUNING.story.bgmVolume * (on ? TUNING.cine.duckVolume : 1), sec);
  },

  // 침묵: 모든 BGM 즉시
  silence() {
    if (this.bgmEl) { this.bgmEl.pause(); this.bgmEl = null; this.bgmId = null; }
    StoryAudio.stopBgm(0);
  },

  fadeTo(a, v, sec, done) {
    const v0 = a.volume;
    const t0 = performance.now();
    const step = () => {
      const k = sec > 0 ? Math.min(1, (performance.now() - t0) / (sec * 1000)) : 1;
      a.volume = Math.max(0, Math.min(1, v0 + (v - v0) * k));
      if (k < 1) requestAnimationFrame(step); else if (done) done();
    };
    step();
  },
};
