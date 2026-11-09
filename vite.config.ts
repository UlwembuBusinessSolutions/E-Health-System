import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

// The README's default Docker Compose setup publishes the API on 8081.
// Override this for a native backend or a different local API address.
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:8082'

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
    // The API client uses relative paths by default. Proxy those requests to
    // the local Spring server so browser requests from :5173 reach the backend
    // on the local backend without needing a separate API base URL.
    proxy: {
      '/api': { target: apiProxyTarget, changeOrigin: true },
      // `/platform/*` is shared by SPA routes and platform API endpoints.
      // Browser page navigations request HTML; let Vite serve the SPA for
      // those requests, while fetch() API calls continue to reach Spring.
      '/platform': {
        target: apiProxyTarget,
        changeOrigin: true,
        bypass: (req) => req.headers.accept?.includes('text/html') ? req.url : undefined,
      },
      '/actuator': apiProxyTarget,
    },
  },
})
