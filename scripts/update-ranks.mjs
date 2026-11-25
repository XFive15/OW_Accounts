// 通过 OverFast API (非官方) 抓取公开生涯资料中的竞技段位,写回 Supabase
// 需要环境变量:SUPABASE_URL, SUPABASE_SERVICE_KEY
const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("缺少 SUPABASE_URL 或 SUPABASE_SERVICE_KEY(检查 GitHub Secrets 名称)");
  process.exit(1);
}
const base = SUPABASE_URL.replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
// 新版 sb_secret_ 密钥不是 JWT,只能放在 apikey 头里
const H = { apikey: SUPABASE_SERVICE_KEY, "Content-Type": "application/json" };

const res = await fetch(`${base}/rest/v1/accounts?select=id,battletag`, { headers: H });
if (!res.ok) {
  console.error("读取账号失败", res.status, await res.text());
  process.exit(1);
}
const list = (await res.json()).filter((a) => a.battletag && a.battletag.trim());
console.log(`共 ${list.length} 个账号带 BattleTag`);

let failed = 0;
for (const a of list) {
  const tag = a.battletag.trim();
  const id = tag.replace("#", "-");
  try {
    const r = await fetch(`https://overfast-api.tekrop.fr/players/${encodeURIComponent(id)}/summary`, {
      headers: { "User-Agent": "ow-account-manager" },
    });
    if (!r.ok) { console.log(tag, "HTTP", r.status, (await r.text()).slice(0, 200)); failed++; continue; }
    const j = await r.json();
    const c = j.competitive?.pc;
    if (!c) { console.log(tag, "无竞技数据(资料未公开?) privacy =", j.privacy); failed++; continue; }
    const ranks = { tank: c.tank, damage: c.damage, support: c.support };
    const p = await fetch(`${base}/rest/v1/accounts?id=eq.${a.id}`, {
      method: "PATCH", headers: { ...H, Prefer: "return=minimal" },
      body: JSON.stringify({ ranks, ranks_updated_at: new Date().toISOString() }),
    });
    if (!p.ok) { console.log(tag, "写入失败", p.status, await p.text()); failed++; continue; }
    console.log(tag, "OK", JSON.stringify(ranks));
  } catch (e) { console.log(tag, "ERR", e.message); failed++; }
  await new Promise((r) => setTimeout(r, 1500));
}
if (failed === list.length && list.length) process.exit(1);
