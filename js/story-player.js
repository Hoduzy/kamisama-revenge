// 컷신 엔진 StoryPlayer: data/story/*.json 의 장면(명령 목록)을 순서대로 재생한다.
// 대사(say/think/voice)는 대화창, 연출(fade/letterbox/caption/cg …)은 HTML 레이어(UI)와 카메라로.
//   - 보통 장면(레터박스 장면 포함)은 조작 잠금: 게임이 멈추고 대사를 넘겨 가며 본다
//   - 조작 가능 컷신(controllable)은 걸으면서 대사가 자동으로 흘러간다 (도중에 레터박스가 켜지면 그동안만 잠금)
//   - 넘기기: Space·J·Enter·탭 / 길게 누르면(또는 Esc) 장면 전체 건너뛰기 (선택지는 꼭 고른다)
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
    if (!reg.get('storyPlayed')) reg.set('storyPlayed', []);
    this.poolState = reg.get('storyPools') || {};
    reg.set('storyPools', this.poolState);
  }

  get flags() { return this.scene.registry.get('storyFlags'); }
  get busy() { return !!this.running; }
  get blocking() { return !!this.running && this.locked; }
  played(id) { return this.scene.registry.get('storyPlayed').includes(id); }

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

  async playAll(ids) {
    for (const id of ids) await this.play(id);
  }

  play(id) {
    const sc = this.scenes[id];
    if (!sc) {
      console.warn('[story] 장면 없음:', id);
      return Promise.resolve();
    }
    if (this.running) return new Promise((r) => this.queue.push(() => this.play(id).then(r)));
    return this.runScene(sc);
  }

  async runScene(sc) {
    this.running = sc;
    this.skipping = false;
    const controllable = !!sc.controllable;
    const played = this.scene.registry.get('storyPlayed');
    if (!played.includes(sc.id)) played.push(sc.id);
    if (!controllable) this.lock(true);
    this.dialogue.open(this.characters, { controllable });
    try {
      await this.runList(sc.commands, sc);
    } catch (e) {
      console.error('[story]', sc.id, e);
    }
    // 정리: 대화창 닫기, 연출 걷기, 느린 화면·카메라 원래대로, 게임 재개
    this.dialogue.close();
    for (const s of ['.fx-cg', '.fx-caption', '.fx-title', '.fx-bossname', '.fx-choice']) UI.hide(s);
    UI.letterbox(false);
    if (this.faded) {
      this.faded = false;
      UI.fade(0, 0.6);
    }
    UI.skipGauge(0);
    this.endSlowmo();
    this.resetCamera();
    this.lock(false);
    this.running = null;
    this.skipping = false;
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

  async runList(cmds, sc) {
    for (const c of cmds || []) await this.exec(c, sc);
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
        UI.fade(1, skip ? 0 : c.duration ?? 0.8);
        if (!skip) await this.wait((c.duration ?? 0.8) * 1000);
        break;
      case 'fadeIn':
        this.faded = false;
        UI.fade(0, skip ? 0 : c.duration ?? 0.8);
        UI.hide('.fx-cg');
        if (!skip) await this.wait((c.duration ?? 0.8) * 1000);
        break;
      case 'letterbox':
        UI.letterbox(c.on, skip);
        // 조작 가능 컷신이라도 레터박스가 있는 동안은 조작 잠금
        if (sc.controllable) this.lock(!!c.on);
        break;
      case 'shake':
        if (!skip) cam.shake(c.strength === 'strong' ? 420 : 220, c.strength === 'strong' ? 0.014 : 0.005);
        break;
      case 'flash':
        if (!skip) cam.flash(c.soft ? 900 : 260, ...(c.color === 'red' ? [255, 40, 40] : [255, 255, 255]));
        break;
      case 'slowmo':
        if (!skip) this.startSlowmo(c.seconds ?? 1.2, c.scale ?? 0.3);
        break;
      case 'bgm':
        StoryAudio.playBgm(c.name);
        UI.audioCue(c.name === 'stop' ? '♪ BGM 멈춤' : `♪ BGM: ${c.name}${StoryAudio.src('bgm', c.name) ? '' : ' (파일 없음)'}`);
        break;
      case 'sfx':
        if (skip) break;
        StoryAudio.playSfx(c.name, c.distant);
        UI.audioCue(c.name === 'stop' ? '효과음 멈춤' : `🔊 ${c.name}${StoryAudio.src('sfx', c.name) ? '' : ' (파일 없음)'}`);
        break;
      case 'cg':
        // 화면 가득. 다음 대사는 CG 위에 나오고, CG 는 페이드인·카메라 이동·다음 CG·장면 끝에서 걷힌다
        if (skip) break;
        dlg.hide();
        UI.cg(c.no, c.desc);
        await this.wait(1800, true);
        break;
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
        UI.hide('.fx-cg');
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
      case 'note':
        // 아직 게임으로 옮기지 못한 연출 메모: 개발 모드에서만 화면 구석에 작게 (style.css 의 body.dev-mode)
        if (!skip) UI.note(c.text);
        break;
      case 'section':
        break;
      default:
        console.warn('[story] 모르는 명령', c);
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
    return true;
  }

  // 기다림. skippable 이면 넘기기 입력으로 일찍 끝난다 (건너뛰기 중이면 바로 끝)
  wait(ms, skippable = false) {
    if (this.skipping) return Promise.resolve();
    return new Promise((resolve) => {
      const w = { skippable, done: false, resolve: () => { if (!w.done) { w.done = true; resolve(); } } };
      w.timer = setTimeout(w.resolve, ms);
      this.waiters.push(w);
    });
  }

  flushWaiters(onlySkippable) {
    this.waiters = this.waiters.filter((w) => {
      if (w.done) return false;
      if (onlySkippable && !w.skippable) return true;
      clearTimeout(w.timer);
      w.resolve();
      return false;
    });
  }

  // 장면 전체 건너뛰기: 남은 명령은 상태(플래그·아이템·레터박스 등)만 반영하고 바로 끝낸다
  skip() {
    this.skipping = true;
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

  startSlowmo(sec, scale) {
    const scene = this.scene;
    scene.physics.world.timeScale = 1 / scale; // Arcade 는 값이 클수록 느려진다
    scene.tweens.timeScale = scale;
    scene.anims.globalTimeScale = scale;
    clearTimeout(this.slowTimer);
    this.slowTimer = setTimeout(() => this.endSlowmo(), sec * 1000);
  }

  endSlowmo() {
    const scene = this.scene;
    clearTimeout(this.slowTimer);
    scene.physics.world.timeScale = 1;
    scene.tweens.timeScale = 1;
    scene.anims.globalTimeScale = 1;
  }

  // ───────── 매 프레임 입력 ─────────
  // in: { advance, advanceSoft, hold, holdSoft, skip, left, right, confirm }
  //   advance / hold         : Space·J·Enter·탭 (잠긴 컷신) — 누르면 넘기기, 계속 누르고 있으면 건너뛰기
  //   advanceSoft / holdSoft : Enter·탭 (조작 가능 컷신 — Space·J 는 게임 조작)
  //   skip                   : Esc (바로 건너뛰기)
  update(dt, input) {
    const held = this.locked ? input.hold : input.holdSoft;
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
    if (input.skip || this.holdTime >= H) {
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
