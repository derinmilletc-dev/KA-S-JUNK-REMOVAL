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
  if new.override_paid and not old.override_paid then new.override_paid_at = now();
  elsif not new.override_paid then new.override_paid_at = null; end if;
  return new;
end $$;
drop trigger if exists leads_touch on leads;
create trigger leads_touch before update on leads for each row execute function touch_lead();

-- ---------- Program: 2 kademe, seviyeler, musteri tavsiyesi ----------
-- Kurallar: para SADECE gercek musterinin odedigi isten cikar. Katilim ucreti yok. En fazla 2 kademe.
alter table partners add column if not exists parent_id uuid references partners(id) on delete set null;
alter table partners add column if not exists override_pct numeric(5,2) not null default 5 check (override_pct between 0 and 100);
alter table leads add column if not exists share_code text unique default lower(substr(replace(gen_random_uuid()::text,'-',''),1,8));
update leads set share_code = lower(substr(replace(gen_random_uuid()::text,'-',''),1,8)) where share_code is null;
alter table leads add column if not exists referrer_code text;
alter table leads add column if not exists override_paid boolean not null default false;
alter table leads add column if not exists override_paid_at timestamptz;
create index if not exists leads_ref_code_idx on leads(referrer_code);

create table if not exists tiers (min_jobs int primary key check (min_jobs > 0), pct numeric(5,2) not null check (pct between 0 and 100));
insert into tiers values (5, 25), (10, 30) on conflict do nothing;
create table if not exists settings (key text primary key, value text not null);
insert into settings values ('customer_credit', '20') on conflict do nothing;
alter table tiers enable row level security;
alter table settings enable row level security;

-- Her tamamlanan is icin: komisyon yuzdesi (ayin kacinci isi ise ona gore seviye) ve ust ortak payi
create or replace view lead_calc as
with d as (
  select l.id, l.partner_id, l.price,
         row_number() over (partition by l.partner_id, date_trunc('month', l.completed_at) order by l.completed_at, l.id) as pos
  from leads l where l.status = 'done' and l.partner_id is not null and l.completed_at is not null
)
select d.id as lead_id, d.partner_id, d.pos,
       greatest(p.commission_pct, coalesce((select max(t.pct) from tiers t where t.min_jobs <= d.pos), 0)) as pct,
       case when d.price is not null then round(d.price * greatest(p.commission_pct, coalesce((select max(t.pct) from tiers t where t.min_jobs <= d.pos), 0)) / 100, 2) end as commission,
       case when sp.active then p.parent_id end as sponsor_id,
       case when sp.active then p.override_pct end as override_pct,
       case when sp.active and d.price is not null then round(d.price * p.override_pct / 100, 2) end as override_amt
from d join partners p on p.id = d.partner_id left join partners sp on sp.id = p.parent_id;
revoke all on lead_calc from anon, authenticated, public;
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
drop function if exists submit_lead(text,text,text,text,text,text,text);
create or replace function submit_lead(p_ref text, p_code text, p_name text, p_address text, p_summary text, p_message text, p_token text, p_rc text default null)
returns void language plpgsql security definer set search_path = public as $$
declare pid uuid; pc text; rc text;
begin
  if p_ref is null or length(p_ref) not between 4 and 20 then return; end if;
  if p_token is null or p_token !~ '^[a-f0-9]{24,48}$' then return; end if;
  select id, code into pid, pc from partners where code = upper(coalesce(p_code,'')) and active;
  select share_code into rc from leads where share_code = lower(coalesce(p_rc,'')) and length(coalesce(p_rc,'')) = 8;
  insert into leads(ref, partner_id, partner_code, customer_name, address, summary, message, track_token, referrer_code)
  values (p_ref, pid, pc, left(p_name,120), left(p_address,300), left(p_summary,500), left(p_message,3000), p_token, rc)
  on conflict (ref) do update set
    customer_name = excluded.customer_name, address = excluded.address,
    summary = excluded.summary, message = excluded.message
  where leads.status = 'new' and leads.track_token = excluded.track_token;
end $$;
grant execute on function submit_lead(text,text,text,text,text,text,text,text) to anon, authenticated;

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
returns table(ref text, created_at timestamptz, updated_at timestamptz, first_name text, summary text, status text, price numeric, can_confirm boolean, confirmed boolean, closed boolean, share_code text, friends_done int, credit numeric, credit_each numeric)
language sql stable security definer set search_path = public as $$
  select l.ref,
         case when l.closed then null else l.created_at end,
         case when l.closed then null else l.updated_at end,
         case when l.closed then null else split_part(coalesce(l.customer_name,''),' ',1) end,
         case when l.closed then null else l.summary end,
         case when l.closed then 'closed' else l.status end,
         case when not l.closed and l.status in ('quoted','booked','done') then l.price end,
         (not l.closed and l.status = 'done' and l.customer_confirmed_at is null),
         (l.customer_confirmed_at is not null),
         l.closed,
         l.share_code,
         f.n,
         f.n * ce.v,
         ce.v
  from (select x.*, (x.customer_confirmed_at is not null and x.paid_at is not null) as closed
        from leads x where x.track_token = p_token and length(coalesce(p_token,'')) >= 24) l
  cross join lateral (select count(*)::int as n from leads y where y.referrer_code = l.share_code and y.status = 'done') f
  cross join lateral (select coalesce((select value::numeric from settings where key = 'customer_credit'), 0) as v) ce;
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
returns table(track_token text, ref text, created_at timestamptz, completed_at timestamptz, customer text, summary text, status text, price numeric, commission numeric, commission_paid boolean, commission_paid_at timestamptz, pct numeric)
language sql stable security definer set search_path = public as $$
  select l.track_token, l.ref, l.created_at, l.completed_at,
         left(coalesce(l.customer_name,''),1) || '.' as customer,
         l.summary, l.status, l.price, c.commission, l.commission_paid, l.commission_paid_at, c.pct
  from leads l join partners p on p.id = l.partner_id
  left join lead_calc c on c.lead_id = l.id
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
declare c record; nm text;
begin
  if new.partner_id is null then return new; end if;
  if tg_op = 'INSERT' then
    insert into notifications(partner_id, text) values (new.partner_id, 'Yeni talep geldi: ' || coalesce(new.summary,'is'));
    return new;
  end if;
  select * into c from lead_calc where lead_id = new.id;
  if new.status = 'done' and old.status is distinct from 'done' then
    insert into notifications(partner_id, text) values (new.partner_id, 'Is tamamlandi: ' || coalesce(new.summary,'is') || case when c.commission is not null then ' - komisyonun $' || c.commission else '' end);
    if c.sponsor_id is not null then
      select split_part(name,' ',1) into nm from partners where id = new.partner_id;
      insert into notifications(partner_id, text) values (c.sponsor_id, 'Ekibinden ' || coalesce(nm,'bir ortak') || ' bir is tamamladi' || case when c.override_amt is not null then ' - payin $' || c.override_amt else '' end);
    end if;
  end if;
  if new.commission_paid and not old.commission_paid then
    insert into notifications(partner_id, text) values (new.partner_id, 'Komisyon odemesi yapildi: ' || coalesce(new.summary,'is') || case when c.commission is not null then ' ($' || c.commission || ')' else '' end);
  end if;
  if new.override_paid and not old.override_paid and c.sponsor_id is not null then
    insert into notifications(partner_id, text) values (c.sponsor_id, 'Ekip payi odendi' || case when c.override_amt is not null then ' ($' || c.override_amt || ')' else '' end);
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


-- ---------- Program: yetkiler ve fonksiyonlar ----------
drop policy if exists admin_all_tiers on tiers;
create policy admin_all_tiers on tiers for all using (is_admin()) with check (is_admin());
drop policy if exists admin_all_settings on settings;
create policy admin_all_settings on settings for all using (is_admin()) with check (is_admin());

create or replace function admin_lead_calc()
returns table(lead_id uuid, pct numeric, commission numeric, sponsor_id uuid, override_pct numeric, override_amt numeric)
language sql stable security definer set search_path = public as $$
  select c.lead_id, c.pct, c.commission, c.sponsor_id, c.override_pct, c.override_amt from lead_calc c where is_admin();
$$;
grant execute on function admin_lead_calc() to authenticated;

create or replace function my_level()
returns table(jobs_month int, next_pct numeric, to_next_jobs int, next_tier_pct numeric)
language sql stable security definer set search_path = public as $$
  with me as (select id, commission_pct from partners where lower(email) = lower(coalesce(auth.jwt() ->> 'email',''))),
  j as (select count(*)::int as n from leads l, me where l.partner_id = me.id and l.status = 'done' and date_trunc('month', l.completed_at) = date_trunc('month', now())),
  cur as (select j.n, greatest(me.commission_pct, coalesce((select max(t.pct) from tiers t where t.min_jobs <= j.n + 1), 0)) as pct from j, me)
  select cur.n, cur.pct,
         (select t.min_jobs - cur.n from tiers t where t.min_jobs > cur.n + 1 and t.pct > cur.pct order by t.min_jobs limit 1),
         (select t.pct from tiers t where t.min_jobs > cur.n + 1 and t.pct > cur.pct order by t.min_jobs limit 1)
  from cur;
$$;
grant execute on function my_level() to authenticated;

create table if not exists partner_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  sponsor_code text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);
alter table partner_applications enable row level security;
drop policy if exists admin_all_apps on partner_applications;
create policy admin_all_apps on partner_applications for all using (is_admin()) with check (is_admin());

create or replace function apply_partner(p_name text, p_email text, p_phone text, p_sponsor text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(trim(p_name),'') = '' or coalesce(p_email,'') !~ '^[^@ ]+@[^@ ]+[.][^@ ]+$' then raise exception 'invalid'; end if;
  if exists (select 1 from partners where lower(email) = lower(trim(p_email))) then return; end if;
  if exists (select 1 from partner_applications where lower(email) = lower(trim(p_email)) and status = 'pending') then return; end if;
  insert into partner_applications(name, email, phone, sponsor_code)
  values (left(trim(p_name),120), lower(left(trim(p_email),200)), left(p_phone,40), nullif(upper(left(trim(coalesce(p_sponsor,'')),12)),''));
end $$;
grant execute on function apply_partner(text,text,text,text) to anon, authenticated;

create or replace function approve_application(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a partner_applications; sp uuid; nc text; chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int;
begin
  if not is_admin() then raise exception 'admin only'; end if;
  select * into a from partner_applications where id = p_id and status = 'pending';
  if not found then return; end if;
  select id into sp from partners where code = a.sponsor_code and active;
  loop
    nc := ''; for i in 1..6 loop nc := nc || substr(chars, 1 + floor(random() * length(chars))::int, 1); end loop;
    exit when not exists (select 1 from partners where code = nc);
  end loop;
  insert into partners(name, email, phone, code, parent_id) values (a.name, a.email, a.phone, nc, sp) on conflict (email) do nothing;
  update partner_applications set status = 'approved' where id = p_id;
  if sp is not null then insert into notifications(partner_id, text) values (sp, 'Ekibine yeni ortak katildi: ' || a.name); end if;
end $$;
grant execute on function approve_application(uuid) to authenticated;

-- Ortak: ekibi (sadece dogrudan getirdikleri; tek kademe) ve ekip payi
create or replace function my_team()
returns table(name text, joined timestamptz, active boolean, jobs_done int, earned numeric, pending numeric)
language sql stable security definer set search_path = public as $$
  select split_part(c.name,' ',1) || coalesce(' ' || left(nullif(split_part(c.name,' ',2),''),1) || '.', ''),
         c.created_at, c.active,
         (select count(*)::int from lead_calc k where k.partner_id = c.id),
         coalesce((select sum(k.override_amt) from lead_calc k join leads l on l.id = k.lead_id where k.partner_id = c.id and l.override_paid), 0),
         coalesce((select sum(k.override_amt) from lead_calc k join leads l on l.id = k.lead_id where k.partner_id = c.id and not l.override_paid), 0)
  from partners c join partners me on me.id = c.parent_id
  where lower(me.email) = lower(coalesce(auth.jwt() ->> 'email',''))
  order by c.created_at;
$$;
grant execute on function my_team() to authenticated;

create or replace function my_overrides()
returns table(ref text, who text, summary text, completed_at timestamptz, amount numeric, paid boolean, paid_at timestamptz)
language sql stable security definer set search_path = public as $$
  select l.ref, split_part(c.name,' ',1), l.summary, l.completed_at, k.override_amt, l.override_paid, l.override_paid_at
  from lead_calc k join leads l on l.id = k.lead_id join partners c on c.id = k.partner_id join partners me on me.id = k.sponsor_id
  where lower(me.email) = lower(coalesce(auth.jwt() ->> 'email','')) and k.override_amt is not null
  order by l.completed_at desc;
$$;
grant execute on function my_overrides() to authenticated;

-- Yonetici (e-postani degistir!)
insert into admins(email) values (lower('BURAYA_KENDI_EPOSTAN@ornek.com')) on conflict do nothing;
