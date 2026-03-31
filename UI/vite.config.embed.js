import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Vite configuration for building the embed bundle
export default defineConfig({
    plugins: [react()],
    build: {
        // Output to a specific directory for the embed bundle
        outDir: 'dist-embed',
        // Build as a library (single bundle)
        lib: {
            entry: resolve(__dirname, 'src/embed.jsx'),
            name: 'OmniAgentChatbot',
            // Output as IIFE (Immediately Invoked Function Expression) for browser script tag usage
            formats: ['iife'],
            fileName: () => 'chatbot-fullscreen-bundle.js',
        },
        rollupOptions: {
            // No external dependencies - bundle everything
            external: [],
            output: {
                // Ensure all styles are bundled into a single CSS file
                assetFileNames: (assetInfo) => {
                    if (assetInfo.name === 'style.css') {
                        return 'chatbot-fullscreen-bundle.css';
                    }
                    return assetInfo.name;
                },
                // Global variable name when loaded via script tag
                globals: {},
            },
        },
        // Don't minify for easier debugging (can be enabled in production)
        minify: true,
        // Generate source maps for debugging
        sourcemap: false,
    },
    // Define environment variables for the embed build
    define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
    },
})
