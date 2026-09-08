import { Note } from 'tonal';

// Helper to convert note names (e.g. 'F2', 'Ab2') or MIDI numbers to precise frequency in Hz
const frequency = (note) => (typeof note === 'string' ? Note.freq(note) || 440 : 440 * 2 ** ((note - 69) / 12));

// Exact one-pole coefficient, always in (0,1). The 2*pi*fc/sr approximation only holds while the
// corner sits far below the rate: at 22.05 kHz the hat's 7.2 kHz corner pushes it past 2, where
// the filter diverges into NaN instead of smoothing.
const onePole = (cutoffHz, sampleRate) => 1 - Math.exp((-2 * Math.PI * cutoffHz) / sampleRate);

export function render({ sampleRate, volume, bpm, rounds, intensity, seed }) {
  const beat = 60 / bpm;
  const frames = Math.round(rounds * 16 * beat * sampleRate);
  const channelData = [new Float32Array(frames), new Float32Array(frames)];
  let state = seed >>> 0;

  // PRNG Pseudo-random number generator for deterministic sound output
  const noise = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2147483648 - 1;
  };

  function place(atBeat, length, pan, voice) {
    const offset = Math.round(atBeat * beat * sampleRate);
    const gains = [Math.sqrt((1 - pan) / 2), Math.sqrt((1 + pan) / 2)];
    for (let i = 0; i < Math.round(length * sampleRate); i++) {
      const t = i / sampleRate;
      const envelope = Math.min(1, t / 0.001) * Math.min(1, (length - t) / 0.012);
      const value = voice(t) * envelope;
      const index = (offset + i) % frames;
      channelData[0][index] += value * gains[0];
      channelData[1][index] += value * gains[1];
    }
  }

  // 1. Kick + Warehouse Sub Rumble (Tuned to F0 = 43.65 Hz)
  function kick(atBeat, gain = 1) {
    const f0 = frequency('F0'); // 43.65 Hz fundamental
    place(atBeat, 0.32, 0, (t) => {
      const pitchEnv = Math.exp(-t * 45);
      const phase = 2 * Math.PI * (f0 * t + (90 * (1 - pitchEnv)) / 45);
      const punch = Math.sin(phase) * Math.exp(-t * 16);
      const transient = noise() * Math.exp(-t * 220) * 0.12;
      return (punch * 0.85 + transient) * gain;
    });

    // Sub-rumble tail filtered cleanly without low distortion
    let subLp = 0;
    const lpCutoff = onePole(140, sampleRate);
    place(atBeat + 0.14, 0.4, 0, (t) => {
      const subPhase = 2 * Math.PI * f0 * t;
      const rawRumble = Math.sin(subPhase) + noise() * 0.05;
      subLp += lpCutoff * (rawRumble - subLp);
      const subEnv = Math.exp(-t * 7.0) * Math.min(1, t / 0.02);
      return subLp * subEnv * 0.26 * gain;
    });
  }

  // 2. High-Fidelity Metallic Hi-Hats
  function hat(atBeat, open = false, pan = 0, gain = 1) {
    let hpState = 0;
    const cutoff = 7200;
    const alpha = onePole(cutoff, sampleRate);
    place(atBeat, open ? 0.2 : 0.045, pan, (t) => {
      const metal = Math.sin(2 * Math.PI * 4120 * t) * 0.2 + Math.sin(2 * Math.PI * 6200 * t) * 0.2 + noise() * 0.6;
      hpState += alpha * (metal - hpState);
      const filtered = metal - hpState;
      const env = Math.exp(-t * (open ? 20 : 80));
      return filtered * env * gain * 0.2;
    });
  }

  // 3. Tuned Industrial Clap
  function clap(atBeat, pan = 0.05, gain = 1) {
    let lpState = 0;
    const alpha = onePole(2200, sampleRate);
    place(atBeat, 0.2, pan, (t) => {
      const snap = t < 0.01 ? (Math.sin(t * 1800) > 0 ? 0.5 : -0.5) : 0;
      const body = snap + noise() * 0.65;
      lpState += alpha * (body - lpState);
      const env = Math.exp(-t * 26);
      return Math.tanh(lpState * 1.05) * env * gain * 0.26;
    });
  }

  // 4. Berlin Dark Industrial Bassline (Dual-Oscillator Sub + Body for deep 'grave' essence)
  function synth(note, atBeat, lengthBeats, accent = false, pan = -0.1) {
    const fSub = frequency(note); // Base note in Octave 1 (e.g., F1 = 43.65 Hz)
    const fBody = fSub * 2; // Octave above (F2 = 87.3 Hz) for clear pitch harmonic definition
    const lengthSec = beat * lengthBeats;

    // State variable filter parameters with warm, non-screechy resonance
    let low = 0,
      band = 0;
    const q = 2.0 + (accent ? 1.5 : 0.5);

    place(atBeat, lengthSec, pan, (t) => {
      // Dual oscillator: Deep sub sine/triangle (70%) + Warm saw body (30%)
      const subOsc = Math.sin(2 * Math.PI * fSub * t) * 0.75 + Math.sin(4 * Math.PI * fSub * t) * 0.25;
      const sawPhase = (fBody * t) % 1;
      const bodySaw = 2 * sawPhase - 1;

      const rawSignal = subOsc * 0.7 + bodySaw * 0.3;

      // Dark Filter Envelope (Lowpass sweep focused strictly in 130 Hz - 850 Hz for heavy weight)
      const envFilter = Math.exp(-t * (16 + (accent ? 4 : 10)));
      const baseCutoff = 130 + intensity * 250;
      const cutoffHz = Math.min(sampleRate * 0.35, baseCutoff + (accent ? 850 : 450) * envFilter);

      // State Variable Lowpass Filter step
      const fFilter = 2 * Math.sin((Math.PI * cutoffHz) / sampleRate);
      low = low + fFilter * band;
      const high = rawSignal - low - (1 / q) * band;
      band = band + fFilter * high;

      // Tight decay envelope for fast, punchy bass dynamics
      const ampEnv = Math.exp(-t * 14) * Math.min(1, t / 0.004);

      // Sidechain ducking simulation against kick transient (beats 1, 2, 3, 4)
      const beatPhase = (atBeat * beat + t) % beat;
      const sidechain = Math.min(1, beatPhase / 0.12);

      const signal = low * ampEnv * (0.55 + 0.45 * sidechain);
      return Math.tanh(signal * 1.35) * (accent ? 0.32 : 0.22);
    });
  }

  // 5. Dynamic Melodic Event Layer (Atmospheric Dark Chord Stabs)
  function darkStab(chordNotes, atBeat, pan = 0) {
    chordNotes.forEach((noteName, idx) => {
      const f = frequency(noteName);
      const notePan = pan + (idx % 2 === 0 ? -0.12 : 0.12);
      place(atBeat, beat * 1.2, notePan, (t) => {
        const phase = 2 * Math.PI * f * t;
        const osc = Math.sin(phase) * 0.5 + Math.sin(phase * 2) * 0.25;
        const filterSweep = Math.exp(-t * 5);
        const env = Math.exp(-t * 4) * Math.min(1, t / 0.008);
        return Math.tanh(osc * (1 + filterSweep * 1.2)) * env * 0.07;
      });
    });
  }

  // Sequencer Loop Logic
  for (let bar = 0; bar < rounds * 4; bar++) {
    const start = bar * 4;

    // 4-on-the-floor Kicks
    for (let k = 0; k < 4; k++) {
      kick(start + k, k === 0 ? 1.0 : 0.92);
    }

    // Industrial Clap on beats 2 and 4
    clap(start + 1, 0.05, 0.9);
    clap(start + 3, -0.05, 1.0);

    // Offbeat & 16th Hi-Hats
    for (let step = 0; step < 16; step++) {
      const stepBeat = start + step / 4;
      const isOffbeat = step % 4 === 2;
      if (isOffbeat) {
        hat(stepBeat, true, 0.25, 1.0);
      } else if (step % 2 === 1 || intensity > 0.6) {
        hat(stepBeat, false, step % 4 === 1 ? -0.3 : 0.3, 0.5 + intensity * 0.4);
      }
    }

    // Hypnotic Techno Sequence in Octave 1/2 (F Minor: F1, Ab1, C2, Db2, Eb2)
    const notes = ['F1', 'F1', 'Ab1', 'F1', 'C2', 'F1', 'Db2', 'F1', 'F1', 'Ab1', 'F1', 'C2', 'F1', 'Eb2', 'C2', 'F1'];
    notes.forEach((note, step) => {
      const accent = step % 4 === 0 || step === 10;
      if (step % 2 === 0 || intensity > 0.4) {
        synth(note, start + step / 4, 0.3, accent, ((step % 4) - 1.5) * 0.15);
      }
    });

    // Dynamic Melodic Event Layer: Dark chord stabs trigger on bar turnarounds
    if (bar % 2 === 1) {
      const stabChord =
        bar % 4 === 3
          ? ['F3', 'Ab3', 'C4', 'Eb4'] // Fm7
          : ['Db3', 'F3', 'Ab3', 'C4']; // Dbmaj7

      const stabBeat = start + (bar % 4 === 3 ? 3.5 : 2.5);
      darkStab(stabChord, stabBeat, bar % 2 === 0 ? -0.2 : 0.2);
    }

    // Fill / Accent modulation at the 4th bar end
    if (bar % 4 === 3) {
      clap(start + 3.5, 0.2, 0.7);
      if (intensity > 0.5) {
        clap(start + 3.75, -0.2, 0.85);
      }
    }
  }

  // Master stage. The kick and sub voices are asymmetric, so the mix carries a small DC offset;
  // removing it before the peak is measured keeps the phrase centred and hands that headroom back
  // to the music. A constant subtraction is safe on a loop, whose boundaries only have to meet.
  let sum = 0;
  for (const channel of channelData) for (const value of channel) sum += value;
  const offset = sum / (channelData.length * frames);
  let peak = 0;
  for (const channel of channelData) {
    for (let i = 0; i < frames; i++) {
      channel[i] -= offset;
      peak = Math.max(peak, Math.abs(channel[i]));
    }
  }
  // volume is the fraction of full scale the peak reaches, so volume 1 is as loud as this gets.
  const master = peak > 0 ? (volume * 0.98) / peak : 0;
  for (const channel of channelData) {
    for (let i = 0; i < frames; i++) {
      channel[i] *= master;
    }
  }

  return { sampleRate, channelData, loop: true };
}
