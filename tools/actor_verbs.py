"""대본 ▶ 연출 문장 → 배우 명령 (js/actors.js). tools/convert_story.py 가 쓴다.

    actor_commands('하루가 옆에 쪼그려 앉아 …', NAMES) → [{'cmd': 'sit', 'actor': 'haru'}]

문장의 주어(인물 이름 + 이/가/은/는)를 찾고, 동사로 명령을 고른다. 주어가 없거나 아는 동사가 없으면 [] (note 로 남는다).
위치를 문장에서 알 수 없는 이동(예: '숲길로 걸어 사라진다')은 to 를 비워 두고 needs='x' 를 단다 → 보고서의 '위치 필요' 목록.
게임에 넣을 때 맵의 points 이름이나 x 를 채우면 된다.
"""
import re

MODE_WORDS = {'자동': 'auto', '조작': 'play', '느린 조작': 'slow', '조작 가능 컷신': 'play'}


def parse_modes(tag):
    """'자동 → 조작' · '조작 가능 컷신 → 자동' · '자동 · 패배 전투' → (모드 목록, 조작 가능 컷신인지, 덧붙은 말)"""
    flow, extra = [], []
    controllable = False
    for part in [p.strip() for p in tag.split('→')]:
        bits = [b.strip() for b in part.split('·')]
        word = bits[0]
        if word in MODE_WORDS:
            flow.append(MODE_WORDS[word])
            controllable = controllable or word == '조작 가능 컷신'
        else:
            extra.append(word)
        extra += bits[1:]
    return flow, controllable, extra


def _names_re(names):
    alts = '|'.join(re.escape(n) for n in sorted(names, key=len, reverse=True))
    return alts


def find_subjects(s, names):
    """문장의 주어 인물들 (한글 이름 그대로). 'A와 B가' 면 둘"""
    alts = _names_re(names)
    m = re.search(rf'(?:^|[\s,])({alts})(?:와|과) ({alts})(?:이|가|는|은)\s', s)
    if m:
        return [m.group(1), m.group(2)]
    m = re.search(rf'(?:^|[\s,])({alts})(?:이|가|는|은|도)\s', s)
    return [m.group(1)] if m else []


def find_target(s, names, subject):
    """이동·바라보기의 대상 인물: 'X에게' 'X 쪽' 'X 앞' 'X 옆' 'X를 본다'"""
    alts = _names_re(names)
    for pat in (rf'({alts})(?:에게|한테)', rf'다가(?:가|와|간다|온다)\s+({alts})의', rf'({alts}) (?:쪽|앞|옆|곁)', rf'({alts})(?:을|를) (?:본다|바라본다|돌아본다|쳐다본다)',
                rf'(?:돌려|돌아) ({alts})(?:을|를)'):
        m = re.search(pat, s)
        if m and m.group(1) != subject:
            return m.group(1)
    return None


def actor_commands(sentence, names):
    """한 문장 → 배우 명령 목록. names: {한글 이름: id}"""
    s = sentence.strip()
    subs = find_subjects(s, names)
    if not subs:
        return []
    # '아카네가 다가가면 …' 처럼 조건으로 시작하는 문장은 플레이어 행동 (게임 쪽 트리거)
    if re.search(r'(다가가|다가오|가까이 가|도착하)면', s):
        return []
    # '대나무를 베면 아카네가 …' 처럼 주어 앞에 조건절(…면)이 있으면 그 인물의 동작이 아니다
    pos = s.find(subs[0])
    if re.search(r'\S면[\s,]', s[:pos]):
        return []
    out = []
    ids = [names[n] for n in subs]
    a = ids[0]
    tgt = find_target(s, names, subs[0])
    tid = names[tgt] if tgt else None

    # 자세 (일어서기는 이동 앞, 앉기는 이동 뒤: '걸어와 앉는다')
    pre, post = [], []
    if re.search(r'일어나 앉|일어나서 앉', s) or re.search(r'앉는다|앉아|쪼그려|주저앉', s):
        post += [{'cmd': 'sit', 'actor': x} for x in ids]
    elif re.search(r'무릎(?:을)? 꿇', s):
        post += [{'cmd': 'kneel', 'actor': x} for x in ids]
    elif re.search(r'일어선다|일어난다|일어나[^ 앉]|일어나 |몸을 일으', s):
        pre.append({'cmd': 'standUp', 'actor': a})
    out += pre
    # 이동
    mv = re.search(r'(걸어|달려|뛰어|걸어 나가|뛰어나가|천천히 걸어)\s?(간다|온다|나간다|나온다|들어온다|들어간다|사라진다|가 버린다|나가)|다가온다|다가간다|다가와|다가가|달려온다|달려간다|뛰어온다|뛰어간다|걸어와|달려와|뛰어와', s)
    if mv:
        speed = 'run' if re.search(r'달려|뛰어', s) else 'slow' if '천천히' in s else 'walk'
        c = {'cmd': 'moveTo', 'actor': a, 'speed': speed}
        if tid:
            c.update(to=tid, near=True)
        elif re.search(r'다가온다|다가와|(?:걸어|달려|뛰어)\s?(?:온다|와)', s) and a != 'akane':
            c.update(to='akane', near=True)  # 대상 없이 '다가온다·달려온다' = 주인공에게
        else:
            c['needs'] = 'x'  # 어디로 가는지 맵 위치가 필요
        out.append(c)
        if '사라진다' in s or '가 버린다' in s:
            out.append({'cmd': 'disappear', 'actor': a, 'fade': 0.6})
    out += post
    if re.search(r'쓰러진다|쓰러져 있다', s) and not out:
        out.append({'cmd': 'pose', 'actor': a, 'pose': 'down'})
    # 나타나기 · 사라지기 (이동과 따로)
    if not mv:
        if re.search(r'사라진다|모습을 감춘다', s):
            out.append({'cmd': 'disappear', 'actor': a, 'fade': 0.6})
        elif re.search(r'나타난다|모습을 드러낸다|들어온다|등장', s):
            out.append({'cmd': 'appear', 'actor': a, 'fade': 0.5})
    # 바라보기
    if tid and re.search(r'본다|바라본다|돌아본다|쳐다본다|돌려', s):
        out.append({'cmd': 'face', 'actor': a, 'dir': tid})
    elif re.search(r'돌아본다|뒤돌아', s) and a != 'akane':
        out.append({'cmd': 'face', 'actor': a, 'dir': 'akane'})
    elif re.search(r'마주 (?:보|앉|서)', s) and len(ids) == 2:
        out += [{'cmd': 'face', 'actor': ids[0], 'dir': ids[1]}, {'cmd': 'face', 'actor': ids[1], 'dir': ids[0]}]
    # 머리 위 감정 아이콘
    for pat, kind in ((r'놀라|놀란다|움찔', '!'), (r'갸웃|어리둥절', '?'), (r'머뭇|망설|한숨|말없이|침묵', '…'),
                      (r'식은땀|땀을', 'sweat'), (r'흥얼', 'note')):
        if re.search(pat, s):
            out.append({'cmd': 'emote', 'actor': a, 'kind': kind})
            break
    return out
