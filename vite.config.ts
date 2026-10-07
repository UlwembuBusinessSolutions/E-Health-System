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
  },
})

// https://vite.dev/config/
// export default defineConfig({
//   plugins: [react(), tailwindcss()],
//   resolve: {
//     alias: {
//       '@': path.resolve(__dirname, './src'),
//     },
//   },
//   server: {
//     port: 5173,
//   },
// })

// VitePWA({
//   registerType: "autoUpdate",
//   manifest: false, // add a manifest + icons later if you want "install to home screen"
//   workbox: {
//     globPatterns: ["**/*.{js,css,html,svg,png,jpg,woff2}"],
//     maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, // login-background.jpg is large
//     navigateFallback: "/index.html",
//     navigateFallbackDenylist: [/^\/api\//, /^\/platform\//, /^\/actuator\//],
//   },
// })
