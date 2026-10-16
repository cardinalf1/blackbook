import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    testTimeout: 15_000,
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts', 'server/**/*.test.ts', 'electron/**/*.test.ts'],
  },
});
