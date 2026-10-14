import { saveSchema } from '../../../shared/character.ts';

const allowedOrigins = new Set(['https://jops128.github.io', 'http://127.0.0.1:5173', 'http://127.0.0.1:4173', 'http://localhost:5173']);
const url = Deno.env.get('SUPABASE_URL')!;
const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
const secret = keys.default || Object.values(keys)[0] || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

export async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get('Origin');
  const cors: Record<string, string> = {
    'Access-Control-Allow-Headers': 'content-type, x-sheet-token',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json',
  };
  if (origin && allowedOrigins.has(origin)) cors['Access-Control-Allow-Origin'] = origin;
  const response = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: cors });
  if (origin && !allowedOrigins.has(origin)) return response(403, { error: 'Origin not allowed.' });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!['GET', 'PUT'].includes(req.method)) return response(405, { error: 'Method not allowed.' });
  const token = req.headers.get('X-Sheet-Token') || '';
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return response(401, { error: 'Invalid sheet link.' });
  const tokenHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))).map(b => b.toString(16).padStart(2, '0')).join('');
  const endpoint = `${url}/rest/v1/chonk_characters?token_hash=eq.${tokenHash}&select=data,revision,updated_at,last_write_id`;
  const headers: Record<string, string> = { apikey: String(secret), 'Content-Type': 'application/json' };
  if (String(secret).startsWith('eyJ')) headers.Authorization = `Bearer ${secret}`;
  async function load() {
    const result = await fetch(endpoint, { headers });
    if (!result.ok) throw new Error('Database unavailable');
    return (await result.json())[0];
  }
  try {
    const current = await load();
    if (!current) return response(401, { error: 'Invalid sheet link.' });
    if (req.method === 'GET') return response(200, current);
    const raw = await req.text();
    if (raw.length > 1000000) return response(413, { error: 'Sheet is too large.' });
    let input;
    try { input = saveSchema.safeParse(JSON.parse(raw)); } catch { return response(400, { error: 'Invalid JSON.' }); }
    if (!input.success) return response(400, { error: 'Invalid character data.' });
    const { data, expectedRevision, writeId } = input.data;
    if (current.last_write_id === writeId) return response(200, current);
    if (current.revision !== expectedRevision) return response(409, current);
    const result = await fetch(`${endpoint}&revision=eq.${expectedRevision}`, {
      method: 'PATCH', headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({ data, revision: expectedRevision + 1, updated_at: new Date().toISOString(), last_write_id: writeId }),
    });
    if (!result.ok) throw new Error('Database unavailable');
    const rows = await result.json();
    if (rows[0]) return response(200, rows[0]);
    const latest = await load();
    return response(latest.last_write_id === writeId ? 200 : 409, latest);
  } catch {
    return response(503, { error: 'Cloud storage is temporarily unavailable.' });
  }
}

Deno.serve(handler);
