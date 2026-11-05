import { NextResponse } from 'next/server';
import { createUploadTarget } from '@/lib/store';
import { FILE_LIMITS, type UploadKind } from '@/lib/types';
import { clientIp, rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const ALLOWED: Record<UploadKind, string[]> = {
  screenshot: ['jpg', 'jpeg', 'png', 'webp'],
  pdf: ['pdf'],
  qr: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
};

function extensionOf(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx > -1 ? name.slice(idx + 1).toLowerCase() : '';
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!rateLimit(`upload:ip:${ip}`, 800, 60 * 60 * 1000)) {
    return NextResponse.json({ error: '上传过于频繁，请稍后再试' }, { status: 429 });
  }

  let body: {
    studentId?: string;
    kind?: UploadKind;
    name?: string;
    size?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });
  }

  const studentId = String(body.studentId || '').trim();
  const kind = body.kind as UploadKind;
  const name = String(body.name || '');
  const size = Number(body.size || 0);

  if (!/^[A-Za-z0-9]{6,20}$/.test(studentId)) {
    return NextResponse.json({ error: '学号格式不正确' }, { status: 400 });
  }
  if (!kind || !Object.hasOwn(FILE_LIMITS, kind)) {
    return NextResponse.json({ error: '文件类型不正确' }, { status: 400 });
  }
  if (!rateLimit(`upload:student:${studentId}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ error: '该学号上传次数过多，请稍后再试' }, { status: 429 });
  }

  const ext = extensionOf(name);
  if (!ALLOWED[kind].includes(ext)) {
    return NextResponse.json({ error: '文件格式不支持' }, { status: 400 });
  }
  if (size > FILE_LIMITS[kind].max) {
    return NextResponse.json(
      { error: `文件超过 ${FILE_LIMITS[kind].label} 限制` },
      { status: 400 },
    );
  }

  const filePath = `${studentId}/${kind}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  try {
    const target = await createUploadTarget(filePath);
    return NextResponse.json({ ...target, path: filePath });
  } catch (error) {
    console.error(error);
    const networkIssue =
      error instanceof Error && /fetch failed|network|timeout/i.test(error.message);
    return NextResponse.json(
      {
        error: networkIssue
          ? '无法连接文件存储服务，请检查网络后重试'
          : '无法创建上传地址，请稍后再试',
      },
      { status: networkIssue ? 503 : 500 },
    );
  }
}
