import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    optimizeDeps: {
      // The erasure-coding packages locate their WebAssembly with
      // `new URL('./clay.wasm', import.meta.url)`. Pre-bundling rewrites that URL into
      // .vite/deps, where the .wasm was never copied, so the fetch lands on the SPA fallback
      // and WebAssembly.compile receives HTML. Leaving these unbundled keeps each module beside
      // its own asset.
      //
      // Only these two are excluded: the SDK itself must stay pre-bundled, because unbundled it
      // loses the CommonJS interop its own dependencies rely on for named exports.
      exclude: ['@shelby-protocol/clay-codes', '@shelby-protocol/reed-solomon'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
