# player-hit

The player has taken damage.

Use for: Enemy hits, hazards, and immediate negative feedback.

## Sound design

An initial noise impact gives way to two dissonant falling oscillators. Amplitude modulation and soft saturation produce a rough, downward grunt that contrasts with the upward reward and healing sounds.

## Parameters and output

`duration` (0.15–1 seconds, default 0.38), `severity` (0–1, default 0.6), and integer `seed` (default 73).

All parameters are optional. `sampleRate` accepts integers from 22050 to 96000 (default 44100); `volume` accepts 0–1 (default 0.8). Seeds accept integers from 0 to 4294967295. Invalid or unknown parameters are rejected.

Mono, one shot. Repeatable seeded transient. Rendering returns `{ sampleRate, channelData: Float32Array[], loop }` with samples in [-1, 1]. Rendering never opens a speaker or writes files. Playback and 16-bit WAV encoding consume the same samples.

## Usage

```js
import audio from 'cyberia-audio';

const playback = await audio.sfx.play('player-hit');
await playback.done;
await audio.sfx.record('player-hit'); // records/player-hit.wav
```

```sh
cyberia-audio sfx player-hit
```
