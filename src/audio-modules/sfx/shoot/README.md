# shoot

A sharp weapon discharge.

Use for: Rapid blaster fire and compact projectile weapons.

## Sound design

A high-pass noise transient supplies the sharp attack. A descending oscillator and a short filtered noise body add weight. Power changes the balance between the crack and the body.

## Parameters and output

`duration` (0.1–0.8 seconds, default 0.24), `power` (0–1, default 0.7), and integer `seed` (default 193).

All parameters are optional. `sampleRate` accepts integers from 22050 to 96000 (default 44100); `volume` accepts 0–1 (default 0.8). Seeds accept integers from 0 to 4294967295. Invalid or unknown parameters are rejected.

Mono, one shot. Noise is repeatable for the same seed. Rendering returns `{ sampleRate, channelData: Float32Array[], loop }` with samples in [-1, 1]. Rendering never opens a speaker or writes files. Playback and 16-bit WAV encoding consume the same samples.

## Usage

```js
import audio from 'cyberia-audio';

const playback = await audio.sfx.play('shoot');
await playback.done;
await audio.sfx.record('shoot'); // records/shoot.wav
```

```sh
cyberia-audio sfx shoot
```
