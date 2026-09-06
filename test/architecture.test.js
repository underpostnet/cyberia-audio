import { afterAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, sep } from 'node:path';
import { dispatch, listAssets, resolveAudioModule } from '../src/dispatcher.js';
import { validateAudioResult } from '../src/validation.js';

const root = fileURLToPath(new URL('../src/audio-modules/', import.meta.url));
const ids = {
  sfx: ['coin', 'explosion', 'heal', 'player-hit', 'shoot', 'ui-click'],
  music: ['combat', 'exploration', 'mystery', 'victory'],
};
const digest = (result) => {
  const hash = createHash('sha256');
  for (const channel of result.channelData) hash.update(new Uint8Array(channel.buffer));
  return hash.digest('hex');
};

describe('filesystem dispatch', () => {
  it.each(Object.keys(ids))('discovers the %s vocabulary', async (type) => {
    expect(await listAssets(type)).toEqual(ids[type]);
  });
  it('rejects invalid domains before resolution', async () => {
    await expect(dispatch('ambient', 'coin')).rejects.toThrow('domain');
  });
  it.each(['../coin', '/coin', 'Coin', '', 'coin.js', 'coin%2f', 'a\\b', null])('rejects invalid ID %s', async (id) => {
    await expect(resolveAudioModule('sfx', id)).rejects.toThrow('Semantic ID');
  });
  it('reports unknown IDs with available names', async () => {
    await expect(resolveAudioModule('sfx', 'laser')).rejects.toThrow(/Unknown SFX: laser\nAvailable SFX:\n  coin/);
  });
  it('keeps the domains separate', async () => {
    await expect(resolveAudioModule('sfx', 'combat')).rejects.toThrow('Unknown SFX');
    await expect(resolveAudioModule('music', 'coin')).rejects.toThrow('Unknown Music');
  });
});

describe('isolated asset contracts and audio', () => {
  for (const [type, names] of Object.entries(ids)) {
    for (const id of names) {
      it(`${type}/${id}: independent source, valid PCM, determinism, parameters`, async () => {
        const directory = resolve(root, type, id);
        expect((await readdir(directory)).sort()).toEqual(['README.md', 'dsp.js', 'index.js', 'manifest.json', 'params.js']);
        const manifest = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8'));
        expect(manifest).toMatchObject({ id, type, author: 'cyberia-audio', version: '0.1.0' });
        const asset = await resolveAudioModule(type, id);
        expect(asset).toMatchObject({ id, type, render: expect.any(Function) });
        const result = validateAudioResult(await asset.render());
        expect(result.duration).toBeCloseTo(manifest.duration, 4);
        let peak = 0, energy = 0, sum = 0;
        const count = result.channelData.length * result.channelData[0].length;
        for (const channel of result.channelData) {
          for (const sample of channel) { peak = Math.max(peak, Math.abs(sample)); energy += sample ** 2; sum += sample; }
          expect(Math.abs(channel[0] - channel.at(-1))).toBeLessThan(0.03);
          if (!result.loop) { expect(Math.abs(channel[0])).toBe(0); expect(Math.abs(channel.at(-1))).toBe(0); }
        }
        expect(peak).toBeGreaterThan(0.1);
        expect(Math.sqrt(energy / count)).toBeGreaterThan(0.01);
        expect(Math.abs(sum / count)).toBeLessThan(0.005);
        expect(digest(result)).toBe(digest(await asset.render()));
        const quiet = await asset.render({ sampleRate: 22050, volume: 0 });
        expect(quiet.channelData.every((channel) => channel.every((value) => value === 0))).toBe(true);
        expect(() => asset.render({ volume: 2 })).toThrow('volume');
        expect(() => asset.render({ sampleRate: NaN })).toThrow('sampleRate');
        expect(() => asset.render({ unexpected: 1 })).toThrow('Unknown parameter');
        expect(() => asset.render(null)).toThrow('plain object');

        // Check EVERY local source import, not just index.js: only this asset,
        // general data validation, built-ins, or explicitly allowed packages.
        const allowed = Object.keys(JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).dependencies);
        for (const file of ['index.js', 'dsp.js', 'params.js']) {
          const source = await readFile(resolve(directory, file), 'utf8');
          expect(source).not.toMatch(/Math\.random\s*\(/);
          for (const match of source.matchAll(/(?:from\s*|import\s*\(?\s*)['"]([^'"]+)['"]/g)) {
            const specifier = match[1];
            if (specifier.startsWith('.')) {
              const target = resolve(dirname(resolve(directory, file)), specifier);
              expect(target.startsWith(directory + sep) || target === resolve(root, '../validation.js')).toBe(true);
            } else {
              expect(allowed.some((name) => specifier === name || specifier.startsWith(name + '/'))).toBe(true);
            }
          }
          expect(source).not.toMatch(/@audio\/speaker|node-wav|node:fs|node:child_process/);
        }
      });
    }
  }
  it('keeps sounds differentiated and noise controllable', async () => {
    const fingerprints = new Set();
    for (const id of ids.sfx) fingerprints.add(digest((await dispatch('sfx', id, {}, { play: false })).audio));
    expect(fingerprints.size).toBe(6);
    for (const [type, id] of [['sfx', 'shoot'], ['sfx', 'explosion'], ['sfx', 'player-hit'], ['music', 'combat']]) {
      const asset = await resolveAudioModule(type, id);
      expect(digest(await asset.render({ seed: 0 }))).not.toBe(digest(await asset.render({ seed: 1 })));
    }
  });
  it('has no shared DSP directories', async () => {
    expect((await readdir(root)).sort()).toEqual(['music', 'sfx']);
  });
});

describe('contract rejection', () => {
  const valid = () => ({ sampleRate: 44100, channelData: [new Float32Array([0, 0.5, -0.5])] });
  it('derives duration from samples', () => {
    expect(validateAudioResult({ ...valid(), duration: 999 }).duration).toBe(3 / 44100);
  });
  it.each([
    null, {}, { sampleRate: 1, channelData: [new Float32Array(2)] },
    { sampleRate: 44100, channelData: [] },
    { sampleRate: 44100, channelData: [[0, 1]] },
    { sampleRate: 44100, channelData: [new Float32Array(0)] },
    { sampleRate: 44100, channelData: [new Float32Array(2), new Float32Array(3)] },
    { sampleRate: 44100, channelData: [new Float32Array([NaN])] },
    { sampleRate: 44100, channelData: [new Float32Array([Infinity])] },
    { sampleRate: 44100, channelData: [new Float32Array([1.1])] },
    { ...valid(), loop: 'yes' },
  ])('rejects malformed output %#', (result) => {
    expect(() => validateAudioResult(result)).toThrow('Invalid audio result');
  });
});

// An actual new directory must be sufficient; no registry or dispatcher edits.
describe('extension boundary', () => {
  const directory = resolve(root, 'sfx', 'test-extension');
  afterAll(() => rm(directory, { recursive: true, force: true }));
  it('discovers a newly added module and validates its rendered result', async () => {
    await mkdir(directory);
    await writeFile(resolve(directory, 'index.js'), `export default {
      id: 'test-extension', type: 'sfx',
      render: () => ({ sampleRate: 22050, channelData: [new Float32Array([0, 0.2, 0])] })
    };`);
    const { audio } = await dispatch('sfx', 'test-extension', {}, { play: false });
    expect(audio.sampleRate).toBe(22050);
    expect(audio.channelData[0][1]).toBeCloseTo(0.2);

    // A module with no manifest.json or params.js still records a valid pair.
    const output = await mkdtemp(join(tmpdir(), 'cyberia-audio-extension-'));
    const { path, manifestPath } = await dispatch('sfx', 'test-extension', {}, {
      play: false, record: true, path: join(output, 'test-extension.wav'),
    });
    expect(manifestPath).toBe(join(output, 'test-extension.json'));
    expect(JSON.parse(await readFile(manifestPath, 'utf8'))).toEqual({
      id: 'test-extension', type: 'sfx', tags: [], author: '', version: '',
      duration: 3 / 22050, sampleRate: 22050, channels: 1, loop: false,
      audio: 'test-extension.wav', defaults: {}, parameters: {},
    });
    expect((await readFile(path)).toString('ascii', 0, 4)).toBe('RIFF');
    await rm(output, { recursive: true, force: true });
    await rm(directory, { recursive: true });
  });
});
