import { NextResponse } from 'next/server';
import { SITE } from '@/lib/site';
import { StoreError, createSubmission, verifyPaths } from '@/lib/store';
import { normalizeSubmission, validateSubmission } from '@/lib/validation';
import { clientIp, rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!rateLimit(`submit:ip:${ip}`, 200, 60 * 60 * 1000)) {
    return NextResponse.json({ error: '提交过于频繁，请稍后再试' }, { status: 429 });
  }

  if (SITE.deadline) {
    const deadline = new Date(SITE.deadline);
    if (!Number.isNaN(deadline.getTime()) && Date.now() > deadline.getTime()) {
      return NextResponse.json({ error: '本次作品提交已截止' }, { status: 403 });
    }
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });
  }

  if (!raw || typeof raw !== 'object') {
    return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });
  }

  const input = normalizeSubmission(raw as Parameters<typeof normalizeSubmission>[0]);
  const errors = validateSubmission(input);
  if (Object.keys(errors).length) {
    return NextResponse.json({ error: '表单校验未通过', fields: errors }, { status: 422 });
  }

  if (!rateLimit(`submit:student:${input.student_id}`, 8, 60 * 60 * 1000)) {
    return NextResponse.json({ error: '该学号提交次数过多，请稍后再试' }, { status: 429 });
  }

  const allPaths = [...input.screenshot_paths, input.pdf_path, input.qr_path].filter(
    Boolean,
  ) as string[];

  const unique = new Set(allPaths);
  if (unique.size !== allPaths.length) {
    return NextResponse.json({ error: '文件路径重复' }, { status: 400 });
  }

  const valid = await verifyPaths(allPaths, input.student_id);
  if (!valid) {
    return NextResponse.json(
      { error: '文件尚未上传完成或已失效，请重新上传后再提交' },
      { status: 400 },
    );
  }

  try {
    const created = await createSubmission(input);
    return NextResponse.json({ ok: true, ...created });
  } catch (error) {
    if (error instanceof StoreError && error.code === 'DUPLICATE') {
      return NextResponse.json(
        { error: error.message, code: 'DUPLICATE' },
        { status: 409 },
      );
    }
    console.error(error);
    return NextResponse.json({ error: '提交失败，请稍后重试' }, { status: 500 });
  }
}
