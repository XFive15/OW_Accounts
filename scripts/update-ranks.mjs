// 通过 OverFast API (非官方) 抓取公开生涯资料中的竞技段位,写回 Supabase
// 需要环境变量:SUPABASE_URL, SUPABASE_SERVICE_KEY
const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
const H = { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json" };

const list = await (await fetch(`${SUPABASE_URL}/rest/v1/accounts?select=id,battletag&battletag=not.is.null`, { headers: H })).json();

for (const a of list) {
  if (!a.battletag) continue;
  const id = a.battletag.replace("#", "-");
  try {
    const r = await fetch(`https://overfast-api.tekrop.fr/players/${encodeURIComponent(id)}/summary`);
    if (!r.ok) { console.log(a.battletag, "HTTP", r.status, "(资料未公开或未找到)"); continue; }
    const j = await r.json();
    const c = j.competitive?.pc;
    if (!c) { console.log(a.battletag, "无竞技数据"); continue; }
    const ranks = { tank: c.tank, damage: c.damage, support: c.support };
    await fetch(`${SUPABASE_URL}/rest/v1/accounts?id=eq.${a.id}`, {
      method: "PATCH", headers: H,
      body: JSON.stringify({ ranks, ranks_updated_at: new Date().toISOString() }),
    });
    console.log(a.battletag, "OK", JSON.stringify(ranks));
  } catch (e) { console.log(a.battletag, "ERR", e.message); }
  await new Promise((r) => setTimeout(r, 1500)); // 限速
}
