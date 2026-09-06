export function render({ sampleRate, duration, volume, brightness }) {
  const samples = new Float32Array(Math.round(sampleRate * duration));
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    const progress = t / duration;
    const body = Math.sin(2 * Math.PI * 680 * t) * Math.exp(-progress * 11);
    const shell = Math.sin(2 * Math.PI * 1820 * t) * Math.exp(-progress * 22);
    const snap = Math.sin(2 * Math.PI * 3270 * t) * Math.exp(-progress * 35);
    const envelope = Math.min(1, t / 0.0004) * Math.min(1, (samples.length - 1 - i) / (sampleRate * 0.005));
    samples[i] = (body * 0.55 + shell * (0.15 + brightness * 0.2) + snap * brightness * 0.25) * envelope;
  }
  // volume is the fraction of full scale the peak reaches, so volume 1 is as loud as this gets.
  let peak = 0;
  for (const value of samples) peak = Math.max(peak, Math.abs(value));
  const master = peak > 0 ? (volume * 0.98) / peak : 0;
  for (let i = 0; i < samples.length; i++) samples[i] *= master;
  return { sampleRate, channelData: [samples], loop: false };
}
