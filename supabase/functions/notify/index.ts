// Anlik e-posta bildirimleri (Supabase Edge Function + Database Webhook).
// Yeni talep -> admin, teklif kabul -> admin, is bitti / odeme alindi -> ortak, destek mesaji -> karsi taraf.
// Kurulum: KURULUM.md "E-posta bildirimleri" bolumu. RESEND_API_KEY ve WEBHOOK_SECRET gerekir.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

async function mail(to: string[], subject: string, body: string, link?: string) {
  if (!to.length) return;
  const from = Deno.env.get("FROM_EMAIL") ?? "Kais Junk Remove <onboarding@resend.dev>";
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;color:#1F2421"><h2 style="margin:0 0 10px">${esc(subject)}</h2>${body}${
    link ? `<p style="margin-top:18px"><a href="${esc(link)}" style="background:#F26B1D;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600">Open panel</a></p>` : ""}</div>`;
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
