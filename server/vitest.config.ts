import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    env: {
      JWT_SECRET: process.env.JWT_SECRET || 'test-jwt-secret-do-not-use-in-production-ok',
      JWT_REFRESH_SECRET:
        process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-do-not-use-in-prod-ok',
    },
  },
});
