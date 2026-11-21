// Her sabah admin'e: bugunku ve yarinki randevular + bekleyen talepler (Supabase Edge Function, cron ile).
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

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) return new Response("forbidden", { status: 403 });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const ny = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const today = ny(new Date()), tomorrow = ny(new Date(Date.now() + 864e5));
  const { data: leads } = await sb.from("leads").select("ref,customer_name,address,summary,status,scheduled_at,crew_id")
    .neq("status", "lost").gte("scheduled_at", today + "T00:00:00").lt("scheduled_at", tomorrow + "T23:59:59").order("scheduled_at");
  const crews = Object.fromEntries(((await sb.from("crews").select("id,name")).data ?? []).map((c: { id: string; name: string }) => [c.id, c.name]));
  const open = (await sb.from("leads").select("id", { count: "exact", head: true }).in("status", ["new", "quoted"])).count ?? 0;
  const row = (l: Record<string, string>) =>
    `<tr><td style="padding:6px 8px 6px 0;white-space:nowrap">${esc(String(l.scheduled_at).slice(11, 16))}</td><td><b>${esc(l.customer_name)}</b><br><span style="color:#565D58">${esc(l.address)} · ${esc(l.summary)}${l.crew_id ? " · " + esc(crews[l.crew_id]) : " · no crew"}</span></td></tr>`;
  const part = (d: string) => (leads ?? []).filter((l: Record<string, string>) => String(l.scheduled_at).slice(0, 10) === d);
  const block = (t: string, d: string) => `<h3 style="margin:16px 0 6px">${t}</h3>${part(d).length ? `<table style="font-size:15px">${part(d).map(row).join("")}</table>` : '<p style="color:#565D58">Nothing scheduled.</p>'}`;
  const html = layout("Good morning", `${block("Today", today)}${block("Tomorrow", tomorrow)}<p style="margin-top:18px;padding:14px 16px;background:#FBF6EC;border-radius:12px"><b>${open}</b> requests waiting for a quote or answer.</p>`, (Deno.env.get("PANEL_URL") ?? "") ? (Deno.env.get("PANEL_URL") ?? "") + "/portal/admin.html" : undefined, "Open admin panel", `Today: ${part(today).length} jobs`);
  const to = ((await sb.from("admins").select("email")).data ?? []).map((a: { email: string }) => a.email);
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: Deno.env.get("FROM_EMAIL") ?? "Kais Junk Remove <onboarding@resend.dev>", to, subject: `Today: ${part(today).length} jobs · Tomorrow: ${part(tomorrow).length}`, html }),
  });
  return new Response(JSON.stringify({ ok: r.ok }), { headers: { "Content-Type": "application/json" } });
});
