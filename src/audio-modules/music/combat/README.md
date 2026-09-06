# combat

Urgent, energetic conflict.

Use for: Encounters, combat arenas, and active danger.

## Sound design

A D minor bass ostinato drives syncopated sixteenth-note patterns under kick, snare, and high-hat percussion. E-flat accents add tension; a rising upper motif and a fourth-bar drum fill mark each phrase. Intensity adds subdivisions and stronger upper harmonics. Noise and pattern decisions are deterministic.

## Parameters and output

`bpm` (100–190, default 144), `rounds` (1–4 four-bar phrases, default 2), `intensity` (0–1, default 0.7), integer `seed` (default 841). Default volume is 0.85.

All parameters are optional. `sampleRate` accepts integers from 22050 to 96000 (default 44100); `volume` accepts 0–1 (default 0.85). Seeds accept integers from 0 to 4294967295. Invalid or unknown parameters are rejected. `volume` is the fraction of full scale the loudest sample reaches, so `1` is as loud as this render gets without clipping.

Stereo; duration is `rounds * 16 * 60 / bpm` seconds (about 13.33 by default). `loop: true` marks a repeatable phrase; playback plays it once. Rendering returns `{ sampleRate, channelData: Float32Array[], loop }` with samples in [-1, 1]. Rendering never opens a speaker or writes files. Playback and 16-bit WAV encoding consume the same samples.

## Usage

```js
import audio from 'cyberia-audio';

const playback = await audio.music.play('combat');
await playback.done;
await audio.music.record('combat'); // records/combat.wav
```

```sh
cyberia-audio music combat
```
