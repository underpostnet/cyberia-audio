import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEnvFile } from '../src/runtime/env.js';

const KEYS = ['CYBERIA_TEST_KEY', 'CYBERIA_TEST_QUOTED', 'CYBERIA_TEST_EXPORTED'];
const directories = [];
const workspace = async (contents) => {
  const directory = await mkdtemp(join(tmpdir(), 'cyberia-audio-env-'));
  directories.push(directory);
  if (contents !== undefined) await writeFile(join(directory, '.env'), contents);
  return directory;
};

afterEach(async () => {
  for (const key of KEYS) delete process.env[key];
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

// process.chdir is process-wide; Vitest isolates each test file in its own worker and runs the
// tests in a file one at a time, so the cwd is restored before anything else observes it.
const inDirectory = async (directory, run) => {
  const previous = process.cwd();
  process.chdir(directory);
  try {
    return await run();
  } finally {
    process.chdir(previous);
  }
};

describe('environment file loading', () => {
  it('reads ./.env without being asked', async () => {
    const directory = await workspace('CYBERIA_TEST_KEY=from-file\n');
    const loaded = await inDirectory(directory, () => loadEnvFile());
    expect(loaded).toContain('.env');
    expect(process.env.CYBERIA_TEST_KEY).toBe('from-file');
  });

  it('is silent when a project keeps no .env', async () => {
    const directory = await workspace(undefined);
    expect(await inDirectory(directory, () => loadEnvFile())).toBe(null);
  });

  it('never overrides a variable the environment already carries', async () => {
    const directory = await workspace('CYBERIA_TEST_EXPORTED=from-file\n');
    process.env.CYBERIA_TEST_EXPORTED = 'from-shell';
    await inDirectory(directory, () => loadEnvFile());
    expect(process.env.CYBERIA_TEST_EXPORTED).toBe('from-shell');
  });

  it('strips the quotes around a value', async () => {
    // The reason this uses dotenv rather than Node's own env-file parser, which keeps them.
    const directory = await workspace('CYBERIA_TEST_QUOTED="spaced value"\n');
    await inDirectory(directory, () => loadEnvFile());
    expect(process.env.CYBERIA_TEST_QUOTED).toBe('spaced value');
  });

  it('loads a file named explicitly, from anywhere', async () => {
    const directory = await workspace('CYBERIA_TEST_KEY=from-explicit-file\n');
    expect(loadEnvFile(join(directory, '.env'))).toBe(join(directory, '.env'));
    expect(process.env.CYBERIA_TEST_KEY).toBe('from-explicit-file');
  });

  it('reports an explicitly named file that is not there', async () => {
    const directory = await workspace(undefined);
    expect(() => loadEnvFile(join(directory, 'absent.env'))).toThrow('Environment file not found');
  });
});
