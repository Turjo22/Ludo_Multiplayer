import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@ludo/shared-types': path.resolve(__dirname, './packages/shared-types/src/index.ts'),
      '@ludo/validation': path.resolve(__dirname, './packages/validation/src/index.ts'),
      '@ludo/game-rules': path.resolve(__dirname, './packages/game-rules/src/index.ts'),
    },
  },
});
