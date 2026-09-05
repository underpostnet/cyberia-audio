**cyberia-audio is a semantic, event-driven procedural audio engine for game developers who are not musicians.**

Describe the game event. The asset owns the sound.

```js
import audio from "cyberia-audio";

audio.sfx.play("coin");
audio.music.play("combat");
```

## Try it

Requires Node.js 24 or newer. From this checkout:

```sh
npm ci
npm start -- sfx coin
npm start -- music exploration

# Render and record without opening an audio device:
npm start -- music combat
```

After installing the package, its executable is `cyberia-audio`:

```sh
cyberia-audio sfx explosion
cyberia-audio music victory
cyberia-audio sfx coin --volume 0.5
cyberia-audio sfx coin --volume 0.5 --play
```

The CLI has two domains: `sfx <id>` and `music <id>`. Every valid command writes a 16-bit PCM WAV to `records/<id>.wav` in the **current working directory** and exits after recording by default. Pass `--play` to play the generated sound after the WAV is saved. Repeating a command overwrites that file. Recording finishes before playback starts, so a device failure leaves the WAV available. Invalid IDs list the available assets and exit with status 1. Ctrl-C stops active playback.

## Vocabulary

| Domain | ID                                                           | Communicates                                 | Default duration |
| ------ | ------------------------------------------------------------ | -------------------------------------------- | ---------------- |
| SFX    | [coin](src/audio-modules/sfx/coin/README.md)                 | A bright, upward reward                      | 0.42 s           |
| SFX    | [shoot](src/audio-modules/sfx/shoot/README.md)               | A sharp weapon transient                     | 0.24 s           |
| SFX    | [explosion](src/audio-modules/sfx/explosion/README.md)       | Wide debris and low rumble                   | 1.8 s            |
| SFX    | [heal](src/audio-modules/sfx/heal/README.md)                 | A soft, ascending recovery gesture           | 1.5 s            |
| SFX    | [player-hit](src/audio-modules/sfx/player-hit/README.md)     | Rough, downward damage feedback              | 0.38 s           |
| SFX    | [ui-click](src/audio-modules/sfx/ui-click/README.md)         | A brief, dry interface tap                   | 0.065 s          |
| Music  | [exploration](src/audio-modules/music/exploration/README.md) | Spacious harmony and answering bell motifs   | 20 s             |
| Music  | [combat](src/audio-modules/music/combat/README.md)           | Syncopated bass, drums, and harmonic tension | 13.33 s          |
| Music  | [victory](src/audio-modules/music/victory/README.md)         | Ascending fanfare and a resolved cadence     | 9.2 s            |

The music is arranged in phrases with melody, harmony, bass, and independent instrumental voices. Exploration and combat carry note releases across their loop boundary. Victory ends with a cadence and release.

## Programmatic API

Both domains expose four methods. No DSP modules are exported from the package entry point.

```js
import audio from "cyberia-audio";

// play() resolves once the asset is rendered and the output device is open.
const coin = await audio.sfx.play("coin", { volume: 0.8 });
await coin.done; // wait for playback; rejects if the device fails while writing

const battle = await audio.music.play("combat", { intensity: 0.9 });
battle.stop(); // stop this instance; safe to call repeatedly
await battle.done; // { stopped: true }

// Offline generation opens no audio device and writes no file.
const result = await audio.music.render("exploration", { density: 0.7 });
console.log(result.sampleRate, result.duration, result.channelData.length);

// Recording opens no audio device; returns the absolute WAV path.
const path = await audio.sfx.record("explosion", { weight: 1, seed: 42 });

audio.sfx.stop(); // all active effects
audio.music.stop(); // all active music
audio.stop(); // all active playback
```

`play`, `render`, and `record` return promises. Await them to handle validation, loading, file, or device-open errors. A playback handle has `stop()`, `done`, and `backend`; `done` resolves to `{ stopped: false }` on normal completion. Calls to `play()` do not write files; use `record()` or the CLI for artifacts. Playback plays one finite render, including music. The `loop` metadata describes whether its samples can repeat; this version does not schedule continuous loops.

All built-in assets accept optional `volume` (0–1) and `sampleRate` (integer 22050–96000, default 44100). Each asset defines its own remaining parameters and ranges. For example, combat has `intensity`, exploration has `density`, and explosion has `weight`. Read the asset's README for its choices. Unknown or invalid parameters are rejected. Seeded noise uses a module-local deterministic generator; no network, samples, or audio service is needed.

## Architecture

A semantic, event-driven procedural audio engine with isolated asset modules and a standardized rendering contract.

```text
Game intent: audio.sfx.play('coin')
                |
      dispatcher: type + semantic ID
                |
      audio-modules/sfx/coin/index.js
                |
      coin's own parameters and DSP
                |
       { sampleRate, channelData, loop }
                |
          +-----+-----+
          |           |
      playback     WAV writer
```

The dispatcher knows **what** was requested and never **how** it is synthesized. It validates the domain and ID, resolves `src/audio-modules/{type}/{id}/index.js`, checks the module contract, renders once, validates the samples, and forwards the result to the selected output. The CLI and public API share this resolver. The filesystem is the registry; no list of asset-specific conditions or duplicate registry is required.

Each asset is a vertical slice:

```text
src/audio-modules/{sfx|music}/{semantic-id}/
  index.js       public module boundary
  dsp.js         specialized synthesis or musical composition
  params.js      owned defaults and parameter validation rules
  manifest.json  ID, type, tags, author, version, default duration
  README.md      meaning, usage, sound design, parameters, output

records/         generated .wav files only; ignored by Git
```

`src/audio-modules/` contains source definitions; `records/` contains generated artifacts. Asset modules never import another asset's implementation. Similar mathematics may be duplicated to keep creative ownership independent. The only shared asset helper is ordinary numeric/options validation in `src/validation.js`, which contains no synthesis. Isolation is architectural, within the same process; these are trusted modules, not a security sandbox.

## Rendering contract

Every `index.js` default-exports the same boundary:

```js
import { render } from "./dsp.js";
import { getParams } from "./params.js";
import manifest from "./manifest.json" with { type: "json" };

export default {
  id: manifest.id,
  type: manifest.type, // 'sfx' or 'music'; must match its directory
  render(options = {}) {
    return render(getParams(options));
  },
};
```

`render(options)` may be synchronous or asynchronous. It returns:

```js
{
  sampleRate: 44100,
  channelData: [new Float32Array(/* samples */)], // mono, or two arrays for stereo
  loop: false, // optional; true means the rendered phrase is suitable for repetition
}
```

Channels must have equal, nonzero length, contain finite samples in [-1, 1], and use a sample rate from 8000 to 192000. The current runtime accepts mono/stereo renders up to 120 seconds. The dispatcher derives `duration` from the sample count and normalizes omitted `loop` to `false`. It rejects invalid audio instead of silently clipping or changing the asset's sound.

Modules own gain, envelopes, filters, oscillators, noise, instruments, harmony, rhythm, and loop construction. They do not open devices or write files. Both playback and WAV output consume the same generated samples. The playback adapter interleaves 16-bit PCM in small chunks with backpressure, tracks active instances, and closes devices after completion, cancellation, or error.

## Add a word

1. Create `src/audio-modules/sfx/laser/` (or `music/boss-battle/`) with the five conventional files.
2. Give its manifest matching `id` and `type` fields. Implement its parameters and specialized DSP locally.
3. Return the rendering contract above. Test its intended meaning and output.
4. Run `cyberia-audio sfx laser`. Discovery is automatic; no dispatcher or existing asset changes are needed.

This borrows the event-to-implementation boundary familiar from game-audio middleware while keeping the runtime small. There is no event bus, synthesis framework, service container, build step, or global musical template. PCM is rendered eagerly in the main Node.js process; long phrases take time and memory before playback begins. Overlapping calls use separate native output instances; this version has no central mixer, streaming composition, routing graph, or automatic music transitions.

## Playback and verification

The runtime uses the bundled native backend of [`@audio/speaker`](https://github.com/audiojs/speaker) and the OS default output device. It explicitly selects `miniaudio` to bypass the package's JavaScript `null` and process fallbacks. A native backend can still connect to a virtual OS sink; successful writes alone do not prove that a physical speaker is audible. The CLI is record-only by default; pass `--play` for explicit playback.

```sh
npm test
npm ls --all

# Native playback smoke checks on a machine with an output device:
node bin/index.js sfx coin
node bin/index.js sfx explosion
node bin/index.js music exploration
node bin/index.js music combat
```

Vitest checks filesystem discovery, domain separation, malformed contracts, adding a new asset, module import isolation, deterministic PCM, signal levels and boundaries, CLI errors, all nine WAV round-trips, and playback data/stop/error handling with a controlled speaker. Native device checks are separate so CI does not require speakers. Tests spawn Node subprocesses and need an environment that permits capturing their output.

The runtime dependencies are intentionally limited to the packages used by the current implementation: `@audio/speaker` for device output, `commander` for the CLI, and `node-wav` for WAV encoding. Vitest is the test-only dependency. Asset DSP uses local mathematical synthesis, so no external synthesis package is loaded at runtime.
