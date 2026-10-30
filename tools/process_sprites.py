#!/usr/bin/env python3
"""ChatGPT로 만든 도트 이미지를 게임용 스프라이트 시트로 전처리한다.

    python3 tools/process_sprites.py              # assets/raw → assets/sprites
    python3 tools/process_sprites.py --only player_run boss

단계:
 1. 바깥과 연결된 흰 배경(밝기 240 이상)·투명 영역을 투명으로 만든다. 캐릭터 안쪽 흰색은 남는다.
 2. 도트 1칸 크기를 추정해 Nearest Neighbor(칸 중앙 샘플)로 축소한다.
 3. 투명한 세로 빈 열을 기준으로 프레임을 나눈다 (개수를 알고 있으면 거기에 맞춰 합치거나 자른다).
 4. 프레임을 같은 크기 칸에 넣고, 발바닥(아래)과 가로 중앙을 맞춘다.
 5. assets/sprites/ 에 가로 시트 PNG + manifest.json, 비교용 preview.html 을 만든다.

필요: Pillow, numpy
"""
import argparse
import json
import math
import re
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent

# ───────── 시트별 설정 ─────────
# frames: 프레임 수 / labels: 프레임 이름 / facing: 바라보는 방향
# anchor: 'feet' = 발(아래 12% 영역) 중앙을 기준으로 가로 정렬, 'bbox' = 테두리 상자 중앙
# pad: 칸 여백(도트) / dot: 도트 크기를 직접 지정하고 싶을 때 (None 이면 자동 추정)
# size: 최종 크기 맞추기
#   ('reference', 키)  player_idle 서 있는 키를 이 값으로. 다른 주인공 시트 배율의 기준이 된다
#   ('head',)          머리 크기가 player_idle 과 같아지도록 (시트 전체에 한 배율)
#                      자동 측정이 틀리면 head_scale=0.9 처럼 'idle 대비 이 시트 머리 크기'를 직접 적는다
# adjust: 위 계산이 끝난 뒤 이 시트만 추가로 곱하는 배율 (눈으로 보고 미세 조정. 다른 시트에는 영향 없음)
#   ('height', 키, i)  i 번째 프레임 키를 이 값으로 (i 없으면 가장 큰 프레임)
#   ('max', 크기)      프레임 중 가장 긴 변을 이 값으로 (이펙트)
PLAYER_HEIGHT = 96
PLAYER6 = dict(frames=6, facing='right', anchor='feet', pad=2, size=('head',))
ENEMY4 = dict(frames=4, facing='left', anchor='feet', pad=6, labels=['idle', 'windup', 'attack', 'death'])

SHEETS = {
    # idle 은 다른 시트의 기준(머리 크기·96도트)으로만 쓰고, 그림 자체는 adjust 로 조금 줄인다
    'player_idle': dict(PLAYER6, size=('reference', PLAYER_HEIGHT), adjust=0.85),
    'player_run': dict(PLAYER6),
    'player_jump': dict(PLAYER6, labels=['crouch', 'rise', 'apex', 'fall', 'land', 'recover']),
    'player_dash': dict(PLAYER6),
    'player_iaido_ready': dict(PLAYER6),
    'player_iaido_slash': dict(PLAYER6),
    'player_parry': dict(PLAYER6),
    'player_death': dict(PLAYER6, adjust=0.70),
    # 적은 가면이라 주인공 얼굴과 비교할 수 없어 서 있는(idle) 키로 맞춘다
    'enemy_sword': dict(ENEMY4, size=('height', 100, 0)),
    'enemy_ninja': dict(ENEMY4, size=('height', 100, 0)),
    'boss': dict(frames=1, facing='left', anchor='feet', pad=2, size=('height', 190, 0)),
    'tree': dict(frames=2, anchor='feet', pad=2, labels=['bare', 'bloom'], size=('height', 192)),
    'portraits': dict(frames=3, anchor='bbox', pad=1, labels=['neutral', 'angry', 'sad']),
    'ui_icons': dict(frames=4, anchor='bbox', pad=0, labels=['dash', 'iaido', 'stack_empty', 'stack_full']),
    # 2줄 × 8개를 4개씩 4개 시트로 나눈다
    # (시트 이름, 프레임 수, 가장 긴 변 크기)
    'effects': dict(kind='effects', anchor='bbox', pad=1, rows=[
        [('fx_petals', 4, 9), ('fx_slash', 4, 72)],
        [('fx_parry_flash', 4, 48), ('fx_sakura_burst', 4, 72)],
    ]),
    'tileset': dict(kind='tiles', tile=32),
    'bg_mid': dict(kind='background', parallax=0.3),
    'bg_near': dict(kind='background', parallax=0.6),
}

# 배경은 화면에 이 배율로 그린다고 보고 스테이지를 덮는지 계산한다 (배경 1도트 = 화면 2px).
# 캐릭터는 1도트 = 1px. 배경을 1배로 두면 높이가 화면 절반밖에 안 된다.
BG_DISPLAY_SCALE = 2


def player_body():
    cfg = (ROOT / 'js/config.js').read_text(encoding='utf-8')
    m = re.search(r'playerBody:\s*\{\s*width:\s*(\d+),\s*height:\s*(\d+)', cfg)
    return dict(width=int(m.group(1)), height=int(m.group(2)), note='몸통 판정. 발바닥 중앙(origin) 기준')


def game_numbers():
    """게임 화면 너비와 스테이지 길이를 js 설정에서 읽는다."""
    cfg = (ROOT / 'js/config.js').read_text(encoding='utf-8')
    lvl = (ROOT / 'js/level.js').read_text(encoding='utf-8')
    gw = int(re.search(r'GAME_WIDTH\s*=\s*(\d+)', cfg).group(1))
    sw = int(re.search(r'width:\s*(\d+)', lvl).group(1))
    return gw, sw

ALPHA_CUT = 128     # 축소 후 이 값 미만은 완전 투명, 이상은 불투명
WHITE_LUMA = 240    # 배경으로 볼 밝기


# ───────── 1. 배경 제거 ─────────

def luma(rgb):
    return rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114


def remove_background(img):
    """이미지 테두리에서 시작해 밝기 240 이상인 픽셀만 따라 퍼지며 투명으로 만든다(4방향).
    흰색만으로 테두리까지 이어진 영역 = 배경. 캐릭터 안쪽 흰색(눈 하이라이트, 칼날, 흰 옷)이나
    이미 투명한 배경에 떠 있는 흰 섬광은 흰색으로 테두리와 이어지지 않으므로 남는다."""
    a = np.array(img.convert('RGBA'))
    h, w = a.shape[:2]
    rgb = a[..., :3].astype(np.float32)
    cand = (a[..., 3] >= 16) & (luma(rgb) >= WHITE_LUMA)
    seen = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if cand[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if cand[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and cand[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    removed_white = int(seen.sum())
    a[seen] = 0

    # 흰 배경이었다면 가장자리에 남은 밝은 테두리(헤일로)를 2겹까지 걷어낸다
    if removed_white > 0:
        for _ in range(2):
            bg = a[..., 3] == 0
            near = np.zeros_like(bg)
            near[1:] |= bg[:-1]
            near[:-1] |= bg[1:]
            near[:, 1:] |= bg[:, :-1]
            near[:, :-1] |= bg[:, 1:]
            rgbf = a[..., :3].astype(np.float32)
            sat = rgbf.max(2) - rgbf.min(2)
            halo = near & ~bg & (luma(rgbf) >= 215) & (sat < 30)
            a[halo] = 0
    return a, removed_white


# ───────── 2. 도트 크기 추정 / 축소 ─────────

def _edges(a, axis):
    """axis=1: 가로 방향 경계 강도 (H × W-1), axis=0: 세로 방향 (W × H-1)"""
    rgb = a[..., :3].astype(np.float32) * (a[..., 3:4] / 255.0)
    if axis == 1:
        return np.abs(np.diff(rgb, axis=1)).sum(2)
    return np.abs(np.diff(rgb, axis=0)).sum(2).T


def _local_period(E, win=192, maxlag=16):
    """창(win 픽셀)마다 경계 강도의 자기상관에서 첫 봉우리를 찾아 중앙값을 낸다.
    AI 그림은 격자가 조금씩 어긋나므로 전체보다 부분별로 재는 게 안정적이다."""
    vals = []
    for s in range(0, max(1, E.shape[1] - win), win // 2):
        block = E[:, s:s + win]
        if (block > 30).sum() < win * 4:
            continue
        e = block.sum(0)
        e = e - e.mean()
        denom = (e * e).sum()
        if denom <= 0:
            continue
        ac = np.array([(e[:-l] * e[l:]).sum() for l in range(1, maxlag + 1)]) / denom
        for l in range(2, maxlag - 1):
            if ac[l - 1] > ac[l - 2] and ac[l - 1] >= ac[l] and ac[l - 1] > 0.08:
                y0, y1, y2 = ac[l - 2], ac[l - 1], ac[l]
                d = y0 - 2 * y1 + y2
                vals.append(l + (0.5 * (y0 - y2) / d if d else 0))
                break
    return (float(np.median(vals)), len(vals)) if vals else (None, 0)


def estimate_dot(a):
    px, nx = _local_period(_edges(a, 1))
    py, ny = _local_period(_edges(a, 0))
    if px is None and py is None:
        return 4.0
    if px is None:
        return py
    if py is None:
        return px
    if abs(px - py) / min(px, py) <= 0.15:
        return (px * nx + py * ny) / (nx + ny)
    return px if nx >= ny else py  # 크게 다르면 측정 창이 많은 쪽을 믿는다


def _phase(profile, s):
    """경계 강도 1차원 신호에서 주기 s 격자의 경계 위치(0~s)"""
    x = np.arange(len(profile))
    z = (profile * np.exp(2j * np.pi * x / s)).sum()
    c = (np.angle(z) / (2 * np.pi)) * s
    return (c + 1) % s  # profile[i] 는 i 와 i+1 사이 경계 → 칸 시작은 c+1


def downscale(a, s):
    """도트 칸 중앙 픽셀을 그대로 가져온다(Nearest Neighbor). 칸 위치는 이 영역에서 따로 맞춘다."""
    h, w = a.shape[:2]
    if h < 2 or w < 2:
        return a[:1, :1].copy()
    bx = _phase(_edges(a, 1).sum(0), s)
    by = _phase(_edges(a, 0).sum(0), s)
    xs = np.floor(bx - s * math.ceil(bx / s) + (np.arange(int(w / s) + 2) + 0.5) * s).astype(int)
    ys = np.floor(by - s * math.ceil(by / s) + (np.arange(int(h / s) + 2) + 0.5) * s).astype(int)
    xs = xs[(xs >= 0) & (xs < w)]
    ys = ys[(ys >= 0) & (ys < h)]
    out = a[ys][:, xs].copy()
    out[..., 3] = np.where(out[..., 3] >= ALPHA_CUT, 255, 0)
    out[out[..., 3] == 0] = 0
    return out


# ───────── 3. 프레임 분리 ─────────

def runs(mask):
    out, start = [], None
    for i, v in enumerate(mask):
        if v and start is None:
            start = i
        elif not v and start is not None:
            out.append([start, i])
            start = None
    if start is not None:
        out.append([start, len(mask)])
    return out


def split_axis(occ, count=None, min_mass_ratio=0.002):
    """occ: 열(또는 행)별 불투명 픽셀 수. 빈 구간에서 자르고, count 에 맞게 합치거나 나눈다."""
    segs = runs(occ > 1)
    total = occ.sum()
    # 먼지 같은 작은 조각 제거
    segs = [g for g in segs if occ[g[0]:g[1]].sum() >= total * min_mass_ratio] or segs
    if count:
        while len(segs) > count:  # 가장 좁은 틈부터 합침
            gaps = [segs[i + 1][0] - segs[i][1] for i in range(len(segs) - 1)]
            i = int(np.argmin(gaps))
            segs[i] = [segs[i][0], segs[i + 1][1]]
            del segs[i + 1]
        while len(segs) < count:  # 붙어 있는 프레임은 가장 넓은 구간의 가장 얇은 곳에서 자름
            i = int(np.argmax([g[1] - g[0] for g in segs]))
            a0, a1 = segs[i]
            lo, hi = a0 + (a1 - a0) // 5, a1 - (a1 - a0) // 5
            cut = lo + int(np.argmin(occ[lo:hi]))
            segs[i:i + 1] = [[a0, cut], [cut, a1]]
    return segs


def crop_to_content(a):
    op = a[..., 3] > 0
    if not op.any():
        return a[:1, :1], (0, 0)
    ys, xs = np.where(op)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1], (xs.min(), ys.min())


# ───────── 4. 칸 맞추기 ─────────

def anchor_x(frame, mode):
    if mode == 'feet':
        h = frame.shape[0]
        foot = frame[int(h * 0.88):, :, 3] > 0
        cols = np.where(foot.any(0))[0]
        if len(cols):
            return (cols.min() + cols.max() + 1) / 2
    return frame.shape[1] / 2


def pack(frames, mode, pad):
    """프레임마다 아래(발바닥)를 칸 바닥에, anchor 를 칸 가로 중앙에 둔다."""
    anchors = [anchor_x(f, mode) for f in frames]
    half = max(max(ax, f.shape[1] - ax) for f, ax in zip(frames, anchors))
    fw = int(math.ceil(half)) * 2 + pad * 2
    fh = max(f.shape[0] for f in frames) + pad
    sheet = np.zeros((fh, fw * len(frames), 4), np.uint8)
    for i, (f, ax) in enumerate(zip(frames, anchors)):
        x = i * fw + int(round(fw / 2 - ax))
        y = fh - f.shape[0]
        sheet[y:y + f.shape[0], x:x + f.shape[1]] = f
    return sheet, fw, fh


# ───────── 시트 종류별 처리 ─────────

def process_frames(a, cfg, dot, count=None):
    """한 줄짜리 시트: 원본 해상도에서 프레임을 나눈 뒤 프레임마다 축소한다."""
    op = a[..., 3] > 0
    segs = split_axis(op.sum(0), count or cfg.get('frames'))
    frames, bottoms = [], []
    for x0, x1 in segs:
        part = a[:, x0:x1]
        ys = np.where(part[..., 3].any(1))[0]
        if len(ys):
            part = part[max(0, ys.min() - 4):ys.max() + 5]
            bottoms.append(ys.max())
        small, _ = crop_to_content(downscale(part, dot))
        frames.append(small)
    # 원래 그림에서 발이 얼마나 떠 있었는지(점프 높이 참고용, 도트 단위)
    base = max(bottoms) if bottoms else 0
    lift = [round((base - b) / dot) for b in bottoms]
    return frames, lift


def fit_to(a, cfg, dot, measure, target, count=None):
    """measure(frames) 가 target 이 되도록 도트 크기(원본 몇 px 를 1칸으로 볼지)를 조정한다.
    축소는 항상 원본에서 바로 Nearest Neighbor 로 다시 뽑는다(축소본을 또 줄이지 않음)."""
    frames, lift = process_frames(a, cfg, dot, count)
    for _ in range(5):
        m = measure(frames)
        if abs(m - target) < 0.5:
            break
        dot = dot * m / target
        frames, lift = process_frames(a, cfg, dot, count)
    return frames, lift, dot


def frame_height(i=None):
    return lambda frames: frames[i].shape[0] if i is not None else max(f.shape[0] for f in frames)


def standing_height(frames):
    return float(np.median([f.shape[0] for f in frames]))


# ───────── 머리 크기 비교 ─────────

def _components(mask):
    h, w = mask.shape
    seen = np.zeros_like(mask)
    out = []
    for y, x in zip(*np.where(mask)):
        if seen[y, x]:
            continue
        seen[y, x] = True
        st, pts = [(y, x)], []
        while st:
            cy, cx = st.pop()
            pts.append((cy, cx))
            for ny in (cy - 1, cy, cy + 1):
                for nx in (cx - 1, cx, cx + 1):
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        st.append((ny, nx))
        out.append(np.array(pts))
    return out


def _face_blob(f):
    """얼굴 피부색 덩어리 (위쪽 60% 안에서 가장 큰 것. 귀 안쪽 분홍은 작아서 빠진다)"""
    r, g, b, a = [f[..., i].astype(int) for i in range(4)]
    skin = (a > 0) & (r > 170) & (g > 120) & (b > 100) & (r - b > 25) & (r >= g) & (r - g < 90)
    blobs = [c for c in _components(skin) if len(c) >= 12]
    upper = [c for c in blobs if c[:, 0].mean() < f.shape[0] * 0.6]
    blobs = upper or blobs
    return max(blobs, key=len) if blobs else None


def _flat(f):
    al = f[..., 3:4] / 255.0
    return f[..., :3] / 255.0 * al + 0.5 * (1 - al)


class HeadMatcher:
    """player_idle 첫 프레임의 머리(얼굴+고양이귀+앞머리)를 본으로 잘라 두고,
    다른 프레임에서 이 머리가 몇 배 크기로 가장 잘 맞는지 찾는다(정규화 상호상관).
    얼굴 피부 폭만 재면 1~2도트 오차가 20~30% 가 되어, 머리 전체 모양을 맞춰 보는 방식을 쓴다."""
    K_MIN, K_MAX = 0.6, 1.6  # 같은 캐릭터라 이 범위면 충분. 너무 작은 배율은 엉뚱한 곳에 맞는다

    def __init__(self, idle_frame):
        c = _face_blob(idle_frame)
        fy0, fy1, fx0, fx1 = c[:, 0].min(), c[:, 0].max(), c[:, 1].min(), c[:, 1].max()
        fw, fh = fx1 - fx0 + 1, fy1 - fy0 + 1
        ty0, ty1 = max(0, int(fy0 - 1.3 * fh)), fy1 + 2
        tx0, tx1 = max(0, int(fx0 - 1.0 * fw)), min(idle_frame.shape[1], int(fx1 + 0.5 * fw))
        self.tpl = Image.fromarray((_flat(idle_frame[ty0:ty1, tx0:tx1]) * 255).astype(np.uint8))
        self.face_c = ((fx0 + fx1) / 2 - tx0, (fy0 + fy1) / 2 - ty0)
        self.width = tx1 - tx0  # 머리 폭(도트) — idle 기준값

    def match(self, f):
        c = _face_blob(f)
        if c is None:
            return None
        cy, cx = c[:, 0].mean(), c[:, 1].mean()
        F = _flat(f)
        best = (-2.0, 1.0)
        for k in np.arange(self.K_MIN, self.K_MAX + 0.001, 0.02):
            tw, th = max(4, round(self.tpl.width * k)), max(4, round(self.tpl.height * k))
            T = np.asarray(self.tpl.resize((tw, th), Image.BILINEAR)) / 255.0
            T = T - T.mean()
            tn = np.sqrt((T * T).sum())
            oy, ox = round(cy - self.face_c[1] * k), round(cx - self.face_c[0] * k)
            for dy in range(-6, 7):
                for dx in range(-6, 7):
                    y, x = oy + dy, ox + dx
                    if y < 0 or x < 0 or y + th > F.shape[0] or x + tw > F.shape[1]:
                        continue
                    W = F[y:y + th, x:x + tw]
                    W = W - W.mean()
                    d = tn * np.sqrt((W * W).sum())
                    if d > 0:
                        s = float((T * W).sum() / d)
                        if s > best[0]:
                            best = (s, float(k))
        return best

    def ratio(self, frames):
        """이 시트의 머리 크기 / idle 머리 크기. 일치도가 높은 프레임 3개의 중앙값."""
        res = [m for m in (self.match(f) for f in frames) if m]
        res.sort(reverse=True)
        # 범위 끝에 걸린 값은 제대로 못 맞춘 것(가려진 얼굴, 누운 자세)이므로 뺀다
        good = [m for m in res if self.K_MIN + 0.01 < m[1] < self.K_MAX - 0.01] or res
        top = good[:3]
        conf = float(np.mean([s for s, _ in top]))
        return float(np.median([k for _, k in top])), conf, [(round(s, 2), round(k, 2)) for s, k in res]


def save_sheet(name, frames, cfg, dot, out_dir, source, lift=None):
    sheet, fw, fh = pack(frames, cfg.get('anchor', 'bbox'), cfg.get('pad', 1))
    Image.fromarray(sheet).save(out_dir / f'{name}.png')
    entry = dict(file=f'{name}.png', source=source, frameWidth=fw, frameHeight=fh, frames=len(frames),
                 origin=dict(x=0.5, y=1.0), dot=round(dot, 2))
    if cfg.get('facing'):
        entry['facing'] = cfg['facing']
    if cfg.get('labels'):
        entry['labels'] = cfg['labels']
    if lift and any(lift):
        entry['liftInSource'] = lift
    return entry


def process_effects(a, cfg, dot, out_dir, source):
    """줄 → 묶음(시트) 순서로 나누고, 묶음마다 가장 긴 변이 정한 크기가 되도록 따로 배율을 맞춘다."""
    entries = {}
    bands = split_axis((a[..., 3] > 0).sum(1), len(cfg['rows']))
    longest = lambda frames: max(max(f.shape[:2]) for f in frames)
    for (y0, y1), groups in zip(bands, cfg['rows']):
        band = a[y0:y1]
        segs = split_axis((band[..., 3] > 0).sum(0), sum(n for _, n, _ in groups))
        i = 0
        for name, n, target in groups:
            x0, x1 = segs[i][0], segs[i + n - 1][1]
            frames, _, d = fit_to(band[:, x0:x1], cfg, dot, longest, target, count=n)
            entries[name] = save_sheet(name, frames, cfg, d, out_dir, source)
            i += n
    return entries


def process_tiles(a, cfg, out_dir, source):
    """행 → 열 순서로 타일을 찾아 개별 PNG(32×32)로 저장. 도트 크기는 '가장 큰 타일 = 32px' 로 정한다."""
    T = cfg['tile']
    tile_dir = out_dir / 'tiles'
    tile_dir.mkdir(exist_ok=True)
    for old in tile_dir.glob('*.png'):
        old.unlink()
    op = a[..., 3] > 0
    regions = []
    for r, (y0, y1) in enumerate(split_axis(op.sum(1), min_mass_ratio=0.01)):
        for c, (x0, x1) in enumerate(split_axis(op[y0:y1].sum(0), min_mass_ratio=0.0005)):
            regions.append((r, c, x0, y0, x1, y1))
    widths = np.array([x1 - x0 for *_, x0, y0, x1, y1 in regions])
    full = widths[widths >= widths.max() * 0.85]
    dot = float(np.median(full)) / T

    tiles = []
    atlas_cols = 12
    for idx, (r, c, x0, y0, x1, y1) in enumerate(regions):
        small, _ = crop_to_content(downscale(a[y0:y1, x0:x1], dot))
        h, w = small.shape[:2]
        # 거의 한 칸이면 32 로 맞춤(NN), 작은 조각(기둥 머리, 끝 장식 등)은 원래 크기로 아래·가운데 정렬
        nw = T if w >= T * 0.75 else min(w, T)
        nh = T if h >= T * 0.75 else min(h, T)
        if (nw, nh) != (w, h):
            small = np.array(Image.fromarray(small).resize((nw, nh), Image.NEAREST))
        canvas = np.zeros((T, T, 4), np.uint8)
        ox, oy = (T - nw) // 2, T - nh
        canvas[oy:oy + nh, ox:ox + nw] = small
        name = f'tile_r{r}_c{c:02d}.png'
        Image.fromarray(canvas).save(tile_dir / name)
        tiles.append(dict(file=f'tiles/{name}', row=r, col=c, size=[int(w), int(h)],
                          stretched=bool((nw, nh) != (w, h))))
    # 한 장으로도 저장 (Phaser spritesheet 로 바로 쓸 수 있게 32×32 격자)
    rows_n = math.ceil(len(tiles) / atlas_cols)
    atlas = Image.new('RGBA', (atlas_cols * T, rows_n * T))
    for i, t in enumerate(tiles):
        atlas.paste(Image.open(tile_dir / Path(t['file']).name), ((i % atlas_cols) * T, (i // atlas_cols) * T))
    atlas.save(out_dir / 'tileset.png')
    return dict(file='tileset.png', source=source, frameWidth=T, frameHeight=T, frames=len(tiles),
                columns=atlas_cols, dot=round(dot, 2), tiles=tiles)


def process_background(a, out_dir, name, source, parallax):
    """자르지 않고 도트 해상도로만 줄인다. 패럴랙스로 스테이지를 덮는 데 모자라면
    좌우 반전 사본을 번갈아 붙인 띠(A, 반전A, A, …)를 따로 만든다. 반전 이음매는 저절로 맞는다."""
    dot = estimate_dot(a)
    small = downscale(a, dot)
    Image.fromarray(small).save(out_dir / f'{name}.png')
    gw, stage = game_numbers()
    need = gw + (stage - gw) * parallax           # 이 레이어가 화면에 보여야 하는 총 길이(px)
    shown = small.shape[1] * BG_DISPLAY_SCALE      # 배경 한 장이 화면에서 차지하는 길이(px)
    copies = max(1, math.ceil(need / shown))
    entry = dict(file=f'{name}.png', source=source, width=int(small.shape[1]), height=int(small.shape[0]),
                 dot=round(dot, 2), parallax=parallax, displayScale=BG_DISPLAY_SCALE,
                 coverage=dict(gameWidth=gw, stageWidth=stage, needPx=round(need), onePx=int(shown),
                               copies=copies, covered=copies == 1))
    if copies > 1:
        parts = [small if i % 2 == 0 else small[:, ::-1] for i in range(copies)]
        strip = np.concatenate(parts, axis=1)
        Image.fromarray(strip).save(out_dir / f'{name}_strip.png')
        entry['strip'] = dict(file=f'{name}_strip.png', width=int(strip.shape[1]), height=int(strip.shape[0]),
                              pattern='A, 반전A 번갈아')
    return entry


# ───────── preview.html ─────────

def write_preview(manifest, out_dir, src_rel):
    data = json.dumps(manifest, ensure_ascii=False)
    html = """<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sprite Preview</title>
<style>
:root { --bg:#f4f1ea; --fg:#1d1b18; --muted:#6b665d; --card:#fff; --line:#ddd6c8; --accent:#d6336c; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg:#16151a; --fg:#ece8e1; --muted:#9a948a; --card:#1f1e24; --line:#34323a; } }
body { margin:0; background:var(--bg); color:var(--fg); font:14px/1.5 system-ui,-apple-system,sans-serif; }
header { padding:20px 16px 4px; max-width:1200px; margin:auto; }
h1 { font-size:20px; margin:0 0 4px; } header p { color:var(--muted); margin:0; }
.controls { display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin:10px 0; }
main { max-width:1200px; margin:auto; padding:0 16px 40px; }
section { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:14px; margin:14px 0; }
h2 { font-size:16px; margin:0 0 2px; } .meta { color:var(--muted); font-size:12px; margin-bottom:10px; }
.row { display:grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap:14px; align-items:start; }
@media (max-width:760px) { .row { grid-template-columns: minmax(0,1fr); } }
.label { font-size:12px; color:var(--muted); margin-bottom:4px; }
.box { overflow:auto; border:1px solid var(--line); border-radius:6px; padding:6px;
  background: repeating-conic-gradient(#cfcfcf 0 25%, #f2f2f2 0 50%) 0 0/16px 16px; }
.box img, .box canvas { display:block; image-rendering:pixelated; }
.orig img { max-width:100%; height:auto; image-rendering:auto; }
.anim { display:flex; gap:14px; align-items:flex-end; margin-top:10px; flex-wrap:wrap; }
.tiles { display:flex; flex-wrap:wrap; gap:6px; }
.tiles figure { margin:0; text-align:center; font-size:10px; color:var(--muted); }
.tiles img { width:64px; height:64px; image-rendering:pixelated; border:1px dashed var(--line); }
.lineup canvas { image-rendering:pixelated; display:block; width:100%; height:auto; }
.legend { display:flex; gap:16px; flex-wrap:wrap; font-size:12px; color:var(--muted); margin:6px 0 0; }
.legend i { display:inline-block; width:14px; height:0; border-top:2px solid; vertical-align:middle; margin-right:4px; }
.warn { color:#c2410c; }
</style></head><body>
<header><h1>스프라이트 전처리 미리보기</h1>
<p>왼쪽: 원본 (assets/raw) · 오른쪽: 결과 (assets/sprites). 빨간 선 = 프레임 칸 경계, 분홍 선 = 바닥선(발바닥 정렬 기준).</p>
<div class="controls"><label>확대 <select id="zoom"><option>2</option><option selected>3</option><option>4</option><option>6</option></select></label>
<label>속도 <select id="fps"><option>6</option><option selected>10</option><option>15</option></select> fps</label></div></header>
<main id="list"></main>
<script>
const M = __DATA__;
const SRC = '__SRC__';
const list = document.getElementById('list');
const zoomSel = document.getElementById('zoom'), fpsSel = document.getElementById('fps');
const anims = [];
function el(tag, attrs = {}, ...kids) { const e = document.createElement(tag); Object.assign(e, attrs); kids.forEach(k => e.append(k)); return e; }

function sheetCanvas(img, s) {
  const z = +zoomSel.value, c = el('canvas'); c.width = img.width * z; c.height = img.height * z;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, c.width, c.height);
  if (s.frames) {
    g.strokeStyle = 'rgba(220,30,30,.8)'; g.lineWidth = 1;
    for (let i = 0; i <= s.frames; i++) { const x = i * s.frameWidth * z + .5; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, c.height); g.stroke(); }
    g.strokeStyle = 'rgba(214,51,108,.9)'; g.beginPath(); g.moveTo(0, c.height - .5); g.lineTo(c.width, c.height - .5); g.stroke();
  }
  return c;
}

const IDLE_H = M.sheets.player_idle && M.sheets.player_idle.heights
  ? [...M.sheets.player_idle.heights].sort((a, b) => a - b)[M.sheets.player_idle.heights.length >> 1] : 96;
// 같은 바닥선 위에 나란히 세워 크기를 비교한다
const LINEUP = [
  { title: '주인공 시트 전체 (머리 크기 기준 정규화)', names: Object.keys(M.sheets).filter(n => n.startsWith('player_')), body: true },
  { title: '적 · 보스 · 벚꽃나무와 비교', names: ['player_idle', 'enemy_sword', 'enemy_ninja', 'boss', 'tree'], body: true },
];
const lineups = [];
function renderLineup() {
  const z = 2; // 한눈에 보이도록 고정 2배 그린 뒤 상자 폭에 맞춰 줄인다
  for (const L of LINEUP) {
    const items = L.names.filter(n => M.sheets[n] && M.sheets[n].frames);
    if (!items.length) continue;
    const gap = 12, top = 24, bottom = 44;
    const maxH = Math.max(...items.map(n => M.sheets[n].frameHeight), 100);
    const W = items.reduce((w, n) => w + M.sheets[n].frameWidth + gap, gap);
    const c = el('canvas'); c.width = W * z; c.height = (maxH + top + bottom) * z;
    const box = el('div', { className: 'box lineup' }, c);
    const sec = el('section', {}, el('h2', { textContent: L.title }),
      el('div', { className: 'meta', textContent: '모든 시트를 같은 바닥선에 맞춰 동시에 재생. 숫자 = idle 대비 머리 배율(원본 기준), 아래 = 이 시트 키 범위' }),
      box,
      el('div', { className: 'legend' },
        el('span', {}, el('i', { style: 'border-color:#d6336c' }), '바닥선'),
        el('span', {}, el('i', { style: 'border-color:#2563eb;border-top-style:dashed' }), `idle 서 있는 키 ${IDLE_H}도트`),
        el('span', {}, el('i', { style: 'border-color:#16a34a' }), '주인공 판정 박스 ' + (M.sheets.player_idle && M.sheets.player_idle.body ? M.sheets.player_idle.body.width + '×' + M.sheets.player_idle.body.height : ''))));
    list.append(sec);
    const imgs = {};
    let loaded = 0;
    items.forEach(n => { const im = new Image(); im.onload = () => { if (++loaded === items.length) lineups.push({ c, z, items, imgs, gap, top, maxH }); }; im.src = M.sheets[n].file; imgs[n] = im; });
  }
}
function drawLineups() {
  for (const L of lineups) {
    const g = L.c.getContext('2d'), z = L.z; g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, L.c.width, L.c.height);
    const base = (L.top + L.maxH) * z;
    let x = L.gap;
    g.font = `bold ${8 * z}px system-ui`; g.textAlign = 'center';
    for (const n of L.items) {
      const s = M.sheets[n], i = frame % s.frames;
      g.drawImage(L.imgs[n], i * s.frameWidth, 0, s.frameWidth, s.frameHeight, x * z, base - s.frameHeight * z, s.frameWidth * z, s.frameHeight * z);
      const cx = (x + s.frameWidth / 2) * z;
      if (n.startsWith('player_') && M.sheets.player_idle && M.sheets.player_idle.body) {
        const b = M.sheets.player_idle.body; g.strokeStyle = '#16a34a'; g.lineWidth = 1;
        g.strokeRect(cx - b.width * z / 2 + .5, base - b.height * z + .5, b.width * z - 1, b.height * z - 1);
      }
      g.fillStyle = '#333';
      const short = n.replace('player_', '').replace('enemy_', '');
      g.fillText(short, cx, base + 10 * z);
      const k = (s.headScaleVsIdle != null ? '머리 ' + s.headScaleVsIdle + (s.headConfidence < 0.7 ? ' ⚠' : '') : '') + (s.adjust ? ' ×' + s.adjust : '');
      g.fillStyle = s.headConfidence < 0.7 ? '#c2410c' : '#666';
      g.fillText(k, cx, base + 20 * z);
      x += s.frameWidth + L.gap;
    }
    g.strokeStyle = '#d6336c'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, base); g.lineTo(L.c.width, base); g.stroke();
    g.strokeStyle = '#2563eb'; g.lineWidth = 1; g.setLineDash([6, 4]); g.beginPath();
    g.moveTo(0, base - IDLE_H * z + .5); g.lineTo(L.c.width, base - IDLE_H * z + .5); g.stroke(); g.setLineDash([]);
  }
}

function render() {
  list.innerHTML = ''; anims.length = 0; lineups.length = 0;
  renderLineup();
  for (const [name, s] of Object.entries(M.sheets)) {
    const sec = el('section');
    const info = s.tiles ? `타일 ${s.tiles.length}개 · 32×32 · 도트 ${s.dot}px`
      : s.frames ? `${s.frames}프레임 · 칸 ${s.frameWidth}×${s.frameHeight} · 도트 ${s.dot}px` + (s.facing ? ` · ${s.facing === 'right' ? '오른쪽' : '왼쪽'} 봄` : '')
      : `${s.width}×${s.height} · 도트 ${s.dot}px · 패럴랙스 ${s.parallax} · 화면 ${s.displayScale}배로 그리면 한 장 ${s.coverage.onePx}px, 필요 ${s.coverage.needPx}px → ` + (s.coverage.covered ? '한 장으로 충분' : `${s.coverage.copies}장 거울 반복`);
    sec.append(el('h2', { textContent: name }), el('div', { className: 'meta', textContent: info + (s.labels ? ' · ' + s.labels.join(', ') : '') }));
    const orig = el('div', {}, el('div', { className: 'label', textContent: '원본 ' + s.source }),
      el('div', { className: 'box orig' }, el('img', { src: SRC + s.source, loading: 'lazy' })));
    const outBox = el('div', { className: 'box' });
    const out = el('div', {}, el('div', { className: 'label', textContent: '결과 ' + s.file }), outBox);
    sec.append(el('div', { className: 'row' }, orig, out));
    const img = new Image(); img.src = s.strip ? s.strip.file : s.file;
    img.onload = () => {
      if (s.tiles) {
        const t = el('div', { className: 'tiles' });
        s.tiles.forEach(tt => t.append(el('figure', {}, el('img', { src: tt.file }), el('figcaption', { textContent: `r${tt.row} c${tt.col}${tt.stretched ? ' ↔' : ''}` }))));
        outBox.append(t);
      } else if (!s.frames) {
        // 배경: 두 장 이어 붙여 이음매 확인
        // 배경: 거울 반복 띠 전체 (분홍 눈금 = 사본 경계)
        const c = el('canvas'); c.width = img.width; c.height = img.height; c.style.width = '100%';
        const g = c.getContext('2d'); g.drawImage(img, 0, 0);
        g.fillStyle = 'rgba(214,51,108,.9)';
        for (let x = s.width; x < img.width; x += s.width) { g.fillRect(x, 0, 1, 8); g.fillRect(x, c.height - 8, 1, 8); }
        outBox.append(c);
        out.append(el('div', { className: 'label', textContent: s.strip ? `↑ ${s.strip.file} (${s.strip.width}×${s.strip.height}) · A, 반전A 번갈아 ${s.coverage.copies}장 · 분홍 눈금 = 경계` : '↑ 원본 그대로 한 장' }));
      } else {
        outBox.append(sheetCanvas(img, s));
        if (s.frames > 1) {
          const z = +zoomSel.value, c = el('canvas'); c.width = s.frameWidth * z; c.height = s.frameHeight * z;
          out.append(el('div', { className: 'anim' }, el('div', {}, el('div', { className: 'label', textContent: '재생' }), el('div', { className: 'box' }, c))));
          anims.push({ c, img, s, z });
        }
      }
    };
    list.append(sec);
  }
}
let frame = 0;
function tick() {
  frame++;
  drawLineups();
  for (const a of anims) {
    const g = a.c.getContext('2d'), i = frame % a.s.frames; g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, a.c.width, a.c.height);
    g.drawImage(a.img, i * a.s.frameWidth, 0, a.s.frameWidth, a.s.frameHeight, 0, 0, a.c.width, a.c.height);
  }
  setTimeout(tick, 1000 / +fpsSel.value);
}
zoomSel.onchange = render;
render(); tick();
</script></body></html>"""
    html = html.replace('__DATA__', data).replace('__SRC__', src_rel)
    (out_dir / 'preview.html').write_text(html, encoding='utf-8')


# ───────── main ─────────

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--src', default=str(ROOT / 'assets/raw'))
    ap.add_argument('--out', default=str(ROOT / 'assets/sprites'))
    ap.add_argument('--only', nargs='*', help='이 이름의 원본만 처리 (manifest 의 나머지는 유지)')
    args = ap.parse_args()
    src, out = Path(args.src), Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    man_path = out / 'manifest.json'
    manifest = json.loads(man_path.read_text(encoding='utf-8')) if (args.only and man_path.exists()) else {}
    manifest.setdefault('sheets', {})

    ref = {}  # player_idle 기준: 머리 본(matcher), 축소 배율 g(원본 도트 1칸 → 출력 몇 px)

    def reference():
        if not ref:
            ia, _ = remove_background(Image.open(src / 'player_idle.png'))
            icfg = SHEETS['player_idle']
            d0 = estimate_dot(ia)
            native, _ = process_frames(ia, icfg, d0)
            _, _, dref = fit_to(ia, icfg, d0, standing_height, icfg['size'][1])
            ref.update(matcher=HeadMatcher(native[0]), g=d0 / dref, dot=dref)
        return ref

    for name, cfg in SHEETS.items():
        if args.only and name not in args.only:
            continue
        path = src / f'{name}.png'
        if not path.exists():
            print(f'  ! {path.name} 없음 — 건너뜀')
            continue
        a, removed = remove_background(Image.open(path))
        source = path.name
        kind = cfg.get('kind')
        if kind == 'tiles':
            entry = process_tiles(a, cfg, out, source)
            manifest['sheets'][name] = entry
            note = f"타일 {entry['frames']}개"
        elif kind == 'background':
            entry = process_background(a, out, name, source, cfg['parallax'])
            manifest['sheets'][name] = entry
            cv = entry['coverage']
            note = (f"{entry['width']}×{entry['height']}  화면 {cv['onePx']}px / 필요 {cv['needPx']}px"
                    f" → {'한 장으로 충분' if cv['covered'] else str(cv['copies']) + '장 거울 반복'}")
        else:
            dot = cfg.get('dot') or estimate_dot(a)
            if kind == 'effects':
                entries = process_effects(a, cfg, dot, out, source)
                manifest['sheets'].update(entries)
                note = ', '.join(f"{k} {v['frames']}×{v['frameWidth']}×{v['frameHeight']}" for k, v in entries.items())
            else:
                size = cfg.get('size')
                extra = {}
                if size and size[0] == 'reference':
                    r = reference()
                    dot = r['dot']
                    frames, lift = process_frames(a, cfg, dot)
                    extra = dict(headScaleVsIdle=1.0, headWidth=round(r['matcher'].width * r['g'], 1),
                                 body=player_body())
                elif size and size[0] == 'head':
                    r = reference()
                    native, _ = process_frames(a, cfg, dot)
                    k, conf, matches = r['matcher'].ratio(native)
                    if cfg.get('head_scale'):
                        k, conf = cfg['head_scale'], 1.0
                    dot = dot * k / r['g']
                    frames, lift = process_frames(a, cfg, dot)
                    extra = dict(headScaleVsIdle=round(k, 3), headConfidence=round(conf, 2),
                                 headManual=bool(cfg.get('head_scale')), headMatches=matches)
                elif size and size[0] == 'height':
                    idx = size[2] if len(size) > 2 else None
                    frames, lift, dot = fit_to(a, cfg, dot, frame_height(idx), size[1])
                else:
                    frames, lift = process_frames(a, cfg, dot)
                if cfg.get('adjust'):
                    dot = dot / cfg['adjust']
                    frames, lift = process_frames(a, cfg, dot)
                    extra['adjust'] = cfg['adjust']
                entry = save_sheet(name, frames, cfg, dot, out, source, lift)
                entry.update(extra)
                hs = [f.shape[0] for f in frames]
                entry['heights'] = hs
                manifest['sheets'][name] = entry
                note = (f"{entry['frames']}프레임 칸 {entry['frameWidth']}×{entry['frameHeight']}  키 {min(hs)}~{max(hs)}"
                        + (f"  머리배율 {extra['headScaleVsIdle']}" if 'headScaleVsIdle' in extra else '')
                        + ('  ⚠ 머리 일치도 낮음' if extra.get('headConfidence', 1) < 0.7 else ''))
        dot_shown = manifest['sheets'].get(name, {}).get('dot') or round(dot, 2)
        print(f'  {name:<20} 도트 {dot_shown:>5}px  흰 배경 제거 {removed:>7}px  → {note}')

    manifest['note'] = 'tools/process_sprites.py 로 생성. origin 은 프레임 칸 기준 (0.5, 1) = 발바닥 중앙.'
    man_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    write_preview(manifest, out, src_rel='../raw/')
    print(f'완료: {out.relative_to(ROOT)}/ (manifest.json, preview.html)')


if __name__ == '__main__':
    main()
