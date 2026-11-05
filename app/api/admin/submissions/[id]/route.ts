import { NextResponse } from 'next/server';
import { isAuthed } from '@/lib/auth';
import { deleteSubmission } from '@/lib/store';

export const runtime = 'nodejs';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  const { id } = await params;
  if (!id) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  try {
    await deleteSubmission(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
