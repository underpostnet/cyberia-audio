<p align="center">

  <img src="https://www.cyberiaonline.com/assets/splash/apple-touch-icon-precomposed.png" alt="CYBERIA online"/>

</p>

<div align="center">

# cyberia audio

</div>

**Path:** `cyberia-audio/` · **Language:** JavaScript · **Role:** Semantic audio toolkit

**cyberia-audio is a semantic, event-driven procedural audio engine for game developers who are not musicians.**

Describe the game event. The asset owns the sound.

```js
import audio from 'cyberia-audio';

audio.sfx.play('coin');

audio.music.play('combat');
```

## Usage

Install dependencies:

```sh
npm ci
```

Run an asset:

```sh
node bin/index.js sfx coin

node bin/index.js sfx explosion --play

node bin/index.js music exploration

node bin/index.js music combat --play --loop

node bin/index.js sfx coin --volume 0.5

node bin/index.js music combat -o ./records/theme.wav
```

Generate an asset with AI:

```sh
node bin/index.js --prompt "a heavy blast door slamming shut in a derelict station"
```

Recorded assets are written as WAV files with a JSON manifest under `records/`.

## Architecture

Every sound effect (sfx) and musical track (music) is structured as a self-contained, modular asset. Each asset folder fully owns its **synthesis logic**, **configurable parameters**, **metadata**, and **sound-design documentation**.

The filesystem acts as the asset registry. Audio modules are isolated from each other, while the runtime contains the shared rendering and playback infrastructure.

### Project Structure

```text
src/
├── audio-modules/   # Audio assets
├── generator/       # AI generation
└── runtime/         # Playback, PCM and WAV output

records/             # Generated audio artifacts
```

### Audio Asset Structure

Below is the structure of an audio asset (e.g., `src/audio-modules/sfx/laser/` or `src/audio-modules/music/concrete-pulse/`):

```text
src/audio-modules/

└── sfx/

    └── laser/

        ├── index.js
        ├── dsp.js
        ├── params.js
        ├── manifest.json
        └── README.md
```

| File Name           | Asset Ownership Role           | Description & Responsibilities                                                                                                                                                                                                               |
| :------------------ | :----------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`index.js`**      | **Public API & Entry Point**   | Exposes the frozen asset object. Ties together the DSP rendering engine (`dsp.js`) and parameter resolver (`params.js`) to provide a standardized public interface for the runtime engine.                                                   |
| **`dsp.js`**        | **Synthesis & Signal Engine**  | Implements all **Digital Signal Processing** (DSP). Contains `synthesize()` and `render()` functions, low-level math, oscillators, filters (e.g., SVF), envelopes, drum/synth engines, master effects (delay/limiter), and loop crossfading. |
| **`params.js`**     | **Parameters & Rules**         | Defines default parameter values (`params`), numeric boundary constraints and type rules (`rules`), and exports `getParams()` to validate and resolve user options safely.                                                                   |
| **`manifest.json`** | **Metadata & Registration**    | Contains asset metadata including unique id, type (`"sfx"` or `"music"`), tags, author, versioning, and loop duration.                                                                                                                       |
| **`README.md`**     | **Sound-Design Documentation** | Describes the sonic aesthetic, key musical/acoustic properties, parameter descriptions with valid ranges, and usage examples for JavaScript import and CLI execution.                                                                        |

### Core Design Principle

**An asset owns its:**

- **Synthesis** (`dsp.js`)
- **Parameters** (`params.js`)
- **Metadata** (`manifest.json`)
- **Sound-design behavior & docs** (`README.md` & `index.js`)

This modular architecture ensures that every sound effect or musical loop can be developed, tested, and tweaked in total isolation without side effects on the rest of the application.

### Runtime Flow

```text
Game intent: audio.sfx.play('coin')
                |
                v
      dispatcher: type + semantic ID
                |
                v
       audio-modules/sfx/coin/index.js
                |
                v
       coin's own parameters and DSP
                |
                v
        { sampleRate, channelData, loop }
                |
          +-----+-----+
          |           |
      playback     WAV writer + manifest writer
```

## Rendering Contract

Every asset exposes the same module boundary:

```js
export default {
  id: 'coin',
  type: 'sfx',
  render(options = {}) {
    // return rendered audio
  },
};
```

A render returns:

```js
{
  sampleRate: 44100,
  channelData: [new Float32Array(/* samples */)],
  loop: false,
}
```

The runtime validates the rendered audio before playback or recording.

## Programmatic API

```js
import audio from 'cyberia-audio';

const coin = await audio.sfx.play('coin', { volume: 0.8 });

await coin.done;

const battle = await audio.music.play('combat', {
  intensity: 0.9,
});

battle.stop();

const result = await audio.music.render('exploration', {
  density: 0.7,
});

const path = await audio.sfx.record('explosion', {
  weight: 1,
  seed: 42,
});

audio.sfx.stop();

audio.music.stop();

audio.stop();
```

### Methods

| Method     | Description                            |
| :--------- | :------------------------------------- |
| `play()`   | Render and play an asset               |
| `render()` | Render without playback or file output |
| `record()` | Render and write WAV + manifest        |
| `stop()`   | Stop active playback                   |

`play()`, `render()` and `record()` return promises.

Built-in assets support `volume` and `sampleRate`. Additional parameters are asset-specific.

## Generate with AI

The `--prompt` option generates a new audio module from a natural-language game intent.

```sh
export GEMINI_API_KEY="..."

node bin/index.js \
  --prompt "a heavy blast door slamming shut in a derelict station"
```

Specify the domain explicitly:

```sh
node bin/index.js music \
  --prompt "a tense low pulse for a boss approach"
```

Replace an existing asset:

```sh
node bin/index.js sfx blast-door \
  --prompt "a heavy blast door slamming shut" \
  --force
```

Validate without installing:

```sh
node bin/index.js \
  --prompt "a soft interface confirmation" \
  --dry-run
```

### Options

| Option                  | Description                                   |
| :---------------------- | :-------------------------------------------- |
| `--prompt <text>`       | Game intent used to generate the asset        |
| `--model <model>`       | Gemini model                                  |
| `--temperature <value>` | Generation temperature                        |
| `--repairs <count>`     | Maximum repair attempts                       |
| `--force`               | Replace an existing asset                     |
| `--dry-run`             | Generate and validate without installing      |
| `--env-file <path>`     | Load environment variables from a custom file |

The generator uses `GEMINI_API_KEY`.

Generated assets are validated against the same rendering contract as built-in assets before installation.

## Recorded Files

Recording produces a WAV file and its manifest:

```text
records/

├── coin.wav
└── coin.json
```

The manifest contains the asset identity, render information and parameters associated with the recorded asset.

## Vocabulary

| Domain | ID                                                           | Description              | Duration |
| :----- | :----------------------------------------------------------- | :----------------------- | -------: |
| SFX    | [coin](src/audio-modules/sfx/coin/README.md)                 | Bright reward sound      |   0.42 s |
| SFX    | [shoot](src/audio-modules/sfx/shoot/README.md)               | Sharp weapon transient   |   0.24 s |
| SFX    | [explosion](src/audio-modules/sfx/explosion/README.md)       | Debris and low rumble    |    1.8 s |
| SFX    | [heal](src/audio-modules/sfx/heal/README.md)                 | Ascending recovery sound |    1.5 s |
| SFX    | [player-hit](src/audio-modules/sfx/player-hit/README.md)     | Damage feedback          |   0.38 s |
| SFX    | [ui-click](src/audio-modules/sfx/ui-click/README.md)         | Short interface click    |  0.065 s |
| Music  | [exploration](src/audio-modules/music/exploration/README.md) | Exploration ambience     |     20 s |
| Music  | [combat](src/audio-modules/music/combat/README.md)           | Combat tension           |  13.33 s |
| Music  | [mystery](src/audio-modules/music/mystery/README.md)         | Dark mystery loop        |  21.33 s |
| Music  | [victory](src/audio-modules/music/victory/README.md)         | Victory fanfare          |    9.2 s |

See each asset README for its parameters and sound-design details.

## Development

Run tests:

```sh
npm test
```

Run basic playback checks:

```sh
node bin/index.js sfx coin

node bin/index.js sfx explosion

node bin/index.js music exploration

node bin/index.js music combat
```

Native playback requires an available audio output device.
