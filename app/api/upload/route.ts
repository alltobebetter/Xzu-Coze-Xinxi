import { NextResponse } from 'next/server';
import { isDemo } from '@/lib/config';
import { saveDemoFile } from '@/lib/store';

export const runtime = 'nodejs';

const PATH_RE =
  /^[A-Za-z0-9]{6,20}\/(screenshot|pdf|qr)-\d+-[a-f0-9]{8}\.(jpg|jpeg|png|webp|gif|pdf)$/i;

export async function POST(request: Request) {
  if (!isDemo()) {
    return NextResponse.json({ error: '当前环境不支持此上传方式' }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get('file');
  const filePath = String(form.get('path') || '');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '缺少文件' }, { status: 400 });
  }
  if (!PATH_RE.test(filePath)) {
    return NextResponse.json({ error: '上传路径不合法' }, { status: 400 });
  }
  if (file.size > 30 * 1024 * 1024) {
    return NextResponse.json({ error: '文件超过 30MB' }, { status: 400 });
  }

  try {
    await saveDemoFile(filePath, await file.arrayBuffer());
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '文件保存失败' }, { status: 500 });
  }
}
