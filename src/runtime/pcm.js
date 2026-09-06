/**
 * Signed 16-bit PCM quantization: the one law both outputs use.
 *
 * Playback and the WAV writer consume the same render, so they must also agree on how a float
 * sample becomes an integer one. Full scale is asymmetric in two's complement — -1 maps to -32768
 * and +1 to 32767 — and doing that in one place is what keeps a recorded file and its playback
 * sample-identical.
 */
export function interleave16(channelData, start, end) {
  const channels = channelData.length;
  const buffer = Buffer.allocUnsafe((end - start) * channels * 2);
  for (let frame = start; frame < end; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      const sample = channelData[channel][frame];
      buffer.writeInt16LE(Math.round(sample * (sample < 0 ? 32768 : 32767)), ((frame - start) * channels + channel) * 2);
    }
  }
  return buffer;
}
