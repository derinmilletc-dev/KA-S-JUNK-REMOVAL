// Gercek push bildirimi (telefon kapaliyken bile). Database Webhook ile tetiklenir:
//  - notifications tablosu (Insert)  -> ilgili ortaga push
//  - leads tablosu (Insert)          -> yoneticilere "yeni talep" push
// Gizli anahtarlar (Edge Functions > Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...)
// Webhook tipi "Supabase Edge Functions" secilirse yetki basligi otomatik eklenir; govdedeki veriye guvenilmez, kayit veritabanindan yeniden okunur.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type Sub = { id: string; endpoint: string; p256dh: string; auth: string; lang: string };

// Ortak bildirim metinleri Turkce yazilir; en/es icin onek cevirisi.
const PFX: [RegExp, string, string][] = [
  [/^Yeni talep geldi: /, "New request: ", "Nueva solicitud: "],
  [/^Is tamamlandi: /, "Job completed: ", "Trabajo completado: "],
  [/^Komisyon odemesi yapildi: /, "Commission paid: ", "Comisión pagada: "],
  [/^Ekip payi odendi/, "Team share paid", "Parte del equipo pagada"],
  [/^Ekibinden (.*) bir ortak bir is tamamladi/, "A partner on your team completed a job", "Un socio de tu equipo completó un trabajo"],
  [/^Ekibine yeni ortak katildi: /, "A new partner joined your team: ", "Un nuevo socio se unió a tu equipo: "],
  [/^Musteri teklifi kabul etti: /, "Customer accepted the quote: ", "El cliente aceptó la cotización: "],
  [/^Yeni kampanya: /, "New campaign: ", "Nueva campaña: "],
  [/^Yeni egitim: /, "New training: ", "Nueva capacitación: "],
  [/^Destek yaniti: /, "Support reply: ", "Respuesta de soporte: "],
  [/^Eski musterin tekrar is verdi: /, "Your past customer ordered again: ", "Tu cliente anterior volvió a pedir: "],
];
function loc(text: string, lang: string): string {
  if (lang === "tr") return text;
  for (const [re, en, es] of PFX) {
    if (re.test(text)) return text.replace(re, lang === "es" ? es : en);
  }
  return text;
}

Deno.serve(async (req) => {
  try {
    const ev = await req.json().catch(() => ({}));
    if (ev.type !== "INSERT" || !ev.record?.id) return new Response("skip");
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    webpush.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT") ?? "mailto:kaisremoval@gmail.com",
      Deno.env.get("VAPID_PUBLIC_KEY")!,
      Deno.env.get("VAPID_PRIVATE_KEY")!,
    );

    let subs: Sub[] = [];
    let build: (s: Sub) => string;

    if (ev.table === "notifications") {
      const { data: n } = await sb.from("notifications").select("id,partner_id,text,created_at").eq("id", ev.record.id).maybeSingle();
      if (!n) return new Response("none");
      const ins = await sb.from("push_log").insert({ key: "n:" + n.id });
      if (ins.error) return new Response("dup");
      const { data: p } = await sb.from("partners").select("email").eq("id", n.partner_id).maybeSingle();
      if (!p?.email) return new Response("nopartner");
      const r = await sb.from("push_subs").select("id,endpoint,p256dh,auth,lang").eq("role", "partner").ilike("email", p.email);
      subs = (r.data ?? []) as Sub[];
      build = (s) => JSON.stringify({ title: "Kais Partner", body: loc(n.text, s.lang), url: "partner.html", tag: "n" });
    } else if (ev.table === "leads") {
      const { data: l } = await sb.from("leads").select("id,ref,customer_name,summary,created_at").eq("id", ev.record.id).maybeSingle();
      if (!l) return new Response("none");
      if (Date.now() - new Date(l.created_at).getTime() > 10 * 60 * 1000) return new Response("old");
      const ins = await sb.from("push_log").insert({ key: "l:" + l.id });
      if (ins.error) return new Response("dup");
      const admins = ((await sb.from("admins").select("email")).data ?? []).map((a: { email: string }) => a.email.toLowerCase());
      if (!admins.length) return new Response("noadmin");
      const r = await sb.from("push_subs").select("id,endpoint,p256dh,auth,lang,email").eq("role", "admin");
      subs = ((r.data ?? []) as (Sub & { email: string })[]).filter((x) => admins.includes(x.email.toLowerCase()));
      const body = `${l.customer_name ?? ""}${l.summary ? " · " + String(l.summary).slice(0, 80) : ""}`;
      build = () => JSON.stringify({ title: "Yeni talep " + (l.ref ?? ""), body, url: "admin.html", tag: "lead" });
    } else {
      return new Response("skip");
    }

    let sent = 0;
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, build(s), { TTL: 86400 });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await sb.from("push_subs").delete().eq("id", s.id);
      }
    }));
    return new Response(JSON.stringify({ sent, total: subs.length }), { headers: { "content-type": "application/json" } });
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
});
