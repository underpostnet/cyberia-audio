# heal

Gentle restoration and recovery.

Use for: Health pickups, healing spells, and recovery confirmations.

## Sound design

Four overlapping bell voices ascend through a consonant major chord. Soft attacks, a warm lower voice, and quiet stereo echoes communicate recovery instead of a percussive reward.

## Parameters and output

`duration` (0.8–3 seconds, default 1.5) and `warmth` (0–1, default 0.65), which balances the lower voice and sparkle.

All parameters are optional. `sampleRate` accepts integers from 22050 to 96000 (default 44100); `volume` accepts 0–1 (default 0.34). Seeds accept integers from 0 to 4294967295. Invalid or unknown parameters are rejected. `volume` is the fraction of full scale the loudest sample reaches, so `1` is as loud as this render gets without clipping.

Stereo, one shot, including its echo tail. Rendering returns `{ sampleRate, channelData: Float32Array[], loop }` with samples in [-1, 1]. Rendering never opens a speaker or writes files. Playback and 16-bit WAV encoding consume the same samples.

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
