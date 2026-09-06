const frequency = (midi) => 440 * 2 ** ((midi - 69) / 12);

export function render({ sampleRate, volume, bpm, cycles, tension, seed }) {
  const beat = 60 / bpm;
  const frames = Math.round(cycles * 16 * beat * sampleRate);
  const channelData = [new Float32Array(frames), new Float32Array(frames)];
  let state = seed >>> 0;
  const noise = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2147483648 - 1;
  };

  // Every voice is written on a circular phrase, including its release and echoes.
  // This preserves the tail from the previous phrase at the next loop's start.
  function place(atSeconds, length, pan, voice) {
    const offset = Math.round(atSeconds * sampleRate);
    const gains = [Math.sqrt((1 - pan) / 2), Math.sqrt((1 + pan) / 2)];
    for (let i = 0; i < Math.round(length * sampleRate); i++) {
      const t = i / sampleRate;
      const index = (offset + i) % frames;
      const value = voice(t, length);
      channelData[0][index] += value * gains[0];
      channelData[1][index] += value * gains[1];
    }
  }

  // Tremolo strings: two slightly detuned tones with a slow, uneven swell.
  function pad(midi, atBeats, beats, pan) {
    const f = frequency(midi);
    const detune = 1 + 0.0045 * tension;
    place(atBeats * beat, beats * beat + 0.6, pan, (t, length) => {
      const envelope = Math.min(1, t / 0.4) * Math.min(1, (length - t) / 0.55);
      const swell = 1 + 0.32 * Math.sin(2 * Math.PI * 3.9 * t + (midi * 7) % 9.7);
      const phase = 2 * Math.PI * f * t;
      const tone = (Math.sin(phase * detune) + Math.sin(phase / detune)) * 0.5
        + Math.sin(phase * 2) * 0.14 * Math.exp(-t * 1.2);
      return tone * envelope * swell * 0.042 * (0.3 + tension * 0.35);
    });
  }

  // Low pulsing bass heartbeat; each root circles back toward the phrase start.
  function bass(midi, atBeats, gain) {
    const f = frequency(midi);
    place(atBeats * beat, beat * 1.5, -0.06, (t, length) => {
      const envelope = Math.min(1, t / 0.012) * Math.exp(-t * 3.0) * Math.min(1, (length - t) / 0.18);
      const phase = 2 * Math.PI * f * t;
      return (Math.sin(phase) + Math.sin(phase * 2) * 0.16 * Math.exp(-t * 6)) * envelope * gain;
    });
  }

  // The sliding "theremin" voice: it glides to a target, then floats with vibrato.
  function theremin(midiFrom, midiTo, atBeats, beats, gain, pan) {
    const offset = Math.round(atBeats * beat * sampleRate);
    const length = Math.round((beats * beat + 0.6) * sampleRate);
    const glideTime = Math.max(0.02, beats * beat * 0.7);
    const gains = [Math.sqrt((1 - pan) / 2), Math.sqrt((1 + pan) / 2)];
    let phase = (midiFrom * 73) % 179;
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const index = (offset + i) % frames;
      const glide = midiFrom + (midiTo - midiFrom) * Math.min(1, t / glideTime);
      const f = frequency(glide) * (1 + tension * 0.007 * Math.sin(2 * Math.PI * 5.2 * t + 0.6));
      phase += 2 * Math.PI * f / sampleRate;
      const envelope = Math.min(1, t / 0.1) * Math.min(1, (length - t) / (sampleRate * 0.35));
      const tone = Math.sin(phase) + Math.sin(phase * 2) * 0.12 * tension;
      const value = tone * envelope * gain;
      channelData[0][index] += value * gains[0];
      channelData[1][index] += value * gains[1];
    }
  }

  // Glassy celesta: short attack, fast partials, and a whispered echo.
  function glass(midi, atBeats, gain, pan) {
    const f = frequency(midi);
    for (let echo = 0; echo < 2; echo++) {
      place((atBeats + echo * 0.42) * beat, 2.4, pan * (echo % 2 ? -0.5 : 1), (t, length) => {
        const envelope = Math.min(1, t / 0.002) * Math.exp(-t * 4.6) * Math.min(1, (length - t) / 0.22);
        const phase = 2 * Math.PI * f * t;
        return (Math.sin(phase) + Math.sin(phase * 2) * 0.24 * Math.exp(-t * 4.5)) * envelope * gain * 0.4 ** echo;
      });
    }
  }

  // Two dark low stabs -- the "who is there?" motif that anchors each phrase.
  function club(midi, atBeats, gain) {
    const f = frequency(midi);
    place(atBeats * beat, 1.15, 0, (t, length) => {
      const envelope = Math.min(1, t / 0.004) * Math.exp(-t * 2.6) * Math.min(1, (length - t) / 0.16);
      const phase = 2 * Math.PI * f * t;
      return (Math.sin(phase) + Math.sin(phase * 1.01) * 0.22 + Math.sin(phase * 2) * 0.08) * envelope * gain;
    });
  }

  // A minor add9, E-flat major add9 (its tritone), F minor add9, then E7flat9.
  const chords = [
    [45, 48, 52, 59],
    [39, 43, 46, 53],
    [41, 44, 48, 55],
    [40, 44, 47, 53],
  ];
  const roots = [33, 27, 29, 28];

  // First motif set is the "question"; each second cycle answers it.
  const question = [
    [0.5, 69, 71, 2.6, 0.15, -0.2],
    [2.9, 71, 72, 1.3, 0.11, 0.3],
    [0.75, 68, 66, 2.2, 0.12, 0.35],
    [2.75, 63, 66, 1.2, 0.1, -0.35],
    [0.5, 69, 72, 1.6, 0.14, -0.15],
    [2.0, 72, 70, 1.1, 0.11, 0.15],
    [3.25, 70, 68, 0.8, 0.09, -0.1],
    [0.5, 69, 68, 1.6, 0.13, 0.2],
    [2.0, 68, 71, 1.0, 0.11, -0.2],
    [3.25, 71, 69, 0.8, 0.1, 0.35],
  ];
  const answer = [
    [0.75, 64, 66, 2.2, 0.13, 0.3],
    [2.75, 71, 69, 1.2, 0.11, -0.3],
    [0.5, 65, 63, 2.2, 0.12, -0.35],
    [2.5, 70, 66, 1.3, 0.1, 0.15],
    [0.5, 72, 74, 1.5, 0.13, 0.2],
    [2.25, 74, 71, 1.2, 0.1, -0.2],
    [3.25, 71, 69, 0.8, 0.09, 0.1],
    [0.5, 68, 69, 1.6, 0.12, -0.25],
    [2.25, 72, 71, 1.0, 0.11, 0.3],
    [3.25, 69, 69, 0.9, 0.1, -0.35],
  ];
  const motifGroups = [[0, 1], [2, 3], [4, 5, 6], [7, 8, 9]];

  const sparkle = [
    [[1.0, 81, 0.1, -0.3], [2.75, 88, 0.09, 0.35], [3.5, 83, 0.08, 0.1]],
    [[1.0, 77, 0.09, 0.3], [2.5, 75, 0.08, -0.35], [3.25, 79, 0.09, 0.15]],
    [[0.75, 84, 0.1, 0.2], [2.0, 80, 0.09, -0.3], [3.25, 79, 0.08, 0.35]],
    [[1.0, 77, 0.09, -0.2], [2.5, 83, 0.09, 0.3], [3.25, 81, 0.1, -0.35]],
  ];

  for (let cycle = 0; cycle < cycles; cycle++) {
    const motif = cycle % 2 ? answer : question;
    for (let bar = 0; bar < 4; bar++) {
      const at = cycle * 16 + bar * 4;
      chords[bar].forEach((note, i) => pad(note, at, 4.4, (i - 1.5) * 0.28));
      [0, 1.5, 2, 3].forEach((offset, i) => bass(roots[bar], at + offset, i % 2 ? 0.22 : 0.3));
      motifGroups[bar].forEach((k) => {
        const [off, from, to, len, gain, pan] = motif[k];
        theremin(from, to, at + off, len, gain, pan);
      });
      sparkle[bar].forEach(([off, midi, gain, pan]) => glass(midi, at + off, gain, pan));
      if (tension > 0.5) {
        glass(chords[bar][0] + 24, at + 1.25, (tension - 0.5) * 0.1, 0.55);
        glass(chords[bar][2] + 24, at + 2.25, (tension - 0.5) * 0.08, -0.55);
      }
      if (bar === 3) {
        club(45, at + 2.0, 0.2);
        club(52, at + 3.0, 0.16);
      }
    }
  }

  // A slow-breathing, low-passed wind bed. Its swell reaches zero exactly at the
  // phrase boundary so the loop joins cleanly. Driven by the seeded LCG above.
  {
    const duration = frames / sampleRate;
    const cutoff = 1 - Math.exp(-2 * Math.PI * 360 / sampleRate);
    const airGain = 0.4 + tension * 0.6;
    let low = 0;
    for (let i = 0; i < frames; i++) {
      const t = i / sampleRate;
      const white = noise();
      low += cutoff * (white - low);
      const swell = 0.5 - 0.5 * Math.cos(2 * Math.PI * 2 * t / duration);
      const air = low * airGain * 0.06 * swell;
      channelData[0][i] += air;
      channelData[1][i] += air;
    }
  }

  let peak = 0;
  for (const channel of channelData) for (const value of channel) peak = Math.max(peak, Math.abs(value));
  // volume is the fraction of full scale the peak reaches, so volume 1 is as loud as this gets.
  const master = peak > 0 ? (volume * 0.98) / peak : 0;
  for (const channel of channelData) for (let i = 0; i < frames; i++) channel[i] *= master;
  return { sampleRate, channelData, loop: true };
}