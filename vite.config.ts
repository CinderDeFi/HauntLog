import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'

// Source-map upload is OPT-IN: it only runs when SENTRY_AUTH_TOKEN is present
// (CI / your deploy env), so ordinary `npm run build` is completely unaffected
// and never emits source maps into dist. When enabled, the plugin uploads maps
// to Sentry and deletes them from the build so they don't ship publicly.
const uploadSourceMaps = !!process.env.SENTRY_AUTH_TOKEN

export default defineConfig({
  plugins: [
    react(),
    ...(uploadSourceMaps
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            authToken: process.env.SENTRY_AUTH_TOKEN,
            release: { name: process.env.VITE_APP_RELEASE },
          }),
        ]
      : []),
  ],
  build: {
    // Only emit source maps when we're going to upload+delete them.
    sourcemap: uploadSourceMaps,
    rollupOptions: {
      output: {
        // Split heavy, independently-cacheable vendor libraries into their own
        // chunks. Leaflet only rides along when the Atlas route is opened;
        // pulling it out of the main bundle is the single biggest win. The
        // others (supabase, react runtime, date-fns, icons) change far less
        // often than app code, so isolating them keeps them warm in the cache
        // across deploys.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('leaflet')) return 'leaflet'
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('date-fns')) return 'date-fns'
          // lucide-react is intentionally NOT grouped: per-icon tree-shaking
          // keeps each route's chunk carrying only the handful it renders,
          // so the landing page never downloads the whole icon set.
          if (
            id.includes('react-router') ||
            id.includes('react-dom') ||
            id.includes('/react/') ||
            id.includes('scheduler') ||
            id.includes('zustand')
          ) {
            return 'react-vendor'
          }
        },
      },
    },
  },
})
