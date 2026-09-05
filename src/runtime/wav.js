import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import wav from 'node-wav';
import { validateIdentity, validateAudioResult } from '../validation.js';

export async function record(id, result) {
  validateIdentity('sfx', id);
  const { sampleRate, channelData } = validateAudioResult(result);
  const directory = resolve('records');
  await mkdir(directory, { recursive: true });
  const path = resolve(directory, `${id}.wav`);
  await writeFile(path, wav.encode(channelData, { sampleRate, bitDepth: 16, float: false }));
  return path;
}
