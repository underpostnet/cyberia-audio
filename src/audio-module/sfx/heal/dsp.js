export function render({ sampleRate, duration, volume, warmth }) {
  const frames = Math.round(sampleRate * duration);
  const channelData = [new Float32Array(frames), new Float32Array(frames)];
  // A soft major triad in the middle register — D4, F#4, A4, D5. Low enough to stay out of the
  // way of the sharp cues, present enough to be heard over a music bed: the client sounds this
  // only when an entity's life crosses a quarter, so it has to carry when it does.
  const notes = [293.665, 369.994, 440.0, 587.33];

  for (let note = 0; note < notes.length; note++) {
    const start = Math.round(duration * (0.04 + note * 0.09) * sampleRate);
    const pan = (note - 1.5) * 0.24;
    const gains = [Math.sqrt((1 - pan) / 2), Math.sqrt((1 + pan) / 2)];
    // The upper voices carry least: the triad reads as one warm swell, not four notes.
    const weight = 0.34 * (0.62 ** note);
    for (let i = start; i < frames; i++) {
      const t = (i - start) / sampleRate;
      const f = notes[note];
      const phase = 2 * Math.PI * f * t;
      // Squared exponential rise: no attack transient for the ear to catch on, which is what
      // made the old bell sharp. The fall runs the whole tail so nothing stops abruptly.
      const rise = 1 - Math.exp(-t / (0.045 + 0.03 * warmth));
      const envelope = rise * rise * Math.exp((-t * 2.4) / duration);
      // Nearly a pure sine. The octave below adds body; the fifth above is the only brightness,
      // and it is gone before the swell peaks.
      const tone = Math.sin(phase)
        + Math.sin(phase / 2) * warmth * 0.3
        + Math.sin(phase * 1.5) * 0.05 * (1 - warmth) * Math.exp(-t * 5);
      const value = tone * envelope * weight;
      channelData[0][i] += value * gains[0];
      channelData[1][i] += value * gains[1];
    }
  }

  // Both boundaries reach silence: a one-shot must start and end at zero.
  const edge = Math.max(1, Math.round(sampleRate * duration * 0.05));
  const tail = Math.max(1, Math.round(sampleRate * duration * 0.22));
  for (const samples of channelData) {
    for (let i = 0; i < frames; i++) {
      samples[i] *= Math.min(1, i / edge, (frames - 1 - i) / tail);
    }
  }

  // volume is the fraction of full scale the peak reaches, so volume 1 is as loud as this gets.
  let peak = 0;
  for (const channel of channelData) for (const value of channel) peak = Math.max(peak, Math.abs(value));
  const master = peak > 0 ? (volume * 0.98) / peak : 0;
  for (const channel of channelData) for (let i = 0; i < channel.length; i++) channel[i] *= master;
  return { sampleRate, channelData, loop: false };
}
