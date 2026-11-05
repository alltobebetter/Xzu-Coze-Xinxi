import { CAPABILITIES, type Capability, type SubmissionInput } from './types';

type Basic = {
  name?: string;
  student_id?: string;
  grade?: string;
  major?: string;
  phone?: string;
  work_name?: string;
  share_link?: string;
  description?: string;
  bilingual?: boolean;
  capabilities?: string[];
  kb_source?: string | null;
  kb_reviewer?: string | null;
  highlights?: string | null;
  ai_used?: boolean;
  ai_scope?: string | null;
  screenshot_paths?: string[];
  pdf_path?: string;
  qr_path?: string | null;
};

export type FieldErrors = Record<string, string>;

export function validateSubmission(data: Basic): FieldErrors {
  const errors: FieldErrors = {};
  const text = (v?: string | null) => (v || '').trim();

  if (!text(data.name)) errors.name = '请填写姓名';
  else if (text(data.name).length < 2 || text(data.name).length > 20) errors.name = '姓名长度应为 2–20 个字符';

  if (!text(data.student_id)) errors.student_id = '请填写学号';
  else if (!/^[A-Za-z0-9]{6,20}$/.test(text(data.student_id))) errors.student_id = '学号格式不正确';

  if (!text(data.grade)) errors.grade = '请填写年级';
  else if (text(data.grade).length > 20) errors.grade = '年级名称过长';
  if (!text(data.major)) errors.major = '请填写专业';
  else if (text(data.major).length < 2 || text(data.major).length > 30) errors.major = '专业名称长度不正确';

  if (!text(data.phone)) errors.phone = '请填写手机号';
  else if (!/^1[3-9]\d{9}$/.test(text(data.phone))) errors.phone = '请输入 11 位手机号';

  if (!text(data.work_name)) errors.work_name = '请填写作品名称';
  else if (text(data.work_name).length < 2 || text(data.work_name).length > 40) errors.work_name = '作品名称长度不正确';

  if (!text(data.share_link)) errors.share_link = '请填写智能体分享链接';
  else {
    try {
      const url = new URL(text(data.share_link));
      if (!/^https?:$/.test(url.protocol)) errors.share_link = '链接需以 http:// 或 https:// 开头';
    } catch {
      errors.share_link = '链接格式不正确';
    }
  }

  if (!text(data.description)) errors.description = '请填写作品简介';
  else if (text(data.description).length < 20) errors.description = '简介至少 20 字';
  else if (text(data.description).length > 500) errors.description = '简介不能超过 500 字';

  if (typeof data.bilingual !== 'boolean') errors.bilingual = '请选择是否具备双语能力';

  const caps = (data.capabilities || []).filter((c): c is Capability =>
    (CAPABILITIES as readonly string[]).includes(c),
  );
  if (caps.length < 2) errors.capabilities = '请至少选择两项平台能力';

  const usesKb = caps.includes('知识库构建');
  if (usesKb && !text(data.kb_source)) errors.kb_source = '请填写知识库来源';
  else if (text(data.kb_source).length > 300) errors.kb_source = '知识库来源不能超过 300 字';
  if (usesKb && !text(data.kb_reviewer)) errors.kb_reviewer = '请填写知识库人工审核责任人';
  else if (text(data.kb_reviewer).length > 30) errors.kb_reviewer = '审核责任人姓名过长';

  if (typeof data.ai_used !== 'boolean') errors.ai_used = '请选择是否使用 AI 工具辅助创作';
  if (data.ai_used && !text(data.ai_scope)) errors.ai_scope = '请说明 AI 工具的参与范围';
  else if (text(data.ai_scope).length > 100) errors.ai_scope = 'AI 参与范围不能超过 100 字';

  if (text(data.highlights).length > 100) errors.highlights = '创新亮点不能超过 100 字';

  const shots = data.screenshot_paths || [];
  if (shots.length < 1) errors.screenshot_paths = '请至少上传 1 张作品截图';
  if (shots.length > 5) errors.screenshot_paths = '截图不能超过 5 张';

  if (!text(data.pdf_path)) errors.pdf_path = '请上传设计说明 PDF';

  return errors;
}

export function normalizeSubmission(data: Basic): SubmissionInput {
  const text = (v?: string | null) => (v || '').trim();
  const caps = (data.capabilities || []).filter((c): c is Capability =>
    (CAPABILITIES as readonly string[]).includes(c),
  );
  const usesKb = caps.includes('知识库构建');

  return {
    name: text(data.name),
    student_id: text(data.student_id),
    grade: text(data.grade),
    major: text(data.major),
    phone: text(data.phone),
    work_name: text(data.work_name),
    share_link: text(data.share_link),
    description: text(data.description),
    bilingual: !!data.bilingual,
    capabilities: caps,
    kb_source: usesKb ? text(data.kb_source) || null : null,
    kb_reviewer: usesKb ? text(data.kb_reviewer) || null : null,
    highlights: text(data.highlights) || null,
    ai_used: !!data.ai_used,
    ai_scope: data.ai_used ? text(data.ai_scope) || null : null,
    screenshot_paths: (data.screenshot_paths || []).slice(0, 5),
    pdf_path: text(data.pdf_path),
    qr_path: text(data.qr_path) || null,
  };
}
