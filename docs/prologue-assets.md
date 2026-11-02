# 프롤로그 임시 그림 목록

새 프롤로그(P-0 ~ P-14)에서 아직 그림이 없어 **단색 + 이름표**로 임시 표시하는 것들입니다.
그림을 `assets/raw/` 에 올려 `tools/process_*.py` 로 manifest(`assets/sprites/manifest.json`)에 **아래 이름 그대로** 넣으면, 게임이 자동으로 그 그림을 씁니다 (코드는 바꿀 필요 없음).

## 배경 (화면 960×540 크기, 구역마다)

| 이름 | 장소 | 쓰는 장면 |
|---|---|---|
| `bg_pro_room` | 아카네의 방 | P-1 |
| `bg_pro_house` | 집 마당 (죽은 묘목) | P-2, P-4 시작, P-13 |
| `bg_pro_irori` | 이로리 · 아침 밥상 | P-3 |
| `bg_pro_village` | 마을 길 (만두 가게 · 신사 · 우물) | P-5, P-13 |
| `bg_pro_gate` | 마을 입구 (돌 도리이 · 석등) | P-6, P-13 |
| `bg_pro_cave` | 뒷산 동굴 · 새벽 비 | P-12 |
| `bg_pro_grave` | 큰 벚나무 아래 · 검게 탄 그루터기 | P-14 (불타는 광장 배경을 바꿔 씀) |

이미 있는 배경을 다시 쓰는 구역: 대장간(`bg_pro_forge`, 밤에는 붉게), 연습장(`bg_pro_yard`), 축제 광장(`bg_pro_festival`), 불타는 마을 길(`bg_pro_alley`), 불타는 광장(`bg_pro_burning`, P-0 · P-11).

## CG

| 파일 | 내용 |
|---|---|
| `assets/cg/cg_0A.png` | CG A — 가지 위에 겹친 두 손, 아카네 손바닥 아래에서 막 벌어지는 꽃 한 송이 (P-8) |
| `assets/cg/cg_0B.png` | CG B — 비 내리는 잿더미, 검은 그루터기 앞 작은 돌무덤 두 개, 무릎 꿇은 아카네의 뒷모습 (P-14) |
| `assets/cg/cg_01.png`, `cg_02.png` | 있음 (축제 밤의 가족 · 꽃잎에 감싸인 아카네) |

파일이 없으면 검은 화면에 CG 번호와 설명이 나옵니다.

## 인물

| 이름(시트) | 인물 | 지금 |
|---|---|---|
| `wanderer_idle`, `wanderer_walk`, `wanderer_sit` | 나그네 (삿갓 쓴 하쿠야, P-6 · P-8) | 삿갓 쓴 검은 실루엣 + 이름표 |
| `cutin_wanderer_hair` | 컷인: 삿갓 아래 흘러내린 흰 머리카락 한 가닥 (P-6) | 컷인 띠에 이름표 |
| 하나 · 만두 할머니 · 마을 노인 | 마을 사람 시트(`villager_child` 등) | 있음 (색 변형) |

`<이름>_idle` 시트가 manifest 에 생기면 `_walk` `_sit` `_kneel` `_down` 도 있는 만큼 자동으로 씁니다.

## 아카네 · 하루의 새 동작

그림이 없으면 머리 위에 노란 글씨로 동작 이름이 잠깐 나옵니다 (예: `(머리끈을 입에 물고 포니테일을 묶는다)`). 애니메이션 이름으로 manifest 에 넣으면 자동으로 재생됩니다.

| 애니메이션 | 동작 |
|---|---|
| `haru_reach` | 아카네 쪽으로 손을 뻗는다 |
| `player_ear_twitch` | 귀 까딱 |
| `player_iaido_ready` | 칼을 처음 반쯤 뽑는다 |
| `player_tie_hair` | 머리끈을 입에 물고 포니테일을 묶는다 |
| `soichiro_forge` | 마지막 담금질 |

앉기 · 무릎 꿇기: 아카네는 임시로 발도 준비 자세, 하루는 `haru_reach` · `haru_death` 칸. 칼 차지 않은 아카네 그림(P-1~P-4)은 아직 없어 지금 그림을 그대로 씁니다 (`storyFlags.akaneSword` 로 나중에 바꿀 수 있게 표시만 해 둠).

## 소품

소품 시트는 `python3 tools/process_props.py` 로 덩어리마다 잘라 `assets/sprites/props/` 에 넣는다 (조각 미리보기: `assets/sprites/props/props_preview.html`).
어떤 그림이 어느 장면에 실제로 그려지는지는 `docs/asset-audit.md` (점검표, `python3 tools/audit_assets.py`).

**그림이 있어 게임에 쓰이는 소품**: prop_scarecrow · prop_scarecrow_broken · prop_katana · prop_fire_arrow · prop_debris_fire · prop_fox_mask · prop_anvil · prop_sword_rack ·
sapling_dead · sapling_burnt · bell_red · bell_wrapped · kanzashi · manju_basket · steamer · kasa_hat · grave_a · grave_b · stall_burning · mask_broken

**아직 그림이 없어 단색 네모 + 이름표로 나오는 것** (프롤로그를 끝까지 재생하며 실제로 임시 그림이 쓰인 것):
- `prop_flower`
- `prop_glow`
- `prop_hammer`
- `prop_haru_sword`
- `prop_lantern_fallen`
- `prop_lantern_rope`
- `prop_petal`
- `prop_rooftop_cultist`
- `prop_shrine`
- `prop_well`

**큰 벚나무**: `tree` 시트에 앙상함 · 만개 2단계만 있다. 불타는 단계(`tree_burning`)와 검게 탄 단계(`tree_burnt`)는 그림이 없어
만개 그림을 불빛 색 + 불티로, 앙상한 그림을 검게 물들여 대신한다. 같은 이름의 그림을 넣으면 자동으로 바뀐다.
