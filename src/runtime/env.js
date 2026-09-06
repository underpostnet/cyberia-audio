import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

/**
 * Loads a `.env` into the process environment.
 *
 * An explicit path must exist: asking for a file that is not there is a mistake worth reporting,
 * not one to work around. With no path, `./.env` is loaded when it is present and skipped in
 * silence when it is not, so the CLI behaves the same in a checkout that keeps a key file and in
 * one that does not.
 *
 * A variable already set in the environment always wins, so an exported `GEMINI_API_KEY` overrides
 * the file rather than the other way round.
 * @param {string} [path] - Explicit env file to load. Defaults to `./.env` in the working directory.
 * @returns {string|null} The absolute path that was loaded, or null when there was nothing to load.
 */
export function loadEnvFile(path) {
  const file = resolve(path ?? '.env');
  if (!existsSync(file)) {
    if (path) throw new Error(`Environment file not found: ${file}`);
    return null;
  }
  const { error } = dotenv.config({ path: file, override: false, quiet: true });
  if (error) throw error;
  return file;
}
