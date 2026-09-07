# heal

Gentle restoration and recovery.

Use for: Health pickups, healing spells, and recovery confirmations.

## Sound design

Four sine voices swell through a major triad — D4, F#4, A4, D5 — each entering a little after the one below it, panned slightly apart. The attack is a squared exponential rise with no transient, the octave below each note supplies the body, and the one bright partial is gone before the swell peaks. It reads as a swell rather than a bell: the client sounds it only when an entity's life crosses back above zero or a quarter of its maximum, so it has to carry over a music bed without ever being sharp.

## Parameters and output

`duration` (0.8–3 seconds, default 1.5) and `warmth` (0–1, default 0.65), which trades the octave underneath against the brief upper partial.

All parameters are optional. `sampleRate` accepts integers from 22050 to 96000 (default 44100); `volume` accepts 0–1 (default 0.38). Seeds accept integers from 0 to 4294967295. Invalid or unknown parameters are rejected. `volume` is the fraction of full scale the loudest sample reaches, so `1` is as loud as this render gets without clipping.

Stereo, one shot, silent at both boundaries. Rendering returns `{ sampleRate, channelData: Float32Array[], loop }` with samples in [-1, 1]. Rendering never opens a speaker or writes files. Playback and 16-bit WAV encoding consume the same samples.

## Usage

```js
import audio from 'cyberia-audio';

const playback = await audio.sfx.play('heal');
await playback.done;
await audio.sfx.record('heal'); // records/heal.wav
```

```sh
cyberia-audio sfx heal
```
