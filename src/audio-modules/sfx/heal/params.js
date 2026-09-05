import { resolveParams } from '../../../validation.js';

export const params = Object.freeze({
  "sampleRate": 44100,
  "volume": 0.8,
  "duration": 1.5,
  "warmth": 0.65
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
  "duration": [
    0.8,
    3
  ],
  "warmth": [
    0,
    1
  ]
};

export const getParams = (options = {}) => resolveParams(options, params, rules);
