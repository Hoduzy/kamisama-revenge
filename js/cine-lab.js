// 연출 시험 (F1 개발 메뉴 → '연출 시험'): 연출 도구(js/cinematics.js)를 버튼 하나씩 눌러 본다.
// 게임은 멈추지 않으니 걸어 다니면서 시험할 수 있다. 슬라이더는 TUNING.cine 을 바로 바꾸고,
// '브라우저에 저장'(이 브라우저에서만) 또는 'config.js 로 저장'(파일 고르기 창 / 다운로드)으로 남긴다.
const CineLab = {
  isOpen: false,

  get scene() { return window.game && window.game.scene.keys.game; },
  get cine() { return this.scene && this.scene.cine; },

  // [제목, [[버튼 글, 동작], …]]
  sections() {
    const C = () => this.cine;
    const S = () => this.scene;
    const ahead = (d) => S().player.body.center.x + d;
    const panTarget = () => (S().boss && !S().boss.dead ? 'boss' : ahead(500));
    return [
      ['카메라', [
        ['룩어헤드 켜기/끄기', () => { C().lookAheadOn = !C().lookAheadOn; }],
        ['줌 인', () => C().zoom(TUNING.cine.zoomIn)],
        ['줌 아웃', () => C().zoom(TUNING.cine.zoomOut)],
        ['줌 원래대로', () => C().zoom(1)],
        ['패닝 후 복귀', () => C().pan(panTarget(), { hold: 1 })],
        ['위로 틸트', () => C().tilt(-110)],
        ['아래로 틸트', () => C().tilt(90)],
        ['틸트 원래대로', () => C().tilt(0)],
        ['흔들림 약', () => C().shake('weak')],
        ['흔들림 중', () => C().shake('mid')],
        ['흔들림 강', () => C().shake('strong')],
        ['내리꽂는 충격 (세로)', () => C().shake('strong', 'v')],
        ['레터박스 켜기', () => C().letterbox(true)],
        ['레터박스 끄기', () => C().letterbox(false)],
      ]],
      ['시간', [
        ['히트스톱', () => { C().hitStop(TUNING.cine.hitStop); C().shake('mid'); }],
        ['슬로모션', () => C().slowmo()],
        ['일격 (히트스톱 + 흑백 컷 + 흔들림)', () => { C().hitStop(); C().monoCut(1); C().shake('strong', 'v'); CineSound.sfx('heavy'); }],
      ]],
      ['화면 효과', [
        ['플래시 흰색', () => C().flash('white')],
        ['플래시 붉은색', () => C().flash('red')],
        ['플래시 금색', () => C().flash('gold')],
        ['비네트 켜기', () => C().vignette(TUNING.cine.vignette)],
        ['비네트 끄기', () => C().vignette(0)],
        ['색감: 해 질 녘', () => C().mood('dusk')],
        ['색감: 밤', () => C().mood('night')],
        ['색감: 불', () => C().mood('fire')],
        ['색감 없음', () => C().mood('none')],
        ['흑백 1프레임 컷', () => C().monoCut(1)],
        ['탈색 (부상)', () => C().desaturate(0.85, 0.8)],
        ['탈색 풀기', () => C().desaturate(0, 0.6)],
        ['컷인: 아카네', () => C().cutIn('akane', { face: 'angry' })],
        ['컷인: 하쿠야', () => C().cutIn('hakuya', { face: 'laugh' })],
        ['컷인: 하루', () => C().cutIn('haru', { face: 'serious' })],
      ]],
      ['빛 (Light2D)', [
        ['밤 빛 켜기 (주변광 낮춤)', () => C().lights(true, 0x3a3a58)],
        ['빛 끄기', () => C().lights(false)],
        ['등롱', () => C().light('lantern', ahead(120), S().player.body.top - 30)],
        ['화로', () => C().light('brazier', ahead(220), S().player.body.bottom - 20)],
        ['횃불', () => C().light('torch', ahead(-120), S().player.body.top)],
        ['불길', () => C().light('fire', ahead(340), S().player.body.bottom - 30)],
      ]],
      ['입자', [
        ['벚꽃잎 (오른쪽 바람)', () => C().particles('petals', { dir: 1, id: 'lab-petals', seconds: 8 })],
        ['벚꽃잎 (왼쪽 바람)', () => C().particles('petals', { dir: -1, id: 'lab-petals', seconds: 8 })],
        ['재', () => C().particles('ash', { id: 'lab-ash', seconds: 8 })],
        ['불티', () => C().particles('embers', { x: ahead(120), y: S().player.body.bottom, id: 'lab-embers', seconds: 6 })],
        ['연기', () => C().particles('smoke', { x: ahead(160), y: S().player.body.bottom, id: 'lab-smoke', seconds: 6 })],
        ['김 (담금질)', () => C().particles('steam', { x: ahead(80), y: S().player.body.bottom - 10, id: 'lab-steam', seconds: 3 })],
        ['짚 (허수아비)', () => C().particles('straw', { x: ahead(40), y: S().player.body.center.y })],
        ['불꽃 (망치질)', () => { C().particles('sparks', { x: ahead(40), y: S().player.body.bottom - 10 }); CineSound.sfx('hammer'); }],
        ['먼지', () => C().particles('dust', { x: S().player.body.center.x, y: S().player.body.bottom })],
        ['입자 모두 멈춤', () => C().particlesStop()],
      ]],
      ['전경 (1.3배 패럴랙스)', [
        ['등롱 줄', () => C().foreground('lanterns', ahead(200))],
        ['벚꽃 가지', () => C().foreground('branch', ahead(260))],
        ['불타는 기둥', () => C().foreground('pillar', ahead(300))],
        ['전경 지우기', () => C().foregroundClear()],
      ]],
      ['길 안내', [
        ['화살표 (앞쪽 900px, 3초 멈추면)', () => C().guideTo(ahead(900))],
        ['화살표 끄기', () => C().guideTo(null)],
        ['벚꽃 바람 → 앞쪽', () => C().guideWind(ahead(900), 'petals')],
        ['불티 바람 → 뒤쪽', () => C().guideWind(ahead(-900), 'embers')],
        ['바람 끄기', () => C().guideWind(null)],
        ['목표: 아빠에게', () => C().objective('아빠에게')],
        ['목표: 광장으로', () => C().objective('광장으로')],
        ['목표 지우기', () => C().objective(null)],
        ['행동: 대쉬베기(U)', () => C().actionHint('skill1')],
        ['행동: 발도(I)', () => C().actionHint('skill2')],
        ['행동: 점프', () => C().actionHint('jump')],
        ['빛나는 출구 (앞쪽)', () => C().exitGlow(ahead(400))],
        ['출구 끄기', () => C().exitGlowOff()],
      ]],
      ['소리 (ZzFX 임시 / assets/sfx 파일)', [
        ...Object.keys(CineSound.PRESETS).map((id) => [`${id}${CineSound.files[id] ? ' (파일)' : ''}`, () => CineSound.sfx(id)]),
        ['음악 작게 (duck)', () => CineSound.duck(true)],
        ['음악 원래대로', () => CineSound.duck(false)],
        ['침묵', () => CineSound.silence()],
      ]],
    ];
  },

  // 슬라이더: [글, TUNING 경로(cine.… / result.…), 최소, 최대, 간격, 바로 시험]
  sliders() {
    const C = () => this.cine;
    const res = (boss) => () => this.playResult(boss);
    return [
      ['흔들림 약', 'shake.weak.amount', 0, 0.02, 0.0005, () => C().shake('weak')],
      ['흔들림 중', 'shake.mid.amount', 0, 0.03, 0.0005, () => C().shake('mid')],
      ['흔들림 강', 'shake.strong.amount', 0, 0.05, 0.0005, () => C().shake('strong')],
      ['슬로모션 배율', 'slowmoScale', 0.05, 1, 0.05, () => C().slowmo()],
      ['히트스톱 시간(초)', 'hitStop', 0, 0.4, 0.01, () => C().hitStop()],
      ['줌 인 배율', 'zoomIn', 1, 2, 0.05, () => C().zoom(TUNING.cine.zoomIn)],
      ['줌 아웃 배율', 'zoomOut', 0.5, 1, 0.05, () => C().zoom(TUNING.cine.zoomOut)],
      ['— 결과 화면 —'],
      ['전체 빠르기', 'result.speed', 0.1, 2, 0.05, res(false)],
      ['두루마리 폭', 'result.scrollWidth', 0.3, 0.9, 0.01, res(false)],
      ['어둡게', 'result.darken', 0, 1, 0.05, res(false)],
      ['히트스톱 처음(초)', 'result.hitStop1', 0, 0.5, 0.01, res(false)],
      ['떨어짐(ms)', 'result.dropMs', 100, 1500, 10, res(false)],
      ['펼침(ms)', 'result.unrollMs', 100, 1500, 10, res(false)],
      ['손 들어옴(ms)', 'result.handEnterMs', 50, 1000, 10, res(false)],
      ['베기 각도(도)', 'result.slashAngle', 100, 175, 1, res(false)],
      ['베기(ms)', 'result.slashMs', 40, 500, 5, res(false)],
      ['궤적 크기', 'result.slashScale', 1, 5, 0.1, res(false)],
      ['히트스톱 베기(초)', 'result.hitStop2', 0, 0.5, 0.01, res(false)],
      ['조각 날아감(ms)', 'result.pieceMs', 200, 1500, 10, res(true)],
      ['조각 거리', 'result.pieceDist', 200, 1400, 10, res(true)],
      ['조각 회전(도)', 'result.pieceSpin', 0, 180, 1, res(true)],
      ['먹물 크기', 'result.inkScale', 2, 12, 0.5, res(false)],
      ['토벌 글씨 써짐(ms)', 'result.kanjiMs', 200, 2000, 10, res(false)],
      ['토벌 글씨 크기', 'result.kanjiScale', 0.5, 2, 0.05, res(false)],
    ];
  },

  // 결과 화면 시험: 지금 장면에서 바로 (끝나면 점프·공격으로 다시 시작)
  playResult(boss) {
    const s = this.scene;
    if (!s || s.cleared) return this.msg('이미 결과 화면이다. 점프·공격으로 다시 시작한 뒤 눌러 주세요.');
    s.triggerClear({ boss });
  },

  // 'result.…' 는 TUNING.result, 나머지는 TUNING.cine
  root(path) { return path.startsWith('result.') ? [TUNING.result, path.slice(7)] : [TUNING.cine, path]; },
  get(path) { const [r, p] = this.root(path); return p.split('.').reduce((o, k) => o[k], r); },
  set(path, v) {
    const [r, p] = this.root(path);
    const ks = p.split('.');
    const last = ks.pop();
    ks.reduce((o, k) => o[k], r)[last] = v;
  },

  build() {
    const el = document.createElement('div');
    el.id = 'cine-lab';
    const esc = (t) => String(t).replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
    this.actions = [];
    let html = `<div class="cl-head"><b>연출 시험</b><button type="button" class="cl-close">닫기</button></div>
      <p class="cl-note">게임은 계속 움직인다. 걸으면서 눌러 보세요.</p>`;
    html += '<section><h3>수치 (TUNING.cine · TUNING.result)</h3>';
    this.sliders().forEach(([label, path, min, max, step], i) => {
      if (!path) { html += `<h3 class="cl-sub">${label}</h3>`; return; }
      html += `<label class="cl-slider"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" data-i="${i}">
        <output></output><button type="button" data-try="${i}">▶</button></label>`;
    });
    html += `<div class="cl-save"><button type="button" class="cl-local">브라우저에 저장</button>
      <button type="button" class="cl-file">config.js 로 저장</button><button type="button" class="cl-reset">되돌리기</button></div>
      <p class="cl-msg"></p></section>
      <section><h3>결과 화면</h3><div class="cl-btns"><button type="button" class="cl-res">결과 화면 (일반)</button><button type="button" class="cl-res-boss">결과 화면 (보스: X 자)</button></div></section>`;
    for (const [title, list] of this.sections()) {
      html += `<section><h3>${esc(title)}</h3><div class="cl-btns">`;
      for (const [label, fn] of list) {
        this.actions.push(fn);
        html += `<button type="button" data-a="${this.actions.length - 1}">${esc(label)}</button>`;
      }
      html += '</div></section>';
    }
    el.innerHTML = html;
    document.body.append(el);
    this.el = el;
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.querySelector('.cl-close').onclick = () => this.close();
    el.querySelectorAll('[data-a]').forEach((b) => {
      b.onclick = () => { try { this.actions[+b.dataset.a](); } catch (e) { this.msg('오류: ' + e.message); console.error(e); } b.blur(); };
    });
    const sl = this.sliders();
    el.querySelectorAll('.cl-slider input').forEach((inp) => {
      const [, path] = sl[+inp.dataset.i];
      inp.value = this.get(path);
      const out = inp.parentElement.querySelector('output');
      out.textContent = (+inp.value).toString();
      inp.oninput = () => { this.set(path, +inp.value); out.textContent = inp.value; };
      inp.onchange = () => inp.blur();
    });
    el.querySelectorAll('[data-try]').forEach((b) => { b.onclick = () => { sl[+b.dataset.try][5](); b.blur(); }; });
    el.querySelector('.cl-local').onclick = () => this.saveLocal();
    el.querySelector('.cl-file').onclick = () => this.saveFile();
    el.querySelector('.cl-reset').onclick = () => this.reset();
    el.querySelector('.cl-res').onclick = (e) => { this.playResult(false); e.target.blur(); };
    el.querySelector('.cl-res-boss').onclick = (e) => { this.playResult(true); e.target.blur(); };
  },

  msg(t) { if (this.el) this.el.querySelector('.cl-msg').textContent = t; },

  open() {
    if (!this.scene) return;
    if (this.el) this.el.remove(); // 소리 파일 표시 등이 최신이 되게 매번 새로
    this.build();
    this.isOpen = true;
    this.el.classList.add('show');
  },

  close() {
    this.isOpen = false;
    if (this.el) this.el.classList.remove('show');
  },

  saveLocal() {
    try {
      localStorage.setItem('kamisama-cine', JSON.stringify(TUNING.cine));
      localStorage.setItem('kamisama-result', JSON.stringify(TUNING.result));
      this.msg('이 브라우저에 저장했다. 다른 기기·배포에도 쓰려면 config.js 로 저장.');
    } catch (e) { this.msg('브라우저 저장소를 쓸 수 없다.'); }
  },

  // config.js 의 '// <cine>' ~ '// </cine>', '// <result>' ~ '// </result>' 사이를 지금 값으로 바꾼 파일을 만든다.
  // 크롬·엣지는 파일 고르기 창에서 저장소의 js/config.js 를 고르면 그 파일에 바로 쓴다. 그 밖엔 다운로드
  async saveFile() {
    let text;
    try { text = await (await fetch('js/config.js', { cache: 'no-store' })).text(); } catch (e) { return this.msg('config.js 를 읽지 못했다.'); }
    let out = text;
    for (const name of ['cine', 'result']) {
      const a = out.indexOf(`  // <${name}>`);
      const b = out.indexOf(`  // </${name}>`);
      if (a < 0 || b < 0) return this.msg(`config.js 에 <${name}> 표시 줄이 없다.`);
      const head = out.slice(a, out.indexOf('\n', out.indexOf('\n', a) + 1) + 1); // 표시 줄 + 설명 줄
      const keep = head.split('\n').filter((l) => l.trim().startsWith('//')).join('\n') + '\n';
      out = out.slice(0, a) + keep + `  ${name}: ` + this.serialize(TUNING[name], '  ') + ',\n' + out.slice(b);
    }
    if (window.showSaveFilePicker) {
      try {
        const h = await window.showSaveFilePicker({ suggestedName: 'config.js', types: [{ description: 'JavaScript', accept: { 'text/javascript': ['.js'] } }] });
        const w = await h.createWritable();
        await w.write(out);
        await w.close();
        return this.msg('저장했다. 저장소의 js/config.js 를 골랐다면 바로 반영된다.');
      } catch (e) { if (e.name === 'AbortError') return this.msg('저장 취소.'); }
    }
    const url = URL.createObjectURL(new Blob([out], { type: 'text/javascript' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'config.js';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    this.msg('config.js 를 내려받았다. 저장소의 js/config.js 를 이 파일로 바꾸면 된다.');
  },

  serialize(o, ind) {
    const pad = ind + '  ';
    const items = Object.entries(o).map(([k, v]) => `${pad}${k}: ${v && typeof v === 'object' ? this.serialize(v, pad) : JSON.stringify(v)}`);
    return `{\n${items.join(',\n')}\n${ind}}`;
  },

  reset() {
    try { localStorage.removeItem('kamisama-cine'); localStorage.removeItem('kamisama-result'); } catch (e) { /* 무시 */ }
    this.msg('브라우저 저장값을 지웠다. 새로고침하면 config.js 값으로 돌아간다.');
  },
};
