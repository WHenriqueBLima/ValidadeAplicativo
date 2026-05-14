create table if not exists public.app_state (
  id text primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "ValidadeApp pode ler estado" on public.app_state;
create policy "ValidadeApp pode ler estado"
on public.app_state
for select
to anon
using (id = 'validadeapp');

drop policy if exists "ValidadeApp pode criar estado" on public.app_state;
create policy "ValidadeApp pode criar estado"
on public.app_state
for insert
to anon
with check (id = 'validadeapp');

drop policy if exists "ValidadeApp pode atualizar estado" on public.app_state;
create policy "ValidadeApp pode atualizar estado"
on public.app_state
for update
to anon
using (id = 'validadeapp')
with check (id = 'validadeapp');
