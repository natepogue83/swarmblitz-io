import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    // Allow ngrok (and other tunnels) to hit the Vite dev server.
    // Fixes: "Blocked request. This host (...) is not allowed."
    allowedHosts: true,
    proxy: {
      '/ws': {
        target: 'ws://127.0.0.1:8083',
        ws: true,
      },
      '/font': {
        target: 'http://127.0.0.1:8083',
      },
      '/api': {
        target: 'http://127.0.0.1:8083',
      }
    },
  },
});
