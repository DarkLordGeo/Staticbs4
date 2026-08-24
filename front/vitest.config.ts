import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts on purpose: the app's Tailwind/React plugins
// aren't needed to unit-test the plain-TS logic in src/lib, and pulling them
// in just adds startup cost. jsdom is needed though — selector.ts/extract.ts
// operate on real DOM APIs (Element, document, CSS.escape).
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
