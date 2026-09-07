# portal-cooldown

A charging bed for the seconds a portal takes to open.

Use for: Holding position on a portal while its teleport charge runs, or any short, interruptible wind-up the player has to wait out.

## Sound design

A snapped root-and-fifth drone hums under an ascending A-minor pluck run that climbs an octave and a half over each bar, one step per eighth note, so the charge audibly fills. A dry tick marks every beat as a countdown, two whines rise and close inside the bar, and a filtered-air bed breathes across the phrase. The phrase is written circularly and the drone is snapped to a whole number of periods per phrase, so repeating it while the charge runs is seamless.

## Parameters and output

`bpm` (60–180, default 128), `cycles` (1–8 one-bar phrases, default 2), `charge` (0–1 intensity, default 0.6), integer `seed` (default 7311). Default volume is 0.5.

All parameters are optional. `sampleRate` accepts integers from 22050 to 96000 (default 44100); `volume` accepts 0–1 (default 0.5). Seeds accept integers from 0 to 4294967295. Invalid or unknown parameters are rejected. `volume` is the fraction of full scale the loudest sample reaches, so `1` is as loud as this render gets without clipping.

Stereo; duration is `cycles * 4 * 60 / bpm` seconds (3.75 by default, sized to the default 3 s portal hold). `loop: true` marks a phrase suitable for repetition; playback plays it once. Rendering returns `{ sampleRate, channelData: Float32Array[], loop }` with samples in [-1, 1]. Rendering never opens a speaker or writes files. Playback and 16-bit WAV encoding consume the same samples.

## Usage

```js
import audio from 'cyberia-audio';

const playback = await audio.music.play('portal-cooldown');
await playback.done;
await audio.music.record('portal-cooldown'); // records/portal-cooldown.wav
```

```sh
cyberia-audio music portal-cooldown
```
