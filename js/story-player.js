// 컷신 엔진 StoryPlayer: data/story/*.json 의 장면(명령 목록)을 순서대로 재생한다.
// 대사(say/think/voice)는 대화창, 연출(fade/letterbox/caption/cg …)은 HTML 레이어(UI)와 카메라로.
//   - 보통 장면(레터박스 장면 포함)은 조작 잠금: 게임이 멈추고 대사를 넘겨 가며 본다
//   - 조작 가능 컷신(controllable)은 걸으면서 대사가 자동으로 흘러간다 (도중에 레터박스가 켜지면 그동안만 잠금)
//   - 조작 모드(장면의 mode, 또는 mode 명령으로 도중에 바꿈):
//       auto = 입력 막음, 대사 넘기기만 (아카네도 배우 명령대로 움직임) · play = 보통 조작 (대사는 자동으로 흘러감)
//       slow = 걷기만, 이동 60%, 점프·공격·대시 막음 (버튼 회색). mode 를 쓰는 장면은 auto 에 레터박스가 자동으로 들어온다
//   - 배우 명령(moveTo, face, sit, emote, parallel …)은 js/actors.js. 명령 표는 docs/cinematics.md
//   - 넘기기: Space·J·Enter·탭 / 길게 누르거나 Esc 를 1초 누르면 장면 전체 건너뛰기 (선택지는 꼭 고른다).
//     건너뛰어도 그 장면의 결과(아이템, 자세·그림, 위치 이동, 등장·퇴장, 플래그)는 모두 반영된다
// 어느 위치에서 어느 장면이 나오는지는 js/level.js 의 story 표, 체크포인트 한마디(풀)도 여기서 고른다.
const STORY_FILES = ['prologue', 'ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6', 'epilogue', 'test'];

// BGM·효과음: data/story/audio.json 의 이름 → 파일 표. 파일이 없거나 비어 있으면 조용히 넘어간다
const StoryAudio = {
  table: { bgm: {}, sfx: {} },
  bgm: null,
  bgmName: null,

  init(table) {
    if (table) this.table = table;
  },

  src(kind, name) {
    return (this.table[kind] || {})[name] || null;
  },

  play(src, { loop = false, volume = 1 } = {}) {
    const a = new Audio(src);
    a.loop = loop;
    a.volume = volume;
    a.addEventListener('error', () => {}); // 파일이 없어도 조용히
    a.play().catch(() => {});
    return a;
  },

  playBgm(name) {
    if (name === 'stop') return this.stopBgm();
    if (name.startsWith('(')) { // '(현재 곡 작게)'
      if (this.bgm) this.bgm.volume = TUNING.story.bgmVolume * 0.35;
      return;
    }
    if (name === this.bgmName && this.bgm) {
      this.bgm.volume = TUNING.story.bgmVolume;
      return;
    }
    this.stopBgm();
    const src = this.src('bgm', name);
    if (!src) return;
    this.bgm = this.play(src, { loop: true, volume: TUNING.story.bgmVolume });
    this.bgmName = name;
  },

  stopBgm(sec = 0.8) {
    const a = this.bgm;
    this.bgm = null;
    this.bgmName = null;
    if (!a) return;
    const v0 = a.volume;
    const t0 = performance.now();
    const step = () => {
      const k = (performance.now() - t0) / (sec * 1000);
      if (k >= 1) { a.pause(); return; }
      a.volume = v0 * (1 - k);
      requestAnimationFrame(step);
    };
    step();
  },

  playSfx(name, distant) {
    if (name === 'stop') return;
    const src = this.src('sfx', name);
    if (src) this.play(src, { volume: TUNING.story.sfxVolume * (distant ? 0.4 : 1) });
  },
};

// 대화 카메라를 유지하는 명령 (대사 사이에 끼어도 확대를 풀지 않음)
const DIALOGUE_CAM_KEEP = ['say', 'think', 'voice', 'emote', 'emoteHold', 'face', 'wait', 'sfx', 'cutIn', 'act', 'anim', 'pose', 'sit', 'standUp',
  'kneel', 'tremble', 'setFlag', 'note', 'bgm', 'bgmDuck', 'ambience', 'particles', 'propTint', 'giveItem', 'objective', 'mode', 'section', 'stopAnim', 'earTwitch'];

class StoryPlayer {
  // BootScene 에서 읽어 둔 json 으로 만든다
  constructor(scene) {
    this.scene = scene;
    const cache = scene.cache.json;
    this.characters = cache.get('story-characters') || {};
    this.chapters = {};
    this.scenes = {};
    for (const id of STORY_FILES) {
      const ch = cache.get('story-' + id);
      if (!ch) continue;
      this.chapters[id] = ch;
      for (const s of ch.scenes) this.scenes[s.id] = { ...s, chapter: id };
    }
    this.dialogue = new DialogueBox(scene);
    this.running = null;   // 재생 중인 장면
    this.locked = false;   // 조작 잠금(게임 멈춤) 중인지
    this.queue = [];
    this.waiters = [];     // 넘기기 입력으로 일찍 끝낼 수 있는 기다림
    this.skipping = false;
    this.holdTime = 0;     // 길게 누르기 (초)
    this.holdStart = null;
    this.holdLatch = false;
    this.context = {};     // condition 판정에 쓰는 실행 중 값 (예: firstDown)
    const reg = scene.registry;
    if (!reg.get('storyFlags')) reg.set('storyFlags', {});
    if (!reg.get('storyPlayed')) reg.set('storyPlayed', []); // 시작한 장면
    if (!reg.get('storyDone')) reg.set('storyDone', []);     // 끝까지 본 장면 (맵의 막힌 길이 열림)
    this.poolState = reg.get('storyPools') || {};
    reg.set('storyPools', this.poolState);
    // 장면이 다시 시작되면(R, 개발 메뉴) 이 재생기는 멈춘다. 남은 명령이 새 화면을 건드리지 않게
    this.stopped = false;
    scene.events.once('shutdown', () => {
      this.stopped = true;
      this.queue = [];
      this.flushWaiters(false);
      this.dialogue.resolvePending();
      this.endSlowmo();
    });
  }

  get flags() { return this.scene.registry.get('storyFlags'); }
  get busy() { return !!this.running; }
  get blocking() { return !!this.running && this.locked; }
  played(id) { return this.scene.registry.get('storyPlayed').includes(id); }
  done(id) { return this.scene.registry.get('storyDone').includes(id); }

  // level.js 의 story 표 항목 → 재생할 장면 id 들. 'S1-1' | ['S0-7', 'S0-8'] | { scene, when }
  // once: 이미 본 장면은 빼기 (재시작해도 같은 장면이 다시 나오지 않게)
  resolve(entries, once = true) {
    const ids = [];
    for (const e of [].concat(entries || [])) {
      if (e && typeof e === 'object' && !Array.isArray(e)) {
        if (!this.test(e.when)) continue;
        ids.push(...[].concat(e.scene));
      } else if (e) {
        ids.push(...[].concat(e));
      }
    }
    return ids.filter((id) => !(once && this.played(id)));
  }

  // 표 항목을 차례로 재생 (앞 장면이 끝나야 다음)
  playEntries(entries) {
    return this.playAll(this.resolve(entries));
  }

  // 이어지는 장면 사이엔 검은 화면을 유지한다 (암전으로 끝나는 장면 → 다음 장면)
  async playAll(ids) {
    for (let i = 0; i < ids.length; i++) await this.play(ids[i], { keepFade: i < ids.length - 1 });
  }

  play(id, opts = {}) {
    const sc = this.scenes[id];
    if (!sc) {
      console.warn('[story] 장면 없음:', id);
      return Promise.resolve();
    }
    if (this.running) return new Promise((r) => this.queue.push(() => this.play(id, opts).then(r)));
    return this.runScene(sc, opts);
  }

  async runScene(sc, { keepFade = false } = {}) {
    this.running = sc;
    this.skipping = false;
    const controllable = !!sc.controllable;
    const played = this.scene.registry.get('storyPlayed');
    if (!played.includes(sc.id)) played.push(sc.id);
    this.cinema = false; // 레터박스 중인지
    this.mode = null;
    this.modeLetterbox = !!sc.mode; // mode 를 쓰는 장면: auto 일 때 레터박스 자동
    this.dialogue.open(this.characters, { controllable });
    this.setMode(sc.mode || (controllable ? 'play' : 'auto'));
    if (TUNING.cine.duckDuringDialogue) CineSound.duck(true); // 장면 동안 음악 작게
    try {
      await this.runList(sc.commands, sc);
    } catch (e) {
      console.error('[story]', sc.id, e);
    }
    if (this.stopped) return;
    // 정리: 대화창 닫기, 연출 걷기, 느린 화면·카메라 원래대로, 게임 재개
    this.dialogueCamOff();
    this.dialogue.close();
    if (TUNING.cine.duckDuringDialogue) CineSound.duck(false);
    // CG 가 남아 있으면 페이드아웃이 끝난 뒤 다음 장면으로
    if (!this.skipping) {
      const ms = UI.cgHide(0.8);
      if (ms) await new Promise((r) => setTimeout(r, ms));
    }
    this.cinema = false;
    for (const s of ['.fx-cg', '.fx-caption', '.fx-title', '.fx-bossname', '.fx-choice']) UI.hide(s);
    UI.letterbox(false);
    UI.prompt(null);
    if (this.faded && !keepFade) {
      this.faded = false;
      UI.fade(0, 0.6);
    }
    UI.skipGauge(0);
    this.endSlowmo();
    this.resetCamera();
    this.endMode();
    this.lock(false);
    this.running = null;
    this.skipping = false;
    const done = this.scene.registry.get('storyDone');
    if (!done.includes(sc.id)) done.push(sc.id);
    this.scene.events.emit('storySceneEnd', sc.id);
    const next = this.queue.shift();
    if (next) next();
  }

  // 조작 잠금 = 물리를 멈추고 게임 로직을 건너뜀 (GameScene.update 가 blocking 을 본다)
  lock(on) {
    if (on === this.locked) return;
    this.locked = on;
    const scene = this.scene;
    scene.cutscene = on;
    if (on) scene.physics.world.pause();
    else if (!(scene.hitStopTimer > 0)) scene.physics.world.resume();
  }

  // ───────── 조작 모드 ─────────
  get ctl() { return this.mode !== 'auto'; } // 플레이어가 움직일 수 있는 모드인지

  setMode(mode, { letterbox } = {}) {
    if (!['auto', 'play', 'slow'].includes(mode)) mode = 'auto';
    this.mode = mode;
    const ctl = mode !== 'auto';
    if (letterbox ?? this.modeLetterbox) {
      UI.letterbox(!ctl, this.skipping);
      this.cinema = !ctl;
    }
    this.lock(!ctl || this.cinema || !!this.faded);
    this.dialogue.setControllable(ctl);
    const slow = mode === 'slow';
    const scene = this.scene;
    scene.inputLimit = slow ? 'slow' : null;
    scene.player.speedMul = slow ? TUNING.actors.slowMode : 1;
    document.body.classList.toggle('slow-mode', slow);
  }

  endMode() {
    const scene = this.scene;
    scene.inputLimit = null;
    scene.player.speedMul = 1;
    document.body.classList.remove('slow-mode');
    if (scene.actors) scene.actors.endScene();
    this.mode = null;
  }

  // 조건이 맞을 때까지 매 프레임 확인. 건너뛰기·장면 재시작이면 바로 끝
  waitUntil(test) {
    if (this.skipping) return Promise.resolve();
    const scene = this.scene;
    return new Promise((resolve) => {
      const w = { skippable: false, done: false };
      const check = () => { if (test()) w.resolve(); };
      w.resolve = () => {
        if (w.done) return;
        w.done = true;
        scene.events.off('update', check);
        resolve();
      };
      scene.events.on('update', check);
      this.waiters.push(w);
    });
  }

  async runList(cmds, sc) {
    const list = cmds || [];
    for (let i = 0; i < list.length; i++) {
      if (this.stopped) return;
      const c = list[i];
      // 대화 카메라: 대사(대화창)가 이어지는 동안 1.25배 확대해 말하는 사람들을 대화창 위 공간 가운데로. 대사 아닌 연출이 오면 원래대로
      if (['say', 'think'].includes(c.cmd)) this.dialogueCam(c);
      else if (!DIALOGUE_CAM_KEEP.includes(c.cmd)) this.dialogueCamOff();
      await this.exec(c, sc);
    }
  }

  // ───────── 대화 카메라 ─────────
  dialogueCam(c) {
    const D = TUNING.dialogueCam;
    const scene = this.scene;
    const cine = scene.cine;
    const cam = scene.cameras.main;
    const A = scene.actors;
    if (!D || this.skipping || this.dialogue.controllable || !A) return;
    // 장면이 카메라를 직접 움직였으면(패닝 · 줌 · 다른 인물 따라가기) 건드리지 않는다
    // 장면이 확대 · 다른 인물 따라가기 중이거나 CG 가 떠 있으면 건드리지 않는다 (한 곳을 비추는 패닝은 괜찮다: 끝나면 그 자리로 돌아감)
    if (!this.dlgCam && (A.follow || Math.abs(cam.zoom - 1) > 0.01 || UI.cgShown)) return;
    const a = A.get(c.speaker);
    if (!a || a.visible === false) return;
    this.dlgPeople = (this.dlgPeople || []).filter((p) => p !== a && p.visible !== false).slice(-1).concat(a);
    // 너무 멀리 떨어진 사람은 빼고 (화면에 같이 담을 수 있는 만큼)
    const ppl = this.dlgPeople.filter((p) => Math.abs(p.x - a.x) < GAME_WIDTH / D.zoom * 0.8);
    const x = ppl.reduce((s, p) => s + p.x, 0) / ppl.length;
    const y = ppl.reduce((s, p) => s + (p.y + p.headY) / 2, 0) / ppl.length;
    // 대화창 위 공간의 가운데(화면 y = D.screenY)에 오도록: 화면 가운데에서 위로 (GAME_HEIGHT/2 - screenY)/zoom
    const cy = y + (GAME_HEIGHT / 2 - D.screenY) / D.zoom;
    if (!this.dlgCam) {
      this.dlgCam = { following: cine.following, x: cam.midPoint.x, y: cam.midPoint.y };
      // 맵 아래 끝에 막혀 인물을 대화창 위로 못 올리지 않게, 대화 동안만 카메라 경계를 아래로 넓힌다 (넓힌 곳은 대화창 뒤라 안 보임)
      cam.setBounds(0, 0, LEVEL.width, LEVEL.height + 240);
      cam.stopFollow();
      cine.following = false;
      cam.zoomTo(D.zoom, D.ms, 'Sine.easeInOut', true);
    }
    cam.pan(x, cy, D.ms, 'Sine.easeInOut', true);
  }

  dialogueCamOff() {
    if (!this.dlgCam) return;
    const prev = this.dlgCam;
    this.dlgCam = null;
    this.dlgPeople = [];
    const cam = this.scene.cameras.main;
    const cine = this.scene.cine;
    const ms = TUNING.dialogueCam.ms;
    cam.zoomTo(1, ms, 'Sine.easeInOut', true);
    this.scene.time.delayedCall(ms + 30, () => { if (!this.dlgCam) cam.setBounds(0, 0, LEVEL.width, LEVEL.height); });
    // 원래대로: 아카네를 따라가던 중이었으면 다시 따라가고, 한 곳을 비추던 중이었으면 그 자리로
    if (prev.following) cine.follow();
    else cam.pan(prev.x, prev.y, ms, 'Sine.easeInOut', true);
  }

  // ───────── 명령 하나 ─────────
  async exec(c, sc) {
    const scene = this.scene;
    const cam = scene.cameras.main;
    const skip = this.skipping;
    const dlg = this.dialogue;
    switch (c.cmd) {
      case 'say':
      case 'think':
      case 'voice':
        if (!skip) await dlg.line(c);
        break;
      case 'caption': {
        if (skip) break;
        dlg.hide();
        const ms = UI.caption(c.text);
        await this.wait(ms + 900 + c.text.length * 25, true);
        UI.hide('.fx-caption');
        await this.wait(350);
        break;
      }
      case 'fadeOut':
        this.faded = true;
        dlg.hide();
        if (this.ctl) this.lock(true); // 암전 동안은 걷지 않게
        UI.cgHide(skip ? 0 : c.duration ?? 0.8); // 떠 있던 CG 도 함께 어두워진다 (CG 가 검은 막보다 위라서)
        UI.fade(1, skip ? 0 : c.duration ?? 0.8);
        if (!skip) await this.wait((c.duration ?? 0.8) * 1000);
        break;
      case 'fadeIn': {
        // CG 가 떠 있으면 먼저 페이드아웃 (검은 화면 위에서) → 그다음 밝아진다
        const ms = UI.cgHide(skip ? 0 : 0.8);
        if (ms && !skip) await this.wait(ms);
        this.faded = false;
        UI.fade(0, skip ? 0 : c.duration ?? 0.8);
        if (!skip) await this.wait((c.duration ?? 0.8) * 1000);
        if (this.ctl && !this.cinema) this.lock(false);
        break;
      }
      case 'letterbox':
        UI.letterbox(c.on, skip);
        this.cinema = !!c.on;
        // 조작 가능 컷신이라도 레터박스가 있는 동안은 조작 잠금
        if (this.ctl) this.lock(!!c.on);
        break;
      case 'shake':
        // level: weak | mid | strong (예전 대본의 strength: 'strong' 도 받음), dir: both | v | h
        if (!skip) scene.cine.shake(c.level || (c.strength === 'strong' ? 'strong' : 'mid'), c.dir || 'both');
        break;
      case 'flash':
        // color: white | red | gold
        if (!skip) scene.cine.flash(c.color || 'white', c.ms ?? (c.soft ? 900 : 260));
        break;
      case 'slowmo':
        if (!skip) this.startSlowmo(c.seconds ?? TUNING.cine.slowmoSec, c.scale ?? TUNING.cine.slowmoScale, c.back);
        break;
      case 'bgm':
        // id: assets/bgm/<id> (연출 도구) / name: 대본의 곡 이름 (data/story/audio.json)
        if (c.id || c.id === null) { CineSound.bgm(c.id, c.fade ?? 1); break; }
        StoryAudio.playBgm(c.name);
        UI.audioCue(c.name === 'stop' ? '♪ BGM 멈춤' : `♪ BGM: ${c.name}${StoryAudio.src('bgm', c.name) ? '' : ' (파일 없음)'}`);
        break;
      case 'sfx':
        if (skip) break;
        // id: 효과음 프리셋/파일 (assets/sfx/<id>, 없으면 ZzFX 임시 소리) / name: 대본의 소리 이름 (audio.json)
        if (c.id) { CineSound.sfx(c.id, { volume: c.volume ?? 1, pitch: c.pitch ?? 0.05, distant: c.distant }); break; }
        StoryAudio.playSfx(c.name, c.distant);
        UI.audioCue(c.name === 'stop' ? '효과음 멈춤' : `소리: ${c.name}${StoryAudio.src('sfx', c.name) ? '' : ' (파일 없음)'}`);
        break;
      case 'cg':
        // 화면 가득. 검은 바탕에서 0.8초 떠오르고(아주 느리게 확대·패닝), 다음 대사는 CG 위에 나온다.
        // cgEnd · 암전 · 명전 · 카메라 이동 · 장면 끝에서 0.8초 페이드아웃으로 걷힌다
        if (skip) break;
        dlg.hide();
        if (this.ctl) this.lock(true); // CG 가 떠 있는 동안은 걷지 않게
        UI.cg(c);
        await this.wait(800);
        await this.wait(1000, true);
        break;
      case 'cgEnd': {
        if (skip) {
          UI.cgHide(0);
        } else {
          dlg.hide();
          const ms = UI.cgHide(0.8);
          if (ms) await this.wait(ms + 150);
        }
        if (this.ctl && !this.cinema && !this.faded) this.lock(false);
        break;
      }
      case 'titleCard': {
        if (skip) break;
        dlg.hide();
        const ms = UI.titleCard(c.text, c);
        await this.wait(ms + 1300, true);
        UI.hide('.fx-title');
        await this.wait(400);
        break;
      }
      case 'bossName': {
        scene.bossDisplayName = c.text; // 보스 체력바 이름도 바뀐다
        if (skip) break;
        dlg.hide();
        const ms = UI.bossName(c.text);
        await this.wait(ms + 900, true);
        UI.hide('.fx-bossname');
        break;
      }
      case 'giveItem': {
        const items = scene.registry.get('items') || [];
        if (!items.includes(c.name)) items.push(c.name);
        scene.registry.set('items', items);
        if (skip) break;
        UI.item(c.name);
        await this.wait(2200, true);
        break;
      }
      case 'wait':
        if (skip) break;
        dlg.hide();
        await this.wait(c.seconds * 1000, true);
        break;
      case 'cameraPan':
        if (skip) break;
        dlg.hide();
        { const ms = UI.cgHide(0.8); if (ms) await this.wait(ms); }
        await this.pan(c);
        break;
      case 'setFlag':
        this.flags[c.flag] = c.value;
        break;
      case 'condition':
        if (c.cases) {
          const hit = c.cases.find((k) => this.test(k.when));
          if (hit) await this.runList(hit.commands, sc);
        } else if (this.test(c.when)) {
          await this.runList(c.then, sc);
        } else if (c.else) {
          await this.runList(c.else, sc);
        }
        break;
      case 'choice': {
        // 선택은 건너뛰기 중에도 직접 고른다
        this.skipping = false;
        dlg.hide();
        const id = await UI.choice(c.options);
        this.flags['choice:' + sc.id] = id;
        const opt = c.options.find((o) => o.id === id);
        await this.runList(opt.commands, sc);
        break;
      }
      case 'run':
        await this.runList((sc.blocks || {})[c.block], sc);
        break;
      case 'include': {
        const other = this.scenes[c.scene];
        if (other) await this.runList(other.commands.slice(0, c.endBefore ?? c.toIndex ?? other.commands.length), sc);
        break;
      }
      case 'gameplay':
        // 실제 게임 동작 (js/gameplay.js). 조작이 필요한 건 건너뛰기 중에도 한다
        dlg.hide();
        await this.scene.gameplay.run(c, skip);
        break;
      case 'note':
        // 아직 게임으로 옮기지 못한 연출 메모: 개발 모드에서만 화면 구석에 작게 (style.css 의 body.dev-mode)
        if (!skip) UI.note(c.text);
        break;
      case 'section':
        break;
      // ───── 배우 시스템 (js/actors.js) ─────
      case 'mode':
        if (c.letterbox !== false) this.modeLetterbox = true;
        this.setMode(c.mode, { letterbox: c.letterbox });
        break;
      case 'parallel':
        // 여러 배우를 동시에: 안의 명령(또는 sequence 블록)을 한꺼번에 시작하고 모두 끝나면 다음으로
        await Promise.all((c.commands || []).map((x) => this.exec(x, sc)));
        break;
      case 'sequence':
        await this.runList(c.commands, sc);
        break;
      case 'hum': {
        // 흥얼거림 자막 (하루의 자장가): 화면 아래 작게 분홍 글. 다음 명령은 거의 다 흐른 뒤에 (wait: false 면 바로)
        // lines: [가사…] 면 한 줄씩 이어서 (줄 사이 gap 초)
        if (skip) break;
        // subtitle: false = 흥얼거리는 소리만 (가사 자막 없음)
        if (c.subtitle === false) { CineSound.sfx('hum', { volume: 0.4 }); break; }
        const lines = c.lines || [c.text];
        const dur = (t) => (c.seconds ?? Math.max(2.6, 1.4 + t.length * 0.12)) * 1000;
        let at = 0;
        lines.forEach((t) => {
          const d = dur(t);
          if (at === 0) UI.hum(t, d, c.color);
          else scene.time.delayedCall(at, () => UI.hum(t, d, c.color));
          at += d - 500 + (c.gap ?? 0) * 1000;
        });
        if (c.wait !== false) await this.wait(at, true);
        break;
      }
      case 'overwrite': {
        // 덮어쓰기 자막: 위쪽 반투명 글(text) 위를 다른 색 글(over)이 덮어 씀
        if (skip) break;
        const ms = UI.overwrite(c.text, c.over, c);
        await this.wait(ms + (c.hold ?? 1.6) * 1000, true);
        if (!c.keep) UI.overwriteHide();
        break;
      }
      case 'recall': {
        // 회상 자막: 그 자리(at, 없으면 아카네 옆)에 과거 대사가 반투명하게 떠올랐다가 빗물처럼 흘러내림
        if (skip) break;
        const A = scene.actors;
        const x = A.xOf(c.at ?? c.x) ?? A.akane.x;
        const lines = c.lines || [{ speaker: c.speaker, text: c.text }];
        const names = Object.fromEntries(Object.entries(this.characters).map(([id, ch]) => [id, ch.name]));
        const ms = UI.recall(lines, x, A.groundAt(x), names, c.color);
        if (c.wait !== false) await this.wait(ms * 0.75, true);
        break;
      }
      case 'waitForPlayerAt': {
        // play·slow 모드: 플레이어가 그 위치(반경 radius)에 오거나 지나가면 다음으로. auto 모드면 아카네가 걸어간다
        const A = scene.actors;
        const x = A.xOf(c.x ?? c.to, c.offset || 0);
        if (x == null) break;
        const p = scene.player;
        if (skip) { A.akane.place(x); break; }
        if (!this.ctl) { await A.moveTo(A.akane, x, c.speed || 'walk', false); break; }
        // dir: 1 = 오른쪽으로 가며 그 자리에 닿거나 지나가면(기본), -1 = 왼쪽으로. 0 = 반경 안에 들어올 때만
        const r = c.radius ?? 40;
        const dir = c.dir ?? 1;
        const reached = () => {
          const px = p.body.center.x;
          if (dir > 0) return px >= x - r;
          if (dir < 0) return px <= x + r;
          return Math.abs(px - x) <= r;
        };
        if (c.guide !== false && !reached()) scene.cine.guideTo(x);
        await this.waitUntil(reached);
        if (c.guide !== false) scene.cine.guideTo(null);
        if (this.skipping) A.akane.place(x); // 기다리다 건너뛰면 그 자리로
        break;
      }
      default:
        // 배우·카메라 동작이 시작되면 앞 대사 창은 내린다 (인물이 가려지지 않게)
        if (!skip && ['moveTo', 'jump', 'spawn', 'appear', 'disappear', 'sit', 'kneel', 'standUp', 'anim', 'emote', 'face', 'camPan', 'camZoom', 'camFollow'].includes(c.cmd)) dlg.hide();
        if (await scene.actors.command(c, skip)) break;
        // 연출 도구 명령 (camZoom, cutIn, particles, light, objective … docs/cinematics.md)
        if (!(await scene.cine.command(c, skip))) console.warn('[story] 모르는 명령', c);
    }
  }

  // when: memoriesAtLeast / ending / firstDown / flag + is | not
  test(when) {
    if (!when) return true;
    const reg = this.scene.registry;
    if (when.memoriesAtLeast != null && (reg.get('memories') || []).length < when.memoriesAtLeast) return false;
    if (when.ending != null && this.flags.ending !== when.ending) return false;
    if (when.firstDown != null && this.context.firstDown !== when.firstDown) return false;
    if (when.flag != null && 'is' in when && this.flags[when.flag] !== when.is) return false;
    if (when.flag != null && 'not' in when && this.flags[when.flag] === when.not) return false;
    // 조사 지점 (js/actors.js): inspected: id | [id…] (모두 조사했으면), inspectedAtLeast / inspectedLessThan: 개수 (group 이 있으면 그 묶음만)
    const A = this.scene.actors;
    if (when.inspected != null && ![].concat(when.inspected).every((id) => id in A.inspected)) return false;
    if (when.notInspected != null && [].concat(when.notInspected).some((id) => id in A.inspected)) return false;
    if (when.inspectedAtLeast != null && A.inspectCount(when.group) < when.inspectedAtLeast) return false;
    if (when.inspectedLessThan != null && A.inspectCount(when.group) >= when.inspectedLessThan) return false;
    return true;
  }

  // 기다림. skippable 이면 넘기기 입력으로 일찍 끝난다 (건너뛰기 중이면 바로 끝)
  wait(ms, skippable = false) {
    if (this.skipping) return Promise.resolve();
    return new Promise((resolve) => {
      const w = { skippable, done: false, resolve: () => { if (!w.done) { w.done = true; resolve(); } } };
      // 장면 시계로 잰다 → 일시정지하면 컷신(자막·자동 넘김 …)도 같이 멈춘다
      w.timer = this.scene.time.delayedCall(ms, w.resolve);
      this.waiters.push(w);
    });
  }

  flushWaiters(onlySkippable) {
    this.waiters = this.waiters.filter((w) => {
      if (w.done) return false;
      if (onlySkippable && !w.skippable) return true;
      if (w.timer) w.timer.remove(false);
      w.resolve();
      return false;
    });
  }

  // 장면 전체 건너뛰기: 남은 명령은 상태(플래그·아이템·레터박스 등)만 반영하고 바로 끝낸다
  skip() {
    this.skipping = true;
    if (this.scene.actors) this.scene.actors.finishAll(); // 걷던 배우는 도착한 자리로, 사라지던 배우는 사라진 채로
    this.flushWaiters(false);
    this.dialogue.resolvePending();
    UI.hide('.fx-cg');
  }

  // ───────── 카메라 / 느린 화면 ─────────
  async pan(c) {
    const cam = this.scene.cameras.main;
    if (c.zoom) {
      cam.zoomTo(c.zoom === 'in' ? 1.25 : 0.85, 900, 'Sine.easeInOut');
      await this.wait(1100, true);
      return;
    }
    const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[c.dir] || [0, 0];
    cam.stopFollow();
    this.panned = true;
    const from = { x: cam.scrollX, y: cam.scrollY };
    this.scene.tweens.add({ targets: cam, scrollX: from.x + d[0] * 160, scrollY: from.y + d[1] * 120, duration: c.slow ? 2200 : 1400, ease: 'Sine.easeInOut' });
    await this.wait(c.slow ? 2300 : 1500, true);
  }

  resetCamera() {
    const scene = this.scene;
    const cam = scene.cameras.main;
    if (cam.zoom !== 1) cam.zoomTo(1, 400);
    if (this.panned) {
      this.panned = false;
      cam.startFollow(scene.player.obj, true, 0.14, 0.12);
    }
  }

  // 슬로모션은 연출 도구에 맡긴다 (끝날 때 부드럽게 1배로 돌아옴)
  startSlowmo(sec, scale, back) {
    this.scene.cine.slowmo(scale, sec, back ?? TUNING.cine.slowmoReturn);
  }

  endSlowmo() {
    if (this.scene.cine) this.scene.cine.endSlowmo();
  }

  // ───────── 매 프레임 입력 ─────────
  // in: { advance, advanceSoft, hold, holdSoft, skip, left, right, confirm }
  //   advance / hold         : Space·J·Enter·탭 (잠긴 컷신) — 누르면 넘기기, 계속 누르고 있으면 건너뛰기
  //   advanceSoft / holdSoft : Enter·탭 (조작 가능 컷신 — Space·J 는 게임 조작)
  //   escHeld                : Esc 를 누르고 있는지 (1초면 건너뛰기)
  update(dt, input) {
    const held = (this.locked ? input.hold : input.holdSoft) || input.escHeld; // Esc 도 1초 누르면 건너뛰기
    if (!held) this.holdLatch = false;
    // 길게 누르기는 실제 시간으로 잰다 (프레임이 떨어져도 같은 길이)
    const now = performance.now();
    if (!this.running || UI.choiceButtons || !held || this.holdLatch) this.holdStart = null;
    else if (this.holdStart == null) this.holdStart = now;
    this.holdTime = this.holdStart == null ? 0 : (now - this.holdStart) / 1000;
    // 게이지는 잠깐 누른 걸로는 안 보이게 (보통 넘기기와 구분)
    const H = TUNING.story.holdToSkip;
    const show = 0.2;
    UI.skipGauge(this.holdTime > show ? (this.holdTime - show) / (H - show) : 0);
    if (!this.running) return;

    if (UI.choiceButtons) {
      if (input.left) UI.choiceMove(-1);
      if (input.right) UI.choiceMove(1);
      if (input.confirm) UI.choiceConfirm();
      return;
    }
    if (this.holdTime >= H) {
      this.holdStart = null;
      this.holdLatch = true; // 손을 뗄 때까지 다음 장면은 건너뛰지 않음
      UI.skipGauge(0);
      this.skip();
      return;
    }
    const advance = this.locked ? input.advance : input.advanceSoft;
    if (advance) this.flushWaiters(true);
    this.dialogue.update(dt, advance);
  }

  // ───────── 체크포인트 한마디 (게임을 멈추지 않음) ─────────
  // chapter: 지금 장, firstOfStage: 이번 스테이지의 첫 체크포인트인지
  checkpointChatter(chapter, firstOfStage) {
    const ch = this.chapters[chapter];
    if (!ch) return;
    const no = STORY_FILES.indexOf(chapter); // prologue 0, ch1 1 …
    const pools = ch.pools.filter((p) => !p.stages || p.stages.includes(this.scene.stageName));
    // 하루 목소리: 2장(S2-4 이후)부터 10%, 6장은 확정
    const haru = chapter === 'ch6' ? pools.find((p) => p.id === 'ch6_haru_voice')
      : no >= 2 ? this.chapters.ch2?.pools.find((p) => p.id === 'haru_voice') : null;
    const haruOk = haru && (chapter !== 'ch2' || this.played(haru.afterScene || ''));
    if (haruOk && Math.random() < haru.chance) {
      const line = this.pick(haru);
      UI.voiceToast(line.text, line.style, (haru.duration || 3) * 1000);
      return; // 하루가 말하면 타누키치는 쉰다
    }
    const tan = pools.find((p) => p.display === 'bubble');
    if (!tan) return;
    if (!(firstOfStage && tan.firstCheckpointOfStage) && Math.random() >= tan.chance) return;
    const line = this.pick(tan);
    const p = this.scene.player;
    const who = this.characters[line.speaker] || {};
    UI.bubble(() => [p.body.center.x, p.body.bottom - 96], line.text,
      { name: line.cmd === 'think' ? `${who.name} · 속마음` : who.name, ms: (tan.duration || 3) * 1000 });
  }

  // 같은 풀 안에서 다 나올 때까지 겹치지 않게 고른다
  pick(pool) {
    const st = this.poolState[pool.id] || (this.poolState[pool.id] = []);
    if (st.length >= pool.lines.length) st.length = 0;
    const left = pool.lines.map((_, i) => i).filter((i) => !st.includes(i));
    const i = left[Math.floor(Math.random() * left.length)];
    st.push(i);
    return pool.lines[i];
  }
}
