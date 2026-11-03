# 연출 도구 (Cinematics) — 대본 명령 표

모든 장에서 쓰는 연출 도구입니다. 코드는 `js/cinematics.js`, 수치는 `js/config.js`의 `TUNING.cine`에 있습니다.

- 대본(`data/story/*.json`)의 장면 `commands`에 아래 명령을 넣으면 컷신 엔진(`js/story-player.js`)이 차례로 실행합니다. 엔진이 따로 처리하지 않는 명령은 모두 `cine.command()`로 넘어갑니다.
- 시간이 걸리는 명령(줌, 패닝, 틸트, 색감 전환, 컷인)은 끝날 때까지 다음 명령을 기다립니다. 기다리지 않게 하려면 `"wait": false`를 넣습니다.
- 장면을 건너뛰는 중(길게 누르기, Esc)에는 보여 주기만 하는 효과는 생략하고, 상태(색감, 줌 배율, 빛 켜기 등)만 반영합니다.
- **시험해 보기**: 일시정지 메뉴(ESC 또는 오른쪽 위 버튼) → `연출 시험` (F1 → `연출 시험`도 같음). 게임이 멈추지 않는 옆 창이라 걸어 다니면서 버튼을 눌러 볼 수 있습니다. 인물이 대본대로 움직이는 배우 명령은 이 문서 아래쪽 「배우(Actor) 시스템」 절에 있습니다.

위치를 받는 명령의 `to` / `at`은 다음 중 하나를 씁니다.
- `"player"` (주인공)
- NPC id (예: `"haru"`)
- `"boss"`
- 맵의 `points` 이름
- x 숫자
- `{ "x": …, "y": … }`

## 카메라

| 명령 | 매개변수 | 설명 |
| --- | --- | --- |
| *(늘 켜짐)* | `TUNING.cine.lookAhead` (0.15) | 룩어헤드: 움직이는 방향으로 화면 폭의 15% 앞을 비추고 부드럽게 따라갑니다. 멈춰도 마지막 방향을 유지합니다. |
| `lookAhead` | `on` (true/false) | 룩어헤드 켜기/끄기 |
| `camZoom` | `zoom` (배율), `ms`, `ease` (Phaser 이징 이름, 기본 `Sine.easeInOut`) | 줌 인/아웃. 원래대로는 `zoom: 1` |
| `camPan` | `to`, `ms` (900), `hold` (초, 0.8), `back` (true) | 목표로 패닝하고 `hold`초 머문 뒤 주인공에게 돌아옵니다. `back: false`면 그대로 둡니다. |
| `camFocus` | `x`(지점 · 배우), `offset`, `dy`(바닥에서 위로), `zoom` (1.4), `inSec` (0.6), `hold` (0.8), `outSec` (0.5) | 한 곳을 가운데로 확대해 들여다본 뒤 원래 자리 · 배율로 돌아옵니다 (P-3 편지). 방 밖은 보이지 않게 카메라 경계 안에서만. |
| `camTilt` | `y` (px, 음수 = 위를 더 보여줌), `ms` | 위아래 틸트 |
| `camReset` | `ms` | 줌 1배, 틸트 0, 다시 따라가기 |
| `shake` | `level`: `weak` / `mid` / `strong`, `dir`: `both` / `v` / `h` | 흔들림 3단계. 위에서 내리꽂는 충격은 `dir: "v"`로 세로만 흔듭니다. 예전 대본의 `strength: "strong"`도 받습니다. |
| `letterbox` | `on` | 위아래 검은 띠가 0.4초(`letterboxSec`) 동안 미끄러져 들어옵니다. 걸어 다니는 장면에서도 띠가 있는 동안은 조작이 잠깁니다. |

## 시간

| 명령 | 매개변수 | 설명 |
| --- | --- | --- |
| `hitStop` | `seconds` (기본 `hitStop` 0.08) | 지정한 초 동안 물리, 애니메이션, 트윈, 입자가 모두 멈춥니다. |
| `slowmo` | `scale` (0.3), `seconds` (1.2), `back` (0.4) | 슬로모션. 끝날 때 `back`초 동안 부드럽게 1배로 돌아옵니다. |

## 화면 효과 (셰이더 없이 색 오버레이, 레이어, 캔버스 필터)

| 명령 | 매개변수 | 설명 |
| --- | --- | --- |
| `flash` | `color`: `white` / `red` / `gold`, `ms` (260) | 플래시 |
| `vignette` | `amount` (0~1, 0 = 끔), `seconds` | 가장자리를 어둡게 합니다. HUD 글자 아래에 깔립니다. |
| `mood` | `to`: `dusk`(따뜻한 주황) / `night`(밤 남색) / `fire`(불타는 붉은색) / `none`, `seconds` (2) | 장면 색감을 컬러 오버레이로 서서히 바꿉니다. |
| `monoCut` | `frames` (1) | 흑백 고대비 컷. 강한 일격에 씁니다. |
| `desaturate` | `amount` (0 = 원래 색, 1 = 흑백), `seconds` | 화면 전체 탈색 (부상, 충격). 풀 때는 `amount: 0` |
| `cutIn` | `speaker` (인물 id), `face`, `hold` (0.9초) | 산나비식 컷인: 가운데 가로 띠가 0.3초 만에 열리고, 그 안에 초상화의 눈 부분만 크게 보인 뒤 닫힙니다. 눈 위치는 `CINE_EYES`에 있습니다. |
| `fadeOut` / `fadeIn` | `duration` | (컷신 엔진) 암전 / 명전 |
| `cg` / `cgEnd` | `no` 또는 `image`, `motion` | (컷신 엔진) 화면 가득 CG |

## 빛과 입자

| 명령 | 매개변수 | 설명 |
| --- | --- | --- |
| `lights` | `on`, `ambient` (`"#3a3a58"` 같은 색, 어두울수록 밤) | Phaser Light2D를 켜고 끕니다. 켜면 주변광이 낮아져 빛이 있는 곳만 밝습니다. WebGL에서만 동작합니다. |
| `light` | `preset`: `lantern`(등롱) / `brazier`(화로) / `torch`(횃불) / `fire`(불길), `x`, `y` 또는 `at`, `id` | 깜빡이는 점광원. 빛이 꺼져 있으면 자동으로 켭니다. |
| `lightOff` | `id` | 점광원 끄기 |
| `particles` | `preset`, `x`·`y` 또는 `at`, `dir` (바람 −1/1), `seconds`, `count`, `id` | 입자 프리셋 (아래 표) |
| `particlesStop` | `id` (없으면 모두) | 새 입자를 멈추고, 남은 입자는 자연스럽게 사라집니다. |
| `foreground` | `preset`: `lanterns`(등롱 줄) / `branch`(벚꽃 가지) / `pillar`(불타는 기둥), `x` | 캐릭터 앞을 지나가는 실루엣. 1.3배(`foregroundParallax`) 속도로 움직입니다. |
| `foregroundClear` | | 전경 지우기 |

| 입자 프리셋 | 모양 |
| --- | --- |
| `petals` | 벚꽃잎. 화면 위에서 `dir` 쪽 바람을 타고 떨어집니다. |
| `embers` | 불티. 위로 올라가며 사라집니다. |
| `smoke` | 연기 |
| `ash` | 재. 회색 꽃잎처럼 천천히 떨어집니다. |
| `straw` | 짚 (허수아비를 벨 때, 한 번 터짐) |
| `sparks` | 불꽃 (망치질, 한 번 터짐) |
| `steam` | 김 (담금질) |
| `dust` | 먼지 (한 번 터짐) |

## 길 안내 (말로 하지 않고 화면으로)

| 명령 | 매개변수 | 설명 |
| --- | --- | --- |
| `guideArrow` | `to` (없으면 끔) | 목적지가 있고 `guideIdle`(3초) 동안 안 움직이면 화면 끝에 픽셀 화살표가 맥박처럼 깜빡입니다. 도착하면 꺼집니다. |
| `guideWind` | `to` (없으면 끔), `kind`: `petals` / `embers` | 목적지 쪽으로 흘러가는 벚꽃잎·불티 바람. 지나치면 방향을 바꾸고, 도착하면 멈춥니다. |
| `objective` | `text` (없으면 지움) | 왼쪽 위 목표 자막 〈…〉. 새 목표는 위쪽 가운데에 크게 나왔다가 작아지며 구석으로 갑니다. |
| `actionHint` | `action`: `move` / `jump` / `attack` / `dash` / `skill1` / `skill2` (없으면 지움) | 해야 할 키를 머리 위에 붓 테두리로 띄웁니다. 그 행동을 하면 먹물처럼 번지며 사라집니다. 터치 조작이면 해당 버튼도 같이 빛납니다. |
| `exitGlow` | `to` / `x`, `on: false` (모두 끄기) | 땅에서 솟는 빛기둥과 올라가는 빛 알갱이. NPC가 가리키는 출구에 씁니다. |

## 소리

| 명령 | 매개변수 | 설명 |
| --- | --- | --- |
| `sfx` | `id`, `volume` (0~1), `pitch` (무작위 폭 ±, 0.05), `distant` | 효과음. `assets/sfx/<id>.ogg|mp3|wav`가 있으면 그 파일을, 없으면 ZzFX로 만든 임시 소리를 냅니다. 파일은 장 시작 로딩 때(그 장이 쓰는 id) 또는 처음 울릴 때 찾아봅니다. 대본의 `name`(소리 이름, `data/story/audio.json`)도 그대로 씁니다. |
| `bgm` | `id` (null = 멈춤), `fade` (초) | `assets/bgm/<id>.ogg|mp3`. 파일이 없으면 조용히 넘어갑니다. 대본의 `name`(audio.json)도 그대로 씁니다. |
| `bgmDuck` | `on`, `seconds` | 음악 볼륨을 `duckVolume`(35%)으로 낮춥니다. 대사 장면 동안에는 `duckDuringDialogue: true`로 자동으로 낮춥니다. |
| `silence` | | 모든 BGM을 즉시 끊습니다. |

| 효과음 id (ZzFX 임시) | 쓰임 |
| --- | --- |
| `slash` `hit` `heavy` `parry` `dash` `iaido` | 전투 |
| `hammer` `steam` `fire` `arrow` `bell` `drum` `boom` `wind` `heartbeat` | 장면 소리 |
| `step` `swish` | 발소리, 바람 가르는 소리 |
| `ui_click` `ui_confirm` | UI |

## 예

```json
{ "cmd": "letterbox", "on": true },
{ "cmd": "mood", "to": "fire", "seconds": 2 },
{ "cmd": "camPan", "to": "hakuya", "hold": 1.2 },
{ "cmd": "cutIn", "speaker": "hakuya", "face": "laugh" },
{ "cmd": "shake", "level": "strong", "dir": "v" },
{ "cmd": "hitStop", "seconds": 0.12 },
{ "cmd": "monoCut" },
{ "cmd": "sfx", "id": "heavy" },
{ "cmd": "objective", "text": "아빠에게" },
{ "cmd": "guideWind", "to": "smithyFront", "kind": "embers" }
```

## 수치 (TUNING.cine)

일시정지 메뉴 → `연출 시험`의 슬라이더로 흔들림 세기, 슬로모션 배율, 히트스톱 시간, 줌 배율을 바로 바꿔 볼 수 있습니다.

- **브라우저에 저장**: 이 브라우저에서만 `config.js` 값 위에 덮어씁니다. `되돌리기`로 지웁니다.
- **config.js 로 저장**: `config.js`에서 `// <cine>` ~ `// </cine>` 사이를 지금 값으로 바꾼 파일을 만듭니다.
  - 크롬·엣지: 파일 고르기 창에서 저장소의 `js/config.js`를 고르면 그 파일에 바로 씁니다.
  - 그 밖의 브라우저: 다운로드합니다. 받은 파일로 `js/config.js`를 바꾸면 됩니다.
  - 웹 페이지는 저장소 파일에 몰래 쓸 수 없어서 이렇게 합니다.

---

# 배우(Actor) 시스템 — 컷신에서 인물이 대본대로 움직인다

코드는 `js/actors.js`(배우·조사 지점·감정 아이콘)와 `js/story-player.js`(조작 모드·블록·자막), 수치는 `js/config.js` 의 `TUNING.actors` 에 있습니다.

- **시험해 보기**: 일시정지 메뉴 → `개발 메뉴` (또는 F1) → `배우 시험` 줄의 버튼.
  - `나란히 걸어와 마주 보고 앉기` (`ACTOR-1`, 자동 모드)
  - `조작 · 조사 · 자막 · 느린 조작` (`ACTOR-2`, 조작 → 느린 조작 → 자동)
  - 시험 장면은 `data/story/test.json` 에 있고, 프롤로그 맵(연습장)에서 돌아갑니다. 프롤로그 대본에는 아직 쓰지 않았습니다.
- **배우 이름**: `akane`(= `아카네`, `player`) 또는 맵 인물 id(`haru`, `soichiro` …)나 한글 이름(`characters.json`). 맵에 없는 인물은 `spawn` 으로 세웁니다.
- **위치**: 숫자(x) · 맵 `points` 이름 · 배우 이름(+ `offset`) · `{ "x": … }`.
- **속도**: `walk`(110) · `run`(260) · `slow`(60) · 숫자(px/초).

## 조작 모드

장면에 `"mode"` 를 정하거나, 장면 도중 `mode` 명령으로 바꿉니다. `mode` 를 쓰는 장면은 auto 일 때 레터박스가 자동으로 들어오고, play·slow 로 바뀌면 나갑니다.

| 모드 | 플레이어 | 대사 | 레터박스 |
| --- | --- | --- | --- |
| `auto` | 입력 막힘, 대사 넘기기만. 아카네도 배우 명령대로 움직임 | Space·J·탭으로 넘김 | 들어옴 |
| `play` | 보통 조작 | 화면에 흘러가며 자동으로 넘어감 (= 조작 가능 컷신) | 나감 |
| `slow` | 걷기만, 이동 60%(`TUNING.actors.slowMode`). 점프·공격·대시·스킬 막힘, 그 버튼과 스킬 칸은 회색 | 자동으로 넘어감 | 나감 |

| 명령 | 매개변수 | 설명 |
| --- | --- | --- |
| `mode` | `mode`: auto / play / slow, `letterbox` (false 면 레터박스는 그대로) | 조작 모드 바꾸기 |

## 배우 명령

| 명령 | 매개변수 | 설명 |
| --- | --- | --- |
| `moveTo` | `actor`, `x` 또는 `to`, `offset`, `near`(true = 대상 배우 바로 앞 50px 에서 멈춤), `speed`, `wait`(기본 true) | 걸어서(달려서) 이동. `wait: false` 면 도착을 기다리지 않고 다음 명령으로 |
| `face` | `actor`, `dir`: left / right / 배우 이름 | 바라보기 |
| `anim` | `actor`, `anim`(애니메이션 이름, 인물 접두사 생략 가능: `forge` → `soichiro_forge`), `loop` | 애니메이션 재생 |
| `stopAnim` | `actor` | 서 있는 그림으로 |
| `jump` | `actor`, `x` | 포물선으로 x 까지 뛰기 (`jumpHeight`, `jumpMs`) |
| `sit` / `kneel` / `standUp` | `actor` | 앉기 / 무릎 꿇기 / 일어서기. 그림이 없으면 비슷한 그림으로 대신함 (아래) |
| `pose` | `actor`, `pose` (idle · sit · kneel · down …) | 자세 직접 |
| `emote` | `actor`, `kind`: `!` `?` `…` `sweat` `heart` `note`, `seconds` | 머리 위 픽셀 아이콘 (말풍선, 2배). 튀어나오는 0.35초만 기다림 |
| `appear` / `disappear` | `actor`, `fade`(초, false = 바로) | 나타나기 / 사라지기 |
| `spawn` | `actor`, `at`, `face`, `look`, `sheet`, `fade` | 그 자리에 세우기 (맵에 없으면 새로 만듦. 그림이 없으면 실루엣) |
| `camFollow` | `actor` | 카메라가 그 배우를 따라감 (`akane` 이면 원래대로) |
| `camPan` | `x`(또는 배우), `seconds`, `back`(기본 false) | 카메라를 x 로 옮겨 머묾. 장면이 끝나면 아카네에게 돌아옴 |
| `camZoom` | `zoom`, `seconds` | 줌 |
| `parallel` | `commands`: [...] | 안의 명령을 동시에 시작하고 모두 끝나면 다음으로 (여러 배우를 함께 걷게) |
| `sequence` | `commands`: [...] | 하나 끝나면 다음 (parallel 안에서 순서가 필요할 때) |
| `wait` | `seconds` | 기다리기 |
| `waitForPlayerAt` | `x` 또는 `to`, `radius`(40), `dir`(1 = 오른쪽으로 닿거나 지나가면, -1 왼쪽, 0 반경 안), `guide`(기본 true = 길 안내 화살표) | play·slow 에서 플레이어가 그 자리에 오면 다음으로. auto 면 아카네가 걸어감 |

```json
{ "cmd": "parallel", "commands": [
  { "cmd": "moveTo", "actor": "akane", "x": 1840 },
  { "cmd": "moveTo", "actor": "haru", "x": 1920 } ] },
{ "cmd": "face", "actor": "haru", "dir": "akane" },
{ "cmd": "emote", "actor": "haru", "kind": "note" },
{ "cmd": "sit", "actor": "haru" }
```

**그림이 없는 자세** (그림이 생기면 `js/actors.js` 의 `ACTOR_POSES`, `js/npc.js` 의 `NPC_POSES` 에 넣으면 됨)

| 인물 | 앉기 | 무릎 | 걷기 |
| --- | --- | --- | --- |
| 아카네 | 임시: 발도 준비(웅크림) 첫 칸 | 임시: 같은 시트 마지막 칸 | `player_run` 을 속도에 맞춰 느리게 |
| 하루 | `haru_reach` 첫 칸 (앉은 그림) | `haru_death` 4번째 칸 | 걷는 그림 없음 → 서 있는 그림이 2px 씩 통통 |
| 소이치로 | `soichiro_kneel` 4번째 칸 | `soichiro_kneel` | 걷는 그림 없음 |
| 그 밖 | 서 있는 그림을 세로 75% 로 (임시) | 85% | — |

## 조사 지점 (대본의 〔조사〕)

| 명령 | 매개변수 | 설명 |
| --- | --- | --- |
| `inspect` | `id`, `at`, `radius`(60), `lines`: [{ `speaker`, `text` }] 또는 `text`, `group`, `once`, `recall`: [{ `text` }], `recallColor` | 다가가면 아카네 머리 위에 `…` 와 `E` 키(터치는 `조사` 버튼). 누르면 속마음이 말풍선으로 짧게 (게임은 멈추지 않음). `recall` 이 있으면 그 자리에서 회상 자막도 |
| `inspectClear` | `id` (없으면 모두) | 조사 지점 지우기 |

- 조사한 것은 `registry.inspected` 에 `{ id: group }` 으로 남습니다 (개발 메뉴의 `본 장면·플래그 지우기` 로 지움).
- 조건(`condition` 의 `when`): `inspected`(id 또는 목록, 모두 조사했으면), `notInspected`, `inspectedAtLeast` / `inspectedLessThan`(개수, `group` 이 있으면 그 묶음만).

```json
{ "cmd": "condition", "when": { "inspectedAtLeast": 3, "group": "P-13" }, "then": [ … ] }
```

## 대사 연출

| 명령 | 매개변수 | 설명 |
| --- | --- | --- |
| `hum` | `text` 또는 `lines`, `speaker`, `seconds`, `gap`, `color`, `wait` | 흥얼거림 자막: 화면 아래 작게 흐르는 분홍 글 (대화창 없이). `lines` 면 한 줄씩 이어서 |
| `overwrite` | `text`(바탕 글), `over`(덮는 글), `color`, `overColor`, `hold`(초), `keep` | 덮어쓰기 자막: 화면 위쪽에 반투명 글이 떠오르고, 다른 색 글이 왼쪽부터 그 위를 덮어 씀 |
| `recall` | `lines`: [{ `speaker`, `text` }] 또는 `text`, `at`, `color`, `wait` | 회상 자막: 그 자리에 과거 대사가 반투명하게 떠올랐다가 글자마다 빗물처럼 흘러내림 |

## 건너뛰기

- 화면(또는 Space·J)을 길게 누르거나 **Esc 를 1초** 누르면 장면 전체를 건너뜁니다 (`TUNING.story.holdToSkip`).
- 건너뛰어도 결과는 모두 남습니다: 걷던 배우는 도착한 자리로, 사라지던 배우는 사라진 채로, 앉기·무릎·그림 바꿈, `spawn`, 아이템(`giveItem`), 플래그, 조사 지점, `waitForPlayerAt` 의 위치 이동.

## 대본 표기 → 명령 (tools/convert_story.py, tools/actor_verbs.py)

| 대본 | 변환 |
| --- | --- |
| 머리말 끝 `〔자동〕` `〔조작〕` `〔느린 조작〕` `〔조작 가능 컷신〕` `〔자동 → 조작〕` | 장면 `mode`(첫 모드), `modeFlow`, `controllable` |
| `▶ 〔자동〕 …` (연출 줄 맨 앞) | `mode` 명령 |
| `〔조사〕 대상: 인물 (속마음) "…"` | `inspect` (위치는 비어 있음 → 맵에 넣을 때 `at` 채움) |
| `〔조사〕 대상: 설명. 떠오르는 대사 — "…"` | `inspect` + `recall` |
| `▶ (P-13 조사 개수에 따라 …)` 다음 `- 인물 (속마음): "…"` 줄들 | n 번째 줄 = `inspectedAtLeast: n` 조건 |
| `### 하루의 자장가` 의 〈가사 / 가사〉 + 연출 문장의 '자장가' | `hum` (`한 소절` 이면 첫 줄만, '가사'가 없으면 기다리지 않음) |
| '화면 위쪽 … 반투명' 다음 〈자막〉, '덮어쓰' 다음 대사 | `overwrite` (바탕 글 = 그 자막, 덮는 글 = 그 대사) |
| 주어(인물 이름+이/가) + 걸어간다·달려온다·다가온다 | `moveTo` (대상 인물이 있으면 `near`, 없으면 '다가온다'는 아카네에게, 그 밖엔 위치 필요) |
| 앉는다·쪼그려 앉아 / 무릎을 꿇는다 / 일어선다 | `sit` / `kneel` / `standUp` |
| 사라진다 / 나타난다·들어온다 | `disappear` / `appear` |
| X를 본다·돌아본다·마주 본다 | `face` |
| 놀라 / 갸웃 / 머뭇·말없이 / 땀 / 흥얼 | `emote` ! / ? / … / sweat / note |

- '아카네가 다가가면 …' 처럼 조건(…면)이 붙은 문장은 바꾸지 않습니다 (플레이어 행동).
- 시험 변환: `python3 tools/convert_story.py --dry-run --report 보고서.md` — `data/story` 는 그대로 두고, 장면별 모드·바꾼 연출 문장·위치가 필요한 것·남은 note 를 보고서로 씁니다.

## 프롤로그용으로 더한 명령 (새 프롤로그 P-0 ~ P-14)

새 프롤로그의 ▶ 연출은 `tools/prologue_directions.py` 표에서 줄마다 명령으로 옮깁니다. 대본을 변환할 때 표에 없는 ▶ 줄이 있으면 목록으로 경고합니다. 그림이 없는 배경·소품·인물·동작의 이름 목록은 `docs/prologue-assets.md` 에 있습니다.

| 명령 | 매개변수 | 설명 |
| --- | --- | --- |
| `prop` | `id`, `key`(그림 이름), `at`/`x`, `y`·`dy`, `w`·`h`·`color`(임시 그림), `depth`, `angle`, `scale`, `fade`, `screen`: {x, y}(화면 고정), `label` | 소품 놓기. manifest 에 그림이 없으면 단색 네모 + 이름표 |
| `propOff` | `id`, `fade` | 소품 치우기 |
| `propMove` | `id`, `x`/`to`, `y`·`dy`·`ground`, `angle`, `seconds`, `ease` | 소품 옮기기 (떨어지는 삿갓, 쓰러지는 기둥) |
| `propTint` | `id`, `color`, `alpha`, `seconds` | 소품 색 바꾸기 (꽃이 재가 됨, 꽃잎이 시듦) |
| `propShine` | `id`, `seconds` (0.7), `band` (폭 비율 0.12), `alpha` | 빛이 소품 위를 왼쪽 → 오른쪽으로 한 번 훑고 지나감 (칼 획득: 칼날). 화면 고정 소품(`screen`)은 카메라 줌을 받지 않는다 |
| `talkStop` | `on` (true) | 이 장면의 말풍선 대화 동안 아카네를 멈춰 세운다: 말하는 사람 왼쪽 70px 에 서서 그 사람을 보고, 걷던 인물도 멈춰 아카네를 본다. 대사가 끝나면 다시 조작 (P-5 마을) |
| `act` | `actor`, `name`, `anim`, `loop`, `seconds`, `wait` | 동작. 애니메이션이 있으면 재생, 없으면 머리 위에 `(동작 이름)` |
| `emoteHold` | `actor`, `kind`, `on` | 머리 위 아이콘을 계속 (심부름 중 바구니). 아이콘 종류에 `palm`(손바닥), `basket`(바구니) 추가 |
| `tremble` | `actor`, `times` | 그림을 2px 씩 떨기 (손이 떨림) |
| `stageBg` | `id`(구역), `key`, `tint` | 구역 배경 바꾸기 (P-14 잿더미 광장) |
| `ambience` | `id`(효과음), `every`(초), `volume` / `id: null`(모두 멈춤) | 반복 환경음: 빗소리 `rain`, 불 `fire`, 북 `drum`, 피리 `pipe`, 망치 `hammer`, 방울 `chime` |
| `mood` | `to`: … `morning`(아침) · `duskDeep`(짙은 해 질 녘) · `ash`(잿빛 비) · `cave`(동굴) 추가 | |
| `particles` | `preset`: … `rain`(비) 추가 | |
| `cutIn` | … `image`(manifest 그림), `label` | 초상화가 없는 컷인 (그림이 없으면 띠에 이름표) |

| gameplay `do` | 설명 |
| --- | --- |
| `tutorialIcon` (`step`: move · jump · dashSlash · iaido · parry, `failLine`, `zoomOnThird`) | 글자 없이 머리 위 행동 아이콘만 쓰는 튜토리얼 (P-7) |
| `arrowVolley` / `arrowRain` | 달 앞을 지나는 불화살 실루엣 / 화살이 땅·지붕·나무에 꽂힘 (P-9) |
| `arrowTraps` (`every`, `on`) | 바닥에 붉은 원이 깜빡인 뒤 불화살이 꽂힘, 맞으면 피해 (P-10) |
| `cutPillar` (`prop`) | 기둥 위에 베기 아이콘, 베면 기둥이 부서짐 (P-10 하나 구출) |
| `collapse` (`at`) | 잔해가 쏟아지며 흔들림 강 (만두 가게 · 대장간 지붕) |
| `freezeDancers` / `fleeTag` (`tag`) | 춤추던 사람들이 멈춤 / 표시 붙은 사람들이 도망 |
| `bossLook` (`color: 'black'`, `show`, `x`, `face`) · `bossWalk` (`to`) | 하쿠야 실루엣 · 걸어 나오기 |
| `revive` (`at`) | 하쿠야의 발도로 쓰러진 아카네를 다시 일으킴 (P-12) |
| `fight` 에 `firstKillSlowmo`(초) 추가 | 처음 벨 때만 슬로모션 + 줌인 (P-10) |

- 붉은 방울(`giveItem` 이름 `붉은 방울`)을 받으면 점프할 때마다 아주 작게 방울 소리가 납니다. `setFlag bellWrapped` (P-14 천으로 감쌈) 뒤에는 소리가 나지 않습니다.
