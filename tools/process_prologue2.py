"""새 프롤로그 그림 묶음 → 배경 · CG · 인물 시트 · 소품 · 초상화 (+ 원본 대비 미리보기)

    python3 tools/process_prologue2.py           # 전처리 결과 파일 + assets/sprites/prologue2_preview.html (manifest 는 그대로)
    python3 tools/process_prologue2.py --apply   # manifest.json 에도 넣는다 (게임이 쓰기 시작)

원본: assets/raw/prologue2/<새 이름>.png (없으면 assets/raw/prologue/<원래 이름>.png)
- 배경(bg_pro2_*): 투명 처리 없음. 기존 프롤로그 배경과 같은 도트(3.0) · 아래 15% 바닥 띠 · 화면 배율 계산 (process_sprites.process_stage_bg)
- CG(cg_A, cg_B): 투명 처리 없음. 16:9 로 위아래를 잘라 assets/cg/
- 인물 시트: 바깥과 이어진 흰색만 투명으로. 프레임은 빈 열에서 자르고, 붙어 있는 프레임(가운데 폭의 1.6배 넘는 구간)만
  가장 얇은 열에서 나눈다 — 설명의 프레임 수에 억지로 맞추지 않는다 (다르면 보고서에 표시)
  크기: 머리 높이를 기존 시트와 맞춘다 (아카네 = player_idle, 하루 = haru_idle, 소이치로 = soichiro_give 머리 본을 대어 배율을 찾음).
  나그네는 기존 하쿠야(hakuya_walk)와 같은 키, 마을 노인 · 할머니는 손으로 잰 머리 높이
- 소품: 덩어리 단위로 잘라(process_props.blobs) assets/sprites/props/ (같은 이름이 있으면 덮어씀). 배율은 나그네 시트 속 삿갓 폭에 맞춘다(같은 도트 굵기)
- 초상화: 기존 아카네 초상화와 같은 높이(107)
"""
import argparse
import html
import json
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
import process_sprites as ps  # noqa: E402
import process_prologue as pp  # noqa: E402
from process_props import blobs  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RAW_NEW = ROOT / 'assets/raw/prologue2'
RAW_OLD = ROOT / 'assets/raw/prologue'
OUT = ROOT / 'assets/sprites'
PROPS_OUT = OUT / 'props'  # 소품은 모두 props/ 한 곳 (tools/process_props.py 와 같은 폴더)

# 원래 파일 이름 → 새 이름, 종류, 판단 근거
FILES = [
    ('A91EBB5E-312D-4880-9A91-15B28659BA4D', 'bg_pro2_house', 'bg', '햇살 드는 실내, 가운데 이로리 화로와 주전자, 왼쪽에 개어 둔 이불'),
    ('1FA47849-DA42-47A5-8707-78EFDC561945', 'bg_pro2_yard', 'bg', '초가집 툇마루 앞마당, 빨랫줄의 천, 대나무 울타리'),
    ('D5A561F7-CF07-42C3-AA63-5C0F5814F357', 'bg_pro2_street', 'bg', '등롱 줄을 건 밝은 마을 길, 만두 찜통 가게, 가운데 붉은 도리이 신사 계단'),
    ('A2756280-692C-4EE8-90F1-84EFDD2009F8', 'bg_pro2_gate', 'bg', '삼나무 숲 앞 돌 도리이와 석등'),
    ('3FF77765-1907-4BC3-ABB8-192E36D38F8C', 'bg_pro2_cave', 'bg', '비 오는 새벽 동굴 입구, 멀리 마을 쪽 연기 기둥'),
    ('191F365C-54D4-4E28-8B82-54731322DEBB', 'bg_pro2_ash', 'bg', '비 오는 새벽, 무너진 집 · 우물 · 쓰러진 도리이, 잿더미'),
    ('9CC851B0-62AF-4567-9E4F-48DF662320EA', 'cg_A', 'cg', '벚나무 가지 위에 겹친 두 손, 손 아래 빛나며 피는 꽃 한 송이'),
    ('95ECCCEE-F563-4C90-8212-60CE72412776', 'cg_B', 'cg', '빗속 검게 탄 큰 나무 앞 돌무덤 두 개, 방울을 든 채 무릎 꿇은 아카네'),
    ('E3117D04-1D27-4C71-862E-E27A92840F4A', 'hakuya_traveler', 'sheet', '삿갓 · 회색 망토 · 지팡이: 돌에 앉기 2, 만두(김) 들기 2, 일어서기 2, 걷기 6'),
    ('470DF9DE-3C44-4FFB-A6AE-92811FEDB436', 'akane_morning', 'sheet', '흰 잠옷 · 붉은 이불: 자기 2, 하품 · 기지개 2, 머리 묶기 2, 일어서기 4'),
    ('4D5CFFC3-D567-4422-B5C1-16B2217A2C64', 'akane_emote1', 'sheet', '검은 기모노(마른 모습): 쪼그려 앉기 2, 손 뻗기 2, 불씨 1, 정좌 2, 밥 먹기 2, 웃기 1'),
    ('116FDC58-3725-4640-8A65-243AE41AFA31', 'akane_emote2', 'sheet', '머리 · 옷이 젖어 늘어진 모습, 방울 · 흙 파기 · 돌 치기가 있음'),
    ('AC761801-25E7-43FD-97C9-CD4FDF60A835', 'family_sitting', 'sheet', '붉은 기모노 하루 6프레임 + 앞치마 소이치로 4프레임'),
    ('EB3BE145-212E-4CF5-95A7-13C6A896F052', 'villagers_elder', 'sheet', '만두 바구니 든 할머니 4 + 지팡이 노인 4'),
    ('F5323BD8-A0E4-4ECA-86B0-BF088FDDF4DF', 'props', 'props', '소품 12개 (묘목 2, 방울 2, 비녀, 바구니, 찜통, 삿갓, 돌무덤 2, 노점 기둥, 가면)'),
    ('0A0C1F40-D30F-4237-A229-4B3FBE2A43E7', 'portraits_pro2', 'portraits', '초상 6칸: 아카네 3(웃음 · 젖은 슬픔 · 젖은 분노), 삿갓 나그네 2, 할머니 1'),
]

# 인물 시트: 기대 프레임(이름, 개수) · 바라보는 방향 · 크기 맞추는 법
# head_src: 원본 머리 높이(정수리~턱, 귀 · 상투 제외 · 눈금을 대고 손으로 잼), 머리 배율(아카네 = 1, 하루 1.05)
#   새 그림체는 머리 본 자동 맞추기 점수가 0.5~0.7 로 낮아 손으로 쟀다.
#   akane_morning 9번(선 모습) 88, akane_emote1 5번(정좌) 115, akane_emote2 는 정좌 키 비율로 62,
#   family_sitting 하루 0번 117 — 결과 머리가 haru_idle 보다 2px 작아 106 으로 보정, 할머니 0번 105
SHEET_CFG = {
    'hakuya_traveler': dict(expect=[('sit', 2), ('look_manju', 2), ('stand', 2), ('walk', 6)], facing='left',
                            size=('height_like', 'hakuya_walk', 'walk')),
    'akane_morning': dict(expect=[('sleep', 2), ('stretch', 2), ('tie_hair', 2), ('stand_up', 4)], facing='right',
                          size=('head_src', 88, 1.0)),
    'akane_emote1': dict(expect=[('crouch', 2), ('reach', 2), ('ember', 1), ('seiza', 2), ('eat', 2), ('smile', 1)], facing='right',
                         size=('head_src', 115, 1.0)),
    'akane_emote2': dict(expect=[('collapse', 2), ('sit_up', 2), ('shake_bell', 2), ('slow_walk', 4), ('dig', 2), ('strike', 2)],
                         facing='right', size=('head_src', 62, 1.0)),
    'family_sitting': dict(expect=[('haru_seiza', 2), ('haru_reach', 2), ('haru_eat', 2), ('soichiro_hide', 2), ('soichiro_laugh', 2)],
                           facing='left', size=('head_src', 106, 1.05)),
    'villagers_elder': dict(expect=[('grandma', 4), ('elder', 4)], facing='left', size=('head_src', 105, 1.0)),
}
PROP_NAMES = ['sapling_dead', 'sapling_burnt', 'bell_red', 'bell_wrapped', 'kanzashi', 'manju_basket', 'steamer',
              'kasa_hat', 'grave_a', 'grave_b', 'stall_burning', 'mask_broken']
# 애니메이션 (manifest 의 시트에 anims 로 적고, js/sprites.js createAnims 가 그대로 만든다): 이름 → (칸, 초당 칸, 반복)
ANIMS = {
    'hakuya_traveler': {'wanderer_sit': ([0, 1], 2, True), 'wanderer_look_manju': ([2, 3], 3, True),
                        'wanderer_stand': ([4, 5], 4, False), 'wanderer_walk': ([6, 7, 8, 9, 10, 11], 8, True)},
    'akane_morning': {'akane_sleep': ([0, 1], 1.5, True), 'akane_stretch': ([2, 3], 2.5, False),
                      'akane_tie_hair': ([4, 5], 3, True), 'akane_stand_up': ([6, 7, 8, 9], 6, False)},
    'akane_emote1': {'akane_crouch': ([0, 1], 2, True), 'akane_reach': ([2, 3], 3, False), 'akane_ember': ([4], 1, False),
                     'akane_seiza': ([5, 6], 1.5, True), 'akane_eat': ([7, 8], 3, True), 'akane_smile': ([9], 1, False)},
    'akane_emote2': {'akane_collapse': ([0, 1], 1.5, True), 'akane_sit_up': ([2, 3], 2, False), 'akane_shake_bell': ([4, 5], 5, True),
                     'akane_slow_walk': ([6, 7, 8, 9], 5, True), 'akane_dig': ([10, 11], 3, True), 'akane_strike': ([12, 13], 4, False)},
    'family_sitting': {'haru_seiza': ([0, 1], 1.5, True), 'haru_crouch_reach': ([2, 3], 2, False), 'haru_eat': ([4, 5], 3, True),
                       'soichiro_hide': ([6, 7], 2, True), 'soichiro_laugh': ([8, 9], 4, True)},
    'villagers_elder': {'grandma_idle': ([0, 1], 1.5, True), 'grandma_give': ([1, 2, 3], 3, False), 'grandma_wave': ([2, 3], 3, True),
                        'old_man_idle': ([4, 6], 1, True), 'old_man_bow': ([5], 1, False), 'old_man_laugh': ([7], 1, False)},
}
PORTRAIT_LABELS = ['akane_happy', 'akane_rain_sad', 'akane_rain_hate', 'traveler_neutral', 'traveler_smile', 'manju_grandma']

# 머리 본: (시트, 프레임, 정수리 y, 턱 y, 얼굴 x0, x1) 원본 px — 내용 맨 위 기준
HEAD_TPL = {
    'akane': ('player_idle', 6, 100, 225, 170, 292),
}


def src_path(old, new):
    p = RAW_NEW / f'{new}.png'
    return p if p.exists() else RAW_OLD / f'{old}.png'


def natural_frames(a):
    """빈 열에서 자르고, 너무 넓은 구간(붙은 프레임)만 나눈다 → [(x0, x1)]"""
    occ = (a[..., 3] >= ps.ALPHA_CUT).sum(0)
    segs = ps.split_axis(occ)
    med = float(np.median([s[1] - s[0] for s in segs]))
    out = []
    for x0, x1 in segs:
        n = int(round((x1 - x0) / med)) if (x1 - x0) > med * 1.6 else 1
        if n <= 1:
            out.append([x0, x1])
            continue
        cuts = [x0]
        for k in range(1, n):
            c = x0 + (x1 - x0) * k // n
            lo, hi = c - int(med * 0.3), c + int(med * 0.3)
            cuts.append(lo + int(np.argmin(occ[lo:hi])))
        cuts.append(x1)
        out += [[cuts[i], cuts[i + 1]] for i in range(n)]
    return out


def frames_from(a, segs):
    parts = []
    for x0, x1 in segs:
        part = a[:, x0:x1]
        ys = np.where((part[..., 3] >= ps.ALPHA_CUT).any(1))[0]
        parts.append(part[max(0, ys.min() - 4):ys.max() + 5])
    return parts


def head_template(cid):
    if cid == 'akane':
        sheet, n, y0, y1, x0, x1 = HEAD_TPL['akane']
        a, _ = pp.load(sheet)
        p = pp.split_frames(a, n)[0]
        ys = np.where(p[..., 3].any(1))[0]
        p = p[ys.min():]
        return pp.gray(p[y0:y1, x0:x1]), y1 - y0
    sheet, fi, y0, y1 = pp.HEAD_BASE[cid][0]
    a, _ = pp.load(sheet)
    p = pp.split_frames(a, pp.SHEETS[sheet][1])[fi]
    ys = np.where(p[..., 3].any(1))[0]
    p = p[ys.min():]
    band = p[y0:y1]
    cc = np.where(band[..., 3].any(0))[0]
    return pp.gray(band[:, cc.min():cc.max() + 1]), y1 - y0


def labels_for(expect, n):
    exp = [f'{name}_{i}' if c > 1 else name for name, c in expect for i in range(c)]
    return exp if len(exp) == n else [f'f{i}' for i in range(n)]


def process_sheet(name, a, cfg, sheets):
    segs = natural_frames(a)
    parts = frames_from(a, segs)
    expect_n = sum(c for _, c in cfg['expect'])
    akane_head_out = pp.AKANE_HEAD_SRC / sheets['player_idle']['dot']
    kind = cfg['size'][0]
    note = ''
    if kind == 'head':
        cid = cfg['size'][1]
        T, h = head_template(cid)
        use = parts
        if name == 'family_sitting':
            use = parts[:6]  # 하루 프레임으로 잰다
        k, score = pp.match_scale([T], use)
        head_src = h * k
        scale = 1.0 if cid == 'akane' else pp.CHARACTERS[cid]['head']
        dot = head_src / (akane_head_out * scale)
        note = f'머리 본 {cid} ×{k:.2f} (점수 {score}) → 원본 머리 {head_src:.0f}px'
    elif kind == 'head_src':
        _, head_src, scale = cfg['size']
        dot = head_src / (akane_head_out * scale)
        note = f'손으로 잰 머리 {head_src}px'
    else:  # height_like: 기준 시트의 서 있는 키와 같게
        _, ref, lab = cfg['size']
        target = float(np.median(sheets[ref]['heights']))
        labs = labels_for(cfg['expect'], len(parts))
        hs = [p.shape[0] - 9 for p, l in zip(parts, labs) if l.startswith(lab)] or [max(p.shape[0] for p in parts)]
        dot = float(np.median(hs)) / target
        note = f'{ref} 키 {target:.0f}px 에 맞춤'
    frames = [pp.shrink(p, dot) for p in parts]
    labels = labels_for(cfg['expect'], len(frames))
    entry = ps.save_sheet(name, frames, dict(anchor='feet', pad=2, facing=cfg['facing'], labels=labels), dot, OUT, f'prologue2/{name}.png')
    entry['heights'] = [int(f.shape[0]) for f in frames]
    if name in ANIMS:
        entry['anims'] = {k: {'frames': f, 'rate': r, 'loop': lp} for k, (f, r, lp) in ANIMS[name].items()}
    if name == 'family_sitting':
        entry['character'] = ['haru'] * 6 + ['soichiro'] * 4
    return entry, dict(found=len(frames), expect=expect_n, note=note)


def process_portraits(a, sheets):
    target = sheets['portraits']['frameHeight'] - 1
    segs = natural_frames(a)
    parts = frames_from(a, segs)
    dot = max(p.shape[0] for p in parts) / target
    frames = [pp.shrink(p, dot) for p in parts]
    labels = PORTRAIT_LABELS if len(frames) == len(PORTRAIT_LABELS) else [f'f{i}' for i in range(len(frames))]
    e = ps.save_sheet('portraits_pro2', frames, dict(anchor='bbox', pad=1, labels=labels), dot, OUT, 'prologue2/portraits_pro2.png')
    return e, dict(found=len(frames), expect=len(PORTRAIT_LABELS), note=f'높이 {target}')


def process_props(a, kasa_w):
    found = blobs(a)
    if len(found) != len(PROP_NAMES):
        return {}, dict(found=len(found), expect=len(PROP_NAMES), note='덩어리 수가 다름 — 자르지 않음')
    PROPS_OUT.mkdir(parents=True, exist_ok=True)
    r = found[PROP_NAMES.index('kasa_hat')]
    scale = (r[3] - r[2]) / kasa_w
    out = {}
    for n, (y0, y1, x0, x1, mask) in zip(PROP_NAMES, found):
        crop = a[y0:y1, x0:x1].copy()
        crop[..., 3] = np.where(mask, crop[..., 3], 0)
        small = ps.downscale(crop, scale)
        small, _ = ps.crop_to_content(small)
        Image.fromarray(small).save(PROPS_OUT / f'{n}.png')
        out[n] = {'file': f'props/{n}.png', 'source': 'prologue2/props.png', 'width': int(small.shape[1]),
                  'height': int(small.shape[0]), 'kind': 'prop', 'dot': round(scale, 2)}
    return out, dict(found=len(found), expect=len(PROP_NAMES), note=f'삿갓 폭 {kasa_w}px (나그네 시트 속 삿갓)에 맞춤, 배율 1/{scale:.2f}')


def kasa_width(entry):
    """나그네 시트 걷기 프레임의 삿갓 폭 (위에서 6줄 안의 가장 넓은 행)"""
    im = np.array(Image.open(OUT / entry['file']))
    fw, fh = entry['frameWidth'], entry['frameHeight']
    labs = entry['labels']
    ws = []
    for i, l in enumerate(labs):
        if not l.startswith('walk'):
            continue
        f = im[:, i * fw:(i + 1) * fw, 3] > 0
        rows = np.where(f.any(1))[0]
        band = f[rows.min():rows.min() + 14]
        ws.append(max(int(np.ptp(np.where(r)[0])) + 1 for r in band if r.any()))
    return int(np.median(ws)) if ws else 40


def preview(rows, manifest_sheets, cg):
    """원본 | 결과 나란히 (+ 기존 인물과 같은 배율로 세운 비교 줄)"""
    css = """:root{--bg:#f4f1ea;--fg:#1d1b18;--muted:#6b665d;--card:#fff;--line:#ddd6c8;--warn:#b5462b}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#16151a;--fg:#ece8e1;--muted:#9a948a;--card:#1f1e24;--line:#34323a;--warn:#ff8a65}}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,sans-serif}
main{max-width:1200px;margin:auto;padding:16px}
section{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px;margin:14px 0}
h2{font-size:16px;margin:0}.meta{color:var(--muted);font-size:12px;margin:2px 0 10px}.warn{color:var(--warn);font-weight:600}
.row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px}
@media(max-width:760px){.row{grid-template-columns:minmax(0,1fr)}}
.box{overflow:auto;border:1px solid var(--line);border-radius:6px;padding:6px;background:repeating-conic-gradient(#cfcfcf 0 25%,#f2f2f2 0 50%) 0 0/16px 16px}
.box img{display:block;image-rendering:pixelated}.orig img{max-width:100%;height:auto;image-rendering:auto}
.lab{font-size:12px;color:var(--muted);margin-bottom:4px}
.frames{display:flex;flex-wrap:wrap;gap:6px;align-items:flex-end}.frames figure{margin:0;text-align:center;font-size:10px;color:var(--muted)}
table{border-collapse:collapse;width:100%;font-size:13px}td,th{border-bottom:1px solid var(--line);padding:4px 6px;text-align:left;vertical-align:top}"""
    h = ['<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
         f'<title>Prologue2 Preview</title><style>{css}</style></head><body><main>',
         '<h1>새 프롤로그 그림: 원본 → 전처리 결과</h1>',
         '<p class="meta">tools/process_prologue2.py. 결과 칸은 게임 화면과 같은 배율(인물 · 소품 · 초상 1도트 = 2px 로 확대해 보임, 배경은 게임 배율). '
         '비교 줄은 기존 인물과 같은 배율로 나란히 세운 것.</p>',
         '<section><h2>대응표</h2><table><tr><th>원래 파일 이름</th><th>새 이름</th><th>판단 근거</th><th>프레임</th></tr>']
    for r in rows:
        fr = ''
        if r.get('found') is not None:
            ok = r['found'] == r['expect']
            fr = f"{r['found']} / 설명 {r['expect']}" + ('' if ok else ' <span class="warn">다름</span>')
        amb = ' <span class="warn">애매</span>' if r.get('ambiguous') else ''
        h.append(f"<tr><td><code>{r['old']}.png</code></td><td><b>{r['new']}</b>{amb}</td><td>{html.escape(r['why'])}</td><td>{fr}</td></tr>")
    h.append('</table></section>')
    rel_raw = '../raw/prologue/'
    for r in rows:
        new, kind = r['new'], r['kind']
        h.append(f'<section id="{new}"><h2>{new}</h2><div class="meta">{html.escape(r["why"])} · {html.escape(r.get("note", ""))}</div><div class="row">')
        h.append(f'<div><div class="lab">원본 {r["old"]}.png ({r["size"]})</div><div class="box orig"><img src="{rel_raw}{r["old"]}.png"></div></div><div><div class="lab">결과</div>')
        if kind == 'bg':
            e = manifest_sheets[new]
            h.append(f'<div class="box"><img src="{e["file"]}" width="{e["width"] * 2}" style="max-width:100%;height:auto"></div>'
                     f'<div class="meta">{e["width"]}×{e["height"]} · 도트 {e["dot"]} · 게임 배율 {e["displayScale"]} · 아래 15% 바닥 띠</div>')
        elif kind == 'cg':
            e = cg[new]
            h.append(f'<div class="box"><img src="../cg/{new}.png" style="width:100%;height:auto"></div>'
                     f'<div class="meta">{e["width"]}×{e["height"]} (16:9, 원본 위 {e["crop"]["top"]}px · 아래 {e["crop"]["bottom"]}px 잘라냄)</div>')
        elif kind == 'props':
            h.append('<div class="box frames">')
            for n, e in r['props'].items():
                h.append(f'<figure><img src="{e["file"]}" width="{e["width"] * 2}"><figcaption>{n}<br>{e["width"]}×{e["height"]}</figcaption></figure>')
            h.append('</div>')
        else:
            e = manifest_sheets[new]
            fw, fh = e['frameWidth'], e['frameHeight']
            h.append('<div class="box frames">')
            for i, lab in enumerate(e.get('labels') or range(e['frames'])):
                h.append(f'<figure><div style="width:{fw * 2}px;height:{fh * 2}px;background:url({e["file"]}) -{i * fw * 2}px 0/{fw * e["frames"] * 2}px {fh * 2}px;image-rendering:pixelated"></div>'
                         f'<figcaption>{i} {lab}</figcaption></figure>')
            h.append(f'</div><div class="meta">칸 {fw}×{fh} · 도트 {e["dot"]} · 키 {min(e["heights"]) if e.get("heights") else ""}~{max(e["heights"]) if e.get("heights") else ""}</div>')
            if r.get('compare'):
                h.append('<div class="lab">비교 (같은 배율): ' + ' · '.join(c[0] for c in r['compare']) + '</div><div class="box frames">')
                for cname, cfile, cfw, cfh, ci in r['compare']:
                    h.append(f'<figure><div style="width:{cfw * 2}px;height:{cfh * 2}px;background:url({cfile}) -{ci * cfw * 2}px 0/auto {cfh * 2}px;image-rendering:pixelated"></div><figcaption>{cname}</figcaption></figure>')
                h.append('</div>')
        h.append('</div></div></section>')
    h.append('</main></body></html>')
    (OUT / 'prologue2_preview.html').write_text('\n'.join(h), encoding='utf-8')


COMPARE = {
    'akane_morning': [('player_idle', 0)], 'akane_emote1': [('player_idle', 0)], 'akane_emote2': [('player_idle', 0)],
    'family_sitting': [('haru_idle', 0), ('soichiro_give', 0), ('player_idle', 0)],
    'hakuya_traveler': [('hakuya_walk', 0), ('boss', 0)],
    'villagers_elder': [('villager_woman', 1), ('villager_man', 1), ('player_idle', 0)],
    'portraits_pro2': [('portraits', 0), ('portraits_hakuya', 0)],
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true')
    args = ap.parse_args()
    man_path = OUT / 'manifest.json'
    manifest = json.loads(man_path.read_text(encoding='utf-8'))
    sheets = dict(manifest['sheets'])
    cgs = {}
    rows = []
    new_sheets = {}
    props_raw = None
    for old, new, kind, why in FILES:
        p = src_path(old, new)
        img = Image.open(p)
        r = dict(old=old, new=new, kind=kind, why=why, size=f'{img.width}×{img.height}')
        if kind == 'bg':
            a = np.array(img.convert('RGBA'))
            e = ps.process_stage_bg(a, OUT, new, f'prologue2/{new}.png', dict(anchor=0.5))
            new_sheets[new] = e
        elif kind == 'cg':
            a = np.array(img.convert('RGBA'))
            e = ps.process_cg(a, new, f'prologue2/{new}.png', dict(top=0.5))
            cgs[new] = e
        elif kind == 'sheet':
            a = np.array(img.convert('RGBA'))
            removed = pp.remove_outer_white(a)
            e, info = process_sheet(new, a, SHEET_CFG[new], sheets)
            new_sheets[new] = e
            sheets[new] = e
            r.update(info)
            if removed:
                r['note'] = r.get('note', '') + f' · 바깥 흰색 {removed}px 투명'
        elif kind == 'portraits':
            a = np.array(img.convert('RGBA'))
            pp.remove_outer_white(a)
            e, info = process_portraits(a, sheets)
            new_sheets[new] = e
            r.update(info)
        elif kind == 'props':
            props_raw = (r, np.array(img.convert('RGBA')))
        rows.append(r)
    # 소품은 나그네 시트의 삿갓 폭이 정해진 뒤
    r, a = props_raw
    pp.remove_outer_white(a)
    props, info = process_props(a, kasa_width(new_sheets['hakuya_traveler']))
    r.update(info, props=props)
    new_sheets.update(props)
    for r in rows:
        if r['new'] in COMPARE:
            r['compare'] = [(n, sheets[n]['file'], sheets[n]['frameWidth'], sheets[n]['frameHeight'], i) for n, i in COMPARE[r['new']]]
        if r['new'] == 'portraits_pro2':
            r['note'] = (r.get('note', '') + ' · 나그네 초상 3번 「기본」, 4번 「웃음」 (얼굴을 숨긴 인물이라 거의 같은 것이 의도 — 확인받음)')
    preview(rows, {**sheets, **new_sheets}, cgs)
    # 대응표 (문서)
    md = ['# 새 프롤로그 그림 대응표', '', '`python3 tools/process_prologue2.py` 가 만든다. 미리보기: `assets/sprites/prologue2_preview.html`', '',
          '| 원래 파일 이름 | 새 이름 | 판단 근거 | 프레임 (찾음 / 설명) | 비고 |', '|---|---|---|---|---|']
    for r in rows:
        fr = f"{r['found']} / {r['expect']}" if r.get('found') is not None else ''
        md.append(f"| `{r['old']}.png` | `{r['new']}` | {r['why']} | {fr} | {r.get('note', '').strip(' ·')} |")
    (ROOT / 'docs/prologue2-mapping.md').write_text('\n'.join(md) + '\n', encoding='utf-8')
    for r in rows:
        print(f"{r['old'][:8]} → {r['new']:16s} {r.get('found', '')}/{r.get('expect', '')} {r.get('note', '')}")
    if args.apply:
        manifest['sheets'].update(new_sheets)
        manifest.setdefault('cg', {}).update(cgs)
        man_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding='utf-8')
        print('manifest.json 갱신')


if __name__ == '__main__':
    main()
