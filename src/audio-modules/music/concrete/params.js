import { resolveParams } from '../../../validation.js';

export const params = Object.freeze({
  sampleRate: 44100,
  volume: 0.8,
  grit: 0.4,
  gateSync: 2.0,
  metallicResonance: 0.6,
  mechanicalTension: 0.5,
  seed: 28471,
});

export const rules = {
  sampleRate: [22050, 96000, true],
  volume: [0, 1],
  grit: [0, 1],
  gateSync: [0.5, 16],
  metallicResonance: [0, 1],
  mechanicalTension: [0, 1],
  seed: [0, 4294967295, true],
};

export const getParams = (options = {}) => resolveParams(options, params, rules);
