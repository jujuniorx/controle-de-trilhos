import { requireAdmin } from '@/lib/services/requireAdmin';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}
