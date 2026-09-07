export function render({ sampleRate, duration, volume, weight, seed }) {
  const channelData = [new Float32Array(Math.round(sampleRate * duration)), new Float32Array(Math.round(sampleRate * duration))];
  let state = seed >>> 0;
  const noise = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2147483648 - 1;
  };
  const low = [0, 0];
  const rumble = [0, 0];
  const previous = [0, 0];
  const dc = [0, 0];
  let phase = 0;
  const frames = channelData[0].length;
  for (let i = 0; i < frames; i++) {
    const t = i / sampleRate;
    const progress = t / duration;
    const shared = noise();
    const cutoff = 100 + 6200 * Math.exp(-progress * 11);
    const coefficient = 1 - Math.exp(-2 * Math.PI * cutoff / sampleRate);
    const bassCoefficient = 1 - Math.exp(-2 * Math.PI * 95 / sampleRate);
    phase += 2 * Math.PI * (28 + (70 + weight * 35) * Math.exp(-progress * 13)) / sampleRate;
    const sub = Math.sin(phase) * Math.exp(-progress * 7) * (0.2 + weight * 0.45);
    const attack = Math.min(1, t / 0.0015);
    const release = Math.min(1, (frames - 1 - i) / (sampleRate * 0.12));
    for (let c = 0; c < 2; c++) {
      const turbulence = shared * 0.65 + noise() * 0.35;
      low[c] += coefficient * (turbulence - low[c]);
      rumble[c] += bassCoefficient * (turbulence - rumble[c]);
      const debris = low[c] * (1 + 0.2 * Math.sin(2 * Math.PI * 17 * t + c)) * Math.exp(-progress * 4.5);
      const impact = shared * Math.exp(-progress * 65) * 0.3;
      const value = Math.tanh(debris * 2.8 + rumble[c] * weight * 3 + sub + impact);
      // Remove DC/very slow drift from the noise without losing audible sub-bass.
      dc[c] = value - previous[c] + Math.exp(-2 * Math.PI * 15 / sampleRate) * dc[c];
      previous[c] = value;
      channelData[c][i] = Math.tanh(dc[c]) * attack * release;
    }
  }
  // volume is the fraction of full scale the peak reaches, so volume 1 is as loud as this gets.
  let peak = 0;
  for (const channel of channelData) for (const value of channel) peak = Math.max(peak, Math.abs(value));
  const master = peak > 0 ? (volume * 0.98) / peak : 0;
  for (const channel of channelData) for (let i = 0; i < channel.length; i++) channel[i] *= master;
  return { sampleRate, channelData, loop: false };
}
