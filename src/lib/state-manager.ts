import { ThemeMode } from './theme';
import { CompilerStatus, EnvironmentStatus } from './webcontainer';
import type { PackageManagerStatus } from '../hooks/usePackageManager';

export interface PlaygroundState {
  lifecycle: EnvironmentStatus;
  tscStatus: CompilerStatus;
  parcelStatus: CompilerStatus;
  packageManagerStatus: PackageManagerStatus;
  theme: ThemeMode;
  lineWrap: boolean;
  trueColor: boolean;
  isReady: boolean;
}

type StateListener = (state: PlaygroundState) => void;

class PlaygroundStore {
  private state: PlaygroundState = {
    lifecycle: 'idle',
    tscStatus: 'Idle',
    parcelStatus: 'Idle',
    packageManagerStatus: 'idle',
    theme: (localStorage.getItem('tsplay_theme') as ThemeMode) || 'mocha',
    lineWrap: localStorage.getItem('tsplay_linewrap') === 'true',
    trueColor: localStorage.getItem('tsplay_truecolor') !== 'false',
    isReady: false,
  };

  private listeners: Set<StateListener> = new Set();
  private operationQueue: Promise<any> = Promise.resolve();

  getState(): PlaygroundState {
    return { ...this.state };
  }

  setState(patch: Partial<PlaygroundState>) {
    const oldReady = this.state.isReady;
    this.state = { ...this.state, ...patch };

    // Persistence
    if (patch.theme) localStorage.setItem('tsplay_theme', patch.theme);
    if (patch.lineWrap !== undefined) localStorage.setItem('tsplay_linewrap', String(patch.lineWrap));
    if (patch.trueColor !== undefined) localStorage.setItem('tsplay_truecolor', String(patch.trueColor));

    // Derive readiness
    this.state.isReady =
      this.state.lifecycle === 'ready' &&
      this.state.tscStatus === 'Ready' &&
      this.state.parcelStatus === 'Ready';

    if (this.state.isReady !== oldReady || Object.keys(patch).length > 0) {
      this.notify();
    }
  }

  subscribe(listener: StateListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const snapshot = { ...this.state };
    this.listeners.forEach(l => l(snapshot));
  }

  async enqueue<T>(task: () => Promise<T>): Promise<T> {
    this.operationQueue = this.operationQueue.then(task);
    return this.operationQueue;
  }
}

export const playgroundStore = new PlaygroundStore();
