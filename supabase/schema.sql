-- 在 Supabase → SQL Editor 中运行
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  battletag text,                 -- 明文,用于查询段位
  secret text not null,           -- 浏览器端加密后的 邮箱/密码/验证码链接/备注
  ranks jsonb,                    -- {tank:{division,tier},damage:{...},support:{...}}
  ranks_updated_at timestamptz,
  created_at timestamptz default now()
);

alter table public.accounts enable row level security;

-- 只有已登录(被你邀请的)用户可读写
create policy "auth read"   on public.accounts for select to authenticated using (true);
create policy "auth insert" on public.accounts for insert to authenticated with check (true);
create policy "auth update" on public.accounts for update to authenticated using (true) with check (true);
create policy "auth delete" on public.accounts for delete to authenticated using (true);

-- 因创建项目时未自动授权 Data API,这里手动授权(RLS 仍然限制只有登录用户可访问)
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.accounts to authenticated;
grant all on public.accounts to service_role;

-- 使用状态(已建过表的话,单独运行这一段即可)
alter table public.accounts add column if not exists in_use boolean not null default false;
alter table public.accounts add column if not exists in_use_by text;
alter table public.accounts add column if not exists in_use_at timestamptz;
