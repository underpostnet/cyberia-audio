# coin

A small reward or collectible pickup.

Use for: Coins, gems, score increments, and small positive events.

## Sound design

Two bright bell tones jump upward by a perfect fifth. A short pitch sweep and quickly decaying upper harmonics give the pickup a sparkling attack without a harsh sustained buzz.

## Parameters and output

`duration` (0.2–1 seconds, default 0.42) controls the ring; `pitch` (0.5–2, default 1) changes its register.

All parameters are optional. `sampleRate` accepts integers from 22050 to 96000 (default 44100); `volume` accepts 0–1 (default 0.8). Seeds accept integers from 0 to 4294967295. Invalid or unknown parameters are rejected.

Mono, one shot, with a short fade at both boundaries. Rendering returns `{ sampleRate, channelData: Float32Array[], loop }` with samples in [-1, 1]. Rendering never opens a speaker or writes files. Playback and 16-bit WAV encoding consume the same samples.

## Usage

```js
import audio from 'cyberia-audio';

const playback = await audio.sfx.play('coin');
await playback.done;
await audio.sfx.record('coin'); // records/coin.wav
```

```sh
cyberia-audio sfx coin
```
