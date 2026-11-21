// Haftalik ortak ozeti maili (Supabase Edge Function).
// Kurulum: README'deki "Haftalik e-posta" bolumune bak. Calismasi icin RESEND_API_KEY gerekir.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const esc = (s: string) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const money = (n: number) => "$" + Number(n || 0).toFixed(2).replace(/\.00$/, "");

Deno.serve(async (req) => {
  // Sadece gizli anahtarla cagrilabilir (cron bunu gonderir)
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) return new Response("forbidden", { status: 403 });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await sb.rpc("weekly_digest");
  if (error) return new Response(error.message, { status: 500 });

  const from = Deno.env.get("FROM_EMAIL") ?? "Kais Junk Remove <onboarding@resend.dev>";
  const panel = Deno.env.get("PANEL_URL") ?? "";
  let sent = 0, failed = 0;

  for (const p of data ?? []) {
    // Hareketsiz ortaga mail atma
    if (!p.requests && !p.done && !Number(p.earned) && !p.team_new && !Number(p.pending)) continue;
    const first = esc(String(p.name).split(" ")[0]);
    const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;color:#1F2421">
      <h2 style="margin:0 0 8px">Hi ${first}, here is your week</h2>
      <p style="color:#565D58;margin:0 0 16px">Your last 7 days with Kais Junk Remove.</p>
      <table style="width:100%;border-collapse:collapse;font-size:16px">
        <tr><td style="padding:8px 0">New requests</td><td align="right"><b>${p.requests}</b></td></tr>
        <tr><td style="padding:8px 0">Completed jobs</td><td align="right"><b>${p.done}</b></td></tr>
        <tr><td style="padding:8px 0">Earned this week</td><td align="right"><b>${money(p.earned)}</b></td></tr>
        <tr><td style="padding:8px 0">Waiting to be paid</td><td align="right"><b>${money(p.pending)}</b></td></tr>
        ${p.team_new ? `<tr><td style="padding:8px 0">New team members</td><td align="right"><b>${p.team_new}</b></td></tr>` : ""}
      </table>
      ${panel ? `<p style="margin-top:20px"><a href="${esc(panel)}" style="background:#F26B1D;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600">Open my partner panel</a></p>` : ""}
      <p style="color:#565D58;font-size:13px;margin-top:24px">“You will be paid in direct proportion to the value you create.” — T. Harv Eker</p>
    </div>`;
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [p.email], subject: `Your week: ${p.done} completed, ${money(p.earned)} earned`, html }),
    });
    r.ok ? sent++ : failed++;
  }
  return new Response(JSON.stringify({ sent, failed }), { headers: { "Content-Type": "application/json" } });
});
