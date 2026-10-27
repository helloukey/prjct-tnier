import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In dev, proxy /api to the FastAPI server so the browser sees a single origin (same as Vercel/Docker).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': process.env.VITE_API_PROXY ?? 'http://localhost:8000',
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // Vendor code changes far less often than app code: separate chunks keep browser caches warm.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 20 },
            { name: 'charts', test: /node_modules[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
})
