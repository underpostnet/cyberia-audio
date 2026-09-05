# explosion

A large, chaotic release of energy.

Use for: Destruction, bombs, heavy collisions, and large impacts.

## Sound design

A broad noise burst collapses into low-pass filtered turbulence. A falling sub-bass oscillator and slowly moving rumble make the impact feel heavy; independently filtered stereo noise widens the debris tail.

## Parameters and output

`duration` (0.6–5 seconds, default 1.8), `weight` (0–1, default 0.8), and integer `seed` (default 90210).

All parameters are optional. `sampleRate` accepts integers from 22050 to 96000 (default 44100); `volume` accepts 0–1 (default 0.8). Seeds accept integers from 0 to 4294967295. Invalid or unknown parameters are rejected.

Stereo, one shot, with a fading rumble tail. Repeatable seeded noise. Rendering returns `{ sampleRate, channelData: Float32Array[], loop }` with samples in [-1, 1]. Rendering never opens a speaker or writes files. Playback and 16-bit WAV encoding consume the same samples.

## Usage

```js
import audio from 'cyberia-audio';

const playback = await audio.sfx.play('explosion');
await playback.done;
await audio.sfx.record('explosion'); // records/explosion.wav
```

```sh
cyberia-audio sfx explosion
```
