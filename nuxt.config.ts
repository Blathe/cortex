// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  routeRules: {
    '/': { prerender: true },
    '/chat': { prerender: true },
    '/config': { prerender: true },
    '/jobs': { prerender: true }
  },

  compatibilityDate: '2025-01-15',

  nitro: {
    prerender: {
      routes: ['/', '/chat', '/config', '/jobs']
    },
    typescript: {
      tsConfig: {
        compilerOptions: {
          types: ['node']
        }
      }
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
