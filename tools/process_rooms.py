"""새 프롤로그 배경 6장 → bg_pro2_* 교체 (방 시스템용, 거울 띠 없음)

    python3 tools/process_rooms.py

원본(assets/raw/<원래 이름>.png)을 내용으로 판단해 이름을 붙였다. 도트 3 으로 줄여 assets/sprites/<이름>.png.
방 시스템(js/rooms.js · data/rooms/*.json)은 그림 한 장을 그대로 방 하나로 쓴다 — 배율 · 바닥선은 방 설정 파일에.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
import process_sprites as ps  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / 'assets/raw'
OUT = ROOT / 'assets/sprites'
FILES = {
    '17138E00-6F95-44CC-97CA-469743FE1208': ('bg_pro2_house', '집 실내: 이불 · 경대 · 장지문 · 이로리 화로 · 부뚜막, 오른쪽 열린 문 밖 마당'),
    'A646A61F-44B6-4D83-828A-691CCDFE1A76': ('bg_pro2_yard', '초가집 툇마루 · 빨랫줄 · 대나무 울타리 · 돌 물확, 가운데 빈 흙자리'),
    '4B8CCD7F-7CBB-47DD-AB2A-2999DC0DAF1A': ('bg_pro2_street', '만두 가게(찜통) · 우물 · 붉은 도리이와 신사 계단 · 석등, 등롱 줄'),
    '6DF32CCF-5E2B-448A-A47B-04B9236B9022': ('bg_pro2_gate', '삼나무 숲길 · 돌 도리이 · 석등 · 넓적한 바위, 오른쪽 마을 집'),
    '9BA57213-F482-4D74-8B15-1AC6839784AF': ('bg_pro2_cave', '비 오는 동굴 입구, 멀리 연기 오르는 마을'),
    'C35F55EB-6BD6-46EE-913F-ECEDF3EEF6E7': ('bg_pro2_ash', '비 오는 잿더미 마을: 무너진 집 · 쓰러진 도리이 · 석등 · 우물, 검게 탄 나무'),
}


def main():
    man = OUT / 'manifest.json'
    manifest = json.loads(man.read_text(encoding='utf-8'))
    md = ['# 프롤로그 방 배경 대응표', '', '`python3 tools/process_rooms.py`', '', '| 원래 파일 | 새 이름 | 판단 근거 |', '|---|---|---|']
    for src, (name, why) in FILES.items():
        a = np.array(Image.open(RAW / f'{src}.png').convert('RGBA'))
        small = ps.downscale(a, ps.STAGE_BG_DOT)
        small[..., 3] = 255
        Image.fromarray(small).save(OUT / f'{name}.png')
        (OUT / f'{name}_strip.png').unlink(missing_ok=True)
        h, w = small.shape[:2]
        manifest['sheets'][name] = dict(file=f'{name}.png', source=f'{src}.png', width=int(w), height=int(h), dot=ps.STAGE_BG_DOT,
                                        displayScale=2, parallax=1, floorBand=0.15, anchor=0.5, stage=True, room=True)
        md.append(f'| `{src}.png` | `{name}` | {why} |')
        print(name, w, '×', h)
    # 방 시스템은 거울 띠를 쓰지 않는다: 다른 구역 배경도 원본 한 장을 그대로 불러오게 strip 표시를 뺀다
    for k, v in manifest['sheets'].items():
        if v.get('stage') and v.get('strip'):
            v.pop('strip')
            v['room'] = True
    man.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding='utf-8')
    (ROOT / 'docs/rooms-mapping.md').write_text('\n'.join(md) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
