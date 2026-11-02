# 프롤로그 그림 3차 대응표

`python3 tools/process_prologue3.py`

| 원래 파일 | 새 이름 | 판단 근거 |
|---|---|---|
| `CEC6ABFB-2AAE-4F8B-8D76-BE2C55A47C23.png` | `player_idle_nosword` | 칼 없이 서 있는 아카네 4칸 |
| `B0A8903B-2FB8-4179-8A4A-AFF493A8E49D.png` | `player_walk_nosword + player_run_nosword` | 칼 없는 아카네 걷기 6 + 달리기 6 |
| `731B05A5-0FCE-436C-8965-4224613BFA76.png` | `player_jump_nosword` | 칼 없는 아카네 점프 6칸 (웅크림 → 착지) |
| `F4C71650-BE62-48D5-9876-558426334AD7.png` | `haru_gesture` | 선 하루: 손 내밀어 머리 헝클기 4, 방울 들고 묶기 4 |
| `4E5F6F93-66EF-429D-AA51-A08888254E1A.png` | `hana_actions` | 하나: 가면 흔들기 4, 깔려 울기 2, 기어 나오기 4, 안겨 울기 2 |
| `402484DE-E596-479E-B159-4282D95D37AC.png` | `akane_gesture` | 무릎 꿇은 아카네: 팔 벌려 안기 3, 방울 풀어 천으로 감싸기 4, 품에 넣기 3 |
| `10B6081D-1681-4893-B8E3-C164F165FE44.png` | `props/ (소품 8)` | 편지 · 목검 · 꽃 한 송이 · 망치 / 하루의 칼 · 켜진 등롱 · 찢긴 등롱 · 줄 조각 |
| `4B813E01-0E0D-4F49-BC8C-396752B3DF32.png` | `cutin_traveler_hair` | 삿갓 아래로 흘러내린 흰 머리카락 클로즈업 (컷인) |

## 결과

- CEC6ABFB → player_idle_nosword: 4칸, 칸 40×85, 키 82~83, 도트 8.57
- 731B05A5 → player_jump_nosword: 6칸, 칸 66×75, 키 58~73, 도트 6.22
- F4C71650 → haru_gesture: 8칸, 칸 54×100, 키 97~98, 도트 5.56
- 4E5F6F93 → hana_actions: 12칸, 칸 38×46, 키 23~44, 도트 5.70
- 402484DE → akane_gesture: 10칸, 칸 44×52, 키 47~50, 도트 6.73
- B0A8903B → player_walk_nosword: 6칸, 칸 44×83, 키 80~81, 도트 4.22
- B0A8903B → player_run_nosword: 6칸, 칸 72×79, 키 72~77, 도트 4.22
- 10B6081D → props/: letter 34×21, bokken 55×12, blossom_single 34×32, hammer 46×27, haru_katana 58×20, lantern_lit 24×56, lantern_torn 52×25, rope_segment 56×26
- lantern_rope · lantern_rope_fallen (조립), prop_rooftop_cultist (enemy_sword 실루엣)
- 4B813E01 → cutin_traveler_hair 724×242
