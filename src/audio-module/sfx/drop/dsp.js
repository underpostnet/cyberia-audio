export function render({ sampleRate, volume, duration, seed }) {
  const samples = new Float32Array(Math.round(duration * sampleRate));
  let state = seed >>> 0;
  let phase = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    const progress = t / duration;
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    phase += 2 * Math.PI * (100 + 550 * Math.exp(-progress * 18)) / sampleRate;
    const envelope = Math.min(1, t / 0.002) * Math.min(1, (samples.length - 1 - i) / (sampleRate * 0.02));
    samples[i] = (Math.sin(phase) * Math.exp(-progress * 8) * 0.65 +
      (state / 2147483648 - 1) * Math.exp(-progress * 35) * 0.35) * envelope;
  }
  let peak = 0;
  for (const value of samples) peak = Math.max(peak, Math.abs(value));
  const gain = peak > 0 ? volume * 0.98 / peak : 0;
  for (let i = 0; i < samples.length; i++) samples[i] *= gain;
  return { sampleRate, channelData: [samples], loop: false };
}
