# Kais Junk Remove

Customer web page for Kais Junk Remove (Florida, USA). Static single page: `index.html`.

- Quote requests (photos + address) go to WhatsApp.
- Hosting: GitHub repo, published with Vercel. Database: Supabase (separate project from KaisPilot).
- Partner program and admin panel: planned, built here step by step.

## Ortak (partner) sistemi

1. Supabase projesi aç. SQL Editor'da `supabase/schema.sql` dosyasını (içindeki e-postayı kendininkiyle değiştirip) tek seferde çalıştır.
2. `portal/config.js` içine Project URL ve anon key yaz (service_role asla).
3. Authentication > URL Configuration: Site URL = sitenin adresi, Redirect URLs'e `https://ADRES/portal/*` ekle.
4. Yönetim: `/portal/admin.html` — ortak ekle, kod/QR al, işlere tutar gir, komisyon öde.
5. Ortak girişi: `/portal/partner.html` — kendi link/QR'ı ve işleri.
6. Müşteri `siteadresi/?ref=KOD` ile gelirse 30 gün hatırlanır, talep ortağa yazılır.

### Musteri takibi
Her talebin ozel takip linki var (`track.html?t=KOD`). Musteri sitede forma doldurunca link ekranda ve WhatsApp mesajinda gelir. Ortak da kendi musterisi icin portaldan is acip link/QR alir. Durumu admin panelden degistirdikce musterinin sayfasi 30 sn icinde guncellenir.

### Ortak paneli ekleri
Komisyon varsayılanı %20 (ortak başına admin panelinden değişir). Ortak panelinde: bildirimler, ödeme geçmişi, hazır paylaşım metinleri, profil (telefon, ödeme bilgisi) ve "bu müşteri benim" itirazı. Admin panelinde "İtirazlar" sekmesi: onaylarsan iş koduna göre iş ortağa bağlanır ve ortağa bildirim gider. Bildirimler şimdilik panel içi; e-posta bildirimi için ayrı bir mail servisi gerekir.

### Büyüme programı (2 kademe, seviyeler, müşteri tavsiyesi)
- **Kural:** Para yalnızca gerçek müşterinin ödediği işten çıkar. Katılım ücreti yok, kazanç garantisi verilmez, en fazla 2 kademe. Yayına almadan önce bir avukata (Florida) danış.
- **2 kademe:** Ortak `join.html?sp=KOD` ile ortak davet eder. Başvuru admin panelinde "Başvurular" sekmesine düşer, onaylanınca davet edenin ekibine bağlanır. Davet eden, ekibin tamamlanan işlerinden "üst pay" alır (varsayılan %5, ortak başına değişir).
- **Seviyeler:** Ortağın son 30 gündeki iş sayısına göre yüzde artar (varsayılan 5 iş %25, 10 iş %30). İş azalınca seviye de düşer. Admin > Ortaklar > Program ayarları'ndan değişir. Ortağın kendi yüzdesi daha yüksekse o kalır.
- **Müşteri tavsiyesi:** İş tamamlanınca müşterinin takip sayfasında paylaşım linki çıkar (`?rc=KOD`). Gelen arkadaşın işi tamamlanınca müşteriye kredi ($20 varsayılan, ayarlardan değişir). Kredi ödemesi/indirimi şimdilik elle yapılır.

### Spam koruması, kayıt defteri, kampanya, takvim, rapor
- **Spam:** Sitede gizli tuzak alanı + 8 saniyeden hızlı doldurma = kayıt gönderilmez (WhatsApp yine çalışır). Sunucuda aynı IP'den saatte en fazla 6, günde 20 talep; ortak başvurusu saatte 3; ortak panelinden saatte 30 iş. Kısa ad/adres reddedilir.
- **Tekrar kayıt:** Aynı adres 7 gün içinde (açık iş varken) tekrar gelirse "Tekrar kayıt" olarak işaretlenir, ortak payı yalnızca ilk kayda gider. Ortak aynı adresle ikinci iş açamaz.
- **Kayıt defteri (admin > Kayıt):** İş durumu/tutar/ödeme, ortak yüzdeleri, seviyeler, ayarlar, kampanyalar, itirazlar ve başvurulardaki değişiklikler (kim, ne zaman, eski → yeni) otomatik tutulur. Silinemez/değiştirilemez.
- **Kampanya (admin > Kampanyalar):** Ortak panelinde duyuru + bildirim. Ek komisyon girersen tarih aralığında TAMAMLANAN işlere eklenir (Florida saatiyle).
- **Takvim (admin > Takvim):** İşlerde "Randevu (Florida)" alanı; randevu verince durum "Randevu" olur ve müşterinin takip sayfasında görünür.
- **Rapor (admin > Rapor):** Ay seçimi, ciro, ortak komisyonu, üst pay, müşteri kredisi, sana kalan, operasyon maliyeti (kendin girersin, tarayıcıda saklanır), ortak bazında tablo, son 6 ay, CSV.
- **Haftalık özet (ortak paneli):** Son 7 gün talep/tamamlanan/kazanç kartı hazır.

#### Haftalık e-posta (isteğe bağlı, ayrı kurulum)
`supabase/functions/weekly-digest` hazır ama kendiliğinden çalışmaz. Gerekenler: Resend hesabı + API anahtarı, doğrulanmış gönderici adresi.
1. `supabase functions deploy weekly-digest --no-verify-jwt`
2. `supabase secrets set RESEND_API_KEY=... FROM_EMAIL="Kais Junk Remove <info@alanadin.com>" CRON_SECRET=uzun-rastgele PANEL_URL=https://ADRES/portal/partner.html`
3. Supabase > Integrations > Cron: haftada bir (ör. Pazartesi 14:00 UTC) bu fonksiyonu `x-cron-secret: <CRON_SECRET>` başlığıyla çağır.

### Kurumsal sayfa, tekrar müşteri, fiyat hesaplayıcı, Google yorum
- **Kurumsal sayfa:** `business.html` (emlakçı, mülk yöneticisi, HOA). Başvuru admin > Başvurular'a "Kurumsal" etiketiyle düşer. Ana sitenin altında link var.
- **Tekrar müşteri (12 ay):** Ortaksız gelen bir iş, son 12 ayda ortaklı iş yaptırmış aynı isimli (en az 5 harf) müşteriyle eşleşirse işte "Muhtemel tekrar müşteri" çıkar. Admin "Ortağa bağla" derse ortak o işten sabit %10 alır (admin > Ortaklar > Program ayarları'ndan değişir; seviye/kampanya uygulanmaz) ve bildirim gider. Otomatik bağlanmaz, çünkü isim eşleşmesi yanlış olabilir.
- **Fiyat hesaplayıcı:** Admin > Fiyatlar. Kamyon dolulugu fiyatları (1/4, 1/2, 3/4, tam), isteğe bağlı eşya başı fiyat, minimum ücret ve aralık %. "Sitede göster" açılana ve fiyat girilene kadar sitede görünmez. Müşteri "tahmini fiyat" görür, WhatsApp mesajına da eklenir.
- **Google yorum:** Admin > Program ayarları'na Google yorum linkini yaz. Müşteri takip sayfasında "hizmet yapıldı" onayından sonra yorum kartı çıkar (link kapandıktan sonra da durur). Tıklama admin panelinde görünür; işte "Yorum mesajı kopyala" düğmesi var.

## Ekip, galeri, makbuz, destek (yeni)
- **Ekip paneli** `portal/crew.html`: taseron e-postasiyla girer, kendi islerini gorur (adres + harita, ne alinacak, erisim notu), "Yoldayim / Calisiyor / Bitti" der, once/sonra fotograf yukler. Bitti icin en az 1 "sonra" fotografi sart. Fiyat ve komisyon gormez. Admin "Ekip" sekmesinden eklenir, is satirindan atanir.
- **Musteri takip sayfasi**: "ekip yolda" bildirimi, depozito karti, is bitip odeme alinca makbuz butonu.
- **Makbuz** `receipt.html?t=TOKEN`: yazdir / PDF kaydet. Admin is satirindan "Makbuz linki" kopyalar.
- **Depozito**: admin is satirina tutar yazar, parayi alinca "alindi" isaretler. Odeme talimati Ayarlar'da (Zelle vb.). Stripe henuz yok.
- **Kaynak takibi**: `attr.js` ilk temas kaynagini (UTM, Google/Facebook reklam, ortak/QR, sehir sayfasi) kaydeder; admin is satirinda ve Rapor'da "Musteri nereden geldi".
- **Sehir sayfalari**: `python3 tools/build_cities.py` (12 sehir). Alan adin olunca `SITE_URL=https://alanadin.com python3 tools/build_cities.py` sitemap.xml ve robots.txt de uretir.
- **Galeri/yorumlar**: admin "Galeri" sekmesi; site bolumu bos ise gizli kalir.
- **Ortak pazarlama paketi**: ortak panelinde el ilani, kartvizit, kare ve story gorseli (kendi linkli QR), PNG indirme.
- **Destek**: ortak panelinden mesaj, admin "Destek" sekmesinden cevap (ortaga bildirim duser).
