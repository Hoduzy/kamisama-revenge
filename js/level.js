// 레벨 데이터. 좌표는 월드 기준, 사각형은 좌상단 (x, y)와 크기 (w, h).
// oneWay: 아래에서 뚫고 올라갈 수 있는 얇은 발판.
window.LEVEL = {
  width: 7000,
  height: 720,
  spawn: { x: 120, y: 560 },

  ground: [
    { x: 0, y: 620, w: 1100, h: 100 },
    { x: 1250, y: 620, w: 700, h: 100 },
    { x: 2150, y: 620, w: 480, h: 100 },
    { x: 2800, y: 620, w: 1250, h: 100 },
    { x: 4300, y: 620, w: 1300, h: 100 },
    // 보스 아레나
    { x: 5750, y: 620, w: 1250, h: 100 },
    // 계단/벽
    { x: 1700, y: 540, w: 120, h: 80 },
    { x: 3820, y: 520, w: 90, h: 100 },
    { x: 3910, y: 440, w: 140, h: 180 },
    { x: 4700, y: 540, w: 80, h: 80 },
    // 월드 양 끝 벽
    { x: -40, y: 0, w: 40, h: 720 },
    { x: 7000, y: 0, w: 40, h: 720 },
  ],

  platforms: [
    { x: 480, y: 500, w: 160, h: 20 },
    { x: 760, y: 400, w: 180, h: 20 },
    { x: 1080, y: 500, w: 120, h: 20 },
    { x: 1420, y: 480, w: 180, h: 20 },
    { x: 1990, y: 520, w: 120, h: 20 },
    { x: 2280, y: 480, w: 180, h: 20 },
    { x: 2650, y: 520, w: 110, h: 20 },
    { x: 2950, y: 500, w: 200, h: 20 },
    { x: 3200, y: 390, w: 200, h: 20 },
    { x: 3480, y: 290, w: 220, h: 20 },
    { x: 3560, y: 500, w: 160, h: 20 },
    { x: 4120, y: 520, w: 120, h: 20 },
    { x: 4450, y: 480, w: 180, h: 20 },
    { x: 4880, y: 440, w: 200, h: 20 },
    { x: 5300, y: 470, w: 160, h: 20 },
    { x: 6080, y: 500, w: 140, h: 20 },
    { x: 6560, y: 500, w: 140, h: 20 },
  ],

  // type: swordsman(근접 검사) / thrower(투척병)
  // y: 발을 딛는 바닥(땅·발판 윗면) 높이 / minX/maxX: 움직일 수 있는 범위
  enemies: [
    { type: 'swordsman', x: 900, y: 620, minX: 700, maxX: 1090 },
    { type: 'thrower', x: 860, y: 400, minX: 765, maxX: 935 },
    { type: 'swordsman', x: 1550, y: 620, minX: 1260, maxX: 1690 },
    { type: 'thrower', x: 1520, y: 480, minX: 1425, maxX: 1595 },
    { type: 'swordsman', x: 2450, y: 620, minX: 2160, maxX: 2620 },
    { type: 'swordsman', x: 3150, y: 620, minX: 2810, maxX: 3810 },
    { type: 'thrower', x: 3300, y: 390, minX: 3205, maxX: 3395 },
    { type: 'swordsman', x: 3550, y: 620, minX: 2810, maxX: 3810 },
    { type: 'thrower', x: 3600, y: 290, minX: 3485, maxX: 3695 },
    { type: 'thrower', x: 3990, y: 440, minX: 3915, maxX: 4045 },
    { type: 'swordsman', x: 4550, y: 620, minX: 4310, maxX: 4690 },
    { type: 'thrower', x: 4980, y: 440, minX: 4885, maxX: 5075 },
    { type: 'swordsman', x: 5100, y: 620, minX: 4790, maxX: 5590 },
    { type: 'thrower', x: 5380, y: 470, minX: 5305, maxX: 5455 },
    // 보스: 대화가 끝날 때까지 움직이지 않음
    { type: 'boss', x: 6650, y: 620, minX: 5760, maxX: 6990, dormant: true },
  ],

  // 벚꽃나무(체크포인트). x, 땅 높이 y. 첫 나무는 처음부터 만개.
  trees: [
    { x: 120, y: 620 },
    { x: 1310, y: 620 },
    { x: 2210, y: 620 },
    { x: 2880, y: 620 },
    { x: 4380, y: 620 },
    { x: 5810, y: 620 },
  ],

  // 스토리 트리거 ↔ 장면 id (data/story/*.json). 맵이 아직 하나라서 장마다 같은 맵 위에 배치한다.
  //   start      : 장을 시작할 때 차례로 재생. { scene, when } 이면 조건이 맞을 때만
  //   triggers   : 주인공이 x 를 넘으면 한 번. stage = 여기서 스테이지 번호가 바뀜(타누키치 한마디 풀),
  //                then: 'wakeBoss'(장면 뒤 보스가 깨어남) | 'clear'(장면 뒤 장 클리어)
  //   trees      : 벚꽃나무 번호(LEVEL.trees 순서, 0 = 시작 나무) → 그 나무가 필 때 장면. 없으면 한마디(풀)
  //   boss.hp    : 보스 체력 비율이 below 이하가 되면 / boss.after : 보스를 쓰러뜨린 뒤 → 클리어
  //   events     : 게임 쪽 사건 이름 → 장면 (scene.storyEvent(이름) 으로 재생. 아직 그 사건이 없는 것들)
  story: {
    prologue: {
      start: ['S0-1', 'S0-2'],
      triggers: [
        { x: 900, scene: 'S0-3' },
        { x: 2200, scene: 'S0-4', stage: 2 },
        { x: 5900, scene: ['S0-7', 'S0-8'], then: 'clear' },
      ],
      trees: { 1: 'S0-5', 2: 'S0-6' },
    },
    ch1: {
      start: ['S1-1', 'S1-2'],
      triggers: [
        { x: 2200, scene: 'S1-4', stage: 2 },
        { x: 4330, scene: 'S1-6', stage: 3 },
        { x: 5900, scene: 'S1-7', then: 'wakeBoss' },
      ],
      trees: { 1: 'S1-3', 2: 'S1-5' },
      boss: { hp: [{ below: 0.5, scene: 'S1-8' }], after: ['S1-9', 'S1-10'] },
    },
    ch2: {
      start: ['S2-1'],
      triggers: [
        { x: 1000, scene: 'S2-2' },
        { x: 2200, scene: 'S2-3', stage: 2 },
        { x: 4330, scene: 'S2-5', stage: 3 },
        { x: 5900, scene: 'S2-6', then: 'wakeBoss' },
      ],
      trees: { 2: 'S2-4' },
      boss: { after: ['S2-8', 'S2-9'] },
      events: { '한 명 쓰러짐': 'S2-7' },
    },
    ch3: {
      start: ['S3-1'],
      triggers: [
        { x: 1000, scene: 'S3-2' },
        { x: 2200, scene: 'S3-3', stage: 2 },
        { x: 4330, stage: 3 },
        { x: 5900, scene: 'S3-6', then: 'wakeBoss' },
      ],
      trees: { 2: 'S3-4', 3: 'S3-5' },
      boss: { hp: [{ below: 0.5, scene: 'S3-7' }], after: ['S3-8', 'S3-9'] },
    },
    ch4: {
      start: ['S4-1'],
      triggers: [
        { x: 1000, scene: 'S4-2' },
        { x: 2200, scene: 'S4-3', stage: 2 },
        { x: 4330, stage: 3 },
        { x: 5900, scene: 'S4-5', then: 'wakeBoss' },
      ],
      trees: { 3: 'S4-4' },
      boss: { hp: [{ below: 0.3, scene: 'S4-6' }], after: ['S4-7', 'S4-8'] },
    },
    ch5: {
      start: ['S5-1', 'S5-2'],
      triggers: [
        { x: 2050, scene: 'S5-3' },
        { x: 2200, scene: 'S5-4', stage: 2 },
        { x: 4330, scene: 'S5-6', stage: 3 },
        { x: 5900, scene: 'S5-7', then: 'wakeBoss' },
      ],
      trees: { 2: 'S5-5' },
      boss: { after: ['S5-9', 'S5-10'] },
      events: { '화승총병 전멸': 'S5-8' },
    },
    ch6: {
      start: ['S6-1', 'S6-2'],
      triggers: [
        { x: 4330, scene: 'S6-5', stage: 2 },
        { x: 5200, scene: 'S6-6' },
        { x: 5900, scene: 'S6-7', stage: 3, then: 'wakeBoss' },
      ],
      trees: { 1: 'S6-3', 2: 'S6-4a', 3: 'S6-4b' },
      boss: { hp: [{ below: 0.5, scene: 'S6-9' }], after: ['S6-10', 'S6-11'] },
      events: { '1페이즈 종료': 'S6-8' },
    },
    // 엔딩: 6장 마지막 선택에서 〈나눈다〉를 골랐으면 진엔딩(E-5, E-6), 아니면 E-3, E-4
    epilogue: {
      start: [
        'E-1', 'E-2',
        { scene: 'E-3', when: { flag: 'choice:S6-10', not: 'share' } },
        { scene: 'E-4', when: { flag: 'choice:S6-10', not: 'share' } },
        { scene: 'E-5', when: { flag: 'choice:S6-10', is: 'share' } },
        { scene: 'E-6', when: { flag: 'choice:S6-10', is: 'share' } },
      ],
      then: 'clear',
    },
  },
};
