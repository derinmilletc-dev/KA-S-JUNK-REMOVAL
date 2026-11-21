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
