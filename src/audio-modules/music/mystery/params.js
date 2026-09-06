import { resolveParams } from '../../../validation.js';

export const params = Object.freeze({
  "sampleRate": 44100,
  "volume": 0.46,
  "bpm": 90,
  "cycles": 2,
  "tension": 0.6,
  "seed": 2153
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
    140
  ],
  "cycles": [
    1,
    3,
    true
  ],
  "tension": [
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