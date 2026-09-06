import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { interleave16 } from './pcm.js';
import { validateIdentity, validateAudioResult } from '../validation.js';
import { writeManifest } from './manifest.js';

const HEADER_BYTES = 44;
const BITS_PER_SAMPLE = 16;
const PCM_FORMAT = 1;

/**
 * The canonical RIFF/WAVE header for interleaved 16-bit PCM: the 44 bytes that precede the
 * samples, with every field derived from the render itself.
 */
export function wavHeader({ sampleRate, channels, dataLength }) {
  const header = Buffer.alloc(HEADER_BYTES);
  const blockAlign = channels * (BITS_PER_SAMPLE / 8);
  header.write('RIFF', 0, 'ascii');
  // Everything after this field: the rest of the header, then the samples.
  header.writeUInt32LE(HEADER_BYTES - 8 + dataLength, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(PCM_FORMAT, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * blockAlign, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(BITS_PER_SAMPLE, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(dataLength, 40);
  return header;
}

/** One render as 16-bit PCM WAV bytes. A 16-bit data chunk is always even, so it needs no pad byte. */
export function encodeWav({ sampleRate, channelData }) {
  const samples = interleave16(channelData, 0, channelData[0].length);
  const header = wavHeader({ sampleRate, channels: channelData.length, dataLength: samples.length });
  return Buffer.concat([header, samples]);
}

export async function record(type, id, result, outputPath = resolve('records', `${id}.wav`)) {
  validateIdentity(type, id);
  const audio = validateAudioResult(result);
  // Absolute paths are written as given; relative paths resolve against the current working directory.
  const path = resolve(outputPath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, encodeWav(audio));
  return { path, manifestPath: await writeManifest(type, id, audio, path) };
}
