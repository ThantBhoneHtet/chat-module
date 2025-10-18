import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import tailwindcss from '@tailwindcss/postcss'
import autoprefixer from 'autoprefixer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/shared/lib/utils': path.resolve(__dirname, './src/lib/utils.js'),
      '@/shared/components/ui': path.resolve(__dirname, './src/components/chat/ui'),
      '@/shared/hooks': path.resolve(__dirname, './src/hooks'),
    },
  },
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  },
  server: {
    port: 8080,
  },
})
