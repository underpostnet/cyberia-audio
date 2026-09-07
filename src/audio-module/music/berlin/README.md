# **berlin**

Dark, hypnotic Berlin industrial techno track.  
Use for: Underground clubs, industrial zones, high-speed night chases, and relentless gameplay loops.

## **Sound design**

A heavy 4-on-the-floor kick with a reverberant sub-bass rumble forms the foundation at 138 BPM. Sharp metallic offbeat hi-hats, distorted industrial clap bursts, and a hypnotic F minor synth line with dynamic filter sweeping provide relentless forward momentum. Intensity increases parameter drive, adds sub-harmonic saturation, syncopated ride cymbals, and raw metallic percussion accents.

## **Parameters and output**

bpm (120–150, default 138), rounds (1–4 four-bar phrases, default 2), intensity (0–1, default 0.7), integer seed (default 841). Default volume is 0.88.  
All parameters are optional. sampleRate accepts integers from 22050 to 96000 (default 44100); volume accepts 0–1 (default 0.88). Seeds accept integers from 0 to 4294967295\. Invalid or unknown parameters are rejected. volume is the fraction of full scale the loudest sample reaches, so 1 is as loud as this render gets without clipping.  
Stereo; duration is rounds \* 16 \* 60 / bpm seconds (about 13.91 by default). loop: true marks a repeatable phrase; playback plays it once. Rendering returns { sampleRate, channelData: Float32Array\[\], loop } with samples in \[-1, 1\]. Rendering never opens a speaker or writes files. Playback and 16-bit WAV encoding consume the same samples.

## **Usage**

import audio from 'cyberia-audio';

const playback \= await audio.music.play('berlin');  
await playback.done;  
await audio.music.record('berlin'); // records/berlin.wav

cyberia-audio music berlin
