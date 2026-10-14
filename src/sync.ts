import { characterSchema, type Character, type Snapshot } from '../shared/character';
import { readLocal, writeLocal, type LocalRecord, type Pending } from './storage';

export type SyncStatus = 'loading' | 'saved' | 'pending' | 'offline' | 'failed' | 'conflict' | 'local';
export type SyncView = { character: Character | null; status: SyncStatus; error: string; remote: Snapshot | null; hasUndo: boolean; updatedAt: string | null };
export class SheetStore {
  private record: LocalRecord;
  private listeners = new Set<() => void>();
  private view: SyncView = { character: null, status: 'loading', error: '', remote: null, hasUndo: false, updatedAt: null };
  private busy = false;
  private persistTail: Promise<void> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;
  constructor(private token: string, private endpoint: string, private demo: Character | null = null) {
    this.record = { token, snapshot: null, pending: null, undo: null };
  }
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getSnapshot = () => this.view;
  private emit(partial: Partial<SyncView>) {
    this.view = { ...this.view, ...partial };
    for (const fn of this.listeners) fn();
  }
  private persist() {
    const copy = structuredClone(this.record);
    this.persistTail = this.persistTail.catch(() => {}).then(() => writeLocal(copy));
    return this.persistTail;
  }
  async start() {
    try {
      this.record = await readLocal(this.token) ?? this.record;
      if (this.disposed) return;
      if (this.demo && !this.record.snapshot) this.record.snapshot = { data: this.demo, revision: 0, updated_at: new Date().toISOString(), last_write_id: null };
      const character = this.record.pending?.data ?? this.record.snapshot?.data ?? null;
      this.emit({ character, hasUndo: !!this.record.undo, updatedAt: this.record.snapshot?.updated_at ?? null, status: this.demo ? 'local' : character ? 'pending' : 'loading' });
      if (this.demo) await this.persist();
      else await this.sync();
    } catch { this.emit({ status: 'failed', error: 'Browser storage is unavailable. Allow storage for this site before editing.' }); }
  }
  async change(fn: (c: Character) => Character) {
    if (!this.view.character || this.view.status === 'conflict') return;
    const current = this.view.character;
    const next = characterSchema.parse(fn(structuredClone(current)));
    this.record.undo = structuredClone(current);
    this.record.pending = { data: next, expectedRevision: this.record.snapshot?.revision ?? 0, writeId: crypto.randomUUID() };
    this.emit({ character: next, status: this.demo ? 'local' : navigator.onLine ? 'pending' : 'offline', hasUndo: true, error: '' });
    try { await this.persist(); }
    catch { this.emit({ status: 'failed', error: 'Could not save on this device. Keep this page open and export a backup.' }); return; }
    clearTimeout(this.timer);
    if (!this.demo) this.timer = setTimeout(() => void this.sync(), 300);
  }
  async undo() {
    const previous = this.record.undo;
    if (!previous) return;
    await this.change(() => previous);
    this.record.undo = null;
    this.emit({ hasUndo: false });
    await this.persist();
  }
  private async request(method: 'GET' | 'PUT', pending?: Pending): Promise<Snapshot> {
    if (!this.endpoint) throw new Error('Cloud connection is not configured yet.');
    const response = await fetch(this.endpoint, { method, headers: { 'Content-Type': 'application/json', 'X-Sheet-Token': this.token }, body: pending ? JSON.stringify(pending) : undefined, signal: AbortSignal.timeout(12000), cache: 'no-store' });
    if (response.status === 409) {
      const remote = await response.json() as Snapshot;
      characterSchema.parse(remote.data);
      this.emit({ status: 'conflict', remote, error: 'Another device changed the sheet. Choose which version to keep.' });
      throw new Error('conflict');
    }
    if (response.status === 401) throw new Error('This sheet link is invalid or has been replaced. Check the complete secret link.');
    if (!response.ok) throw new Error(`Cloud save is unavailable (${response.status}). Your local changes are kept.`);
    const result = await response.json() as Snapshot;
    characterSchema.parse(result.data);
    return result;
  }
  async sync() {
    if (this.busy || this.disposed || this.demo || this.view.status === 'conflict') return;
    if (!navigator.onLine) { this.emit({ status: 'offline' }); return; }
    this.busy = true;
    try {
      await this.persistTail;
      const pending = this.record.pending ? structuredClone(this.record.pending) : null;
      const remote = await this.request(pending ? 'PUT' : 'GET', pending ?? undefined);
      // A refresh may overlap a local edit. Do not silently rebase that edit
      // onto a cloud revision that changed on another device.
      if (!pending && this.record.pending && remote.revision !== this.record.snapshot?.revision) {
        this.emit({ status: 'conflict', remote, error: 'Another device changed the sheet. Choose which version to keep.' });
        return;
      }
      this.record.snapshot = remote;
      // Preserve edits made while this network request was in flight.
      if (pending && this.record.pending?.writeId === pending.writeId) this.record.pending = null;
      else if (this.record.pending) this.record.pending.expectedRevision = remote.revision;
      await this.persist();
      this.emit({ character: this.record.pending?.data ?? remote.data, status: this.record.pending ? 'pending' : 'saved', updatedAt: remote.updated_at, error: '' });
    } catch (error) {
      if (this.getSnapshot().status !== 'conflict') this.emit({ status: navigator.onLine ? 'failed' : 'offline', error: error instanceof Error ? error.message : 'Unable to reach the cloud. Your local changes are kept.' });
    } finally {
      this.busy = false;
      if (this.record.pending && this.view.status === 'pending' && !this.disposed) this.timer = setTimeout(() => void this.sync(), 300);
    }
  }
  async resolveConflict(choice: 'local' | 'cloud') {
    const remote = this.view.remote;
    if (!remote) return;
    this.record.snapshot = remote;
    if (choice === 'cloud') { this.record.pending = null; this.record.undo = null; }
    else this.record.pending = { data: this.view.character!, expectedRevision: remote.revision, writeId: crypto.randomUUID() };
    await this.persist();
    this.emit({ character: this.record.pending?.data ?? remote.data, status: choice === 'cloud' ? 'saved' : 'pending', remote: null, error: '', hasUndo: !!this.record.undo, updatedAt: remote.updated_at });
    if (choice === 'local') await this.sync();
  }
  dispose() { this.disposed = true; clearTimeout(this.timer); }
}
