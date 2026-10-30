// 조작감 튜닝 값. 단위: px, px/s, px/s², 초.
// 숫자만 바꿔서 손맛을 조절할 수 있도록 한 곳에 모아 둔다.
window.TUNING = {
  // 수평 이동
  maxRunSpeed: 340,
  groundAccel: 5200,     // 지상 가속 (0 → 최고속까지 약 0.065초)
  groundDecel: 6400,     // 지상 감속 (키를 떼면 거의 즉시 멈춤)
  groundTurnAccel: 9000, // 지상 방향 전환
  airAccel: 3800,        // 공중 가속
  airDecel: 1600,        // 공중 감속 (관성을 조금 남김)
  airTurnAccel: 6000,    // 공중 방향 전환

  // 점프 / 중력
  gravity: 2100,
  jumpVelocity: 760,     // 최대 점프 높이 ≈ v² / 2g
  jumpCutMultiplier: 0.45, // 점프 키를 일찍 떼면 상승 속도에 곱함 (가변 점프)
  fallGravityMult: 1.65, // 하강 시 중력 배율 (묵직하게 떨어짐)
  apexGravityMult: 0.55, // 정점 근처에서 점프 키를 누르고 있으면 살짝 체공
  apexThreshold: 90,     // |vy|가 이 값보다 작으면 정점으로 간주
  maxFallSpeed: 1050,
  coyoteTime: 0.10,      // 발판에서 떨어진 뒤에도 점프 가능한 시간
  jumpBuffer: 0.12,      // 착지 직전에 누른 점프를 기억하는 시간

  // 대시
  dashSpeed: 860,
  dashTime: 0.14,
  dashCooldown: 0.30,

  // 판정 박스는 몸통만 (머리·머리카락·칼·옷자락 제외). 발바닥이 박스 아래 변. 스프라이트 키 82도트 기준
  // H 키로 화면에 판정을 표시할 수 있다
  playerBody: { width: 28, height: 60 },

  // 공격
  attackActive: 0.11,
  attackCooldown: 0.24,
  attackBuffer: 0.10,
  attackRange: 58,
  attackHeight: 56,
  airHitBounce: 260,     // 공중에서 적을 때리면 살짝 떠오름
  stompBounce: 560,

  // 피격: 체력 1칸. 맞으면 즉시 죽고 마지막 벚꽃나무에서 부활
  respawnInvuln: 1.0,    // 부활 직후 무적
  deathAnimTime: 0.75,   // 사망 애니메이션을 보여 주는 시간 (그 뒤 부활)
  interruptInvuln: 0.6,  // 발도가 끊겼을 때 무적 (연속 피격 방지)
  hurtLockTime: 0.2,     // 발도가 끊겼을 때 조작 불가 시간
  hurtKnockX: 380,
  hurtKnockY: 420,

  // 타격감: 적을 벨 때
  hitStop: 0.05,
  hitShake: { duration: 90, intensity: 0.005 },

  attackDamage: 1,       // 기본 공격(J)
  stompDamage: 2,        // 밟기

  // 벚꽃나무(체크포인트)
  treeActivateRadius: 70,

  // 근접 검사
  swordsman: {
    hp: 3,
    body: { width: 34, height: 74 },   // 그림 키 100 중 목 아래 몸통
    patrolSpeed: 70,
    chaseSpeed: 150,
    aggroRange: 320,     // 이 거리 안에 들어오면 쫓아옴
    attackRange: 72,     // 이 거리 안이면 공격 시작
    windup: 0.4,         // 빨간 예고 표시 시간
    activeTime: 0.1,     // 베기 판정 시간
    recover: 0.45,       // 공격 후 빈틈
    cooldown: 0.6,
    reach: 78,           // 베기 판정 폭(몸 앞쪽부터)
    height: 50,
    lunge: 160,          // 벨 때 내딛는 속도
  },

  // 원거리 투척병
  thrower: {
    hp: 2,
    body: { width: 36, height: 74 },
    range: 520,          // 이 거리 안이면 수리검을 던짐
    windup: 0.4,         // 던지기 전 머리 위 '!' + 반짝임 예고 시간
    cooldown: 1.6,
    retreatRange: 150,   // 이보다 가까우면 뒤로 물러남
    retreatSpeed: 110,
  },

  // 프롤로그 연습장 허수아비: 대쉬베기로만 쓰러진다
  dummy: {
    hp: 1,
    body: { width: 30, height: 64 },
  },

  // 패링 연습 상대(하루): 근접 검사 AI 를 천천히. 맞아도 죽지 않음(프롤로그 튜토리얼)
  trainer: {
    hp: 999,
    body: { width: 28, height: 60 },
    patrolSpeed: 0,
    chaseSpeed: 90,
    aggroRange: 700,
    attackRange: 80,
    windup: 0.9,         // 일부러 느리게
    activeTime: 0.14,
    recover: 0.6,
    cooldown: 1.0,
    reach: 70,
    height: 50,
    lunge: 70,
  },

  // 보스: 근접 검사 AI + 부채꼴 수리검. 맞아도 공격이 끊기지 않음(슈퍼아머)
  boss: {
    hp: 24,
    body: { width: 60, height: 140 },  // 그림 키 190 중 목 아래 몸통 (후광·흰 머리·큰 칼 제외)
    patrolSpeed: 0,
    chaseSpeed: 170,
    aggroRange: 1400,
    attackRange: 100,
    windup: 0.5,
    activeTime: 0.12,
    recover: 0.5,
    cooldown: 0.5,
    reach: 112,
    height: 80,
    lunge: 260,
    throwCooldown: 2.4,  // 수리검 3개를 부채꼴로 던지는 간격
    superArmor: true,
  },

  // 컷신 엔진 (js/story-player.js)
  story: {
    autoAdvanceBase: 1.6,     // 조작 가능 컷신: 대사가 다 나온 뒤 기본 대기(초)
    autoAdvancePerChar: 0.05, //   + 글자당
    holdToSkip: 0.8,          // 이만큼 길게 누르면 장면 전체 건너뛰기(초)
    bgmVolume: 0.6,
    sfxVolume: 0.8,
  },

  // 대화
  dialogue: {
    charsPerSecond: 32,
    punctuationPause: 0.12, // 문장부호 뒤 잠깐 멈춤
  },

  shuriken: {
    speed: 336,          // 날아가는 속도(px/s). 처음 420 에서 20% 느리게
    life: 3,
    radius: 10,          // 맞는 판정 반지름 (그림 1.5배에 맞춤)
    trailInterval: 0.025, // 잔상 꼬리를 남기는 간격(초)
    reflectSpeedMult: 1.4, // 패링으로 되돌려 보낼 때 속도 배율
    reflectDamage: 2,
  },

  // 벚꽃 스택
  sakuraMax: 5,

  // 스킬1 대쉬베기 (U)
  dashSlash: {
    distance: 230,       // 대쉬 거리(px)
    time: 0.12,          // 대쉬에 걸리는 시간(초). 속도 = distance / time
    cooldown: 0.8,
    damage: 1,
    stacksPerHit: 1,     // 적 하나 맞힐 때마다 벚꽃 스택 증가량
    hitHeight: 72,       // 판정 높이
    endGrace: 0.2,       // 대쉬가 끝난 직후 무적 시간 (적 몸에 겹쳐 끝나도 바로 맞지 않게)
  },

  // 스킬2 발도 (I)
  iaido: {
    chargeTime: 1.0,     // 준비 시간
    parryWindow: 0.5,    // 준비 시작 후 이 시간까지 패링
    cooldown: 6,
    baseDamage: 3,
    damagePerStack: 2,   // 벚꽃 스택 1개당 추가 피해
    range: 200,          // 베기 사거리(px, 몸 앞쪽부터)
    height: 84,          // 베기 판정 높이
    lungeSpeed: 650,     // 벨 때 앞으로 내딛는 속도
    parryDamage: 2,      // 패링당한 적이 받는 피해
    parryKnockback: 480,
    hitStop: 0.12,       // 발도는 일반 베기보다 묵직하게
  },
};

window.GAME_WIDTH = 960;
window.GAME_HEIGHT = 540;

window.COLORS = {
  background: 0x14172e,   // 밤 (배경 그림 뒤)
  player: 0x000000,
  enemy: 0xd62828,
  ground: 0x8a8a8a,
  groundFill: 0x24222c,   // 땅 윗면 타일 아래 채움색
  platform: 0x9d9d9d,
};
