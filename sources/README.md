# Sources

The encoded scores the verified songs are converted from, one folder a track. Each holds the score's LilyPond files
exactly as the [Mutopia Project](https://www.mutopiaproject.org) publishes them (from
https://github.com/MutopiaProject/MutopiaProject, at the commit named in `tools/sources.json`) and `<id>.mid`, the MIDI
file LilyPond renders from them (`tools/render-sources.py`). Each score's header carries its own licence: public
domain, Creative Commons Attribution (CC BY) or Attribution-ShareAlike (CC BY-SA). The typesetters and licences are
credited in TRACKS.md and in the app (Settings › Credits). These files are not part of the app and are never
downloaded by it; they are here so `tools/verify-tracks.mjs` can check every track against its score.
