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

    nitro: {
        prerender: {
            routes: ['/', '/chat', '/config', '/jobs']
        }
    },

    compatibilityDate: '2025-01-15',

    eslint: {
        config: {
            stylistic: {
                commaDangle: 'never',
                braceStyle: '1tbs'
            }
        }
    }
})
