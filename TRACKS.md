# Songs: the track library

Every track the Songs button offers, where it comes from and how it was checked. Round E replaced the songs that had
been typed in from memory with tracks converted from encoded scores, and hid the rest.

**Status.** `verified`: converted from an encoded score (a LilyPond file from the [Mutopia Project](https://www.mutopiaproject.org),
rendered to MIDI) by `tools/midi-to-track.mjs`, then checked by `tools/verify-tracks.mjs`: every note against the source MIDI
(pitch exact, onset within a 16th of a beat), and an offline render of the track whose pitches are detected again and
compared. `generated`: built from a definition in `tools/make-tracks.mjs` (a raag's aroha and avaroha, the alankar
exercise, a taal's theka, a drum groove, or a tune written for Pocket Band), so the definition is the track.
`unverified`: typed in from memory; kept in `tracks/unverified.json` but hidden from the song picker.

**Licences.** Only public domain, CC BY and CC BY-SA scores are used; `tools/render-sources.py` reads each score's own
licence line and stops on anything else. CC BY and CC BY-SA scores are credited here and in the app (Settings → Credits).
The track data converted from a CC BY-SA score is shared under the same licence.

**Rebuilding.** `python3 tools/render-sources.py <Mutopia checkout>` copies the scores into `sources/` and renders their MIDI;
`node tools/make-tracks.mjs` converts them and writes `tracks/*.json` and this file; `node tools/verify-tracks.mjs` checks
every verified track (the build fails if a track and its source disagree).

**Easy and Full.** Every verified melody carries the score's own bass line (`low`) and the chords its harmony spells
(`chords`). Easy is the melody alone; Full adds the bass line, as notes to play on the keyboards and as backing elsewhere.
Sections (`sections`, 4 to 8 bars) end where the tune breathes.

**Format.** Each track: `id`, `type`, `title`, `by`, `src` (the licence), `status`, `tempo` (quarter notes a minute), `time`,
`key`, `tonic` (pitch class), `mode`, `level` (1-3), `tags`, `bars`, `sections`, `inst` (the melodic instruments that offer it),
and by type: `notes` `[startBeat, beats, midi, velocity]`, `low` (bass line, same form), `chords` (one string a bar),
`strum`, `hits`, `bols`, `tune`. Verified tracks add `credit` (composer, death year, licence, source, URL, conversion
date) and `from` (the source MIDI file, its parts and the beat the track starts at, for the verifier).

## Verified tracks and their sources

Converted on 2026-10-13 from Mutopia (https://github.com/MutopiaProject/MutopiaProject, commit 2144afd6f5).

| Track | Composer | Died | Excerpt | Licence | Source | Tempo |
|---|---|---|---|---|---|---|
| Twinkle Twinkle Little Star | Wolfgang Amadeus Mozart (theme: traditional) | 1791 | Theme ("Allegro (Thema)", No. 9 of the edition), guitar 1 | Public domain | [Mutopia 2236](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2236) | from the score |
| Greensleeves | Traditional | – | Soprano, bars 1-16 | Public domain | [Mutopia 1247](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1247) | set (the score has no tempo marking) |
| Amazing Grace | Anonymous (American hymn tune) | – | Soprano, whole hymn | Public domain | [Mutopia 1283](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1283) | set (the score has no tempo marking) |
| Silent Night (Stille Nacht) | Franz Xaver Gruber | 1863 | Soprano, whole hymn | Public domain | [Mutopia 1295](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1295) | set (the score has no tempo marking) |
| Joy to the World | Lowell Mason, after Handel | 1872 | Soprano, whole hymn | Public domain | [Mutopia 1223](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1223) | set (the score has no tempo marking) |
| Auld Lang Syne | Felix Horetzky (arranger; tune traditional) | 1870 | Top voice, bars 1-16 | Public domain | [Mutopia 1121](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1121) | from the score |
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

## Melodies (every melodic instrument)

| Track | Status | By | Key | Time | Tempo | Length | Level | Instruments | First 16 notes |
|---|---|---|---|---|---|---|---|---|---|
| Twinkle Twinkle Little Star | verified | Traditional French air (1761), as set by W. A. Mozart (K. 265) | C Major | 2/4 | 108 | 0:27 | ★ | Piano, Flute, Harmonica, Horn, Xylophone, Viola, Cello | C4 C4 G4 G4 A4 A4 G4 G4 F4 F4 E4 E4 D4 D4 E4 C4 |
| Greensleeves | verified | Traditional (English, 16th century) | E Natural minor | 6/8 | 90 | 0:34 | ★★ | Piano, Horn, Trumpet, Cello | E4 G4 A4 B4 C5 B4 A4 F♯4 D4 E4 F♯4 G4 E4 E4 D♯4 E4 |
| Amazing Grace | verified | Tune "New Britain" (Virginia Harmony, 1831) | G Major | 3/4 | 84 | 0:34 | ★ | Piano, Organ, Harmonica, Trumpet, Cello | D4 G4 B4 G4 B4 A4 G4 E4 D4 D4 G4 B4 G4 B4 A4 D5 |
| Silent Night (Stille Nacht) | verified | Franz Xaver Gruber (1818) | B♭ Major | 6/8 | 90 | 0:24 | ★ | Piano, Organ, Trumpet, Sax | F4 G4 F4 D4 F4 G4 F4 D4 C5 C5 A4 B♭4 B♭4 F4 G4 G4 |
| Joy to the World | verified | Tune "Antioch", arranged by Lowell Mason (1839) from G. F. Handel | D Major | 2/4 | 100 | 0:23 | ★ | Organ, Synth, Sax | D5 C♯5 B4 A4 G4 F♯4 E4 D4 A4 B4 B4 C♯5 C♯5 D5 D5 D5 |
| Auld Lang Syne | verified | Traditional (Scottish), guitar setting by Felix Horetzky | D Major | 2/4 | 72 | 0:28 | ★ | Organ, Synth, Sax, Xylophone | A4 D5 D5 D5 F♯5 E5 D5 E5 F♯5 D5 D5 F♯5 A5 B5 D6 A5 |
| Ode to Joy | verified | Ludwig van Beethoven (Symphony No. 9, 1824), hymn setting | G Major | 4/4 | 100 | 0:38 | ★ | Piano, Flute, Sax, Viola | B4 B4 C5 D5 D5 C5 A4 B4 A4 G4 G4 A4 B4 B4 A4 A4 |
| Für Elise (opening) | verified | Ludwig van Beethoven (WoO 59, 1810) | A Natural minor | 3/8 | 72 | 0:11 | ★★★ | Piano, Viola, Cello | E5 D♯5 E5 D♯5 E5 B4 D5 C5 A4 C4 E4 A4 B4 E4 G♯4 B4 |
| Moonlight Sonata (opening) | verified | Ludwig van Beethoven (Op. 27 No. 2, 1801) | E Major | 2/2 | 54 | 0:40 | ★★ | Organ, Viola, Cello | G♯4 G♯4 G♯4 G♯4 G♯4 G♯4 A4 G♯4 F♯4 B4 E4 G4 G4 G4 G4 G4 |
| Canon in D | verified | Johann Pachelbel (c. 1690) | D Major | 4/4 | 55 | 0:35 | ★ | Organ, Cello | F♯5 E5 D5 C♯5 B4 A4 B4 C♯5 D5 C♯5 B4 A4 G4 F♯4 G4 E4 |
| Eine kleine Nachtmusik (theme) | verified | Wolfgang Amadeus Mozart (K. 525, 1787) | G Major | 4/4 | 132 | 0:15 | ★★ | Organ, Synth | G5 D5 G5 D5 G5 D5 G5 B5 D6 C6 A5 C6 A5 C6 A5 F♯5 |
| Turkish March (Rondo alla turca) | verified | Wolfgang Amadeus Mozart (K. 331, 1783) | A Natural minor | 2/4 | 120 | 0:09 | ★★★ | Piano, Organ, Synth | B4 A4 G♯4 A4 C5 D5 C5 B4 C5 E5 F5 E5 D♯5 E5 B5 A5 |
| Minuet in G | verified | Christian Petzold (c. 1725, BWV Anh. 114, long credited to J. S. Bach) | G Major | 3/4 | 140 | 0:21 | ★★ | Synth, Cello | D5 G4 A4 B4 C5 D5 G4 G4 E5 C5 D5 E5 F♯5 G5 G4 G4 |
| Minuet in G minor | verified | Christian Petzold (c. 1725, BWV Anh. 115) | G Natural minor | 3/4 | 140 | 0:21 | ★★ | Synth | B♭5 A5 G5 A5 D5 D5 G5 G4 A4 B♭4 C5 D5 E♭5 F5 E♭5 D5 |
| Musette in D | verified | Anna Magdalena Bach notebook (BWV Anh. 126, c. 1725) | D Major | 2/4 | 120 | 0:12 | ★★ | Synth, Flute | A5 G5 F♯5 E5 D5 A5 G5 F♯5 E5 D5 F♯4 G4 A4 G4 F♯4 E4 |
| Air on the G String | verified | Johann Sebastian Bach (Suite No. 3, BWV 1068) | A Major | 4/4 | 30 | 0:48 | ★★★ | Xylophone, Violin | F♯5 B5 G5 F♯5 E5 D5 C♯5 D5 C♯5 B4 A4 A5 F♯5 C5 B4 E5 |
| Spring (The Four Seasons) | verified | Antonio Vivaldi (Op. 8 No. 1, 1725) | E Major | 4/4 | 115 | 0:15 | ★★ | Flute, Violin | E5 G♯5 G♯5 G♯5 F♯5 E5 B5 B5 A5 G♯5 G♯5 G♯5 F♯5 E5 B5 B5 |
| Brahms' Lullaby (Wiegenlied) | verified | Johannes Brahms (Op. 49 No. 4, 1868) | E♭ Major | 3/4 | 72 | 0:43 | ★ | Piano, Flute | G4 G4 B♭4 G4 G4 B♭4 G4 B♭4 E♭5 D5 C5 C5 B♭4 F4 G4 A♭4 |
| In the Hall of the Mountain King | verified | Edvard Grieg (Peer Gynt, Op. 46 No. 4, 1875), Grieg's piano version | B Natural minor | 4/4 | 138 | 0:14 | ★★ | Flute, Cello | B1 C♯2 D2 E2 F♯2 D2 F♯2 F2 C♯2 F2 E2 C2 E2 B1 C♯2 D2 |
| Symphony No. 5 (opening) | verified | Ludwig van Beethoven (Op. 67, 1808) | C Natural minor | 2/4 | 192 | 0:13 | ★★ | Horn | G4 G4 G4 E♭4 F4 F4 F4 D4 G4 G4 G4 E♭4 A♭4 A♭4 A♭4 G4 |
| O Come, All Ye Faithful (Adeste Fideles) | verified | John Francis Wade (c. 1743) | G Major | 4/4 | 100 | 0:50 | ★ | Synth, Flute, Xylophone | G4 G4 D4 G4 A4 D4 B4 A4 B4 C5 B4 A4 G4 G4 C♯4 F♯4 |
| Good King Wenceslas | verified | Traditional (Piae Cantiones, 1582) | A Major | 4/4 | 120 | 0:34 | ★ | Flute, Violin | A4 A4 A4 B4 A4 A4 E4 F♯4 E4 F♯4 G♯4 A4 A4 A4 A4 A4 |
| The First Noel | verified | Traditional English carol (published 1833) | D Major | 3/4 | 100 | 0:45 | ★ | Harmonica, Violin | F♯4 E4 D4 E4 F♯4 G4 A4 B4 C♯5 D5 C♯5 B4 A4 B4 C♯5 D5 |
| The Holly and the Ivy | verified | Traditional English carol | F Major | 3/4 | 120 | 0:26 | ★ | Horn, Violin, Viola | F4 F4 F4 F4 D5 C5 A4 F4 F4 F4 F4 D5 C5 C5 B♭4 A4 |
| Home! Sweet Home! | verified | Henry Rowley Bishop (1823) | F Major | 4/4 | 90 | 0:45 | ★ | Harmonica, Horn, Viola | F4 G4 A4 B♭4 B♭4 C5 C5 A4 A4 C5 B♭4 A4 B♭4 G4 A4 F4 |
| Gymnopédie No. 1 | verified | Erik Satie (1888) | D Major | 3/4 | 72 | 0:10 | ★ | Horn | F♯5 A5 G5 F♯5 C♯5 B4 C♯5 D5 A4 F♯4 |
| Sonata facile (opening) | verified | Wolfgang Amadeus Mozart (K. 545, 1788) | C Major | 4/4 | 132 | 0:07 | ★★ | Harmonica, Horn, Trumpet | C5 E5 G5 B4 C5 D5 C5 A5 G5 C6 G5 F5 E5 F5 E5 |
| Piano Sonata in A (theme) | verified | Wolfgang Amadeus Mozart (K. 331, 1783) | A Major | 6/8 | 56 | 0:26 | ★★ | Harmonica, Horn, Trumpet, Xylophone | C♯5 D5 C♯5 E5 E5 B4 C♯5 B4 D5 D5 A4 A4 B4 B4 C♯5 E5 |
| The Happy Farmer | verified | Robert Schumann (Album for the Young, Op. 68 No. 10, 1848) | F Major | 4/4 | 100 | 0:22 | ★ | Harmonica, Trumpet, Xylophone | C3 F3 A3 C4 F3 B♭3 D4 F4 D4 C4 A3 B♭3 G3 C3 B♭3 A3 |
| Soldiers' March | verified | Robert Schumann (Album for the Young, Op. 68 No. 2, 1848) | G Major | 2/4 | 120 | 0:08 | ★ | Harmonica, Trumpet, Sax, Xylophone, Violin | B4 C5 D5 E5 D5 C5 B4 A4 G4 B4 C5 D5 E5 D5 G5 F♯5 |
| March of the Wooden Soldiers | verified | Pyotr Ilyich Tchaikovsky (Album for the Young, Op. 39 No. 5, 1878) | D Major | 2/4 | 140 | 0:14 | ★★ | Trumpet, Sax, Xylophone, Violin | D5 D5 B4 A♯4 B4 C♯5 D5 D5 B4 A♯4 B4 C♯5 D5 E5 F♯5 F♯5 |
| Waltz in A flat | verified | Johannes Brahms (Op. 39 No. 15, 1865) | A♭ Major | 3/4 | 116 | 0:25 | ★★ | Sax, Viola | C5 A♭4 A♭4 C5 C5 A♭4 A♭4 C5 D♭5 E♭5 D♭5 C5 B♭4 C5 A♭4 A♭4 |
| Sa Re Ga Ma alankar (paltas) | generated | Traditional exercise | C Bilawal | 3/4 | 80 | 0:29 | ★ | Piano, Harmonica, Horn, Viola | C4 D4 E4 D4 E4 F4 E4 F4 G4 F4 G4 A4 G4 A4 B4 A4 |
| Bilawal: aroha and avaroha | generated | Traditional exercise | C Bilawal | 4/4 | 80 | 0:12 | ★ | Flute, Xylophone | C4 D4 E4 F4 G4 A4 B4 C5 C5 B4 A4 G4 F4 E4 D4 C4 |
| Bhoopali: aroha and avaroha | generated | Traditional exercise | C Bhoopali | 4/4 | 80 | 0:12 | ★ | Organ, Trumpet, Cello | C4 D4 E4 G4 A4 C5 C5 A4 G4 E4 D4 C4 |
| Yaman: aroha and avaroha | generated | Traditional exercise | C Yaman | 4/4 | 76 | 0:13 | ★★ | Sax, Violin | B3 D4 E4 F♯4 A4 B4 C5 C5 B4 A4 G4 F♯4 E4 D4 C4 |
| Sunny Steps | generated | Pocket Band (original) | C Major | 4/4 | 100 | 0:19 | ★ | Piano, Synth, Trumpet, Xylophone, Viola | C4 D4 E4 C4 E4 F4 G4 G4 A4 G4 F4 E4 C4 D4 D4 E4 |
| Five Finger March | generated | Pocket Band (original) | C Major | 4/4 | 96 | 0:20 | ★ | Violin | C4 E4 G4 E4 F4 D4 E4 E4 G4 F4 D4 E4 C4 G4 F4 E4 |
| Little Waltz | generated | Pocket Band (original) | G Major | 3/4 | 120 | 0:24 | ★ | Organ, Flute, Harmonica, Horn, Sax, Violin, Cello | G4 B4 D5 B4 A4 F♯4 G4 E4 G4 B4 G4 A4 B4 A4 D4 G4 |
| Rainy Day Blues | generated | Pocket Band (original) | A Blues | 4/4 | 92 | 0:21 | ★★ | Viola | A4 C5 A4 D5 D♯5 E5 C5 A4 A4 C5 A4 D5 E5 G5 E5 D5 |
| Morning Walk in Bhoopali | generated | Pocket Band (original) | C Bhoopali | 4/4 | 88 | 0:22 | ★ | Synth, Sax | C4 D4 E4 D4 E4 G4 A4 G4 E4 G4 D4 E4 G4 A4 C5 A4 |

## Chord songs (guitar and rhythm guitar)

| Track | Status | By | Key | Time | Tempo | Length | Level | First 16 notes |
|---|---|---|---|---|---|---|---|---|
| Twinkle Twinkle Little Star | verified | Traditional French air (1761), as set by W. A. Mozart (K. 265) | C Major | 2/4 | 108 | 0:27 | ★ | C4 C4 G4 G4 A4 A4 G4 G4 F4 F4 E4 E4 D4 D4 E4 C4 |
| Amazing Grace | verified | Tune "New Britain" (Virginia Harmony, 1831) | G Major | 3/4 | 84 | 0:34 | ★ | D4 G4 B4 G4 B4 A4 G4 E4 D4 D4 G4 B4 G4 B4 A4 D5 |
| Silent Night (Stille Nacht) | verified | Franz Xaver Gruber (1818) | B♭ Major | 6/8 | 90 | 0:24 | ★ | F4 G4 F4 D4 F4 G4 F4 D4 C5 C5 A4 B♭4 B♭4 F4 G4 G4 |
| Joy to the World | verified | Tune "Antioch", arranged by Lowell Mason (1839) from G. F. Handel | D Major | 2/4 | 100 | 0:23 | ★ | D5 C♯5 B4 A4 G4 F♯4 E4 D4 A4 B4 B4 C♯5 C♯5 D5 D5 D5 |
| Ode to Joy | verified | Ludwig van Beethoven (Symphony No. 9, 1824), hymn setting | G Major | 4/4 | 100 | 0:38 | ★ | B4 B4 C5 D5 D5 C5 A4 B4 A4 G4 G4 A4 B4 B4 A4 A4 |
| Canon in D | verified | Johann Pachelbel (c. 1690) | D Major | 4/4 | 55 | 0:35 | ★ | F♯5 E5 D5 C♯5 B4 A4 B4 C♯5 D5 C♯5 B4 A4 G4 F♯4 G4 E4 |
| O Come, All Ye Faithful (Adeste Fideles) | verified | John Francis Wade (c. 1743) | G Major | 4/4 | 100 | 0:50 | ★ | G4 G4 D4 G4 A4 D4 B4 A4 B4 C5 B4 A4 G4 G4 C♯4 F♯4 |
| Good King Wenceslas | verified | Traditional (Piae Cantiones, 1582) | A Major | 4/4 | 120 | 0:34 | ★ | A4 A4 A4 B4 A4 A4 E4 F♯4 E4 F♯4 G♯4 A4 A4 A4 A4 A4 |
| The First Noel | verified | Traditional English carol (published 1833) | D Major | 3/4 | 100 | 0:45 | ★ | F♯4 E4 D4 E4 F♯4 G4 A4 B4 C♯5 D5 C♯5 B4 A4 B4 C♯5 D5 |
| Rainy Day Blues | generated | Pocket Band (original) | A Blues | 4/4 | 92 | 0:21 | ★★ | A4 C5 A4 D5 D♯5 E5 C5 A4 A4 C5 A4 D5 E5 G5 E5 D5 |

## Bass lines (electric bass)

| Track | Status | By | Key | Time | Tempo | Length | Level | First 16 notes |
|---|---|---|---|---|---|---|---|---|
| Twinkle Twinkle Little Star | verified | Traditional French air (1761), as set by W. A. Mozart (K. 265) | C Major | 2/4 | 108 | 0:27 | ★ | E3 C3 E3 C3 F3 C3 E3 C3 D3 B2 C3 A2 F2 G2 C3 E3 |
| Amazing Grace | verified | Tune "New Britain" (Virginia Harmony, 1831) | G Major | 3/4 | 84 | 0:34 | ★ | G2 G2 G2 B2 D3 D3 E3 C3 G2 G2 G2 G2 B2 D3 C3 B2 |
| Silent Night (Stille Nacht) | verified | Franz Xaver Gruber (1818) | B♭ Major | 6/8 | 90 | 0:24 | ★ | B♭2 B♭2 B♭2 B♭2 B♭2 B♭2 F3 F3 F3 B♭2 B♭2 B♭2 E♭3 E♭3 E♭3 E♭3 |
| Joy to the World | verified | Tune "Antioch", arranged by Lowell Mason (1839) from G. F. Handel | D Major | 2/4 | 100 | 0:23 | ★ | D3 D3 D3 D3 G2 A2 A2 D3 F♯3 G3 G3 A3 A3 D3 D3 D3 |
| Ode to Joy | verified | Ludwig van Beethoven (Symphony No. 9, 1824), hymn setting | G Major | 4/4 | 100 | 0:38 | ★ | G3 G3 G3 G3 E3 F♯3 G3 D3 B3 B3 A3 G3 D3 D3 D3 G3 |
| Canon in D | verified | Johann Pachelbel (c. 1690) | D Major | 4/4 | 55 | 0:35 | ★ | D3 A2 B2 F♯2 G2 D2 G2 A2 D3 A2 B2 F♯2 G2 D2 G2 A2 |
| O Come, All Ye Faithful (Adeste Fideles) | verified | John Francis Wade (c. 1743) | G Major | 4/4 | 100 | 0:50 | ★ | G3 G3 B3 G3 F♯3 F♯3 G3 F♯3 G3 C3 D3 D3 E3 E3 D3 A2 |
| The First Noel | verified | Traditional English carol (published 1833) | D Major | 3/4 | 100 | 0:45 | ★ | D3 G3 D3 B2 A2 A3 G3 F♯3 F♯3 G3 C♯4 D3 G3 G3 F♯3 D3 |
| Rainy Day Blues | generated | Pocket Band (original) | A Blues | 4/4 | 92 | 0:21 | ★★ | A1 A1 E2 A2 A1 A1 E2 A2 A1 A1 E2 A2 A1 A1 E2 A2 |
| Sunny Steps | generated | Pocket Band (original) | C Major | 4/4 | 100 | 0:19 | ★★ | C2 C2 C2 C2 C2 C2 C2 C2 C2 C2 C2 C2 C2 C2 C2 C2 |

## Drum grooves (drums and electric drum pad)

| Track | Status | By | Key | Time | Tempo | Length | Level | First 16 notes |
|---|---|---|---|---|---|---|---|---|
| Rock beat | generated | Pocket Band (original) | – (unpitched) | 4/4 | 100 | 0:10 | ★ | – |
| Disco | generated | Pocket Band (original) | – (unpitched) | 4/4 | 116 | 0:08 | ★ | – |
| Hip hop | generated | Pocket Band (original) | – (unpitched) | 4/4 | 90 | 0:11 | ★★ | – |
| Bossa nova | generated | Pocket Band (original) | – (unpitched) | 4/4 | 120 | 0:08 | ★★★ | – |
| Reggae one drop | generated | Pocket Band (original) | – (unpitched) | 4/4 | 76 | 0:13 | ★★ | – |
| House | generated | Pocket Band (original) | – (unpitched) | 4/4 | 122 | 0:08 | ★ | – |
| Shuffle | generated | Pocket Band (original) | – (unpitched) | 4/4 | 96 | 0:10 | ★★ | – |
| Funk | generated | Pocket Band (original) | – (unpitched) | 4/4 | 100 | 0:10 | ★★★ | – |
| Slow ballad | generated | Pocket Band (original) | – (unpitched) | 4/4 | 70 | 0:14 | ★ | – |
| March | generated | Pocket Band (original) | – (unpitched) | 4/4 | 112 | 0:09 | ★★ | – |

## Taals (tabla, dual and single)

| Track | Status | By | Key | Time | Tempo | Length | Level | First 16 notes |
|---|---|---|---|---|---|---|---|---|
| Teental (16 matras) | generated | Traditional (theka) | – (unpitched) | 16/4 | 100 | 0:19 | ★ | – |
| Keherwa (8 matras) | generated | Traditional (theka) | – (unpitched) | 8/4 | 110 | 0:09 | ★ | – |
| Dadra (6 matras) | generated | Traditional (theka) | – (unpitched) | 6/4 | 120 | 0:06 | ★ | – |
| Rupak (7 matras) | generated | Traditional (theka) | – (unpitched) | 7/4 | 100 | 0:08 | ★★ | – |
| Jhaptal (10 matras) | generated | Traditional (theka) | – (unpitched) | 10/4 | 100 | 0:12 | ★★ | – |
| Ektaal (12 matras) | generated | Traditional (theka) | – (unpitched) | 12/4 | 84 | 0:17 | ★★★ | – |
| Dhamar (14 matras) | generated | Traditional (theka) | – (unpitched) | 14/4 | 90 | 0:19 | ★★★ | – |
| Tilwada (16 matras) | generated | Traditional (theka) | – (unpitched) | 16/4 | 72 | 0:27 | ★★★ | – |
| Chautal (12 matras) | generated | Traditional (theka) | – (unpitched) | 12/4 | 90 | 0:16 | ★★★ | – |
| Deepchandi (14 matras) | generated | Traditional (theka) | – (unpitched) | 14/4 | 100 | 0:17 | ★★ | – |

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

- **Mary Had a Little Lamb**: no encoded score with a free licence in the sources this sandbox can reach (Mutopia, music21's corpus with a stated licence)
- **Jingle Bells**: as above
- **Happy Birthday**: as above
- **Frère Jacques**: as above
- **London Bridge**: as above
- **Row, Row, Row Your Boat**: as above
- **Old MacDonald**: as above
- **Scarborough Fair**: as above
- **When the Saints Go Marching In**: as above
- **Oh! Susanna**: as above
- **Danny Boy (Londonderry Air)**: as above
- **Swing Low, Sweet Chariot**: as above
- **We Wish You a Merry Christmas**: as above
- **Jesu, Joy of Man's Desiring**: no BWV 147 in Mutopia; music21's Bach chorales carry no stated licence
- **Swan Lake (theme)**: Mutopia only has a 'Danse napolitaine' that is a recent arrangement
- **Hungarian Dance No. 5**: not in Mutopia
- **The Blue Danube**: Mutopia's version is a recent arrangement (in C, not Strauss's D)
- **Morning Mood (Peer Gynt)**: not in Mutopia
- **Can-Can (Galop infernal)**: not in Mutopia
- **William Tell Overture (finale)**: not in Mutopia
- **Habanera (Carmen)**: not in Mutopia (its Carmen Prelude does not compile and has no Habanera)
- **Raghupati Raghav Raja Ram**: no encoded score with a free licence found
- **Vaishnav Jan To**: no encoded score with a free licence found
- **Chandamama Raave**: no encoded score with a free licence found
