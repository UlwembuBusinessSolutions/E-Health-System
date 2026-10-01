import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { pharmacyConcurrency } from './dev/pharmacyConcurrency.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), pharmacyConcurrency()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
  },
})
