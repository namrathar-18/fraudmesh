import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Project is served from https://namrathar-18.github.io/fraudmesh/
export default defineConfig({
  plugins: [react()],
  base: '/fraudmesh/',
  server: {
    host: true,
    port: Number(process.env.PORT) || 5173,
  },
})
