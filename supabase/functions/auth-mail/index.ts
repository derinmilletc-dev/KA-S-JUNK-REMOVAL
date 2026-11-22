// Ortak/ekip/admin giris e-postalari: davet (sifre belirle), sifremi unuttum, basvuru alindi.
// Supabase Edge Function. Gizli anahtarlar: RESEND_API_KEY, FROM_EMAIL, PANEL_URL (hepsi zaten tanimli).
// JWT dogrulamasi KAPALI olmali (sifremi unuttum herkese acik). Yetki kontrolu kodun icinde yapilir:
//  - invite: sadece yonetici (Authorization: Bearer <yonetici oturumu>)
//  - forgot: herkes, ama yalnizca kayitli e-postalara ve saatte en fazla 3 kez; cevap hep aynidir (e-posta var mi yok mu belli olmaz)
//  - applied: yalnizca son 30 dakikada gelmis bekleyen basvurusu olan e-postaya, bir kez
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Lang = "tr" | "en" | "es";
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const LOGO = "https://kaisremoval.com/apple-touch-icon.png";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const L = (v: unknown): Lang => (v === "tr" || v === "es" ? v : "en");

// ---------- Mail metinleri (tr / en / es) ----------
type Copy = {
  subject: string; pre: string; badge: string; title: string; intro: string;
  steps?: [string, string][]; btn: string; fallback: string; note: string; spam?: string;
};
const C: Record<string, Record<Lang, Copy>> = {
  invite: {
    en: {
      subject: "You're in! Set your password, Kais Partners", pre: "Your application is approved. One tap to create your password.", badge: "🎉",
      title: "Welcome aboard, you're approved!",
      intro: "Your Kais Junk Remove partner account is ready. Create your password and you can log in any time with your email and password.",
      steps: [["Create your password", "Tap the button below. It takes 20 seconds."], ["Share your link or QR code", "Friends, neighbors, realtors, property managers. Ready-made messages are in your panel."], ["Get paid", "You earn commission on every job that is completed and paid. Joining is free."]],
      btn: "Create my password", fallback: "Button not working? Copy this link into your browser:",
      note: "For your security this link works for a limited time and only once. If it expires, open the login page and tap “Forgot password”.",
    },
    es: {
      subject: "¡Estás dentro! Crea tu contraseña, Socios Kais", pre: "Tu solicitud fue aprobada. Un toque para crear tu contraseña.", badge: "🎉",
      title: "¡Bienvenido, estás aprobado!",
      intro: "Tu cuenta de socio de Kais Junk Remove está lista. Crea tu contraseña y podrás entrar cuando quieras con tu correo y contraseña.",
      steps: [["Crea tu contraseña", "Toca el botón de abajo. Toma 20 segundos."], ["Comparte tu enlace o código QR", "Amigos, vecinos, agentes inmobiliarios, administradores de propiedades. Tienes mensajes listos en tu panel."], ["Cobra", "Ganas comisión por cada trabajo completado y pagado. Unirse es gratis."]],
      btn: "Crear mi contraseña", fallback: "¿No funciona el botón? Copia este enlace en tu navegador:",
      note: "Por tu seguridad este enlace funciona por tiempo limitado y una sola vez. Si vence, abre la página de acceso y toca “Olvidé mi contraseña”.",
    },
    tr: {
      subject: "Hesabın hazır! Şifreni belirle, Kais Ortakları", pre: "Başvurun onaylandı. Tek dokunuşla şifreni oluştur.", badge: "🎉",
      title: "Aramıza hoş geldin, onaylandın!",
      intro: "Kais Junk Remove ortak hesabın hazır. Şifreni oluştur, sonra istediğin zaman e-posta ve şifrenle giriş yap.",
      steps: [["Şifreni oluştur", "Aşağıdaki butona dokun. 20 saniye sürer."], ["Linkini veya QR kodunu paylaş", "Arkadaşlar, komşular, emlakçılar, apartman yöneticileri. Hazır mesajlar panelinde seni bekliyor."], ["Kazan", "Tamamlanan ve ödenen her işten komisyon kazanırsın. Katılım ücretsiz."]],
      btn: "Şifremi oluştur", fallback: "Buton çalışmıyor mu? Bu linki tarayıcına yapıştır:",
      note: "Güvenliğin için bu link sınırlı süre geçerli ve tek kullanımlık. Süresi dolarsa giriş sayfasında “Şifremi unuttum”a dokun.",
    },
  },
  forgot: {
    en: { subject: "Reset your Kais password", pre: "Tap to choose a new password.", badge: "🔐", title: "Reset your password", intro: "We got a request to reset the password for this email. Tap the button to choose a new one.", btn: "Choose a new password", fallback: "Button not working? Copy this link into your browser:", note: "This link works once and for a limited time. Didn't ask for this? You can safely ignore this email, your password stays the same." },
    es: { subject: "Restablece tu contraseña de Kais", pre: "Toca para elegir una nueva contraseña.", badge: "🔐", title: "Restablece tu contraseña", intro: "Recibimos una solicitud para restablecer la contraseña de este correo. Toca el botón para elegir una nueva.", btn: "Elegir nueva contraseña", fallback: "¿No funciona el botón? Copia este enlace en tu navegador:", note: "Este enlace funciona una sola vez y por tiempo limitado. ¿No lo pediste? Ignora este correo, tu contraseña no cambia." },
    tr: { subject: "Kais şifreni sıfırla", pre: "Yeni şifre seçmek için dokun.", badge: "🔐", title: "Şifreni sıfırla", intro: "Bu e-posta için şifre sıfırlama isteği aldık. Yeni şifre seçmek için butona dokun.", btn: "Yeni şifre seç", fallback: "Buton çalışmıyor mu? Bu linki tarayıcına yapıştır:", note: "Bu link tek kullanımlık ve sınırlı süre geçerli. Sen istemediysen bu maili yok sayabilirsin, şifren aynı kalır." },
  },
  applied: {
    en: {
      subject: "We got your application ✅", pre: "Under review. We'll email you shortly.", badge: "✅", title: "Application received!",
      intro: "Thanks for applying to the Kais Junk Remove partner program. Your request is under review and we'll email you very soon. Please keep an eye on your inbox and hang tight.",
      steps: [["Received", "Your application is in."], ["Under review", "We'll check it shortly."], ["Approved by email", "You'll get a link to create your password."]],
      btn: "", fallback: "", note: "",
      spam: "Can't find our email? Check your Spam or Junk folder too. If it's there, mark it as “Not spam” so you don't miss future messages.",
    },
    es: {
      subject: "Recibimos tu solicitud ✅", pre: "En revisión. Te escribiremos pronto.", badge: "✅", title: "¡Solicitud recibida!",
      intro: "Gracias por postularte al programa de socios de Kais Junk Remove. Tu solicitud está en revisión y te enviaremos un correo muy pronto. Revisa tu bandeja de entrada y espera con calma.",
      steps: [["Recibida", "Tu solicitud ya llegó."], ["En revisión", "La revisaremos en breve."], ["Aprobación por correo", "Recibirás un enlace para crear tu contraseña."]],
      btn: "", fallback: "", note: "",
      spam: "¿No encuentras nuestro correo? Revisa también tu carpeta de Spam o Correo no deseado. Si está ahí, márcalo como “No es spam” para no perder mensajes futuros.",
    },
    tr: {
      subject: "Başvurunu aldık ✅", pre: "İncelemede. Kısa sürede mail göndereceğiz.", badge: "✅", title: "Başvurun alındı!",
      intro: "Kais Junk Remove ortaklık programına başvurduğun için teşekkürler. Talebin incelemede, çok kısa süre içinde sana mail göndereceğiz. Lütfen e-posta kutunu kontrol et ve beklemede kal.",
      steps: [["Alındı", "Başvurun bize ulaştı."], ["İncelemede", "Kısa sürede bakacağız."], ["Mail ile onay", "Şifreni oluşturman için link göndereceğiz."]],
      btn: "", fallback: "", note: "",
      spam: "Mailimizi bulamadın mı? Spam veya istenmeyen klasörüne de bak. Orada ise “Spam değil” olarak işaretle ki sonraki mailleri kaçırma.",
    },
  },
};

function render(c: Copy, link?: string): string {
  const steps = c.steps
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 4px">${c.steps.map((s, i) => `<tr><td valign="top" style="width:40px;padding:0 0 14px"><div style="width:30px;height:30px;line-height:30px;text-align:center;border-radius:15px;background:#FDEBDD;color:#C9500F;font-weight:700;font-size:14px">${i + 1}</div></td><td valign="top" style="padding:0 0 14px"><div style="font-weight:700;font-size:15px;color:#1F2421">${esc(s[0])}</div><div style="font-size:14px;line-height:1.5;color:#5F6762">${esc(s[1])}</div></td></tr>`).join("")}</table>`
    : "";
  const btn = link && c.btn
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 8px"><tr><td align="center" style="background:#F26B1D;border-radius:14px"><a href="${esc(link)}" style="display:block;padding:16px 24px;font-size:17px;font-weight:700;color:#ffffff;text-decoration:none">${esc(c.btn)} &rarr;</a></td></tr></table>
<div style="font-size:12px;line-height:1.5;color:#7A817C;margin-top:10px">${esc(c.fallback)}<br><span style="word-break:break-all;color:#5F6762">${esc(link)}</span></div>`
    : "";
  const note = c.note ? `<div style="margin-top:18px;padding:12px 14px;background:#F7F3EA;border-radius:12px;font-size:13px;line-height:1.55;color:#5F6762">🔒 ${esc(c.note)}</div>` : "";
  const spam = c.spam ? `<div style="margin-top:18px;padding:14px 16px;background:#FFF6E5;border:1px solid #F4DFB0;border-radius:12px;font-size:14px;line-height:1.55;color:#6B4E12">📬 ${esc(c.spam)}</div>` : "";
  return `<!doctype html><html><body style="margin:0;padding:0;background:#F3EEE4"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(c.pre)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3EEE4"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border-radius:22px;overflow:hidden;border:1px solid #E7E0D2;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1F2421">
<tr><td style="background:#1F2421;padding:20px 28px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td><img src="${LOGO}" width="40" height="40" alt="" style="display:block;border-radius:10px;border:0"></td><td style="padding-left:12px;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.01em">Kais Junk Remove</td></tr></table></td></tr>
<tr><td style="height:4px;line-height:4px;font-size:0;background:#F26B1D">&nbsp;</td></tr>
<tr><td style="padding:34px 28px 8px"><div style="width:64px;height:64px;line-height:64px;text-align:center;font-size:32px;background:#FDEBDD;border-radius:20px;margin:0 0 18px">${c.badge}</div>
<h1 style="margin:0 0 12px;font-size:26px;line-height:1.2;letter-spacing:-0.02em;color:#1F2421">${esc(c.title)}</h1>
<div style="font-size:16px;line-height:1.6;color:#2C332F">${esc(c.intro)}</div>${steps}${btn}${note}${spam}</td></tr>
<tr><td style="padding:22px 28px 28px"><div style="border-top:1px solid #EDE7DA;padding-top:16px;font-size:12px;line-height:1.7;color:#7A817C">Kais Junk Remove &middot; Florida &middot; Open 24/7<br>+1 (407) 446-2534 &middot; <a href="https://kaisremoval.com" style="color:#7A817C">kaisremoval.com</a></div></td></tr>
</table></td></tr></table></body></html>`;
}

async function send(to: string, c: Copy, link?: string) {
  const from = Deno.env.get("FROM_EMAIL") ?? "Kais Junk Remove <onboarding@resend.dev>";
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject: c.subject, html: render(c, link) }),
  });
  if (!r.ok) throw new Error("mail " + r.status + " " + (await r.text()).slice(0, 200));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");
    const email = String(body.email ?? "").trim().toLowerCase();
    const lang = L(body.lang);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) return json({ ok: true });
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const base = (() => { let p = (Deno.env.get("PANEL_URL") ?? "").trim(); if (!p) p = "https://kaisremoval.com"; if (!/^https?:\/\//i.test(p)) p = "https://" + p; return p.replace(/\/portal.*$/i, "").replace(/\/+$/, ""); })();

    // Hangi panel? (giris sonrasi yonlendirme)
    async function role(): Promise<"admin" | "partner" | "crew" | null> {
      if ((await sb.from("admins").select("email").ilike("email", email).limit(1)).data?.length) return "admin";
      if ((await sb.from("partners").select("id").ilike("email", email).limit(1)).data?.length) return "partner";
      if ((await sb.from("crews").select("id").ilike("email", email).limit(1)).data?.length) return "crew";
      return null;
    }
    async function makeLink(mode: "welcome" | "reset", r: string): Promise<string | null> {
      const redirectTo = `${base}/portal/reset.html?m=${mode}&to=${r}&l=${lang}`;
      let res = await sb.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo } });
      if (res.error) res = await sb.auth.admin.generateLink({ type: "invite", email, options: { redirectTo } });
      return res.data?.properties?.action_link ?? null;
    }

    if (action === "forgot") {
      const r = await role();
      if (!r) return json({ ok: true });
      const hour = new Date().toISOString().slice(0, 13);
      let allowed = false;
      for (let n = 1; n <= 3 && !allowed; n++) allowed = !(await sb.from("push_log").insert({ key: `f:${email}:${hour}:${n}` })).error;
      if (!allowed) return json({ ok: true });
      const link = await makeLink("reset", r);
      try { if (link) await send(email, C.forgot[lang], link); } catch (_e) { /* cevap hep ayni */ }
      return json({ ok: true });
    }

    if (action === "invite") {
      const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
      const u = token ? (await sb.auth.getUser(token)).data.user : null;
      const isAdmin = u?.email ? !!(await sb.from("admins").select("email").ilike("email", u.email).limit(1)).data?.length : false;
      if (!isAdmin) return json({ ok: false, error: "forbidden" }, 403);
      const r = await role();
      if (!r || r === "admin") return json({ ok: false, error: "not_found" }, 404);
      const link = await makeLink("welcome", r);
      if (!link) return json({ ok: false, error: "link" }, 500);
      await send(email, C.invite[lang], link);
      return json({ ok: true });
    }

    if (action === "applied") {
      const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const a = (await sb.from("partner_applications").select("id,lang").ilike("email", email).eq("status", "pending").gte("created_at", since).order("created_at", { ascending: false }).limit(1)).data?.[0];
      if (!a) return json({ ok: true });
      if ((await sb.from("push_log").insert({ key: "a:" + a.id })).error) return json({ ok: true });
      await send(email, C.applied[L(a.lang ?? lang)]);
      return json({ ok: true });
    }
    return json({ ok: false, error: "action" }, 400);
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 200) }, 500);
  }
});
