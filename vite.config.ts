import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  build: {
    rollupOptions: {
      input: {
        overview: 'index.html',
        history: 'history.html',
        incident: 'incident.html',
      },
    },
  },
});
