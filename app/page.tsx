import { Clock3, FileCheck2, UserRound } from 'lucide-react';
import SubmitForm from '@/components/SubmitForm';
import AgentMark from '@/components/AgentMark';
import { SITE } from '@/lib/site';
import { isDemo } from '@/lib/config';
import { deadlineParts } from '@/lib/format';

export default function Page() {
  const deadline = deadlineParts(SITE.deadline);

  return (
    <>
      <header className="topbar">
        <div className="shell topbar__inner">
          <a className="brand" href="#top">
            <span className="brand__seal" aria-hidden="true">
              <AgentMark />
            </span>
            <span className="brand__name">
              <span className="brand__full">扣子（Coze）智能体设计大赛</span>
              <span className="brand__short">扣子大赛</span>
            </span>
            <span className="brand__sub">{SITE.event}</span>
          </a>
          <div className="topbar__right">
            <span className="topbar__deadline">
              <Clock3 size={13} strokeWidth={1.5} aria-hidden="true" />
              <span className="topbar__deadline-label">提交截止</span>
              {deadline ? `${deadline.date} ${deadline.time}` : '以群内通知为准'}
            </span>
          </div>
        </div>
      </header>

      <main className="shell page" id="top">
        <section className="intro">
          <p className="eyebrow">{SITE.event} · 专业类比赛</p>
          <h1 className="intro__title">作品提交</h1>
          <p className="intro__lead">
            {SITE.track} · {SITE.theme}。请填写参赛信息并上传作品材料，
            智能体链接须公开可访问至成绩公布后 30 日。
          </p>
          <div className="intro__meta">
            <span>
              <UserRound size={13} strokeWidth={1.5} aria-hidden="true" />
              个人参赛 · 每人限报 1 件
            </span>
            <span>
              <FileCheck2 size={13} strokeWidth={1.5} aria-hidden="true" />
              提交后不可自行修改
            </span>
          </div>
        </section>

        <div className="paper">
          <SubmitForm demo={isDemo()} />
        </div>
      </main>

      <footer className="footer">
        <div className="shell footer__inner">
          <span>
            {SITE.college} · {SITE.organizer}
          </span>
          <span>
            负责人 {SITE.contact.name} ·{' '}
            <a href={`tel:${SITE.contact.phone}`}>{SITE.contact.phone}</a>
          </span>
        </div>
      </footer>
    </>
  );
}
