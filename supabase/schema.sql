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
-- Spam/tekrar kaydi, randevu
alter table leads add column if not exists addr_key text;
alter table leads add column if not exists dup_of uuid references leads(id) on delete set null;
alter table leads add column if not exists scheduled_at timestamp;      -- Florida saati (duvar saati)
alter table leads add column if not exists when_text text;               -- musterinin istedigi zaman (siteden)
create index if not exists leads_addr_idx on leads(addr_key, created_at);
-- Tekrar musteri (12 ay) ve yorum takibi
alter table leads add column if not exists name_key text;
alter table leads add column if not exists repeat_of uuid references leads(id) on delete set null;
alter table leads add column if not exists repeat_hint uuid references leads(id) on delete set null;
alter table leads add column if not exists review_clicked_at timestamptz;
create index if not exists leads_name_idx on leads(name_key);
update leads set name_key = lower(regexp_replace(coalesce(customer_name,''),'[^a-zA-Z0-9]','','g')) where name_key is null;
-- Kaynak takibi, ekip, depozito
alter table leads add column if not exists source text;
alter table leads add column if not exists campaign text;
alter table leads add column if not exists crew_status text check (crew_status in ('enroute','working','finished'));
alter table leads add column if not exists crew_started_at timestamptz;
alter table leads add column if not exists crew_finished_at timestamptz;
alter table leads add column if not exists crew_note text;
alter table leads add column if not exists deposit_amount numeric(10,2);
alter table leads add column if not exists deposit_paid_at timestamptz;
create table if not exists crews (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table crews enable row level security;
alter table leads add column if not exists crew_id uuid references crews(id) on delete set null;
create index if not exists leads_crew_idx on leads(crew_id, scheduled_at);
update leads set addr_key = lower(regexp_replace(coalesce(address,''),'[^a-zA-Z0-9]','','g')) where addr_key is null;

create table if not exists rate_limits (key text not null, at timestamptz not null default now());
create index if not exists rate_limits_idx on rate_limits(key, at);
alter table rate_limits enable row level security;

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  bonus_pct numeric(5,2) not null default 0 check (bonus_pct between 0 and 100),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table campaigns enable row level security;

create table if not exists audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor text,
  tbl text not null,
  row_id text,
  label text,
  field text,
  old_val text,
  new_val text
);
alter table audit_log enable row level security;
create index if not exists audit_at_idx on audit_log(at desc);

create table if not exists tiers (min_jobs int primary key check (min_jobs > 0), pct numeric(5,2) not null check (pct between 0 and 100));
insert into tiers values (5, 25), (10, 30) on conflict do nothing;
create table if not exists settings (key text primary key, value text not null);
insert into settings values ('customer_credit', '20') on conflict do nothing;
insert into settings values ('deposit_note', ''), ('repeat_pct', '10'), ('range_pct', '20'), ('min_charge', '0'), ('pricing_on', 'false'), ('review_url', '') on conflict do nothing;
create table if not exists price_list (key text primary key, price numeric(10,2) not null check (price >= 0));
alter table price_list enable row level security;
alter table tiers enable row level security;
alter table settings enable row level security;

-- Her tamamlanan is icin: komisyon yuzdesi (son 30 gundeki is sayisina gore seviye; performans dusunce seviye de duser) ve ust ortak payi
drop view if exists lead_calc;
create view lead_calc as
with d as (
  select l.id, l.partner_id, l.price, l.completed_at, l.repeat_of,
         count(*) over (partition by l.partner_id order by l.completed_at range between interval '30 days' preceding and current row) as pos
  from leads l where l.status = 'done' and l.partner_id is not null and l.completed_at is not null
), e as (
  select d.*, p.parent_id, p.override_pct as ov_pct,
         case when d.repeat_of is not null
              then coalesce((select s.value::numeric from settings s where s.key = 'repeat_pct'), 10)
              else least(100,
                     greatest(p.commission_pct, coalesce((select max(t.pct) from tiers t where t.min_jobs <= d.pos), 0))
                     + coalesce((select sum(c.bonus_pct) from campaigns c where c.active and d.completed_at >= c.starts_at and d.completed_at <= c.ends_at), 0))
         end as eff_pct,
         case when d.repeat_of is not null then 0
              else coalesce((select sum(c.bonus_pct) from campaigns c where c.active and d.completed_at >= c.starts_at and d.completed_at <= c.ends_at), 0)
         end as bonus_pct
  from d join partners p on p.id = d.partner_id
)
select e.id as lead_id, e.partner_id, e.pos,
       e.eff_pct as pct,
       e.bonus_pct,
       case when e.price is not null then round(e.price * e.eff_pct / 100, 2) end as commission,
       case when sp.active then e.parent_id end as sponsor_id,
       case when sp.active then e.ov_pct end as override_pct,
       case when sp.active and e.price is not null then round(e.price * e.ov_pct / 100, 2) end as override_amt
from e left join partners sp on sp.id = e.parent_id;
revoke all on lead_calc from anon, authenticated, public;

create or replace function client_key() returns text
language sql stable as $$
  select coalesce(nullif(split_part(coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1), ''), 'local');
$$;
create or replace function rate_ok(p_key text, p_max int, p_window interval) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from rate_limits where at < now() - interval '2 days' and random() < 0.02;
  select count(*) into n from rate_limits where key = p_key and at > now() - p_window;
  if n >= p_max then return false; end if;
  insert into rate_limits(key) values (p_key);
  return true;
end $$;
revoke all on function rate_ok(text,int,interval) from public, anon, authenticated;
revoke all on function client_key() from public, anon, authenticated;
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
drop function if exists submit_lead(text,text,text,text,text,text,text,text);
drop function if exists submit_lead(text,text,text,text,text,text,text,text,text);
create or replace function submit_lead(p_ref text, p_code text, p_name text, p_address text, p_summary text, p_message text, p_token text, p_rc text default null, p_when text default null, p_source text default null, p_campaign text default null)
returns void language plpgsql security definer set search_path = public as $$
declare pid uuid; pc text; rc text; ak text; dup uuid; ex uuid; ip text; nk text; hint uuid;
begin
  if p_ref is null or length(p_ref) not between 4 and 20 then return; end if;
  if p_token is null or p_token !~ '^[a-f0-9]{24,48}$' then return; end if;
  if length(trim(coalesce(p_name,''))) < 2 or length(trim(coalesce(p_address,''))) < 5 then return; end if;
  select id into ex from leads where ref = p_ref;
  if ex is not null then
    -- ayni talep duzenleniyor (sadece yeni ve ayni takip kodu)
    update leads set customer_name = left(p_name,120), address = left(p_address,300), summary = left(p_summary,500), message = left(p_message,3000),
           addr_key = lower(regexp_replace(coalesce(p_address,''),'[^a-zA-Z0-9]','','g')), when_text = left(p_when,100), name_key = lower(regexp_replace(coalesce(p_name,''),'[^a-zA-Z0-9]','','g'))
     where id = ex and status = 'new' and track_token = p_token;
    return;
  end if;
  ip := client_key();
  if not rate_ok('lead:' || ip, 6, interval '1 hour') or not rate_ok('leadd:' || ip, 20, interval '1 day') then return; end if;
  ak := lower(regexp_replace(coalesce(p_address,''),'[^a-zA-Z0-9]','','g'));
  select id into dup from leads where addr_key = ak and created_at > now() - interval '7 days' and status in ('new','quoted','booked') order by created_at limit 1;
  select id, code into pid, pc from partners where code = upper(coalesce(p_code,'')) and active;
  select share_code into rc from leads where share_code = lower(coalesce(p_rc,'')) and length(coalesce(p_rc,'')) = 8;
  nk := lower(regexp_replace(coalesce(p_name,''),'[^a-zA-Z0-9]','','g'));
  -- ortaksiz gelen ama 12 ay icinde ortakli is yaptirmis ayni isimli musteri: admin onayina oner
  if pid is null and dup is null and length(nk) >= 5 then
    select l.id into hint from leads l where l.name_key = nk and l.partner_id is not null and l.repeat_of is null
       and l.status = 'done' and l.completed_at > now() - interval '12 months' order by l.completed_at desc limit 1;
  end if;
  -- tekrar kayit: ortak payi sadece ilk kayda gider
  insert into leads(ref, partner_id, partner_code, customer_name, address, summary, message, track_token, referrer_code, addr_key, dup_of, when_text, name_key, repeat_hint, source, campaign)
  values (p_ref, case when dup is null then pid end, case when dup is null then pc end, left(p_name,120), left(p_address,300), left(p_summary,500), left(p_message,3000), p_token, rc, ak, dup, left(p_when,100), nk, hint, left(lower(regexp_replace(coalesce(p_source,''),'[^a-zA-Z0-9._ -]','','g')),40), left(lower(regexp_replace(coalesce(p_campaign,''),'[^a-zA-Z0-9._ -]','','g')),60));
end $$;
grant execute on function submit_lead(text,text,text,text,text,text,text,text,text,text,text) to anon, authenticated;

-- Ortak, kendi musterisi icin is olusturur (ozel takip linki uretilir)
create or replace function partner_create_lead(p_ref text, p_name text, p_address text, p_summary text, p_token text)
returns void language plpgsql security definer set search_path = public as $$
declare pid uuid; pc text; ak text;
begin
  select id, code into pid, pc from partners
   where lower(email) = lower(coalesce(auth.jwt() ->> 'email','')) and active;
  if pid is null then raise exception 'not a partner'; end if;
  if p_token is null or p_token !~ '^[a-f0-9]{24,48}$' then raise exception 'bad token'; end if;
  if length(trim(coalesce(p_name,''))) < 2 or length(trim(coalesce(p_address,''))) < 5 then raise exception 'name and address required'; end if;
  if not rate_ok('pcl:' || pid::text, 30, interval '1 hour') then raise exception 'too many requests, try later'; end if;
  ak := lower(regexp_replace(coalesce(p_address,''),'[^a-zA-Z0-9]','','g'));
  if exists (select 1 from leads where addr_key = ak and created_at > now() - interval '7 days' and status in ('new','quoted','booked')) then
    raise exception 'duplicate: this address already has an open request';
  end if;
  insert into leads(ref, partner_id, partner_code, customer_name, address, summary, track_token, addr_key, name_key)
  values (left(p_ref,20), pid, pc, left(p_name,120), left(p_address,300), left(p_summary,500), p_token, ak, lower(regexp_replace(coalesce(p_name,''),'[^a-zA-Z0-9]','','g')));
end $$;
grant execute on function partner_create_lead(text,text,text,text,text) to authenticated;

-- Musteri takip sayfasi: sadece ozel kodu bilen gorur, hassas bilgi donmez.
-- Hizmet onayi (musteri) + odeme onayi (admin) tamamlaninca link kapanir: detay donmez.
drop function if exists track_lead(text);
create or replace function track_lead(p_token text)
returns table(ref text, created_at timestamptz, updated_at timestamptz, first_name text, summary text, status text, price numeric, can_confirm boolean, confirmed boolean, closed boolean, share_code text, friends_done int, credit numeric, credit_each numeric, scheduled_at timestamp, review_url text, crew_status text, deposit_amount numeric, deposit_paid boolean, deposit_note text, paid boolean)
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
         ce.v,
         case when l.closed then null else l.scheduled_at end,
         case when l.customer_confirmed_at is not null then nullif((select value from settings where key = 'review_url'), '') end,
         case when not l.closed and l.status in ('booked','done') then l.crew_status end,
         case when not l.closed then l.deposit_amount end,
         (l.deposit_paid_at is not null),
         case when not l.closed and l.deposit_amount > 0 and l.deposit_paid_at is null then nullif((select value from settings where key = 'deposit_note'), '') end,
         (l.paid_at is not null)
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
returns table(track_token text, ref text, created_at timestamptz, completed_at timestamptz, customer text, summary text, status text, price numeric, commission numeric, commission_paid boolean, commission_paid_at timestamptz, pct numeric, is_repeat boolean)
language sql stable security definer set search_path = public as $$
  select l.track_token, l.ref, l.created_at, l.completed_at,
         left(coalesce(l.customer_name,''),1) || '.' as customer,
         l.summary, l.status, l.price, c.commission, l.commission_paid, l.commission_paid_at, c.pct, (l.repeat_of is not null)
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

drop function if exists admin_lead_calc();
create or replace function admin_lead_calc()
returns table(lead_id uuid, pct numeric, commission numeric, sponsor_id uuid, override_pct numeric, override_amt numeric, bonus_pct numeric)
language sql stable security definer set search_path = public as $$
  select c.lead_id, c.pct, c.commission, c.sponsor_id, c.override_pct, c.override_amt, c.bonus_pct from lead_calc c where is_admin();
$$;
grant execute on function admin_lead_calc() to authenticated;

create or replace function my_level()
returns table(jobs_month int, next_pct numeric, to_next_jobs int, next_tier_pct numeric)
language sql stable security definer set search_path = public as $$
  with me as (select id, commission_pct from partners where lower(email) = lower(coalesce(auth.jwt() ->> 'email',''))),
  j as (select count(*)::int as n from leads l, me where l.partner_id = me.id and l.status = 'done' and l.completed_at > now() - interval '30 days'),
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
alter table partner_applications add column if not exists kind text not null default 'individual';
alter table partner_applications add column if not exists company text;
alter table partner_applications add column if not exists note text;
alter table partner_applications enable row level security;
drop policy if exists admin_all_apps on partner_applications;
create policy admin_all_apps on partner_applications for all using (is_admin()) with check (is_admin());

drop function if exists apply_partner(text,text,text,text);
create or replace function apply_partner(p_name text, p_email text, p_phone text, p_sponsor text, p_kind text default 'individual', p_company text default null, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(trim(p_name),'') = '' or coalesce(p_email,'') !~ '^[^@ ]+@[^@ ]+[.][^@ ]+$' then raise exception 'invalid'; end if;
  if not rate_ok('app:' || client_key(), 3, interval '1 hour') then raise exception 'too many requests'; end if;
  if exists (select 1 from partners where lower(email) = lower(trim(p_email))) then return; end if;
  if exists (select 1 from partner_applications where lower(email) = lower(trim(p_email)) and status = 'pending') then return; end if;
  insert into partner_applications(name, email, phone, sponsor_code, kind, company, note)
  values (left(trim(p_name),120), lower(left(trim(p_email),200)), left(p_phone,40), nullif(upper(left(trim(coalesce(p_sponsor,'')),12)),''),
          case when p_kind = 'business' then 'business' else 'individual' end, left(p_company,120), left(p_note,300));
end $$;
grant execute on function apply_partner(text,text,text,text,text,text,text) to anon, authenticated;

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


-- ---------- Kampanyalar, haftalik ozet, denetim kaydi ----------
drop policy if exists admin_all_campaigns on campaigns;
create policy admin_all_campaigns on campaigns for all using (is_admin()) with check (is_admin());
drop policy if exists admin_read_audit on audit_log;
create policy admin_read_audit on audit_log for select using (is_admin());
revoke update, delete, truncate on audit_log from anon, authenticated;

create or replace function active_campaigns()
returns table(title text, body text, bonus_pct numeric, starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.title, c.body, c.bonus_pct, c.starts_at, c.ends_at from campaigns c
  where c.active and c.ends_at > now()
    and exists (select 1 from partners p where lower(p.email) = lower(coalesce(auth.jwt() ->> 'email','')) and p.active)
  order by c.starts_at;
$$;
grant execute on function active_campaigns() to authenticated;

create or replace function campaign_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.active then
    insert into notifications(partner_id, text)
    select p.id, 'Yeni kampanya: ' || new.title || case when new.bonus_pct > 0 then ' (+%' || new.bonus_pct || ' komisyon)' else '' end
    from partners p where p.active;
  end if;
  return new;
end $$;
drop trigger if exists campaigns_notify on campaigns;
create trigger campaigns_notify after insert on campaigns for each row execute function campaign_notify();

-- Ortak: son 7 gun ozeti
create or replace function my_week()
returns table(requests int, done int, earned numeric, team_new int)
language sql stable security definer set search_path = public as $$
  with me as (select id from partners where lower(email) = lower(coalesce(auth.jwt() ->> 'email','')))
  select (select count(*)::int from leads l, me where l.partner_id = me.id and l.created_at > now() - interval '7 days'),
         (select count(*)::int from leads l, me where l.partner_id = me.id and l.status = 'done' and l.completed_at > now() - interval '7 days'),
         coalesce((select sum(c.commission) from lead_calc c join leads l on l.id = c.lead_id, me where c.partner_id = me.id and l.completed_at > now() - interval '7 days'), 0)
         + coalesce((select sum(c.override_amt) from lead_calc c join leads l on l.id = c.lead_id, me where c.sponsor_id = me.id and l.completed_at > now() - interval '7 days'), 0),
         (select count(*)::int from partners ch, me where ch.parent_id = me.id and ch.created_at > now() - interval '7 days');
$$;
grant execute on function my_week() to authenticated;

-- Haftalik e-posta icin (sadece service_role / Edge Function cagirir)
create or replace function weekly_digest()
returns table(email text, name text, requests int, done int, earned numeric, team_new int, pending numeric)
language sql stable security definer set search_path = public as $$
  select p.email, p.name,
         (select count(*)::int from leads l where l.partner_id = p.id and l.created_at > now() - interval '7 days'),
         (select count(*)::int from leads l where l.partner_id = p.id and l.status = 'done' and l.completed_at > now() - interval '7 days'),
         coalesce((select sum(c.commission) from lead_calc c join leads l on l.id = c.lead_id where c.partner_id = p.id and l.completed_at > now() - interval '7 days'), 0)
         + coalesce((select sum(c.override_amt) from lead_calc c join leads l on l.id = c.lead_id where c.sponsor_id = p.id and l.completed_at > now() - interval '7 days'), 0),
         (select count(*)::int from partners ch where ch.parent_id = p.id and ch.created_at > now() - interval '7 days'),
         coalesce((select sum(c.commission) from lead_calc c join leads l on l.id = c.lead_id where c.partner_id = p.id and not l.commission_paid), 0)
         + coalesce((select sum(c.override_amt) from lead_calc c join leads l on l.id = c.lead_id where c.sponsor_id = p.id and not l.override_paid), 0)
  from partners p where p.active;
$$;
revoke all on function weekly_digest() from public, anon, authenticated;
do $$ begin if exists (select 1 from pg_roles where rolname = 'service_role') then grant execute on function weekly_digest() to service_role; end if; end $$;

-- Denetim kaydi: kim neyi ne zaman degistirdi (silinemez/degistirilemez)
create or replace function audit_changes() returns trigger
language plpgsql security definer set search_path = public as $$
declare o jsonb; n jsonb; r jsonb; k text; watch text[]; who text; lbl text; rid text;
begin
  o := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  n := case when tg_op in ('UPDATE','INSERT') then to_jsonb(new) end;
  r := coalesce(n, o);
  who := coalesce(nullif(auth.jwt() ->> 'email',''), 'sistem/site');
  lbl := coalesce(r ->> 'ref', r ->> 'name', r ->> 'title', r ->> 'key', r ->> 'min_jobs', r ->> 'customer_name', '');
  rid := coalesce(r ->> 'id', r ->> 'min_jobs', r ->> 'key', '');
  watch := case tg_table_name
    when 'leads' then array['status','price','commission_paid','override_paid','paid_at','customer_confirmed_at','partner_id','scheduled_at','dup_of','repeat_of','crew_id','crew_status','deposit_amount','deposit_paid_at']
    when 'partners' then array['commission_pct','override_pct','active','parent_id','email','name','payout_info']
    when 'tiers' then array['pct']
    when 'price_list' then array['price']
    when 'crews' then array['name','email','active']
    when 'settings' then array['value']
    when 'campaigns' then array['title','bonus_pct','starts_at','ends_at','active']
    when 'claims' then array['status','admin_note']
    when 'partner_applications' then array['status']
    else array[]::text[] end;
  if tg_op = 'UPDATE' then
    foreach k in array watch loop
      if (o -> k) is distinct from (n -> k) then
        insert into audit_log(actor, tbl, row_id, label, field, old_val, new_val)
        values (who, tg_table_name, rid, lbl, k,
                case when k = 'payout_info' then '(gizli)' else left(o ->> k, 200) end,
                case when k = 'payout_info' then '(degisti)' else left(n ->> k, 200) end);
      end if;
    end loop;
  elsif tg_op = 'INSERT' then
    insert into audit_log(actor, tbl, row_id, label, field, new_val) values (who, tg_table_name, rid, lbl, 'olusturuldu', left((n - 'payout_info')::text, 300));
  else
    insert into audit_log(actor, tbl, row_id, label, field, old_val) values (who, tg_table_name, rid, lbl, 'silindi', left((o - 'payout_info')::text, 300));
  end if;
  return null;
end $$;
drop trigger if exists audit_leads on leads;
create trigger audit_leads after update on leads for each row execute function audit_changes();
drop trigger if exists audit_partners on partners;
create trigger audit_partners after insert or update or delete on partners for each row execute function audit_changes();
drop trigger if exists audit_tiers on tiers;
create trigger audit_tiers after insert or update or delete on tiers for each row execute function audit_changes();
drop trigger if exists audit_crews on crews;
create trigger audit_crews after insert or update or delete on crews for each row execute function audit_changes();
drop trigger if exists audit_price on price_list;
create trigger audit_price after insert or update or delete on price_list for each row execute function audit_changes();
drop trigger if exists audit_settings on settings;
create trigger audit_settings after insert or update or delete on settings for each row execute function audit_changes();
drop trigger if exists audit_campaigns on campaigns;
create trigger audit_campaigns after insert or update or delete on campaigns for each row execute function audit_changes();
drop trigger if exists audit_claims on claims;
create trigger audit_claims after update on claims for each row execute function audit_changes();
drop trigger if exists audit_apps on partner_applications;
create trigger audit_apps after update on partner_applications for each row execute function audit_changes();


-- ---------- Kurumsal, tekrar musteri, fiyat hesaplayici, yorum ----------
drop policy if exists admin_all_prices on price_list;
create policy admin_all_prices on price_list for all using (is_admin()) with check (is_admin());

-- Sitenin okudugu acik fiyat bilgisi (sadece admin acarsa gorunur)
create or replace function public_pricing() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'on', coalesce((select value = 'true' from settings where key = 'pricing_on'), false),
    'min', coalesce((select value::numeric from settings where key = 'min_charge'), 0),
    'range', coalesce((select value::numeric from settings where key = 'range_pct'), 20),
    'prices', coalesce((select json_object_agg(key, price) from price_list), '{}'::json));
$$;
grant execute on function public_pricing() to anon, authenticated;

-- Admin: muhtemel tekrar musteriyi ortaga bagla / reddet
create or replace function link_repeat(p_lead uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare l leads; r leads; pcode text;
begin
  if not is_admin() then raise exception 'admin only'; end if;
  select * into l from leads where id = p_lead;
  if not found or l.repeat_hint is null then return; end if;
  if not p_accept then update leads set repeat_hint = null where id = p_lead; return; end if;
  select * into r from leads where id = l.repeat_hint;
  if r.partner_id is null or not exists (select 1 from partners where id = r.partner_id and active) then
    update leads set repeat_hint = null where id = p_lead; return;
  end if;
  select code into pcode from partners where id = r.partner_id;
  update leads set partner_id = r.partner_id, partner_code = pcode, repeat_of = r.id, repeat_hint = null where id = p_lead;
  insert into notifications(partner_id, text) values (r.partner_id, 'Eski musterin tekrar is verdi: ' || coalesce(l.summary,'is') || ' (tekrar musteri payi)');
end $$;
grant execute on function link_repeat(uuid, boolean) to authenticated;

-- Musteri yorum linkine tikladi (takip kodu ile)
create or replace function mark_review_click(p_token text) returns void
language sql security definer set search_path = public as $$
  update leads set review_clicked_at = coalesce(review_clicked_at, now())
  where track_token = p_token and length(coalesce(p_token,'')) >= 24 and customer_confirmed_at is not null;
$$;
grant execute on function mark_review_click(text) to anon, authenticated;


-- ---------- Ekip paneli, galeri, yorumlar, destek, makbuz ----------
drop policy if exists admin_all_crews on crews;
create policy admin_all_crews on crews for all using (is_admin()) with check (is_admin());
drop policy if exists crew_self on crews;
create policy crew_self on crews for select using (lower(email) = lower(coalesce(auth.jwt() ->> 'email','')));

create table if not exists job_photos (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  crew_id uuid references crews(id) on delete set null,
  path text not null,
  kind text not null check (kind in ('before','after')),
  at timestamptz not null default now()
);
alter table job_photos enable row level security;
drop policy if exists admin_all_jphotos on job_photos;
create policy admin_all_jphotos on job_photos for all using (is_admin()) with check (is_admin());

create table if not exists gallery (
  id uuid primary key default gen_random_uuid(),
  title text,
  city text,
  before_url text not null,
  after_url text not null,
  visible boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table gallery enable row level security;
drop policy if exists admin_all_gallery on gallery;
create policy admin_all_gallery on gallery for all using (is_admin()) with check (is_admin());

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  stars int not null default 5 check (stars between 1 and 5),
  body text not null,
  visible boolean not null default true,
  created_at timestamptz not null default now()
);
alter table reviews enable row level security;
drop policy if exists admin_all_reviews on reviews;
create policy admin_all_reviews on reviews for all using (is_admin()) with check (is_admin());

create table if not exists support_msgs (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  from_admin boolean not null default false,
  body text not null,
  read_admin boolean not null default false,
  created_at timestamptz not null default now()
);
alter table support_msgs enable row level security;
create index if not exists support_idx on support_msgs(partner_id, created_at);
drop policy if exists admin_all_support on support_msgs;
create policy admin_all_support on support_msgs for all using (is_admin()) with check (is_admin());

-- Admin yanit yazinca ortaga bildirim
create or replace function support_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.from_admin then
    insert into notifications(partner_id, text) values (new.partner_id, 'Destek yaniti: ' || left(new.body, 80));
  end if;
  return new;
end $$;
drop trigger if exists support_notify_t on support_msgs;
create trigger support_notify_t after insert on support_msgs for each row execute function support_notify();

create or replace function my_support() returns table(id uuid, from_admin boolean, body text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.id, m.from_admin, m.body, m.created_at from support_msgs m join partners p on p.id = m.partner_id
  where lower(p.email) = lower(coalesce(auth.jwt() ->> 'email','')) order by m.created_at limit 200;
$$;
grant execute on function my_support() to authenticated;

create or replace function partner_support_send(p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  select id into pid from partners where lower(email) = lower(coalesce(auth.jwt() ->> 'email','')) and active;
  if pid is null then raise exception 'not a partner'; end if;
  if length(trim(coalesce(p_body,''))) < 2 then raise exception 'empty'; end if;
  if not rate_ok('sup:' || pid::text, 20, interval '1 hour') then raise exception 'too many messages, try later'; end if;
  insert into support_msgs(partner_id, body) values (pid, left(trim(p_body), 1000));
end $$;
grant execute on function partner_support_send(text) to authenticated;

-- Sitenin okudugu acik icerik: galeri + yorumlar (sadece gorunur olanlar)
create or replace function public_content() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'gallery', coalesce((select json_agg(json_build_object('title', g.title, 'city', g.city, 'before', g.before_url, 'after', g.after_url) order by g.sort, g.created_at desc) from gallery g where g.visible), '[]'::json),
    'reviews', coalesce((select json_agg(json_build_object('name', r.name, 'city', r.city, 'stars', r.stars, 'body', r.body) order by r.created_at desc) from reviews r where r.visible), '[]'::json));
$$;
grant execute on function public_content() to anon, authenticated;

-- Makbuz: sadece odemesi alinmis ve fiyati girilmis is, takip koduyla
create or replace function receipt_lead(p_token text)
returns table(ref text, paid_at timestamptz, completed_at timestamptz, customer_name text, address text, summary text, price numeric, deposit numeric)
language sql stable security definer set search_path = public as $$
  select l.ref, l.paid_at, l.completed_at, l.customer_name, l.address, l.summary, l.price,
         case when l.deposit_paid_at is not null then l.deposit_amount end
  from leads l where l.track_token = p_token and length(coalesce(p_token,'')) >= 24 and l.paid_at is not null and l.price is not null and l.status = 'done';
$$;
grant execute on function receipt_lead(text) to anon, authenticated;

-- ---------- Ekip fonksiyonlari ----------
create or replace function crew_me() returns uuid
language sql stable security definer set search_path = public as $$
  select id from crews where lower(email) = lower(coalesce(auth.jwt() ->> 'email','')) and active;
$$;
revoke all on function crew_me() from public, anon;
grant execute on function crew_me() to authenticated;

-- Ekibin isleri: bugunden itibaren (Florida), bitmis olanlar son 3 gun. Fiyat/ortak bilgisi YOK.
create or replace function crew_jobs()
returns table(id uuid, ref text, scheduled_at timestamp, customer_name text, address text, summary text, access text, note text, status text, crew_status text, crew_note text, photos int)
language sql stable security definer set search_path = public as $$
  select l.id, l.ref, l.scheduled_at, l.customer_name, l.address, l.summary,
         substring(l.message from E'Access: ([^\n]*)'), substring(l.message from E'Notes: ([^\n]*)'),
         l.status, l.crew_status, l.crew_note,
         (select count(*)::int from job_photos j where j.lead_id = l.id)
  from leads l
  where l.crew_id = crew_me() and l.status in ('new','quoted','booked','done')
    and (l.crew_status is distinct from 'finished' or l.crew_finished_at > now() - interval '3 days')
    and (l.scheduled_at is null or l.scheduled_at >= (now() at time zone 'America/New_York')::date - 1)
  order by l.scheduled_at nulls last, l.created_at;
$$;
grant execute on function crew_jobs() to authenticated;

create or replace function crew_set_status(p_lead uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare c uuid;
begin
  c := crew_me();
  if c is null then raise exception 'not crew'; end if;
  if p_status not in ('enroute','working','finished') then raise exception 'bad status'; end if;
  if p_status = 'finished' and not exists (select 1 from job_photos where lead_id = p_lead and kind = 'after') then
    raise exception 'add at least one after photo first';
  end if;
  update leads set crew_status = p_status,
         crew_started_at = case when p_status = 'enroute' and crew_started_at is null then now() else crew_started_at end,
         crew_finished_at = case when p_status = 'finished' then now() else crew_finished_at end,
         crew_note = coalesce(left(p_note, 500), crew_note)
   where id = p_lead and crew_id = c;
  if not found then raise exception 'not your job'; end if;
end $$;
grant execute on function crew_set_status(uuid, text, text) to authenticated;

create or replace function crew_add_photo(p_lead uuid, p_path text, p_kind text) returns void
language plpgsql security definer set search_path = public as $$
declare c uuid;
begin
  c := crew_me();
  if c is null then raise exception 'not crew'; end if;
  if p_kind not in ('before','after') then raise exception 'bad kind'; end if;
  if split_part(p_path, '/', 1) <> p_lead::text then raise exception 'bad path'; end if;
  if not exists (select 1 from leads where id = p_lead and crew_id = c) then raise exception 'not your job'; end if;
  if (select count(*) from job_photos where lead_id = p_lead) >= 30 then raise exception 'too many photos'; end if;
  insert into job_photos(lead_id, crew_id, path, kind) values (p_lead, c, left(p_path, 200), p_kind);
end $$;
grant execute on function crew_add_photo(uuid, text, text) to authenticated;

-- ---------- Depolama (Storage) kovalari ve yetkileri ----------
-- Storage yoksa veya yetki hatasi olursa hata vermez, sadece uyari yazar.
do $$ begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public) values ('job-photos', 'job-photos', false) on conflict (id) do nothing;
    insert into storage.buckets (id, name, public) values ('gallery', 'gallery', true) on conflict (id) do nothing;
    drop policy if exists "jp_crew_insert" on storage.objects;
    create policy "jp_crew_insert" on storage.objects for insert to authenticated with check (
      bucket_id = 'job-photos' and exists (select 1 from public.leads l where l.id::text = (storage.foldername(name))[1] and l.crew_id = public.crew_me()));
    drop policy if exists "jp_read" on storage.objects;
    create policy "jp_read" on storage.objects for select to authenticated using (
      bucket_id = 'job-photos' and (public.is_admin() or exists (select 1 from public.leads l where l.id::text = (storage.foldername(name))[1] and l.crew_id = public.crew_me())));
    drop policy if exists "gal_admin_write" on storage.objects;
    create policy "gal_admin_write" on storage.objects for insert to authenticated with check (bucket_id = 'gallery' and public.is_admin());
    drop policy if exists "gal_admin_del" on storage.objects;
    create policy "gal_admin_del" on storage.objects for delete to authenticated using (bucket_id = 'gallery' and public.is_admin());
  end if;
exception when others then
  raise notice 'Storage ayari atlandi: %', sqlerrm;
end $$;

-- Yonetici (e-postani degistir!)
insert into admins(email) values (lower('BURAYA_KENDI_EPOSTAN@ornek.com')) on conflict do nothing;
