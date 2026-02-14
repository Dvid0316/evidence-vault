import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/records': 'http://localhost:3001',
      '/users': 'http://localhost:3001',
      '/attachments': 'http://localhost:3001',
      '/exhibits': 'http://localhost:3001',
      '/cases': 'http://localhost:3001',
      '/tags': 'http://localhost:3001',
      '/dashboard': 'http://localhost:3001',
      '/share': 'http://localhost:3001',
      '/shares': 'http://localhost:3001',
      '/auth': 'http://localhost:3001',
      '/__routes': 'http://localhost:3001',
    },
  },
})
