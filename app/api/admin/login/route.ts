import { NextResponse } from 'next/server';
import { checkPassword, setSessionCookie } from '@/lib/auth';
import { clientIp, rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!rateLimit(`login:${clientIp(request)}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json({ error: '尝试次数过多，请 15 分钟后再试' }, { status: 429 });
  }

  let password = '';
  try {
    const body = await request.json();
    password = String(body?.password || '');
  } catch {
    return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });
  }

  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: '服务端未配置 ADMIN_PASSWORD' }, { status: 500 });
  }

  if (!checkPassword(password)) {
    return NextResponse.json({ error: '口令不正确' }, { status: 401 });
  }

  await setSessionCookie();
  return NextResponse.json({ ok: true });
}
