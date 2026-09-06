import { resolveParams } from '../../../validation.js';

export const params = Object.freeze({
  "sampleRate": 44100,
  "volume": 0.37,
  "duration": 0.065,
  "brightness": 0.45
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
    0.025,
    0.15
  ],
  "brightness": [
    0,
    1
  ]
};

export const getParams = (options = {}) => resolveParams(options, params, rules);
