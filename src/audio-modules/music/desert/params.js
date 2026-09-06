import { resolveParams } from '../../../validation.js';

export const params = Object.freeze({
  "sampleRate": 44100,
  "volume": 0.8,
  "intensity": 0.5,
  "grittiness": 0.3,
  "desolation": 0.7,
  "pulseSpeed": 1,
  "seed": 0
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
  "intensity": [
    0,
    1
  ],
  "grittiness": [
    0,
    1
  ],
  "desolation": [
    0,
    1
  ],
  "pulseSpeed": [
    0.5,
    2
  ],
  "seed": [
    0,
    4294967295,
    true
  ]
};

export const getParams = (options = {}) => resolveParams(options, params, rules);
