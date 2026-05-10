import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            injectRegister: 'auto',
            includeAssets: [
                'favicon.ico',
                'apple-touch-icon.png',
                'robots.txt',
            ],
            manifest: {
                id: '/',
                name: 'Space Impact Defense',
                short_name: 'SID',
                description: 'Deploy warships, defend Earth, and destroy alien fleets in this arcade sci-fi defense game.',
                theme_color: '#020617',
                background_color: '#020617',
                display: 'standalone',
                orientation: 'landscape',
                scope: '/',
                start_url: '/',
                lang: 'en',
                categories: ['games', 'arcade', 'action'],
                icons: [
                    {
                        src: '/pwa-192.png',
                        sizes: '192x192',
                        type: 'image/png',
                    },
                    {
                        src: '/pwa-512.png',
                        sizes: '512x512',
                        type: 'image/png',
                    },
                    {
                        src: '/pwa-512.png',
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
                globPatterns: [
                    '**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,mp3,wav,ogg}',
                ],
                runtimeCaching: [
                    {
                        urlPattern: function (_a) {
                            var request = _a.request;
                            return request.destination === 'image';
                        },
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'game-images',
                            expiration: {
                                maxEntries: 200,
                                maxAgeSeconds: 60 * 60 * 24 * 30,
                            },
                        },
                    },
                    {
                        urlPattern: function (_a) {
                            var request = _a.request;
                            return request.destination === 'audio';
                        },
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'game-audio',
                            expiration: {
                                maxEntries: 50,
                                maxAgeSeconds: 60 * 60 * 24 * 30,
                            },
                        },
                    },
                    {
                        urlPattern: function (_a) {
                            var request = _a.request;
                            return request.destination === 'script' ||
                                request.destination === 'style';
                        },
                        handler: 'StaleWhileRevalidate',
                        options: {
                            cacheName: 'game-assets',
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
