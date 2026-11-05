import { NextResponse } from 'next/server';
import { isAuthed } from '@/lib/auth';
import { listSubmissions } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  try {
    const items = await listSubmissions();
    return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '读取数据失败' }, { status: 500 });
  }
}
