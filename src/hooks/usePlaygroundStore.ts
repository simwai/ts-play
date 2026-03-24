import { useState, useEffect } from 'react';
import { playgroundStore, type PlaygroundState } from '../lib/state-manager';

export function usePlaygroundStore() {
  const [state, setState] = useState<PlaygroundState>(playgroundStore.getState());

  useEffect(() => {
    return playgroundStore.subscribe(setState);
  }, []);

  return state;
}
