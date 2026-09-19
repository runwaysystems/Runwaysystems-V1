import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { validatePublicBuildEnvironment } from './scripts/validate-public-env.mjs'

export default defineConfig(({ command, mode }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), '') }
  const productionDeployment = command === 'build'
    && (env.RUNWAY_PRODUCTION_BUILD === '1' || env.CF_PAGES === '1')
  validatePublicBuildEnvironment(env, { production: productionDeployment })

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      allowedHosts: true,
    },
    preview: {
      host: '0.0.0.0',
      allowedHosts: true,
    },
    build: {
      target: 'esnext',
      minify: 'esbuild',
      cssMinify: true,
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/three')) {
              return 'vendor-three'
            }
            if (id.includes('node_modules/gsap')) {
              return 'vendor-gsap'
            }
            if (id.includes('node_modules/lucide-react')) {
              return 'vendor-icons'
            }
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/react-router-dom/') ||
              id.includes('node_modules/scheduler/')
            ) {
              return 'vendor-react'
            }
          },
        },
      },
    },
  }
})
