#!/usr/bin/env python3
"""Copies the encoded scores listed in tools/sources.json into sources/<id>/ and renders each to MIDI.

    pip install lilypond music21              # LilyPond itself, and music21 (reads ABC and MusicXML)
    python3 tools/render-sources.py --mutopia=/path/to/mutopia --openewld=/path --nmd=/path --boostermusic=/path \
        --latex4musicians=/path [id ...]

Each source names its origin (tools/sources.json "origins": the repository and commit, or the package and version,
to fetch); the script needs the checkout of every origin whose sources it renders (the music21 corpus comes with
the music21 package). Where each one comes from:
    mutopia          git clone https://github.com/MutopiaProject/MutopiaProject (LilyPond scores)
    openewld         git clone https://github.com/00sapo/OpenEWLD (MusicXML leadsheets of public-domain songs)
    nmd              git clone https://github.com/jukedeck/nottingham-dataset (the Nottingham Music Database, ABC)
    boostermusic     git clone https://github.com/pianobooster/BoosterMusic (PianoBooster's tunes, ABC)
    latex4musicians  the latex4musicians folder of TeX Live's documentation (Ubuntu package texlive-music), ABC
    music21          the corpus inside the music21 package (ABC)

For every source it
  - checks the licence: a LilyPond score's own header must carry the licence written in sources.json; for the other
    origins the licence file named in "origins" must say it. Public domain, CC BY, CC BY-SA, GPL and GFDL only;
    anything non-commercial stops the script,
  - copies the score unchanged into sources/<id>/ (all of a LilyPond score's files; for an ABC file holding many
    tunes, just the tune's own lines), with SOURCE.md saying where it comes from and under which licence,
  - LilyPond: in a scratch copy, updates old syntax with convert-ly, drops lyrics and page-layout markup that
    today's LilyPond no longer reads (none of it changes a note), and asks for one MIDI channel per voice so a
    melody can be told apart from the voices under it on the same staff, then renders the MIDI file;
    ABC: abc2midi (the abcMIDI package: apt install abcmidi, or ABC2MIDI=path) plays the tune with its repeats and
    parts, and its guitar chords as a bass and chord accompaniment;
    MusicXML: music21 reads the leadsheet, plays its repeats out and writes the melody as MIDI track 1, and its
    chord symbols as two more tracks, the chords (track 2) and their roots (track 3, the bass line Full plays).
    Lyrics are never read.
  - renders sources/<id>/<id>.mid.
The MIDI files are what tools/midi-to-track.mjs converts and what tools/verify-tracks.mjs checks the tracks against.
"""
import json, os, re, shutil, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ALLOWED = re.compile(r'^(public domain|creative commons attribution( |-)?(sharealike|share-alike)?\s*[0-9.]*( international)?( license)?|gnu (general public license|free documentation license)( version)? [0-9.]+)$', re.I)
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
            s = re.sub(r'(?<!-)-\|', '-!', s)  # old staccatissimo (a tenuto "--" before a bar check stays)
            open(p, 'w', encoding='utf8').write(s)


def render(src, mutopia):
    sid = src['id']
    origin = os.path.join(mutopia, 'ftp', src['path'])
    lic = header_licence(origin)
    if lic != src['licence']:
        sys.exit(f'{sid}: the score says licence "{lic}", sources.json says "{src["licence"]}"')
    licence_ok(lic, sid)
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


def licence_ok(lic, sid):
    if not ALLOWED.match(lic) or re.search(r'noncommercial|non-commercial|\bnc\b', lic, re.I):
        sys.exit(f'{sid}: licence "{lic}" is not public domain, CC BY, CC BY-SA, GPL or GFDL')


def read_text(p):
    import gzip
    raw = gzip.open(p).read() if p.endswith('.gz') else open(p, 'rb').read()
    return re.sub(r'\s+', ' ', raw.decode('utf8', 'replace'))


def abc_tune(text, number):
    """The lines of tune X:number in an ABC file (from its X: line to the next tune)"""
    out, on = [], False
    for line in text.splitlines():
        m = re.match(r'X:\s*(\d+)', line)
        if m:
            on = int(m.group(1)) == number
        if on:
            out.append(line)
    if not out:
        sys.exit(f'no tune X:{number}')
    while out and not out[-1].strip():
        out.pop()
    return '\n'.join(out) + '\n'


def m21_render(src, path, kind, out_mid):
    """Reads an ABC tune or a MusicXML leadsheet with music21 and writes the MIDI file: the melody as track 1 and,
    if the score has chord symbols, the chords as track 2 and their roots as track 3. Lyrics are left out."""
    from music21 import converter, stream, chord, note
    sc = converter.parse(path, format='abc' if kind == 'abc' else 'musicxml', forceSource=True)
    mel = sc.parts[0]
    if kind == 'abc':
        return abc_render(src, path, out_mid)
    # "endings" renumbers a score's first/second-time brackets where they are misnumbered (Jingle Bells' second ending
    # is numbered 3), so music21 can play the repeats out
    for rb in mel.spannerBundle.getByClass('RepeatBracket'):
        if str(rb.number) in src.get('endings', {}):
            rb.number = src['endings'][str(rb.number)]
    mel = mel.expandRepeats()
    flat = mel.flatten()
    end = flat.highestTime
    syms = sorted(((flat.elementOffset(cs), cs) for cs in flat.getElementsByClass('ChordSymbol')), key=lambda x: x[0])
    res = stream.Score()
    res.insert(0, mel)
    if syms:
        hp, bp = stream.Part(), stream.Part()
        for i, (o, cs) in enumerate(syms):
            d = (syms[i + 1][0] if i + 1 < len(syms) else end) - o
            if d <= 0 or not cs.pitches:
                continue
            c = chord.Chord(sorted({55 + (x.pitchClass - 7) % 12 for x in cs.pitches}))  # G3 to F#4
            c.quarterLength = d
            hp.insert(o, c)
            b = note.Note(40 + (cs.root().pitchClass - 4) % 12)  # E2 to D#3
            b.quarterLength = d
            bp.insert(o, b)
        res.insert(0, hp)
        res.insert(0, bp)
    for cs in list(mel.recurse().getElementsByClass('ChordSymbol')):
        cs.activeSite.remove(cs)
    for n in mel.recurse().notes:
        n.lyrics = []
    # the repeats are played out already: flat parts, so music21 doesn't try again
    out = stream.Score()
    for p in res.parts:
        out.insert(0, p.flatten())
    out.write('midi', fp=out_mid)


def abc_render(src, path, out_mid):
    """An ABC tune through abc2midi (the abcMIDI package, the reference ABC player): repeats and parts played out as
    ABC defines them, guitar chords ("G", "D7") played as a bass and chord accompaniment on channels of their own.
    A tune whose play order is in its "Y:" field (the cleaned Nottingham files) gets it as the "P:" field abc2midi
    reads; nothing else changes."""
    text = open(path, encoding='utf8').read()
    if src.get('order'):
        text = re.sub(r'^Y:.*$', 'P:' + src['order'], text, count=1, flags=re.M)
    tmp = path + '.play.abc'
    open(tmp, 'w', encoding='utf8').write(text)
    exe = os.environ.get('ABC2MIDI') or shutil.which('abc2midi') or 'abc2midi'
    r = subprocess.run([exe, tmp, '-o', out_mid, '-silent'], capture_output=True, text=True)
    if r.returncode or not os.path.exists(out_mid):
        sys.exit(f'{src["id"]}: abc2midi failed\n{r.stdout[-1500:]}{r.stderr[-1500:]}')


def renderer(kind):
    if kind == 'abc':
        exe = os.environ.get('ABC2MIDI') or shutil.which('abc2midi') or 'abc2midi'
        v = subprocess.run([exe, '-ver'], capture_output=True, text=True).stdout.strip()
        return 'abc2midi ' + v.split()[0] if v else 'abc2midi'
    return 'music21 ' + __import__('music21').__version__


def render_other(src, roots, origins):
    sid, org = src['id'], origins[src['origin']]
    root = roots.get(src['origin'])
    if src['origin'] == 'music21':
        import music21
        root = os.path.join(os.path.dirname(music21.__file__), 'corpus')
    if not root:
        sys.exit(f'{sid}: give the {src["origin"]} checkout (--{src["origin"]}=path)')
    lic_file = os.path.join(root, org['licenceFile'])
    if org['licenceText'] not in read_text(lic_file):
        sys.exit(f'{sid}: {org["licenceFile"]} does not say "{org["licenceText"]}"')
    licence_ok(src['licence'], sid)
    origin = os.path.join(root, src['file'])
    out = os.path.join(ROOT, 'sources', sid)
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out)
    name = os.path.basename(src['file'])
    kind = 'abc' if name.endswith('.abc') else 'musicxml'
    if kind == 'abc' and src.get('number') is not None:
        text = open(origin, encoding='utf8', errors='replace').read()
        name = re.sub(r'\.abc$', '', name) + f'-X{src["number"]}.abc'
        open(os.path.join(out, name), 'w', encoding='utf8').write(abc_tune(text, src['number']))
    else:
        shutil.copy2(origin, os.path.join(out, name))
    where = org.get('repo', '') + (('/blob/' + org['commit'] + '/' + src['file']) if org.get('commit') else '')
    open(os.path.join(out, 'SOURCE.md'), 'w', encoding='utf8').write(
        f'# {src["title"]}\n\n`{name}` is copied unchanged from {org["name"]}' +
        (f' ({where})' if org.get('commit') else f' ({org.get("package", "")}, file `{src["file"]}`)') +
        (f', tune X:{src["number"]} of `{os.path.basename(src["file"])}`' if src.get('number') is not None else '') + '.\n\n' +
        f'Licence: {src["licence"]}' + (f' ({src["licenceNote"]})' if src.get('licenceNote') else '') + '.' +
        (f' The licence text is in [sources/LICENSES]({os.path.relpath(os.path.join(ROOT, "sources", "LICENSES"), out)}).' if re.search('GNU', src['licence']) else '') + '\n\n' +
        f'`{sid}.mid` is rendered from it by `tools/render-sources.py` ({renderer(kind)}).\n')
    with tempfile.TemporaryDirectory() as tmp:
        p = os.path.join(tmp, name)
        shutil.copy2(os.path.join(out, name), p)
        m21_render(src, p, kind, os.path.join(out, sid + '.mid'))
    print(f'{sid}: {src["licence"]}, rendered {sid}.mid')


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    roots = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
    if not roots and args and os.path.isdir(args[0]):  # the old form: the Mutopia checkout first
        roots['mutopia'] = args.pop(0)
    if not roots:
        sys.exit(__doc__)
    conf = json.load(open(os.path.join(ROOT, 'tools', 'sources.json'), encoding='utf8'))
    want = set(args)
    for src in conf['sources']:
        if want and src['id'] not in want:
            continue
        if src.get('origin', 'mutopia') == 'mutopia':
            if 'mutopia' not in roots:
                sys.exit(f'{src["id"]}: give the Mutopia checkout (--mutopia=path)')
            render(src, roots['mutopia'])
        else:
            render_other(src, roots, conf['origins'])


if __name__ == '__main__':
    main()
