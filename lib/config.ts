const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// 新版 Supabase 用 sb_secret_... / SUPABASE_SECRET_KEY；
// 旧版 service_role JWT 继续兼容。
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

export const BUCKET = process.env.SUPABASE_BUCKET || 'submissions';

/**
 * 本地开发时没有配置 Supabase，自动进入演示模式：
 * 数据写入 .data/submissions.json，文件写入 .data/uploads。
 * 生产环境缺配置不会静默降级，直接报配置错误。
 */
export function isDemo(): boolean {
  if (process.env.DEMO_MODE === '1') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DEMO_MODE=1 不能用于生产环境：Vercel 文件系统只读，请连接 Supabase');
    }
    return true;
  }
  return process.env.NODE_ENV !== 'production' && !url;
}

export function hasSupabase(): boolean {
  return !!url && !!serviceKey;
}

export function supabaseConfig() {
  if (!url || !serviceKey) {
    throw new Error('缺少 Supabase 配置：请设置 NEXT_PUBLIC_SUPABASE_URL 与 SUPABASE_SECRET_KEY（或 SUPABASE_SERVICE_ROLE_KEY）');
  }
  if (serviceKey.startsWith('sb_publishable_')) {
    throw new Error('服务端密钥不能使用 publishable key，请改用 Supabase 的 secret key（sb_secret_...）');
  }
  return { url, serviceKey };
}
