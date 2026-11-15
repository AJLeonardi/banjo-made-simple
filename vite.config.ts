import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

// Version = number of commits, so it goes up by one with every commit.
function version(command: string): string {
  try {
    const n = execSync('git rev-list --count HEAD').toString().trim();
    return command === 'build' ? `v${n}` : `v${n}-dev`;
  } catch {
    return 'dev';
  }
}

// GitHub Pages serves the app from /banjo-made-simple/ (override with BASE_PATH for other hosts).
export default defineConfig(({ command, mode }) => ({
  base: command === 'build' ? process.env.BASE_PATH ?? '/banjo-made-simple/' : '/',
  define: { __APP_VERSION__: JSON.stringify(version(command)) },
  plugins: [
    react(),
    // Phones only allow the mic over https; `npm run dev:https` serves a self-signed cert on the LAN.
    mode === 'https' && basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Narration clips: cached as they're first played, so lessons work offline after.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/voice/') && url.pathname.endsWith('.mp3'),
            handler: 'CacheFirst',
            options: { cacheName: 'narration', expiration: { maxEntries: 400 }, rangeRequests: true },
          },
        ],
      },
      manifest: {
        name: 'Banjo Made Simple',
        short_name: 'Banjo Simple',
        description: 'Learn 5-string banjo: it listens to you play and shows you where your fingers go.',
        theme_color: '#2a1a10',
        background_color: '#2a1a10',
        display: 'standalone',
        orientation: 'any',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  test: { include: ['test/**/*.test.ts'] },
}));
