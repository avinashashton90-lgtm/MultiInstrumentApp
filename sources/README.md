# Sources

The encoded scores the verified songs are converted from, one folder a track. Each holds the score exactly as its
collection publishes it and `<id>.mid`, the MIDI file rendered from it by `tools/render-sources.py`:

- LilyPond files from the [Mutopia Project](https://www.mutopiaproject.org) (https://github.com/MutopiaProject/MutopiaProject,
  at the commit named in `tools/sources.json`), rendered with LilyPond. Each score's header carries its own licence.
- ABC and MusicXML files from the other collections named in `tools/sources.json` (`origins`): OpenEWLD, the Nottingham
  Music Database, PianoBooster's Booster Music, Guido Gonzato's LaTeX for Musicians and the music21 corpus. ABC is
  rendered with abc2midi, MusicXML with music21. Where an ABC file holds many tunes, only the one used is kept, cut out
  unchanged. Each folder's `SOURCE.md` names the file, its commit or package version, and its licence.

Licences are public domain, Creative Commons Attribution (CC BY) or Attribution-ShareAlike (CC BY-SA), the GNU General
Public License 3.0 or the GNU Free Documentation License 1.3; the two GNU licence texts are in `LICENSES/`. Only the
melodies are used, never lyrics. The typesetters and licences are credited in TRACKS.md and in the app (Settings ›
Credits). These files are not part of the app and are never downloaded by it; they are here so
`tools/verify-tracks.mjs` can check every track against its score.
