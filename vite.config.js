import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'assets/**/*.png', 'assets/**/*.mp3'],
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,mp3,webp,jpg,jpeg,gif,woff,woff2}'],
        globIgnores: ['**/assets/intro.mp4', '**/assets/intro.mkv', '**/assets/videos/**'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/images\.igdb\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'igdb-images',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          },
          {
            urlPattern: /\.(mp4|mkv|webm)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'media',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 7 }
            }
          }
        ]
      }
    })
  ],
  base: process.env.ELECTRON ? './' : '/',
})
