-- =========================================================
-- MUV FITNESS — schema do backend real (Supabase / Postgres)
-- Rode este script inteiro no SQL Editor do seu projeto Supabase.
-- =========================================================

-- ---------- PROFILES (nome/telefone do usuário) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  phone text,
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "profiles: usuário lê o próprio perfil"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: usuário cria/atualiza o próprio perfil"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles: usuário atualiza o próprio perfil"
  on public.profiles for update
  using (auth.uid() = id);

-- ---------- ADDRESSES (endereços de entrega) ----------
create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  cep text not null,
  street text not null,
  number text not null,
  complement text,
  neighborhood text not null,
  city text not null,
  state text not null,
  is_default boolean default false,
  created_at timestamptz default now()
);

alter table public.addresses enable row level security;

create policy "addresses: usuário vê os próprios endereços"
  on public.addresses for select
  using (auth.uid() = user_id);

create policy "addresses: usuário cria os próprios endereços"
  on public.addresses for insert
  with check (auth.uid() = user_id);

create policy "addresses: usuário atualiza os próprios endereços"
  on public.addresses for update
  using (auth.uid() = user_id);

create policy "addresses: usuário apaga os próprios endereços"
  on public.addresses for delete
  using (auth.uid() = user_id);

-- ---------- ORDERS (pedidos) ----------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  items jsonb not null,
  subtotal numeric(10,2) not null,
  freight numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  payment_method text,
  address jsonb,
  status text default 'Pagamento pendente',
  created_at timestamptz default now()
);

alter table public.orders enable row level security;

create policy "orders: usuário vê os próprios pedidos"
  on public.orders for select
  using (auth.uid() = user_id);

create policy "orders: usuário cria os próprios pedidos"
  on public.orders for insert
  with check (auth.uid() = user_id);

-- Observação: não criamos policy de UPDATE para orders porque, no fluxo real,
-- quem deve mudar o status do pedido (ex: "Pagamento aprovado", "Enviado") é o
-- backend/webhook do gateway de pagamento (rodando com a service_role key),
-- e não o próprio cliente pelo navegador.
