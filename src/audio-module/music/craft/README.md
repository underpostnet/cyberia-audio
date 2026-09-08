# craft

Matter being synthesised: energy drawn inward to form the object a recipe assembles.

Use for: The assembly progress bar in the client's notification modal. It is held for as long as the recipe charges and released when the bar completes, the same way `portal-cooldown` holds the bus while a teleport charge runs.

## Sound design

A containment field of sustained tones — root, fifth and a quiet high shimmer — holds the space. Inside it, each cycle is one intake: motes enter at the top of the spectrum and the edges of the stereo field, and their pitch, position and level all converge together, so the ear hears them pulled toward the centre rather than merely falling. They are gone by the moment a low bloom swells and settles in their place: the motes becoming mass.

The arrival sits at the middle of each cycle, away from the loop point, and every sustained voice is snapped to a whole number of periods per phrase, so the bed wraps without a seam.

## Parameters and output

`bpm` (60–160, default 96) and `cycles` (1–8 four-beat bars, default 2) set the phrase; at the defaults it is a five-second loop with two intakes. `particles` (0–48, default 14) is how many motes each intake draws in. `seed` (0–4294967295, default 8641) fixes their flight times and entry pitches, so a render is reproducible.

All parameters are optional. `sampleRate` accepts integers from 22050 to 96000 (default 44100); `volume` accepts 0–1 (default 0.55). Invalid or unknown parameters are rejected. `volume` is the fraction of full scale the loudest sample reaches, so `1` is as loud as this render gets without clipping.

Stereo, seamless loop. Rendering returns `{ sampleRate, channelData: Float32Array[], loop }` with samples in [-1, 1]. Rendering never opens a speaker or writes files. Playback and 16-bit WAV encoding consume the same samples.

## Usage

```js
import audio from 'cyberia-audio';

const playback = await audio.music.play('craft');
await playback.done;
await audio.music.record('craft'); // records/craft.wav
```

```sh
cyberia-audio music craft
```
