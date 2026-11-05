import { NextResponse } from 'next/server';
import { isAuthed } from '@/lib/auth';
import { listSubmissions } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEADERS = [
  '提交编号',
  '提交时间',
  '姓名',
  '学号',
  '年级',
  '专业',
  '手机号',
  '作品名称',
  '智能体链接',
  '作品简介',
  '藏汉双语',
  '平台能力',
  '知识库来源',
  '知识库审核责任人',
  '创新亮点',
  'AI 辅助',
  'AI 参与范围',
  '截图数量',
  '二维码',
];

function cell(value: unknown): string {
  let text = String(value ?? '');
  // 防止 CSV 公式注入
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const items = await listSubmissions();
  const lines = [HEADERS.map(cell).join(',')];

  for (const row of items) {
    lines.push(
      [
        row.id,
        new Date(row.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
        row.name,
        row.student_id,
        row.grade,
        row.major,
        row.phone,
        row.work_name,
        row.share_link,
        row.description,
        row.bilingual ? '是' : '否',
        (row.capabilities || []).join(' / '),
        row.kb_source,
        row.kb_reviewer,
        row.highlights,
        row.ai_used ? '是' : '否',
        row.ai_scope,
        (row.screenshot_paths || []).length,
        row.qr_path ? '有' : '无',
      ]
        .map(cell)
        .join(','),
    );
  }

  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate(),
  ).padStart(2, '0')}`;

  return new Response('\uFEFF' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="coze-submissions-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
