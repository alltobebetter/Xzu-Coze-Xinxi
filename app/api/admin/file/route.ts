import { NextResponse } from 'next/server';
import { isAuthed } from '@/lib/auth';
import { isDemo } from '@/lib/config';
import { readDemoFile, signedFileUrl } from '@/lib/store';

export const runtime = 'nodejs';

const TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
};

export async function GET(request: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const filePath = new URL(request.url).searchParams.get('path');
  if (!filePath || filePath.includes('..')) {
    return NextResponse.json({ error: '缺少文件路径' }, { status: 400 });
  }

  try {
    if (isDemo()) {
      const buffer = await readDemoFile(filePath);
      const ext = filePath.split('.').pop()?.toLowerCase() || '';
      return new Response(new Uint8Array(buffer), {
        headers: {
          'Content-Type': TYPES[ext] || 'application/octet-stream',
          'Cache-Control': 'private, max-age=60',
        },
      });
    }

    const url = await signedFileUrl(filePath);
    if (!url) return NextResponse.json({ error: '文件不存在' }, { status: 404 });
    return NextResponse.redirect(url);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '文件读取失败' }, { status: 404 });
  }
}
