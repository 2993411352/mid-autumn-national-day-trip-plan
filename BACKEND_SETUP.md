# 后端与上线配置

## 先解决 GitHub Pages 404

仓库当前对未登录访问返回 404，说明它是私有仓库。GitHub Free 个人账户只支持公开仓库的 Pages。二选一：

1. 免费方案：仓库 `Settings → General → Danger Zone → Change repository visibility → Public`。
2. 保持私有：升级 GitHub Pro（Pages 网站本身仍是公开的；真正的隐私由登录和数据库 RLS 控制）。

然后依次检查：

1. `Settings → Actions → General → Actions permissions` 允许 GitHub Actions。
2. `Settings → Pages → Source` 保持 `GitHub Actions`。
3. 不要点击 Jekyll 或 Static HTML 模板，本仓库已有 `.github/workflows/deploy.yml`。
4. 打开 `Actions → Deploy to GitHub Pages → Run workflow`，选择 `main` 后运行。
5. 两个 job 都变绿后访问 `https://2993411352.github.io/mid-autumn-national-day-trip-plan/`。

## 创建 Supabase 后端

1. 在 Supabase 新建项目。
2. 安装并登录 CLI，然后在仓库目录执行：

```bash
npx supabase login
npx supabase link --project-ref 你的项目ID
npx supabase db push
```

3. 部署智能体函数：

```bash
npx supabase functions deploy trip-agent
npx supabase secrets set OPENAI_API_KEY=你的密钥 OPENAI_MODEL=gpt-5
```

OpenAI API Key 只能作为 Edge Function secret，不能使用 `VITE_` 前缀，也不能提交到仓库。

4. 在 Supabase `Authentication → URL Configuration` 设置：

- Site URL：`https://2993411352.github.io/mid-autumn-national-day-trip-plan/`
- Redirect URL：同上

5. 在 GitHub 仓库 `Settings → Secrets and variables → Actions → New repository secret` 创建：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

这两个是浏览器端公开配置；安全性由数据库 RLS 控制。不要在这里放 service role key。

6. 重新运行 `Deploy to GitHub Pages` workflow。

## 已实现的数据边界

- 每个用户通过邮箱一次性链接登录。
- 首次登录自动创建一趟川西旅程及七天基础行程。
- 同伴使用邀请码加入，所有表均开启 RLS。
- 账目仅旅程成员可读；普通成员只能修改或删除自己录入的账目。
- 图册文件存放在私有 bucket，通过一小时有效的签名地址查看。
- 智能体函数验证登录与旅程成员身份，OpenAI 请求设置 `store: false`，只生成修改草案。
