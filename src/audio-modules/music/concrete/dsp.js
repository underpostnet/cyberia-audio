// Utility: Convert MIDI note to frequency in Hz
function midiToFreq(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

// 2-Pole State Variable Filter implementation
class SVFilter {
  constructor(sampleRate) {
    this.sr = sampleRate;
    this.low = 0;
    this.band = 0;
    this.high = 0;
    this.notch = 0;
  }

  process(input, cutoff, resonance) {
    // Clamp cutoff
    const f = Math.min(0.45, 2 * Math.sin((Math.PI * Math.min(cutoff, this.sr * 0.45)) / this.sr));
    const q = 1.0 - Math.min(0.95, resonance);

    this.low += f * this.band;
    this.high = input - this.low - q * this.band;
    this.band += f * this.high;
    this.notch = this.high + this.low;

    return { low: this.low, band: this.band, high: this.high, notch: this.notch };
  }
}

export function synthesize({ sampleRate, volume, grit, gateSync, metallicResonance, mechanicalTension, seed }) {
  const duration = 12.0; // 12 seconds at 120 BPM = 6 bars of 4/4
  const totalFrames = Math.floor(duration * sampleRate);
  const l = new Float32Array(totalFrames);
  const r = new Float32Array(totalFrames);

  // Deterministic Seeded Pseudo-Random Generator
  let state = seed;
  const noise = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return (state / 4294967296) * 2 - 1;
  };

  // Musical Constants (120 BPM)
  const bpm = 120;
  const stepDuration = 60 / bpm / 4; // 16th note step duration = 0.125s
  const totalSteps = 96; // 6 bars * 16 steps

  // Post-Punk Octave Bassline Note Map (MIDI Notes)
  // 6 Bars in A Minor (A1, F1, G1, E1 darkwave drive)
  const bassPattern = [
    // Bar 1: A1 - A2 Drive
    33, 45, 33, 45, 33, 45, 36, 45, 33, 45, 33, 45, 33, 45, 35, 45,
    // Bar 2: A1 - A2 Drive with G drop
    33, 45, 33, 45, 31, 43, 33, 45, 33, 45, 33, 45, 36, 45, 35, 43,
    // Bar 3: F1 - F2 Dark shift
    29, 41, 29, 41, 29, 41, 33, 41, 29, 41, 29, 41, 29, 41, 31, 41,
    // Bar 4: F1 - F2 to G1
    29, 41, 29, 41, 31, 43, 31, 43, 31, 43, 31, 43, 29, 41, 31, 43,
    // Bar 5: G1 - G2 to E1
    31, 43, 31, 43, 31, 43, 28, 40, 28, 40, 28, 40, 31, 43, 28, 40,
    // Bar 6: E1 turn-around fill
    28, 40, 29, 41, 31, 43, 32, 44, 28, 40, 35, 47, 28, 40, 31, 43,
  ];

  // Melodic Guitar/Synth Lead Pattern (Gothic Minor Melody)
  // Step index -> MIDI Note (0 means rest)
  const leadPattern = new Array(totalSteps).fill(0);
  leadPattern[0] = 64; // E4
  leadPattern[8] = 64; // E4
  leadPattern[12] = 65; // F4
  leadPattern[14] = 64; // E4
  leadPattern[16] = 60; // C4
  leadPattern[20] = 59; // B3
  leadPattern[24] = 60; // C4
  leadPattern[28] = 57; // A3

  leadPattern[32] = 64; // E4
  leadPattern[36] = 67; // G4
  leadPattern[40] = 65; // F4
  leadPattern[44] = 64; // E4
  leadPattern[48] = 62; // D4
  leadPattern[52] = 60; // C4
  leadPattern[56] = 59; // B3
  leadPattern[60] = 60; // C4

  leadPattern[64] = 64; // E4
  leadPattern[68] = 65; // F4
  leadPattern[72] = 64; // E4
  leadPattern[76] = 60; // C4
  leadPattern[80] = 59; // B3
  leadPattern[84] = 60; // C4
  leadPattern[88] = 59; // B3
  leadPattern[92] = 56; // G#3

  // 1. Post-Punk Bassline Engine (Dual Saw + Sub-pulse + SVF Filter + Distortion)
  const bassFilter = new SVFilter(sampleRate);
  for (let s = 0; s < totalSteps; s++) {
    const note = bassPattern[s];
    const startTime = s * stepDuration;
    const noteFreq = midiToFreq(note);
    const stepFrames = Math.floor(stepDuration * sampleRate);
    const startFrame = Math.floor(startTime * sampleRate);

    let phase1 = 0;
    let phase2 = 0;

    for (let j = 0; j < stepFrames; j++) {
      const idx = (startFrame + j) % totalFrames;
      const tRel = j / sampleRate;

      // Amplitude envelope (tight punch with sustain)
      const ampEnv = Math.exp(-tRel * 12);

      // Filter envelope
      const filterEnv = Math.exp(-tRel * 18);
      const cutoff = 250 + filterEnv * (1500 + mechanicalTension * 1000);

      // Dual detuned Sawtooth + Pulse
      phase1 += noteFreq / sampleRate;
      phase2 += (noteFreq * 1.005) / sampleRate;
      if (phase1 >= 1) phase1 -= 1;
      if (phase2 >= 1) phase2 -= 1;

      const saw1 = 2 * phase1 - 1;
      const saw2 = 2 * phase2 - 1;
      const subPulse = (phase1 < 0.5 ? 1 : -1) * 0.4;

      const rawBass = saw1 * 0.4 + saw2 * 0.3 + subPulse;

      // Filter sweep
      const filtered = bassFilter.process(rawBass, cutoff, 0.45).low;

      // Tube Saturator / Overdrive driven by 'grit'
      const drive = 1 + grit * 6.0;
      const distorted = Math.tanh(filtered * drive * ampEnv) * 0.55;

      l[idx] += distorted * 0.45;
      r[idx] += distorted * 0.45;
    }
  }

  // 2. Gothic Lead Synth / Guitar Pluck Engine
  const leadFilter = new SVFilter(sampleRate);
  for (let s = 0; s < totalSteps; s++) {
    const note = leadPattern[s];
    if (note === 0) continue;

    const startTime = s * stepDuration;
    const noteFreq = midiToFreq(note);
    const duration = stepDuration * 3.5; // Legato ring-out
    const leadFrames = Math.floor(duration * sampleRate);
    const startFrame = Math.floor(startTime * sampleRate);

    let phase = 0;
    for (let j = 0; j < leadFrames; j++) {
      const idx = (startFrame + j) % totalFrames;
      const tRel = j / sampleRate;

      // Pluck decay envelope
      const env = Math.exp(-tRel * 3.2);

      phase += noteFreq / sampleRate;
      if (phase >= 1) phase -= 1;

      // Bright narrow pulse + noise transient (guitar pick attack)
      const pulse = phase < 0.25 ? 1 : -1;
      const pickNoise = j < 150 ? noise() * 0.5 : 0;

      const rawPluck = (pulse * 0.6 + pickNoise) * env;

      // Filter cutoff modulation
      const cutoff = 800 + env * 2200;
      const leadSig = leadFilter.process(rawPluck, cutoff, 0.3).low;

      // Stereo chorus detune effect
      const stereoOffset = Math.sin((2 * Math.PI * 0.5 * (startFrame + j)) / sampleRate);
      l[idx] += leadSig * (0.28 + stereoOffset * 0.05);
      r[idx] += leadSig * (0.28 - stereoOffset * 0.05);
    }
  }

  // 3. Drum Machine Engine (Kick, Snare, Hi-Hat, FM Metallic Clang)
  for (let s = 0; s < totalSteps; s++) {
    const startTime = s * stepDuration;
    const startFrame = Math.floor(startTime * sampleRate);

    // --- KICK DRUM (Steps 0, 4, 8, 10, 12, 16...) ---
    const isKick = s % 4 === 0 || s % 16 === 10 || s % 16 === 14;
    if (isKick) {
      const kDuration = 0.25;
      const kFrames = Math.floor(kDuration * sampleRate);
      for (let j = 0; j < kFrames; j++) {
        const idx = (startFrame + j) % totalFrames;
        const tRel = j / sampleRate;
        const env = Math.exp(-tRel * 16);

        // Pitch sweep from 130Hz down to 42Hz
        const pFreq = 42 + 90 * Math.exp(-tRel * 40);
        const pPhase = 2 * Math.PI * pFreq * tRel;

        // Transient click + body
        const click = j < 80 ? noise() * 0.4 : 0;
        const kVal = (Math.sin(pPhase) * 0.8 + click) * env;

        l[idx] += kVal * 0.5 * (0.9 + mechanicalTension * 0.2);
        r[idx] += kVal * 0.5 * (0.9 + mechanicalTension * 0.2);
      }
    }

    // --- GATED SNARE DRUM (Beats 2 and 4 -> steps 4, 12, 20, 28...) ---
    const isSnare = s % 8 === 4;
    if (isSnare) {
      const snDuration = 0.22;
      const snFrames = Math.floor(snDuration * sampleRate);
      const snFilter = new SVFilter(sampleRate);

      for (let j = 0; j < snFrames; j++) {
        const idx = (startFrame + j) % totalFrames;
        const tRel = j / sampleRate;

        // Snare tonal body + Gated white noise tail
        const toneEnv = Math.exp(-tRel * 30);
        const noiseEnv = tRel < 0.18 ? Math.exp(-tRel * 5) : 0; // Hard gated tail

        const tone = Math.sin(2 * Math.PI * 175 * tRel) * toneEnv;
        const nSig = snFilter.process(noise(), 2200, 0.2).band * noiseEnv;

        const snareSig = tone * 0.4 + nSig * 0.7;

        l[idx] += snareSig * 0.42;
        r[idx] += snareSig * 0.42;
      }
    }

    // --- HI-HAT (16th notes with accent pattern) ---
    const isHat = true;
    if (isHat) {
      const hatDuration = s % 4 === 2 ? 0.09 : 0.04; // Open hat accent
      const hatFrames = Math.floor(hatDuration * sampleRate);
      const hatFilter = new SVFilter(sampleRate);
      const accent = s % 2 === 0 ? 0.25 : 0.12;

      for (let j = 0; j < hatFrames; j++) {
        const idx = (startFrame + j) % totalFrames;
        const tRel = j / sampleRate;
        const env = Math.exp(-tRel * (s % 4 === 2 ? 25 : 55));

        // Highpass filtered metallic noise
        const hatSig = hatFilter.process(noise(), 7500, 0.6).high * env * accent;

        l[idx] += hatSig * 0.3;
        r[idx] += hatSig * 0.3;
      }
    }

    // --- FM METALLIC CLANG / ANVIL (Downbeats 0, 32, 64, 80) ---
    const isClang = s === 0 || s === 32 || s === 64 || s === 80;
    if (isClang) {
      const cDuration = 0.8;
      const cFrames = Math.floor(cDuration * sampleRate);
      const clangFilter = new SVFilter(sampleRate);
      const carrierFreq = 380 + metallicResonance * 800;
      const modFreq = carrierFreq * 2.76;
      const modIndex = 12 + metallicResonance * 25;

      for (let j = 0; j < cFrames; j++) {
        const idx = (startFrame + j) % totalFrames;
        const tRel = j / sampleRate;
        const env = Math.exp(-tRel * (6 + (1 - metallicResonance) * 8));

        const fmMod = Math.sin(2 * Math.PI * modFreq * tRel) * modIndex;
        const clang = Math.sin(2 * Math.PI * carrierFreq * tRel + fmMod) * env;
        const metallicNoise = clangFilter.process(noise(), 3500, 0.8).band * env * 0.3;

        const val = (clang * 0.7 + metallicNoise) * 0.35;

        // Stereo spreading for metallic impact
        l[idx] += val * 0.8;
        r[idx] += val * 0.5;
      }
    }
  }

  // 4. Cold Atmospheric Background Synth Pad with Gate Tremolo
  const padFilter = new SVFilter(sampleRate);
  for (let i = 0; i < totalFrames; i++) {
    const t = i / sampleRate;

    // Atmospheric low drone notes (A2 and E2)
    const f1 = 110.0;
    const f2 = 164.81;

    const osc1 = Math.sin(2 * Math.PI * f1 * t);
    const osc2 = Math.sin(2 * Math.PI * f2 * t + 0.5);

    // Lowpass filter sweep
    const cutoff = 400 + Math.sin(2 * Math.PI * 0.08 * t) * 150;
    const padRaw = padFilter.process((osc1 + osc2) * 0.5, cutoff, 0.2).low;

    // Gate Tremolo Effect using gateSync
    const gateLfo = Math.sin(2 * Math.PI * gateSync * t);
    const gateVal = gateLfo > 0 ? 0.8 : 0.15;

    const padFinal = padRaw * gateVal * 0.12;

    l[i] += padFinal;
    r[i] += padFinal;
  }

  // 5. Master Stereo Ping-Pong Delay Effect (1/8d note = 0.375s)
  const delayTimeSec = 0.375;
  const delaySamples = Math.floor(delayTimeSec * sampleRate);
  const feedback = 0.32;
  const delayBufL = new Float32Array(totalFrames);
  const delayBufR = new Float32Array(totalFrames);

  for (let i = 0; i < totalFrames; i++) {
    const prevIdx = (i - delaySamples + totalFrames) % totalFrames;
    delayBufL[i] = l[i] + delayBufR[prevIdx] * feedback;
    delayBufR[i] = r[i] + delayBufL[prevIdx] * feedback;

    l[i] = l[i] * 0.75 + delayBufL[i] * 0.25;
    r[i] = r[i] * 0.75 + delayBufR[i] * 0.25;
  }

  return [l, r];
}

const LOOP = true;
const HEADROOM = 0.98;
const EDGE_SECONDS = 0.005;

export function render(params) {
  const { sampleRate, volume } = params;
  const channelData = synthesize(params);
  if (!Array.isArray(channelData) || channelData.length < 1 || channelData.length > 2) {
    throw new TypeError('synthesize() must return one or two channels.');
  }
  const frames = channelData[0]?.length ?? 0;
  const edge = Math.min(Math.round(sampleRate * EDGE_SECONDS), Math.floor(frames / 2));
  let peak = 0;
  for (const channel of channelData) {
    if (!(channel instanceof Float32Array) || channel.length !== frames || frames === 0) {
      throw new TypeError('synthesize() must return equally sized, non-empty Float32Array channels.');
    }

    // DC offset removal
    let sum = 0;
    for (const value of channel) {
      if (!Number.isFinite(value)) throw new TypeError('synthesize() produced a non-finite sample.');
      sum += value;
    }
    const offset = sum / frames;
    for (let i = 0; i < frames; i++) channel[i] -= offset;

    // Seamless Loop Crossfade
    if (edge > 0 && LOOP) {
      for (let i = frames - edge; i < frames; i++) {
        const t = (i - (frames - edge) + 1) / edge;
        channel[i] = channel[i] * (1 - t) + channel[0] * t;
      }
    } else if (edge > 0) {
      for (let i = 0; i < edge; i++) {
        channel[i] *= i / edge;
        channel[frames - 1 - i] *= i / edge;
      }
    }

    // Soft Clipper / Limiter
    for (let i = 0; i < frames; i++) {
      channel[i] = Math.tanh(channel[i]);
      peak = Math.max(peak, Math.abs(channel[i]));
    }
  }

  // Master Normalization with headroom
  const gain = peak > 0 ? (volume * HEADROOM) / peak : 0;
  for (const channel of channelData) for (let i = 0; i < frames; i++) channel[i] *= gain;
  return { sampleRate, channelData, loop: LOOP };
}
