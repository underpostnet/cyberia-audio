import { resolveParams } from '../../../validation.js';

export const params = Object.freeze({
  "sampleRate": 44100,
  "volume": 0.55,
  "bpm": 96,
  "cycles": 2,
  "particles": 14,
  "seed": 8641
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
    60,
    160
  ],
  "cycles": [
    1,
    8,
    true
  ],
  "particles": [
    0,
    48,
    true
  ],
  "seed": [
    0,
    4294967295,
    true
  ]
};

export const getParams = (options = {}) => resolveParams(options, params, rules);
