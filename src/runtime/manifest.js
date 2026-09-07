import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname } from 'node:path';

const modules = new URL('../audio-module/', import.meta.url);

const missing = (error, ...codes) => codes.includes(error.code);

/** Asset metadata, or an empty record for a module that ships no manifest.json. */
const readAssetManifest = async (bus, id) => {
  try {
    return JSON.parse(await readFile(new URL(`${bus}/${id}/manifest.json`, modules), 'utf8'));
  } catch (error) {
    if (missing(error, 'ENOENT')) return {};
    throw error;
  }
};

/** Owned defaults and their numeric contracts, or empty records when params.js is absent. */
const readParameterContract = async (bus, id) => {
  let module;
  try {
    module = await import(new URL(`${bus}/${id}/params.js`, modules));
  } catch (error) {
    if (missing(error, 'ERR_MODULE_NOT_FOUND', 'ENOENT')) return { defaults: {}, parameters: {} };
    throw error;
  }
  const defaults = { ...(module.params ?? {}) };
  const parameters = {};
  for (const [key, [min, max, integer]] of Object.entries(module.rules ?? {})) {
    parameters[key] = { min, max, integer: Boolean(integer) };
  }
  return { defaults, parameters };
};

/** WAV and manifest are one artifact pair: `<name-out>.wav` beside `<name-out>.json`. */
export const manifestPathFor = (wavPath) => `${wavPath.replace(/\.wav$/i, '')}.json`;

export async function buildManifest(bus, id, audio, wavPath) {
  const { tags = [], author = '', version = '' } = await readAssetManifest(bus, id);
  const { defaults, parameters } = await readParameterContract(bus, id);
  return {
    id,
    bus,
    tags,
    author,
    version,
    duration: audio.duration,
    sampleRate: audio.sampleRate,
    channels: audio.channelData.length,
    loop: audio.loop,
    audio: basename(wavPath),
    defaults,
    parameters,
  };
}

export async function writeManifest(bus, id, audio, wavPath) {
  const path = manifestPathFor(wavPath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(await buildManifest(bus, id, audio, wavPath), null, 2)}\n`);
  return path;
}
