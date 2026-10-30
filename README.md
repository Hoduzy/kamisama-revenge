# 2D 횡스크롤 액션 (Phaser 3)

빌드 도구 없이 `index.html` + `js/` 파일만으로 동작합니다. Phaser 3.80.1은 `js/lib/phaser.min.js`에 포함되어 있어 외부 CDN이 필요 없습니다.

## 실행

- 로컬: 폴더에서 `python3 -m http.server` 후 http://localhost:8000 접속 (`index.html`을 파일로 직접 열면 `data/story/*.json`을 못 읽어 대화 없이 시작됨)
- GitHub Pages: 저장소 Settings → Pages → Source를 `Deploy from a branch`, 브랜치/루트(`/`) 선택

## 조작

| 동작 | 키보드 | 터치 |
| --- | --- | --- |
| 이동 | A / D (←/→) | ◀ ▶ |
| 점프 | Space (W/↑) | JUMP |
| 공격 | J | ATK |
| 대시 | K (Shift) | DASH |
| 스킬1 대쉬베기 | U | 베기 |
| 스킬2 발도 | I | 발도 |
| 재시작 | R | 클리어 후 JUMP·ATK |

- 점프: 코요테 타임 0.1초, 점프 버퍼 0.12초, 키를 일찍 떼면 낮게 뜀(가변 점프), 정점 체공, 하강 시 중력 증가
- 대시: 지상/공중 1회, 대시 중 몸통 무적, 지상 대시는 점프로 캔슬
- 공격: 공중에서 적을 맞히면 살짝 떠오름, 적을 위에서 밟으면 튕겨 오름

## 스킬

- **대쉬베기 (U)**: 바라보는 방향으로 짧게 대쉬하며 지나가는 적을 벤다. 대쉬 중 무적. 적을 맞힐 때마다 벚꽃 스택 +1 (최대 5).
- **발도 (I)**: 1초 준비 후 앞으로 강하게 벤다.
  - 준비 0~0.5초: 패링. 부딪힌 적이 대신 피해를 받는다 (분홍 테두리 표시).
  - 준비 0.5~1초: 맞으면 스킬이 끊기고 쿨타임 시작. 체력은 1 밑으로 내려가지 않는다.
  - 피해 = 기본 피해 + 벚꽃 스택 × 스택당 피해. 스택을 모두 소모하고 꽃잎이 터진다.
- 화면 하단에 스킬 쿨타임과 벚꽃 스택 5칸이 표시된다.
- 쿨타임·피해량·대쉬 거리 등 수치는 `js/config.js`의 `dashSlash`, `iaido`, `sakuraMax`에서, 적 수치는 `swordsman`, `thrower`, `shuriken`에서 수정.

## 규칙

- 체력은 1칸. 적의 검이나 수리검에 맞으면 즉시 죽고, 마지막으로 만개시킨 **벚꽃나무**에서 바로 부활한다.
- 벚꽃나무에 가까이 가면 꽃잎이 터지며 만개하고 부활 지점이 된다.
- 적과 몸이 부딪히는 것만으로는 죽지 않는다. 위에서 밟으면 피해를 준다.
- 대시(K)와 대쉬베기(U) 중에는 공격을 맞지 않는다.

## 적

- **근접 검사**: 쫓아와서 0.4초 동안 빨간 예고 영역과 `!`를 띄운 뒤 벤다. 예고 중에 때리면 공격이 끊긴다.
- **원거리 투척병**: 플레이어를 향해 수리검을 던진다. 가까이 가면 뒤로 물러난다.
  - 수리검은 기본 공격(J)으로 쳐낼 수 있고, 발도 패링 구간에 맞으면 던진 적에게 되돌아간다.
- **교주 아마테루 (보스, 임시)**: 근접 검사 AI를 크게 키우고 수리검 3개를 부채꼴로 던진다. 맞아도 공격이 끊기지 않는다. 수치는 `config.js`의 `boss`.

## 스토리

에도 막부 시대. 적안 흑발 고양이귀 소녀 **아카네**가 부모를 잃고, 그 원인인 사이비 사무라이 집단 **카미사마**에게 복수하러 간다.

### 대본 데이터 (`data/story/`)

- 대본 원고(`docs/*.md`)를 `python3 tools/convert_story.py`로 변환한 JSON. 장마다 한 파일: `prologue`, `ch1`~`ch6`, `epilogue`, `memories`, 인물은 `characters.json`. 변환 결과 요약은 `_report.md`.
- 장면 = `{ id, place, trigger, controllable, commands }`. 명령: `say`(대사) `think`(속마음) `voice`(목소리) `caption`(붓 자막) `fadeOut/fadeIn` `letterbox` `shake` `flash` `slowmo` `bgm` `sfx` `cg` `titleCard` `bossName` `giveItem` `wait` `cameraPan` `condition` `choice` `setFlag` `include` `note`(연출 메모).
- 풀(pools): 체크포인트 한마디. 타누키치는 50%(스테이지 첫 체크포인트는 확정), 장 안에서 다 쓸 때까지 반복 없음, 하루 목소리가 나오면 생략, 3초 말풍선. 하루 목소리는 10%(6장은 확정).

### 컷신 엔진 StoryPlayer (`js/story-player.js`)

- **트리거 ↔ 장면 id**는 맵 데이터 `js/level.js`의 `story` 표에 장별로 적는다:
  - `start` 장 시작 때, `triggers` 주인공이 x를 넘을 때(`stage`, `then: 'wakeBoss' | 'clear'`)
  - `trees` n번째 벚꽃나무가 필 때(장면이 없으면 타누키치 한마디)
  - `boss.hp` 보스 체력 비율, `boss.after` 보스 처치 후
  - `events` 아직 게임에 없는 사건용 (`scene.storyEvent('이름')`)
  - 엔딩은 6장 선택(`choice:S6-10`)에 따라 갈린다.
- **조작:**
  - 보통 장면·레터박스 장면은 조작 잠금(게임 멈춤).
  - 조작 가능 컷신(`controllable`)은 걸으면서 대사가 자동으로 흘러간다.
  - 넘기기: Space·J·Enter·화면 탭.
  - **길게 누르면(0.8초) 장면 전체 건너뛰기** (화면 위에 게이지). Esc도 건너뛰기. 선택지는 꼭 골라야 한다.
- **CG:** `assets/cg/cg번호.png`를 화면 가득 띄운다. 없으면 검은 화면에 "CG 번호 + 대본의 설명". 다음 대사는 CG 위에 나온다.
- **초상화:** 도트 초상화(`sprite`)나 그림(`image`)이 없는 인물은 실루엣 + 이름 첫 글자 (`js/portraits.js`).
- **소리:** `data/story/audio.json`에 대본의 BGM·효과음 이름 → 파일 경로를 적는다. 비어 있거나 파일이 없으면 조용히 넘어간다. 변환기를 다시 돌려도 적어 둔 경로는 남는다.
- **연출 메모(note):** 아직 게임으로 옮기지 못한 연출은 개발 모드에서만 왼쪽 위 구석에 작게 보인다.
- **저장:** 플래그·선택·재생 기록·아이템은 registry(`storyFlags`, `storyPlayed`, `items`)에 있다.
- **설정:** 글자 속도는 `config.js`의 `dialogue`, 자동 넘김·길게 누르기·음량은 `story`.

### 개발 메뉴 (F1)

- 아무 장면 id나 바로 재생한다. 검색은 id·장소·대사로 하고, ↑↓·Enter 또는 클릭으로 고른다. 장면이 속한 장으로 다시 시작한다.
- 개발 모드 켜고 끄기 (연출 메모·소리 이름 표시). 주소에 `?dev=1`을 붙여도 켜지고, 브라우저가 기억한다.
- 기억 조각 개수 설정, 본 장면·플래그 지우기.

### 테스트용 주소

- `index.html?scene=TEST` — 모든 연출 명령 시연 (`data/story/test.json`)
- `index.html?scene=S0-7` — 장면 하나만 재생
- `index.html?chapter=ch3` — 그 장으로 시작 (기본 ch1, `epilogue`도 가능)
- `index.html?scene=E-5&memories=18` — 기억 조각 개수 조건 시험

## 그림 (스프라이트)

- 원본: `assets/raw/` → `python3 tools/process_sprites.py` → `assets/sprites/` (시트 PNG + `manifest.json` + `preview.html`)
- 게임은 시작할 때 `manifest.json`을 읽어 시트·배경·타일을 불러온다 (`js/sprites.js`, `js/boot-scene.js`). 그림을 못 읽으면 예전 도형으로 그린다.
- 판정은 그림과 별개인 몸통 사각형 (주인공 28×60). H 키로 판정 표시.
- 배경: bg_far(밤하늘·달, 0.05배 스크롤, 3배 확대) → bg_mid(마을, 0.3) → bg_near(난간, 0.6). 앞쪽일수록 어둡게 틴트.

## 파일 구성

- `js/config.js` — 조작감 튜닝 값(가속, 점프, 대시 등)을 한 곳에 모음
- `js/touch.js` — 화면 버튼(멀티터치, 손가락 슬라이드 지원)
- `js/controls.js` — 키보드 + 터치 입력 통합
- `js/skills.js` — 대쉬베기, 발도, 벚꽃 스택
- `js/tree.js` — 벚꽃나무(체크포인트)
- `data/story/` — 대본 JSON (`tools/convert_story.py`로 생성)
- `js/story-player.js` — 컷신 엔진 StoryPlayer (장면 재생, 길게 눌러 건너뛰기, 소리, 풀, 플래그)
- `js/dev-menu.js` — F1 개발 메뉴, 개발 모드
- `js/dialogue.js` / `js/portraits.js` / `js/boot-scene.js` — 대화창, 초상화 그리기, 대본·스프라이트 로딩
- `js/ui.js` — HTML 글자 레이어 + 컷신 연출(페이드, 레터박스, 자막, CG, 선택지, 말풍선)
- `js/sprites.js` — 스프라이트 애니메이션·이펙트 도우미
- `tools/process_sprites.py` — 원본 도트 이미지 전처리
- `js/player.js` / `js/enemy.js` — 주인공, 적
- `js/level.js` — 땅·발판·적 배치, 스토리 트리거 ↔ 장면 id 표
- `js/game-scene.js` — 충돌, 전투, 카메라, HUD
