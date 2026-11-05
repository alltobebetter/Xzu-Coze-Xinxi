import type { Metadata, Viewport } from 'next';
import { Instrument_Serif } from 'next/font/google';
import './globals.css';

const instrument = Instrument_Serif({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-instrument',
  display: 'swap',
});

export const metadata: Metadata = {
  title: '作品提交 · 扣子（Coze）智能体设计大赛',
  description:
    '西藏大学信息科学技术学院第十二届信息技术文化节——扣子（Coze）智能体设计大赛作品提交页。',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#f2ede3',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className={instrument.variable}>
        <div className="grain" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
