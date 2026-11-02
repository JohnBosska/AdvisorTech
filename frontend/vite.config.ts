/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_DEV_API_TARGET || 'http://localhost:8000'
  return {
    plugins: [react(), tailwindcss()],
    server: { port: 5173, proxy: { '/api': target, '/health': target } },
    test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], globals: true },
  }
})
