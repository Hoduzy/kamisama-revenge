# 2D 횡스크롤 액션 (Phaser 3)

빌드 도구 없이 `index.html` + `js/` 파일만으로 동작합니다. Phaser 3.80.1은 `js/lib/phaser.min.js`에 포함되어 있어 외부 CDN이 필요 없습니다.

## 실행

- 로컬: 폴더에서 `python3 -m http.server` 후 http://localhost:8000 접속
- GitHub Pages: 저장소 Settings → Pages → Source를 `Deploy from a branch`, 브랜치/루트(`/`) 선택

## 조작

| 동작 | 키보드 | 터치 |
| --- | --- | --- |
| 이동 | A / D (←/→) | ◀ ▶ |
| 점프 | Space (W/↑) | JUMP |
| 공격 | J | ATK |
| 대시 | K (Shift) | DASH |
| 재시작 | R | 클리어/게임오버 후 JUMP·ATK |

- 점프: 코요테 타임 0.1초, 점프 버퍼 0.12초, 키를 일찍 떼면 낮게 뜀(가변 점프), 정점 체공, 하강 시 중력 증가
- 대시: 지상/공중 1회, 대시 중 몸통 무적, 지상 대시는 점프로 캔슬
- 공격: 공중에서 적을 맞히면 살짝 떠오름, 적을 위에서 밟으면 튕겨 오름

## 파일 구성

- `js/config.js` — 조작감 튜닝 값(가속, 점프, 대시 등)을 한 곳에 모음
- `js/touch.js` — 화면 버튼(멀티터치, 손가락 슬라이드 지원)
- `js/controls.js` — 키보드 + 터치 입력 통합
- `js/player.js` / `js/enemy.js` — 주인공, 적
- `js/level.js` — 땅·발판·적 배치 데이터
- `js/game-scene.js` — 충돌, 전투, 카메라, HUD
