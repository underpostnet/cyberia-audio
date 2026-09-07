# **concrete-pulse**

A driving post-punk & darkwave industrial soundscape featuring a pulsating octave bassline, atmospheric chorus guitar-synth lead, gated reverb drum machine, and FM metallic clangs.  
Use for: coldwave night environments, high-tension industrial club scenes, dark sci-fi, and mechanical sequences.

## **Sound Design & Musical Structure**

> - **Tempo & Key**: 120 BPM in A Minor (6-bar seamless loop duration of 12.00 seconds).
> - **Driving Bass**: Dual-oscillator analog-style octave bassline processed through a resonant SVF filter and tube overdrive (grit).
> - **Post-Punk Lead**: Plucked gothic lead melody with stereo chorus phase modulation and ping-pong delay.
> - **Industrial Percussion**: Punchy synth kick, 80s gated-reverb snare, metallic FM anvil hits (metallicResonance), and rhythmic hi-hats.
> - **Cold Synth Pad**: Background drone gated rhythmically (gateSync) for industrial tension.

## **Parameters and Output**

> - grit (0–1, default 0.4): Controls harmonic saturation and tube overdrive.
> - gateSync (0.5–16, default 2.0): Sets the frequency (in Hz) of the atmospheric rhythmic tremolo gate.
> - metallicResonance (0–1, default 0.6): Adjusts the modulation depth and metallic timbre of the industrial percussion.
> - mechanicalTension (0–1, default 0.5): Controls drum punch, sub-bass drive, and accent intensity.
> - seed (0–4294967295, integer, default 28471): Seeds the pseudo-random timing jitter and noise generators.

All parameters are optional. sampleRate accepts integers from 22050 to 96000 (default 44100); volume accepts 0–1 (default 0.8).  
Stereo output; duration is exactly 12.00 seconds at 120 BPM (loop: true).

## **Usage**

import audio from 'cyberia-audio';

const playback \= await audio.music.play('concrete-pulse');  
await playback.done;  
await audio.music.record('concrete-pulse'); // records/concrete-pulse.wav

cyberia-audio music concrete-pulse
