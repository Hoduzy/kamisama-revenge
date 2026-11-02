"""스킬 이펙트 · 2단 점프 그림 → assets/sprites/ (manifest.json 에 바로)

    python3 tools/process_skillfx.py

원본 7장(assets/raw/<원래 이름>.png)을 내용으로 판단해 이름을 붙였다 (FILES).
- 원형 이펙트(칼날 소용돌이 · 충격파 · 발도 기운 · 발판 바람)와 공중제비는 칸마다 중심점이 정확히 같게:
  각 칸의 내용 상자 가운데(공중제비는 불투명 픽셀의 무게중심)를 칸 한가운데에 놓는다
- fx_dash_wake: 각 칸의 오른쪽 끝 = 캐릭터 등 → 오른쪽 끝을 칸 오른쪽에 맞추고 세로는 가운데
- fx_dash_trail: 가운데 정렬 (게임에서 대쉬 거리만큼 가로로 늘림)
- 크기: 이펙트는 SIZE(가장 큰 칸의 지름 또는 폭, 출력 px), 공중제비는 첫 칸 키를 아카네 점프 시트와 같게
반투명 빛(이펙트)은 투명도를 살린다 (process_prologue.shrink soft).
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
import process_sprites as ps  # noqa: E402
import process_prologue as pp  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / 'assets/raw'
OUT = ROOT / 'assets/sprites'

# 원래 파일 → (새 이름, 칸 수, 정렬, 크기, 판단 근거)
#   정렬: center(상자 가운데) | mass(무게중심) | right(오른쪽 끝) ; 크기: ('max', px) 가장 큰 칸의 긴 변 | ('h0', px) 첫 칸 키
FILES = {
    '2A1AA123-289D-469B-9352-BF7D4069BB57': ('fx_blade_storm', 8, 'center', ('max', 220), '칼날이 원형으로 휘몰아쳐 커졌다 흩어지는 8칸'),
    'A8EF0A46-FFE4-41B9-8688-B951591623B9': ('fx_shock_ring', 5, 'center', ('max', 240), '점에서 퍼지는 원형 충격파 고리 5칸'),
    'CE06CE9D-0BC5-4E4A-ACA6-9D549BE9A34C': ('fx_iaido_charge', 6, 'center', ('max', 120), '얇은 원 안에서 도는 기운 · 반짝임 6칸 (반복)'),
    'B359E473-6DF0-4005-A371-7AC5A1E9EFEB': ('fx_dash_trail', 5, 'center', ('max', 200), '가로로 긴 돌진 궤적이 가늘어지며 사라지는 5칸'),
    '5549C6EC-2DF1-406F-BE61-F9B615E3CE71': ('fx_dash_wake', 8, 'right', ('max', 72), '오른쪽 끝이 뾰족한 분홍 돌진 기운 8칸 (짧게 → 길게 → 흩어짐)'),
    '01CEB073-955A-41EB-992F-6B2A7AFCF4AB': ('player_double_jump', 8, 'mass', ('h0', 70), '아카네가 웅크려 한 바퀴 도는 공중제비 8칸'),
    'E0E474E1-9061-4030-9650-214BB01ECBA1': ('fx_double_jump_puff', 5, 'center', ('max', 64), '납작한 고리 모양 바람이 퍼지는 5칸'),
}
# 애니메이션: 이름 → (칸, 초당 칸, 반복)  — js/sprites.js 가 manifest 의 anims 로 만든다
ANIMS = {
    'fx_blade_storm': {'fx_blade_storm': (list(range(8)), 24, False)},
    'fx_shock_ring': {'fx_shock_ring': (list(range(5)), 20, False)},
    'fx_iaido_charge': {'fx_iaido_charge': (list(range(6)), 14, True)},
    'fx_dash_trail': {'fx_dash_trail': (list(range(5)), 18, False)},
    'fx_dash_wake': {'fx_dash_wake_start': ([0, 1], 24, False), 'fx_dash_wake_loop': ([2, 3, 4, 5], 24, True),
                     'fx_dash_wake_end': ([6, 7], 16, False)},
    'player_double_jump': {'player_double_jump': (list(range(8)), 23, False)},  # 8칸 / 0.35초 (게임에서 빠르기를 다시 맞춤)
    'fx_double_jump_puff': {'fx_double_jump_puff': (list(range(5)), 18, False)},
}


def load(src):
    a = np.array(Image.open(RAW / f'{src}.png').convert('RGBA'))
    pp.remove_outer_white(a)
    return a


EQUAL = {'fx_blade_storm'}  # 칸끼리 붙어 있어 같은 폭으로 자르는 시트 (그림을 보고 확인)


def split(a, count, equal=False):
    """빈 열로 자른 덩어리가 칸 수와 같으면 그것, 아니면 같은 폭 칸.
    칸 위치(x0, y0)를 함께 돌려준다"""
    h, w = a.shape[:2]
    occ = (a[..., 3] >= 24).sum(0)
    nat = ps.split_axis(occ, None, min_mass_ratio=0.0)
    if len(nat) >= count and not equal:   # 빈 열로 자른 덩어리가 많으면 가장 좁은 틈부터 합친다 (흩어진 조각은 제 칸으로)
        cols = [(x0, x1) for x0, x1 in ps.split_axis(occ, count, min_mass_ratio=0.0)]
    else:                   # 칸끼리 붙어 있으면 같은 폭 (칼날 소용돌이)
        cw = w / count
        cols = [(int(round(i * cw)), int(round((i + 1) * cw))) for i in range(count)]
    parts = []
    for x0, x1 in cols:
        part = a[:, x0:x1]
        ys, xs = np.where(part[..., 3] >= 24)
        parts.append((part[ys.min():ys.max() + 1, xs.min():xs.max() + 1], (xs.min(), ys.min())))
    return parts


def anchor(f, mode):
    """칸 안의 기준점 (x, y)"""
    m = f[..., 3] > 0
    ys, xs = np.where(m)
    if mode == 'mass':
        return float(xs.mean()), float(ys.mean())
    if mode == 'right':
        return float(xs.max() + 1), (ys.min() + ys.max() + 1) / 2
    return (xs.min() + xs.max() + 1) / 2, (ys.min() + ys.max() + 1) / 2


def pack(frames, mode, square=False, cells=None):
    """기준점을 칸마다 같은 자리에 놓는다. 반환: 시트, 칸 폭, 칸 높이
    cells: 칸 안 원래 위치(축소 후 px). 흩어져 듬성한 칸(불투명 넓이가 가장 큰 칸의 35% 미만)은 자기 상자 대신
    꽉 찬 칸들의 평균 중심(원래 칸 좌표)을 쓴다 → 사라지는 조각이 한쪽으로 쏠려도 중심이 움직이지 않는다"""
    anc = [anchor(f, mode) for f in frames]
    if cells and mode == 'center':
        mass = [int((f[..., 3] > 0).sum()) for f in frames]
        solid = [i for i, m in enumerate(mass) if m >= max(mass) * 0.35]
        cx = float(np.mean([cells[i][0] + anc[i][0] for i in solid]))
        cy = float(np.mean([cells[i][1] + anc[i][1] for i in solid]))
        anc = [a if i in solid else (cx - cells[i][0], cy - cells[i][1]) for i, a in enumerate(anc)]
    if mode == 'right':
        left = max(ax for ax, _ in anc)
        up = max(ay for _, ay in anc)
        down = max(f.shape[0] - ay for f, (_, ay) in zip(frames, anc))
        half_h = int(np.ceil(max(up, down))) + 1
        fw, fh = int(np.ceil(left)) + 1, half_h * 2
        sheet = np.zeros((fh, fw * len(frames), 4), np.uint8)
        for i, (f, (ax, ay)) in enumerate(zip(frames, anc)):
            x0 = i * fw + fw - int(round(ax))
            y0 = half_h - int(round(ay))
            sheet[y0:y0 + f.shape[0], x0:x0 + f.shape[1]] = f
        return sheet, fw, fh
    hx = max(max(ax, f.shape[1] - ax) for f, (ax, _) in zip(frames, anc))
    hy = max(max(ay, f.shape[0] - ay) for f, (_, ay) in zip(frames, anc))
    hx, hy = int(np.ceil(hx)) + 1, int(np.ceil(hy)) + 1
    if square:
        hx = hy = max(hx, hy)
    fw, fh = hx * 2, hy * 2
    sheet = np.zeros((fh, fw * len(frames), 4), np.uint8)
    for i, (f, (ax, ay)) in enumerate(zip(frames, anc)):
        x0 = i * fw + hx - int(round(ax))
        y0 = hy - int(round(ay))
        sheet[y0:y0 + f.shape[0], x0:x0 + f.shape[1]] = f
    return sheet, fw, fh


def main():
    man = OUT / 'manifest.json'
    manifest = json.loads(man.read_text(encoding='utf-8'))
    sheets = manifest['sheets']
    md = ['# 스킬 이펙트 · 2단 점프 대응표', '', '`python3 tools/process_skillfx.py`', '',
          '| 원래 파일 | 새 이름 | 칸 | 판단 근거 | 결과 칸 크기 |', '|---|---|---|---|---|']
    for src, (name, count, mode, size, why) in FILES.items():
        a = load(src)
        cut = split(a, count, equal=name in EQUAL)
        parts = [p for p, _ in cut]
        if size[0] == 'max':
            big = max(max(p.shape[:2]) for p in parts)
            dot = big / size[1]
        else:
            dot = parts[0].shape[0] / size[1]
        soft = name.startswith('fx_')
        frames = []
        cells = []
        for p, (x0, y0) in cut:
            frames.append(pp.shrink(p, dot, soft=soft))
            cells.append((x0 / dot, y0 / dot))  # 칸 안에서 내용이 시작하는 자리 (축소 후 px)
        # 같은 폭 칸일 때만 원래 칸 좌표로 듬성한 칸의 중심을 잡는다 (빈 열로 자른 칸은 폭이 서로 달라 칸 좌표가 기준이 못 된다)
        sheet, fw, fh = pack(frames, mode, square=(name == 'player_double_jump'), cells=cells if name in EQUAL else None)
        Image.fromarray(sheet).save(OUT / f'{name}.png')
        e = dict(file=f'{name}.png', source=f'{src}.png', frameWidth=fw, frameHeight=fh, frames=len(frames),
                 origin=dict(x=1.0 if mode == 'right' else 0.5, y=0.5), dot=round(dot, 2), align=mode)
        if name == 'player_double_jump':
            e['facing'] = 'right'
        e['anims'] = {k: {'frames': f, 'rate': r, 'loop': lp} for k, (f, r, lp) in ANIMS[name].items()}
        sheets[name] = e
        md.append(f'| `{src}.png` | `{name}` | {len(frames)} / {count} | {why} | {fw}×{fh} (정렬 {mode}) |')
        print(f'{src[:8]} → {name}: {len(frames)}칸 {fw}×{fh} 도트 {dot:.2f} 정렬 {mode}')
    man.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding='utf-8')
    (ROOT / 'docs/skillfx-mapping.md').write_text('\n'.join(md) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
