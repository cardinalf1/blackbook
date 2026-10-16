import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    environmentMatchGlobs: [
      ['server/**', 'node'],
      ['scripts/**', 'node'],
      ['electron/**', 'node'],
    ],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts', 'server/**/*.test.ts', 'electron/**/*.test.ts'],
  },
});
