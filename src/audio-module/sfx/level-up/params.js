import { resolveParams } from '../../../validation.js';

export const params = Object.freeze({
  sampleRate: 44100,
  volume: 0.55,
  duration: 1.8,
  steps: 5,
  shimmer: 0.6,
});

export const rules = {
  sampleRate: [22050, 96000, true],
  volume: [0, 1],
  duration: [0.8, 2.5],
  steps: [3, 8, true],
  shimmer: [0, 1],
};

export const getParams = (options = {}) => resolveParams(options, params, rules);
