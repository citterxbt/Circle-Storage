-- Isolate Shelbynet files from the Aptos Testnet records already in Circle Storage.
-- Run this once in Supabase SQL Editor before deploying the Shelbynet build.
-- This is non-destructive: existing rows remain available for archival/export, but the app no
-- longer tries to fetch their Testnet blob references from Shelbynet.

alter table public.files
  add column if not exists network text;

update public.files
set network = 'aptos-testnet'
where network is null;

alter table public.files
  alter column network set default 'aptos-testnet',
  alter column network set not null;

alter table public.files
  drop constraint if exists files_network_check;

alter table public.files
  add constraint files_network_check
  check (network in ('aptos-testnet', 'shelbynet'));

create index if not exists files_network_uploader_idx
  on public.files (network, uploader);

create index if not exists files_network_visibility_idx
  on public.files (network, visibility);
