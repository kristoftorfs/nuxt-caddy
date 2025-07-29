import { defineNuxtModule } from '@nuxt/kit'

interface CaddyOptions {
  hostname?: string
  caddyAdminUrl?: string
}

interface CaddyServer {
  listen: string[]
}

export default defineNuxtModule<CaddyOptions>({
  meta: {
    name: 'nuxt-caddy',
    configKey: 'caddy',
  },
  defaults: {},
  setup(_options, _nuxt) {
    if ('production' === process.env.NODE_ENV) {
      return
    }

    const caddyAdminUrl = _options.caddyAdminUrl ?? process.env.CADDY_ADMIN_URL ?? 'http://localhost:2019'
    // FIXME: validate hostname
    const hostname = _options.hostname ?? process.env.CADDY_HOSTNAME
    const caddyId = `nuxt-caddy-route-${hostname}`

    const deleteConfig = async () => {
      try {
        const response = await fetch(caddyAdminUrl.concat(`/id/${caddyId}`), {
          method: 'DELETE',
        })

        // A 404 response is fine, our route did not exist yet
        if (!response.ok && response.status !== 404) {
          throw new Error('Unexpected response from Caddy server.')
        }

        return response
      }
      catch (error) {
        // Anything but 404
        console.warn(('Is your Caddy server running?'))
        throw error
      }
    }

    const putConfig = async (serverName: string, config: object) => {
      await fetch(caddyAdminUrl.concat(`/config/apps/http/servers/${serverName}/routes/0`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
    }

    process.on('exit', async () => {
      // FIXME: Remove the Caddy route
    })

    _nuxt.hook('listen', async (_server, listener) => {
      const port = listener.address.port

      const caddyConfig = {
        '@id': caddyId,
        'handle': [
          {
            handler: 'subroute',
            routes: [
              {
                handle: [
                  {
                    handler: 'reverse_proxy',
                    headers: {
                      request: {
                        set: {
                          Host: [
                            '{http.reverse_proxy.upstream.hostport}',
                          ],
                        },
                      },
                    },
                    upstreams: [
                      {
                        dial: 'localhost:'.concat(port.toString()),
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        'match': [
          {
            host: [
              hostname,
            ],
          },
        ],
      }

      await deleteConfig()
      const servers: { [k: string]: CaddyServer } = await fetch(caddyAdminUrl.concat('/config/apps/http/servers')).then(response => response.json())
      let matched = false

      Object.entries(servers).forEach(([serverName, server]) => {
        server.listen.forEach((listen) => {
          if (matched) {
            return
          }

          // FIXME: find a better way to match servers
          if (':443' === listen) {
            matched = true
            putConfig(serverName, caddyConfig)
            console.info(`Caddy config for https://${hostname} was created.`)
          }
        })
      })

      if (!matched) {
        // FIXME: Add the entire server block if !matched
        console.error(`No Caddy server found for port 443, unable to add route to your application.`)
      }
    })
  },
})
