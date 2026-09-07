import { resolveParams } from '../../../validation.js';

export const params = Object.freeze({ sampleRate: 44100, volume: 0.7, duration: 0.8 });
export const rules = { sampleRate: [22050, 96000, true], volume: [0, 1], duration: [0.3, 2] };
export const getParams = (options = {}) => resolveParams(options, params, rules);
