import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// `--mode artifact` builds one self-contained page (no service worker, no code splitting)
// for publishing as a claude.ai artifact; see scripts/build-artifact.mjs.
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    mode !== 'artifact' && VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'I Could Eat a Horse Games',
        short_name: 'ICEHG',
        description: 'A battle simulator for you and your friends.',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        background_color: '#0b0d12',
        theme_color: '#0b0d12',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  server: { host: true },
  build: mode === 'artifact' ? { outDir: 'dist-artifact', rolldownOptions: { output: { inlineDynamicImports: true } } } : {},
}));
