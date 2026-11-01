// 결과 화면 (장 클리어). 그림은 assets/result/ (tools/process_result.py), 수치는 config.js 의 TUNING.result.
//  1 히트스톱 → 게임 화면이 어두워지고 채도가 빠짐 · 가장자리 장식 · 레터박스
//  2 닫힌 두루마리가 떨어져 살짝 튕기고 좌우로 펼쳐짐
//  3 두루마리에 장 이름이 한 글자씩 (붓 소리)
//  4 1인칭 손이 오른쪽 위에서 들어와 멈추고 칼날이 반짝
//  5 손이 두루마리를 가로질러 베고 칼날 궤적 재생 (각도 = 손이 지나가는 길)
//  6 히트스톱 + 흰 플래시 + 강한 흔들림
//  7 두루마리가 궤적을 따라 잘려(같은 그림 + 다각형 마스크) 조각마다 단면을 달고 날아감, 종이 조각·꽃잎이 흩날림
//  8 먹물이 번지고 「討伐」이 왼쪽 → 오른쪽으로 붓질하듯 드러남 → 북 소리 + 작은 흔들림
//  9 斬 · 死 · 시간 · 기억 조각이 차례로, 마지막에 '점프 · 공격으로 계속'
// 보스를 쓰러뜨렸을 때는 4~6 을 두 번 (두 번째는 좌우 반전 → X 자) 하고 두루마리가 네 조각으로 흩어진다.
// 게임 화면(주 카메라)과 결과 화면(덧씌운 카메라)을 나눠, 어둡게·탈색은 게임 화면에만 걸린다.
const RESULT_DIR = 'assets/result/';

class ResultScreen {
  constructor(scene) {
    this.scene = scene;
    this.R = TUNING.result;
    this.objs = [];
  }

  // BootScene: 결과 화면 그림 불러오기
  static preload(scene, meta) {
    if (!meta) return;
    for (const [k, v] of Object.entries(meta)) {
      if (k.startsWith('_')) continue;
      if (v.frames) scene.load.spritesheet(k, RESULT_DIR + v.file, { frameWidth: v.frameWidth, frameHeight: v.frameHeight });
      else scene.load.image(k, RESULT_DIR + v.file);
    }
    for (const k of ['ui_scroll_closed', 'ui_scroll_open', 'ui_scroll_paper', 'ui_scroll_roller_l', 'ui_scroll_roller_r']) {
      scene.load.image(k, `${UI_DIR}${k}.png`);
    }
  }

  // 시간(ms) — speed 가 1 보다 작으면 느리게 (시험용)
  T(ms) { return ms / this.R.speed; }

  wait(ms) { return new Promise((r) => setTimeout(r, this.T(ms))); }

  tween(cfg) {
    return new Promise((resolve) => {
      this.scene.tweens.add({ ...cfg, duration: this.T(cfg.duration), delay: cfg.delay ? this.T(cfg.delay) : 0, onComplete: resolve });
    });
  }

  phase(name) { window.__resultPhase = name; }

  // 결과 화면 전용 물체: 주 카메라에는 안 보이고 덧씌운 카메라에만
  add(obj, depth = 0) {
    obj.isResult = true;
    obj.setScrollFactor(0).setDepth(1000 + depth);
    this.scene.cameras.main.ignore(obj);
    this.objs.push(obj);
    return obj;
  }

  setupCamera() {
    const s = this.scene;
    this.cam = s.cameras.add(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.cam.setScroll(0, 0);
    this.cam.ignore(s.children.list.filter((o) => !o.isResult));
    // 이후에 생기는 게임 물체(꽃잎 등)는 결과 카메라에 안 보이게
    // (생기는 순간에는 아직 결과 화면 표시가 안 붙어 있으므로 한 박자 뒤에 확인)
    this.onAdded = (o) => { Promise.resolve().then(() => { if (!o.isResult && this.cam) this.cam.ignore(o); }); };
    s.events.on('addedtoscene', this.onAdded);
    s.events.once('shutdown', () => s.events.off('addedtoscene', this.onAdded));
  }

  // stats: { kills, deaths, time(초), memories: [가진 수, 전체] | null, title, boss }
  async play(stats) {
    const s = this.scene;
    const R = this.R;
    const W = GAME_WIDTH;
    const H = GAME_HEIGHT;
    this.phase('start');
    this.setupCamera();

    // 1. 히트스톱 → 어둡게 + 탈색 · 가장자리 장식 · 레터박스
    s.cine.hitStop(R.hitStop1);
    await this.wait(R.hitStop1 * 1000);
    const dark = s.add.rectangle(W / 2, H / 2, W * 3, H * 3, 0x050308, 0).setScrollFactor(0).setDepth(900);
    this.cam.ignore(dark);
    s.tweens.add({ targets: dark, fillAlpha: R.darken, duration: this.T(R.darkenMs) });
    if (s.game.renderer.type === Phaser.WEBGL && s.cameras.main.postFX) {
      const cm = s.cameras.main.postFX.addColorMatrix();
      const o = { v: 0 };
      s.tweens.add({ targets: o, v: R.desaturate, duration: this.T(R.darkenMs), onUpdate: () => cm.grayscale(o.v) });
    }
    if (s.textures.exists('result_frame')) {
      const fr = this.add(s.add.image(0, 0, 'result_frame').setOrigin(0).setScale(W / s.textures.get('result_frame').source[0].width).setAlpha(0), 1);
      s.tweens.add({ targets: fr, alpha: 1, duration: this.T(R.darkenMs) });
    }
    s.cine.letterbox(true);

    // 2. 두루마리: 떨어져 튕기고 펼쳐짐
    const open = s.textures.get('ui_scroll_open').source[0];
    const k = (W * R.scrollWidth) / open.width;
    const sw = open.width * k;
    const sh = open.height * k;
    const cx = W / 2;
    const cy = H * R.scrollY;
    this.scroll = { cx, cy, sw, sh, k };
    const closed = this.add(s.add.image(cx, -sh, 'ui_scroll_closed').setScale(k), 10);
    await this.tween({ targets: closed, y: cy, duration: R.dropMs, ease: 'Back.easeOut' });
    CineSound.sfx('drum', { volume: 0.5 });
    // 펼치기: 종이는 가운데에서 좌우로 드러나고 두 축이 양끝으로
    const rl = s.textures.get('ui_scroll_roller_l').source[0];
    const rr = s.textures.get('ui_scroll_roller_r').source[0];
    const paper = this.add(s.add.image(cx + (rl.width - rr.width) * k / 2, cy, 'ui_scroll_paper').setScale(k), 9);
    const pmask = s.make.graphics({}, false);
    paper.setMask(pmask.createGeometryMask());
    const rollL = this.add(s.add.image(cx, cy, 'ui_scroll_roller_l').setScale(k).setOrigin(1, 0.5), 11);
    const rollR = this.add(s.add.image(cx, cy, 'ui_scroll_roller_r').setScale(k).setOrigin(0, 0.5), 11);
    closed.destroy();
    const u = { t: 0 };
    const pw = s.textures.get('ui_scroll_paper').source[0].width * k;
    await this.tween({
      targets: u, t: 1, duration: R.unrollMs, ease: 'Cubic.easeOut',
      onUpdate: () => {
        const half = (pw / 2) * u.t;
        pmask.clear().fillStyle(0xffffff).fillRect(paper.x - half, cy - sh, half * 2, sh * 2);
        rollL.x = paper.x - half;
        rollR.x = paper.x + half;
      },
    });
    this.phase('scroll');

    // 3. 장 이름: 한 글자씩 (붓 소리)
    const title = stats.title || '';
    const chars = [...title];
    const style = { fontFamily: "'Nanum Brush Script', 'Song Myung', serif", fontSize: `${R.titleSize}px`, color: '#2a1416' };
    const probe = s.make.text({ text: title, style }, false);
    const tw = probe.width;
    probe.destroy();
    let x = cx - tw / 2;
    this.titleChars = [];
    for (const ch of chars) {
      const t = this.add(s.add.text(x, cy, ch, style).setOrigin(0, 0.5).setAlpha(0).setScale(1.25), 12);
      this.titleChars.push(t);
      x += t.width;
      if (ch.trim()) CineSound.sfx('swish', { volume: 0.7, pitch: 0.15 });
      s.tweens.add({ targets: t, alpha: 1, scale: 1, duration: this.T(160), ease: 'Quad.easeOut' });
      await this.wait(R.titleCharMs);
    }
    await this.wait(250);
    // 펼친 두루마리 + 글자를 한 장으로 굽는다 (자를 때 같은 그림을 마스크로 나눠 씀)
    this.bakeScroll([paper, rollL, rollR, ...this.titleChars]);

    // 4~6. 베기 (보스면 X 자로 두 번)
    const cuts = [R.slashAngle];
    if (stats.boss) cuts.push(180 - R.slashAngle);
    for (let i = 0; i < cuts.length; i++) await this.slash(cuts[i], i === 1);

    // 7. 잘린 조각이 날아감
    this.phase('split');
    await this.split(cuts);

    // 8. 먹물 + 討伐
    await this.kanji();
    this.phase('kanji');

    // 9. 기록
    await this.showStats(stats);
    this.phase('stats');
  }

  // 펼친 두루마리(종이·두 축·장 이름 글자)를 기억해 둔다. 자를 때 조각마다 같은 구성을 복사해 다각형 마스크로 나눈다
  bakeScroll(parts) {
    const { cx, cy, sw, sh } = this.scroll;
    this.scrollParts = parts;
    this.parts = parts.map((p) => ({
      text: p.type === 'Text' ? p.text : null, style: p.type === 'Text' ? p.style.toJSON() : null,
      key: p.texture && p.texture.key, x: p.x - cx, y: p.y - cy, sx: p.scaleX, sy: p.scaleY, ox: p.originX, oy: p.originY,
    }));
    this.bakedOrigin = { w: sw + 8, h: sh + 8 };
    this.phase('baked');
  }

  // 조각 하나 = 두루마리 구성을 복사한 컨테이너 (가운데 기준)
  scrollCopy() {
    const s = this.scene;
    const { cx, cy } = this.scroll;
    const c = this.add(s.add.container(cx, cy), 10);
    for (const d of this.parts) {
      const o = d.text != null
        ? s.add.text(d.x, d.y, d.text, d.style)
        : s.add.image(d.x, d.y, d.key);
      o.isResult = true; // 결과 카메라에서 숨기지 않게 (컨테이너 안 물체도 카메라 필터를 따른다)
      o.setScale(d.sx, d.sy).setOrigin(d.ox, d.oy);
      c.add(o);
    }
    return c;
  }

  // 4·5·6: 손이 들어와 멈추고 → 가로질러 베고 → 히트스톱·플래시·흔들림. mirror: 좌우 반전 (X 자 두 번째)
  async slash(angleDeg, mirror) {
    const s = this.scene;
    const R = this.R;
    const W = GAME_WIDTH;
    const a = Phaser.Math.DegToRad(angleDeg);
    const dir = { x: Math.cos(a), y: Math.sin(a) };   // 손이 지나가는 방향 (오른쪽 위 → 왼쪽 아래)
    const scale = W / s.textures.get('fx_slash_hand_1').source[0].width;
    // 4. 들어와 멈춤 (감속)
    const hand = this.add(s.add.image(-dir.x * R.handEnterDist, -dir.y * R.handEnterDist, 'fx_slash_hand_1')
      .setOrigin(0).setScale(scale).setFlipX(mirror), 30);
    await this.tween({ targets: hand, x: 0, y: 0, duration: R.handEnterMs, ease: 'Cubic.easeOut' });
    // 칼날 반짝임 (그림 속 반짝이 자리)
    const gx = (mirror ? 1 - 0.444 : 0.444) * W;
    const glint = this.add(s.add.image(gx, 0.25 * GAME_HEIGHT, 'cine-soft').setBlendMode('ADD').setScale(0.2).setTint(0xffffff), 31);
    CineSound.sfx('parry', { volume: 0.5, pitch: 0.1 });
    await this.tween({ targets: glint, scale: 2.4, alpha: 0, duration: R.glintMs, ease: 'Quad.easeOut' });
    glint.destroy();
    this.phase(mirror ? 'slash2-ready' : 'slash-ready');
    // 5. 프레임2 → 3 으로 바뀌며 왼쪽 아래 화면 밖으로, 동시에 두루마리 위에 궤적
    hand.setTexture('fx_slash_hand_2');
    CineSound.sfx('slash', { volume: 1 });
    const { cx, cy } = this.scroll;
    const art = (TUNING.result.artAngle != null ? TUNING.result.artAngle : (s.cache.json.get('result') || {}).result_slash?.artAngle) || 137.3;
    const trail = this.add(s.add.sprite(cx, cy, 'result_slash', 0).setScale(R.slashScale * this.scroll.k)
      .setFlipX(mirror).setRotation(Phaser.Math.DegToRad(mirror ? angleDeg - (180 - art) : angleDeg - art)), 20);
    trail.play({ key: 'result_slash_anim', frameRate: 5 / (this.T(R.slashAnimMs) / 1000) });
    trail.once('animationcomplete', () => trail.destroy());
    this.phase(mirror ? 'slash2' : 'slash');
    await this.tween({
      targets: hand, x: dir.x * R.handTravel, y: dir.y * R.handTravel, duration: R.slashMs, ease: 'Quad.easeIn',
      onUpdate: (tw) => { if (tw.progress > 0.4 && hand.texture.key !== 'fx_slash_hand_3') hand.setTexture('fx_slash_hand_3'); },
    });
    hand.destroy();
    // 6. 히트스톱 + 흰 플래시 + 강한 흔들림 (게임 화면과 결과 화면 모두)
    s.cine.hitStop(R.hitStop2);
    this.cam.flash(this.T(220), 255, 255, 255, true);
    const L = TUNING.cine.shake.strong;
    this.cam.shake(this.T(L.ms), L.amount, true);
    s.cine.shake('strong');
    CineSound.sfx('heavy');
    await this.wait(R.hitStop2 * 1000 + 60);
  }

  // 7: 궤적(cuts: 각도들, 두루마리 가운데를 지남)으로 두루마리를 나눠 조각마다 날려 보낸다
  async split(cutsDeg) {
    const s = this.scene;
    const R = this.R;
    const { cx, cy } = this.scroll;
    const { w, h } = this.bakedOrigin;
    const lines = cutsDeg.map((d) => { const a = Phaser.Math.DegToRad(d); return { d: { x: Math.cos(a), y: Math.sin(a) }, n: { x: -Math.sin(a), y: Math.cos(a) } }; });
    // 두루마리 사각형(가운데 기준)을 잘린 선의 양쪽으로 나눈다
    const rect = [{ x: -w / 2, y: -h / 2 }, { x: w / 2, y: -h / 2 }, { x: w / 2, y: h / 2 }, { x: -w / 2, y: h / 2 }];
    let polys = [{ pts: rect, sides: [] }];
    for (const L of lines) {
      const next = [];
      for (const p of polys) {
        for (const side of [1, -1]) {
          const c = ResultScreen.clip(p.pts, L.n, side);
          if (c.length >= 3) next.push({ pts: c, sides: [...p.sides, side] });
        }
      }
      polys = next;
    }
    for (const p of this.scrollParts) p.setVisible(false);
    const edgeKeys = ['result_edge_a', 'result_edge_b'];
    const pieces = polys.map((poly) => {
      const img = this.scrollCopy();
      const g = s.make.graphics({}, false);
      g.fillStyle(0xffffff).fillPoints(poly.pts, true);
      g.setPosition(cx, cy);
      img.setMask(g.createGeometryMask());
      // 잘린 면: 선마다 이 조각 안에 들어온 구간에 단면 그림
      const edges = lines.map((L, li) => {
        const on = poly.pts.filter((p) => Math.abs(p.x * L.n.x + p.y * L.n.y) < 0.5);
        if (on.length < 2) return null;
        on.sort((p, q) => (p.x * L.d.x + p.y * L.d.y) - (q.x * L.d.x + q.y * L.d.y));
        const p1 = on[0];
        const p2 = on[on.length - 1];
        const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const side = poly.sides[li];
        const key = edgeKeys[side > 0 ? 1 : 0];
        const e = this.add(s.add.image(0, 0, key), 11);
        const eh = s.textures.get(key).source[0].height * this.scroll.k * 0.9;
        e.setDisplaySize(len, eh);
        // 띠를 조각 안쪽으로 반만큼 → 찢긴 가장자리가 잘린 선에 걸침
        const inward = { x: L.n.x * side, y: L.n.y * side };
        const mid = { x: (p1.x + p2.x) / 2 + inward.x * eh * 0.35, y: (p1.y + p2.y) / 2 + inward.y * eh * 0.35 };
        return { e, mid, ang: Math.atan2(L.d.y, L.d.x) + (side > 0 ? Math.PI : 0) };
      }).filter(Boolean);
      const c = poly.pts.reduce((a, p) => ({ x: a.x + p.x / poly.pts.length, y: a.y + p.y / poly.pts.length }), { x: 0, y: 0 });
      const st = { x: cx, y: cy, rot: 0 };
      const apply = () => {
        img.setPosition(st.x, st.y).setRotation(st.rot);
        g.setPosition(st.x, st.y).setRotation(st.rot);
        const cs = Math.cos(st.rot);
        const sn = Math.sin(st.rot);
        for (const E of edges) E.e.setPosition(st.x + E.mid.x * cs - E.mid.y * sn, st.y + E.mid.x * sn + E.mid.y * cs).setRotation(E.ang + st.rot);
      };
      apply();
      return { img, g, edges, c, st, apply };
    });
    // 잘린 선을 따라 종이 조각·꽃잎
    const counts = (s.cache.json.get('result') || {})._counts || { pieces: 8, petals: 6 };
    for (const L of lines) {
      const half = Math.hypot(w, h) / 2;
      for (let i = 0; i < R.paperBits + R.petals; i++) {
        const isPetal = i >= R.paperBits;
        const key = isPetal ? `result_petal_${i % counts.petals}` : `result_piece_${i % counts.pieces}`;
        if (!s.textures.exists(key)) continue;
        const t = (Math.random() * 2 - 1) * half * 0.85;
        const px = cx + L.d.x * t;
        const py = cy + L.d.y * t;
        if (Math.abs(px - cx) > w / 2 || Math.abs(py - cy) > h / 2) continue;
        const side = Math.random() < 0.5 ? 1 : -1;
        const bit = this.add(s.add.image(px, py, key).setScale((isPetal ? 1.4 : 0.9) * this.scroll.k).setRotation(Math.random() * 6), 15);
        const sp = 60 + Math.random() * 160;
        s.tweens.add({
          targets: bit, x: px + L.n.x * side * sp + (Math.random() - 0.5) * 80, y: py + L.n.y * side * sp + 120 + Math.random() * 160,
          rotation: bit.rotation + (Math.random() - 0.5) * 10, alpha: 0, duration: this.T(900 + Math.random() * 500), ease: 'Quad.easeOut',
          onComplete: () => bit.destroy(),
        });
      }
    }
    // 조각들: 가운데에서 멀어지는 쪽으로 미끄러지며 돌면서 화면 밖으로
    await Promise.all(pieces.map((P) => {
      const len = Math.hypot(P.c.x, P.c.y) || 1;
      const ux = P.c.x / len;
      const uy = P.c.y / len;
      return this.tween({
        targets: P.st, x: cx + ux * R.pieceDist, y: cy + uy * R.pieceDist + R.pieceDist * 0.25,
        rot: Phaser.Math.DegToRad(R.pieceSpin) * (ux >= 0 ? 1 : -1), duration: R.pieceMs, ease: 'Quad.easeIn', onUpdate: P.apply,
      });
    }));
    for (const P of pieces) { P.img.destroy(true); P.edges.forEach((E) => E.e.destroy()); }
  }

  // 8: 먹물 번짐 → 討伐 이 왼쪽에서 오른쪽으로 붓질하듯 (앞쪽 가장자리가 들쭉날쭉한 마스크)
  async kanji() {
    const s = this.scene;
    const R = this.R;
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT * R.kanjiY;
    // 어두워진 화면 위에서도 먹 글씨가 읽히게, 한지처럼 옅은 빛을 먼저 깐다
    if (!s.textures.exists('result-glow')) {
      const ct = s.textures.createCanvas('result-glow', 320, 160);
      const g2 = ct.getContext();
      g2.setTransform(2, 0, 0, 1, 0, 0);
      const rg = g2.createRadialGradient(80, 80, 0, 80, 80, 80);
      rg.addColorStop(0, 'rgba(243,230,207,0.95)');
      rg.addColorStop(0.55, 'rgba(236,220,192,0.7)');
      rg.addColorStop(1, 'rgba(236,220,192,0)');
      g2.fillStyle = rg;
      g2.fillRect(0, 0, 160, 160);
      ct.refresh();
    }
    const glow = this.add(s.add.image(cx, cy, 'result-glow').setScale(R.kanjiScale * 2.2, R.kanjiScale * 1.55).setAlpha(0), 39);
    s.tweens.add({ targets: glow, alpha: R.kanjiGlow, duration: this.T(R.inkMs) });
    const ink = this.add(s.add.sprite(cx, cy, 'result_ink', 0).setScale(R.inkScale), 40);
    ink.play({ key: 'result_ink_anim', frameRate: 5 / (this.T(R.inkMs) / 1000) });
    CineSound.sfx('steam', { volume: 0.4, pitch: 0.2 });
    await this.wait(R.inkMs * 0.6);
    const kj = this.add(s.add.image(cx, cy, 'result_kanji').setScale(R.kanjiScale), 41);
    // 먹물은 글씨가 써지는 동안 옅어져 바탕 번짐으로 남는다
    s.tweens.add({ targets: ink, alpha: R.inkFade, duration: this.T(R.kanjiMs) });
    const left = cx - kj.displayWidth / 2 - 8;
    const right = cx + kj.displayWidth / 2 + 8;
    const top = cy - kj.displayHeight / 2 - 10;
    const bot = cy + kj.displayHeight / 2 + 10;
    const g = s.make.graphics({}, false);
    kj.setMask(g.createGeometryMask());
    const N = 10;
    const jag = Array.from({ length: N + 1 }, () => (Math.random() * 2 - 1) * R.kanjiJag);
    const u = { t: 0 };
    this.phase('kanji-writing');
    await this.tween({
      targets: u, t: 1, duration: R.kanjiMs, ease: 'Sine.easeInOut',
      onUpdate: () => {
        const x = left + (right - left + R.kanjiJag * 2) * u.t;
        const pts = [{ x: left, y: top }, { x: x, y: top }];
        for (let i = 0; i <= N; i++) pts.push({ x: x + jag[i], y: top + ((bot - top) * i) / N });
        pts.push({ x: left, y: bot });
        g.clear().fillStyle(0xffffff).fillPoints(pts, true);
      },
    });
    kj.clearMask(true);
    CineSound.sfx('drum');
    const L = TUNING.cine.shake.weak;
    this.cam.shake(this.T(L.ms), L.amount * 0.7, true);
    this.kanjiBottom = bot;
    await this.wait(200);
  }

  // 9: 기록 (0.1초 간격) → '점프 · 공격으로 계속' 천천히 깜빡임
  async showStats(st) {
    const s = this.scene;
    const R = this.R;
    const mm = Math.floor(st.time / 60);
    const ss = String(Math.floor(st.time % 60)).padStart(2, '0');
    const items = [
      `斬 ${st.kills}`,
      `死 ${st.deaths}`,
      `시간 ${mm}:${ss}`,
      `기억 조각 ${st.memories ? `${st.memories[0]}/${st.memories[1]}` : '—'}`,
    ];
    const style = { fontFamily: "'Song Myung', serif", fontSize: `${R.statsSize}px`, color: '#f5e6c8', stroke: '#1a0e10', strokeThickness: 4 };
    const y = Math.min(GAME_HEIGHT - 110, this.kanjiBottom + 26);
    const gap = 34;
    const texts = items.map((t) => s.make.text({ text: t, style }, false));
    const total = texts.reduce((a, t) => a + t.width, 0) + gap * (texts.length - 1);
    let x = GAME_WIDTH / 2 - total / 2;
    for (const t of texts) {
      const obj = this.add(s.add.text(x, y + 8, t.text, style).setOrigin(0, 0.5).setAlpha(0), 50);
      x += t.width + gap;
      t.destroy();
      s.tweens.add({ targets: obj, alpha: 1, y, duration: this.T(220), ease: 'Quad.easeOut' });
      CineSound.sfx('ui_click', { volume: 0.4 });
      await this.wait(R.statsGap);
    }
    const touch = TouchPad.mode === 'touch';
    const again = this.add(s.add.text(GAME_WIDTH / 2, y + 42, touch ? '화면을 눌러 계속' : '점프 · 공격으로 계속',
      { fontFamily: "'Gowun Batang', serif", fontSize: '15px', color: '#d8cdb8', stroke: '#1a0e10', strokeThickness: 3 })
      .setOrigin(0.5).setAlpha(0), 50);
    s.tweens.add({ targets: again, alpha: { from: 0.25, to: 1 }, duration: this.T(1100), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // 다각형을 원점을 지나는 직선(법선 n)의 side 쪽만 남긴다 (Sutherland–Hodgman)
  static clip(pts, n, side) {
    const f = (p) => (p.x * n.x + p.y * n.y) * side;
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const fa = f(a);
      const fb = f(b);
      if (fa >= 0) out.push(a);
      if ((fa >= 0) !== (fb >= 0)) {
        const t = fa / (fa - fb);
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
    return out;
  }
}
