# 프롤로그 임시 그림 목록

새 프롤로그(P-0 ~ P-14)에서 아직 그림이 없어 **단색 + 이름표**로 임시 표시하는 것들입니다.
그림을 `assets/raw/` 에 올려 `tools/process_*.py` 로 manifest(`assets/sprites/manifest.json`)에 **아래 이름 그대로** 넣으면, 게임이 자동으로 그 그림을 씁니다 (코드는 바꿀 필요 없음).

## 새 프롤로그 그림 (tools/process_prologue2.py)

원본 16장의 이름 대응표: `docs/prologue2-mapping.md`, 원본 ↔ 전처리 결과 미리보기: `assets/sprites/prologue2_preview.html`.

### 배경 (구역마다, `js/level.js` LEVELS.prologue.backgrounds)

| 그림 | 장소 | 쓰는 장면 |
|---|---|---|
| `bg_pro2_house` | 집 실내 (이로리 · 이불) | P-1 아카네의 방, P-3 이로리 |
| `bg_pro2_yard` | 초가집 앞마당 | P-2, P-4 시작 |
| `bg_pro2_street` | 축제 준비 중인 마을 길 | P-5 |
| `bg_pro2_gate` | 돌 도리이 · 석등 · 삼나무 숲 입구 | P-6 (오후 — 색감 오버레이 없이 그림 그대로) |
| `bg_pro2_cave` | 비 오는 새벽 동굴 입구 | P-12 |
| `bg_pro2_ash` | 비 오는 새벽 잿더미 마을 | P-13 (방 · 마당 · 대장간 · 마을 길 · 입구를 장면 준비에서 바꿈), P-14 광장 (+ 큰 벚나무 검게 탄 단계) |

밤(P-10)의 같은 장소는 기존 불타는 배경(`bg_pro_alley` · `bg_pro_forge` 붉게 · `bg_pro_burning`). 색감: P-1 ~ P-5 아침(mood morning), P-6 없음, P-7 점점 주황(dusk → duskDeep).

### CG

`assets/cg/cg_A.png` (P-8), `assets/cg/cg_B.png` (P-14). 대본의 `cg no='A'` 는 `cg_A.png` 를 찾는다 (숫자만 두 자리로 채움).

### 인물 시트 · 애니메이션 (manifest 의 `anims` 로 자동 생성)

| 시트 | 애니메이션 |
|---|---|
| `akane_morning` (잠옷) | akane_sleep · akane_stretch · akane_tie_hair · akane_stand_up — P-1 |
| `akane_emote1` (마른 기모노, 칼 없음) | akane_crouch · akane_reach · akane_ember · akane_seiza(앉기 기본) · akane_eat · akane_smile — P-2 · P-3 · P-8 |
| `akane_emote2` (비에 젖음) | akane_collapse · akane_sit_up · akane_shake_bell · akane_slow_walk · akane_dig · akane_strike — P-12 ~ P-14 (깃발 `akaneRain`: 앉기 · 쓰러짐 · 걷기도 젖은 그림) |
| `family_sitting` | haru_seiza(하루 앉기) · haru_crouch_reach · haru_eat · soichiro_hide · soichiro_laugh (소이치로 앉기 = 6번 칸) |
| `hakuya_traveler` (나그네) | wanderer_sit(돌 포함) · wanderer_look_manju · wanderer_stand · wanderer_walk |
| `villagers_elder` | grandma_idle · grandma_give · grandma_wave · old_man_idle · old_man_bow · old_man_laugh |

초상화 `portraits_pro2`: 0 아카네 활짝 웃음(P-3 · P-8 의 웃음), 1 젖은 슬픔 · 2 젖은 분노(P-12 ~ P-14), 3 나그네 기본, 4 나그네 웃음, 5 만두 할머니 (`tools/convert_story.py` 의 PORTRAITS · FACE_OVERRIDES).

머리끈 방울: P-7 에서 받은 뒤부터 P-14 에서 천으로 감쌀 때까지 아카네 그림 위에 빨간 2×2 점 (`js/player.js` updateBell, 자리 표 `Player.BELL_TIE`).

### 3차 그림 (tools/process_prologue3.py, 대응표 docs/prologue3-mapping.md)

| 그림 | 쓰는 곳 |
|---|---|
| `player_idle_nosword` · `player_walk_nosword` · `player_run_nosword` · `player_jump_nosword` | 칼 받기 전 아카네 (P-1 ~ P-4 칼 획득 전, 깃발 `akaneNoSword`) |
| `haru_gesture` | haru_ruffle(머리 헝클기, P-2) · haru_take_bell / haru_tie_bell (방울 꺼내 묶기, P-7) |
| `hana_actions` | hana_wave_mask(P-5 가면 자랑, P-8 손뼉) · hana_trapped → hana_crawl (P-10 기둥) · hana_cry (P-10 아카네의 akane_hug 와 같은 자리에서 동시에) |
| `akane_gesture` | akane_hug (P-10 하나 안기, P-12 망토 덮기) · akane_wrap_bell → akane_tuck (P-14) |
| `cutin_traveler_hair` | P-6 컷인 (삿갓 끝이 들림) |
| props/ `letter` `bokken` `blossom_single` `hammer` `haru_katana` | 편지(P-3) · 목검(P-7) · 피운 꽃(P-8) · 망치(P-13) · 하루의 칼(P-14) |
| props/ `lantern_rope` · `lantern_rope_fallen` | P-9 등롱 줄 (줄 조각 + 켜진 등롱 조립 → 끊기면 찢긴 등롱이 땅에) |
| props/ `prop_rooftop_cultist` | P-9 지붕 위 신도 (enemy_sword 대기 칸을 검은 실루엣 + 붉은 눈 2픽셀) |

이미 있는 그림으로 대신한 것: 꽃잎 = `fx_petals` 4종, 빛 점 = 분홍 코드 입자(`glow`), 하루 목검 치켜들기 = haru_attack 1-3, 편지 만지기 = family_sitting 2번째 칸,
소이치로 칼 내밀기 = soichiro_give · 화살 맞기 = soichiro_kneel, 칼자루 쥐기 = player_iaido_ready 첫 칸, 비녀 줍기 = akane_emote2 흙 파기 첫 칸,
귀 까딱 = 코드(`earTwitch`), 마을 노인 등롱 걸기 = 생략(대기), 나그네 삿갓 끝 = 컷인.

### 전경 · 불 (P-0 · P-11 불타는 광장)

전경(`cine.foreground`)은 그림이 있을 때만 그린다 — 코드로 그린 검은 실루엣은 지웠다.

| 이름 | 무엇 | 지금 |
|---|---|---|
| `fg_burning_pillar` | 불타는 기둥 (0 서 있음, 1 쓰러짐) — `tools/process_prologue3.py --pillar` | 서 있음: P-9 끝 · P-10 · P-0 · P-11 화면 앞 1개씩 / 쓰러짐: P-10 하나를 깔고 있는 기둥, P-10b 무너진 지붕 |
| `lantern_rope` (props) | 등롱 줄 전경 | P-5 · P-8 |
| `fx_fire_wall` | 화면 앞 불길 (1.3배 패럴랙스) | P-0 · P-11 화면 앞 오른쪽 |
| `fx_fire_small` | 바닥 곳곳 작은 불 | P-0 · P-11 바닥, P-10 깔린 기둥 위, P-10b 무너진 기둥 위 |
| `fg_sakura_branch` | 위쪽 벚꽃 가지 전경 | 그림 없음, 쓰는 장면도 없음 |
| `tree_burning` / `tree_charred` | 큰 벚나무 불타는 · 검게 탄 (`process_prologue3.py --fire`, 기존 tree 칸과 키 · 줄기 밑동을 맞춤) | P-9 꼭대기부터 0.8초 닦아내듯 교체 → P-11 까지, P-14 검게 탄 |

### 아직 그림이 없는 것

프롤로그 전체를 재생하며 단색 네모 · 이름표 · 머리 위 노란 글씨 · 실루엣이 만들어지는지 기록했을 때 0개.

## 소품

소품 시트는 `python3 tools/process_props.py` 로 덩어리마다 잘라 `assets/sprites/props/` 에 넣는다 (조각 미리보기: `assets/sprites/props/props_preview.html`).
어떤 그림이 어느 장면에 실제로 그려지는지는 `docs/asset-audit.md` (점검표, `python3 tools/audit_assets.py`).

소품은 모두 `assets/sprites/props/` 한 폴더 (새 프롤로그 소품 시트는 `tools/process_prologue2.py` 가 같은 폴더에 자른다).

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
