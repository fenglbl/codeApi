import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: '/admin/',
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 18180
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})
