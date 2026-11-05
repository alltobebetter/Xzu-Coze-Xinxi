-- ============================================================
-- 扣子智能体设计大赛 · 提交页数据库
-- 在 Supabase Dashboard → SQL Editor 中整段执行一次即可
-- ============================================================

create extension if not exists "pgcrypto";

create table if not exists public.submissions (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  status           text not null default 'submitted',

  name             text not null,
  student_id       text not null,
  grade            text not null,
  major            text not null,
  phone            text not null,

  work_name        text not null,
  share_link       text not null,
  description      text not null,
  bilingual        boolean not null default false,
  capabilities     text[] not null default '{}',
  kb_source        text,
  kb_reviewer      text,
  highlights       text,
  ai_used          boolean not null default false,
  ai_scope         text,

  screenshot_paths text[] not null default '{}',
  pdf_path         text not null,
  qr_path          text,

  constraint submissions_student_id_unique unique (student_id),
  constraint submissions_status_check check (status in ('submitted'))
);

create index if not exists submissions_created_at_idx
  on public.submissions (created_at desc);

-- 服务端只用 service_role 访问，不开放匿名读写。
-- 开启 RLS 且不创建任何策略，anon / authenticated 一律被拒绝。
alter table public.submissions enable row level security;

-- ------------------------------------------------------------
-- 文件存储桶：私有，单文件最大 30MB
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'submissions',
  'submissions',
  false,
  31457280,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 上传走服务端生成的签名地址（service_role），不需要给 anon 开放 storage 策略。
-- 管理端预览由 /api/admin/file 生成 10 分钟有效的签名链接。
