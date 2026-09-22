import { requirePatioAcesso } from '@/lib/services/requirePatioAcesso';

export default async function PatioLayout({ children }: { children: React.ReactNode }) {
  await requirePatioAcesso();
  return <>{children}</>;
}
