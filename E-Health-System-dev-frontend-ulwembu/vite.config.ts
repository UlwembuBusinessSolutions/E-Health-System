import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    // Local development runs Vite on 5173 and the API on 8081. Keep the
    // browser's same-origin API calls working when VITE_API_BASE_URL is unset.
    proxy: {
      // `/platform` is both the platform console's SPA route and the API
      // prefix. Let browser document navigations reach Vite's SPA fallback;
      // proxy only the JSON/API requests (such as `/platform/auth/login`).
      '/platform': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8081',
        bypass: (req) =>
          req.headers.accept?.includes('text/html') ? '/index.html' : undefined,
      },
      '/api': process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8081',
    },
  },
})
