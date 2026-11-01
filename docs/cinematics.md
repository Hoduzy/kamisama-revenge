# 연출 도구 (Cinematics) — 대본 명령 표

모든 장에서 쓰는 연출 도구입니다. 코드는 `js/cinematics.js`, 수치는 `js/config.js`의 `TUNING.cine`에 있습니다.

- 대본(`data/story/*.json`)의 장면 `commands`에 아래 명령을 넣으면 컷신 엔진(`js/story-player.js`)이 차례로 실행합니다. 엔진이 따로 처리하지 않는 명령은 모두 `cine.command()`로 넘어갑니다.
- 시간이 걸리는 명령(줌, 패닝, 틸트, 색감 전환, 컷인)은 끝날 때까지 다음 명령을 기다립니다. 기다리지 않게 하려면 `"wait": false`를 넣습니다.
- 장면을 건너뛰는 중(길게 누르기, Esc)에는 보여 주기만 하는 효과는 생략하고, 상태(색감, 줌 배율, 빛 켜기 등)만 반영합니다.
- **시험해 보기**: F1 → `🎬 연출 시험`. 게임이 멈추지 않는 옆 창이라 걸어 다니면서 버튼을 눌러 볼 수 있습니다.

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
| `guideArrow` | `to` (없으면 끔) | 목적지가 있고 `guideIdle`(3초) 동안 안 움직이면 화면 끝에 붓 화살표 `▶`가 맥박처럼 깜빡입니다. 도착하면 꺼집니다. |
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

F1 → `🎬 연출 시험`의 슬라이더로 흔들림 세기, 슬로모션 배율, 히트스톱 시간, 줌 배율을 바로 바꿔 볼 수 있습니다.

- **브라우저에 저장**: 이 브라우저에서만 `config.js` 값 위에 덮어씁니다. `되돌리기`로 지웁니다.
- **config.js 로 저장**: `config.js`에서 `// <cine>` ~ `// </cine>` 사이를 지금 값으로 바꾼 파일을 만듭니다.
  - 크롬·엣지: 파일 고르기 창에서 저장소의 `js/config.js`를 고르면 그 파일에 바로 씁니다.
  - 그 밖의 브라우저: 다운로드합니다. 받은 파일로 `js/config.js`를 바꾸면 됩니다.
  - 웹 페이지는 저장소 파일에 몰래 쓸 수 없어서 이렇게 합니다.
