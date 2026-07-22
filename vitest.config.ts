import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'src/**/*.test.ts',
      'netlify/**/*.test.js',
      'netlify/**/*.test.ts',
      'scripts/**/*.test.js',
    ],
  },
});
