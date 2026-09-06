import { describe, expect, it } from 'vitest';
import { encodeWav, wavHeader } from '../src/runtime/wav.js';
import { interleave16 } from '../src/runtime/pcm.js';
import { decodeWav } from './support/wav.js';

const mono = { sampleRate: 8000, channelData: [new Float32Array([0, 0.5, -0.5, 1, -1])] };
const stereo = { sampleRate: 44100, channelData: [new Float32Array([0, 1]), new Float32Array([0, -1])] };

describe('native WAV encoding', () => {
  it('writes the canonical 44-byte RIFF/WAVE header', () => {
    const buffer = encodeWav(mono);
    expect(buffer.length).toBe(44 + 5 * 2);
    expect(buffer.toString('ascii', 0, 4)).toBe('RIFF');
    expect(buffer.readUInt32LE(4)).toBe(buffer.length - 8);
    expect(buffer.toString('ascii', 8, 12)).toBe('WAVE');
    expect(buffer.toString('ascii', 12, 16)).toBe('fmt ');
    expect(buffer.readUInt32LE(16)).toBe(16); // fmt chunk size
    expect(buffer.readUInt16LE(20)).toBe(1); // uncompressed PCM
    expect(buffer.readUInt16LE(22)).toBe(1); // channels
    expect(buffer.readUInt32LE(24)).toBe(8000);
    expect(buffer.readUInt32LE(28)).toBe(8000 * 2); // byte rate
    expect(buffer.readUInt16LE(32)).toBe(2); // block align
    expect(buffer.readUInt16LE(34)).toBe(16); // bit depth
    expect(buffer.toString('ascii', 36, 40)).toBe('data');
    expect(buffer.readUInt32LE(40)).toBe(buffer.length - 44);
  });

  it('interleaves stereo frames and sizes their header accordingly', () => {
    const buffer = encodeWav(stereo);
    expect(buffer.readUInt16LE(22)).toBe(2);
    expect(buffer.readUInt16LE(32)).toBe(4);
    expect(buffer.readUInt32LE(28)).toBe(44100 * 4);
    expect(Array.from({ length: 4 }, (_, i) => buffer.readInt16LE(44 + i * 2))).toEqual([0, 0, 32767, -32768]);
  });

  it('writes exactly the bytes playback sends to the device', () => {
    // One quantization law, so a recorded file and its playback are sample-identical.
    const samples = encodeWav(stereo).subarray(44);
    expect(samples.equals(interleave16(stereo.channelData, 0, 2))).toBe(true);
  });

  it('round-trips full scale and silence', () => {
    const decoded = decodeWav(encodeWav(mono));
    expect(decoded.sampleRate).toBe(8000);
    expect(decoded.bitDepth).toBe(16);
    expect(decoded.channelData).toHaveLength(1);
    expect(decoded.channelData[0][0]).toBe(0);
    expect(decoded.channelData[0][4]).toBe(-1); // -1 is exact in two's complement
    for (const [index, value] of [[1, 0.5], [2, -0.5], [3, 1]]) {
      expect(Math.abs(decoded.channelData[0][index] - value)).toBeLessThan(2 / 32768);
    }
  });

  it('describes a header the reader rejects when it is wrong', () => {
    const corrupt = (mutate) => {
      const buffer = Buffer.from(encodeWav(mono));
      mutate(buffer);
      return () => decodeWav(buffer);
    };
    expect(corrupt((buffer) => buffer.write('RIFX', 0, 'ascii'))).toThrow('the container id');
    expect(corrupt((buffer) => buffer.writeUInt32LE(9, 40))).toThrow('the declared data size');
    expect(corrupt((buffer) => buffer.writeUInt16LE(8, 34))).toThrow('the bit depth');
  });

  it('sizes a header from its arguments alone', () => {
    const header = wavHeader({ sampleRate: 22050, channels: 2, dataLength: 400 });
    expect(header.length).toBe(44);
    expect(header.readUInt32LE(4)).toBe(436);
    expect(header.readUInt32LE(40)).toBe(400);
  });
});
