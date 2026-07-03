import { defineConfig } from 'vitest/config';
import path from 'node:path';
import swc from 'unplugin-swc';

export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
  resolve: {
    alias: {
      '@split/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
    extensions: ['.ts', '.js', '.json'],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
