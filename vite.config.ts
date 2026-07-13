import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// On Vercel the app is served from the domain root; on GitHub Pages it lives
// under /fraudmesh/. Vercel sets the VERCEL env var during its build.
const base = process.env.VERCEL ? '/' : '/fraudmesh/'

export default defineConfig({
  plugins: [react()],
  base,
  server: {
    host: true,
    port: Number(process.env.PORT) || 5173,
  },
})
