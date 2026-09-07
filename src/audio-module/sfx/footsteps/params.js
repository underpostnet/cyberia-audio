import { resolveParams } from '../../../validation.js';

export const params = Object.freeze({
  "sampleRate": 44100,
  "volume": 0.24,
  "duration": 0.62,
  "weight": 0.55,
  "seed": 4177
});

export const rules = {
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
    0.3,
    1.5
  ],
  "weight": [
    0,
    1
  ],
  "seed": [
    0,
    4294967295,
    true
  ]
};

export const getParams = (options = {}) => resolveParams(options, params, rules);
