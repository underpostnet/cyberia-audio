# **level-up**

An entity gained a level\! Designed for classic RPG and MMO achievement feedback.

## **Sound design**

Inspired by iconic MMORPG level-up fanfares, this cue combines a low impact punch, an ascending warm major arpeggio, and a rich, golden chord resolution.  
The climb begins in a warm mid-register (C3 / 130.8 Hz) with warm sine-triangle harmonics. Rather than ending on an isolated high tone, the climb blossoms into a majestic, full major chord (Root–5th–Octave–3rd) anchored by a subtle sub-bass drop and warm shimmer.  
The high frequencies are smoothed by a 2.0 kHz low-pass filter to ensure there are no sharp, piercing whistles or annoying high-frequency beeps, leaving a satisfying, heroic tail.

## **Parameters and output**

> - duration (0.8–2.5 seconds, default 1.8): Sets total cue duration. The climb spans the first 38% of this time.
> - steps (3–8, default 5): Number of ascending note steps in the arpeggio flourish.
> - shimmer (0–1, default 0.6): Controls the lush harmonic chord swell beneath the peak note.

All parameters are optional. sampleRate accepts integers from 22050 to 96000 (default 44100); volume accepts 0–1 (default 0.55).  
Stereo, single-shot output. Rendering returns { sampleRate, channelData: Float32Array\[\], loop: false } with audio samples in normalized bounds \[-1, 1\].

## **Usage**

import audio from 'cyberia-audio';

const playback \= await audio.sfx.play('level-up');  
await playback.done;  
await audio.sfx.record('level-up'); // records/level-up.wav

cyberia-audio sfx level-up
