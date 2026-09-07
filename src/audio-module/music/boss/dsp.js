export function render({ sampleRate, volume, bpm, rounds }) {
  const beat = 60 / bpm;
  const frames = Math.round(rounds * 16 * beat * sampleRate);
  const channelData = [new Float32Array(frames), new Float32Array(frames)];
  const roots = [38, 38, 34, 37];
  const motif = [0, 12, 7, 1, 0, 7, 13, 12];
  for (let step = 0; step < rounds * 32; step++) {
    const offset = Math.round(step * beat * 0.5 * sampleRate);
    const root = roots[Math.floor(step / 8) % roots.length];
    const hz = 440 * 2 ** ((root + motif[step % motif.length] - 69) / 12);
    const length = Math.round(beat * 0.48 * sampleRate);
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const edge = Math.min(1, i / (sampleRate * 0.004)) * Math.min(1, (length - 1 - i) / (sampleRate * 0.012));
      const phase = 2 * Math.PI * hz * t;
      const bass = (Math.sin(phase) + 0.4 * Math.sin(phase * 2) + 0.2 * Math.sin(phase * 3)) * Math.exp(-t * 8);
      const kick = step % 2 === 0 ? Math.sin(2 * Math.PI * (45 * t + 1.8 * (1 - Math.exp(-t * 45)))) * Math.exp(-t * 18) : 0;
      const bell = Math.sin(phase * 4) * Math.exp(-t * 20) * 0.15;
      const index = (offset + i) % frames;
      channelData[0][index] += (bass * 0.5 + kick * 0.55 + bell * (step % 2 ? 1 : 0.4)) * edge;
      channelData[1][index] += (bass * 0.5 + kick * 0.55 + bell * (step % 2 ? 0.4 : 1)) * edge;
    }
  }
  let peak = 0;
  for (const channel of channelData) for (const value of channel) peak = Math.max(peak, Math.abs(value));
  const gain = peak > 0 ? volume * 0.98 / peak : 0;
  for (const channel of channelData) for (let i = 0; i < frames; i++) channel[i] *= gain;
  return { sampleRate, channelData, loop: true };
}
