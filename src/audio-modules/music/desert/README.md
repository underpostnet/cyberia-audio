# desert-pulse

A pulsating, evolving desert-synth music loop

Use for: creating a sense of driving, desolate motion through a futuristic desert landscape.

## Sound design

A driving four-on-the-floor beat, delivered by a kick and tight snare, anchors the rhythm. A deep, resonant sub-bass provides a pulsating foundation, while a shimmering, evolving pad creates an expansive harmonic texture. A dry, percussive filtered synth arpeggio cuts through the mix, occasionally joined by a metallic, twangy, pitch-bent lead synth that evokes a desolate, futuristic soundscape.

## Parameters and output

`intensity` (0–1, default 0.5) controls the overall energy and prominence of musical elements; `grittiness` (0–1, default 0.3) adjusts the harshness and distortion of the sounds; `desolation` (0–1, default 0.7) influences the spaciousness and emptiness of the soundscape; `pulseSpeed` (0.5–2, default 1) determines the tempo or rate of the pulsating rhythm; `seed` (0–4294967295, integer, default 0) initializes random number generators for procedural sound variations.

All parameters are optional. `sampleRate` accepts integers from 22050 to 96000 (default 44100); `volume` accepts 0–1 (default 0.8). Seeds accept integers from 0 to 4294967295. Invalid or unknown parameters are rejected.

Stereo; duration is about 20.00 seconds by default. `loop: true` marks a phrase suitable for repetition; playback plays it once. Rendering returns `{ sampleRate, channelData: Float32Array[], loop }` with samples in [-1, 1]. Rendering never opens a speaker or writes files. Playback and 16-bit WAV encoding consume the same samples.

## Usage

```js
import audio from 'cyberia-audio';

const playback = await audio.music.play('desert-pulse');
await playback.done;
await audio.music.record('desert-pulse'); // records/desert-pulse.wav
```

```sh
cyberia-audio music desert-pulse
```
