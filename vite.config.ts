import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Precaches the built app shell so the app loads with no network.
    // API calls are never cached. Only active in a production build.
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, // login-background.jpg is large
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/platform\//, /^\/actuator\//],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': { target: process.env.BACKEND_PROXY_TARGET ?? 'http://localhost:8082', changeOrigin: true },
      '/platform': {
        target: process.env.BACKEND_PROXY_TARGET ?? 'http://localhost:8082',
        changeOrigin: true,
        // `/platform/login` is a frontend route too. Serve the SPA for browser
        // navigations while proxying fetch/API requests to the backend.
        bypass: (req) => {
          if (req.method === 'GET' && req.headers.accept?.includes('text/html')) {
            return '/index.html'
          }
        },
      },
      '/actuator': { target: process.env.BACKEND_PROXY_TARGET ?? 'http://localhost:8082', changeOrigin: true },
    },
  },
})
