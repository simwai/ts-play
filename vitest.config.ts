import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    browser: {
      enabled: true,
      instances: [
        {
          browser: 'chromium',
          provider: playwright({
            launchOptions: {
              args: ['--no-sandbox', '--disable-setuid-sandbox', '--headless=new'],
            },
          }),
        },
      ],
    },
    include: ['src/**/*.test.ts', 'e2e/**/*.spec.ts'],
    exclude: ['**/node_modules/**'],
  },
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
})
