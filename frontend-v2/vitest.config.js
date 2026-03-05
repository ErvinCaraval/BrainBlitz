import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
    include: ['src/**/*.test.{js,jsx,ts,tsx}', 'src/**/__tests__/**/*.test.{js,jsx,ts,tsx}'],
    exclude: ['src/**/__tests__/testUtils.jsx', 'src/**/__tests__/mocks.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      all: true,
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      exclude: ['src/main.jsx', 'src/App.jsx', 'src/routes.jsx', 'src/services/**', 'src/**/index.{js,ts}', '**/*.css', '**/*.md'],
      statements: 95,
      branches: 90,
      functions: 95,
      lines: 95,
    }
  }
})
