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

如果只是在 CloudBase 重新上传静态压缩包，Supabase 数据库不会自动更新。已有项目升级时，请在 Supabase 的 `SQL Editor`中按顺序执行：

1. `supabase/migrations/202609170001_enforce_ten_day_trip.sql`
2. `supabase/migrations/202609170002_guides_stays_and_note_delete.sql`
3. `supabase/migrations/202609170003_expense_dates_and_photo_albums.sql`

执行成功后再刷新网页。Supabase 项目管理员和应用内的旅程成员是两套权限；同一邮箱重新登录会继续使用原来的成员身份。

3. 部署智能体函数：

```bash
npx supabase functions deploy trip-agent
npx supabase secrets set OPENAI_API_KEY=你的密钥 OPENAI_MODEL=gpt-5
```

OpenAI API Key 只能作为 Edge Function secret，不能使用 `VITE_` 前缀，也不能提交到仓库。

4. 在 Supabase `Authentication → Email Templates`（新版可能显示为 `Authentication → Emails → Templates`）中分别打开 **Confirm signup** 和 **Magic link or OTP / Magic Link / 登录链接 / 魔法链接**，把正文中的登录链接替换为验证码，例如：

```html
<h2>同行登录验证码</h2>
<p>你的验证码是：</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px">{{ .Token }}</p>
<p>验证码即将过期，请勿转发给他人。</p>
```

必须使用 `{{ .Token }}`，否则 Supabase 仍会发送点击登录链接。若你的新项目是免费套餐且仍使用 Supabase 默认邮件服务，模板编辑入口可能被限制；这时先在 `Project Settings → Authentication → SMTP Settings` 配置 Resend、Postmark、SendGrid 或 SES 等自有 SMTP，再回到模板页设置。Supabase 默认邮件服务只适合测试。

5. 在 Supabase `Authentication → URL Configuration` 设置：

- Site URL：`https://2993411352.github.io/mid-autumn-national-day-trip-plan/`
- Redirect URL：同上

6. 在 GitHub 仓库 `Settings → Secrets and variables → Actions → New repository secret` 创建：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

这两个是浏览器端公开配置；安全性由数据库 RLS 控制。不要在这里放 service role key。

7. 重新运行 `Deploy to GitHub Pages` workflow。

## 已实现的数据边界

- 每个用户通过邮箱一次性验证码登录，登录后的会话保存在当前浏览器。
- 首次登录自动创建一趟川西旅程及十天基础行程。
- 同伴使用邀请码加入，所有表均开启 RLS。
- 账目仅旅程成员可读；普通成员只能修改或删除自己录入的账目。
- 图册文件存放在私有 bucket，通过一小时有效的签名地址查看。
- 智能体函数验证登录与旅程成员身份，OpenAI 请求设置 `store: false`，只生成修改草案。
