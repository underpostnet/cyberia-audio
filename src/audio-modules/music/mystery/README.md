# mystery

A half-lit, watchful theme for hidden secrets.

Use for: Investigating a clue, sneaking through a dark area, or approaching the unknown.

## Sound design

A low bass heartbeat pulses under tremolo strings that move from A minor add9 to its tritone, E-flat major add9, then slip through F minor add9 to a dominant E7 flat-nine ready to circle home. A sliding, vibrato-laden voice poses the motifs while glassy celesta notes sparkle overhead and a soft filtered-air bed breathes across each phrase. The second cycle answers the first melody; dark low stabs anchor the end of each phrase.

## Parameters and output

`bpm` (60–140, default 90), `cycles` (1–3 four-bar phrases, default 2), `tension` (0–1, default 0.6), integer `seed` (default 2153). Default volume is 0.7.

All parameters are optional. `sampleRate` accepts integers from 22050 to 96000 (default 44100); `volume` accepts 0–1 (default 0.7). Seeds accept integers from 0 to 4294967295. Invalid or unknown parameters are rejected.

Stereo; duration is `cycles * 16 * 60 / bpm` seconds (about 21.33 by default). `loop: true` marks a phrase suitable for repetition; playback plays it once. Rendering returns `{ sampleRate, channelData: Float32Array[], loop }` with samples in [-1, 1]. Rendering never opens a speaker or writes files. Playback and 16-bit WAV encoding consume the same samples.

## Usage

```js
import audio from 'cyberia-audio';

const playback = await audio.music.play('mystery');
await playback.done;
await audio.music.record('mystery'); // records/mystery.wav
```

```sh
cyberia-audio music mystery
```