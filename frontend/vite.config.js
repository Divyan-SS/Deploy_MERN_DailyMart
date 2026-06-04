// frontend/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // Directs frontend axios dispatches cleanly into the local server layer to prevent CORS blocks
      '/api': {
        target: 'http://localhost:5001', // ✅ FIXED: Shifted from 5000 to 5001 to match your active node server
        changeOrigin: true,
      },
    },
  },
});