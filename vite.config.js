import { defineConfig } from 'vite';

// Build step for the front-end. Each src/*.js references import.meta.env.VITE_*;
// `vite build` inlines those values (from .env) into the compiled bundle in dist/.
// This is injection path P4: the secret is NOT in source, it enters at build time.
export default defineConfig({
    build: {
        outDir:      'dist',
        emptyOutDir: true,
        // keep output readable so the inlined secrets are visible in evidence/screenshots
        minify:      false,
        rollupOptions: {
            input: {
                config:   'src/config.js',
                env:      'src/env.js',
                firebase: 'src/firebase.js',
                app:      'src/app.js'
            },
            output: {
                format:         'es',
                entryFileNames: 'js/[name].js',
                chunkFileNames: 'js/[name].js',
                assetFileNames: 'assets/[name][extname]'
            }
        }
    }
});
