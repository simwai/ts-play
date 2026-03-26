import Dexie, { type Table } from 'dexie';

interface Snapshot {
  id?: number;
  name: string;
  data: Uint8Array;
  timestamp: number;
}

class PlaygroundDatabase extends Dexie {
  snapshots!: Table<Snapshot>;

  constructor() {
    super('PlaygroundDatabase');
    this.version(1).stores({
      snapshots: '++id, name, timestamp',
    });
  }

  async saveSnapshot(name: string, data: Uint8Array) {
    await this.snapshots.put({
      name,
      data,
      timestamp: Date.now(),
    });
  }

  async getLatestSnapshot(name: string): Promise<Snapshot | undefined> {
    return this.snapshots
      .where('name')
      .equals(name)
      .reverse()
      .sortBy('timestamp')
      .then((results) => results[0]);
  }
}

export const db = new PlaygroundDatabase();
