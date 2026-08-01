-- Circle Storage: durable application state and serverless wallet-sign-in nonces.
-- Run this in Supabase SQL Editor before deploying the Vercel API, or apply with the Supabase CLI.

create table if not exists public.profiles (
  wallet_address text primary key,
  username text not null,
  avatar_url text not null,
  bio text not null default '',
  x_social text not null default '',
  github_social text not null default '',
  telegram_social text not null default ''
);

create table if not exists public.files (
  id text primary key,
  uploader text not null references public.profiles(wallet_address),
  name text not null,
  size bigint not null check (size >= 0),
  shelby_ref text not null,
  price numeric not null default 0 check (price >= 0),
  visibility text not null check (visibility in ('public', 'private')),
  duration text not null check (duration in ('7d', '30d', '90d', '365d')),
  created_at timestamptz not null default now(),
  aes_key text not null default '',
  aes_iv text not null default '',
  file_data text not null default '',
  content_type text not null default 'application/octet-stream',
  lease_tx text not null unique,
  shelby_owner text not null default ''
);

create index if not exists files_uploader_idx on public.files (uploader);
create index if not exists files_visibility_idx on public.files (visibility);

create table if not exists public.purchases (
  id text primary key,
  file_id text not null references public.files(id),
  buyer text not null references public.profiles(wallet_address),
  tx_hash text not null unique,
  amount numeric not null check (amount >= 0),
  timestamp timestamptz not null default now()
);

create index if not exists purchases_file_id_idx on public.purchases (file_id);
create index if not exists purchases_buyer_idx on public.purchases (buyer);

-- Store only a SHA-256 nonce digest. The RPC below makes consumption atomic across Vercel
-- instances, so a captured sign-in signature cannot be replayed in a race.
create table if not exists public.auth_nonces (
  address text primary key,
  nonce_hash text not null,
  expires_at timestamptz not null
);

create or replace function public.consume_auth_nonce(p_address text, p_nonce_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  matched boolean;
begin
  delete from public.auth_nonces
  where address = lower(p_address)
    and nonce_hash = p_nonce_hash
    and expires_at > now()
  returning true into matched;

  return coalesce(matched, false);
end;
$$;

-- The browser never receives a Supabase key. RLS keeps the public data API closed; the server
-- uses the service-role/secret key, which intentionally bypasses these policies.
alter table public.profiles enable row level security;
alter table public.files enable row level security;
alter table public.purchases enable row level security;
alter table public.auth_nonces enable row level security;

revoke all on function public.consume_auth_nonce(text, text) from public;
grant execute on function public.consume_auth_nonce(text, text) to service_role;
