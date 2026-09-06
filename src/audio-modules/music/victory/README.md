# victory

A clear, celebratory success.

Use for: Winning a battle, completing a level, or achieving a major objective.

## Sound design

An ascending C major fanfare answers a short opening call. Independent brass-like voices, chordal accompaniment, bass, and pitched timpani lead from C through F and G to a sustained final C major chord. A bright bell doubles the final resolution. This is a composed four-bar cue with a cadence, not a repeating combat pattern.

## Parameters and output

`bpm` (90–160, default 120) and `brilliance` (0–1, default 0.7), controlling upper harmonics. Default volume is 0.57.

All parameters are optional. `sampleRate` accepts integers from 22050 to 96000 (default 44100); `volume` accepts 0–1 (default 0.57). Seeds accept integers from 0 to 4294967295. Invalid or unknown parameters are rejected. `volume` is the fraction of full scale the loudest sample reaches, so `1` is as loud as this render gets without clipping.

Stereo, one shot; four bars plus a 1.2-second release, or `16 * 60 / bpm + 1.2` seconds (9.2 by default). Rendering returns `{ sampleRate, channelData: Float32Array[], loop }` with samples in [-1, 1]. Rendering never opens a speaker or writes files. Playback and 16-bit WAV encoding consume the same samples.

## Usage

```js
import audio from 'cyberia-audio';

const playback = await audio.music.play('victory');
await playback.done;
await audio.music.record('victory'); // records/victory.wav
```

```sh
cyberia-audio music victory
```
