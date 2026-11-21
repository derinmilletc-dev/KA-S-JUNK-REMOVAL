// Haftalik otomatik yedek: tum veriyi JSON olarak ozel "backups" kovasina yazar, son 8 yedegi tutar.
// Kurulum: KURULUM.md "Yedek" bolumu. CRON_SECRET gerekir (x-cron-secret basligi ile cagirilir).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) return new Response("forbidden", { status: 403 });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await sb.rpc("_backup_all");
  if (error) return new Response("rpc: " + error.message, { status: 500 });
  const name = `kais-yedek-${new Date().toISOString().slice(0, 10)}.json`;
  const up = await sb.storage.from("backups").upload(name, new Blob([JSON.stringify(data)], { type: "application/json" }), { upsert: true });
  if (up.error) return new Response("upload: " + up.error.message, { status: 500 });
  const list = (await sb.storage.from("backups").list("", { limit: 100 })).data ?? [];
  const old = list.filter((f) => f.name.endsWith(".json")).map((f) => f.name).sort().reverse().slice(8);
  if (old.length) await sb.storage.from("backups").remove(old);
  return new Response("ok " + name);
});
