import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
    base: './',
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['pwa-192x192.png', 'pwa-512x512.png', 'apple-touch-icon.png'],
            manifest: {
                name: 'Space Defender Impact',
                short_name: 'Space Defense',
                description: 'Deploy warships, defend Earth, and break alien fleets across shifting space lanes.',
                theme_color: '#050816',
                background_color: '#050816',
                display: 'standalone',
                orientation: 'any',
                scope: '.',
                start_url: '.',
                icons: [
                    {
                        src: 'pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png',
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable',
                    },
                ],
            },
            workbox: {
                cleanupOutdatedCaches: true,
                clientsClaim: true,
                skipWaiting: true,
                runtimeCaching: [
                    {
                        urlPattern: function (_a) {
                            var request = _a.request, url = _a.url;
                            return request.destination === 'audio' || url.pathname.includes('/audio/');
                        },
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'space-defender-audio-v1',
                            expiration: {
                                maxEntries: 32,
                                maxAgeSeconds: 60 * 60 * 24 * 30,
                            },
                            cacheableResponse: {
                                statuses: [0, 200],
                            },
                        },
                    },
                ],
            },
            devOptions: {
                enabled: true,
            },
        }),
    ],
    server: {
        host: true,
        port: 5173,
    },
});
