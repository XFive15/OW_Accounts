import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);
const show = (...ids) => ["loginView", "unlockView", "listView"].forEach((v) => ($(v).hidden = !ids.includes(v)));
const msg = (t = "") => ($("msg").textContent = t);

let key = null;      // AES key (仅内存)
let accounts = [];
let editingId = null;

/* ---------- 加解密 (PBKDF2 -> AES-GCM) ---------- */
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(pw) {
  const base = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode("ow-account-manager-v1"), iterations: 250000, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function encrypt(obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(obj)));
  return b64(iv) + "." + b64(ct);
}
async function decrypt(s) {
  const [iv, ct] = s.split(".");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, key, unb64(ct));
  return JSON.parse(dec.decode(pt));
}

/* ---------- 登录 ---------- */
async function boot() {
  const { data } = await sb.auth.getSession();
  if (data.session) afterLogin(); else show("loginView");
}
let me = "";
function afterLogin() {
  sb.auth.getUser().then(({ data }) => (me = (data.user?.email || "").split("@")[0]));
  $("bar").hidden = false;
  show("unlockView");
}
$("loginForm").onsubmit = async (e) => {
  e.preventDefault();
  const { error } = await sb.auth.signInWithPassword({ email: $("email").value, password: $("pass").value });
  if (error) return msg("登录失败:" + error.message);
  msg(); afterLogin();
};
$("btnLogout").onclick = async () => { await sb.auth.signOut(); key = null; location.reload(); };

$("unlockForm").onsubmit = async (e) => {
  e.preventDefault();
  key = await deriveKey($("master").value);
  try { await load(); msg(); show("listView"); }
  catch { key = null; msg("主密码错误,或数据读取失败"); }
};

/* ---------- 数据 ---------- */
async function load() {
  const { data, error } = await sb.from("accounts").select("*").order("created_at");
  if (error) throw error;
  const out = [];
  for (const r of data) out.push({ ...r, secret: await decrypt(r.secret) }); // 错误密码会抛异常
  accounts = out;
  render();
}

function rankText(r) {
  if (!r) return "—";
  return `${r.division ?? ""} ${r.tier ?? ""}`.trim() || "—";
}

function render() {
  const box = $("cards");
  box.innerHTML = "";
  if (!accounts.length) box.innerHTML = '<p class="hint">还没有账号,点右上角添加。</p>';
  for (const a of accounts) {
    const rk = a.ranks || {};
    const el = document.createElement("div");
    el.className = "card";
    el.innerHTML = `
      <h3></h3><div class="tag"></div>
      <div class="status"><span class="badge"></span><button class="sm" data-a="use"></button></div>
      <div class="ranks">
        <span>🛡 ${rankText(rk.tank)}</span><span>⚔ ${rankText(rk.damage)}</span><span>💚 ${rankText(rk.support)}</span>
      </div>
      <div class="tag">${a.ranks_updated_at ? "段位更新:" + new Date(a.ranks_updated_at).toLocaleString() : "段位未更新"}</div>
      <div class="note"></div>
      <div class="acts">
        <button class="sm" data-a="email">复制邮箱</button>
        <button class="sm" data-a="pw">复制密码</button>
        <button class="sm" data-a="open">打开验证码</button>
        <button class="sm ghost" data-a="frame">内嵌验证码</button>
        <button class="sm ghost" data-a="edit">编辑</button>
        <button class="sm ghost" data-a="del">删除</button>
      </div>
      <div class="frame"></div>`;
    el.querySelector("h3").textContent = a.name;
    el.querySelector(".tag").textContent = a.battletag || "(未填 BattleTag)";
    const badge = el.querySelector(".badge"), useBtn = el.querySelector('[data-a="use"]');
    badge.textContent = a.in_use ? `🔴 使用中${a.in_use_by ? " · " + a.in_use_by : ""}` : "🟢 空闲";
    badge.className = "badge " + (a.in_use ? "busy" : "free");
    useBtn.textContent = a.in_use ? "我用完了" : "我要用";
    el.querySelector(".note").textContent = a.secret.note || a.note || "";
    el.querySelector(".acts").onclick = (ev) => act(ev.target.dataset.a, a, el);
    box.appendChild(el);
  }
}

async function copy(text, btn) {
  await navigator.clipboard.writeText(text);
  const old = btn.textContent; btn.textContent = "已复制 ✓";
  setTimeout(() => (btn.textContent = old), 1200);
}

async function act(what, a, el) {
  const btn = event.target;
  if (what === "use") {
    const next = !a.in_use;
    if (next && a.in_use && !confirm("该账号正被占用,确定接管?")) return;
    const { error } = await sb.from("accounts")
      .update({ in_use: next, in_use_by: next ? me : null, in_use_at: new Date().toISOString() })
      .eq("id", a.id);
    if (error) return msg("更新状态失败:" + error.message);
    return load();
  }
  if (what === "email") copy(a.secret.email, btn);
  if (what === "pw") copy(a.secret.password, btn);
  if (what === "open") a.secret.codeUrl ? window.open(a.secret.codeUrl, "_blank", "noopener") : alert("没有保存验证码链接");
  if (what === "frame") {
    const f = el.querySelector(".frame");
    f.innerHTML = f.innerHTML ? "" : `<iframe sandbox="allow-scripts allow-same-origin" src="${encodeURI(a.secret.codeUrl || "about:blank")}"></iframe>
      <p class="hint">若空白,说明该网站禁止内嵌,请用"打开验证码"。</p>`;
  }
  if (what === "edit") openDlg(a);
  if (what === "del" && confirm(`删除 ${a.name}?`)) {
    await sb.from("accounts").delete().eq("id", a.id);
    load();
  }
}

/* ---------- 编辑对话框 ---------- */
const form = $("accForm");
function openDlg(a = null) {
  editingId = a?.id ?? null;
  $("dlgTitle").textContent = a ? "编辑账号" : "添加账号";
  form.name.value = a?.name ?? "";
  form.battletag.value = a?.battletag ?? "";
  form.email.value = a?.secret.email ?? "";
  form.password.value = a?.secret.password ?? "";
  form.codeUrl.value = a?.secret.codeUrl ?? "";
  form.note.value = a?.secret.note ?? "";
  $("dlg").showModal();
}
$("btnAdd").onclick = () => key && openDlg();
$("dlgCancel").onclick = () => $("dlg").close();
form.onsubmit = async () => {
  const f = Object.fromEntries(new FormData(form));
  const row = {
    name: f.name,
    battletag: f.battletag.trim(),
    secret: await encrypt({ email: f.email, password: f.password, codeUrl: f.codeUrl.trim(), note: f.note }),
  };
  const q = editingId ? sb.from("accounts").update(row).eq("id", editingId) : sb.from("accounts").insert(row);
  const { error } = await q;
  if (error) return msg("保存失败:" + error.message);
  load();
};

boot();
