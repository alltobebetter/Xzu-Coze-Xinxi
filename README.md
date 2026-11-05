# 扣子（Coze）智能体设计大赛 · 作品提交页

Next.js（App Router）+ Supabase（Postgres + Storage），面向 Vercel 部署。

- 提交端：`/`
- 管理端：`/admin`（口令登录，可检索、查看文件、导出 CSV）
- 数据：参赛者、作品信息存 Postgres；截图 / PDF / 二维码存私有存储桶
- 大文件：浏览器拿服务端签名的上传地址后**直传 Supabase**，绕开 Vercel 函数 4.5MB 请求体限制

设计说明见 [`DESIGN.md`](./DESIGN.md)。

## 本地预览（不需要任何账号）

```bash
npm install
npm run dev
```

打开 http://localhost:3000 。没有配置 Supabase 时会自动进入**演示模式**：

- 数据写入 `.data/submissions.json`
- 文件写入 `.data/uploads/`
- 管理端口令：在 `.env.local` 里设置（示例见下）

`.env.local` 示例：

```dotenv
DEMO_MODE=1
ADMIN_PASSWORD=请换成至少12位强口令
SESSION_SECRET=请换成32位以上随机字符串
```

> 演示模式只用于本地。Vercel 的文件系统只读，不要把 `DEMO_MODE=1` 部署上去。

## 配置 Supabase（上线前）

1. 在 [supabase.com](https://supabase.com) 新建项目（免费额度够用）。
2. 打开 **SQL Editor**，把 [`supabase/schema.sql`](./supabase/schema.sql) 整段执行一次。
   - 会创建 `public.submissions` 表（学号唯一）
   - 会创建私有存储桶 `submissions`，单文件上限 30MB，只允许图片 / PDF
   - 表开启 RLS 且不建策略，匿名用户无法读写；服务端用 secret key（旧版为 service_role）访问
3. 打开 **Project Settings → API Keys**，复制：
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - publishable key（`sb_publishable_...`）→ `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - secret key（`sb_secret_...`）→ `SUPABASE_SECRET_KEY`（**只放服务端，不要加 NEXT_PUBLIC_**）
   - 旧版项目的 `anon` / `service_role` JWT 仍然兼容，分别填入 `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`

> 免费版 Supabase Storage 通常只有 1GB 左右。若 PDF 较多，注意压缩文件或赛后清理，避免配额被占满。

`.env.local` 改为：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
SUPABASE_BUCKET=submissions

ADMIN_PASSWORD=换成你的管理口令
SESSION_SECRET=至少32位随机字符串
# 可选：提交截止时间（含时区）
NEXT_PUBLIC_DEADLINE=2026-11-20T23:59:59+08:00
```

重启 `npm run dev`，提交一条测试数据，然后到 `/admin` 检查。

## 部署到 Vercel

1. 把项目推到 GitHub / GitLab。
2. Vercel → **Add New Project** → 选择仓库。
3. **Root Directory** 选 `coze-submit`（如果仓库根目录就是本项目，保持默认）。
4. 在 **Environment Variables** 里填入上面列出的全部变量（Production / Preview 都要）。
5. Deploy。

Framework 会被自动识别为 Next.js，不需要改 Build Command。

## 管理端

访问 `https://你的域名/admin`，输入 `ADMIN_PASSWORD`。

- 检索：姓名 / 学号 / 作品名 / 专业
- 筛选：双语 / 知识库 / AI 辅助
- 导出：`导出 CSV`（带 BOM，Excel 直接打开）
- 点击任意一行查看详情、打开截图与 PDF、删除整条提交（文件一并删除）
- 登录状态 8 小时，Cookie 为 HttpOnly + SameSite=Lax

## 数据与安全

| 项目 | 做法 |
| --- | --- |
| 数据库访问 | 仅服务端 secret key（旧版 `service_role`），表 RLS 全拒匿名 |
| 文件访问 | 私有桶；管理端通过 10 分钟签名链接读取 |
| 上传 | 服务端生成一次性签名地址，路径限定为 `学号/类型-时间-随机.扩展名` |
| 重复提交 | `student_id` 唯一约束，前端提示联系负责人 |
| 限流 | 提交 200 次/小时/IP + 8 次/小时/学号，上传地址 800 次/小时/IP + 30 次/小时/学号，登录 10 次/15 分钟/IP |
| 个人信息 | 只收姓名、学号、年级、专业、手机号；不存身份证、住址 |

> 限流是进程内计数，Vercel 多实例下不是严格全局限制；对校内比赛足够。

## 上线前检查清单

- [ ] `supabase/schema.sql` 已执行，桶 `submissions` 为 private
- [ ] 全部环境变量已配置，`DEMO_MODE` 未设置
- [ ] `ADMIN_PASSWORD` 不是示例值
- [ ] `NEXT_PUBLIC_DEADLINE` 与实际通知一致（不填则显示“以群内通知为准”）
- [ ] 用手机流量打开一次，测试截图上传和 PDF 上传
- [ ] 提交一条测试作品，在 `/admin` 能看到、能打开 PDF、能导出 CSV
- [ ] 删除测试作品

## 常见问题

**上传返回 401 / 403**
检查 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`（旧版为 `NEXT_PUBLIC_SUPABASE_ANON_KEY`）是否配置；直传请求需要 `apikey` 头。再确认存储桶存在且为 private。

**提交提示“文件尚未上传完成”**
签名地址 2 小时有效，但页面停留过久或上传中断会导致文件不存在。重新选择文件再提交。

**Vercel 上写入 `.data/` 失败**
说明误设了 `DEMO_MODE=1`。Vercel 文件系统只读，必须连接 Supabase。

**国内访问慢**
Vercel 默认域名在部分网络下不稳定，建议绑定自定义域名；Supabase 可换用新加坡 / 东京区域。

## 目录

```
app/
  page.tsx                 提交页
  globals.css              设计系统与提交页样式
  admin/                   管理端（页面 / 布局 / 样式）
  api/
    upload-url/            生成签名直传地址
    upload/                仅演示模式：本地落盘
    submit/                校验并写入数据库
    admin/                 登录、列表、删除、文件、CSV
components/
  SubmitForm.tsx           表单、上传、二维码、成功凭证
  AdminDashboard.tsx       登记簿
  LoginForm.tsx
lib/
  store.ts                 Supabase / 本地演示两套存储
  validation.ts            前后端共用校验规则
  auth.ts                  口令与签名 Cookie
  types.ts                 字段、能力项、文件限制
supabase/schema.sql
```
