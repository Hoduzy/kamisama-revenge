"""그림 사용 점검표 → docs/asset-audit.md

    python3 tools/audit_assets.py [--usage tools/asset_usage.json]

새 그림을 넣을 때마다 다시 돌린다. 항목:
- 파일 / 원본 시트 / 개별 이미지로 잘렸는지
- 게임에서 로드되는지 (manifest.json 에 있으면 BootScene 이 모두 불러온다)
- 실제로 화면에 그려지는 장면: 브라우저에서 장면을 재생하며 Image·Sprite 가 그 그림을 쓴 순간을 기록한 결과
  (tools/asset_usage.json — 스크린샷 시험이 만든다). 없으면 코드·대본에서 그 이름을 쓰는 곳
- 같은 자리에 코드로 그린 임시 도형이 남아 있는지 (그림이 없을 때만 나오는 대체 도형인지)
마지막에 '로드는 되지만 화면에 안 쓰이는 그림' 목록.
"""
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPR = ROOT / 'assets/sprites'

# 그림이 없을 때만 나오는 코드 도형 (그림 이름 → 어디의 무엇)
FALLBACKS = {
    'prop_scarecrow': 'game-scene.js createTextures 의 허수아비 도형 (그림 없을 때만)',
    'prop_scarecrow_broken': 'enemy.js 허수아비 기울이기 (그림 없을 때만)',
    'prop_fire_arrow': 'game-scene.js fireArrow · gameplay.js arrowVolley 의 네모 (그림 없을 때만)',
    'prop_debris_fire': 'game-scene.js debris 의 네모 (그림 없을 때만)',
    'fx_barrier_break': 'enemy.js 금빛 고리 (그림 없을 때만)',
    'tree': 'tree.js 도형 나무 (그림 없을 때만)',
    'fx_red_sun_grow': '없음 (그림이 없으면 문양을 안 그림)',
    'logo_emblem': '없음',
    'lantern_rope': '없음 (조립 그림, 그림이 없으면 단색 네모)',
    'prop_rooftop_cultist': '없음 (enemy_sword 실루엣, 그림이 없으면 단색 네모)',
}
# 다른 그림의 재료로만 쓰이는 조각 (그 그림이 화면에 그려지면 쓰인 것)
USED_VIA = {'rope_segment': 'lantern_rope', 'lantern_lit': 'lantern_rope', 'lantern_torn': 'lantern_rope_fallen'}
KIND = [('bg_', '배경'), ('cg_', 'CG'), ('portraits', '초상화'), ('fx_', '이펙트'), ('prop', '소품'), ('ui_', 'UI'),
        ('tree', '벚나무'), ('logo', '로고')]


def kind_of(name, meta):
    if meta.get('kind') == 'prop':
        return '소품'
    for p, k in KIND:
        if name.startswith(p):
            return k
    return '인물·적' if meta.get('frames') else '기타'


def code_refs(name):
    """js · 대본 · 연출 표에서 이 이름을 쓰는 곳"""
    hits = []
    for f in sorted((ROOT / 'js').glob('*.js')):
        if re.search(r"['\"`]" + re.escape(name) + r"['\"`/_]", f.read_text(encoding='utf-8')):
            hits.append(f.name)
    scenes = set()
    for f in sorted((ROOT / 'data/story').glob('*.json')):
        d = json.loads(f.read_text(encoding='utf-8'))
        for sc in d.get('scenes', []):
            if f'"{name}"' in json.dumps(sc, ensure_ascii=False):
                scenes.add(sc['id'])
    return hits, sorted(scenes, key=lambda s: (s[0], [int(x) if x.isdigit() else 0 for x in re.findall(r'\d+', s)]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--usage', default=str(ROOT / 'tools/asset_usage.json'))
    args = ap.parse_args()
    m = json.loads((SPR / 'manifest.json').read_text(encoding='utf-8'))['sheets']
    usage = json.loads(Path(args.usage).read_text(encoding='utf-8')) if Path(args.usage).exists() else {}
    placeholders = set(re.findall(r'^\s{4}(\w+): \{ label', (ROOT / 'js/placeholders.js').read_text(encoding='utf-8'), re.M))
    files = sorted(p.relative_to(SPR).as_posix() for p in list(SPR.glob('*.png')) + list(SPR.glob('props/*.png'))
                   if not p.name.startswith('_') and not p.name.endswith('_strip.png'))
    by_file = {v.get('file'): k for k, v in m.items()}
    rows, unused = [], []
    for f in files:
        name = by_file.get(f) or Path(f).stem
        meta = m.get(name, {})
        if kind_of(name, meta) not in ('소품', '이펙트', '벚나무', '로고'):
            continue
        loaded = '로드됨' if name in m else '✗ manifest 에 없음'
        src = meta.get('source', '')
        cut = f'잘림 ({src})' if src and src != f else ('—' if not src else '원본 그대로')
        if meta.get('frames'):
            cut += f" · {meta['frames']}칸"
        drawn = usage.get(name, {})
        if not drawn and name in USED_VIA and usage.get(USED_VIA[name]):
            drawn = {f'{USED_VIA[name]} 의 재료 → ' + ', '.join(sorted(usage[USED_VIA[name]])): 1}
        js, scenes = code_refs(name)
        if drawn:
            where = '**그려짐**: ' + ', '.join(sorted(drawn))
        elif js or scenes:
            where = '코드·대본에서 씀 (시험에서 안 봄): ' + ', '.join(scenes + js)
        else:
            where = '✗ 안 쓰임'
        fb = FALLBACKS.get(name) or ('placeholders.js 단색 네모 (그림 없을 때만)' if name in placeholders else '없음')
        rows.append(f'| `{f}` | {kind_of(name, meta)} | {cut} | {loaded} | {where} | {fb} |')
        if name in m and not drawn:
            unused.append((name, where))
    # 원본 시트
    raws = sorted({v.get('source') for v in m.values() if v.get('kind') == 'prop' or (v.get('source') or '').startswith(('props', 'fx_prologue', 'prologue/F5'))} - {None})
    out = ['# 그림 사용 점검표 (소품 · 이펙트 · 벚나무)', '',
           '`python3 tools/audit_assets.py` 가 만든다. 새 그림을 넣을 때마다 다시 돌린다.',
           '「그려짐」은 개발 메뉴로 장면을 재생하며 실제로 그 그림이 화면 오브젝트에 쓰인 장면이다 (`tools/asset_usage.json`).', '',
           '## 원본 시트 → 조각', '']
    for r in raws:
        pieces = sorted(k for k, v in m.items() if v.get('source') == r)
        out.append(f'- `assets/raw/{r}` → {len(pieces)}조각: ' + ', '.join(f'`{p}`' for p in pieces))
    out += ['', '## 그림별', '', '| 파일 | 종류 | 개별 이미지로 잘렸는지 | 로드 | 실제로 화면에 그려지는 장면 | 같은 자리 코드 임시 도형 |',
            '|---|---|---|---|---|---|'] + rows
    out += ['', '## 로드는 되지만 화면에 안 쓰이는 그림', '']
    out += [f'- `{n}` — {w}' for n, w in unused] or ['- 없음']
    (ROOT / 'docs/asset-audit.md').write_text('\n'.join(out) + '\n', encoding='utf-8')
    print(f'docs/asset-audit.md: {len(rows)}개, 안 쓰이는 그림 {len(unused)}개')
    for n, w in unused:
        print('  ', n, '—', w)


if __name__ == '__main__':
    main()
