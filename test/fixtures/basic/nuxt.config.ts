import CaddyModule from '../../../src/module'

export default defineNuxtConfig({
  modules: [
    CaddyModule,
  ],
  caddy: {
    hostnames: ['nuxt-caddy', 'nuxt-caddy-dev'],
  },
})
