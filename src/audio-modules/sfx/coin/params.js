import { resolveParams } from '../../../validation.js';

export const params = Object.freeze({
  "sampleRate": 44100,
  "volume": 0.8,
  "duration": 0.42,
  "pitch": 1
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
    0.2,
    1
  ],
  "pitch": [
    0.5,
    2
  ]
};

export const getParams = (options = {}) => resolveParams(options, params, rules);
