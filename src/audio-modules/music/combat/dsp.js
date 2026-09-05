const frequency = (midi) => 440 * 2 ** ((midi - 69) / 12);

export function render({ sampleRate, volume, bpm, rounds, intensity, seed }) {
  const beat = 60 / bpm;
  const frames = Math.round(rounds * 16 * beat * sampleRate);
  const channelData = [new Float32Array(frames), new Float32Array(frames)];
  let state = seed >>> 0;
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

  function kick(atBeat, gain = 1) {
    place(atBeat, 0.32, 0, (t) => {
      const phase = 2 * Math.PI * (46 * t + 125 * 0.018 * (1 - Math.exp(-t / 0.018)));
      return (Math.sin(phase) * Math.exp(-t * 14) * 0.65 + noise() * Math.exp(-t * 160) * 0.15) * gain;
    });
  }

  function snare(atBeat, gain = 1) {
    let low = 0;
    place(atBeat, 0.2, 0.08, (t) => {
      const white = noise();
      low += (1 - Math.exp(-2 * Math.PI * 1600 / sampleRate)) * (white - low);
      return ((white - low) * Math.exp(-t * 24) * 0.55 + Math.sin(2 * Math.PI * 185 * t) * Math.exp(-t * 35) * 0.22) * gain;
    });
  }

  function hat(atBeat, open, pan, gain) {
    let low = 0;
    place(atBeat, open ? 0.18 : 0.065, pan, (t) => {
      const white = noise();
      low += (1 - Math.exp(-2 * Math.PI * 6500 / sampleRate)) * (white - low);
      return (white - low) * Math.exp(-t * (open ? 24 : 65)) * gain;
    });
  }

  function bass(midi, atBeat, accent) {
    const f = frequency(midi);
    place(atBeat, beat * 0.43, -0.05, (t) => {
      const phase = 2 * Math.PI * f * t;
      let oscillator = Math.sin(phase);
      for (let harmonic = 2; harmonic <= 8; harmonic++) {
        const brightness = Math.exp(-t * (8 + harmonic * 5));
        oscillator += Math.sin(phase * harmonic) * brightness * (0.25 + intensity * 0.4) / harmonic;
      }
      return Math.tanh(oscillator * 1.4) * Math.exp(-t * 9) * (accent ? 0.32 : 0.23);
    });
  }

  function lead(midi, atBeat, pan) {
    const f = frequency(midi);
    place(atBeat, beat * 0.65, pan, (t) => {
      const phase = 2 * Math.PI * f * t;
      let oscillator = Math.sin(phase);
      for (let harmonic = 3; harmonic <= 9; harmonic += 2) {
        if (f * harmonic < sampleRate * 0.45) oscillator += Math.sin(phase * harmonic) / harmonic * intensity;
      }
      return oscillator * Math.min(1, t / 0.008) * Math.exp(-t * 8) * 0.12;
    });
  }

  for (let bar = 0; bar < rounds * 4; bar++) {
    const start = bar * 4;
    const root = [38, 38, 34, 39][bar % 4]; // D, D, B-flat, E-flat: pedal and tension.
    for (const offset of [0, 1.5, 2, 3.25]) kick(start + offset, offset === 0 ? 1 : 0.85);
    snare(start + 1);
    snare(start + 3);
    for (let step = 0; step < 16; step++) {
      if (step % 2 === 0 || intensity > 0.55) {
        hat(start + step / 4, step === 14, step % 4 ? 0.45 : -0.35, (step % 2 ? 0.13 : 0.23) * (0.5 + intensity * 0.5));
      }
    }
    const rhythm = [0, 0.5, 0.75, 1.5, 2, 2.5, 3.25, 3.5];
    rhythm.forEach((offset, i) => bass(root + (i === 3 || i === 7 ? 12 : 0), start + offset, i % 4 === 0));
    if (intensity > 0.2) {
      const motif = bar % 4 === 3 ? [75, 74, 69, 73] : [74, 77, 76, 81];
      motif.forEach((note, i) => lead(note, start + i * 0.75 + (bar % 2 ? 0.25 : 0), i % 2 ? 0.3 : -0.3));
    }
    if (bar % 4 === 3) {
      snare(start + 3.5, 0.55);
      if (intensity > 0.5) snare(start + 3.75, 0.7);
    }
  }

  let peak = 0;
  for (const channel of channelData) for (const value of channel) peak = Math.max(peak, Math.abs(value));
  const gain = volume * Math.min(1, 0.88 / (peak || 1));
  for (const channel of channelData) for (let i = 0; i < frames; i++) channel[i] *= gain;
  return { sampleRate, channelData, loop: true };
}
