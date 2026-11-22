// Anlik e-posta bildirimleri (Supabase Edge Function + Database Webhook).
// Yeni talep -> admin, teklif kabul -> admin, is bitti / odeme alindi -> ortak, destek mesaji -> karsi taraf.
// Kurulum: KURULUM.md "E-posta bildirimleri" bolumu. RESEND_API_KEY ve WEBHOOK_SECRET gerekir.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));


// ---- Ortak e-posta tasarimi (logolu, sade). Tum fonksiyonlarda ayni. ----
const LOGO = "https://kaisremoval.com/apple-touch-icon.png";
function layout(title: string, inner: string, link?: string, label = "Open panel / Abrir panel", pre = ""): string {
  const btn = link
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px"><tr><td style="background:#F26B1D;border-radius:12px"><a href="${esc(link)}" style="display:inline-block;padding:14px 24px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none">${label}</a></td></tr></table>`
    : "";
  return `<!doctype html><html><body style="margin:0;padding:0;background:#F3EEE4"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(pre || title)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3EEE4"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #E7E0D2;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1F2421">
<tr><td style="background:#1F2421;padding:20px 28px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td><img src="${LOGO}" width="40" height="40" alt="" style="display:block;border-radius:10px;border:0"></td><td style="padding-left:12px;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.01em">Kais Junk Remove</td></tr></table></td></tr>
<tr><td style="height:4px;line-height:4px;font-size:0;background:#F26B1D">&nbsp;</td></tr>
<tr><td style="padding:30px 28px 6px"><h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;letter-spacing:-0.02em;color:#1F2421">${esc(title)}</h1><div style="font-size:16px;line-height:1.6;color:#2C332F">${inner}</div>${btn}</td></tr>
<tr><td style="padding:22px 28px 28px"><div style="border-top:1px solid #EDE7DA;padding-top:16px;font-size:12px;line-height:1.7;color:#7A817C">Kais Junk Remove &middot; Florida &middot; Open 24/7<br>+1 (407) 446-2534 &middot; <a href="https://kaisremoval.com" style="color:#7A817C">kaisremoval.com</a></div></td></tr>
</table></td></tr></table></body></html>`;
}

async function mail(to: string[], subject: string, body: string, link?: string) {
  if (!to.length) return;
  const from = Deno.env.get("FROM_EMAIL") ?? "Kais Junk Remove <onboarding@resend.dev>";
  const html = layout(subject, body, link);
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
}

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== Deno.env.get("WEBHOOK_SECRET")) return new Response("forbidden", { status: 403 });
  const ev = await req.json();
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const panel = Deno.env.get("PANEL_URL") ?? "";
  const admins = async () => ((await sb.from("admins").select("email")).data ?? []).map((a: { email: string }) => a.email);
  const partnerEmail = async (id: string | null) => (id ? (await sb.from("partners").select("email,name").eq("id", id).maybeSingle()).data : null);
  const rec = ev.record ?? {}, old = ev.old_record ?? {};

  if (ev.table === "leads") {
    if (ev.type === "INSERT") {
      await mail(await admins(), `New request ${rec.ref}`,
        `<p><b>${esc(rec.customer_name)}</b><br>${esc(rec.address)}<br>${esc(rec.summary)}</p><p style="color:#565D58">Source: ${esc(rec.source || "direct")}${rec.partner_id ? " · via partner" : ""}</p>`, panel && panel + "/portal/admin.html");
    } else if (ev.type === "UPDATE") {
      if (rec.quote_accepted_at && !old.quote_accepted_at)
        await mail(await admins(), `Quote accepted ${rec.ref}`, `<p>${esc(rec.customer_name)} accepted the quote ($${esc(rec.price)}). Book a time.</p>`, panel && panel + "/portal/admin.html");
      if (rec.crew_status === "finished" && old.crew_status !== "finished")
        await mail(await admins(), `Crew finished ${rec.ref}`, `<p>${esc(rec.customer_name)} · ${esc(rec.address)}</p><p>After photos are in. Collect payment and mark it paid.</p>`, panel && panel + "/portal/admin.html");
      const p = rec.partner_id && !rec.dup_of ? await partnerEmail(rec.partner_id) : null;
      if (p?.email) {
        if (rec.status === "done" && old.status !== "done")
          await mail([p.email], `Job completed ${rec.ref}`, `<p>Hi ${esc(String(p.name).split(" ")[0])}, your customer's job is completed. Your commission shows in your panel once payment is received.</p>`, panel && panel + "/portal/partner.html");
        if (rec.paid_at && !old.paid_at) {
          const c = (await sb.from("lead_calc").select("commission").eq("lead_id", rec.id).maybeSingle()).data;
          await mail([p.email], `Payment received ${rec.ref}`, `<p>The customer paid${c?.commission != null ? `. Your commission: <b>$${esc(c.commission)}</b>` : ""}. The team will pay you out.</p>`, panel && panel + "/portal/partner.html");
        }
      }
    }
  }
  if (ev.table === "support_msgs" && ev.type === "INSERT") {
    if (rec.from_admin) {
      const p = await partnerEmail(rec.partner_id);
      if (p?.email) await mail([p.email], "Reply from Kais Junk Remove", `<p>${esc(rec.body)}</p>`, panel && panel + "/portal/partner.html");
    } else {
      const p = await partnerEmail(rec.partner_id);
      await mail(await admins(), `Support message from ${p?.name ?? "partner"}`, `<p>${esc(rec.body)}</p>`, panel && panel + "/portal/admin.html");
    }
  }
  return new Response("ok");
});
