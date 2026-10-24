import { defineConfig } from 'vite';

// Used only by the local dev server (npm run dev).
// Inside Docker, nginx proxies /api to the api service instead.
const API_PROXY_TARGET = process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8000';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: API_PROXY_TARGET,
        changeOrigin: true,
      },
      '/health': {
        target: API_PROXY_TARGET,
        changeOrigin: true,
      },
    },
  },
});
