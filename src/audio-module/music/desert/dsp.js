import { Chord, Note, Scale } from "tonal";

export function synthesize({ sampleRate, volume, intensity, grittiness, desolation, pulseSpeed, seed }) {
    const duration = 20; // seconds
    const frames = Math.floor(duration * sampleRate);
    const leftChannel = new Float32Array(frames);
    const rightChannel = new Float32Array(frames);

    let state = seed;
    const rand = () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296; // 0 to 1
    };
    const randPM1 = () => rand() * 2 - 1; // -1 to 1

    // Oscillator helpers using accumulated phase
    const sinOsc = (phase) => Math.sin(phase);
    const sawOsc = (phase) => (((phase / (2 * Math.PI)) % 1) * 2 - 1);
    const squareOsc = (phase) => (((phase / (2 * Math.PI)) % 1) < 0.5 ? 1 : -1);

    // Helper for linear interpolation
    const lerp = (a, b, t) => a * (1 - t) + b * t;

    // ADSR envelope
    const adsr = (t, attack, decay, sustain, release, envDuration) => {
        if (attack === 0 && decay === 0 && release === 0) return sustain; // Handle instant envelopes
        if (t < attack) {
            return t / attack;
        } else if (t < attack + decay) {
            return 1 - ((t - attack) / decay) * (1 - sustain);
        } else if (t < envDuration - release) {
            return sustain;
        } else if (t < envDuration) {
            return sustain * (1 - (t - (envDuration - release)) / release);
        } else {
            return 0;
        }
    };
    
    // Simple 1-pole Low-Pass Filter with dynamic cutoff
    const makeLPF = (initialCutoff, sr) => {
        let y = 0; // Filter state
        let alpha;
        const updateAlpha = (newCutoff) => {
            // Clamp cutoff frequency within reasonable limits (e.g., 1Hz to Nyquist-1Hz)
            newCutoff = Math.max(1, Math.min(sr / 2 - 1, newCutoff));
            alpha = Math.min(1, 2 * Math.PI * newCutoff / sr); // Calculate alpha for current cutoff
        };
        updateAlpha(initialCutoff); // Initialize alpha

        const filter = (input) => {
            y = alpha * input + (1 - alpha) * y;
            return y;
        };
        filter.setCutoff = updateAlpha; // Add a method to change cutoff
        return filter;
    };

    // Global timing
    const baseBpm = 120; // Base tempo
    const bpm = baseBpm * pulseSpeed;
    const beatDuration = 60 / bpm; // seconds per beat
    const framesPerBeat = Math.floor(beatDuration * sampleRate);

    // --- MIDI to Frequency conversion ---
    const getFreq = (midi) => 440 * 2 ** ((midi - 69) / 12);

    // Helper to adjust frequency for perfect looping over the entire duration
    const adjustFreqForLoop = (initialFreq, totalDuration) => {
        const N = Math.round(initialFreq * totalDuration);
        return N / totalDuration;
    };

    // --- Kick Drum Parameters ---
    const kickGain = 0.8 * intensity;
    const kickAttackTime = 0.005; // s
    const kickDecayTime = 0.2; // s
    const kickFreqStart = 80 + grittiness * 70; // 80-150Hz
    const kickFreqEnd = 40; // 40Hz
    // FIX: Extended decay time for kicks to ensure envelope fully decays to near zero
    // This prevents clicks when the sound wraps around in the loop.
    const kickLengthFrames = Math.floor((kickAttackTime + 5 * kickDecayTime) * sampleRate);

    // --- Snare Drum Parameters ---
    const snareGain = 0.6 * intensity;
    const snareAttackTime = 0.005; // s
    const snareDecayTime = 0.15; // s
    // FIX: Extended decay time for snares to ensure envelope fully decays to near zero
    // This prevents clicks when the sound wraps around in the loop.
    const snareLengthFrames = Math.floor((snareAttackTime + 5 * snareDecayTime) * sampleRate);
    const snareNoiseHPFCutoff = 500 + grittiness * 1000;
    const snareNoiseLPFCutoff = 6000 + grittiness * 2000;
    const snareBodyFreq = 200; // Base freq for body component

    // --- Sub-Bass Parameters ---
    const subBassGain = 0.7 * intensity;
    const subBassBaseMidi = 36; // C2
    const rawSubBassFreq = getFreq(subBassBaseMidi);
    // FIX: Adjusted sub-bass frequency to loop perfectly over the total duration
    const subBassFreq = adjustFreqForLoop(rawSubBassFreq, duration);
    const subBassLFOFreq = 2 * pulseSpeed; // LFO for pulsation
    const subBassLFODepth = 0.3 + desolation * 0.2; // How much it pulses
    let subBassPhase = 0; // Continuous phase

    // --- Pad Chord Parameters ---
    const padGain = 0.4 * intensity;
    const padAttackTime = 2; // s
    const padDecayTime = 1; // s
    const padSustain = 0.7;
    const padReleaseTime = 3; // s
    const padBaseMidi = 48; // C3
    const padDetuneAmount = 0.005 + intensity * 0.005; // 0.5% to 1% detune
    const rawPadVibratoFreq = 3 + intensity * 2;
    // FIX: Adjusted pad vibrato LFO frequency to loop perfectly over the total duration
    const padVibratoFreq = adjustFreqForLoop(rawPadVibratoFreq, duration);
    const padVibratoDepth = 0.002 + desolation * 0.003;
    const padFilterCutoffStart = 300 + desolation * 200;
    const padFilterCutoffEnd = 800 + intensity * 500;

    // Chord progression (Cm, G/Bb, Abmaj, Ebmaj)
    const padChords = [
        [padBaseMidi, padBaseMidi + 3, padBaseMidi + 7], // Cm (C3, Eb3, G3)
        [padBaseMidi + 7, padBaseMidi + 10, padBaseMidi + 14], // Gm (G3, Bb3, D4)
        [padBaseMidi + 8, padBaseMidi + 12, padBaseMidi + 15], // AbM (Ab3, C4, Eb4)
        [padBaseMidi + 3, padBaseMidi + 7, padBaseMidi + 10], // EbM (Eb3, G3, Bb3)
    ];
    const framesPerChord = framesPerBeat * 4;
    const padPhases = [0, 0, 0]; // Continuous phases for each pad voice
    let padLfo1Phase = rand() * 2 * Math.PI; // For filter sweep. Freq 0.05, already loops (0.05*20=1).
    let padLfo2Phase = rand() * 2 * Math.PI; // For vibrato. Freq adjusted above.
    const padLPFs = [makeLPF(padFilterCutoffEnd, sampleRate), makeLPF(padFilterCutoffEnd, sampleRate), makeLPF(padFilterCutoffEnd, sampleRate)];

    // --- Arpeggio Parameters ---
    const arpeggioGain = 0.5 * intensity;
    const arpeggioAttackTime = 0.001; // s
    const arpeggioDecayTime = 0.1; // s
    const arpeggioSustain = 0.0;
    const arpeggioReleaseTime = 0.05; // s
    const arpeggioLengthFrames = Math.floor((arpeggioAttackTime + arpeggioDecayTime + arpeggioReleaseTime) * sampleRate);
    const arpeggioFilterCutoff = 1000 + grittiness * 2000;
    const arpeggioNotesPerBeat = 4 * pulseSpeed;
    const arpeggioFramesPerNote = arpeggioNotesPerBeat > 0 ? Math.floor(framesPerBeat / arpeggioNotesPerBeat) : 0;

    // --- Lead Synth Parameters ---
    const leadGain = 0.6 * intensity * (1 - desolation * 0.5); // More desolate, less lead
    const leadAttackTime = 0.01; // s
    const leadDecayTime = 0.3; // s
    const leadSustain = 0.5;
    const leadReleaseTime = 0.5; // s
    const leadBaseMidi = 60; // C4
    const leadPitchBendDepth = 0.2 + desolation * 0.3; // Semitones
    const rawLeadVibratoFreq = 6 + grittiness * 4;
    // FIX: Adjusted lead vibrato LFO frequency to loop perfectly over the total duration
    const leadVibratoFreq = adjustFreqForLoop(rawLeadVibratoFreq, duration);
    const leadVibratoDepth = 0.005 + intensity * 0.005;
    const leadModFreq = 100 + grittiness * 200; // For metallic sound (FM or ring mod)
    const leadModDepth = 0.5 + desolation * 0.5; // Amount of metallic grit
    let leadPhase = 0; // Continuous carrier phase
    let modPhase = 0; // Continuous modulator phase
    let leadLfoPhase = rand() * 2 * Math.PI; // For vibrato. Freq adjusted above.
    const leadLPF = makeLPF(8000 + grittiness * 1000, sampleRate); // High cutoff LPF for lead

    // Seeded white noise generator (separate state for consistent noise)
    let noiseState = seed + 123; // Different seed for noise
    const getNoiseSample = () => {
        noiseState = (Math.imul(noiseState, 1664525) + 1013904223) >>> 0;
        return (noiseState / 4294967296) * 2 - 1; // -1 to 1
    };

    // Main loop for generating samples
    for (let i = 0; i < frames; i++) {
        const t = i / sampleRate;
        let sampleL = 0;
        let sampleR = 0;

        // --- Kick Drum (four-on-the-floor) ---
        // Kicks are triggered, their sound is written circularly. The extended kickLengthFrames
        // and explicit clamping ensure the envelope goes to zero within its length.
        if (framesPerBeat > 0 && i % framesPerBeat === 0) {
            // Trigger on every beat
            let currentKickPhase = 0; // Reset phase for each kick hit
            for (let k = 0; k < kickLengthFrames; k++) {
                const currentFrame = (i + k) % frames;
                const t_kick = k / sampleRate;
                
                let env;
                if (t_kick < kickAttackTime) {
                    env = t_kick / kickAttackTime; // Attack phase
                } else {
                    // Exponential decay, clamped to 0 at the effective end of kickLengthFrames
                    const decayTimeElapsed = t_kick - kickAttackTime;
                    const decayProgress = decayTimeElapsed / kickDecayTime;
                    env = Math.exp(-decayProgress);
                    if (t_kick >= (kickLengthFrames / sampleRate)) { // Ensure it is exactly 0 at the end of its intended sound length
                        env = 0;
                    }
                }
                
                const freq = lerp(kickFreqStart, kickFreqEnd, t_kick / (kickLengthFrames / sampleRate)); // Base lerp on actual sound length
                
                currentKickPhase += 2 * Math.PI * freq / sampleRate;
                let kickSample = sinOsc(currentKickPhase) * env * kickGain;
                
                leftChannel[currentFrame] += kickSample;
                rightChannel[currentFrame] += kickSample;
            }
        }

        // --- Snare Drum (on beats 2 and 4) ---
        const beatIndex = Math.floor(t / beatDuration);
        // Snares are triggered, their sound is written circularly. The extended snareLengthFrames
        // and explicit clamping ensure the envelope goes to zero within its length.
        if (framesPerBeat > 0 && beatIndex % 2 === 1 && i % framesPerBeat === 0) {
            // Trigger on beat 2 and 4 (0-indexed, so beat 1 and 3 in `beatIndex`)
            let currentSnareNoiseLPF = makeLPF(snareNoiseLPFCutoff, sampleRate); // New filter instance for each hit
            // FIX: Renamed `currentSnareNoiseHPFLPF` for clarity and correctly apply 1-pole HPF.
            let hpfLowpass = makeLPF(snareNoiseHPFCutoff, sampleRate); // This LPF is used to create the HPF

            let currentSnarePhase = 0; // Reset phase for each snare hit

            for (let k = 0; k < snareLengthFrames; k++) {
                const currentFrame = (i + k) % frames;
                const t_snare = k / sampleRate;
                let env;
                if (t_snare < snareAttackTime) {
                    env = t_snare / snareAttackTime;
                } else {
                    const decayTimeElapsed = t_snare - snareAttackTime;
                    const decayProgress = decayTimeElapsed / snareDecayTime;
                    env = Math.exp(-decayProgress);
                    if (t_snare >= (snareLengthFrames / sampleRate)) { // Ensure it is exactly 0 at the end of its intended sound length
                        env = 0;
                    }
                }

                let noise = getNoiseSample();
                let hpfNoise = noise - hpfLowpass(noise); // Correct 1-pole HPF calculation using the LPF state
                noise = currentSnareNoiseLPF(hpfNoise); // LPF on the HPF'd noise
                
                const bodyFreq = lerp(snareBodyFreq * 1.5, snareBodyFreq, t_snare / (snareLengthFrames / sampleRate)); // Base lerp on actual sound length
                currentSnarePhase += 2 * Math.PI * bodyFreq / sampleRate;
                let body = sinOsc(currentSnarePhase);

                let snareSample = (noise * 0.7 + body * 0.3) * env * snareGain;
                leftChannel[currentFrame] += snareSample;
                rightChannel[currentFrame] += snareSample;
            }
        }

        // --- Sub-Bass (continuous) ---
        // subBassFreq is now adjusted for perfect looping.
        const subBassLFO = (sinOsc(2 * Math.PI * subBassLFOFreq * t) * 0.5 + 0.5) * subBassLFODepth + (1 - subBassLFODepth);
        subBassPhase += 2 * Math.PI * subBassFreq / sampleRate; // Use adjusted subBassFreq
        let subBassSample = sinOsc(subBassPhase) * subBassLFO * subBassGain;
        sampleL += subBassSample;
        sampleR += subBassSample;

        // --- Pad Chord (shimmering, evolving, continuous) ---
        // Pad's overall envelope fades to 0 at loop start/end, so it's not the issue.
        // Pad LFO for vibrato is adjusted for perfect looping.
        const currentChordIndex = Math.floor(t / (framesPerChord / sampleRate)) % padChords.length;
        const currentChordMidi = padChords[currentChordIndex];

        // Overall pad envelope over the loop duration
        const padEnvAmount = adsr(t, padAttackTime, padDecayTime, padSustain, padReleaseTime, duration);

        // Filter sweep LFO
        padLfo1Phase += (2 * Math.PI * 0.05 / sampleRate); // Freq 0.05, loops perfectly over 20s (0.05 * 20 = 1 cycle).
        const filterCutoff = lerp(padFilterCutoffStart, padFilterCutoffEnd, sinOsc(padLfo1Phase) * 0.5 + 0.5);
        
        // Vibrato LFO
        padLfo2Phase += (2 * Math.PI * padVibratoFreq / sampleRate); // Use adjusted padVibratoFreq
        const vibratoAmount = sinOsc(padLfo2Phase) * padVibratoDepth;

        let padMix = 0;
        for (let j = 0; j < currentChordMidi.length; j++) {
            let freq = getFreq(currentChordMidi[j]);
            freq *= (1 + vibratoAmount); // Apply vibrato
            freq *= (1 + (j - 1) * padDetuneAmount); // Detune voices (-1, 0, 1 for middle voice)

            padPhases[j] += 2 * Math.PI * freq / sampleRate;
            let padOsc = sawOsc(padPhases[j]); // Use saw for richer sound
            
            // Apply filter for this voice, updating its state
            padLPFs[j].setCutoff(filterCutoff); // Update cutoff for current frame
            padOsc = padLPFs[j](padOsc);

            padMix += padOsc;
        }
        padMix /= currentChordMidi.length; // Average for gain staging

        // Pan based on slow LFO and desolation
        const pan = sinOsc(padLfo1Phase * 0.5); // Slow pan (LFO frequency 0.025 Hz, so 0.025*20 = 0.5 cycles). This ensures pan starts and ends centered.
        const panAmount = desolation * 0.5; // Desolation increases stereo width
        sampleL += padMix * padEnvAmount * padGain * (1 - pan * panAmount);
        sampleR += padMix * padEnvAmount * padGain * (1 + pan * panAmount);

        // --- Arpeggio (percussive, filtered) ---
        // Arpeggio uses ADSR which correctly returns 0 at envDuration. No fix needed here.
        if (arpeggioFramesPerNote > 0) {
            const arpeggioBeatFrame = i % framesPerBeat;
            // Trigger a new note at the start of each arpeggio step
            if (arpeggioBeatFrame % arpeggioFramesPerNote === 0) {
                const noteIndexInChord = Math.floor(arpeggioBeatFrame / arpeggioFramesPerNote) % currentChordMidi.length;
                const arpeggioChord = currentChordMidi.slice().sort((a,b) => a-b); // Sort for ascending arp
                const noteMidi = arpeggioChord[noteIndexInChord] + 12; // One octave up
                const noteFreq = getFreq(noteMidi);
                
                let currentArpPhase = 0; // Reset phase for each note
                let currentArpLPF = makeLPF(arpeggioFilterCutoff, sampleRate); // New filter instance for each note
                let panPerNote = randPM1() * 0.5; // Random pan per note

                for (let k = 0; k < arpeggioLengthFrames; k++) {
                    const currentFrame = (i + k) % frames;
                    const t_arp = k / sampleRate;
                    const env = adsr(t_arp, arpeggioAttackTime, arpeggioDecayTime, arpeggioSustain, arpeggioReleaseTime, arpeggioLengthFrames / sampleRate);

                    currentArpPhase += 2 * Math.PI * noteFreq / sampleRate;
                    let arpSample = squareOsc(currentArpPhase); // Square wave for percussive
                    
                    arpSample = currentArpLPF(arpSample);
                    
                    arpSample *= env * arpeggioGain;
                    
                    leftChannel[currentFrame] += arpSample * (1 - panPerNote);
                    rightChannel[currentFrame] += arpSample * (1 + panPerNote);
                }
            }
        }

        // --- Lead Synth (metallic, pitch-bent, sparse) ---
        // Lead LFO for vibrato is adjusted for perfect looping.
        // Lead synth only plays in a specific segment, not at t=0 or t=duration, so its phase accumulation
        // across cycles should not cause a direct boundary click, as its output is zero at loop boundaries.
        const leadPhraseDurationFrames = framesPerBeat * 4; // 4 beats long
        const leadStartBeatOffset = 8; // Start on beat 8 (0-indexed beat 8)
        const leadRepeatEveryBeats = 16; // Repeat every 16 beats

        const currentBeatInCycle = beatIndex % leadRepeatEveryBeats;
        const leadShouldPlay = (currentBeatInCycle >= leadStartBeatOffset && currentBeatInCycle < leadStartBeatOffset + 4) && (desolation < 0.8); // Less lead if very desolate

        if (leadShouldPlay) {
            const timeInLeadPhrase = (t - (beatIndex - currentBeatInCycle) * beatDuration - leadStartBeatOffset * beatDuration);
            
            let currentLeadFreq = getFreq(leadBaseMidi);

            // Pitch bend up at the start of the lead phrase
            const bendAttackDuration = beatDuration * 0.5; // Bend for half a beat
            if (timeInLeadPhrase < bendAttackDuration) {
                // Apply a negative pitch bend and then return to base
                const bendFactor = lerp(1 - leadPitchBendDepth, 1, timeInLeadPhrase / bendAttackDuration); // Bends up
                currentLeadFreq *= bendFactor; 
            }
            
            // Vibrato
            leadLfoPhase += (2 * Math.PI * leadVibratoFreq / sampleRate); // Use adjusted leadVibratoFreq
            currentLeadFreq *= (1 + sinOsc(leadLfoPhase) * leadVibratoDepth);

            // Metallic sound via FM
            let leadModFreqValue = leadModFreq * (1 + grittiness * 0.5); // Grittiness affects modulator freq
            let modIndex = leadModDepth * 5; // How much FM affects carrier pitch
            
            leadPhase += 2 * Math.PI * (currentLeadFreq + sinOsc(modPhase) * modIndex) / sampleRate; // Carrier freq modulated by sine
            modPhase += 2 * Math.PI * leadModFreqValue / sampleRate;

            let leadSample = sinOsc(leadPhase); // FM carrier is a sine wave

            // ADSR for the entire lead note
            const env = adsr(timeInLeadPhrase, leadAttackTime, leadDecayTime, leadSustain, leadReleaseTime, leadPhraseDurationFrames / sampleRate);
            leadSample *= env * leadGain;

            leadLPF.setCutoff(8000 + grittiness * 1000); // Update filter cutoff
            leadSample = leadLPF(leadSample); // Apply filter

            // Pan based on desolation (fixed for the phrase)
            const pan = randPM1() * desolation * 0.8; // Pan varies per phrase, using one rand for whole phrase
            sampleL += leadSample * (1 - pan);
            sampleR += leadSample * (1 + pan);
        }

        // Accumulate all voices to final channels
        leftChannel[i] += sampleL;
        rightChannel[i] += sampleR;
    }

    return [leftChannel, rightChannel];
}

const LOOP = true;
const HEADROOM = 0.98;
const FADE_SECONDS = 0.005;

export function render(params) {
  const { sampleRate, volume } = params;
  const channelData = synthesize(params);
  if (!Array.isArray(channelData) || channelData.length < 1 || channelData.length > 2) {
    throw new TypeError('synthesize() must return one or two channels.');
  }
  const frames = channelData[0]?.length ?? 0;
  // A one-shot fades to silence at both boundaries; a phrase keeps them, because its last sample
  // has to continue into its first. The fade is applied before the peak is taken, so the mix ends
  // up at exactly HEADROOM of full scale whether or not the loudest sample sat inside the fade.
  const fade = LOOP ? 0 : Math.min(Math.round(sampleRate * FADE_SECONDS), Math.floor(frames / 2));
  let peak = 0;
  for (const channel of channelData) {
    if (!(channel instanceof Float32Array) || channel.length !== frames || frames === 0) {
      throw new TypeError('synthesize() must return equally sized, non-empty Float32Array channels.');
    }
    for (let i = 0; i < frames; i++) {
      if (!Number.isFinite(channel[i])) throw new TypeError('synthesize() produced a non-finite sample.');
      channel[i] *= fade === 0 ? 1 : Math.min(1, i / fade, (frames - 1 - i) / fade);
      peak = Math.max(peak, Math.abs(channel[i]));
    }
  }
  const gain = peak > 0 ? (volume * HEADROOM) / peak : 0;
  for (const channel of channelData) for (let i = 0; i < frames; i++) channel[i] *= gain;
  return { sampleRate, channelData, loop: LOOP };
}