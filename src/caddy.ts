import { x } from 'tinyexec'
import { type CaddyEntry, Configurator } from './caddy/configurator'
import type { ProjectConfiguration } from './schemas/project'
import type { CaddyConfiguration } from './schemas/caddy'
import { consola, type ConsolaInstance } from 'consola'
import chalk, { type ChalkInstance } from 'chalk'
import { homedir } from 'node:os'
import _ from 'lodash'
import terminalLink from 'terminal-link'

interface FetchResult {
  response: Response
  action: 'created' | 'updated' | 'deleted' | 'skipped'
}

export class Caddy {
  private readonly configurator: Configurator
  private readonly config: CaddyConfiguration
  private readonly apiUrl: string
  private readonly adminAddress: string
  private readonly console: ConsolaInstance

  constructor(private devPort: number) {
    this.configurator = new Configurator(this.path().concat('caddy.json'))
    this.config = this.configurator.get()
    this.apiUrl = `http://localhost:${this.config.port}`
    this.adminAddress = `localhost:${this.config.port}`
    this.console = consola.withTag('caddy')
  }

  private path(): string {
    return homedir().concat('/.nuxt/')
  }

  async spawn(): Promise<boolean> {
    if (await this.isUp()) {
      this.console.info(`Caddy server is already running on port ${chalk.yellow(this.config.port)}`)
      return true
    }

    this.console.start('Caddy is not running, launching with admin port set to ' + chalk.yellow(this.config.port) + '...')

    return new Promise<boolean>((resolve, reject) => {
      // FIXME: ensure that the directory exists
      const pidFile = this.path().concat('caddy.pid')

      try {
        const instance = x(__dirname.concat('/../examples/caddy'), ['run', '--pidfile', pidFile], {
          persist: true,
          nodeOptions: {
            stdio: 'pipe',
            detached: false,
            env: {
              CADDY_ADMIN: this.adminAddress,
            },
          },
        })

        instance.process?.stderr?.on('data', (data) => {
          data.toString().split('\n').forEach((line: string) => {
            if (line.length === 0) {
              return
            }

            try {
              const json = JSON.parse(line)
              if (json.msg && json.msg === 'serving initial configuration') {
                this.console.ready('Caddy server launched')
                resolve(true)
              }
            }
            catch {
              // Ignore JSON parsing errors
            }
          })
        })

        instance.process?.on('error', (error) => {
          reject(error)
        })

        // Optional: Add exit handling
        instance.process?.on('exit', (code) => {
          if (code !== 0) {
            reject(new Error(`Caddy exited with code ${code}`))
          }
        })
      }
      catch (error) {
        reject(error)
      }
    })
  }

  private async exists(path: string): Promise<boolean> {
    try {
      const response = await fetch(this.apiUrl.concat(path))

      return response.ok
    }
    catch {
      return false
    }
  }

  async isUp(): Promise<boolean> {
    return this.exists('/config')
  }

  private async fetch(entry: CaddyEntry) {
    const promise = new Promise<FetchResult>((resolve, reject) => {
      try {
        const check = new Promise<boolean>((resolveCheck) => {
          entry.json = entry.json || {}

          if (entry.method === 'DELETE') {
            resolveCheck(false)
            return
          }

          fetch(this.apiUrl.concat('/id/'.concat(entry.update?.id || entry.id))).then((response) => {
            if (!response.ok) {
              // The id does not exist yet, safe to continue
              resolveCheck(false)
            }
            else {
              response.text().then((body) => {
                const current = JSON.parse(body)
                const replacement = entry.update?.json || entry.json
                if (_.isEqual(current, replacement)) {
                  // Exists but has not changed
                  resolve({ response, action: 'skipped' })
                }
                else {
                  // Exists and has changed, we need to update
                  resolveCheck(true)
                }
              })
            }
          })
        })

        check.then((replace: boolean) => {
          const id = entry.update?.id || entry.id
          const json = replace ? entry.update?.json || entry.json : entry.json
          const target = replace ? '/id/'.concat(id) : entry.target
          const method = replace ? 'PATCH' : entry.method

          const body = JSON.stringify(json)
          const url = this.apiUrl.concat(target)
          fetch(url, {
            method,
            headers: {
              'Content-Type': 'application/json',
            },
            body: body,
          })
            .then((response) => {
              if (!response.ok) {
                if (response.status === 404 && entry.method === 'DELETE') {
                  resolve({ response, action: 'deleted' })
                  return
                }

                response.text().then((body) => {
                  reject(new Error(`Unable to ${method} ${target}: ${response.status} ${response.statusText}\n: ${body}`))
                }).catch((error) => {
                  reject(error)
                })
              }
              else {
                const action = method === 'DELETE' ? 'deleted' : replace ? 'updated' : 'created'
                resolve({ response, action })
              }
            })
            .catch((error) => {
              reject(error)
            })
        })
      }
      catch (error) {
        reject(error)
      }
    })

    promise.catch((error: Error) => {
      this.console.box({
        title: 'Configuring Caddy failed',
        style: {
          borderColor: 'red',
          borderStyle: 'rounded',
        },
        message: [
          `${entry.method} ${entry.target}`,
          `${error.message}`,
          `${error.cause}`,
          `${error.stack}`,
        ].join('\n'),
      })
      process.exit(1)
    })

    return promise
  }

  private chalkify(template: string) {
    return template.replace(/<(\w+)>(.*?)<\/\1>/g, (_match, color: keyof ChalkInstance, content) => {
      if (chalk[color] && typeof chalk[color] === 'function') {
        return (chalk[color] as (text: string) => string)(content)
      }
      return content
    })
  }

  private speak(message: string, initialVerbOrResult?: FetchResult | string) {
    const result = typeof initialVerbOrResult === 'string' ? undefined : initialVerbOrResult

    let verb = typeof initialVerbOrResult === 'string' ? initialVerbOrResult : 'Creating'
    let suffix = '...'
    let method = this.console.start
    let icon: string | undefined = undefined

    if (result) {
      verb = result.action.charAt(0).toUpperCase() + result.action.slice(1)
      method = this.console.ready
      suffix = ''
    }

    switch (result?.action) {
      case 'created':
        break
      case 'updated':
        icon = '<green>↻</green>'
        method = this.console.log
        break
      case 'deleted':
        method = this.console.fail
        break
      case 'skipped':
        method = this.console.info
        suffix = ', already present'
        break
    }

    const output = `${icon ? icon.concat(' ') : ''}${verb} ${message}${suffix}`
    method(this.chalkify(output))
  }

  private async verboseFetch(message: string, entry: CaddyEntry): Promise<FetchResult> {
    const verb = entry.method === 'DELETE' ? 'Deleting' : undefined
    this.speak(message, verb)
    const result = this.fetch(entry)
    result.then((result) => {
      this.speak(message, result)
    })
    return result
  }

  async launch(project: ProjectConfiguration) {
    this.spawn()
      .then(() => {
        this.verboseFetch(
          `<cyan>server</cyan> for <green>wildcard domain</green> <yellow>${'*.'.concat(this.config.domain)}</yellow>`,
          this.configurator.server(this.config.domain))
          .then(() => {
            this.verboseFetch(
              `<cyan>TLS settings</cyan> for <green>wildcard domain</green> <yellow>${'*.'.concat(this.config.domain)}</yellow> and <green>provider</green> <yellow>${this.config.provider.name}</yellow>`,
              this.configurator.tls(this.config.domain, this.config.provider))
              .then(() => {
                this.verboseFetch(
                  `<cyan>reverse proxies</cyan> for <green>wildcard domain</green> <yellow>${'*.'.concat(this.config.domain)}</yellow>`,
                  this.configurator.hostnames(project.hostnames, this.config.domain, this.devPort))
                  .then((result) => {
                    project.hostnames?.forEach((hostname) => {
                      const url = `https://${hostname.concat('.').concat(this.config.domain)}`
                      const message = `<cyan>reverse proxy</cyan> for <yellow>${terminalLink(url, url)}</yellow> to <green>port</green> <yellow>${this.devPort}</yellow>`
                      this.speak(message, result)
                    })

                    this.console.ready(this.chalkify('Caddy configuration complete'))
                  })
              })
          })
      })
      .catch((error) => {
        this.console.fail('Unable to launch Caddy server', error)
        process.exit(1)
      })
  }

  async down() {
    const message = `<cyan>reverse proxies</cyan> to <green>port</green> <yellow>${this.devPort}</yellow>...`
    await this.verboseFetch(message, this.configurator.down(this.devPort))
    // TODO: check if we can delete our server or even stop Caddy completely
  }
}
