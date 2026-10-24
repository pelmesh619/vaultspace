import { defineConfig } from 'vite';

// Used only by the local dev server (npm run dev).
// By default it goes through the frontend container from docker compose,
// which already proxies /api to the api service.
const API_PROXY_TARGET =
  process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8080';

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
