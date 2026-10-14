import { beforeEach, describe, expect, it, vi } from 'vitest';
import { demoCharacter } from '../shared/demo';
import type { Snapshot } from '../shared/character';
import type { LocalRecord } from '../src/storage';
const memory = vi.hoisted(() => ({ records: new Map<string, LocalRecord>() }));
vi.mock('../src/storage', () => ({
  readLocal: async (token: string) => structuredClone(memory.records.get(token)),
  writeLocal: async (r: LocalRecord) => { memory.records.set(r.token, structuredClone(r)); },
}));
import { SheetStore } from '../src/sync';
let cloud: Snapshot;
let calls: Array<{ method: string; body?: unknown }>;
beforeEach(() => {
  memory.records.clear(); cloud = { data: demoCharacter(), revision: 0, updated_at: new Date().toISOString(), last_write_id: null }; calls = [];
  vi.stubGlobal('navigator', { onLine: true });
  vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
    calls.push({ method: options.method, body: options.body && JSON.parse(options.body) });
    if (options.method === 'PUT') {
      const p = JSON.parse(options.body);
      if (p.expectedRevision !== cloud.revision) return Response.json(cloud, { status: 409 });
      cloud = { data: p.data, revision: cloud.revision + 1, updated_at: new Date().toISOString(), last_write_id: p.writeId };
    }
    return Response.json(cloud);
  }));
});
describe('cloud and offline persistence', () => {
  it('clears stale undo history when another device saves newer changes', async () => {
    const a = new SheetStore('token', 'https://example.test'); await a.start();
    await a.change(c => { c.combat.hp = 15; return c; }); await a.sync();
    expect(a.getSnapshot().hasUndo).toBe(true);
    cloud.revision++; cloud.data.combat.hp = 10;
    await a.sync();
    expect(a.getSnapshot().hasUndo).toBe(false);
    await a.undo(); expect(a.getSnapshot().character?.combat.hp).toBe(10); a.dispose();
  });
  it('keeps offline edits through reopening and syncs on reconnection', async () => {
    const a = new SheetStore('token', 'https://example.test'); await a.start();
    navigator.onLine = false;
    await a.change(c => { c.combat.hp = 12; return c; }); a.dispose();
    const b = new SheetStore('token', 'https://example.test'); await b.start();
    expect(b.getSnapshot().character?.combat.hp).toBe(12); expect(b.getSnapshot().status).toBe('offline');
    navigator.onLine = true; await b.sync(); expect(cloud.data.combat.hp).toBe(12); expect(b.getSnapshot().status).toBe('saved'); b.dispose();
  });
  it('preserves edits made while a save is in flight', async () => {
    const a = new SheetStore('token', 'https://example.test'); await a.start();
    await a.change(c => { c.combat.hp = 20; return c; });
    let release!: (r: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(async () => new Promise(resolve => { release = resolve; }));
    const syncing = a.sync(); await vi.waitFor(() => expect(release).toBeDefined());
    await a.change(c => { c.combat.hp = 15; return c; });
    release(Response.json({ ...cloud, data: { ...cloud.data, combat: { ...cloud.data.combat, hp: 20 } }, revision: 1 }));
    await syncing; expect(a.getSnapshot().character?.combat.hp).toBe(15);
    expect(memory.records.get('token')?.pending?.expectedRevision).toBe(1); a.dispose();
  });
  it('prompts before overwriting a conflicting cloud revision', async () => {
    const a = new SheetStore('token', 'https://example.test'); await a.start();
    await a.change(c => { c.combat.hp = 14; return c; }); cloud.revision = 1; cloud.data.combat.hp = 9;
    await a.sync(); expect(a.getSnapshot().status).toBe('conflict'); expect(a.getSnapshot().character?.combat.hp).toBe(14);
    await a.resolveConflict('cloud'); expect(a.getSnapshot().character?.combat.hp).toBe(9); expect(memory.records.get('token')?.pending).toBeNull(); a.dispose();
  });
  it('detects cloud changes during a refresh that overlaps a local edit', async () => {
    const a = new SheetStore('token', 'https://example.test'); await a.start();
    let release!: (r: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(async () => new Promise(resolve => { release = resolve; }));
    const syncing = a.sync(); await vi.waitFor(() => expect(release).toBeDefined());
    await a.change(c => { c.combat.hp = 15; return c; });
    release(Response.json({ ...cloud, revision: 1 })); await syncing;
    expect(a.getSnapshot().status).toBe('conflict'); expect(a.getSnapshot().character?.combat.hp).toBe(15); a.dispose();
  });
  it('does not pretend failed saves succeeded', async () => {
    const a = new SheetStore('token', 'https://example.test'); await a.start();
    await a.change(c => { c.combat.hp = 2; return c; });
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Network unavailable'));
    await a.sync(); expect(a.getSnapshot().status).toBe('failed'); expect(memory.records.get('token')?.pending?.data.combat.hp).toBe(2); a.dispose();
  });
});
