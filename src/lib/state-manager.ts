import { ThemeMode } from './theme';
import { CompilerStatus, EnvironmentStatus } from './webcontainer';
import type { PackageManagerStatus } from '../hooks/usePackageManager';

export interface PlaygroundState {
  lifecycle: EnvironmentStatus;
  tscStatus: CompilerStatus;
  esbuildStatus: CompilerStatus;
  packageManagerStatus: PackageManagerStatus;
  theme: ThemeMode;
  lineWrap: boolean;
  stripAnsi: boolean;
  inlineDeps: boolean;
  isReady: boolean; bootTime: number | null;
}

type StateListener = (state: PlaygroundState) => void;

class PlaygroundStore {
  private state: PlaygroundState = {
    lifecycle: 'idle',
    tscStatus: 'Idle',
    esbuildStatus: 'Idle',
    packageManagerStatus: 'idle',
    theme: (localStorage.getItem('tsplay_theme') as ThemeMode) || 'mocha',
    lineWrap: localStorage.getItem('tsplay_linewrap') === 'true',
    stripAnsi: localStorage.getItem('tsplay_stripansi') === 'true',
    inlineDeps: localStorage.getItem('tsplay_inlinedeps') === 'true',
    isReady: false, bootTime: null,
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
    if (patch.stripAnsi !== undefined) localStorage.setItem('tsplay_stripansi', String(patch.stripAnsi));
    if (patch.inlineDeps !== undefined) localStorage.setItem('tsplay_inlinedeps', String(patch.inlineDeps));

    // Derive readiness
    this.state.isReady =
      this.state.lifecycle === 'ready' &&
      this.state.tscStatus === 'Ready' &&
      this.state.esbuildStatus === 'Ready';

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
