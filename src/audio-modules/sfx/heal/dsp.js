export function render({ sampleRate, duration, volume, warmth }) {
  const frames = Math.round(sampleRate * duration);
  const channelData = [new Float32Array(frames), new Float32Array(frames)];
  const notes = [523.251, 659.255, 783.991, 1046.502];
  for (let note = 0; note < notes.length; note++) {
    const onset = duration * (0.05 + note * 0.13);
    for (let echo = 0; echo < 3; echo++) {
      const start = Math.round((onset + echo * duration * 0.11) * sampleRate);
      const pan = Math.max(-0.9, Math.min(0.9, (note - 1.5) * 0.35 * (echo % 2 ? -1 : 1)));
      for (let i = start; i < frames; i++) {
        const t = (i - start) / sampleRate;
        const f = notes[note];
        const phase = 2 * Math.PI * f * (t - 0.003 * (1 - Math.exp(-t / 0.05)));
        const envelope = (1 - Math.exp(-t / 0.016)) * Math.exp(-t * 6 / duration);
        const bell = Math.sin(phase + (1 - warmth) * 0.8 * Math.sin(phase * 2) * Math.exp(-t * 9));
        const warm = Math.sin(phase / 2) * warmth * 0.35;
        const value = (bell + warm) * envelope * 0.24 * (0.28 ** echo);
        channelData[0][i] += value * Math.sqrt((1 - pan) / 2);
        channelData[1][i] += value * Math.sqrt((1 + pan) / 2);
      }
    }
  }
  for (const samples of channelData) {
    for (let i = 0; i < frames; i++) samples[i] *= Math.min(1, (frames - 1 - i) / (sampleRate * duration * 0.18));
  }
  // volume is the fraction of full scale the peak reaches, so volume 1 is as loud as this gets.
  let peak = 0;
  for (const channel of channelData) for (const value of channel) peak = Math.max(peak, Math.abs(value));
  const master = peak > 0 ? (volume * 0.98) / peak : 0;
  for (const channel of channelData) for (let i = 0; i < channel.length; i++) channel[i] *= master;
  return { sampleRate, channelData, loop: false };
}
