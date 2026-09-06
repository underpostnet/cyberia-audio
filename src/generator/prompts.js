/**
 * Stage prompts for AI module generation.
 *
 * Each stage asks for the smallest distinct payload the pipeline cannot write itself: identity,
 * parameter values, the synthesis body, and the prose of the README. Everything structural — the
 * module boundary, the parameter file, the render wrapper, the manifest envelope and every fixed
 * README sentence — is templated locally and never spent on tokens. Prompts are deliberately
 * terse: a rule the pipeline enforces after the fact does not need to be argued in-prompt.
 */

const ROLE = 'You write one module for cyberia-audio, a procedural game-audio engine. You are a game sound designer and DSP engineer.';

/** A compact `name default [min..max]` signature: the whole parameter contract on one line. */
export const signature = ({ params, rules }) =>
  Object.entries(params)
    .map(([name, value]) => {
      const [min, max, integer] = rules[name];
      return `${name}=${value} [${min}..${max}${integer ? ' int' : ''}]`;
    })
    .join(', ');

/** Stage 1 — identity, and for a phrase the musical plan the grid is built from. */
export const briefSystem = ({ type, id }) =>
  [
    ROLE,
    'STAGE 1/4 — IDENTITY. Infer the module from the game intent. JSON only:',
    '{' +
      (type ? '' : '"type":"sfx"|"music",') +
      (id ? '' : '"id":"kebab-case-semantic-id",') +
      '"title":"short human title","tags":["3-5","lowercase"],' +
      '"design":"one sentence: the voices, their envelopes and their motion",' +
      '"voices":["one short phrase per synthesis voice"],' +
      '"parameters":["expressive parameter names besides volume"],' +
      '"durationSeconds":number,' +
      '"key":"tonic and mode as tonal writes them, e.g. F minor, Bb dorian, D phrygian",' +
      '"progression":["3-4 chord symbols in that key, e.g. Fm","Ab","Cm"],' +
      '"bpm":number,"bars":2|4|8}',
    'sfx: one non-repeating gesture, 0.05-2 s, mono — durationSeconds only.',
    'music: a repeatable phrase, stereo — key, progression, bpm and bars decide its length.',
    'Choose the key, mode and tempo the intent actually implies: mode carries the mood, tempo the body.',
    'The id names the game meaning ("boss-alarm"), never the synthesis ("saw-sweep-3"), and must be new.',
  ].join('\n');

/** Stage 2 — the numbers behind the parameter contract, plus one clause of prose per parameter. */
export const paramsSystem = () =>
  [
    ROLE,
    'STAGE 2/4 — PARAMETERS. The module owns expressive parameters the caller may override. JSON only:',
    '{"params":{"name":default},"rules":{"name":[min,max]|[min,max,true]},"meaning":{"name":"verb phrase, no parameter name, e.g. controls the ring"}}',
    'Every value is a finite number. Every name is camelCase, has a rule, and its default sits inside it.',
    'sampleRate and volume are added by the engine: never emit them.',
    'Emit 1-5 parameters from the brief. Add integer "seed" [0,4294967295,true] only if the design uses noise.',
  ].join('\n');

/**
 * Stage 3 — the synthesis body, and nothing else.
 *
 * The generated module's `render()` is written locally and already owns normalization, the volume
 * law and the one-shot boundary fade, so the model is told what it may stop doing rather than
 * being asked for a wrapper that would be identical in every module.
 */
export const dspSystem = ({ loop }) =>
  [
    ROLE,
    'STAGE 3/4 — SYNTHESIS. JSON only: {"source":"<javascript>"}',
    'Write exactly one export: export function synthesize(params) — destructure the parameters you',
    'are given — returning an array of Float32Array channels, all the same length.',
    '',
    'The file already defines these above your code. Use them; never redeclare or import them:',
    loop
      ? [
          '  SCALE[]        MIDI numbers of the key, three ascending octaves',
          '  CHORDS[bar][]  MIDI numbers of the bar\'s chord, root position; BASS[bar] its root an octave down',
          '  frequency(midi)                     Hz in equal temperament',
          '  totalFrames(sampleRate, bpm)        the phrase length in frames — allocate every channel with it',
          '  STEPS, stepFrame(step, sampleRate, bpm), stepBar(step)   the sixteenth-note grid',
        ].join('\n')
      : '  frequency(midi)   Hz in equal temperament',
    '',
    loop
      ? [
          'Every pitch comes from frequency() with a MIDI number out of SCALE, CHORDS or BASS. Never write',
          'a frequency in Hz. Every event starts on stepFrame(). Write, at least: a rhythm bed on the step',
          'grid that the intent implies (kick, snare or clap, hat), a bass line on BASS, and harmony from',
          'CHORDS — then the voices the design names. Releases and echoes wrap circularly (index % frames)',
          'so the phrase continues into itself. Spread the voices across the stereo field and keep the kick',
          'and the bass centred, the way a record is mixed.',
        ].join('\n')
      : 'Tuned voices take their pitch from frequency(midi). It must not depend on wrapping around its own end.',
    '',
    'The wrapper already centres the mix, normalizes it to 0.98 of full scale, applies volume, closes a',
    'loop onto its own first sample and fades a one-shot to silence at both ends. Do NOT normalize,',
    'apply volume, remove DC or fade the boundaries. Balance voices with fixed gains instead.',
    'Every voice gets a shaped envelope in seconds — attack, decay, release — never a bare oscillator',
    'switched on and off, which clicks. Keep harmonics below sampleRate / 2. Derive every length from',
    'sampleRate. The mix must carry real energy: RMS above 0.01 of full scale once normalized.',
    'Deterministic: no Math.random, no Date, no performance. Seeded noise uses a local integer',
    'generator, e.g. state = (Math.imul(state, 1664525) + 1013904223) >>> 0.',
    'No import, no I/O, no module-scope side effect. Comment only non-obvious intent.',
  ].join('\n');

/** Stage 4 — the three paragraphs of a module README that are not mechanical. */
export const proseSystem = () =>
  [
    ROLE,
    'STAGE 4/4 — DOCUMENTATION. The README template writes every mechanical sentence. JSON only:',
    '{"summary":"one sentence naming the sound","useFor":"the game moments it serves, no trailing period",',
    '"soundDesign":"one paragraph, 2-4 sentences: voices, harmony, envelopes, motion, in plain language"}',
    'Describe only what the synthesis you are shown actually does. Invent no parameter and no behaviour.',
  ].join('\n');

/** Repair — the rejected source and the diagnostics. The brief is already inside the source. */
export const repairSystem = ({ loop }) =>
  [
    dspSystem({ loop }),
    'REPAIR: the engine rejected the source below. Fix every diagnostic, keep the sound design, and',
    'return the corrected synthesize() in the same JSON shape.',
  ].join('\n');
