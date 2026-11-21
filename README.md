# Kais Junk Remove

Customer web page for Kais Junk Remove (Florida, USA). Static single page: `index.html`.

- Quote requests (photos + address) go to WhatsApp.
- Hosting: GitHub repo, published with Vercel. Database: Supabase (separate project from KaisPilot).
- Partner program and admin panel: planned, built here step by step.

## Ortak (partner) sistemi

1. Supabase projesi aç. SQL Editor'da `supabase/schema.sql` dosyasını çalıştır, sonra:
   `insert into admins(email) values ('senin@epostan.com');`
2. `portal/config.js` içine Project URL ve anon key yaz (service_role asla).
3. Authentication > URL Configuration: Site URL = sitenin adresi, Redirect URLs'e `https://ADRES/portal/*` ekle.
4. Yönetim: `/portal/admin.html` — ortak ekle, kod/QR al, işlere tutar gir, komisyon öde.
5. Ortak girişi: `/portal/partner.html` — kendi link/QR'ı ve işleri.
6. Müşteri `siteadresi/?ref=KOD` ile gelirse 30 gün hatırlanır, talep ortağa yazılır.
