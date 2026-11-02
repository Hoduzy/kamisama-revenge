// 방(Room) 시스템: 스토리 장(프롤로그)은 배경 그림 한 장 = 방 하나. 전투 스테이지(1-1 ~ 6-3)는 예전 3겹 패럴랙스 그대로.
//
// - 방 설정: data/rooms/<id>.json (목록 data/rooms/index.json). 배경 · 배율 · 바닥선 · 입구 · 출구 · 장면 · 조명 · 환경음 · 소품 · 지점
// - 배율(scale): 그림 속 사람이 드나드는 문(door.height, 그림 px)이 아카네 키(82)의 1.4배가 되게 (115 / door.height). 도트는 Nearest Neighbor
// - 바닥선(floor): 그림 위에서부터 실제 바닥(마루 윗면 · 흙길 · 돌바닥)이 시작되는 높이(그림 px). 게임 바닥 판정(y = FLOOR_Y)이 이 선에 온다
// - 방은 월드에 왼쪽부터 띄엄띄엄 놓이고(사이 GAP), 카메라는 지금 방 밖을 절대 보여 주지 않는다 (setBounds + 기본 줌)
//   방이 화면보다 작으면 기본 줌을 올려 방이 화면을 꽉 채우게 한다 (그래도 아카네 : 문 = 1 : 1.4 는 그대로)
// - 예전 한 줄 맵의 x(대본 · 연출 표의 숫자와 지점 이름)는 legacy 표로 방 안 자리로 옮긴다 (Rooms.mapX). 지점(points)은 방 그림 px 로 덮어쓸 수 있다
// - 배율 · 바닥선은 F1 → 연출 시험 → '방' 슬라이더로 바꾸고 이 브라우저에 저장 / 방 파일로 내려받기
const ROOM_GAP = 600;
const ROOM_FLOOR_Y = 620; // 게임 바닥 판정 높이 (모든 방 같음)

const Rooms = {
  cfg: {},      // id → 설정 (data/rooms/<id>.json + 이 브라우저에 저장한 배율 · 바닥선)
  order: [],    // 프롤로그 방 순서
  list: [],     // 만든 방 (월드 자리 포함)
  current: null,

  // BootScene: 방 파일 불러오기 대기열
  queue(scene, index) {
    for (const id of index.prologue || []) scene.load.json('room-' + id, `data/rooms/${id}.json`);
  },

  init(cache) {
    const index = cache.get('rooms-index');
    if (!index) return;
    this.order = index.prologue || [];
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('kamisama-rooms') || '{}') || {}; } catch (e) { /* 무시 */ }
    for (const id of this.order) {
      const c = cache.get('room-' + id);
      if (!c) continue;
      if (saved[id]) Object.assign(c, saved[id]);
      this.cfg[id] = c;
    }
    this.build();
  },

  // 방 설정 → LEVELS.prologue (월드 자리 · 바닥 · 벽 · 인물 · 적 · 나무를 방 자리로)
  build() {
    const L = LEVELS.prologue;
    if (!L || !this.order.length) return;
    if (!L.legacyPoints) L.legacyPoints = { ...L.points };
    if (!L.legacy) L.legacy = { npcs: L.npcs, enemies: L.enemies, trees: L.trees, extraGround: L.extraGround || [] };
    this.list = [];
    let x0 = 0;
    for (const id of this.order) {
      const c = this.cfg[id];
      const s = Sprites.sheet(c.background) || { width: 512, height: 341 };
      const W = s.width * c.scale;
      const H = s.height * c.scale;
      const top = ROOM_FLOOR_Y - c.floor * c.scale;
      const zoom = Math.max(1, GAME_WIDTH / W, GAME_HEIGHT / H);
      this.list.push({ id, c, x0, w: W, h: H, top, bottom: top + H, zoom, imgW: s.width, imgH: s.height });
      x0 += W + ROOM_GAP;
    }
    const R = this;
    L.rooms = this.list;
    L.width = x0;
    L.paintedFloor = true;
    L.backgrounds = null;
    L.gates = [];
    L.ground = [{ x: 0, y: ROOM_FLOOR_Y, w: x0, h: 200 }];
    for (const r of this.list) {
      L.ground.push({ x: r.x0 - 40, y: 0, w: 40, h: 900 }, { x: r.x0 + r.w, y: 0, w: 40, h: 900 });
    }
    for (const g of L.legacy.extraGround) L.ground.push({ ...g, x: R.mapX(g.x) });
    const mapList = (arr, keys) => arr.map((d) => {
      const o = { ...d };
      for (const k of keys) if (o[k] != null) o[k] = R.mapX(o[k]);
      return o;
    });
    L.npcs = mapList(L.legacy.npcs, ['x']);
    L.enemies = mapList(L.legacy.enemies, ['x', 'minX', 'maxX']);
    L.trees = mapList(L.legacy.trees, ['x']);
    L.decorTrees = this.list.filter((r) => r.c.tree).map((r) => ({
      id: r.c.tree.id, x: r.x0 + this.imgX(r, r.c.tree.x), y: ROOM_FLOOR_Y, scale: r.c.tree.scale, hidden: true,
      canopy: { y: ROOM_FLOOR_Y - 150 * r.c.tree.scale, w: 70 * r.c.tree.scale },
    }));
    L.spawn = { x: this.list[0].x0 + 60, y: ROOM_FLOOR_Y - 60 };
    L.height = 720;
  },

  // 그림 px(가로) → 방 안 월드 x (뒤집힌 그림이면 설정의 px 는 뒤집힌 그림 기준)
  imgX(r, px) { return px * r.c.scale; },

  byId(id) { return this.list.find((r) => r.id === id) || null; },

  at(x) { return this.list.find((r) => x >= r.x0 - 20 && x <= r.x0 + r.w + 20) || null; },

  // 예전 한 줄 맵의 x → 새 월드 x. 지금 방의 legacy 구간에 들면 그 방, 아니면 legacy 가 그 x 를 가진 첫 방 (없으면 그대로)
  mapX(x) {
    if (typeof x !== 'number' || !this.list.length) return x;
    const pick = (r) => (r.c.legacy || []).find((seg) => x >= seg[0][0] && x <= seg[seg.length - 1][0]);
    let room = this.current;
    let seg = room && pick(room);
    if (!seg) {
      room = this.list.find((r) => pick(r));
      seg = room && pick(room);
    }
    if (!seg) return x;
    for (let i = 0; i < seg.length - 1; i++) {
      const [a, pa] = seg[i];
      const [b, pb] = seg[i + 1];
      if (x >= a && x <= b) return room.x0 + this.imgX(room, pa + (pb - pa) * (b === a ? 0 : (x - a) / (b - a)));
    }
    return room.x0 + this.imgX(room, seg[seg.length - 1][1]);
  },

  // 지점 이름 → 새 월드 x: 지금 방의 points(그림 px)가 있으면 그것, 아니면 예전 지점 x 를 옮긴 값
  pointX(name) {
    const r = this.current;
    if (r && r.c.points && r.c.points[name] != null) return r.x0 + this.imgX(r, r.c.points[name]);
    const old = (LEVEL.legacyPoints || {})[name];
    return old != null ? this.mapX(old) : null;
  },

  // 입구 자리 (side: 'left' | 'right')
  entryX(r, side = 'left') { return r.x0 + this.imgX(r, (r.c.entry || {})[side] ?? (side === 'left' ? 30 : r.imgW - 30)); },

  exitX(r, e) { return r.x0 + this.imgX(r, e.x); },

  saveLocal() {
    const out = {};
    for (const [id, c] of Object.entries(this.cfg)) out[id] = { scale: c.scale, floor: c.floor };
    try { localStorage.setItem('kamisama-rooms', JSON.stringify(out)); } catch (e) { /* 무시 */ }
  },

  // 방 파일 내려받기 (data/rooms/<id>.json 을 이 파일로 바꾸면 된다)
  download(id) {
    const c = this.cfg[id];
    if (!c) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(c, null, 1)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${id}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  },
};

// GameScene 쪽: 방 배경 · 카메라 · 출구 빛 · 방 사이 이동
const RoomRuntime = {
  // 방 배경 그림을 방마다 한 장씩 (거울 반복 · 이어 붙이기 없음)
  create(scene) {
    scene.roomImgs = {};
    for (const r of LEVEL.rooms) {
      const c = r.c;
      if (!scene.textures.exists(c.background)) {
        UI.devWarn(`방 배경을 불러오지 못함: ${SPRITE_DIR}${(Sprites.sheet(c.background) || {}).file || c.background + '.png'} (방 ${r.id})`);
        continue;
      }
      const img = scene.add.image(r.x0, r.top, c.background).setOrigin(0, 0).setScale(c.scale).setDepth(-90);
      if (c.flip) img.setFlipX(true);
      if (c.tint) img.setTint(Phaser.Display.Color.HexStringToColor(c.tint).color);
      scene.roomImgs[r.id] = img;
      for (const p of c.props || []) {
        const pi = scene.add.image(r.x0 + Rooms.imgX(r, p.x), ROOM_FLOOR_Y + (p.dy || 0), p.key).setOrigin(0.5, 1).setDepth(p.depth ?? 6);
        if (p.scale) pi.setScale(p.scale);
      }
    }
    scene.exitGlows = [];
    Rooms.current = null;

    scene.events.on('storySceneEnd', () => RoomRuntime.refreshExits(scene));
  },

  // 아카네가 있는 방이 바뀌었으면 카메라 경계 · 기본 줌 · 환경음 · 출구 빛
  update(scene) {
    const p = scene.player;
    const r = Rooms.at(p.body.center.x);
    if (r && r !== Rooms.current) this.enter(scene, r);
    if (!r || scene.roomBusy || scene.story.running || p.dead) return;
    // 출구: 빛 안으로 걸어 들어가면 다음 방으로
    for (const e of this.activeExits(scene, r)) {
      const ex = Rooms.exitX(r, e);
      // 빛기둥에 몸이 닿으면 (방 끝 벽에 막히기 전에)
      const inside = e.side === 'left' ? p.body.left <= ex + 2 : p.body.right >= ex - 2;
      if (inside) { this.go(scene, e); break; }
    }
  },

  enter(scene, r) {
    Rooms.current = r;
    // 체크포인트 벚꽃나무는 방 그림과 겹치므로 숨긴다 (부활은 방 입구에서)
    for (const t of scene.trees || []) {
      t.active = true;
      if (t.sprite) t.sprite.setVisible(false);
      if (t.container) t.container.setVisible(false);
    }
    const cam = scene.cameras.main;
    // 세로 경계: 방 그림 안에서, 바닥선 아래는 보이는 높이의 15% 까지만 (그림 아래쪽 어두운 띠가 화면을 차지하지 않게)
    const viewH0 = GAME_HEIGHT / r.zoom;
    const bottom = Math.min(r.bottom, Math.max(ROOM_FLOOR_Y + viewH0 * 0.15, r.top + viewH0));
    cam.setBounds(r.x0, r.top, r.w, bottom - r.top);
    scene.cine.baseZoom = r.zoom;
    // 세로: 바닥선이 보이는 화면 높이의 85% 에 오게 따라간다 (방 아래쪽 어두운 띠가 화면을 차지하지 않게)
    const viewH = GAME_HEIGHT / r.zoom;
    scene.cine.followY = 0.35 * viewH - 30;
    // 부활 자리: 이 방의 입구 (스토리 방에는 체크포인트 나무를 따로 세우지 않는다)
    scene.activeTree = { x: Rooms.entryX(r, 'left') + 20, y: ROOM_FLOOR_Y };
    if (!scene.story.running || Math.abs(cam.zoom - 1) < 0.01 || !scene.cine.zoomTouched) cam.setZoom(r.zoom);
    scene.cine.zoomTouched = false;
    const amb = r.c.ambience;
    if (amb && amb.id) scene.cine.ambience(amb.id, amb.every ?? 1.4, amb.volume ?? 0.5);
    this.refreshExits(scene);
  },

  // 다음 목표가 있는 출구: after 장면을 봤고 until 장면은 아직
  activeExits(scene, r) {
    const st = scene.story;
    return (r.c.exits || []).filter((e) => e.to && (!e.after || st.done(e.after)) && (!e.until || !st.played(e.until)));
  },

  refreshExits(scene) {
    for (const g of scene.exitGlows) scene.cine.exitGlowOff(g);
    scene.exitGlows = [];
    const r = Rooms.current;
    if (!r) return;
    for (const e of this.activeExits(scene, r)) scene.exitGlows.push(scene.cine.exitGlow(Rooms.exitX(r, e)));
  },

  // 걸어서 다음 방으로: 잠금 → 0.25초 검게 → 0.15초 (다음 방) → 입구에서 걸어 들어오는 자세로 0.25초 밝게 → 복귀
  async go(scene, e) {
    const to = Rooms.byId(e.to);
    if (!to) return;
    scene.roomBusy = true;
    const p = scene.player;
    const dir = e.side === 'left' ? -1 : 1;
    p.scripted = { anim: 'player_run', loop: true, walk: true };
    p.body.setVelocityX(dir * 120);
    await this.fade(scene, 1, 250);
    CineSound.sfx('step', { volume: 0.25 });
    const side = dir > 0 ? 'left' : 'right';
    scene.actors.akane.place(Rooms.entryX(to, side), dir);
    scene.actors.akane.setY(ROOM_FLOOR_Y);
    this.enter(scene, to);
    scene.cameras.main.centerOn(p.body.center.x, ROOM_FLOOR_Y - 120);
    await new Promise((res) => scene.time.delayedCall(150, res));
    CineSound.sfx('step', { volume: 0.25 });
    p.body.setVelocityX(dir * 120);
    await this.fade(scene, 0, 250);
    p.scripted = null;
    p.body.setVelocityX(0);
    scene.roomBusy = false;
    // 이 방의 장면 (아직 안 본 것)
    const scenes = (to.c.scenes || []).filter((id) => !scene.story.played(id));
    if (scenes.length) {
      scene.story.playEntries(scenes).then(() => {
        if (to.c.then === 'nextChapter') scene.goToChapter(scene.storyMap.next);
        this.refreshExits(scene);
      });
    }
  },

  fade(scene, to, ms) {
    return new Promise((res) => {
      const el = UI.root.querySelector('.fx-fade');
      el.style.transitionDuration = ms + 'ms';
      el.style.opacity = String(to);
      setTimeout(res, ms);
    });
  },
};
