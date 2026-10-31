#!/usr/bin/env python3
"""docs/ 의 스토리 대본(마크다운)을 게임 데이터(data/story/*.json)로 바꾼다.

    python3 tools/convert_story.py            # 변환 + data/story/_report.md
    python3 tools/convert_story.py --src 다른대본.md

대본 표기법(대본 맨 위 '표기법' 섹션):
  ### S번호 · 장소 · 트리거       장면 머리말
  ▶ 연출                         → 표준 연출 명령으로 바꿀 수 있는 문장은 바꾸고, 못 바꾸면 note
  인물 (표정): "대사"             → say   (표정 자리에 '속마음' → think, '목소리' → voice)
  〈자막〉                        → caption
  - "…" / - 인물 (표정): "…"      → (체크포인트 한마디 등) 랜덤 풀

명령마다 연출에서 나온 것은 원문 문장을 src 로 남긴다.
"""
import argparse
import json
import re
from collections import Counter, OrderedDict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'data/story'

# ───────── 인물 ─────────
# 한글 이름 → id. side: 기본 위치(아카네는 항상 왼쪽, 나머지는 화자가 바뀔 때 자동 배정)
CHARACTERS = OrderedDict([
    ('아카네', 'akane'), ('하루', 'haru'), ('소이치로', 'soichiro'), ('타누키치', 'tanukichi'),
    ('하쿠야', 'hakuya'), ('어린 하쿠야', 'hakuya_young'), ('어린 하루', 'haru_young'),
    ('곤조', 'gonzo'), ('아오이', 'aoi'), ('카에데', 'kaede'), ('츠구미', 'tsugumi'),
    ('츠바키', 'tsubaki'), ('겐카이', 'genkai'), ('오카무라', 'okamura'),
    ('가면 신도', 'cultist'), ('가면 닌자', 'ninja'), ('신도 간부 A', 'cult_exec_a'), ('신도 간부 B', 'cult_exec_b'),
    ('승병', 'warrior_monk'), ('화승총병 A', 'gunner_a'), ('화승총병 B', 'gunner_b'),
    ('마을 아이', 'village_child'), ('마을 사람', 'villager'), ('마을 할머니', 'village_grandma'),
    ('마을 어른', 'village_elder'), ('쌀가게 노인', 'rice_seller'), ('하녀', 'maid'),
])
FACES = {'기본': 'neutral', '웃음': 'smile', '분노': 'angry', '슬픔': 'sad', '놀람': 'surprised',
         '겁먹음': 'scared', '진지': 'serious'}
VOICE_STYLE = {'haru': 'pink', 'hakuya': 'goldTremble'}  # 하루 = 분홍 글자, 하쿠야 = 금색 떨리는 글자

# 대화창에서 쓸 초상화·이름 색. 아카네는 도트 초상화 시트(표정 3종: 기본·분노·슬픔)라
# 다른 표정은 가까운 것으로 대신한다. 나머지는 그림이 생길 때까지 실루엣 + 이름 첫 글자(js/portraits.js, style = 머리 모양).
P = lambda style, **kw: {'style': style, **kw}
PORTRAITS = {
    'akane': {'color': '#ff6b7a', 'sprite': {'key': 'portraits', 'faces': {
        'neutral': 0, 'smile': 0, 'serious': 0, 'surprised': 0, 'angry': 1, 'sad': 2, 'scared': 2}}},
    'haru': {'color': '#ffb7c5', 'portrait': P('bun', hair='#1c1416', eyes='#d62828', skin='#f2dccb', clothes='#7a2a3e', bg='#33262c')},
    'haru_young': {'color': '#ffb7c5', 'portrait': P('bun', hair='#1c1416', eyes='#d62828', skin='#f6e2d2', clothes='#b05a78', bg='#3a2a32')},
    'soichiro': {'color': '#c9a66b', 'portrait': P('topknot', hair='#2b2b2b', eyes='#1a1a1a', skin='#e2c2a2', clothes='#3d4a5c', bg='#2a2a30')},
    'tanukichi': {'color': '#d9a35b', 'portrait': P('catgirl', hair='#6b4a2b', eyes='#3a2a1a', skin='#f0d4b8', clothes='#5b6b3a', bg='#2e2a20')},
    'hakuya': {'color': '#ffd166', 'portrait': P('godmask', hair='#efefef', skin='#fafafa', clothes='#e8e2d0', bg='#2a2410')},
    'hakuya_young': {'color': '#ffd166', 'portrait': P('topknot', hair='#d8d8d8', eyes='#1a1a1a', skin='#f0dcc8', clothes='#6b6b60', bg='#2a2a26')},
    'genkai': {'color': '#b8b8a0', 'portrait': P('monk', skin='#d8b494', clothes='#5a5a50', bg='#2b2b26')},
    'warrior_monk': {'color': '#b8b8a0', 'portrait': P('monk', skin='#c9a585', clothes='#4a4a42', bg='#26261f')},
    'okamura': {'color': '#9fb4d6', 'portrait': P('topknot', hair='#555555', eyes='#111111', skin='#dcc0a2', clothes='#2b3550', bg='#1f2433')},
    'gonzo': {'color': '#ff6b6b', 'portrait': P('masked', armor='#6b1b1b', skin='#8a2a2a', clothes='#3a1010', bg='#241414')},
    'tsubaki': {'color': '#ff8fb1', 'portrait': P('bun', hair='#151015', eyes='#1a1a1a', skin='#f8e8e0', clothes='#a51d2d', bg='#2c1820')},
    'aoi': {'color': '#8fc1e3', 'portrait': P('bun', hair='#202830', eyes='#1a1a1a', skin='#efd8c4', clothes='#2f4f5f', bg='#1e2a30')},
    'kaede': {'color': '#e3a88f', 'portrait': P('bun', hair='#302020', eyes='#1a1a1a', skin='#efd8c4', clothes='#6b3a2a', bg='#30221e')},
    'tsugumi': {'color': '#f5d08a', 'portrait': P('bun', hair='#3a2a20', eyes='#1a1a1a', skin='#f6e2d2', clothes='#c08a4a', bg='#33291e')},
}
for _id in ('cultist', 'ninja', 'cult_exec_a', 'cult_exec_b', 'gunner_a', 'gunner_b'):
    PORTRAITS[_id] = {'color': '#ff4d4d', 'portrait': P('masked', armor='#d8d4cc', skin='#f2efe8', clothes='#a31b1b', bg='#241414')}
for _id, st in (('village_child', 'bun'), ('villager', 'topknot'), ('village_grandma', 'bun'), ('village_elder', 'topknot'),
                ('rice_seller', 'topknot'), ('maid', 'bun')):
    PORTRAITS[_id] = {'color': '#e8e0d0', 'portrait': P(st, hair='#4a3a30', eyes='#1a1a1a', skin='#e6c8aa', clothes='#5a5048', bg='#2a2622')}
# 마을 사람 도트 초상화 (portraits_village: 0 아이 웃음, 1 아이 울음, 2 남자 웃음, 3 남자 놀람)
PORTRAITS['village_child']['sprite'] = {'key': 'portraits_village', 'faces': {'neutral': 0, 'smile': 0, 'surprised': 0, 'sad': 1, 'scared': 1, 'angry': 1, 'serious': 0}}
# 가족·하쿠야 도트 초상화 (tools/process_prologue.py). 표정 → 칸
PORTRAITS['haru']['sprite'] = {'key': 'portraits_haru', 'faces': {
    'neutral': 0, 'smile': 0, 'serious': 0, 'surprised': 1, 'scared': 1, 'angry': 1, 'sad': 2, 'crying': 2}}
PORTRAITS['soichiro']['sprite'] = {'key': 'portraits_soichiro', 'faces': {
    'neutral': 0, 'smile': 0, 'serious': 1, 'sad': 1, 'surprised': 1, 'scared': 1, 'angry': 2, 'wounded': 2}}
PORTRAITS['hakuya']['sprite'] = {'key': 'portraits_hakuya', 'faces': {
    'neutral': 0, 'smile': 0, 'serious': 0, 'sad': 0, 'laugh': 1, 'surprised': 2, 'angry': 2}}
PORTRAITS['villager']['sprite'] = {'key': 'portraits_village', 'faces': {'neutral': 2, 'smile': 2, 'surprised': 3, 'sad': 3, 'scared': 3, 'angry': 3, 'serious': 3}}

CHAPTERS = [  # (파일 이름, 대본의 장 제목 머리말 시작)
    ('prologue', '## 프롤로그'), ('ch1', '## 1장'), ('ch2', '## 2장'), ('ch3', '## 3장'), ('ch4', '## 4장'),
    ('ch5', '## 5장'), ('ch6', '## 6장'), ('epilogue', '## 에필로그'),
]

# ───────── 대본 한 줄 패턴 ─────────
RE_SCENE = re.compile(r'^### ((?:S\d+-\d+|E-\d+)) · (.+)$')
RE_SAY = re.compile(r'^(?:- )?([^\s(":-][^(":]*?) \(([^)]+)\): ["“](.*)["”](?:\s*\((.+)\))?$')
RE_CAPTION = re.compile(r'^〈(.+)〉$')
RE_BOLD = re.compile(r'^\*\*(.+)\*\*$')
RE_BULLET_QUOTE = re.compile(r'^- ["“](.*)["”]$')


# ───────── 연출 문장 → 표준 명령 ─────────
# 게임 이벤트에 걸린 문장(성공 시, ~할 때마다 …)은 순서대로 재생하면 틀리므로 note 로 둔다
GAMEPLAY_WORDS = ('성공 시', '때마다', '반복', '튜토리얼', '안내', '기믹', '페이즈', '패턴', '튕긴다',
                  '자동 진행', '이후 체크포인트', '선택:', '전투 시작', '이 전투에 한해', '타이머 UI',
                  '힌트', '베는 순간', '마지막 일격')

# 규칙으로 뽑기 어려운 문장은 원문 그대로 짝지어 둔다 (원문 문장 → 명령 목록)
OVERRIDES = {
    # 검은 화면에서 시작하는 장면: 바로 암전 (자막이 게임 화면 위가 아니라 검은 바탕에 나오게)
    '완전한 검은 화면.': [{'cmd': 'fadeOut', 'duration': 0}],
    '검은 화면.': [{'cmd': 'fadeOut', 'duration': 0}],
    # CG·전경: 검은 화면에서 0.8초 떠오르고, 떠 있는 동안 아주 느리게 확대/패닝, '사라진다' 에서 0.8초 페이드아웃
    '해 질 녘 연습장 전경이 검은 화면에서 떠오르며 천천히 옆으로 패닝.': [{'cmd': 'cg', 'image': 'bg_pro_yard', 'desc': '해 질 녘 연습장 전경', 'motion': 'pan'}],
    '전경이 천천히 사라진다.': [{'cmd': 'cgEnd'}],
    'CG가 천천히 사라진다.': [{'cmd': 'cgEnd'}],
    'CG 1: 축제 밤의 가족이 천천히 떠오른다.': [{'cmd': 'cg', 'no': 1, 'desc': '축제 밤의 가족', 'motion': 'zoom'}],
    '0.8초 암전.': [{'cmd': 'fadeOut', 'duration': 0.8}],
    '명전.': [{'cmd': 'fadeIn', 'duration': 0.8}],
    '검은 칼집의 칼을 건넨다.': [{'cmd': 'note', 'text': '검은 칼집의 칼을 건넨다.'}],
    '아이템 획득 연출 (칼이 화면 가운데서 빛남).': [{'cmd': 'giveItem', 'name': '아카네의 칼 (이름 없음)'}],
    '타이틀 로고가 붓으로 써지며 등장.': [{'cmd': 'titleCard', 'text': '카미사마 복수극', 'style': 'logo'}],
    'BGM이 얇아지고 물방울 소리.': [{'cmd': 'bgm', 'name': '(현재 곡 작게)', 'volume': 0.4}, {'cmd': 'sfx', 'name': '물방울'}],
    '화면이 하얗게 번진다.': [{'cmd': 'flash', 'color': 'white', 'soft': True}],
    '화면이 순간 하얘지고 안개 속에서 목소리가 들린다.': [{'cmd': 'flash', 'color': 'white'}],
    '화면이 따라 내려가며 스테이지 1-1 시작.': [{'cmd': 'cameraPan', 'dir': 'down'}],
    '아카네가 언덕에서 뛰어내린다.': [{'cmd': 'note', 'text': '아카네가 언덕에서 뛰어내린다.'}],
    '카메라가 위로 올라가며 마을 전체를 비춘다.': [{'cmd': 'cameraPan', 'dir': 'up'}],
    '화면이 줌아웃되며 보스가 화면 높이 2/3를 차지한다.': [{'cmd': 'cameraPan', 'zoom': 'out'}],
    '아카네가 지나가면 수배서 하나가 클로즈업된다.': [{'cmd': 'cameraPan', 'zoom': 'in', 'target': '수배서'}],
    '효과음 없이 침묵.': [{'cmd': 'bgm', 'name': 'stop'}, {'cmd': 'sfx', 'name': 'stop'}],
    '종소리.': [{'cmd': 'sfx', 'name': '종소리'}],
    '한 번, 두 번.': [{'cmd': 'sfx', 'name': '종소리'}],
    '그중 한 명이 종을 친다.': [{'cmd': 'note', 'text': '그중 한 명이 종을 친다.'}],
    '댕— 소리가 산을 울린다.': [{'cmd': 'sfx', 'name': '큰 종 (댕—)'}],
    '화면 정지.': [{'cmd': 'note', 'text': '화면 정지.'}],
    '소이치로가 칼날을 물에 담그자 치익 소리와 하얀 김.': [{'cmd': 'sfx', 'name': '담금질 (치익)'}],
    '다리 끝에서 쿵, 쿵 하는 발소리.': [{'cmd': 'sfx', 'name': '거한의 발소리 (쿵, 쿵)'}],
    '복도 끝의 방에서 샤미센 소리.': [{'cmd': 'sfx', 'name': '샤미센'}],
    '타누키치가 처음으로 큰 소리를 낸다.': [{'cmd': 'note', 'text': '타누키치가 처음으로 큰 소리를 낸다.'}],
    '관객 소리도 뚝 끊긴다.': [{'cmd': 'sfx', 'name': '관객', 'stop': True}],
    '화로 타는 소리만.': [{'cmd': 'sfx', 'name': '화로 타는 소리'}],
    '심장 박동 같은 낮은 북소리만.': [{'cmd': 'sfx', 'name': '심장 박동 같은 낮은 북'}],
    '계단 아래에서 작은 발소리.': [{'cmd': 'sfx', 'name': '작은 발소리'}],
    '멀리 산 아래에서, 딸랑— 방울 소리.': [{'cmd': 'sfx', 'name': '방울 (딸랑—)', 'distant': True}],
    '쇠 두드리는 소리.': [{'cmd': 'sfx', 'name': '쇠 두드리는 소리'}],
    '칼 뽑는 소리 한 번.': [{'cmd': 'sfx', 'name': '칼 뽑는 소리'}],
    '칼집에 넣는 소리.': [{'cmd': 'sfx', 'name': '칼집에 넣는 소리'}],
    '부채 펴는 소리.': [{'cmd': 'sfx', 'name': '부채 펴는 소리'}],
    '바람에 대나무가 서로 부딪히는 소리.': [{'cmd': 'sfx', 'name': '대나무 부딪히는 소리'}],
    '바람 소리가 BGM보다 크다.': [{'cmd': 'sfx', 'name': '바람', 'loud': True}],
    '장 제목 카드: 〈第六章 · 천년벚나무〉 — 이 장만 제목 글자가 붉은색.': [{'cmd': 'titleCard', 'text': '第六章 · 천년벚나무', 'color': 'red'}],
    '벚꽃나무에 다가가 꽃이 피는 순간, 화면이 순간 하얘지고 안개 속에서 목소리가 들린다.': [{'cmd': 'flash', 'color': 'white'}],
    'CG 없음, 실제 게임 화면을 카메라가 위로 천천히 올려다본다.': [{'cmd': 'cameraPan', 'dir': 'up', 'slow': True}],
    '2페이즈 체력바: 〈천년벚나무 · 하쿠야〉.': [{'cmd': 'bossName', 'text': '천년벚나무 · 하쿠야', 'phase': 2}],
    '보스 체력바: "하쿠야" — 체력바가 줄지 않는다.': [{'cmd': 'bossName', 'text': '하쿠야'},
                                         {'cmd': 'note', 'text': '체력바가 줄지 않는다. (패배 이벤트 전투)'}],
}

# 게임플레이로 옮긴 연출 메모: 장면 id → { note 원문: 대신 넣을 gameplay 명령들 }
# gameplay 명령은 js/gameplay.js 가 실행한다 ({cmd:'gameplay', do: 동작, ...}). 빈 목록이면 메모만 지운다(앞 명령에 포함됨)
G = lambda do, **kw: {'cmd': 'gameplay', 'do': do, **kw}
GAMEPLAY = {
    'S0-3': {
        '불꽃이 튄다.': [G('npcPose', who='soichiro', pose='forge')],
        '검은 칼집의 칼을 건넨다.': [G('npcPose', who='soichiro', pose='give')],
    },
    'S0-2': {
        '해 질 녘.': [G('mood', mood='dusk')],
        '이동 튜토리얼 표시.': [G('tutorial', step='move')],
        '하루가 마당 끝으로 걸어간다.': [G('npcMove', who='haru', to='haruWall')],
        '점프 튜토리얼.': [G('tutorial', step='jump')],
        '낮은 담을 넘는다.': [G('npcMove', who='haru', to='haruDrill')],
        '허수아비 3개.': [G('spawn', group='dummies')],
        '대쉬 베기 튜토리얼.': [G('tutorial', step='dashSlash')],
        '하루가 목검을 허리에 대고 자세를 낮춘다.': [G('npcPose', who='haru', pose='guard')],
        '벨 때마다 칼에 분홍 꽃잎이 하나씩 붙는다 (벚꽃 스택 UI 처음 등장).': [],
        '발도 튜토리얼.': [G('tutorial', step='iaido')],
        '하루가 목검으로 천천히 공격한다.': [],
        '패링에 성공할 때까지 반복.': [G('tutorial', step='parry')],
        '성공 시 하얀 섬광 + 짧은 슬로모션.': [],
    },
    'S0-4': {
        '등롱이 줄지어 걸리고 마을 사람들이 고양이귀 가면을 쓰고 춤춘다.': [G('festival')],
        '하루가 손을 대자 분홍 빛이 퍼지며 꽃이 한꺼번에 핀다.': [G('bloomTree', tree='festival')],
        '마을 사람들 환호.': [G('cheer')],
        '아카네가 다가가면 하루가 귓속말.': [G('approach', who='haru')],
        '하늘에서 불화살 수십 개가 포물선을 그리며 떨어진다.': [G('fireArrows')],
    },
    'S0-5': {
        '흰 옷에 흰 가면을 쓴 무리가 횃불을 들고 들어온다.': [G('spawn', group='alley')],
        '첫 실전 전투.': [],
        '가면 신도 2명.': [G('fight', group='alley')],
    },
    'S0-6': {
        '소이치로가 망치 하나로 신도 셋을 막고 있다.': [G('npcPlace', who='soichiro', at='smithyFront', face=1), G('npcPose', who='soichiro', pose='attack'), G('spawn', group='smithy')],
        '어깨에 화살이 꽂혀 있다.': [G('npcPose', who='soichiro', pose='guard')],
        '플레이어가 신도들을 벤다.': [G('fight', group='smithy', slowmoLast=True)],
        '마지막 신도를 베는 순간 슬로모션.': [],
        '소이치로가 무릎을 꿇는다.': [G('npcPose', who='soichiro', pose='kneel')],
        '대장간 지붕이 무너지며 화면을 가린다.': [G('roofCollapse', who='soichiro')],
    },
    'S0-7': {
        '하루가 목검이 아닌 진검을 들고 서 있다.': [G('npcPlace', who='haru', at='fireHaru', face=1)],
        '아카네가 광장에 뛰어든다.': [G('playerRun', to='fireAkane')],
        '하루가 돌아본다.': [G('npcFace', who='haru', dir=-1)],
        '체력바가 줄지 않는다. (패배 이벤트 전투)': [],
        '패배 이벤트 전투.': [G('defeatBattle', seconds=20, hits=3)],
        '아카네의 공격은 모두 금빛 막에 튕긴다.': [],
        '20초 후 또는 3번 피격 시 자동 진행.': [],
        '하쿠야의 발도.': [G('hakuyaIaido')],
        '아카네가 날아가 쓰러진다.': [],
        '사망 연출이 나오지만 화면이 멈추지 않는다.': [],
        '하루가 마지막 힘으로 손을 뻗는다.': [G('npcPose', who='haru', pose='reach')],
        '하쿠야가 손을 뻗지만 꽃잎이 그의 손을 벤다.': [G('bossAnim', anim='hakuya_hurt', hold=True)],
        '하루가 아카네 앞을 막아선다.': [G('npcMove', who='haru', to='player', offset=60, wait=True)],
        '하쿠야의 칼이 하루를 꿰뚫는다.': [G('stab', who='haru')],
        '꽃잎 한 장이 떨어진다.': [G('petal')],
        '아카네 주위로 분홍 꽃잎 수천 장이 소용돌이친다.': [G('petalStorm')],
        '꽃잎이 아카네를 싣고 하늘로 날아간다.': [G('carryAway')],
    },
}


# 장면마다 표정을 고정: (장면, 화자) → 표정. 대장간 앞(S0-6) 소이치로는 다친 얼굴, 불타는 광장(S0-7) 하쿠야의 미소는 비웃음
FACE_OVERRIDES = {('S0-6', 'soichiro'): 'wounded', ('S0-7', 'hakuya', 'smile'): 'laugh'}


def apply_face_overrides(chapters):
    def walk(cmds, sid):
        for c in cmds or []:
            if c.get('cmd') in ('say', 'think'):
                k3 = (sid, c.get('speaker'), c.get('face'))
                k2 = (sid, c.get('speaker'))
                if k3 in FACE_OVERRIDES:
                    c['face'] = FACE_OVERRIDES[k3]
                elif k2 in FACE_OVERRIDES:
                    c['face'] = FACE_OVERRIDES[k2]
            for k in ('then', 'else', 'commands'):
                walk(c.get(k), sid)
            for o in c.get('options', []) + c.get('cases', []):
                walk(o.get('commands'), sid)
    for ch in chapters.values():
        for sc in ch['scenes']:
            walk(sc['commands'], sc['id'])


def apply_gameplay(chapters):
    """GAMEPLAY 표의 메모를 gameplay 명령으로 바꾼다. 표에 있는데 대본에서 못 찾은 문장은 알려 준다"""
    scenes = {sc['id']: sc for ch in chapters.values() for sc in ch['scenes']}
    for sid, table in GAMEPLAY.items():
        sc = scenes.get(sid)
        if not sc:
            print('[gameplay] 장면 없음:', sid)
            continue
        used, out = set(), []
        for c in sc['commands']:
            t = c.get('text')
            if c.get('cmd') == 'note' and t in table:
                used.add(t)
                out += [{**g, 'text': t} for g in table[t]]
            else:
                out.append(c)
        sc['commands'] = out
        for t in table:
            if t not in used:
                print(f'[gameplay] {sid} 에서 못 찾은 문장:', t)


FADE_SEC = 0.8


def _bgm_name(s):
    """BGM 이름을 문장에서 뽑는다"""
    if re.search(r'BGM(이)? (뚝 )?끊긴다|BGM 정지|BGM 없음', s):
        return 'stop'
    for pat in (r'BGM:\s*([^.]+?)\.?$', r'BGM이 (.+?)(?:으로|로) 바뀐다', r'(\S+(?: \S+){0,2}) BGM 시작',
                r'이 보스전 BGM은 (.+?)만', r'^(.+?) BGM(?: \(([^)]+)\))?\.?$'):
        m = re.search(pat, s)
        if m:
            return ' '.join(g for g in m.groups() if g).strip(' .,')
    return None


def _sfx_names(s):
    names = []
    for m in re.finditer(r'((?:[^\s.,]+ ){0,2}[^\s.,]*?)\s?소리', s):
        if '목소리' in m.group(0):
            continue
        n = m.group(0).replace(' 소리', '').replace('소리', '').strip(' ,—')
        n = re.sub(r'^(이어서|멀리 산 아래에서|다리 끝에서|안에서|성 안에서|화로|침묵 속|바깥)\s*', '', n)
        if n:
            names.append(n if n.endswith('소리') or not re.search(r'[는은던]$', n) else n + ' 소리')
    return names


def direction_commands(sentence):
    """연출 한 문장 → 표준 명령 목록. 하나도 못 뽑으면 [] (note 가 된다)"""
    s = sentence.strip()
    if s in OVERRIDES:
        return [dict(c) for c in OVERRIDES[s]]
    if any(w in s for w in GAMEPLAY_WORDS):
        return []
    cmds = []
    m = re.search(r'암전(?:\s*([\d.]+)초)?', s)
    if m:
        cmds.append({'cmd': 'fadeOut', 'duration': float(m.group(1)) if m.group(1) else FADE_SEC})
    if '명전' in s:
        cmds.append({'cmd': 'fadeIn', 'duration': FADE_SEC})
    if '레터박스 해제' in s:
        cmds.append({'cmd': 'letterbox', 'on': False})
    elif '레터박스' in s:
        cmds.append({'cmd': 'letterbox', 'on': True})
    m = re.search(r'흔들림 (강|약)', s)
    if m:
        cmds.append({'cmd': 'shake', 'strength': 'strong' if m.group(1) == '강' else 'weak'})
    m = re.search(r'플래시\((붉음|흰색)\)', s)
    if m:
        cmds.append({'cmd': 'flash', 'color': 'red' if m.group(1) == '붉음' else 'white'})
    if '슬로모션' in s:
        cmds.append({'cmd': 'slowmo'})
    m = re.search(r'CG\s*(\d+)(?::\s*([^)]+?))?(?:\)|\.|$)', s)
    if m:
        cmds.append({'cmd': 'cg', 'no': int(m.group(1)), **({'desc': m.group(2).strip()} if m.group(2) else {})})
    m = re.search(r'(?:장 제목 카드:\s*)?〈(第.+?)〉', s)
    if m:
        cmds.append({'cmd': 'titleCard', 'text': m.group(1)})
    m = re.search(r'(?:보스 이름 붓 자막|\d페이즈 체력바|보스 체력바):\s*[〈"“](.+?)[〉"”]', s)
    if m:
        cmds.append({'cmd': 'bossName', 'text': m.group(1)})
    m = re.search(r'아이템 획득(?: 연출)?:\s*〈(.+?)〉', s)
    if m:
        cmds.append({'cmd': 'giveItem', 'name': m.group(1)})
    m = re.search(r'화면 가운데 문구:\s*〈(.+?)〉', s)
    if m:
        cmds.append({'cmd': 'caption', 'text': m.group(1)})
    m = re.search(r'(위|아래|왼쪽|오른쪽)로 패닝', s)
    if m:
        cmds.append({'cmd': 'cameraPan', 'dir': {'위': 'up', '아래': 'down', '왼쪽': 'left', '오른쪽': 'right'}[m.group(1)]})
    bgm = _bgm_name(s)
    if '침묵' in s and not bgm:
        bgm = 'stop'  # 침묵 = BGM 이 끊기고 환경음만 남음
    if bgm:
        cmds.append({'cmd': 'bgm', 'name': bgm})
    m = re.search(r'(?:침묵|정적)\s*(\d+)초|(\d+)초\s*(?:간|정적)', s)
    if m:
        cmds.append({'cmd': 'wait', 'seconds': float(m.group(1) or m.group(2))})
    if not bgm or 'BGM' not in s:
        for n in _sfx_names(s):
            cmds.append({'cmd': 'sfx', 'name': n})
    return cmds


def split_sentences(text):
    """마침표 기준으로 나누되 괄호·〈〉 안의 마침표는 무시. '→ 에필로그' 는 따로 뗀다"""
    out, buf, depth = [], '', 0
    for ch in text:
        buf += ch
        if ch in '(〈':
            depth += 1
        elif ch in ')〉':
            depth = max(0, depth - 1)
        elif ch == '.' and depth == 0:
            out.append(buf.strip())
            buf = ''
    # '0.3초' 처럼 숫자 사이 마침표에서 잘린 것은 다시 붙인다
    merged = []
    for s in out + ([buf.strip()] if buf.strip() else []):
        if merged and re.search(r'\d\.$', merged[-1]) and re.match(r'^\d', s):
            merged[-1] += s
        else:
            merged.append(s)
    out, buf = merged, ''
    if buf.strip():
        out.append(buf.strip())
    res = []
    for s in out:
        if '→ 에필로그' in s:
            a, b = s.split('→', 1)
            if a.strip():
                res.append(a.strip())
            res.append('→' + b.strip())
        else:
            res.append(s)
    return res


# ───────── 장면 트리거 ─────────
def parse_trigger(rest):
    """머리말의 '장소 · 트리거' 부분 → (장소, 트리거 dict)"""
    parts = [p.strip() for p in rest.split(' · ')]
    if len(parts) == 1:  # 'E-5 · 진엔딩 — 사쿠라자와 가는 길'
        return parts[0], {'type': 'chapterStart', 'raw': parts[0]}
    place, raw = ' · '.join(parts[:-1]), parts[-1]
    t = {'raw': raw}
    note = re.search(r'\(([^)]+)\)\s*$', raw)
    core = re.sub(r'\s*\([^)]+\)\s*$', '', raw)
    stage = re.search(r'스테이지 ([\dP]+-\d+)', core)
    if stage:
        t['stage'] = stage.group(1)
    if core in ('게임 시작', '장 시작', '공통'):
        t['type'] = 'chapterStart'
    elif core in ('장 끝', '프롤로그 끝'):
        t['type'] = 'chapterEnd'
    elif '보스 전' in core:
        t['type'] = 'bossBefore'
    elif '보스 후' in core:
        t['type'] = 'bossAfter'
    elif place.startswith('보스전'):
        t['type'] = 'bossCondition'
        hp = re.search(r'체력 (\d+)%', core)
        t['condition'] = {'hpBelow': int(hp.group(1)) / 100} if hp else {'event': core}
        if core.startswith('체력 0'):
            t['condition'] = {'hpBelow': 0}
        boss = re.match(r'(\S+) 체력', core)
        if boss:
            t['condition']['boss'] = boss.group(1)
        if '페이즈' in core:
            t['condition']['phase'] = int(re.search(r'(\d)페이즈', core).group(1))
    elif core.startswith('체크포인트'):
        t['type'] = 'checkpoint'
        t['n'] = [int(x) for x in re.findall(r'\d+', core)]
        if len(t['n']) == 1:
            t['n'] = t['n'][0]
    elif '시작' in core and stage:
        t['type'] = 'stageStart'
    elif stage and ('중간' in core or '끝' in core):
        t['type'] = 'reach'
        t['at'] = 'middle' if '중간' in core else 'end'
    elif '위치 도달' in core:
        t['type'] = 'reach'
    elif '엔딩' in core or '크레딧 후' in place or '크레딧 후' in core:
        t['type'] = 'chapterStart'
    else:
        t['type'] = 'reach'  # '부모와의 대화' 처럼 장소에 도착하면 시작
    if note:
        t['note'] = note.group(1)
    return place, t


# ───────── 변환 ─────────
class Converter:
    def __init__(self, lines):
        self.lines = lines
        self.unknown_speakers = Counter()

    def speaker_id(self, name):
        if name not in CHARACTERS:
            self.unknown_speakers[name] += 1
            return name
        return CHARACTERS[name]

    def line_command(self, m):
        """say / think / voice 한 줄"""
        name, face_raw, text, tail = m.group(1).strip(), m.group(2), m.group(3), m.group(4)
        sid = self.speaker_id(name)
        parts = [p.strip() for p in face_raw.split(',')]
        face, manner = parts[0], parts[1:]
        if face == '속마음':
            c = {'cmd': 'think', 'speaker': sid, 'text': text}
        elif face == '목소리' or '목소리만' in manner:
            c = {'cmd': 'voice', 'speaker': sid, 'text': text, 'style': VOICE_STYLE.get(sid, 'plain')}
            if face in FACES:
                c['face'] = FACES[face]
            manner = [x for x in manner if x != '목소리만']
        else:
            c = {'cmd': 'say', 'speaker': sid, 'face': FACES.get(face, face), 'text': text}
        if manner:
            c['manner'] = ', '.join(manner)
        if tail:
            c['note'] = tail
        return c

    def dir_commands(self, text, scene):
        out = []
        for s in split_sentences(text):
            if s.startswith('→'):
                ending = 'true' if '진엔딩' in s else 'normal'
                out.append({'cmd': 'setFlag', 'flag': 'ending', 'value': ending, 'src': s})
                continue
            # 장면 속성으로 옮기는 문장
            if re.fullmatch(r'조작 가능(?: 컷신)?[.,]?', s) or s in ('조작 가능, 전투 없음.',):
                scene['controllable'] = True
                if '전투 없음' in s:
                    scene['noCombat'] = True
                continue
            # 대사 줄의 속성(portrait: false, 목소리 글자 스타일)으로 이미 옮긴 문장
            if s in ('목소리만 들린다.', '초상화 없이 그림자만.', '초상화 없이 뒷모습.', '초상화 없이 글자만, 분홍색.') or \
                    s.startswith('하쿠야의 목소리는 이 장 동안'):
                scene.setdefault('applied', []).append(s)
                continue
            if s in ('전투 없음.',):
                scene['noCombat'] = True
                continue
            if '(조작 가능 컷신)' in s:
                scene['controllable'] = True
            cmds = direction_commands(s)
            if cmds and not (len(cmds) == 1 and cmds[0]['cmd'] == 'note'):
                first = next(c for c in cmds if c['cmd'] != 'note')
                first['src'] = s
                out.extend(cmds)
            else:
                out.append({'cmd': 'note', 'text': s})
        return out

    def assign_sides(self, commands, state=None, all_cmds=None):
        """say/think 에 초상화 위치. 아카네는 항상 왼쪽.
        장면(분기 포함) 어디에서든 아카네가 말하면 다른 인물은 모두 오른쪽,
        아카네가 없는 장면이면 화자가 바뀔 때 왼쪽/오른쪽을 자동으로 번갈아 배정."""
        if state is None:
            akane = any(c.get('cmd') in ('say', 'think') and c.get('speaker') == 'akane' for c in walk(all_cmds or commands))
            state = {'akane_spoke': akane, 'left': None, 'right': None, 'last': None}
        for c in commands:
            for key in ('then', 'else', 'commands'):
                if isinstance(c.get(key), list):
                    self.assign_sides(c[key], dict(state))
            if c.get('cmd') == 'choice':
                for o in c['options']:
                    self.assign_sides(o['commands'], dict(state))
            if c.get('cmd') == 'condition' and 'cases' in c:
                for case in c['cases']:
                    self.assign_sides(case['commands'], dict(state))
            if c.get('cmd') not in ('say', 'think'):
                continue
            sp = c['speaker']
            if sp == 'akane':
                c['side'] = 'left'
                state['akane_spoke'] = True
                state['left'] = 'akane'
            elif state['akane_spoke']:
                c['side'] = 'right'
                state['right'] = sp
            elif state['left'] == sp:
                c['side'] = 'left'
            elif state['right'] == sp:
                c['side'] = 'right'
            else:
                # 비어 있는 쪽, 없으면 방금 말한 사람의 반대쪽
                side = 'left' if state['left'] is None else 'right' if state['right'] is None else \
                    ('right' if state['last'] == state['left'] else 'left')
                state[side] = sp
                c['side'] = side
            state['last'] = sp
        return state

    def parse_scene_body(self, sid, body, scene):
        """장면 본문 → 명령 목록 (조건·선택지 블록 포함)"""
        cmds = []
        target = cmds        # 지금 명령을 넣는 목록
        i = 0
        while i < len(body):
            s = body[i].strip()
            i += 1
            if not s:
                continue
            b = RE_BOLD.match(s)
            if b:
                title = b.group(1)
                if title.startswith('(진엔딩 조건'):
                    block = {'cmd': 'condition', 'when': {'memoriesAtLeast': 18}, 'then': [], 'src': title.strip('()')}
                    cmds.append(block)
                    target = block['then']
                elif title.startswith('일반 루트'):
                    scene.setdefault('blocks', {})['normalRoute'] = []
                    target = scene['blocks']['normalRoute']
                elif title.startswith('진엔딩 루트'):
                    cond = {'cmd': 'condition', 'when': {'memoriesAtLeast': 18}, 'then': [],
                            'else': [{'cmd': 'run', 'block': 'normalRoute'}], 'src': title}
                    cmds.append(cond)
                    target = cond['then']
                else:
                    target.append({'cmd': 'section', 'title': title})
                continue
            if s.startswith('▶'):
                target.extend(self.dir_commands(s[1:].strip(), scene))
                continue
            cap = RE_CAPTION.match(s)
            if cap and ' / ' in s and '〉 / 〈' in s:  # 〈벤다〉 / 〈나눈다〉 선택지
                labels = re.findall(r'〈(.+?)〉', s)
                choice = {'cmd': 'choice', 'options': []}
                # 이어지는 '- 〈X〉를 고르면 → …' 줄
                while i < len(body) and body[i].strip().startswith('- 〈') or (i < len(body) and not body[i].strip()):
                    t = body[i].strip()
                    i += 1
                    if not t:
                        continue
                    lab = re.match(r'- 〈(.+?)〉를 고르면 → (.+)', t)
                    opt = {'id': {'벤다': 'cut', '나눈다': 'share'}.get(lab.group(1), lab.group(1)), 'text': lab.group(1),
                           'commands': [], 'src': t}
                    if '일반 루트와 같다' in lab.group(2):
                        opt['commands'] = [{'cmd': 'run', 'block': 'normalRoute'}]
                    choice['options'].append(opt)
                assert [o['text'] for o in choice['options']] == labels, (sid, labels)
                target.append(choice)
                share = next(o for o in choice['options'] if not o['commands'])
                target = share['commands']  # '아래 장면' = 이후 줄들
                continue
            if cap:
                target.append({'cmd': 'caption', 'text': cap.group(1)})
                continue
            cond = re.match(r'^- (.+?)(?:이|가) 먼저 쓰러지면 — (.+)$', s)
            if cond:
                m = RE_SAY.match(cond.group(2))
                case = {'when': {'firstDown': self.speaker_id(cond.group(1))}, 'commands': [self.line_command(m)]}
                if target and target[-1].get('cmd') == 'condition' and 'cases' in target[-1]:
                    target[-1]['cases'].append(case)
                else:
                    target.append({'cmd': 'condition', 'cases': [case]})
                continue
            m = RE_SAY.match(s)
            if m:
                target.append(self.line_command(m))
                continue
            raise ValueError(f'{sid}: 해석 못 한 줄: {s}')
        return cmds

    def pool(self, title, body, chapter):
        """'타누키치 체크포인트 한마디' 같은 목록 → 랜덤 풀"""
        entries = []
        desc = []
        for s in (x.strip() for x in body):
            if not s:
                continue
            q = RE_BULLET_QUOTE.match(s)
            m = RE_SAY.match(s)
            if q and title.startswith('하루의 목소리'):
                entries.append({'cmd': 'voice', 'speaker': 'haru', 'text': q.group(1), 'style': VOICE_STYLE['haru']})
            elif q:
                entries.append({'cmd': 'say', 'speaker': 'tanukichi', 'face': 'smile', 'text': q.group(1), 'side': 'right'})
            elif m:
                c = self.line_command(m)
                if c['cmd'] in ('say', 'think'):
                    c['side'] = 'left' if c['speaker'] == 'akane' else 'right'
                entries.append(c)
            elif s.startswith('▶'):
                desc.append(s[1:].strip())
            else:
                desc.append(s)
        p = {'id': None, 'title': title, 'trigger': 'checkpointBloom', 'mode': 'random', 'chance': 1.0, 'lines': entries}
        if desc:
            p['note'] = ' '.join(desc)
        if title.startswith('타누키치'):
            p['id'] = f'{chapter}_tanukichi'
            if '5-1까지만' in title:
                p['stages'] = ['5-1']
        elif title.startswith('하루의 목소리'):
            p.update(id='haru_voice', chance=0.1, fromChapter=2, afterScene='S2-4')
        elif title.startswith('대신 5-2부터'):
            p.update(id='ch5_akane_alone', stages=['5-2', '5-3'])
        elif title.startswith('6장 체크포인트'):
            p.update(id='ch6_haru_voice', chance=1.0)
        return p

    def run(self):
        L = self.lines
        idx = {}
        for name, head in CHAPTERS:
            idx[name] = next(i for i, l in enumerate(L) if l.startswith(head))
        mem_i = next(i for i, l in enumerate(L) if l.startswith('## 기억 조각'))
        bounds = [idx[n] for n, _ in CHAPTERS] + [mem_i]
        chapters = {}
        for k, (name, _) in enumerate(CHAPTERS):
            chunk = L[bounds[k]:bounds[k + 1]]
            title = chunk[0].split('—', 1)[1].strip() if '—' in chunk[0] else chunk[0][3:].strip()
            # 장 소개 문단: 제목 다음 첫 '###' 전까지
            first = next(j for j, l in enumerate(chunk) if l.startswith('###'))
            summary = ' '.join(l.strip() for l in chunk[1:first] if l.strip())
            ch = {'id': name, 'title': title, 'summary': summary, 'scenes': [], 'pools': []}
            # '###' 단위로 나눈다
            heads = [j for j, l in enumerate(chunk) if l.startswith('### ')] + [len(chunk)]
            for a, b in zip(heads, heads[1:]):
                head, body = chunk[a], chunk[a + 1:b]
                m = RE_SCENE.match(head)
                if not m:
                    t = head[4:].strip()
                    if '기억 조각 연결' in t:
                        ch['memoryNote'] = ' '.join(x.strip() for x in body if x.strip())
                    else:
                        ch['pools'].append(self.pool(t, body, name))
                    continue
                sid, rest = m.group(1), m.group(2)
                place, trig = parse_trigger(rest)
                scene = {'id': sid, 'place': place, 'trigger': trig}
                scene['commands'] = self.parse_scene_body(sid, body, scene)
                self.post_scene(scene)
                ch['scenes'].append(scene)
            chapters[name] = ch
        self.special_cases(chapters)
        for ch in chapters.values():
            for sc in ch['scenes']:
                everything = sc['commands'] + [c for blk in sc.get('blocks', {}).values() for c in blk]
                self.assign_sides(sc['commands'], all_cmds=everything)
                for blk in sc.get('blocks', {}).values():
                    self.assign_sides(blk, all_cmds=everything)
        memories = self.memories(L[mem_i:])
        return chapters, memories

    def post_scene(self, scene):
        # 초상화 없이 목소리/그림자/뒷모습만 나오는 장면
        no_portrait = {'S1-2': ['cultist'], 'S3-4': ['cult_exec_a', 'cult_exec_b'], 'E-3': ['akane']}
        for c in scene['commands']:
            if c.get('cmd') == 'say' and c['speaker'] in no_portrait.get(scene['id'], []):
                c['portrait'] = False

    def special_cases(self, chapters):
        ep = {s['id']: s for s in chapters['epilogue']['scenes']}
        # 엔딩별 장면: 일반 엔딩 = 진엔딩 조건 미충족 또는 〈벤다〉, 진엔딩 = 〈나눈다〉
        for sid in ('E-3', 'E-4'):
            ep[sid]['condition'] = {'ending': 'normal'}
        for sid in ('E-5', 'E-6'):
            ep[sid]['condition'] = {'ending': 'true'}
        # E-5: E-3 의 앞부분(산길을 걸으며 벚나무가 피고 타누키치와 대화)까지만 같다
        #      → E-3 을 '마을 도착' 연출 바로 앞까지 포함하고, 그 뒤는 E-5 대사만
        e3 = ep['E-3']['commands']
        end = next(k for k, c in enumerate(e3) if c.get('cmd') == 'note' and c['text'].startswith('폐허가 된 사쿠라자와 마을'))
        cmds = ep['E-5']['commands']
        out = []
        for c in cmds:
            t = c.get('text', '')
            if c.get('cmd') == 'note' and t.startswith('E-3의 앞부분'):
                out.append({'cmd': 'include', 'scene': 'E-3', 'endBefore': end, 'src': t})
            elif c.get('cmd') == 'note' and (t.startswith('마을에 도착한 직후부터') or t.startswith('순서:')):
                ep['E-5'].setdefault('applied', []).append(t)  # 작가 지시: include 범위로 반영함
            else:
                out.append(c)
        ep['E-5']['commands'] = out
        # 체크포인트 대사 풀: 타누키치(·5장 아카네 혼잣말)는 너무 잦지 않게
        for ch in chapters.values():
            for p in ch['pools']:
                if p['id'].endswith('_tanukichi') or p['id'] == 'ch5_akane_alone':
                    p.update(chance=0.5, firstCheckpointOfStage=1.0, noRepeat=True, yieldTo=['haru_voice', 'ch6_haru_voice'],
                             display='bubble', duration=3, pause=False)
                elif p['id'] in ('haru_voice', 'ch6_haru_voice'):
                    p.update(display='voice', duration=3, pause=False)
        # 6장 체크포인트 2·3 의 하쿠야 목소리: 순서대로 나눈다
        #   체크포인트 2 → 첫 줄 / 체크포인트 3 → 두 번째 줄 → 아카네 대답 → 세 번째 줄 (조작 가능 컷신, 이어서)
        scenes = chapters['ch6']['scenes']
        k = next(i for i, s in enumerate(scenes) if s['id'] == 'S6-4')
        s64 = scenes[k]
        lines = [c for c in s64['commands'] if c['cmd'] in ('say', 'voice', 'think')]
        notes = [c for c in s64['commands'] if c['cmd'] == 'note']
        a = {'id': 'S6-4a', 'place': s64['place'], 'trigger': {**s64['trigger'], 'n': 2}, 'mode': 'sequence',
             'controllable': True, 'commands': notes + lines[:1]}
        b = {'id': 'S6-4b', 'place': s64['place'], 'trigger': {**s64['trigger'], 'n': 3}, 'mode': 'sequence',
             'controllable': True, 'commands': lines[1:]}
        scenes[k:k + 1] = [a, b]

    def memories(self, L):
        rows, notes, intro = [], [], []
        for l in L[1:]:
            s = l.strip()
            if s.startswith('| ') and not s.startswith('| 번호') and not s.startswith('| ---'):
                cells = [c.strip() for c in s.strip('|').split('|')]
                no, stage, where, title, content = cells
                quote = re.findall(r'"([^"]+)"', content)
                rows.append({'no': int(no), 'stage': stage, 'hidden': where, 'title': title, 'content': content,
                             **({'quotes': quote} if quote else {})})
            elif s.startswith('- '):
                notes.append(s[2:])
            elif s and not s.startswith('|') and not s.startswith('**'):
                intro.append(s)
        return {'description': ' '.join(intro), 'total': len(rows), 'trueEndingRequires': len(rows),
                'fragments': rows, 'designNotes': notes}


# ───────── 보고서 ─────────
def walk(cmds):
    for c in cmds:
        yield c
        for key in ('then', 'else'):
            if isinstance(c.get(key), list):
                yield from walk(c[key])
        for case in c.get('cases', []):
            yield from walk(case['commands'])
        for o in c.get('options', []):
            yield from walk(o['commands'])


def report(chapters, memories, conv):
    out = ['# 스토리 변환 보고서', '', '`tools/convert_story.py` 가 만든다. 다시 돌리면 덮어쓴다.', '',
           '## 장별 대사 수', '', '| 장 | 장면 | say | think | voice | 자막 | 랜덤 풀 줄 | 연출 명령 | note |', '|---|---|---|---|---|---|---|---|---|']
    tot = Counter()
    notes_by = []
    for name, ch in chapters.items():
        c = Counter()
        for sc in ch['scenes']:
            allc = list(walk(sc['commands'])) + [x for blk in sc.get('blocks', {}).values() for x in walk(blk)]
            for x in allc:
                k = x.get('cmd')
                if k in ('say', 'think', 'voice', 'caption', 'note'):
                    c[k] += 1
                elif k not in ('condition', 'choice', 'run', 'section', 'include', 'setFlag'):
                    c['dir'] += 1
                if k == 'note':
                    notes_by.append((name, sc['id'], x['text']))
        pool_lines = sum(len(p['lines']) for p in ch['pools'])
        c['pool'] = pool_lines
        c['scenes'] = len(ch['scenes'])
        tot.update(c)
        out.append(f"| {name} | {c['scenes']} | {c['say']} | {c['think']} | {c['voice']} | {c['caption']} | {pool_lines} | {c['dir']} | {c['note']} |")
    out.append(f"| **합계** | {tot['scenes']} | {tot['say']} | {tot['think']} | {tot['voice']} | {tot['caption']} | {tot['pool']} | {tot['dir']} | {tot['note']} |")
    out += ['', f"대사(say+think+voice) 합계 {tot['say'] + tot['think'] + tot['voice']}줄, 랜덤 풀 {tot['pool']}줄, 기억 조각 {memories['total']}개.", '',
            '## 연출 명령으로 못 바꾼 note (원문 그대로)', '']
    cur = None
    for name, sid, text in notes_by:
        if name != cur:
            out += ['', f'### {name}', '']
            cur = name
        out.append(f'- **{sid}** {text}')
    if conv.unknown_speakers:
        out += ['', '## 인물 표에 없는 화자', ''] + [f'- {k} ({v}줄)' for k, v in conv.unknown_speakers.items()]
    return '\n'.join(out) + '\n', tot, notes_by


def write_audio_table(chapters):
    """대본의 bgm/sfx 이름 → 소리 파일 경로 표 (data/story/audio.json).
    이미 적어 둔 경로는 그대로 두고 새 이름만 빈 값으로 더한다. 경로가 비어 있으면 게임은 조용히 넘어간다."""
    path = OUT / 'audio.json'
    table = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
    table.setdefault('_설명', '대본의 소리 이름 → 파일 경로 (예: "assets/audio/bgm/main.mp3"). 비어 있으면 소리 없이 넘어간다.')
    for kind in ('bgm', 'sfx'):
        table.setdefault(kind, {})

    def walk(cmds):
        for c in cmds or []:
            if c.get('cmd') in ('bgm', 'sfx') and c.get('name') != 'stop' and not c['name'].startswith('('):
                table[c['cmd']].setdefault(c['name'], '')
            for k in ('then', 'else', 'commands'):
                walk(c.get(k))
            for o in c.get('options', []) + c.get('cases', []):
                walk(o.get('commands'))

    for ch in chapters.values():
        for sc in ch['scenes']:
            walk(sc['commands'])
            for b in (sc.get('blocks') or {}).values():
                walk(b)
    path.write_text(json.dumps(table, ensure_ascii=False, indent=2), encoding='utf-8')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=None)
    args = ap.parse_args()
    src = Path(args.src) if args.src else next((ROOT / 'docs').glob('*.md'))
    lines = src.read_text(encoding='utf-8').split('\n')
    conv = Converter(lines)
    chapters, memories = conv.run()
    apply_gameplay(chapters)
    apply_face_overrides(chapters)
    OUT.mkdir(parents=True, exist_ok=True)
    meta = {'source': src.name, 'faces': FACES, 'voiceStyles': VOICE_STYLE}
    for name, ch in chapters.items():
        (OUT / f'{name}.json').write_text(json.dumps({**ch, 'meta': meta}, ensure_ascii=False, indent=2), encoding='utf-8')
    (OUT / 'memories.json').write_text(json.dumps(memories, ensure_ascii=False, indent=2), encoding='utf-8')
    chars = {cid: {'name': ko, 'side': 'left' if cid == 'akane' else 'auto', **PORTRAITS.get(cid, {})}
             for ko, cid in CHARACTERS.items()}
    (OUT / 'characters.json').write_text(json.dumps(chars, ensure_ascii=False, indent=2), encoding='utf-8')
    write_audio_table(chapters)
    text, tot, notes = report(chapters, memories, conv)
    (OUT / '_report.md').write_text(text, encoding='utf-8')
    print(f"장면 {tot['scenes']} · say {tot['say']} · think {tot['think']} · voice {tot['voice']} · 자막 {tot['caption']} · 풀 {tot['pool']} · 연출 명령 {tot['dir']} · note {tot['note']}")
    if conv.unknown_speakers:
        print('인물 표에 없는 화자:', dict(conv.unknown_speakers))


if __name__ == '__main__':
    main()
