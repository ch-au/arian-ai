import { defineConfig } from 'vitest/config';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  test: {
    include: [
      'server/**/*.{test,spec}.?(c|m)[jt]s?(x)',
      'tests/**/*.{test,spec}.?(c|m)[jt]s?(x)'
    ],
    environment: 'node',
    setupFiles: ['./tests/setupTests.ts'],
    server: {
      deps: {
        inline: [/deep-equal/],
      },
    },
    sequence: {
      concurrent: false,
    },
    poolOptions: {
      threads: {
        singleThread: true,
        maxThreads: 1,
        minThreads: 1,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared'),
      'object.assign': path.resolve(__dirname, './tests/mocks/object-assign.ts'),
    },
  },
});
