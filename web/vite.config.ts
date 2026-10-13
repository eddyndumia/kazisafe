import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // BASE_PATH=/kazisafe/ when building for a sub-path host like GitHub Pages.
  base: process.env.BASE_PATH ?? '/',
  define: { global: 'globalThis' },
  server: { proxy: { '/api': 'http://localhost:8787' } },
})
