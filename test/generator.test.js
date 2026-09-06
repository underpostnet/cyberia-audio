import { describe, expect, it } from 'vitest';
import { mkdir, readdir, rm, utimes, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { GeminiClient, parseJsonLoose } from '../src/generator/gemini-client.js';
import { briefSystem, dspSystem, paramsSystem, proseSystem, repairSystem, signature } from '../src/generator/prompts.js';
import {
  dspSource,
  generateModule,
  indexSource,
  listExistingIds,
  manifestSource,
  musicalGridSource,
  musicalPlanFactory,
  paramsSource,
  planDuration,
  readmeSource,
  renderWrapperSource,
  slugify,
  sweepStagingDirectories,
} from '../src/generator/generate-module.js';

const root = fileURLToPath(new URL('../src/audio-modules/', import.meta.url));

// The generated half only synthesizes: normalization, the volume law and the boundary fade belong
// to the wrapper the pipeline appends.
const WORKING_SYNTHESIS = `export function synthesize({ sampleRate, duration, pitch }) {
  const frames = Math.round(sampleRate * duration);
  const samples = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    const t = i / sampleRate;
    samples[i] = Math.sin(2 * Math.PI * 660 * pitch * t) * Math.exp(-t * 6);
  }
  return [samples];
}`;

// Destructures a name the contract does not own, and uses it: the pipeline adopts it.
const ADOPTED_PARAM_SYNTHESIS = WORKING_SYNTHESIS.replaceAll('pitch', 'weight');
// Destructures a name the contract does not own, and then does not use it.
const UNKNOWN_PARAM_SYNTHESIS = WORKING_SYNTHESIS.replace('{ sampleRate, duration, pitch }', '{ sampleRate, duration, weight }');
const PLAIN_ARRAY_SYNTHESIS = WORKING_SYNTHESIS.replace('return [samples];', 'return [Array.from(samples)];');

// Plays the grid it was handed — bass on BASS, harmony on CHORDS, events on the step line — while
// being off-centre and ending nowhere near where it started: what the master stage exists to fix.
const BIASED_LOOP_SYNTHESIS = `export function synthesize({ sampleRate, volume, bpm }) {
  const frames = totalFrames(sampleRate, bpm);
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  const voice = Math.round(sampleRate * 0.45);
  for (let step = 0; step < STEPS; step += 4) {
    const start = stepFrame(step, sampleRate, bpm);
    const bar = stepBar(step);
    const low = frequency(BASS[bar]);
    const high = frequency(CHORDS[bar][1]);
    for (let i = 0; i < voice && start + i < frames; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 3.5);
      const value = Math.sin(2 * Math.PI * low * t) * envelope * 0.6 + 0.4;
      left[start + i] += value;
      right[start + i] += value * 0.9 + Math.sin(2 * Math.PI * high * t) * envelope * 0.2;
    }
  }
  return [left, right];
}`;

const BRIEF = {
  type: 'sfx',
  id: 'test-generated-chime',
  title: 'Test chime',
  tags: ['test', 'fixture', 'chime'],
  durationSeconds: 0.4,
  design: 'A single decaying sine bell.',
  voices: ['bell'],
  parameters: ['duration', 'pitch'],
};
// Plays the grid correctly, but writes one signal to both channels.
const MONO_IN_STEREO_SYNTHESIS = BIASED_LOOP_SYNTHESIS.replace(
  'right[start + i] += value * 0.9 + Math.sin(2 * Math.PI * high * t) * envelope * 0.2;',
  'right[start + i] += value;',
);

const MUSIC_BRIEF = {
  type: 'music',
  id: 'test-generated-phrase',
  title: 'Test phrase',
  tags: ['test', 'fixture', 'loop'],
  design: 'A four-bar bass and chord figure.',
  voices: ['bass', 'chord'],
  parameters: ['drive'],
  key: 'F Minor',
  progression: ['Fm', 'Ab', 'Cm', 'Db'],
  bpm: 128,
  bars: 4,
};
const CONTRACT = {
  params: { duration: 0.4, pitch: 1 },
  rules: { duration: [0.1, 2], pitch: [0.5, 2] },
  meaning: { duration: 'controls the ring', pitch: 'changes its register' },
};
const PROSE = { summary: 'A short test chime.', useFor: 'Fixtures and tests', soundDesign: 'A single decaying sine bell.' };

/** A client that answers each stage from a script, so the pipeline runs without the network. */
const fakeClient = (synthesisSources, parameterPayloads = [CONTRACT], brief = BRIEF) => {
  const remaining = [...synthesisSources];
  const parameters = [...parameterPayloads];
  const calls = [];
  const prompts = [];
  return {
    model: 'fake-model',
    calls,
    prompts,
    async chatJson({ system, user }) {
      const stage = system.includes('REPAIR:') ? 'repair' : system.match(/STAGE (\d)\/4/)?.[1];
      calls.push(stage);
      prompts.push({ stage, system, user });
      if (stage === '1') return brief;
      if (stage === '2') return parameters.length > 1 ? parameters.shift() : parameters[0];
      if (stage === '3' || stage === 'repair') return { source: remaining.shift() };
      if (stage === '4') return PROSE;
      throw new Error(`Unexpected stage prompt: ${system.slice(0, 80)}`);
    },
  };
};

describe('generator units', () => {
  it.each([
    ['Boss Alarm', 'boss-alarm'],
    ['  Deep__Cave   Drone ', 'deep-cave-drone'],
    ['Café Résumé!', 'cafe-resume'],
    ['--leading-and-trailing--', 'leading-and-trailing'],
  ])('slugifies %s into a semantic id', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it('writes the one module boundary every asset shares', () => {
    expect(indexSource()).toContain("import { render } from './dsp.js';");
    expect(indexSource()).toContain("import manifest from './manifest.json' with { type: 'json' };");
    expect(indexSource()).toContain('render(options = {}) { return render(getParams(options)); }');
  });

  it('writes a parameter contract the engine can resolve', () => {
    const source = paramsSource({ params: { sampleRate: 44100, volume: 0.8 }, rules: { sampleRate: [22050, 96000, true], volume: [0, 1] } });
    expect(source).toContain("import { resolveParams } from '../../../validation.js';");
    expect(source).toContain('export const getParams = (options = {}) => resolveParams(options, params, rules);');
  });

  it('wraps the generated synthesis between its grid and the render contract', () => {
    const effect = dspSource({ synthesis: WORKING_SYNTHESIS, loop: false });
    expect(effect.startsWith('/** Equal temperament')).toBe(true);
    expect(effect).toContain(WORKING_SYNTHESIS);
    expect(effect.match(/export function render\s*\(/g)).toHaveLength(1);
    expect(effect).toContain('const LOOP = false;');
    expect(effect).not.toContain("from 'tonal'");

    const phrase = dspSource({ synthesis: BIASED_LOOP_SYNTHESIS, loop: true, plan: musicalPlanFactory(MUSIC_BRIEF) });
    expect(phrase.startsWith("import { Chord, Note, Scale } from 'tonal';")).toBe(true);
    expect(phrase).toContain('const KEY = "F minor";');
    expect(phrase).toContain('const LOOP = true;');
  });

  it('repairs a musical plan instead of trusting it', () => {
    // tonal reads "F minor", never "F Minor"; a chord it cannot resolve would render as silence.
    expect(musicalPlanFactory(MUSIC_BRIEF)).toEqual({
      key: 'F minor',
      progression: ['Fm', 'Ab', 'Cm', 'Db'],
      bpm: 128,
      // Four bars at 128 is 7.5 seconds — a fragment, so the phrase doubles to eight bars.
      bars: 8,
    });
    expect(musicalPlanFactory({ key: 'H bogus', progression: ['Xyz', 'Nope'], bpm: 9000, bars: 3 })).toEqual({
      key: 'A minor',
      progression: ['Am', 'F', 'C', 'G'],
      bpm: 200,
      bars: 8,
    });
    expect(planDuration({ bars: 4 }, 120)).toBe(8);
  });

  it('lays the key out ascending, so no chord is left inverted', async () => {
    // The bug this exists to prevent: mapping tonal's names onto one octave folds F minor back on
    // itself at C (53 55 56 58 48 49 51) and turns Fm into [53, 56, 48], root above its own fifth.
    const directory = new URL('../src/audio-modules/music/.staging-test-grid-cccccccc/', import.meta.url);
    await mkdir(directory, { recursive: true });
    try {
      const source = musicalGridSource({ key: 'F minor', progression: ['Fm', 'Ab'], bars: 4 });
      await writeFile(
        new URL('grid.js', directory),
        `${source}\nexport { SCALE, CHORDS, BASS, frequency, totalFrames, stepFrame, stepBar, STEPS };`,
      );
      const grid = await import(new URL('grid.js', directory));
      expect(grid.SCALE.slice(0, 7)).toEqual([53, 55, 56, 58, 60, 61, 63]);
      expect(grid.SCALE.slice(7, 9)).toEqual([65, 67]);
      expect(grid.CHORDS).toEqual([
        [53, 56, 60],
        [56, 60, 63],
      ]);
      expect(grid.BASS).toEqual([41, 44]);
      expect(grid.frequency(69)).toBe(440);
      // Four bars at 120 bpm is eight seconds, and the step grid closes exactly on it.
      expect(grid.totalFrames(44100, 120)).toBe(44100 * 8);
      expect(grid.stepFrame(grid.STEPS, 44100, 120)).toBe(grid.totalFrames(44100, 120));
      expect(grid.stepBar(20)).toBe(1);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('stamps the house author and version into every manifest', () => {
    expect(JSON.parse(manifestSource({ id: 'a-b', type: 'sfx', tags: ['x'], duration: 1 })))
      .toEqual({ id: 'a-b', type: 'sfx', tags: ['x'], author: 'cyberia-audio', version: '0.1.0', duration: 1 });
  });

  it('composes every mechanical README sentence from the contract', () => {
    const markdown = readmeSource({
      id: 'blast-door',
      type: 'sfx',
      prose: { summary: 'A heavy door.', useFor: 'Doors and gates', soundDesign: 'A slam and a ring.' },
      params: { sampleRate: 44100, volume: 0.8, weight: 0.7 },
      rules: { sampleRate: [22050, 96000, true], volume: [0, 1], weight: [0, 1] },
      meaning: { weight: 'controls the mass of the impact' },
      measured: { duration: 1.42, loop: false, channels: 1 },
    });
    expect(markdown).toContain('# blast-door');
    expect(markdown).toContain('Use for: Doors and gates.');
    expect(markdown).toContain('`weight` (0–1, default 0.7) controls the mass of the impact.');
    expect(markdown).toContain('Mono, one shot, about 1.42 seconds by default');
    expect(markdown).toContain("await audio.sfx.record('blast-door'); // records/blast-door.wav");
    expect(markdown).toContain('cyberia-audio sfx blast-door');
    // The seed sentence is boilerplate for a module that owns no seed.
    expect(markdown).not.toContain('Seeds accept integers');
  });

  it('states the parameter contract in one line instead of two JSON blocks', () => {
    expect(signature({ params: { volume: 0.8, seed: 7 }, rules: { volume: [0, 1], seed: [0, 4294967295, true] } }))
      .toBe('volume=0.8 [0..1], seed=7 [0..4294967295 int]');
  });

  it('parses JSON out of fences and prose', () => {
    expect(parseJsonLoose('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonLoose('Sure!\n{"a":[1,2]}\nHope that helps.')).toEqual({ a: [1, 2] });
    expect(() => parseJsonLoose('no json here')).toThrow('no JSON object');
  });

  it('finds the answer of a model that narrates its plan and quotes the schema back', () => {
    // The shape an open instruction-tuned model actually returns: a plan that repeats the
    // requested format as an example, and only then the answer.
    const narrated = [
      '*   Task: write the synthesis.',
      '*   Format: JSON `{"source": "<javascript>"}`.',
      '*   Note: braces inside the code must not confuse the reader.',
      '',
      '{"source": "export function synthesize({ a }) { return [a]; }"}',
    ].join('\n');
    expect(parseJsonLoose(narrated).source).toBe('export function synthesize({ a }) { return [a]; }');
  });

  it('refuses to construct a client without a key', () => {
    expect(() => new GeminiClient({ apiKey: '' })).toThrow('GEMINI_API_KEY');
  });
});

describe('prompt budget', () => {
  const systems = {
    brief: briefSystem({}),
    params: paramsSystem(),
    dsp: dspSystem({ loop: true }),
    prose: proseSystem(),
    repair: repairSystem({ loop: true }),
  };

  // The synthesis stage is where quality is bought — it carries the grid's whole surface — so it
  // is allowed more room than the stages that only shuffle metadata.
  const budget = { brief: 1200, params: 800, dsp: 2200, prose: 700, repair: 2500 };
  it.each(Object.entries(systems))('keeps the %s stage prompt within budget', (name, system) => {
    expect(system.length, name).toBeLessThan(budget[name]);
  });

  it('never asks the model for a structure the pipeline writes itself', () => {
    // Every one of these appears in a generated module, and none of them is worth a token.
    for (const [name, system] of Object.entries(systems)) {
      for (const boilerplate of ['resolveParams', 'manifest.json\' with', 'Object.freeze', 'getParams', 'author', 'version']) {
        expect(system, `${name} / ${boilerplate}`).not.toContain(boilerplate);
      }
    }
  });
});

describe('module generation pipeline', () => {
  it('runs every stage and verifies the module before installing it', async () => {
    const client = fakeClient([WORKING_SYNTHESIS]);
    const before = await listExistingIds('sfx');
    const result = await generateModule({ prompt: 'a small test chime', client, dryRun: true });

    expect(client.calls).toEqual(['1', '2', '3', '4']);
    expect(result).toMatchObject({ type: 'sfx', id: 'test-generated-chime', repairs: 0, model: 'fake-model' });
    expect(Object.keys(result.files).sort()).toEqual(['README.md', 'dsp.js', 'index.js', 'manifest.json', 'params.js']);
    expect(result.measured).toMatchObject({ channels: 1, loop: false });
    expect(result.measured.duration).toBeCloseTo(0.4, 4);

    // The wrapper owns loudness: volume is the fraction of full scale the peak reaches.
    expect(result.measured.peak).toBeCloseTo(0.8 * 0.98, 3);

    const manifest = JSON.parse(result.files['manifest.json']);
    expect(manifest).toMatchObject({ id: 'test-generated-chime', type: 'sfx', author: 'cyberia-audio', version: '0.1.0' });
    expect(manifest.duration).toBeCloseTo(result.measured.duration, 10);
    expect(result.files['params.js']).toContain('"sampleRate": 44100');
    expect(result.files['index.js']).toBe(indexSource());
    expect(result.files['dsp.js']).toBe(dspSource({ synthesis: WORKING_SYNTHESIS, loop: false }));
    expect(result.files['README.md']).toContain('`duration` (0.1–2, default 0.4) controls the ring');

    // A dry run leaves the vocabulary and the tree exactly as it found them.
    expect(await listExistingIds('sfx')).toEqual(before);
    expect(result.directory).toBe(null);
    expect((await readdir(`${root}sfx`)).some((name) => name.startsWith('.staging-'))).toBe(false);
  });

  it('sends each stage only its own delta', async () => {
    const client = fakeClient([WORKING_SYNTHESIS]);
    await generateModule({ prompt: 'a small test chime', client, dryRun: true });
    const byStage = Object.fromEntries(client.prompts.map(({ stage, user }) => [stage, user]));

    // The raw intent is stage 1 business; later stages carry the resolved brief instead.
    expect(byStage['1']).toContain('a small test chime');
    for (const stage of ['2', '3', '4']) expect(byStage[stage], stage).not.toContain('a small test chime');
    // The parameter contract travels as one line, and only where it is needed.
    expect(byStage['3']).toContain('synthesize({ sampleRate, volume, duration, pitch }) — sampleRate=44100');
    expect(byStage['3']).not.toContain('"rules"');
    expect(byStage['4']).not.toContain('synthesize');
    for (const { user } of client.prompts) expect(user.length).toBeLessThan(500);
  });

  it('reports a parameter the synthesis destructures but the contract does not own', async () => {
    const client = fakeClient([UNKNOWN_PARAM_SYNTHESIS]);
    await expect(generateModule({ prompt: 'a small test chime', client, dryRun: true, repairs: 0 }))
      .rejects.toThrow(/destructures parameters the contract does not own: weight/);
  });

  it('reports a synthesis whose output the wrapper cannot render', async () => {
    const client = fakeClient([PLAIN_ARRAY_SYNTHESIS]);
    await expect(generateModule({ prompt: 'a small test chime', client, dryRun: true, repairs: 0 }))
      .rejects.toThrow(/Float32Array channels/);
    expect((await readdir(`${root}sfx`)).some((name) => name.startsWith('.staging-'))).toBe(false);
  });

  it('repairs a rejected synthesis and reports how many passes it took', async () => {
    const client = fakeClient([UNKNOWN_PARAM_SYNTHESIS, WORKING_SYNTHESIS]);
    const result = await generateModule({ prompt: 'a small test chime', client, dryRun: true, repairs: 1 });
    // The extra '2' is the adoption attempt: this scripted client offers no contract for `weight`,
    // so the mismatch survives it and the repair pass is what fixes the source.
    expect(client.calls).toEqual(['1', '2', '3', '2', 'repair', '4']);
    expect(result.repairs).toBe(1);
    // The repair pass carries the diagnostics and the rejected source, not the brief again.
    const repair = client.prompts.find(({ stage }) => stage === 'repair').user;
    expect(repair).toContain('Diagnostics:');
    expect(repair).toContain(UNKNOWN_PARAM_SYNTHESIS);
    expect(repair).not.toContain('Design:');
  });

  it('centres the mix and closes a loop the synthesis left open', async () => {
    // The synthesis carries a 0.4 offset, a rising drift and no seam. None of that reaches
    // verification, because the wrapper owns DC, the loop join and the boundaries: a repair pass
    // is spent on sound design, never on gain staging.
    const client = fakeClient([BIASED_LOOP_SYNTHESIS], [CONTRACT], MUSIC_BRIEF);
    const result = await generateModule({ prompt: 'a test phrase', client, dryRun: true });
    expect(client.calls).toEqual(['1', '2', '3', '4']);
    expect(result.repairs).toBe(0);
    expect(result.measured).toMatchObject({ loop: true, channels: 2 });
    expect(result.measured.peak).toBeCloseTo(0.8 * 0.98, 3);
    expect(result.files['dsp.js']).toContain('const LOOP = true;');
    // Eight bars at 128 bpm, to the frame: the loop repeats exactly on the bar line.
    expect(result.measured.duration).toBeCloseTo(15, 6);
    expect(JSON.parse(result.files['manifest.json']).duration).toBeCloseTo(15, 6);
    // The tempo is a parameter of every phrase, whatever the parameter stage answered.
    expect(result.files['params.js']).toContain('"bpm": 128');
  });

  it('rejects a phrase that writes its own tuning and its own bar line', async () => {
    // The shape of the complaint this grid exists to answer: a raw frequency, a length in seconds
    // and no rhythm, which is a phrase in no key and on no beat.
    const offGrid = `export function synthesize({ sampleRate, volume, bpm }) {
      const frames = Math.round(sampleRate * 12);
      const left = new Float32Array(frames);
      const right = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        const value = Math.sin(2 * Math.PI * 331.7 * (i / sampleRate)) * 0.5;
        left[i] = value;
        right[i] = value;
      }
      return [left, right];
    }`;
    const client = fakeClient([offGrid], [CONTRACT], MUSIC_BRIEF);
    const failure = generateModule({ prompt: 'a test phrase', client, dryRun: true, repairs: 0 });
    await expect(failure).rejects.toThrow(/totalFrames\(sampleRate, bpm\)/);
    await expect(failure).rejects.toThrow(/frequency\(midi\)/);
    await expect(failure).rejects.toThrow(/stepFrame/);
  });

  it('rejects a phrase that writes the same samples to both channels', async () => {
    // Stereo is not two copies of a mono mix; a phrase that never places a voice has no width.
    const client = fakeClient([MONO_IN_STEREO_SYNTHESIS], [CONTRACT], MUSIC_BRIEF);
    await expect(generateModule({ prompt: 'a test phrase', client, dryRun: true, repairs: 0 })).rejects.toThrow(
      /renders in stereo/,
    );
  });

  it('adopts a parameter the synthesis introduced rather than failing on it', async () => {
    const client = fakeClient(
      [ADOPTED_PARAM_SYNTHESIS],
      [CONTRACT, { params: { weight: 1 }, rules: { weight: [0.5, 2] }, meaning: { weight: 'sets the strike' } }],
    );
    const result = await generateModule({ prompt: 'a small test chime', client, dryRun: true });
    expect(client.calls).toEqual(['1', '2', '3', '2', '4']);
    expect(result.repairs).toBe(0);
    // The contract follows the code: the name is owned, ruled, documented and validated.
    expect(result.files['params.js']).toContain('"weight": 1');
    expect(result.files['params.js']).toContain('"weight": [\n    0.5,\n    2\n  ]');
    expect(result.files['README.md']).toContain('`weight` (0.5–2, default 1) sets the strike');
    expect(() => JSON.parse(result.files['manifest.json'])).not.toThrow();
  });

  it('sweeps staging directories an interrupted run left behind', async () => {
    // An hour-old leftover is abandoned; a fresh one may belong to a generation running right now.
    const stale = new URL('../src/audio-modules/sfx/.staging-test-stale-aaaaaaaa/', import.meta.url);
    const fresh = new URL('../src/audio-modules/sfx/.staging-test-fresh-bbbbbbbb/', import.meta.url);
    await mkdir(stale, { recursive: true });
    await mkdir(fresh, { recursive: true });
    const old = Date.now() / 1000 - 7200;
    await utimes(stale, old, old);
    try {
      expect(await sweepStagingDirectories('sfx')).toEqual(['.staging-test-stale-aaaaaaaa']);
      const names = await readdir(new URL('../src/audio-modules/sfx/', import.meta.url));
      expect(names).not.toContain('.staging-test-stale-aaaaaaaa');
      expect(names).toContain('.staging-test-fresh-bbbbbbbb');
      // Neither was ever dispatchable: the discovery filter rejects the name.
      expect(await listExistingIds('sfx')).not.toContain('.staging-test-fresh-bbbbbbbb');
    } finally {
      await rm(fresh, { recursive: true, force: true });
      await rm(stale, { recursive: true, force: true });
    }
  });

  it('refuses a domain it cannot dispatch', async () => {
    await expect(generateModule({ prompt: 'a small test chime', type: 'ambient', client: fakeClient([]) })).rejects.toThrow('sfx');
    await expect(generateModule({ prompt: '', client: fakeClient([]) })).rejects.toThrow('prompt');
  });
});
