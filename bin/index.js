#!/usr/bin/env node
import { Command, InvalidArgumentError } from 'commander';
import { dispatch } from '../src/dispatcher.js';
import { play, stop } from '../src/runtime/playback.js';

const program = new Command();
program.name('cyberia-audio').description('Semantic game music and SFX. Every command writes records/<id>.wav.').version('0.1.0');
program.addHelpCommand(false);

const number = (value) => {
  if (value.trim() === '' || !Number.isFinite(Number(value))) throw new InvalidArgumentError('Expected a finite number.');
  return Number(value);
};

for (const type of ['sfx', 'music']) {
  program.command(`${type} <id>`)
    .description(`Render and record a semantic ${type === 'sfx' ? 'sound effect' : 'music phrase'}.`)
    .option('--play', 'play the generated sound after the WAV has been saved')
    .option('--volume <value>', 'gain from 0 to 1', number)
    .action(async (id, options) => {
      const params = options.volume === undefined ? {} : { volume: options.volume };
      const result = await dispatch(type, id, params, { record: true, play: false });
      console.log(`Recorded ${type}/${id} → ${result.path}`);
      if (options.play) {
        // Render and resolve exactly once; playback consumes the recorded samples.
        const playback = await play(type, result.audio);
        await playback.done;
      }
    });
}

process.once('SIGINT', () => { stop(); process.exitCode = 130; });
process.once('SIGTERM', () => { stop(); process.exitCode = 143; });

try {
  await program.parseAsync();
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
