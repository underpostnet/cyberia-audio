import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { speaker, sinks } = vi.hoisted(() => ({ speaker: vi.fn(), sinks: [] }));
vi.mock('@audio/speaker', () => ({ default: speaker }));

import audio from '../src/index.js';
import { dispatch } from '../src/dispatcher.js';
import { play, stop } from '../src/runtime/playback.js';
import { interleave16 } from '../src/runtime/pcm.js';

beforeEach(() => {
  sinks.length = 0;
  speaker.mockReset().mockImplementation(() => {
    const write = vi.fn((buffer, callback) => setImmediate(() => callback(null)));
    write.close = vi.fn();
    write.backend = 'miniaudio';
    sinks.push(write);
    return write;
  });
});
afterEach(() => stop());

describe('playback adapter', () => {
  it('interleaves stereo signed 16-bit PCM with correct endpoints', () => {
    const buffer = interleave16([new Float32Array([-1, 0, 1]), new Float32Array([1, 0, -1])], 0, 3);
    expect(Array.from({ length: 6 }, (_, i) => buffer.readInt16LE(i * 2))).toEqual([-32768, 32767, 0, 0, 32767, -32768]);
  });
  it('repeats through one open device until stopped, and never drains between passes', async () => {
    const result = await audio.sfx.render('ui-click');
    const pass = interleave16(result.channelData, 0, result.channelData[0].length);
    const handle = await play('sfx', result, { loop: true });
    // Long enough for several passes at the mock's setImmediate cadence.
    await new Promise((resolve) => setTimeout(resolve, 50));
    handle.stop();
    expect(await handle.done).toEqual({ stopped: true });
    expect(speaker).toHaveBeenCalledTimes(1);
    const bytes = Buffer.concat(sinks[0].mock.calls.map(([buffer]) => buffer));
    expect(bytes.length).toBeGreaterThan(pass.length);
    // The second pass starts where the first ended: no silence is written at the seam.
    expect(bytes.subarray(0, pass.length).equals(pass)).toBe(true);
    expect(bytes.subarray(pass.length, pass.length + 64).equals(pass.subarray(0, 64))).toBe(true);
    expect(sinks[0].close).toHaveBeenCalledTimes(1);
  });
  it('plays the exact render once, drains output, and closes the speaker', async () => {
    const result = await audio.sfx.render('coin');
    const handle = await play('sfx', result);
    expect(handle.backend).toBe('miniaudio');
    expect(speaker).toHaveBeenCalledWith(expect.objectContaining({ sampleRate: 44100, channels: 1, bitDepth: 16, backend: 'miniaudio' }));
    expect(await handle.done).toEqual({ stopped: false });
    const bytes = Buffer.concat(sinks[0].mock.calls.map(([buffer]) => buffer));
    const expected = interleave16(result.channelData, 0, result.channelData[0].length);
    expect(bytes.subarray(0, expected.length).equals(expected)).toBe(true);
    expect(bytes.subarray(expected.length).every((value) => value === 0)).toBe(true);
    expect(sinks[0].close).toHaveBeenCalledTimes(1);
    handle.stop();
    expect(sinks[0].close).toHaveBeenCalledTimes(1);
  });
  it('public API and dispatcher both use the same runtime', async () => {
    const first = await audio.sfx.play('coin', { volume: 0.1 });
    first.stop();
    const second = await dispatch('music', 'victory', { bpm: 160 });
    expect(speaker).toHaveBeenCalledTimes(2);
    second.playback.stop();
    expect(await first.done).toEqual({ stopped: true });
    expect(await second.playback.done).toEqual({ stopped: true });
  });
  it('stops only the selected bus, and all playback on audio.stop()', async () => {
    // Both renders happen before either device opens. Rendering between the two plays would let
    // the first one run to completion and close itself, which is not what this is asserting.
    const [effect, phrase] = [await audio.sfx.render('explosion'), await audio.music.render('combat')];
    const hit = await play('sfx', effect);
    const music = await play('music', phrase);
    audio.music.stop();
    expect(sinks[1].close).toHaveBeenCalledTimes(1);
    expect(sinks[0].close).not.toHaveBeenCalled();
    audio.stop();
    await Promise.all([hit.done, music.done]);
    expect(sinks[0].close).toHaveBeenCalledTimes(1);
  });
  it('does not open a device when rendering offline', async () => {
    await audio.sfx.render('coin');
    expect(speaker).not.toHaveBeenCalled();
  });
  it('reports device-open failures', async () => {
    speaker.mockImplementation(() => { throw new Error('No device'); });
    await expect(audio.sfx.play('coin')).rejects.toThrow('Live playback unavailable');
  });
  it('reports write failures through done and releases the device', async () => {
    const write = vi.fn((buffer, callback) => setImmediate(() => callback(new Error('Device lost'))));
    write.close = vi.fn();
    speaker.mockReturnValue(write);
    const handle = await audio.sfx.play('coin');
    await expect(handle.done).rejects.toThrow('Device lost');
    expect(write.close).toHaveBeenCalledTimes(1);
  });
});
