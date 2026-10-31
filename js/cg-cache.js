// CG·컷신 그림 미리 불러오기. 장(章)을 시작할 때 그 장 대본의 cg 명령이 쓰는 그림을 모두 불러와 디코딩해 둔다.
// 컷신 도중에는 불러오지 않는다 → CG 가 '자리표시 → 그림' 순서로 바뀌어 보이는 일이 없다.
const CgCache = {
  state: {}, // 경로 → 'ok' | 'missing' | Promise(불러오는 중)
  imgs: {},  // 디코딩된 Image 를 붙잡아 두어 브라우저가 버리지 않게

  // cg 명령 → 그림 경로. no: assets/cg/cg_0N.png, image: assets/sprites/<이름>.png (배경 전경 등)
  path(c) {
    if (c.image) return `${SPRITE_DIR}${c.image}.png`;
    return `assets/cg/cg_${String(c.no).padStart(2, '0')}.png`;
  },

  status(p) {
    const s = this.state[p];
    return s === 'ok' || s === 'missing' ? s : s ? 'loading' : 'none';
  },

  // 한 장 불러오기 → Promise<true(있음) | false(없음)>
  load(p) {
    const s = this.state[p];
    if (s === 'ok') return Promise.resolve(true);
    if (s === 'missing') return Promise.resolve(false);
    if (s) return s;
    const pr = new Promise((resolve) => {
      const im = new Image();
      im.onload = () => {
        const done = () => { this.state[p] = 'ok'; this.imgs[p] = im; resolve(true); };
        if (im.decode) im.decode().then(done, done); else done();
      };
      im.onerror = () => { this.state[p] = 'missing'; resolve(false); };
      im.src = p;
    });
    this.state[p] = pr;
    return pr;
  },

  // 대본 장(chapter)들이 쓰는 cg 그림 경로 (조건·선택지 안쪽까지)
  pathsOf(story, chapters) {
    const out = new Set();
    const walk = (cmds) => {
      for (const c of cmds || []) {
        if (c.cmd === 'cg') out.add(this.path(c));
        for (const k of ['then', 'else', 'commands']) walk(c[k]);
        for (const o of [...(c.options || []), ...(c.cases || [])]) walk(o.commands);
      }
    };
    for (const id of chapters) {
      const ch = story.chapters[id];
      if (!ch) continue;
      for (const sc of ch.scenes) {
        walk(sc.commands);
        for (const b of Object.values(sc.blocks || {})) walk(b);
      }
    }
    return [...out];
  },

  // 장 시작: 그 장의 그림을 모두 불러올 때까지 기다린다
  preload(story, chapters) {
    return Promise.all(this.pathsOf(story, chapters).map((p) => this.load(p)));
  },
};
