"""게임 글자 중 둥근모꼴(assets/fonts/DungGeunMo.ttf)에 없는 글자를 찾아 경고한다.

    python3 tools/check_glyphs.py          # 목록만 보여 주고 끝 (없는 글자가 있어도 0 으로 끝남)
    python3 tools/check_glyphs.py --strict # 없는 글자가 있으면 1 로 끝남 (CI 등에서)

tools/convert_story.py (대본 빌드) 끝에도 자동으로 불린다.

살펴보는 곳
- data/story/*.json 의 모든 문자열 값
- js/*.js 의 문자열 ('…' "…" `…`, 주석 제외)
- index.html 의 글자, style.css 의 content: "…"
- js/lib/ 은 외부 라이브러리라 건너뛴다

코드에서 일부러 대체하는 글자(아래 HANDLED)는 경고하지 않는다.
"""
import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FONT = ROOT / 'assets/fonts/DungGeunMo.ttf'

# 코드가 그림으로 바꿔 그리는 글자: ▶ ▼ ◀ ▲ 는 ui.js 의 픽셀 화살표(<i class="px-arrow">)로 바뀐다
HANDLED = set('▶▼◀▲')
# 공백·제어 문자는 글꼴과 상관없다
IGNORE = set(' \n\r\t​️')


def font_chars():
    from fontTools.ttLib import TTFont
    return set(TTFont(FONT).getBestCmap())


def strip_js_comments(src):
    # 문자열 안의 // 를 지우지 않도록 문자열과 주석을 함께 훑는다
    out, i, n = [], 0, len(src)
    while i < n:
        c = src[i]
        if c in '\'"`':
            j = i + 1
            while j < n and src[j] != c:
                j += 2 if src[j] == '\\' else 1
            out.append(src[i:j + 1])
            i = j + 1
        elif src.startswith('//', i):
            j = src.find('\n', i)
            i = n if j < 0 else j
        elif src.startswith('/*', i):
            j = src.find('*/', i)
            i = n if j < 0 else j + 2
        else:
            out.append(c)
            i += 1
    return ''.join(out)


def js_strings(src):
    src = strip_js_comments(src)
    for m in re.finditer(r"'(?:\\.|[^'\\\n])*'|\"(?:\\.|[^\"\\\n])*\"|`(?:\\.|[^`\\])*`", src):
        yield m.group(0)[1:-1]


def json_strings(v):
    if isinstance(v, str):
        yield v
    elif isinstance(v, dict):
        for x in v.values():
            yield from json_strings(x)
    elif isinstance(v, list):
        for x in v:
            yield from json_strings(x)


def collect():
    """{글자: {파일 이름, …}}"""
    found = defaultdict(set)

    def add(text, where):
        for ch in text:
            found[ch].add(where)

    for p in sorted((ROOT / 'data/story').glob('*.json')):
        for s in json_strings(json.loads(p.read_text(encoding='utf-8'))):
            add(s, p.relative_to(ROOT).as_posix())
    for p in sorted((ROOT / 'js').glob('*.js')):
        for s in js_strings(p.read_text(encoding='utf-8')):
            add(s, p.relative_to(ROOT).as_posix())
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    html = re.sub(r'<!--.*?-->', '', html, flags=re.S)
    add(re.sub(r'<[^>]+>', '', html), 'index.html')
    css = (ROOT / 'style.css').read_text(encoding='utf-8')
    for m in re.finditer(r'content:\s*(["\'])(.*?)\1', css):
        add(m.group(2), 'style.css')
    return found


def missing():
    have = font_chars()
    return {ch: where for ch, where in collect().items()
            if ch not in IGNORE and ch not in HANDLED and ord(ch) not in have and unicodedata.category(ch)[0] != 'C'}


def report():
    miss = missing()
    if not miss:
        print('글꼴 검사: 모든 글자가 둥근모꼴에 있습니다.')
        return 0
    print(f'⚠ 글꼴 경고: 둥근모꼴에 없는 글자 {len(miss)}개 (화면에 다른 글꼴로 나오거나 빈 네모로 보입니다)')
    for ch, where in sorted(miss.items(), key=lambda t: (sorted(t[1]), t[0])):
        name = unicodedata.name(ch, '?')
        print(f'  {ch}  U+{ord(ch):04X} {name:<36} {", ".join(sorted(where))}')
    return len(miss)


if __name__ == '__main__':
    n = report()
    sys.exit(1 if n and '--strict' in sys.argv else 0)
