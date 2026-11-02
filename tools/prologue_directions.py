"""새 프롤로그(P-0 ~ P-14) 연출 표: 대본 ▶ 줄(그대로) → 게임 명령. tools/convert_story.py 가 쓴다.

- LINES[장면][▶ 줄 글자] = 명령 목록. 줄 맨 앞 〔자동〕 같은 모드 표기는 변환기가 mode 명령으로 따로 넣고, 키는 그 뒤 글자다.
  번호 매긴 연출(P-9 '1. …')은 번호 뒤 글자가 키다.
- SETUP[장면] = 장면 맨 앞에 넣는 준비(자리 · 배경 · 소품), AFTER[장면] = 맨 뒤.
- INSPECT_AT['P-1:1'] = 조사 지점 위치 (맵 points 이름 또는 x).
- 표에 없는 ▶ 줄이 있으면 변환기가 '프롤로그 연출 표에 없는 줄'로 알려 준다 (하나도 빠뜨리지 않게).
- 그림이 없는 동작은 act(머리 위에 동작 이름), 소품은 prop(단색 네모 + 이름표), 배경은 임시 그림으로 보인다.
  위치 이름은 js/level.js 의 LEVELS.prologue.points.
"""

# ───────── 짧은 도우미 ─────────
def C(cmd, **kw):
    return {'cmd': cmd, **kw}


def say(who, text, face='neutral'):
    return C('say', speaker=who, face=face, text=text)


def act(who, name, sec=1.6, anim=None, wait=True):
    c = C('act', actor=who, name=name, seconds=sec)
    if anim:
        c['anim'] = anim
    if not wait:
        c['wait'] = False
    return c


def move(who, to, speed='walk', wait=True, **kw):
    c = C('moveTo', actor=who, to=to, speed=speed, **kw)
    if not wait:
        c['wait'] = False
    return c


def spawn(who, at, face=None, **kw):
    return C('spawn', actor=who, at=at, **({'face': face} if face else {}), **kw)


def face(who, d):
    return C('face', actor=who, dir=d)


def sfx(i, **kw):
    return C('sfx', id=i, **kw)


def wait(sec):
    return C('wait', seconds=sec)


def prop(i, key, at, **kw):
    return C('prop', id=i, key=key, at=at, **kw)


def G(do, **kw):
    return C('gameplay', do=do, **kw)


def par(*cmds):
    return C('parallel', commands=list(cmds))


def seq(*cmds):
    return C('sequence', commands=list(cmds))


LULLABY = '@lullaby'    # 변환기가 '### 하루의 자장가' 가사로 바꾼다
LULLABY1 = '@lullaby1'  # 첫 줄만 (한 소절)

# P-0 과 P-11(하쿠야의 발도 직후)의 같은 구도: 낮은 시점, 앞에 흐릿한 불길, 쓰러진 아카네 · 칼 든 하루의 뒷모습 · 불길 속 하쿠야
FRAME_P0 = [
    spawn('akane', 'fireAkaneDown', 'right'),
    C('pose', actor='akane', pose='down'),
    spawn('haru', 'fireHaru', 'right'),
    C('pose', actor='haru', pose='guard'),
    C('camPan', x='fireHaru', seconds=0.01),
    C('camTilt', y=46, ms=10),
    C('foreground', preset='pillar', x='fireAkaneDown'),
    C('particles', preset='embers', at='fireAkaneDown', id='p0embers'),
    C('vignette', amount=0.55, seconds=0.01),
]

SETUP = {
    'P-0': [
        C('fadeOut', duration=0), C('mood', to='fire', seconds=0), G('mood', mood='fire'),
        G('bossLook', color='black', x='fireHakuya', face=-1, show=True),
        C('treeStage', tree='burning', stage='burning'),
        prop('dbA0', 'prop_debris_fire', 12080, scale=0.7, depth=3, label=''),
        prop('dbA1', 'prop_debris_fire', 12420, scale=0.5, depth=3, label=''),
        prop('dbA2', 'prop_debris_fire', 13250, scale=0.7, depth=3, label=''),
        prop('dbA3', 'prop_debris_fire', 13520, scale=0.5, depth=3, label=''),
    ],
    'P-1': [
        G('bossLook', color=None, show=False),
        C('camReset', ms=0), C('vignette', amount=0, seconds=0), C('foregroundClear'), C('particlesStop'),
        C('mood', to='morning', seconds=0), G('mood', mood=None),
        C('disappear', actor='haru', fade=False), C('disappear', actor='soichiro', fade=False),
        C('disappear', actor='hana', fade=False), C('disappear', actor='wanderer', fade=False),
        spawn('akane', 'bed', 'right'), C('pose', actor='akane', pose='down'),
        prop('bed', 'prop_bed', 'bed', depth=6),
        prop('wsword', 'prop_wooden_sword', 120, dy=-80, w=44, h=6, color='#a08060', label='작은 목검'),
        prop('comb', 'prop_comb', 520, dy=-40, w=16, h=6, color='#c09060', label='거울 앞 빗'),
        prop('window', 'prop_window', 700, dy=-150, w=90, h=70, color='#bfd8e8', label='창 (큰 나무가 보임)'),
    ],
    'P-2': [
        spawn('akane', 1060, 'right'), C('exitGlow', on=False), prop('sapling', 'sapling_dead', 'sapling'),
        spawn('haru', 1080, 'right'), C('disappear', actor='haru', fade=False),
    ],
    'P-3': [
        C('ambience', id=None), spawn('akane', 'iroriAkane', 'right'), C('sit', actor='akane'),
        spawn('haru', 'iroriHaru', 'left'), C('sit', actor='haru'),
        spawn('soichiro', 'iroriDoor', 'left'), C('disappear', actor='soichiro', fade=False),
        prop('irori', 'prop_irori', 'irori', depth=6),
    ],
    'P-4': [
        spawn('akane', 'houseExit', 'right'), C('standUp', actor='akane'), spawn('soichiro', 'forge', 'left'),
        prop('anvil', 'prop_anvil', 'forge', offset=-80, depth=6),
        C('camReset', ms=0), C('fadeIn', duration=0.6),
    ],
    'P-5': [
        spawn('akane', 2990, 'right'), C('mood', to='morning', seconds=0),
        spawn('hana', 3480, 'left'), spawn('dumpling_grandma', 'dumplingShop', 'left'), spawn('village_old_man', 'shrine', 'left'),
        prop('steamer', 'steamer', 4240), prop('shopBasket', 'manju_basket', 4180, depth=9),
        prop('shrine', 'prop_shrine', 3560, depth=4),
        prop('well', 'prop_well', 'well', depth=4),
        C('emoteHold', actor='akane', kind='img:manju_basket'),
    ],
    'P-6': [
        spawn('akane', 4880, 'right'), C('guideWind', to=None), spawn('wanderer', 'gateStone', 'right', tall=True, hat=True), C('sit', actor='wanderer'),
        prop('wandererHat', 'kasa_hat', 'wanderer', head='wanderer', dy=12, depth=9, label=''),
        prop('torii', 'prop_torii', 4960, depth=3), prop('stoneLantern', 'prop_lantern_stone', 5060, depth=3),
        prop('stone', 'prop_stone', 'gateStone', depth=6),
    ],
    'P-7': [
        C('emoteHold', actor='akane', kind='img:manju_basket', on=False), C('objective', text=None),
        spawn('akane', 5790, 'right'), spawn('haru', 'yardHaru', 'left'), C('mood', to='dusk', seconds=0),
        prop('swordRack', 'prop_sword_rack', 5900, depth=3),
    ],
    'P-8': [
        C('mood', to='night', seconds=0), C('vignette', amount=0, seconds=0), C('camReset', ms=0),
        spawn('akane', 'festivalAkane', 'right'), spawn('haru', 'festivalHaru', 'left'), spawn('soichiro', 'festivalSoichiro', 'right'),
        spawn('dumpling_grandma', 7580, 'right'), spawn('hana', 7940, 'left'), C('disappear', actor='wanderer', fade=False),
        C('foreground', preset='lanterns', x='festivalTree'),
        C('treeStage', tree='festival', stage='bare'),
        prop('mask_vm1', 'prop_fox_mask', 'vm1', head='vm1', dy=6, scale=0.5, depth=9, label=''),
        prop('mask_vw1', 'prop_fox_mask', 'vw1', head='vw1', dy=6, scale=0.5, depth=9, label=''),
        prop('mask_vm2', 'prop_fox_mask', 'vm2', head='vm2', dy=6, scale=0.5, depth=9, label=''),
        prop('mask_vw2', 'prop_fox_mask', 'vw2', head='vw2', dy=6, scale=0.5, depth=9, label=''),
        prop('mask_vm3', 'prop_fox_mask', 'vm3', head='vm3', dy=6, scale=0.5, depth=9, label=''),
        prop('mask_vw3', 'prop_fox_mask', 'vw3', head='vw3', dy=6, scale=0.5, depth=9, label=''),
        prop('mask_hana', 'prop_fox_mask', 'hana', head='hana', dy=6, scale=0.5, depth=9, label=''),
        C('light', preset='lantern', at='festivalAkane', id='l1'), C('light', preset='lantern', at='festivalTree', id='l2'),
    ],
    'P-9': [
        spawn('akane', 7910, 'right'),  # 개발 메뉴로 이 장면만 재생할 때도 축제 광장에서
    ],
    'P-10': [
        C('fadeOut', duration=0.5), C('foregroundClear'), C('lightOff'), C('camReset', ms=0),
        C('mood', to='fire', seconds=0), G('mood', mood='fire'),
        spawn('akane', 'roadStart', 'right'),
        prop('pillar', 'stall_burning', 'roadHana', depth=9),
        prop('dbR0', 'prop_debris_fire', 9260, scale=0.7, depth=3, label=''),
        prop('dbR1', 'prop_debris_fire', 9620, scale=0.5, depth=3, label=''),
        prop('dbR2', 'prop_debris_fire', 10180, scale=0.7, depth=3, label=''),
        prop('dbR3', 'prop_debris_fire', 10520, scale=0.5, depth=3, label=''),
        spawn('hana', 'roadHana', 'left'), C('sit', actor='hana'),
        C('ambience', id='fire', every=1.1, volume=0.5),
        C('fadeIn', duration=0.6), C('objective', text='아빠에게'),
    ],
    'P-10b': [
        spawn('akane', 10880, 'right'), spawn('soichiro', 'smithySoichiro', 'left'), C('anim', actor='soichiro', anim='guard', loop=True),
        C('particles', preset='embers', at='smithySoichiro', id='smithyEmbers'),
    ],
    'P-11': [
        spawn('akane', 12240, 'right'), C('particlesStop', id='smithyEmbers'), spawn('haru', 'fireHaru', 'right'), C('pose', actor='haru', pose='guard'),
        G('bossLook', color=None, show=True, x=13450, face=-1),
        C('treeStage', tree='burning', stage='burning'),
        prop('dbP0', 'prop_debris_fire', 12080, scale=0.7, depth=3, label=''),
        prop('dbP1', 'prop_debris_fire', 12420, scale=0.5, depth=3, label=''),
        prop('dbP2', 'prop_debris_fire', 13250, scale=0.7, depth=3, label=''),
        prop('dbP3', 'prop_debris_fire', 13520, scale=0.5, depth=3, label=''),
    ],
    'P-12': [
        C('desaturate', amount=0, seconds=0), C('vignette', amount=0, seconds=0), C('foregroundClear'), C('particlesStop'),
        C('mood', to='cave', seconds=0), G('mood', mood=None), C('camReset', ms=0), C('camTilt', y=0, ms=10),
        G('revive', at='caveAkane'), spawn('akane', 'caveAkane', 'left'), C('pose', actor='akane', pose='down'),
        G('bossLook', show=False),
        spawn('hana', 'caveHana', 'right'), C('sit', actor='hana'),
        prop('mask', 'mask_broken', 15440),
        prop('wp1', 'prop_petal', 15780, color='#7a5530', label=''), prop('wp2', 'prop_petal', 15860, color='#7a5530', label=''),
        prop('wp3', 'prop_petal', 15900, color='#6a4a2a', label=''),
        C('camPan', x=15760, seconds=0.01),
    ],
    'P-13': [
        C('mood', to='ash', seconds=0), C('camReset', ms=0), G('bossLook', show=False),
        spawn('akane', 5330, 'left'), C('standUp', actor='akane'),
        C('disappear', actor='hana', fade=False), C('disappear', actor='dumpling_grandma', fade=False),
        C('disappear', actor='village_old_man', fade=False), C('disappear', actor='wanderer', fade=False),
        C('propOff', id='steamer'), C('propOff', id='sapling'),
        prop('ashSteamer', 'steamer', 4240, tint='#3a3230', label='타 버린 찜통'),
        prop('ashLantern', 'prop_lantern_fallen', 3560, w=60, h=20, color='#4a4a48', label='쓰러진 석등'),
        prop('ashHammer', 'prop_hammer', 'forge'),
        prop('ashSapling', 'sapling_burnt', 'sapling'),
        C('particles', preset='rain', id='rain'), C('ambience', id='rain', every=1.4, volume=0.5),
        C('fadeIn', duration=1),
    ],
    'P-14': [
        C('stageBg', id='plaza', key='bg_pro_grave'), C('camReset', ms=0), G('bossLook', show=False),
        C('mood', to='ash', seconds=0), C('desaturate', amount=0.6, seconds=0),
        C('treeStage', tree='burning', stage='burnt'),  # 큰 벚나무 3단계: 검게 탄
        prop('haruSword', 'prop_haru_sword', 12830), prop('hairpin', 'kanzashi', 12800),
        spawn('akane', 12560, 'right'), C('standUp', actor='akane'),
        C('disappear', actor='haru', fade=False), C('disappear', actor='soichiro', fade=False),
        C('particles', preset='rain', id='rain'),
    ],
}

AFTER = {
    'P-0': [C('foregroundClear'), C('particlesStop'), C('vignette', amount=0, seconds=0), G('bossLook', color=None, show=False)],
    'P-2': [C('fadeOut', duration=0.8)],
    'P-3': [C('fadeOut', duration=0.8)],
    'P-6': [C('emoteHold', actor='akane', kind='img:manju_basket', on=False)],
    'P-10b': [C('particlesStop')],
    'P-13': [C('fadeOut', duration=1)],
}

INSPECT_AT = {
    'P-1:1': 120, 'P-1:2': 520, 'P-1:3': 700,
    'P-5:1': 'shrine', 'P-5:2': 'well',
    'P-13:1': 'gateStone', 'P-13:2': 'dumplingShop', 'P-13:3': 3560, 'P-13:4': 'forge', 'P-13:5': 'sapling',
}

LINES = {
    'P-0': {
        '완전한 검은 화면. 불 타는 소리만 들린다. 3초.': [
            C('ambience', id='fire', every=0.9, volume=0.7), wait(3)],
        '페이드인. 아주 낮은 시점. 불타는 광장 바닥에 아카네가 쓰러져 있다. 눈이 반쯤 떠져 있다. 화면 앞쪽은 흐릿한 불길.': [
            *FRAME_P0, C('fadeIn', duration=1.4), act('akane', '눈이 반쯤 떠져 있다', 1.6)],
        '아카네의 시선 끝: 칼을 든 하루의 뒷모습. 그 너머 불길 속 흰 머리 사내의 실루엣. 얼굴은 보이지 않는다.': [
            C('camPan', x=12900, seconds=1.8), act('haru', '칼을 든 뒷모습', 1.2), wait(0.8)],
        '하루가 고개를 반쯤 돌려 아카네를 본다. 입술이 움직이지만 소리는 없다.': [
            face('haru', 'akane'), act('haru', '입술이 움직인다 — 소리 없음', 2.0)],
        '꽃잎 한 장이 아카네의 뺨 위로 떨어진다. 꽃잎 끝에 불이 붙어 재가 된다.': [
            C('camPan', x='fireAkaneDown', seconds=0.9),
            prop('p0petal', 'prop_petal', 'fireAkaneDown', dy=-180, offset=12, depth=12, label=''),
            C('propMove', id='p0petal', dy=160, angle=200, seconds=2.2),
            C('propTint', id='p0petal', color='#ff5a20', seconds=0.4), C('propTint', id='p0petal', color='#444444', alpha=0, seconds=0.7),
            C('propOff', id='p0petal')],
        '컷. 검은 화면. 완전한 침묵 2초.': [
            C('fadeOut', duration=0), C('silence'), wait(2)],
        '검은 화면 속에서 하루의 자장가 흥얼거림이 따뜻하게 들려온다. 가사 자막.': [
            C('hum', speaker='haru', lines=LULLABY)],
    },
    'P-1': {
        '장지문 사이로 아침 햇살. 아카네가 이불 속에서 자고 있다. 멀리서 망치 소리, 가까이 부엌에서 하루의 자장가.': [
            C('fadeIn', duration=1.4), C('light', preset='lantern', x=480, y=300, id='sun'), act('akane', '이불 속에서 자고 있다', 1.6),
            C('ambience', id='hammer', every=2.2, volume=0.2), C('hum', speaker='haru', lines=LULLABY, wait=False)],
        '아카네가 뒤척이다 일어나 앉는다. 하품. 머리끈을 입에 물고 포니테일을 묶는다.': [
            act('akane', '뒤척인다', 1.0), C('sit', actor='akane'), act('akane', '하품', 1.0),
            act('akane', '머리끈을 입에 물고 포니테일을 묶는다', 2.0, anim='player_tie_hair')],
        '방 안을 걸을 수 있다. 오른쪽 문이 은은하게 빛난다.': [
            C('standUp', actor='akane'), C('lightOff', id='sun'), C('exitGlow', x='roomDoor')],
    },
    'P-2': {
        '마당 한구석, 무릎 높이의 죽은 벚나무 묘목. 아카네가 다가가면 머리 위에 손바닥 아이콘.': [
            C('waitForPlayerAt', x='sapling', offset=-70), C('emote', actor='akane', kind='palm', seconds=1.2)],
        '아카네가 쪼그려 앉아 묘목에 손바닥을 댄다. 숨을 고른다. 아무 일도 없다.': [
            move('akane', 'sapling', offset=-34), face('akane', 'right'), C('sit', actor='akane'),
            act('akane', '묘목에 손바닥을 댄다 · 숨을 고른다', 2.0), wait(1.0)],
        '다시 댄다. 손끝에서 분홍 빛 한 점이 반짝이다가 꺼진다.': [
            act('akane', '다시 댄다', 1.0), prop('spark', 'prop_glow', 'sapling', dy=-24, w=4, h=4, color='#ff9eb8', label='', depth=12, fade=0.3),
            sfx('chime', volume=0.25), C('propOff', id='spark', fade=0.6)],
        '뒤에서 하루가 다가온다. 앞치마 차림. 아카네가 놀라 손을 뗀다.': [
            C('appear', actor='haru', fade=0.4), move('haru', 'akane', near=True), act('haru', '앞치마 차림', 1.0, wait=False),
            C('emote', actor='akane', kind='!'), face('akane', 'haru')],
        '하루가 옆에 쪼그려 앉아 아카네의 손 위에 자기 손을 겹친다. 묘목은 여전히 그대로다.': [
            face('haru', 'right'), C('sit', actor='haru'), act('haru', '아카네의 손 위에 자기 손을 겹친다', 1.8)],
        '하루가 아카네의 머리를 헝클어뜨리고 일어난다.': [
            act('haru', '아카네의 머리를 헝클어뜨린다', 1.2), C('standUp', actor='haru')],
        '아카네의 귀가 살짝 움직인다 (스프라이트 귀 까딱 1프레임).': [
            act('akane', '귀 까딱', 0.7, anim='player_ear_twitch'), C('standUp', actor='akane')],
    },
    'P-3': {
        '레터박스. 이로리(화로) 앞 밥상. 하루와 아카네가 마주 앉아 있다. 문이 열리고 얼굴에 그을음이 묻은 소이치로가 들어온다. 등 뒤로 뭔가를 숨기고 있다.': [
            C('camPan', x='irori', seconds=0.01), C('fadeIn', duration=0.8), wait(0.6), sfx('clack', volume=0.6),
            C('appear', actor='soichiro', fade=0.4), move('soichiro', 14660), face('soichiro', 'akane'),
            act('soichiro', '그을음 묻은 얼굴 · 등 뒤로 뭔가를 숨긴다', 1.6)],
        '셋이 동시에 웃는다. 아카네의 초상화가 처음으로 활짝 웃는 얼굴로 바뀐다 (1초).': [
            C('emote', actor='haru', kind='note', wait=False), C('emote', actor='soichiro', kind='note', wait=False),
            C('emote', actor='akane', kind='heart'), C('cutIn', speaker='akane', face='smile', hold=1.0)],
        '아카네가 밥그릇을 들 때, 카메라가 하루 쪽으로 천천히 이동한다. 하루가 소매 안의 접힌 편지를 손끝으로 만지작거리고 있다. 편지 위에 카메라가 0.8초 머문다. 아무도 그것에 대해 말하지 않는다.': [
            act('akane', '밥그릇을 든다', 1.0, wait=False),
            prop('letter', 'prop_letter', 'iroriHaru', dy=-34, offset=-12, depth=12),
            C('camPan', x='iroriHaru', seconds=2.0), C('camZoom', zoom=2, seconds=0.8),
            act('haru', '소매 속 접힌 편지를 만지작거린다', 1.2), wait(0.8),
            C('camZoom', zoom=1, seconds=0.6), C('propOff', id='letter'), C('camPan', x='irori', seconds=0.8)],
    },
    'P-4': {
        '집을 나서면 오른쪽에서 망치 소리. 가까이 갈수록 커진다.': [
            C('ambience', id='hammer', every=1.4, volume=0.3), C('objective', text='대장간으로'),
            C('waitForPlayerAt', x=2150), C('ambience', id='hammer', every=1.2, volume=0.6),
            C('waitForPlayerAt', x='forgeFront'), C('ambience', id='hammer', every=1.0, volume=0.95)],
        '대장간 안. 소이치로가 마지막 담금질을 한다. 칼날이 물에 들어가는 순간 치익 소리, 하얀 김이 화면을 채운다.': [
            C('ambience', id=None), C('objective', text=None), face('akane', 'soichiro'),
            act('soichiro', '마지막 담금질', 1.6, anim='soichiro_forge'), sfx('steam'),
            C('particles', preset='steam', at='forge', seconds=2.5), C('flash', color='white', ms=900), wait(0.8)],
        '소이치로가 검은 칼집의 칼을 두 손으로 내민다. 칼 획득 연출 (화면 정지, 칼이 떠오르며 회전, 빛이 칼날을 훑음). 붓 자막 〈칼을 얻었다〉.': [
            C('anim', actor='soichiro', anim='give'), act('soichiro', '검은 칼집의 칼을 두 손으로 내민다', 1.2),
            C('flash', color='gold', ms=400), prop('giftSword', 'prop_katana', 0, screen={'x': 480, 'y': 300}, depth=40, scale=2),
            C('propMove', id='giftSword', y=250, angle=360, seconds=1.2), sfx('ui_confirm'),
            C('caption', text='칼을 얻었다'), C('propOff', id='giftSword', fade=0.4),
            C('giveItem', name='아카네의 칼 (이름 없음)')],
        '아카네가 칼을 처음 반쯤 뽑는다. 컷인: 칼날에 비친 아카네의 붉은 눈.': [
            act('akane', '칼을 처음 반쯤 뽑는다', 0.9, anim='player_iaido_ready'), sfx('draw'),
            C('cutIn', speaker='akane', face='angry', hold=0.9)],
        '이후 아카네 스프라이트가 칼 찬 버전으로 바뀐다. 목표 자막 〈만두 가게로〉.': [
            C('setFlag', flag='akaneSword', value=True), act('akane', '칼을 허리에 찬다', 0.8), C('objective', text='만두 가게로')],
    },
    'P-5': {
        '밝은 아침 마을. 축제 준비로 사람들이 등롱을 걸고 있다. 아카네 머리 위에 작은 바구니 아이콘 (심부름 중 표시). 오른쪽으로 꽃잎이 흐른다.': [
            C('foreground', preset='lanterns', x=3400), act('village_old_man', '등롱을 건다', 1.6, wait=False),
            C('guideWind', to='dumplingShop', kind='petals')],
        '마을 아이 하나가 고양이귀 가면을 흔들며 달려온다.': [
            C('waitForPlayerAt', x=3150), move('hana', 'akane', 'run', near=True), act('hana', '고양이귀 가면을 흔든다', 1.0)],
        '하나가 달려간다. 아카네가 그 뒷모습을 잠깐 본다.': [
            move('hana', 2960, 'run', wait=False), face('akane', 'hana'), wait(1.2), C('disappear', actor='hana', fade=0.6, wait=False)],
        '만두 가게. 김이 오르는 찜통. 할머니가 바구니에 만두를 담는다.': [
            C('waitForPlayerAt', x='dumplingShop', offset=-90), C('particles', preset='steam', at=4240, seconds=6),
            face('akane', 'dumpling_grandma'), act('dumpling_grandma', '바구니에 만두를 담는다', 1.4)],
        '목표 자막 〈연습장으로 — 마을 입구 쪽 길〉.': [
            C('objective', text='연습장으로 — 마을 입구 쪽 길'), C('guideWind', to='gateAkane', kind='petals'), C('foregroundClear')],
    },
    'P-6': {
        '작은 돌 도리이와 석등이 서 있는 마을 입구. 그 옆 돌 위에 삿갓을 깊게 눌러쓴 나그네가 앉아 있다. 회색 여행 망토. 얼굴은 삿갓 그림자에 가려 입가만 보인다. 그는 멀리 광장의 큰 나무를 보고 있다.': [
            C('camPan', x='gateStone', seconds=1.6),
            act('wanderer', '회색 여행 망토 · 삿갓 그림자에 입가만 보인다 · 멀리 광장의 큰 나무를 본다', 2.2)],
        '아카네가 다가가면 레터박스. BGM이 조용히 빠진다.': [
            move('akane', 'gateAkane'), C('bgm', id=None, fade=2), C('bgmDuck', on=True), face('akane', 'wanderer'),
            C('camFollow', actor='akane')],
        '3초 침묵. 아카네가 바구니를 내려다본다. 머뭇거리다가 만두 하나를 꺼내 내민다.': [
            wait(3), act('akane', '바구니를 내려다본다', 1.2), C('emote', actor='akane', kind='…'),
            act('akane', '만두 하나를 꺼내 내민다', 1.4)],
        '나그네가 만두를 받아 한참 내려다본다.': [
            face('wanderer', 'akane'), act('wanderer', '만두를 받아 한참 내려다본다', 2.2)],
        '긴 침묵. 나그네의 입가가 아주 조금 올라간다.': [
            wait(2.5), act('wanderer', '입가가 아주 조금 올라간다', 1.4)],
        '나그네가 일어선다. 바람이 불어 삿갓 끝이 들린다. 컷인 0.3초: 삿갓 아래로 흘러내린 흰 머리카락 한 가닥.': [
            C('standUp', actor='wanderer'), sfx('wind'), C('particles', preset='petals', dir=1, seconds=2),
            act('wanderer', '삿갓 끝이 들린다', 0.6),
            C('cutIn', speaker='wanderer', hold=0.3, image='cutin_wanderer_hair', label='삿갓 아래 흘러내린 흰 머리카락 한 가닥')],
        '나그네가 숲길로 걸어 사라진다. 그가 앉았던 돌 위에 꽃잎 한 장이 떨어지는데, 닿는 순간 갈색으로 시든다. 아카네는 보지 못한다. 플레이어만 본다.': [
            par(seq(move('wanderer', 'forestPath'), C('disappear', actor='wanderer', fade=1.0)),
                seq(wait(1.2), face('akane', 'left'))),
            C('camPan', x='gateStone', seconds=0.8),
            prop('witheredPetal', 'prop_petal', 'gateStone', dy=-170, depth=12, label=''),
            C('propMove', id='witheredPetal', dy=150, angle=160, seconds=2.2),
            C('propTint', id='witheredPetal', color='#7a5530', seconds=0.35), wait(1.0), C('camFollow', actor='akane'),
            C('bgmDuck', on=False)],
    },
    'P-7': {
        '튜토리얼. 글자 설명 없이 하루의 대사와 머리 위 행동 아이콘으로만 가르친다.': [
            C('section', title='튜토리얼: 글자 없이 하루의 대사 + 머리 위 행동 아이콘 (gameplay tutorialIcon)')],
        '낮은 돌담 — 점프 아이콘. 하루: "검은 발에서 시작해. 발이 늦으면 칼도 늦어."': [
            move('haru', 'haruWall', wait=False), G('tutorialIcon', step='move'),
            say('haru', '검은 발에서 시작해. 발이 늦으면 칼도 늦어.', 'serious'),
            G('tutorialIcon', step='jump'), C('jump', actor='haru', x=6480), move('haru', 'haruDrill', wait=False)],
        '허수아비 셋 — 대쉬 베기 아이콘. 하루: "상대 품으로 단숨에 파고들어서, 지나가며 베는 거야. 그 짧은 순간엔 아무것도 너를 못 건드려."': [
            say('haru', '상대 품으로 단숨에 파고들어서, 지나가며 베는 거야. 그 짧은 순간엔 아무것도 너를 못 건드려.', 'smile'),
            G('tutorialIcon', step='dashSlash', zoomOnThird=True)],
        '벨 때마다 칼에 꽃잎이 하나씩 붙는다. 세 번째에 카메라가 살짝 줌인.': [
            C('section', title='대쉬베기 단계에 포함: 벨 때마다 꽃잎 스택, 세 번째 허수아비에서 줌인')],
        '발도 아이콘. 하루가 목검을 치켜든다 (끝에 별빛 예고). 패링 성공할 때까지 반복.': [
            G('tutorialIcon', step='iaido'), face('haru', 'akane'), C('pose', actor='haru', pose='guard'),
            act('haru', '목검을 치켜든다 (끝에 별빛)', 1.0), C('particles', preset='sparks', at='haru')],
        '하루가 목검을 내려놓고 품에서 작은 붉은 방울을 꺼낸다. 아이템 획득 연출. 붓 자막 〈붉은 방울〉.': [
            C('pose', actor='haru', pose='idle'), move('haru', 'akane', near=True),
            act('haru', '목검을 내려놓고 품에서 작은 붉은 방울을 꺼낸다', 1.6), C('flash', color='gold', ms=400),
            prop('giftBell', 'bell_red', 0, screen={'x': 480, 'y': 300}, depth=40, scale=3),
            C('propMove', id='giftBell', y=270, seconds=0.8), sfx('chime', volume=0.6), C('caption', text='붉은 방울'),
            C('propOff', id='giftBell', fade=0.4), C('giveItem', name='붉은 방울')],
        '하루가 아카네의 머리끈에 방울을 묶어 준다. 딸랑. 이후 아카네가 점프할 때마다 아주 작게 방울 소리가 난다.': [
            act('haru', '아카네의 머리끈에 방울을 묶어 준다', 1.6), sfx('chime', volume=0.5)],
        '해가 지기 시작한다. 색감이 주황으로 짙어진다.': [
            C('mood', to='duskDeep', seconds=2.5)],
        '하루가 들고 있던 목검이 땅에 떨어진다. 딱. BGM이 끊긴다. 바람 소리.': [
            prop('woodSword', 'prop_wooden_sword', 'haru', dy=-46, offset=10, w=44, h=6, color='#a08060', label=''),
            C('propMove', id='woodSword', dy=46, angle=80, seconds=0.3, ease='Quad.easeIn'), sfx('clack'),
            C('silence'), sfx('wind'), C('emote', actor='haru', kind='!')],
        '하루가 아무 말 없이 마을 입구 쪽을 본다. 3초. 하루의 초상화가 아주 잠깐 겁먹음으로 바뀌었다가 웃음으로 돌아온다.': [
            face('haru', 'left'), wait(3), C('cutIn', speaker='haru', face='scared', hold=0.35)],
        '색감이 주황 → 남색으로 2초 동안 바뀌고 암전. 붓 자막 〈그날 밤, 벚꽃 축제.〉 피리와 북 소리 페이드인.': [
            C('mood', to='night', seconds=2), wait(2), C('fadeOut', duration=0.8), C('propOff', id='woodSword'),
            C('caption', text='그날 밤, 벚꽃 축제.'),
            C('ambience', id='pipe', every=2.4, volume=0.35), C('ambience', id='drum', every=1.2, volume=0.3)],
    },
    'P-8': {
        '등롱이 줄지어 흔들리고 고양이귀 가면을 쓴 마을 사람들이 춤춘다. 하나가 가면을 쓰고 아카네 주위를 맴돈다. 만두 할머니가 손을 흔든다. 소이치로가 그을음을 씻은 얼굴로 서 있다.': [
            C('fadeIn', duration=1.0),
            par(seq(move('hana', 'akane', 'run', offset=70), move('hana', 'akane', 'run', offset=-70), move('hana', 'akane', 'run', offset=60)),
                act('hana', '가면을 쓰고 아카네 주위를 맴돈다', 1.6, wait=False)),
            act('dumpling_grandma', '손을 흔든다', 1.4, wait=False), act('soichiro', '그을음을 씻은 얼굴', 1.4, wait=False), wait(1.6)],
        '하루가 큰 벚나무 앞에 선다. 카메라가 나무로 패닝하며 줌인. 하루의 손에서 분홍 빛이 줄기를 타고 오르고, 꼭대기에 닿는 순간 나무가 만개한다. 꽃잎 폭발, 환호성.': [
            move('haru', 'festivalTree', offset=-30), face('haru', 'right'),
            C('camPan', x='festivalTree', seconds=1.4), C('camZoom', zoom=2, seconds=1.0),
            prop('rise', 'prop_glow', 'festivalTree', dy=-20, w=6, h=6, color='#ff9eb8', label='', depth=12),
            C('propMove', id='rise', dy=-260, seconds=1.4, ease='Sine.easeIn'), C('propOff', id='rise'),
            G('bloomTree', tree='festival'), C('treeStage', tree='festival', stage='bloom'), C('particles', preset='petals', seconds=3), sfx('cheer'), G('cheer'),
            C('camZoom', zoom=1, seconds=0.8), C('camFollow', actor='akane')],
        '하루가 아카네의 손을 낮게 늘어진 가지에 올리고, 그 위에 자기 손을 겹친다.': [
            move('akane', 'festivalTree', offset=-90), face('akane', 'right'), face('haru', 'akane'),
            act('haru', '아카네의 손을 낮은 가지에 올리고 자기 손을 겹친다', 1.8)],
        '모든 소리가 작아진다. 두 손 사이로 빛이 스민다. CG A 페이드인: 가지 위에 겹친 두 손, 아카네 손바닥 아래에서 막 벌어지는 꽃 한 송이.': [
            C('ambience', id=None), C('bgmDuck', on=True),
            prop('handGlow', 'prop_glow', 'festivalTree', offset=-60, dy=-70, w=10, h=10, color='#ffd0e0', label='', depth=12, fade=0.6),
            C('cg', no='A', desc='가지 위에 겹친 두 손, 아카네 손바닥 아래에서 막 벌어지는 꽃 한 송이')],
        'CG A 페이드아웃. 하나가 누구보다 크게 손뼉 친다.': [
            C('cgEnd'), C('propOff', id='handGlow'),
            prop('flower', 'prop_flower', 'festivalTree', offset=-60, dy=-74, depth=12),
            act('hana', '누구보다 크게 손뼉 친다', 1.2), sfx('cheer', volume=0.6), C('emote', actor='hana', kind='!')],
        '소이치로가 다가와 셋이 나무 아래 앉는다. CG 1 페이드인 (축제 밤의 가족).': [
            move('soichiro', 'akane', near=True), par(C('sit', actor='akane'), C('sit', actor='haru'), C('sit', actor='soichiro')),
            C('cg', no=1)],
        'CG 1 페이드아웃. 하루가 문득 고개를 든다. 광장 끝 등롱 빛이 닿지 않는 어둠 속에 삿갓 하나가 서 있다. 깜빡하면 사라진다.': [
            C('cgEnd'), act('haru', '문득 고개를 든다', 1.0),
            spawn('wanderer', 'festivalEdge', 'left', tall=True, hat=True),
            prop('wandererHat', 'kasa_hat', 'wanderer', head='wanderer', dy=12, depth=9, label=''),
            par(C('camPan', to='festivalEdge', ms=800, hold=0.7), seq(wait(1.3), C('disappear', actor='wanderer', fade=0.12)))],
        '음악이 작아지고 두 사람에게 줌인, 비네트.': [
            C('ambience', id=None), C('bgmDuck', on=True), C('camPan', x='festivalTree', offset=-60, seconds=0.8),
            C('camZoom', zoom=2, seconds=1.0), C('vignette', amount=0.6, seconds=1.0)],
    },
    'P-9': {
        '깊은 절 종소리 "댕—". 축제 음악이 늘어지며 멈춘다. 춤추던 사람들이 그 자세 그대로 멈춘다.': [
            C('camZoom', zoom=1, seconds=0.6), C('vignette', amount=0, seconds=0.6), sfx('gong'), C('ambience', id=None),
            C('silence'), G('freezeDancers'), wait(1.2)],
        '카메라 줌아웃. 1초 침묵, 바람 소리만. 두 번째 종소리.': [
            C('camZoom', zoom=0.8, seconds=1.0), wait(1), sfx('wind'), sfx('gong'), wait(1)],
        '멀리서 휘파람 같은 소리가 커진다. 카메라가 하늘로 틸트업.': [
            sfx('whistle', volume=0.4), C('camTilt', y=-170, ms=1200), sfx('whistle', volume=1.0)],
        '보름달 앞을 지나가는 불화살 수십 개의 검은 실루엣. 슬로모션 0.3배 1.5초.': [
            C('slowmo', scale=0.3, seconds=1.5), G('arrowVolley', seconds=1.5)],
        '컷인: 아카네의 눈. 눈동자에 불빛.': [
            C('cutIn', speaker='akane', face='surprised', hold=0.8)],
        '정상 속도로 복귀하며 화살이 땅·지붕·나무에 꽂힌다. 붉은 플래시와 세로 흔들림.': [
            C('camTilt', y=0, ms=400), C('camZoom', zoom=1, seconds=0.4), G('arrowRain'),
            C('flash', color='red'), C('shake', level='strong', dir='v'), sfx('boom')],
        '등롱 줄이 끊어져 떨어지고, 큰 벚나무 꼭대기부터 불이 번진다. 방금 아카네가 피운 꽃 한 송이가 클로즈업되고, 불티가 닿아 재가 된다.': [
            C('foregroundClear'), prop('rope', 'prop_lantern_rope', 'festivalTree', offset=-280, y=340, depth=11),
            C('propMove', id='rope', ground=True, angle=14, seconds=0.6, ease='Quad.easeIn'), sfx('thud'),
            C('treeStage', tree='festival', stage='burning'),
            C('particles', preset='embers', x='festivalTree', y=330, id='treeFire'), C('light', preset='fire', x='festivalTree', y=360, id='treeFire'),
            C('camPan', x='festivalTree', offset=-60, seconds=0.8), C('camZoom', zoom=2, seconds=0.6),
            C('particles', preset='embers', at='festivalTree', id='flowerEmbers'),
            C('propTint', id='flower', color='#3a3a3a', seconds=1.2), C('particles', preset='dust', at='festivalTree'),
            C('propOff', id='flower', fade=0.8), C('particlesStop', id='flowerEmbers'),
            C('camZoom', zoom=1, seconds=0.5), C('camFollow', actor='akane')],
        '색감 남색 → 붉은색. 비명, 불길, 전투 북.': [
            C('mood', to='fire', seconds=1.5), G('mood', mood='fire'), sfx('scream'),
            C('ambience', id='fire', every=1.0, volume=0.6), C('ambience', id='drum', every=0.8, volume=0.6)],
        '하늘에서 삿갓 하나가 천천히 떨어져 광장 한가운데 굴러 멈춘다. 아카네가 그것을 본다.': [
            prop('hat', 'kasa_hat', 'festivalTree', offset=220, y=60, depth=11),
            C('propMove', id='hat', to='festivalTree', offset=140, ground=True, angle=340, seconds=2.4),
            C('propMove', id='hat', to='festivalTree', offset=60, angle=720, seconds=0.8, ease='Quad.easeOut'),
            face('akane', 'right'), C('emote', actor='akane', kind='!')],
        '지붕 위에 흰 가면 신도들이 하나씩 나타나고 횃불이 왼쪽부터 차례로 켜진다.': [
            *[x for i, px in enumerate((7520, 7700, 7880, 8120, 8300, 8480)) for x in (
                prop(f'roof{i}', 'prop_rooftop_cultist', px, y=360, depth=5, fade=0.3, label='흰 가면 신도' if i == 0 else ''),
                prop(f'flag{i}', 'fx_red_sun', px + 16, y=330, scale=0.12, anim='fx_red_sun_grow', depth=5, label=''),
                C('light', preset='torch', x=px, y=320, id=f'torch{i}'), sfx('fire', volume=0.4), wait(0.25))]],
        '신도 무리가 광장으로 쏟아져 내려오고, 연기가 화면을 덮는다. 연기가 걷히면 아카네 혼자. 하루도 소이치로도 보이지 않는다. 레터박스 해제, 목표 자막 〈아빠에게〉.': [
            par(*[C('propMove', id=f'roof{i}', ground=True, seconds=0.6, ease='Quad.easeIn') for i in range(6)]),
            G('fleeTag', tag='festival'), C('particles', preset='smoke', at='akane', seconds=2),
            *[C('propOff', id=f'flag{i}', fade=0.4, wait=False) for i in range(6)],
            # 불타는 잔해: 불화살 뒤 광장 곳곳
            *[prop(f'dbF{k}', 'prop_debris_fire', x, scale=0.7 if k % 2 == 0 else 0.5, depth=3, label='') for k, x in enumerate((7560, 7760, 8250, 8480))],
            C('fadeOut', duration=0.6), *[C('propOff', id=f'roof{i}') for i in range(6)], C('propOff', id='hat'), C('propOff', id='rope'),
            C('disappear', actor='haru', fade=False), C('disappear', actor='soichiro', fade=False),
            C('disappear', actor='hana', fade=False), C('disappear', actor='dumpling_grandma', fade=False),
            *[C('lightOff', id=f'torch{i}') for i in range(6)], C('fadeIn', duration=0.8),
            act('akane', '혼자 남았다', 1.4), C('mode', mode='play'), C('objective', text='아빠에게')],
    },
    'P-10': {
        '아침에 걸었던 그 길이 불타고 있다. 마을 사람들이 왼쪽으로 도망치고 아카네만 오른쪽으로 거슬러 간다. 바닥에 붉은 원이 깜빡인 뒤 불화살이 꽂힌다.': [
            G('fleeTag', tag='road', dir=-1), G('arrowTraps', every=2.0)],
        '첫 신도를 처음 벨 때만 슬로모션 0.5초와 줌인. 아카네의 손이 떨린다 (스프라이트 1프레임 흔들림).': [
            G('fight', group='road', firstKillSlowmo=0.5), C('tremble', actor='akane', times=3)],
        '만두 가게 앞. 무너진 노점 기둥 밑에 하나가 깔려 울고 있다. 고양이귀 가면이 반쯤 깨져 있다. 기둥 위에 베기 아이콘.': [
            C('waitForPlayerAt', x='roadHana', offset=-130), act('hana', '기둥 밑에 깔려 울고 있다 · 가면이 반쯤 깨져 있다', 1.6, wait=False)],
        '기둥을 베면 하나가 기어 나온다.': [
            G('cutPillar', prop='pillar'), act('hana', '기어 나온다', 1.0), C('standUp', actor='hana'), move('hana', 'akane', 'slow', near=True)],
        '만두 가게가 통째로 무너진다. 흔들림 강. 아카네가 하나를 감싸 안는다.': [
            G('collapse', at='roadHana', offset=60, id='shopRuin'), act('akane', '하나를 감싸 안는다', 1.4)],
        '하나가 뛰어간다. 깨진 가면이 땅에 남는다.': [
            prop('maskOnRoad', 'mask_broken', 'hana'), move('hana', 9000, 'run', wait=False),
            C('disappear', actor='hana', fade=0.8, wait=False)],
    },
    'P-10b': {
        '대장간이 불타고 있다. 소이치로가 망치 하나로 신도 셋을 막고 있다. 어깨에 화살.': [
            G('spawn', group='smithy'), act('soichiro', '망치 하나로 신도 셋을 막는다 · 어깨에 화살', 1.6, wait=False),
            C('light', preset='fire', x='smithySoichiro', y=400, id='smithyFire')],
        '신도들을 벤다. 마지막 신도를 베는 순간 슬로모션.': [
            G('fight', group='smithy', slowmoLast=True)],
        '화면 밖에서 휘파람 소리 두 번. 소이치로의 등에 화살이 꽂힐 때마다 히트스톱, 둔탁한 소리, 화면이 조금씩 탈색된다.': [
            G('arrowTraps', on=False), C('stopAnim', actor='soichiro'),
            sfx('whistle'), G('arrowAt', target='soichiro', **{'from': 'left'}), C('hitStop', seconds=0.14), sfx('thud'), act('soichiro', '등에 화살이 꽂힌다', 0.6),
            C('desaturate', amount=0.15, seconds=0.3), wait(0.6),
            sfx('whistle'), G('arrowAt', target='soichiro', height=36, **{'from': 'left'}), C('hitStop', seconds=0.14), sfx('thud'), act('soichiro', '또 한 대', 0.6),
            C('desaturate', amount=0.3, seconds=0.3), C('kneel', actor='soichiro')],
        '대장간 지붕이 무너지며 불타는 잔해가 둘 사이를 막는다. 흰 플래시. 다시 밝아지면 아카네 혼자. 탈색 30% 유지. 목표 자막 〈엄마에게〉.': [
            G('collapse', at='smithySoichiro', offset=-110, id='roofRuin'), C('flash', color='white', ms=500),
            C('disappear', actor='soichiro', fade=False), C('lightOff', id='smithyFire'), wait(0.6),
            C('objective', text='엄마에게')],
    },
    'P-11': {
        '레터박스. 불타는 큰 벚나무. 하루가 진검을 들고 서 있다. 그 앞, 불길 속에서 흰 머리 사내가 걸어 나온다. 삿갓은 없다. 금빛 고리 장식. 하쿠야.': [
            C('objective', text=None), move('akane', 'fireAkane', 'run'), C('camPan', x='fireHaru', offset=120, seconds=1.2),
            G('bossWalk', to='fireHakuya'), C('particles', preset='embers', at='plazaStump', id='plazaEmbers')],
        '하쿠야가 아카네를 본다. 그리고 웃는다.': [
            G('bossLook', face=-1), C('cutIn', speaker='hakuya', face='laugh', hold=0.6)],
        '레터박스 해제. 보스 이름 붓 자막 〈카미사마 · 하쿠야〉. 체력바가 줄지 않는다. 아카네의 공격은 금빛 막에 튕긴다. 20초 또는 3번 피격 후 자동 진행.': [
            C('mode', mode='play'), C('camFollow', actor='akane'), C('bossName', text='카미사마 · 하쿠야'),
            G('defeatBattle', seconds=20, hits=3), C('mode', mode='auto')],
        '하쿠야의 발도. 흑백 1프레임, 금빛 베기 선. 아카네가 날아가 쓰러진다. (P-0과 같은 시점, 같은 구도로 연결)': [
            C('monoCut', frames=1), G('hakuyaIaido'), *FRAME_P0, G('bossLook', x='fireHakuya', face=-1)],
        '하루가 아카네 앞을 막아선다. 하쿠야의 칼이 하루를 꿰뚫는다. 모든 소리 끊김. 슬로모션 0.2배. 화면 앞쪽으로 커다란 꽃잎 한 장이 천천히 떨어진다. 심장 소리 두 번.': [
            C('pose', actor='haru', pose='idle'), move('haru', 'fireAkaneDown', 'run', offset=70), face('haru', 'right'),
            G('stab', who='haru'), C('silence'), C('ambience', id=None), C('slowmo', scale=0.2, seconds=3),
            prop('bigPetal', 'prop_petal', 0, screen={'x': 560, 'y': -10}, w=64, h=40, depth=45, label=''),
            C('propMove', id='bigPetal', x=430, y=600, angle=200, seconds=3.0, wait=False),
            sfx('heartbeat'), wait(0.8), sfx('heartbeat'), wait(1.2), C('propOff', id='bigPetal')],
        '하루가 무릎 꿇은 채 아카네 쪽으로 손을 뻗는다. 아카네 주위로 꽃잎 수천 장이 소용돌이친다.': [
            C('kneel', actor='haru'), face('haru', 'akane'), act('haru', '아카네 쪽으로 손을 뻗는다', 1.2, anim='haru_reach'),
            G('petalStorm')],
        '바람에 아카네 머리의 방울이 울린다. 딸랑. 하루가 그 소리를 듣고 아주 작게 웃는다.': [
            sfx('wind', volume=0.4), sfx('chime', volume=0.6), act('haru', '아주 작게 웃는다', 1.2)],
        'CG 2 페이드인 (꽃잎에 감싸인 아카네와 손을 뻗은 하루).': [
            C('cg', no=2)],
        '흰 플래시. 꽃잎이 아카네를 싣고 하늘로 날아간다. 카메라가 따라 올라간다. 하쿠야가 손을 뻗지만 꽃잎이 그 손을 벤다.': [
            C('cgEnd'), C('flash', color='white'), C('camTilt', y=-200, ms=1800, wait=False), G('carryAway'),
            G('bossAnim', anim='hakuya_hurt', hold=True)],
        '외침이 메아리처럼 작아진다. 방울 소리만 멀리서 계속 울리다가 끊긴다. 암전. 3초 침묵.': [
            C('ambience', id='chime', every=0.9, volume=0.25), wait(2.4), C('ambience', id=None),
            C('fadeOut', duration=1.2), C('silence'), wait(3)],
    },
    'P-12': {
        '빗소리. 페이드인. 동굴 입구에 아카네가 쓰러져 있다. 주위의 꽃잎은 모두 갈색으로 시들어 있다.': [
            C('particles', preset='rain', id='rain'), C('ambience', id='rain', every=1.4, volume=0.5), C('fadeIn', duration=1.4), wait(0.8)],
        '아카네가 눈을 뜬다. 천천히 일어나 앉는다. 손이 머리끈의 방울에 닿는다.': [
            act('akane', '눈을 뜬다', 1.0), C('sit', actor='akane'), act('akane', '손이 머리끈의 방울에 닿는다', 1.2)],
        '아카네가 방울을 흔든다. 딸랑.': [
            act('akane', '방울을 흔든다', 0.8), sfx('chime', volume=0.7)],
        '아무도 오지 않는다. 빗소리만. 5초 동안 카메라도 움직이지 않는다.': [
            wait(5)],
        '다시 흔든다. 딸랑, 딸랑.': [
            act('akane', '다시 흔든다', 0.6), sfx('chime', volume=0.7), wait(0.35), sfx('chime', volume=0.7)],
        '동굴 안쪽 어둠에서 무언가 움직인다. 하나다. 하나가 깨진 가면을 끌어안고 잠들어 있다. 아카네가 그 옆에 앉아 자기 망토를 덮어 준다. (하나가 살아 있다는 것만 보여 주고, 대사는 없다.)': [
            C('tremble', actor='hana', times=2), act('hana', '움직인다', 0.8), C('camPan', x='caveHana', offset=150, seconds=1.2),
            act('hana', '깨진 가면을 끌어안고 잠들어 있다', 1.6), C('standUp', actor='akane'),
            move('akane', 'caveHana', 'slow', offset=50), face('akane', 'hana'), C('sit', actor='akane'),
            act('akane', '자기 망토를 덮어 준다', 1.6)],
        '아카네가 일어나 비 속으로 걸어 나간다.': [
            C('standUp', actor='akane'), C('camFollow', actor='akane'), move('akane', 'caveExit'), C('fadeOut', duration=1.0)],
    },
    'P-13': {
        'BGM 없음. 빗소리와 발소리뿐. 화면 채도 40%. 공격·대쉬 버튼 아이콘이 회색으로 꺼져 있다.': [
            C('silence'), C('ambience', id='rain', every=1.4, volume=0.5), C('desaturate', amount=0.6, seconds=0.01)],
        '아침에 지나간 길을 거꾸로 걷는다. 장소마다 〔조사〕가 하나씩 있고, 조사하면 그 자리에서 아침에 들었던 대사가 반투명 분홍 글씨로 다시 떠올랐다가 빗물처럼 흘러내린다.': [
            C('objective', text='지나온 길을 거꾸로 — 집 마당까지')],
        '조사를 모두 하지 않아도 광장으로 갈 수 있다. 조사한 개수에 따라 P-14의 아카네 속마음이 한 줄씩 늘어난다.': [
            C('waitForPlayerAt', x='sapling', dir=-1, radius=50), C('objective', text=None)],
    },
    'P-14': {
        '광장. 큰 벚나무는 검게 탄 그루터기만 남았다. 그 아래 진흙 속에 하루의 칼과 붉은 술 장식 비녀가 놓여 있다. 하루와 소이치로의 모습은 보이지 않는다.': [
            C('fadeIn', duration=1.2), C('camPan', x='plazaStump', seconds=1.4), move('akane', 12760, 'slow')],
        '아카네가 비녀를 줍는다. 오래 내려다본다.': [
            act('akane', '비녀를 줍는다', 1.0), C('propOff', id='hairpin'), act('akane', '오래 내려다본다', 2.0)],
        '아카네가 그루터기 옆에 맨손으로 흙을 판다. 망치와 비녀를 묻고, 돌을 쌓아 작은 무덤 두 개를 만든다. 빗줄기가 굵어진다.': [
            C('kneel', actor='akane'), act('akane', '맨손으로 흙을 판다', 2.0), act('akane', '망치와 비녀를 묻는다', 1.4),
            prop('grave1', 'grave_a', 12700, fade=0.6), prop('grave2', 'grave_b', 12735, fade=0.6),
            C('particles', preset='rain', id='rain2'), C('ambience', id='rain', every=1.0, volume=0.7)],
        '아카네가 검게 탄 그루터기에 손바닥을 댄다. 아무 일도 없다. 다시. 아무 일도 없다. 손바닥으로 그루터기를 친다. 한 번, 두 번.': [
            C('standUp', actor='akane'), face('akane', 'right'), act('akane', '그루터기에 손바닥을 댄다', 1.2), wait(0.8),
            act('akane', '다시', 0.8), wait(0.8), act('akane', '손바닥으로 그루터기를 친다', 0.5), sfx('thud'),
            C('shake', level='weak'), wait(0.4), sfx('thud'), C('shake', level='weak')],
        '화면 위쪽에 하루의 마지막 말이 반투명 분홍 글씨로 천천히 떠오른다.': [],  # 다음 〈자막〉이 덮어쓰기 자막의 바탕 글 (변환기)
        '아카네가 일어선다. 칼자루를 쥔다. 분홍 글씨 위로 붉은 글씨가 덮어쓰듯 나타나고, 분홍 글씨가 지워진다.': [
            C('standUp', actor='akane'), act('akane', '칼자루를 쥔다', 1.0)],  # + overwrite (변환기)
        '아카네가 머리끈에서 방울을 풀어 천 조각으로 꽁꽁 감싼다. 이제 흔들어도 소리가 나지 않는다. 그것을 품에 넣는다.': [
            act('akane', '머리끈에서 방울을 푼다', 1.2), prop('bellInHand', 'bell_red', 'akane', offset=14, dy=-34, depth=12, label=''),
            sfx('chime', volume=0.3), act('akane', '천 조각으로 꽁꽁 감싼다', 1.6), C('propOff', id='bellInHand'),
            prop('bellWrapped', 'bell_wrapped', 'akane', offset=14, dy=-30, depth=12, label=''),
            C('setFlag', flag='bellWrapped', value=True), act('akane', '품에 넣는다', 1.0), C('propOff', id='bellWrapped', fade=0.4)],
        'CG B 페이드인: 비 내리는 잿더미, 검은 그루터기 앞 작은 돌무덤 두 개, 그 앞에 무릎 꿇은 아카네의 뒷모습. 오래 머문다. 빗소리 위로 하루의 자장가가 아주 희미하게, 한 소절만.': [
            C('kneel', actor='akane'),
            C('cg', no='B', desc='비 내리는 잿더미, 검은 그루터기 앞 작은 돌무덤 두 개, 그 앞에 무릎 꿇은 아카네의 뒷모습'),
            wait(2.0), C('hum', speaker='haru', lines=LULLABY1, color='rgba(255,183,197,0.6)')],
        '암전. 3초 침묵. 칼 뽑는 소리 한 번.': [
            C('cgEnd'), C('fadeOut', duration=1.0), C('silence'), C('particlesStop'), wait(3), sfx('draw')],
        '로고 문양이 먹물로 그려지듯 나타나고 제목. 메인 테마.': [
            C('titleCard', text='카미사마 복수극', style='logo'), C('bgm', id='main_theme', fade=1)],
    },
}
