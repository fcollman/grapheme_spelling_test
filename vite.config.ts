import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Everything must end up inside one index.html: Chrome blocks fetch/ES modules/JSON
// over file://, and the teacher opens the app by double-clicking it.
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    // The espeak-ng bundle is ~1.3MB on its own; the warning is expected and fine.
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
})
