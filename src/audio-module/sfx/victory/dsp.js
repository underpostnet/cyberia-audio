// A celebration going off: a drum flourish under a rising chime, with sparkles thrown upward and
// outward behind it. An event, not a phrase — it fires and is gone.
//
// The brightness is deliberately held back. Every sparkle is a sine with one soft partial, its
// attack is a rise rather than a step, and the whole render is tilted away from the top end, so
// the burst reads as celebratory rather than as glass breaking.
export function render({ sampleRate, duration, volume, sparkle, seed }) {
  const frames = Math.round(duration * sampleRate);
  const channelData = [new Float32Array(frames), new Float32Array(frames)];
  const tau = Math.PI * 2;
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };

  function place(at, length, pan, voice) {
    const start = Math.round(at * sampleRate);
    const gains = [Math.sqrt((1 - pan) / 2), Math.sqrt((1 + pan) / 2)];
    const count = Math.min(frames - start, Math.round(length * sampleRate));
    for (let i = 0; i < count; i++) {
      const value = voice(i / sampleRate);
      channelData[0][start + i] += value * gains[0];
      channelData[1][start + i] += value * gains[1];
    }
  }

  // Drums: a three-hit flourish landing on the downbeat, tuned rather than noisy so it thumps
  // without cutting.
  for (const [at, f, gain] of [[0, 150, 0.5], [0.055, 132, 0.42], [0.115, 98, 0.85]]) {
    place(at, 0.42, 0, (t) => {
      const pitch = f * (1 + 0.9 * Math.exp(-t * 34));
      const envelope = Math.min(1, t / 0.003) * Math.exp(-t * 13);
      return gain * envelope * (Math.sin(tau * pitch * t) + 0.18 * Math.sin(tau * pitch * 1.5 * t));
    });
  }

  // Chime: a major triad rising into its octave, one note per step, each ringing over the next.
  const chime = [0, 4, 7, 12];
  chime.forEach((semitone, index) => {
    const f = 523.25 * 2 ** (semitone / 12);
    place(0.1 + index * 0.075, 0.9, (index % 2 ? 1 : -1) * 0.22, (t) => {
      const envelope = Math.min(1, t / 0.006) * Math.exp(-t * 4.6);
      return 0.3 * envelope * (Math.sin(tau * f * t) + 0.22 * Math.sin(tau * f * 2 * t) * Math.exp(-t * 9));
    });
  });

  // Sparkles: short grains thrown upward, later ones higher and wider, so the cloud lifts and
  // spreads instead of arriving all at once. This is the confetti.
  for (let i = 0; i < sparkle; i++) {
    const progress = i / Math.max(1, sparkle - 1);
    const at = 0.12 + progress * (duration * 0.5) + random() * 0.04;
    const f = 900 * 2 ** (progress * 1.6 + random() * 0.35);
    const pan = (random() * 2 - 1) * (0.35 + 0.5 * progress);
    place(at, 0.3, pan, (t) => {
      // Each grain lifts a little as it decays: the "jumping upward" the cloud is made of.
      const lift = f * (1 + 0.22 * (1 - Math.exp(-t * 16)));
      const envelope = Math.min(1, t / 0.004) * Math.exp(-t * 19);
      return 0.085 * envelope * (Math.sin(tau * lift * t) + 0.16 * Math.sin(tau * lift * 2 * t));
    });
  }

  // A one-pole low pass takes the edge off the whole burst, and the tail fades so nothing clicks.
  const alpha = 1 - Math.exp((-tau * 5200) / sampleRate);
  for (const channel of channelData) {
    let smoothed = 0;
    for (let i = 0; i < frames; i++) {
      smoothed += alpha * (channel[i] - smoothed);
      channel[i] = smoothed * Math.min(1, (frames - 1 - i) / (sampleRate * 0.12));
    }
  }

  // volume is the fraction of full scale the peak reaches, so volume 1 is as loud as this gets.
  let peak = 0;
  for (const channel of channelData) for (const value of channel) peak = Math.max(peak, Math.abs(value));
  const master = peak > 0 ? (volume * 0.98) / peak : 0;
  for (const channel of channelData) for (let i = 0; i < frames; i++) channel[i] *= master;
  return { sampleRate, channelData, loop: false };
}
