# Songs: the track library

Every track the Songs button offers, where it comes from and how it was checked. Round E replaced the songs that had
been typed in from memory with tracks converted from encoded scores, and hid the rest. Round F added more songs from
further free collections, a Celebrate group (Happy Birthday first), and a version of every song for every instrument.

**Status.** `verified`: converted from an encoded score (LilyPond from the [Mutopia Project](https://www.mutopiaproject.org),
ABC or MusicXML from the collections listed below, rendered to MIDI) by `tools/midi-to-track.mjs`, then checked by
`tools/verify-tracks.mjs`: every note against the source MIDI (pitch exact, onset within a 16th of a beat), and an offline
render of the track whose pitches are detected again and compared. `generated`: built from a definition in
`tools/make-tracks.mjs` (a song's drum beat or tabla theka, a raag's aroha and avaroha, the alankar exercise, a taal's
theka, a drum groove, or a tune written for Pocket Band), so the definition is the track. `unverified`: typed in from
memory; kept in `tracks/unverified.json` but hidden from the song picker.

**Licences.** Only public domain, CC BY, CC BY-SA, GNU GPL and GNU FDL scores are used; `tools/render-sources.py` reads each
score's own licence line (or its collection's licence file) and stops on anything else. Every non-public-domain score is
credited here and in the app (Settings → Credits). Track data converted from a CC BY-SA, GPL or GFDL score is shared under
that same licence; the licence texts are in `sources/LICENSES/`. Only melodies are used, never lyrics.

**Every song on every instrument.** Each verified song comes as: the melody, offered on every melodic instrument (the app
moves it by whole octaves into the instrument's range and plays any note out of reach for you); a chord song for the
guitars (the key's own chords that best cover the score's harmony, strummed in a pattern for its time signature); a bass
line (the score's own lowest part, or where it has none the roots of those chords); a drum beat and a tabla theka in its
time signature and tempo (Keherwa for two and four beats a bar, Dadra for three-four and compound time), from its first
full bar, with a fill every fourth bar. Chord songs, bass lines and rhythms carry the tune and chords as backing.

**Rebuilding.** `python3 tools/render-sources.py --mutopia=<checkout> --openewld=<checkout> --nmd=<checkout>
--boostermusic=<checkout> --latex4musicians=<folder>` copies the scores into `sources/` and renders their MIDI;
`npm run tracks` converts them and writes `tracks/*.json` and this file; `node tools/verify-tracks.mjs` checks every
verified track (the build fails if a track and its source disagree).

**Easy and Full.** Every verified melody carries the score's own bass line (`low`, where it has one) and the chords its
harmony spells (`chords`). Easy is the melody alone; Full adds the bass line. Sections (`sections`, 4 to 8 bars) end where
the tune breathes.

**Format.** Each track: `id`, `type`, `title`, `by`, `src` (the licence), `status`, `tempo` (quarter notes a minute), `time`,
`key`, `tonic` (pitch class), `mode`, `level` (1-3), `tags`, `bars`, `sections`, `inst` (the melodic instruments that offer it),
and by type: `notes` `[startBeat, beats, midi, velocity]`, `low` (bass line, same form), `chords` (one string a bar),
`strum`, `hits`, `tune`; a song's rhythm adds `song`, a drum beat `groove`, a theka `taal`, `vibhag`, `tali`, `matra`
(beats a matra), `cycle` (beats a cycle) and `sam` (the beat of the first sam). Verified tracks add `credit` (composer,
death year, licence, collection, source, URL, conversion date) and `from` (the source MIDI file, its parts and the beat
the track starts at, for the verifier).

## Collections

Converted on 2026-10-15.

- **Mutopia Project**: LilyPond, https://github.com/MutopiaProject/MutopiaProject, commit 2144afd6f5; each file states its own licence.
- **OpenEWLD** (OpenEWLD, the public-domain leadsheets of the Wikifonia archive): https://github.com/00sapo/OpenEWLD, commit ec03cbd809; licence from `README.md`.
- **Nottingham Music Database** (the Nottingham Music Database (as kept by Jukedeck)): https://github.com/jukedeck/nottingham-dataset, commit 0992bb6cd8; licence from `LICENSE.md`.
- **PianoBooster** (PianoBooster’s Booster Music): https://github.com/pianobooster/BoosterMusic, commit 7e9b126ceb; licence from `license.txt`.
- **LaTeX for Musicians** (LaTeX for Musicians by Guido Gonzato (in TeX Live)): https://ctan.org/pkg/latex4musicians, TeX Live 2023, Ubuntu 24.04 package texlive-music 2023.20240207-1, folder doc/latex/latex4musicians; licence from `latex4musicians.tex.gz`.
- **music21 corpus** (the music21 corpus): https://github.com/cuthbertLab/music21, music21 10.5.0 (PyPI), corpus folder; licence from `license.txt`.

## Verified tracks and their sources

| Track | Composer | Died | Excerpt | Licence | Source | Tempo |
|---|---|---|---|---|---|---|
| Happy Birthday | Mildred J. Hill | 1916 | The tune, whole | GFDL 1.3 | [LaTeX for Musicians: happyb.abc X:1](https://ctan.org/pkg/latex4musicians) | set (the score has no tempo marking) |
| Silent Night (Stille Nacht) | Franz Xaver Gruber | 1863 | Soprano, whole hymn | Public domain | [Mutopia 1295](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1295) | set (the score has no tempo marking) |
| Joy to the World | Lowell Mason, after Handel | 1872 | Soprano, whole hymn | Public domain | [Mutopia 1223](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1223) | set (the score has no tempo marking) |
| Auld Lang Syne | Felix Horetzky (arranger; tune traditional) | 1870 | Top voice, bars 1-16 | Public domain | [Mutopia 1121](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1121) | from the score |
| Jingle Bells | James Lord Pierpont | 1893 | Verse and chorus (the second time through, which ends on the final ending) | Public domain | [OpenEWLD: Jingle_Bells.mxl](https://github.com/00sapo/OpenEWLD/blob/ec03cbd809ca5296ee708591b970d0423dcbe31c/dataset/James_Pierpont/Jingle_Bells/Jingle_Bells.mxl) | set (the score has no tempo marking) |
| Deck the Halls (Nos Galan) | Traditional | – | Parts A A B A (the Nottingham file plays each A part twice: the track is the second A, then B and A) | GPL 3.0 | [Nottingham Music Database: xmas.abc X:8](https://github.com/jukedeck/nottingham-dataset/blob/0992bb6cd864f6d4b90d6663e08c0ef53ffaa08f/ABC_cleaned/xmas.abc) | set (the score has no tempo marking) |
| We Wish You a Merry Christmas | Traditional | – | Verse and chorus | Public domain | [OpenEWLD: We_Wish_You_a_Merry_Christmas.mxl](https://github.com/00sapo/OpenEWLD/blob/ec03cbd809ca5296ee708591b970d0423dcbe31c/dataset/[Traditional]/We_Wish_You_a_Merry_Christmas/We_Wish_You_a_Merry_Christmas.mxl) | set (the score has no tempo marking) |
| Wedding March | Felix Mendelssohn | 1847 | The main theme, bars 6-13 (right hand; the pedal part as bass) | CC BY-SA 4.0 | [Mutopia 2198](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2198) | from the score |
| Twinkle Twinkle Little Star | Wolfgang Amadeus Mozart (theme: traditional) | 1791 | Theme ("Allegro (Thema)", No. 9 of the edition), guitar 1 | Public domain | [Mutopia 2236](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2236) | from the score |
| Greensleeves | Traditional | – | Soprano, bars 1-16 | Public domain | [Mutopia 1247](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1247) | set (the score has no tempo marking) |
| Amazing Grace | Anonymous (American hymn tune) | – | Soprano, whole hymn | Public domain | [Mutopia 1283](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1283) | set (the score has no tempo marking) |
| Ode to Joy | Ludwig van Beethoven | 1827 | Soprano, bars 1-16 | Public domain | [Mutopia 528](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=528) | from the score |
| Für Elise (opening) | Ludwig van Beethoven | 1827 | Right hand, bars 1-8 | Public domain | [Mutopia 931](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=931) | from the score |
| Moonlight Sonata (opening) | Ludwig van Beethoven | 1827 | The melody voice of the right hand, bars 6-13 with its pickup in bar 5 | CC BY-SA 2.5 | [Mutopia 276](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=276) | from the score (\tempo 4 = 54, which LilyPond left out of the MIDI file) |
| Canon in D | Johann Pachelbel | 1706 | Violin 1, bars 3-10 (after the two-bar ground) | CC BY 4.0 | [Mutopia 2047](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2047) | from the score |
| Eine kleine Nachtmusik (theme) | Wolfgang Amadeus Mozart | 1791 | First movement, violin 1, bars 1-8 | Public domain | [Mutopia 2230](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2230) | from the score |
| Turkish March (Rondo alla turca) | Wolfgang Amadeus Mozart | 1791 | Right hand, bars 1-8 (grace notes left out) | Public domain | [Mutopia 108](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=108) | set (the score has no tempo marking) |
| Minuet in G | Christian Petzold | 1733 | Right hand, bars 1-16 | Public domain | [Mutopia 75](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=75) | from the score |
| Minuet in G minor | Christian Petzold | 1733 | Right hand, bars 1-16 | Public domain | [Mutopia 76](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=76) | from the score |
| Musette in D | Anonymous (Anna Magdalena Bach notebook) | – | Right hand, bars 1-12 | Public domain | [Mutopia 79](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=79) | from the score |
| Air on the G String | Johann Sebastian Bach | 1750 | Violin 1, bars 1-6 | CC BY-SA 3.0 | [Mutopia 242](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=242) | from the score |
| Spring (The Four Seasons) | Antonio Vivaldi | 1741 | Solo violin, first movement, bars 1-6 | CC BY-SA 3.0 | [Mutopia 301](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=301) | from the score |
| Brahms' Lullaby (Wiegenlied) | Johannes Brahms | 1897 | Voice, first verse | Public domain | [Mutopia 1037](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1037) | set (the score has no tempo marking) |
| In the Hall of the Mountain King | Edvard Grieg | 1907 | Right hand, the theme's first eight bars | Public domain | [Mutopia 1888](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1888) | from the score |
| Symphony No. 5 (opening) | Ludwig van Beethoven | 1827 | First movement, the strings' top line, bars 1-20 | Public domain | [Mutopia 941](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=941) | from the score |
| O Come, All Ye Faithful (Adeste Fideles) | John Francis Wade | 1786 | Soprano, whole hymn | Public domain | [Mutopia 1220](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1220) | set (the score has no tempo marking) |
| Good King Wenceslas | Traditional | – | Melody, whole carol | Public domain | [Mutopia 905](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=905) | from the score |
| The First Noel | Traditional | – | Soprano, whole carol | Public domain | [Mutopia 1243](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1243) | set (the score has no tempo marking) |
| The Holly and the Ivy | Traditional | – | Melody, whole carol | Public domain | [Mutopia 644](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=644) | from the score |
| Home! Sweet Home! | Henry Rowley Bishop | 1855 | Voice, first verse | Public domain | [Mutopia 435](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=435) | from the score |
| Gymnopédie No. 1 | Erik Satie | 1925 | Right hand, bars 5-8 (after the four-bar introduction) | Public domain | [Mutopia 37](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=37) | set (the score has no tempo marking) |
| Sonata facile (opening) | Wolfgang Amadeus Mozart | 1791 | Right hand, bars 1-4 | CC BY-SA 3.0 | [Mutopia 998](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=998) | from the score |
| Piano Sonata in A (theme) | Wolfgang Amadeus Mozart | 1791 | Theme, right hand, bars 1-8 | Public domain | [Mutopia 614](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=614) | from the score |
| The Happy Farmer | Robert Schumann | 1856 | The tune (left hand), bars 1-8 | CC BY-SA 2.5 | [Mutopia 659](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=659) | from the score |
| Soldiers' March | Robert Schumann | 1856 | Right hand, bars 1-8 | CC BY-SA 2.5 | [Mutopia 650](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=650) | from the score |
| March of the Wooden Soldiers | Pyotr Ilyich Tchaikovsky | 1893 | Right hand, bars 1-16 | Public domain | [Mutopia 1806](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1806) | from the score |
| Waltz in A flat | Johannes Brahms | 1897 | Right hand, bars 1-16 | Public domain | [Mutopia 794](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=794) | from the score |
| Frère Jacques | Traditional | – | Whole tune (both hands: the left hand plays the low G of the last line) | CC BY 4.0 | [PianoBooster: 04-FrereJacques.abc X:1](https://github.com/pianobooster/BoosterMusic/blob/7e9b126cebce36db94976294caea48c82195e86e/BoosterMusic/04-FrereJacques.abc) | set (the score has no tempo marking) |
| Scarborough Fair | Traditional | – | Whole tune | CC BY 4.0 | [PianoBooster: 05-ScarboroughFair.abc X:1](https://github.com/pianobooster/BoosterMusic/blob/7e9b126cebce36db94976294caea48c82195e86e/BoosterMusic/05-ScarboroughFair.abc) | set (the score’s 30 a minute is PianoBooster’s practice speed) |
| Danny Boy (Londonderry Air) | Traditional | – | Whole tune | Public domain | [OpenEWLD: Danny_Boy.mxl](https://github.com/00sapo/OpenEWLD/blob/ec03cbd809ca5296ee708591b970d0423dcbe31c/dataset/Frederic_Weatherly/Danny_Boy/Danny_Boy.mxl) | set (the score has no tempo marking) |
| When the Saints Go Marching In | Traditional | – | Whole tune | GPL 3.0 | [Nottingham Music Database: reelsr-t.abc X:29](https://github.com/jukedeck/nottingham-dataset/blob/0992bb6cd864f6d4b90d6663e08c0ef53ffaa08f/ABC_cleaned/reelsr-t.abc) | set (the score has no tempo marking) |
| Oh! Susanna | Stephen Foster | 1864 | Verse and chorus | Public domain | [OpenEWLD: Oh!_Susanna.mxl](https://github.com/00sapo/OpenEWLD/blob/ec03cbd809ca5296ee708591b970d0423dcbe31c/dataset/Stephen_Foster/Oh!_Susanna/Oh!_Susanna.mxl) | set (the score has no tempo marking) |
| Yankee Doodle | Traditional | – | Whole tune | Public domain | [music21 corpus: americanfifeopus.abc X:30](https://github.com/cuthbertLab/music21/tree/master/music21/corpus/miscFolk) | set (the score has no tempo marking) |
| Home on the Range | Daniel E. Kelley | 1905 | Verse and chorus | Public domain | [OpenEWLD: Home_on_the_Range.mxl](https://github.com/00sapo/OpenEWLD/blob/ec03cbd809ca5296ee708591b970d0423dcbe31c/dataset/Brewster_M._Higley-Daniel_E._Kelley/Home_on_the_Range/Home_on_the_Range.mxl) | set (the score has no tempo marking) |
| Shenandoah | Traditional | – | Whole tune | Public domain | [OpenEWLD: Shenandoah.mxl](https://github.com/00sapo/OpenEWLD/blob/ec03cbd809ca5296ee708591b970d0423dcbe31c/dataset/[Traditional]/Shenandoah/Shenandoah.mxl) | set (the score has no tempo marking) |
| Clair de Lune | Claude Debussy | 1918 | Right hand, bars 1-8 | Public domain | [Mutopia 1778](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1778) | set (the score has no tempo marking) |

## Melodies (every melodic instrument)

| Track | Status | By | Key | Time | Tempo | Length | Level | Instruments | First 16 notes |
|---|---|---|---|---|---|---|---|---|---|
| Happy Birthday | verified | Mildred J. Hill and Patty Hill ("Good Morning to All", 1893) | F Major | 3/4 | 100 | 0:16 | ★ | All | C4 C4 D4 C4 F4 E4 C4 C4 D4 C4 G4 F4 C4 C4 C5 A4 |
| Silent Night (Stille Nacht) | verified | Franz Xaver Gruber (1818) | B♭ Major | 6/8 | 90 | 0:24 | ★ | All | F4 G4 F4 D4 F4 G4 F4 D4 C5 C5 A4 B♭4 B♭4 F4 G4 G4 |
| Joy to the World | verified | Tune "Antioch", arranged by Lowell Mason (1839) from G. F. Handel | D Major | 2/4 | 100 | 0:23 | ★ | All | D5 C♯5 B4 A4 G4 F♯4 E4 D4 A4 B4 B4 C♯5 C♯5 D5 D5 D5 |
| Auld Lang Syne | verified | Traditional (Scottish), guitar setting by Felix Horetzky | D Major | 2/4 | 72 | 0:28 | ★ | All | A4 D5 D5 D5 F♯5 E5 D5 E5 F♯5 D5 D5 F♯5 A5 B5 D6 A5 |
| Jingle Bells | verified | James Lord Pierpont (1857) | G Major | 4/4 | 120 | 1:04 | ★ | All | D4 B4 A4 G4 D4 D4 D4 D4 B4 A4 G4 E4 E4 E4 C5 B4 |
| Deck the Halls (Nos Galan) | verified | Traditional Welsh carol tune "Nos Galan" | F Major | 4/4 | 112 | 0:34 | ★ | All | C5 B♭4 A4 G4 F4 G4 A4 F4 G4 A4 B♭4 G4 A4 G4 F4 E4 |
| We Wish You a Merry Christmas | verified | Traditional English carol | C Major | 3/4 | 132 | 0:23 | ★ | All | G4 C5 C5 D5 C5 B4 A4 A4 A4 D5 D5 E5 D5 C5 B4 G4 |
| Wedding March | verified | Felix Mendelssohn (A Midsummer Night’s Dream, Op. 61, 1842), organ transcription by Théodore Dubois | C Major | 4/4 | 130 | 0:15 | ★★ | All | B5 F♯5 A5 G5 F5 D5 C5 D5 G4 D5 E5 C5 E5 G5 C6 B5 |
| Twinkle Twinkle Little Star | verified | Traditional French air (1761), as set by W. A. Mozart (K. 265) | C Major | 2/4 | 108 | 0:27 | ★ | All | C4 C4 G4 G4 A4 A4 G4 G4 F4 F4 E4 E4 D4 D4 E4 C4 |
| Greensleeves | verified | Traditional (English, 16th century) | E Natural minor | 6/8 | 90 | 0:34 | ★★ | All | E4 G4 A4 B4 C5 B4 A4 F♯4 D4 E4 F♯4 G4 E4 E4 D♯4 E4 |
| Amazing Grace | verified | Tune "New Britain" (Virginia Harmony, 1831) | G Major | 3/4 | 84 | 0:34 | ★ | All | D4 G4 B4 G4 B4 A4 G4 E4 D4 D4 G4 B4 G4 B4 A4 D5 |
| Ode to Joy | verified | Ludwig van Beethoven (Symphony No. 9, 1824), hymn setting | G Major | 4/4 | 100 | 0:38 | ★ | All | B4 B4 C5 D5 D5 C5 A4 B4 A4 G4 G4 A4 B4 B4 A4 A4 |
| Für Elise (opening) | verified | Ludwig van Beethoven (WoO 59, 1810) | A Natural minor | 3/8 | 72 | 0:11 | ★★★ | All | E5 D♯5 E5 D♯5 E5 B4 D5 C5 A4 C4 E4 A4 B4 E4 G♯4 B4 |
| Moonlight Sonata (opening) | verified | Ludwig van Beethoven (Op. 27 No. 2, 1801) | E Major | 2/2 | 54 | 0:40 | ★★ | All | G♯4 G♯4 G♯4 G♯4 G♯4 G♯4 A4 G♯4 F♯4 B4 E4 G4 G4 G4 G4 G4 |
| Canon in D | verified | Johann Pachelbel (c. 1690) | D Major | 4/4 | 55 | 0:35 | ★ | All | F♯5 E5 D5 C♯5 B4 A4 B4 C♯5 D5 C♯5 B4 A4 G4 F♯4 G4 E4 |
| Eine kleine Nachtmusik (theme) | verified | Wolfgang Amadeus Mozart (K. 525, 1787) | G Major | 4/4 | 132 | 0:15 | ★★ | All | G5 D5 G5 D5 G5 D5 G5 B5 D6 C6 A5 C6 A5 C6 A5 F♯5 |
| Turkish March (Rondo alla turca) | verified | Wolfgang Amadeus Mozart (K. 331, 1783) | A Natural minor | 2/4 | 120 | 0:09 | ★★★ | All | B4 A4 G♯4 A4 C5 D5 C5 B4 C5 E5 F5 E5 D♯5 E5 B5 A5 |
| Minuet in G | verified | Christian Petzold (c. 1725, BWV Anh. 114, long credited to J. S. Bach) | G Major | 3/4 | 140 | 0:21 | ★★ | All | D5 G4 A4 B4 C5 D5 G4 G4 E5 C5 D5 E5 F♯5 G5 G4 G4 |
| Minuet in G minor | verified | Christian Petzold (c. 1725, BWV Anh. 115) | G Natural minor | 3/4 | 140 | 0:21 | ★★ | All | B♭5 A5 G5 A5 D5 D5 G5 G4 A4 B♭4 C5 D5 E♭5 F5 E♭5 D5 |
| Musette in D | verified | Anna Magdalena Bach notebook (BWV Anh. 126, c. 1725) | D Major | 2/4 | 120 | 0:12 | ★★ | All | A5 G5 F♯5 E5 D5 A5 G5 F♯5 E5 D5 F♯4 G4 A4 G4 F♯4 E4 |
| Air on the G String | verified | Johann Sebastian Bach (Suite No. 3, BWV 1068) | A Major | 4/4 | 30 | 0:48 | ★★★ | All | F♯5 B5 G5 F♯5 E5 D5 C♯5 D5 C♯5 B4 A4 A5 F♯5 C5 B4 E5 |
| Spring (The Four Seasons) | verified | Antonio Vivaldi (Op. 8 No. 1, 1725) | E Major | 4/4 | 115 | 0:15 | ★★ | All | E5 G♯5 G♯5 G♯5 F♯5 E5 B5 B5 A5 G♯5 G♯5 G♯5 F♯5 E5 B5 B5 |
| Brahms' Lullaby (Wiegenlied) | verified | Johannes Brahms (Op. 49 No. 4, 1868) | E♭ Major | 3/4 | 72 | 0:43 | ★ | All | G4 G4 B♭4 G4 G4 B♭4 G4 B♭4 E♭5 D5 C5 C5 B♭4 F4 G4 A♭4 |
| In the Hall of the Mountain King | verified | Edvard Grieg (Peer Gynt, Op. 46 No. 4, 1875), Grieg's piano version | B Natural minor | 4/4 | 138 | 0:14 | ★★ | All | B1 C♯2 D2 E2 F♯2 D2 F♯2 F2 C♯2 F2 E2 C2 E2 B1 C♯2 D2 |
| Symphony No. 5 (opening) | verified | Ludwig van Beethoven (Op. 67, 1808) | C Natural minor | 2/4 | 192 | 0:13 | ★★ | All | G4 G4 G4 E♭4 F4 F4 F4 D4 G4 G4 G4 E♭4 A♭4 A♭4 A♭4 G4 |
| O Come, All Ye Faithful (Adeste Fideles) | verified | John Francis Wade (c. 1743) | G Major | 4/4 | 100 | 0:50 | ★ | All | G4 G4 D4 G4 A4 D4 B4 A4 B4 C5 B4 A4 G4 G4 C♯4 F♯4 |
| Good King Wenceslas | verified | Traditional (Piae Cantiones, 1582) | A Major | 4/4 | 120 | 0:34 | ★ | All | A4 A4 A4 B4 A4 A4 E4 F♯4 E4 F♯4 G♯4 A4 A4 A4 A4 A4 |
| The First Noel | verified | Traditional English carol (published 1833) | D Major | 3/4 | 100 | 0:45 | ★ | All | F♯4 E4 D4 E4 F♯4 G4 A4 B4 C♯5 D5 C♯5 B4 A4 B4 C♯5 D5 |
| The Holly and the Ivy | verified | Traditional English carol | F Major | 3/4 | 120 | 0:26 | ★ | All | F4 F4 F4 F4 D5 C5 A4 F4 F4 F4 F4 D5 C5 C5 B♭4 A4 |
| Home! Sweet Home! | verified | Henry Rowley Bishop (1823) | F Major | 4/4 | 90 | 0:45 | ★ | All | F4 G4 A4 B♭4 B♭4 C5 C5 A4 A4 C5 B♭4 A4 B♭4 G4 A4 F4 |
| Gymnopédie No. 1 | verified | Erik Satie (1888) | D Major | 3/4 | 72 | 0:10 | ★ | All | F♯5 A5 G5 F♯5 C♯5 B4 C♯5 D5 A4 F♯4 |
| Sonata facile (opening) | verified | Wolfgang Amadeus Mozart (K. 545, 1788) | C Major | 4/4 | 132 | 0:07 | ★★ | All | C5 E5 G5 B4 C5 D5 C5 A5 G5 C6 G5 F5 E5 F5 E5 |
| Piano Sonata in A (theme) | verified | Wolfgang Amadeus Mozart (K. 331, 1783) | A Major | 6/8 | 56 | 0:26 | ★★ | All | C♯5 D5 C♯5 E5 E5 B4 C♯5 B4 D5 D5 A4 A4 B4 B4 C♯5 E5 |
| The Happy Farmer | verified | Robert Schumann (Album for the Young, Op. 68 No. 10, 1848) | F Major | 4/4 | 100 | 0:22 | ★ | All | C3 F3 A3 C4 F3 B♭3 D4 F4 D4 C4 A3 B♭3 G3 C3 B♭3 A3 |
| Soldiers' March | verified | Robert Schumann (Album for the Young, Op. 68 No. 2, 1848) | G Major | 2/4 | 120 | 0:08 | ★ | All | B4 C5 D5 E5 D5 C5 B4 A4 G4 B4 C5 D5 E5 D5 G5 F♯5 |
| March of the Wooden Soldiers | verified | Pyotr Ilyich Tchaikovsky (Album for the Young, Op. 39 No. 5, 1878) | D Major | 2/4 | 140 | 0:14 | ★★ | All | D5 D5 B4 A♯4 B4 C♯5 D5 D5 B4 A♯4 B4 C♯5 D5 E5 F♯5 F♯5 |
| Waltz in A flat | verified | Johannes Brahms (Op. 39 No. 15, 1865) | A♭ Major | 3/4 | 116 | 0:25 | ★★ | All | C5 A♭4 A♭4 C5 C5 A♭4 A♭4 C5 D♭5 E♭5 D♭5 C5 B♭4 C5 A♭4 A♭4 |
| Frère Jacques | verified | Traditional French round | C Major | 4/4 | 108 | 0:18 | ★ | All | C4 D4 E4 C4 C4 D4 E4 C4 E4 F4 G4 E4 F4 G4 G4 A4 |
| Scarborough Fair | verified | Traditional English ballad | D Dorian | 3/4 | 96 | 0:36 | ★ | All | D4 D4 A4 A4 E4 F4 E4 D4 A4 C5 D5 C5 A4 B4 G4 A4 |
| Danny Boy (Londonderry Air) | verified | Traditional Irish air "Londonderry Air" | F Major | 4/4 | 72 | 1:47 | ★★ | All | E4 F4 G4 A4 G4 A4 D5 C5 A4 G4 F4 D4 F4 A4 B♭4 C5 |
| When the Saints Go Marching In | verified | Traditional American spiritual | G Major | 4/4 | 120 | 0:32 | ★ | All | G4 B4 C5 D5 G4 B4 C5 D5 G4 B4 C5 D5 B4 G4 B4 A4 |
| Oh! Susanna | verified | Stephen Foster (1848) | G Major | 2/2 | 144 | 0:42 | ★ | All | G4 A4 B4 D5 D5 E5 D5 B4 G4 A4 B4 B4 A4 G4 A4 G4 |
| Yankee Doodle | verified | Traditional American fife tune (18th century) | D Major | 2/4 | 120 | 0:32 | ★ | All | D5 E5 F♯5 D5 F♯5 E5 C♯5 D5 E5 F♯5 D5 C♯5 D5 E5 F♯5 G5 |
| Home on the Range | verified | Daniel E. Kelley (1872) | G Major | 3/4 | 120 | 1:00 | ★ | All | D4 D4 G4 A4 B4 G4 F♯4 E4 C5 C5 C5 D5 C5 B4 A4 G4 |
| Shenandoah | verified | Traditional American folk song | F Major | 4/4 | 72 | 1:10 | ★★ | All | C4 F4 F4 F4 G4 A4 B♭4 D5 C5 F5 E5 D5 C5 D5 C5 A4 |
| Clair de Lune | verified | Claude Debussy (Suite bergamasque, 1905) | C♯ Major | 9/8 | 66 | 0:33 | ★★★ | All | A♭5 F5 E♭5 F5 E♭5 D♭5 E♭5 D♭5 F5 D♭5 C5 D♭5 C5 G♭4 B♭4 C5 |
| Sa Re Ga Ma alankar (paltas) | generated | Traditional exercise | C Bilawal | 3/4 | 80 | 0:29 | ★ | All | C4 D4 E4 D4 E4 F4 E4 F4 G4 F4 G4 A4 G4 A4 B4 A4 |
| Bilawal: aroha and avaroha | generated | Traditional exercise | C Bilawal | 4/4 | 80 | 0:12 | ★ | All | C4 D4 E4 F4 G4 A4 B4 C5 C5 B4 A4 G4 F4 E4 D4 C4 |
| Bhoopali: aroha and avaroha | generated | Traditional exercise | C Bhoopali | 4/4 | 80 | 0:12 | ★ | All | C4 D4 E4 G4 A4 C5 C5 A4 G4 E4 D4 C4 |
| Yaman: aroha and avaroha | generated | Traditional exercise | C Yaman | 4/4 | 76 | 0:13 | ★★ | All | B3 D4 E4 F♯4 A4 B4 C5 C5 B4 A4 G4 F♯4 E4 D4 C4 |
| Sunny Steps | generated | Pocket Band (original) | C Major | 4/4 | 100 | 0:19 | ★ | All | C4 D4 E4 C4 E4 F4 G4 G4 A4 G4 F4 E4 C4 D4 D4 E4 |
| Five Finger March | generated | Pocket Band (original) | C Major | 4/4 | 96 | 0:20 | ★ | All | C4 E4 G4 E4 F4 D4 E4 E4 G4 F4 D4 E4 C4 G4 F4 E4 |
| Little Waltz | generated | Pocket Band (original) | G Major | 3/4 | 120 | 0:24 | ★ | All | G4 B4 D5 B4 A4 F♯4 G4 E4 G4 B4 G4 A4 B4 A4 D4 G4 |
| Rainy Day Blues | generated | Pocket Band (original) | A Blues | 4/4 | 92 | 0:21 | ★★ | All | A4 C5 A4 D5 D♯5 E5 C5 A4 A4 C5 A4 D5 E5 G5 E5 D5 |
| Morning Walk in Bhoopali | generated | Pocket Band (original) | C Bhoopali | 4/4 | 88 | 0:22 | ★ | All | C4 D4 E4 D4 E4 G4 A4 G4 E4 G4 D4 E4 G4 A4 C5 A4 |

## Chord songs (guitar and rhythm guitar)

| Track | Status | By | Key | Time | Tempo | Length | Level | First 16 notes |
|---|---|---|---|---|---|---|---|---|
| Happy Birthday | verified | Mildred J. Hill and Patty Hill ("Good Morning to All", 1893) | F Major | 3/4 | 100 | 0:16 | ★ | C4 C4 D4 C4 F4 E4 C4 C4 D4 C4 G4 F4 C4 C4 C5 A4 |
| Silent Night (Stille Nacht) | verified | Franz Xaver Gruber (1818) | B♭ Major | 6/8 | 90 | 0:24 | ★ | F4 G4 F4 D4 F4 G4 F4 D4 C5 C5 A4 B♭4 B♭4 F4 G4 G4 |
| Joy to the World | verified | Tune "Antioch", arranged by Lowell Mason (1839) from G. F. Handel | D Major | 2/4 | 100 | 0:23 | ★ | D5 C♯5 B4 A4 G4 F♯4 E4 D4 A4 B4 B4 C♯5 C♯5 D5 D5 D5 |
| Auld Lang Syne | verified | Traditional (Scottish), guitar setting by Felix Horetzky | D Major | 2/4 | 72 | 0:28 | ★ | A4 D5 D5 D5 F♯5 E5 D5 E5 F♯5 D5 D5 F♯5 A5 B5 D6 A5 |
| Jingle Bells | verified | James Lord Pierpont (1857) | G Major | 4/4 | 120 | 1:04 | ★ | D4 B4 A4 G4 D4 D4 D4 D4 B4 A4 G4 E4 E4 E4 C5 B4 |
| Deck the Halls (Nos Galan) | verified | Traditional Welsh carol tune "Nos Galan" | F Major | 4/4 | 112 | 0:34 | ★ | C5 B♭4 A4 G4 F4 G4 A4 F4 G4 A4 B♭4 G4 A4 G4 F4 E4 |
| We Wish You a Merry Christmas | verified | Traditional English carol | C Major | 3/4 | 132 | 0:23 | ★ | G4 C5 C5 D5 C5 B4 A4 A4 A4 D5 D5 E5 D5 C5 B4 G4 |
| Wedding March | verified | Felix Mendelssohn (A Midsummer Night’s Dream, Op. 61, 1842), organ transcription by Théodore Dubois | C Major | 4/4 | 130 | 0:15 | ★★ | B5 F♯5 A5 G5 F5 D5 C5 D5 G4 D5 E5 C5 E5 G5 C6 B5 |
| Twinkle Twinkle Little Star | verified | Traditional French air (1761), as set by W. A. Mozart (K. 265) | C Major | 2/4 | 108 | 0:27 | ★ | C4 C4 G4 G4 A4 A4 G4 G4 F4 F4 E4 E4 D4 D4 E4 C4 |
| Greensleeves | verified | Traditional (English, 16th century) | E Natural minor | 6/8 | 90 | 0:34 | ★★ | E4 G4 A4 B4 C5 B4 A4 F♯4 D4 E4 F♯4 G4 E4 E4 D♯4 E4 |
| Amazing Grace | verified | Tune "New Britain" (Virginia Harmony, 1831) | G Major | 3/4 | 84 | 0:34 | ★ | D4 G4 B4 G4 B4 A4 G4 E4 D4 D4 G4 B4 G4 B4 A4 D5 |
| Ode to Joy | verified | Ludwig van Beethoven (Symphony No. 9, 1824), hymn setting | G Major | 4/4 | 100 | 0:38 | ★ | B4 B4 C5 D5 D5 C5 A4 B4 A4 G4 G4 A4 B4 B4 A4 A4 |
| Für Elise (opening) | verified | Ludwig van Beethoven (WoO 59, 1810) | A Natural minor | 3/8 | 72 | 0:11 | ★★★ | E5 D♯5 E5 D♯5 E5 B4 D5 C5 A4 C4 E4 A4 B4 E4 G♯4 B4 |
| Moonlight Sonata (opening) | verified | Ludwig van Beethoven (Op. 27 No. 2, 1801) | E Major | 2/2 | 54 | 0:40 | ★★ | G♯4 G♯4 G♯4 G♯4 G♯4 G♯4 A4 G♯4 F♯4 B4 E4 G4 G4 G4 G4 G4 |
| Canon in D | verified | Johann Pachelbel (c. 1690) | D Major | 4/4 | 55 | 0:35 | ★ | F♯5 E5 D5 C♯5 B4 A4 B4 C♯5 D5 C♯5 B4 A4 G4 F♯4 G4 E4 |
| Eine kleine Nachtmusik (theme) | verified | Wolfgang Amadeus Mozart (K. 525, 1787) | G Major | 4/4 | 132 | 0:15 | ★★ | G5 D5 G5 D5 G5 D5 G5 B5 D6 C6 A5 C6 A5 C6 A5 F♯5 |
| Turkish March (Rondo alla turca) | verified | Wolfgang Amadeus Mozart (K. 331, 1783) | A Natural minor | 2/4 | 120 | 0:09 | ★★★ | B4 A4 G♯4 A4 C5 D5 C5 B4 C5 E5 F5 E5 D♯5 E5 B5 A5 |
| Minuet in G | verified | Christian Petzold (c. 1725, BWV Anh. 114, long credited to J. S. Bach) | G Major | 3/4 | 140 | 0:21 | ★★ | D5 G4 A4 B4 C5 D5 G4 G4 E5 C5 D5 E5 F♯5 G5 G4 G4 |
| Minuet in G minor | verified | Christian Petzold (c. 1725, BWV Anh. 115) | G Natural minor | 3/4 | 140 | 0:21 | ★★ | B♭5 A5 G5 A5 D5 D5 G5 G4 A4 B♭4 C5 D5 E♭5 F5 E♭5 D5 |
| Musette in D | verified | Anna Magdalena Bach notebook (BWV Anh. 126, c. 1725) | D Major | 2/4 | 120 | 0:12 | ★★ | A5 G5 F♯5 E5 D5 A5 G5 F♯5 E5 D5 F♯4 G4 A4 G4 F♯4 E4 |
| Air on the G String | verified | Johann Sebastian Bach (Suite No. 3, BWV 1068) | A Major | 4/4 | 30 | 0:48 | ★★★ | F♯5 B5 G5 F♯5 E5 D5 C♯5 D5 C♯5 B4 A4 A5 F♯5 C5 B4 E5 |
| Spring (The Four Seasons) | verified | Antonio Vivaldi (Op. 8 No. 1, 1725) | E Major | 4/4 | 115 | 0:15 | ★★ | E5 G♯5 G♯5 G♯5 F♯5 E5 B5 B5 A5 G♯5 G♯5 G♯5 F♯5 E5 B5 B5 |
| Brahms' Lullaby (Wiegenlied) | verified | Johannes Brahms (Op. 49 No. 4, 1868) | E♭ Major | 3/4 | 72 | 0:43 | ★ | G4 G4 B♭4 G4 G4 B♭4 G4 B♭4 E♭5 D5 C5 C5 B♭4 F4 G4 A♭4 |
| In the Hall of the Mountain King | verified | Edvard Grieg (Peer Gynt, Op. 46 No. 4, 1875), Grieg's piano version | B Natural minor | 4/4 | 138 | 0:14 | ★★ | B1 C♯2 D2 E2 F♯2 D2 F♯2 F2 C♯2 F2 E2 C2 E2 B1 C♯2 D2 |
| Symphony No. 5 (opening) | verified | Ludwig van Beethoven (Op. 67, 1808) | C Natural minor | 2/4 | 192 | 0:13 | ★★ | G4 G4 G4 E♭4 F4 F4 F4 D4 G4 G4 G4 E♭4 A♭4 A♭4 A♭4 G4 |
| O Come, All Ye Faithful (Adeste Fideles) | verified | John Francis Wade (c. 1743) | G Major | 4/4 | 100 | 0:50 | ★ | G4 G4 D4 G4 A4 D4 B4 A4 B4 C5 B4 A4 G4 G4 C♯4 F♯4 |
| Good King Wenceslas | verified | Traditional (Piae Cantiones, 1582) | A Major | 4/4 | 120 | 0:34 | ★ | A4 A4 A4 B4 A4 A4 E4 F♯4 E4 F♯4 G♯4 A4 A4 A4 A4 A4 |
| The First Noel | verified | Traditional English carol (published 1833) | D Major | 3/4 | 100 | 0:45 | ★ | F♯4 E4 D4 E4 F♯4 G4 A4 B4 C♯5 D5 C♯5 B4 A4 B4 C♯5 D5 |
| The Holly and the Ivy | verified | Traditional English carol | F Major | 3/4 | 120 | 0:26 | ★ | F4 F4 F4 F4 D5 C5 A4 F4 F4 F4 F4 D5 C5 C5 B♭4 A4 |
| Home! Sweet Home! | verified | Henry Rowley Bishop (1823) | F Major | 4/4 | 90 | 0:45 | ★ | F4 G4 A4 B♭4 B♭4 C5 C5 A4 A4 C5 B♭4 A4 B♭4 G4 A4 F4 |
| Gymnopédie No. 1 | verified | Erik Satie (1888) | D Major | 3/4 | 72 | 0:10 | ★ | F♯5 A5 G5 F♯5 C♯5 B4 C♯5 D5 A4 F♯4 |
| Sonata facile (opening) | verified | Wolfgang Amadeus Mozart (K. 545, 1788) | C Major | 4/4 | 132 | 0:07 | ★★ | C5 E5 G5 B4 C5 D5 C5 A5 G5 C6 G5 F5 E5 F5 E5 |
| Piano Sonata in A (theme) | verified | Wolfgang Amadeus Mozart (K. 331, 1783) | A Major | 6/8 | 56 | 0:26 | ★★ | C♯5 D5 C♯5 E5 E5 B4 C♯5 B4 D5 D5 A4 A4 B4 B4 C♯5 E5 |
| The Happy Farmer | verified | Robert Schumann (Album for the Young, Op. 68 No. 10, 1848) | F Major | 4/4 | 100 | 0:22 | ★ | C3 F3 A3 C4 F3 B♭3 D4 F4 D4 C4 A3 B♭3 G3 C3 B♭3 A3 |
| Soldiers' March | verified | Robert Schumann (Album for the Young, Op. 68 No. 2, 1848) | G Major | 2/4 | 120 | 0:08 | ★ | B4 C5 D5 E5 D5 C5 B4 A4 G4 B4 C5 D5 E5 D5 G5 F♯5 |
| March of the Wooden Soldiers | verified | Pyotr Ilyich Tchaikovsky (Album for the Young, Op. 39 No. 5, 1878) | D Major | 2/4 | 140 | 0:14 | ★★ | D5 D5 B4 A♯4 B4 C♯5 D5 D5 B4 A♯4 B4 C♯5 D5 E5 F♯5 F♯5 |
| Waltz in A flat | verified | Johannes Brahms (Op. 39 No. 15, 1865) | A♭ Major | 3/4 | 116 | 0:25 | ★★ | C5 A♭4 A♭4 C5 C5 A♭4 A♭4 C5 D♭5 E♭5 D♭5 C5 B♭4 C5 A♭4 A♭4 |
| Frère Jacques | verified | Traditional French round | C Major | 4/4 | 108 | 0:18 | ★ | C4 D4 E4 C4 C4 D4 E4 C4 E4 F4 G4 E4 F4 G4 G4 A4 |
| Scarborough Fair | verified | Traditional English ballad | D Dorian | 3/4 | 96 | 0:36 | ★ | D4 D4 A4 A4 E4 F4 E4 D4 A4 C5 D5 C5 A4 B4 G4 A4 |
| Danny Boy (Londonderry Air) | verified | Traditional Irish air "Londonderry Air" | F Major | 4/4 | 72 | 1:47 | ★★ | E4 F4 G4 A4 G4 A4 D5 C5 A4 G4 F4 D4 F4 A4 B♭4 C5 |
| When the Saints Go Marching In | verified | Traditional American spiritual | G Major | 4/4 | 120 | 0:32 | ★ | G4 B4 C5 D5 G4 B4 C5 D5 G4 B4 C5 D5 B4 G4 B4 A4 |
| Oh! Susanna | verified | Stephen Foster (1848) | G Major | 2/2 | 144 | 0:42 | ★ | G4 A4 B4 D5 D5 E5 D5 B4 G4 A4 B4 B4 A4 G4 A4 G4 |
| Yankee Doodle | verified | Traditional American fife tune (18th century) | D Major | 2/4 | 120 | 0:32 | ★ | D5 E5 F♯5 D5 F♯5 E5 C♯5 D5 E5 F♯5 D5 C♯5 D5 E5 F♯5 G5 |
| Home on the Range | verified | Daniel E. Kelley (1872) | G Major | 3/4 | 120 | 1:00 | ★ | D4 D4 G4 A4 B4 G4 F♯4 E4 C5 C5 C5 D5 C5 B4 A4 G4 |
| Shenandoah | verified | Traditional American folk song | F Major | 4/4 | 72 | 1:10 | ★★ | C4 F4 F4 F4 G4 A4 B♭4 D5 C5 F5 E5 D5 C5 D5 C5 A4 |
| Clair de Lune | verified | Claude Debussy (Suite bergamasque, 1905) | C♯ Major | 9/8 | 66 | 0:33 | ★★★ | A♭5 F5 E♭5 F5 E♭5 D♭5 E♭5 D♭5 F5 D♭5 C5 D♭5 C5 G♭4 B♭4 C5 |
| Rainy Day Blues | generated | Pocket Band (original) | A Blues | 4/4 | 92 | 0:21 | ★★ | A4 C5 A4 D5 D♯5 E5 C5 A4 A4 C5 A4 D5 E5 G5 E5 D5 |

## Bass lines (electric bass)

| Track | Status | By | Key | Time | Tempo | Length | Level | Line | First 16 notes |
|---|---|---|---|---|---|---|---|---|---|
| Happy Birthday | verified | Mildred J. Hill and Patty Hill ("Good Morning to All", 1893) | F Major | 3/4 | 100 | 0:16 | ★ | the score's | F2 C2 C2 F2 F2 B♭2 F2 F2 |
| Silent Night (Stille Nacht) | verified | Franz Xaver Gruber (1818) | B♭ Major | 6/8 | 90 | 0:24 | ★ | the score's | B♭2 B♭2 B♭2 B♭2 B♭2 B♭2 F3 F3 F3 B♭2 B♭2 B♭2 E♭3 E♭3 E♭3 E♭3 |
| Joy to the World | verified | Tune "Antioch", arranged by Lowell Mason (1839) from G. F. Handel | D Major | 2/4 | 100 | 0:23 | ★ | the score's | D3 D3 D3 D3 G2 A2 A2 D3 F♯3 G3 G3 A3 A3 D3 D3 D3 |
| Auld Lang Syne | verified | Traditional (Scottish), guitar setting by Felix Horetzky | D Major | 2/4 | 72 | 0:28 | ★ | the score's | D4 D4 A3 A3 D4 D4 G4 G4 D4 D4 A3 A♯3 B3 G3 D4 D4 |
| Jingle Bells | verified | James Lord Pierpont (1857) | G Major | 4/4 | 120 | 1:04 | ★ | the score's | G2 C3 A2 D3 D3 G2 G2 C3 A2 G2 D3 G2 D3 G2 G2 C3 |
| Deck the Halls (Nos Galan) | verified | Traditional Welsh carol tune "Nos Galan" | F Major | 4/4 | 112 | 0:34 | ★ | the score's | F2 F2 F2 F2 B♭2 G2 C2 F2 F2 F2 F2 F2 B♭2 G2 C2 F2 |
| We Wish You a Merry Christmas | verified | Traditional English carol | C Major | 3/4 | 132 | 0:23 | ★ | the score's | C3 F2 D3 G2 E2 A2 D3 G2 C3 C3 E2 D3 G2 C3 G2 D3 |
| Wedding March | verified | Felix Mendelssohn (A Midsummer Night’s Dream, Op. 61, 1842), organ transcription by Théodore Dubois | C Major | 4/4 | 130 | 0:15 | ★★ | the score's | B2 B2 E3 F3 F3 G2 G3 C3 A2 B2 B2 E3 F3 F3 G2 G3 |
| Twinkle Twinkle Little Star | verified | Traditional French air (1761), as set by W. A. Mozart (K. 265) | C Major | 2/4 | 108 | 0:27 | ★ | the score's | E3 C3 E3 C3 F3 C3 E3 C3 D3 B2 C3 A2 F2 G2 C3 E3 |
| Greensleeves | verified | Traditional (English, 16th century) | E Natural minor | 6/8 | 90 | 0:34 | ★★ | the score's | E3 E3 F♯3 G3 G3 D3 D4 D3 D3 D♯3 E3 E3 C3 C3 B2 B2 |
| Amazing Grace | verified | Tune "New Britain" (Virginia Harmony, 1831) | G Major | 3/4 | 84 | 0:34 | ★ | the score's | G2 G2 G2 B2 D3 D3 E3 C3 G2 G2 G2 G2 B2 D3 C3 B2 |
| Ode to Joy | verified | Ludwig van Beethoven (Symphony No. 9, 1824), hymn setting | G Major | 4/4 | 100 | 0:38 | ★ | the score's | G3 G3 G3 G3 E3 F♯3 G3 D3 B3 B3 A3 G3 D3 D3 D3 G3 |
| Für Elise (opening) | verified | Ludwig van Beethoven (WoO 59, 1810) | A Natural minor | 3/8 | 72 | 0:11 | ★★★ | the score's | A2 E3 A3 E2 E3 G♯3 A2 E3 A3 A2 E3 A3 E2 E3 G♯3 A2 |
| Moonlight Sonata (opening) | verified | Ludwig van Beethoven (Op. 27 No. 2, 1801) | E Major | 2/2 | 54 | 0:40 | ★★ | chord roots | C♯2 G♯1 C♯2 F♯1 E1 B1 E1 E1 E1 E1 F♯1 B1 E1 |
| Canon in D | verified | Johann Pachelbel (c. 1690) | D Major | 4/4 | 55 | 0:35 | ★ | the score's | D3 A2 B2 F♯2 G2 D2 G2 A2 D3 A2 B2 F♯2 G2 D2 G2 A2 |
| Eine kleine Nachtmusik (theme) | verified | Wolfgang Amadeus Mozart (K. 525, 1787) | G Major | 4/4 | 132 | 0:15 | ★★ | the score's | G3 D3 G3 D3 G3 D3 G3 B3 D4 C4 A3 C4 A3 C4 A3 F♯3 |
| Turkish March (Rondo alla turca) | verified | Wolfgang Amadeus Mozart (K. 331, 1783) | A Natural minor | 2/4 | 120 | 0:09 | ★★★ | the score's | A3 C4 C4 C4 A3 C4 C4 C4 A3 C4 A3 C4 A3 C4 C4 C4 |
| Minuet in G | verified | Christian Petzold (c. 1725, BWV Anh. 114, long credited to J. S. Bach) | G Major | 3/4 | 140 | 0:21 | ★★ | the score's | G3 A3 B3 C4 B3 A3 G3 D4 B3 G3 D4 D3 C4 B3 A3 B3 |
| Minuet in G minor | verified | Christian Petzold (c. 1725, BWV Anh. 115) | G Natural minor | 3/4 | 140 | 0:21 | ★★ | the score's | G3 F3 E♭3 D3 D4 C4 B♭3 A3 G3 A3 B♭3 G3 A3 G♭3 G3 D3 |
| Musette in D | verified | Anna Magdalena Bach notebook (BWV Anh. 126, c. 1725) | D Major | 2/4 | 120 | 0:12 | ★★ | the score's | D2 D3 D2 D3 D2 D3 D2 D3 F♯3 G3 A3 G3 F♯3 E3 A3 F♯3 |
| Air on the G String | verified | Johann Sebastian Bach (Suite No. 3, BWV 1068) | A Major | 4/4 | 30 | 0:48 | ★★★ | chord roots | D2 B1 E1 A1 F♯1 B1 E1 A1 D2 E1 A1 |
| Spring (The Four Seasons) | verified | Antonio Vivaldi (Op. 8 No. 1, 1725) | E Major | 4/4 | 115 | 0:15 | ★★ | the score's | E3 E3 E3 E3 E3 E3 E3 E3 E3 E3 E3 A2 A♯2 B2 E3 E3 |
| Brahms' Lullaby (Wiegenlied) | verified | Johannes Brahms (Op. 49 No. 4, 1868) | E♭ Major | 3/4 | 72 | 0:43 | ★ | the score's | B♭2 E♭2 G3 B♭2 E♭2 G3 B♭2 E♭2 B♭3 B♭2 E♭2 F3 B♭2 E♭2 F3 B♭2 |
| In the Hall of the Mountain King | verified | Edvard Grieg (Peer Gynt, Op. 46 No. 4, 1875), Grieg's piano version | B Natural minor | 4/4 | 138 | 0:14 | ★★ | the score's | F♯1 B0 F♯1 B0 F♯1 B0 F♯1 B0 F♯1 D1 A1 D1 A1 B0 F♯1 B0 |
| Symphony No. 5 (opening) | verified | Ludwig van Beethoven (Op. 67, 1808) | C Natural minor | 2/4 | 192 | 0:13 | ★★ | the score's | G2 G2 G2 E♭2 F2 F2 F2 D2 C4 B3 C4 B3 C4 B3 B2 B2 |
| O Come, All Ye Faithful (Adeste Fideles) | verified | John Francis Wade (c. 1743) | G Major | 4/4 | 100 | 0:50 | ★ | the score's | G3 G3 B3 G3 F♯3 F♯3 G3 F♯3 G3 C3 D3 D3 E3 E3 D3 A2 |
| Good King Wenceslas | verified | Traditional (Piae Cantiones, 1582) | A Major | 4/4 | 120 | 0:34 | ★ | the score's | A3 A3 F♯3 G♯3 A3 D3 E3 D3 C♯3 D3 B2 A2 A2 A3 A3 F♯3 |
| The First Noel | verified | Traditional English carol (published 1833) | D Major | 3/4 | 100 | 0:45 | ★ | the score's | D3 G3 D3 B2 A2 A3 G3 F♯3 F♯3 G3 C♯4 D3 G3 G3 F♯3 D3 |
| The Holly and the Ivy | verified | Traditional English carol | F Major | 3/4 | 120 | 0:26 | ★ | chord roots | D2 F1 D2 C2 D2 D2 A1 F1 D2 F1 D2 C2 D2 D2 A1 F1 |
| Home! Sweet Home! | verified | Henry Rowley Bishop (1823) | F Major | 4/4 | 90 | 0:45 | ★ | the score's | F2 C3 F3 C3 G2 C3 G3 C3 F2 C3 F3 C3 F2 C3 F3 C3 |
| Gymnopédie No. 1 | verified | Erik Satie (1888) | D Major | 3/4 | 72 | 0:10 | ★ | the score's | G2 D2 G2 D2 |
| Sonata facile (opening) | verified | Wolfgang Amadeus Mozart (K. 545, 1788) | C Major | 4/4 | 132 | 0:07 | ★★ | the score's | C4 G4 E4 G4 C4 G4 E4 G4 D4 G4 F4 G4 C4 G4 E4 G4 |
| Piano Sonata in A (theme) | verified | Wolfgang Amadeus Mozart (K. 331, 1783) | A Major | 6/8 | 56 | 0:26 | ★★ | the score's | A3 B3 A3 C♯4 C♯4 G♯3 A3 G♯3 B3 B3 F♯3 F♯3 G♯3 G♯3 A3 D3 |
| The Happy Farmer | verified | Robert Schumann (Album for the Young, Op. 68 No. 10, 1848) | F Major | 4/4 | 100 | 0:22 | ★ | chord roots | F1 B♭1 F1 E1 F1 C2 F1 B♭1 F1 E1 F1 C2 |
| Soldiers' March | verified | Robert Schumann (Album for the Young, Op. 68 No. 2, 1848) | G Major | 2/4 | 120 | 0:08 | ★ | the score's | G3 A3 B3 C4 B3 A3 G3 D3 G3 G3 A3 B3 C4 B3 C♯4 D4 |
| March of the Wooden Soldiers | verified | Pyotr Ilyich Tchaikovsky (Album for the Young, Op. 39 No. 5, 1878) | D Major | 2/4 | 140 | 0:14 | ★★ | the score's | D4 D4 F♯4 G4 E4 D4 D4 F♯4 G4 E4 D4 A4 D5 D4 A4 A4 |
| Waltz in A flat | verified | Johannes Brahms (Op. 39 No. 15, 1865) | A♭ Major | 3/4 | 116 | 0:25 | ★★ | the score's | A♭2 E♭3 C3 A♭1 E♭3 C3 A♭2 D♭3 F3 A♭1 E♭3 C3 F2 F3 A♭2 F2 |
| Frère Jacques | verified | Traditional French round | C Major | 4/4 | 108 | 0:18 | ★ | the score's | E3 E3 C3 C3 E3 E3 G3 G3 |
| Scarborough Fair | verified | Traditional English ballad | D Dorian | 3/4 | 96 | 0:36 | ★ | chord roots | D2 A1 E1 D2 A1 D2 A1 A1 D2 D2 F1 D2 C2 C2 D2 G1 |
| Danny Boy (Londonderry Air) | verified | Traditional Irish air "Londonderry Air" | F Major | 4/4 | 72 | 1:47 | ★★ | the score's | F2 F2 B♭2 F2 D3 G2 C3 F2 F2 B♭2 C3 F2 B♭2 F2 B♭2 F2 |
| When the Saints Go Marching In | verified | Traditional American spiritual | G Major | 4/4 | 120 | 0:32 | ★ | the score's | G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 G2 A2 A2 D2 D2 |
| Oh! Susanna | verified | Stephen Foster (1848) | G Major | 2/2 | 144 | 0:42 | ★ | the score's | G2 D3 G2 D3 G2 D3 G2 D3 G2 C3 G2 D3 G2 D3 G2 |
| Yankee Doodle | verified | Traditional American fife tune (18th century) | D Major | 2/4 | 120 | 0:32 | ★ | chord roots | D2 D2 D2 D2 D2 G1 F♯1 D2 D2 D2 D2 D2 D2 G1 F♯1 D2 |
| Home on the Range | verified | Daniel E. Kelley (1872) | G Major | 3/4 | 120 | 1:00 | ★ | the score's | G2 C3 C3 G2 D3 G2 C3 C3 G2 D3 G2 G2 D3 G2 D3 G2 |
| Shenandoah | verified | Traditional American folk song | F Major | 4/4 | 72 | 1:10 | ★★ | the score's | F2 B♭2 F2 B♭2 C3 F2 B♭2 F2 F2 B♭2 F2 D3 A2 F2 D3 G2 |
| Clair de Lune | verified | Claude Debussy (Suite bergamasque, 1905) | C♯ Major | 9/8 | 66 | 0:33 | ★★★ | the score's | F4 G♭4 F4 E♭4 D♭4 C4 B♭3 A3 A♭3 G♭3 F3 E♭3 A♭2 |
| Rainy Day Blues | generated | Pocket Band (original) | A Blues | 4/4 | 92 | 0:21 | ★★ | pattern | A1 A1 E2 A2 A1 A1 E2 A2 A1 A1 E2 A2 A1 A1 E2 A2 |
| Sunny Steps | generated | Pocket Band (original) | C Major | 4/4 | 100 | 0:19 | ★★ | pattern | C2 C2 C2 C2 C2 C2 C2 C2 C2 C2 C2 C2 C2 C2 C2 C2 |

## Drum beats (drums and electric drum pad)

| Track | Status | By | Key | Time | Tempo | Length | Level | Beat | First 16 notes |
|---|---|---|---|---|---|---|---|---|---|
| Happy Birthday | generated | Mildred J. Hill and Patty Hill ("Good Morning to All", 1893) | – (unpitched) | 3/4 | 100 | 0:16 | ★ | Waltz | C4 C4 D4 C4 F4 E4 C4 C4 D4 C4 G4 F4 C4 C4 C5 A4 |
| Silent Night (Stille Nacht) | generated | Franz Xaver Gruber (1818) | – (unpitched) | 6/8 | 90 | 0:24 | ★ | Six-eight | F4 G4 F4 D4 F4 G4 F4 D4 C5 C5 A4 A♯4 A♯4 F4 G4 G4 |
| Joy to the World | generated | Tune "Antioch", arranged by Lowell Mason (1839) from G. F. Handel | – (unpitched) | 2/4 | 100 | 0:23 | ★ | March | D5 C♯5 B4 A4 G4 F♯4 E4 D4 A4 B4 B4 C♯5 C♯5 D5 D5 D5 |
| Auld Lang Syne | generated | Traditional (Scottish), guitar setting by Felix Horetzky | – (unpitched) | 2/4 | 72 | 0:28 | ★ | March | A4 D5 D5 D5 F♯5 E5 D5 E5 F♯5 D5 D5 F♯5 A5 B5 D6 A5 |
| Jingle Bells | generated | James Lord Pierpont (1857) | – (unpitched) | 4/4 | 120 | 1:04 | ★ | Rock beat | D4 B4 A4 G4 D4 D4 D4 D4 B4 A4 G4 E4 E4 E4 C5 B4 |
| Deck the Halls (Nos Galan) | generated | Traditional Welsh carol tune "Nos Galan" | – (unpitched) | 4/4 | 112 | 0:34 | ★ | Rock beat | C5 A♯4 A4 G4 F4 G4 A4 F4 G4 A4 A♯4 G4 A4 G4 F4 E4 |
| We Wish You a Merry Christmas | generated | Traditional English carol | – (unpitched) | 3/4 | 132 | 0:23 | ★ | Waltz | G4 C5 C5 D5 C5 B4 A4 A4 A4 D5 D5 E5 D5 C5 B4 G4 |
| Wedding March | generated | Felix Mendelssohn (A Midsummer Night’s Dream, Op. 61, 1842), organ transcription by Théodore Dubois | – (unpitched) | 4/4 | 130 | 0:15 | ★ | Rock beat | B5 F♯5 A5 G5 F5 D5 C5 D5 G4 D5 E5 C5 E5 G5 C6 B5 |
| Twinkle Twinkle Little Star | generated | Traditional French air (1761), as set by W. A. Mozart (K. 265) | – (unpitched) | 2/4 | 108 | 0:27 | ★ | March | C4 C4 G4 G4 A4 A4 G4 G4 F4 F4 E4 E4 D4 D4 E4 C4 |
| Greensleeves | generated | Traditional (English, 16th century) | – (unpitched) | 6/8 | 90 | 0:34 | ★ | Six-eight | E4 G4 A4 B4 C5 B4 A4 F♯4 D4 E4 F♯4 G4 E4 E4 D♯4 E4 |
| Amazing Grace | generated | Tune "New Britain" (Virginia Harmony, 1831) | – (unpitched) | 3/4 | 84 | 0:34 | ★ | Waltz | D4 G4 B4 G4 B4 A4 G4 E4 D4 D4 G4 B4 G4 B4 A4 D5 |
| Ode to Joy | generated | Ludwig van Beethoven (Symphony No. 9, 1824), hymn setting | – (unpitched) | 4/4 | 100 | 0:38 | ★ | Rock beat | B4 B4 C5 D5 D5 C5 A4 B4 A4 G4 G4 A4 B4 B4 A4 A4 |
| Für Elise (opening) | generated | Ludwig van Beethoven (WoO 59, 1810) | – (unpitched) | 3/8 | 72 | 0:11 | ★ | One in a bar | E5 D♯5 E5 D♯5 E5 B4 D5 C5 A4 C4 E4 A4 B4 E4 G♯4 B4 |
| Moonlight Sonata (opening) | generated | Ludwig van Beethoven (Op. 27 No. 2, 1801) | – (unpitched) | 2/2 | 54 | 0:40 | ★ | Ballad | G♯4 G♯4 G♯4 G♯4 G♯4 G♯4 A4 G♯4 F♯4 B4 E4 G4 G4 G4 G4 G4 |
| Canon in D | generated | Johann Pachelbel (c. 1690) | – (unpitched) | 4/4 | 55 | 0:35 | ★ | Ballad | F♯5 E5 D5 C♯5 B4 A4 B4 C♯5 D5 C♯5 B4 A4 G4 F♯4 G4 E4 |
| Eine kleine Nachtmusik (theme) | generated | Wolfgang Amadeus Mozart (K. 525, 1787) | – (unpitched) | 4/4 | 132 | 0:15 | ★ | Rock beat | G5 D5 G5 D5 G5 D5 G5 B5 D6 C6 A5 C6 A5 C6 A5 F♯5 |
| Turkish March (Rondo alla turca) | generated | Wolfgang Amadeus Mozart (K. 331, 1783) | – (unpitched) | 2/4 | 120 | 0:09 | ★ | March | B4 A4 G♯4 A4 C5 D5 C5 B4 C5 E5 F5 E5 D♯5 E5 B5 A5 |
| Minuet in G | generated | Christian Petzold (c. 1725, BWV Anh. 114, long credited to J. S. Bach) | – (unpitched) | 3/4 | 140 | 0:21 | ★★ | Waltz | D5 G4 A4 B4 C5 D5 G4 G4 E5 C5 D5 E5 F♯5 G5 G4 G4 |
| Minuet in G minor | generated | Christian Petzold (c. 1725, BWV Anh. 115) | – (unpitched) | 3/4 | 140 | 0:21 | ★★ | Waltz | A♯5 A5 G5 A5 D5 D5 G5 G4 A4 A♯4 C5 D5 D♯5 F5 D♯5 D5 |
| Musette in D | generated | Anna Magdalena Bach notebook (BWV Anh. 126, c. 1725) | – (unpitched) | 2/4 | 120 | 0:12 | ★ | March | A5 G5 F♯5 E5 D5 A5 G5 F♯5 E5 D5 F♯4 G4 A4 G4 F♯4 E4 |
| Air on the G String | generated | Johann Sebastian Bach (Suite No. 3, BWV 1068) | – (unpitched) | 4/4 | 30 | 0:48 | ★ | Ballad | F♯5 B5 G5 F♯5 E5 D5 C♯5 D5 C♯5 B4 A4 A5 F♯5 C5 B4 E5 |
| Spring (The Four Seasons) | generated | Antonio Vivaldi (Op. 8 No. 1, 1725) | – (unpitched) | 4/4 | 115 | 0:15 | ★ | Rock beat | E5 G♯5 G♯5 G♯5 F♯5 E5 B5 B5 A5 G♯5 G♯5 G♯5 F♯5 E5 B5 B5 |
| Brahms' Lullaby (Wiegenlied) | generated | Johannes Brahms (Op. 49 No. 4, 1868) | – (unpitched) | 3/4 | 72 | 0:43 | ★ | Waltz | G4 G4 A♯4 G4 G4 A♯4 G4 A♯4 D♯5 D5 C5 C5 A♯4 F4 G4 G♯4 |
| In the Hall of the Mountain King | generated | Edvard Grieg (Peer Gynt, Op. 46 No. 4, 1875), Grieg's piano version | – (unpitched) | 4/4 | 138 | 0:14 | ★ | Rock beat | B1 C♯2 D2 E2 F♯2 D2 F♯2 F2 C♯2 F2 E2 C2 E2 B1 C♯2 D2 |
| Symphony No. 5 (opening) | generated | Ludwig van Beethoven (Op. 67, 1808) | – (unpitched) | 2/4 | 192 | 0:13 | ★★ | March | G4 G4 G4 D♯4 F4 F4 F4 D4 G4 G4 G4 D♯4 G♯4 G♯4 G♯4 G4 |
| O Come, All Ye Faithful (Adeste Fideles) | generated | John Francis Wade (c. 1743) | – (unpitched) | 4/4 | 100 | 0:50 | ★ | Rock beat | G4 G4 D4 G4 A4 D4 B4 A4 B4 C5 B4 A4 G4 G4 C♯4 F♯4 |
| Good King Wenceslas | generated | Traditional (Piae Cantiones, 1582) | – (unpitched) | 4/4 | 120 | 0:34 | ★ | Rock beat | A4 A4 A4 B4 A4 A4 E4 F♯4 E4 F♯4 G♯4 A4 A4 A4 A4 A4 |
| The First Noel | generated | Traditional English carol (published 1833) | – (unpitched) | 3/4 | 100 | 0:45 | ★ | Waltz | F♯4 E4 D4 E4 F♯4 G4 A4 B4 C♯5 D5 C♯5 B4 A4 B4 C♯5 D5 |
| The Holly and the Ivy | generated | Traditional English carol | – (unpitched) | 3/4 | 120 | 0:26 | ★ | Waltz | F4 F4 F4 F4 D5 C5 A4 F4 F4 F4 F4 D5 C5 C5 A♯4 A4 |
| Home! Sweet Home! | generated | Henry Rowley Bishop (1823) | – (unpitched) | 4/4 | 90 | 0:45 | ★ | Rock beat | F4 G4 A4 A♯4 A♯4 C5 C5 A4 A4 C5 A♯4 A4 A♯4 G4 A4 F4 |
| Gymnopédie No. 1 | generated | Erik Satie (1888) | – (unpitched) | 3/4 | 72 | 0:10 | ★ | Waltz | F♯5 A5 G5 F♯5 C♯5 B4 C♯5 D5 A4 F♯4 |
| Sonata facile (opening) | generated | Wolfgang Amadeus Mozart (K. 545, 1788) | – (unpitched) | 4/4 | 132 | 0:07 | ★ | Rock beat | C5 E5 G5 B4 C5 D5 C5 A5 G5 C6 G5 F5 E5 F5 E5 |
| Piano Sonata in A (theme) | generated | Wolfgang Amadeus Mozart (K. 331, 1783) | – (unpitched) | 6/8 | 56 | 0:26 | ★ | Six-eight | C♯5 D5 C♯5 E5 E5 B4 C♯5 B4 D5 D5 A4 A4 B4 B4 C♯5 E5 |
| The Happy Farmer | generated | Robert Schumann (Album for the Young, Op. 68 No. 10, 1848) | – (unpitched) | 4/4 | 100 | 0:22 | ★ | Rock beat | C3 F3 A3 C4 F3 A♯3 D4 F4 D4 C4 A3 A♯3 G3 C3 A♯3 A3 |
| Soldiers' March | generated | Robert Schumann (Album for the Young, Op. 68 No. 2, 1848) | – (unpitched) | 2/4 | 120 | 0:08 | ★ | March | B4 C5 D5 E5 D5 C5 B4 A4 G4 B4 C5 D5 E5 D5 G5 F♯5 |
| March of the Wooden Soldiers | generated | Pyotr Ilyich Tchaikovsky (Album for the Young, Op. 39 No. 5, 1878) | – (unpitched) | 2/4 | 140 | 0:14 | ★★ | March | D5 D5 B4 A♯4 B4 C♯5 D5 D5 B4 A♯4 B4 C♯5 D5 E5 F♯5 F♯5 |
| Waltz in A flat | generated | Johannes Brahms (Op. 39 No. 15, 1865) | – (unpitched) | 3/4 | 116 | 0:25 | ★ | Waltz | C5 G♯4 G♯4 C5 C5 G♯4 G♯4 C5 C♯5 D♯5 C♯5 C5 A♯4 C5 G♯4 G♯4 |
| Frère Jacques | generated | Traditional French round | – (unpitched) | 4/4 | 108 | 0:18 | ★ | Rock beat | C4 D4 E4 C4 C4 D4 E4 C4 E4 F4 G4 E4 F4 G4 G4 A4 |
| Scarborough Fair | generated | Traditional English ballad | – (unpitched) | 3/4 | 96 | 0:36 | ★ | Waltz | D4 D4 A4 A4 E4 F4 E4 D4 A4 C5 D5 C5 A4 B4 G4 A4 |
| Danny Boy (Londonderry Air) | generated | Traditional Irish air "Londonderry Air" | – (unpitched) | 4/4 | 72 | 1:47 | ★ | Ballad | E4 F4 G4 A4 G4 A4 D5 C5 A4 G4 F4 D4 F4 A4 A♯4 C5 |
| When the Saints Go Marching In | generated | Traditional American spiritual | – (unpitched) | 4/4 | 120 | 0:32 | ★ | Rock beat | G4 B4 C5 D5 G4 B4 C5 D5 G4 B4 C5 D5 B4 G4 B4 A4 |
| Oh! Susanna | generated | Stephen Foster (1848) | – (unpitched) | 2/2 | 144 | 0:42 | ★★ | Rock beat | G4 A4 B4 D5 D5 E5 D5 B4 G4 A4 B4 B4 A4 G4 A4 G4 |
| Yankee Doodle | generated | Traditional American fife tune (18th century) | – (unpitched) | 2/4 | 120 | 0:32 | ★ | March | D5 E5 F♯5 D5 F♯5 E5 C♯5 D5 E5 F♯5 D5 C♯5 D5 E5 F♯5 G5 |
| Home on the Range | generated | Daniel E. Kelley (1872) | – (unpitched) | 3/4 | 120 | 1:00 | ★ | Waltz | D4 D4 G4 A4 B4 G4 F♯4 E4 C5 C5 C5 D5 C5 B4 A4 G4 |
| Shenandoah | generated | Traditional American folk song | – (unpitched) | 4/4 | 72 | 1:10 | ★ | Ballad | C4 F4 F4 F4 G4 A4 A♯4 D5 C5 F5 E5 D5 C5 D5 C5 A4 |
| Clair de Lune | generated | Claude Debussy (Suite bergamasque, 1905) | – (unpitched) | 9/8 | 66 | 0:33 | ★ | Nine-eight | G♯5 F5 D♯5 F5 D♯5 C♯5 D♯5 C♯5 F5 C♯5 C5 C♯5 C5 F♯4 A♯4 C5 |
| Rock beat | generated | Pocket Band (original) | – (unpitched) | 4/4 | 100 | 0:10 | ★ | groove | – |
| Disco | generated | Pocket Band (original) | – (unpitched) | 4/4 | 116 | 0:08 | ★ | groove | – |
| Hip hop | generated | Pocket Band (original) | – (unpitched) | 4/4 | 90 | 0:11 | ★★ | groove | – |
| Bossa nova | generated | Pocket Band (original) | – (unpitched) | 4/4 | 120 | 0:08 | ★★★ | groove | – |
| Reggae one drop | generated | Pocket Band (original) | – (unpitched) | 4/4 | 76 | 0:13 | ★★ | groove | – |
| House | generated | Pocket Band (original) | – (unpitched) | 4/4 | 122 | 0:08 | ★ | groove | – |
| Shuffle | generated | Pocket Band (original) | – (unpitched) | 4/4 | 96 | 0:10 | ★★ | groove | – |
| Funk | generated | Pocket Band (original) | – (unpitched) | 4/4 | 100 | 0:10 | ★★★ | groove | – |
| Slow ballad | generated | Pocket Band (original) | – (unpitched) | 4/4 | 70 | 0:14 | ★ | groove | – |
| March | generated | Pocket Band (original) | – (unpitched) | 4/4 | 112 | 0:09 | ★★ | groove | – |

## Taals (tabla, dual and single)

| Track | Status | By | Key | Time | Tempo | Length | Level | Taal | First 16 notes |
|---|---|---|---|---|---|---|---|---|---|
| Happy Birthday | generated | Mildred J. Hill and Patty Hill ("Good Morning to All", 1893) | – (unpitched) | 3/4 | 100 | 0:16 | ★ | Dadra (6 matras) | C4 C4 D4 C4 F4 E4 C4 C4 D4 C4 G4 F4 C4 C4 C5 A4 |
| Silent Night (Stille Nacht) | generated | Franz Xaver Gruber (1818) | – (unpitched) | 6/8 | 90 | 0:24 | ★ | Dadra (6 matras) | F4 G4 F4 D4 F4 G4 F4 D4 C5 C5 A4 A♯4 A♯4 F4 G4 G4 |
| Joy to the World | generated | Tune "Antioch", arranged by Lowell Mason (1839) from G. F. Handel | – (unpitched) | 2/4 | 100 | 0:23 | ★ | Keherwa (8 matras) | D5 C♯5 B4 A4 G4 F♯4 E4 D4 A4 B4 B4 C♯5 C♯5 D5 D5 D5 |
| Auld Lang Syne | generated | Traditional (Scottish), guitar setting by Felix Horetzky | – (unpitched) | 2/4 | 72 | 0:28 | ★ | Keherwa (8 matras) | A4 D5 D5 D5 F♯5 E5 D5 E5 F♯5 D5 D5 F♯5 A5 B5 D6 A5 |
| Jingle Bells | generated | James Lord Pierpont (1857) | – (unpitched) | 4/4 | 120 | 1:04 | ★ | Keherwa (8 matras) | D4 B4 A4 G4 D4 D4 D4 D4 B4 A4 G4 E4 E4 E4 C5 B4 |
| Deck the Halls (Nos Galan) | generated | Traditional Welsh carol tune "Nos Galan" | – (unpitched) | 4/4 | 112 | 0:34 | ★ | Keherwa (8 matras) | C5 A♯4 A4 G4 F4 G4 A4 F4 G4 A4 A♯4 G4 A4 G4 F4 E4 |
| We Wish You a Merry Christmas | generated | Traditional English carol | – (unpitched) | 3/4 | 132 | 0:23 | ★ | Dadra (6 matras) | G4 C5 C5 D5 C5 B4 A4 A4 A4 D5 D5 E5 D5 C5 B4 G4 |
| Wedding March | generated | Felix Mendelssohn (A Midsummer Night’s Dream, Op. 61, 1842), organ transcription by Théodore Dubois | – (unpitched) | 4/4 | 130 | 0:15 | ★ | Keherwa (8 matras) | B5 F♯5 A5 G5 F5 D5 C5 D5 G4 D5 E5 C5 E5 G5 C6 B5 |
| Twinkle Twinkle Little Star | generated | Traditional French air (1761), as set by W. A. Mozart (K. 265) | – (unpitched) | 2/4 | 108 | 0:27 | ★ | Keherwa (8 matras) | C4 C4 G4 G4 A4 A4 G4 G4 F4 F4 E4 E4 D4 D4 E4 C4 |
| Greensleeves | generated | Traditional (English, 16th century) | – (unpitched) | 6/8 | 90 | 0:34 | ★ | Dadra (6 matras) | E4 G4 A4 B4 C5 B4 A4 F♯4 D4 E4 F♯4 G4 E4 E4 D♯4 E4 |
| Amazing Grace | generated | Tune "New Britain" (Virginia Harmony, 1831) | – (unpitched) | 3/4 | 84 | 0:34 | ★ | Dadra (6 matras) | D4 G4 B4 G4 B4 A4 G4 E4 D4 D4 G4 B4 G4 B4 A4 D5 |
| Ode to Joy | generated | Ludwig van Beethoven (Symphony No. 9, 1824), hymn setting | – (unpitched) | 4/4 | 100 | 0:38 | ★ | Keherwa (8 matras) | B4 B4 C5 D5 D5 C5 A4 B4 A4 G4 G4 A4 B4 B4 A4 A4 |
| Für Elise (opening) | generated | Ludwig van Beethoven (WoO 59, 1810) | – (unpitched) | 3/8 | 72 | 0:11 | ★ | Dadra (6 matras) | E5 D♯5 E5 D♯5 E5 B4 D5 C5 A4 C4 E4 A4 B4 E4 G♯4 B4 |
| Moonlight Sonata (opening) | generated | Ludwig van Beethoven (Op. 27 No. 2, 1801) | – (unpitched) | 2/2 | 54 | 0:40 | ★ | Keherwa (8 matras) | G♯4 G♯4 G♯4 G♯4 G♯4 G♯4 A4 G♯4 F♯4 B4 E4 G4 G4 G4 G4 G4 |
| Canon in D | generated | Johann Pachelbel (c. 1690) | – (unpitched) | 4/4 | 55 | 0:35 | ★ | Keherwa (8 matras) | F♯5 E5 D5 C♯5 B4 A4 B4 C♯5 D5 C♯5 B4 A4 G4 F♯4 G4 E4 |
| Eine kleine Nachtmusik (theme) | generated | Wolfgang Amadeus Mozart (K. 525, 1787) | – (unpitched) | 4/4 | 132 | 0:15 | ★ | Keherwa (8 matras) | G5 D5 G5 D5 G5 D5 G5 B5 D6 C6 A5 C6 A5 C6 A5 F♯5 |
| Turkish March (Rondo alla turca) | generated | Wolfgang Amadeus Mozart (K. 331, 1783) | – (unpitched) | 2/4 | 120 | 0:09 | ★ | Keherwa (8 matras) | B4 A4 G♯4 A4 C5 D5 C5 B4 C5 E5 F5 E5 D♯5 E5 B5 A5 |
| Minuet in G | generated | Christian Petzold (c. 1725, BWV Anh. 114, long credited to J. S. Bach) | – (unpitched) | 3/4 | 140 | 0:21 | ★ | Dadra (6 matras) | D5 G4 A4 B4 C5 D5 G4 G4 E5 C5 D5 E5 F♯5 G5 G4 G4 |
| Minuet in G minor | generated | Christian Petzold (c. 1725, BWV Anh. 115) | – (unpitched) | 3/4 | 140 | 0:21 | ★ | Dadra (6 matras) | A♯5 A5 G5 A5 D5 D5 G5 G4 A4 A♯4 C5 D5 D♯5 F5 D♯5 D5 |
| Musette in D | generated | Anna Magdalena Bach notebook (BWV Anh. 126, c. 1725) | – (unpitched) | 2/4 | 120 | 0:12 | ★ | Keherwa (8 matras) | A5 G5 F♯5 E5 D5 A5 G5 F♯5 E5 D5 F♯4 G4 A4 G4 F♯4 E4 |
| Air on the G String | generated | Johann Sebastian Bach (Suite No. 3, BWV 1068) | – (unpitched) | 4/4 | 30 | 0:48 | ★ | Keherwa (8 matras) | F♯5 B5 G5 F♯5 E5 D5 C♯5 D5 C♯5 B4 A4 A5 F♯5 C5 B4 E5 |
| Spring (The Four Seasons) | generated | Antonio Vivaldi (Op. 8 No. 1, 1725) | – (unpitched) | 4/4 | 115 | 0:15 | ★ | Keherwa (8 matras) | E5 G♯5 G♯5 G♯5 F♯5 E5 B5 B5 A5 G♯5 G♯5 G♯5 F♯5 E5 B5 B5 |
| Brahms' Lullaby (Wiegenlied) | generated | Johannes Brahms (Op. 49 No. 4, 1868) | – (unpitched) | 3/4 | 72 | 0:43 | ★ | Dadra (6 matras) | G4 G4 A♯4 G4 G4 A♯4 G4 A♯4 D♯5 D5 C5 C5 A♯4 F4 G4 G♯4 |
| In the Hall of the Mountain King | generated | Edvard Grieg (Peer Gynt, Op. 46 No. 4, 1875), Grieg's piano version | – (unpitched) | 4/4 | 138 | 0:14 | ★ | Keherwa (8 matras) | B1 C♯2 D2 E2 F♯2 D2 F♯2 F2 C♯2 F2 E2 C2 E2 B1 C♯2 D2 |
| Symphony No. 5 (opening) | generated | Ludwig van Beethoven (Op. 67, 1808) | – (unpitched) | 2/4 | 192 | 0:13 | ★ | Keherwa (8 matras) | G4 G4 G4 D♯4 F4 F4 F4 D4 G4 G4 G4 D♯4 G♯4 G♯4 G♯4 G4 |
| O Come, All Ye Faithful (Adeste Fideles) | generated | John Francis Wade (c. 1743) | – (unpitched) | 4/4 | 100 | 0:50 | ★ | Keherwa (8 matras) | G4 G4 D4 G4 A4 D4 B4 A4 B4 C5 B4 A4 G4 G4 C♯4 F♯4 |
| Good King Wenceslas | generated | Traditional (Piae Cantiones, 1582) | – (unpitched) | 4/4 | 120 | 0:34 | ★ | Keherwa (8 matras) | A4 A4 A4 B4 A4 A4 E4 F♯4 E4 F♯4 G♯4 A4 A4 A4 A4 A4 |
| The First Noel | generated | Traditional English carol (published 1833) | – (unpitched) | 3/4 | 100 | 0:45 | ★ | Dadra (6 matras) | F♯4 E4 D4 E4 F♯4 G4 A4 B4 C♯5 D5 C♯5 B4 A4 B4 C♯5 D5 |
| The Holly and the Ivy | generated | Traditional English carol | – (unpitched) | 3/4 | 120 | 0:26 | ★ | Dadra (6 matras) | F4 F4 F4 F4 D5 C5 A4 F4 F4 F4 F4 D5 C5 C5 A♯4 A4 |
| Home! Sweet Home! | generated | Henry Rowley Bishop (1823) | – (unpitched) | 4/4 | 90 | 0:45 | ★ | Keherwa (8 matras) | F4 G4 A4 A♯4 A♯4 C5 C5 A4 A4 C5 A♯4 A4 A♯4 G4 A4 F4 |
| Gymnopédie No. 1 | generated | Erik Satie (1888) | – (unpitched) | 3/4 | 72 | 0:10 | ★ | Dadra (6 matras) | F♯5 A5 G5 F♯5 C♯5 B4 C♯5 D5 A4 F♯4 |
| Sonata facile (opening) | generated | Wolfgang Amadeus Mozart (K. 545, 1788) | – (unpitched) | 4/4 | 132 | 0:07 | ★ | Keherwa (8 matras) | C5 E5 G5 B4 C5 D5 C5 A5 G5 C6 G5 F5 E5 F5 E5 |
| Piano Sonata in A (theme) | generated | Wolfgang Amadeus Mozart (K. 331, 1783) | – (unpitched) | 6/8 | 56 | 0:26 | ★ | Dadra (6 matras) | C♯5 D5 C♯5 E5 E5 B4 C♯5 B4 D5 D5 A4 A4 B4 B4 C♯5 E5 |
| The Happy Farmer | generated | Robert Schumann (Album for the Young, Op. 68 No. 10, 1848) | – (unpitched) | 4/4 | 100 | 0:22 | ★ | Keherwa (8 matras) | C3 F3 A3 C4 F3 A♯3 D4 F4 D4 C4 A3 A♯3 G3 C3 A♯3 A3 |
| Soldiers' March | generated | Robert Schumann (Album for the Young, Op. 68 No. 2, 1848) | – (unpitched) | 2/4 | 120 | 0:08 | ★ | Keherwa (8 matras) | B4 C5 D5 E5 D5 C5 B4 A4 G4 B4 C5 D5 E5 D5 G5 F♯5 |
| March of the Wooden Soldiers | generated | Pyotr Ilyich Tchaikovsky (Album for the Young, Op. 39 No. 5, 1878) | – (unpitched) | 2/4 | 140 | 0:14 | ★ | Keherwa (8 matras) | D5 D5 B4 A♯4 B4 C♯5 D5 D5 B4 A♯4 B4 C♯5 D5 E5 F♯5 F♯5 |
| Waltz in A flat | generated | Johannes Brahms (Op. 39 No. 15, 1865) | – (unpitched) | 3/4 | 116 | 0:25 | ★ | Dadra (6 matras) | C5 G♯4 G♯4 C5 C5 G♯4 G♯4 C5 C♯5 D♯5 C♯5 C5 A♯4 C5 G♯4 G♯4 |
| Frère Jacques | generated | Traditional French round | – (unpitched) | 4/4 | 108 | 0:18 | ★ | Keherwa (8 matras) | C4 D4 E4 C4 C4 D4 E4 C4 E4 F4 G4 E4 F4 G4 G4 A4 |
| Scarborough Fair | generated | Traditional English ballad | – (unpitched) | 3/4 | 96 | 0:36 | ★ | Dadra (6 matras) | D4 D4 A4 A4 E4 F4 E4 D4 A4 C5 D5 C5 A4 B4 G4 A4 |
| Danny Boy (Londonderry Air) | generated | Traditional Irish air "Londonderry Air" | – (unpitched) | 4/4 | 72 | 1:47 | ★ | Keherwa (8 matras) | E4 F4 G4 A4 G4 A4 D5 C5 A4 G4 F4 D4 F4 A4 A♯4 C5 |
| When the Saints Go Marching In | generated | Traditional American spiritual | – (unpitched) | 4/4 | 120 | 0:32 | ★ | Keherwa (8 matras) | G4 B4 C5 D5 G4 B4 C5 D5 G4 B4 C5 D5 B4 G4 B4 A4 |
| Oh! Susanna | generated | Stephen Foster (1848) | – (unpitched) | 2/2 | 144 | 0:42 | ★ | Keherwa (8 matras) | G4 A4 B4 D5 D5 E5 D5 B4 G4 A4 B4 B4 A4 G4 A4 G4 |
| Yankee Doodle | generated | Traditional American fife tune (18th century) | – (unpitched) | 2/4 | 120 | 0:32 | ★ | Keherwa (8 matras) | D5 E5 F♯5 D5 F♯5 E5 C♯5 D5 E5 F♯5 D5 C♯5 D5 E5 F♯5 G5 |
| Home on the Range | generated | Daniel E. Kelley (1872) | – (unpitched) | 3/4 | 120 | 1:00 | ★ | Dadra (6 matras) | D4 D4 G4 A4 B4 G4 F♯4 E4 C5 C5 C5 D5 C5 B4 A4 G4 |
| Shenandoah | generated | Traditional American folk song | – (unpitched) | 4/4 | 72 | 1:10 | ★ | Keherwa (8 matras) | C4 F4 F4 F4 G4 A4 A♯4 D5 C5 F5 E5 D5 C5 D5 C5 A4 |
| Clair de Lune | generated | Claude Debussy (Suite bergamasque, 1905) | – (unpitched) | 9/8 | 66 | 0:33 | ★ | Dadra (6 matras) | G♯5 F5 D♯5 F5 D♯5 C♯5 D♯5 C♯5 F5 C♯5 C5 C♯5 C5 F♯4 A♯4 C5 |
| Teental (16 matras) | generated | Traditional (theka) | – (unpitched) | 16/4 | 100 | 0:19 | ★ | Teental (16 matras) | – |
| Keherwa (8 matras) | generated | Traditional (theka) | – (unpitched) | 8/4 | 110 | 0:09 | ★ | Keherwa (8 matras) | – |
| Dadra (6 matras) | generated | Traditional (theka) | – (unpitched) | 6/4 | 120 | 0:06 | ★ | Dadra (6 matras) | – |
| Rupak (7 matras) | generated | Traditional (theka) | – (unpitched) | 7/4 | 100 | 0:08 | ★★ | Rupak (7 matras) | – |
| Jhaptal (10 matras) | generated | Traditional (theka) | – (unpitched) | 10/4 | 100 | 0:12 | ★★ | Jhaptal (10 matras) | – |
| Ektaal (12 matras) | generated | Traditional (theka) | – (unpitched) | 12/4 | 84 | 0:17 | ★★★ | Ektaal (12 matras) | – |
| Dhamar (14 matras) | generated | Traditional (theka) | – (unpitched) | 14/4 | 90 | 0:19 | ★★★ | Dhamar (14 matras) | – |
| Tilwada (16 matras) | generated | Traditional (theka) | – (unpitched) | 16/4 | 72 | 0:27 | ★★★ | Tilwada (16 matras) | – |
| Chautal (12 matras) | generated | Traditional (theka) | – (unpitched) | 12/4 | 90 | 0:16 | ★★★ | Chautal (12 matras) | – |
| Deepchandi (14 matras) | generated | Traditional (theka) | – (unpitched) | 14/4 | 100 | 0:17 | ★★ | Deepchandi (14 matras) | – |

## Unverified (hidden)

Typed in from memory before round E. They stay in `tracks/unverified.json` and are never listed in the app.

| Track | Type | By |
|---|---|---|
| Twinkle Twinkle Little Star | melody | Traditional |
| Ode to Joy | melody | Ludwig van Beethoven (1824) |
| Jingle Bells (chorus) | melody | James Lord Pierpont (1857) |
| Amazing Grace | melody | Traditional (tune "New Britain") |
| Greensleeves | melody | Traditional (English, 16th century) |
| Frère Jacques | melody | Traditional (French) |
| Mary Had a Little Lamb | melody | Traditional (American, 1830s) |
| Happy Birthday | melody | Mildred and Patty Hill (1893) |
| London Bridge | melody | Traditional (English) |
| When the Saints Go Marching In | melody | Traditional (American spiritual) |
| Auld Lang Syne | melody | Traditional (Scottish) |
| Lullaby (Wiegenlied) | melody | Johannes Brahms (1868) |
| Minuet in G | melody | Christian Petzold (c. 1725, long credited to J. S. Bach) |
| Canon in D (simplified) | melody | Johann Pachelbel (c. 1690) |
| Für Elise (opening) | melody | Ludwig van Beethoven (1810) |
| In the Hall of the Mountain King | melody | Edvard Grieg (1875) |
| Can-Can (Galop infernal) | melody | Jacques Offenbach (1858) |
| The Blue Danube (theme) | melody | Johann Strauss II (1866) |
| Raghupati Raghav Raja Ram | melody | Traditional bhajan (tune popularised by V. D. Paluskar, d. 1931) |
| Vaishnav Jan To | melody | Narsinh Mehta (15th century), traditional tune |
| Chandamama Raave | melody | Traditional (Telugu lullaby) |
| Twinkle Twinkle Little Star | chords | Traditional |
| Ode to Joy | chords | Ludwig van Beethoven (1824) |
| Amazing Grace | chords | Traditional (tune "New Britain") |
| Auld Lang Syne | chords | Traditional (Scottish) |
| When the Saints Go Marching In | chords | Traditional (American spiritual) |
| Happy Birthday | chords | Mildred and Patty Hill (1893) |
| Canon in D (simplified) | chords | Johann Pachelbel (c. 1690) |
| Minuet in G | chords | Christian Petzold (c. 1725, long credited to J. S. Bach) |
| Raghupati Raghav Raja Ram | chords | Traditional bhajan (tune popularised by V. D. Paluskar, d. 1931) |
| Twinkle Twinkle Little Star | bass | Traditional |
| Ode to Joy | bass | Ludwig van Beethoven (1824) |
| Amazing Grace | bass | Traditional (tune "New Britain") |
| When the Saints Go Marching In | bass | Traditional (American spiritual) |
| Canon in D (simplified) | bass | Johann Pachelbel (c. 1690) |
| Jingle Bells (chorus) | bass | James Lord Pierpont (1857) |
| Auld Lang Syne | bass | Traditional (Scottish) |
| Minuet in G | bass | Christian Petzold (c. 1725, long credited to J. S. Bach) |

## Not found

No accurate source with a free licence was found for these, so they are left out:

- **Wagner: Bridal Chorus (Lohengrin)**: not in Mutopia or the other collections
- **Mary Had a Little Lamb**: no encoded score with a free licence in the sources this sandbox can reach (Mutopia, OpenEWLD, the Nottingham Music Database, PianoBooster's Booster Music, LaTeX for Musicians, the music21 corpus)
- **Row, Row, Row Your Boat**: no encoded score with a free licence in the sources this sandbox can reach (Mutopia, OpenEWLD, the Nottingham Music Database, PianoBooster's Booster Music, LaTeX for Musicians, the music21 corpus)
- **London Bridge**: no encoded score with a free licence in the sources this sandbox can reach (Mutopia, OpenEWLD, the Nottingham Music Database, PianoBooster's Booster Music, LaTeX for Musicians, the music21 corpus)
- **Old MacDonald**: no encoded score with a free licence in the sources this sandbox can reach (Mutopia, OpenEWLD, the Nottingham Music Database, PianoBooster's Booster Music, LaTeX for Musicians, the music21 corpus)
- **Itsy Bitsy Spider**: no encoded score with a free licence in the sources this sandbox can reach (Mutopia, OpenEWLD, the Nottingham Music Database, PianoBooster's Booster Music, LaTeX for Musicians, the music21 corpus)
- **Take Me Out to the Ball Game**: no encoded score with a free licence in the sources this sandbox can reach (Mutopia, OpenEWLD, the Nottingham Music Database, PianoBooster's Booster Music, LaTeX for Musicians, the music21 corpus)
- **The Blue Danube**: Mutopia's version is a recent arrangement (in C, not Strauss's D); nothing else found
- **Swan Lake (theme)**: Mutopia only has a 'Danse napolitaine' that is a recent arrangement
- **Habanera (Carmen)**: not in Mutopia (its Carmen Prelude does not compile and has no Habanera); nothing else found
- **Jana Gana Mana**: no encoded score with a stated free licence found
- **Vande Mataram**: no encoded score with a stated free licence found
- **Swing Low, Sweet Chariot**: no encoded score with a free licence in the sources this sandbox can reach (Mutopia, OpenEWLD, the Nottingham Music Database, PianoBooster's Booster Music, LaTeX for Musicians, the music21 corpus)
- **Jesu, Joy of Man's Desiring**: no BWV 147 in Mutopia; music21's Bach chorales carry no stated licence
- **Hungarian Dance No. 5**: not in Mutopia
- **Morning Mood (Peer Gynt)**: not in Mutopia
- **Can-Can (Galop infernal)**: not in Mutopia
- **William Tell Overture (finale)**: not in Mutopia
- **Raghupati Raghav Raja Ram**: no encoded score with a free licence found
- **Vaishnav Jan To**: no encoded score with a free licence found
- **Chandamama Raave**: no encoded score with a free licence found
