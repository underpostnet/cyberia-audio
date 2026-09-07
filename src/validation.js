// Data validation only. Asset-specific parameters and all DSP live in each asset.
export function assertOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(options))) {
    throw new TypeError('Options must be a plain object.');
  }
}

export function resolveParams(options, defaults, rules) {
  assertOptions(options);
  for (const key of Object.keys(options)) {
    if (!Object.hasOwn(defaults, key)) throw new TypeError(`Unknown parameter: ${key}`);
  }
  const params = { ...defaults, ...options };
  for (const [key, [min, max, integer]] of Object.entries(rules)) {
    const value = params[key];
    if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
      throw new RangeError(`${key} must be ${integer ? 'an integer' : 'a number'} between ${min} and ${max}.`);
    }
  }
  return params;
}

/** The two audio routes, and the `src/audio-module/<bus-id>/` directory each one is authored in. */
export const AUDIO_BUSES = Object.freeze(['music', 'sfx']);

export function validateIdentity(bus, id) {
  if (!AUDIO_BUSES.includes(bus)) throw new TypeError(`Audio bus must be one of: ${AUDIO_BUSES.join(', ')}.`);
  if (typeof id !== 'string' || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id)) {
    throw new TypeError('Semantic ID must contain lowercase words separated by hyphens.');
  }
}

/** Planar PCM: one finite, equally sized Float32Array per channel, in [-1, 1]. */
export function validateAudioResult(result) {
  const invalid = (reason) => { throw new TypeError(`Invalid audio result: ${reason}`); };
  if (!result || typeof result !== 'object') invalid('expected an object.');
  const { sampleRate, channelData } = result;
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) invalid('invalid sampleRate.');
  if (!Array.isArray(channelData) || channelData.length < 1 || channelData.length > 2) invalid('expected mono or stereo channelData.');
  const frames = channelData[0]?.length;
  if (!frames || frames > sampleRate * 120) invalid('duration must be greater than zero and at most 120 seconds.');
  for (const channel of channelData) {
    if (!(channel instanceof Float32Array) || channel.length !== frames) invalid('channels must be equally sized Float32Arrays.');
    for (const value of channel) {
      if (!Number.isFinite(value) || Math.abs(value) > 1) invalid('samples must be finite and within [-1, 1].');
    }
  }
  if (result.loop !== undefined && typeof result.loop !== 'boolean') invalid('loop must be a boolean.');
  return { sampleRate, channelData, duration: frames / sampleRate, loop: result.loop ?? false };
}
