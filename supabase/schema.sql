-- Kais Junk Remove: ortak (partner) sistemi
-- Supabase > SQL Editor'a yapistirip bir kez calistir.
-- Sonra su satirdaki e-postayi KENDI e-postanla degistirip calistir:
--   insert into admins(email) values ('senin@epostan.com');

create table if not exists admins (email text primary key);

create table if not exists partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  phone text,
  code text not null unique check (code ~ '^[A-Z0-9]{3,12}$'),
  commission_pct numeric(5,2) not null default 10 check (commission_pct between 0 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  partner_id uuid references partners(id) on delete set null,
  partner_code text,
  customer_name text,
  address text,
  summary text,
  message text,
  status text not null default 'new' check (status in ('new','quoted','booked','done','lost')),
  price numeric(10,2),
  commission_paid boolean not null default false,
  notes text,
  track_token text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table leads add column if not exists track_token text unique;
alter table leads add column if not exists updated_at timestamptz not null default now();

create or replace function touch_lead() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists leads_touch on leads;
create trigger leads_touch before update on leads for each row execute function touch_lead();
create index if not exists leads_partner_idx on leads(partner_id, created_at desc);

alter table admins enable row level security;
alter table partners enable row level security;
alter table leads enable row level security;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where lower(email) = lower(coalesce(auth.jwt() ->> 'email','')));
$$;

drop policy if exists admin_all_admins on admins;
create policy admin_all_admins on admins for select using (is_admin());
drop policy if exists admin_all_partners on partners;
create policy admin_all_partners on partners for all using (is_admin()) with check (is_admin());
drop policy if exists admin_all_leads on leads;
create policy admin_all_leads on leads for all using (is_admin()) with check (is_admin());

-- Ortak kendi satirini okuyabilir (e-posta eslesmesi)
drop policy if exists partner_self on partners;
create policy partner_self on partners for select
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email','')));

-- Web sitesi: herkes talep gonderebilir (sadece bu fonksiyonla). Takip kodunu site uretir.
drop function if exists submit_lead(text,text,text,text,text,text);
create or replace function submit_lead(p_ref text, p_code text, p_name text, p_address text, p_summary text, p_message text, p_token text)
returns void language plpgsql security definer set search_path = public as $$
declare pid uuid; pc text;
begin
  if p_ref is null or length(p_ref) not between 4 and 20 then return; end if;
  if p_token is null or p_token !~ '^[a-f0-9]{24,48}$' then return; end if;
  select id, code into pid, pc from partners where code = upper(coalesce(p_code,'')) and active;
  insert into leads(ref, partner_id, partner_code, customer_name, address, summary, message, track_token)
  values (p_ref, pid, pc, left(p_name,120), left(p_address,300), left(p_summary,500), left(p_message,3000), p_token)
  on conflict (ref) do update set
    customer_name = excluded.customer_name, address = excluded.address,
    summary = excluded.summary, message = excluded.message
  where leads.status = 'new' and leads.track_token = excluded.track_token;
end $$;
grant execute on function submit_lead(text,text,text,text,text,text,text) to anon, authenticated;

-- Ortak, kendi musterisi icin is olusturur (ozel takip linki uretilir)
create or replace function partner_create_lead(p_ref text, p_name text, p_address text, p_summary text, p_token text)
returns void language plpgsql security definer set search_path = public as $$
declare pid uuid; pc text;
begin
  select id, code into pid, pc from partners
   where lower(email) = lower(coalesce(auth.jwt() ->> 'email','')) and active;
  if pid is null then raise exception 'not a partner'; end if;
  if p_token is null or p_token !~ '^[a-f0-9]{24,48}$' then raise exception 'bad token'; end if;
  insert into leads(ref, partner_id, partner_code, customer_name, address, summary, track_token)
  values (left(p_ref,20), pid, pc, left(p_name,120), left(p_address,300), left(p_summary,500), p_token);
end $$;
grant execute on function partner_create_lead(text,text,text,text,text) to authenticated;

-- Musteri takip sayfasi: sadece ozel kodu bilen gorur, hassas bilgi donmez
create or replace function track_lead(p_token text)
returns table(ref text, created_at timestamptz, updated_at timestamptz, first_name text, summary text, status text, price numeric)
language sql stable security definer set search_path = public as $$
  select l.ref, l.created_at, l.updated_at, split_part(coalesce(l.customer_name,''),' ',1), l.summary, l.status,
         case when l.status in ('quoted','booked','done') then l.price end
  from leads l where l.track_token = p_token and length(coalesce(p_token,'')) >= 24;
$$;
grant execute on function track_lead(text) to anon, authenticated;

-- Ortak kendi islerini gorur (musteri adresi/telefonu gizli: sadece ad bas harfi + ozet)
drop function if exists my_leads();
create or replace function my_leads()
returns table(track_token text, ref text, created_at timestamptz, customer text, summary text, status text, price numeric, commission numeric, commission_paid boolean)
language sql stable security definer set search_path = public as $$
  select l.track_token, l.ref, l.created_at,
         left(coalesce(l.customer_name,''),1) || '.' as customer,
         l.summary, l.status, l.price,
         case when l.status = 'done' and l.price is not null then round(l.price * p.commission_pct / 100, 2) end,
         l.commission_paid
  from leads l join partners p on p.id = l.partner_id
  where lower(p.email) = lower(coalesce(auth.jwt() ->> 'email',''))
  order by l.created_at desc;
$$;
grant execute on function my_leads() to authenticated;
