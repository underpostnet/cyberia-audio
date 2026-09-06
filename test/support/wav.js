/**
 * A strict, dependency-free RIFF/WAVE reader for the tests.
 *
 * It validates the container it is asked to decode — chunk ids, declared sizes, format, block
 * alignment — so a round-trip assertion fails on a malformed header rather than quietly reading
 * samples out of a file the rest of the world would reject.
 */
export function decodeWav(buffer) {
  const ascii = (offset) => buffer.toString('ascii', offset, offset + 4);
  const expect = (actual, wanted, what) => {
    if (actual !== wanted) throw new Error(`Invalid WAV: ${what} is ${JSON.stringify(actual)}, expected ${JSON.stringify(wanted)}`);
  };
  expect(ascii(0), 'RIFF', 'the container id');
  expect(buffer.readUInt32LE(4), buffer.length - 8, 'the declared RIFF size');
  expect(ascii(8), 'WAVE', 'the form type');
  expect(ascii(12), 'fmt ', 'the first chunk');
  expect(buffer.readUInt32LE(16), 16, 'the fmt chunk size');
  expect(buffer.readUInt16LE(20), 1, 'the audio format');
  const channels = buffer.readUInt16LE(22);
  const sampleRate = buffer.readUInt32LE(24);
  const bitDepth = buffer.readUInt16LE(34);
  expect(bitDepth, 16, 'the bit depth');
  expect(buffer.readUInt16LE(32), channels * 2, 'the block align');
  expect(buffer.readUInt32LE(28), sampleRate * channels * 2, 'the byte rate');
  expect(ascii(36), 'data', 'the second chunk');
  const dataLength = buffer.readUInt32LE(40);
  expect(dataLength, buffer.length - 44, 'the declared data size');

  const frames = dataLength / (channels * 2);
  const channelData = Array.from({ length: channels }, () => new Float32Array(frames));
  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      channelData[channel][frame] = buffer.readInt16LE(44 + (frame * channels + channel) * 2) / 32768;
    }
  }
  return { sampleRate, bitDepth, channelData };
}
