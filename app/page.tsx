import { FileCheck2, UserRound } from 'lucide-react';
import SubmitForm from '@/components/SubmitForm';
import { SITE } from '@/lib/site';
import { isDemo } from '@/lib/config';

export default function Page() {
  return (
    <>
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
