import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  server: {
    port: 3000,
    // Allow ngrok (and other tunnels) to hit the Vite dev server.
    // Fixes: "Blocked request. This host (...) is not allowed."
    allowedHosts: true,
    proxy: {
      // Proxy WebSocket to Cloudflare Workers dev server (wrangler)
      '/room': {
        target: 'ws://127.0.0.1:8787',
        ws: true,
        changeOrigin: true,
      },
      '/font': {
        target: 'http://127.0.0.1:8787',
      },
      '/api': {
        target: 'http://127.0.0.1:8787',
      },
      '/health': {
        target: 'http://127.0.0.1:8787',
      }
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
