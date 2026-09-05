import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import wav from 'node-wav';
import audio from '../src/index.js';

const exec = promisify(execFile);
const bin = fileURLToPath(new URL('../bin/index.js', import.meta.url));
const api = new URL('../src/index.js', import.meta.url).href;
let directory;
beforeAll(async () => { directory = await mkdtemp(join(tmpdir(), 'cyberia-audio-test-')); });
afterAll(() => rm(directory, { recursive: true, force: true }));
const cli = (...args) => exec(process.execPath, [bin, ...args], { cwd: directory, timeout: 15000 });

describe('CLI and WAV integration', () => {
  it('exposes exactly two top-level domains', async () => {
    const { stdout } = await cli('--help');
    const commands = stdout.split('Commands:')[1].trim().split('\n').map((line) => line.trim().split(' ')[0]);
    expect(commands).toEqual(['sfx', 'music']);
  });
  for (const [type, id] of [
    ['sfx', 'coin'], ['sfx', 'shoot'], ['sfx', 'explosion'], ['sfx', 'heal'],
    ['sfx', 'player-hit'], ['sfx', 'ui-click'], ['music', 'exploration'], ['music', 'combat'], ['music', 'victory'],
  ]) {
    it(`${type} ${id}: uses the API render and writes records/${id}.wav`, async () => {
      const { stdout, stderr } = await cli(type, id);
      expect(stdout).toContain(`Recorded ${type}/${id}`);
      expect(stderr).toBe('');
      const buffer = await readFile(join(directory, 'records', `${id}.wav`));
      expect(buffer.toString('ascii', 0, 4)).toBe('RIFF');
      expect(buffer.readUInt16LE(34)).toBe(16);
      const decoded = wav.decode(buffer);
      const result = await audio[type].render(id);
      expect(decoded.sampleRate).toBe(result.sampleRate);
      expect(decoded.channelData.length).toBe(result.channelData.length);
      for (let c = 0; c < decoded.channelData.length; c++) {
        const actual = decoded.channelData[c];
        expect(actual.length).toBe(result.channelData[c].length);
        let error = 0;
        for (let i = 0; i < actual.length; i++) error = Math.max(error, Math.abs(actual[i] - result.channelData[c][i]));
        expect(error).toBeLessThan(2 / 32768);
      }
    });
  }
  it('overwrites the stable filename, with volume applied', async () => {
    await cli('sfx', 'coin', '--volume', '0');
    const decoded = wav.decode(await readFile(join(directory, 'records/coin.wav')));
    expect(decoded.channelData[0].every((sample) => sample === 0)).toBe(true);
    expect((await readdir(join(directory, 'records'))).sort()).toEqual([
      'coin.wav', 'combat.wav', 'exploration.wav', 'explosion.wav', 'heal.wav', 'player-hit.wav', 'shoot.wav', 'ui-click.wav', 'victory.wav',
    ]);
  });
  it('supports programmatic recording from a different working directory', async () => {
    const code = `import audio from ${JSON.stringify(api)}; console.log(await audio.sfx.record('coin', { volume: 0.3 }));`;
    const { stdout } = await exec(process.execPath, ['--input-type=module', '-e', code], { cwd: directory });
    expect(stdout.trim()).toBe(join(directory, 'records/coin.wav'));
  });
  it.each([
    ['sfx', 'laser'], ['sfx', 'exploration'], ['music', 'coin'], ['sfx', '../coin'],
    ['sfx', 'coin', '--volume', 'NaN'], ['sfx', 'coin', '--volume', '2'], ['ambient', 'coin'],
  ])('reports invalid invocation %s %s without a stack trace', async (...args) => {
    await expect(cli(...args)).rejects.toMatchObject({ code: 1 });
    try { await cli(...args); } catch (error) { expect(`${error.stderr}\n${error.stdout}`).toMatch(/error:/i); expect(error.stderr).not.toContain('    at '); }
  });
  it('uses --play as an explicit opt-in and rejects the old --no-play spelling', async () => {
    const { stdout } = await cli('sfx', '--help');
    expect(stdout).toContain('--play');
    await expect(cli('sfx', 'ui-click', '--no-play')).rejects.toMatchObject({ code: 1 });
  });
});
