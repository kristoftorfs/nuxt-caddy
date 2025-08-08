import { defineNuxtModule } from '@nuxt/kit'
import { Caddy } from './caddy'
import { type ProjectConfiguration, projectSchema } from './schemas/project'

export default defineNuxtModule<ProjectConfiguration>({
  meta: {
    name: 'nuxt-caddy',
    configKey: 'caddy',
  },
  async setup(_options, _nuxt) {
    if ('production' === process.env.NODE_ENV) {
      return
    }

    const options = projectSchema.parse(_options)
    let caddy: Caddy

    _nuxt.hook('close', async () => {
      if (!caddy) {
        return
      }

      await caddy.down()
    })

    _nuxt.hook('listen', async (_server, listener) => {
      const port = listener.address.port
      caddy = new Caddy(Number(port))
      await caddy.launch(options)

      // FIXME: find a better way to detect the dev server going down
      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(true)
        process.stdin.resume()
        process.stdin.setEncoding('utf8')

        process.stdin.on('data', (key: string) => {
          // Ctrl+C detection
          if (key === '\u0003') {
            _nuxt.close().then(() => {
              process.exit(0)
            })
          }
        })
      }
    })
  },
})
