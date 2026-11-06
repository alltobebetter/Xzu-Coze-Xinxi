'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  ArrowRight,
  Check,
  Download,
  FileText,
  ImagePlus,
  Link2,
  QrCode,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import {
  CAPABILITIES,
  FILE_LIMITS,
  type Capability,
  type UploadKind,
} from '@/lib/types';
import { validateSubmission, type FieldErrors } from '@/lib/validation';
import { formatBytes, formatDateTime } from '@/lib/format';
import { SITE } from '@/lib/site';

type TextKey =
  | 'name'
  | 'student_id'
  | 'grade'
  | 'major'
  | 'phone'
  | 'work_name'
  | 'share_link'
  | 'description'
  | 'kb_source'
  | 'kb_reviewer'
  | 'highlights'
  | 'ai_scope';

type TextState = Record<TextKey, string>;

const EMPTY: TextState = {
  name: '',
  student_id: '',
  grade: '',
  major: '',
  phone: '',
  work_name: '',
  share_link: '',
  description: '',
  kb_source: '',
  kb_reviewer: '',
  highlights: '',
  ai_scope: '',
};

const RECEIPT_KEY = 'coze_submission_receipt_v1';

type Shot = { id: string; file: File; url: string };

type Receipt = {
  id: string;
  created_at: string;
  name: string;
  studentId: string;
  work: string;
  shots: number;
};

type Props = { demo: boolean };

function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

const QR_OPTIONS = {
  width: 560,
  margin: 1,
  errorCorrectionLevel: 'M' as const,
  color: { dark: '#16130f', light: '#ffffff' },
};

async function makeQrFile(link: string): Promise<File> {
  const dataUrl = await QRCode.toDataURL(link, QR_OPTIONS);
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], 'qr-auto.png', { type: 'image/png' });
}

async function compressImage(file: File): Promise<File> {
  if (file.size <= 700 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const maxWidth = 1600;
    const scale = Math.min(1, maxWidth / bitmap.width);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.86),
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, {
      type: 'image/jpeg',
    });
  } catch {
    return file;
  }
}

function Field({
  label,
  htmlFor,
  required,
  note,
  hint,
  error,
  wide,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  note?: string;
  hint?: string;
  error?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`field${wide ? ' field--wide' : ''}${error ? ' is-bad' : ''}`}>
      {htmlFor ? (
        <label htmlFor={htmlFor}>
          {label}
          {required && <em>*</em>}
          {note && <span className="field__note">{note}</span>}
        </label>
      ) : (
        <span className="field__label">
          {label}
          {required && <em>*</em>}
          {note && <span className="field__note">{note}</span>}
        </span>
      )}
      {children}
      {hint && <p className="hint">{hint}</p>}
      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default function SubmitForm({ demo }: Props) {
  const [text, setText] = useState<TextState>(EMPTY);
  const [bilingual, setBilingual] = useState<boolean | null>(null);
  const [caps, setCaps] = useState<Capability[]>([]);
  const [aiUsed, setAiUsed] = useState<boolean | null>(null);

  const [shots, setShots] = useState<Shot[]>([]);
  const [pdf, setPdf] = useState<File | null>(null);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrUploadUrl, setQrUploadUrl] = useState('');
  const [qrPreview, setQrPreview] = useState('');
  const [qrAuto, setQrAuto] = useState<File | null>(null);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [stage, setStage] = useState<'form' | 'submitting' | 'done'>('form');
  const [progress, setProgress] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [toastText, setToastText] = useState('');
  const [dragShot, setDragShot] = useState(false);
  const [dragPdf, setDragPdf] = useState(false);
  const [closed, setClosed] = useState(false);
  const [savingPdf, setSavingPdf] = useState(false);

  const shotInput = useRef<HTMLInputElement>(null);
  const pdfInput = useRef<HTMLInputElement>(null);
  const qrInput = useRef<HTMLInputElement>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const usesKb = caps.includes('知识库构建');
  const link = text.share_link.trim();

  const toast = useCallback((message: string, duration = 3600) => {
    setToastText(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastText(''), duration);
  }, []);

  /* ---------------- 截止时间 ---------------- */

  useEffect(() => {
    if (!SITE.deadline) return;
    const at = new Date(SITE.deadline).getTime();
    if (Number.isNaN(at)) return;
    const check = () => setClosed(Date.now() > at);
    check();
    const timer = setInterval(check, 60_000);
    return () => clearInterval(timer);
  }, []);

  /* ---------------- 提交凭证 ---------------- */

  useEffect(() => {
    try {
      // 旧版本自动保存的草稿不再恢复，顺手清理掉，避免共用电脑残留个人信息。
      localStorage.removeItem('coze_submission_draft_v2');
    } catch {
      /* 忽略存储不可用 */
    }
    try {
      const savedReceipt = sessionStorage.getItem(RECEIPT_KEY);
      if (savedReceipt) {
        const parsed = JSON.parse(savedReceipt);
        if (parsed && parsed.id) {
          setReceipt(parsed);
          setStage('done');
        }
      }
    } catch {
      /* 忽略损坏的凭证 */
    }
  }, []);

  /* ---------------- 二维码 ---------------- */

  useEffect(() => {
    if (qrFile) return;
    if (!/^https?:\/\/\S+$/i.test(link)) {
      setQrPreview('');
      setQrAuto(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const dataUrl = await QRCode.toDataURL(link, {
          width: 560,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: { dark: '#16130f', light: '#ffffff' },
        });
        if (cancelled) return;
        const blob = await (await fetch(dataUrl)).blob();
        setQrPreview(dataUrl);
        setQrAuto(new File([blob], 'qr-auto.png', { type: 'image/png' }));
      } catch {
        if (!cancelled) {
          setQrPreview('');
          setQrAuto(null);
        }
      }
    }, 320);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [link, qrFile]);

  useEffect(() => {
    if (!qrFile) {
      setQrUploadUrl('');
      return;
    }
    const url = URL.createObjectURL(qrFile);
    setQrUploadUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [qrFile]);

  /* ---------------- 进度 ---------------- */

  useEffect(() => {
    const result = validateSubmission({
      ...text,
      bilingual: bilingual ?? undefined,
      capabilities: caps,
      kb_source: text.kb_source,
      kb_reviewer: text.kb_reviewer,
      ai_used: aiUsed ?? undefined,
      ai_scope: text.ai_scope,
      screenshot_paths: shots.length ? ['x'] : [],
      pdf_path: pdf ? 'x' : '',
    });
    const done = {
      basic: !['name', 'student_id', 'grade', 'major', 'phone'].some((key) => result[key]),
      work: !result.work_name && !result.share_link && !result.description,
      files: !result.screenshot_paths && !result.pdf_path,
      ability:
        !result.bilingual &&
        !result.capabilities &&
        !result.ai_used &&
        !result.ai_scope &&
        !result.kb_source &&
        !result.kb_reviewer,
    };
    window.dispatchEvent(new CustomEvent('coze:progress', { detail: done }));
  }, [text, bilingual, caps, aiUsed, shots.length, pdf]);

  useEffect(() => {
    document.body.classList.toggle('is-done', stage === 'done');
    return () => document.body.classList.remove('is-done');
  }, [stage]);

  /* ---------------- 字段 ---------------- */

  const update = (key: TextKey) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const value = event.target.value;
    setText((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const focusFirst = (errs: FieldErrors) => {
    const order = [
      'name',
      'student_id',
      'grade',
      'major',
      'phone',
      'work_name',
      'share_link',
      'description',
      'screenshots',
      'pdf',
      'bilingual',
      'capabilities',
      'kb_source',
      'kb_reviewer',
      'ai_used',
      'ai_scope',
    ];
    const first = order.find((key) => errs[key]);
    if (!first) return;
    const targets: Record<string, string> = {
      screenshots: 'drop-shots',
      pdf: 'drop-pdf',
      bilingual: 'bilingual-yes',
      capabilities: 'cap-0',
      ai_used: 'ai-yes',
    };
    const el = document.getElementById(targets[first] || `f-${first}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => el.focus({ preventScroll: true }), 320);
    }
  };

  const validateAll = (): FieldErrors => {
    const result = validateSubmission({
      ...text,
      bilingual: bilingual ?? undefined,
      capabilities: caps,
      kb_source: text.kb_source,
      kb_reviewer: text.kb_reviewer,
      ai_used: aiUsed ?? undefined,
      ai_scope: text.ai_scope,
      screenshot_paths: shots.length ? ['x'] : [],
      pdf_path: pdf ? 'x' : '',
    });
    if (result.screenshot_paths) {
      result.screenshots = result.screenshot_paths;
      delete result.screenshot_paths;
    }
    if (result.pdf_path) {
      result.pdf = result.pdf_path;
      delete result.pdf_path;
    }
    return result;
  };

  /* ---------------- 上传 ---------------- */

  async function uploadOne(file: File, kind: UploadKind, studentId: string): Promise<string> {
    const metaRes = await fetch('/api/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, kind, name: file.name, size: file.size }),
    });
    const meta = await metaRes.json().catch(() => ({}));
    if (!metaRes.ok) throw new Error(meta.error || '无法创建上传地址');

    if (meta.mode === 'signed') {
      const headers: Record<string, string> = {
        'Content-Type': file.type || 'application/octet-stream',
        'x-upsert': 'false',
      };
      const anonKey =
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (anonKey) {
        headers.apikey = anonKey;
        headers.Authorization = `Bearer ${anonKey}`;
      }
      const put = await fetch(meta.signedUrl, {
        method: 'PUT',
        headers,
        body: file,
      });
      if (!put.ok) throw new Error('文件上传失败，请检查网络后重试');
    } else {
      const form = new FormData();
      form.append('file', file);
      form.append('path', meta.path);
      const put = await fetch('/api/upload', { method: 'POST', body: form });
      if (!put.ok) {
        const data = await put.json().catch(() => ({}));
        throw new Error(data.error || '文件上传失败');
      }
    }
    return meta.path as string;
  }

  const addShots = async (files: File[]) => {
    const remaining = FILE_LIMITS.screenshot.count - shots.length;
    if (remaining <= 0) {
      toast('最多上传 5 张截图');
      return;
    }
    const picked = files.slice(0, remaining);
    const next: Shot[] = [];

    for (const file of picked) {
      if (!/^image\//.test(file.type) && !/\.(png|jpe?g|webp)$/i.test(file.name)) {
        toast(`「${file.name}」不是支持的图片格式`);
        continue;
      }
      if (file.size > FILE_LIMITS.screenshot.max) {
        toast(`「${file.name}」超过 5MB，已忽略`);
        continue;
      }
      const compressed = await compressImage(file);
      next.push({ id: uid(), file: compressed, url: URL.createObjectURL(compressed) });
    }

    if (next.length) {
      setShots((prev) => [...prev, ...next]);
      setErrors((prev) => ({ ...prev, screenshots: '' }));
    }
    if (files.length > remaining) toast('最多上传 5 张截图，多余的已忽略');
  };

  const setPdfFile = (file: File | null) => {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      setErrors((prev) => ({ ...prev, pdf: '请选择 PDF 文件' }));
      return;
    }
    if (file.size > FILE_LIMITS.pdf.max) {
      setErrors((prev) => ({ ...prev, pdf: 'PDF 不能超过 30MB，请压缩后重试' }));
      return;
    }
    setPdf(file);
    setErrors((prev) => ({ ...prev, pdf: '' }));
  };

  const setQr = (file: File | null) => {
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      toast('二维码需要是图片文件');
      return;
    }
    if (file.size > FILE_LIMITS.qr.max) {
      toast('二维码图片不能超过 2MB');
      return;
    }
    setQrFile(file);
  };

  /* ---------------- 提交 ---------------- */

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (stage === 'submitting' || closed) return;

    const errs = validateAll();
    if (Object.keys(errs).length) {
      setErrors(errs);
      focusFirst(errs);
      toast('还有必填项未完成，请检查标红处');
      return;
    }

    setErrors({});
    setStage('submitting');

    try {
      // 提交开始后表单仍可滚动，先固定一份快照，避免上传期间改学号/链接导致文件路径或二维码错位。
      const payload = {
        ...text,
        name: text.name.trim(),
        student_id: text.student_id.trim(),
        work_name: text.work_name.trim(),
        share_link: text.share_link.trim(),
        bilingual,
        capabilities: caps,
        ai_used: aiUsed,
      };
      const studentId = payload.student_id;
      const shotPaths: string[] = [];
      const shotTotal = shots.length;
      let step = 0;

      const qrToSend =
        qrFile ||
        (payload.share_link ? await makeQrFile(payload.share_link).catch(() => null) : null) ||
        qrAuto;

      for (const shot of shots) {
        step += 1;
        setProgress(`正在上传截图 ${step} / ${shotTotal}`);
        shotPaths.push(await uploadOne(shot.file, 'screenshot', studentId));
      }

      setProgress('正在上传设计说明 PDF');
      const pdfPath = await uploadOne(pdf as File, 'pdf', studentId);

      let qrPath: string | null = null;
      if (qrToSend) {
        setProgress('正在上传作品二维码');
        qrPath = await uploadOne(qrToSend, 'qr', studentId);
      }

      setProgress('正在写入提交记录');
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          screenshot_paths: shotPaths,
          pdf_path: pdfPath,
          qr_path: qrPath,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (data.fields) setErrors(data.fields);
        if (data.code === 'DUPLICATE') {
          setErrors((prev) => ({ ...prev, student_id: '该学号已提交过作品' }));
        }
        throw new Error(data.error || '提交失败，请稍后重试');
      }

      const nextReceipt: Receipt = {
        id: data.id,
        created_at: data.created_at,
        name: payload.name,
        studentId,
        work: payload.work_name,
        shots: shots.length,
      };
      try {
        sessionStorage.setItem(RECEIPT_KEY, JSON.stringify(nextReceipt));
      } catch {
        /* 隐私模式下可能不可用 */
      }
      setReceipt(nextReceipt);
      setStage('done');
      setTimeout(() => {
        document.querySelector('.receipt')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    } catch (error) {
      setStage('form');
      const message = error instanceof Error ? error.message : '提交失败，请稍后重试';
      toast(message, 6000);
    }
  };

  /* ---------------- 保存凭证 PDF ---------------- */

  const saveReceiptPdf = async () => {
    const node = receiptRef.current;
    if (!node || savingPdf) return;

    setSavingPdf(true);
    try {
      if (document.fonts?.ready) await document.fonts.ready;

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const canvas = await html2canvas(node, {
        scale: 2,
        backgroundColor: '#fbf8f1',
        useCORS: true,
        logging: false,
        onclone: (clonedDoc) => {
          clonedDoc
            .querySelectorAll('.receipt__actions, .receipt__hint')
            .forEach((element) => element.remove());
        },
      });
      const imgData = canvas.toDataURL('image/png');

      const pageWidth = 210;
      const margin = 10;
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height / canvas.width) * imgWidth;
      const pageHeight = Math.max(120, imgHeight + margin * 2);
      const pdf = new jsPDF({
        unit: 'mm',
        format: [pageWidth, pageHeight],
        orientation: 'portrait',
      });
      pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);

      const shortId = (receipt?.id || 'receipt').replace(/-/g, '').slice(0, 8).toUpperCase();
      pdf.save(`作品提交凭证-${shortId}.pdf`);
    } catch (error) {
      console.error(error);
      toast('凭证 PDF 生成失败，请重试', 6000);
    } finally {
      setSavingPdf(false);
    }
  };

  /* ---------------- 成功页 ---------------- */

  if (stage === 'done' && receipt) {
    const shortId = receipt.id.replace(/-/g, '').slice(0, 8).toUpperCase();
    return (
      <div className="receipt" ref={receiptRef}>
        <div className="receipt__head">
          <div>
            <p className="eyebrow">Submission receipt</p>
            <h2 className="receipt__title">作品提交凭证</h2>
            <p className="receipt__latin">Dossier received · {new Date().getFullYear()}</p>
          </div>
          <div className="receipt__no">
            NO.
            <b>{shortId}</b>
          </div>
        </div>

        <dl className="receipt__grid">
          <div>
            <dt>提交编号</dt>
            <dd style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{receipt.id}</dd>
          </div>
          <div>
            <dt>提交时间</dt>
            <dd>{formatDateTime(receipt.created_at)}</dd>
          </div>
          <div>
            <dt>参赛者</dt>
            <dd>
              {receipt.name} · {receipt.studentId}
            </dd>
          </div>
          <div>
            <dt>作品名称</dt>
            <dd>{receipt.work}</dd>
          </div>
          <div>
            <dt>提交材料</dt>
            <dd>
              截图 {receipt.shots} 张 · 设计说明 PDF · 作品二维码
            </dd>
          </div>
          <div>
            <dt>状态</dt>
            <dd>已提交，等待初评</dd>
          </div>
        </dl>

        <div className="receipt__actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={saveReceiptPdf}
            disabled={savingPdf}
          >
            <Download size={15} strokeWidth={1.7} aria-hidden="true" />
            {savingPdf ? '正在生成 PDF' : '保存凭证'}
          </button>
        </div>
        <p className="receipt__hint">
          请下载并保存凭证 PDF。若需修改作品，请携带提交编号联系负责人
          {` ${SITE.contact.name}（${SITE.contact.phone}）`}。
        </p>
      </div>
    );
  }

  /* ---------------- 表单 ---------------- */

  const busy = stage === 'submitting';
  const formCheck = validateSubmission({
    ...text,
    bilingual: bilingual ?? undefined,
    capabilities: caps,
    kb_source: text.kb_source,
    kb_reviewer: text.kb_reviewer,
    ai_used: aiUsed ?? undefined,
    ai_scope: text.ai_scope,
    screenshot_paths: shots.length ? ['x'] : [],
    pdf_path: pdf ? 'x' : '',
  });
  const basicDone = !['name', 'student_id', 'grade', 'major', 'phone'].some((key) =>
    Boolean(formCheck[key]),
  );
  const workDone = !['work_name', 'share_link', 'description'].some((key) =>
    Boolean(formCheck[key]),
  );
  const filesDone = !formCheck.screenshot_paths && !formCheck.pdf_path;
  const abilityDone = ![
    'bilingual',
    'capabilities',
    'kb_source',
    'kb_reviewer',
    'ai_used',
    'ai_scope',
  ].some((key) => Boolean(formCheck[key]));

  return (
    <form onSubmit={submit} noValidate>
      <div className="paper__head">
        <span>参赛登记 · 作品材料</span>
        <span>Form 01 / 2026</span>
      </div>

      {demo && (
        <p className="demo-note">
          当前为本地演示模式：数据写入 <code>.data/</code> 目录，未连接云数据库。
        </p>
      )}

      {closed && (
        <p className="closed-note">本次提交已截止。如需补交或修改，请联系负责人。</p>
      )}

      <section className="chapter" id="ch-basic">
        <div className="chapter__head">
          <span className="chapter__icon" aria-hidden="true">
            <UserRound size={15} strokeWidth={1.6} />
          </span>
          <div className="chapter__head-text">
            <h2>参赛者信息</h2>
            <p>仅用于身份核验、评审通知与证书制作，不在页面公开展示。</p>
          </div>
          <span className={`chapter__state${basicDone ? ' is-done' : ''}`}>
            {basicDone ? (
              <>
                <Check size={13} strokeWidth={2} aria-hidden="true" />
                已完成
              </>
            ) : (
              '01'
            )}
          </span>
        </div>

        <div className="fields">
          <Field label="姓名" htmlFor="f-name" required error={errors.name}>
            <input
              id="f-name"
              type="text"
              value={text.name}
              onChange={update('name')}
              placeholder="请输入真实姓名"
              autoComplete="name"
              maxLength={20}
              aria-invalid={!!errors.name}
            />
          </Field>

          <Field label="学号" htmlFor="f-student_id" required error={errors.student_id}>
            <input
              id="f-student_id"
              type="text"
              value={text.student_id}
              onChange={update('student_id')}
              placeholder="如 2023xxxxxxx"
              inputMode="numeric"
              maxLength={20}
              aria-invalid={!!errors.student_id}
            />
          </Field>

          <Field label="年级" htmlFor="f-grade" required error={errors.grade}>
            <input
              id="f-grade"
              type="text"
              value={text.grade}
              onChange={update('grade')}
              placeholder="如 2026级 / 研一"
              maxLength={20}
              aria-invalid={!!errors.grade}
            />
          </Field>

          <Field label="专业" htmlFor="f-major" required error={errors.major}>
            <input
              id="f-major"
              type="text"
              value={text.major}
              onChange={update('major')}
              placeholder="如 计算机科学与技术"
              maxLength={30}
              aria-invalid={!!errors.major}
            />
          </Field>

          <Field
            label="手机号"
            htmlFor="f-phone"
            required
            wide
            error={errors.phone}
          >
            <input
              id="f-phone"
              type="tel"
              value={text.phone}
              onChange={update('phone')}
              placeholder="11 位手机号"
              inputMode="numeric"
              maxLength={11}
              autoComplete="tel"
              aria-invalid={!!errors.phone}
            />
          </Field>
        </div>
      </section>

      <section className="chapter" id="ch-work">
        <div className="chapter__head">
          <span className="chapter__icon" aria-hidden="true">
            <Link2 size={15} strokeWidth={1.6} />
          </span>
          <div className="chapter__head-text">
            <h2>作品与链接</h2>
            <p>智能体须公开发布，链接在无登录状态下可以打开，并保持至成绩公布后 30 日。</p>
          </div>
          <span className={`chapter__state${workDone ? ' is-done' : ''}`}>
            {workDone ? (
              <>
                <Check size={13} strokeWidth={2} aria-hidden="true" />
                已完成
              </>
            ) : (
              '02'
            )}
          </span>
        </div>

        <div className="fields">
          <Field label="作品名称" htmlFor="f-work_name" required wide error={errors.work_name}>
            <input
              id="f-work_name"
              type="text"
              value={text.work_name}
              onChange={update('work_name')}
              placeholder="给你的智能体起个名字"
              maxLength={40}
              aria-invalid={!!errors.work_name}
            />
          </Field>

          <Field
            label="智能体分享链接"
            htmlFor="f-share_link"
            required
            wide
            hint="扣子平台：发布 → 分享链接。建议用浏览器无痕模式确认可访问。"
            error={errors.share_link}
          >
            <input
              id="f-share_link"
              type="url"
              value={text.share_link}
              onChange={update('share_link')}
              placeholder="https://www.coze.cn/store/bot/..."
              inputMode="url"
              aria-invalid={!!errors.share_link}
            />
          </Field>
        </div>

        <div className="qr">
          <div className="qr__box">
            {qrFile && qrUploadUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrUploadUrl} alt="已上传的作品二维码" />
            ) : qrPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrPreview} alt="根据分享链接生成的作品二维码" />
            ) : (
              <span className="qr__empty">
                填写链接后
                <br />
                自动生成
              </span>
            )}
          </div>
          <div className="qr__copy">
            <h3>
              <QrCode size={14} strokeWidth={1.6} aria-hidden="true" />
              作品二维码
            </h3>
            <p>
              系统会按分享链接自动生成二维码，无需额外操作。若你已在扣子后台下载官方二维码，可上传替换。
            </p>
            <div className="qr__actions">
              <button type="button" className="btn btn--ghost" onClick={() => qrInput.current?.click()}>
                上传官方二维码
              </button>
              {qrFile && (
                <button type="button" className="btn btn--ghost" onClick={() => setQrFile(null)}>
                  改回自动生成
                </button>
              )}
              {qrFile && <span className="qr__name">{qrFile.name}</span>}
            </div>
            <input
              ref={qrInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                setQr((e.target.files && e.target.files[0]) || null);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        <div className="fields" style={{ marginTop: 30 }}>
          <Field
            label="作品简介"
            htmlFor="f-description"
            required
            wide
            hint="回答三个问题：解决什么问题、面向谁、核心功能是什么。"
            error={errors.description}
          >
            <textarea
              id="f-description"
              value={text.description}
              onChange={update('description')}
              rows={4}
              maxLength={500}
              placeholder="它解决什么问题？面向谁？核心功能有哪些？"
              aria-invalid={!!errors.description}
            />
            <div className="counter">{text.description.length} / 500</div>
          </Field>
        </div>
      </section>

      <section className="chapter" id="ch-files">
        <div className="chapter__head">
          <span className="chapter__icon" aria-hidden="true">
            <ImagePlus size={15} strokeWidth={1.6} />
          </span>
          <div className="chapter__head-text">
            <h2>作品材料</h2>
            <p>截图用于快速了解交互效果，文档用于说明设计思路与知识库来源。</p>
          </div>
          <span className={`chapter__state${filesDone ? ' is-done' : ''}`}>
            {filesDone ? (
              <>
                <Check size={13} strokeWidth={2} aria-hidden="true" />
                已完成
              </>
            ) : (
              '03'
            )}
          </span>
        </div>

        <div className="fields">
          <Field
            label="作品截图"
            required
            wide
            note="1–5 张，建议包含开场白、核心问答、工作流或知识库配置"
            error={errors.screenshots}
          >
            <div
              id="drop-shots"
              className={`drop${dragShot ? ' is-drag' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => shotInput.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  shotInput.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragShot(true);
              }}
              onDragLeave={() => setDragShot(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragShot(false);
                addShots(Array.from(e.dataTransfer.files));
              }}
            >
              <span className="drop__icon" aria-hidden="true">
                <ImagePlus size={18} strokeWidth={1.5} />
              </span>
              <span className="drop__text">
                <strong>点击选择，或把图片拖到这里</strong>
                <span>JPG / PNG / WebP，单张不超过 5MB。我们会自动压缩过大的图片。</span>
              </span>
            </div>
            <input
              ref={shotInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              hidden
              onChange={(e) => {
                addShots(Array.from(e.target.files || []));
                e.target.value = '';
              }}
            />
            {shots.length > 0 && (
              <ul className="thumbs">
                {shots.map((shot, index) => (
                  <li className="thumb" key={shot.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={shot.url} alt={`作品截图 ${index + 1}`} />
                    <button
                      type="button"
                      aria-label={`删除第 ${index + 1} 张截图`}
                      onClick={() => {
                        URL.revokeObjectURL(shot.url);
                        setShots((prev) => prev.filter((s) => s.id !== shot.id));
                      }}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Field>

          <Field
            label="设计说明文档"
            required
            wide
            note="PDF，不超过 30MB"
            hint="须包含：定位与核心功能、Prompt 与知识库设计思路、实际使用效果、知识库来源及人工审核责任人。"
            error={errors.pdf}
          >
            <div
              id="drop-pdf"
              className={`drop${dragPdf ? ' is-drag' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => pdfInput.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  pdfInput.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragPdf(true);
              }}
              onDragLeave={() => setDragPdf(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragPdf(false);
                setPdfFile(e.dataTransfer.files[0] || null);
              }}
            >
              <span className="drop__icon" aria-hidden="true">
                <FileText size={18} strokeWidth={1.5} />
              </span>
              <span className="drop__text">
                <strong>{pdf ? '重新选择 PDF' : '点击选择，或把 PDF 拖到这里'}</strong>
                <span>提交后不可自行修改，请确认版本无误。</span>
              </span>
            </div>
            <input
              ref={pdfInput}
              type="file"
              accept="application/pdf,.pdf"
              hidden
              onChange={(e) => {
                setPdfFile(e.target.files?.[0] || null);
                e.target.value = '';
              }}
            />
            {pdf && (
              <div className="filepill">
                <FileText size={14} strokeWidth={1.6} aria-hidden="true" />
                <span className="name">{pdf.name}</span>
                <span className="size">{formatBytes(pdf.size)}</span>
                <button type="button" onClick={() => setPdf(null)}>
                  移除
                </button>
              </div>
            )}
          </Field>
        </div>
      </section>

      <section className="chapter" id="ch-ability">
        <div className="chapter__head">
          <span className="chapter__icon" aria-hidden="true">
            <ShieldCheck size={15} strokeWidth={1.6} />
          </span>
          <div className="chapter__head-text">
            <h2>能力与合规</h2>
            <p>用于核对合格线与评分维度，请如实填写。</p>
          </div>
          <span className={`chapter__state${abilityDone ? ' is-done' : ''}`}>
            {abilityDone ? (
              <>
                <Check size={13} strokeWidth={2} aria-hidden="true" />
                已完成
              </>
            ) : (
              '04'
            )}
          </span>
        </div>

        <div className="fields">
          <Field label="是否具备藏汉双语对话能力" required wide error={errors.bilingual}>
            <div className="choices" role="radiogroup" aria-label="藏汉双语对话能力">
              {[
                { value: true, label: '是', id: 'bilingual-yes' },
                { value: false, label: '否', id: 'bilingual-no' },
              ].map((item) => (
                <label className="choice" key={item.label}>
                  <input
                    id={item.id}
                    type="radio"
                    name="bilingual"
                    checked={bilingual === item.value}
                    onChange={() => {
                      setBilingual(item.value);
                      setErrors((prev) => ({ ...prev, bilingual: '' }));
                    }}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
            <p className="hint">双语能力为鼓励项，不计入合格线，但会计入「主题契合」评分。</p>
          </Field>

          <Field
            label="综合运用的平台能力"
            required
            wide
            note="至少选择两项"
            error={errors.capabilities}
          >
            <div className="chips">
              {CAPABILITIES.map((cap, index) => (
                <label className="chip" key={cap}>
                  <input
                    id={`cap-${index}`}
                    type="checkbox"
                    checked={caps.includes(cap)}
                    onChange={(e) => {
                      setCaps((prev) =>
                        e.target.checked ? [...prev, cap] : prev.filter((c) => c !== cap),
                      );
                      setErrors((prev) => ({ ...prev, capabilities: '' }));
                    }}
                  />
                  <span>{cap}</span>
                </label>
              ))}
            </div>
          </Field>

          {usesKb && (
            <>
              <Field
                label="知识库来源"
                htmlFor="f-kb_source"
                required
                wide
                hint="列出资料名称、链接或出处，如院系官网、公开出版物。"
                error={errors.kb_source}
              >
                <textarea
                  id="f-kb_source"
                  value={text.kb_source}
                  onChange={update('kb_source')}
                  rows={2}
                  maxLength={300}
                  placeholder="例：西藏大学官网院系介绍、××出版社《藏族民俗文化》"
                  aria-invalid={!!errors.kb_source}
                />
              </Field>

              <Field
                label="知识库人工审核责任人"
                htmlFor="f-kb_reviewer"
                required
                wide
                hint="须对知识库内容准确性负责；如为他人，需先取得本人同意。"
                error={errors.kb_reviewer}
              >
                <input
                  id="f-kb_reviewer"
                  type="text"
                  value={text.kb_reviewer}
                  onChange={update('kb_reviewer')}
                  placeholder="本人或经确认的指导教师姓名"
                  maxLength={30}
                  aria-invalid={!!errors.kb_reviewer}
                />
              </Field>
            </>
          )}

          <Field label="创新亮点" htmlFor="f-highlights" wide note="选填">
            <input
              id="f-highlights"
              type="text"
              value={text.highlights}
              onChange={update('highlights')}
              placeholder="一句话说明最与众不同的地方"
              maxLength={100}
            />
          </Field>

          <Field label="是否使用人工智能工具辅助创作" required wide error={errors.ai_used}>
            <div className="choices" role="radiogroup" aria-label="是否使用人工智能工具">
              {[
                { value: true, label: '是', id: 'ai-yes' },
                { value: false, label: '否', id: 'ai-no' },
              ].map((item) => (
                <label className="choice" key={item.label}>
                  <input
                    id={item.id}
                    type="radio"
                    name="ai"
                    checked={aiUsed === item.value}
                    onChange={() => {
                      setAiUsed(item.value);
                      setErrors((prev) => ({ ...prev, ai_used: '' }));
                    }}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </Field>

          {aiUsed === true && (
            <Field label="AI 参与范围" htmlFor="f-ai_scope" required wide error={errors.ai_scope}>
              <input
                id="f-ai_scope"
                type="text"
                value={text.ai_scope}
                onChange={update('ai_scope')}
                placeholder="例：使用 AI 润色 Prompt 与设计说明文字"
                maxLength={100}
                aria-invalid={!!errors.ai_scope}
              />
            </Field>
          )}

          <div className="field field--wide">
            <span className="field__label">原创与使用承诺</span>
            <div className="promise">
              <p className="promise__text">
                我承诺作品为本人原创，不存在知识产权纠纷；智能体链接可访问至成绩公布后 30
                日；提交信息真实有效，并已阅读
                <button
                  type="button"
                  className="promise__link"
                  onClick={() => {
                    const dialog = document.getElementById('rules-dialog') as HTMLDialogElement | null;
                    dialog?.showModal();
                  }}
                >
                  作品要求
                </button>
                。
              </p>
              <p className="promise__note">提交即视为确认上述承诺</p>
            </div>
          </div>
        </div>
      </section>

      <div className="submit">
        <p className="submit__note">
          <b>提交后不可自行修改</b>
          如需修改，请携带提交编号联系负责人。提交即表示同意主办方将材料用于评审、存档及教学展示（保留署名）。
        </p>
        <div className="submit__actions">
          <button type="submit" className="btn btn--primary" disabled={busy || closed}>
            {busy ? (
              <>
                <span className="btn__spinner" aria-hidden="true" />
                {progress || '正在提交'}
              </>
            ) : (
              <>
                提交作品
                <span className="btn__arrow" aria-hidden="true">
                  <ArrowRight size={15} strokeWidth={1.8} />
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      <p className="formfoot">
        提交编号将在提交成功后生成，请截图保存。本页不收集身份证号、住址等敏感信息。
      </p>

      <dialog className="dialog" id="rules-dialog">
        <div className="dialog__head">
          <h2>作品要求（合格线）</h2>
          <button
            type="button"
            className="dialog__close"
            aria-label="关闭"
            onClick={() => (document.getElementById('rules-dialog') as HTMLDialogElement)?.close()}
          >
            ×
          </button>
        </div>
        <ol className="rules">
          <li>具备明确的角色定位与服务边界；</li>
          <li>能够处理不少于两类典型用户意图；</li>
          <li>
            综合运用不少于两项平台能力（结构化 Prompt 设计、知识库构建、工作流编排、插件调用）；
          </li>
          <li>配置完整的开场白、引导语及异常兜底回复机制；</li>
          <li>鼓励配置藏汉双语对话能力与多轮上下文记忆（鼓励项，不计入合格线，计入评分）。</li>
        </ol>
        <p className="dialog__note">
          任一项不满足的，工作人员将通知限期整改；整改后仍不符合的不进入评审。
        </p>
        <div className="dialog__actions">
          <button
            type="button"
            className="btn btn--primary"
            style={{ width: '100%' }}
            onClick={() => (document.getElementById('rules-dialog') as HTMLDialogElement)?.close()}
          >
            我知道了
          </button>
        </div>
      </dialog>

      <div className={`toast${toastText ? ' is-on' : ''}`} role="status" aria-live="polite">
        {toastText}
      </div>
    </form>
  );
}
