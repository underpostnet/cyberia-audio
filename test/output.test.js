import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeWav } from './support/wav.js';
import audio from '../src/index.js';

const exec = promisify(execFile);
const bin = fileURLToPath(new URL('../bin/index.js', import.meta.url));
const api = new URL('../src/index.js', import.meta.url).href;
let directory;
beforeAll(async () => { directory = await mkdtemp(join(tmpdir(), 'cyberia-audio-test-')); });
afterAll(() => rm(directory, { recursive: true, force: true }));
const cli = (...args) => exec(process.execPath, [bin, ...args], { cwd: directory, timeout: 15000 });

describe('CLI and WAV integration', () => {
  it('dispatches from one entry point that takes the bus as an argument', async () => {
    const { stdout } = await cli('--help');
    // One command, not one per bus: adding a bus must not add CLI surface.
    expect(stdout).toContain('Usage: cyberia-audio [options] [bus-id] [id]');
    expect(stdout).not.toContain('Commands:');
    expect(stdout).toContain('audio bus to render from: music or sfx');
  });
  for (const [bus, id] of [
    ['sfx', 'coin'], ['sfx', 'shoot'], ['sfx', 'explosion'], ['sfx', 'heal'],
    ['sfx', 'hit'], ['sfx', 'ui-click'], ['sfx', 'footsteps'],
    ['sfx', 'victory'],
    ['music', 'exploration'], ['music', 'combat'], ['music', 'mystery'],
    ['music', 'portal-cooldown'],
  ]) {
    it(`${bus} ${id}: uses the API render and writes records/${id}.wav`, async () => {
      const { stdout, stderr } = await cli(bus, id);
      expect(stdout).toContain(`Recorded ${bus}/${id}`);
      expect(stdout).toContain(`Manifest ${bus}/${id}`);
      expect(stderr).toBe('');
      const manifest = JSON.parse(await readFile(join(directory, 'records', `${id}.json`), 'utf8'));
      expect(manifest).toMatchObject({
        id, bus, author: 'cyberia-audio', version: expect.stringMatching(/^\d+\.\d+\.\d+$/), audio: `${id}.wav`,
      });
      expect(manifest.tags.length).toBeGreaterThan(0);
      expect(manifest.defaults.volume).toBeGreaterThan(0);
      expect(manifest.parameters.volume).toEqual({ min: 0, max: 1, integer: false });
      const buffer = await readFile(join(directory, 'records', `${id}.wav`));
      expect(buffer.toString('ascii', 0, 4)).toBe('RIFF');
      expect(buffer.readUInt16LE(34)).toBe(16);
      const decoded = decodeWav(buffer);
      const result = await audio[bus].render(id);
      expect(decoded.sampleRate).toBe(result.sampleRate);
      expect(decoded.channelData.length).toBe(result.channelData.length);
      expect(manifest.sampleRate).toBe(result.sampleRate);
      expect(manifest.channels).toBe(result.channelData.length);
      expect(manifest.duration).toBeCloseTo(result.duration, 6);
      expect(manifest.loop).toBe(result.loop);
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
    const decoded = decodeWav(await readFile(join(directory, 'records/coin.wav')));
    expect(decoded.channelData[0].every((sample) => sample === 0)).toBe(true);
    const stems = ['coin', 'combat', 'exploration', 'explosion', 'footsteps', 'heal', 'hit', 'mystery', 'portal-cooldown', 'shoot', 'ui-click', 'victory'];
    expect((await readdir(join(directory, 'records'))).sort()).toEqual(
      stems.flatMap((stem) => [`${stem}.json`, `${stem}.wav`]).sort(),
    );
  });
  it('writes -o output to a custom absolute or relative path', async () => {
    const relative = join(directory, 'custom', 'combat.wav');
    const { stdout } = await cli('music', 'combat', '-o', './custom/combat.wav');
    expect(stdout).toContain(relative);
    expect(stdout).toContain(join(directory, 'custom', 'combat.json'));
    expect(JSON.parse(await readFile(join(directory, 'custom', 'combat.json'), 'utf8')))
      .toMatchObject({ id: 'combat', bus: 'music', audio: 'combat.wav' });
    const decodedRelative = decodeWav(await readFile(relative));
    expect(decodedRelative.sampleRate).toBe(44100);
    expect(decodedRelative.channelData[0].length).toBe((await audio.music.render('combat')).channelData[0].length);
    const absolute = join(directory, 'custom', 'victory.wav');
    await cli('sfx', 'victory', '--output', absolute);
    const decodedAbsolute = decodeWav(await readFile(absolute));
    expect(decodedAbsolute.sampleRate).toBe(44100);
    expect(JSON.parse(await readFile(join(directory, 'custom', 'victory.json'), 'utf8')))
      .toMatchObject({ id: 'victory', bus: 'sfx', audio: 'victory.wav' });
    expect(decodedAbsolute.channelData[0].length).toBe((await audio.sfx.render('victory')).channelData[0].length);
    expect((await readdir(directory + '/records')).includes('combat.wav')).toBe(true); // default path still used without -o
  });
  it('supports programmatic recording from a different working directory', async () => {
    const code = `import audio from ${JSON.stringify(api)}; console.log(await audio.sfx.record('coin', { volume: 0.3 }));`;
    const { stdout } = await exec(process.execPath, ['--input-type=module', '-e', code], { cwd: directory });
    expect(stdout.trim()).toBe(join(directory, 'records/coin.wav'));
    expect(JSON.parse(await readFile(join(directory, 'records/coin.json'), 'utf8')))
      .toMatchObject({ id: 'coin', bus: 'sfx', audio: 'coin.wav' });
  });
  it.each([
    ['sfx', 'laser'], ['sfx', 'exploration'], ['music', 'coin'], ['sfx', '../coin'],
    ['sfx', 'coin', '--volume', 'NaN'], ['sfx', 'coin', '--volume', '2'], ['ambient', 'coin'],
  ])('reports invalid invocation %s %s without a stack trace', async (...args) => {
    await expect(cli(...args)).rejects.toMatchObject({ code: 1 });
    try { await cli(...args); } catch (error) { expect(`${error.stderr}\n${error.stdout}`).toMatch(/error:/i); expect(error.stderr).not.toContain('    at '); }
  });
  it('reads an env file named beside the app flags, where it is typed', async () => {
    // Node's own --env-file is a runtime flag that has to precede the script; this one does not.
    await writeFile(join(directory, 'keys.env'), 'CYBERIA_TEST_CLI=present\n');
    const { stdout } = await cli('sfx', 'ui-click', '--env-file', 'keys.env');
    expect(stdout).toContain(`Environment ${join(directory, 'keys.env')}`);
    expect(stdout).toContain('Recorded sfx/ui-click');
  });
  it('refuses an env file that is not there', async () => {
    // Node validates a --env-file path wherever it appears and exits 9 before the app starts, so
    // the runtime reports this one; loadEnvFile's own message covers the programmatic path.
    await expect(cli('sfx', 'ui-click', '--env-file', 'absent.env')).rejects.toMatchObject({ code: 9 });
    try { await cli('sfx', 'ui-click', '--env-file', 'absent.env'); } catch (error) {
      expect(`${error.stderr}${error.stdout}`).toMatch(/absent\.env: not found/);
    }
  });
  it('uses --play as an explicit opt-in and rejects the old --no-play spelling', async () => {
    const { stdout } = await cli('--help');
    expect(stdout).toContain('--play');
    await expect(cli('sfx', 'ui-click', '--no-play')).rejects.toMatchObject({ code: 1 });
  });
  it('keeps --loop tied to playback, so it never opens a device on its own', async () => {
    await expect(cli('sfx', 'ui-click', '--loop')).rejects.toMatchObject({ code: 1 });
    try { await cli('sfx', 'ui-click', '--loop'); } catch (error) {
      expect(error.stderr).toContain('--loop applies to playback');
    }
    expect((await cli('--help')).stdout).toContain('--loop');
  });
});
