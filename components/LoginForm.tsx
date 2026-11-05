'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AgentMark from '@/components/AgentMark';

export default function LoginForm() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '登录失败');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
      setBusy(false);
    }
  };

  return (
    <main className="login">
      <div className="login__card">
        <span className="login__seal" aria-hidden="true">
          <AgentMark size={20} />
        </span>
        <p className="eyebrow">Coze Agent Award · 2026</p>
        <h1 className="login__title">
          登记
          <br />
          簿
        </h1>
        <p className="login__latin">Submission ledger</p>

        <form onSubmit={submit}>
          <label htmlFor="admin-password">管理口令</label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入管理口令"
            autoComplete="current-password"
            autoFocus
          />
          {error && (
            <p className="login__error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="login__button" disabled={busy}>
            {busy ? '验证中…' : '进入'}
            <span aria-hidden="true">→</span>
          </button>
        </form>

        <p className="login__note">
          仅限竞赛工作组成员使用。
          <br />
          登录状态保持 8 小时。
        </p>
      </div>
    </main>
  );
}
