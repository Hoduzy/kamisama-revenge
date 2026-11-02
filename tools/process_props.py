"""소품 시트 → 조각 하나씩 (assets/sprites/props/<이름>.png) + manifest + 미리보기.

    python3 tools/process_props.py            # 모든 시트
    python3 tools/process_props.py --list     # 덩어리만 찾아 번호·크기만 보여 줌 (이름 붙이기 전 확인)

격자 위치를 가정하지 않는다:
1. 바깥 투명 영역과 이어진 흰 배경은 지운다 (process_prologue.remove_outer_white)
2. 불투명 픽셀을 8방향으로 이은 덩어리를 찾는다
3. 큰 덩어리(가장 큰 것의 MIN_BIG 이상)를 본체로 보고, 작은 조각(불티·짚 부스러기·김)은 가장 가까운 본체에 합친다
4. 위 → 아래 줄, 줄 안에서 왼쪽 → 오른쪽 순서로 SHEETS 의 이름을 붙인다 (개수가 다르면 멈추고 알린다)
5. 시트 공통 배율로 도트를 줄인다 (ref: 이 조각의 키 또는 폭을 몇 px 로)

결과: assets/sprites/props/<이름>.png, manifest.json 의 sheets[이름] = { file: 'props/<이름>.png', … },
      assets/sprites/props/props_preview.html (조각 번호 · 이름 · 크기, 원본 시트에 번호 상자)
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).parent))
import process_sprites as ps  # noqa: E402
from process_prologue import remove_outer_white  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / 'assets/raw'
OUT = ROOT / 'assets/sprites/props'
MANIFEST = ROOT / 'assets/sprites/manifest.json'
MIN_BIG = 0.06  # 가장 큰 덩어리 넓이의 이 비율 이상이면 본체

# 시트 → 조각 이름 (읽는 순서), 배율 기준 (이름, 'h' 키 | 'w' 폭, px)
SHEETS = {
    'props_prologue.png': dict(ref=('prop_scarecrow', 'h', 80), names=[
        'prop_scarecrow', 'prop_scarecrow_broken', 'prop_katana', 'prop_fire_arrow',
        'prop_debris_fire', 'prop_fox_mask', 'prop_anvil', 'prop_sword_rack']),
    # 새 프롤로그 소품 시트(묘목 · 방울 · 삿갓 …)는 tools/process_prologue2.py 가 같은 방법으로 props/ 에 자른다
}


def blobs(a):
    """본체 덩어리들: [(y0, y1, x0, x1, mask)] 읽는 순서로"""
    from scipy import ndimage
    occ = a[..., 3] >= 24
    lab, n = ndimage.label(occ, structure=np.ones((3, 3)))
    sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    objs = ndimage.find_objects(lab)
    big = [i for i in range(n) if sizes[i] >= sizes.max() * MIN_BIG]
    owner = {i: i for i in big}
    # 작은 조각 → 상자끼리 가장 가까운 본체
    def gap(s, t):
        dy = max(0, max(s[0].start, t[0].start) - min(s[0].stop, t[0].stop))
        dx = max(0, max(s[1].start, t[1].start) - min(s[1].stop, t[1].stop))
        return dx * dx + dy * dy
    for i in range(n):
        if i in owner:
            continue
        owner[i] = min(big, key=lambda b: gap(objs[i], objs[b]))
    groups = {b: [i for i in range(n) if owner[i] == b] for b in big}
    out = []
    for b, members in groups.items():
        y0 = min(objs[i][0].start for i in members)
        y1 = max(objs[i][0].stop for i in members)
        x0 = min(objs[i][1].start for i in members)
        x1 = max(objs[i][1].stop for i in members)
        mask = np.isin(lab[y0:y1, x0:x1], [i + 1 for i in members])
        out.append((y0, y1, x0, x1, mask))
    # 줄 나누기: 세로 가운데가 앞 줄 높이의 절반 안이면 같은 줄
    out.sort(key=lambda t: (t[0] + t[1]) / 2)
    rows = []
    for t in out:
        cy = (t[0] + t[1]) / 2
        if rows and abs(cy - rows[-1]['cy']) < rows[-1]['h'] * 0.5:
            rows[-1]['items'].append(t)
        else:
            rows.append({'cy': cy, 'h': t[1] - t[0], 'items': [t]})
    return [t for r in rows for t in sorted(r['items'], key=lambda t: t[2])]


def cut(src, cfg, list_only=False):
    a = np.array(Image.open(RAW / src).convert('RGBA'))
    removed = remove_outer_white(a)
    found = blobs(a)
    print(f'{src}: 덩어리 {len(found)}개 (흰 배경 지움 {removed}px)')
    for k, (y0, y1, x0, x1, _) in enumerate(found):
        print(f'  #{k:2d}  x {x0:4d}~{x1:4d}  y {y0:4d}~{y1:4d}  ({x1 - x0}×{y1 - y0})')
    names = cfg['names']
    if list_only:
        return None
    if len(found) != len(names):
        sys.exit(f'  ✗ 이름 {len(names)}개와 덩어리 {len(found)}개가 다르다 — 조각을 확인하고 SHEETS 의 이름을 고쳐 주세요')
    ref_name, axis, px = cfg['ref']
    r = found[names.index(ref_name)]
    scale = ((r[1] - r[0]) if axis == 'h' else (r[3] - r[2])) / px
    pieces = []
    for name, (y0, y1, x0, x1, mask) in zip(names, found):
        crop = a[y0:y1, x0:x1].copy()
        crop[..., 3] = np.where(mask, crop[..., 3], 0)
        small = ps.downscale(crop, scale)
        small[..., 3] = np.where(small[..., 3] >= ps.ALPHA_CUT, 255, 0).astype(np.uint8)
        ys, xs = np.where(small[..., 3] > 0)
        small = small[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        Image.fromarray(small).save(OUT / f'{name}.png')
        pieces.append(dict(name=name, src=src, box=(x0, y0, x1, y1), w=int(small.shape[1]), h=int(small.shape[0])))
    print(f'  배율 1/{scale:.2f} → ' + ', '.join(f"{p['name']} {p['w']}×{p['h']}" for p in pieces))
    return pieces, a


def preview(all_pieces):
    """props_preview.html: 원본 시트(번호 상자) + 조각 목록"""
    html = ['<!doctype html><meta charset="utf-8"><title>소품 조각 미리보기</title>',
            '<style>body{background:#2b2b38;color:#eee;font:14px sans-serif;margin:20px}'
            '.sheet{max-width:100%;border:1px solid #555;margin:8px 0 20px}'
            '.grid{display:flex;flex-wrap:wrap;gap:14px}.p{background:repeating-conic-gradient(#555 0 25%,#444 0 50%) 0 0/16px 16px;'
            'padding:8px;text-align:center;min-width:120px}.p img{image-rendering:pixelated;transform-origin:bottom;display:block;margin:0 auto}'
            '.p b{display:block;color:#ffd166}</style>',
            '<h1>소품 조각 (tools/process_props.py)</h1><p>원본 시트에서 투명 영역으로 둘러싸인 덩어리를 찾아 자른 결과. 번호는 읽는 순서(위→아래, 왼→오른쪽). 화면에는 2배.</p>']
    for src, (pieces, a) in all_pieces.items():
        im = Image.fromarray(a)
        k = 900 / im.width
        sm = im.resize((900, int(im.height * k)))
        bg = Image.new('RGBA', sm.size, (60, 60, 76, 255))
        bg.alpha_composite(sm)
        d = ImageDraw.Draw(bg)
        for i, p in enumerate(pieces):
            x0, y0, x1, y1 = [int(v * k) for v in p['box']]
            d.rectangle([x0, y0, x1, y1], outline=(255, 209, 102), width=2)
            d.text((x0 + 3, y0 + 2), str(i), fill=(255, 255, 0))
        sheet_png = OUT / f"_sheet_{Path(src).stem[:12]}.png"
        bg.convert('RGB').save(sheet_png)
        html.append(f'<h2>{src}</h2><img class="sheet" src="{sheet_png.name}">')
        html.append('<div class="grid">')
        for i, p in enumerate(pieces):
            html.append(f'<div class="p"><b>#{i} {p["name"]}</b><img src="{p["name"]}.png" width="{p["w"] * 2}" height="{p["h"] * 2}">'
                        f'<small>{p["w"]}×{p["h"]}</small></div>')
        html.append('</div>')
    (OUT / 'props_preview.html').write_text('\n'.join(html), encoding='utf-8')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--list', action='store_true')
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    results = {}
    for src, cfg in SHEETS.items():
        r = cut(src, cfg, args.list)
        if r:
            results[src] = r
    if args.list:
        return
    m = json.loads(MANIFEST.read_text(encoding='utf-8'))
    for src, (pieces, _) in results.items():
        for p in pieces:
            old = m['sheets'].get(p['name'], {})
            # 예전 자리(assets/sprites/<이름>.png)에 있던 파일은 지운다 (props/ 로 옮김)
            if old.get('file') and not old['file'].startswith('props/'):
                f = ROOT / 'assets/sprites' / old['file']
                if f.exists():
                    f.unlink()
            m['sheets'][p['name']] = {'file': f"props/{p['name']}.png", 'source': src, 'width': p['w'], 'height': p['h'], 'kind': 'prop'}
    MANIFEST.write_text(json.dumps(m, ensure_ascii=False, indent=1), encoding='utf-8')
    preview(results)
    print('→ assets/sprites/props/ , manifest.json , props/props_preview.html')


if __name__ == '__main__':
    main()
