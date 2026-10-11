create type public.app_role as enum ('admin','tecnico','cliente');
create type public.visit_status as enum ('agendada','em_andamento','concluida');

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null, phone text not null, address text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  client_id uuid references public.clients(id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
create table public.swimming_pools (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  coating text not null default 'Vinil',
  dimensions text,
  volume_m3 numeric not null default 0,
  created_at timestamptz not null default now()
);
create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.swimming_pools(id) on delete cascade,
  technician_id uuid references public.profiles(id) on delete set null,
  scheduled_at timestamptz not null,
  status public.visit_status not null default 'agendada',
  created_at timestamptz not null default now()
);
create table public.visit_reports (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null unique references public.schedules(id) on delete cascade,
  technician_id uuid,
  ph numeric, free_chlorine numeric, alkalinity numeric, cyanuric_acid numeric,
  chemicals jsonb not null default '{}'::jsonb,
  tasks text[] not null default '{}',
  photo_before text, photo_after text,
  notes text,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.clients, public.profiles, public.swimming_pools, public.schedules, public.visit_reports to authenticated;
grant select on public.user_roles to authenticated;
grant all on public.clients, public.profiles, public.user_roles, public.swimming_pools, public.schedules, public.visit_reports to service_role;

alter table public.clients enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.swimming_pools enable row level security;
alter table public.schedules enable row level security;
alter table public.visit_reports enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create or replace function public.my_client_id()
returns uuid language sql stable security definer set search_path = public as $$
  select client_id from public.profiles where id = auth.uid() $$;

create or replace function public.pool_client(_pool uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select client_id from public.swimming_pools where id = _pool $$;

create or replace function public.schedule_tech(_s uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select technician_id from public.schedules where id = _s $$;

create or replace function public.schedule_client(_s uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select p.client_id from public.schedules s join public.swimming_pools p on p.id = s.pool_id where s.id = _s $$;

create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "profiles read" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'tecnico'));
create policy "profiles admin write" on public.profiles for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "clients read" on public.clients for select to authenticated using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'tecnico') or id = public.my_client_id());
create policy "clients admin" on public.clients for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "pools read" on public.swimming_pools for select to authenticated using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'tecnico') or client_id = public.my_client_id());
create policy "pools admin" on public.swimming_pools for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "schedules read" on public.schedules for select to authenticated using (public.has_role(auth.uid(),'admin') or technician_id = auth.uid() or public.pool_client(pool_id) = public.my_client_id());
create policy "schedules admin" on public.schedules for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "schedules tech update" on public.schedules for update to authenticated using (technician_id = auth.uid()) with check (technician_id = auth.uid());
create policy "reports read" on public.visit_reports for select to authenticated using (public.has_role(auth.uid(),'admin') or public.schedule_tech(schedule_id) = auth.uid() or public.schedule_client(schedule_id) = public.my_client_id());
create policy "reports admin" on public.visit_reports for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "reports tech insert" on public.visit_reports for insert to authenticated with check (public.schedule_tech(schedule_id) = auth.uid());
create policy "reports tech update" on public.visit_reports for update to authenticated using (public.schedule_tech(schedule_id) = auth.uid()) with check (public.schedule_tech(schedule_id) = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email) values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.email)
  on conflict (id) do nothing;
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create policy "photos read" on storage.objects for select to authenticated using (bucket_id = 'visit-photos');
create policy "photos upload" on storage.objects for insert to authenticated with check (bucket_id = 'visit-photos' and (public.has_role(auth.uid(),'tecnico') or public.has_role(auth.uid(),'admin')));

alter publication supabase_realtime add table public.schedules;