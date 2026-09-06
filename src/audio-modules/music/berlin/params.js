import { resolveParams } from '../../../validation.js';

export const params = Object.freeze({
  sampleRate: 44100,
  volume: 0.88,
  bpm: 138,
  rounds: 2,
  intensity: 0.7,
  seed: 841,
});

export const rules = {
  sampleRate: [22050, 96000, true],
  volume: [0, 1],
  bpm: [120, 150],
  rounds: [1, 4, true],
  intensity: [0, 1],
  seed: [0, 4294967295, true],
};

export const getParams = (options = {}) => resolveParams(options, params, rules);
