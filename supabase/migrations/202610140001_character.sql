create table if not exists public.chonk_characters (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  data jsonb not null,
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now(),
  last_write_id uuid
);

alter table public.chonk_characters enable row level security;
revoke all on public.chonk_characters from anon, authenticated;
grant select, insert, update on public.chonk_characters to service_role;
-- Access is authenticated by the Edge Function's high-entropy sheet token.
-- No browser role can select or mutate this table directly.
