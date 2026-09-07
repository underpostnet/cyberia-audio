const frequency = (midi) => 440 * 2 ** ((midi - 69) / 12);

export function render({ sampleRate, volume, bpm, cycles, charge, seed }) {
  const beat = 60 / bpm;
  const frames = Math.round(cycles * 4 * beat * sampleRate);
  const channelData = [new Float32Array(frames), new Float32Array(frames)];
  let state = seed >>> 0;
  const noise = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2147483648 - 1;
  };

  // Voices are written circularly so a decay tail rejoins the head of the phrase: this bed is
  // held in a loop for as long as the portal charge runs, and any seam would be audible.
  function place(atSeconds, length, pan, voice) {
    const offset = Math.round(atSeconds * sampleRate);
    const gains = [Math.sqrt((1 - pan) / 2), Math.sqrt((1 + pan) / 2)];
    for (let i = 0; i < Math.round(length * sampleRate); i++) {
      const t = i / sampleRate;
      const index = (offset + i) % frames;
      const value = voice(t, length);
      channelData[0][index] += value * gains[0];
      channelData[1][index] += value * gains[1];
    }
  }

  // Held root and fifth: the energy the portal is drawing, steady under everything else.
  function drone(midi, gain, pan) {
    const duration = frames / sampleRate;
    // Snapped to a whole number of periods per phrase: the drone runs unbroken across the loop
    // point, and a fraction of a semitone of detune is the price of a seamless wrap.
    const f = Math.round(frequency(midi) * duration) / duration;
    const gains = [Math.sqrt((1 - pan) / 2), Math.sqrt((1 + pan) / 2)];
    for (let i = 0; i < frames; i++) {
      const t = i / sampleRate;
      const phase = 2 * Math.PI * f * t;
      // An integer count of tremolo periods per phrase keeps the wrap continuous.
      const tremolo = 1 - 0.18 * charge * Math.cos((2 * Math.PI * 2 * cycles * t) / duration);
      const tone = Math.sin(phase) + Math.sin(phase * 2) * 0.2 + Math.sin(phase * 3) * 0.07;
      const value = tone * tremolo * gain;
      channelData[0][i] += value * gains[0];
      channelData[1][i] += value * gains[1];
    }
  }

  // Ascending pluck run: the charge filling up, one step per eighth note.
  function pluck(midi, atBeats, gain, pan) {
    const f = frequency(midi);
    place(atBeats * beat, beat * 2.2, pan, (t, length) => {
      const envelope = Math.min(1, t / 0.004) * Math.exp(-t * 7.5) * Math.min(1, (length - t) / 0.12);
      const phase = 2 * Math.PI * f * t;
      const tone = Math.sin(phase) + Math.sin(phase * 2) * 0.3 * Math.exp(-t * 11) + Math.sin(phase * 3) * 0.1;
      return tone * envelope * gain;
    });
  }

  // Beat tick: the audible countdown the player is waiting out.
  function tick(atBeats, gain) {
    place(atBeats * beat, beat * 0.9, 0, (t, length) => {
      const envelope = Math.min(1, t / 0.002) * Math.exp(-t * 24) * Math.min(1, (length - t) / 0.05);
      const sweep = frequency(45) * Math.exp(-t * 9);
      return Math.sin(2 * Math.PI * sweep * t) * envelope * gain;
    });
  }

  // Rising whine: pitch climbs across a bar and its envelope closes before the reset, so the
  // sweep restarts each cycle without a step in either pitch or level.
  function riser(fromMidi, toMidi, atBeats, beats, gain, pan) {
    const offset = Math.round(atBeats * beat * sampleRate);
    const length = Math.round(beats * beat * sampleRate);
    const gains = [Math.sqrt((1 - pan) / 2), Math.sqrt((1 + pan) / 2)];
    let phase = 0;
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const progress = t / (length / sampleRate);
      const f = frequency(fromMidi + (toMidi - fromMidi) * progress ** 1.7);
      phase += (2 * Math.PI * f) / sampleRate;
      const envelope = Math.sin(Math.PI * progress) ** 1.4;
      const value = (Math.sin(phase) + Math.sin(phase * 2) * 0.12) * envelope * gain;
      const index = (offset + i) % frames;
      channelData[0][index] += value * gains[0];
      channelData[1][index] += value * gains[1];
    }
  }

  const run = [57, 60, 64, 67, 69, 72, 76, 79];

  for (let cycle = 0; cycle < cycles; cycle++) {
    const at = cycle * 4;
    run.forEach((midi, step) => {
      const gain = (0.11 + 0.06 * charge) * (0.72 + (step / (run.length - 1)) * 0.5);
      pluck(midi, at + step * 0.5, gain, ((step % 2) - 0.5) * 0.5);
    });
    for (let b = 0; b < 4; b++) tick(at + b, b === 0 ? 0.3 : 0.19);
    riser(64, 76 + 5 * charge, at, 4, 0.05 + 0.05 * charge, 0.25);
    riser(52, 59, at, 4, 0.04, -0.3);
  }

  drone(33, 0.13, -0.05);
  drone(40, 0.06, 0.15);

  // Filtered-air bed. Its swell reaches zero at the phrase boundary, so the noise never steps.
  {
    const duration = frames / sampleRate;
    const cutoff = 1 - Math.exp((-2 * Math.PI * 900) / sampleRate);
    let low = 0;
    for (let i = 0; i < frames; i++) {
      const t = i / sampleRate;
      low += cutoff * (noise() - low);
      const swell = 0.5 - 0.5 * Math.cos((2 * Math.PI * cycles * t) / duration);
      const air = low * (0.05 + 0.07 * charge) * swell;
      channelData[0][i] += air;
      channelData[1][i] += air;
    }
  }

  let peak = 0;
  for (const channel of channelData) for (const value of channel) peak = Math.max(peak, Math.abs(value));
  // volume is the fraction of full scale the peak reaches, so volume 1 is as loud as this gets.
  const master = peak > 0 ? (volume * 0.98) / peak : 0;
  for (const channel of channelData) for (let i = 0; i < frames; i++) channel[i] *= master;
  return { sampleRate, channelData, loop: true };
}
