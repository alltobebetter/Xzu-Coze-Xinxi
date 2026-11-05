import type { Metadata } from 'next';
import './admin.css';

export const metadata: Metadata = {
  title: '作品登记簿 · 管理端',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
