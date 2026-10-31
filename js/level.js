// 레벨(맵) 데이터. 좌표는 월드 기준, 사각형은 좌상단 (x, y)와 크기 (w, h).
// oneWay: 아래에서 뚫고 올라갈 수 있는 얇은 발판.
// LEVELS.town   : 에도 마을 (1장~, 아직 장마다 맵이 따로 없어 같은 맵을 쓴다)
// LEVELS.prologue: 프롤로그 사쿠라자와 (대장간 → 연습장 → 축제 광장 → 불타는 골목 → 대장간 앞 → 불타는 광장)
// STORY_MAP     : 장별 스토리 트리거 ↔ 장면 id
window.LEVELS = {};
LEVELS.town = {
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

  // 1-1 조작 안내 (1장일 때만, 처음 한 번). 주인공이 from~to 에 있으면 x,y 자리에 작게 뜨고,
  // act 행동을 하면(이 자리 전에 이미 했어도) 다시 나오지 않는다. [키] 는 키 모양으로 그린다
  hints: [
    { id: 'move', act: 'move', x: 230, y: 520, from: 0, to: 600, kb: '[A][D] 이동', touch: '[◀][▶] 이동' },
    { id: 'attack', act: 'attack', x: 780, y: 520, from: 560, to: 1000, kb: '[J] 공격', touch: '[공격] 베기' },
    { id: 'jump', act: 'jump', x: 1060, y: 540, from: 900, to: 1180, kb: '[Space] 점프', touch: '[점프] 뛰어넘기' },
    { id: 'dash', act: 'dash', x: 1310, y: 540, from: 1230, to: 1420, kb: '[K] 대시 — 잠깐 무적', touch: '[대시] 잠깐 무적' },
    { id: 'skill1', act: 'skill1', x: 1440, y: 540, from: 1380, to: 1600, kb: '[U] 대쉬베기 — 벚꽃이 쌓인다', touch: '[베기] 대쉬베기 — 벚꽃이 쌓인다' },
    { id: 'skill2', act: 'skill2', x: 1640, y: 480, from: 1560, to: 2150, kb: '[I] 발도 — 수리검을 받아친다', touch: '[발도] 수리검을 받아친다' },
  ],

  // 기억 조각 (data/story/memories.json 의 번호). chapter 가 그 장일 때만 나온다
  memories: [
    { no: 1, chapter: 'ch1', x: 900, y: 372 },   // 1-1 지붕 끝 굴뚝 뒤 (높은 발판)
    { no: 2, chapter: 'ch1', x: 3640, y: 262 },  // 1-2 쌀가게 지붕 (가장 높은 발판)
    { no: 3, chapter: 'ch1', x: 5420, y: 442 },  // 1-3 다리 아래 기둥
  ],
};

// 프롤로그: 사쿠라자와 마을. 대장간(칼 선물) → 해 질 녘 연습장에서 튜토리얼 → 축제 광장(불화살) →
// 불타는 골목(첫 실전) → 대장간 앞(소이치로) → 불타는 광장(하쿠야 패배 이벤트)
LEVELS.prologue = {
  width: 6300,
  height: 720,
  spawn: { x: 120, y: 560 },
  mood: 'dusk', // 화면 색: dusk(해 질 녘) / night / fire (gameplay 'mood'·'fireArrows' 로 바뀜)

  // 구역 배경 (assets/sprites/bg_pro_*.png, tools/process_sprites.py 로 전처리). x0~x1 구역에서 보이고
  // 경계에서 겹쳐 바뀐다. anchorX: 그림의 기준 가로 위치(manifest 의 anchor)가 화면 가운데 올 때의 카메라 중심 x.
  // 축제 광장과 불타는 광장은 같은 곳이라 둘 다 큰 벚나무 줄기를 그 광장의 나무 자리(decorTrees)에 맞춘다
  backgrounds: [
    { key: 'bg_pro_forge', x0: 0, x1: 700, anchorX: 350 },
    { key: 'bg_pro_yard', x0: 700, x1: 2330, anchorX: 1515 },
    { key: 'bg_pro_festival', x0: 2330, x1: 3120, anchorX: 2760 },
    { key: 'bg_pro_alley', x0: 3120, x1: 4400, anchorX: 3760 },
    { key: 'bg_pro_burning', x0: 4400, x1: 6300, anchorX: 5680 },
  ],

  ground: [
    { x: 0, y: 620, w: 3700, h: 100 },
    { x: 1400, y: 572, w: 44, h: 48 },    // 연습장 낮은 담 (점프 튜토리얼)
    { x: 3820, y: 620, w: 2480, h: 100 }, // 골목의 구덩이 3700~3820 너머
    { x: 4250, y: 560, w: 90, h: 60 },    // 무너진 담
    { x: -40, y: 0, w: 40, h: 720 },
    { x: 6300, y: 0, w: 40, h: 720 },
  ],

  platforms: [
    { x: 3380, y: 500, w: 160, h: 20 },
    { x: 3600, y: 450, w: 140, h: 20 },
    { x: 3980, y: 500, w: 150, h: 20 },
  ],

  // 처음엔 없고 gameplay 'spawn' 으로 나타나는 무리는 group 을 단다
  enemies: [
    { type: 'dummy', group: 'dummies', x: 1760, y: 620 },
    { type: 'dummy', group: 'dummies', x: 1880, y: 620 },
    { type: 'dummy', group: 'dummies', x: 2000, y: 620 },
    { type: 'swordsman', group: 'alley', x: 3520, y: 620, minX: 3300, maxX: 3690 },
    { type: 'swordsman', group: 'alley', x: 4000, y: 620, minX: 3830, maxX: 4240 },
    { type: 'swordsman', group: 'smithy', x: 4830, y: 620, minX: 4600, maxX: 5050 },
    { type: 'swordsman', group: 'smithy', x: 4920, y: 620, minX: 4600, maxX: 5050 },
    { type: 'swordsman', group: 'smithy', x: 5010, y: 620, minX: 4600, maxX: 5050 },
    // 하쿠야: 패배 이벤트 전투 (gameplay 'defeatBattle' 이 깨운다)
    { type: 'boss', x: 5760, y: 620, minX: 5150, maxX: 6250, dormant: true },
  ],

  trees: [
    { x: 120, y: 620 },
    { x: 3240, y: 620 }, // 불타는 골목 입구 (S0-5)
    { x: 4480, y: 620 }, // 대장간 앞 (S0-6)
  ],
  // 광장의 큰 벚나무는 배경 그림 속 나무라 나무 그림은 숨기고(hidden) 꽃 피는 효과만 그 자리(canopy)에 낸다
  decorTrees: [
    { id: 'festival', x: 2760, y: 620, hidden: true, canopy: { y: 300, w: 230 } },
    { id: 'burning', x: 5680, y: 620, bloomed: true, burning: true, hidden: true, canopy: { y: 300, w: 230 } },
  ],

  // 인물(그림만, 판정 없음). look: haru(주인공 그림을 물들임) / 그 밖엔 실루엣 + 이름
  // 인물(그림만, 판정 없음). look: haru / soichiro / villager(sheet + 색 변형) / silhouette(그림이 없을 때)
  // festival: 축제 때 춤추다가 불화살이 떨어지면 flee 쪽(-1 왼쪽 / 1 오른쪽)으로 도망친다
  npcs: [
    { id: 'soichiro', name: '소이치로', look: 'soichiro', x: 350, y: 620, face: -1 },
    { id: 'haru', name: '하루', look: 'haru', x: 1030, y: 620, face: -1 },
    { id: 'child', name: '마을 아이', look: 'villager', sheet: 'villager_child', x: 2520, y: 620, face: 1, festival: true, flee: -1 },
    { id: 'vm1', name: '마을 사람', look: 'villager', sheet: 'villager_man', x: 2590, y: 620, face: 1, festival: true, flee: -1 },
    { id: 'vw1', name: '마을 사람', look: 'villager', sheet: 'villager_woman_v1', x: 2650, y: 620, face: -1, festival: true, flee: -1 },
    { id: 'vm2', name: '마을 사람', look: 'villager', sheet: 'villager_man_v2', x: 2860, y: 620, face: 1, festival: true, flee: 1 },
    { id: 'vw2', name: '마을 사람', look: 'villager', sheet: 'villager_woman', x: 2920, y: 620, face: -1, festival: true, flee: 1 },
    { id: 'vm3', name: '마을 사람', look: 'villager', sheet: 'villager_man_v3', x: 2990, y: 620, face: -1, festival: true, flee: 1 },
    { id: 'vw3', name: '마을 사람', look: 'villager', sheet: 'villager_woman_v3', x: 3050, y: 620, face: 1, festival: true, flee: 1 },
    { id: 'vm4', name: '마을 사람', look: 'villager', sheet: 'villager_man_v1', x: 2460, y: 620, face: 1, festival: true, flee: -1 },
    // 불타는 골목: 신도가 들이닥치면 도망치는 마을 사람들 (S0-5)
    { id: 'af1', name: '마을 사람', look: 'villager', sheet: 'villager_woman_v2', x: 3420, y: 620, face: -1, alley: true, flee: -1 },
    { id: 'af2', name: '마을 사람', look: 'villager', sheet: 'villager_man_v2', x: 3480, y: 620, face: -1, alley: true, flee: -1 },
  ],

  // gameplay 명령이 쓰는 위치(x)
  points: {
    wall: 1400, forge: 350, haruWall: 1340, haruDrill: 2200, plazaTree: 2700, smithyFront: 4660,
    fireHaru: 5600, fireAkane: 5450, fireHaruAside: 5360,
  },
  // 보이지 않는 벽: 그 장면이 끝나기 전엔 앞으로 못 감
  gates: [
    { x: 700, until: 'S0-3' },
    { x: 2330, until: 'S0-2' },
    { x: 3120, until: 'S0-4' },
    { x: 4400, until: 'S0-5' },
    { x: 5100, until: 'S0-6' },
  ],
  memories: [], // 기억 조각은 1-1 ~ 6-3 에만 있다 (memories.json)
};

// 장 → 맵
window.levelFor = (chapter) => LEVELS[chapter] || LEVELS.town;

// 스토리 트리거 ↔ 장면 id (data/story/*.json). 장마다 쓰는 맵은 levelFor(장).
//   start      : 장을 시작할 때 차례로 재생. { scene, when } 이면 조건이 맞을 때만
//   triggers   : 주인공이 x 를 넘으면 한 번. stage = 여기서 스테이지 번호가 바뀜(타누키치 한마디 풀),
//                then: 'wakeBoss'(장면 뒤 보스가 깨어남) | 'clear'(장면 뒤 장 클리어)
//   trees      : 벚꽃나무 번호(LEVEL.trees 순서, 0 = 시작 나무) → 그 나무가 필 때 장면. 없으면 한마디(풀)
//   boss.hp    : 보스 체력 비율이 below 이하가 되면 / boss.after : 보스를 쓰러뜨린 뒤 → 클리어
//   events     : 게임 쪽 사건 이름 → 장면 (scene.storyEvent(이름) 으로 재생. 아직 그 사건이 없는 것들)
//   next       : 마지막 장면 뒤 이어지는 장 (then: 'nextChapter')
window.STORY_MAP = {
  prologue: {
    start: ['S0-1', 'S0-3'],  // 대장간에서 칼을 받고 → 연습장으로
    triggers: [
      { x: 780, scene: 'S0-2' },
      { x: 2420, scene: 'S0-4' },
      { x: 5330, scene: ['S0-7', 'S0-8'], then: 'nextChapter' },
    ],
    trees: { 1: 'S0-5', 2: 'S0-6' },
    next: 'ch1',
    restartFromBeginning: true, // R: 프롤로그는 처음부터 (튜토리얼·연출이 이어져 있어서)
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

};
