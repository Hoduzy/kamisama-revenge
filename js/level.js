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
  // 새 프롤로그 (P-0 ~ P-14, docs 대본). 한 줄로 이어진 맵을 구역으로 나눠 쓴다 — 장면이 아카네·인물을 그 구역으로 옮긴다.
  //   아침: 아카네의 방 → 집 마당 → 대장간 → 마을 길 → 마을 입구 → 연습장 → 축제 광장  (P-1 ~ P-9, P-13 은 같은 길을 거꾸로)
  //   밤  : 불타는 마을 길 → 불타는 대장간 앞 → 불타는 광장  (P-10 ~ P-11, P-0 · P-14 도 이 광장)
  //   따로: 이로리(P-3) · 뒷산 동굴(P-12)
  // 배경 그림이 아직 없는 구역은 화면 크기 임시 그림(단색 + 이름표, js/placeholders.js). manifest 에 같은 이름이 생기면 자동으로 그 그림
  width: 16200,
  height: 720,
  spawn: { x: 300, y: 560 },
  mood: null,

  backgrounds: [
    // 새 프롤로그 배경 (tools/process_prologue2.py): 집 실내 = 아카네의 방 · 이로리, 앞마당, 마을 길, 마을 입구, 동굴.
    // 같은 장소의 밤(P-10)은 불타는 배경, 새벽(P-13 · P-14)은 장면 준비에서 stageBg 로 bg_pro2_ash 로 바꾼다
    { id: 'room', key: 'bg_pro2_house', x0: 0, x1: 960, anchorX: 480 },
    { id: 'house', key: 'bg_pro2_yard', x0: 960, x1: 2000, anchorX: 1480 },
    { id: 'forge', key: 'bg_pro_forge', x0: 2000, x1: 2900, anchorX: 2450 },
    // 마을 길: 그림 속 만두 가게(왼쪽 찜통)가 만두 할머니 자리(dumplingShop 4200) 뒤에 오도록 기준점을 옮김 (배경은 0.15배로 움직여 한 곳만 맞출 수 있다)
    { id: 'village', key: 'bg_pro2_street', x0: 2900, x1: 4700, anchorX: 6547 },
    { id: 'gate', key: 'bg_pro2_gate', x0: 4700, x1: 5700, anchorX: 5200 },
    { id: 'yard', key: 'bg_pro_yard', x0: 5700, x1: 7400, anchorX: 6515 },
    { id: 'festival', key: 'bg_pro_festival', x0: 7400, x1: 8700, anchorX: 8000 },
    { id: 'road', key: 'bg_pro_alley', x0: 8700, x1: 10800, anchorX: 9900 },
    { id: 'smithy', key: 'bg_pro_forge', x0: 10800, x1: 11800, anchorX: 11300, tint: 0xd07060 },
    { id: 'plaza', key: 'bg_pro_burning', x0: 11800, x1: 13700, anchorX: 12900 },
    { id: 'irori', key: 'bg_pro2_house', x0: 13700, x1: 15100, anchorX: 14480 },
    { id: 'cave', key: 'bg_pro2_cave', x0: 15100, x1: 16200, anchorX: 15680 },
  ],

  ground: [
    { x: 0, y: 620, w: 16200, h: 100 },
    { x: 6400, y: 572, w: 44, h: 48 },     // 연습장 낮은 돌담 (점프)
    { x: 6560, y: 450, w: 44, h: 170 },    // 조금 높은 담 (2단 점프로만 넘음. 1단 최고 높이 ≈ 140)
    { x: -40, y: 0, w: 40, h: 720 },
    { x: 8660, y: 0, w: 40, h: 720 },      // 아침 / 밤 사이 벽
    { x: 13700, y: 0, w: 40, h: 720 },     // 밤 / 이로리
    { x: 14000 - 40, y: 0, w: 40, h: 720 },
    { x: 14960, y: 0, w: 40, h: 720 },
    { x: 15200 - 40, y: 0, w: 40, h: 720 }, // 동굴
    { x: 16160, y: 0, w: 40, h: 720 },
  ],
  platforms: [],

  enemies: [
    { type: 'dummy', group: 'dummies', x: 6760, y: 620 },
    { type: 'dummy', group: 'dummies', x: 6880, y: 620 },
    { type: 'dummy', group: 'dummies', x: 7000, y: 620 },
    // P-10 불타는 마을: 첫 신도 (처음 벨 때만 슬로모션)
    { type: 'swordsman', group: 'road', x: 9500, y: 620, minX: 9300, maxX: 9700 },
    // P-10b 대장간 앞: 소이치로가 막고 있는 신도 셋
    { type: 'swordsman', group: 'smithy', x: 11180, y: 620, minX: 11000, maxX: 11500 },
    { type: 'swordsman', group: 'smithy', x: 11270, y: 620, minX: 11000, maxX: 11500 },
    { type: 'swordsman', group: 'smithy', x: 11360, y: 620, minX: 11000, maxX: 11500 },
    // 하쿠야: P-0 실루엣 · P-11 패배 이벤트 전투
    { type: 'boss', x: 13050, y: 620, minX: 12100, maxX: 13600, dormant: true },
  ],

  // 체크포인트 벚꽃나무 (죽으면 마지막 나무에서). 첫 나무는 마을 길 어귀
  trees: [
    { x: 3000, y: 620 },
    { x: 9150, y: 620 },   // 불타는 마을 길
    { x: 10900, y: 620 },  // 대장간 앞
  ],
  decorTrees: [
    // 큰 벚나무 (tree 시트, 2배): 장면이 treeStage 로 단계를 바꾼다 (P-8 만개 → P-9 불타는 → P-14 검게 탄)
    { id: 'festival', x: 8000, y: 620, scale: 2, hidden: true, canopy: { y: 380, w: 200 } },
    { id: 'burning', x: 12900, y: 620, scale: 2, hidden: true, canopy: { y: 380, w: 200 } },
  ],

  // 처음부터 맵에 있는 인물. 장면마다 spawn 으로 자리를 옮긴다. 그림이 없는 인물은 실루엣 + 이름표
  npcs: [
    { id: 'haru', name: '하루', look: 'haru', x: 1700, y: 620, face: -1 },
    { id: 'soichiro', name: '소이치로', look: 'soichiro', x: 2450, y: 620, face: -1 },
    { id: 'hana', name: '하나', look: 'villager', sheet: 'villager_child', x: 3000, y: 620, face: -1 },
    { id: 'dumpling_grandma', name: '만두 할머니', look: 'dumpling_grandma', sheet: 'villager_woman', x: 4260, y: 620, face: -1 },
    { id: 'village_old_man', name: '마을 노인', look: 'village_old_man', sheet: 'villager_man_v3', x: 3500, y: 620, face: -1 },
    { id: 'wanderer', name: '나그네', look: 'wanderer', tall: true, hat: true, x: 5230, y: 620, face: 1 },
    // 축제 광장 마을 사람들 (P-8 춤 → P-9 멈춤)
    { id: 'vm1', name: '마을 사람', look: 'villager', sheet: 'villager_man', x: 7620, y: 620, face: 1, festival: true, flee: -1 },
    { id: 'vw1', name: '마을 사람', look: 'villager', sheet: 'villager_woman_v1', x: 7700, y: 620, face: -1, festival: true, flee: -1 },
    { id: 'vm2', name: '마을 사람', look: 'villager', sheet: 'villager_man_v2', x: 8260, y: 620, face: 1, festival: true, flee: 1 },
    { id: 'vw2', name: '마을 사람', look: 'villager', sheet: 'villager_woman_v2', x: 8340, y: 620, face: -1, festival: true, flee: 1 },
    { id: 'vm3', name: '마을 사람', look: 'villager', sheet: 'villager_man_v1', x: 8420, y: 620, face: -1, festival: true, flee: 1 },
    { id: 'vw3', name: '마을 사람', look: 'villager', sheet: 'villager_woman_v3', x: 7540, y: 620, face: 1, festival: true, flee: -1 },
    // P-10 왼쪽으로 도망치는 마을 사람들
    { id: 'rf1', name: '마을 사람', look: 'villager', sheet: 'villager_woman_v2', x: 9320, y: 620, face: -1, road: true, flee: -1 },
    { id: 'rf2', name: '마을 사람', look: 'villager', sheet: 'villager_man_v2', x: 9420, y: 620, face: -1, road: true, flee: -1 },
    { id: 'rf3', name: '마을 사람', look: 'villager', sheet: 'villager_man', x: 9640, y: 620, face: -1, road: true, flee: -1 },
  ],

  // 장면이 쓰는 위치(x)
  points: {
    // 아침
    bed: 260, roomDoor: 900, sapling: 1500, houseExit: 1900,
    forge: 2450, forgeFront: 2330, well: 3200, shrine: 3500, dumplingShop: 4200, villageEnd: 4600,
    gateStone: 5230, gateAkane: 5130, forestPath: 5650,
    wall: 6400, wall2: 6560, haruWall: 6340, haruDrill: 7200, yardHaru: 6100,
    festivalTree: 8000, festivalAkane: 7880, festivalHaru: 7960, festivalSoichiro: 7820, festivalEdge: 8560,
    // 밤
    roadStart: 9100, dumplingFire: 9950, roadHana: 9950, smithyFront: 11050, smithySoichiro: 11450,
    plazaEnter: 12300, fireAkane: 12560, fireAkaneDown: 12560, fireHaru: 12760, fireHaruAside: 12660, fireHakuya: 13060,
    plazaStump: 12900, graveAkane: 12820,
    // 따로
    irori: 14480, iroriAkane: 14400, iroriHaru: 14560, iroriDoor: 14900,
    caveMouth: 15900, caveAkane: 15820, caveHana: 15420, caveExit: 16120,
  },
  // 보이지 않는 벽: 그 장면이 끝나기 전엔 앞으로 못 감 (조작 장면이 끝나기 전에 다음 장소로 앞질러 가지 않게)
  gates: [
    { x: 960, until: 'P-1' },
    { x: 2900, until: 'P-4' },
    { x: 4760, until: 'P-5' },
    { x: 5720, until: 'P-6' },
    { x: 10780, until: 'P-10' },
    { x: 11780, until: 'P-10b' },
  ],
  memories: [],
};

// 스킬 시험 (F1 개발 메뉴 → '스킬 시험'): 허수아비 5개를 일렬로, 5개를 원형으로. 낭떠러지 · 벽에서 대쉬가 멈추는지도 본다
LEVELS.skilltest = {
  width: 2600,
  height: 720,
  spawn: { x: 300, y: 560 },
  mood: null,
  backgrounds: [{ id: 'yard', key: 'bg_pro_yard', x0: 0, x1: 2600, anchorX: 1300 }],
  ground: [
    { x: 0, y: 620, w: 2200, h: 100 },     // 2200 에서 낭떠러지
    { x: 2380, y: 620, w: 220, h: 100 },
    { x: 1460, y: 530, w: 80, h: 16 },      // 원형 위쪽 허수아비 발판
    { x: -40, y: 0, w: 40, h: 720 },
    { x: 2600, y: 0, w: 40, h: 720 },
  ],
  platforms: [],
  // anySkill: 대쉬베기 말고 발도에도 맞는 허수아비, hp 크게 (맞아도 쓰러지지 않고 피해 숫자만)
  enemies: [
    // 일렬 (스킬 1 관통)
    ...[560, 605, 650, 695, 740].map((x) => ({ type: 'dummy', x, y: 620, hp: 999, anySkill: true })),
    // 원형: 가운데(1500)에 서면 좌우 두 겹 + 위 발판 하나가 둘러싼다 (스킬 2 원형 타격)
    ...[1410, 1450, 1550, 1590].map((x) => ({ type: 'dummy', x, y: 620, hp: 999, anySkill: true })),
    { type: 'dummy', x: 1500, y: 530, hp: 999, anySkill: true },
  ],
  trees: [{ x: 160, y: 620 }],  // 부활 자리 (맵마다 하나는 있어야 한다)
  decorTrees: [],
  npcs: [],
  points: { line: 560, ring: 1500, ledge: 2200 },
  memories: [],
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
    // 새 프롤로그: 불타는 광장 미리보기 → 열두 시간 전 아침부터. 장면 안에서 모드·자리·카메라를 정한다 (배우 시스템)
    start: ['P-0', 'P-1'],
    triggers: [
      { x: 1000, scene: ['P-2', 'P-3', 'P-4'] },        // 방을 나서 마당 → 밥상 → 대장간
      { x: 2950, scene: 'P-5' },                        // 마을 길 (심부름)
      { x: 4850, scene: 'P-6' },                        // 마을 입구 (나그네)
      { x: 5750, scene: ['P-7', 'P-8', 'P-9', 'P-10'] }, // 연습장 → 축제 → 종소리 → 불타는 마을
      { x: 10850, scene: 'P-10b' },                     // 대장간 앞
      { x: 12200, scene: ['P-11', 'P-12', 'P-13', 'P-14'], then: 'nextChapter' }, // 광장 결전 → 동굴 → 잿더미 → 무덤
    ],
    next: 'ch1',
    restartFromBeginning: true, // R: 프롤로그는 처음부터 (연출이 이어져 있어서)
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
