import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Load environment variables from .env, .env.local, .env.[mode], .env.[mode].local
    const env = loadEnv(mode, process.cwd(), '');
    
    // Get API key from environment, with fallback
    const apiKey = env.GEMINI_API_KEY || env.API_KEY || '';
    
    return {
      base: './',
      server: {
        port: 3000,
        host: '0.0.0.0',
        watch: {
          ignored: ['**/release/**', '**/dist/**', '**/backend/venv/**', '**/backend/__pycache__/**']
        },
        proxy: {
          '/api': {
            target: 'http://localhost:8000',
            changeOrigin: true,
            ws: true,
            rewrite: (p) => p.replace(/^\/api/, '') || '/',
          },
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(apiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(apiKey)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        outDir: 'dist',
        assetsDir: 'assets',
        rollupOptions: {
          output: {
            manualChunks: undefined
          }
        }
      }
    };
});
