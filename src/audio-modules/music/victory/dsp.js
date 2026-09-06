const frequency = (midi) => 440 * 2 ** ((midi - 69) / 12);

export function render({ sampleRate, volume, bpm, brilliance }) {
  const beat = 60 / bpm;
  const frames = Math.round((16 * beat + 1.2) * sampleRate);
  const channelData = [new Float32Array(frames), new Float32Array(frames)];

  function place(atBeat, length, pan, voice) {
    const start = Math.round(atBeat * beat * sampleRate);
    const gains = [Math.sqrt((1 - pan) / 2), Math.sqrt((1 + pan) / 2)];
    const count = Math.min(frames - start, Math.round(length * sampleRate));
    for (let i = 0; i < count; i++) {
      const value = voice(i / sampleRate, length);
      channelData[0][start + i] += value * gains[0];
      channelData[1][start + i] += value * gains[1];
    }
  }

  function brass(midi, atBeat, beats, gain, pan) {
    const f = frequency(midi);
    place(atBeat, beats * beat + 0.18, pan, (t, length) => {
      const envelope = Math.min(1, t / 0.025) * Math.min(1, (length - t) / 0.22);
      const phase = 2 * Math.PI * f * t + Math.sin(2 * Math.PI * 5.2 * t) * Math.min(0.025, t * 0.025);
      let tone = Math.sin(phase);
      for (let harmonic = 2; harmonic <= 8; harmonic++) {
        if (f * harmonic < sampleRate * 0.45) {
          tone += Math.sin(phase * harmonic) * (0.15 + brilliance * 0.65) / harmonic ** 1.25;
        }
      }
      return tone * envelope * gain * (0.85 + 0.15 * Math.exp(-t * 9));
    });
  }

  function timpani(atBeat, f, gain) {
    place(atBeat, 0.75, 0, (t, length) => {
      const phase = 2 * Math.PI * f * (t + 0.009 * (1 - Math.exp(-t * 35)));
      const envelope = Math.min(1, t / 0.002) * Math.exp(-t * 7) * Math.min(1, (length - t) / 0.1);
      return (Math.sin(phase) + Math.sin(phase * 1.5) * 0.25) * envelope * gain;
    });
  }

  function bell(midi, atBeat) {
    const f = frequency(midi);
    place(atBeat, 2.4, 0.25, (t, length) => {
      const phase = 2 * Math.PI * f * t;
      const envelope = Math.min(1, t / 0.002) * Math.exp(-t * 2.8) * Math.min(1, (length - t) / 0.2);
      return (Math.sin(phase) + Math.sin(phase * 2) * 0.3 * Math.exp(-t * 5)) * envelope * 0.16;
    });
  }

  // Opening call, ascending answer, dominant preparation, and a sustained tonic.
  const melody = [
    [0, 67, 0.6], [0.75, 67, 0.2], [1, 72, 0.85], [2, 76, 1.5],
    [4, 72, 0.6], [4.75, 74, 0.2], [5, 76, 0.65], [6, 81, 1.4],
    [8, 79, 0.65], [9, 77, 0.65], [10, 74, 0.6], [11, 71, 0.7],
    [12, 84, 4.8],
  ];
  melody.forEach(([at, note, length]) => brass(note, at, length, 0.22, -0.15));
  const chords = [[48, 55, 60, 64], [41, 53, 57, 60], [43, 55, 59, 62], [36, 55, 60, 64]];
  for (let bar = 0; bar < 4; bar++) {
    const start = bar * 4;
    const final = bar === 3;
    chords[bar].forEach((note, i) => {
      brass(note, start, final ? 5 : 1.65, i === 0 ? 0.13 : 0.075, (i - 1.5) * 0.35);
      if (!final) brass(note, start + 2, 1.5, i === 0 ? 0.11 : 0.06, (i - 1.5) * 0.35);
    });
    timpani(start, bar === 2 ? 73.416 : 65.406, 0.28);
    if (!final) timpani(start + 2.5, 98, 0.18);
  }
  timpani(11, 98, 0.16);
  timpani(11.5, 98, 0.2);
  bell(84, 12);
  bell(88, 12.5);
  bell(91, 13);

  // The closing release belongs to the phrase, so it is applied before the master stage measures
  // the peak; otherwise the fade could pull the loudest sample away from the headroom target.
  for (const channel of channelData) {
    for (let i = 0; i < frames; i++) channel[i] *= Math.min(1, (frames - 1 - i) / (sampleRate * 0.4));
  }
  let peak = 0;
  for (const channel of channelData) for (const value of channel) peak = Math.max(peak, Math.abs(value));
  // volume is the fraction of full scale the peak reaches, so volume 1 is as loud as this gets.
  const master = peak > 0 ? (volume * 0.98) / peak : 0;
  for (const channel of channelData) for (let i = 0; i < frames; i++) channel[i] *= master;
  return { sampleRate, channelData, loop: false };
}
