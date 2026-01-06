import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      '/socket.io': {
        target: 'http://127.0.0.1:8083',
        ws: true,
      },
      '/font': {
        target: 'http://127.0.0.1:8083',
      }
    },
  },
});
