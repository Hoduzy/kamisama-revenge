"""프롤로그 컷 그림 · 하나 초상화 (python3 tools/process_cuts.py)

- 4C52D247 (3칸, 검은 바탕) → assets/cg/cut_p0_1~3.png : P-0 오프닝 1인칭 3컷 (쓰러진 아카네의 눈으로 본 하루 · 하쿠야)
- E63740E8 (4칸, 검은 바탕) → assets/cg/cut_p6_stone_1~4.png : P-6 나그네가 앉았던 바위 클로즈업 (꽃잎 떨어짐 → 닿음 → 시듦 → 부서짐)
- CF2E7A47 (4칸, 투명) → assets/sprites/portrait_hana.png : 하나 초상 (0 가면 자랑, 1 박수 환호, 2 깨진 가면 울음, 3 걱정)
컷은 칸 사이 검은 세로 띠로 나누고, 위아래 검은 여백을 걷어 도트 3배로 줄인다 (CG 와 같은 굵기, 화면 가득 늘려 보여 줌)
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
CG = ROOT / 'assets/cg'
OUT = ROOT / 'assets/sprites'
CUTS = [('4C52D247-06FD-42D7-9D3A-FECE91E9B3F7', 'cut_p0', 3), ('E63740E8-803A-4D7A-B452-D607C967E676', 'cut_p6_stone', 4)]
HANA = 'CF2E7A47-4438-496A-8679-D9EF1E73A3DE'


def panels(a, n):
    lum = a[..., :3].astype(int).sum(2)
    col = (lum > 40).mean(0)
    w = a.shape[1]
    # 칸 경계: 칸 폭 1/n 근처의 가장 어두운 열
    cuts = [0]
    for k in range(1, n):
        c = w * k // n
        lo, hi = c - w // (4 * n), c + w // (4 * n)
        cuts.append(lo + int(np.argmin(col[lo:hi])))
    cuts.append(w)
    out = []
    for x0, x1 in zip(cuts, cuts[1:]):
        p = a[:, x0:x1]
        m = (p[..., :3].astype(int).sum(2) > 40)
        ys, xs = np.where(m.mean(1) > 0.05)[0], np.where(m.mean(0) > 0.05)[0]
        out.append(p[ys.min():ys.max() + 1, xs.min():xs.max() + 1])
    return out


def main():
    CG.mkdir(exist_ok=True)
    man = OUT / 'manifest.json'
    manifest = json.loads(man.read_text(encoding='utf-8'))
    for src, name, n in CUTS:
        a = np.array(Image.open(RAW / f'{src}.png').convert('RGBA'))
        for i, p in enumerate(panels(a, n), 1):
            small = ps.downscale(p, 2.0)
            small[..., 3] = 255
            Image.fromarray(small).save(CG / f'{name}_{i}.png')
            print(f'{name}_{i}', small.shape[1], '×', small.shape[0])
    # 하나 초상화: 기존 초상과 같은 높이
    a = np.array(Image.open(RAW / f'{HANA}.png').convert('RGBA'))
    pp.remove_outer_white(a)
    segs = ps.split_axis((a[..., 3] >= 128).sum(0), 4)
    parts = []
    for x0, x1 in segs:
        part = a[:, x0:x1]
        ys = np.where((part[..., 3] >= 128).any(1))[0]
        parts.append(part[ys.min():ys.max() + 1])
    target = manifest['sheets']['portraits']['frameHeight'] - 1
    dot = max(p.shape[0] for p in parts) / target
    frames = [pp.shrink(p, dot) for p in parts]
    e = ps.save_sheet('portrait_hana', frames, dict(anchor='bbox', pad=1, labels=['proud', 'cheer', 'cry', 'worried']), dot, OUT, f'{HANA}.png')
    manifest['sheets']['portrait_hana'] = e
    man.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding='utf-8')
    print('portrait_hana', e['frameWidth'], '×', e['frameHeight'])


if __name__ == '__main__':
    main()
