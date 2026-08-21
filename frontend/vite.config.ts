/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Project page, not a user page: the site lives at
  // https://tyler-burns.github.io/Fantasy-Football-Draft-Tool/ , so every
  // emitted asset URL and import.meta.env.BASE_URL must carry that prefix.
  // Deliberately unconditional -- dev, preview, build, and CI all resolve
  // the same value, so a base-path bug can't hide in one command and only
  // appear in another (Vite's redirect middleware makes this work for
  // `npm run dev` and `npm run preview` too, not just `build`).
  base: '/Fantasy-Football-Draft-Tool/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
