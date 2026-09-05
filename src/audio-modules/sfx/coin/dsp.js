export function render({ sampleRate, duration, volume, pitch }) {
  const samples = new Float32Array(Math.round(sampleRate * duration));
  const tau = Math.PI * 2;
  // The second strike is higher and stronger: an audible reward gesture.
  for (const [onset, frequency, gain] of [[0, 880, 0.55], [duration * 0.22, 1320, 0.75]]) {
    const start = Math.round(onset * sampleRate);
    for (let i = start; i < samples.length; i++) {
      const t = (i - start) / sampleRate;
      const f = frequency * pitch;
      // Integrating the exponential sweep keeps oscillator phase continuous.
      const phase = tau * f * (t - 0.0018 * (1 - Math.exp(-t / 0.012)));
      const attack = Math.min(1, t / 0.002);
      const envelope = attack * Math.exp(-t * 7 / duration);
      let bell = Math.sin(phase);
      for (const [harmonic, level] of [[2, 0.24], [3, 0.1], [4, 0.06]]) {
        if (f * harmonic < sampleRate * 0.45) bell += level * Math.sin(phase * harmonic) * Math.exp(-t * 25);
      }
      samples[i] += gain * envelope * bell * 0.65;
    }
  }
  for (let i = 0; i < samples.length; i++) {
    samples[i] *= volume * Math.min(1, (samples.length - 1 - i) / (sampleRate * 0.025));
  }
  return { sampleRate, channelData: [samples], loop: false };
}
