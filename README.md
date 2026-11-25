# 守望先锋账号管理 (GitHub Pages + Supabase)

静态前端 + Supabase(登录/数据库)+ GitHub Actions(定时更新段位)。
邮箱/密码/验证码链接在**浏览器端用共享主密码 AES-GCM 加密**后才上传,数据库里只有密文。

## 部署步骤

### 1. Supabase
1. 在 https://supabase.com 新建项目(免费)。
2. SQL Editor 运行 `supabase/schema.sql`。
3. Authentication → Providers → Email:**关闭 "Allow new users to sign up"**。
4. Authentication → Users → "Add user" 手动给 4-5 个朋友创建邮箱+密码账号。
5. Project Settings → API:复制 `Project URL` 和 `anon key` 填入 `config.js`;复制 `service_role key`(**保密**)。

### 2. GitHub
```bash
git init && git add . && git commit -m "init"
git branch -M main
git remote add origin https://github.com/<你>/<仓库>.git
git push -u origin main
```
- Settings → Secrets and variables → Actions,添加:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_KEY`(service_role key)
- Settings → Pages → Source 选 **GitHub Actions**。
- 访问 `https://<你>.github.io/<仓库>/`。
- Actions 里手动运行 "Update ranks" 测试段位抓取。

### 3. 使用
- 登录 → 输入大家约定的**主密码**(忘记则无法恢复数据)→ 添加账号。
- 填 BattleTag 后,段位每 3 小时自动更新(需在游戏内把生涯资料设为**公开**)。
- 验证码:点"打开验证码"新窗口打开保存的链接;"内嵌"仅在目标站允许 iframe 时可用。

## 注意
- 段位来自非官方 OverFast API,可能失效或延迟。
- 不要把 service_role key 写进代码或提交。
- 账号共享可能违反暴雪用户协议。
