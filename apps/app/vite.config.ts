import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // só com DEV_API=1 (config "ikizy-app-dev-api" em .claude/launch.json, ou DEV_API=1 npm run dev): as rotas /api e a página pública vêm do servidor local (npm run dev:api, ligado à branch dev do Neon)
  server: process.env.DEV_API === '1' ? { proxy: { '/api': 'http://localhost:3001', '^/s/[a-z0-9-]+$': 'http://localhost:3001' } } : {},
})
