// 연출 엔진: data/story/*.json 의 장면(명령 목록)을 순서대로 재생한다.
// 대사(say/think/voice)는 대화창, 연출(fade/letterbox/caption/cg …)은 HTML 레이어(UI)와 카메라로.
// 조작 가능 컷신(controllable)은 게임을 멈추지 않고 대사가 자동으로 넘어간다.
// 체크포인트 대사 풀(타누키치 한마디, 하루 목소리)도 여기서 고른다.
const STORY_FILES = ['prologue', 'ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6', 'epilogue', 'test'];

class StoryEngine {
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
    this.queue = [];
    this.waiters = [];     // 넘기기 입력으로 일찍 끝낼 수 있는 기다림
    this.skipping = false;
    this.context = {};     // condition 판정에 쓰는 실행 중 값 (예: firstDown)
    const reg = scene.registry;
    if (!reg.get('storyFlags')) reg.set('storyFlags', {});
    if (!reg.get('storyPlayed')) reg.set('storyPlayed', []);
    this.poolState = reg.get('storyPools') || {};
    reg.set('storyPools', this.poolState);
  }

  get flags() { return this.scene.registry.get('storyFlags'); }
  get busy() { return !!this.running; }
  get blocking() { return !!this.running && !this.running.controllable; }
  played(id) { return this.scene.registry.get('storyPlayed').includes(id); }

  // 장(chapter) 안에서 트리거가 맞는 장면들 (아직 안 본 것만)
  find(chapter, test) {
    const ch = this.chapters[chapter];
    if (!ch) return [];
    return ch.scenes.filter((s) => !this.played(s.id) && test(s.trigger || {}, s)).map((s) => s.id);
  }

  // 장면 여러 개를 차례로 (앞 장면이 끝나야 다음)
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
    const scene = this.scene;
    this.running = sc;
    this.skipping = false;
    const controllable = !!sc.controllable;
    scene.registry.get('storyPlayed').push(sc.id);
    if (!controllable) {
      scene.physics.world.pause();
      scene.cutscene = true;
    }
    this.dialogue.open(this.characters, { controllable });
    try {
      await this.runList(sc.commands, sc);
    } catch (e) {
      console.error('[story]', sc.id, e);
    }
    // 정리: 대화창 닫기, 느린 화면·카메라 원래대로, 게임 재개
    this.dialogue.close();
    UI.hide('.fx-cg');
    UI.hide('.fx-caption');
    this.endSlowmo();
    this.resetCamera();
    if (!controllable) {
      scene.physics.world.resume();
      scene.cutscene = false;
    }
    this.running = null;
    this.skipping = false;
    const next = this.queue.shift();
    if (next) next();
  }

  async runList(cmds, sc) {
    for (const c of cmds || []) await this.exec(c, sc);
  }

  // ───────── 명령 하나 ─────────
  async exec(c, sc) {
    const scene = this.scene;
    const cam = scene.cameras.main;
    const skip = this.skipping;
    switch (c.cmd) {
      case 'say':
      case 'think':
      case 'voice':
        if (!skip) await this.dialogue.line(c);
        break;
      case 'caption': {
        if (skip) break;
        const ms = UI.caption(c.text);
        await this.wait(ms + 900 + c.text.length * 25, true);
        UI.hide('.fx-caption');
        await this.wait(350);
        break;
      }
      case 'fadeOut':
        UI.fade(1, skip ? 0 : c.duration ?? 0.8);
        if (!skip) await this.wait((c.duration ?? 0.8) * 1000);
        break;
      case 'fadeIn':
        UI.fade(0, skip ? 0 : c.duration ?? 0.8);
        UI.hide('.fx-cg');
        if (!skip) await this.wait((c.duration ?? 0.8) * 1000);
        break;
      case 'letterbox':
        UI.letterbox(c.on, skip);
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
        if (TUNING.story.showAudioCues) UI.audioCue(c.name === 'stop' ? '♪ BGM 멈춤' : `♪ BGM: ${c.name}`);
        break;
      case 'sfx':
        if (!skip && TUNING.story.showAudioCues) UI.audioCue(c.name === 'stop' ? '효과음 멈춤' : `🔊 ${c.name}`);
        break;
      case 'cg':
        if (skip) break;
        UI.cg(c.no, c.desc);
        await this.wait(3500, true);
        UI.hide('.fx-cg');
        await this.wait(400);
        break;
      case 'titleCard': {
        if (skip) break;
        const ms = UI.titleCard(c.text, c);
        await this.wait(ms + 1300, true);
        UI.hide('.fx-title');
        await this.wait(400);
        break;
      }
      case 'bossName': {
        scene.bossDisplayName = c.text; // 보스 체력바 이름도 바뀐다
        if (skip) break;
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
        if (!skip) await this.wait(c.seconds * 1000, true);
        break;
      case 'cameraPan':
        if (!skip) await this.pan(c);
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
        this.dialogue.root.classList.remove('show');
        const id = await UI.choice(c.options);
        this.dialogue.root.classList.add('show');
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
        if (!skip) UI.note(c.text);
        break;
      case 'section':
        break;
      default:
        console.warn('[story] 모르는 명령', c);
    }
  }

  // condition 의 when: memoriesAtLeast / ending / firstDown / flag+is
  test(when = {}) {
    const reg = this.scene.registry;
    if (when.memoriesAtLeast != null && (reg.get('memories') || []).length < when.memoriesAtLeast) return false;
    if (when.ending != null && this.flags.ending !== when.ending) return false;
    if (when.firstDown != null && this.context.firstDown !== when.firstDown) return false;
    if (when.flag != null && this.flags[when.flag] !== when.is) return false;
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
  // in: { advance, advanceSoft, skip, left, right, confirm }
  //   advance     : Space/J/Enter/탭 (멈춘 컷신에서 넘기기)
  //   advanceSoft : Enter/탭 (조작 가능 컷신에서 넘기기 — Space/J 는 게임 조작)
  update(dt, input) {
    if (!this.running) return;
    if (UI.choiceButtons) {
      if (input.left) UI.choiceMove(-1);
      if (input.right) UI.choiceMove(1);
      if (input.confirm) UI.choiceConfirm();
      return;
    }
    const controllable = this.running.controllable;
    const advance = controllable ? input.advanceSoft : input.advance;
    if (input.skip && !controllable) {
      this.skipping = true;
      this.flushWaiters(false);
      this.dialogue.resolvePending();
      return;
    }
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
