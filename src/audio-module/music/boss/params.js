import { resolveParams } from '../../../validation.js';

export const params = Object.freeze({ sampleRate: 44100, volume: 0.8, bpm: 120, rounds: 1 });
export const rules = { sampleRate: [22050, 96000, true], volume: [0, 1], bpm: [90, 160], rounds: [1, 4, true] };
export const getParams = (options = {}) => resolveParams(options, params, rules);
