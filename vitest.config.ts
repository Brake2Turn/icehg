import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['engine/tests/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
    testTimeout: 120000,
  },
});
