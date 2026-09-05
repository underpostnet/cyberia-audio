export function render({ sampleRate, duration, volume, severity, seed }) {
  const samples = new Float32Array(Math.round(sampleRate * duration));
  let state = seed >>> 0;
  let low = 0;
  let phase = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    const progress = t / duration;
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const noise = state / 2147483648 - 1;
    low += (1 - Math.exp(-2 * Math.PI * 1200 / sampleRate)) * (noise - low);
    phase += 2 * Math.PI * (60 + 240 * Math.exp(-progress * 5)) / sampleRate;
    const dissonance = Math.sin(phase) + 0.45 * Math.sin(phase * 1.067);
    const roughness = 1 - severity * 0.45 + severity * 0.45 * Math.sin(2 * Math.PI * 43 * t);
    const thud = dissonance * roughness * Math.exp(-progress * 6);
    const impact = low * Math.exp(-progress * 24) * 1.8;
    const envelope = Math.min(1, t / 0.001) * Math.min(1, (samples.length - 1 - i) / (sampleRate * 0.025));
    samples[i] = Math.tanh((thud + impact) * (1 + severity)) * envelope * volume * 0.7;
  }
  return { sampleRate, channelData: [samples], loop: false };
}
