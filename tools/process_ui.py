"""UI 그림 전처리: assets/raw/ui_*.png → assets/ui/*.png + assets/ui/ui.json

    python3 tools/process_ui.py

원본 한 장에 여러 조각이 있으면 빈 줄·빈 칸으로 잘라 순서대로(위→아래, 왼→오) 나눈다.
각 조각은 내용만 남기고 잘라 도트 해상도로 줄인다(process_sprites.py 와 같은 도트 추정·축소).
틀 그림은 9-slice 값(slice: 위·오른쪽·아래·왼쪽, 출력 그림 px)을 함께 적는다.
CSS 에서는 border-image 로 모서리는 그대로, 가운데·변은 늘려 쓴다.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
import process_sprites as ps  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets/raw'
OUT = ROOT / 'assets/ui'

# 원본 → 조각 이름들(위→아래, 왼→오 순서). dot: 도트 크기(없으면 추정)
# slice: 9-slice [위, 오른쪽, 아래, 왼쪽] (출력 px). 장식이 있는 모서리·끝은 늘어나지 않게 넉넉히 잡는다
# extra: 게임이 쓰는 위치 정보 (출력 px)
SHEETS = {
    'ui_dialogue_frame': [dict(name='ui_dialogue_frame')],
    'ui_nameplate': [dict(name='ui_nameplate')],
    'ui_skill_set': [dict(name='ui_skill_frame_a'), dict(name='ui_skill_frame_b'), dict(name='ui_scabbard')],
    'ui_scroll_set': [dict(name='ui_scroll_open'), dict(name='ui_scroll_closed')],
    'ui_plaque': [dict(name='ui_plaque')],
    'ui_medallion_set': [dict(name='ui_medallion'), dict(name='ui_medallion_pressed')],
}
# 9-slice·위치 값은 조각을 본 뒤 손으로 정해 ui_slices.json 에 둔다
SLICE_FILE = Path(__file__).parent / 'ui_slices.json'

# 펼친 두루마리를 왼쪽 축 · 종이 · 오른쪽 축으로 나눈다 (펼치는 연출에서 축만 좌우로 움직이고 종이는 드러난다)
SCROLL_CUTS = (40, 366)


def parts_of(a):
    occ = a[..., 3] >= ps.ALPHA_CUT
    out = []
    for r0, r1 in ps.split_axis(occ.sum(1)):
        for c0, c1 in ps.split_axis(occ[r0:r1].sum(0)):
            sub = occ[r0:r1, c0:c1]
            rr = np.where(sub.any(1))[0]
            cc = np.where(sub.any(0))[0]
            out.append((r0 + rr.min(), r0 + rr.max() + 1, c0 + cc.min(), c0 + cc.max() + 1))
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    slices = json.loads(SLICE_FILE.read_text(encoding='utf-8')) if SLICE_FILE.exists() else {}
    manifest = {}
    for src, pieces in SHEETS.items():
        a = np.array(Image.open(SRC / f'{src}.png').convert('RGBA'))
        dot = ps.estimate_dot(a)
        boxes = parts_of(a)
        if len(boxes) != len(pieces):
            print(f'  ! {src}: 조각 {len(boxes)}개 (예상 {len(pieces)}개)')
        for box, p in zip(boxes, pieces):
            r0, r1, c0, c1 = box
            pad = int(round(dot))
            crop = a[max(0, r0 - pad):r1 + pad, max(0, c0 - pad):c1 + pad]
            small = ps.downscale(crop, dot)
            # 가장자리 빈 줄 정리
            occ = small[..., 3] > 0
            rr, cc = np.where(occ.any(1))[0], np.where(occ.any(0))[0]
            small = small[rr.min():rr.max() + 1, cc.min():cc.max() + 1]
            Image.fromarray(small).save(OUT / f"{p['name']}.png")
            entry = dict(file=f"{p['name']}.png", source=f'{src}.png', width=int(small.shape[1]),
                         height=int(small.shape[0]), dot=round(dot, 2))
            entry.update({k: v for k, v in slices.get(p['name'], {}).items()})
            manifest[p['name']] = entry
            print(f"  {p['name']:<22} 도트 {dot:5.2f}px → {small.shape[1]}×{small.shape[0]}"
                  + (f"  9-slice {entry['slice']}" if 'slice' in entry else ''))
    # 두루마리 나누기
    sc = np.array(Image.open(OUT / 'ui_scroll_open.png'))
    l, r = SCROLL_CUTS
    for name, part in (('ui_scroll_roller_l', sc[:, :l]), ('ui_scroll_paper', sc[:, l:r]), ('ui_scroll_roller_r', sc[:, r:])):
        Image.fromarray(part).save(OUT / f'{name}.png')
        manifest[name] = dict(file=f'{name}.png', source='ui_scroll_set.png (ui_scroll_open 에서 나눔)',
                              width=int(part.shape[1]), height=int(part.shape[0]), **slices.get(name, {}))
        print(f'  {name:<22} → {part.shape[1]}×{part.shape[0]}')
    (OUT / 'ui.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'완료: {OUT.relative_to(ROOT)}/ui.json')


if __name__ == '__main__':
    main()
