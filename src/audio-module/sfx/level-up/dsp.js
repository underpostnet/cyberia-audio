// Heroic MMO Level-Up Sound Cue DSP
// Combines a low-frequency impact, a warm major arpeggio climb, and a lush blooming chord resolution.
// Designed with smooth saturation and low-pass filtering to completely remove high-pitched ringing.
export function render({ sampleRate, duration, volume, steps, shimmer }) {
  const frames = Math.round(duration * sampleRate);
  const channelData = [new Float32Array(frames), new Float32Array(frames)];
  const tau = Math.PI * 2;

  function place(at, length, pan, voice) {
    const start = Math.round(at * sampleRate);
    const gains = [Math.sqrt((1 - pan) / 2), Math.sqrt((1 + pan) / 2)];
    const count = Math.min(frames - start, Math.round(length * sampleRate));
    for (let i = 0; i < count; i++) {
      const t = i / sampleRate;
      const value = voice(t);
      channelData[0][start + i] += value * gains[0];
      channelData[1][start + i] += value * gains[1];
    }
  }

  // 1. Sub-Bass Thump: Gives physical weight to the level-up moment (80 Hz -> 35 Hz drop)
  place(0, 0.35, 0, (t) => {
    const freq = 80 * Math.exp(-t * 9) + 35;
    const env = Math.sin(Math.min(1, t / 0.005) * Math.PI * 0.5) * Math.exp(-t * 7);
    return 0.35 * env * Math.sin(tau * freq * t);
  });

  // 2. Ascending Arpeggio Steps: Warm C-Major scale (C3 to C5)
  const scale = [130.81, 164.81, 196.0, 261.63, 329.63, 392.0, 523.25];
  const climb = duration * 0.38;

  for (let i = 0; i < steps; i++) {
    const progress = i / Math.max(1, steps - 1);
    const at = climb * (1 - (1 - progress) ** 1.5);
    const noteIdx = Math.min(scale.length - 1, Math.round(progress * (scale.length - 1)));
    const f = scale[noteIdx];
    const pan = (progress - 0.5) * 0.4;
    const isLast = i === steps - 1;
    const stepLength = isLast ? duration - at : 0.28;

    place(at, stepLength, pan, (t) => {
      const env = Math.min(1, t / 0.006) * Math.exp(-t * (isLast ? 2.2 : 10));
      // Organic brass/organ tone: fundamental + soft 2nd harmonic
      const tone = Math.sin(tau * f * t) + 0.22 * Math.sin(tau * f * 2 * t) * Math.exp(-t * 15);
      return (isLast ? 0.32 : 0.22) * env * Math.tanh(tone * 1.2);
    });
  }

  // 3. Smooth Pitch Sweep: Low rising tone (C3 -> C4) providing motion under the arpeggio
  place(0.02, climb + 0.15, 0, (t) => {
    const p = Math.min(1, t / climb);
    const f = 130.81 * (1 + p);
    const env = Math.sin(Math.min(1, t / 0.03) * Math.PI * 0.5) * (1 - p * 0.5) * Math.exp(-Math.max(0, t - climb) * 8);
    return 0.18 * env * Math.sin(tau * f * t);
  });

  // 4. Heroic Final Chord Blossom: Replaces sharp single note with full C-Major chord sustain
  const chordFreqs = [130.81, 196.0, 261.63, 329.63, 392.0, 523.25];
  const chordPans = [-0.25, 0.25, -0.15, 0.15, -0.05, 0.05];
  const chordWeights = [0.25, 0.2, 0.24, 0.22, 0.18, 0.14]; // Gently taper high voices

  const chordStart = climb * 0.88;
  const chordDuration = duration - chordStart;

  chordFreqs.forEach((f, idx) => {
    place(chordStart, chordDuration, chordPans[idx], (t) => {
      const lfo = 1 + 0.1 * Math.sin(tau * 4.5 * t);
      const env = Math.min(1, t / 0.08) * Math.exp(-t * 1.8) * lfo;
      const s = Math.sin(tau * f * t) + 0.15 * Math.sin(tau * f * 2 * t);
      return shimmer * chordWeights[idx] * env * Math.tanh(s * 1.1);
    });
  });

  // 5. Warm Low-Pass Filter (2000 Hz Cutoff) & Smooth Tail Fade
  const cutoffHz = 2000;
  const alpha = 1 - Math.exp((-tau * cutoffHz) / sampleRate);

  for (const channel of channelData) {
    let smoothed = 0;
    for (let i = 0; i < frames; i++) {
      smoothed += alpha * (channel[i] - smoothed);
      const tailFade = Math.min(1, (frames - 1 - i) / (sampleRate * 0.12));
      channel[i] = smoothed * tailFade;
    }
  }

  // Peak Normalization
  let peak = 0;
  for (const channel of channelData) {
    for (let i = 0; i < frames; i++) {
      peak = Math.max(peak, Math.abs(channel[i]));
    }
  }

  const master = peak > 0 ? (volume * 0.98) / peak : 0;
  for (const channel of channelData) {
    for (let i = 0; i < frames; i++) {
      channel[i] *= master;
    }
  }

  return { sampleRate, channelData, loop: false };
}
