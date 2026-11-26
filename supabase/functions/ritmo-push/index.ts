// Ritmo: manda los avisos push que ya vencieron. La llama pg_cron cada minuto (ver supabase/ritmo_push.sql).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  const { data: cfgRows } = await sb.from("ritmo_config").select("k,v");
  const cfg = Object.fromEntries((cfgRows ?? []).map((r: { k: string; v: string }) => [r.k, r.v]));
  if (!cfg.cron_secret || req.headers.get("x-ritmo-cron") !== cfg.cron_secret) return new Response("no", { status: 401 });
  webpush.setVapidDetails("mailto:ritmo@example.com", cfg.vapid_public, cfg.vapid_private);

  const { data: due, error } = await sb.rpc("ritmo_push_take");
  if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  let sent = 0;
  const dead = new Set<string>();
  for (const n of due ?? []) {
    const payload = JSON.stringify({ title: n.title, body: n.body, url: n.url, tag: n.key });
    for (const s of n.subs ?? []) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: 1800, urgency: "high" });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.add(s.endpoint);
      }
    }
  }
  if (dead.size) await sb.from("ritmo_push_subs").delete().in("endpoint", [...dead]);
  return new Response(JSON.stringify({ ok: true, due: due?.length ?? 0, sent }), { headers: { "Content-Type": "application/json" } });
});
