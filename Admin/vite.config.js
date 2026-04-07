import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('react-router')) return 'router';
          if (id.includes('@headlessui') || id.includes('lucide-react')) return 'ui';
          if (id.includes('axios') || id.includes('file-saver') || id.includes('react-toastify')) {
            return 'utils';
          }
          if (id.includes('react-dom') || /node_modules\/react\//.test(id)) return 'vendor';
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    port: 5174,
    // Do not set COEP require-corp here: it blocks cross-origin images (e.g. URL preview,
    // chat background) unless every host sends Cross-Origin-Resource-Policy. Only re-enable
    // if you need SharedArrayBuffer and are willing to proxy or CORP all subresources.
  }
})
