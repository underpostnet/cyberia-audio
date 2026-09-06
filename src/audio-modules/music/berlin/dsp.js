import { Note } from 'tonal';

// Helper to convert note names (e.g. 'F1', 'Ab3') or MIDI numbers to precise frequency in Hz
const frequency = (note) => (typeof note === 'string' ? Note.freq(note) || 440 : 440 * 2 ** ((note - 69) / 12));

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

  // 1. Kick + Warehouse Sub Rumble (Tuned exactly to F0 = 43.65 Hz using tonal)
  function kick(atBeat, gain = 1) {
    const f0 = frequency('F0'); // 43.65 Hz (Perfect fundamental pitch for F Minor)
    place(atBeat, 0.35, 0, (t) => {
      // Clean pitch drop envelope from 140Hz down to F0
      const pitchEnv = Math.exp(-t * 40);
      const phase = 2 * Math.PI * (f0 * t + (95 * (1 - pitchEnv)) / 40);
      const punch = Math.sin(phase) * Math.exp(-t * 14);
      const transient = noise() * Math.exp(-t * 220) * 0.15;
      return (punch * 0.8 + transient) * gain;
    });

    // Sub-rumble tail filtered to eliminate muddy distortion
    let subLp = 0;
    const lpCutoff = (2 * Math.PI * 160) / sampleRate;
    place(atBeat + 0.16, 0.42, 0, (t) => {
      const subPhase = 2 * Math.PI * f0 * t;
      const rawRumble = Math.sin(subPhase) + noise() * 0.08;
      subLp += lpCutoff * (rawRumble - subLp); // Soft low-pass filter
      const subEnv = Math.exp(-t * 6.5) * Math.min(1, t / 0.025);
      return Math.tanh(subLp * 1.1) * subEnv * 0.28 * gain;
    });
  }

  // 2. High-Fidelity Metallic Hi-Hats
  function hat(atBeat, open = false, pan = 0, gain = 1) {
    let hpState = 0;
    const cutoff = 6800;
    const alpha = (2 * Math.PI * cutoff) / sampleRate;
    place(atBeat, open ? 0.22 : 0.05, pan, (t) => {
      const metal = Math.sin(2 * Math.PI * 4120 * t) * 0.25 + Math.sin(2 * Math.PI * 5870 * t) * 0.25 + noise() * 0.5;
      hpState += alpha * (metal - hpState);
      const filtered = metal - hpState;
      const env = Math.exp(-t * (open ? 18 : 75));
      return filtered * env * gain * 0.22;
    });
  }

  // 3. Tuned Industrial Clap
  function clap(atBeat, pan = 0.05, gain = 1) {
    let lpState = 0;
    const alpha = (2 * Math.PI * 2400) / sampleRate;
    place(atBeat, 0.22, pan, (t) => {
      const snap = t < 0.012 ? (Math.sin(t * 1800) > 0 ? 0.6 : -0.6) : 0;
      const body = snap + noise() * 0.7;
      lpState += alpha * (body - lpState);
      const env = Math.exp(-t * 24);
      return Math.tanh(lpState * 1.1) * env * gain * 0.28;
    });
  }

  // 4. Berlin Acid / Monophonic Bassline Synth (F Minor Scale)
  function synth(note, atBeat, lengthBeats, accent = false, pan = -0.1) {
    const f = frequency(note);
    const lengthSec = beat * lengthBeats;
    place(atBeat, lengthSec, pan, (t) => {
      const phase = 2 * Math.PI * f * t;
      let wave = 0;
      const numHarmonics = Math.min(20, Math.floor((sampleRate * 0.4) / f));
      for (let h = 1; h <= numHarmonics; h++) {
        const brightEnv = Math.exp(-t * (5 + (accent ? 2 : 7)));
        wave += (Math.sin(phase * h) / h) * (1 + brightEnv * intensity);
      }
      const env = Math.exp(-t * 8.5) * Math.min(1, t / 0.004);
      const saturated = Math.tanh(wave * (accent ? 1.8 : 1.2));
      return saturated * env * (accent ? 0.28 : 0.2);
    });
  }

  // 5. NEW: Dynamic Melodic Event Layer (Atmospheric Dark Chord Stabs)
  function darkStab(chordNotes, atBeat, pan = 0) {
    chordNotes.forEach((noteName, idx) => {
      const f = frequency(noteName);
      const notePan = pan + (idx % 2 === 0 ? -0.15 : 0.15);
      place(atBeat, beat * 1.5, notePan, (t) => {
        const phase = 2 * Math.PI * f * t;
        const osc = Math.sin(phase) * 0.5 + Math.sin(phase * 2) * 0.25;
        const filterSweep = Math.exp(-t * 4);
        const env = Math.exp(-t * 3.5) * Math.min(1, t / 0.01);
        return Math.tanh(osc * (1 + filterSweep * 1.5)) * env * 0.08;
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

    // Hypnotic Techno Synth Sequence (F Minor: F1, Ab1, C2, Db2, Eb2)
    const notes = ['F1', 'F1', 'Ab1', 'F1', 'C2', 'F1', 'Db2', 'F1', 'F1', 'Ab1', 'F1', 'C2', 'F1', 'Eb2', 'C2', 'F1'];
    notes.forEach((note, step) => {
      const accent = step % 4 === 0 || step === 10;
      if (step % 2 === 0 || intensity > 0.4) {
        synth(note, start + step / 4, 0.35, accent, ((step % 4) - 1.5) * 0.15);
      }
    });

    // DYNAMIC EVENT LAYER: Dark chord stabs triggered on bar turnarounds or high intensity
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
