import { resolveParams } from '../../../validation.js';

export const params = Object.freeze({
  "sampleRate": 44100,
  "volume": 0.46,
  "duration": 0.24,
  "pitch": 1
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
    0.1,
    0.6
  ],
  "pitch": [
    0.5,
    2
  ]
};

export const getParams = (options = {}) => resolveParams(options, params, rules);
