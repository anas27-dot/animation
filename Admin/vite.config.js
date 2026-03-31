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
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          ui: ['@headlessui/react', 'lucide-react'],
          utils: ['axios', 'file-saver', 'react-toastify']
        }
      }
    }
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
