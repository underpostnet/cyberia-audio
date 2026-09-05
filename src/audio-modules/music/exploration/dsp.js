const frequency = (midi) => 440 * 2 ** ((midi - 69) / 12);

export function render({ sampleRate, volume, bpm, cycles, density }) {
  const beat = 60 / bpm;
  const frames = Math.round(cycles * 16 * beat * sampleRate);
  const channelData = [new Float32Array(frames), new Float32Array(frames)];

  // Every voice is written on a circular phrase, including its release and echoes.
  // This preserves the tail from the previous phrase at the next loop's start.
  function place(start, length, pan, voice) {
    const offset = Math.round(start * sampleRate);
    const gains = [Math.sqrt((1 - pan) / 2), Math.sqrt((1 + pan) / 2)];
    for (let i = 0; i < Math.round(length * sampleRate); i++) {
      const t = i / sampleRate;
      const index = (offset + i) % frames;
      const value = voice(t, length);
      channelData[0][index] += value * gains[0];
      channelData[1][index] += value * gains[1];
    }
  }

  function pad(midi, start, pan) {
    const f = frequency(midi);
    place(start, beat * 4 + 0.6, pan, (t, length) => {
      const envelope = Math.min(1, t / 0.3) * Math.min(1, (length - t) / 0.65);
      const phase = 2 * Math.PI * f * t;
      const shimmer = Math.sin(phase * 1.0015) + Math.sin(phase * 0.9985);
      return (shimmer * 0.5 + Math.sin(phase * 2) * 0.12) * envelope * 0.075;
    });
  }

  function chime(midi, start, gain, pan) {
    const f = frequency(midi);
    for (let echo = 0; echo < 3; echo++) {
      place(start + echo * beat * 0.75, beat * 2.5, pan * (echo % 2 ? -1 : 1), (t, length) => {
        const envelope = Math.min(1, t / 0.005) * Math.exp(-t * 3.5) * Math.min(1, (length - t) / 0.1);
        const phase = 2 * Math.PI * f * t;
        return (Math.sin(phase) + Math.sin(phase * 2) * 0.22 * Math.exp(-t * 5)) * envelope * gain * 0.32 ** echo;
      });
    }
  }

  function bass(midi, start) {
    const f = frequency(midi);
    place(start, beat * 3.5, 0, (t, length) => {
      const envelope = Math.min(1, t / 0.04) * Math.min(1, (length - t) / 0.3) * Math.exp(-t * 0.65);
      return (Math.sin(2 * Math.PI * f * t) + Math.sin(4 * Math.PI * f * t) * 0.12) * envelope * 0.18;
    });
  }

  const harmony = [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 60, 62, 67]];
  const roots = [36, 33, 29, 31];
  const question = [[76, 79, 74], [76, 72, 71], [69, 72, 76], [74, 79, 74]];
  const answer = [[79, 83, 79], [76, 79, 72], [77, 76, 72], [74, 72, 67]];
  for (let cycle = 0; cycle < cycles; cycle++) {
    for (let bar = 0; bar < 4; bar++) {
      const start = (cycle * 16 + bar * 4) * beat;
      harmony[bar].forEach((note, i) => pad(note, start, (i - 1.5) * 0.3));
      bass(roots[bar], start);
      const motif = (cycle % 2 ? answer : question)[bar];
      chime(motif[0], start + beat * 0.5, 0.2, -0.3);
      chime(motif[1], start + beat * 2, 0.15, 0.35);
      if (density > 0.25) chime(motif[2], start + beat * 3.25, density * 0.16, 0.1);
      if (density > 0.65) {
        chime(harmony[bar][1] + 12, start + beat * 1.25, 0.1 * density, -0.55);
        chime(harmony[bar][2] + 12, start + beat * 2.75, 0.1 * density, 0.55);
      }
    }
  }

  let peak = 0;
  for (const channel of channelData) for (const value of channel) peak = Math.max(peak, Math.abs(value));
  const gain = volume * Math.min(1, 0.85 / (peak || 1));
  for (const channel of channelData) for (let i = 0; i < frames; i++) channel[i] *= gain;
  return { sampleRate, channelData, loop: true };
}
