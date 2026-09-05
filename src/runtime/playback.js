import { setTimeout as delay } from 'node:timers/promises';

const active = new Map();

export function stop(type) {
  for (const [handle, domain] of active) {
    if (type === undefined || type === domain) handle.stop();
  }
}

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

export async function play(type, { sampleRate, channelData }) {
  // Lazy loading keeps offline rendering independent of native audio initialization.
  const { default: speaker } = await import('@audio/speaker');
  let write;
  try {
    // Automatic fallback may silently discard audio. Require the native output backend.
    write = speaker({ sampleRate, channels: channelData.length, bitDepth: 16, bufferSize: 50, backend: 'miniaudio' });
  } catch (cause) {
    throw new Error('Live playback unavailable: could not open the default audio device. The WAV was saved; omit --play for record-only mode.', { cause });
  }

  let stopped = false;
  let closed = false;
  const close = () => {
    if (!closed) { closed = true; write.close(); }
  };
  const handle = {
    backend: write.backend,
    stop() { stopped = true; close(); },
    done: undefined,
  };
  active.set(handle, type);
  handle.done = (async () => {
    try {
      const frames = channelData[0].length;
      // Backpressure keeps at most one small chunk in flight and allows prompt stopping.
      for (let start = 0; start < frames && !stopped; start += 2048) {
        const chunk = interleave16(channelData, start, Math.min(frames, start + 2048));
        await new Promise((resolve, reject) => write(chunk, (error) => error ? reject(error) : resolve()));
      }
      // Silence drains both the native ring and the device's final hardware buffer.
      // Avoid an uncancellable flush-poll loop when stop() closes the device.
      if (!stopped) {
        const silence = Buffer.alloc(Math.ceil(sampleRate * 0.1) * channelData.length * 2);
        await new Promise((resolve, reject) => write(silence, (error) => error ? reject(error) : resolve()));
        if (!stopped) await delay(50);
      }
      return { stopped };
    } catch (cause) {
      if (stopped) return { stopped: true };
      throw new Error(`Audio playback failed: ${cause.message}`, { cause });
    } finally {
      close();
      active.delete(handle);
    }
  })();
  handle.done.catch(() => {});
  return handle;
}
