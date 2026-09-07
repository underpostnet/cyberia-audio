export function render({ sampleRate, volume, duration, weight, seed }) {
  const frames = Math.round(sampleRate * duration);
  const channelData = [new Float32Array(frames), new Float32Array(frames)];
  let state = seed >>> 0;
  const noise = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2147483648 - 1;
  };

  // One gait cycle: left foot, then right. The pair is what the client repeats while anything is
  // walking, so the two steps carry the alternation instead of the caller having to pan them.
  function step(atSeconds, pan, gain) {
    const start = Math.round(atSeconds * sampleRate);
    const gains = [Math.sqrt((1 - pan) / 2), Math.sqrt((1 + pan) / 2)];
    // A one-pole low pass, run over the step's own noise: the body of a foot on ground is dull,
    // and an unfiltered burst would read as a click.
    const cutoff = 1 - Math.exp((-2 * Math.PI * (620 + 280 * weight)) / sampleRate);
    let low = 0;
    for (let i = start; i < frames; i++) {
      const t = (i - start) / sampleRate;
      if (t > 0.26) break;
      low += cutoff * (noise() - low);
      // Softened attack: a few milliseconds of rise, so the transient is a press, not a snap.
      const body = Math.min(1, t / 0.006) * Math.exp(-t * 34);
      // The weight under it — a short low sine that decays before the body does.
      const thump = Math.sin(2 * Math.PI * (78 + 26 * weight) * t) * Math.exp(-t * 46) * 0.5 * weight;
      // Scuff: the only brightness, and it is over almost immediately.
      const scuff = noise() * Math.exp(-t * 150) * 0.12 * (1 - weight * 0.5);
      const value = (low * 1.5 + thump + scuff) * body * gain;
      channelData[0][i] += value * gains[0];
      channelData[1][i] += value * gains[1];
    }
  }

  step(0.012, -0.38, 0.5);
  // The trailing foot lands a touch lighter, which is what keeps the pair from sounding mechanical.
  step(duration * 0.5, 0.38, 0.42);

  // Both boundaries reach silence: a one-shot must start and end at zero.
  const edge = Math.max(1, Math.round(sampleRate * 0.004));
  for (const samples of channelData) {
    for (let i = 0; i < frames; i++) samples[i] *= Math.min(1, i / edge, (frames - 1 - i) / edge);
  }

  // volume is the fraction of full scale the peak reaches, so volume 1 is as loud as this gets.
  let peak = 0;
  for (const channel of channelData) for (const value of channel) peak = Math.max(peak, Math.abs(value));
  const master = peak > 0 ? (volume * 0.98) / peak : 0;
  for (const channel of channelData) for (let i = 0; i < frames; i++) channel[i] *= master;
  return { sampleRate, channelData, loop: false };
}
