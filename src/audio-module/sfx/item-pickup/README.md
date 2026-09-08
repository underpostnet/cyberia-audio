# item-pickup

An item landing in the inventory bar.

Use for: Every arrival into the player's inventory — loot flying in from the grid, a quest reward, a purchase, an assembly output.

## Sound design

A short blip sweeping up a fifth over a soft low body, so the gesture reads as gained rather than spent. Deliberately quieter and plainer than `coin`: this fires on every arrival, so it has to survive repetition, while `coin` stays the two-note reward gesture reserved for currency.

## Parameters and output

`duration` (0.1–0.6 seconds, default 0.24) and `pitch` (0.5–2, default 1).

All parameters are optional. `sampleRate` accepts integers from 22050 to 96000 (default 44100); `volume` accepts 0–1 (default 0.46). Invalid or unknown parameters are rejected. `volume` is the fraction of full scale the loudest sample reaches, so `1` is as loud as this render gets without clipping.

Mono, one short blip. Rendering returns `{ sampleRate, channelData: Float32Array[], loop }` with samples in [-1, 1]. Rendering never opens a speaker or writes files. Playback and 16-bit WAV encoding consume the same samples.

## Usage

```js
import audio from 'cyberia-audio';

const playback = await audio.sfx.play('item-pickup');
await playback.done;
await audio.sfx.record('item-pickup'); // records/item-pickup.wav
```

```sh
cyberia-audio sfx item-pickup
```
