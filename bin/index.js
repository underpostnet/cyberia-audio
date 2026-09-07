#!/usr/bin/env node
import { Command, InvalidArgumentError } from 'commander';
import { dispatch } from '../src/dispatcher.js';
import { generateModule } from '../src/generator/generate-module.js';
import { loadEnvFile } from '../src/runtime/env.js';
import { play, stop } from '../src/runtime/playback.js';
import { AUDIO_BUSES } from '../src/validation.js';

const program = new Command();
program.name('cyberia-audio').description('Semantic game music and SFX. Every run writes records/<id>.wav and records/<id>.json.').version('0.1.0');
program.addHelpCommand(false);

const number = (value) => {
  if (value.trim() === '' || !Number.isFinite(Number(value))) throw new InvalidArgumentError('Expected a finite number.');
  return Number(value);
};

// One entry point, one option table: the dispatcher takes <bus-id> <id> as arguments rather than
// as a command per bus, so nothing is declared twice and adding a bus adds no CLI surface.
program
  .argument('[bus-id]', `audio bus to render from: ${AUDIO_BUSES.join(' or ')}`)
  .argument('[id]', 'semantic module id under src/audio-module/<bus-id>/')
  .option('--play', 'play the generated sound after the WAV has been saved')
  .option('--loop', 'with --play, repeat the sound without a gap until Ctrl-C')
  .option('--volume <value>', 'gain from 0 to 1', number)
  .option('-o, --output <path>', 'write the WAV and its manifest to this absolute or relative path instead of records/<id>.wav')
  .option('--prompt <text>', 'generate a new audio module from this game intent, then render it')
  .option('--model <model>', 'Gemini model for --prompt (default: $GEMINI_MODEL, else gemma-4-26b-a4b-it)')
  .option('--temperature <value>', 'sampling temperature for --prompt', number)
  .option('--repairs <count>', 'repair passes allowed when a generated module fails verification', number)
  .option('--force', 'let --prompt replace an existing module with the same id')
  .option('--dry-run', 'generate and verify the module for --prompt, then discard it')
  .option('--env-file <path>', 'read environment variables from this file instead of ./.env');

// Before any action, and for every command: ./.env is the ordinary place a GEMINI_API_KEY lives,
// and reading it here is what lets `--env-file` sit beside the app's own flags. Node's own
// --env-file is a runtime flag and must precede the script, which is not where anyone types it.
program.hook('preAction', () => {
  const loaded = loadEnvFile(program.opts().envFile);
  if (loaded && program.opts().envFile) console.log(`Environment ${loaded}`);
});

const generate = async ({ bus, id } = {}) => {
  const options = program.opts();
  const result = await generateModule({
    prompt: options.prompt,
    bus,
    id,
    model: options.model,
    temperature: options.temperature,
    repairs: options.repairs,
    force: options.force,
    dryRun: options.dryRun,
    log: (line) => console.log(line),
  });
  const { channels, duration, loop } = result.measured;
  console.log(
    `Generated ${result.bus}/${result.id} — ${duration.toFixed(2)}s ${channels === 1 ? 'mono' : 'stereo'}` +
      `${loop ? ' loop' : ''}${result.repairs ? `, repaired ${result.repairs}x` : ''}`,
  );
  if (options.dryRun) console.log(`Dry run ${result.bus}/${result.id} → nothing installed (${Object.keys(result.files).join(', ')})`);
  return result;
};

const recordAsset = async (bus, id, options) => {
  if (options.loop && !options.play) throw new Error('--loop applies to playback: pass --play as well.');
  const params = options.volume === undefined ? {} : { volume: options.volume };
  const result = await dispatch(bus, id, params, { record: true, play: false, path: options.output });
  console.log(`Recorded ${bus}/${id} → ${result.path}`);
  console.log(`Manifest ${bus}/${id} → ${result.manifestPath}`);
  if (options.play) {
    // Render and resolve exactly once; playback consumes the recorded samples.
    if (options.loop) console.log(`Looping ${bus}/${id} — Ctrl-C to stop`);
    const playback = await play(bus, result.audio, { loop: options.loop === true });
    await playback.done;
  }
};

program.action(async (busId, id, options) => {
  if (busId !== undefined && !AUDIO_BUSES.includes(busId)) {
    throw new Error(`Unknown audio bus: ${busId}. Expected ${AUDIO_BUSES.join(' or ')}.`);
  }
  if (!options.prompt && !busId) {
    program.outputHelp();
    process.exitCode = 1;
    return;
  }
  if (!options.prompt && !id) {
    throw new Error(`Missing ${busId} id. Pass an id, or --prompt "<game intent>" to generate a new module.`);
  }
  // Generation is a separate act from synthesis: it writes and verifies the module, and the
  // record path below then renders it exactly as it renders a hand-written one. Naming a bus or
  // an id fixes that half of the identity; leaving it out lets the prompt decide.
  const generated = options.prompt ? await generate({ bus: busId, id }) : null;
  if (options.dryRun && generated) return;
  await recordAsset(generated?.bus ?? busId, generated?.id ?? id, options);
});

// Playback stops the moment the device is closed, and a render or a recording in flight is given
// a moment to finish. Installing a handler replaces the default exit, so a pending network
// request would otherwise hold the process open with nothing left to report.
const shutdown = (code) => {
  stop();
  process.exitCode = code;
  setTimeout(() => process.exit(code), 1000).unref();
};
process.once('SIGINT', () => shutdown(130));
process.once('SIGTERM', () => shutdown(143));

try {
  await program.parseAsync();
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
