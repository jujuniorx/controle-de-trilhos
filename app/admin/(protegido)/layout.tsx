import { requireAdmin } from '@/lib/services/requireAdmin';
import { AdminShell } from '@/components/admin/AdminShell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { nome, role } = await requireAdmin();
  return <AdminShell nome={nome} ehDono={role === 'DONO'}>{children}</AdminShell>;
}
