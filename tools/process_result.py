"""결과 화면 그림 전처리: assets/raw/result/*.png → assets/result/*.png + assets/result/result.json

    python3 tools/process_result.py

- result_kanji      붓글씨 「討伐」 한 장 (도트 4px → 화면 1배로 쓰면 원본 붓결이 살아 있다)
- result_ink        먹물 번짐 5프레임 (빈 틈으로 나눠 가운데 맞춤)
- result_slash      거대 칼날 궤적 5프레임 (원본이 같은 폭 칸에 그려져 있어 칸을 그대로 둔다 — 다시 가운데 맞추면 궤적이 흔들림)
- fx_slash_hand_1~3 1인칭 손 (화면 크기 그림 → 480×270, 화면에 2배)
- result_frame      가장자리 장식 (화면 크기 → 480×270, 2배)
- result_paper      잘린 단면 2종(edge_a 위쪽 조각용, edge_b 아래쪽 조각용) · 종이 조각 8종 · 꽃잎 6종
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
import process_sprites as ps  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets/raw/result'
OUT = ROOT / 'assets/result'
SCREEN_W = 480  # 화면 크기 그림을 이 폭으로 (게임 화면 960 에 2배)


def load(name):
    return np.array(Image.open(SRC / f'{name}.png').convert('RGBA'))


def crop(a):
    op = a[..., 3] > 0
    ys, xs = np.where(op)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def sheet(frames, name, center=True):
    """프레임들을 한 줄 시트로. center: 칸 가운데에 맞춤 (아니면 같은 크기 칸 그대로)"""
    fw = max(f.shape[1] for f in frames) + 2
    fh = max(f.shape[0] for f in frames) + 2
    out = np.zeros((fh, fw * len(frames), 4), np.uint8)
    for i, f in enumerate(frames):
        x = i * fw + (fw - f.shape[1]) // 2 if center else i * fw
        y = (fh - f.shape[0]) // 2 if center else 0
        out[y:y + f.shape[0], x:x + f.shape[1]] = f
    Image.fromarray(out).save(OUT / f'{name}.png')
    return dict(file=f'{name}.png', frameWidth=fw, frameHeight=fh, frames=len(frames))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    meta = {}

    # 화면 크기 그림: 손 3장 · 가장자리 장식
    for n in ['fx_slash_hand_1', 'fx_slash_hand_2', 'fx_slash_hand_3', 'result_frame']:
        a = load(n)
        dot = a.shape[1] / SCREEN_W
        small = ps.downscale(a, dot)[:270, :SCREEN_W]
        Image.fromarray(small).save(OUT / f'{n}.png')
        meta[n] = dict(file=f'{n}.png', width=int(small.shape[1]), height=int(small.shape[0]), dot=round(dot, 2), screen=True)

    # 討伐
    a = load('result_kanji')
    small = crop(ps.downscale(a, 4.0))
    Image.fromarray(small).save(OUT / 'result_kanji.png')
    meta['result_kanji'] = dict(file='result_kanji.png', width=int(small.shape[1]), height=int(small.shape[0]), dot=4.0)

    # 먹물 번짐: 빈 틈으로 5프레임
    a = load('result_ink')
    dot = ps.estimate_dot(a)
    segs = ps.split_axis((a[..., 3] >= ps.ALPHA_CUT).sum(0), 5)
    frames = [crop(ps.downscale(a[:, x0:x1], dot)) for x0, x1 in segs]
    meta['result_ink'] = {**sheet(frames, 'result_ink'), 'dot': round(dot, 2)}

    # 칼날 궤적: 같은 폭 5칸 그대로 (위아래만 내용에 맞춰 자름)
    a = load('result_slash')
    ys = np.where((a[..., 3] > 0).any(1))[0]
    a = a[ys.min():ys.max() + 1]
    dot = ps.estimate_dot(a)
    w = a.shape[1] / 5
    cells = [ps.downscale(a[:, round(i * w):round((i + 1) * w)], dot) for i in range(5)]
    h = min(c.shape[0] for c in cells)
    cw = min(c.shape[1] for c in cells)
    cells = [c[:h, :cw] for c in cells]
    # 궤적 방향(그림 속 각도): 마지막에서 두 번째로 큰 프레임의 불투명 픽셀 주축
    f = cells[2]
    yy, xx = np.where(f[..., 3] > 128)
    cov = np.cov(np.vstack([xx - xx.mean(), yy - yy.mean()]))
    vx, vy = np.linalg.eigh(cov)[1][:, -1]
    art_angle = float(np.degrees(np.arctan2(vy, vx)))
    meta['result_slash'] = {**sheet(cells, 'result_slash', center=False), 'dot': round(dot, 2), 'artAngle': round(art_angle, 1)}

    # 종이: 위 두 줄 = 잘린 단면, 셋째 줄 = 종이 조각 8 + 꽃잎 6 (덩어리마다)
    from scipy import ndimage
    a = load('result_paper')
    dot = ps.estimate_dot(a)
    rows = ps.split_axis((a[..., 3] >= ps.ALPHA_CUT).sum(1))
    for name, (r0, r1) in zip(['result_edge_a', 'result_edge_b'], rows[:2]):
        small = crop(ps.downscale(a[r0:r1], dot))
        Image.fromarray(small).save(OUT / f'{name}.png')
        meta[name] = dict(file=f'{name}.png', width=int(small.shape[1]), height=int(small.shape[0]))
    r0, r1 = rows[2]
    part = a[r0:r1]
    lab, n = ndimage.label(part[..., 3] >= ps.ALPHA_CUT)
    objs = ndimage.find_objects(lab)
    sizes = ndimage.sum(np.ones(lab.shape), lab, range(1, n + 1))
    blobs = sorted([(o, s) for o, s in zip(objs, sizes) if s > 300], key=lambda t: (t[0][1].start // 60, t[0][0].start))
    big = sorted([b for b in blobs if b[1] > 4000], key=lambda t: t[0][1].start)
    # 꽃잎: 작은 덩어리 중 큰 6개 (나머지는 종이 부스러기 점)
    small_b = sorted(sorted([b for b in blobs if b[1] <= 4000], key=lambda t: -t[1])[:6], key=lambda t: (t[0][1].start, t[0][0].start))
    for prefix, group in (('result_piece', big), ('result_petal', small_b)):
        for i, (o, _) in enumerate(group):
            y0, y1, x0, x1 = o[0].start, o[0].stop, o[1].start, o[1].stop
            img = crop(ps.downscale(part[max(0, y0 - 3):y1 + 3, max(0, x0 - 3):x1 + 3], dot))
            Image.fromarray(img).save(OUT / f'{prefix}_{i}.png')
            meta[f'{prefix}_{i}'] = dict(file=f'{prefix}_{i}.png', width=int(img.shape[1]), height=int(img.shape[0]))
    meta['_counts'] = dict(pieces=len(big), petals=len(small_b))

    (OUT / 'result.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')
    for k, v in meta.items():
        if not k.startswith('_'):
            print(f"  {k:<18} {v.get('width', v.get('frameWidth'))}×{v.get('height', v.get('frameHeight'))}" + (f"  {v['frames']}프레임" if 'frames' in v else '') + (f"  궤적 각도 {v['artAngle']}°" if 'artAngle' in v else ''))
    print('  ', meta['_counts'])


if __name__ == '__main__':
    main()
