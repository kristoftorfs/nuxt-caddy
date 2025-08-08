import { existsSync, readFileSync } from 'node:fs'
import { type CaddyConfiguration, caddySchema } from '../schemas/caddy'
import type { Provider } from '../schemas/providers'

export type CaddyEntry = {
  target: string
  method: string
  id: string
  json: object
  update?: {
    id: string
    json: object
  }
}

export class Configurator {
  constructor(private readonly path: string) {
  }

  private has(): boolean {
    return existsSync(this.path)
  }

  private hostnameId(devPort: number): string {
    return `nuxt-hostname-${devPort}`
  }

  get(): CaddyConfiguration {
    if (!this.has()) {
      // FIXME: Add interactive setup
      throw new Error(`No Caddy configuration found at ${this.path}.`)
    }
    else {
      return caddySchema.parse(JSON.parse(readFileSync(this.path).toString()))
    }
  }

  server(domain: string): CaddyEntry {
    return {
      id: 'nuxt-server',
      target: '/config/apps/http/servers/nuxt',
      method: 'PUT',
      json: {
        '@id': 'nuxt-server',
        'listen': [':443'],
        'routes': [
          {
            match: [
              {
                '@id': 'nuxt-wildcard-match',
                'host': [`*.${domain}`],
              },
            ],
            handle: [
              {
                '@id': 'nuxt-wildcard-routes',
                'handler': 'subroute',
                'routes': [],
              },
              {
                body: 'Nuxt project "{http.request.host}" appears to be down.',
                handler: 'static_response',
                status_code: 404,
              },
            ],
            terminal: true,
          },
        ],
      },
      update: {
        id: 'nuxt-wildcard-match',
        json: {
          '@id': 'nuxt-wildcard-match',
          'host': [`*.${domain}`],
        },
      },
    }
  }

  tls(domain: string, provider: Provider): CaddyEntry {
    return {
      id: 'nuxt-wildcard-tls',
      target: '/config/apps/tls/automation/policies',
      method: 'PUT',
      json: [{
        '@id': 'nuxt-wildcard-tls',
        'subjects': [`*.${domain}`],
        'issuers': [
          {
            module: 'acme',
            challenges: {
              dns: {
                provider,
              },
            },
          },
        ],
      }],
      update: {
        id: 'nuxt-wildcard-tls',
        json: {
          '@id': 'nuxt-wildcard-tls',
          'subjects': [`*.${domain}`],
          'issuers': [
            {
              module: 'acme',
              challenges: {
                dns: {
                  provider: provider,
                },
              },
            },
          ],
        },
      },
    }
  }

  hostnames(subdomains: string[], domain: string, devPort: number): CaddyEntry {
    const id = this.hostnameId(devPort)
    const hosts = subdomains.map((subdomain) => {
      return {
        host: [subdomain.concat('.').concat(domain)],
      }
    })

    return {
      id,
      target: '/id/nuxt-wildcard-routes/routes/0',
      method: 'PUT',
      json: {
        '@id': id,
        'handle': [{
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
              dial: 'localhost:'.concat(devPort.toString()),
            },
          ],
        }],
        'match': hosts,
      },
    }
  }

  down(devPort: number): CaddyEntry {
    const id = this.hostnameId(devPort)

    return {
      id,
      target: '/id/'.concat(id),
      method: 'DELETE',
      json: {},
    }
  }
}
