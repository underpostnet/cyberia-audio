import { defineConfig } from 'vitest/config';

// Vitest searches upward for its configuration. Without this file, a checkout placed inside
// another repository runs that repository's Vitest projects and none of these tests.
export default defineConfig({
  test: { include: ['test/**/*.test.js'] },
});
