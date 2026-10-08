import { requireAdmin } from '@/lib/services/requireAdmin';
import { AdminShell } from '@/components/admin/AdminShell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { nome } = await requireAdmin();
  return <AdminShell nome={nome}>{children}</AdminShell>;
}
