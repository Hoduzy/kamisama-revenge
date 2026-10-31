"""프롤로그 그림 전처리: assets/raw/ 의 인물·마을 사람·소품·이펙트 → assets/sprites/ (manifest.json 에 추가)

    python3 tools/process_prologue.py

1. 배경: 투명으로 왔지만 바깥(투명 영역)과 이어진 큰 흰 덩어리가 남아 있으면 그것만 투명으로 (안쪽 흰색·작은 섬광은 둠)
2. 크기: 머리 높이를 아카네(player_idle)와 맞춘다 (아래 CHARACTERS 의 손으로 잰 값).
   하루 ×1.05, 소이치로 ×1.15, 하쿠야 ×1.20, 마을 남자·여자 ×1.0, 아이 ×0.9.
3. 하쿠야 기준 그림 정면 → 기존 boss 시트를 교체.
4. 마을 남자·여자: 옷 색을 바꾼 변형(_v1~_v3)을 만든다 (피부·머리·검은 윤곽은 그대로).
5. 소품·이펙트 시트는 조각마다 따로 저장한다.
"""
import colorsys
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
import process_sprites as ps  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets/raw'
OUT = ROOT / 'assets/sprites'

# 인물: 머리 배율(아카네 = 1)과 원본 머리 높이(px, 정수리~턱, 귀·상투·후광 제외)
# 얼굴 피부색으로 자동으로 재 보니 하루·하쿠야의 크림색 옷이 피부로 잡혀 틀려서, 확대한 그림에 눈금을 대고 손으로 쟀다.
# 같은 인물의 2172×724 시트들은 같은 크기로 그려져 있어(서 있는 키가 캔버스에 꽉 참) 인물마다 한 값을 쓴다.
# 다른 캔버스에 그려진 시트는 SHEET_HEAD 에 따로 적는다.
AKANE_HEAD_SRC = 122     # player_idle 원본 첫 프레임
CHARACTERS = {
    'haru': dict(head=1.05, head_src=130),          # haru_idle 기준
    'soichiro': dict(head=1.15, head_src=145),      # 소이치로는 기준 그림이 없어 '칼 건네기' 첫 프레임으로 잼
    'hakuya': dict(head=1.20, head_src=150),        # hakuya_ref 정면
    'villager_man': dict(head=1.0, head_src=88),
    'villager_woman': dict(head=1.0, head_src=100),
    'villager_child': dict(head=0.9, head_src=115),
}
# 머리를 잰 기준 시트 (시트 이름, 프레임 번호, 정수리 y, 턱 y). 다른 시트는 이 머리 띠를 본으로 크기를 맞춰 본다(match_scale)
HEAD_BASE = {
    'haru': [('haru_idle', 0, 58, 190)],
    'soichiro': [('soichiro_give', 0, 95, 240)],
    'hakuya': [('hakuya_ref', 0, 95, 245), ('hakuya_ref', 1, 95, 245)],
    'villager_man': [('villager_man', 1, 200, 288)],
    'villager_woman': [('villager_woman', 1, 180, 280)],
    'villager_child': [('villager_child', 0, 185, 300)],
}
# 본 맞추기 점수가 낮아(0.7 미만) 틀린 시트는 손으로 (기준 시트 대비 그림 크기 배율).
# 같은 2172×724 캔버스끼리 서 있는 자세의 키를 견주어 정했다. 하쿠야는 걷기(점수 0.85)와 같은 크기로 그려져 있다.
SHEET_SCALE = {
    'haru_ref': 1.23,  # 1536×1024 캔버스: 정면 키가 haru_idle 과 같게
    'haru_death': 0.68,
    'soichiro_forge': 0.72, 'soichiro_attack': 0.72, 'soichiro_kneel': 0.78,
    'hakuya_walk': 0.65, 'hakuya_dash': 0.65, 'hakuya_iaido': 0.65, 'hakuya_thrust': 0.65,
    'hakuya_hurt': 0.65, 'hakuya_kneel': 0.65,
}

# 시트: 원본 이름 → (인물, 프레임 수, 바라보는 방향, 프레임 이름)
SHEETS = {
    'haru_ref': ('haru', 4, 'left', ['front', 'side', 'back', 'three_quarter']),
    'haru_idle': ('haru', 4, 'right', None),
    'haru_attack': ('haru', 6, 'right', ['ready', 'raise', 'overhead', 'swing', 'thrust', 'recover']),
    'haru_death': ('haru', 6, 'right', None),
    'haru_reach': ('haru', 4, 'right', ['kneel', 'reach', 'glow', 'petals']),
    'soichiro_give': ('soichiro', 4, 'left', None),
    'soichiro_forge': ('soichiro', 6, 'right', ['ready', 'raise', 'top', 'strike', 'spark', 'recover']),
    'soichiro_guard': ('soichiro', 4, 'right', None),
    'soichiro_attack': ('soichiro', 4, 'right', ['raise', 'swing', 'smash', 'recover']),
    'soichiro_kneel': ('soichiro', 5, 'right', None),
    'hakuya_ref': ('hakuya', 4, 'left', ['front', 'side', 'back', 'three_quarter']),
    'hakuya_walk': ('hakuya', 6, 'left', None),
    'hakuya_barrier': ('hakuya', 4, 'left', None),
    'hakuya_dash': ('hakuya', 5, 'left', None),
    'hakuya_iaido': ('hakuya', 6, 'left', ['ready', 'crouch', 'draw', 'slash', 'follow', 'sheathe']),
    'hakuya_thrust': ('hakuya', 5, 'left', None),
    'hakuya_hurt': ('hakuya', 4, 'left', None),
    'hakuya_kneel': ('hakuya', 6, 'left', None),
    'villager_man': ('villager_man', 10, 'right', ['dance'] * 6 + ['flee'] * 4),
    'villager_woman': ('villager_woman', 10, 'right', ['dance'] * 6 + ['flee'] * 4),
    'villager_child': ('villager_child', 8, 'right', None),
}

# 조각마다 따로 저장하는 시트. 반짝이·부스러기가 흩어져 있어 자동으로 못 나누므로 원본 좌표 상자를 손으로 정했다
# (y0, y1, x0, x1). 상자에 걸친 덩어리는 중심이 들어 있는 상자 쪽으로 간다. height_of: 이 조각의 키를 몇 px 로 할지 → 시트 공통 배율
PIECES = {
    'props_prologue': dict(height_of=('prop_scarecrow', 80), boxes=[
        ('prop_scarecrow', (100, 580, 10, 335)), ('prop_scarecrow_broken', (100, 585, 336, 684)),
        ('prop_katana', (370, 580, 685, 1425)), ('prop_fire_arrow', (185, 500, 1185, 1510)),
        ('prop_debris_fire', (560, 960, 5, 627)), ('prop_fox_mask', (660, 935, 627, 845)),
        ('prop_anvil', (635, 960, 846, 1186)), ('prop_sword_rack', (645, 955, 1187, 1525))]),
    # 붉은 태양 문양 / 문양이 번지는 5단계 / 금빛 막 4단계 / 막이 깨지는 4단계 / 타이틀 로고 문양
    'fx_prologue': dict(height_of=('fx_barrier_3', 130), boxes=[
        ('fx_red_sun', (0, 410, 0, 400)),
        ('fx_red_sun_0', (220, 300, 420, 520)), ('fx_red_sun_1', (180, 330, 540, 720)),
        ('fx_red_sun_2', (140, 360, 730, 920)), ('fx_red_sun_3', (110, 380, 925, 1180)),
        ('fx_red_sun_4', (60, 410, 1180, 1525)),
        ('fx_barrier_0', (420, 620, 10, 262)), ('fx_barrier_1', (420, 620, 263, 515)),
        ('fx_barrier_2', (410, 620, 516, 785)), ('fx_barrier_3', (410, 620, 786, 1045)),
        ('fx_barrier_break_0', (680, 920, 10, 262)), ('fx_barrier_break_1', (680, 930, 245, 515)),
        ('fx_barrier_break_2', (680, 930, 505, 785)), ('fx_barrier_break_3', (700, 930, 786, 1048)),
        ('logo_emblem', (440, 950, 1050, 1530))]),
}
# 조각을 한 줄짜리 애니메이션 시트로 묶기
GROUPS = {
    'fx_red_sun_grow': ['fx_red_sun_0', 'fx_red_sun_1', 'fx_red_sun_2', 'fx_red_sun_3', 'fx_red_sun_4'],
    'fx_barrier': ['fx_barrier_0', 'fx_barrier_1', 'fx_barrier_2', 'fx_barrier_3'],
    'fx_barrier_break': ['fx_barrier_break_0', 'fx_barrier_break_1', 'fx_barrier_break_2', 'fx_barrier_break_3'],
}

# 마을 사람 옷 색 변형: (색상 회전 °, 채도 배율, 밝기 배율)
VARIANTS = {
    'villager_man': [(150, 1.6, 1.35), (-95, 1.5, 1.3), (80, 1.4, 1.35)],      # 어두운 남색이라 채도·밝기를 올려야 티가 난다
    'villager_woman': [(150, 1.0, 1.0), (-110, 0.9, 1.05), (40, 0.7, 0.9)],
}


def remove_outer_white(a, min_size=500):
    """바깥 투명 영역과 맞닿은 흰 덩어리 중 큰 것(배경 찌꺼기)만 투명으로. 지운 픽셀 수를 돌려준다"""
    from scipy import ndimage
    al = a[..., 3]
    lum = ps.luma(a[..., :3].astype(np.float32))
    white = (al >= 16) & (lum >= ps.WHITE_LUMA)
    trans = al < 16
    lab, _ = ndimage.label(trans)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    outside = np.isin(lab, edge[edge > 0]) & trans
    wl, n = ndimage.label(white)
    touch = np.unique(wl[ndimage.binary_dilation(outside) & white])
    removed = 0
    for i in touch[touch > 0]:
        comp = wl == i
        if comp.sum() >= min_size:
            a[comp] = 0
            removed += int(comp.sum())
    return removed


def load(name):
    a = np.array(Image.open(SRC / f'{name}.png').convert('RGBA'))
    return a, remove_outer_white(a)


def split_frames(a, count):
    segs = ps.split_axis((a[..., 3] > 0).sum(0), count)
    parts = []
    for x0, x1 in segs:
        part = a[:, x0:x1]
        ys = np.where(part[..., 3].any(1))[0]
        parts.append(part[max(0, ys.min() - 4):ys.max() + 5] if len(ys) else part)
    return parts


def shrink(part, dot, soft=False):
    """도트 해상도로 축소. soft: 반투명(금빛 막·빛)을 살린다 — 투명도만 영역 평균으로 다시 뽑음"""
    small = ps.downscale(part, dot)
    if soft:
        h, w = small.shape[:2]
        al = np.asarray(Image.fromarray(part[..., 3]).resize((w, h), Image.BOX))
        rgb = np.asarray(Image.fromarray(part[..., :3]).resize((w, h), Image.BOX))
        small = np.dstack([np.where(small[..., 3:4] > 0, small[..., :3], rgb), np.where(al < 24, 0, al)]).astype(np.uint8)
    small, _ = ps.crop_to_content(small)
    return small


def gray(part):
    """투명 부분을 중간 회색으로 깐 흑백 (본 맞추기용)"""
    al = part[..., 3:4] / 255.0
    g = (ps.luma(part[..., :3].astype(np.float32))[..., None] * al + 128 * (1 - al))[..., 0]
    return g.astype(np.float32)


def match_scale(templates, parts, work=0.25):
    """templates(기준 머리 띠, 원본 px) 가 이 시트 프레임들에서 몇 배 크기로 가장 잘 맞는지.
    키가 큰 프레임 3개에서 찾아 점수가 높은 쪽의 배율(중앙값)과 점수를 돌려준다"""
    import cv2
    frames = sorted(parts, key=lambda p: -p.shape[0])[:3]
    found = []
    for p in frames:
        G = cv2.resize(gray(p), None, fx=work, fy=work, interpolation=cv2.INTER_AREA)
        best = (-1, 1.0)
        for T0 in templates:
            for k in np.arange(0.4, 1.61, 0.02):
                T = cv2.resize(T0, None, fx=work * k, fy=work * k, interpolation=cv2.INTER_AREA)
                if T.shape[0] >= G.shape[0] or T.shape[1] >= G.shape[1] or min(T.shape) < 4:
                    continue
                sc = float(cv2.matchTemplate(G, T, cv2.TM_CCOEFF_NORMED).max())
                if sc > best[0]:
                    best = (sc, float(k))
        found.append(best)
    found.sort(reverse=True)
    return float(np.median([k for _, k in found[:2]])), round(found[0][0], 2)


# 색을 바꿀 옷의 범위 (색상 h 0~1, 넘으면 1 더해 비교 / 밝기 v / 채도 s). 피부·머리·귀는 이 범위 밖이라 그대로 남는다
CLOTHES = {
    'villager_man': dict(h=(0.50, 0.76), v=(0.08, 1.0), s=(0.12, 1.0)),    # 남색 유카타
    'villager_woman': dict(h=(0.88, 1.06), v=(0.30, 0.88), s=(0.18, 1.0)),  # 분홍 기모노 (피부는 더 밝아서 빠진다)
}


def recolor(frame, hue, sat, val, clothes):
    """옷 색 범위(clothes)에 드는 픽셀만 색상을 돌린다"""
    out = frame.copy()
    rgb = frame[..., :3].astype(float) / 255
    for y, x in zip(*np.where(frame[..., 3] > 0)):
        h, s, v = colorsys.rgb_to_hsv(*rgb[y, x])
        hh = h + 1 if h < clothes['h'][0] - 0.5 else h
        if not (clothes['h'][0] <= hh <= clothes['h'][1] and clothes['v'][0] <= v <= clothes['v'][1] and clothes['s'][0] <= s <= clothes['s'][1]):
            continue
        nr, ng, nb = colorsys.hsv_to_rgb((h + hue / 360) % 1, min(1, s * sat), min(1, v * val))
        out[y, x, :3] = [round(nr * 255), round(ng * 255), round(nb * 255)]
    return out


def main():
    man_path = OUT / 'manifest.json'
    manifest = json.loads(man_path.read_text(encoding='utf-8'))
    sheets = manifest['sheets']
    akane = sheets['player_idle']['dot']
    head_out = AKANE_HEAD_SRC / akane  # 아카네 머리 높이(출력 px)
    print(f'아카네 머리 {head_out:.1f}px (출력)')
    report = []

    # 1. 인물별 머리 본 (기준 시트의 정수리~턱 띠, 원본 px)
    bases = {}
    for cid, lst in HEAD_BASE.items():
        bases[cid] = []
        for sheet, fi, y0, y1 in lst:
            a, _ = load(sheet)
            p = split_frames(a, SHEETS[sheet][1])[fi]
            ys = np.where(p[..., 3].any(1))[0]
            p = p[ys.min():]
            band = p[y0:y1]
            cc = np.where(band[..., 3].any(0))[0]
            bases[cid].append((gray(band[:, cc.min():cc.max() + 1]), y1 - y0))

    # 2. 인물 시트
    for name, (cid, count, facing, labels) in SHEETS.items():
        a, removed = load(name)
        parts = split_frames(a, count)
        c = CHARACTERS[cid]
        base_dot = c['head_src'] / (head_out * c['head'])
        first = HEAD_BASE[cid][0]
        if name == first[0]:
            k, score = 1.0, 1.0
        elif name in SHEET_SCALE:
            k, score = SHEET_SCALE[name], 1.0
        else:
            # 템플릿마다 머리 높이가 다르면(다른 캔버스) 첫 기준 높이에 맞춰 보정
            h0 = bases[cid][0][1]
            tpls = [T if h == h0 else __import__('cv2').resize(T, None, fx=h0 / h, fy=h0 / h) for T, h in bases[cid]]
            k, score = match_scale(tpls, parts)
        dot = base_dot * k
        frames = [shrink(p, dot) for p in parts]
        cfg = dict(anchor='feet', pad=2, facing=facing, labels=labels)
        entry = ps.save_sheet(name, frames, cfg, dot, OUT, f'{name}.png')
        entry.update(character=cid, headScale=c['head'], headRatioToBase=round(k, 2), matchScore=score,
                     heights=[int(f.shape[0]) for f in frames])
        sheets[name] = entry
        report.append((name, f'{count}프레임', f"{entry['frameWidth']}×{entry['frameHeight']}", f'키 {min(entry["heights"])}~{max(entry["heights"])}', f'머리비 {k:.2f} ({score})',
                       f'흰 배경 {removed}px' if removed else ''))
        # 마을 사람 색 변형
        if cid in ('villager_man', 'villager_woman'):
            for i, v in enumerate(VARIANTS[cid], 1):
                vn = f'{name}_v{i}'
                ps.save_sheet(vn, [recolor(f, *v, CLOTHES[cid]) for f in frames], cfg, dot, OUT, f'{name}.png (색 변형)')
                sheets[vn] = {**entry, 'file': f'{vn}.png', 'variantOf': name, 'recolor': dict(hue=v[0], sat=v[1], val=v[2])}
            report.append((f'{name}_v1~v3', '색 변형 3', '', '', ''))

    # 3. 하쿠야 정면 → boss 교체
    ref = sheets['hakuya_ref']
    a = np.array(Image.open(OUT / ref['file']))
    front = a[:, :ref['frameWidth']]
    front, _ = ps.crop_to_content(front)
    entry = ps.save_sheet('boss', [front], dict(anchor='feet', pad=2, facing='left'), ref['dot'], OUT, 'hakuya_ref.png (정면)')
    entry.update(heights=[int(front.shape[0])], body=ps.enemy_body('boss'), character='hakuya')
    sheets['boss'] = entry
    report.append(('boss', '1프레임 (교체)', f"{entry['frameWidth']}×{entry['frameHeight']}", f'키 {front.shape[0]}', 'hakuya_ref 정면'))

    # 4. 소품·이펙트 조각
    from scipy import ndimage
    for src, p in PIECES.items():
        a, removed = load(src)
        lab, k = ndimage.label(a[..., 3] >= 64)  # 거의 투명한 바탕 잡티는 덩어리로 치지 않는다
        centers = ndimage.center_of_mass(np.ones(lab.shape), lab, range(1, k + 1))
        names = [n for n, _ in p['boxes']]
        boxes = dict(p['boxes'])
        ref_name, ref_h = p['height_of']
        y0, y1, x0, x1 = boxes[ref_name]
        sub = a[y0:y1, x0:x1, 3] >= ps.ALPHA_CUT
        rr = np.where(sub.any(1))[0]
        dot = (rr.max() - rr.min() + 1) / ref_h
        pieces = {}
        for n in names:
            y0, y1, x0, x1 = boxes[n]
            # 중심이 이 상자 안인 덩어리만 남긴다
            keep = [i + 1 for i, (cy, cx) in enumerate(centers) if y0 <= cy < y1 and x0 <= cx < x1]
            mask = np.isin(lab, keep)
            ys, xs = np.where(mask)
            part = np.where(mask[..., None], a, 0).astype(np.uint8)[max(0, ys.min() - 4):ys.max() + 5, max(0, xs.min() - 4):xs.max() + 5]
            small = shrink(part, dot, soft=n.startswith('fx_'))
            pieces[n] = small
            Image.fromarray(small).save(OUT / f'{n}.png')
            sheets[n] = dict(file=f'{n}.png', source=f'{src}.png', width=int(small.shape[1]), height=int(small.shape[0]), dot=round(dot, 2))
        for g, names in GROUPS.items():
            if not all(n in pieces for n in names):
                continue
            e = ps.save_sheet(g, [pieces[n] for n in names], dict(anchor='bbox', pad=1), dot, OUT, f'{src}.png')
            sheets[g] = e
            for n in names:  # 묶은 조각은 따로 두지 않는다
                sheets.pop(n, None)
                (OUT / f'{n}.png').unlink(missing_ok=True)
        report.append((src, f"조각 {len(p['boxes'])}개", f'도트 {dot:.2f}', '', f'흰 배경 {removed}px' if removed else ''))

    # 5. 마을 사람 초상화 (아카네 초상화와 같은 높이 108)
    a, _ = load('portraits_village')
    parts = split_frames(a, 4)
    target = sheets['portraits']['frameHeight'] - 1
    dot = max(p.shape[0] for p in parts) / target
    frames = [shrink(p, dot) for p in parts]
    e = ps.save_sheet('portraits_village', frames, dict(anchor='bbox', pad=1, labels=['girl_happy', 'girl_cry', 'man_laugh', 'man_shock']), dot, OUT, 'portraits_village.png')
    sheets['portraits_village'] = e
    report.append(('portraits_village', '4프레임', f"{e['frameWidth']}×{e['frameHeight']}", '', ''))

    man_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    ps.write_preview(manifest, OUT, src_rel='../raw/')
    print('\n'.join('  ' + ' · '.join(x for x in r if x) for r in report))


if __name__ == '__main__':
    main()
