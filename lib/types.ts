export const CAPABILITIES = [
  '结构化 Prompt 设计',
  '知识库构建',
  '工作流编排',
  '插件调用',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export type SubmissionInput = {
  name: string;
  student_id: string;
  grade: string;
  major: string;
  phone: string;
  work_name: string;
  share_link: string;
  description: string;
  bilingual: boolean;
  capabilities: Capability[];
  kb_source: string | null;
  kb_reviewer: string | null;
  highlights: string | null;
  ai_used: boolean;
  ai_scope: string | null;
  screenshot_paths: string[];
  pdf_path: string;
  qr_path: string | null;
};

export type Submission = SubmissionInput & {
  id: string;
  created_at: string;
  status: 'submitted';
};

export const FILE_LIMITS = {
  screenshot: { max: 5 * 1024 * 1024, count: 5, label: '5MB' },
  pdf: { max: 30 * 1024 * 1024, count: 1, label: '30MB' },
  qr: { max: 2 * 1024 * 1024, count: 1, label: '2MB' },
} as const;

export type UploadKind = keyof typeof FILE_LIMITS;
