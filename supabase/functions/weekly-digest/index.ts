// Haftalik ortak ozeti maili (Supabase Edge Function).
// Kurulum: README'deki "Haftalik e-posta" bolumune bak. Calismasi icin RESEND_API_KEY gerekir.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const esc = (s: string) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const money = (n: number) => "$" + Number(n || 0).toFixed(2).replace(/\.00$/, "");

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

Deno.serve(async (req) => {
  // Sadece gizli anahtarla cagrilabilir (cron bunu gonderir)
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) return new Response("forbidden", { status: 403 });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await sb.rpc("weekly_digest");
  if (error) return new Response(error.message, { status: 500 });

  const from = Deno.env.get("FROM_EMAIL") ?? "Kais Junk Remove <onboarding@resend.dev>";
  const panel = (() => { let p = (Deno.env.get("PANEL_URL") ?? "").trim(); if (!p) p = "https://kaisremoval.com"; if (!/^https?:\/\//i.test(p)) p = "https://" + p; return p.replace(/\/portal.*$/i, "").replace(/\/+$/, ""); })();
  let sent = 0, failed = 0;

  for (const p of data ?? []) {
    // Hareketsiz ortaga mail atma
    if (!p.requests && !p.done && !Number(p.earned) && !p.team_new && !Number(p.pending)) continue;
    const first = esc(String(p.name).split(" ")[0]);
    const html = layout(`Hi ${first}, here is your week`, `<p style="color:#565D58;margin:0 0 14px">Your last 7 days with Kais Junk Remove.</p>
      <table role="presentation" style="width:100%;border-collapse:collapse;font-size:16px">
        <tr><td style="padding:10px 0;border-bottom:1px solid #EDE7DA">New requests</td><td align="right" style="border-bottom:1px solid #EDE7DA"><b>${p.requests}</b></td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #EDE7DA">Completed jobs</td><td align="right" style="border-bottom:1px solid #EDE7DA"><b>${p.done}</b></td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #EDE7DA">Earned this week</td><td align="right" style="border-bottom:1px solid #EDE7DA"><b>${money(p.earned)}</b></td></tr>
        <tr><td style="padding:10px 0">Waiting to be paid</td><td align="right"><b>${money(p.pending)}</b></td></tr>
        ${p.team_new ? `<tr><td style="padding:10px 0;border-top:1px solid #EDE7DA">New team members</td><td align="right" style="border-top:1px solid #EDE7DA"><b>${p.team_new}</b></td></tr>` : ""}
      </table>`, panel + "/portal/partner.html", "Open my partner panel");
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [p.email], subject: `Your week: ${p.done} completed, ${money(p.earned)} earned`, html }),
    });
    r.ok ? sent++ : failed++;
  }
  return new Response(JSON.stringify({ sent, failed }), { headers: { "Content-Type": "application/json" } });
});
