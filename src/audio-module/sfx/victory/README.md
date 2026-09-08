# victory

A celebration going off.

Use for: A quest completed, a reward granted, an objective closed out.

## Sound design

A three-hit drum flourish lands on the downbeat under a major triad rising into its octave, with a cloud of sparkles thrown upward and outward behind it — later grains higher and wider, each lifting a little as it decays, so the confetti spreads rather than arriving all at once.

The brightness is deliberately held back: every voice is a sine with one soft partial, attacks rise rather than step, and a low pass takes the edge off the whole burst. Celebratory, not sharp.

## Parameters and output

`duration` (0.8–2.5 seconds, default 1.5) and `sparkle` (0–32 grains, default 14) set the size of the burst. `seed` (0–4294967295, default 5310) fixes their scatter, so a render is reproducible.

All parameters are optional. `sampleRate` accepts integers from 22050 to 96000 (default 44100); `volume` accepts 0–1 (default 0.5). Invalid or unknown parameters are rejected. `volume` is the fraction of full scale the loudest sample reaches, so `1` is as loud as this render gets without clipping.

Stereo, one shot. Rendering returns `{ sampleRate, channelData: Float32Array[], loop }` with samples in [-1, 1]. Rendering never opens a speaker or writes files. Playback and 16-bit WAV encoding consume the same samples.

## Usage

```js
import audio from 'cyberia-audio';

const playback = await audio.sfx.play('victory');
await playback.done;
await audio.sfx.record('victory'); // records/victory.wav
```

```sh
cyberia-audio sfx victory
```
