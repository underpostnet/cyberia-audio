# **death**

An entity was defeated.  
Designed for classic RPG and MMO defeat feedback when a monster, creature, player, or boss dies in combat or falls to zero health.

## **Sound design**

Inspired by dark fantasy MMORPG defeat sounds, this cue combines a heavy physical impact thump, a descending pitch decay representing falling vitality, a dark dissonant chord bloom (minor 2nd / flat 5th interval mix), and a slowing sub-frequency pulse.  
The effect opens with a heavy low-frequency hit (150 Hz down to 30 Hz) accompanied by a soft transient thump. As the entity perishes, a descending note scale glides down into a brooding minor chord resonance. A dynamic low-pass filter gradually sweeps down over time (from 1,800 Hz to 80 Hz), muffling the tail to give the sensory feeling of fading vitality without leaving any annoying high-pitched noise or sharp ringing.

## **Parameters and output**

> - duration (1.0–4.0 seconds, default 2.2): Sets total cue duration.
> - dissonance (0–1, default 0.55): Controls the amount of dark minor/tritone harmonic tension in the sustaining chord tail.
> - darkness (0–1, default 0.65): Controls the depth of the low-pass filter sweep and low sub-frequency weight.
> - seed (0–4294967295, default 8813): Fixes the impact noise, so a render is reproducible.

All parameters are optional. sampleRate accepts integers from 22050 to 96000 (default 44100); volume accepts 0–1 (default 0.80). Invalid or unknown parameters are rejected.  
Stereo, single-shot output. Rendering returns { sampleRate, channelData: Float32Array\[\], loop: false } with audio samples normalized within $\[-1, 1\]$.

## **Usage**

import audio from 'cyberia-audio';

const playback \= await audio.sfx.play('death');  
await playback.done;  
await audio.sfx.record('death'); // records/death.wav

cyberia-audio sfx death
