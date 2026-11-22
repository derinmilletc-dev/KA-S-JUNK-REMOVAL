# Kurulum rehberi (basit anlatim)

Sirayla yap. Her adimdan sonra `portal/setup-check.html` sayfasini ac, yesil isaretleri gor.

## 1. Supabase projesi
1. supabase.com > yeni proje ac (Kais icin ayri proje). Bolge: East US.
2. **SQL Editor** > yeni sorgu > `supabase/schema.sql` dosyasinin TAMAMINI yapistir > son satirdaki `BURAYA_KENDI_EPOSTAN@ornek.com` yerine kendi e-postani yaz > Run.
3. Hata cikarsa bana yapistir. Dosya tekrar calistirilabilir, zarar vermez.

## 2. Siteye baglama
1. Supabase > Project Settings > API: **Project URL** ve **anon public** anahtarini kopyala.
2. `portal/config.js` icine yaz (service_role anahtarini ASLA yazma).
3. GitHub'a gonder, Vercel otomatik yayinlar.

## 3. Giris ayari
Supabase > Authentication > URL Configuration:
- Site URL: sitenin adresi (ornek `https://siten.vercel.app`)
- Redirect URLs: `https://siten.vercel.app/portal/*`

## 4. Ilk deneme (30 dakika)
1. `portal/admin.html` > e-postanla giris yap (mailine baglanti gelir).
2. Admin > Ortaklar: kendine ikinci bir e-postayla deneme ortagi ekle.
3. Admin > Ayarlar > Ekip: deneme ekibi ekle.
4. Ortak linkiyle siteden deneme talebi gonder. Admin > Bugun'de gorunmeli.
5. Teklif yaz, durumu "Teklif verildi" yap. Takip linkini ac, "Accept this quote" calismali.
6. Randevu ver, ekip ata. `portal/crew.html` ile gir: Yoldayim > foto > Bitti.
7. Is tutarini gir, "Odeme alindi", musteri takip sayfasinda "hizmet yerine getirildi" de. Makbuz acilmali.
8. Ortak panelinde komisyon gorunmeli. Admin > Para > Odemeler'den "Odendi yap".

## 5. Alan adi
Vercel > Domains > alan adini ekle, DNS kayitlarini alan adi saglayicina gir. Sonra:
`SITE_URL=https://alanadin.com python3 tools/build_cities.py` (sitemap + robots uretir) ve Supabase Site URL'ini guncelle.

## 6. E-posta bildirimleri (istege bagli)
1. resend.com hesabi, API anahtari al (ucretsiz paket yeter). Kendi alan adini dogrula (yoksa test adresi sadece kendi mailine gonderir).
2. Supabase CLI ile: `supabase functions deploy notify` ve `supabase functions deploy daily-brief`.
3. Supabase > Edge Functions > Secrets: `RESEND_API_KEY`, `WEBHOOK_SECRET` (uydur), `CRON_SECRET` (uydur), `FROM_EMAIL`, `PANEL_URL` (site adresi, sonunda / yok).
4. Supabase > Database > Webhooks > yeni: tablo `leads` (Insert + Update) tablo `support_msgs` (Insert) ve tablo `partners` (Insert: yeni ortaga otomatik hos geldin e-postasi, Ingilizce + Ispanyolca), tur "Supabase Edge Functions" > `notify`, HTTP header: `x-webhook-secret` = WEBHOOK_SECRET.
5. Sabah ozeti ve ortak haftalik ozeti: Database > Cron (pg_cron) ile `daily-brief` ve `weekly-digest` fonksiyonlarini `x-cron-secret` basligiyla zamanla.

Gonderilen e-postalar: yeni talep (admin), teklif kabul (admin), ekip bitirdi (admin), is bitti / odeme alindi (ortak), destek mesaji, sabah ozeti.
Musteriye e-posta gitmez, cunku musteri e-postasi toplanmiyor; musteri takip sayfasindan haberdar olur.

## 7. Yedek
- Elle: Admin > Ayarlar > Yedek > "Tam yedek indir". Haftada bir yap. Bugun ekraninda 7 gunden fazla yedek almadiysan uyari cikar.
- Otomatik (istege bagli): `supabase functions deploy backup`, sonra pg_cron ile haftada bir `x-cron-secret` basligiyla cagir. Yedekler ozel "backups" kovasina yazilir, son 8 tanesi tutulur, Admin > Yedek sekmesinden indirilir.
- Fotograflar yedege dahil degildir (Supabase kendi gunluk yedegini tutar).

## 8. Telefona kurma (PWA)
Ortak, ekip ve admin sayfalari telefonda "ana ekrana ekle" teklif eder (Android: Kur butonu, iPhone: Safari Paylas > Ana Ekrana Ekle). Uygulama acikken yeni bildirimde telefon bildirimi cikar. Uygulama kapaliyken anlik bildirim (push) icin ayri sunucu kurulumu gerekir; simdilik e-posta bildirimleri bunu karsilar.

## Push bildirimi (telefon kapaliyken)
1. Secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (portal/config.js icindeki public ile ayni cift).
2. Deploy: `supabase functions deploy push` ve `supabase functions deploy daily-quote`.
3. Database > Webhooks: `notifications` Insert ve `leads` Insert -> Edge Function `push`.
4. Gunun sozu: pg_cron ile her gun `daily-quote` fonksiyonunu `x-cron-secret` basligiyla cagir (Florida 09:00 = UTC 14:00):
   `select cron.schedule('daily-quote','0 14 * * *',$$select net.http_post(url:='https://<PROJE>.supabase.co/functions/v1/daily-quote', headers:='{"x-cron-secret":"<CRON_SECRET>"}'::jsonb)$$);`
