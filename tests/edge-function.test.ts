import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoCharacter } from '../shared/demo';
import type { Snapshot } from '../shared/character';
let handler: (r: Request) => Promise<Response>;
let cloud: Snapshot;
const token = 'a'.repeat(43);
beforeAll(async () => {
  vi.stubGlobal('Deno', { env: { get: (name: string) => ({ SUPABASE_URL: 'https://db.example', SUPABASE_SECRET_KEYS: '{"default":"sb_secret_example"}' })[name] }, serve: vi.fn() });
  handler = (await import('../supabase/functions/chonk-sheet/index')).handler;
});
beforeEach(() => {
  cloud = { data: demoCharacter(), revision: 0, updated_at: new Date().toISOString(), last_write_id: null };
  vi.stubGlobal('fetch', vi.fn(async (url: string, options) => {
    expect(options.headers.apikey).toBe('sb_secret_example');
    expect(options.headers.Authorization).toBeUndefined();
    if (options.method === 'PATCH') {
      const revision = Number(new URL(url).searchParams.get('revision')?.slice(3));
      if (revision !== cloud.revision) return Response.json([]);
      cloud = JSON.parse(options.body); return Response.json([cloud]);
    }
    return Response.json([cloud]);
  }));
});
function request(body?: unknown, key = token, origin = 'https://jops128.github.io') {
  return new Request('https://api.example/chonk-sheet', { method: body ? 'PUT' : 'GET', headers: { 'X-Sheet-Token': key, Origin: origin }, body: body ? JSON.stringify(body) : undefined });
}
describe('secret-link cloud API', () => {
  it('rejects missing or malformed tokens without reaching the database', async () => {
    expect((await handler(request(undefined, ''))).status).toBe(401); expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects valid-shaped but unknown tokens', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json([]));
    expect((await handler(request())).status).toBe(401);
  });
  it('returns the character without exposing the token hash', async () => {
    const response = await handler(request()); expect(response.status).toBe(200);
    expect(await response.json()).toEqual(cloud);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://jops128.github.io');
  });
  it('rejects malformed character data', async () => {
    const response = await handler(request({ data: {}, expectedRevision: 0, writeId: crypto.randomUUID() }));
    expect(response.status).toBe(400);
  });
  it('updates atomically and acknowledges a duplicate write without applying it twice', async () => {
    const payload = { data: demoCharacter(), expectedRevision: 0, writeId: crypto.randomUUID() }; payload.data.combat.hp = 15;
    expect((await handler(request(payload))).status).toBe(200); expect(cloud.revision).toBe(1);
    expect((await handler(request(payload))).status).toBe(200); expect(cloud.revision).toBe(1);
    expect(cloud.data.combat.hp).toBe(15);
  });
  it('returns conflicts instead of overwriting another device', async () => {
    cloud.revision = 2;
    const response = await handler(request({ data: demoCharacter(), expectedRevision: 0, writeId: crypto.randomUUID() }));
    expect(response.status).toBe(409); expect((await response.json()).revision).toBe(2);
  });
  it('rejects an unapproved browser origin', async () => {
    expect((await handler(request(undefined, token, 'https://unrelated.example'))).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });
});
