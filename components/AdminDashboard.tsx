'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Submission } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import AgentMark from '@/components/AgentMark';

type Filter = 'all' | 'bilingual' | 'kb' | 'ai';

export default function AdminDashboard() {
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<Submission | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/submissions', { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '读取失败');
      setItems(Array.isArray(data.items) ? data.items : []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const stats = useMemo(
    () => ({
      total: items.length,
      bilingual: items.filter((item) => item.bilingual).length,
      kb: items.filter((item) => (item.capabilities || []).includes('知识库构建')).length,
      screenshots: items.reduce((sum, item) => sum + (item.screenshot_paths || []).length, 0),
    }),
    [items],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === 'bilingual' && !item.bilingual) return false;
      if (filter === 'kb' && !(item.capabilities || []).includes('知识库构建')) return false;
      if (filter === 'ai' && !item.ai_used) return false;
      if (!needle) return true;
      return [item.name, item.student_id, item.work_name, item.major, item.grade, item.phone]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [items, query, filter]);

  const remove = async (item: Submission) => {
    if (deleting) return;
    const ok = window.confirm(`确认删除「${item.work_name}」（${item.name}）？文件将一并删除，且不可恢复。`);
    if (!ok) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/submissions/${item.id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '删除失败');
      setItems((prev) => prev.filter((row) => row.id !== item.id));
      setSelected(null);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location.reload();
  };

  return (
    <div className="admin">
      <header className="admin__head">
        <div>
          <p className="eyebrow">Coze Agent Award · Submission ledger</p>
          <div className="admin__title">
            <span className="admin__seal" aria-hidden="true">
              <AgentMark size={18} />
            </span>
            <h1>作品登记簿</h1>
          </div>
        </div>
        <div className="admin__head-right">
          <a href="/" target="_blank" rel="noreferrer">
            查看提交页 ↗
          </a>
          <button type="button" onClick={logout}>
            退出登录
          </button>
        </div>
      </header>

      <div className="admin__stats">
        <div>
          <span>提交总数</span>
          <b>{stats.total}</b>
        </div>
        <div>
          <span>藏汉双语</span>
          <b>{stats.bilingual}</b>
        </div>
        <div>
          <span>使用知识库</span>
          <b>{stats.kb}</b>
        </div>
        <div>
          <span>截图总数</span>
          <b>{stats.screenshots}</b>
        </div>
      </div>

      <div className="admin__bar">
        <div className="admin__search">
          <label htmlFor="q">检索</label>
          <input
            id="q"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="姓名 / 学号 / 作品名 / 专业"
          />
        </div>
        <div className="admin__filters" role="group" aria-label="筛选">
          {(
            [
              ['all', '全部'],
              ['bilingual', '双语'],
              ['kb', '知识库'],
              ['ai', 'AI 辅助'],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={filter === key ? 'is-on' : ''}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="admin__bar-right">
          <span>{filtered.length} 条</span>
          <a className="admin__export" href="/api/admin/export">
            导出 CSV ↓
          </a>
        </div>
      </div>

      {error && <p className="admin__error">{error}</p>}

      <p className="admin__scrollhint">左右滑动查看完整登记簿</p>

      <div className="admin__tablewrap">
        <table className="ledger">
          <thead>
            <tr>
              <th>提交时间</th>
              <th>学号</th>
              <th>姓名</th>
              <th>作品名称</th>
              <th>年级 / 专业</th>
              <th>能力</th>
              <th>双语</th>
              <th>材料</th>
              <th aria-label="操作" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="ledger__empty">
                  正在读取…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="ledger__empty">
                  暂无符合条件的提交
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id} onClick={() => setSelected(item)} tabIndex={0} onKeyDown={(e) => {
                  if (e.key === 'Enter') setSelected(item);
                }}>
                  <td className="mono">{formatDateTime(item.created_at)}</td>
                  <td className="mono">{item.student_id}</td>
                  <td>{item.name}</td>
                  <td>
                    <span className="ledger__work">{item.work_name}</span>
                  </td>
                  <td className="muted">
                    {item.grade} / {item.major}
                  </td>
                  <td className="muted">{(item.capabilities || []).length} 项</td>
                  <td>{item.bilingual ? '是' : '—'}</td>
                  <td className="muted">
                    {item.screenshot_paths?.length || 0} 图 · PDF{item.qr_path ? ' · QR' : ''}
                  </td>
                  <td className="ledger__arrow" aria-hidden="true">
                    →
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="drawer" role="dialog" aria-modal="true" aria-label="提交详情">
          <button
            type="button"
            className="drawer__scrim"
            aria-label="关闭"
            onClick={() => setSelected(null)}
          />
          <aside className="drawer__panel">
            <div className="drawer__head">
              <div>
                <p className="eyebrow">Submission · {selected.id.slice(0, 8).toUpperCase()}</p>
                <h2>{selected.work_name}</h2>
                <p className="drawer__sub">
                  {selected.name} · {selected.student_id} · {selected.grade} {selected.major}
                </p>
              </div>
              <button type="button" className="drawer__close" onClick={() => setSelected(null)}>
                ×
              </button>
            </div>

            <div className="drawer__body">
              <dl className="drawer__meta">
                <div>
                  <dt>提交时间</dt>
                  <dd>{formatDateTime(selected.created_at)}</dd>
                </div>
                <div>
                  <dt>手机号</dt>
                  <dd className="mono">{selected.phone}</dd>
                </div>
                <div>
                  <dt>双语能力</dt>
                  <dd>{selected.bilingual ? '是' : '否'}</dd>
                </div>
                <div>
                  <dt>AI 辅助</dt>
                  <dd>{selected.ai_used ? selected.ai_scope || '是' : '否'}</dd>
                </div>
              </dl>

              <section>
                <h3>作品链接</h3>
                <a className="drawer__link" href={selected.share_link} target="_blank" rel="noreferrer">
                  {selected.share_link}
                </a>
              </section>

              <section>
                <h3>作品简介</h3>
                <p className="drawer__text">{selected.description}</p>
              </section>

              <section>
                <h3>平台能力</h3>
                <div className="drawer__tags">
                  {(selected.capabilities || []).map((cap) => (
                    <span key={cap}>{cap}</span>
                  ))}
                </div>
              </section>

              {(selected.kb_source || selected.kb_reviewer) && (
                <section>
                  <h3>知识库</h3>
                  <p className="drawer__text">
                    <b>来源：</b>
                    {selected.kb_source || '—'}
                    <br />
                    <b>审核责任人：</b>
                    {selected.kb_reviewer || '—'}
                  </p>
                </section>
              )}

              {selected.highlights && (
                <section>
                  <h3>创新亮点</h3>
                  <p className="drawer__text">{selected.highlights}</p>
                </section>
              )}

              <section>
                <h3>作品截图</h3>
                <div className="drawer__shots">
                  {(selected.screenshot_paths || []).map((path, index) => (
                    <a
                      key={path}
                      href={`/api/admin/file?path=${encodeURIComponent(path)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/admin/file?path=${encodeURIComponent(path)}`}
                        alt={`截图 ${index + 1}`}
                      />
                    </a>
                  ))}
                </div>
              </section>

              <section>
                <h3>文件</h3>
                <ul className="drawer__files">
                  <li>
                    <a
                      href={`/api/admin/file?path=${encodeURIComponent(selected.pdf_path)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      设计说明 PDF ↗
                    </a>
                  </li>
                  {selected.qr_path && (
                    <li>
                      <a
                        href={`/api/admin/file?path=${encodeURIComponent(selected.qr_path)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        作品二维码 ↗
                      </a>
                    </li>
                  )}
                </ul>
              </section>
            </div>

            <div className="drawer__foot">
              <span>{selected.id}</span>
              <button
                type="button"
                className="drawer__delete"
                onClick={() => remove(selected)}
                disabled={deleting}
              >
                {deleting ? '删除中…' : '删除这条提交'}
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
