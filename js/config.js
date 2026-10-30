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

  // 공격
  attackActive: 0.11,
  attackCooldown: 0.24,
  attackBuffer: 0.10,
  attackRange: 58,
  attackHeight: 38,
  airHitBounce: 260,     // 공중에서 적을 때리면 살짝 떠오름
  stompBounce: 560,

  // 피격
  maxHp: 5,
  invulnTime: 1.0,
  hurtLockTime: 0.2,
  hurtKnockX: 380,
  hurtKnockY: 420,

  // 연출
  hitStop: 0.06,
};

window.GAME_WIDTH = 960;
window.GAME_HEIGHT = 540;

window.COLORS = {
  background: 0xeeebe4,
  player: 0x000000,
  enemy: 0xd62828,
  ground: 0x8a8a8a,
  platform: 0x9d9d9d,
};
