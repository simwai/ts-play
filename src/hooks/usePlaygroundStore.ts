import { useEffect, useState } from 'react'
import { type PlaygroundState, playgroundStore } from '../lib/state-manager'

export function usePlaygroundStore() {
  const [state, setState] = useState<PlaygroundState>(playgroundStore.getState())

  useEffect(() => {
    return () => playgroundStore.subscribe(setState)()
  }, [])

  return state
}
