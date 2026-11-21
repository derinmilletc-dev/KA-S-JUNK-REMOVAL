// Her sabah admin'e: bugunku ve yarinki randevular + bekleyen talepler (Supabase Edge Function, cron ile).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

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
  const html = `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;color:#1F2421"><h2 style="margin:0">Good morning</h2>${block("Today", today)}${block("Tomorrow", tomorrow)}<p style="margin-top:16px"><b>${open}</b> requests waiting for a quote or answer.</p></div>`;
  const to = ((await sb.from("admins").select("email")).data ?? []).map((a: { email: string }) => a.email);
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: Deno.env.get("FROM_EMAIL") ?? "Kais Junk Remove <onboarding@resend.dev>", to, subject: `Today: ${part(today).length} jobs · Tomorrow: ${part(tomorrow).length}`, html }),
  });
  return new Response(JSON.stringify({ ok: r.ok }), { headers: { "Content-Type": "application/json" } });
});
