# exploration

An open, curious, safe place to explore.

Use for: Overworld traversal, calm discovery, and low-pressure puzzles.

## Sound design

A four-bar C major / A minor / F major / G suspended harmony supports soft stereo pads, sparse bell motifs, and a rounded bassline. Each second cycle answers the first melody. Density adds gentle offbeat arpeggios, while notes and echo tails wrap across the phrase boundary.

## Parameters and output

`bpm` (60–140, default 96), `cycles` (1–3 four-bar phrases, default 2), and `density` (0–1, default 0.45). Default volume is 0.32.

All parameters are optional. `sampleRate` accepts integers from 22050 to 96000 (default 44100); `volume` accepts 0–1 (default 0.32). Seeds accept integers from 0 to 4294967295. Invalid or unknown parameters are rejected. `volume` is the fraction of full scale the loudest sample reaches, so `1` is as loud as this render gets without clipping.

Stereo; duration is `cycles * 16 * 60 / bpm` seconds (20 by default). `loop: true` marks a phrase suitable for repetition; playback plays it once. Rendering returns `{ sampleRate, channelData: Float32Array[], loop }` with samples in [-1, 1]. Rendering never opens a speaker or writes files. Playback and 16-bit WAV encoding consume the same samples.

## Usage

```js
import audio from 'cyberia-audio';

const playback = await audio.music.play('exploration');
await playback.done;
await audio.music.record('exploration'); // records/exploration.wav
```

```sh
cyberia-audio music exploration
```
