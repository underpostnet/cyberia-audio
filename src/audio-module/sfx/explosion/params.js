import { resolveParams } from '../../../validation.js';

export const params = Object.freeze({
  "sampleRate": 44100,
  "volume": 0.8,
  "duration": 1.8,
  "weight": 0.8,
  "seed": 90210
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
    0.6,
    5
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
