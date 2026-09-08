import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../../', '');
  const apiUrl = process.env.API_URL || env.API_URL || 'http://localhost:4000';

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: apiUrl,
          changeOrigin: true,
        },
        '/health': {
          target: apiUrl,
          changeOrigin: true,
        },
        '/uploads': {
          target: apiUrl,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 4173,
      strictPort: true,
    },
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'react-core',
                priority: 30,
                test: /node_modules[\\/](?:react|react-dom|scheduler)[\\/]/,
              },
              {
                name: 'routing-query',
                priority: 25,
                test: /node_modules[\\/](?:react-router|react-router-dom|@tanstack)[\\/]/,
              },
              {
                name: 'forms-validation',
                priority: 20,
                test: /node_modules[\\/](?:react-hook-form|@hookform|zod)[\\/]/,
              },
              {
                name: 'ui-vendor',
                priority: 15,
                test: /node_modules[\\/](?:motion|framer-motion|swiper|react-icons|sonner)[\\/]/,
              },
              {
                entriesAware: true,
                maxSize: 200_000,
                name: 'vendor',
                priority: 10,
                test: /node_modules[\\/]/,
              },
            ],
          },
        },
      },
      sourcemap: true,
      target: 'es2022',
    },
  };
});
