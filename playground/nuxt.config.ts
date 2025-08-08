export default defineNuxtConfig({
  modules: ['../src/module'],
  devtools: { enabled: true },
  caddy: {
    hostnames: ['nuxt-caddy', 'nuxt-caddy-dev'],
  },
})
