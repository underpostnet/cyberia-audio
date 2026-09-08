// An item landing in the inventory bar: a short upward blip that seats on a soft body.
//
// Deliberately quieter and plainer than `coin`. This fires on every arrival — loot flying in from
// the grid, a quest reward, a purchase — so it has to survive repetition. `coin` stays the
// two-note reward gesture reserved for currency.
export function render({ sampleRate, duration, volume, pitch }) {
  const samples = new Float32Array(Math.round(sampleRate * duration));
  const tau = Math.PI * 2;

  // The blip: one voice sweeping up a fifth over the first third, so the gesture reads as
  // "gained" rather than "spent".
  {
    const sweep = duration * 0.34;
    for (let i = 0; i < samples.length; i++) {
      const t = i / sampleRate;
      const rise = Math.min(1, t / sweep);
      const f = 660 * pitch * (1 + 0.5 * rise * rise);
      const phase = tau * f * t;
      const attack = Math.min(1, t / 0.0015);
      const envelope = attack * Math.exp(-t * 11 / duration);
      let voice = Math.sin(phase) + 0.2 * Math.sin(phase * 2) * Math.exp(-t * 40);
      samples[i] += 0.62 * envelope * voice;
    }
  }

  // Body: a low seat under the blip, the weight of the thing landing in the slot.
  {
    for (let i = 0; i < samples.length; i++) {
      const t = i / sampleRate;
      const phase = tau * 196 * pitch * t;
      samples[i] += 0.26 * Math.exp(-t * 34) * Math.sin(phase);
    }
  }

  const edge = Math.max(1, Math.round(sampleRate * 0.004));
  for (let i = 0; i < samples.length; i++) {
    samples[i] *= Math.min(1, i / edge, (samples.length - 1 - i) / (sampleRate * 0.02));
  }

  // volume is the fraction of full scale the peak reaches, so volume 1 is as loud as this gets.
  let peak = 0;
  for (const value of samples) peak = Math.max(peak, Math.abs(value));
  const master = peak > 0 ? (volume * 0.98) / peak : 0;
  for (let i = 0; i < samples.length; i++) samples[i] *= master;
  return { sampleRate, channelData: [samples], loop: false };
}
