#!/usr/bin/env python3
"""Copies the encoded scores listed in tools/sources.json into sources/<id>/ and renders each to MIDI with LilyPond.

    pip install lilypond                      # LilyPond itself, as a Python package
    git clone https://github.com/MutopiaProject/MutopiaProject /path/to/mutopia
    git -C /path/to/mutopia checkout <commit in tools/sources.json>
    python3 tools/render-sources.py /path/to/mutopia [id ...]

For every source it
  - checks that the score's own header carries the licence written in sources.json (public domain, CC BY or CC BY-SA
    only; anything non-commercial stops the script),
  - copies the LilyPond files unchanged into sources/<id>/ (the licences allow it; this is what the credits point to),
  - in a scratch copy, updates old syntax with convert-ly, drops lyrics and page-layout markup that today's LilyPond
    no longer reads (none of it changes a note), and asks for one MIDI channel per voice so a melody can be told
    apart from the voices under it on the same staff,
  - renders sources/<id>/<id>.mid.
The MIDI files are what tools/midi-to-track.mjs converts and what tools/verify-tracks.mjs checks the tracks against.
"""
import json, os, re, shutil, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ALLOWED = re.compile(r'^(public domain|creative commons attribution( |-)?(sharealike|share-alike)?\s*[0-9.]*( international)?( license)?)$', re.I)
LY = ('.ly', '.ily', '.lyi')


def lilypond_bin(name):
    try:
        import lilypond  # noqa
        return os.path.join(os.path.dirname(str(lilypond.executable())), name)
    except Exception:
        return shutil.which(name) or name


def header_licence(folder):
    pat = re.compile(r'\b(license|mutopiacopyright|copyright)\s*=\s*"([^"]+)"', re.I)
    for root, _, files in os.walk(folder):
        for f in sorted(files):
            if f.endswith(LY):
                for m in pat.finditer(open(os.path.join(root, f), encoding='utf8', errors='replace').read()):
                    if m.group(2).strip():
                        return m.group(2).strip()
    return None


def compat(folder):
    for root, _, files in os.walk(folder):
        for f in files:
            if not f.endswith(LY):
                continue
            p = os.path.join(root, f)
            raw = open(p, 'rb').read()
            try:
                s = raw.decode('utf8')
            except UnicodeDecodeError:
                s = raw.decode('latin1')
            s = re.sub(r'\\on-the-fly\s+#first-page', r'\\if \\on-first-page', s)
            s = re.sub(r'\\on-the-fly\s+#not-first-page', r'\\unless \\on-first-page', s)
            s = re.sub(r'\\on-the-fly\s+#last-page', r'\\if \\on-last-page', s)
            s = re.sub(r'\\on-the-fly\s+#not-last-page', r'\\unless \\on-last-page', s)
            s = re.sub(r'\\on-the-fly\s+#print-page-number-check-first', r'\\if \\should-print-page-number', s)
            s = re.sub(r'\\on-the-fly\s+#\S+', '', s)
            s = s.replace('\\RemoveEmptyStaffContext', '\\Staff \\RemoveEmptyStaves')
            s = re.sub(r'\\lyricsto\s+"?\w+"?\s*\\new\s+Lyrics\s*\{[^}]*\}', '', s)
            s = re.sub(r'\\lyricsto\s+"?\w+"?\s*\\new\s+Lyrics\s*\\\w+', '', s)
            s = re.sub(r"markup-system-spacing\s*#'padding\s*=\s*#\d+", '', s)
            s = s.replace('-|', '-!')  # old staccatissimo
            open(p, 'w', encoding='utf8').write(s)


def render(src, mutopia):
    sid = src['id']
    origin = os.path.join(mutopia, 'ftp', src['path'])
    lic = header_licence(origin)
    if lic != src['licence']:
        sys.exit(f'{sid}: the score says licence "{lic}", sources.json says "{src["licence"]}"')
    if not ALLOWED.match(lic) or re.search(r'noncommercial|non-commercial|\bnc\b', lic, re.I):
        sys.exit(f'{sid}: licence "{lic}" is not public domain, CC BY or CC BY-SA')
    out = os.path.join(ROOT, 'sources', sid)
    shutil.rmtree(out, ignore_errors=True)
    for root, _, files in os.walk(origin):
        for f in files:
            if f.endswith(LY):
                rel = os.path.relpath(os.path.join(root, f), origin)
                os.makedirs(os.path.dirname(os.path.join(out, rel)), exist_ok=True)
                shutil.copy2(os.path.join(root, f), os.path.join(out, rel))
    if src.get('driver'):
        open(os.path.join(out, src['main']), 'w').write('% Pocket Band: renders only the movement the track uses\n' + src['driver'])
    with tempfile.TemporaryDirectory() as tmp:
        work = os.path.join(tmp, sid)
        shutil.copytree(out, work)
        for root, _, files in os.walk(work):
            for f in files:
                if f.endswith(LY):
                    subprocess.run([lilypond_bin('convert-ly'), '-e', '-q', os.path.join(root, f)], capture_output=True)
        compat(work)
        main = os.path.join(work, src['main'])
        s = open(main, encoding='utf8').read()
        add = "\n\\midi { \\context { \\Staff midiChannelMapping = #'voice } }\n"
        m = re.search(r'\\version\s*"[^"]*"', s)
        s = s[:m.end()] + add + s[m.end():] if m else add + s
        open(main, 'w', encoding='utf8').write(s)
        r = subprocess.run([lilypond_bin('lilypond'), '-dno-point-and-click', '-dbackend=null', '--loglevel=ERROR', '-o', os.path.join(tmp, 'out'), main],
                           cwd=work, capture_output=True, text=True)
        # LilyPond names the first score's file out.midi, the next out-1.midi, out-2.midi...: take the first score
        def order(f):
            m = re.match(r'out-(\d+)\.', f)
            return int(m.group(1)) if m else -1
        mids = sorted((f for f in os.listdir(tmp) if f.startswith('out') and f.endswith(('.mid', '.midi'))), key=order)
        if not mids:
            sys.exit(f'{sid}: LilyPond made no MIDI file\n{r.stderr[-2000:]}')
        shutil.copy2(os.path.join(tmp, mids[0]), os.path.join(out, sid + '.mid'))
    print(f'{sid}: {lic}, rendered {sid}.mid')


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    conf = json.load(open(os.path.join(ROOT, 'tools', 'sources.json'), encoding='utf8'))
    want = set(sys.argv[2:])
    for src in conf['sources']:
        if not want or src['id'] in want:
            render(src, sys.argv[1])


if __name__ == '__main__':
    main()
