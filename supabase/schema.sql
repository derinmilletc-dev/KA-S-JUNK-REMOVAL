-- =====================================================================
-- KAIS JUNK REMOVE: TEK SEFERDE CALISTIR (tekrar calistirmak da guvenli)
-- 1) Asagidaki 'BURAYA_KENDI_EPOSTAN@ornek.com' yerine KENDI e-postani yaz
--    (admin paneline giriste kullanacagin e-posta).
-- 2) Supabase > SQL Editor > New query > hepsini yapistir > Run.
-- =====================================================================

create table if not exists admins (email text primary key);

create table if not exists partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  phone text,
  payout_info text,
  code text not null unique check (code ~ '^[A-Z0-9]{3,12}$'),
  commission_pct numeric(5,2) not null default 20 check (commission_pct between 0 and 100),
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
-- Musteri hizmeti onaylar, admin odemeyi onaylar; ikisi de dolunca takip linki kapanir
alter table leads add column if not exists customer_confirmed_at timestamptz;
alter table leads add column if not exists paid_at timestamptz;
alter table leads add column if not exists completed_at timestamptz;
alter table leads add column if not exists commission_paid_at timestamptz;
alter table partners add column if not exists payout_info text;
update leads set completed_at = updated_at where status = 'done' and completed_at is null;

create or replace function touch_lead() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  if new.status = 'done' and old.status is distinct from 'done' then new.completed_at = now();
  elsif new.status <> 'done' then new.completed_at = null; end if;
  if new.commission_paid and not old.commission_paid then new.commission_paid_at = now();
  elsif not new.commission_paid then new.commission_paid_at = null; end if;
  return new;
end $$;
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

-- Musteri takip sayfasi: sadece ozel kodu bilen gorur, hassas bilgi donmez.
-- Hizmet onayi (musteri) + odeme onayi (admin) tamamlaninca link kapanir: detay donmez.
drop function if exists track_lead(text);
create or replace function track_lead(p_token text)
returns table(ref text, created_at timestamptz, updated_at timestamptz, first_name text, summary text, status text, price numeric, can_confirm boolean, confirmed boolean, closed boolean)
language sql stable security definer set search_path = public as $$
  select l.ref,
         case when closed then null else l.created_at end,
         case when closed then null else l.updated_at end,
         case when closed then null else split_part(coalesce(l.customer_name,''),' ',1) end,
         case when closed then null else l.summary end,
         case when closed then 'closed' else l.status end,
         case when not closed and l.status in ('quoted','booked','done') then l.price end,
         (not closed and l.status = 'done' and l.customer_confirmed_at is null),
         (l.customer_confirmed_at is not null),
         closed
  from (select x.*, (x.customer_confirmed_at is not null and x.paid_at is not null) as closed
        from leads x where x.track_token = p_token and length(coalesce(p_token,'')) >= 24) l;
$$;
grant execute on function track_lead(text) to anon, authenticated;

-- Musteri "hizmet yerine getirildi" onayi (yalnizca is 'tamamlandi' ise)
create or replace function confirm_service(p_token text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if length(coalesce(p_token,'')) < 24 then return; end if;
  update leads set customer_confirmed_at = now()
   where track_token = p_token and status = 'done' and customer_confirmed_at is null;
end $$;
grant execute on function confirm_service(text) to anon, authenticated;

-- Ortak kendi islerini gorur (musteri adresi/telefonu gizli: sadece ad bas harfi + ozet)
drop function if exists my_leads();
create or replace function my_leads()
returns table(track_token text, ref text, created_at timestamptz, completed_at timestamptz, customer text, summary text, status text, price numeric, commission numeric, commission_paid boolean, commission_paid_at timestamptz)
language sql stable security definer set search_path = public as $$
  select l.track_token, l.ref, l.created_at, l.completed_at,
         left(coalesce(l.customer_name,''),1) || '.' as customer,
         l.summary, l.status, l.price,
         case when l.status = 'done' and l.price is not null then round(l.price * p.commission_pct / 100, 2) end,
         l.commission_paid, l.commission_paid_at
  from leads l join partners p on p.id = l.partner_id
  where lower(p.email) = lower(coalesce(auth.jwt() ->> 'email',''))
  order by l.created_at desc;
$$;
grant execute on function my_leads() to authenticated;


-- ---------- Bildirimler (panel ici) ----------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  text text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table notifications enable row level security;
drop policy if exists admin_all_notes on notifications;
create policy admin_all_notes on notifications for all using (is_admin()) with check (is_admin());

create or replace function lead_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare pct numeric; amt numeric;
begin
  if new.partner_id is null then return new; end if;
  if tg_op = 'INSERT' then
    insert into notifications(partner_id, text) values (new.partner_id, 'Yeni talep geldi: ' || coalesce(new.summary,'is'));
    return new;
  end if;
  select commission_pct into pct from partners where id = new.partner_id;
  amt := case when new.price is not null then round(new.price * coalesce(pct,0) / 100, 2) end;
  if new.status = 'done' and old.status is distinct from 'done' then
    insert into notifications(partner_id, text) values (new.partner_id, 'Is tamamlandi: ' || coalesce(new.summary,'is') || case when amt is not null then ' - komisyonun $' || amt else '' end);
  end if;
  if new.commission_paid and not old.commission_paid then
    insert into notifications(partner_id, text) values (new.partner_id, 'Komisyon odemesi yapildi: ' || coalesce(new.summary,'is') || case when amt is not null then ' ($' || amt || ')' else '' end);
  end if;
  return new;
end $$;
drop trigger if exists leads_notify on leads;
create trigger leads_notify after insert or update on leads for each row execute function lead_notify();

create or replace function my_notes()
returns table(id uuid, text text, read boolean, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select n.id, n.text, n.read, n.created_at from notifications n join partners p on p.id = n.partner_id
  where lower(p.email) = lower(coalesce(auth.jwt() ->> 'email','')) order by n.created_at desc limit 50;
$$;
create or replace function mark_notes_read() returns void
language sql security definer set search_path = public as $$
  update notifications n set read = true from partners p
  where p.id = n.partner_id and lower(p.email) = lower(coalesce(auth.jwt() ->> 'email',''));
$$;
grant execute on function my_notes() to authenticated;
grant execute on function mark_notes_read() to authenticated;

-- ---------- Profil ----------
create or replace function update_my_profile(p_name text, p_phone text, p_payout text) returns void
language sql security definer set search_path = public as $$
  update partners set name = left(coalesce(nullif(trim(p_name),''), name),120), phone = left(p_phone,40), payout_info = left(p_payout,200)
  where lower(email) = lower(coalesce(auth.jwt() ->> 'email',''));
$$;
grant execute on function update_my_profile(text,text,text) to authenticated;

-- ---------- Hizli itiraz ("bu musteri benim") ----------
create table if not exists claims (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  customer_name text not null,
  customer_phone text,
  lead_ref text,
  note text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
alter table claims enable row level security;
drop policy if exists admin_all_claims on claims;
create policy admin_all_claims on claims for all using (is_admin()) with check (is_admin());

create or replace function partner_create_claim(p_name text, p_phone text, p_ref text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  select id into pid from partners where lower(email) = lower(coalesce(auth.jwt() ->> 'email','')) and active;
  if pid is null then raise exception 'not a partner'; end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'name required'; end if;
  insert into claims(partner_id, customer_name, customer_phone, lead_ref, note)
  values (pid, left(p_name,120), left(p_phone,40), left(upper(trim(p_ref)),20), left(p_note,500));
end $$;
grant execute on function partner_create_claim(text,text,text,text) to authenticated;

create or replace function my_claims()
returns table(id uuid, customer_name text, lead_ref text, status text, admin_note text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.customer_name, c.lead_ref, c.status, c.admin_note, c.created_at from claims c join partners p on p.id = c.partner_id
  where lower(p.email) = lower(coalesce(auth.jwt() ->> 'email','')) order by c.created_at desc limit 30;
$$;
grant execute on function my_claims() to authenticated;

-- Admin karar verir; onaylarsa ve is kodu varsa is ortaga baglanir
create or replace function resolve_claim(p_id uuid, p_approve boolean, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare c claims; pcode text;
begin
  if not is_admin() then raise exception 'admin only'; end if;
  select * into c from claims where id = p_id and status = 'pending';
  if not found then return; end if;
  update claims set status = case when p_approve then 'approved' else 'rejected' end, admin_note = left(p_note,300), decided_at = now() where id = p_id;
  if p_approve and coalesce(c.lead_ref,'') <> '' then
    select code into pcode from partners where id = c.partner_id;
    update leads set partner_id = c.partner_id, partner_code = pcode where ref = c.lead_ref;
  end if;
  insert into notifications(partner_id, text) values (c.partner_id,
    'Itirazin (' || c.customer_name || ') ' || case when p_approve then 'onaylandi' else 'reddedildi' end || coalesce(': ' || nullif(p_note,''), ''));
end $$;
grant execute on function resolve_claim(uuid,boolean,text) to authenticated;

-- Yonetici (e-postani degistir!)
insert into admins(email) values (lower('BURAYA_KENDI_EPOSTAN@ornek.com')) on conflict do nothing;
