# 그림 사용 점검표 (소품 · 이펙트 · 벚나무)

`python3 tools/audit_assets.py` 가 만든다. 새 그림을 넣을 때마다 다시 돌린다.
「그려짐」은 개발 메뉴로 장면을 재생하며 실제로 그 그림이 화면 오브젝트에 쓰인 장면이다 (`tools/asset_usage.json`).

## 원본 시트 → 조각

- `assets/raw/fx_prologue.png` → 5조각: `fx_barrier`, `fx_barrier_break`, `fx_red_sun`, `fx_red_sun_grow`, `logo_emblem`
- `assets/raw/prologue/F5323BD8-A0E4-4ECA-86B0-BF088FDDF4DF.png` → 12조각: `bell_red`, `bell_wrapped`, `grave_a`, `grave_b`, `kanzashi`, `kasa_hat`, `manju_basket`, `mask_broken`, `sapling_burnt`, `sapling_dead`, `stall_burning`, `steamer`
- `assets/raw/props_prologue.png` → 8조각: `prop_anvil`, `prop_debris_fire`, `prop_fire_arrow`, `prop_fox_mask`, `prop_katana`, `prop_scarecrow`, `prop_scarecrow_broken`, `prop_sword_rack`

## 그림별

| 파일 | 종류 | 개별 이미지로 잘렸는지 | 로드 | 실제로 화면에 그려지는 장면 | 같은 자리 코드 임시 도형 |
|---|---|---|---|---|---|
| `fx_barrier.png` | 이펙트 | 잘림 (fx_prologue.png) · 4칸 | 로드됨 | **그려짐**: P-11 | 없음 |
| `fx_barrier_break.png` | 이펙트 | 잘림 (fx_prologue.png) · 4칸 | 로드됨 | **그려짐**: P-11 | enemy.js 금빛 고리 (그림 없을 때만) |
| `fx_parry_flash.png` | 이펙트 | 잘림 (effects.png) · 4칸 | 로드됨 | 코드·대본에서 씀 (시험에서 안 봄): skills.js, sprites.js | 없음 |
| `fx_petals.png` | 이펙트 | 잘림 (effects.png) · 4칸 | 로드됨 | **그려짐**: (맵), P-10, P-10b, P-5, P-8 | 없음 |
| `fx_red_sun.png` | 이펙트 | 잘림 (fx_prologue.png) | 로드됨 | **그려짐**: P-9 | 없음 |
| `fx_red_sun_grow.png` | 이펙트 | 잘림 (fx_prologue.png) · 5칸 | 로드됨 | **그려짐**: P-9, 장 제목 카드 (HTML) | 없음 (그림이 없으면 문양을 안 그림) |
| `fx_sakura_burst.png` | 이펙트 | 잘림 (effects.png) · 4칸 | 로드됨 | **그려짐**: (맵), P-10, P-10b, P-8 | 없음 |
| `fx_slash.png` | 이펙트 | 잘림 (effects.png) · 4칸 | 로드됨 | **그려짐**: P-10, P-11 | 없음 |
| `logo_emblem.png` | 로고 | 잘림 (fx_prologue.png) | 로드됨 | **그려짐**: P-14 (HTML 타이틀 로고) | 없음 |
| `props/bell_red.png` | 소품 | 잘림 (prologue/F5323BD8-A0E4-4ECA-86B0-BF088FDDF4DF.png) | 로드됨 | **그려짐**: P-14, P-7 | placeholders.js 단색 네모 (그림 없을 때만) |
| `props/bell_wrapped.png` | 소품 | 잘림 (prologue/F5323BD8-A0E4-4ECA-86B0-BF088FDDF4DF.png) | 로드됨 | **그려짐**: P-14 | placeholders.js 단색 네모 (그림 없을 때만) |
| `props/grave_a.png` | 소품 | 잘림 (prologue/F5323BD8-A0E4-4ECA-86B0-BF088FDDF4DF.png) | 로드됨 | **그려짐**: P-14 | placeholders.js 단색 네모 (그림 없을 때만) |
| `props/grave_b.png` | 소품 | 잘림 (prologue/F5323BD8-A0E4-4ECA-86B0-BF088FDDF4DF.png) | 로드됨 | **그려짐**: P-14 | placeholders.js 단색 네모 (그림 없을 때만) |
| `props/kanzashi.png` | 소품 | 잘림 (prologue/F5323BD8-A0E4-4ECA-86B0-BF088FDDF4DF.png) | 로드됨 | **그려짐**: P-14 | placeholders.js 단색 네모 (그림 없을 때만) |
| `props/kasa_hat.png` | 소품 | 잘림 (prologue/F5323BD8-A0E4-4ECA-86B0-BF088FDDF4DF.png) | 로드됨 | **그려짐**: P-8, P-9 | placeholders.js 단색 네모 (그림 없을 때만) |
| `props/manju_basket.png` | 소품 | 잘림 (prologue/F5323BD8-A0E4-4ECA-86B0-BF088FDDF4DF.png) | 로드됨 | **그려짐**: P-5 | placeholders.js 단색 네모 (그림 없을 때만) |
| `props/mask_broken.png` | 소품 | 잘림 (prologue/F5323BD8-A0E4-4ECA-86B0-BF088FDDF4DF.png) | 로드됨 | **그려짐**: P-10, P-12 | placeholders.js 단색 네모 (그림 없을 때만) |
| `props/prop_anvil.png` | 소품 | 잘림 (props_prologue.png) | 로드됨 | **그려짐**: P-4 | 없음 |
| `props/prop_debris_fire.png` | 소품 | 잘림 (props_prologue.png) | 로드됨 | **그려짐**: P-10, P-10b, P-11 | game-scene.js debris 의 네모 (그림 없을 때만) |
| `props/prop_fire_arrow.png` | 소품 | 잘림 (props_prologue.png) | 로드됨 | **그려짐**: (맵), P-10, P-10b, P-9 | game-scene.js fireArrow · gameplay.js arrowVolley 의 네모 (그림 없을 때만) |
| `props/prop_fox_mask.png` | 소품 | 잘림 (props_prologue.png) | 로드됨 | **그려짐**: P-8 | 없음 |
| `props/prop_katana.png` | 소품 | 잘림 (props_prologue.png) | 로드됨 | **그려짐**: P-4 | 없음 |
| `props/prop_scarecrow.png` | 소품 | 잘림 (props_prologue.png) | 로드됨 | **그려짐**: P-7 | game-scene.js createTextures 의 허수아비 도형 (그림 없을 때만) |
| `props/prop_scarecrow_broken.png` | 소품 | 잘림 (props_prologue.png) | 로드됨 | **그려짐**: P-7 | enemy.js 허수아비 기울이기 (그림 없을 때만) |
| `props/prop_sword_rack.png` | 소품 | 잘림 (props_prologue.png) | 로드됨 | **그려짐**: P-7 | 없음 |
| `props/sapling_burnt.png` | 소품 | 잘림 (prologue/F5323BD8-A0E4-4ECA-86B0-BF088FDDF4DF.png) | 로드됨 | **그려짐**: P-13 | placeholders.js 단색 네모 (그림 없을 때만) |
| `props/sapling_dead.png` | 소품 | 잘림 (prologue/F5323BD8-A0E4-4ECA-86B0-BF088FDDF4DF.png) | 로드됨 | **그려짐**: P-2 | placeholders.js 단색 네모 (그림 없을 때만) |
| `props/stall_burning.png` | 소품 | 잘림 (prologue/F5323BD8-A0E4-4ECA-86B0-BF088FDDF4DF.png) | 로드됨 | **그려짐**: P-10 | placeholders.js 단색 네모 (그림 없을 때만) |
| `props/steamer.png` | 소품 | 잘림 (prologue/F5323BD8-A0E4-4ECA-86B0-BF088FDDF4DF.png) | 로드됨 | **그려짐**: P-13, P-5 | placeholders.js 단색 네모 (그림 없을 때만) |
| `tree.png` | 벚나무 | 원본 그대로 · 2칸 | 로드됨 | **그려짐**: (맵), P-11, P-12, P-13, P-14, P-2, P-4, P-5, P-7, P-8, P-9, S1-1 | tree.js 도형 나무 (그림 없을 때만) |

## 로드는 되지만 화면에 안 쓰이는 그림

- `fx_parry_flash` — 코드·대본에서 씀 (시험에서 안 봄): skills.js, sprites.js
