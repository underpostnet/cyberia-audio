#!/usr/bin/env node
import { Command, InvalidArgumentError } from 'commander';
import { dispatch } from '../src/dispatcher.js';
import { generateModule } from '../src/generator/generate-module.js';
import { loadEnvFile } from '../src/runtime/env.js';
import { play, stop } from '../src/runtime/playback.js';

const program = new Command();
program.name('cyberia-audio').description('Semantic game music and SFX. Every command writes records/<id>.wav and records/<id>.json.').version('0.1.0');
program.addHelpCommand(false);
// The program itself answers a bare `--prompt`, so an unrecognized command reaches its action as
// an argument and is reported by name instead of as a generic excess-argument error.
program.allowExcessArguments(true);

const number = (value) => {
  if (value.trim() === '' || !Number.isFinite(Number(value))) throw new InvalidArgumentError('Expected a finite number.');
  return Number(value);
};

// Generation options belong to the program, not to a domain: they are accepted with or without
// one, and commander routes them to the program from either position. Declaring them on the
// subcommands as well would shadow them there.
program
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

// Generation is a separate act from synthesis: it writes and verifies the module, and the
// ordinary record path then renders it exactly as it renders a hand-written one.
const generate = async ({ type, id } = {}) => {
  const options = program.opts();
  const result = await generateModule({
    prompt: options.prompt,
    type,
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
    `Generated ${result.type}/${result.id} — ${duration.toFixed(2)}s ${channels === 1 ? 'mono' : 'stereo'}` +
      `${loop ? ' loop' : ''}${result.repairs ? `, repaired ${result.repairs}x` : ''}`,
  );
  if (options.dryRun) console.log(`Dry run ${result.type}/${result.id} → nothing installed (${Object.keys(result.files).join(', ')})`);
  return result;
};

const recordAsset = async (type, id, options) => {
  if (options.loop && !options.play) throw new Error('--loop applies to playback: pass --play as well.');
  const params = options.volume === undefined ? {} : { volume: options.volume };
  const result = await dispatch(type, id, params, { record: true, play: false, path: options.output });
  console.log(`Recorded ${type}/${id} → ${result.path}`);
  console.log(`Manifest ${type}/${id} → ${result.manifestPath}`);
  if (options.play) {
    // Render and resolve exactly once; playback consumes the recorded samples.
    if (options.loop) console.log(`Looping ${type}/${id} — Ctrl-C to stop`);
    const playback = await play(type, result.audio, { loop: options.loop === true });
    await playback.done;
  }
};

for (const type of ['sfx', 'music']) {
  program.command(`${type} [id]`)
    .description(`Render and record a semantic ${type === 'sfx' ? 'sound effect' : 'music phrase'}.`)
    .option('--play', 'play the generated sound after the WAV has been saved')
    .option('--loop', 'with --play, repeat the sound without a gap until Ctrl-C')
    .option('--volume <value>', 'gain from 0 to 1', number)
    .option('-o, --output <path>', 'write the WAV and its manifest to this absolute or relative path instead of records/<id>.wav')
    .action(async (id, options) => {
      const { prompt, dryRun } = program.opts();
      if (!prompt && !id) throw new Error(`Missing ${type} id. Pass an id, or --prompt "<game intent>" to generate a new module.`);
      const generated = prompt ? await generate({ type, id }) : null;
      if (dryRun && generated) return;
      await recordAsset(type, generated?.id ?? id, options);
    });
}

program.action(async (options) => {
  const [unknown] = program.args;
  if (unknown) throw new Error(`Unknown command: ${unknown}. Expected "sfx" or "music".`);
  if (!options.prompt) {
    program.outputHelp();
    process.exitCode = 1;
    return;
  }
  // No domain was named, so the prompt itself decides whether this is an effect or a phrase.
  const generated = await generate();
  if (options.dryRun) return;
  await recordAsset(generated.type, generated.id, {});
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
