import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    exclude: ['node_modules', 'dist', 'test', '**/*.e2e-spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.module.ts',
        'src/main.ts',
        '**/*.dto.ts',
        '**/*.entity.ts',
        '**/*.interface.ts',
        '**/*.guard.ts',
        'src/graphql/types/**',
        'src/gateway/types/**',
        'src/test-utils/**',
        'prisma/**',
        '**/*.spec.ts',
        '**/*.e2e-spec.ts',
      ],
    },
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});
