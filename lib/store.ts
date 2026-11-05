import { promises as fs } from 'fs';
import path from 'path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { BUCKET, hasSupabase, isDemo, supabaseConfig } from './config';
import type { Submission, SubmissionInput } from './types';

let cached: SupabaseClient | null = null;

function admin(): SupabaseClient {
  if (!cached) {
    const { url, serviceKey } = supabaseConfig();
    cached = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}

export class StoreError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/* ------------------------- 本地演示存储 ------------------------- */

const DATA_DIR = path.join(process.cwd(), '.data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const STORE_FILE = path.join(DATA_DIR, 'submissions.json');

async function ensureDirs() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

async function readDemo(): Promise<Submission[]> {
  try {
    const raw = await fs.readFile(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeDemo(list: Submission[]) {
  await ensureDirs();
  await fs.writeFile(STORE_FILE, JSON.stringify(list, null, 2), 'utf8');
}

/* ------------------------- 路径安全 ------------------------- */

function safeRelative(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.includes('..') || normalized.startsWith('/')) {
    throw new StoreError('BAD_PATH', '非法的文件路径');
  }
  return normalized;
}

function demoAbsolute(filePath: string): string {
  const rel = safeRelative(filePath);
  const abs = path.resolve(UPLOAD_DIR, rel);
  if (!abs.startsWith(path.resolve(UPLOAD_DIR) + path.sep)) {
    throw new StoreError('BAD_PATH', '非法的文件路径');
  }
  return abs;
}

/* ------------------------- 公开方法 ------------------------- */

export async function createSubmission(
  input: SubmissionInput,
): Promise<{ id: string; created_at: string }> {
  if (isDemo()) {
    const list = await readDemo();
    if (list.some((row) => row.student_id === input.student_id)) {
      throw new StoreError('DUPLICATE', '该学号已提交过作品');
    }
    const row: Submission = {
      ...input,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      status: 'submitted',
    };
    list.unshift(row);
    await writeDemo(list);
    return { id: row.id, created_at: row.created_at };
  }

  if (!hasSupabase()) {
    throw new StoreError('CONFIG', '服务端未配置 Supabase');
  }

  const { data, error } = await admin()
    .from('submissions')
    .insert({ ...input, status: 'submitted' })
    .select('id, created_at')
    .single();

  if (error) {
    if (error.code === '23505') throw new StoreError('DUPLICATE', '该学号已提交过作品');
    throw new StoreError('DB', error.message);
  }
  return data as { id: string; created_at: string };
}

export async function listSubmissions(): Promise<Submission[]> {
  if (isDemo()) {
    const list = await readDemo();
    return list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  }
  const { data, error } = await admin()
    .from('submissions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new StoreError('DB', error.message);
  return (data || []) as Submission[];
}

export async function deleteSubmission(id: string): Promise<void> {
  if (isDemo()) {
    const list = await readDemo();
    const row = list.find((item) => item.id === id);
    if (!row) return;
    await writeDemo(list.filter((item) => item.id !== id));
    await removeFiles(filesOf(row));
    return;
  }

  const { data, error } = await admin().from('submissions').select('*').eq('id', id).single();
  if (error || !data) return;

  const del = await admin().from('submissions').delete().eq('id', id);
  if (del.error) throw new StoreError('DB', del.error.message);
  await removeFiles(filesOf(data as Submission));
}

export function filesOf(row: Submission): string[] {
  return [...(row.screenshot_paths || []), row.pdf_path, row.qr_path].filter(Boolean) as string[];
}

async function removeFiles(paths: string[]) {
  const real = paths.filter(Boolean);
  if (!real.length) return;
  if (isDemo()) {
    await Promise.all(
      real.map(async (p) => {
        try {
          await fs.unlink(demoAbsolute(p));
        } catch {
          /* 文件不存在时忽略 */
        }
      }),
    );
    return;
  }
  try {
    await admin().storage.from(BUCKET).remove(real);
  } catch (e) {
    console.error('清理文件失败', e);
  }
}

export async function saveDemoFile(filePath: string, data: ArrayBuffer): Promise<void> {
  const abs = demoAbsolute(filePath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, Buffer.from(data));
}

export async function readDemoFile(filePath: string): Promise<Buffer> {
  return fs.readFile(demoAbsolute(filePath));
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    if (isDemo()) {
      await fs.access(demoAbsolute(filePath));
      return true;
    }
    const dir = filePath.split('/').slice(0, -1).join('/');
    const name = filePath.split('/').pop()!;
    const { data, error } = await admin().storage.from(BUCKET).list(dir, { limit: 100 });
    if (error) return false;
    return (data || []).some((item) => item.name === name);
  } catch {
    return false;
  }
}

export async function verifyPaths(paths: string[], studentId: string): Promise<boolean> {
  const prefix = `${studentId}/`;
  for (const p of paths) {
    if (!p.startsWith(prefix) || p.includes('..')) return false;
    if (!(await fileExists(p))) return false;
  }
  return true;
}

export async function signedFileUrl(filePath: string): Promise<string | null> {
  if (isDemo()) {
    return `/api/admin/file?path=${encodeURIComponent(filePath)}`;
  }
  const { data, error } = await admin().storage.from(BUCKET).createSignedUrl(filePath, 60 * 10);
  if (error || !data) {
    console.error('生成签名链接失败', error);
    return null;
  }
  return data.signedUrl;
}

export async function createUploadTarget(
  filePath: string,
): Promise<{ mode: 'signed'; signedUrl: string } | { mode: 'demo'; path: string }> {
  if (isDemo()) return { mode: 'demo', path: filePath };

  const { data, error } = await admin().storage.from(BUCKET).createSignedUploadUrl(filePath);
  if (error || !data) {
    throw new StoreError('STORAGE', error?.message || '无法创建上传地址');
  }
  return { mode: 'signed', signedUrl: data.signedUrl };
}
