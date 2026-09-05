export function render({ sampleRate, duration, volume, power, seed }) {
  const samples = new Float32Array(Math.round(sampleRate * duration));
  let state = seed >>> 0;
  let low = 0;
  let body = 0;
  let phase = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    const progress = t / duration;
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const noise = state / 2147483648 - 1;
    low += (1 - Math.exp(-2 * Math.PI * 1800 / sampleRate)) * (noise - low);
    body += (1 - Math.exp(-2 * Math.PI * (500 + 1000 * power) / sampleRate)) * (noise - body);
    const crack = (noise - low) * Math.exp(-progress * 32);
    phase += 2 * Math.PI * (95 + 1600 * Math.exp(-progress * 18)) / sampleRate;
    const punch = Math.sin(phase) * Math.exp(-progress * 12);
    const tail = body * Math.exp(-progress * 7);
    const envelope = Math.min(1, t / 0.0006) * Math.min(1, (samples.length - 1 - i) / (sampleRate * 0.01));
    samples[i] = Math.tanh((crack * 1.15 + punch * (0.25 + power * 0.3) + tail * 0.8) * 1.4) * envelope * volume * 0.85;
  }
  return { sampleRate, channelData: [samples], loop: false };
}
