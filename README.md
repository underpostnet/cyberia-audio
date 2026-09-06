<p align="center">
  <img src="https://www.cyberiaonline.com/assets/splash/apple-touch-icon-precomposed.png" alt="CYBERIA online"/>
</p>

<div align="center">

<h1>cyberia audio</h1>

</div>

**Path:** `cyberia-audio/` · **Language:** Javascript · **Role:** Semantic audio toolkit

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
cyberia-audio music berlin0 --play --loop      # repeats until Ctrl-C
cyberia-audio music combat -o ./records/theme.wav
cyberia-audio music mystery --output /home/user/custom-loop.wav
```

The CLI has two domains: `sfx <id>` and `music <id>`, and `--prompt "<game intent>"` generates a new module before rendering it (see [Generate a word with AI](#generate-a-word-with-ai)). Every valid command writes a 16-bit PCM WAV to `records/<id>.wav` in the **current working directory**, writes its asset manifest beside it as `records/<id>.json`, and exits after recording by default. Pass `-o <path>` or `--output <path>` to write the pair to a custom absolute path (for example `/home/dd/cyberia-audio/records/combat.wav`) or a relative path (for example `./records/coin.wav`); the manifest takes the same path with a `.json` extension and missing parent directories are created. Pass `--play` to play the generated sound after the WAV is saved, and `--play --loop` to keep repeating it until Ctrl-C. Repeating a command overwrites both files. Recording finishes before playback starts, so a device failure leaves the WAV available. Invalid IDs list the available assets and exit with status 1. Ctrl-C stops active playback.

## Vocabulary

| Domain | ID                                                           | Communicates                                   | Default duration |
| ------ | ------------------------------------------------------------ | ---------------------------------------------- | ---------------- |
| SFX    | [coin](src/audio-modules/sfx/coin/README.md)                 | A bright, upward reward                        | 0.42 s           |
| SFX    | [shoot](src/audio-modules/sfx/shoot/README.md)               | A sharp weapon transient                       | 0.24 s           |
| SFX    | [explosion](src/audio-modules/sfx/explosion/README.md)       | Wide debris and low rumble                     | 1.8 s            |
| SFX    | [heal](src/audio-modules/sfx/heal/README.md)                 | A soft, ascending recovery gesture             | 1.5 s            |
| SFX    | [player-hit](src/audio-modules/sfx/player-hit/README.md)     | Rough, downward damage feedback                | 0.38 s           |
| SFX    | [ui-click](src/audio-modules/sfx/ui-click/README.md)         | A brief, dry interface tap                     | 0.065 s          |
| Music  | [exploration](src/audio-modules/music/exploration/README.md) | Spacious harmony and answering bell motifs     | 20 s             |
| Music  | [combat](src/audio-modules/music/combat/README.md)           | Syncopated bass, drums, and harmonic tension   | 13.33 s          |
| Music  | [mystery](src/audio-modules/music/mystery/README.md)         | Low pulsing tones and a lurking half-lit theme | 21.33 s          |
| Music  | [victory](src/audio-modules/music/victory/README.md)         | Ascending fanfare and a resolved cadence       | 9.2 s            |

The music is arranged in phrases with melody, harmony, bass, and independent instrumental voices. Exploration, combat, and mystery carry note releases across their loop boundary. Victory ends with a cadence and release.

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
// The asset manifest is written beside it as explosion.json.
const path = await audio.sfx.record("explosion", { weight: 1, seed: 42 });

audio.sfx.stop(); // all active effects
audio.music.stop(); // all active music
audio.stop(); // all active playback
```

`play`, `render`, and `record` return promises. Await them to handle validation, loading, file, or device-open errors. `record` resolves to the WAV path and always leaves two files on disk: `<name-out>.wav` and its `<name-out>.json` manifest. A playback handle has `stop()`, `done`, and `backend`; `done` resolves to `{ stopped: false }` on normal completion. Calls to `play()` do not write files; use `record()` or the CLI for artifacts. Playback plays one finite render, including music. The `loop` metadata describes whether an asset's samples are written to repeat; `play()` takes `{ loop: true }` (the CLI's `--play --loop`) to write that render continuously through one open device until `stop()`, so a phrase that joins itself has no gap at the seam. There is still no scheduling beyond that: no crossfade, no queue, no transition between assets.

All built-in assets accept optional `volume` (0–1) and `sampleRate` (integer 22050–96000, default 44100). `volume` is the fraction of full scale the loudest sample reaches: every asset normalizes its own mix to it, so `1` is as loud as that asset can render without clipping, `0.5` is half that amplitude, and `0` is exact silence. Each asset's default encodes its place in the mix — a UI click is quieter than an explosion at the same setting — so raise `volume` per call rather than expecting the defaults to be equally loud. Each asset defines its own remaining parameters and ranges. For example, combat has `intensity`, exploration has `density`, and explosion has `weight`. Read the asset's README for its choices. Unknown or invalid parameters are rejected. Seeded noise uses a module-local deterministic generator; no network, samples, or audio service is needed.

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
      playback     WAV writer + manifest writer
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

records/         generated .wav files and their .json manifests; ignored by Git

src/generator/   AI module generation: the Gemini client, the stage prompts, and the pipeline
src/runtime/     playback, native WAV encoding, shared 16-bit PCM, and the recorded manifest
```

`src/audio-modules/` contains source definitions; `records/` contains generated artifacts. Asset modules never import another asset's implementation. Similar mathematics may be duplicated to keep creative ownership independent. The only shared asset helper is ordinary numeric/options validation in `src/validation.js`, which contains no synthesis. Isolation is architectural, within the same process; these are trusted modules, not a security sandbox.

## Recorded manifest

Recording writes the WAV and, next to it, the manifest a consumer needs to load that file without importing the package. It merges the asset's own `manifest.json` with the rendered result and the parameter contract from `params.js`:

```json
{
  "id": "coin",
  "type": "sfx",
  "tags": ["reward", "collectible", "positive"],
  "author": "cyberia-audio",
  "version": "0.1.0",
  "duration": 0.42,
  "sampleRate": 44100,
  "channels": 1,
  "loop": false,
  "audio": "coin.wav",
  "defaults": { "sampleRate": 44100, "volume": 0.8, "duration": 0.42, "pitch": 1 },
  "parameters": { "volume": { "min": 0, "max": 1, "integer": false } }
}
```

`duration`, `sampleRate`, `channels`, and `loop` describe the render that was just written, so they reflect the options passed to that call rather than the asset's declared defaults. `audio` is the WAV basename, which keeps the pair portable when the directory is copied. A module that ships no `manifest.json` or `params.js` still records a valid manifest: its identity and audio fields come from the render, and the metadata fields are empty.

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

## Generate a word with AI

`--prompt` writes a new module from one natural-language game intent, verifies it against the
engine contract, installs it under `src/audio-modules/<type>/<id>/`, and then records it exactly
as it records a hand-written asset. Generation needs a Google Gemini key in the environment;
nothing else about the engine, the dispatcher, or the rendering contract changes.

```sh
# The key is read from ./.env when the file is there; an exported variable wins over it.
echo 'GEMINI_API_KEY=...' > .env

# The prompt decides the domain, the semantic id, the parameters and the synthesis
cyberia-audio --prompt "a heavy blast door slamming shut in a derelict station"

# Fix the domain and let the prompt name the module
cyberia-audio music --prompt "a tense low pulse for a boss approach"

# Fix both, and replace a module that already exists
cyberia-audio sfx blast-door --prompt "a heavy blast door slamming shut" --force

# Generate and verify without writing into the vocabulary
cyberia-audio --prompt "a soft interface confirmation" --dry-run
```

| Option                  | Description                                                                   |
| ----------------------- | ----------------------------------------------------------------------------- |
| `--prompt <text>`       | The game intent. Its presence is what turns a command into a generation.      |
| `--model <model>`       | Gemini model. Defaults to `$GEMINI_MODEL`, else `gemma-4-26b-a4b-it`.         |
| `--temperature <value>` | Sampling temperature.                                                         |
| `--repairs <count>`     | Repair passes allowed when verification rejects the render (default 2).       |
| `--force`               | Replace an existing module with the same id instead of refusing.              |
| `--dry-run`             | Generate and verify, then discard. Nothing is installed.                      |
| `--env-file <path>`     | Read environment variables from this file instead of `./.env`.                |

The API key comes from `GEMINI_API_KEY`: `./.env` is loaded automatically when it exists, `--env-file <path>` names a different file, and a variable already exported in the shell always wins over both. (Node's own `--env-file` is a runtime flag that must precede the script, which is not where it gets typed; this one sits beside the app's own options.)

Four sequential stages, one bounded model call each, and each one asked for the smallest payload
the pipeline cannot write itself: the **identity** (domain, semantic id, tags, voices — and for a
phrase its key, chord progression, tempo and bar count), the **parameter contract** (defaults,
ranges, and one clause of prose per parameter), the **synthesis**, and the three **paragraphs** of
the README that are not mechanical.

**Music is written on a grid, not from scratch.** A phrase's key and progression are resolved
against [`tonal`](https://github.com/tonaljs/tonal) at generation time — a key it cannot parse or a
chord symbol it does not know is replaced rather than carried into the render — and the module then
opens with a generated grid that binds `SCALE`, `CHORDS[bar]`, `BASS[bar]`, `frequency(midi)`,
`totalFrames(sampleRate, bpm)` and the sixteenth-note helpers `STEPS` / `stepFrame` / `stepBar`.
The synthesis chooses what to play; it never chooses what to play it on. Two details in that grid
are the difference between music and noise: MIDI numbers are laid out **ascending**, because
mapping tonal's note names onto one octave folds a scale back on itself at C and leaves every chord
inverted, and the phrase length comes from **bars at the tempo**, so a loop repeats exactly on the
bar line instead of after a round number of seconds. The stage is required to put a rhythm bed on
the step grid, a bass line on `BASS` and its harmony on `CHORDS`, and verification rejects a
synthesis that allocates its own frame count, writes a frequency in Hz, or skips the grid.

Everything identical across modules is templated locally and never spent on tokens. `index.js` is
the module boundary, byte for byte, in every asset. `params.js` is composed from the numbers the
model returned, with `sampleRate` and `volume` owned by the engine. `manifest.json` carries the
house author and version and the duration that was *measured*, not the one that was predicted. The
model writes one export — `synthesize(params)`, returning raw channels — and the pipeline appends
the `render()` wrapper that centres the mix, closes a loop onto its own first sample, fades a
one-shot to exactly zero at both boundaries, normalizes to 0.98 of full scale and applies the
volume law. In the README, only the summary, the use
case and the sound-design paragraph are generated; the parameter sentence, the contract paragraph
and both usage examples are composed from the contract itself. Model-written DSP may import
[`tonal`](https://github.com/tonaljs/tonal) for chord quality, scale degrees and note names.

Because loudness, DC, the loop seam, silence at `volume: 0` and the one-shot boundaries are
structural rather than instructed, a repair pass is spent on sound design instead of on gain
staging. A parameter the synthesis introduces but the contract does not own is adopted into the
contract — one small call for its default, range and meaning — because the name is already in
the code. Weaker models earn their keep this way: they narrate before answering, quote the
response schema back as an example and follow a signature loosely, and none of that has to be
right for the module to be. Later stages carry
the resolved brief rather than the raw intent, the parameter contract travels as a single
`synthesize({ ... }) — name=default [min..max]` line, and a repair pass carries only the rejected
source and the diagnostics.

Generation happens in a hidden staging directory beside its destination, at the same depth, so
`../../../validation.js` resolves exactly as it will after installation and the dispatcher's
discovery filter ignores it. Before anything is installed the staged module must survive the same
contract the built-ins are held to: five files, an untouched module boundary, a matching
`id`/`type`, a `synthesize()` that destructures only parameters the contract owns, deterministic
PCM, samples within [-1, 1], silence at `volume: 0`, a frame count derived from `sampleRate`,
audible peak and RMS, no DC bias, zero-valued one-shot boundaries or a phrase that joins itself,
rejection of unknown and out-of-range parameters, no `Math.random`, and no import beyond its own
directory, `src/validation.js`, and the declared dependencies. A phrase is held to its music as
well: it must run a whole number of bars at its own tempo, take its pitches from `frequency()` and
its harmony from the grid. A failure is reported as diagnostics and fed back to the model as a
repair pass; when the last pass still fails, the run leaves the tree untouched.

A generated module joins the runtime vocabulary immediately — the filesystem is the registry. The
table above and the id lists in `test/architecture.test.js` are hand-maintained, so add the new id
to both when you decide to ship it as a built-in.

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

Vitest checks filesystem discovery, domain separation, malformed contracts, adding a new asset, module import isolation, deterministic PCM, signal levels and boundaries, CLI errors, all ten WAV/manifest round-trips, and playback data/stop/error handling with a controlled speaker. Native device checks are separate so CI does not require speakers. Tests spawn Node subprocesses and need an environment that permits capturing their output.

The runtime dependencies are intentionally limited to the packages the implementation actually uses: `@audio/speaker` for device output, `commander` for the CLI, and `tonal` for the note and chord helpers some asset DSP imports. Vitest is the test-only dependency. WAV encoding is native: `src/runtime/wav.js` writes the 44-byte RIFF/WAVE header itself, and `src/runtime/pcm.js` owns the signed 16-bit quantization that playback and the WAV writer share, so a recorded file and its playback are sample-identical. Asset DSP is local mathematical synthesis; no synthesis framework, sample library, or Web Audio implementation is loaded at runtime.
