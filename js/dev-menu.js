// 개발 메뉴 (F1): 아무 장면 id 나 바로 재생, 개발 모드 켜고 끄기.
// 개발 모드: 아직 게임으로 옮기지 못한 연출 메모(note)와 BGM·효과음 이름을 화면 구석에 작게 보여 준다.
// 켜는 법: F1 메뉴의 체크, 또는 주소에 ?dev=1 (브라우저에 기억됨, ?dev=0 으로 끔)
const DevMenu = {
  isOpen: false,
  sel: 0,

  init(game) {
    if (this.game) return;
    this.game = game;
    const q = new URLSearchParams(location.search).get('dev');
    let on = false;
    try { on = localStorage.getItem('kamisama-dev') === '1'; } catch (e) { /* 저장소를 못 쓰면 매번 꺼진 채로 */ }
    if (q != null) on = q !== '0';
    this.setDev(on);

    const el = document.createElement('div');
    el.id = 'dev-menu';
    el.innerHTML = `
      <div class="dm-box">
        <div class="dm-head"><b>개발 메뉴</b><span>F1 · Esc 닫기</span></div>
        <div class="dm-opts">
          <label><input type="checkbox" class="dm-dev"> 개발 모드 (연출 메모·소리 이름 표시)</label>
          <label>기억 조각 <input type="number" class="dm-mem" min="0" max="30" value="0"></label>
          <button type="button" class="dm-reset">본 장면·플래그 지우기</button>
        </div>
        <input type="search" class="dm-search" placeholder="장면 id · 장소 · 대사로 찾기 (↑↓ 고르기, Enter 재생)">
        <div class="dm-list"></div>
      </div>`;
    document.body.append(el);
    this.el = el;
    this.list = el.querySelector('.dm-list');
    this.search = el.querySelector('.dm-search');
    const dev = el.querySelector('.dm-dev');
    dev.checked = on;
    dev.onchange = () => this.setDev(dev.checked);
    this.mem = el.querySelector('.dm-mem');
    this.mem.onchange = () => {
      const n = Math.max(0, +this.mem.value || 0);
      game.registry.set('memories', Array.from({ length: n }, (_, i) => i + 1));
    };
    el.querySelector('.dm-reset').onclick = () => {
      game.registry.set('storyPlayed', []);
      game.registry.set('storyFlags', {});
      game.registry.set('storyPools', {});
      game.registry.set('items', []);
      this.render();
    };
    this.search.oninput = () => { this.sel = 0; this.render(); };
    el.addEventListener('pointerdown', (e) => { if (e.target === el) this.close(); });

    // 메뉴 안의 키 입력은 게임으로 보내지 않는다 (Phaser 가 Space·A·D 등을 가로채지 않게)
    el.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        this.sel += e.key === 'ArrowDown' ? 1 : -1;
        this.render();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const row = this.list.querySelector('.sel');
        if (row) this.playScene(row.dataset.id);
      } else if (e.key === 'Escape' || e.key === 'F1') {
        e.preventDefault();
        this.close();
      }
    });
    el.addEventListener('keyup', (e) => e.stopPropagation());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F1') {
        e.preventDefault(); // 브라우저 도움말 대신
        this.isOpen ? this.close() : this.open();
      }
    });
  },

  setDev(on) {
    document.body.classList.toggle('dev-mode', on);
    try { localStorage.setItem('kamisama-dev', on ? '1' : '0'); } catch (e) { /* 무시 */ }
  },

  get gameScene() {
    return this.game.scene.keys.game;
  },

  // 장면 목록: 장별로, 장면 id · 장소 · 첫 대사 · 표시(조작 가능/레터박스/선택지)
  scenes() {
    const cache = this.game.cache.json;
    const out = [];
    for (const file of STORY_FILES) {
      const ch = cache.get('story-' + file);
      if (!ch) continue;
      for (const s of ch.scenes) {
        const all = JSON.stringify(s.commands);
        const first = s.commands.find((c) => c.text && ['say', 'think', 'voice', 'caption'].includes(c.cmd));
        out.push({
          id: s.id,
          chapter: file,
          place: s.place || '',
          line: first ? first.text : '',
          tags: [
            s.controllable && '조작 가능',
            all.includes('"letterbox"') && '레터박스',
            all.includes('"choice"') && '선택지',
            all.includes('"cg"') && 'CG',
          ].filter(Boolean),
          search: `${s.id} ${s.place || ''} ${all}`.toLowerCase(),
        });
      }
    }
    return out;
  },

  render() {
    const q = this.search.value.trim().toLowerCase();
    const rows = this.all.filter((r) => !q || r.search.includes(q));
    this.sel = Math.max(0, Math.min(this.sel, rows.length - 1));
    const played = this.game.registry.get('storyPlayed') || [];
    const esc = (t) => String(t).replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
    let html = '';
    let chapter = null;
    rows.forEach((r, i) => {
      if (r.chapter !== chapter) {
        chapter = r.chapter;
        html += `<div class="dm-ch">${chapter}</div>`;
      }
      html += `<div class="dm-row${i === this.sel ? ' sel' : ''}${played.includes(r.id) ? ' played' : ''}" data-id="${r.id}">
        <b>${r.id}</b><span class="dm-place">${esc(r.place)}</span>${r.tags.map((t) => `<i>${t}</i>`).join('')}
        <small>${esc(r.line)}</small></div>`;
    });
    this.list.innerHTML = html || '<div class="dm-empty">맞는 장면이 없다</div>';
    for (const row of this.list.querySelectorAll('.dm-row')) row.onclick = () => this.playScene(row.dataset.id);
    const s = this.list.querySelector('.sel');
    if (s) s.scrollIntoView({ block: 'nearest' });
  },

  open() {
    if (!this.gameScene) return;
    this.isOpen = true;
    this.all = this.scenes();
    this.mem.value = (this.game.registry.get('memories') || []).length;
    this.el.classList.add('show');
    this.game.input.keyboard.enabled = false; // 검색창에 글자를 칠 수 있게
    if (this.gameScene.scene.isActive()) this.gameScene.scene.pause();
    this.render();
    this.search.focus();
    this.search.select();
  },

  close() {
    this.isOpen = false;
    this.el.classList.remove('show');
    this.search.blur();
    this.game.input.keyboard.enabled = true;
    const gs = this.gameScene;
    gs.input.keyboard.resetKeys();
    if (gs.scene.isPaused()) gs.scene.resume();
  },

  // 그 장면이 속한 장으로 게임을 다시 시작하고 장면 하나만 바로 재생
  playScene(id) {
    const r = this.all.find((x) => x.id === id);
    const reg = this.game.registry;
    if (r && LEVEL.story[r.chapter] && r.chapter !== 'epilogue') reg.set('chapterOverride', r.chapter);
    reg.set('devPlay', id);
    reg.set('chapterStarted', true);
    this.close();
    StoryAudio.stopBgm(0.2);
    this.gameScene.scene.restart();
  },
};
