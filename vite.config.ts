import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Parse environment variables for build configuration
const isMinified = process.env.IS_MINIFIED !== 'false' && process.env.IS_MINIFIED !== '0'
const isSourceMapped = process.env.IS_SOURCE_MAPPED === 'true' || process.env.IS_SOURCE_MAPPED === '1'

// Custom plugin to forcefully set COOP/COEP headers for all requests in dev/preview
const crossOriginIsolation = () => ({
  name: 'cross-origin-isolation',
  configureServer(server: any) {
    server.middlewares.use((_request: any, res: any, next: any) => {
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
      next()
    })
  },
  configurePreviewServer(server: any) {
    server.middlewares.use((_request: any, res: any, next: any) => {
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
      next()
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile(), crossOriginIsolation()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  build: {
    minify: isMinified,
    sourcemap: isSourceMapped,
  },
})
