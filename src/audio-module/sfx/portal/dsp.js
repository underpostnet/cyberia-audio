export function render({ sampleRate, volume, duration }) {
  const samples = new Float32Array(Math.round(sampleRate * duration));
  let phase = 0;
  for (let i = 0; i < samples.length; i++) {
    const progress = i / (samples.length - 1);
    phase += 2 * Math.PI * (170 + 1100 * progress ** 2) / sampleRate;
    const envelope = Math.sin(Math.PI * progress) ** 2;
    samples[i] = (Math.sin(phase) + 0.35 * Math.sin(phase * 1.5) +
      0.2 * Math.sin(phase * 2 + Math.sin(phase * 0.25))) * envelope;
  }
  samples[0] = samples[samples.length - 1] = 0;
  let peak = 0;
  for (const value of samples) peak = Math.max(peak, Math.abs(value));
  const gain = peak > 0 ? volume * 0.98 / peak : 0;
  for (let i = 0; i < samples.length; i++) samples[i] *= gain;
  return { sampleRate, channelData: [samples], loop: false };
}
