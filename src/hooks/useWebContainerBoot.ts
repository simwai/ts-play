import { useEffect } from 'react'
import { getWebContainer } from '../lib/webcontainer'

export function useWebContainerBoot() {
  useEffect(() => {
    ;(async () => {
      try {
        const instance = await getWebContainer()
        try {
          await instance.fs.readFile('package.json', 'utf8')
        } catch {
          await instance.fs.writeFile(
            'package.json',
            JSON.stringify(
              { name: 'playground-project', dependencies: {} },
              null,
              2
            )
          )
        }
      } catch {
        // Boot can be cancelled during StrictMode double-mount or HMR teardown.
        // Intentionally silent — not a user-facing error.
      }
    })()
  }, [])
}
