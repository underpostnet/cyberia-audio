/**
 * AI-driven module generation pipeline.
 *
 * Turns one natural-language game intent into a complete audio module under
 * src/audio-module/<bus-id>/<id>/. The division of labour is deliberate: the model produces only
 * what differs between modules — identity, parameter values, the synthesis body and three
 * paragraphs of prose — while every structure that is identical in every module is written here
 * from a template. The module boundary, the parameter file, the render wrapper, the manifest
 * envelope and the mechanical README sentences are therefore consistent by construction rather
 * than by instruction, and no token is spent regenerating them.
 *
 * Generation happens in a hidden staging directory beside its destination, at the same depth so
 * `../../../validation.js` resolves exactly as it will after installation. The dispatcher's
 * discovery filter ignores the staging name, so a half-written module is never dispatchable, and
 * a failed run leaves the tree untouched.
 */

import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { Chord, Note, Scale } from 'tonal';
import { GeminiClient } from './gemini-client.js';
import { briefSystem, dspSystem, paramsSystem, proseSystem, repairSystem, signature } from './prompts.js';
import { AUDIO_BUSES, validateAudioResult } from '../validation.js';

const moduleRoot = new URL('../audio-module/', import.meta.url);
const validationModule = new URL('../validation.js', import.meta.url);
const packageManifest = new URL('../../package.json', import.meta.url);

export const MODULE_FILES = Object.freeze(['README.md', 'dsp.js', 'index.js', 'manifest.json', 'params.js']);
const AUTHOR = 'cyberia-audio';
const VERSION = '0.1.0';
const ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
// Owned by the engine, not by the model: every module accepts the same two.
const BASE_PARAMS = { sampleRate: 44100, volume: 0.8 };
const BASE_RULES = { sampleRate: [22050, 96000, true], volume: [0, 1] };
const FORBIDDEN_SOURCE = /@audio\/speaker|node-wav|node:fs|node:child_process|node:net|node:http/;
const STAGING_PREFIX = '.staging-';
const BEATS_PER_BAR = 4;
const STEPS_PER_BEAT = 4;
const BAR_CHOICES = [2, 4, 8];
const DEFAULT_PLAN = Object.freeze({ key: 'A minor', progression: ['Am', 'F', 'C', 'G'], bpm: 110, bars: 4 });
// Names the injected grid already binds. A synthesis that redeclares one is a duplicate binding.
const GRID_NAMES = [
  'KEY', 'PROGRESSION', 'BARS', 'BEATS_PER_BAR', 'STEPS_PER_BEAT', 'STEPS', 'ROOT_OCTAVE',
  'ascending', 'DEGREES', 'SCALE', 'CHORDS', 'BASS', 'frequency', 'totalFrames', 'stepFrame', 'stepBar',
];
const STALE_STAGING_MS = 60 * 60 * 1000;

/** Lowercase words joined by single hyphens: the only identifier the dispatcher resolves. */
export function slugify(input) {
  return String(input ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s_-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
    .replace(/-$/, '');
}

/** The module boundary. Identical in every asset, so the pipeline writes it rather than the model. */
export const indexSource = () =>
  `import { render } from './dsp.js';
import { getParams } from './params.js';
import manifest from './manifest.json' with { type: 'json' };

export default Object.freeze({
  id: manifest.id,
  bus: manifest.bus,
  render(options = {}) { return render(getParams(options)); },
});`;

/** The parameter contract, in the shape `src/runtime/manifest.js` reads back. */
export const paramsSource = ({ params, rules }) =>
  `import { resolveParams } from '../../../validation.js';

export const params = Object.freeze(${JSON.stringify(params, null, 2)});

export const rules = ${JSON.stringify(rules, null, 2)};

export const getParams = (options = {}) => resolveParams(options, params, rules);
`;

/**
 * The half of dsp.js that never varies: output shape checks, peak normalization, the volume law
 * and — for a one-shot — the zero-valued boundaries the engine requires.
 *
 * Holding these here rather than asking for them per module is what makes the contract structural.
 * A generated synthesis can be quiet, loud or clipped and still produce a valid render, so the
 * repair passes are spent on sound design rather than on gain staging.
 */
export const renderWrapperSource = ({ loop }) =>
  `const LOOP = ${loop === true};
const HEADROOM = 0.98;
const EDGE_SECONDS = 0.005;

export function render(params) {
  const { sampleRate, volume } = params;
  const channelData = synthesize(params);
  if (!Array.isArray(channelData) || channelData.length < 1 || channelData.length > 2) {
    throw new TypeError('synthesize() must return one or two channels.');
  }
  const frames = channelData[0]?.length ?? 0;
  const edge = Math.min(Math.round(sampleRate * EDGE_SECONDS), Math.floor(frames / 2));
  let peak = 0;
  for (const channel of channelData) {
    if (!(channel instanceof Float32Array) || channel.length !== frames || frames === 0) {
      throw new TypeError('synthesize() must return equally sized, non-empty Float32Array channels.');
    }
    // Each channel is centred on its own mean — a stereo mix can sit off-centre on one side while
    // the pair averages to zero — then closed: a loop rejoins its own first sample, a one-shot
    // falls to silence at both ends. Normalization comes last, so the peak is what is returned.
    let sum = 0;
    for (const value of channel) {
      if (!Number.isFinite(value)) throw new TypeError('synthesize() produced a non-finite sample.');
      sum += value;
    }
    const offset = sum / frames;
    for (let i = 0; i < frames; i++) channel[i] -= offset;
    if (edge > 0 && LOOP) {
      for (let i = frames - edge; i < frames; i++) {
        const t = (i - (frames - edge) + 1) / edge;
        channel[i] = channel[i] * (1 - t) + channel[0] * t;
      }
    } else if (edge > 0) {
      for (let i = 0; i < edge; i++) {
        channel[i] *= i / edge;
        channel[frames - 1 - i] *= i / edge;
      }
    }
    for (const value of channel) peak = Math.max(peak, Math.abs(value));
  }
  const gain = peak > 0 ? (volume * HEADROOM) / peak : 0;
  for (const channel of channelData) for (let i = 0; i < frames; i++) channel[i] *= gain;
  return { sampleRate, channelData, loop: LOOP };
}`;

/**
 * Validates the musical plan a brief proposes, and repairs it rather than trusting it.
 *
 * A key tonal cannot resolve, a chord symbol it does not know, or a tempo outside the range the
 * parameter rule allows would each reach the render as silence or as a wrong pitch. Every value is
 * therefore checked against tonal here, at generation time, and replaced when it does not hold.
 * @param {object} [brief={}] - The identity stage's answer.
 * @returns {{key: string, progression: Array<string>, bpm: number, bars: number}} A usable plan.
 */
export function musicalPlanFactory(brief = {}) {
  // tonal reads the tonic capitalised and the mode in lower case, which is not how a model writes it.
  const written = String(brief.key ?? '').trim();
  const proposedKey = written ? written[0].toUpperCase() + written.slice(1).toLowerCase() : '';
  const key = proposedKey && !Scale.get(proposedKey).empty ? proposedKey : DEFAULT_PLAN.key;
  const proposed = (Array.isArray(brief.progression) ? brief.progression : [])
    .map((symbol) => String(symbol).trim())
    .filter((symbol) => symbol && !Chord.get(symbol).empty);
  const bpm = Math.min(200, Math.max(60, Math.round(Number(brief.bpm) || DEFAULT_PLAN.bpm)));
  let bars = BAR_CHOICES.includes(Number(brief.bars)) ? Number(brief.bars) : DEFAULT_PLAN.bars;
  // A phrase shorter than eight seconds is a fragment, not a loop to score a scene with.
  while (bars < Math.max(...BAR_CHOICES) && (bars * BEATS_PER_BAR * 60) / bpm < 8) bars *= 2;
  return { key, progression: proposed.length ? proposed.slice(0, 8) : DEFAULT_PLAN.progression, bpm, bars };
}

/** The phrase length a plan implies: a whole number of bars at the tempo actually rendered. */
export const planDuration = ({ bars }, bpm) => (bars * BEATS_PER_BAR * 60) / bpm;

/**
 * The musical grid every generated phrase is written on.
 *
 * Pitch and time are settled here rather than asked for: the model chooses what to play, never
 * what to play it on. That is what keeps a generated phrase in one key, in equal temperament and
 * on the bar line — and what makes its loop repeat exactly where it started.
 */
export const musicalGridSource = ({ key, progression, bars }) =>
  `import { Chord, Note, Scale } from 'tonal';

const KEY = ${JSON.stringify(key)};
const PROGRESSION = ${JSON.stringify(progression)};
const BARS = ${bars};
const BEATS_PER_BAR = ${BEATS_PER_BAR};
const STEPS_PER_BEAT = ${STEPS_PER_BEAT};
const STEPS = BARS * BEATS_PER_BAR * STEPS_PER_BEAT;
const ROOT_OCTAVE = 3;

// tonal names one pitch class per degree, so each has to be lifted into the octave above the one
// before it. Without this the scale folds back on itself at C and every chord inverts — which is
// exactly what makes generated music sound out of tune.
const ascending = (names, octave) =>
  names.reduce((midi, name) => {
    let value = Note.midi(\`\${name}\${octave}\`);
    while (midi.length && value < midi.at(-1)) value += 12;
    midi.push(value);
    return midi;
  }, []);

const DEGREES = ascending(Scale.get(KEY).notes, ROOT_OCTAVE);
/** Three ascending octaves of the key, for melody and pads. */
const SCALE = [DEGREES, DEGREES.map((midi) => midi + 12), DEGREES.map((midi) => midi + 24)].flat();
/** One chord per bar, root position, ascending MIDI. */
const CHORDS = PROGRESSION.map((symbol) => ascending(Chord.get(symbol).notes, ROOT_OCTAVE));
/** Each bar's root, an octave below its chord. */
const BASS = CHORDS.map((chord) => chord[0] - 12);
/** Equal temperament, A4 = 440 Hz. */
const frequency = (midi) => 440 * 2 ** ((midi - 69) / 12);
/** Frames in the phrase: a whole number of bars, so the loop repeats on the bar line. */
const totalFrames = (sampleRate, bpm) => Math.round((BARS * BEATS_PER_BAR * 60 * sampleRate) / bpm);
/** First frame of a sixteenth-note step, 0 … STEPS - 1. */
const stepFrame = (step, sampleRate, bpm) => Math.round((step * 15 * sampleRate) / bpm);
/** The bar a step falls in, for indexing CHORDS and BASS. */
const stepBar = (step) => Math.floor(step / (BEATS_PER_BAR * STEPS_PER_BEAT)) % PROGRESSION.length;`;

/** A one-shot needs no key, only real pitches. */
export const effectGridSource = () =>
  `/** Equal temperament, A4 = 440 Hz: a tuned voice lands on a real pitch. */
const frequency = (midi) => 440 * 2 ** ((midi - 69) / 12);`;

/** The grid, then the generated synthesis, then the wrapper that meets the rendering contract. */
export const dspSource = ({ synthesis, loop, plan }) =>
  [
    loop ? musicalGridSource(plan) : effectGridSource(),
    String(synthesis).trim(),
    renderWrapperSource({ loop }),
  ].join('\n\n');

export const manifestSource = ({ id, bus, tags, duration }) =>
  JSON.stringify({ id, bus, tags, author: AUTHOR, version: VERSION, duration }, null, 2);

const range = ([min, max, integer]) => `${min}–${max}${integer ? ', integer' : ''}`;

/**
 * The module README. Only the three paragraphs a reader could not derive are generated; the
 * parameter sentence, the contract paragraph and the usage examples are composed from the
 * contract itself, so every module documents the engine identically.
 */
export const readmeSource = ({ id, bus, prose, params, rules, meaning, measured, plan = null }) => {
  const owned = Object.keys(params).filter((key) => !(key in BASE_PARAMS));
  const described = owned
    .map((key) => `\`${key}\` (${range(rules[key])}, default ${params[key]})${meaning[key] ? ` ${meaning[key]}` : ''}`)
    .join('; ');
  const seconds = measured.duration.toFixed(2);
  // A phrase states its music: the key, the progression and the bars it actually runs.
  const music = plan
    ? ` — ${plan.bars} bars of ${plan.key} at ${params.bpm ?? plan.bpm} bpm, ${plan.progression.join(' – ')}`
    : '';
  const shape = measured.loop
    ? `${measured.channels === 1 ? 'Mono' : 'Stereo'}; duration is about ${seconds} seconds by default${music}. \`loop: true\` marks a phrase suitable for repetition; playback plays it once.`
    : `${measured.channels === 1 ? 'Mono' : 'Stereo'}, one shot, about ${seconds} seconds by default, with a short fade at both boundaries.`;
  return `# ${id}

${prose.summary}

Use for: ${prose.useFor}.

## Sound design

${prose.soundDesign}

## Parameters and output

${described ? `${described}.\n\n` : ''}All parameters are optional. \`sampleRate\` accepts integers from 22050 to 96000 (default ${BASE_PARAMS.sampleRate}); \`volume\` accepts 0–1 (default ${params.volume}).${owned.includes('seed') ? ' Seeds accept integers from 0 to 4294967295.' : ''} Invalid or unknown parameters are rejected.

${shape} Rendering returns \`{ sampleRate, channelData: Float32Array[], loop }\` with samples in [-1, 1]. Rendering never opens a speaker or writes files. Playback and 16-bit WAV encoding consume the same samples.

## Usage

\`\`\`js
import audio from 'cyberia-audio';

const playback = await audio.${bus}.play('${id}');
await playback.done;
await audio.${bus}.record('${id}'); // records/${id}.wav
\`\`\`

\`\`\`sh
cyberia-audio ${bus} ${id}
\`\`\`
`;
};

/** Ids already taken on a bus: the model is shown them, and a collision is refused. */
export async function listExistingIds(bus, root = moduleRoot) {
  const entries = await readdir(new URL(`${bus}/`, root), { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isDirectory() && ID_PATTERN.test(entry.name))
    .map(({ name }) => name)
    .sort();
}

/**
 * Removes staging directories an interrupted run left behind.
 *
 * A generation killed mid-call never reaches its own cleanup, and what it leaves is invisible to
 * the dispatcher but not to the person reading the tree. Only directories older than an hour are
 * swept, so a generation running alongside this one keeps its staging area.
 * @param {string} bus - Bus directory to sweep.
 * @param {URL} [root=moduleRoot] - Audio module root.
 * @returns {Promise<Array<string>>} The names that were removed.
 */
export async function sweepStagingDirectories(bus, root = moduleRoot) {
  const parent = new URL(`${bus}/`, root);
  const entries = await readdir(parent, { withFileTypes: true }).catch(() => []);
  const swept = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith(STAGING_PREFIX)) continue;
    const directory = new URL(`${entry.name}/`, parent);
    const { mtimeMs } = await stat(directory).catch(() => ({ mtimeMs: Date.now() }));
    if (Date.now() - mtimeMs <= STALE_STAGING_MS) continue;
    await rm(directory, { recursive: true, force: true });
    swept.push(entry.name);
  }
  return swept;
}

const digest = (result) => {
  const hash = createHash('sha256');
  for (const channel of result.channelData) hash.update(new Uint8Array(channel.buffer));
  return hash.digest('hex');
};

const exists = (url) =>
  stat(url).then(
    () => true,
    () => false,
  );

/** A rejection is the assertion here: an unowned or out-of-range option must never render. */
async function rejection(render, options) {
  try {
    await render(options);
    return null;
  } catch (error) {
    return error.message;
  }
}

/**
 * Where the generated half of dsp.js has to meet the templated half.
 *
 * A parameter the synthesis destructures but the contract does not own resolves to `undefined`
 * and reaches the render as NaN samples, which the audio validator reports as malformed output
 * several steps from the cause. Naming it here makes the mismatch the diagnostic.
 */
/**
 * The parameter names a generated `synthesize` destructures, or null when it takes the whole
 * object. Declaration, const and arrow forms all count: a model picks whichever it likes.
 */
export function destructuredParameters(source) {
  const text = String(source ?? '');
  const match =
    text.match(/function\s+synthesize\s*\(\s*\{([^}]*)\}/) ??
    text.match(/synthesize\s*=\s*(?:async\s*)?\(?\s*\{([^}]*)\}/);
  if (!match) return null;
  return match[1]
    .split(',')
    .map((entry) => entry.split(/[:=]/)[0].trim())
    .filter(Boolean);
}

/**
 * What the generated half has to do with the grid it was handed.
 *
 * These are the musical contract: a phrase that allocates its own frame count drifts off the bar
 * line, and one that writes its own frequencies drifts out of key. Both are audible, and neither
 * shows up in the sample-level checks, so they are read from the source the model wrote.
 */
function synthesisIssues(synthesis, { loop }) {
  const source = String(synthesis ?? '');
  const issues = [];
  const redeclared = GRID_NAMES.filter((name) => new RegExp(`\\b(?:const|let|var|function)\\s+${name}\\b`).test(source));
  if (redeclared.length) {
    issues.push(`the grid above the synthesis already defines ${redeclared.join(', ')}: use them, never redeclare them`);
  }
  if (/^\s*import\s/m.test(source)) {
    issues.push('synthesize() must not import anything: the grid above it already holds every helper it needs');
  }
  if (!loop) return issues;
  const requires = [
    ['totalFrames', 'allocate every channel with totalFrames(sampleRate, bpm), so the phrase is a whole number of bars'],
    ['stepFrame', 'place every event on the sixteenth-note grid with stepFrame(step, sampleRate, bpm)'],
    ['frequency', 'take every pitch from frequency(midi), never from a frequency written in Hz'],
    ['BASS', 'write the bass line on BASS[bar], so it follows the progression'],
  ];
  for (const [name, remedy] of requires) {
    if (!new RegExp(`\\b${name}\\s*[(\\[]`).test(source)) issues.push(remedy);
  }
  if (!/\bCHORDS\b/.test(source) && !/\bSCALE\b/.test(source)) {
    issues.push('take the harmony from CHORDS[bar] and any melody from SCALE, so every voice stays in one key');
  }
  return issues;
}

function glueIssues(source, params) {
  const issues = [];
  // The wrapper contributes exactly one render(); a second one is the model writing its own, which
  // is a duplicate export the module system would reject with a far less useful message.
  const renders = (source.match(/export\s+(?:function|const|let|var)\s+render\b/g) ?? []).length;
  if (renders !== 1) {
    issues.push('dsp.js must export render() once: the module wrapper provides it, so synthesize() is all that is needed');
  }
  const unknown = (destructuredParameters(source) ?? []).filter((name) => !(name in params));
  if (unknown.length) {
    issues.push(`synthesize() destructures parameters the contract does not own: ${unknown.join(', ')}`);
  }
  return issues;
}

/**
 * Holds a staged module to the same contract `test/architecture.test.js` holds the built-ins to.
 *
 * Returns diagnostics rather than throwing: each one is written to be actionable both for the
 * operator reading the terminal and for the repair pass, which receives them verbatim.
 */
export async function verifyModule(directory, { bus, id, params = {}, allowedPackages = [], synthesis = '', plan = null }) {
  const issues = [];
  const files = new Set(await readdir(directory));
  for (const file of MODULE_FILES) if (file !== 'README.md' && !files.has(file)) issues.push(`missing ${file}`);
  if (issues.length) return { issues };

  const sources = {};
  for (const file of ['index.js', 'dsp.js', 'params.js']) {
    const source = await readFile(new URL(file, directory), 'utf8');
    sources[file] = source;
    if (/Math\.random\s*\(/.test(source)) issues.push(`${file}: Math.random() makes the render non-deterministic`);
    if (FORBIDDEN_SOURCE.test(source)) issues.push(`${file}: a module must not touch devices, files, processes or the network`);
    for (const [, specifier] of source.matchAll(/(?:from\s*|import\s*\(?\s*)['"]([^'"]+)['"]/g)) {
      if (specifier.startsWith('.')) {
        const target = new URL(specifier, new URL(file, directory)).href;
        if (!target.startsWith(directory.href) && target !== validationModule.href) {
          issues.push(`${file}: local import escapes the module: ${specifier}`);
        }
      } else if (!allowedPackages.some((name) => specifier === name || specifier.startsWith(`${name}/`))) {
        issues.push(`${file}: "${specifier}" is not a dependency of cyberia-audio`);
      }
    }
  }
  if (sources['index.js'] !== indexSource()) issues.push('index.js is not the module boundary the engine expects');
  issues.push(...glueIssues(sources['dsp.js'], params));
  issues.push(...synthesisIssues(synthesis, { loop: Boolean(plan) }));
  if (issues.length) return { issues };

  let asset;
  try {
    ({ default: asset } = await import(new URL('index.js', directory)));
  } catch (error) {
    return { issues: [`the module failed to import: ${error.message}`] };
  }
  if (!asset || asset.id !== id || asset.bus !== bus || typeof asset.render !== 'function') {
    return { issues: [`index.js must export { id: '${id}', bus: '${bus}', render() }`] };
  }

  // Imported rather than pattern-matched: a generated synthesize may be a declaration, a const or
  // an arrow, and only the module system settles what the wrapper will actually call.
  const dsp = await import(new URL('dsp.js', directory)).catch(() => null);
  if (typeof dsp?.synthesize !== 'function') {
    return { issues: ['dsp.js must export a synthesize(params) function that returns the channel arrays'] };
  }

  let result;
  try {
    result = validateAudioResult(await asset.render());
  } catch (error) {
    return { issues: [`render() with default parameters was rejected: ${error.message}`] };
  }

  const frames = result.channelData[0].length;
  const count = frames * result.channelData.length;
  let peak = 0;
  let energy = 0;
  let sum = 0;
  for (const channel of result.channelData) {
    for (const sample of channel) {
      peak = Math.max(peak, Math.abs(sample));
      energy += sample ** 2;
      sum += sample;
    }
    const [first, last] = [channel[0], channel.at(-1)];
    if (result.loop) {
      if (Math.abs(first - last) >= 0.03) {
        issues.push(`a looping phrase must join itself: first ${first.toFixed(4)} and last ${last.toFixed(4)} differ by 0.03 or more`);
      }
    } else if (first !== 0 || last !== 0) {
      issues.push(`a one-shot must start and end at exactly 0: got first ${first.toFixed(4)}, last ${last.toFixed(4)}`);
    }
  }
  const rms = Math.sqrt(energy / count);
  const offset = Math.abs(sum / count);
  if (peak <= 0.1) issues.push(`peak ${peak.toFixed(4)} is inaudible: the mix carries almost no energy to normalize`);
  if (rms <= 0.01) issues.push(`RMS ${rms.toFixed(4)} is too quiet: it must exceed 0.01`);
  if (offset >= 0.005) issues.push(`mean sample offset ${offset.toFixed(4)} is a DC bias: it must stay below 0.005`);

  if (plan) {
    // Two identical channels are a mono phrase in a stereo file: the width was never written.
    const [left, right] = result.channelData;
    if (!right || left.every((value, index) => value === right[index])) {
      issues.push('a phrase renders in stereo: spread the voices across the field, keeping the kick and the bass centred');
    }
    const expected = planDuration(plan, params.bpm ?? plan.bpm);
    if (Math.abs(result.duration - expected) > 0.02) {
      issues.push(
        `the phrase runs ${result.duration.toFixed(2)}s, but ${plan.bars} bars at ${params.bpm ?? plan.bpm} bpm is ` +
          `${expected.toFixed(2)}s: allocate every channel with totalFrames(sampleRate, bpm)`,
      );
    }
  }

  if (digest(validateAudioResult(await asset.render())) !== digest(result)) {
    issues.push('two renders with the same parameters produced different samples: the synthesis is not deterministic');
  }

  // render() may be synchronous or asynchronous, so the call itself is guarded rather than the promise.
  let quiet;
  try {
    quiet = validateAudioResult(await asset.render({ sampleRate: 22050, volume: 0 }));
  } catch (error) {
    quiet = error;
  }
  if (quiet instanceof Error) {
    issues.push(`render({ sampleRate: 22050, volume: 0 }) was rejected: ${quiet.message}`);
  } else {
    if (!quiet.channelData.every((channel) => channel.every((value) => value === 0))) {
      issues.push('volume 0 must render exact digital silence');
    }
    if (quiet.channelData[0].length === frames) {
      issues.push('halving sampleRate did not change the frame count: the render must derive its length from sampleRate');
    }
  }

  for (const [options, expected] of [
    [{ volume: 2 }, 'volume'],
    [{ sampleRate: NaN }, 'sampleRate'],
    [{ unexpected: 1 }, 'Unknown parameter'],
    [null, 'plain object'],
  ]) {
    const message = await rejection((value) => asset.render(value), options);
    if (message === null || !message.includes(expected)) {
      issues.push(`render(${JSON.stringify(options)}) must be rejected by getParams with a "${expected}" error`);
    }
  }

  return {
    issues,
    measured: {
      duration: result.duration,
      loop: result.loop,
      channels: result.channelData.length,
      sampleRate: result.sampleRate,
      peak,
      rms,
    },
  };
}

/** Strip a fence the model may have wrapped around the code it was asked to return as a string. */
const unfence = (source) => {
  const text = String(source ?? '').trim();
  const fence = text.match(/^```(?:js|javascript)?\s*([\s\S]*?)```$/i);
  return (fence ? fence[1] : text).trim();
};

function resolveParameterContract(payload, base) {
  const params = { ...BASE_PARAMS, ...base?.params };
  const rules = { ...BASE_RULES, ...base?.rules };
  const meaning = { ...base?.meaning };
  for (const [key, value] of Object.entries(payload?.params ?? {})) {
    if (key in params) continue;
    if (!/^[a-z][A-Za-z0-9]*$/.test(key)) throw new Error(`Generated parameter name is not camelCase: ${key}`);
    if (!Number.isFinite(value)) throw new Error(`Generated parameter ${key} is not a finite number.`);
    params[key] = value;
  }
  for (const [key, rule] of Object.entries(payload?.rules ?? {})) {
    if (key in rules || !(key in params)) continue;
    const [min, max, integer] = Array.isArray(rule) ? rule : [];
    if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
      throw new Error(`Generated rule for ${key} is not a [min, max] range.`);
    }
    rules[key] = integer ? [min, max, true] : [min, max];
  }
  for (const key of Object.keys(params)) {
    if (!rules[key]) throw new Error(`Generated parameter ${key} has no validation rule.`);
    const [min, max, integer] = rules[key];
    if (params[key] < min || params[key] > max || (integer && !Number.isInteger(params[key]))) {
      throw new Error(`Generated default for ${key} (${params[key]}) sits outside its own rule.`);
    }
    if (!(key in BASE_PARAMS)) meaning[key] ||= String(payload?.meaning?.[key] ?? '').trim();
  }
  return { params, rules, meaning };
}

const writeStage = (directory, files) =>
  Promise.all(Object.entries(files).map(([name, content]) => writeFile(new URL(name, directory), content)));

/**
 * Generate, verify and install one audio module.
 *
 * @param {object} params
 * @param {string} params.prompt - The game intent, in natural language.
 * @param {'music'|'sfx'} [params.bus] - Forces the bus instead of inferring it from the prompt.
 * @param {string} [params.id] - Forces the semantic id instead of deriving it from the prompt.
 * @param {string} [params.model] - Gemini model id.
 * @param {number} [params.temperature] - Sampling temperature.
 * @param {number} [params.repairs=2] - Repair passes allowed after a failed verification.
 * @param {boolean} [params.force=false] - Replace an existing module of the same id.
 * @param {boolean} [params.dryRun=false] - Generate and verify, then discard instead of installing.
 * @param {object} [params.client] - A Gemini client; constructed from the environment when absent.
 * @param {Function} [params.log] - Progress reporter.
 * @returns {Promise<object>} The installed identity, the measured render and the written files.
 */
export async function generateModule({
  prompt,
  bus: requestedBus,
  id: requestedId,
  model,
  temperature,
  repairs = 2,
  force = false,
  dryRun = false,
  client,
  log = () => {},
} = {}) {
  if (typeof prompt !== 'string' || prompt.trim().length < 3) {
    throw new Error('A prompt of at least three characters is required to generate a module.');
  }
  if (requestedBus !== undefined && !AUDIO_BUSES.includes(requestedBus)) {
    throw new Error(`Audio bus must be one of: ${AUDIO_BUSES.join(', ')}; received "${requestedBus}".`);
  }
  // Constructed only once the request itself is sound, so a malformed call is reported as such
  // rather than as a missing API key.
  client ??= new GeminiClient({ model, temperature });
  const intent = prompt.trim();
  const fixedId = requestedId ? slugify(requestedId) : '';
  const onRetry = ({ attempt, attempts, error, backoff }) =>
    log(`  Gemini attempt ${attempt}/${attempts} failed (${error.message}); retrying in ${backoff}ms`);
  const ask = (system, user) => client.chatJson({ system, user, onRetry });
  const allowedPackages = Object.keys(JSON.parse(await readFile(packageManifest, 'utf8')).dependencies ?? {});

  log('Stage 1/4  identity');
  const vocabulary = await Promise.all(
    (requestedBus ? [requestedBus] : AUDIO_BUSES).map(async (name) => `${name}: ${(await listExistingIds(name)).join(' ')}`),
  );
  const brief = await ask(
    briefSystem({ bus: requestedBus, id: fixedId }),
    [
      `Game intent: ${intent}`,
      requestedBus ? `Bus is fixed: ${requestedBus}` : '',
      fixedId ? `Id is fixed: ${fixedId}` : '',
      `Taken ids — ${vocabulary.join(' | ')}`,
    ]
      .filter(Boolean)
      .join('\n'),
  );

  const bus = requestedBus ?? brief.bus;
  if (!AUDIO_BUSES.includes(bus)) throw new Error(`The model chose an unknown bus: ${JSON.stringify(brief.bus)}`);
  const id = fixedId || slugify(brief.id);
  if (!ID_PATTERN.test(id)) throw new Error(`The model chose an unusable semantic id: ${JSON.stringify(brief.id)}`);

  // Refused before any further token is spent, and before anything is written.
  const target = new URL(`${bus}/${id}/`, moduleRoot);
  if (!dryRun && (await exists(target)) && !force) {
    throw new Error(`${bus}/${id} already exists. Pass --force to replace it, or --id to name a new module.`);
  }
  const abandoned = await sweepStagingDirectories(bus);
  if (abandoned.length) log(`           swept ${abandoned.length} staging director${abandoned.length === 1 ? 'y' : 'ies'} an interrupted run left behind`);
  const loop = 'music' === bus;
  const tags = (Array.isArray(brief.tags) ? brief.tags : []).map(String).filter(Boolean);
  // A phrase is measured in bars, not in seconds: the plan decides its length, and every value in
  // it has been resolved against tonal, so the grid the synthesis plays on cannot be nonsense.
  const plan = loop ? musicalPlanFactory(brief) : null;
  const seconds = loop ? planDuration(plan, plan.bpm) : Number(brief.durationSeconds) || 0.5;
  const design = String(brief.design ?? brief.soundDesign ?? '').trim();
  const voices = (Array.isArray(brief.voices) ? brief.voices : []).join('; ');
  // One line, reused by every later stage instead of re-sending the brief as JSON.
  const identity = loop
    ? `music ${id} — ${plan.key}, ${plan.progression.join(' ')}, ${plan.bpm} bpm, ${plan.bars} bars (${seconds.toFixed(1)}s stereo loop)`
    : `sfx ${id} — ${seconds}s, mono one-shot`;
  log(`           ${identity}${brief.title ? ` (${brief.title})` : ''}`);

  log('Stage 2/4  parameters');
  let contract = resolveParameterContract(
    await ask(
      paramsSystem(),
      [identity, `Design: ${design}`, `Suggested: ${(brief.parameters ?? []).join(', ')}`].filter(Boolean).join('\n'),
    ),
  );
  // The grid is played at the tempo the caller passes, so a phrase always owns bpm.
  if (loop) {
    contract = resolveParameterContract(
      { params: { bpm: plan.bpm }, rules: { bpm: [60, 200] }, meaning: { bpm: 'sets the tempo' } },
      contract,
    );
  }
  const signatureLine = () => `synthesize({ ${Object.keys(contract.params).join(', ')} }) — ${signature(contract)}`;

  log('Stage 3/4  synthesis');
  let synthesis = unfence(
    (
      await ask(
        dspSystem({ loop }),
        [identity, `Design: ${design}`, voices ? `Voices: ${voices}` : '', signatureLine()].filter(Boolean).join('\n'),
      )
    ).source,
  );

  // A model writes the synthesis it wants rather than the signature it was handed. A parameter it
  // introduced is adopted into the contract instead of failing the run: the name is already in the
  // code, so the contract follows the code and the module stays coherent.
  const introduced = (destructuredParameters(synthesis) ?? []).filter((name) => !(name in contract.params));
  if (introduced.length) {
    log(`           adopting from the synthesis: ${introduced.join(', ')}`);
    contract = resolveParameterContract(
      await ask(
        paramsSystem(),
        [identity, `Design: ${design}`, `Emit exactly these parameters, and nothing else: ${introduced.join(', ')}`].join('\n'),
      ),
      contract,
    );
  }

  const staged = [];
  let verified;
  try {
    for (let attempt = 0; attempt <= repairs; attempt++) {
      // A fresh directory per attempt: ES module URLs are cached for the life of the process, so
      // a repaired dsp.js re-imported under a path already loaded would return the rejected code.
      const staging = new URL(`${bus}/${STAGING_PREFIX}${id}-${randomUUID().slice(0, 8)}/`, moduleRoot);
      staged.push(staging);
      await mkdir(staging, { recursive: true });
      await writeStage(staging, {
        'manifest.json': manifestSource({ id, bus, tags, duration: seconds }),
        'params.js': paramsSource(contract),
        'dsp.js': dspSource({ synthesis, loop, plan }),
        'index.js': indexSource(),
      });

      const { issues, measured } = await verifyModule(staging, {
        bus,
        id,
        params: contract.params,
        allowedPackages,
        synthesis,
        plan,
      });
      if (issues.length === 0) {
        verified = { staging, measured, attempt };
        break;
      }
      log(`           verification failed:\n${issues.map((issue) => `             - ${issue}`).join('\n')}`);
      if (attempt === repairs) {
        throw new Error(`The generated module never satisfied the engine contract:\n  - ${issues.join('\n  - ')}`);
      }
      log(`           repair pass ${attempt + 1}/${repairs}`);
      synthesis = unfence(
        (
          await ask(
            repairSystem({ loop }),
            [signatureLine(), 'Diagnostics:', ...issues.map((issue) => `- ${issue}`), 'Rejected source:', synthesis].join('\n'),
          )
        ).source,
      );
    }

    log('Stage 4/4  documentation');
    const prose = await ask(
      proseSystem(),
      [
        identity,
        `Design: ${design}`,
        voices ? `Voices: ${voices}` : '',
        `Parameters: ${Object.entries(contract.meaning)
          .map(([key, text]) => `${key} ${text}`)
          .join('; ')}`,
      ]
        .filter(Boolean)
        .join('\n'),
    );

    const files = {
      'manifest.json': manifestSource({ id, bus, tags, duration: verified.measured.duration }),
      'README.md': readmeSource({
        id,
        bus,
        prose: {
          summary: String(prose.summary ?? brief.title ?? id).trim(),
          useFor: String(prose.useFor ?? '').trim().replace(/\.$/, ''),
          soundDesign: String(prose.soundDesign ?? design).trim(),
        },
        ...contract,
        measured: verified.measured,
        plan,
      }),
    };
    await writeStage(verified.staging, files);

    if (dryRun) {
      log(`Dry run    ${bus}/${id} verified and discarded`);
    } else {
      if (await exists(target)) await rm(target, { recursive: true, force: true });
      await rename(verified.staging, target);
      staged.splice(staged.indexOf(verified.staging), 1);
      log(`Installed  src/audio-module/${bus}/${id}/`);
    }

    const written = Object.fromEntries(
      await Promise.all(
        MODULE_FILES.map(async (name) => [
          name,
          await readFile(new URL(name, dryRun ? verified.staging : target), 'utf8'),
        ]),
      ),
    );
    return {
      bus,
      id,
      brief,
      directory: dryRun ? null : new URL(`${bus}/${id}/`, moduleRoot).pathname,
      files: written,
      measured: verified.measured,
      repairs: verified.attempt,
      model: client.model,
    };
  } finally {
    await Promise.all(staged.map((directory) => rm(directory, { recursive: true, force: true })));
  }
}
