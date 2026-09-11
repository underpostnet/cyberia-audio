// Dark RPG / MMO Entity Death Sound Cue DSP
// Synthesizes a fatal impact, descending defeat glide, dark dissonant chord bloom,
// slowing heartbeat pulses, and a fading low-pass filter sweep.
export function render({ sampleRate, duration, volume, dissonance, darkness, seed }) {
  const frames = Math.round(duration * sampleRate);
  const channelData = [new Float32Array(frames), new Float32Array(frames)];
  const tau = Math.PI * 2;
  // The impact noise comes from a seeded source, so a render is reproducible.
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
      const t = i / sampleRate;
      const value = voice(t);
      channelData[0][start + i] += value * gains[0];
      channelData[1][start + i] += value * gains[1];
    }
  }

  // 1. Heavy Fatal Blow Impact: Pitch sweep (140 Hz -> 32 Hz) with quick noise punch
  place(0, 0.45, 0, (t) => {
    const freq = 140 * Math.exp(-t * 18) + 32;
    const bodyEnv = Math.sin(Math.min(1, t / 0.004) * Math.PI * 0.5) * Math.exp(-t * 8);
    const noise = (random() * 2 - 1) * Math.exp(-t * 22) * 0.25;
    const tone = Math.sin(tau * freq * t) + 0.3 * Math.sin(tau * freq * 0.5 * t);
    return 0.48 * bodyEnv * Math.tanh((tone + noise) * 1.3);
  });

  // 2. Descending Pitch Decay: Falling tone scale representing loss of vitality
  const descendNotes = [220.0, 196.0, 164.81, 130.81, 110.0, 82.41]; // A3 down to E2
  const slideDuration = duration * 0.42;

  descendNotes.forEach((f, idx) => {
    const progress = idx / (descendNotes.length - 1);
    const at = slideDuration * Math.pow(progress, 1.2);
    const pan = (0.5 - progress) * 0.3;
    const noteLen = 0.35 + (1 - progress) * 0.2;

    place(at, noteLen, pan, (t) => {
      const env = Math.min(1, t / 0.01) * Math.exp(-t * 6);
      const tone = Math.sin(tau * f * t) + 0.18 * Math.sin(tau * f * 2 * t) * Math.exp(-t * 10);
      return 0.2 * env * Math.tanh(tone * 1.1);
    });
  });

  // 3. Dark Dissonant Chord Sustain: Brooding minor triad with added flat-5th tension
  // Base frequencies around A2 (110 Hz), C3 (130.81 Hz), E-flat3 (155.56 Hz), G#2 (103.83 Hz)
  const baseFreqs = [110.0, 130.81, 155.56, 103.83, 82.41];
  const chordStart = slideDuration * 0.55;
  const chordLen = duration - chordStart;

  baseFreqs.forEach((baseF, idx) => {
    // Modify interval tension using dissonance parameter
    const f = baseF * (1 + dissonance * 0.03 * (idx % 2 === 0 ? 1 : -1));
    const pan = (idx - 2) * 0.12;

    place(chordStart, chordLen, pan, (t) => {
      // Slow pulsing tremolo simulating fading pulse
      const pulse = 0.8 + 0.2 * Math.sin(tau * (2.5 + idx * 0.4) * t);
      const env = Math.min(1, t / 0.15) * Math.exp(-t * 1.4) * pulse;
      const subTone = Math.sin(tau * f * t) + 0.12 * Math.sin(tau * f * 0.5 * t);
      return 0.18 * env * Math.tanh(subTone * 1.2);
    });
  });

  // 4. Slowing Heartbeat Pulses: Two low sub-thumps as life fades away
  const heartBeats = [0.65, 1.35];
  heartBeats.forEach((time, beatIdx) => {
    if (time < duration) {
      place(time, 0.3, 0, (t) => {
        const freq = 55 * Math.exp(-t * 12) + 28;
        const env = Math.sin(Math.min(1, t / 0.01) * Math.PI * 0.5) * Math.exp(-t * 9);
        const beatWeight = 1 - beatIdx * 0.45;
        return 0.28 * beatWeight * env * Math.sin(tau * freq * t);
      });
    }
  });

  // 5. Dynamic Low-Pass Filter Sweep: Cutoff drops from 1800 Hz down to 80 Hz
  // Simulates fading vitality & muffles high frequencies
  const startCutoff = 1800 * Math.max(0.3, 1 - darkness * 0.5);
  const endCutoff = 80;

  for (const channel of channelData) {
    let smoothed = 0;
    for (let i = 0; i < frames; i++) {
      const progress = i / frames;
      const currentCutoff = endCutoff + (startCutoff - endCutoff) * Math.exp(-progress * 2.8);
      const alpha = 1 - Math.exp((-tau * currentCutoff) / sampleRate);

      smoothed += alpha * (channel[i] - smoothed);

      // Smooth tail fade-out to prevent clicks
      const tailFade = Math.min(1, (frames - 1 - i) / (sampleRate * 0.18));
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
