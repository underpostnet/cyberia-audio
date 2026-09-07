import { readdir, stat } from 'node:fs/promises';
import { assertOptions, validateIdentity, validateAudioResult } from './validation.js';
import { play } from './runtime/playback.js';
import { record } from './runtime/wav.js';

const root = new URL('./audio-module/', import.meta.url);

export async function listAssets(bus) {
  validateIdentity(bus, 'list');
  const entries = await readdir(new URL(`${bus}/`, root), { withFileTypes: true });
  const assets = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async ({ name }) => {
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name)) return null;
    try {
      return (await stat(new URL(`${bus}/${name}/index.js`, root))).isFile() ? name : null;
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }));
  return assets.filter(Boolean).sort();
}

export async function resolveAudioModule(bus, id) {
  validateIdentity(bus, id);
  const available = await listAssets(bus);
  if (!available.includes(id)) {
    throw new Error(`Unknown ${bus} module: ${id}\nAvailable ${bus} modules:\n  ${available.join('\n  ')}`);
  }
  // Import errors inside an existing module are deliberately not reported as unknown IDs.
  const { default: asset } = await import(new URL(`${bus}/${id}/index.js`, root));
  if (!asset || asset.id !== id || asset.bus !== bus || typeof asset.render !== 'function') {
    throw new TypeError(`Invalid module contract: ${bus}/${id}`);
  }
  return asset;
}

export async function dispatch(bus, id, options = {}, output = {}) {
  assertOptions(options);
  const asset = await resolveAudioModule(bus, id);
  const audio = validateAudioResult(await asset.render(options));
  // Both consumers receive the same render. Record first so device failures preserve the WAV.
  const { path, manifestPath } = output.record ? await record(bus, id, audio, output.path) : {};
  const playback = output.play === false ? undefined : await play(bus, audio);
  return { id, bus, audio, path, manifestPath, playback };
}
