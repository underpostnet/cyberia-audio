# footsteps

One gait cycle — left foot, then right.

Use for: A walking loop, repeated for as long as anything in view is on the move

## Sound design

Two dull steps, the second landing on the opposite side and a little lighter so the pair never reads as a machine. Each is a noise burst run through a one-pole low pass, pressed in over a few milliseconds rather than snapped, with a short low sine underneath for weight and a fast scuff of brightness on top that is gone almost immediately. Written to be repeated: it is quiet by design, closer to ambience than to an event, because a walking scene plays it continuously.

## Parameters and output

`duration` (0.3–1.5 seconds, default 0.62) is the gait cycle, and the second step falls at its midpoint; `weight` (0–1, default 0.55) trades the dull body against the low thump; integer `seed` (default 4177). Default volume is 0.24.

All parameters are optional. `sampleRate` accepts integers from 22050 to 96000 (default 44100); `volume` accepts 0–1 (default 0.24). Seeds accept integers from 0 to 4294967295. Invalid or unknown parameters are rejected. `volume` is the fraction of full scale the loudest sample reaches, so `1` is as loud as this render gets without clipping.

Stereo, one shot, silent at both boundaries, so repeating it joins without a click. Rendering returns `{ sampleRate, channelData: Float32Array[], loop }` with samples in [-1, 1]. Rendering never opens a speaker or writes files. Playback and 16-bit WAV encoding consume the same samples.

## Usage

```js
import audio from 'cyberia-audio';

const playback = await audio.sfx.play('footsteps');
await playback.done;
await audio.sfx.record('footsteps'); // records/footsteps.wav
```

```sh
cyberia-audio sfx footsteps
```
