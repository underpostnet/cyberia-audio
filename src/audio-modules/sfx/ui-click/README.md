# ui-click

A small, tactile interface confirmation.

Use for: Buttons, menu navigation, and toggles.

## Sound design

Three rapidly damped resonances simulate a small wooden or plastic tap. It has no melodic pitch rise and no reward-like ring.

## Parameters and output

`duration` (0.025–0.15 seconds, default 0.065) and `brightness` (0–1, default 0.45). Default volume is 0.37.

All parameters are optional. `sampleRate` accepts integers from 22050 to 96000 (default 44100); `volume` accepts 0–1 (default 0.37). Seeds accept integers from 0 to 4294967295. Invalid or unknown parameters are rejected. `volume` is the fraction of full scale the loudest sample reaches, so `1` is as loud as this render gets without clipping.

Mono, one short, dry tap. Rendering returns `{ sampleRate, channelData: Float32Array[], loop }` with samples in [-1, 1]. Rendering never opens a speaker or writes files. Playback and 16-bit WAV encoding consume the same samples.

## Usage

```js
import audio from 'cyberia-audio';

const playback = await audio.sfx.play('ui-click');
await playback.done;
await audio.sfx.record('ui-click'); // records/ui-click.wav
```

```sh
cyberia-audio sfx ui-click
```
