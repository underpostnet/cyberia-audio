import { resolveParams } from '../../../validation.js';

export const params = Object.freeze({
  "sampleRate": 44100,
  "volume": 0.5,
  "bpm": 128,
  "cycles": 2,
  "charge": 0.6,
  "seed": 7311
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
    180
  ],
  "cycles": [
    1,
    8,
    true
  ],
  "charge": [
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
