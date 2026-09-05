import { readdir, stat } from 'node:fs/promises';
import { assertOptions, validateIdentity, validateAudioResult } from './validation.js';
import { play } from './runtime/playback.js';
import { record } from './runtime/wav.js';

const root = new URL('./audio-modules/', import.meta.url);

export async function listAssets(type) {
  validateIdentity(type, 'list');
  const entries = await readdir(new URL(`${type}/`, root), { withFileTypes: true });
  const assets = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async ({ name }) => {
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name)) return null;
    try {
      return (await stat(new URL(`${type}/${name}/index.js`, root))).isFile() ? name : null;
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }));
  return assets.filter(Boolean).sort();
}

export async function resolveAudioModule(type, id) {
  validateIdentity(type, id);
  const available = await listAssets(type);
  if (!available.includes(id)) {
    const label = type === 'sfx' ? 'SFX' : 'Music';
    throw new Error(`Unknown ${label}: ${id}\nAvailable ${label}:\n  ${available.join('\n  ')}`);
  }
  // Import errors inside an existing module are deliberately not reported as unknown IDs.
  const { default: asset } = await import(new URL(`${type}/${id}/index.js`, root));
  if (!asset || asset.id !== id || asset.type !== type || typeof asset.render !== 'function') {
    throw new TypeError(`Invalid module contract: ${type}/${id}`);
  }
  return asset;
}

export async function dispatch(type, id, options = {}, output = {}) {
  assertOptions(options);
  const asset = await resolveAudioModule(type, id);
  const audio = validateAudioResult(await asset.render(options));
  // Both consumers receive the same render. Record first so device failures preserve the WAV.
  const path = output.record ? await record(id, audio) : undefined;
  const playback = output.play === false ? undefined : await play(type, audio);
  return { id, type, audio, path, playback };
}
