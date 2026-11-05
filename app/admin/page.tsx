import LoginForm from '@/components/LoginForm';
import AdminDashboard from '@/components/AdminDashboard';
import { isAuthed } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const authed = await isAuthed();
  return authed ? <AdminDashboard /> : <LoginForm />;
}
