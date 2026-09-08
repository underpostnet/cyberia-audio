const frequency = (midi) => 440 * 2 ** ((midi - 69) / 12);

// Matter being synthesised: motes of energy drawn in from the edges of the field, falling toward a
// centre where they coalesce into the object the recipe is assembling.
//
// Held like `portal-cooldown` while the assembly bar charges, so it loops without a seam. Each
// cycle is one intake — motes sweep down from the top of the spectrum and in from the sides, and
// arrive together on a soft bloom at the middle of the cycle, away from the loop point where a
// transient would click.
export function render({ sampleRate, volume, bpm, cycles, particles, seed }) {
  const beat = 60 / bpm;
  const frames = Math.round(cycles * 4 * beat * sampleRate);
  const channelData = [new Float32Array(frames), new Float32Array(frames)];
  const duration = frames / sampleRate;
  const tau = Math.PI * 2;
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };

  // Written circularly, so a tail that runs past the phrase rejoins its head.
  function place(atSeconds, length, voice) {
    const offset = Math.round(atSeconds * sampleRate);
    for (let i = 0; i < Math.round(length * sampleRate); i++) {
      const t = i / sampleRate;
      const index = ((offset + i) % frames + frames) % frames;
      const [left, right] = voice(t);
      channelData[0][index] += left;
      channelData[1][index] += right;
    }
  }

  // The containment field the synthesis happens inside: sustained, centred, and snapped to a whole
  // number of periods per phrase so the wrap is continuous.
  function field(midi, gain, pan, partials) {
    const f = Math.round(frequency(midi) * duration) / duration;
    const gains = [Math.sqrt((1 - pan) / 2), Math.sqrt((1 + pan) / 2)];
    for (let i = 0; i < frames; i++) {
      const t = i / sampleRate;
      const phase = tau * f * t;
      let tone = 0;
      for (const [harmonic, level] of partials) tone += level * Math.sin(phase * harmonic);
      // An integer count of breaths per phrase keeps the wrap continuous.
      const breath = 1 - 0.16 * Math.cos((tau * cycles * t) / duration);
      channelData[0][i] += tone * breath * gain * gains[0];
      channelData[1][i] += tone * breath * gain * gains[1];
    }
  }

  field(33, 0.14, 0, [[1, 1], [2, 0.26], [3, 0.08]]);
  field(45, 0.06, -0.25, [[1, 1], [2, 0.18]]);
  field(64, 0.028, 0.3, [[1, 1], [3, 0.12], [5, 0.05]]);

  const core = frequency(45);
  for (let c = 0; c < cycles; c++) {
    const arrival = (c + 0.5) * (duration / cycles);

    // The intake. A mote starts wide and high, and its pitch, pan and level all converge on the
    // centre together — the sound of being pulled in rather than of falling.
    for (let n = 0; n < particles; n++) {
      const flight = 0.55 + random() * 0.5;
      const side = n % 2 ? 1 : -1;
      const start = frequency(76 + Math.floor(random() * 14));
      place(arrival - flight, flight, (t) => {
        const approach = t / flight;
        const pull = approach ** 1.5;
        const f = start + (core * 2 - start) * pull;
        const pan = side * (0.9 * (1 - pull));
        // Audible from the edge of the field, gaining as it is drawn in, and gone by the moment
        // the bloom takes over. Present while wide is what makes the sweep inward legible.
        const envelope = Math.min(1, t / 0.03) * (0.45 + 0.55 * pull) * (1 - approach ** 6);
        const value = 0.16 * envelope * (Math.sin(tau * f * t) + 0.2 * Math.sin(tau * f * 2 * t));
        return [value * Math.sqrt((1 - pan) / 2), value * Math.sqrt((1 + pan) / 2)];
      });
    }

    // Coalescence: the motes become mass. A low bloom that swells and settles, no transient.
    const bloom = 0.9;
    place(arrival - 0.12, bloom, (t) => {
      const shape = Math.sin(Math.PI * Math.min(1, t / bloom)) ** 1.3;
      const tone = Math.sin(tau * core * t) + 0.3 * Math.sin(tau * core * 1.5 * t) +
                   0.12 * Math.sin(tau * core * 2 * t);
      const value = 0.16 * shape * tone;
      return [value, value];
    });
  }

  // volume is the fraction of full scale the peak reaches, so volume 1 is as loud as this gets.
  let peak = 0;
  for (const channel of channelData) for (const value of channel) peak = Math.max(peak, Math.abs(value));
  const master = peak > 0 ? (volume * 0.98) / peak : 0;
  for (const channel of channelData) for (let i = 0; i < channel.length; i++) channel[i] *= master;
  return { sampleRate, channelData, loop: true };
}
