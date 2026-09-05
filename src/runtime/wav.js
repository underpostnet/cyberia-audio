import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import wav from 'node-wav';
import { validateIdentity, validateAudioResult } from '../validation.js';

export async function record(id, result, outputPath = resolve('records', `${id}.wav`)) {
  validateIdentity('sfx', id);
  const { sampleRate, channelData } = validateAudioResult(result);
  // Absolute paths are written as given; relative paths resolve against the current working directory.
  const path = resolve(outputPath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, wav.encode(channelData, { sampleRate, bitDepth: 16, float: false }));
  return path;
}
