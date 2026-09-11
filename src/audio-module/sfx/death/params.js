import { resolveParams } from '../../../validation.js';

export const params = Object.freeze({
  sampleRate: 44100,
  volume: 0.8,
  duration: 2.2,
  dissonance: 0.55,
  darkness: 0.65,
  seed: 8813,
});

export const rules = {
  sampleRate: [22050, 96000, true],
  volume: [0, 1],
  duration: [1.0, 4.0],
  dissonance: [0, 1],
  darkness: [0, 1],
  seed: [0, 4294967295, true],
};

export const getParams = (options = {}) => resolveParams(options, params, rules);
