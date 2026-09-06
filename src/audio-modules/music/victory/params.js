import { resolveParams } from '../../../validation.js';

export const params = Object.freeze({
  "sampleRate": 44100,
  "volume": 0.57,
  "bpm": 120,
  "brilliance": 0.7
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
  "bpm": [
    90,
    160
  ],
  "brilliance": [
    0,
    1
  ]
};

export const getParams = (options = {}) => resolveParams(options, params, rules);
