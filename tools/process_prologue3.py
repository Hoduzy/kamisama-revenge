"""프롤로그 그림 3차 묶음: 칼 없는 아카네 · 하루/하나/아카네 손 동작 · 소품 시트 2 · 삿갓 흰머리 컷인
(+ 이미 있는 그림으로 만드는 것: 지붕 위 신도 실루엣, 등롱 줄)

    python3 tools/process_prologue3.py

원본: assets/raw/<원래 이름>.png (이름 대응은 FILES). 결과는 manifest.json 에 바로 넣는다.
크기는 기존 시트와 같은 키로 맞춘다 (칼 없는 아카네 = 칼 찬 아카네와 같은 그림 크기, 하루 = haru_idle, 하나 = villager_child,
아카네 손 동작 = akane_emote1 정좌 키). 소품은 새 프롤로그 소품 시트(props/)와 같은 배율.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
import process_sprites as ps  # noqa: E402
import process_prologue as pp  # noqa: E402
from process_props import blobs  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / 'assets/raw'
OUT = ROOT / 'assets/sprites'

# 원래 파일 → 새 이름, 판단 근거
FILES = {
    'CEC6ABFB-2AAE-4F8B-8D76-BE2C55A47C23': ('player_idle_nosword', '칼 없이 서 있는 아카네 4칸'),
    'B0A8903B-2FB8-4179-8A4A-AFF493A8E49D': ('player_walk_nosword + player_run_nosword', '칼 없는 아카네 걷기 6 + 달리기 6'),
    '731B05A5-0FCE-436C-8965-4224613BFA76': ('player_jump_nosword', '칼 없는 아카네 점프 6칸 (웅크림 → 착지)'),
    'F4C71650-BE62-48D5-9876-558426334AD7': ('haru_gesture', '선 하루: 손 내밀어 머리 헝클기 4, 방울 들고 묶기 4'),
    '4E5F6F93-66EF-429D-AA51-A08888254E1A': ('hana_actions', '하나: 가면 흔들기 4, 깔려 울기 2, 기어 나오기 4, 안겨 울기 2'),
    '402484DE-E596-479E-B159-4282D95D37AC': ('akane_gesture', '무릎 꿇은 아카네: 팔 벌려 안기 3, 방울 풀어 천으로 감싸기 4, 품에 넣기 3'),
    '10B6081D-1681-4893-B8E3-C164F165FE44': ('props/ (소품 8)', '편지 · 목검 · 꽃 한 송이 · 망치 / 하루의 칼 · 켜진 등롱 · 찢긴 등롱 · 줄 조각'),
    '4B813E01-0E0D-4F49-BC8C-396752B3DF32': ('cutin_traveler_hair', '삿갓 아래로 흘러내린 흰 머리카락 클로즈업 (컷인)'),
}
PROP_NAMES = ['letter', 'bokken', 'blossom_single', 'hammer', 'haru_katana', 'lantern_lit', 'lantern_torn', 'rope_segment']
PROP_DOT = 7.86  # 새 프롤로그 소품 시트(props/)와 같은 배율 — tools/process_prologue2.py 의 삿갓 폭 기준

# 시트: (이름, 원본, 칸 수, 바라보는 방향, 크기 기준(높이 px 를 무엇과 맞출지), 애니메이션)
SHEETS = [
    ('player_idle_nosword', 'CEC6ABFB-2AAE-4F8B-8D76-BE2C55A47C23', 4, 'right', ('all', 82),
     {'player_idle_nosword': ([0, 1, 2, 3], 6, True)}),
    ('player_jump_nosword', '731B05A5-0FCE-436C-8965-4224613BFA76', 6, 'right', ('match', 'player_jump'), {}),
    ('haru_gesture', 'F4C71650-BE62-48D5-9876-558426334AD7', 8, 'left', ('all', 97),
     {'haru_ruffle': ([0, 1, 2, 3], 5, False), 'haru_tie_bell': ([4, 5, 6, 7], 4, False), 'haru_take_bell': ([4, 5], 3, False)}),
    ('hana_actions', '4E5F6F93-66EF-429D-AA51-A08888254E1A', 12, 'right', ('first', 4, 'villager_child'),
     {'hana_wave_mask': ([0, 1, 2, 3], 6, True), 'hana_trapped': ([4, 5], 3, True),
      'hana_crawl': ([6, 7, 8, 9], 4, False), 'hana_cry': ([10, 11], 3, True)}),
    ('akane_gesture', '402484DE-E596-479E-B159-4282D95D37AC', 10, 'right', ('match_frames', 'akane_emote1', [5, 6]),
     {'akane_hug': ([0, 1, 2], 4, False), 'akane_wrap_bell': ([3, 4, 5, 6], 2.5, False), 'akane_tuck': ([7, 8, 9], 2.5, False)}),
]
# 걷기 + 달리기 한 장 → 두 시트
WALKRUN = ('B0A8903B-2FB8-4179-8A4A-AFF493A8E49D', 12)


def load(src):
    a = np.array(Image.open(RAW / f'{src}.png').convert('RGBA'))
    pp.remove_outer_white(a)
    return a


def frames(a, count):
    """빈 열에서 자르고, 붙은 프레임은 설명의 칸 수가 될 때까지 가장 얇은 열에서 나눈다 (그림을 보고 칸 수를 확인한 시트만)"""
    occ = (a[..., 3] >= ps.ALPHA_CUT).sum(0)
    segs = ps.split_axis(occ, count)
    parts = []
    for x0, x1 in segs:
        part = a[:, x0:x1]
        ys = np.where((part[..., 3] >= ps.ALPHA_CUT).any(1))[0]
        parts.append(part[max(0, ys.min() - 4):ys.max() + 5])
    return parts


def src_h(p):
    return p.shape[0] - 9


def dot_for(parts, rule, sheets):
    kind = rule[0]
    if kind == 'all':          # 모든 칸 키의 가운데 값 → 목표 키
        return float(np.median([src_h(p) for p in parts])) / rule[1]
    if kind == 'match':        # 같은 칸끼리 키 비율 (같은 동작의 칼 찬 시트)
        ref = sheets[rule[1]]['heights']
        return float(np.median([src_h(p) / h for p, h in zip(parts, ref)]))
    if kind == 'first':        # 앞 n칸(선 자세) 키 → 기준 시트 키 가운데 값
        return float(np.median([src_h(p) for p in parts[:rule[1]]])) / float(np.median(sheets[rule[2]]['heights']))
    if kind == 'match_frames':  # 이 시트 전체 키 가운데 값 → 기준 시트의 그 칸들 키
        ref = sheets[rule[1]]['heights']
        return float(np.median([src_h(p) for p in parts])) / float(np.median([ref[i] for i in rule[2]]))
    raise ValueError(kind)


def save(name, small_frames, facing, dot, src, anims, sheets, labels=None):
    e = ps.save_sheet(name, small_frames, dict(anchor='feet', pad=2, facing=facing, labels=labels), dot, OUT, f'{src}.png')
    e['heights'] = [int(f.shape[0]) for f in small_frames]
    if anims:
        e['anims'] = {k: {'frames': f, 'rate': r, 'loop': lp} for k, (f, r, lp) in anims.items()}
    sheets[name] = e
    return e


def cultist_silhouette(sheets):
    """지붕 위 흰 가면 신도: enemy_sword 대기(첫 칸)를 검게 칠하고 붉은 눈 2픽셀만 남긴다"""
    e = sheets['enemy_sword']
    a = np.array(Image.open(OUT / e['file']).convert('RGBA'))[:, :e['frameWidth']]
    a, _ = ps.crop_to_content(a)
    out = np.zeros_like(a)
    op = a[..., 3] > 0
    out[op] = (14, 12, 18, 255)
    # 눈: 흰 가면의 눈구멍 (enemy_sword 대기 칸, 내용 기준 x 14~15, y 18 — 확대해서 확인). 왼쪽을 보는 옆모습이라 한 눈만 보여 2픽셀 가로로
    for x, y in ((14, 18), (15, 18)):
        out[y, x] = (230, 30, 40, 255)
    Image.fromarray(out).save(OUT / 'props/prop_rooftop_cultist.png')
    return {'file': 'props/prop_rooftop_cultist.png', 'source': f"{e['file']} (대기 칸을 검은 실루엣으로, 붉은 눈 2픽셀)",
            'width': int(out.shape[1]), 'height': int(out.shape[0]), 'kind': 'prop'}


def lantern_rope(pieces):
    """등롱 줄: rope_segment 를 이어 붙이고 lantern_lit 을 일정 간격으로 매단다. 끊긴 뒤 그림은 lantern_torn 이 땅에 놓인 줄"""
    seg, lit, torn = pieces['rope_segment'], pieces['lantern_lit'], pieces['lantern_torn']
    n = 7
    W = seg.shape[1] * n
    every = W // 4
    hang = [every * (i + 1) - every // 2 for i in range(4)]
    H = seg.shape[0] + lit.shape[0] - 6
    up = np.zeros((H, W, 4), np.uint8)
    for i in range(n):
        up[:seg.shape[0], i * seg.shape[1]:(i + 1) * seg.shape[1]] = seg
    for cx in hang:
        x0 = cx - lit.shape[1] // 2
        y0 = 6
        reg = up[y0:y0 + lit.shape[0], x0:x0 + lit.shape[1]]
        m = lit[..., 3:4] > 0
        reg[:] = np.where(m, lit, reg)
    Image.fromarray(up).save(OUT / 'props/lantern_rope.png')
    # 떨어진 줄: 줄은 그대로, 등롱은 찢긴 그림을 줄 아래 땅에
    H2 = seg.shape[0] + torn.shape[0]
    down = np.zeros((H2, W, 4), np.uint8)
    for i in range(n):
        down[:seg.shape[0], i * seg.shape[1]:(i + 1) * seg.shape[1]] = seg
    for k, cx in enumerate(hang):
        x0 = min(max(cx - torn.shape[1] // 2 + (k % 2) * 6, 0), W - torn.shape[1])
        reg = down[H2 - torn.shape[0]:, x0:x0 + torn.shape[1]]
        m = torn[..., 3:4] > 0
        reg[:] = np.where(m, torn, reg)
    Image.fromarray(down).save(OUT / 'props/lantern_rope_fallen.png')
    src = 'props/rope_segment · lantern_lit · lantern_torn 으로 조립'
    return {'lantern_rope': {'file': 'props/lantern_rope.png', 'source': src, 'width': W, 'height': H, 'kind': 'prop'},
            'lantern_rope_fallen': {'file': 'props/lantern_rope_fallen.png', 'source': src, 'width': W, 'height': H2, 'kind': 'prop'}}


def main():
    man = OUT / 'manifest.json'
    manifest = json.loads(man.read_text(encoding='utf-8'))
    sheets = manifest['sheets']
    report = []
    for name, src, count, facing, rule, anims in SHEETS:
        a = load(src)
        parts = frames(a, count)
        dot = dot_for(parts, rule, sheets)
        small = [pp.shrink(p, dot) for p in parts]
        e = save(name, small, facing, dot, src, anims, sheets)
        report.append(f"{src[:8]} → {name}: {count}칸, 칸 {e['frameWidth']}×{e['frameHeight']}, 키 {min(e['heights'])}~{max(e['heights'])}, 도트 {dot:.2f}")
    # 걷기 + 달리기: 걷기(선 자세) 키를 칼 찬 아카네 대기 키(82)에 맞추고 두 시트로
    src, count = WALKRUN
    a = load(src)
    parts = frames(a, count)
    dot = float(np.median([src_h(p) for p in parts[:6]])) / 80
    small = [pp.shrink(p, dot) for p in parts]
    for nm, sl in (('player_walk_nosword', slice(0, 6)), ('player_run_nosword', slice(6, 12))):
        e = save(nm, small[sl], 'right', dot, src, {nm: (list(range(6)), 10 if 'walk' in nm else 12, True)}, sheets)
        report.append(f"{src[:8]} → {nm}: 6칸, 칸 {e['frameWidth']}×{e['frameHeight']}, 키 {min(e['heights'])}~{max(e['heights'])}, 도트 {dot:.2f}")
    # 소품 시트 2
    src = '10B6081D-1681-4893-B8E3-C164F165FE44'
    a = load(src)
    found = blobs(a)
    if len(found) != len(PROP_NAMES):
        sys.exit(f'소품 덩어리 {len(found)}개 ≠ 이름 {len(PROP_NAMES)}개')
    pieces = {}
    for n, (y0, y1, x0, x1, mask) in zip(PROP_NAMES, found):
        crop = a[y0:y1, x0:x1].copy()
        crop[..., 3] = np.where(mask, crop[..., 3], 0)
        sm, _ = ps.crop_to_content(ps.downscale(crop, PROP_DOT))
        Image.fromarray(sm).save(OUT / f'props/{n}.png')
        pieces[n] = sm
        sheets[n] = {'file': f'props/{n}.png', 'source': f'{src}.png', 'width': int(sm.shape[1]), 'height': int(sm.shape[0]),
                     'kind': 'prop', 'dot': PROP_DOT}
    report.append(f"{src[:8]} → props/: " + ', '.join(f'{n} {p.shape[1]}×{p.shape[0]}' for n, p in pieces.items()))
    sheets.update(lantern_rope(pieces))
    sheets['prop_rooftop_cultist'] = cultist_silhouette(sheets)
    report.append('lantern_rope · lantern_rope_fallen (조립), prop_rooftop_cultist (enemy_sword 실루엣)')
    # 컷인: 도트 3 으로 줄여 그대로 (컷인 띠가 cover 로 채운다)
    src = '4B813E01-0E0D-4F49-BC8C-396752B3DF32'
    a = np.array(Image.open(RAW / f'{src}.png').convert('RGBA'))
    sm = ps.downscale(a, 3.0)
    sm[..., 3] = 255
    Image.fromarray(sm).save(OUT / 'cutin_traveler_hair.png')
    sheets['cutin_traveler_hair'] = {'file': 'cutin_traveler_hair.png', 'source': f'{src}.png', 'width': int(sm.shape[1]), 'height': int(sm.shape[0])}
    report.append(f"{src[:8]} → cutin_traveler_hair {sm.shape[1]}×{sm.shape[0]}")
    man.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding='utf-8')
    md = ['# 프롤로그 그림 3차 대응표', '', '`python3 tools/process_prologue3.py`', '', '| 원래 파일 | 새 이름 | 판단 근거 |', '|---|---|---|']
    md += [f'| `{k}.png` | `{v[0]}` | {v[1]} |' for k, v in FILES.items()]
    md += ['', '## 결과', ''] + [f'- {r}' for r in report]
    (ROOT / 'docs/prologue3-mapping.md').write_text('\n'.join(md) + '\n', encoding='utf-8')
    print('\n'.join(report))


if __name__ == '__main__' and '--pillar' not in sys.argv:
    main()


# ───────── 불타는 기둥 전경 (따로 실행: python3 tools/process_prologue3.py --pillar) ─────────
# 원본 875ADA70: 서 있는 기둥(등롱 매달림) + 기울어 쓰러진 기둥 2개 → fg_burning_pillar 2칸 (0 서 있음, 1 쓰러짐), 발 기준 정렬
PILLAR_SRC = '875ADA70-EDF6-4C14-9001-A6AF2DB881F3'
PILLAR_H = 560  # 서 있는 기둥 키(px). 전경은 1.3배 패럴랙스로 화면 앞을 지나가므로 화면 높이만큼


def pillar():
    from scipy import ndimage
    man = OUT / 'manifest.json'
    manifest = json.loads(man.read_text(encoding='utf-8'))
    a = np.array(Image.open(RAW / f'{PILLAR_SRC}.png').convert('RGBA'))
    pp.remove_outer_white(a)
    occ = a[..., 3] >= 24
    lab, n = ndimage.label(occ, structure=np.ones((3, 3)))
    sizes = ndimage.sum(occ, lab, range(1, n + 1))
    objs = ndimage.find_objects(lab)
    big = sorted([i for i in range(n) if sizes[i] >= sizes.max() * 0.2], key=lambda i: objs[i][1].start)
    # 작은 불티는 가로로 가까운 기둥에 붙인다
    owner = {}
    for i in range(n):
        cx = (objs[i][1].start + objs[i][1].stop) / 2
        owner[i] = min(big, key=lambda b: abs(cx - (objs[b][1].start + objs[b][1].stop) / 2))
    parts = []
    for b in big:
        m = np.isin(lab, [i + 1 for i in range(n) if owner[i] == b])
        ys, xs = np.where(m)
        part = np.where(m[..., None], a, 0).astype(np.uint8)[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        parts.append(part)
    dot = parts[0].shape[0] / PILLAR_H
    frames = [pp.shrink(p, dot, soft=True) for p in parts]
    e = ps.save_sheet('fg_burning_pillar', frames, dict(anchor='feet', pad=2, labels=['standing', 'fallen']), dot, OUT, f'{PILLAR_SRC}.png')
    e['heights'] = [int(f.shape[0]) for f in frames]
    manifest['sheets']['fg_burning_pillar'] = e
    man.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding='utf-8')
    print('fg_burning_pillar', len(frames), '칸', e['frameWidth'], '×', e['frameHeight'], '도트', round(dot, 2))


if __name__ == '__main__' and '--pillar' in sys.argv:
    pillar()
