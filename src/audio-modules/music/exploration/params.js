import { resolveParams } from '../../../validation.js';

export const params = Object.freeze({
  "sampleRate": 44100,
  "volume": 0.65,
  "bpm": 96,
  "cycles": 2,
  "density": 0.45
});

const rules = {
  "sampleRate": [
    22050,
    96000,
    true
  ],
  "volume": [
    0,
    1
  ],
  "bpm": [
    60,
    140
  ],
  "cycles": [
    1,
    3,
    true
  ],
  "density": [
    0,
    1
  ]
};

export const getParams = (options = {}) => resolveParams(options, params, rules);
